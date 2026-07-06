# TxLINE integration

ComboRace uses TxLINE as its primary input. TxLINE is the TxODDS verifiable sports-data oracle on Solana: it ships live odds, scores, and match events, with results anchored on-chain. Three things from that feed drive the whole game.

## The de-vigged Pct field drives car position

TxLINE ships odds with a `Pct` array alongside the raw prices, and that array is already de-margined. In plain terms, `Pct` is win-probability directly, with the bookmaker margin already stripped out.

For a game whose entire premise is "position equals the live chance your combo still cashes," this is the exact number the renderer needs, handed over directly. There is no de-vig math to do. ComboRace reads `Pct` for each pending leg and multiplies the legs together to place the car. A whole parlay becomes one probability in a couple of lines of code.

`Pct` being a first-class field is the single best design decision in the feed for a product like this. If the game had to remove the margin by hand from a multi-way market and keep that stable tick to tick, the smoothing work would have been far harder.

## The scores feed resolves the legs

Odds place the cars. The scores feed decides when a leg is won or lost.

The soccer scores feed encodes goals, yellow cards, red cards, and corners, per team and per half, plus a match-phase code (including ended, and ended after a penalty shootout). It is not a bare 1X2 feed.

A car's position is a live odds `Pct`, so ComboRace only offers markets the odds feed prices with a de-vigged `Pct`. That is the goals family:

- Total goals over and under, and team totals
- Match result (1X2)
- Asian handicap
- First-half over and under goals

Corners and cards are settleable from the scores feed, but the odds feed carries no `Pct` for them, so a car built on a corner or card line would have no live position to move. Both-teams-to-score is the same case. The one thing the feed does not carry at all is player-level data, so there are no goalscorer or player-prop legs. These are clean limits to design around rather than blockers.

## On-chain verifiable results

The settlement is not a promise, it is infrastructure. TxLINE publishes Merkle roots to on-chain accounts (PDAs), so a match result can be verified against a root that is already on Solana:

- `daily_scores_roots` validates scores
- `daily_batch_roots` validates odds
- `ten_daily_fixtures_roots` validates fixtures

Program IDs exist for both mainnet and devnet. The verification model is to fetch the leaf plus its Merkle proof off-chain and check it against the on-chain root. This is what makes no-house settlement real: the pool pays out from a result that anyone can verify, so nobody has to trust an operator to call the winner.

## The free tier

TxLINE's free tier covers a full slate of live tournament matches plus international friendlies, which is enough to build, record, and demo against real games without a paid subscription in the way.

The one honest caveat is cadence. On the free tier, odds arrive in 60-second batches, not as a sub-second live stream. Real-time updates are the paid tier. The delay is fair, since everyone in a lobby shares the same 60 seconds, but it pushes the "feels live" work onto the client. ComboRace tweens each car between batches, eases into every fresh snapshot instead of snapping, and exploits minute-drift so a scoreless match still shows motion. Without that smoothing a naive integration would teleport once a minute and look laggy.

That cadence gap is also the honest core of the business story: true real-time is the paid feed. See the [roadmap](/guide/roadmap) for how that flows into monetization, and the [architecture](/guide/architecture) for where the mapping lives in the stack.
