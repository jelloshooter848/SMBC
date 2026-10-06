# Water levels: above the surface line Mario uses his normal air jump physics; the original uses defGravity 700 with a 400 fall cap, and big Mario leaves the water at a different height

- **Severity:** wrong behaviour
- **Build:** commit 01967c8 (branch of agent E, on top of 6a45269)
- **Where:** every water level, at the surface; for example 2-2, swimming up to the wave tiles at row 2
- **How to get there:** `?level=2-2&char=mario`
- **Character and power:** Mario or Luigi, small and big
- **Input:** keyboard
- **Browser and device:** found by code reading; not playtested

## Steps

1. Open `?level=2-2&char=mario` and stroke up until Mario reaches the surface.
2. Watch how he falls back once he is above the water line, small and big.

## Expected

`Character.as` water block (per frame, while `level.waterLevel`): when `hTop <= GLOB_STG_TOP +
TILE_SIZE*2` (the hit box top within 2 tiles, 32 of our px, of the stage top) the hero is not
`underWater` and `gravity = defGravity`; otherwise `gravity = defGravityWater` with the sink cap.
For Mario and Luigi in a water level, `MarioBase.as` `setStats()` sets `defGravity = 700`
(0.097 px/frame²) and `vyMaxPsv = 400` (3.33 px/frame). Their jump power stays `JUMP_PWR_WATER = 200`,
and `pressJmpBtn()` only jumps when `onGround || underWater`, so above the line Mario cannot stroke and
simply falls back under this lighter gravity.

The test is on the hit box top, so the switch happens at the same top height for small and big Mario.

## Actual

`src/game/world/world.ts` sets `p.inWater = p.body.y + (p.body.h >> 1) >= this.waterTop` (the body's
centre against the wave row + 8 px). When it is false, `Player.update()` runs the normal land physics
from the hero's profile: Mario's jump tiers (hold gravity 0x200, fall gravity 0x700 = 0.43 px/frame²)
and fall cap 4.5 px/frame, not 700 / 400.

Because ours tests the centre, the switch height depends on the hit box height: small Mario (16 px)
leaves the water when his top passes y 32, as in the original, but big Mario (24 px box) leaves it with
his top at y 28, higher than small Mario. The reviewer worked out about 8 px; the exact gap depends on
where the original's hit rectangle top sits in the SWF art, which was not checked.

## How often

every time

## Notes

- Related: `2026-10-05-water-swim-stroke-and-sinking.md` (fixed: under-water stroke, gravity and sink
  cap) and `2026-10-06-water-non-mario-heroes-stroke.md`.
- Other heroes have their own `defGravity` (their land gravity) above the line in the original, which
  ours already uses, but they also switch on the centre test rather than `hTop`.
