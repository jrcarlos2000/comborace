// Throwaway devnet driver: runs one real init_pool -> deposit -> settle -> claim
// end to end against the deployed combo_race program using the real ComboRaceClient
// from ../dist. Devnet only. Creates a throwaway SPL mint as the pool token, funds a
// few generated player keypairs, and prints every transaction signature.
//
// Env:
//   PROGRAM_ID  (required) deployed combo_race program id
//   RPC_URL     (optional) defaults to devnet
//   PLAYERS     (optional) number of players, default 3
//   BUY_IN      (optional) buy-in in token major units, default 1

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';
import { ComboRaceClient } from '../dist/index.js';

const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = process.env.PROGRAM_ID;
const PLAYERS = Number(process.env.PLAYERS || 3);
const BUY_IN = Number(process.env.BUY_IN || 1);
const DECIMALS = 6;

if (!PROGRAM_ID) {
  console.error('PROGRAM_ID env var is required');
  process.exit(1);
}

const connection = new Connection(RPC_URL, 'confirmed');

function loadKeypair(p) {
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function walletFor(kp) {
  return {
    publicKey: kp.publicKey,
    async signTransaction(tx) {
      tx.partialSign(kp);
      return tx;
    },
  };
}

function clientFor(kp) {
  return new ComboRaceClient({
    connection,
    wallet: walletFor(kp),
    programId: PROGRAM_ID,
    usdcMint: MINT.toBase58(),
    commitment: 'confirmed',
  });
}

let MINT;
const sigs = {};

async function main() {
  const authority = loadKeypair(path.join(os.homedir(), '.config/solana/id.json'));
  console.log('authority:', authority.publicKey.toBase58());
  const startBal = await connection.getBalance(authority.publicKey);
  console.log('authority balance:', startBal / LAMPORTS_PER_SOL, 'SOL');

  MINT = await createMint(connection, authority, authority.publicKey, null, DECIMALS);
  console.log('devnet test mint:', MINT.toBase58());

  const players = Array.from({ length: PLAYERS }, () => Keypair.generate());
  console.log('players:', players.map((p) => p.publicKey.toBase58()));

  // Fund each player with a little SOL for their entry-PDA rent and tx fees.
  const fundTx = new Transaction();
  for (const p of players) {
    fundTx.add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: p.publicKey,
        lamports: 0.03 * LAMPORTS_PER_SOL,
      }),
    );
  }
  const fundSig = await sendAndConfirmTransaction(connection, fundTx, [authority], {
    commitment: 'confirmed',
  });
  console.log('fund players sig:', fundSig);

  // Give each player a token account with enough test tokens to cover the buy-in.
  for (const p of players) {
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      authority,
      MINT,
      p.publicKey,
    );
    await mintTo(
      connection,
      authority,
      MINT,
      ata.address,
      authority,
      BigInt(Math.round((BUY_IN + 1) * 10 ** DECIMALS)),
    );
  }
  console.log('minted test tokens to player ATAs');

  const poolId = Math.floor(Math.random() * 2 ** 31);
  const authorityClient = clientFor(authority);

  const created = await authorityClient.createPool({
    authority: authority.publicKey.toBase58(),
    buyIn: BUY_IN,
    poolId,
    usdcMint: MINT.toBase58(),
  });
  sigs.init_pool = created.signature;
  const pool = created.pool;
  console.log('init_pool sig:', created.signature, 'pool:', pool);

  sigs.deposit = [];
  for (const p of players) {
    const res = await clientFor(p).joinPool({
      pool,
      player: p.publicKey.toBase58(),
    });
    sigs.deposit.push(res.signature);
    console.log('deposit sig (', p.publicKey.toBase58(), '):', res.signature);
  }

  let state = await authorityClient.getPool(pool);
  console.log('pool after deposits:', JSON.stringify(state));

  const winner = players[0];
  const settleRes = await authorityClient.settle({
    pool,
    authority: authority.publicKey.toBase58(),
    winner: winner.publicKey.toBase58(),
  });
  sigs.settle = settleRes.signature;
  console.log('settle sig:', settleRes.signature, 'winner:', winner.publicKey.toBase58());

  const claimRes = await clientFor(winner).claim({
    pool,
    winner: winner.publicKey.toBase58(),
  });
  sigs.claim = claimRes.signature;
  console.log('claim sig:', claimRes.signature);

  state = await authorityClient.getPool(pool);
  console.log('pool after claim:', JSON.stringify(state));

  const winnerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    MINT,
    winner.publicKey,
  );
  const winnerBal = await connection.getTokenAccountBalance(winnerAta.address);
  console.log('winner token balance after claim:', winnerBal.value.uiAmountString);

  console.log('\n===RESULT_JSON===');
  console.log(
    JSON.stringify(
      {
        programId: PROGRAM_ID,
        cluster: 'devnet',
        mint: MINT.toBase58(),
        pool,
        winner: winner.publicKey.toBase58(),
        players: players.map((p) => p.publicKey.toBase58()),
        signatures: sigs,
        fundSig,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error('FLOW FAILED:', e);
  process.exit(1);
});
