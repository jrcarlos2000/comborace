import type { Address } from '@comborace/sdk/mock';
import type { ComboDef } from '../mock/combos';
import type { CarTick } from '../mock/mockFeed';

export const BUY_IN = 20;

export interface Racer {
  address: Address;
  combo: ComboDef;
  isYou: boolean;
  copiedFrom: string | null;
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function fakeAddress(): Address {
  let out = '';
  while (out.length < 44) out += BASE58[Math.floor(Math.random() * BASE58.length)];
  return out.slice(0, 44);
}

export function shortAddress(a: Address): string {
  return `${a.slice(0, 4)}..${a.slice(-4)}`;
}

export function fieldCombos(field: Racer[]): ComboDef[] {
  return field.map((r) => r.combo);
}

export function racerFor(field: Racer[], comboId: string): Racer | undefined {
  return field.find((r) => r.combo.id === comboId);
}

// Live race standings: cars ranked by win chance (cashed first, crashed last) so each car can
// show its current position number the way a race would.
export function computeStandings(cars: CarTick[]): Map<string, number> {
  const score = (c: CarTick): number => (c.status === 'crashed' ? -1 : c.status === 'cashed' ? 2 : c.pct);
  const ranked = [...cars].sort((a, b) => score(b) - score(a));
  return new Map(ranked.map((c, i) => [c.id, i + 1]));
}

// Full-time resolution. Cashed beats racing beats crashed; the live "if it ends now"
// payout breaks ties, and the multiplier is the final backstop so a total wipeout still
// resolves to the strongest car rather than an arbitrary one.
export function pickWinner(field: Racer[], cars: CarTick[]): Racer {
  const byId = new Map(cars.map((c) => [c.id, c] as const));
  const rank = (c?: CarTick): number => (!c ? -1 : c.status === 'cashed' ? 2 : c.status === 'crashed' ? 0 : 1);
  const scored = [...field].sort((a, b) => {
    const ca = byId.get(a.combo.id);
    const cb = byId.get(b.combo.id);
    const rankDelta = rank(cb) - rank(ca);
    if (rankDelta !== 0) return rankDelta;
    const payoutDelta = (cb?.payoutIfEndsNow ?? 0) - (ca?.payoutIfEndsNow ?? 0);
    if (payoutDelta !== 0) return payoutDelta;
    return b.combo.multiplier - a.combo.multiplier;
  });
  return scored[0] ?? field[0];
}
