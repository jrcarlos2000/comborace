import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, '..');
const PORT = 4188;
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
  // Hide the transient result sheet so the crash-tumble in the lane reads clearly.
  await page.addStyleTag({ content: '.moment-pop{display:none !important}' });

  await page.waitForFunction(() => document.querySelector('.car-crash.is-tumbling') !== null, {
    timeout: 75000,
    polling: 30,
  });
  for (let i = 1; i <= 5; i++) {
    await page.screenshot({ path: resolve(outDir, `tumble-${i}.png`) });
    await sleep(180);
  }
  await sleep(2000);
  await page.screenshot({ path: resolve(outDir, 'wreck-settled.png') });
  console.log(`crash frames saved to ${outDir}`);
} finally {
  if (browser) await browser.close();
  preview.kill('SIGTERM');
}
