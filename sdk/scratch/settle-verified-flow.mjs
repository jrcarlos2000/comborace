// End-to-end REAL devnet driver for the TxLINE-verified settlement path.
//
// 1. init_pool          -> fresh combo_race pool (deposits optional; escrow logic unchanged)
// 2. set_question       -> pin the on-chain question (fixture / stat / period / threshold / comparison)
// 3. fetch a REAL TxLINE Merkle proof for a completed World Cup fixture
// 4. settle_verified    -> CPI into TxLINE validate_stat; oracle verifies the proof against its OWN
//                          on-chain daily-scores root and returns a bool; the pool winner is set from it.
//
// No off-chain score is trusted: the winner is whatever the oracle proves on-chain. Prints every sig.
//
// Env: RPC_URL, FIXTURE(17952170), SEQ(941), STAT_KEY(1002), THRESHOLD(0), COMPARISON(0=GT).
import fs from 'node:fs';
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createMint } from '@solana/spl-token';
import {
  buildSetQuestionData,
  buildSettleVerifiedData,
  dailyScoresPda,
  epochDay,
  TXORACLE_PROGRAM_ID,
  CMP,
} from './txline-borsh.mjs';

const SESSION = JSON.parse(fs.readFileSync('/home/carlos_quantum3labs_com/comborace-txline-session.json', 'utf8'));
const RPC = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('2R3oZhzqf1gS37FAikN5zBZYGVbLnhQw5unR7JWnHiz4');

const FIXTURE = Number(process.env.FIXTURE || 17952170);
const SEQ = Number(process.env.SEQ || 941);
const STAT_KEY = Number(process.env.STAT_KEY || 1002);
const THRESHOLD = process.env.THRESHOLD !== undefined ? Number(process.env.THRESHOLD) : 0;
const COMPARISON = process.env.COMPARISON !== undefined ? Number(process.env.COMPARISON) : CMP.GreaterThan;

const enc = (s) => new TextEncoder().encode(s);
const meta = (pubkey, isSigner, isWritable) => ({ pubkey, isSigner, isWritable });
function u64le(n) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n), true);
  return b;
}
function poolPda(authority, poolId) {
  return PublicKey.findProgramAddressSync([enc('pool'), authority.toBytes(), u64le(poolId)], PROGRAM_ID)[0];
}
function vaultPda(pool) {
  return PublicKey.findProgramAddressSync([enc('vault'), pool.toBytes()], PROGRAM_ID)[0];
}

