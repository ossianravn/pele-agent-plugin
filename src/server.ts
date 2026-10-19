import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Board, projectName } from './board.js';
import { checkDiagram, describeError } from './diagram.js';

const VERSION = '0.1.0';

const INSTRUCTIONS = `Shows Mermaid diagrams to the user on a live page in their browser, rendered by pele.
Use show_diagram when a picture explains work better than prose: a plan, a process, an architecture,
a state machine, a timeline, a comparison, or progress through a task. Reuse the same id to update a
diagram in place as work moves on; the open page refreshes by itself. Mark flowchart or state nodes
with the classes done, active, blocked or todo (for example A[Build]:::active) to show status.`;

const webDir = fileURLToPath(new URL('./web/', import.meta.url));
const board = new Board(webDir, projectName(fileURLToPath(new URL('../', import.meta.url))));

const server = new McpServer({ name: 'pele-board', version: VERSION }, { instructions: INSTRUCTIONS });

server.registerTool(
  'show_diagram',
  {
    title: 'Show diagram',
    description:
      'Validate a Mermaid diagram and show it to the user on the live diagram board, opening the board in ' +
      'their browser if nobody is watching it. Returns syntax errors with line and column instead of showing ' +
      'a broken diagram. Calling again with the same id replaces that diagram in place.',
    inputSchema: {
      title: z.string().min(1).max(120).describe('Short heading shown above the diagram.'),
      source: z.string().min(1).max(50_000).describe('Mermaid source, starting with the diagram header.'),
      id: z
        .string()
        .regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
        .optional()
        .describe('Stable id such as "release-plan". Reuse it to update the diagram. Defaults to the title as a slug.'),
      caption: z.string().max(400).optional().describe('One or two sentences on what to take from the diagram.'),
    },
    outputSchema: {
      url: z.string(),
      id: z.string(),
      type: z.string(),
      revision: z.number(),
      openedBrowser: z.boolean(),
      viewers: z.number(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ title, source, id, caption }) => {
    const checked = checkDiagram(source);
    if (!checked.ok) {
      return { isError: true, content: [{ type: 'text', text: describeError(checked) }] };
    }
    const diagram = board.upsert({ id: id ?? slug(title), title, caption: caption ?? '', source, type: checked.type });
    const openedBrowser = board.reveal();
    const result = {
      url: board.url,
      id: diagram.id,
      type: diagram.type,
      revision: diagram.revision,
      openedBrowser,
      viewers: board.viewerCount,
    };
    const verb = diagram.revision > 1 ? 'Updated' : 'Showed';
    const where = openedBrowser ? 'opened the board in the browser' : `board at ${board.url}`;
    return {
      content: [{ type: 'text', text: `${verb} "${title}" (${diagram.type}, id ${diagram.id}); ${where}.` }],
      structuredContent: result,
    };
  },
);

server.registerTool(
  'remove_diagram',
  {
    title: 'Remove diagram',
    description: 'Remove a diagram from the board when it no longer reflects the work.',
    inputSchema: { id: z.string().describe('The id returned by show_diagram.') },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    const removed = board.remove(id);
    return { content: [{ type: 'text', text: removed ? `Removed ${id}.` : `No diagram with id ${id}.` }] };
  },
);

function slug(title: string): string {
  const base = title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
  return base || 'diagram';
}

await board.start();
await server.connect(new StdioServerTransport());
console.error(`pele-board ${VERSION}: board at ${board.url}`);

const shutdown = () => {
  board.close();
  process.exit(0);
};
process.stdin.on('close', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
