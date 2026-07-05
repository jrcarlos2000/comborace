// Live win-probability models for combo legs.
// Every market here is a GOALS market, because that is what TxLINE prices with a de-vigged
// Pct: over/under total goals, 1X2, Asian handicap, team totals and first-half goals. Corners,
// cards and both-teams-to-score carry no Pct on the feed, so no leg reads them.
// Goals are modeled as Poisson processes over the minutes still to play, so a leg's probability
// drifts smoothly minute to minute and jumps on a goal. This mirrors the real feed: TxLINE
// ships a de-vigged Pct per market, so the recorded Pct values drop straight into the same shape.

export type LegStatus = 'pending' | 'won' | 'lost';

export interface LegEval {
  pct: number;
  status: LegStatus;
}

export interface MatchState {
  minute: number;
  home: number;
  away: number;
  // Goals scored before the first-half whistle, frozen at half time. Drives first-half markets.
  firstHalfGoals: number;
  corners: number;
  cards: number;
  isFullTime: boolean;
}

// Full-time whistle at 90 plus typical stoppage. No extra time counts (sportsbook rule).
export const WHISTLE = 93;
// First-half whistle at 45 plus typical stoppage, the settlement point for first-half markets.
export const FIRST_HALF_WHISTLE = 47;

// Tournament-average goal rates over a full 90, spread across the time still to play.
const TOTAL_GOALS_AVG = 2.7;
const HOME_GOALS_AVG = 1.5;
const AWAY_GOALS_AVG = 1.25;

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function remainingMinutes(minute: number): number {
  return Math.max(0, WHISTLE - minute);
}

function expectedRemaining(avg: number, minute: number): number {
  return avg * (remainingMinutes(minute) / 90);
}

// Goals still expected before the first-half whistle only.
function expectedRemainingFirstHalf(avg: number, minute: number): number {
  return avg * (Math.max(0, FIRST_HALF_WHISTLE - minute) / 90);
}

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

function poissonPmf(k: number, mu: number): number {
  if (mu <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-mu) * Math.pow(mu, k)) / factorial(k);
}

// P(X <= k)
function poissonCdf(k: number, mu: number): number {
  let sum = 0;
  for (let i = 0; i <= k; i++) sum += poissonPmf(i, mu);
  return clamp01(sum);
}

// P(X >= k)
function poissonTail(k: number, mu: number): number {
  if (k <= 0) return 1;
  return clamp01(1 - poissonCdf(k - 1, mu));
}

// Abramowitz and Stegun 7.1.26.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(x: number, mean: number, sd: number): number {
  if (sd <= 0) return x >= mean ? 1 : 0;
  return 0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2)));
}

export function overGoals(line: number, s: MatchState): LegEval {
  const total = s.home + s.away;
  const need = Math.floor(line) + 1;
  if (total >= need) return { pct: 1, status: 'won' };
  if (s.isFullTime) return { pct: 0, status: 'lost' };
  return { pct: poissonTail(need - total, expectedRemaining(TOTAL_GOALS_AVG, s.minute)), status: 'pending' };
}

export function underGoals(line: number, s: MatchState): LegEval {
  const total = s.home + s.away;
  const cap = Math.floor(line);
  if (total > cap) return { pct: 0, status: 'lost' };
  if (s.isFullTime) return { pct: 1, status: 'won' };
  return { pct: poissonCdf(cap - total, expectedRemaining(TOTAL_GOALS_AVG, s.minute)), status: 'pending' };
}

export function overTeamGoals(line: number, team: 'home' | 'away', s: MatchState): LegEval {
  const scored = team === 'home' ? s.home : s.away;
  const avg = team === 'home' ? HOME_GOALS_AVG : AWAY_GOALS_AVG;
  const need = Math.floor(line) + 1;
  if (scored >= need) return { pct: 1, status: 'won' };
  if (s.isFullTime) return { pct: 0, status: 'lost' };
  return { pct: poissonTail(need - scored, expectedRemaining(avg, s.minute)), status: 'pending' };
}

export function firstHalfOverGoals(line: number, s: MatchState): LegEval {
  const need = Math.floor(line) + 1;
  if (s.firstHalfGoals >= need) return { pct: 1, status: 'won' };
  if (s.minute >= FIRST_HALF_WHISTLE) return { pct: 0, status: 'lost' };
  return {
    pct: poissonTail(need - s.firstHalfGoals, expectedRemainingFirstHalf(TOTAL_GOALS_AVG, s.minute)),
    status: 'pending',
  };
}

export function firstHalfUnderGoals(line: number, s: MatchState): LegEval {
  const cap = Math.floor(line);
  if (s.firstHalfGoals > cap) return { pct: 0, status: 'lost' };
  if (s.minute >= FIRST_HALF_WHISTLE) return { pct: 1, status: 'won' };
  return {
    pct: poissonCdf(cap - s.firstHalfGoals, expectedRemainingFirstHalf(TOTAL_GOALS_AVG, s.minute)),
    status: 'pending',
  };
}

// The three 1X2 outcome probabilities, from a normal approximation to the Skellam of the two
// remaining-goals Poissons. Kept as one function so home, draw and away always sum to one.
function resultProbs(s: MatchState): { home: number; draw: number; away: number } {
  const muH = expectedRemaining(HOME_GOALS_AVG, s.minute);
  const muA = expectedRemaining(AWAY_GOALS_AVG, s.minute);
  const mean = s.home - s.away + muH - muA;
  const sd = Math.sqrt(muH + muA + 0.25);
  const home = clamp01(1 - normalCdf(0.5, mean, sd));
  const away = clamp01(normalCdf(-0.5, mean, sd));
  const draw = clamp01(1 - home - away);
  return { home, draw, away };
}

export function homeWin(s: MatchState): LegEval {
  if (s.isFullTime) return s.home > s.away ? { pct: 1, status: 'won' } : { pct: 0, status: 'lost' };
  return { pct: resultProbs(s).home, status: 'pending' };
}

export function awayWin(s: MatchState): LegEval {
  if (s.isFullTime) return s.away > s.home ? { pct: 1, status: 'won' } : { pct: 0, status: 'lost' };
  return { pct: resultProbs(s).away, status: 'pending' };
}

export function drawResult(s: MatchState): LegEval {
  if (s.isFullTime) return s.home === s.away ? { pct: 1, status: 'won' } : { pct: 0, status: 'lost' };
  return { pct: resultProbs(s).draw, status: 'pending' };
}

// Asian handicap on a half line (no push). `line` is the signed handicap applied to `team`
// (a favorite runs -1.5, an underdog +1.5), so the bet wins when the handicap-adjusted margin
// is positive at full time.
export function asianHandicap(team: 'home' | 'away', line: number, s: MatchState): LegEval {
  const teamGoals = team === 'home' ? s.home : s.away;
  const oppGoals = team === 'home' ? s.away : s.home;
  const margin = teamGoals - oppGoals + line;
  if (s.isFullTime) return margin > 0 ? { pct: 1, status: 'won' } : { pct: 0, status: 'lost' };
  const teamAvg = team === 'home' ? HOME_GOALS_AVG : AWAY_GOALS_AVG;
  const oppAvg = team === 'home' ? AWAY_GOALS_AVG : HOME_GOALS_AVG;
  const muTeam = expectedRemaining(teamAvg, s.minute);
  const muOpp = expectedRemaining(oppAvg, s.minute);
  const mean = margin + muTeam - muOpp;
  const sd = Math.sqrt(muTeam + muOpp + 0.25);
  return { pct: clamp01(1 - normalCdf(0, mean, sd)), status: 'pending' };
}
