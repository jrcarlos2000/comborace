# ComboRace

**Your group-chat parlay, turned into a live car race where the cars ARE the odds.**

Each player's car is a soccer parlay. The car's position on the track is the live probability that combo still cashes, designed to be read directly from TxLINE's de-vigged `Pct` field. When a real goal drops, a car surges across the finish line while a rival's car nose-dives to zero and explodes. The pot is a private, no-house USDC pool designed to settle on-chain from the verifiable TxLINE result.

Mario Kart meets your betting group chat, powered by demargined TxLINE win-probability.

**Public demo:** https://comborace.jrcarlos2000.dev (no wallet needed, opens straight into a recorded replay; static client build, no live feed or chain, see "Honesty on the current build" below)

Built for the TxODDS World Cup hackathon on Superteam Earn, Consumer & Fan Experiences track ($16k pool, $10k first prize). Deadline 2026-07-19.

---

## The mechanic

- **Car = a parlay.** Each player builds a multi-leg combo from the goals markets TxLINE prices with a de-vigged `Pct` (over/under total goals, 1X2, Asian handicap, team totals, first-half goals). Corners, cards and both-teams-to-score carry no `Pct` on the feed, so no leg models them; and there are no player-scorer legs, since TxLINE has no player-level data.
- **Position = live cash probability, not elapsed time.** The car advances when the match goes its way and gets dragged back when it does not. We multiply the live `Pct` of every pending leg to get one number: the chance this combo still pays.
- **Crash at 0%, cash at 100%.** A leg loses (a second goal kills an Under, say) and the car detonates on the spot with a full-screen kill cam and a shareable Kill Card. All legs win and the car crosses the line.
- **Balanced-grid draft.** On lobby open we auto-generate cars spread across opposing goals markets (Over vs Under total goals, favorite vs underdog on the result and Asian handicap, home total vs away total) so no single scoreline moves the whole field the same way. A 0-0 rockets the Under cars and starves the Over cars, and a goal-fest does the reverse. This is the fix for the dead-track problem.
- **No house.** Equal buy-in, one pot per lobby, settled from the TxLINE oracle result. Payout is fully on-chain, so nobody custodies funds or approves a payout by hand.

Full game design is in [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md); the sharpened plan is in [`docs/WINNING_PLAN.md`](docs/WINNING_PLAN.md).

---

## Tech

Solana end to end, since TxLINE is a Solana odds oracle.

| Layer | What it is |
|---|---|
| **Chain** | Solana. Match data and verifiable results come from TxLINE, the TxODDS on-chain odds oracle. |
| **Program** | Anchor (Rust) minimal escrow: `init_pool`, `deposit`, `settle(winner)`, `claim`. Winner is computed off-chain from the settled feed; no in-program Merkle math (that is the Prediction Markets flex, deliberately cut for this track). Rust is one reviewable file: [`program/programs/combo_race/src/lib.rs`](program/programs/combo_race/src/lib.rs) (real code, not yet deployed to Solana). |
| **SDK** | `@comborace/sdk`, a TypeScript-strict client that hand-encodes the Anchor instructions over `@solana/web3.js` + `@solana/spl-token`. Ships with a fully in-memory `MockComboRaceClient` twin (identical interface, zero Solana deps) so the wallet-free path never touches web3. Source in [`sdk/`](sdk/). |
| **Frontend** | React + Vite + Tailwind, mobile-first, a canvas race on a probability axis. Wallet is Phantom via `@solana/wallet-adapter`, code-split and off by default so the public bundle stays web3-free. Source in [`app/`](app/). |
| **Server** | One Node service (deps: `ws` only) that serves the built app and streams `MatchTick` frames over WebSocket, from a recorded replay or the live TxLINE feed. Source in [`server/`](server/). |
| **Data** | TxLINE REST snapshots recorded to JSONL, then replayed. The real field mapping (`Pct` to car position, the per-team/per-half score encoding to leg resolution) lives in [`server/src/txline/`](server/src/txline/). |

### Smoothing is priority #1

