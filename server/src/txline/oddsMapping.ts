import type { LegDescriptor, LegMarket } from './types.js';
import type { LegStatus } from '../feed/types.js';

// TxLINE odds Pct -> per-combo win probability.
//
// Shapes are finalized against a REAL recorded World Cup fixture (Mexico vs England,
// txline-dev, fixture 18192996). Each element of the odds array is one priced market:
//   SuperOddsType     e.g. OVERUNDER_PARTICIPANT_GOALS, ASIANHANDICAP_PARTICIPANT_GOALS,
//                     1X2_PARTICIPANT_RESULT
//   MarketParameters  "line=1.5" for totals/handicaps (the signed line on Participant1 for a
//                     handicap), null for 1X2. The demargined feed carries only total-goal
//                     over/under (no per-participant totals), so teamGoals legs find no market.
//   MarketPeriod      null = full match, "half=1" = first half, "et"/"penalties"/"et,half=1"
//                     = extra periods we ignore.
//   PriceNames        ["over","under"] | ["part1","part2"] | ["part1","draw","part2"]
//   Pct               de-vigged win-probability per outcome, as a string "44.346" (0-100 scale)
//                     or "NA" for split (quarter) handicap lines. Parallel to PriceNames.
// A snapshot carries many markets; we pick the one matching a leg's kind + line + participant +
// period and read its Pct at the leg's outcome index. The synthetic sample feed
// (scripts/generate-sample-match.mjs) uses the documented PascalCase variants (MarketParameters
// "Total;1.5" / "Participant1;1.5", PriceNames "Over"/"Home"), so both encodings are accepted.

