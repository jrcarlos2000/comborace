import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  type AccountMeta,
  type Commitment,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { MAINNET_USDC_MINT, PROGRAM_ID } from './constants.js';
import {
  ENTRY_SIZE,
  IX,
  concatBytes,
  decodeEntry,
  decodePool,
  fromBaseUnits,
  toBaseUnits,
  u64,
  type DecodedPool,
} from './codec.js';
import { entryPda, poolPda, vaultPda } from './pda.js';
import type {
  Address,
  ClaimParams,
  ComboRaceClientInterface,
  CreatePoolParams,
  CreatePoolResult,
  JoinPoolParams,
  PoolState,
  PoolStatus,
  SettleParams,
  TxResult,
} from './types.js';

export * from './types.js';

export interface Wallet {
  publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
}

export interface ComboRaceClientOptions {
  connection: Connection;
  wallet: Wallet;
  programId?: Address;
  usdcMint?: Address;
  commitment?: Commitment;
}

const meta = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean): AccountMeta => ({
  pubkey,
  isSigner,
  isWritable,
});

// On-chain client. Wraps @solana/web3.js and the combo_race program with hand-encoded
// Anchor instructions, so it carries no IDL and no @coral-xyz/anchor runtime. Untested
// end to end until the program is built and deployed (see ../program/README.md); swap
// MockComboRaceClient in for UI work until then.
export class ComboRaceClient implements ComboRaceClientInterface {
  private readonly connection: Connection;
  private readonly wallet: Wallet;
  private readonly programId: PublicKey;
  private readonly usdcMint: PublicKey;
  private readonly commitment: Commitment;

  constructor(options: ComboRaceClientOptions) {
    this.connection = options.connection;
    this.wallet = options.wallet;
    this.programId = new PublicKey(options.programId ?? PROGRAM_ID);
    this.usdcMint = new PublicKey(options.usdcMint ?? MAINNET_USDC_MINT);
    this.commitment = options.commitment ?? 'confirmed';
  }

  async createPool(params: CreatePoolParams): Promise<CreatePoolResult> {
    const authority = this.wallet.publicKey;
    this.assertSigner(authority, params.authority, 'authority');
    const mint = params.usdcMint ? new PublicKey(params.usdcMint) : this.usdcMint;
    const poolId = params.poolId !== undefined ? BigInt(params.poolId) : randomPoolId();
    const [pool] = poolPda(this.programId, authority, poolId);
    const [vault] = vaultPda(this.programId, pool);

    const data = concatBytes(IX.initPool, u64(poolId), u64(toBaseUnits(params.buyIn)));
    const ix = new TransactionInstruction({
      programId: this.programId,
      data: Buffer.from(data),
      keys: [
        meta(authority, true, true),
        meta(pool, false, true),
        meta(mint, false, false),
        meta(vault, false, true),
        meta(TOKEN_PROGRAM_ID, false, false),
        meta(SystemProgram.programId, false, false),
        meta(SYSVAR_RENT_PUBKEY, false, false),
      ],
    });

    const signature = await this.send([ix]);
    return { signature, pool: pool.toBase58() };
  }

  async joinPool(params: JoinPoolParams): Promise<TxResult> {
    const player = this.wallet.publicKey;
    this.assertSigner(player, params.player, 'player');
    const pool = new PublicKey(params.pool);
    const { decoded } = await this.mustFetchPool(pool);
    const [vault] = vaultPda(this.programId, pool);
    const [entry] = entryPda(this.programId, pool, player);
    const playerToken = getAssociatedTokenAddressSync(decoded.usdcMint, player);

    const ix = new TransactionInstruction({
      programId: this.programId,
      data: Buffer.from(IX.deposit),
      keys: [
        meta(player, true, true),
        meta(pool, false, true),
        meta(entry, false, true),
        meta(playerToken, false, true),
        meta(vault, false, true),
        meta(TOKEN_PROGRAM_ID, false, false),
        meta(SystemProgram.programId, false, false),
      ],
    });

    const signature = await this.send([ix]);
    return { signature };
  }

