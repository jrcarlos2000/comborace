#!/usr/bin/env node
// ComboRace - replay a recorded JSONL to the terminal (a quick eyeball of a captured match).
// For the browser demo use the server instead (server/ -> SOURCE=replay), which streams the
// same records to the app over WebSocket. This script just prints a per-tick summary.
//
// Accepts either on-disk format, autodetected per line:
//   - a MatchTick object (from scripts/capture-mock.mjs) -> summarized directly
//   - a raw TxLINE snapshot { t, odds, scores } (from record-match.mjs) -> best-effort summary
//
// Usage: node scripts/replay-match.mjs --in data/match-x.jsonl [--speed 20] [--quiet]
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const IN = typeof args.in === 'string' ? path.resolve(args.in) : null;
const SPEED = clampNum(Number(args.speed || 20), 0.1, 1000);
const QUIET = Boolean(args.quiet);

if (!IN) {
  console.error('Missing --in <file.jsonl>');
  printHelp();
  process.exit(1);
}
if (!fs.existsSync(IN)) {
  console.error(`File not found: ${IN}`);
  process.exit(1);
}

const records = fs
  .readFileSync(IN, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l, i) => {
    try {
      return JSON.parse(l);
    } catch {
      console.error(`skip: unparseable line ${i + 1}`);
      return null;
    }
  })
  .filter((r) => r !== null);

if (records.length === 0) {
  console.error('No usable records.');
  process.exit(1);
}

const format = looksLikeTick(records[0]) ? 'matchtick' : 'raw';
console.log(`Replaying ${records.length} record(s) from ${IN} at ${SPEED}x [${format}]\n`);

await run();
console.log('\nReplay complete.');

async function run() {
  let prevT = typeof records[0].t === 'number' ? records[0].t : 0;
  let index = 0;
  for (const rec of records) {
    const t = typeof rec.t === 'number' ? rec.t : index;
    const waitMs = Math.max(0, ((t - prevT) * 1000) / SPEED);
    if (waitMs > 0) await sleep(waitMs);
    prevT = t;
    index++;
    if (!QUIET) console.log(`#${String(index).padStart(4)}  ${summarize(rec)}`);
  }
}

function looksLikeTick(rec) {
  return rec && typeof rec === 'object' && Array.isArray(rec.cars) && typeof rec.minute === 'number';
}

function summarize(rec) {
  if (looksLikeTick(rec)) {
    const alive = rec.cars.filter((c) => c.status === 'racing').length;
    const cashed = rec.cars.filter((c) => c.status === 'cashed').length;
    const lead = [...rec.cars].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
    const score = `${rec.score?.home ?? '?'}-${rec.score?.away ?? '?'}`;
    const leadStr = lead ? `${lead.handle} ${(lead.pct * 100).toFixed(0)}%` : '-';
    return `${String(rec.minute).padStart(2)}' ${rec.phase.padEnd(11)} ${score} pot=${rec.pot} alive=${alive} cashed=${cashed} lead=${leadStr}`;
  }
  const goals = firstGoals(rec.scores);
  const pct = firstPct(rec.odds);
  const err = (rec.odds && rec.odds._error) || (rec.scores && rec.scores._error);
  return `t=${rec.t ?? '?'}s score=${goals} pct=${pct !== null ? (pct > 1 ? pct.toFixed(1) : (pct * 100).toFixed(1)) + '%' : '?'}${err ? ' [feed error]' : ''}`;
}

// TODO(real-sample): replace with exact score-field reads once a real snapshot is recorded.
function firstGoals(scores) {
  if (!scores || typeof scores !== 'object') return '?';
  const h = scores.homeGoals ?? scores.p1Goals ?? scores.homeScore;
  const a = scores.awayGoals ?? scores.p2Goals ?? scores.awayScore;
  if (h !== undefined && a !== undefined) return `${h}-${a}`;
  return '?';
}

function firstPct(odds) {
  if (!odds || typeof odds !== 'object') return null;
  const hit = JSON.stringify(odds).match(/"Pct"\s*:\s*\[?\s*([0-9.]+)/);
  return hit ? Number(hit[1]) : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clampNum(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
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

function printHelp() {
  console.log(`replay-match.mjs - print a per-tick summary of a recorded JSONL

  --in <file>     JSONL to replay (MatchTick lines or raw TxLINE snapshots) [required]
  --speed <x>     playback speed multiplier, 0.1-1000 (default 20)
  --quiet         suppress per-tick lines (timing only)
  --help

For the browser demo, stream the same file through the server:
  cd server && SOURCE=replay REPLAY_FILE=../data/<file>.jsonl npm run dev`);
}
