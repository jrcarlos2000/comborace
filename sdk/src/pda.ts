import { PublicKey } from '@solana/web3.js';
import { u64 } from './codec.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

export function poolPda(programId: PublicKey, authority: PublicKey, poolId: bigint): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([enc('pool'), authority.toBytes(), u64(poolId)], programId);
}

export function vaultPda(programId: PublicKey, pool: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([enc('vault'), pool.toBytes()], programId);
}

export function entryPda(programId: PublicKey, pool: PublicKey, player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([enc('entry'), pool.toBytes(), player.toBytes()], programId);
}
