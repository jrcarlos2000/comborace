import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, '..');
const PORT = 4187;
const BASE = `http://127.0.0.1:${PORT}`;
const outDir = resolve(appDir, 'screenshots', '3d');
mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error(`server never came up at ${url}`);
}

async function clickByText(page, text) {
  const handle = await page.evaluateHandle((t) => {
    const els = [...document.querySelectorAll('button, a')];
    return els.find((el) => el.textContent && el.textContent.trim().toLowerCase().includes(t.toLowerCase())) ?? null;
  }, text);
  const el = handle.asElement();
  if (!el) throw new Error(`no clickable element with text "${text}"`);
  await el.click();
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
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.body.innerText.includes('Watch a race'), { timeout: 8000 });
  await clickByText(page, 'Watch a race');

  // Spread shot: let the field fan out across the probability axis with all four 3D heroes up.
  await page.waitForFunction(() => document.querySelectorAll('.car-hero').length >= 4, { timeout: 15000 });
  await sleep(30000);
  await page.screenshot({ path: resolve(outDir, 'race-spread.png') });
  console.log('shot race-spread');

  // Crash tumble: watch for the sprite that starts playing its crash sheet, then grab the arc.
  await page.waitForFunction(() => document.querySelector('.car-crash.is-tumbling') !== null, {
    timeout: 60000,
    polling: 40,
  });
  await page.screenshot({ path: resolve(outDir, 'crash-1.png') });
  await sleep(300);
  await page.screenshot({ path: resolve(outDir, 'crash-2.png') });
  await sleep(320);
  await page.screenshot({ path: resolve(outDir, 'crash-3.png') });
  console.log('shot crash arc');

  await sleep(2200);
  await page.screenshot({ path: resolve(outDir, 'wrecked.png') });
  console.log('shot wrecked');

  console.log(`screenshots saved to ${outDir}`);
} finally {
  if (browser) await browser.close();
  preview.kill('SIGTERM');
}
