# The game mechanic

The whole game rests on one rule: **position equals live win-probability.** Everything else follows from it.

## Position is probability, not time

This is not a fixed-lap race where cars run a set distance in a set time. The track is a probability axis. A car's position is the live chance its combo still cashes.

- A car **surges forward** when the match goes its way.
- A car **gets dragged back** when the match turns against it.
- A car **crashes at 0 percent** the moment any of its legs is lost.
- A car **cashes at 100 percent** the moment all of its legs are won.

Because position is probability and not elapsed minutes, even a scoreless match keeps moving. An Under bet gets more likely every minute the feared goal does not arrive, so an all-Under car creeps forward on a slow burn instead of sitting frozen until the whistle. It is a survival race against a probability that keeps shifting, with a time limit at full time, not a lap counter.

## One combo, one number

A combo is several legs stacked together, and all of them have to land. Redline reads the live win-probability of each pending leg from the feed and multiplies them into a single number: the chance the whole parlay still pays. That number is the car's position. As the individual legs move tick by tick, the product moves, and the car moves with it.

Every car starts from the same line regardless of how hard its combo is, so an easy combo and a hard combo launch together and the race stays readable. The pool still pays each car by its live multiplier, so a harder combo earns more if it comes home.

## When legs resolve

Legs do not all wait for the final whistle. Each one settles at its natural time. Some can be won early, some can be lost early, and the rest are decided at full time.

Every leg is a goals market TxLINE prices with a de-vigged `Pct`: total goals over/under, 1X2, Asian handicap, team totals and first-half goals. Corners, cards and both-teams-to-score carry no `Pct` on the feed, so they are not offered.

| Leg | Can win early | Can lose early | Otherwise settled |
|---|---|---|---|
| Over X total goals | yes, when the target is hit | no | loses at full time |
| Under X total goals | no | yes, when the target is exceeded | wins at full time |
| Team over X goals | yes, once they score enough | no | loses at full time |
| Match result (1X2) | no | no | wins or loses at full time |
| Asian handicap | no | no | wins or loses at full time |
| First-half over/under | yes | yes | at half-time |

Staggering the legs this way spreads the crashes and cashes across the whole match instead of bunching them at the end. A first-half Over can cash around the twentieth minute, a total Over on a late goal, a match result at the whistle.

## No extra time

Full time is 90 minutes plus stoppage only. Extra time and penalty shootouts do not count toward any leg, which is the standard sportsbook rule. The final whistle settles every pending leg at once.

## Guaranteeing a climax

Two rules keep the finish from fizzling.

- **Best multiplier wins.** If two or more cars are still alive at full time, the pot does not split evenly. It goes to the highest live multiplier. Ties break on the live "if it ended now" payout, then the harder combo.
- **The pot never orphans.** In the rare case where every car crashes, the pot goes to the car that reached the highest peak probability during the match. The pool is always payable, and the settlement is total.

## The three problems this solves

The design deliberately closes three failure modes.

1. **Wipeout.** A wild match could crash most cars early and leave a dead track. The balanced-grid draft spreads cars across opposing markets, so no scoreline moves the whole field the same way. Single-match lobbies keep the pack together.
2. **The waiting game.** All-Under and match-result cars would never finish early and could look static. Position-as-probability plus minute-drift keeps them visibly creeping forward.
3. **Unequal difficulty.** Over 0.5 and Over 4.5 are not the same bet. The normalized start line puts every car on the same mark, and the payout multiplier prices the difficulty, so a harder combo simply earns more.

Push and void cases are handled cleanly too. If a line lands exactly on the number, that leg drops off, the multiplier shrinks, and the car keeps racing on its remaining legs.
