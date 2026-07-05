import { MAINNET_USDC_MINT } from './constants.js';
import type {
  Address,
  ClaimParams,
  ComboRaceClientInterface,
  CreatePoolParams,
  CreatePoolResult,
  JoinPoolParams,
  PoolState,
  SettleParams,
  TxResult,
} from './types.js';

export * from './types.js';

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function fakeAddress(prefix = ''): Address {
  let out = prefix;
  while (out.length < 44) out += BASE58[Math.floor(Math.random() * BASE58.length)];
  return out.slice(0, 44);
}

export interface MockComboRaceOptions {
  // Artificial round-trip delay per call, to mimic wallet confirmation in the UI.
  latencyMs?: number;
  // Pre-seed lobbies so the UI can boot straight into a populated pool.
  pools?: Array<Partial<PoolState> & { buyIn: number; authority: Address }>;
}

// Faithful in-memory reimplementation of the escrow state machine. No RPC, no wallet,
// no deployed program. Same interface as ComboRaceClient so the UI and integration layer
// swap one for the other without touching call sites.
export class MockComboRaceClient implements ComboRaceClientInterface {
  private readonly pools = new Map<Address, PoolState>();
  private readonly latencyMs: number;
  private sig = 0;

  constructor(options: MockComboRaceOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    for (const seed of options.pools ?? []) this.seedPool(seed);
  }

  seedPool(seed: Partial<PoolState> & { buyIn: number; authority: Address }): PoolState {
    const address = seed.address ?? fakeAddress('Pool');
    const players = seed.players ?? [];
    const pool: PoolState = {
      address,
      poolId: seed.poolId ?? Math.floor(Math.random() * 1_000_000),
      authority: seed.authority,
      usdcMint: seed.usdcMint ?? MAINNET_USDC_MINT,
      vault: seed.vault ?? fakeAddress('Valt'),
      buyIn: seed.buyIn,
      pot: seed.pot ?? players.length * seed.buyIn,
      playerCount: seed.playerCount ?? players.length,
      players,
      status: seed.status ?? 'open',
      winner: seed.winner ?? null,
    };
    this.pools.set(address, pool);
    return pool;
  }

  reset(): void {
    this.pools.clear();
  }

  async createPool(params: CreatePoolParams): Promise<CreatePoolResult> {
    await this.tick();
    if (params.buyIn <= 0) throw new Error('buyIn must be greater than zero');
    const seed: Partial<PoolState> & { buyIn: number; authority: Address } = {
      authority: params.authority,
      buyIn: params.buyIn,
    };
    if (params.poolId !== undefined) seed.poolId = params.poolId;
    if (params.usdcMint !== undefined) seed.usdcMint = params.usdcMint;
    const pool = this.seedPool(seed);
    return { signature: this.nextSig('create'), pool: pool.address };
  }

  async joinPool(params: JoinPoolParams): Promise<TxResult> {
    await this.tick();
    const pool = this.require(params.pool);
    if (pool.status !== 'open') throw new Error('pool is not open for deposits');
    if (pool.players.some((e) => e.player === params.player)) {
      throw new Error('player already joined this pool');
    }
    pool.players.push({ player: params.player, amount: pool.buyIn });
    pool.playerCount += 1;
    pool.pot += pool.buyIn;
    return { signature: this.nextSig('join') };
  }

  async settle(params: SettleParams): Promise<TxResult> {
    await this.tick();
    const pool = this.require(params.pool);
    if (pool.status !== 'open') throw new Error('pool is not open');
    if (pool.authority !== params.authority) throw new Error('signer is not the pool authority');
    if (!pool.players.some((e) => e.player === params.winner)) {
      throw new Error('winner is not a player in this pool');
    }
    pool.winner = params.winner;
    pool.status = 'settled';
    return { signature: this.nextSig('settle') };
  }

  async claim(params: ClaimParams): Promise<TxResult> {
    await this.tick();
    const pool = this.require(params.pool);
    if (pool.status !== 'settled') throw new Error('pool has not been settled');
    if (pool.winner !== params.winner) throw new Error('signer is not the settled winner');
    pool.status = 'paid';
    return { signature: this.nextSig('claim') };
  }

  async getPool(pool: Address): Promise<PoolState | null> {
    await this.tick();
    const found = this.pools.get(pool);
    return found ? structuredClone(found) : null;
  }

  private require(pool: Address): PoolState {
    const found = this.pools.get(pool);
    if (!found) throw new Error(`unknown pool ${pool}`);
    return found;
  }

  private nextSig(tag: string): string {
    this.sig += 1;
    return `mock-${tag}-${this.sig}`;
  }

  private tick(): Promise<void> {
    if (this.latencyMs <= 0) return Promise.resolve();
    return new Promise((r) => setTimeout(r, this.latencyMs));
  }
}
