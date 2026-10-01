// Headless smoke test: serves the production build, drives the game with keyboard input
// and writes screenshots. Usage: node tools/smoke/screenshot.mjs [outDir] [level] [character]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

// Playwright may live in a global install (e.g. the cloud dev container); ESM ignores NODE_PATH.
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
  throw new Error('playwright not found; pnpm add -D playwright');
})();

const outDir = process.argv[2] ?? 'smoke-out';
const level = process.argv[3] ?? '1-1';
const character = process.argv[4] ?? 'mario';
const character2 = process.argv[5] ?? '';
mkdirSync(outDir, { recursive: true });

// Hard stop so a hung page never wedges CI.
const watchdog = setTimeout(() => {
  console.error('smoke test timed out');
  process.exit(2);
}, 90000);

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
  stdio: 'pipe',
  detached: true,
});
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => d.toString().includes('4173') && resolve());
  server.stderr.on('data', (d) => process.stderr.write(d));
  server.on('exit', (code) => reject(new Error(`preview exited ${code}`)));
  setTimeout(() => reject(new Error('preview timeout')), 20000);
});

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--no-proxy-server'], // localhost must not go through any configured proxy
});
try {
  const page = await browser.newPage({ viewport: { width: 768, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outDir, '00-title.png') });
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, '00-options.png') });
  await page.keyboard.press('KeyX');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, '00-select.png') });
  await page.goto(
    `http://localhost:4173/?level=${level}&char=${character}${character2 ? `&char2=${character2}` : ''}`,
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(outDir, '01-intro.png') });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(outDir, '02-start.png') });
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('KeyX');
  await page.waitForTimeout(1200);
  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(outDir, '03-jump.png') });
  await page.keyboard.up('KeyZ');
  await page.waitForTimeout(400);
  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyZ');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(outDir, '04-later.png') });
  await page.keyboard.press('F1');
  await page.waitForTimeout(100);
  await page.screenshot({ path: join(outDir, '05-debug.png') });
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('KeyX');
  if (errors.length) {
    console.error('page errors:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else console.log(`ok: screenshots in ${outDir}`);
} finally {
  // Closing can hang in sandboxed containers; never let cleanup block the exit.
  await Promise.race([browser.close().catch(() => undefined), new Promise((r) => setTimeout(r, 3000))]);
  try {
    process.kill(-server.pid, 'SIGKILL'); // the whole preview process group
  } catch {
    server.kill('SIGKILL');
  }
  clearTimeout(watchdog);
  process.exit(process.exitCode ?? 0);
}
