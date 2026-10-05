# Flagpole scores are lower than the original's for the same grab height

- **Severity:** wrong behaviour
- **Build:** V0.1.0-11B3C46 (playtested); the code involved is unchanged on 9623e8a
- **Where:** 1-1 flagpole, column 198 (all flagpoles)
- **How to get there:** `?level=1-1&char=mario`
- **Character and power:** Mario, small and big
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Grab the flagpole at about mid height from a ground jump.
2. In another run, run off the top of the final staircase and grab just under the ball.

## Expected

As in the original (`pickups/FlagPole.as`, `data/ScoreValue.as`): the score uses the player's vertical middle against the pole's height measured up from the bottom. At or above 90% of the pole scores 5000, 65% scores 2000, 40% scores 800, 20% scores 400, and lower scores 100. In the original, a mid-pole grab gave 800.

## Actual

A mid-pole grab gave 400. A grab with Mario's head just under the ball gave 2000, where the original's rule gives 5000.

## How often

every time

## Notes

Ours: `scoreForFeet` in `src/game/entities/objects/flagpole.ts` uses foot height in tile steps.

Reference: the original's source at https://github.com/JayPavlina/super-mario-bros-crossover (paths under `src/`), compared with a playthrough of the original 3.1.21 in the Ruffle emulator.

Status: fixed — the grab is scored by the player's vertical middle against the pole height (TILE_SIZE*9.3 from the base) with the FlagPole.as bands 90/65/40/20% for 5000/2000/800/400, else 100.
