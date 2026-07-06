import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, '..');
const PORT = 4181;
const BASE = `http://127.0.0.1:${PORT}`;
const outDir = resolve(appDir, 'screenshots', 'landing');
mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`server never came up at ${url}`);
}

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  cwd: appDir,
  stdio: 'ignore',
});

let browser;
try {
  await waitForServer(BASE);
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const [label, width, height] of [
    ['desktop-1440', 1440, 900],
    ['mobile-430', 430, 932],
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.body.innerText.includes('Watch a race'), { timeout: 8000 });
    await sleep(900);
    // Above-the-fold hero, motion running.
    await page.screenshot({ path: resolve(outDir, `${label}.png`) });

    // Walk the page so every scroll-reveal IntersectionObserver fires, then return to top so the
    // full-page capture shows all sections instead of the pre-reveal blanks.
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.7;
      for (let y = 0; y <= document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 220));
      }
      window.scrollTo(0, 0);
    });
    await sleep(800);
    await page.screenshot({ path: resolve(outDir, `${label}-full.png`), fullPage: true });
    console.log(`shot ${label}`);
    await page.close();
  }
  console.log(`screenshots saved to ${outDir}`);
} finally {
  if (browser) await browser.close();
  preview.kill('SIGTERM');
}
