#!/usr/bin/env node
// ComboRace - TxLINE live match recorder.
// Polls the TxLINE odds + scores snapshots for one fixture and appends them to a JSONL file so
// a real World Cup match can be replayed later (the public MVP runs on replay; the tournament
// is over during judging). Each line is one raw snapshot: { t, wallClock, odds, scores }.
//
// Usage:
//   TXLINE_TOKEN=<jwt> node scripts/record-match.mjs --fixture <id> [--interval 10] [--out data/x.jsonl]
//     [--max-minutes 150] [--base https://txline.txodds.com]
//
// TODO(real-sample): confirm the free World Cup guest/JWT auth flow, the exact snapshot paths,
// and the JSON shape. The replay/live mapping (server/src/txline) reads Pct + the score
// encoding from what this records, so a real payload finalizes both.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const BASE = String(args.base || process.env.TXLINE_BASE || 'https://txline.txodds.com').replace(/\/+$/, '');
const TOKEN = process.env.TXLINE_TOKEN || (typeof args.token === 'string' ? args.token : '');
const FIXTURE = args.fixture || process.env.FIXTURE_ID;
const INTERVAL_MS = clampNum(Number(args.interval || 10), 2, 600) * 1000;
const MAX_MINUTES = clampNum(Number(args['max-minutes'] || 150), 1, 600);
const REQUEST_TIMEOUT_MS = 15000;
const OUT = path.resolve(String(args.out || `data/match-${FIXTURE || 'unknown'}.jsonl`));

if (!FIXTURE) {
  console.error('Missing --fixture <id>. Find it via the schedule endpoint or the TxLINE docs.');
  printHelp();
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const out = fs.createWriteStream(OUT, { flags: 'a' });

const headers = { Accept: 'application/json' };
if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

console.log(`Recording fixture ${FIXTURE} every ${INTERVAL_MS / 1000}s -> ${OUT}`);
console.log(TOKEN ? 'Auth: Bearer token set' : 'WARNING: no TXLINE_TOKEN (free World Cup may allow guest; set it if calls 401)');

const startedAt = Date.now();
let ticks = 0;
let stopped = false;
let timer = null;

async function fetchJSON(url) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers, signal: controller.signal });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.json();
  } finally {
    clearTimeout(to);
  }
}

// One snapshot fetch with a single retry, so a transient blip does not drop a whole tick.
async function fetchWithRetry(url) {
  try {
    return await fetchJSON(url);
  } catch (first) {
    await sleep(1000);
    try {
      return await fetchJSON(url);
    } catch (second) {
      return { _error: String(second && second.message ? second.message : second), _url: url };
    }
  }
}

async function tick() {
  const [odds, scores] = await Promise.all([
    fetchWithRetry(`${BASE}/api/odds/snapshot/${FIXTURE}`),
    fetchWithRetry(`${BASE}/api/scores/snapshot/${FIXTURE}`),
  ]);
  const rec = {
    t: Math.round((Date.now() - startedAt) / 1000),
    wallClock: new Date().toISOString(),
    odds,
    scores,
  };
  out.write(JSON.stringify(rec) + '\n');
  ticks++;
  const phase = pickPhase(scores);
  const errs = [odds && odds._error, scores && scores._error].filter(Boolean);
  console.log(`[tick ${ticks}] t=${rec.t}s phase=${phase}${errs.length ? ` (errors: ${errs.length})` : ''}`);

  if (isEnded(phase)) {
    console.log('Match ended, stopping recorder.');
    stopped = true;
  }
  if (rec.t / 60 >= MAX_MINUTES) {
    console.log(`Reached --max-minutes ${MAX_MINUTES}, stopping recorder.`);
    stopped = true;
  }
}

// TODO(real-sample): confirm phase field + codes. Docs: 5 = Ended, 13 = Ended after pens.
function pickPhase(scores) {
  if (!scores || scores._error) return '?';
  return scores.phase ?? scores.gamePhase ?? scores.status ?? scores.state ?? '?';
}

function isEnded(phase) {
  return phase === 5 || phase === 13 || /ended|finished|full.?time/i.test(String(phase));
}

async function loop() {
  try {
    await tick();
  } catch (e) {
    console.error('tick error:', e && e.message ? e.message : e);
  }
  if (stopped) {
    shutdown(0);
    return;
  }
  timer = setTimeout(loop, INTERVAL_MS);
}

function shutdown(code) {
  if (timer) clearTimeout(timer);
  out.end(() => process.exit(code));
}

process.on('SIGINT', () => {
  console.log('\nStopped by user.');
  stopped = true;
  shutdown(0);
});
process.on('SIGTERM', () => {
  stopped = true;
  shutdown(0);
});

loop();

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
  console.log(`record-match.mjs - poll TxLINE snapshots for one fixture into a JSONL

  --fixture <id>       fixture id (or FIXTURE_ID env) [required]
  --interval <sec>     poll interval, 2-600 (default 10)
  --out <file>         output path (default data/match-<fixture>.jsonl)
  --max-minutes <n>    stop after n minutes of recording (default 150)
  --base <url>         API base (default https://txline.txodds.com)
  --token <jwt>        auth token (or TXLINE_TOKEN env)
  --help

Each line: { t, wallClock, odds, scores }. Replay with server (SOURCE=replay REPLAY_FILE=...)
or scripts/replay-match.mjs.`);
}
