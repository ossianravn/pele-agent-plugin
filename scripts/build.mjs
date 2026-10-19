// Bundles the MCP server and copies the board page into plugin/dist/, which is committed so that
// installed plugins run without an npm install.
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);

await rm('plugin/dist', { recursive: true, force: true });
const { metafile } = await build({
  entryPoints: ['src/server.ts'],
  outfile: 'plugin/dist/server.mjs',
  bundle: true,
  minify: true,
  metafile: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  legalComments: 'none',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
await mkdir('plugin/dist/web', { recursive: true });
await cp('web', 'plugin/dist/web', { recursive: true });
await cp(require.resolve('pele/global'), 'plugin/dist/web/pele.global.js');
await cp('LICENSE', 'plugin/LICENSE');
await writeFile('plugin/dist/THIRD_PARTY_LICENSES.txt', await notices(['pele', ...bundledPackages(metafile)]));

function bundledPackages({ inputs }) {
  const names = Object.keys(inputs)
    .map((path) => path.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1])
    .filter(Boolean);
  return [...new Set(names)].sort();
}

async function notices(names) {
  const sections = [];
  for (const name of [...new Set(names)]) {
    const dir = join('node_modules', name);
    const { version, license } = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    const file = (await readdir(dir)).find((entry) => /^licen[cs]e/i.test(entry));
    const text = file ? await readFile(join(dir, file), 'utf8') : `License: ${license}`;
    sections.push(`${name}@${version}\n\n${text.trim()}\n`);
  }
  return sections.join(`\n${'-'.repeat(72)}\n\n`);
}