Free-tier TxLINE ships odds in discrete 60-second batches. If the cars snapped to each new batch they would teleport and the race illusion would die. The renderer tweens each car between ticks, eases into fresh snapshots instead of jumping, exploits minute-drift (an Under's probability creeps up every minute the feared goal does not arrive), and adds idle micro-motion so nothing ever sits perfectly still. A screenshot at any random second shows a real race. This is the single technical make-or-break, not a polish item.

---

## Run it

The public MVP runs in replay mode on a recorded match, so it works with no wallet and no live game (the tournament is over during judging).

### Dev

```bash
# 1. Build the SDK first (the app imports its compiled mock through a path alias)
cd sdk && npm install && npm run build

# 2. Run the frontend against the built-in mock feed
cd ../app && npm install && npm run dev        # http://localhost:5173
```

To drive the frontend from the real WebSocket replay server instead of the in-app mock:

```bash
cd app && npm run build
cd ../server && npm install && npm run build
PORT=8080 REPLAY_FILE=../data/sample-match.jsonl npm start   # http://localhost:8080
```

Server env vars: `PORT`, `SOURCE` (`replay` | `live`), `REPLAY_FILE`, `SPEED`, `LOOP`, `WS_PATH`, `STATIC_DIR`, and for the live path `TXLINE_BASE`, `TXLINE_TOKEN`, `FIXTURE_ID`.

### Docker (the whole MVP, one process)

```bash
docker build -t comborace:mvp .
docker run --rm -p 8080:8080 comborace:mvp     # open http://localhost:8080
```

The image builds the SDK, the app, and the server, then serves the static app and the `/ws` feed on a single port. `LOOP=true` keeps a recorded match cycling so a visitor always lands mid-race.

### Record and replay a real match

```bash
export TXLINE_TOKEN=<guest-jwt-or-subscription-token>
node scripts/record-match.mjs --fixture <fixtureId> --interval 10 --out data/semi1.jsonl
node scripts/replay-match.mjs --in data/semi1.jsonl --speed 20
```

---

## Monetization and the flywheel

ComboRace is a demand engine for TxODDS's own product, not a competitor to it. Every unit of growth pulls through a paid TxLINE subscription.

- **Thin on-chain track fee.** We take roughly 2%, disclosed and accruing to a protocol PDA, far below a book's ~20%+ compounded combo vig. This is possible because TxLINE's `Pct` is already de-margined, so a four-leg combo costs about 2% here versus the compounded vig at a sportsbook. That price gap is the switching argument.
- **Consumer Pit Pass.** The free tier runs on the 60-second World Cup feed. Premium play (bigger pools, private leagues, replays) needs the real-time feed that only exists on paid mainnet TxLINE, so a paying fan literally funds a feed pull.
- **B2B white-label.** A sportsbook that white-labels the ComboRace watch-along widget must subscribe to a real-time TxLINE feed to power it, which turns ComboRace into a feature TxODDS's sales team attaches to feed deals. A "bet this combo for real at [BookPartner]" deep link is the CPA funnel; the book carries all licensing and custody inside its regulated perimeter, and ComboRace is the engine, funnel, and data layer.

The builder's growth and the sponsor's core feed revenue are the same arrow.

---

## Repo layout

```
app/        React + Vite frontend: the race canvas, smoothing, kill cam, wallet-free landing
sdk/        @comborace/sdk: on-chain escrow client + in-memory mock twin
program/    Anchor (Rust) minimal escrow
server/     single Node service: serves the app + streams the match feed over WebSocket
scripts/    record-match / replay-match / generate-sample-match (the public replay) / capture-mock
data/        recorded match JSONL files (the public replay feed)
docs/        design, plan, TxLINE capabilities, hackathon guidelines, checklist
Dockerfile  single-process image for the whole MVP
```

## Honesty on the current build

The public link is the wallet-free replay experience: the landing, the balanced-grid draft, the smoothed race, the kill cam and Kill Card, and the cash-out screen. It ships as a static client build that plays a recorded match in-app (the on-page feed badge reads "offline replay") and uses the in-memory `MockComboRaceClient`, so the public link touches no live TxLINE feed and no chain, and the result screen's Solscan link is labeled "(mock)". The Node WebSocket server and the single-process Docker image below are the self-host and live-feed path, not what the public link runs.

The demo video is a 128-second narrated walkthrough of that same wallet-free replay experience.

The Anchor escrow and its SDK client are real source (`init_pool` / `deposit` / `settle` / `claim`; the Rust is one reviewable file, [`program/programs/combo_race/src/lib.rs`](program/programs/combo_race/src/lib.rs), so a Solana judge can read the escrow logic even without a live deployment), but they are not yet deployed to Solana or exercised on-chain in this build. A genuine devnet settle-and-claim on the owner's own wallets in a private, invite-gated lobby is the next step, owner-gated, never an open public sportsbook. The recorded feed today is a scripted match; swapping in a real recorded World Cup match is a data-file change with no code change, and finalizing the TxLINE field mapping is pinned to one recorded snapshot. The 60-second free-tier delay is real and shared by every player in a lobby, so play stays fair. See [`docs/TXLINE_API_NOTE.md`](docs/TXLINE_API_NOTE.md) for the honest account of building on the feed and [`docs/BUILD_REPORT.md`](docs/BUILD_REPORT.md) for exactly what is wired versus stubbed.
