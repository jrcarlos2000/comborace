#!/usr/bin/env node
// Convert a raw TxLINE recording (data/real-match.jsonl) into a client-loadable MatchTick array
// for the STATIC app (app/public/real-match.json). It runs the REAL server txline MatchEngine
// (server/src/txline/engine.ts + the finalized odds/score mappers) over each recorded snapshot,
// so the exported ticks are exactly what the WebSocket server would stream - just baked to a file
// the browser can fetch when no server is present.
//
// Usage: node scripts/build-app-replay.mjs [--in data/real-match.jsonl] [--out app/public/real-match.json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ENTRY = path.join(ROOT, 'server', 'src', 'txline', 'index.ts');
const ESBUILD = path.join(ROOT, 'app', 'node_modules', '.bin', 'esbuild');

const args = parseArgs(process.argv.slice(2));
const IN = path.resolve(args.in || path.join(ROOT, 'data', 'real-match.jsonl'));
const OUT = path.resolve(args.out || path.join(ROOT, 'app', 'public', 'real-match.json'));

if (!fs.existsSync(ESBUILD)) {
  console.error(`esbuild not found: ${ESBUILD}. Run: cd app && npm install`);
  process.exit(1);
}
if (!fs.existsSync(IN)) {
  console.error(`recording not found: ${IN}. Run scripts/record-match.mjs first.`);
  process.exit(1);
}

const tmp = path.join(os.tmpdir(), `comborace-engine-${process.pid}.mjs`);

try {
  execFileSync(ESBUILD, [ENTRY, '--bundle', '--format=esm', '--platform=node', `--outfile=${tmp}`], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const { MatchEngine } = await import(pathToFileURL(tmp).href);
  if (typeof MatchEngine !== 'function') throw new Error('bundled module has no MatchEngine export');

  const lines = fs.readFileSync(IN, 'utf8').split('\n');
  const engine = new MatchEngine();
  const ticks = [];
  let fallbackMinute = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const raw = JSON.parse(trimmed);
    fallbackMinute += 1;
    ticks.push(engine.build(raw, typeof raw.minute === 'number' ? raw.minute : fallbackMinute));
  }
  if (ticks.length === 0) throw new Error('no ticks produced');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(ticks));

  const last = ticks[ticks.length - 1];
  const outcomes = last.cars.map((c) => `${c.handle}:${c.status}`).join(' ');
  console.log(`Wrote ${ticks.length} MatchTick(s) -> ${path.relative(ROOT, OUT)}`);
  console.log(`Final score ${last.score.home}-${last.score.away}; cars: ${outcomes}`);
} finally {
  fs.rmSync(tmp, { force: true });
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return o;
}
