// Probe: fetch a real TxLINE proof, compute the daily-root PDA, and SIMULATE a raw
// validate_stat CPI target directly against the live devnet oracle to confirm it
// returns the real bool via return data. Proves the integration end to end before we
// wire the settle_verified CPI. Read-only: uses simulateTransaction (no signature, no fee).
import fs from 'node:fs';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { buildValidateStatData, dailyScoresPda, epochDay, TXORACLE_PROGRAM_ID, CMP } from './txline-borsh.mjs';

const SESSION = JSON.parse(fs.readFileSync('/home/carlos_quantum3labs_com/comborace-txline-session.json', 'utf8'));
const RPC = process.env.RPC_URL || 'https://api.devnet.solana.com';
const FIXTURE = Number(process.env.FIXTURE || 17952170);
const SEQ = Number(process.env.SEQ || 941);
const STAT_KEY = Number(process.env.STAT_KEY || 1002);
const THRESHOLD = process.env.THRESHOLD !== undefined ? Number(process.env.THRESHOLD) : 0;
const COMPARISON = process.env.COMPARISON !== undefined ? Number(process.env.COMPARISON) : CMP.GreaterThan;

async function fetchProof(fixtureId, seq, statKey) {
  const url = `${SESSION.apiBase}/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKey=${statKey}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${SESSION.jwt}`, 'X-Api-Token': SESSION.apiToken },
  });
  if (!r.ok) throw new Error(`stat-validation ${statKey}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  const conn = new Connection(RPC, 'confirmed');
  console.log(`fixture=${FIXTURE} seq=${SEQ} statKey=${STAT_KEY} predicate: value ${['>','<','=='][COMPARISON]} ${THRESHOLD}`);
  const proof = await fetchProof(FIXTURE, SEQ, STAT_KEY);
  const minTs = proof.summary.updateStats.minTimestamp;
  console.log('statToProve:', JSON.stringify(proof.statToProve));
  console.log('minTimestamp:', minTs, 'epochDay:', epochDay(minTs));

  const dailyPda = dailyScoresPda(minTs);
  console.log('daily_scores_roots PDA:', dailyPda.toBase58());
  const info = await conn.getAccountInfo(dailyPda);
  console.log('PDA on-chain:', info ? `yes (${info.data.length} bytes, owner ${info.owner.toBase58()})` : 'NOT FOUND');

  const data = buildValidateStatData(
    { threshold: THRESHOLD, comparison: COMPARISON, useTwoStats: false },
    proof, null,
  );
  console.log('validate_stat ix data bytes:', data.length);

  const ix = new TransactionInstruction({
    programId: TXORACLE_PROGRAM_ID,
    keys: [{ pubkey: dailyPda, isSigner: false, isWritable: false }],
    data: Buffer.from(data),
  });
  const cu = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

  // simulate with the funded deploy wallet as fee payer (read-only; no funds spent).
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf8'))),
  );
  const { blockhash } = await conn.getLatestBlockhash();
  const tx = new Transaction().add(cu, ix);
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(payer);

  const sim = await conn.simulateTransaction(tx);
  console.log('--- simulation ---');
  console.log('err:', JSON.stringify(sim.value.err));
  if (sim.value.logs) for (const l of sim.value.logs) console.log('  ', l);
  const ret = sim.value.returnData;
  if (ret) {
    const raw = Buffer.from(ret.data[0], ret.data[1]);
    console.log('returnData programId:', ret.programId, 'bytes:', [...raw], '=> bool:', raw[0] === 1);
  } else {
    console.log('returnData: none');
  }
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
