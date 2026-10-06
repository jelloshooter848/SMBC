# A stomped out-of-water Blooper hops and drifts sideways instead of dropping straight down

- **Severity:** cosmetic
- **Build:** V0.3.0-DEV.8F4BF1A (main 8f4bf1a)
- **Where:** any Blooper outside water, for example ll-1-3 or ll-2-3 (column 95)
- **How to get there:** `?level=ll-2-3&char=mario`, or a small test map with a Blooper on dry land
- **Character and power:** Mario, small
- **Input:** keyboard
- **Browser and device:** headless Chromium on Linux (cloud container, scripted through Playwright)

## Steps

1. Find a Blooper outside water.
2. Stomp it.

## Expected

As in the original: `Bloopa.stomp()` calls `die()` and then sets `vx = 0; vy = 0`, so the Blooper drops straight down from where it was stomped.

## Actual

The stomp scores 1000 and the Blooper turns upside down, as fixed in `2026-10-05-blooper-out-of-water-not-stompable.md`. But it pops up and drifts sideways at about 0.5 px/frame while falling.

## How often

every time

## Notes

- Cause, by code: ours uses the generic `flip` reaction, so the corpse gets the standard knock-out launch from `2026-10-05-enemies-knocked-out-fall-upright.md`. The Blooper needs its own: no hop and no sideways speed.
- Found by the build review of V0.3.0-DEV.8F4BF1A. Screenshot names in the review: `150_bj`…`164_bk6`. Not committed (`check:assets` bans image files).

Status: fixed — `Enemy.flipOut` takes a `hop` flag, and `Blooper` passes false for a stomp, so its corpse starts with vx 0 and vy 0 and drops straight down upside down (Bloopa.stomp). Other kills keep the knock-out hop. Test: tests/sim/water-enemies.test.ts, "a stomped Blooper drops straight down".
