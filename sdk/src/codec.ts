import { PublicKey } from '@solana/web3.js';
import { USDC_DECIMALS } from './constants.js';
import type { PoolStatus } from './types.js';

// Anchor 8-byte discriminators = sha256("global:<ix>" | "account:<name>")[..8].
// Regenerate from target/idl/combo_race.json after `anchor build`.
export const IX = {
  initPool: Uint8Array.from([116, 233, 199, 204, 115, 159, 171, 36]),
  deposit: Uint8Array.from([242, 35, 198, 137, 82, 225, 242, 182]),
  settle: Uint8Array.from([175, 42, 185, 87, 144, 131, 102, 212]),
  claim: Uint8Array.from([62, 198, 214, 193, 213, 159, 108, 210]),
} as const;

export const ACCOUNT = {
  pool: Uint8Array.from([241, 154, 109, 4, 17, 177, 109, 188]),
  entry: Uint8Array.from([63, 18, 152, 113, 215, 246, 221, 250]),
} as const;

// disc(8) + pool(32) + player(32) + amount(8) + bump(1)
export const ENTRY_SIZE = 81;

const UNIT = 10 ** USDC_DECIMALS;

export function toBaseUnits(usdc: number): bigint {
  return BigInt(Math.round(usdc * UNIT));
}

export function fromBaseUnits(base: bigint): number {
  return Number(base) / UNIT;
}

export function u64(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, value, true);
  return out;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const STATUS: PoolStatus[] = ['open', 'settled', 'paid'];

export interface DecodedPool {
  authority: PublicKey;
  usdcMint: PublicKey;
  vault: PublicKey;
  poolId: bigint;
  buyIn: bigint;
  totalDeposited: bigint;
  playerCount: number;
  status: PoolStatus;
  winner: PublicKey;
  bump: number;
  vaultBump: number;
}

export function decodePool(data: Uint8Array): DecodedPool {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 8;
  const key = (): PublicKey => {
    const k = new PublicKey(data.subarray(o, o + 32));
    o += 32;
    return k;
  };
  const authority = key();
  const usdcMint = key();
  const vault = key();
  const poolId = view.getBigUint64(o, true);
  o += 8;
  const buyIn = view.getBigUint64(o, true);
  o += 8;
  const totalDeposited = view.getBigUint64(o, true);
  o += 8;
  const playerCount = view.getUint32(o, true);
  o += 4;
  const statusByte = view.getUint8(o);
  o += 1;
  const winner = key();
  const bump = view.getUint8(o);
  o += 1;
  const vaultBump = view.getUint8(o);
  return {
    authority,
    usdcMint,
    vault,
    poolId,
    buyIn,
    totalDeposited,
    playerCount,
    status: STATUS[statusByte] ?? 'open',
    winner,
    bump,
    vaultBump,
  };
}

export interface DecodedEntry {
  pool: PublicKey;
  player: PublicKey;
  amount: bigint;
}

export function decodeEntry(data: Uint8Array): DecodedEntry {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const pool = new PublicKey(data.subarray(8, 40));
  const player = new PublicKey(data.subarray(40, 72));
  const amount = view.getBigUint64(72, true);
  return { pool, player, amount };
}
