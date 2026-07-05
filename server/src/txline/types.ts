// Raw shapes as they land in a recorded JSONL line from scripts/record-match.mjs.
// The exact TxLINE field names inside `odds` and `scores` are NOT finalized here: a real
// recorded World Cup match is needed to pin them down. See TODOs in scoreMapping.ts and
// oddsMapping.ts. Everything here stays defensive (unknown / optional) until then.

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
  corners: number;
  cards: number;
  isFullTime: boolean;
  ended: boolean;
}

export type LegMarketKind =
  | 'totalGoals'
  | 'teamGoals'
  | 'totalCorners'
  | 'totalCards'
  | 'btts'
  | 'matchResult';

export type LegSide = 'over' | 'under' | 'yes' | 'no' | 'home' | 'draw' | 'away';

export interface LegMarket {
  kind: LegMarketKind;
  side: LegSide;
  line?: number;
  team?: 'home' | 'away';
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
