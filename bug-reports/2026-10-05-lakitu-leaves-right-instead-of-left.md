# Lakitu speeds off to the right at the end of his stretch; the original drifts slowly off to the left

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 4-1, column 208 (the Lakitu end marker, just before the staircase); 6-1, column 170 (the end marker, on the staircase before the flagpole); also 8-2 (end 40)
- **How to get there:** `?level=4-1&char=mario` (Dev mode assists Inf. Lives and No Damage were used to get there)
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Play 4-1 to column 201 or so with Lakitu still alive (F1 on).
2. Walk right until Mario stands against the first stair block (column 207, x = 3316).
3. Stand still and watch Lakitu for 2 seconds.

## Expected

The original's Lakitu turns round and leaves to the **left** at a slow constant speed, and is removed once
he is off screen. If the player walks back left of the end marker before he is gone, he comes back and
carries on. `Lakitu.checkState()` (Lakitu.as lines 136–158): when `player.nx > lakSpwnr.enemyEndPos` it sets
`vx = -EXIT_SPEED` with `EXIT_SPEED = 100` (line 46), `destroyOffScreen = true`, and stops its throw timers;
otherwise it resumes (`exiting = false`, timers back on). 100 px/s on the original's 32-px tiles is about
3.1 tiles per second, which is 0.83 px per frame at our 16-px tiles and 60 fps.

## Actual

Our Lakitu accelerates to the **right** up to 2.75 px per frame (`MAX_SPEED = 0x02c00`, `ACCEL = 0x00100`)
and is gone past the right edge of the screen in under 2 seconds (shots `ours/159_leave0.png` …
`164_leave5.png`: Lakitu above column 207, then 211, then off the right edge). The zone is marked done for
good (`this.done = true`), so walking back never brings him back. Code: `src/game/entities/enemies/lakitu.ts`
lines 41–45 (`Lakitu.update`, leaving) and 113–117 (`LakituZone.update`, zone end).

## How often

every time

## Notes

- Ours playtested; original found by reading `Lakitu.as`. The smb-w4 tester could not get Lakitu to column 208
  alive in Ruffle (the emulator ran at a fraction of real speed and Spinies kept killing small Mario).
- 6-1 (smb-w6), ours playtested in a share-link copy of 6-1 with only the start moved to column 160 (HUD reads
  WORLD 1-1): jump the gap at columns 164–166 and climb the stairs to column 170. With Mario at column 170,
  Lakitu is mid-screen in `shots/smb-w6/ours/043_e3.png`, at the right edge in `044_e4.png` and gone in
  `045_e5.png` (series `041_e1` … `046_e6`). The original is from code only there too: the tester could not
  reach column 170 in Ruffle.
- Screenshots: not committed (the repo's `check:assets` bans image files) (4-1, three frames, 0.8 s apart) and
  (screenshot not committed: the repo's `check:assets` bans image files) (6-1, Mario at column 170, Lakitu at the right edge).
- Related: `2026-10-05-4-1-lakitu-appears-before-start-column.md` (the zone start).
- Merged from `smb-w4/2026-10-05-lakitu-leaves-right-instead-of-left.md` (4-1) and
  `smb-w6/2026-10-05-6-1-lakitu-leaves-to-the-right.md` (6-1).
- Reviewed: verified against `com/smbc/enemies/Lakitu.as` (`checkState`, `EXIT_SPEED`), `com/smbc/level/EnemySpawner.as` (`enemyEndPos`), `GlobVars.TILE_SIZE` = 32, `levelDataSmb.xml` (6-1 `lakituEnd` at column 170 on NORMAL), and ours: `src/game/entities/enemies/lakitu.ts`, `src/engine/math/units.ts`

Status: fixed — while the player's middle is past the end column (`player.nx > enemyEndPos`) Lakitu drifts left at `EXIT_SPEED` (0.83 px/frame) without throwing and is removed once off screen; walking back before then brings it back. In 4-1 the end column 208 is the first stair, so Mario has to step onto the stairs (standing against them is not past the end in the original either).
