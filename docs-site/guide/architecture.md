# Architecture

Redline is Solana end to end, since TxLINE is a Solana odds oracle. The public MVP ships as one single-process Docker service, so `docker build && docker run` is the whole app. The on-chain program is deployed separately.

## The layers

| Layer | What it is |
|---|---|
| **Chain** | Solana. Match data and verifiable results come from TxLINE, the TxODDS on-chain odds oracle. |
| **Program** | An Anchor (Rust) minimal escrow: initialize a pool, deposit, settle to a winner, and claim. The winner is computed off-chain from the settled feed, so there is no in-program Merkle math. |
| **SDK** | A TypeScript-strict client that hand-encodes the Anchor instructions over the Solana web3 and SPL-token libraries. It ships with a fully in-memory mock twin that has an identical interface and zero Solana dependencies, so the wallet-free path never touches web3. |
| **Frontend** | React, Vite, and Tailwind, mobile-first, with the race drawn on a canvas over a probability axis. The wallet is Phantom via the Solana wallet adapter, code-split and off by default so the public bundle stays free of web3. |
| **Server** | One Node service whose only runtime dependency is a WebSocket library. It serves the built app and streams match frames to the frontend, from a recorded replay or the live TxLINE feed. |
| **Data** | TxLINE REST snapshots recorded to JSONL, then replayed. The field mapping (`Pct` to car position, the per-team and per-half score encoding to leg resolution) lives with the server. |

## Escrow, kept deliberately minimal

The Anchor program does four things: create a pool, take deposits, settle to a declared winner, and let the winner claim. Funds sit in a program-owned account and the payout fires from the settled result, so nobody custodies the pool or approves a payout by hand.

The winner is computed off-chain from the verifiable TxLINE result rather than proven inside the program. Verifying a Merkle proof in-program is possible and is a strong prediction-markets flex, but for the fan-experience build it was cut on purpose to keep the on-chain surface small and the settlement easy to reason about.

## The SDK and its mock twin

The SDK is the one interface everything else talks to. It wraps the raw instruction encoding so the app and server never hand-build a transaction.

Crucially it ships two implementations behind one interface: the real on-chain client, and a fully in-memory mock. The mock has no Solana dependencies at all. That is what lets the public "Watch a race" path run with no wallet and no web3 in the bundle, while the exact same calling code can switch to the real client for a live pool. The wallet adapter itself is code-split and off by default, so a visitor who never connects a wallet never loads it.

## One process, replay-first

The public MVP runs in replay mode on a recorded match, because a live game is not guaranteed to be in progress when someone opens the app. The server reads a recorded JSONL file and streams `MatchTick` frames over a WebSocket to the frontend, looping so a visitor always lands mid-race.

The same server can point at the live TxLINE feed instead of a recording, with no change to the mapping logic, because a recorded snapshot and a live snapshot have the same shape. Recording a match for replay and then wiring the same shape to a live source is a natural fit.

The whole thing builds into a single Docker image: the SDK, the app, and the server, served on one port. That is the entire deployment. A visitor opens the URL and watches a recorded replay (a scripted match in this build) with no setup.

## Smoothing is the make-or-break

The single most important piece of engineering is not any one layer, it is the smoothing that hides the free-tier batch cadence.

Free-tier TxLINE ships odds in discrete 60-second batches. If the cars snapped to each new batch they would teleport once a minute and the race illusion would die. The renderer tweens each car between ticks, eases into fresh snapshots instead of jumping, exploits minute-drift so an Under's probability creeps up every minute the feared goal does not arrive, and adds idle micro-motion so nothing ever sits perfectly still. A screenshot at any random second shows a real race. This is treated as the top priority, not a polish item.
