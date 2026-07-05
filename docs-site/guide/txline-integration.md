# TxLINE integration

ComboRace uses TxLINE as its primary input. TxLINE is the TxODDS verifiable sports-data oracle on Solana: it ships live odds, scores, and match events, with results anchored on-chain. Three things from that feed drive the whole game.

## The de-vigged Pct field drives car position

TxLINE ships odds with a `Pct` array alongside the raw prices, and that array is already de-margined. In plain terms, `Pct` is win-probability directly, with the bookmaker margin already stripped out.

For a game whose entire premise is "position equals the live chance your combo still cashes," this is the exact number the renderer needs, handed over directly. There is no de-vig math to do. ComboRace reads `Pct` for each pending leg and multiplies the legs together to place the car. A whole parlay becomes one probability in a couple of lines of code.

`Pct` being a first-class field is the single best design decision in the feed for a product like this. If the game had to remove the margin by hand from a multi-way market and keep that stable tick to tick, the smoothing work would have been far harder.

## The scores feed resolves the legs

Odds place the cars. The scores feed decides when a leg is won or lost.

The soccer scores feed encodes goals, yellow cards, red cards, and corners, per team and per half, plus a match-phase code (including ended, and ended after a penalty shootout). That is a rich enough surface to settle real combos:

- Total goals over and under, and team totals
- Both teams to score
- Match result (1X2)
- Total corners over and under
- Total cards over and under, and red card yes or no
- First-half versions of the goals, corners, and cards lines
- Handicap and correct score

It is not a bare 1X2 feed. The one thing it does not carry is player-level data, so there are no goalscorer or player-prop legs. That is a clean limit to design around rather than a blocker.

## On-chain verifiable results

The settlement is not a promise, it is infrastructure. TxLINE publishes Merkle roots to on-chain accounts (PDAs), so a match result can be verified against a root that is already on Solana:

- `daily_scores_roots` validates scores
- `daily_batch_roots` validates odds
- `ten_daily_fixtures_roots` validates fixtures

Program IDs exist for both mainnet and devnet. The verification model is to fetch the leaf plus its Merkle proof off-chain and check it against the on-chain root. This is what makes no-house settlement real: the pool pays out from a result that anyone can verify, so nobody has to trust an operator to call the winner.

## The free World Cup tier

TxLINE's free tier covers all 104 World Cup matches plus international friendlies, which is enough to build, record, and demo against real games without a paid subscription in the way.

The one honest caveat is cadence. On the free tier, odds arrive in 60-second batches, not as a sub-second live stream. Real-time updates are the paid tier. The delay is fair, since everyone in a lobby shares the same 60 seconds, but it pushes the "feels live" work onto the client. ComboRace tweens each car between batches, eases into every fresh snapshot instead of snapping, and exploits minute-drift so a scoreless match still shows motion. Without that smoothing a naive integration would teleport once a minute and look laggy.

That cadence gap is also the honest core of the business story: true real-time is the paid feed. See the [roadmap](/guide/roadmap) for how that flows into monetization, and the [architecture](/guide/architecture) for where the mapping lives in the stack.