async function fetchProof(fixtureId, seq, statKey) {
  const url = `${SESSION.apiBase}/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKey=${statKey}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${SESSION.jwt}`, 'X-Api-Token': SESSION.apiToken } });
  if (!r.ok) throw new Error(`stat-validation ${statKey}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  const conn = new Connection(RPC, 'confirmed');
  const authority = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf8'))),
  );
  console.log('authority / fee payer:', authority.publicKey.toBase58());
  console.log('program:', PROGRAM_ID.toBase58());

  // outcome wallets for the pinned question (throwaway keypairs; only their pubkeys matter)
  const winnerIfTrue = Keypair.generate().publicKey;
  const winnerIfFalse = Keypair.generate().publicKey;

  // --- init a fresh pool ---
  const poolId = BigInt(Date.now());
  const pool = poolPda(authority.publicKey, poolId);
  const vault = vaultPda(pool);
  const mint = await createMint(conn, authority, authority.publicKey, null, 6);
  console.log('poolId:', poolId.toString(), 'pool:', pool.toBase58(), 'mint:', mint.toBase58());

  const INIT_POOL_DISC = Uint8Array.from([116, 233, 199, 204, 115, 159, 171, 36]);
  const initData = new Uint8Array([...INIT_POOL_DISC, ...u64le(poolId), ...u64le(1_000_000)]); // buy_in = 1 token
  const initIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    data: Buffer.from(initData),
    keys: [
      meta(authority.publicKey, true, true),
      meta(pool, false, true),
      meta(mint, false, false),
      meta(vault, false, true),
      meta(TOKEN_PROGRAM_ID, false, false),
      meta(SystemProgram.programId, false, false),
      meta(SYSVAR_RENT_PUBKEY, false, false),
    ],
  });
  const initSig = await sendAndConfirmTransaction(conn, new Transaction().add(initIx), [authority], { commitment: 'confirmed' });
  console.log('init_pool tx:', initSig);

  // --- pin the question (period comes from the proof, so fetch the proof first) ---
  const proof = await fetchProof(FIXTURE, SEQ, STAT_KEY);
  const period = proof.statToProve.period;
  const minTs = proof.summary.updateStats.minTimestamp;
  console.log('proof statToProve:', JSON.stringify(proof.statToProve), 'minTs:', minTs, 'epochDay:', epochDay(minTs));

  const setQData = buildSetQuestionData({
    fixtureId: FIXTURE, statKey: STAT_KEY, period, threshold: THRESHOLD, comparison: COMPARISON,
    winnerIfTrue, winnerIfFalse,
  });
  const setQIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    data: Buffer.from(setQData),
    keys: [meta(authority.publicKey, true, false), meta(pool, false, true)],
  });
  const setQSig = await sendAndConfirmTransaction(conn, new Transaction().add(setQIx), [authority], { commitment: 'confirmed' });
  console.log('set_question tx:', setQSig, `(fixture ${FIXTURE}, stat ${STAT_KEY}, period ${period}, value ${['>','<','=='][COMPARISON]} ${THRESHOLD})`);

  // --- settle_verified: CPI into validate_stat ---
  const dailyPda = dailyScoresPda(minTs);
  console.log('daily_scores_roots PDA:', dailyPda.toBase58());
  const svData = buildSettleVerifiedData({ threshold: THRESHOLD, comparison: COMPARISON, useTwoStats: false }, proof, null);
  console.log('settle_verified ix data bytes:', svData.length);

  const cu = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });
  const svIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    data: Buffer.from(svData),
    keys: [
      meta(authority.publicKey, true, false), // settler (anyone)
      meta(pool, false, true),
      meta(dailyPda, false, false),
      meta(TXORACLE_PROGRAM_ID, false, false),
    ],
  });
  const svSig = await sendAndConfirmTransaction(conn, new Transaction().add(cu, svIx), [authority], {
    commitment: 'confirmed',
    skipPreflight: false,
  });
  console.log('\n==============================================================');
  console.log('settle_verified tx:', svSig);
  console.log('Solscan:', `https://solscan.io/tx/${svSig}?cluster=devnet`);
  console.log('==============================================================\n');

  // --- read back the pool: verified flag + outcome + winner ---
  const acct = await conn.getAccountInfo(pool);
  const d = acct.data;
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  // layout after disc(8): authority(32) usdc_mint(32) vault(32) pool_id(8) buy_in(8)
  // total_deposited(8) player_count(4) status(1) winner(32) bump(1) vault_bump(1)
  // verified(1) verified_outcome(1) question_set(1) fixture_id(8) stat_key(4) period(4)
  // threshold(4) comparison(1) winner_if_true(32) winner_if_false(32)
  let o = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 4;
  const status = dv.getUint8(o); o += 1;
  const winner = new PublicKey(d.subarray(o, o + 32)); o += 32;
  o += 1 + 1; // bump, vault_bump
  const verified = dv.getUint8(o); o += 1;
  const verifiedOutcome = dv.getUint8(o); o += 1;
  console.log('pool.status:', ['open','settled','paid'][status]);
  console.log('pool.verified:', verified === 1);
  console.log('pool.verified_outcome (oracle bool):', verifiedOutcome === 1);
  console.log('pool.winner:', winner.toBase58());
  console.log('winner == winnerIfTrue?', winner.equals(winnerIfTrue), '| winner == winnerIfFalse?', winner.equals(winnerIfFalse));

  // Emit a JSON receipt for wiring into the app.
  const receipt = {
    programId: PROGRAM_ID.toBase58(),
    pool: pool.toBase58(),
    fixtureId: FIXTURE, seq: SEQ, statKey: STAT_KEY, period, threshold: THRESHOLD, comparison: COMPARISON,
    dailyScoresRootPda: dailyPda.toBase58(),
    oracleProgram: TXORACLE_PROGRAM_ID.toBase58(),
    initPoolTx: initSig, setQuestionTx: setQSig, settleVerifiedTx: svSig,
    solscan: `https://solscan.io/tx/${svSig}?cluster=devnet`,
    verified: verified === 1, verifiedOutcome: verifiedOutcome === 1,
  };
  fs.writeFileSync(new URL('./settle-verified-receipt.json', import.meta.url), JSON.stringify(receipt, null, 2));
  console.log('\nreceipt written to scratch/settle-verified-receipt.json');
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
