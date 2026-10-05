# Flagpole score popup stays frozen at the grab height through the tally

- **Severity:** cosmetic
- **Build:** V0.1.0-11B3C46 (playtested); the code involved is unchanged on 9623e8a
- **Where:** 1-1 flagpole, column 198 (all flagpoles)
- **How to get there:** `?level=1-1&char=mario`
- **Character and power:** Mario, any
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Grab the flagpole and watch the score popup during the slide and tally.

## Expected

As in the original: the popup floats up and stays near the top of the pole.

## Actual

The popup (for example "400") stays at the height where Mario grabbed the pole and remains on screen until the level ends.

## How often

every time

## Notes

Our `ScorePopup` in `src/game/entities/effects/effects.ts` rises and expires after 40 frames, so its update probably does not run during the level-clear sequence. Not confirmed in code.

Reference: the original's source at https://github.com/JayPavlina/super-mario-bros-crossover (paths under `src/`), compared with a playthrough of the original 3.1.21 in the Ruffle emulator.
