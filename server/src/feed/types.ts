// Wire contract for the match feed. These types are the on-the-wire shape the server
// streams over WebSocket and MUST stay identical to app/src/mock/mockFeed.ts (and the
// LegStatus in app/src/mock/probability.ts). The app treats each WS frame as one MatchTick,
// so any drift here breaks the client with no compile-time link between the two packages.

export type LegStatus = 'pending' | 'won' | 'lost';

export type CarStatus = 'racing' | 'crashed' | 'cashed';

export interface LegTick {
  id: string;
  label: string;
  short: string;
  pct: number;
  status: LegStatus;
}

export interface CarTick {
  id: string;
  handle: string;
  color: string;
  colorRgb: string;
  multiplier: number;
  tagline: string;
  status: CarStatus;
  legs: LegTick[];
  pct: number;
  payoutIfEndsNow: number;
}

export type FeedEvent =
  | { type: 'kickoff' }
  | { type: 'halftime' }
  | { type: 'fulltime' }
  | { type: 'goal'; team: 'home' | 'away'; minute: number; score: { home: number; away: number } }
  | { type: 'corner'; minute: number }
  | { type: 'card'; minute: number }
  | { type: 'leg'; carId: string; legId: string; result: 'won' | 'lost'; minute: number; label: string }
  | { type: 'crash'; carId: string; minute: number; deadLegLabel: string }
  | { type: 'cash'; carId: string; minute: number; multiplier: number };

export type MatchPhase = 'first-half' | 'second-half' | 'full-time';

export interface MatchTick {
  minute: number;
  whistle: number;
  phase: MatchPhase;
  score: { home: number; away: number };
  stats: { corners: number; cards: number };
  pot: number;
  cars: CarTick[];
  events: FeedEvent[];
}

export function isMatchTick(value: unknown): value is MatchTick {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.minute === 'number' &&
    typeof v.whistle === 'number' &&
    Array.isArray(v.cars) &&
    typeof v.phase === 'string'
  );
}
