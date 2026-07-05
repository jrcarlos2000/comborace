// Public contract shared by the real on-chain client and the in-memory mock.
// Addresses cross this boundary as base58 strings so the surface stays JSON
// serializable and the mock carries zero Solana dependencies. USDC amounts cross
// as human-readable major units (5 = 5 USDC); the on-chain client converts to and
// from 6-decimal base units internally.

export type Address = string;

export type PoolStatus = 'open' | 'settled' | 'paid';

export interface PoolEntry {
  player: Address;
  amount: number;
}

export interface PoolState {
  address: Address;
  poolId: number;
  authority: Address;
  usdcMint: Address;
  vault: Address;
  buyIn: number;
  pot: number;
  playerCount: number;
  players: PoolEntry[];
  status: PoolStatus;
  winner: Address | null;
}

export interface CreatePoolParams {
  authority: Address;
  buyIn: number;
  poolId?: number;
  usdcMint?: Address;
}

export interface JoinPoolParams {
  pool: Address;
  player: Address;
}

export interface SettleParams {
  pool: Address;
  authority: Address;
  winner: Address;
}

export interface ClaimParams {
  pool: Address;
  winner: Address;
}

export interface TxResult {
  signature: string;
}

export interface CreatePoolResult extends TxResult {
  pool: Address;
}

export interface ComboRaceClientInterface {
  createPool(params: CreatePoolParams): Promise<CreatePoolResult>;
  joinPool(params: JoinPoolParams): Promise<TxResult>;
  settle(params: SettleParams): Promise<TxResult>;
  claim(params: ClaimParams): Promise<TxResult>;
  getPool(pool: Address): Promise<PoolState | null>;
}
