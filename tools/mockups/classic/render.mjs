// Renders the Classic-hero design storyboards (Vic Viper, Warriors of Light) to PNG files.
// DESIGN MOCKUPS ONLY: the sprites live in tools/mockups/classic/*.ts and are not registered in the game.
// Usage: node tools/mockups/classic/render.mjs <outDir> [port]
// Starts its own Vite dev server on <port> (default 5183), opens storyboard.html in headless Chromium,
// writes one 768x720 PNG per frame plus vicviper-sheet.png and warriors-sheet.png. Never write the
// output into the repo (CI rejects binary files).
/* global window, Buffer */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const p of [
    'playwright',
    '/opt/node-tools/node_modules/playwright',
    '/usr/local/lib/node_modules_global/playwright',
  ]) {
    try {
      return require(p);
    } catch {
      /* try next */
    }
  }
  throw new Error('playwright not found');
})();

const outDir = process.argv[2];
if (!outDir) throw new Error('usage: node tools/mockups/classic/render.mjs <outDir> [port]');
const port = Number(process.argv[3] ?? 5183);
const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
mkdirSync(outDir, { recursive: true });

const server = await createServer({ root, server: { port, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_BROWSERS_PATH ? {} : { executablePath: '/opt/pw-browsers/chromium' },
);
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://localhost:${port}/tools/mockups/classic/storyboard.html`);
  await page.waitForFunction(() => window.__mock || window.__mockError, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__mockError);
  if (err) throw new Error(err);
  const { frames, sheets } = await page.evaluate(() => window.__mock);
  for (const f of [...frames, ...sheets]) {
    const file = join(outDir, `${f.file}.png`);
    writeFileSync(file, Buffer.from(f.dataUrl.split(',')[1], 'base64'));
    console.log(file);
  }
} finally {
  await browser.close();
  await server.close();
}
