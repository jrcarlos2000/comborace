#!/usr/bin/env node
// ComboRace - TxLINE match recorder.
// Records one real World Cup fixture to a JSONL of raw { t, wallClock, minute, odds, scores }
// snapshots, exactly the shape the server ReplaySource + txline MatchEngine consume. The public
// MVP runs on replay (the tournament is over during judging), so a completed match is recorded
// once and replayed forever.
//
// Auth: every data call sends BOTH credentials from the free World Cup tier flow (see
// scripts/txline-activate.mjs):
//   Authorization: Bearer <guest JWT>   and   X-Api-Token: <activated API token>
// Credentials load from a session file (default /tmp/comborace-txline-session.json) or from
// TXLINE_TOKEN / TXLINE_API_TOKEN / TXLINE_BASE env vars.
//
// Two modes:
//   live (default)  poll /api/odds/snapshot/{id} + /api/scores/snapshot/{id} every --interval
//                   seconds until the match ends. Use for a match that is in progress.
//   --historical    reconstruct a COMPLETED fixture from /api/scores/historical/{id} (an SSE
//                   stream of the full score sequence) + /api/odds/updates/{id} (the full odds
//                   timeline), resampled to one raw snapshot per match minute. The score at each
//                   minute is the real cumulative Score carried from the latest genuine event;
//                   the odds are the real latest de-vigged markets as of that minute. No values
//                   are invented - only the sampling grid is synthetic.
//
// Usage:
//   node scripts/record-match.mjs --fixture <id> [--historical] [--out data/real-match.jsonl]
//     [--session /tmp/comborace-txline-session.json] [--interval 10] [--max-minutes 150]
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const session = loadSession(args);
const BASE = String(args.base || process.env.TXLINE_BASE || session.apiBase || 'https://txline.txodds.com/api').replace(/\/+$/, '');
const JWT = String(args.token || process.env.TXLINE_TOKEN || session.jwt || '');
const API_TOKEN = String(args['api-token'] || process.env.TXLINE_API_TOKEN || session.apiToken || '');
const FIXTURE = args.fixture || process.env.FIXTURE_ID;
const HISTORICAL = Boolean(args.historical);
const INTERVAL_MS = clampNum(Number(args.interval || 10), 2, 600) * 1000;
const MAX_MINUTES = clampNum(Number(args['max-minutes'] || 150), 1, 600);
const TICK_SEC = Number(args['tick-sec'] || 0.45);
const REQUEST_TIMEOUT_MS = 30000;
const OUT = path.resolve(String(args.out || `data/match-${FIXTURE || 'unknown'}.jsonl`));

if (!FIXTURE) {
  console.error('Missing --fixture <id>. Find one via /api/fixtures/snapshot.');
  printHelp();
  process.exit(1);
}
if (!JWT || !API_TOKEN) {
  console.error('Missing credentials. Run scripts/txline-activate.mjs first, or pass a session file / TXLINE_TOKEN + TXLINE_API_TOKEN.');
  process.exit(1);
}

const headers = {
  Accept: 'application/json',
  Authorization: `Bearer ${JWT}`,
  'X-Api-Token': API_TOKEN,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });

if (HISTORICAL) {
  recordHistorical().catch((e) => {
    console.error('historical record failed:', e && e.message ? e.message : e);
    process.exit(1);
  });
} else {
  recordLive();
}

// ----- historical (completed match) -----

