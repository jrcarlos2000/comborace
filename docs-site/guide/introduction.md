# Introduction

**ComboRace turns your group-chat parlay into a live car race where the cars ARE the odds.**

Each player's car is a soccer combo. Its position on the track is the live probability that combo still cashes, read straight from TxLINE's de-vigged `Pct` field. When a real goal drops, your car crosses the finish line while your friend's car explodes, and a private, no-house USDC pool settles on-chain from the verifiable TxLINE result.

Mario Kart meets your betting group chat.

## Betting you can watch

A bet slip is a number that sits still until the final whistle. ComboRace makes that number a physical, moving object. Every car on the track is somebody's parlay, and every car's distance down the track is the same thing: how likely that bet still pays right now.

So you do not read a table of odds and wait. You watch a race. A corner nudges a car forward. A goal rockets one car across the line and drags another back to zero. The tension is on screen every second, not held in your head.

## The parlay-as-a-race hook

A parlay, or combo, is several bets stacked into one. All the legs have to win for it to pay, which is exactly what makes it fun in a group chat and exactly what makes it hard to follow. Four separate lines, each moving on its own, is a spreadsheet, not a spectacle.

ComboRace collapses the whole combo into one live probability and puts it on a track. One car, one number, one position. The car surges when the match goes the combo's way and gets dragged back when it does not. A leg dying is not a line item turning red, it is a car detonating mid-race with a full-screen kill cam. A combo cashing is not a green checkmark, it is a car crossing the line with confetti.

This is the one mechanic that sets ComboRace apart. Other approaches treat a live sports feed as text to narrate, a leaderboard to rank, or a dashboard to display. ComboRace is the only one where the de-vigged probability becomes a watchable, racing object.

## The non-fan angle

Plenty of people watch the World Cup with a phone in their hand and no real stake in the match. They are in the room because their friends are, and they will only really lock in if they have money on it.

ComboRace is built for exactly that person. The front door needs no wallet and no live game: tapping "Watch a race" drops you into a real recorded match with cars already moving. The screen is a race track with named cars and floating win percentages, not a bet slip, so you do not need to know a handicap line from a corner total to understand it. Your car is ahead or behind, alive or dead. That is the whole game, and it reads in one glance.

## Where it comes from

ComboRace was built for the TxODDS World Cup hackathon on Superteam Earn, in the Consumer and Fan Experiences track. TxODDS runs TxLINE, a verifiable sports-data oracle on Solana that ships live odds, scores, and match events for the tournament, with results anchored on-chain. ComboRace uses that feed as its primary input: the odds place the cars, the scores resolve the legs, and the on-chain result settles the pool.

Read on for the [player flow](/guide/how-it-works), the [game mechanic](/guide/game-mechanic), the [TxLINE integration](/guide/txline-integration), and the [architecture](/guide/architecture).
