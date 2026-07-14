# Introduction

Redline turns a soccer parlay into a live car race. Each player's car is a combo, and its position on the track is the live probability that combo still cashes, read directly from TxLINE's de-vigged `Pct` field. When a real goal drops, one car crosses the finish line while another crashes out, and a private, no-house USDC pool settles on-chain from the verifiable TxLINE result.

## Watching the odds move

A bet slip is a number that sits still until the final whistle. Redline makes that number a moving object. Every car on the track is a parlay, and its distance down the track is one thing: how likely that bet still pays right now.

Instead of reading a table of odds and waiting, you watch a race. A corner nudges a car forward. A goal moves one car across the line and drags another back to zero. The state of every bet is on screen at each moment rather than tracked in your head.

## The parlay-as-a-race hook

A parlay, or combo, is several bets stacked into one. All the legs have to win for it to pay, which is exactly what makes it fun in a group chat and exactly what makes it hard to follow. Four separate lines, each moving on its own, is a spreadsheet, not a spectacle.

Redline collapses the whole combo into one live probability and puts it on a track. One car, one number, one position. The car moves forward when the match goes the combo's way and back when it does not. A leg being lost is not a line item turning red, it is a car crashing out mid-race with a full-screen kill cam. A combo cashing is a car crossing the line rather than a green checkmark.

The core mechanic is turning the de-vigged probability itself into a watchable, moving object, rather than presenting a live feed as text to narrate, a leaderboard to rank, or a dashboard to display.

## The wallet-free entry point

Many people watch a match with a phone in their hand and no real stake in the game, in the room because their friends are.

Redline is built with that viewer in mind. The front door needs no wallet and no live game: tapping "Watch a race" opens a recorded replay (a scripted match in this build) with cars already moving. The screen is a race track with named cars and win percentages, not a bet slip, so a viewer does not need to know a handicap line from a total goals line to follow it. A car is ahead or behind, alive or crashed. That reads in one glance.

## Built on TxLINE

TxODDS runs TxLINE, a verifiable sports-data oracle on Solana that ships live odds, scores, and match events, with results anchored on-chain. Redline uses that feed as its primary input: the odds place the cars, the scores resolve the legs, and the on-chain result settles the pool.

Read on for the [player flow](/guide/how-it-works), the [game mechanic](/guide/game-mechanic), the [TxLINE integration](/guide/txline-integration), and the [architecture](/guide/architecture).