interface Market {
  superType: string;
  params: string;
  period: string;
  priceNames: string[];
  // Parallel to priceNames; a non-finite entry means the feed sent "NA" for that outcome.
  pct: number[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

// Parse a Pct-style array keeping index alignment with PriceNames: "NA" or any non-numeric entry
// becomes NaN in place rather than being dropped, so outcome i still lines up with price i.
function pctArray(value: unknown): number[] {
  if (Array.isArray(value)) return value.map((x) => Number(x));
  if (typeof value === 'number') return [value];
  if (typeof value === 'string') return [Number(value)];
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

// Walk an arbitrary odds payload (an array of markets, or an envelope wrapping one) and collect
// every priced market. A market is any node carrying a Pct array alongside its price names.
function collectMarkets(node: unknown, acc: Market[], depth = 0): void {
  if (depth > 8) return;
  const rec = asRecord(node);
  if (rec) {
    const rawPct = rec['Pct'] ?? rec['pct'];
    if (rawPct !== undefined) {
      const pct = pctArray(rawPct);
      if (pct.length > 0) {
        acc.push({
          superType: str(rec['SuperOddsType'] ?? rec['superOddsType']).toUpperCase(),
          params: str(rec['MarketParameters'] ?? rec['marketParameters']),
          period: str(rec['MarketPeriod'] ?? rec['marketPeriod']),
          priceNames: strArray(rec['PriceNames'] ?? rec['priceNames']),
          pct,
        });
      }
    }
    for (const v of Object.values(rec)) collectMarkets(v, acc, depth + 1);
    return;
  }
  if (Array.isArray(node)) for (const v of node) collectMarkets(v, acc, depth + 1);
}

// Outcome-name hints per leg side. The real feed labels sides part1/part2; the synthetic feed uses
// Home/Away/1/2. Draw is x on some feeds. Matched by exact-or-prefix against the lowercased name.
const SIDE_HINTS: Record<string, string[]> = {
  over: ['over', 'o', 'more'],
  under: ['under', 'u', 'less'],
  home: ['part1', 'home', 'p1', '1'],
  draw: ['draw', 'x'],
  away: ['part2', 'away', 'p2', '2'],
};

function priceIndexForSide(priceNames: string[], side: LegMarket['side']): number {
  const hints = SIDE_HINTS[side] ?? [];
  // Prefer an exact match (so "part1" is not shadowed by the "1" prefix hint) before a prefix.
  for (let i = 0; i < priceNames.length; i++) {
    const name = priceNames[i].toLowerCase();
    if (hints.some((h) => name === h)) return i;
  }
  for (let i = 0; i < priceNames.length; i++) {
    const name = priceNames[i].toLowerCase();
    if (hints.some((h) => name.startsWith(h))) return i;
  }
  return -1;
}

// The signed line encoded in MarketParameters (the last number in the string): "line=1.5" -> 1.5,
// "line=-1.5" -> -1.5, "Total;1.5" -> 1.5, "-1.5" -> -1.5.
function lineOf(params: string): number | null {
  const matches = params.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  return Number(matches[matches.length - 1]);
}

// Which participant an over/under market scores, from the MarketParameters tokens. The real feed's
// total-goals markets carry only "line=N" (no participant), so they read as the aggregate total.
function participantOf(params: string): 'home' | 'away' | 'total' {
  const p = params.toLowerCase();
  if (/(participant1|\bp1\b|part1|home)/.test(p)) return 'home';
  if (/(participant2|\bp2\b|part2|away)/.test(p)) return 'away';
  return 'total';
}

// full match | firstHalf | other. "half=1" or an h1/first token is the first half; extra time and
// penalties are markets we never read; anything else (including null) is the full match.
function periodOf(marketPeriod: string): 'match' | 'firstHalf' | 'other' {
  const p = marketPeriod.toLowerCase().trim();
  if (p === '' || p === 'null' || p === 'match' || p === 'half=0') return 'match';
  if (/(\bet\b|penalt)/.test(p)) return 'other';
  if (/(half=1|h1|1h|first|1st)/.test(p)) return 'firstHalf';
  return 'match';
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

// Return the leg's de-vigged win-probability in [0,1], or null if no usable market matched. Null
// tells the engine to hold the leg's prior pct rather than snap it to a wrong value. A matched
// market whose outcome Pct is "NA" (split handicap) is also treated as no data.
export function matchMarketPct(rawOdds: unknown, leg: LegDescriptor): number | null {
  const markets: Market[] = [];
  collectMarkets(rawOdds, markets);
  if (markets.length === 0) return null;

  const m = leg.market;
  const wantPeriod = m.period === 'firstHalf' ? 'firstHalf' : 'match';

  for (const mk of markets) {
    if (!familyMatches(mk.superType, m.kind)) continue;
    if (periodOf(mk.period) !== wantPeriod) continue;

    let idx = -1;
    if (m.kind === 'matchResult') {
      idx = priceIndexForSide(mk.priceNames, m.side);
    } else if (m.kind === 'asianHandicap') {
      // MarketParameters encodes the line on Participant1 (home). A leg on the away side of a
      // +L handicap is the same market as home at -L, so flip the sign when the leg is away.
      const team = m.team === 'away' ? 'away' : 'home';
      const wantP1Line = team === 'home' ? m.line ?? 0 : -(m.line ?? 0);
      const line = lineOf(mk.params);
      if (line === null || Math.abs(line - wantP1Line) > 1e-6) continue;
      idx = priceIndexForSide(mk.priceNames, team);
    } else {
      const wantParticipant = m.kind === 'teamGoals' ? m.team ?? 'home' : 'total';
      if (participantOf(mk.params) !== wantParticipant) continue;
      if (m.line !== undefined) {
        const line = lineOf(mk.params);
        if (line === null || Math.abs(Math.abs(line) - m.line) > 1e-6) continue;
      }
      idx = priceIndexForSide(mk.priceNames, m.side);
    }

    if (idx < 0 || idx >= mk.pct.length) continue;
    const p = mk.pct[idx];
    if (!Number.isFinite(p)) continue;
    return normalizePct(p);
  }
  return null;
}

// TxLINE Pct arrives on a 0-100 scale ("44.346"); normalize to a [0,1] probability. Already-[0,1]
// inputs pass through so a future real-time feed that ships fractions still maps correctly.
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
