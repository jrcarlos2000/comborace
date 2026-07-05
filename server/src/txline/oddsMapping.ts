import type { LegDescriptor, LegMarket } from './types.js';
import type { LegStatus } from '../feed/types.js';

// TxLINE odds Pct -> per-combo win probability.
//
// Per docs.yaml each Odds object carries SuperOddsType (the market kind, e.g.
// OVERUNDER_PARTICIPANT_GOALS, 1X2_PARTICIPANT_RESULT, ASIANHANDICAP_PARTICIPANT_GOALS),
// MarketParameters (the line and which participant), MarketPeriod (full match vs first half),
// PriceNames (the outcome labels, e.g. Over/Under or 1/X/2 or Home/Away) and a parallel `Pct`
// array. `Pct` is the de-vigged (demargined) win-probability already, the exact "how likely is
// this outcome" number a car's position wants. A snapshot carries many markets; we pick the one
// matching a leg's kind + line + participant + period and read its Pct at the leg's price index.

interface Market {
  superType: string;
  params: string;
  period: string;
  priceNames: string[];
  pct: number[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function numArray(value: unknown): number[] {
  if (Array.isArray(value)) return value.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  if (typeof value === 'number' && Number.isFinite(value)) return [value];
  if (typeof value === 'string' && Number.isFinite(Number(value))) return [Number(value)];
  return [];
}

function strArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x));
  if (typeof value === 'string') return [value];
  return [];
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
}

// Walk an arbitrary odds payload (an array of Odds, or an envelope wrapping one) and collect
// every priced market. A market is any node carrying a Pct array alongside its price names.
function collectMarkets(node: unknown, acc: Market[], depth = 0): void {
  if (depth > 8) return;
  const rec = asRecord(node);
  if (rec) {
    const pct = numArray(rec['Pct'] ?? rec['pct']);
    if (pct.length > 0) {
      acc.push({
        superType: str(rec['SuperOddsType'] ?? rec['superOddsType']).toUpperCase(),
        params: str(rec['MarketParameters'] ?? rec['marketParameters']),
        period: str(rec['MarketPeriod'] ?? rec['marketPeriod']),
        priceNames: strArray(rec['PriceNames'] ?? rec['priceNames']),
        pct,
      });
    }
    for (const v of Object.values(rec)) collectMarkets(v, acc, depth + 1);
    return;
  }
  if (Array.isArray(node)) for (const v of node) collectMarkets(v, acc, depth + 1);
}

const SIDE_HINTS: Record<string, string[]> = {
  over: ['over', 'o', 'more'],
  under: ['under', 'u', 'less'],
  home: ['home', '1', 'p1'],
  draw: ['draw', 'x'],
  away: ['away', '2', 'p2'],
};

function priceIndexForSide(priceNames: string[], side: LegMarket['side']): number {
  const hints = SIDE_HINTS[side] ?? [];
  for (let i = 0; i < priceNames.length; i++) {
    const name = priceNames[i].toLowerCase();
    if (hints.some((h) => name === h || name.startsWith(h))) return i;
  }
  return -1;
}

// The signed line encoded in MarketParameters (the last number in the string).
function lineOf(params: string): number | null {
  const matches = params.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  return Number(matches[matches.length - 1]);
}

// Which participant a market scores, from the MarketParameters tokens. A market with no
// participant token (or a "total" / "match" token) is the aggregate market.
function participantOf(params: string): 'home' | 'away' | 'total' {
  const p = params.toLowerCase();
  if (/(participant1|\bp1\b|home)/.test(p)) return 'home';
  if (/(participant2|\bp2\b|away)/.test(p)) return 'away';
  return 'total';
}

function periodOf(marketPeriod: string): 'match' | 'firstHalf' {
  return /(h1|1h|first|1st)/i.test(marketPeriod) ? 'firstHalf' : 'match';
}

function familyMatches(superType: string, kind: LegMarket['kind']): boolean {
  switch (kind) {
    case 'totalGoals':
    case 'teamGoals':
      return superType.includes('OVERUNDER') || superType.includes('OVER_UNDER') || superType.includes('TOTAL');
    case 'matchResult':
      return superType.includes('1X2') || superType.includes('RESULT') || superType.includes('MATCHODDS');
    case 'asianHandicap':
      return superType.includes('HANDICAP');
    default:
      return false;
  }
}

// Return the leg's de-vigged win-probability in [0,1], or null if no market matched. Null tells
// the engine to hold the leg's prior pct rather than snap it to a wrong value.
export function matchMarketPct(rawOdds: unknown, leg: LegDescriptor): number | null {
  const markets: Market[] = [];
  collectMarkets(rawOdds, markets);
  if (markets.length === 0) return null;

  const m = leg.market;
  const wantPeriod = m.period === 'firstHalf' ? 'firstHalf' : 'match';
  const wantParticipant = m.kind === 'teamGoals' ? m.team ?? 'home' : 'total';
  const lineScoped = m.kind === 'totalGoals' || m.kind === 'teamGoals' || m.kind === 'asianHandicap';

  for (const mk of markets) {
    if (!familyMatches(mk.superType, m.kind)) continue;
    if (periodOf(mk.period) !== wantPeriod) continue;
    if ((m.kind === 'totalGoals' || m.kind === 'teamGoals') && participantOf(mk.params) !== wantParticipant) continue;
    if (lineScoped && m.line !== undefined) {
      const line = lineOf(mk.params);
      if (line === null || Math.abs(Math.abs(line) - m.line) > 1e-6) continue;
    }
    const idx = priceIndexForSide(mk.priceNames, m.side);
    if (idx >= 0 && idx < mk.pct.length) return normalizePct(mk.pct[idx]);
  }
  return null;
}

// TxLINE Pct may arrive as 0-100 or already 0-1; normalize to a [0,1] probability.
export function normalizePct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  const p = pct > 1 ? pct / 100 : pct;
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

// Combine resolved leg statuses + live per-leg probabilities into a combo's cash probability.
// A won leg contributes 1, a lost leg 0 (the combo is dead), pending legs multiply their Pct.
export function comboPct(legPcts: number[], statuses: LegStatus[]): number {
  let product = 1;
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i] === 'lost') return 0;
    if (statuses[i] === 'won') continue;
    product *= legPcts[i] ?? 0;
  }
  return product < 0 ? 0 : product > 1 ? 1 : product;
}
