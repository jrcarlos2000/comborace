import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, '..');
const round = process.argv[2] ?? '1';
const PORT = 4180;
const BASE = `http://127.0.0.1:${PORT}`;
const outDir = resolve(appDir, 'screenshots', `round${round}`);
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

  // Landing
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.body.innerText.includes('Watch a race'), { timeout: 8000 });
  await sleep(600);
  await page.screenshot({ path: resolve(outDir, 'landing.png') });
  console.log('shot landing');

  // Race (mid-motion). The preview server has no /ws, so the feed falls back to the local
  // mock quickly; wait for cars to spread across the track.
  await clickByText(page, 'Watch a race');
  await sleep(12000);
  await page.screenshot({ path: resolve(outDir, 'race.png') });
  console.log('shot race');

  // Later race frame to catch more spread / a resolved pick.
  await sleep(9000);
  await page.screenshot({ path: resolve(outDir, 'race-late.png') });
  console.log('shot race-late');

  // Lobby draft board
  const page2 = await browser.newPage();
  await page2.goto(BASE, { waitUntil: 'networkidle2' });
  await page2.waitForFunction(() => document.body.innerText.includes('private lobby'), { timeout: 8000 });
  await clickByText(page2, 'Enter a private lobby');
  await page2.waitForFunction(() => document.querySelector('input') !== null, { timeout: 8000 });
  await page2.type('input', 'LOS3');
  await clickByText(page2, 'Join lobby');
  await page2.waitForFunction(() => document.body.innerText.toLowerCase().includes('your turn'), { timeout: 8000 });
  await sleep(700);
  await page2.screenshot({ path: resolve(outDir, 'lobby.png'), fullPage: true });
  console.log('shot lobby');

  console.log(`screenshots saved to ${outDir}`);
} finally {
  if (browser) await browser.close();
  preview.kill('SIGTERM');
}
