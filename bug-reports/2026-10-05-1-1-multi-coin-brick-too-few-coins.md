# Multi-coin brick gives at most 10 coins in 5 seconds; the original allows 15 in 6

- **Severity:** wrong behaviour
- **Build:** V0.1.0-11B3C46 (playtested); the code involved is unchanged on 9623e8a
- **Where:** 1-1, column 94 (the brick under the high ? block); all multi-coin bricks
- **How to get there:** `?level=1-1&char=mario`
- **Character and power:** Mario, small and big
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Stand under the brick at column 94.
2. Bump it repeatedly, about once every 0.65 seconds.

## Expected

As in the original (`ground/Brick.as`: `COIN_BRICK_MAX_COINS = 15`, `coinBrickTmrDur = 6000`): a 6-second timer starts on the first hit, and the brick turns into a used block after 15 coins or when the timer ends.

## Actual

The brick turned into a used block after 7 coins. Our rule is 10 coins within 300 frames, so the timer ran out first. In the original the same bumping rate gave 15 coins.

## How often

every time

## Notes

Ours: the `coins10` case in `src/game/world/world.ts` (`{ left: 10, until: this.frame + 300 }`).

Reference: the original's source at https://github.com/JayPavlina/super-mario-bros-crossover (paths under `src/`), compared with a playthrough of the original 3.1.21 in the Ruffle emulator.
