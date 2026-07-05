// Live win-probability models for combo legs.
// Goals, corners and cards are modeled as Poisson processes over the minutes still
// to play, so a leg's probability drifts smoothly minute to minute and jumps on events.
// This mirrors what the real feed will feed us: TxLINE ships a de-vigged Pct per market,
// so the Data agent later swaps these estimators for the recorded Pct values, same shape.

export type LegStatus = 'pending' | 'won' | 'lost';

export interface LegEval {
  pct: number;
  status: LegStatus;
}

export interface MatchState {
  minute: number;
  home: number;
  away: number;
  corners: number;
  cards: number;
  isFullTime: boolean;
}

// Full-time whistle at 90 plus typical stoppage. No extra time counts (sportsbook rule).
export const WHISTLE = 93;

// Tournament-average rates over a full 90, spread across the time still to play.
const TOTAL_GOALS_AVG = 2.7;
const HOME_GOALS_AVG = 1.5;
const AWAY_GOALS_AVG = 1.25;
const CORNERS_AVG = 10.2;
const CARDS_AVG = 4.2;

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function remainingMinutes(minute: number): number {
  return Math.max(0, WHISTLE - minute);
}

function expectedRemaining(avg: number, minute: number): number {
  return avg * (remainingMinutes(minute) / 90);
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

export function overCorners(line: number, s: MatchState): LegEval {
  const need = Math.floor(line) + 1;
  if (s.corners >= need) return { pct: 1, status: 'won' };
  if (s.isFullTime) return { pct: 0, status: 'lost' };
  return { pct: poissonTail(need - s.corners, expectedRemaining(CORNERS_AVG, s.minute)), status: 'pending' };
}

export function underCards(line: number, s: MatchState): LegEval {
  const cap = Math.floor(line);
  if (s.cards > cap) return { pct: 0, status: 'lost' };
  if (s.isFullTime) return { pct: 1, status: 'won' };
  return { pct: poissonCdf(cap - s.cards, expectedRemaining(CARDS_AVG, s.minute)), status: 'pending' };
}

export function bttsYes(s: MatchState): LegEval {
  if (s.home >= 1 && s.away >= 1) return { pct: 1, status: 'won' };
  if (s.isFullTime) return { pct: 0, status: 'lost' };
  let p = 1;
  if (s.home < 1) p *= 1 - Math.exp(-expectedRemaining(HOME_GOALS_AVG, s.minute));
  if (s.away < 1) p *= 1 - Math.exp(-expectedRemaining(AWAY_GOALS_AVG, s.minute));
  return { pct: clamp01(p), status: 'pending' };
}

export function homeWin(s: MatchState): LegEval {
  const diff = s.home - s.away;
  // Settles only at the whistle. A draw loses a home-win bet.
  if (s.isFullTime) return diff > 0 ? { pct: 1, status: 'won' } : { pct: 0, status: 'lost' };
  const muH = expectedRemaining(HOME_GOALS_AVG, s.minute);
  const muA = expectedRemaining(AWAY_GOALS_AVG, s.minute);
  const mean = diff + muH - muA;
  const sd = Math.sqrt(muH + muA + 0.25);
  // P(final margin >= 1), normal approximation to Skellam with a continuity correction.
  return { pct: clamp01(1 - normalCdf(0.5, mean, sd)), status: 'pending' };
}

export function awayWin(s: MatchState): LegEval {
  const diff = s.away - s.home;
  if (s.isFullTime) return diff > 0 ? { pct: 1, status: 'won' } : { pct: 0, status: 'lost' };
  const muH = expectedRemaining(HOME_GOALS_AVG, s.minute);
  const muA = expectedRemaining(AWAY_GOALS_AVG, s.minute);
  const mean = diff + muA - muH;
  const sd = Math.sqrt(muH + muA + 0.25);
  return { pct: clamp01(1 - normalCdf(0.5, mean, sd)), status: 'pending' };
}

export function overCards(line: number, s: MatchState): LegEval {
  const need = Math.floor(line) + 1;
  if (s.cards >= need) return { pct: 1, status: 'won' };
  if (s.isFullTime) return { pct: 0, status: 'lost' };
  return { pct: poissonTail(need - s.cards, expectedRemaining(CARDS_AVG, s.minute)), status: 'pending' };
}

export function overTeamGoals(line: number, team: 'home' | 'away', s: MatchState): LegEval {
  const scored = team === 'home' ? s.home : s.away;
  const avg = team === 'home' ? HOME_GOALS_AVG : AWAY_GOALS_AVG;
  const need = Math.floor(line) + 1;
  if (scored >= need) return { pct: 1, status: 'won' };
  if (s.isFullTime) return { pct: 0, status: 'lost' };
  return { pct: poissonTail(need - scored, expectedRemaining(avg, s.minute)), status: 'pending' };
}
