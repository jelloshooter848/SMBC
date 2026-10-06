# Underwater: every hero can swim with mid-water strokes; in the original only Mario and Luigi can, the others only jump off the ground with their own water jump and gravity

- **Severity:** wrong behaviour
- **Build:** commit 01967c8 (branch of agent E, on top of 6a45269)
- **Where:** every water level, for example 2-2 from column 2
- **How to get there:** `?level=2-2&char=link` (also `megaman`, `ryu`, `samus`, `simon`, `bill`)
- **Character and power:** any non-Mario hero, any power
- **Input:** keyboard
- **Browser and device:** found by code reading; not playtested

## Steps

1. Open `?level=2-2&char=link` and let Link sink to the sea floor.
2. Tap jump several times while he is off the floor.

## Expected

In the original, mid-water strokes belong to Mario and Luigi only: `MarioBase.as` `pressJmpBtn()`
jumps when `onGround || (level.waterLevel && underWater)`. Every other hero's `pressJmpBtn()` (or the
jump code it calls) checks `onGround` first, so under water they jump off the floor or a ledge only,
with their own water jump power and gravity set in `setStats()` when `level.waterLevel`:

| Hero | Water jump power | Water gravity | Source |
|---|---|---|---|
| Link | `JUMP_PWR_WATER = 500` | `GRAVITY_WATER = 500` | `Link.as` constants, `setStats` |
| Ryu | `JUMP_PWR_WATER = 400` | `GRAVITY_WATER = 500` | `Ryu.as` constants, `setStats` |
| Mega Man | `JUMP_PWR_WATER = 500` (560 with the high-jump upgrade) | `GRAVITY_WATER = 500` | `MegaManBase.as` constants, `setStats` |
| Samus | her normal `jumpPwr` | 400 | `Samus.as` `setStats` |
| Simon | his normal `jumpPwr = 565` | 750 | `Simon.as` `setStats` |
| Bill | his normal `jumpPwr = 550` | 500 | `Bill.as` `setStats` |

Units: Flash px/s at 32 px tiles, so /2/60 for our px/frame and /2/3600 for px/frame². The sink cap is
`Character.as` `vyMaxPsvWater = 250` for every hero (already matched).

## Actual

`src/game/entities/player.ts` `swim()` lets any hero stroke at any time under water, with the shared
`DEFAULT_SWIM` (stroke 1.5 px/f, gravity 0.0625 px/f²) for every hero without a `swim` profile. Only
Mario and Luigi have their own (`MARIO_PROFILE.swim`). So Link, Mega Man, Ryu, Samus, Simon and Bill
swim up like Mario instead of making floaty jumps off the floor.

## How often

every time

## Notes

- Found while fixing `2026-10-05-water-swim-stroke-and-sinking.md` (agent E); left out of that fix on
  purpose because it changes how six heroes get through every water level. Check that water levels
  stay passable with floor-only jumps (for example the walls in 2-2 and 7-2) before changing it.
- Simon, Samus and Bill keep their normal jump power, so under halved gravity they jump much higher
  than on land.
