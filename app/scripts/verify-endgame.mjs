import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, '..');
const PORT = 4181;
const BASE = `http://127.0.0.1:${PORT}`;
const outDir = resolve(appDir, 'screenshots', 'verify');
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await sleep(250);
  }
  throw new Error('server never came up');
}
async function clickByText(page, text) {
  const h = await page.evaluateHandle((t) => [...document.querySelectorAll('button,a')]
    .find((el) => el.textContent?.trim().toLowerCase().includes(t.toLowerCase())) ?? null, text);
  const el = h.asElement();
  if (!el) throw new Error(`no element "${text}"`);
  await el.click();
}

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
  { cwd: appDir, stdio: 'ignore' });
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
  // Scripted split-fate: 3rd goal at ~63s cashes the Over car and crashes the Under car.
  await sleep(64000);
  await page.screenshot({ path: resolve(outDir, 'moment.png') });
  console.log('shot moment (~63 min)');
  // Full time end + result overlay lands after the whistle (~96s).
  await sleep(36000);
  await page.screenshot({ path: resolve(outDir, 'result.png') });
  console.log('shot result (full time)');
} finally {
  if (browser) await browser.close();
  preview.kill('SIGTERM');
}
