// Hand-rolled borsh serializer for TxLINE validate_stat args (no @coral-xyz/anchor
// runtime, matching the ComboRace SDK's IDL-free philosophy). Mirrors the exact
// field order / types of the on-chain validate_stat instruction (see idl/txline_devnet.json):
//   ts: i64
//   fixture_summary: ScoresBatchSummary { fixture_id:i64, update_stats:{update_count:i32,min_timestamp:i64,max_timestamp:i64}, events_sub_tree_root:[u8;32] }
//   fixture_proof: Vec<ProofNode { hash:[u8;32], is_right_sibling:bool }>
//   main_tree_proof: Vec<ProofNode>
//   predicate: TraderPredicate { threshold:i32, comparison:Comparison(enum u8) }
//   stat_a: StatTerm { stat_to_prove:{key:u32,value:i32,period:i32}, event_stat_root:[u8;32], stat_proof:Vec<ProofNode> }
//   stat_b: Option<StatTerm>
//   op: Option<BinaryExpression(enum u8)>
import { PublicKey } from '@solana/web3.js';

export const TXORACLE_PROGRAM_ID = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');
export const VALIDATE_STAT_DISC = Uint8Array.from([107, 197, 232, 90, 191, 136, 105, 185]);

// Comparison enum indices: 0 GreaterThan, 1 LessThan, 2 EqualTo.
export const CMP = { GreaterThan: 0, LessThan: 1, EqualTo: 2 };
// BinaryExpression: 0 Add, 1 Subtract.
export const OP = { Add: 0, Subtract: 1 };

class Writer {
  constructor() { this.buf = []; }
  u8(n) { this.buf.push(n & 0xff); }
  bool(b) { this.u8(b ? 1 : 0); }
  i32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setInt32(0, n, true);
    for (const x of b) this.buf.push(x);
  }
  u32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n >>> 0, true);
    for (const x of b) this.buf.push(x);
  }
  i64(n) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigInt64(0, BigInt(n), true);
    for (const x of b) this.buf.push(x);
  }
  array32(arr) {
    if (arr.length !== 32) throw new Error(`expected [u8;32], got ${arr.length}`);
    for (const x of arr) this.buf.push(x & 0xff);
  }
  vecLen(n) { this.u32(n); }
  bytes() { return Uint8Array.from(this.buf); }
}

function writeProofNode(w, node) {
  w.array32(node.hash);
  w.bool(node.isRightSibling);
}
function writeProofNodes(w, nodes) {
  w.vecLen(nodes.length);
  for (const n of nodes) writeProofNode(w, n);
}
function writeStatTerm(w, proof) {
  // stat_to_prove
  w.u32(proof.statToProve.key);
  w.i32(proof.statToProve.value);
  w.i32(proof.statToProve.period);
  // event_stat_root
  w.array32(proof.eventStatRoot);
  // stat_proof
  writeProofNodes(w, proof.statProof);
}

export function epochDay(minTimestamp) {
  return Math.floor(Number(minTimestamp) / 1000 / 86400);
}

// Daily root PDA seed = ["daily_scores_roots", u16LE(epochDay)] (NOT the account name).
export function dailyScoresPda(minTimestamp) {
  const day = epochDay(minTimestamp);
  const seed = new Uint8Array(2);
  new DataView(seed.buffer).setUint16(0, day, true);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('daily_scores_roots'), Buffer.from(seed)],
    TXORACLE_PROGRAM_ID,
  )[0];
}

export function pubkeyBytes(pk) {
  return new PublicKey(pk).toBytes();
}

// combo_race set_question(fixture_id:i64, stat_key:u32, period:i32, threshold:i32,
//   comparison:u8, winner_if_true:Pubkey, winner_if_false:Pubkey)
export const SET_QUESTION_DISC = Uint8Array.from([50, 35, 107, 147, 193, 167, 42, 239]);
export function buildSetQuestionData(q) {
  const w = new Writer();
  for (const b of SET_QUESTION_DISC) w.buf.push(b);
  w.i64(q.fixtureId);
  w.u32(q.statKey);
  w.i32(q.period);
  w.i32(q.threshold);
  w.u8(q.comparison);
  for (const b of pubkeyBytes(q.winnerIfTrue)) w.buf.push(b);
  for (const b of pubkeyBytes(q.winnerIfFalse)) w.buf.push(b);
  return w.bytes();
}

// combo_race settle_verified(args: ValidateStatArgs). Same borsh body as validate_stat
// minus the oracle discriminator, prefixed with the combo_race settle_verified disc.
export const SETTLE_VERIFIED_DISC = Uint8Array.from([55, 109, 229, 81, 230, 191, 37, 218]);
export function buildSettleVerifiedData(predicate, proofA, proofB) {
  // buildValidateStatData already prefixes VALIDATE_STAT_DISC(8) + the borsh body.
  // Strip the oracle disc and re-prefix with settle_verified's disc.
  const inner = buildValidateStatData(predicate, proofA, proofB).slice(8);
  const out = new Uint8Array(8 + inner.length);
  out.set(SETTLE_VERIFIED_DISC, 0);
  out.set(inner, 8);
  return out;
}

// predicate: { threshold:i32, comparison:0|1|2, op?:0|1, useTwoStats:bool }
// proofA / proofB: raw stat-validation responses. Returns the full ix data bytes
// (discriminator + borsh) ready to drop into a TransactionInstruction.
export function buildValidateStatData(predicate, proofA, proofB) {
  const w = new Writer();
  // discriminator
  for (const b of VALIDATE_STAT_DISC) w.buf.push(b);
  // ts (MUST equal summary.updateStats.minTimestamp)
  w.i64(proofA.summary.updateStats.minTimestamp);
  // fixture_summary
  w.i64(proofA.summary.fixtureId);
  w.i32(proofA.summary.updateStats.updateCount);
  w.i64(proofA.summary.updateStats.minTimestamp);
  w.i64(proofA.summary.updateStats.maxTimestamp);
  w.array32(proofA.summary.eventStatsSubTreeRoot);
  // fixture_proof = subTreeProof
  writeProofNodes(w, proofA.subTreeProof);
  // main_tree_proof = mainTreeProof
  writeProofNodes(w, proofA.mainTreeProof);
  // predicate
  w.i32(predicate.threshold);
  w.u8(predicate.comparison);
  // stat_a
  writeStatTerm(w, proofA);
  // stat_b: Option<StatTerm>
  if (predicate.useTwoStats) {
    w.u8(1);
    writeStatTerm(w, proofB);
    // op: Option<BinaryExpression>
    w.u8(1);
    w.u8(predicate.op);
  } else {
    w.u8(0); // stat_b = None
    w.u8(0); // op = None
  }
  return w.bytes();
}
