// Raw shapes as they land in a recorded JSONL line from scripts/record-match.mjs.
// `odds` and `scores` carry the TxLINE payload shapes documented in docs.yaml (Odds:
// SuperOddsType/MarketParameters/MarketPeriod/PriceNames/Prices/Pct; scores: SoccerFixtureScore
// with per-period SoccerScore subtrees and a SoccerFixtureStatus). They stay `unknown` here so
// the mapping layer is the single place that reads those shapes.

export interface RawSnapshot {
  t: number;
  wallClock?: string;
  odds: unknown;
  scores: unknown;
}

// Decoded, feed-agnostic match state used by the leg-resolution logic. This mirrors the
// MatchState the app mock feeds its estimators (app/src/mock/probability.ts).
export interface DecodedScore {
  minute: number;
  home: number;
  away: number;
  // First-half goals per team (from the H1 sub-score), for first-half markets.
  h1Home: number;
  h1Away: number;
  corners: number;
  cards: number;
  isFullTime: boolean;
  ended: boolean;
}

// Only markets TxLINE prices with a de-vigged Pct: goals totals, team goals, the 1X2 result and
// Asian handicap. Corners, cards and both-teams-to-score carry no Pct, so no leg models them.
export type LegMarketKind = 'totalGoals' | 'teamGoals' | 'matchResult' | 'asianHandicap';

export type LegSide = 'over' | 'under' | 'home' | 'draw' | 'away';

export type MarketPeriod = 'match' | 'firstHalf';

export interface LegMarket {
  kind: LegMarketKind;
  side: LegSide;
  line?: number;
  team?: 'home' | 'away';
  // Full match by default; 'firstHalf' reads the H1 sub-score and the first-half odds period.
  period?: MarketPeriod;
}

export interface LegDescriptor {
  id: string;
  label: string;
  short: string;
  market: LegMarket;
}

export interface ComboDescriptor {
  id: string;
  handle: string;
  color: string;
  colorRgb: string;
  multiplier: number;
  ante: number;
  tagline: string;
  legs: LegDescriptor[];
}
