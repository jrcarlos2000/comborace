# TxLINE capabilities vs MoneyPitch needs

Analyzed 2026-07-05 from https://txline-docs.txodds.com/llms.txt and the odds/scores/programs docs.

## One-line project
MoneyPitch: put USDC on a team and watch your stake move down a live soccer pitch as the odds shift, paid out trustlessly from TxLINE's verifiable on-chain result, so a non-fan can feel the match through their money. Tagline: "Betting you can watch."

## What TxLINE HAS (confirmed)
- **Stable Price odds:** TxODDS consensus pricing engine (aggregated global operator lines, filtered), "anchored on Solana," cryptographically verifiable. Derive win-probability from it to place the ball.
- **Update frequency:** 60-second batch updates on the free/Build tier; sub-second real-time on the paid Scale tier.
- **Scores feed (soccer):** encodes goals, yellow/red cards, corners, PER TEAM and PER HALF (key = period*1000 + base_key, base 1-8), plus 19 match-phase codes incl. Ended (5) and Ended after Penalty Shootout (13). Supports live in-match state + finalization for settlement.
- **On-chain verifiability (the moat):** Merkle ROOTS published to PDAs:
  - `daily_scores_roots` (epoch day) - validate scores
  - `daily_batch_roots` (epoch day) - validate odds
  - `ten_daily_fixtures_roots` (10-day epoch) - fixtures
  - Program IDs: mainnet `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA`, devnet `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
  - Verification model = fetch leaf + Merkle proof off-chain, verify against the on-chain root.
- **Free tier:** World Cup + international friendlies.

## What TxLINE LACKS
- No player-level / goalscorer data -> NO "player to score" props/combos.
- Sub-second odds only on paid tier -> free tier ball updates once per 60s (mitigate: interpolate between updates + use goal events for the dramatic jumps).

## Combos that ARE settleable (match-level, from the scores feed)
Over/under total goals, both teams to score, total corners, cards, half-specific versions (H1/H2 goals) - all derivable from the encoded per-team/per-half stats. Stack these for a multi-leg "money multiplies" feature. Avoid any player-scorer leg.

## What we need to BUILD
1. Poller: read TxLINE odds + scores snapshots (REST) -> frontend.
2. React pitch: ball position from de-vigged win-prob; goal events (scores feed) yank ball to net.
3. Anchor escrow (devnet): create / join / settle / refund for the 1v1 USDC duel.
4. Settlement/verify: verify a Merkle proof of the match result against `daily_scores_roots`. Strong = verify on-chain in the escrow program; MVP = verify client-side + show the "verify your payout" receipt.
5. Phantom wallet-adapter + devnet USDC; play-the-house auto-counterparty + replay mode for demoing.

## Still to confirm (minor)
- Exact odds market list (1X2 only vs also totals/handicap) in the OpenAPI spec: https://txline.txodds.com/docs/docs.yaml
- Whether in-play odds (not just pre-match) are in the free World Cup tier.

## Docs
- Index: https://txline-docs.txodds.com/llms.txt
- Odds overview: https://txline.txodds.com/documentation/odds/overview
- Scores/soccer feed: https://txline.txodds.com/documentation/scores/soccer-feed
- On-chain programs/PDAs: https://txline.txodds.com/documentation/programs/addresses
- OpenAPI: https://txline.txodds.com/docs/docs.yaml
