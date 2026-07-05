#!/usr/bin/env node
// Capture the app's mock feed to a MatchTick JSONL, one tick per line. This gives the replay
// server a real out-of-the-box fixture whose shape is guaranteed identical to the app feed,
// because it IS the app feed: app/src/mock/mockFeed.ts is bundled and run as-is. Read-only on
// app/; writes only to data/. Regenerate after the UI agent changes the mock.
//
// Usage: node scripts/capture-mock.mjs [--out data/sample-match.jsonl] [--tick-ms 1]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ENTRY = path.join(ROOT, 'app', 'src', 'mock', 'mockFeed.ts');
const ESBUILD = path.join(ROOT, 'app', 'node_modules', '.bin', 'esbuild');

const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(args.out || path.join(ROOT, 'data', 'sample-match.jsonl'));
const TICK_MS = Number(args['tick-ms'] || 1);

if (!fs.existsSync(ENTRY)) {
  console.error(`app mock not found: ${ENTRY}`);
  process.exit(1);
}
if (!fs.existsSync(ESBUILD)) {
  console.error(`esbuild not found: ${ESBUILD}. Run: cd app && npm install`);
  process.exit(1);
}

const tmp = path.join(os.tmpdir(), `comborace-mock-${process.pid}.mjs`);

try {
  execFileSync(ESBUILD, [ENTRY, '--bundle', '--format=esm', '--platform=node', `--outfile=${tmp}`], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  const mod = await import(pathToFileURL(tmp).href);
  const createMockFeed = mod.createMockFeed;
  if (typeof createMockFeed !== 'function') {
    throw new Error('bundled module has no createMockFeed export');
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const stream = fs.createWriteStream(OUT, { flags: 'w' });
  let count = 0;

  await new Promise((resolve) => {
    const feed = createMockFeed({
      tickMs: TICK_MS,
      onTick: (tick) => {
        stream.write(JSON.stringify(tick) + '\n');
        count++;
      },
      onEnd: () => resolve(undefined),
    });
    feed.start();
  });

  await new Promise((resolve) => stream.end(resolve));
  console.log(`Captured ${count} MatchTick(s) -> ${OUT}`);
} finally {
  fs.rmSync(tmp, { force: true });
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      o[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return o;
}
