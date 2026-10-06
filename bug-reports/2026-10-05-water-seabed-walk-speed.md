# Underwater: walking on the sea floor is as fast as walking on land; the original halves it

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every water level; measured in 2-2, columns 2–6 on the sea floor
- **How to get there:** `?level=2-2&char=mario`
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=2-2&char=mario` and let Mario land on the sea floor (column 2), with F1 on.
2. Hold right for 1 s without jumping.
3. Read `vx` in the overlay.

## Expected

In the original, Mario walks at half speed while he stands on the floor under water. `MarioBase.as` line 254 sets `walksSlowUnderWater = true`, and `Character.as` (line 226, `vxMaxGroundWater = 90`, applied at lines 999-1004) clamps his ground speed to 90 Flash px/s = 0.75 NES px/frame. Swimming off the floor keeps the normal cap of `MAX_WALK_SPEED = 175` (1.46 px/frame).

Playtested in the original's 2-2: walking on the floor moved Mario 63 and then 60 screen px per 3 s of wall time (`orig/095_wa0.png`–`097_wa2.png`). Swimming sideways moved him 157 screen px in the same time (`orig/100_sm0.png`, `101_sm1.png`), so floor walking is less than half the swimming speed.

## Actual

Our Mario walks on the sea floor at `vx 1.563`, the same as on land and the same as swimming (overlay, column 6). `swim()` in `build/src/game/entities/player.ts` (lines 261-263) clamps only to `maxWalk` and has no slower case for standing on the floor.

## How often

every time

## Notes

Playtested in both games, with the original's source as backup. Related report: `2026-10-05-water-swim-stroke-and-sinking.md`.
- The source ratio of floor walking to swimming is 90 / 175 = 0.51; the playtest gave about 0.39, which fits within Ruffle's uneven speed. Our `maxWalk` is 0x01900 = 1.5625 px/frame (`src/game/characters/mario/profile.ts`).
- The clamp in the original applies only while Mario is under water (more than 2 tiles below the screen top) and on the ground, so it covers the sea floor and any underwater ledge.
- Source: `smb-w2/2026-10-05-water-seabed-walk-speed.md`.
- Reviewed: verified against `com/smbc/characters/base/MarioBase.as` (`walksSlowUnderWater`, `MAX_WALK_SPEED`), `com/smbc/characters/Character.as` (`vxMaxGroundWater`, the water block in the per-frame update), and ours: `src/game/entities/player.ts` (`swim`), `src/game/characters/mario/profile.ts` (`maxWalk`).

Status: fixed — Mario and Luigi now walk on the sea floor at vxMaxGroundWater = 90 (0.75 px/f) via a per-hero `swim.floorWalk` (MarioBase.as walksSlowUnderWater, Character.as water block); other heroes keep their walk cap.
