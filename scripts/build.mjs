// npm run build → dist/extension/ (ready for Load unpacked): the static files in extension/ (no dotfiles,
// such as macOS's .DS_Store) and two bundles, content.js and the background.js service worker.
import { build } from 'esbuild';
import { cp, rm } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export async function buildExtension({ from = `${root}extension`, out = `${root}dist/extension` } = {}) {
  await rm(out, { recursive: true, force: true });
  await cp(from, out, { recursive: true, filter: source => !basename(source).startsWith('.') });
  await build({
    entryPoints: { content: `${root}src/content.js`, background: `${root}src/background.js` },
    outdir: out,
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'chrome120',
    charset: 'utf8',
    legalComments: 'none',
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildExtension();
  console.log('extension → dist/extension/');
}
