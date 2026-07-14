# Roadmap

Redline today is the wallet-free replay experience plus a real Anchor escrow and its SDK client. From here the path runs in three directions: real-time play, full on-chain settlement, and a business funnel back to TxODDS.

## Real-time in-play betting

The public MVP runs on the free 60-second feed, smoothed hard on the client so it still feels live. The next step is true real-time, which is the paid TxLINE tier with sub-second updates.

On a real-time feed the cars move on every odds tick instead of every batch, so the interpolation becomes a finishing touch rather than the thing holding the illusion together. That opens genuine in-play betting: joining a pool after kickoff, live copy-a-car, and reacting to the match as it unfolds instead of locking a grid at the whistle.

## On-chain devnet settlement

The escrow program and SDK are real source today, and real USDC settlement runs in a private, invite-gated demo lobby on the builder's own wallets. The next step is a public devnet deployment with a one-tap faucet, so anyone can play the full crash-and-cash-and-settle loop end to end with zero jurisdiction risk and no real money.

Beyond that, settlement can move from an off-chain winner computation to an in-program verification of the TxLINE Merkle proof, so the payout is proven on-chain against the published root rather than declared. That is the stronger trustless-settlement story, deliberately left as a next step so the fan-experience build stayed small and readable.

## The B2B white-label funnel

The longer game is that Redline is a demand engine for TxODDS's own product, not a competitor to it. Every unit of growth pulls through a paid TxLINE subscription.

- **A thin, on-chain track fee.** Redline can take roughly 2 percent, disclosed and accruing to a protocol account, far below a book's compounded combo vig. This is possible because `Pct` is already de-margined, so a four-leg combo costs about 2 percent here versus the much higher compounded vig at a sportsbook. That price gap is the switching argument.
- **A consumer Pit Pass.** The free tier runs on the 60-second feed. Premium play, meaning bigger pools, private leagues, and replays, needs the real-time feed that only exists on paid mainnet TxLINE, so a paying fan directly funds a feed pull.
- **A white-label widget for books.** A sportsbook that white-labels the Redline watch-along widget must subscribe to a real-time TxLINE feed to power it, which turns Redline into a feature the TxODDS sales team attaches to feed deals. A "bet this combo for real at your book" deep link is the funnel. The book carries all licensing and custody inside its regulated perimeter, and Redline is the engine, funnel, and data layer.

The builder's growth and the sponsor's core feed revenue point the same way.
