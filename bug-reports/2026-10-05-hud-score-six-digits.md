# HUD score has 6 digits; the original shows 7

- **Severity:** cosmetic
- **Build:** V0.1.0-11B3C46 (playtested); the code involved is unchanged on 9623e8a
- **Where:** HUD in any level
- **How to get there:** `?level=1-1&char=mario`
- **Character and power:** any
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Look at the score in the HUD.

## Expected

As in the original Crossover: a 7-digit score (0000000).

## Actual

6 digits (000000).

## How often

every time

## Notes

Ours: `pad(state.score, 6)` in `src/game/hud/hud.ts`. Check that the wider number still fits beside the coin counter.

Reference: the original's source at https://github.com/JayPavlina/super-mario-bros-crossover (paths under `src/`), compared with a playthrough of the original 3.1.21 in the Ruffle emulator.

Status: fixed — the HUD score is 7 digits capped at 9999999 (StatManager.SCORE_MAX) and the coin counter moved to x=96 so it keeps a 16 px gap; checked for every hero and pair in a unit test and in the browser.
