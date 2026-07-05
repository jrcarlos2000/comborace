# Building on TxLINE: an honest note

This is the required write-up on what it was actually like to build ComboRace on the TxLINE API. The whole game hangs on one field, so I will start there.

## The key input: the de-vigged `Pct`

TxLINE ships odds with a `Pct` array alongside the raw prices, and that array is already de-margined (de-vigged) win-probability. For a game whose entire premise is "position equals the live chance your combo still cashes," this is the exact number I needed, handed over directly. I do not remove the bookmaker margin myself, I do not reconstruct an implied probability from decimal odds and then normalize, I just read `Pct` per leg and multiply the pending legs together to place the car. A player's whole parlay becomes one probability in a couple of lines (`server/src/txline/oddsMapping.ts`, `comboPct`). If I had to de-vig a multi-way market by hand and keep it stable tick to tick, the smoothing work would have been much harder. `Pct` being a first-class field is the single best design decision in the feed for a product like this.

## What was smooth

- **The REST snapshot plus SSE stream split is clean.** `GET /api/odds/snapshot/{fixtureId}` and `GET /api/scores/snapshot/{fixtureId}` give a full state you can poll and record to JSONL, and `/api/odds/stream` (with an `InRunning` flag for in-play) plus `/api/scores/stream` cover the push case. Recording a match for replay and then wiring the same shape to a live source was a natural fit, and the whole public MVP runs off recorded snapshots with no change to the mapping logic.
- **The scores feed is rich enough to settle real combos.** Goals, corners, yellow and red cards, encoded per team and per half, plus a match-phase code, is exactly the surface needed for over/under, both-teams-to-score, 1X2, corners, cards, and first-half legs. It is not a bare 1X2 feed.
- **The on-chain verifiability is real infrastructure, not a slogan.** Results anchor to Merkle roots published to PDAs, with both mainnet and devnet program IDs available, so no-house settlement is something you can actually build against rather than a promise. It let me design the money rail around "the result is verifiable" from day one.
- **The free World Cup tier is generous.** All 104 matches plus international friendlies on the free tier meant I could build and record against real games without a paid subscription in the way.

## Where I hit friction

Two real ones, neither a blocker.

1. **The 60-second free-tier delay is a batch cadence, not a live stream.** On the free tier (Service Level 1) odds arrive in 60-second batches; sub-second updates are the paid tier. That is honest and fair, since everyone in a lobby shares the same delay, but it pushed all of the "feels live" burden onto my client: without interpolation the cars would teleport once a minute. I spent real effort tweening between batches, easing into each fresh snapshot, and using minute-drift so a scoreless match still shows motion. Worth naming plainly, because a naive integration on the free tier will look laggy, and the fix is on the builder's side. It also became the honest core of the monetization story: true real-time is the paid feed.

2. **Auth and field-mapping needed a real payload, not just the docs.** Two smaller learning-curve items. First, the auth model has a guest JWT path and an on-chain subscription (Bearer) path, and it took a beat to confirm which one the free World Cup tier expects and to wire the header correctly. Second, and more time-consuming, mapping a specific parlay leg to the right market inside a snapshot means matching on `MarketParameters`, `PriceNames`, `MarketPeriod`, and the line, and the score keys use a `period*1000 + base_key` encoding. The docs list the fields, but the exact key numbers and the precise `PriceNames` spellings are much easier to lock from one recorded `/api/odds/snapshot` and `/api/scores/snapshot` than to infer from prose. My mapping code is written defensively (a structural walk that holds a leg's prior probability if no market matches cleanly) precisely so that finalizing it against a real recorded payload is a small, contained change rather than a rewrite.

## Net

For a probability-driven consumer game, `Pct` plus a per-half scores feed plus verifiable on-chain results is a strong base to build on. The main thing a builder should budget for is the client-side smoothing to hide the free-tier batch cadence, and one recorded snapshot to pin the exact field names before finalizing the mapping.