  async settle(params: SettleParams): Promise<TxResult> {
    const authority = this.wallet.publicKey;
    this.assertSigner(authority, params.authority, 'authority');
    const pool = new PublicKey(params.pool);
    const winner = new PublicKey(params.winner);

    const ix = new TransactionInstruction({
      programId: this.programId,
      data: Buffer.from(concatBytes(IX.settle, winner.toBytes())),
      keys: [meta(authority, true, false), meta(pool, false, true)],
    });

    const signature = await this.send([ix]);
    return { signature };
  }

  async claim(params: ClaimParams): Promise<TxResult> {
    const winner = this.wallet.publicKey;
    this.assertSigner(winner, params.winner, 'winner');
    const pool = new PublicKey(params.pool);
    const { decoded } = await this.mustFetchPool(pool);
    const [vault] = vaultPda(this.programId, pool);
    const winnerToken = getAssociatedTokenAddressSync(decoded.usdcMint, winner);

    // Ensure the winner has a USDC account to receive the pot; no-op if it exists.
    const createAta = createAssociatedTokenAccountIdempotentInstruction(
      winner,
      winnerToken,
      winner,
      decoded.usdcMint,
    );
    const claimIx = new TransactionInstruction({
      programId: this.programId,
      data: Buffer.from(IX.claim),
      keys: [
        meta(winner, true, true),
        meta(pool, false, true),
        meta(vault, false, true),
        meta(winnerToken, false, true),
        meta(TOKEN_PROGRAM_ID, false, false),
      ],
    });

    const signature = await this.send([createAta, claimIx]);
    return { signature };
  }

  async getPool(pool: Address): Promise<PoolState | null> {
    const poolKey = new PublicKey(pool);
    const account = await this.connection.getAccountInfo(poolKey, this.commitment);
    if (!account) return null;
    const decoded = decodePool(account.data);
    const players = await this.fetchEntries(poolKey);
    return this.toPoolState(poolKey, decoded, players);
  }

  private async fetchEntries(pool: PublicKey): Promise<Array<{ player: Address; amount: number }>> {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      commitment: this.commitment,
      filters: [{ dataSize: ENTRY_SIZE }, { memcmp: { offset: 8, bytes: pool.toBase58() } }],
    });
    return accounts.map(({ account }) => {
      const entry = decodeEntry(account.data);
      return { player: entry.player.toBase58(), amount: fromBaseUnits(entry.amount) };
    });
  }

  private toPoolState(
    address: PublicKey,
    decoded: DecodedPool,
    players: Array<{ player: Address; amount: number }>,
  ): PoolState {
    const status: PoolStatus = decoded.status;
    const winner = status === 'open' || decoded.winner.equals(PublicKey.default)
      ? null
      : decoded.winner.toBase58();
    return {
      address: address.toBase58(),
      poolId: Number(decoded.poolId),
      authority: decoded.authority.toBase58(),
      usdcMint: decoded.usdcMint.toBase58(),
      vault: decoded.vault.toBase58(),
      buyIn: fromBaseUnits(decoded.buyIn),
      pot: fromBaseUnits(decoded.totalDeposited),
      playerCount: decoded.playerCount,
      players,
      status,
      winner,
    };
  }

  private async mustFetchPool(pool: PublicKey): Promise<{ decoded: DecodedPool }> {
    const account = await this.connection.getAccountInfo(pool, this.commitment);
    if (!account) throw new Error(`pool ${pool.toBase58()} not found`);
    return { decoded: decodePool(account.data) };
  }

  private assertSigner(walletKey: PublicKey, provided: Address, label: string): void {
    if (walletKey.toBase58() !== provided) {
      throw new Error(`${label} ${provided} does not match the connected wallet ${walletKey.toBase58()}`);
    }
  }

  private async send(instructions: TransactionInstruction[]): Promise<string> {
    const tx = new Transaction().add(...instructions);
    tx.feePayer = this.wallet.publicKey;
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash(this.commitment);
    tx.recentBlockhash = blockhash;
    const signed = await this.wallet.signTransaction(tx);
    const signature = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      this.commitment,
    );
    return signature;
  }
}

function randomPoolId(): bigint {
  const hi = BigInt(Math.floor(Math.random() * 0xffffffff));
  const lo = BigInt(Math.floor(Math.random() * 0xffffffff));
  return (hi << 32n) | lo;
}
