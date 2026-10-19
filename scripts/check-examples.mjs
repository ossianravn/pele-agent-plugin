// Renders every Mermaid example in the skills with the pinned pele, so a pele upgrade
// cannot silently break the syntax the skill teaches agents.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PeleError, render } from 'pele';

let failures = 0;
let count = 0;
for (const entry of await readdir('plugin/skills', { recursive: true })) {
  if (!entry.endsWith('.md')) continue;
  const text = await readFile(join('plugin/skills', entry), 'utf8');
  for (const [, source] of text.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)) {
    count++;
    try {
      render(source);
    } catch (error) {
      if (!(error instanceof PeleError)) throw error;
      failures++;
      console.error(`${entry}: ${error.code}: ${error.message}\n${source}`);
    }
  }
}
console.log(`${count - failures}/${count} skill examples render`);
process.exitCode = failures || count === 0 ? 1 : 0;
