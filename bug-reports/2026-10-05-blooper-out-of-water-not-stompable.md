# Out of water, landing on a Blooper hurts Mario; the original lets you stomp it for 1000 points

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every Blooper in a non-water area, all in The Lost Levels: ll-1-3 (columns 57 and 83), ll-2-3 (column 95), ll-5-3, ll-8-4-end2, ll-10-3, ll-12-2, ll-13-4-exit and ll-13-4-end (full list in Notes). Seen in ll-1-3 at column 80 and in ll-2-3 at columns 91-92.
- **How to get there:** `?level=ll-1-3&char=mario`, go to the treetop at columns 75-81 (the Blooper from column 83 floats beside it). Or `?level=ll-2-3&char=mario`, go to the end of the low bridge at column 92 (the Blooper from column 95 comes to you). For a quick test, the testers used share-link copies of the real maps with only `start:` moved (`79,3` in ll-1-3, `92,11` in ll-2-3).
- **Character and power:** Mario, small (ll-1-3: Dev assist infinite lives; ll-2-3: also tried with Dev assist "No damage")
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open ll-1-3 and stand on the treetop at column 79, or open ll-2-3 and stand on the bridge at column 92.
2. Wait for the Blooper to come level with or below Mario, then jump and come down squarely on top of it.
3. Watch what happens on contact.

## Expected

Outside a water area, a Blooper is stompable like any other enemy. It dies and scores 1000.

- `com/smbc/enemies/Bloopa.as` `setStats()` lines 50-53: `if (level.waterLevel) stompable = false; else stompable = true;`.
- `Bloopa.stomp()` lines 79-88: if `stompable` and `player.canStomp`, it calls `super.stomp()` and `die()`.
- `overwriteInitialStats()` line 44: `scoreStomp = ScoreValue.BLOOPA_STOMP` = 1000 (`com/smbc/data/ScoreValue.as` line 22). `Enemy.stomp()` (`com/smbc/enemies/Enemy.as` lines 299-302) pays the larger of `scoreStomp` and the stomp-chain value, so a first stomp gives 1000.
- `level.waterLevel` is true only for areas of type `water` (or with the water-mode cheat): `com/smbc/level/Level.as` lines 440-445, `LevelTypes.WATER = "water"`. ll-1-3 is `<AREA ID="a" TYPE="platform">` and ll-2-3 is `TYPE="cheepCheep"` in `levelDataLostLevels.xml`, so their Bloopers are stompable.

## Actual

Mario is hurt as if he had touched the Blooper from the side. Small Mario dies: the world freezes on contact, Mario does the death hop, and the hero-select screen follows. With the "No damage" assist on (ll-2-3), Mario passes through it, the Blooper stays alive and no points are scored.

Cause: `src/game/entities/enemies/blooper.ts`, constructor lines 29-30, always sets `this.stompable = false` and `this.vulnerability.stomp = 'hurtAttacker'`, in water or not (the class comment, line 15, says "Not stompable"). In `World` (`src/game/world/world.ts` line 1006) a stomp only happens when `e.stompable`, so the landing falls through to contact damage. Only the movement code looks at water (`world.waterTop` / `AIR_TOP`, lines 11 and 57). The 1000-point value is already in `src/game/rules/score.ts` line 28 (`BLOOPA: { stomp: 1000, ... }`) but is never paid for a stomp.

Our "is this a water level" test is the map theme (`isWaterTheme` in `src/game/level/schema.ts` line 46, which sets `world.waterTop` in `world.ts` lines 200-211). For every map with Bloopers it agrees with the original's area type, so the fix can key on `Number.isFinite(world.waterTop)` (or the theme) when the Blooper spawns: stompable with the normal `kill` stomp reaction out of water, unchanged in water.

## How often

every time (the code has no water check for stomps). In play, ll-1-3: Mario landed squarely on a Blooper once and died, and missed it as it moved on the other tries. ll-2-3: reproduced with and without the "No damage" assist.

## Notes

