# Game over has no Continue option

- **Severity:** wrong behaviour
- **Build:** V0.1.0-11B3C46 (playtested); the code involved is unchanged on 9623e8a
- **Where:** any level, after the last life
- **How to get there:** `?level=1-1&char=mario`, then lose all lives
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Lose every life.

## Expected

As in the original Crossover: the GAME OVER card, then "CONTINUE? YES / NO". YES restarts the current level from its start with 3 lives, and score and coins reset to 0. NO goes to the title screen.

## Actual

GAME OVER shows for about 4 seconds, then the title screen. There is no way to continue.

## How often

every time

## Notes

Ours: `src/game/scenes/game-over.ts`.

Reference: the original's source at https://github.com/JayPavlina/super-mario-bros-crossover (paths under `src/`), compared with a playthrough of the original 3.1.21 in the Ruffle emulator.

Status: fixed — GAME OVER (4.5 s, InformativeBlackScreen.END_DUR_GAME_OVER_MARIO) is followed by CONTINUE? YES / NO (up/down, jump/start; keyboard, gamepad, touch, announcer); YES resets lives to 3 and score/coins to 0 and, like the original's continueAfterDying (resetAllStats(false) + changeToFirstWorldLevel), goes through character select to the first level of the current world from its start; NO goes to the title.
