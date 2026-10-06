# A moving lift carries the player straight through solid blocks (ll-4-1 sky: the brick column at column 32)

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** ll-4-1-sky (the coin heaven reached by the vine at ll-4-1 column 170). The `lift-right` lift starts at columns 17-19, row 10 (48 px wide), and the brick column is at column 32, rows 2-9. The same carry code moves the rider on every lift; the other lifts that run into walls are listed in Notes.
- **How to get there:** `?level=ll-4-1-sky&char=mario` (`&dev=1` for F1). In the real level, hit the brick at ll-4-1 column 170, row 5 from below and climb the vine.
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=ll-4-1-sky&char=mario` and climb the vine (hold up).
2. Jump off to the right and walk to column 15.
3. Jump onto the lift at columns 17-19, row 10. It starts drifting right at 1 px per frame.
4. Stand still on the lift and let it carry you right to the brick column at column 32.

## Expected

The bricks at column 32, rows 2-9 are solid. Mario stands on the lift with his body in row 9. When the lift reaches the column, he is held against the bricks' left side while the lift moves on beneath them (row 10 is open under the column), and he drops off once the lift has passed under him. He then has to walk under the column on the ground (feet on row 13).

**Code (original):** the original moves the rider before its wall check, so walls still stop him.
- This lift is `movingPlatform&&width=6&&type=StepConstantRight` at (17,10) in `levelDataLostLevels.xml`, level 4-1, area `c`, and the column is `brick` at (32, 2-9) on the normal layer (row 10 is empty). `Platform.as` `CONSTANT_RIGHT_SPEED = 120` Flash px/s = 1 px per frame at our scale, the same as ours.
- For this cloud-type lift, `Platform.setCharOnPlat` sets `player.cloudPlatform = true` (`com/smbc/ground/Platform.as` line 414), and `Platform.updateGround` moves the rider with `player.x += dx` (lines 296-302). For every other lift type, `Character.checkPlatform` does `nx += dxPlatform` (`com/smbc/characters/Character.as` lines 1069-1083, called at line 950; it skips cloud lifts).
- Both happen before the ground hit test: `Level.gameLoop` runs the platforms' `updateGround` (`Level.as` line 1851), then each object's `updateObj` (line 1859, which starts from `nx = x`), then `checkCollisions` (line 1887). The hit test compares Mario's last-frame box with the brick (`HitTester.checkLastHitPoints`, "mc1 was left of mc2 only", line 398), and `Character.groundOnSide` (line 1479) clamps him back to `nx = g.hLft - hWidth/2` (line 1506).

## Actual

Mario rides through the bricks without stopping. With F1 on, he stays at y 144 on the lift while x goes 483 (tile 30) → 543 (tile 33.9) in 60 frames. In a share-link copy, a frame at x 511 shows him drawn inside the column (x 512-528). He comes out on the other side still standing on the lift.

**Cause:** `Lift.carry()` (`src/game/entities/objects/lift.ts` lines 107-129) moves the rider with `rider.x += this.dx` and `rider.y += this.dy` and does no tile check. It runs from `World.resolveLifts()` (`src/game/world/world.ts` lines 1101-1106), which is called (line 576) after the players' own movement and tile collision for the frame. The next frame doesn't push him out either: `moveX` (`src/game/entities/body.ts` lines 34-61) does nothing when the player's own `dx` is 0, and when he walks it only tests the column at his leading edge.

## How often

every time

## Notes

- Ours: playtested in the real `ll-4-1-sky`, and in a share-link copy with `start:` moved onto the lift (18,9). Original: found by reading the code and data. The ll-w4 tester couldn't reach the original's coin heaven in Ruffle, because the original ran about 5-10 times slower than real time.
- Not the filed lift path and speed reports (`2026-10-05-lifts-sideways-lifts-wrong-path-and-speed.md` and the others) or the placement report (`2026-10-05-converter-ignores-shiftup-shiftright.md`). The speed here matches; the bug is that the rider has no wall collision. Those reports make it worse, though: our `lift-h` runs from its column to 48 px right of it, while the original swings ±30 px around the cell centre, so several of our lifts reach walls the original's never touch (table below).
- In this sub-area the wall decides how the area plays. In the original the column scrapes Mario off the lift, so he can't ride it past column 32 and has to drop to the ground. In ours he rides on past it. Further on, the solid row at columns 48-63, row 9 is at the rider's body height too, so a rider who gets back on the lift after column 32 would be scraped off again there in the original. That second contact was not tested in ours.
- **Lifts that run into walls (reviewer's scan of every map in `src/content/levels/`, both map sets).** A wall counts when a solid tile is in a rider's rows (the row above the lift; two rows for big Mario) anywhere a rider can stand on the lift, overhang included. The original's path uses the cell-centred anchor and ±30 px `WaveHorizontal` swing from the reports above. Walls and lift cells were checked in both XMLs.

  | Level | Lift (our map) | Wall | Ours | Original |
  |---|---|---|---|---|
  | ll-2-1-sky, ll-3-1-sky, ll-4-1-sky | `lift-right 17 10 len=6` (StepConstantRight) | brick column at 32, rows 2-9; solid row 48-63, row 9 | rider carried through | rider scraped off at 32 |
  | SMB 3-1-sky, 6-2-sky | `lift-right 17 10 len=6` | single blocks at 32, 51 and 61, row 8 | big Mario carried through | big Mario scraped off (small Mario passes under) |
  | ll-5-1-sky, ll-8-3-sky | `lift-right 16 10 len=4` | blocks at 69 (rows 7-8) and 79 (row 8) | big Mario carried through | big Mario scraped off (small Mario passes under) |
  | ll-11-4 | `lift-h 66 10 len=4` | shaft walls at 60-63 and 69-71, rows 6-14 | the lift itself runs 32 px into the right wall, carrying the rider into it | the lift's ends reach 6 px into both walls; a rider at either end is scraped |
  | ll-2-4 | `lift-h 138 5 len=4` | hanging wall at 142-143, rows 3-5 | the lift runs 16 px into the wall, carrying the rider | lift stops 2 px short; a rider on its right end is scraped |
  | ll-5-4 | `lift-h 202 6 len=4` | hanging wall at 206-207, rows 3-5 | the lift runs 16 px under the wall, carrying the rider into it | lift stops 2 px short; a rider on its right end is scraped |
  | ll-1-4 | `lift-h 137 6 len=4` | hanging wall at 142-143, rows 3-5 | a rider on the lift's right end is carried up to 11 px into the wall | lift stops 18 px short: no contact |
  | ll-2-1 | `lift-h 107 12 len=6` | mushroom cap at 112-115, row 11 | a rider on the right end is carried into the cap | lift stops 18 px short: no contact |
  | SMB 8-4 | `lift-h 70 13 len=4` | wall at 75-80, rows 10-14 | a rider on the right end is carried up to 11 px into the wall | no contact |

  No other `lift-h` or `lift-right` reaches a wall. SMB 2-1-sky and 5-2-sky and ll-10-1-sky, ll-11-1-sky, ll-12-1-sky and ll-13-2-sky have no blocks in the rider's rows. No vertical lift (`lift-v`, `lift-up`) carries a rider into a ceiling in our maps.
- Screenshot: not committed (the repo's `check:assets` bans image files), six frames 1 s apart (60 game frames) in the real `ll-4-1-sky`. Mario is left of the column in frame 3 (x 483) and right of it in frame 4 (x 543), still on the lift at y 144.
- Source: `ll-w4/2026-10-05-lifts-carry-player-through-walls.md`. The reviewer corrected the lift's columns (17-19, not 17-22: `len=6` is 48 px), found that this lift moves its rider through `Platform.updateGround` rather than `checkPlatform`, confirmed the frame order, and added the list of lifts that run into walls.
- **Related (ll-wC review):** the ll-11-4 lift at 66 above is also the one that never comes under the entry shaft at column 64, which makes ll-11-4 impossible. See `2026-10-05-ll-12-4-lava-lift-never-reaches-drop-shaft.md`.
- Reviewed: verified against `com/smbc/ground/Platform.as` (`updateGround` lines 262-330, `setCharOnPlat` lines 374-415, `CONSTANT_RIGHT_SPEED`, `hWaveRange`), `com/smbc/characters/Character.as` (`checkPlatform`, `groundOnSide`), `com/smbc/main/AnimatedObject.as` (`groundBelow` sets `dxPlatform`), `com/smbc/main/LevObj.as` (`updateObj`), `com/smbc/level/Level.as` (`gameLoop`), `com/smbc/level/HitTester.as` (`checkLastHitPoints`), both level XMLs, and ours: `src/game/entities/objects/lift.ts`, `src/game/world/world.ts` (`update`, `resolveLifts`), `src/game/entities/body.ts` (`moveX`), the maps named above.
