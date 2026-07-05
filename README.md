# ComboRace

**Betting you can watch.** Each player's car is a soccer parlay. The car's position on the track is the live probability the combo still cashes (from TxLINE's de-vigged `Pct`). A car crashes the instant a leg loses and crosses the line when every leg wins. Private pool, no house, real result from the TxLINE oracle.

Built for the **TxODDS World Cup hackathon on Superteam Earn**, Consumer & Fan Experiences track ($10k). Deadline 2026-07-19.

> Working name ComboRace. Brand alternatives: Sweatstakes, Redline.

## Stack (Solana, NOT StarkNet)
- **Chain:** Solana mainnet. Data comes from TxLINE, a Solana odds oracle, so this is Solana end to end.
- **Program:** Anchor (Rust) - a MINIMAL escrow (deposit -> settle -> pay winner). Winner computed off-chain; no in-program Merkle proofs (that is the Prediction Markets flex, cut here).
- **SDK:** TypeScript client wrapping @solana/web3.js + Anchor, crafted with the same clean-client discipline as Stormbit's SDK.
- **Frontend:** React + Vite, mobile-first, canvas race with heavy interpolation/smoothing.
- **Data:** TxLINE REST/SSE (record + replay + live).
- **Wallet:** @solana/wallet-adapter (Phantom).

## The one technical make-or-break
Smoothing. Odds arrive in discrete 60s-delayed jumps. Without interpolation between ticks the cars teleport and the race illusion dies. Tweening + idle micro-motion is priority #1 on the frontend, not polish.

## Scope (lean, per the Gemini gut-check)
90% of effort on the frontend + smoothing + demo video. Minimal real escrow (real USDC moves on-chain for the demo beat). Everything else is roadmap. See `docs/WINNING_PLAN.md` and `SUBMISSION_CHECKLIST.md`.

## Layout
- `scripts/record-match.mjs` - record a live TxLINE match to `data/*.jsonl` (run during the WC).
- `scripts/replay-match.mjs` - replay a recorded match (the public MVP feed; works with no live game, no wallet).
- `program/` - Anchor escrow (to build).
- `sdk/` - TypeScript client (to build).
- `app/` - React frontend (to build).
- `data/` - recorded match files.
- `docs/` - brainstorm, game design, winning plan, hackathon guidelines, TxLINE capabilities.

## Record a match (tonight)
```bash
export TXLINE_TOKEN=<guest-jwt-or-subscription-token>   # from TxLINE quickstart / Telegram
node scripts/record-match.mjs --fixture <fixtureId> --interval 10 --out data/semi1.jsonl
# later:
node scripts/replay-match.mjs --in data/semi1.jsonl --speed 20
```

## Status
Scaffold + recorder/replay skeletons done. Next: map the real TxLINE odds/scores JSON shape (once Carlos records a live match), then build the race renderer, the escrow, and the lobby.
