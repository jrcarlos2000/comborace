---
title: ComboRace
aside: false
outline: false
---

# ComboRace

ComboRace is a live parlay game built on TxLINE, the TxODDS sports-data oracle on Solana. Each player's car is a soccer parlay, and its position on the track is the live probability that the parlay still cashes, read directly from TxLINE's de-vigged `Pct` field.

These pages cover what the game is, how the odds feed drives the race, and how the pool settles on-chain. Start with the introduction, or jump to the section you need.

## Guide

- [Introduction](/guide/introduction): what ComboRace is, and the idea of reading a whole parlay as one moving number.
- [How it works](/guide/how-it-works): the two ways in, a wallet-free replay or a private lobby with a real pool.
- [The game mechanic](/guide/game-mechanic): how position, crashes, and cashes are computed, and when each leg resolves.
- [TxLINE integration](/guide/txline-integration): which fields place the cars, resolve the legs, and settle the result on-chain.
- [Architecture](/guide/architecture): the single-process service, the SDK and its mock twin, and where settlement runs.
- [Roadmap](/guide/roadmap): what runs today, and the path to real-time play and public devnet settlement.

The app runs a wallet-free replay at [comborace.vercel.app](https://comborace.vercel.app).
