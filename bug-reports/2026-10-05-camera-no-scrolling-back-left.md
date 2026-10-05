# Camera never scrolls back left, unlike the original

- **Severity:** wrong behaviour
- **Build:** V0.1.0-11B3C46 (playtested); the code involved is unchanged on 9623e8a
- **Where:** 1-1, any column (affects every scrolling level)
- **How to get there:** `?level=1-1&char=mario`
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Hold right until the screen has scrolled past the first ? block (column 16).
2. Hold left.

## Expected

As in the original Crossover, the camera keeps Mario near the middle of the screen and follows him back left, all the way to the level's start. There is a small dead zone when he turns around.

## Actual

Mario is held about a third of the way across the screen (x = 80 of 256) and the screen never scrolls left. The left edge acts as a wall, so a mushroom that drifts off to the left is lost.

## How often

every time

## Notes

Ours: `src/game/world/camera.ts` (`pushX = px(80)`, left scrolling only when `allowLeftScroll` is on). That assist is off by default in `src/engine/save/settings.ts` and `src/game/context.ts`. Suggest making centred two-way following the default and keeping the NES-style lock as an option. This is a design choice, so confirm the intended default first.

Reference: the original's source at https://github.com/JayPavlina/super-mario-bros-crossover (paths under `src/`), compared with a playthrough of the original 3.1.21 in the Ruffle emulator.
