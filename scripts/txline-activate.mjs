#!/usr/bin/env node
// ComboRace - TxLINE free World Cup tier bootstrap.
// Runs the self-serve flow once to mint API credentials for the funded wallet:
//   1. guest JWT           POST {apiOrigin}/auth/guest/start
//   2. on-chain subscribe  program.subscribe(serviceLevel, weeks) - free WC tier charges 0 TxL
//   3. sign the binding    ed25519 over `${txSig}:${leagues.join(',')}:${jwt}`
//   4. activate            POST {apiOrigin}/api/token/activate -> API token
// The subscribe instruction is built by hand from the published IDL discriminator + account
// layout (github.com/txodds/tx-on-chain, idl/txoracle.json) so no Anchor runtime is needed.
// Credentials are written to a session file OUTSIDE the repo; secrets never touch git.
//
// Usage: node scripts/txline-activate.mjs [--network devnet|mainnet] [--service-level 1] [--weeks 4]
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
// Resolve @solana/* from the SDK workspace (already installed there); no new deps.
const require = createRequire(path.join(ROOT, 'sdk', 'package.json'));
const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } = require('@solana/web3.js');
const {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');

const args = parseArgs(process.argv.slice(2));
const NETWORK = String(args.network || process.env.TXLINE_NETWORK || 'devnet');
const SERVICE_LEVEL_ID = Number(args['service-level'] ?? 1);
const WEEKS = Number(args.weeks ?? 4);
const SELECTED_LEAGUES = []; // standard World Cup + Int Friendlies bundle
const WALLET_PATH = String(args.wallet || process.env.SOLANA_WALLET || path.join(os.homedir(), 'wallet-stormdrift-backup.json'));
const SESSION_PATH = String(args.session || path.join(os.tmpdir(), 'comborace-txline-session.json'));

// subscribe instruction discriminator, from idl/txoracle.json.
const SUBSCRIBE_DISCRIMINATOR = Buffer.from([254, 28, 191, 138, 156, 179, 183, 53]);

const CONFIG = {
  mainnet: {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    apiOrigin: 'https://txline.txodds.com',
    programId: new PublicKey('9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA'),
    txlTokenMint: new PublicKey('Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL'),
    cluster: 'mainnet',
  },
  devnet: {
    rpcUrl: 'https://api.devnet.solana.com',
    apiOrigin: 'https://txline-dev.txodds.com',
    programId: new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J'),
    txlTokenMint: new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG'),
    cluster: 'devnet',
  },
};

const cfg = CONFIG[NETWORK];
if (!cfg) throw new Error(`unknown network: ${NETWORK}`);

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return o;
}

function loadKeypair(p) {
  const secret = Uint8Array.from(JSON.parse(fs.readFileSync(p, 'utf8')));
  return Keypair.fromSecretKey(secret);
}

// ed25519 detached signature over `message` using a Solana 64-byte secret key, via Node crypto.
function signDetached(message, secretKey) {
  const seed = Buffer.from(secretKey.slice(0, 32));
  const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
  const priv = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  return crypto.sign(null, Buffer.from(message), priv);
}

async function postJSON(url, body, headers = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }
  if (!r.ok) throw new Error(`${url} -> ${r.status} ${r.statusText}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

async function main() {
  const wallet = loadKeypair(WALLET_PATH);
  console.log(`network=${NETWORK} wallet=${wallet.publicKey.toBase58()} serviceLevel=${SERVICE_LEVEL_ID} weeks=${WEEKS}`);

  const connection = new Connection(cfg.rpcUrl, 'confirmed');
  const bal = await connection.getBalance(wallet.publicKey);
  console.log(`SOL balance: ${(bal / 1e9).toFixed(4)}`);
  if (bal === 0) throw new Error('wallet has no SOL on this cluster to pay the tx fee');

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from('pricing_matrix')], cfg.programId);
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from('token_treasury_v2')], cfg.programId);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(cfg.txlTokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const userTokenAccount = getAssociatedTokenAddressSync(cfg.txlTokenMint, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  // 1. guest JWT
  const auth = await postJSON(`${cfg.apiOrigin}/auth/guest/start`);
  const jwt = auth.token;
  if (!jwt) throw new Error('no JWT returned from /auth/guest/start');
  console.log('guest JWT acquired');

  // Ensure the user Token-2022 account exists (subscribe reads/writes it even on the free tier).
  const ataInfo = await connection.getAccountInfo(userTokenAccount);
  const preIxs = [];
  if (!ataInfo) {
    console.log('creating user Token-2022 associated account...');
    preIxs.push(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userTokenAccount,
        wallet.publicKey,
        cfg.txlTokenMint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  // 2. subscribe instruction (manual borsh: disc + u16 LE serviceLevel + u8 weeks)
  const data = Buffer.concat([
    SUBSCRIBE_DISCRIMINATOR,
    (() => {
      const b = Buffer.alloc(2);
      b.writeUInt16LE(SERVICE_LEVEL_ID, 0);
      return b;
    })(),
    Buffer.from([WEEKS & 0xff]),
  ]);
  const keys = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: pricingMatrixPda, isSigner: false, isWritable: false },
    { pubkey: cfg.txlTokenMint, isSigner: false, isWritable: false },
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: tokenTreasuryVault, isSigner: false, isWritable: true },
    { pubkey: tokenTreasuryPda, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  const subscribeIx = new TransactionInstruction({ programId: cfg.programId, keys, data });

  const tx = new Transaction();
  for (const ix of preIxs) tx.add(ix);
  tx.add(subscribeIx);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  tx.sign(wallet);

  // Simulate first so an encoding mistake never burns a real send.
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    console.error('simulation logs:\n' + (sim.value.logs || []).join('\n'));
    throw new Error(`subscribe simulation failed: ${JSON.stringify(sim.value.err)}`);
  }
  console.log('subscribe simulation OK');

  const txSig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed' });
  await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed');
  console.log(`subscribe confirmed: ${txSig}`);

  // 3 + 4. sign the binding and activate
  const messageString = `${txSig}:${SELECTED_LEAGUES.join(',')}:${jwt}`;
  const walletSignature = signDetached(messageString, wallet.secretKey).toString('base64');
  const activation = await postJSON(
    `${cfg.apiOrigin}/api/token/activate`,
    { txSig, walletSignature, leagues: SELECTED_LEAGUES },
    { Authorization: `Bearer ${jwt}` },
  );
  const apiToken = activation.token || (typeof activation === 'string' ? activation : activation.apiToken);
  if (!apiToken) throw new Error(`activation returned no token: ${JSON.stringify(activation)}`);
  console.log('API token activated');

  const session = {
    network: NETWORK,
    apiOrigin: cfg.apiOrigin,
    apiBase: `${cfg.apiOrigin}/api`,
    wallet: wallet.publicKey.toBase58(),
    programId: cfg.programId.toBase58(),
    serviceLevelId: SERVICE_LEVEL_ID,
    weeks: WEEKS,
    leagues: SELECTED_LEAGUES,
    txSig,
    solscan: `https://solscan.io/tx/${txSig}?cluster=${cfg.cluster}`,
    jwt,
    apiToken,
    activatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2));
  fs.chmodSync(SESSION_PATH, 0o600);
  console.log(`session written -> ${SESSION_PATH}`);
  console.log(`subscribe txSig: ${txSig}`);
  console.log(`solscan: ${session.solscan}`);
}

main().catch((e) => {
  console.error('FAILED:', e && e.message ? e.message : e);
  process.exit(1);
});
