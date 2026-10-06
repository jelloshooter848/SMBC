# Underwater: a swim stroke lifts Mario about 18 px instead of about 28 px, and he sinks at half the original's top speed

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every water level; measured in 2-2 at column 2 (standing on the sea floor, F1 shows `tile 2,12`)
- **How to get there:** `?level=2-2&char=mario`
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=2-2&char=mario`, wait for Mario to settle on the sea floor at column 2 and turn on F1.
2. Tap jump once (50 ms) and step the game 3 frames at a time, reading `y` and `vy` from the overlay.
3. Swim up near the surface, release everything and watch `vy` while Mario sinks.

## Expected

The original (Mario in `MarioBase.as`) sets a water stroke of `JUMP_PWR_WATER = 200` (line 137, applied as `vy = -jumpPwr` at line 771), water gravity `350` (lines 257-259) and caps sinking at `vyMaxPsvWater = 250` (`Character.as` line 225, applied at lines 996-998). In NES pixels at 60 fps that is a stroke of 1.67 px/frame, gravity 0.049 px/frame² and a sink cap of 2.08 px/frame, so one stroke from rest lifts Mario about 28 px (1.8 tiles) and he sinks faster than he swims sideways (2.08 vs 1.46 px/frame).

Playtested in the original's 2-2: one tap from the sea floor raised Mario's feet from screen y 475 to 422, which is 26.5 NES px with the sample before the peak (`orig/080_st0.png`–`084_st4.png`). While sinking, he fell 76 screen px per wall-second against 52 for swimming sideways, a ratio of 1.46, which matches the source.

## Actual

Our stroke is 1.5 px/frame with gravity 0.0625 px/frame² and a sink cap of 1 px/frame (`build/src/game/entities/player.ts` lines 11-13, used at lines 270 and 292-293). One tap from the floor goes from y 192 to y 173, a 19 px rise (about 1.2 tiles). Mario sinks at 1.0 px/frame, more slowly than he swims sideways (1.56 px/frame), the reverse of the original. Mario needs about 50% more taps to climb, and diving takes twice as long.

## How often

every time

## Notes

Playtested in both games, and confirmed in the original's source. The original's timings come from Ruffle, which runs at about a quarter speed in this harness, so its distances are reliable and its times are only ratios. Seabed walking speed is filed separately (`2026-10-05-water-seabed-walk-speed.md`).
- Units: the original's speeds are Flash px per second at 32 px tiles, so NES px/frame = Flash value / 2 / 60 (200 → 1.67, 250 → 2.08, `MAX_WALK_SPEED` 175 → 1.46) and gravity NES px/frame² = Flash value / 2 / 3600 (350 → 0.049). Rise = 1.67² / (2 × 0.049) ≈ 28.6 px; ours 1.5² / (2 × 0.0625) = 18 px.
- In the original, Mario counts as out of the water while his top is within 2 tiles of the screen top (`Character.as` lines 985-995); the sink cap and water gravity apply only below that.
- Source: `smb-w2/2026-10-05-water-swim-stroke-and-sinking.md`.
- Also seen in ll-4-1-water (ll-w4 tester, ours; folded in by the ll-w3 to ll-w5 review). No new measurements.
- Reviewed: verified against `com/smbc/characters/base/MarioBase.as` (`JUMP_PWR_WATER`, `setStats` water gravity, `jump`), `com/smbc/characters/Character.as` (`vyMaxPsvWater`, the water block in the per-frame update), and ours: `src/game/entities/player.ts` (`SWIM_STROKE`, `SWIM_GRAVITY`, `SWIM_SINK_MAX`, `swim`).

Status: fixed — Mario and Luigi swim with JUMP_PWR_WATER = 200 (1.67 px/f, ~28 px per stroke) and water gravity 350, and every hero sinks at up to Character.as vyMaxPsvWater = 250 (2.08 px/f).
