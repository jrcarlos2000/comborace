#!/usr/bin/env node
// Generate the public replay: a goals-only scripted match written as raw TxLINE snapshots,
// one { t, odds, scores } per line, exactly the shape scripts/record-match.mjs records and the
// server ReplaySource + MatchEngine consume. The odds carry a de-vigged `Pct` per market and the
// scores carry a SoccerFixtureScore, so replaying this file exercises the real oddsMapping and
// scoreMapping paths rather than a pre-baked MatchTick.
//
// The Pct values are computed from the app's own probability estimators (bundled from
// app/src/mock/probability.ts) so the recorded numbers match the in-app mock feed. The scripted
// arc: three first-half-plus goals build to a split-fate moment at 58' where the over-goals car
// cashes and the under-goals car crashes in the same frame, then home extends at 84' to sink the
// underdog handicap and cash the favorite at the whistle.
//
// Usage: node scripts/generate-sample-match.mjs [--out data/sample-match.jsonl] [--tick-sec 0.45]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ENTRY = path.join(ROOT, 'app', 'src', 'mock', 'probability.ts');
const ESBUILD = path.join(ROOT, 'app', 'node_modules', '.bin', 'esbuild');

const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(args.out || path.join(ROOT, 'data', 'sample-match.jsonl'));
// Seconds between snapshots; the server waits on this delta, so 0.45 gives a ~450ms cadence.
const TICK_SEC = Number(args['tick-sec'] || 0.45);

const WHISTLE = 93;
const END_MINUTE = WHISTLE + 3;

// Scripted goals: minute + scoring side. Mirrors app/src/mock/mockFeed.ts.
const GOALS = [
  { min: 12, team: 'home' },
  { min: 34, team: 'away' },
  { min: 58, team: 'home' },
  { min: 84, team: 'home' },
];

if (!fs.existsSync(ESBUILD)) {
  console.error(`esbuild not found: ${ESBUILD}. Run: cd app && npm install`);
  process.exit(1);
}

const tmp = path.join(os.tmpdir(), `comborace-prob-${process.pid}.mjs`);

try {
  execFileSync(ESBUILD, [ENTRY, '--bundle', '--format=esm', '--platform=node', `--outfile=${tmp}`], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const p = await import(pathToFileURL(tmp).href);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const stream = fs.createWriteStream(OUT, { flags: 'w' });
  let count = 0;

  for (let minute = 0; minute <= END_MINUTE; minute++) {
    const state = matchStateAt(minute);
    const snapshot = {
      t: Number((minute * TICK_SEC).toFixed(3)),
      wallClock: new Date(1500 * minute).toISOString(),
      odds: buildOdds(p, state),
      scores: buildScores(state),
    };
    stream.write(JSON.stringify(snapshot) + '\n');
    count++;
  }

  await new Promise((resolve) => stream.end(resolve));
  console.log(`Generated ${count} raw snapshot(s) -> ${OUT}`);
} finally {
  fs.rmSync(tmp, { force: true });
}

// Running match state at a given minute, in the shape the bundled estimators consume.
function matchStateAt(minute) {
  let home = 0;
  let away = 0;
  let h1Home = 0;
  let h1Away = 0;
  for (const g of GOALS) {
    if (g.min > minute) continue;
    if (g.team === 'home') {
      home++;
      if (g.min <= 45) h1Home++;
    } else {
      away++;
      if (g.min <= 45) h1Away++;
    }
  }
  return {
    minute,
    home,
    away,
    h1Home,
    h1Away,
    firstHalfGoals: h1Home + h1Away,
    corners: 0,
    cards: 0,
    isFullTime: minute >= WHISTLE,
  };
}

// Pct string per the spec: 3 decimal places, 0-100 scale (example in docs.yaml is "52.632").
function pct(x) {
  return (Math.max(0, Math.min(1, x)) * 100).toFixed(3);
}

// One Odds object in the documented shape.
function market(superType, params, period, priceNames, pcts) {
  return {
    FixtureId: 900001,
    Bookmaker: 'TxODDS Stable',
    SuperOddsType: superType,
    MarketParameters: params,
    MarketPeriod: period,
    InRunning: true,
    PriceNames: priceNames,
    Pct: pcts.map(pct),
  };
}

// The full priced menu for one minute. Every server house-car leg reads one of these; the extras
// give the on-screen oracle ticker something to show.
function buildOdds(p, s) {
  const over = (line) => p.overGoals(line, s).pct;
  const res = { home: p.homeWin(s).pct, draw: p.drawResult(s).pct, away: p.awayWin(s).pct };
  const homeCover = p.asianHandicap('home', -1.5, s).pct;
  const homeTeamOver = p.overTeamGoals(1.5, 'home', s).pct;
  const awayTeamOver = p.overTeamGoals(0.5, 'away', s).pct;
  const fhOver = p.firstHalfOverGoals(1.5, s).pct;

  return [
    market('OVERUNDER_PARTICIPANT_GOALS', 'Total;1.5', 'Match', ['Over', 'Under'], [over(1.5), 1 - over(1.5)]),
    market('OVERUNDER_PARTICIPANT_GOALS', 'Total;2.5', 'Match', ['Over', 'Under'], [over(2.5), 1 - over(2.5)]),
    market('OVERUNDER_PARTICIPANT_GOALS', 'Total;3.5', 'Match', ['Over', 'Under'], [over(3.5), 1 - over(3.5)]),
    market('1X2_PARTICIPANT_RESULT', '', 'Match', ['1', 'X', '2'], [res.home, res.draw, res.away]),
    market('OVERUNDER_PARTICIPANT_GOALS', 'Participant1;1.5', 'Match', ['Over', 'Under'], [homeTeamOver, 1 - homeTeamOver]),
    market('OVERUNDER_PARTICIPANT_GOALS', 'Participant2;0.5', 'Match', ['Over', 'Under'], [awayTeamOver, 1 - awayTeamOver]),
    market('ASIANHANDICAP_PARTICIPANT_GOALS', '-1.5', 'Match', ['Home', 'Away'], [homeCover, 1 - homeCover]),
    market('OVERUNDER_PARTICIPANT_GOALS', 'Total;1.5', 'H1', ['Over', 'Under'], [fhOver, 1 - fhOver]),
  ];
}

// SoccerScore subtree.
function score(goals) {
  return { Goals: goals, YellowCards: 0, RedCards: 0, Corners: 0 };
}

// The scores payload in the documented SoccerFixtureScore + SoccerFixtureStatus shape.
function buildScores(s) {
  const h2Home = s.home - s.h1Home;
  const h2Away = s.away - s.h1Away;
  const statusCode = phaseCode(s.minute);
  return {
    fixtureId: 900001,
    gameState: statusCode,
    participant1IsHome: true,
    statusSoccerId: { [statusCode]: {} },
    clock: { running: statusCode === 'H1' || statusCode === 'H2', seconds: s.minute * 60 },
    scoreSoccer: {
      Participant1: {
        H1: score(s.h1Home),
        HT: score(s.h1Home),
        H2: score(h2Home),
        Total: score(s.home),
      },
      Participant2: {
        H1: score(s.h1Away),
        HT: score(s.h1Away),
        H2: score(h2Away),
        Total: score(s.away),
      },
    },
  };
}

function phaseCode(minute) {
  if (minute >= WHISTLE) return 'F';
  if (minute === 0) return 'NS';
  if (minute <= 45) return 'H1';
  if (minute === 46) return 'HT';
  return 'H2';
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