async function recordHistorical() {
  console.log(`Recording completed fixture ${FIXTURE} (historical) -> ${OUT}`);
  const scoreEvents = await fetchScoresHistorical(FIXTURE);
  console.log(`  scores: ${scoreEvents.length} historical event(s)`);
  const oddsUpdates = await fetchJSON(`${BASE}/odds/updates/${FIXTURE}`);
  const odds = Array.isArray(oddsUpdates) ? oddsUpdates.slice().sort((a, b) => num(a.Ts) - num(b.Ts)) : [];
  console.log(`  odds: ${odds.length} update(s)`);

  // Genuine in-play score events: a real Score + a monotonic cumulative Clock. Administrative
  // actions (score_adjustment / action_amend / action_discarded) carry clock resets, so they are
  // dropped by the monotonic-clock guard below.
  const genuine = [];
  let maxSec = -1;
  for (const e of scoreEvents.sort((a, b) => num(e2ts(a)) - num(e2ts(b)))) {
    const score = e.Score ?? e.scoreSoccer;
    const clock = e.Clock ?? e.clock;
    if (!score || !clock) continue;
    const sec = num(clock.Seconds ?? clock.seconds);
    if (!Number.isFinite(sec) || sec <= 0) continue;
    if (sec < maxSec) continue;
    maxSec = sec;
    genuine.push({ ts: num(e2ts(e)), sec, minute: Math.floor(sec / 60), statusId: e.StatusId ?? null, score, raw: e });
  }
  if (genuine.length === 0) throw new Error('no genuine in-play score events found');

  const first = genuine[0];
  const last = genuine[genuine.length - 1];
  const p1IsHome = boolOf(last.raw.Participant1IsHome ?? last.raw.participant1IsHome, true);
  const lastMinute = last.minute;
  const WHISTLE = 93;
  const endMinute = Math.min(Math.max(lastMinute, WHISTLE) + 3, WHISTLE + 3);

  // minute -> real event Ts, for aligning the odds snapshot to each sampled minute.
  const minuteTs = new Map();
  for (const g of genuine) minuteTs.set(g.minute, g.ts);
  const knownMinutes = [...minuteTs.keys()].sort((a, b) => a - b);
  const tsForMinute = (m) => {
    if (minuteTs.has(m)) return minuteTs.get(m);
    let lo = null;
    let hi = null;
    for (const km of knownMinutes) {
      if (km <= m) lo = km;
      if (km >= m) {
        hi = km;
        break;
      }
    }
    if (lo === null) return minuteTs.get(hi);
    if (hi === null) return minuteTs.get(lo);
    const tlo = minuteTs.get(lo);
    const thi = minuteTs.get(hi);
    return Math.round(tlo + ((thi - tlo) * (m - lo)) / (hi - lo));
  };

  const stream = fs.createWriteStream(OUT, { flags: 'w' });
  let count = 0;
  for (let m = 0; m <= endMinute; m++) {
    const state = latestAtMinute(genuine, m) ?? first;
    const ts = tsForMinute(m);
    const ended = m >= WHISTLE;
    const scores = {
      FixtureId: Number(FIXTURE),
      Participant1IsHome: p1IsHome,
      GameState: ended ? 'F' : m < 46 ? 'H1' : 'H2',
      // Real integer game-phase code (2=H1, 3=HT, 4=H2, 5=Ended); the score mapper reads this.
      StatusId: ended ? 5 : m < 45 ? 2 : m === 45 ? 3 : 4,
      Clock: { Running: !ended, Seconds: m * 60 },
      Score: state.score,
    };
    const snapshot = {
      t: Number((count * TICK_SEC).toFixed(3)),
      wallClock: new Date(ts).toISOString(),
      minute: m,
      odds: oddsSnapshotAsOf(odds, ts),
      scores,
    };
    stream.write(JSON.stringify(snapshot) + '\n');
    count++;
  }
  await new Promise((resolve) => stream.end(resolve));

  const homeName = p1IsHome ? last.raw.Participant1 : last.raw.Participant2;
  const awayName = p1IsHome ? last.raw.Participant2 : last.raw.Participant1;
  const hg = num((p1IsHome ? last.score.Participant1 : last.score.Participant2)?.Total?.Goals);
  const ag = num((p1IsHome ? last.score.Participant2 : last.score.Participant1)?.Total?.Goals);
  console.log(`Wrote ${count} snapshot(s). Final: ${homeName ?? 'home'} ${hg} - ${ag} ${awayName ?? 'away'} @ ${new Date(first.ts).toISOString()}`);
}

// Full score sequence as an SSE stream of `data: {...}` lines.
async function fetchScoresHistorical(fixtureId) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS * 4);
  try {
    const r = await fetch(`${BASE}/scores/historical/${fixtureId}`, { headers, signal: controller.signal });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    const text = await r.text();
    const out = [];
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*data:\s*(.*)$/);
      if (m && m[1].trim()) {
        try {
          out.push(JSON.parse(m[1]));
        } catch {
          // partial / non-json data line
        }
      }
    }
    return out;
  } finally {
    clearTimeout(to);
  }
}

