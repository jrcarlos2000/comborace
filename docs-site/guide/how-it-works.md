# How it works

There are two ways in. You can watch a race straight away with no wallet, or you can join a private lobby with friends and put a real pool on the line. Both land on the same track.

## Watch a race

The public front door is wallet-free and always mid-race.

1. **Open the app.** Tap "Watch a race". A recorded replay (a scripted match in this build) starts, with cars already moving, in under five seconds. No sign-up, no wallet, no live game required.
2. **Read the track.** Each car is named and carries a live win percentage. Position down the track is that percentage. A car near the finish is close to cashing, a car near the start is close to crashing.
3. **Watch it resolve.** Cars breathe with the match every second. A corner nudges one forward. A goal yanks the relevant cars to their new probability and detonates the ones whose leg just died, with a full-screen kill cam and a shareable Kill Card. Survivors keep racing toward the line.

This is the mode that runs on the public link. It exists so a mainstream fan, or a judge, can understand the whole idea in one glance without touching crypto.

## Join a private lobby

The full loop is a private, invite-gated pool with friends. This is where the money tension lives.

1. **Ante into the pool.** Everyone in the lobby puts in an equal USDC buy-in. One pot per lobby, no house, no bookmaker taking the other side.
2. **Draft a car.** On lobby open, ComboRace auto-generates a grid of pre-built cars spread across opposing goals markets (Over versus Under total goals, favorite versus underdog on the result and Asian handicap, home total versus away total). Players snake-draft distinct cars. The one allowed duplicate is copying a friend's car, which puts the two cars in a shared lane as visible doppelgangers for a personal duel.
3. **Watch it crash or cash.** Kickoff locks the grid and the race runs off the live feed. Every car carries an always-on ticker showing what you take if the whistle blew right now, computed from the pool weighted by the surviving cars. That number ticks up every time a rival explodes.
4. **Get paid.** At full time the pot goes to the survivor, or to the best live multiplier if more than one car is still alive. Settlement fires on-chain from the verifiable TxLINE result. A wallet toast confirms what you received, with a link to the on-chain transaction.

## Why the grid is drafted this way

Auto-generating a balanced grid is not a cosmetic choice, it is the fix for a dead track. If everyone picked Over plus favorites, a chaos match would crash the whole field at once and a dull match would freeze it. By spreading cars across opposing markets, no single scoreline moves everyone the same way. A 0-0 rockets the Under and low-total cars while starving the Over cars. A four-goal match does the reverse. Something is always moving.

The [game mechanic](/guide/game-mechanic) page explains exactly how position, crashes, and cashes are computed.
