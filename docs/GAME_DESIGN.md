# Combo Race - game design + data confirmation

Updated 2026-07-05. Concept: a private real-money "combo race" where each player's car = a parlay, cars advance/crash live off TxLINE, last/best combo home takes the pot.

## Live data: CONFIRMED (verified in the TxLINE OpenAPI)
- Odds: `GET /api/odds/stream` (SSE, has `InRunning` boolean for in-play), `/api/odds/updates/{fixtureId}`, `/api/odds/snapshot/{fixtureId}`.
- Scores: `GET /api/scores/stream` (SSE), `/api/scores/updates/{fixtureId}` (live 5-min interval), `/api/scores/snapshot/{fixtureId}`, `/api/scores/historical/{fixtureId}`.
- FREE World Cup tier = Service Level 1, **60-second delay**. Real-time = paid/mainnet (Service Level 12). 60s delay is fine for a casual game; the whole lobby shares it, so it is fair.
- BONUS: odds include `Pct` = demargined (de-vigged) percentages = **win-probability directly**. No de-vig math; read `Pct` to drive car position. Odds fields: MarketParameters, MarketPeriod, PriceNames, Prices, Pct.

## Combo menu (legs settleable from TxLINE)
Stat events in the feed: Goals (incl. own goals), Corners, Yellow Cards, Red Cards, per team and per half; odds include handicap lines. Leg types you can offer:
- Total goals over/under (any line); team total goals O/U
- Both teams to score (yes/no)
- Match result 1X2
- Total corners over/under
- Total cards over/under; red card yes/no
- First-half markets (H1 goals/corners/cards)
- Handicap; correct score
- NO player/goalscorer markets (no player-level data). Fine.

## The race mechanic (LOCKED)
- **Car = a combo (parlay). Track = one match.**
- **Position = live probability the combo still cashes** (from TxLINE `Pct` across the legs), NOT elapsed time. Car surges forward when the match goes its way, gets dragged back when it doesn't. A survival/probability race with a time limit, NOT a fixed-lap F1 race.
- **Crash at 0%** (any leg LOST). **Finish/cash at 100%** (all legs WON).
- Legs resolve at their natural times:

| Leg | Can win early | Can lose early | Else at full time |
|---|---|---|---|
| Over X (goals/corners/cards) | yes (target hit) | no | loses |
| Under X | no | yes (target exceeded) | wins |
| BTTS yes | yes (both scored) | no | loses |
| BTTS no | no | yes (both scored) | wins |
| Match result 1X2 | no | no | wins/loses |
| Team to score | yes (they score) | no | loses |
| Correct score | no | yes (exceeded) | wins/loses |
| First-half O/U | yes | yes | at halftime |

- Full time = **90 min + stoppage only. No extra time / penalties count** (standard sportsbook rule). The whistle settles all pending legs.

## Three holes to design around (Gemini)
1. Wipeout: a wild match crashes most cars early -> dead track. Mitigate: single-match lobbies, favor lower-variance combos, optional VAR-respawn.
2. Waiting game: all-Under/1X2 cars never finish early. Fixed by probability-position (they still move visibly).
3. Unequal difficulty: Over 0.5 vs Over 4.5. Priced by the multiplier (harder combo = bigger payout).

## Edge cases
- Push/void (exactly on the line): leg drops off, multiplier shrinks, car keeps racing.
- VAR/suspension: yellow-flag caution; an overturned goal can respawn a just-crashed car (optional).
- Early finish (all legs locked by min 70): car parks in a winners' circle, payout secured, spectates.

## Money model (from earlier decision, still open on real-vs-play)
Private close-circle lobby, parimutuel pool (ante USDC, no house), copy-a-car at the start, pot to the survivor(s)/best multiplier, settled on-chain from the TxLINE verifiable result. AI = optional "starter car" helper only, not the headline. OPEN DECISION: real USDC (real tension, gray-area compliance, use own wallets for the demo) vs play money.

## Honest caveat
Free tier = 60s behind live TV. Fine for casual social play. Real-time needs paid/mainnet.