- **Levels with Bloopers outside water** (normal layer of both XMLs, Mario-visible; our maps have the same Bloopers at the same cells). The SMB map set has none: all its Bloopers are in water areas.

  | Our map | XML level, area (type) | Bloopers (column,row) |
  |---|---|---|
  | `ll-1-3` (theme overworld) | 1-3 a (`platform`) | 57,6 and 83,4 |
  | `ll-2-3` (night) | 2-3 a (`cheepCheep`) | 95,9 |
  | `ll-5-3` (overworld) | 5-3 a (`platform`) | 45,9; 109,9; 193,7 |
  | `ll-8-4-end2` (castle) | 8-4 d (`castle`) | 25,12 and 89,12 |
  | `ll-10-3` (clouds) | 10-3 a (`platform`) | 70,7 |
  | `ll-12-2` (night) | 12-2 a (`cheepCheep`) | 21,5; 47,9; 65,5 |
  | `ll-13-4-exit` (overworld) | 13-4 b (`normal`) | 44,11 and 51,5 |
  | `ll-13-4-end` (castle) | 13-4 d (`castle`) | 36,7; 39,10; 42,6 |

  That is 17 Bloopers in 8 maps. Every other Blooper (SMB 2-2, 5-2, 6-2, 7-2, 8-4 water areas; Lost Levels 3-2, 4-1, 6-1, 6-2, 8-1, 8-4 b, 9-1, 9-4, 11-2) is in a `water` area and stays unstompable. The ll-w2 tester also listed 1-2 (area b), 3-1, 6-1 and 6-2 (area c); the reviewer checked those Bloopers and they are all `HideOnDifficulties=easynormal` (hard only), so they don't apply.
- **Related, not part of this fix:** `2026-10-05-blooper-sink-speed-and-rise-rule.md` covers the Blooper's sink and rise motion. The ll-w2 tester also noticed that out of water ours stops the Blooper at y 32 (`AIR_TOP`, `blooper.ts` line 11), while the original has no hard ceiling: it only starts braking the rise once its bottom is within 4 tiles of the stage top (`Bloopa.as` line 112) and drifts on. In the original's 2-3 the Blooper was seen as high as about row 1. The reviewer added this to the sink/rise final's notes rather than filing it separately.
- **Evidence:** our side playtested by both testers. The original's side is from code. Both testers played the level in the original (ll-1-3 with the Invincible, Infinite lives and Bouncy pits cheats, about 10 tries; ll-2-3 with Invincible and Bouncy pits) and saw the Blooper stretch up toward a Mario above it, but neither managed to land on it before Ruffle slowed down too much, so the 1000-point stomp itself was not seen.
- Screenshots (ours): (screenshot not committed: the repo's `check:assets` bans image files) (ll-1-3, F1 x 1283, tile 80,1, vy +4.0: Mario on top of the Blooper at the moment it kills him) and (screenshot not committed: the repo's `check:assets` bans image files) (ll-2-3 test map, column 91: Mario landing on the Blooper just before the death fall; the HUD says WORLD 1-1 because it is a share-link copy).
- D-4 (ll-wD tester, played in ours): the Bloopers in `ll-13-4-end` (columns 36-42) float in the castle air, and those in `ll-13-4-exit` (44,11 and 51,5) in the open air. They could not be stomped there either.
- PR #24 check: still applies on main 2225155. `git diff b8379f9 HEAD` is empty for `blooper.ts`, `world.ts`, `schema.ts`, `score.ts` and every map in `src/content/levels/`.
- Sources: `ll-w1/2026-10-05-ll-1-3-blooper-out-of-water-not-stompable.md` and `ll-w2/2026-10-05-ll-2-3-blooper-out-of-water-not-stompable.md`, merged. The reviewer built the level table from both XMLs and our maps, removed the hard-only levels, and added the stomp branch in `world.ts` and the `waterTop` fix hint.
- Reviewed: verified against `com/smbc/enemies/Bloopa.as` (`setStats`, `stomp`, `overwriteInitialStats`, `updateStats`), `com/smbc/enemies/Enemy.as` (`stomp` score), `com/smbc/data/ScoreValue.as`, `com/smbc/data/LevelTypes.as`, `com/smbc/level/Level.as` (`waterLevel`), both level XMLs (area types and Blooper cells), and ours: `src/game/entities/enemies/blooper.ts`, `src/game/world/world.ts` (stomp branch, `waterTop`), `src/game/level/schema.ts` (`isWaterTheme`), `src/game/rules/score.ts`, the `blooper` lines and themes of every map in `src/content/levels/`.
