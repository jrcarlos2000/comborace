import type { LegDescriptor, LegMarket } from './types.js';
import type { LegStatus } from '../feed/types.js';

// TxLINE odds Pct -> per-combo win probability.
//
// TxLINE ships odds with a `Pct` array = de-vigged (demargined) win-probabilities, already
// the "how likely is this outcome" number we want for a car's position. Odds payload fields
// per docs: MarketParameters, MarketPeriod, PriceNames, Prices, Pct. A snapshot carries many
// markets; we pick the one matching each leg (market kind + line + period + team/side) and
// read its Pct entry.
//
// TODO(real-sample): the market-matching below is a best-effort structural walk. Once tonight's
// recorded /api/odds/snapshot lands, replace matchMarketPct with exact reads keyed on the real
// MarketParameters / PriceNames values, then delete this note.

interface MarketLike {
  pct: number[];
  priceNames: string[];
  params: Record<string, unknown>;
  period: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function numArray(value: unknown): number[] {
  if (Array.isArray(value)) return value.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  if (typeof value === 'number' && Number.isFinite(value)) return [value];
  return [];
}

function strArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x));
  if (typeof value === 'string') return [value];
  return [];
}

// Walk an arbitrary odds payload and collect anything that looks like a priced market.
function collectMarkets(node: unknown, acc: MarketLike[], depth = 0): void {
  if (depth > 8) return;
  const rec = asRecord(node);
  if (rec) {
    const pct = numArray(rec['Pct'] ?? rec['pct']);
    if (pct.length > 0) {
      acc.push({
        pct,
        priceNames: strArray(rec['PriceNames'] ?? rec['priceNames']),
        params: asRecord(rec['MarketParameters'] ?? rec['marketParameters']) ?? {},
        period: rec['MarketPeriod'] ?? rec['marketPeriod'],
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
  yes: ['yes', 'gg'],
  no: ['no', 'ng'],
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

// Return the leg's de-vigged win-probability in [0,1], or null if no market matched. Null
// tells the engine to hold the leg's prior pct rather than snap it to a wrong value.
export function matchMarketPct(rawOdds: unknown, leg: LegDescriptor): number | null {
  const markets: MarketLike[] = [];
  collectMarkets(rawOdds, markets);
  if (markets.length === 0) return null;

  // TODO(real-sample): filter `markets` down to the one whose MarketParameters encode this
  // leg's kind + line (+ team/period). For now, pick the first market that exposes a price
  // name matching the leg's side and read that Pct entry.
  for (const mk of markets) {
    const idx = priceIndexForSide(mk.priceNames, leg.market.side);
    if (idx >= 0 && idx < mk.pct.length) {
      return normalizePct(mk.pct[idx]);
    }
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