// The set of latest markets as of `ts`: one OddsPayload per (type|params|period), trimmed to the
// fields the odds mapper and provenance need.
function oddsSnapshotAsOf(odds, ts) {
  const latest = new Map();
  for (const o of odds) {
    if (num(o.Ts) > ts) break;
    const key = `${o.SuperOddsType}|${o.MarketParameters}|${o.MarketPeriod}`;
    latest.set(key, o);
  }
  return [...latest.values()].map((o) => ({
    FixtureId: o.FixtureId,
    Ts: o.Ts,
    SuperOddsType: o.SuperOddsType,
    MarketParameters: o.MarketParameters,
    MarketPeriod: o.MarketPeriod,
    InRunning: o.InRunning,
    PriceNames: o.PriceNames,
    Prices: o.Prices,
    Pct: o.Pct,
  }));
}

function latestAtMinute(genuine, minute) {
  let hit = null;
  for (const g of genuine) {
    if (g.minute <= minute) hit = g;
    else break;
  }
  return hit;
}

// ----- live (in-progress match) -----

function recordLive() {
  const out = fs.createWriteStream(OUT, { flags: 'a' });
  console.log(`Recording fixture ${FIXTURE} live every ${INTERVAL_MS / 1000}s -> ${OUT}`);
  const startedAt = Date.now();
  let ticks = 0;
  let stopped = false;
  let timer = null;

  async function tick() {
    const [odds, scores] = await Promise.all([
      fetchWithRetry(`${BASE}/odds/snapshot/${FIXTURE}`),
      fetchWithRetry(`${BASE}/scores/snapshot/${FIXTURE}`),
    ]);
    const rec = { t: Math.round((Date.now() - startedAt) / 1000), wallClock: new Date().toISOString(), odds, scores };
    out.write(JSON.stringify(rec) + '\n');
    ticks++;
    const phase = pickPhase(scores);
    console.log(`[tick ${ticks}] t=${rec.t}s phase=${phase}`);
    if (isEnded(phase)) {
      console.log('Match ended, stopping recorder.');
      stopped = true;
    }
    if (rec.t / 60 >= MAX_MINUTES) {
      console.log(`Reached --max-minutes ${MAX_MINUTES}, stopping recorder.`);
      stopped = true;
    }
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
}

// The latest score snapshot is an array of Scores events; its phase is the max StatusId seen.
function pickPhase(scores) {
  if (!scores || scores._error) return '?';
  if (Array.isArray(scores)) {
    let maxId = 0;
    for (const e of scores) if (num(e.StatusId) > maxId) maxId = num(e.StatusId);
    return maxId || '?';
  }
  return scores.StatusId ?? scores.gameState ?? scores.status ?? '?';
}

function isEnded(phase) {
  return phase === 5 || phase === 10 || phase === 13 || /ended|finished|full.?time/i.test(String(phase));
}

// ----- shared helpers -----

async function fetchJSON(url) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers, signal: controller.signal });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
    return await r.json();
  } finally {
    clearTimeout(to);
  }
}

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

function loadSession(a) {
  const p = String(a.session || process.env.TXLINE_SESSION || '/tmp/comborace-txline-session.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function e2ts(e) {
  return e.Ts ?? e.ts ?? 0;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function boolOf(v, fallback) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return fallback;
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
  console.log(`record-match.mjs - record one real TxLINE fixture into a raw-snapshot JSONL

  --fixture <id>       fixture id (or FIXTURE_ID env) [required]
  --historical         reconstruct a COMPLETED match from /scores/historical + /odds/updates
  --out <file>         output path (default data/match-<fixture>.jsonl)
  --session <file>     credentials file (default /tmp/comborace-txline-session.json)
  --interval <sec>     live poll interval, 2-600 (default 10)
  --tick-sec <sec>     synthetic per-snapshot delta written to t (default 0.45)
  --max-minutes <n>    live: stop after n minutes (default 150)
  --base <url>         API base (default from session, else https://txline.txodds.com/api)
  --token <jwt>        guest JWT (or TXLINE_TOKEN env / session)
  --api-token <tok>    activated API token (or TXLINE_API_TOKEN env / session)
  --help

Each line: { t, wallClock, minute, odds, scores }. Replay with the server (SOURCE=replay
REPLAY_FILE=...) or convert to app ticks with scripts/build-app-replay.mjs.`);
}
