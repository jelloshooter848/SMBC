# Lives card before a level has no HUD

- **Severity:** cosmetic
- **Build:** V0.1.0-11B3C46 (playtested); the code involved is unchanged on 9623e8a
- **Where:** the "WORLD 1-1 / x 3" card before any level
- **How to get there:** `?level=1-1&char=mario`
- **Character and power:** any
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Start a level and look at the black lives card.

## Expected

As in the original Crossover: the HUD (score, coins, world, TIME 400) shows across the top of the card.

## Actual

The card shows only "WORLD 1-1" and the hero icon with the lives count.

## How often

every time

## Notes

Ours: `src/game/scenes/intro.ts`.

Reference: the original's source at https://github.com/JayPavlina/super-mario-bros-crossover (paths under `src/`), compared with a playthrough of the original 3.1.21 in the Ruffle emulator.
