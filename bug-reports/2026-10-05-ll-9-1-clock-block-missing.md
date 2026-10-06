# ll-9-1: the `?` block at column 24 is a plain coin block; the original's 9-1 has a Clock item there (+100 time, 1000 points)

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** ll-9-1 (the flooded main area), the row of `?` blocks at columns 23-28, row 9. The block in question is column 24.
- **How to get there:** `?level=ll-9-1&char=mario`. Walk along the seabed to column 24 and swim up into the block. In the real level: ll-9-1-start, pipe at column 23, then the same spot.
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=ll-9-1&char=mario` and press F1.
2. Walk right along the seabed to column 24 (x about 386-397).
3. Swim up into the `?` block above you.

## Expected

The original's normal-difficulty 9-1 has a **Clock** in the block at column 24, row 9.

- **Data.** In `levelDataLostLevels.xml`, `<LEVEL ID="9-1">` (line 426), area `b`, cell 24,9 is `itemBlock&&ContainedItem=Clock()itemBlock&&HideOnDifficulties=hard`. The Clock block has no `HideOnDifficulties`, so it is placed on every difficulty. On easy and normal a second, plain (coin) `itemBlock` is placed on the same cell. On hard only the Clock block is placed.
- **Two blocks on one tile.** `Level.as` splits each cell on `PROP_OBJECT_SEP` = `"()"` ("used to separate objects on one tile", lines 116 and 716) and builds one `ItemBlock` per `itemBlock` token (line 869), so on normal there are two blocks at the same position.
- **What a hit does.** When Mario bumps a block from below, `Brick.hitCharacter` (`Brick.as` lines 193-207) adds that block to `level.gBounceArr`. With more than one block in the list and `canHitMultipleBricks` false (Mario), `Level.as` lines 2047-2051 sort the list by `yPenAmt` (the horizontal distance from Mario's centre, which is the same for both) and bounce only the first one. So one bump hits one of the two blocks:
  - If it is the Clock block, it bounces, and when the bounce ends `doneBouncing` → `addObj` (`Brick.as` lines 492-495 and 426-427) releases a `Clock` pickup out of the top of the block (`normalItemExitBrickStart`, line 456). Collecting it (`Character.as` lines 1641-1647) adds `Clock.TIME_TO_ADD` = 100 to the timer and pops `Clock.SCORE_VALUE` = 1000 points (`com/smbc/pickups/Clock.as`).
  - If it is the coin block, it gives a coin straight away (`Brick.as` lines 349-355).
  - Either way, the other block is still live on the same tile, so a second bump can release the other item. The order is not fixed by the code: both entries have the same `yPenAmt`. A spent block can also still enter the list, because `hitCharacter` does not check `disabled`. If it is picked, `bounce()` returns at once (line 297) and that bump does nothing.
- **The only one.** This is the only Clock in either map set's normal layer. Every other `ContainedItem=Clock` token is hidden on normal: all 45 in `levelDataSmb.xml` and the other 76 in `levelDataLostLevels.xml`. Everywhere else the Clock is limited to easy or to hard, so the missing `HideOnDifficulties` here may be a data slip in the original. The original still behaves as its data says.

## Actual

`src/content/levels/lost/world9/ll-9-1.map` line 23 (row 9) has six plain coin blocks `??????` at columns 23-28 (`?` is `T.Q_COIN`, `src/game/level/tiles.ts` line 97). Hitting column 24 gives one coin, and the block is then used.

- The converter turns the Clock into a coin block on purpose. `tools/levelgen/convert-smbc.mjs` lines 179-192 map `Clock` to `?` (in a `?` block), `E` (in a brick) and `2` (hidden), with the comment "the Clock item (time bonus) is not modelled and becomes a plain coin block". So the token is not lost by accident, but the item is.
- The cell's two tokens both become `?`, and the second overwrites the first (`b.set(x, y, ch)`, line 450), so the stacked second block is lost too.
- Ours has no Clock item at all: `PowerUpKind` in `src/game/entities/objects/powerup.ts` line 8 is only `mushroom`, `1up`, `flower`, `star` and `poison`.

## How often

every time

## Notes

- Evidence: ours playtested (the coin block hit from the seabed; the tester hit column 27 in the run they kept, and column 24 is the same `?` tile). The original was checked by reading its XML and source. In Ruffle the tester went through 9-1's start room and pipe but swam past the blocks before hitting column 24. A second attempt was too slow to finish (the emulator ran at about 1/12 speed).
- **Fix options for the owner.** The full match is two blocks on the cell: a Clock block and a coin block, one per bump. A simpler fix that gives the same items as hard difficulty is a single Clock block. Either way the Clock item (+100 time, 1000 points) has to be added.
- Screenshot: not committed (the repo's `check:assets` bans image files) (ours: the block row at columns 23-28, F1 on).
- Source: `ll-w9/2026-10-05-ll-9-1-clock-block-missing.md`. The reviewer checked the XML cell and every Clock token in both files, traced the two-block hit in `Level.as` and `Brick.as`, and found the converter's deliberate Clock-to-coin mapping.
- Reviewed: verified against `levelDataLostLevels.xml` (9-1 area b, row 9, columns 22-29) and `levelDataSmb.xml` (every `ContainedItem=Clock`), `com/smbc/level/Level.as` (lines 116, 716, 856-870, 2040-2061), `com/smbc/ground/Brick.as` (lines 57, 193-207, 295-360, 387-427, 456-461, 471-495), `com/smbc/ground/ItemBlock.as` (`getPickup`, `bounce`), `com/smbc/pickups/Clock.as`, `com/smbc/characters/Character.as` (lines 1641-1647), and ours at b8379f9: `src/content/levels/lost/world9/ll-9-1.map`, `src/game/level/tiles.ts`, `src/game/entities/objects/powerup.ts`, `tools/levelgen/convert-smbc.mjs` (lines 179-192, 320-325, 435-450).

Status: fixed — `Q` (T.Q_CLOCK) models the two stacked blocks: the first bump releases a Clock that stays on the block (+100 time, 1000 points, any hero), the second gives the coin.
