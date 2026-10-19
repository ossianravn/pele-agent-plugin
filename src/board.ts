import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { basename, isAbsolute, join, relative, sep } from 'node:path';

export interface Diagram {
  id: string;
  title: string;
  caption: string;
  source: string;
  type: string;
  revision: number;
  updatedAt: string;
}

const ASSETS: Record<string, string> = {
  '/': 'index.html',
  '/board.css': 'board.css',
  '/board.js': 'board.js',
  '/pele.global.js': 'pele.global.js',
};

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  'img-src * data:',
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

// A new browser tab takes a moment to connect; don't open a second one meanwhile.
const REOPEN_AFTER_MS = 15_000;

/** The live page that shows this session's diagrams. One board per MCP server process. */
export class Board {
  private readonly diagrams = new Map<string, Diagram>();
  private readonly viewers = new Set<ServerResponse>();
  private readonly server = createServer((req, res) => void this.handle(req, res));
  private port = 0;
  private lastOpenedAt = 0;

  constructor(
    private readonly webDir: string,
    private readonly project: string,
  ) {}

  get url(): string {
    return `http://127.0.0.1:${this.port}/`;
  }

  async start(): Promise<void> {
    const preferred = Number(process.env.PELE_BOARD_PORT) || 0;
    try {
      await this.listen(preferred);
    } catch (error) {
      // Windows reserves port ranges that report EADDRINUSE even when nothing listens there.
      if (preferred === 0) throw error;
      console.error(`pele-board: port ${preferred} unavailable (${(error as Error).message}); using a free port`);
      await this.listen(0);
    }
    this.port = (this.server.address() as AddressInfo).port;
  }

  private listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, '127.0.0.1', () => {
        this.server.off('error', reject);
        resolve();
      });
    });
  }

  upsert(input: Omit<Diagram, 'revision' | 'updatedAt'>): Diagram {
    const previous = this.diagrams.get(input.id);
    const diagram = { ...input, revision: (previous?.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
    this.diagrams.set(diagram.id, diagram);
    this.broadcast('upsert', diagram);
    return diagram;
  }

  remove(id: string): boolean {
    const existed = this.diagrams.delete(id);
    if (existed) this.broadcast('remove', { id });
    return existed;
  }

  get viewerCount(): number {
    return this.viewers.size;
  }

  /** Opens the board in the default browser unless someone is already watching it. */
  reveal(): boolean {
    if (this.viewers.size > 0 || process.env.PELE_BOARD_NO_OPEN === '1') return false;
    if (Date.now() - this.lastOpenedAt < REOPEN_AFTER_MS) return false;
    this.lastOpenedAt = Date.now();
    const [command, args] =
      process.platform === 'win32'
        ? ['rundll32', ['url.dll,FileProtocolHandler', this.url]]
        : [process.platform === 'darwin' ? 'open' : 'xdg-open', [this.url]];
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', (error) => console.error(`pele-board: could not open a browser: ${error.message}`));
    child.unref();
    return true;
  }

  close(): void {
    for (const viewer of this.viewers) viewer.end();
    this.server.close();
  }

  private broadcast(event: string, data: unknown): void {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const viewer of this.viewers) viewer.write(frame);
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Rejects DNS-rebinding requests from other sites that resolve to this port.
    const host = req.headers.host ?? '';
    if (host !== `127.0.0.1:${this.port}` && host !== `localhost:${this.port}`) {
      res.writeHead(403).end();
      return;
    }
    const path = new URL(req.url ?? '/', this.url).pathname;
    if (req.method !== 'GET') {
      res.writeHead(405).end();
    } else if (path === '/events') {
      this.subscribe(req, res);
    } else if (ASSETS[path]) {
      await this.serveAsset(ASSETS[path], res);
    } else {
      res.writeHead(404).end();
    }
  }

  private subscribe(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    const snapshot = { project: this.project, diagrams: [...this.diagrams.values()] };
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
    this.viewers.add(res);
    req.on('close', () => this.viewers.delete(res));
  }

  private async serveAsset(file: string, res: ServerResponse): Promise<void> {
    try {
      const body = await readFile(join(this.webDir, file));
      res.writeHead(200, {
        'Content-Type': CONTENT_TYPES[file.split('.').pop()!],
        'Content-Security-Policy': CSP,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      });
      res.end(body);
    } catch (error) {
      console.error(`pele-board: missing asset ${file}: ${(error as Error).message}`);
      res.writeHead(500).end();
    }
  }
}

/** Names the board after the user's project. Hosts that start servers in the plugin folder get no name. */
export function projectName(pluginRoot: string): string {
  const dir = process.env.PELE_BOARD_PROJECT || process.cwd();
  const fromPlugin = relative(pluginRoot, dir);
  const insidePlugin = !isAbsolute(fromPlugin) && fromPlugin.split(sep)[0] !== '..';
  if (!process.env.PELE_BOARD_PROJECT && insidePlugin) return '';
  return basename(dir);
}
