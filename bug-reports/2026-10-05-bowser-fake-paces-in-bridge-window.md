# Fake Bowsers (ll-8-4, ll-9-3, ll-13-4) pace in the bridge Bowser's 3.5-tile window left of their spot; the original's fake Bowser walks up to 5 tiles either side of where it spawned

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every fake Bowser (`bowser … fake=1`): ll-8-4, last room (`ll-8-4-end3`), column 23 on the floor at row 10; ll-9-3 column 183 (`ll-9-3.map` line 31); ll-13-4 (`ll-13-4-end`) column 20 (line 33). Measured in ll-8-4 with Mario on the pipe top at column 15.
- **How to get there:** `?level=ll-8-4-end3&char=mario&dev=1` (Dev mode > Assists > No damage on). Walk right over the steps and drop onto the pipe at columns 14-15. In the real level, the room is reached through pipe 47 → water room → pipe 10 → pipe 203.
- **Character and power:** Mario, small (No damage assist on)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open the room as above and stand on the pipe top at column 15, left of the fake Bowser.
2. Watch the fake Bowser for 10 s without moving.

## Expected

The original's fake Bowser has its own walking range (`com/smbc/enemies/BowserFake.as`):

- `WALK_DISTANCE = TILE_SIZE*5` (line 10). `setXMinMax()` (lines 24-28, called from `setStats`, lines 18-22) sets `xMin = nx - 5 tiles` and `xMax = nx + 5 tiles` around its spawn position.
- `Bowser.updateStats` (`Bowser.as` lines 251-260) turns it when its hit box's left edge reaches `xMin`. `BowserFake.pastXMax` (lines 35-39) turns it when the right edge reaches `xMax` while it walks right in its normal state. So its body moves within about 10 tiles centred on its spawn point: in ll-8-4, roughly columns 18.5-28.5 (±0.5 tile, depending on where `nx` sits in the spawn cell). Like every Bowser, it starts walking left (`Bowser.initiate`, line 148, `vx = -WALK_SPEED`).
- After a chase (a Bowser chases a player who gets past him; already filed for the bridge Bowser), the window is re-centred where it stopped (`returnToNormalStateFromChase`, lines 30-33).
- Only the bridge Bowser uses the bridge-based window `getXMaxMin` (`Bowser.as` lines 202-206). The fake one never becomes `level.bowser` (line 99: `if (!(this is BowserFake)) level.bowser = this`), so the axe never sets up a window for it.

All three fake Bowsers are on the normal layer (`levelDataLostLevels.xml` lines 422, 448 and 652: `enemyBowserFake&&shiftRight&&HideOnDifficulties=easy…&&BowserType=Hammer`).

## Actual

`src/game/entities/enemies/bowser.ts` lines 82-85 use one rule for every Bowser, fake or real: turn when the body's left edge passes `homeX - 48 px` or `homeX + 8 px`. That is a window of 3.5 tiles that sits almost entirely left of its spot. `homeX` is `tx*16 + 2` (lines 36-37). The `fake` flag (line 34, set from `fake=1` in `src/game/world/world.ts` line 339) is used only to keep the axe from dropping it (`world.ts` line 1407).

For the ll-8-4 fake at column 23, that puts the left edge between columns 20.1 and 23.6. The tester measured it from screenshots taken every 0.7 s for 10 s: the left edge of its shell moved only between column 20.3 and column 23.5. It never went right of its spot or more than about 3 tiles left of it. The same code gives 180.1-183.6 for ll-9-3 and 17.1-20.6 for ll-13-4.

Screenshot: not committed (the repo's `check:assets` bans image files) (fake Bowser at the right end of its window, column ~23.5).

## How often

every time

## Notes

- Evidence: ours playtested in ll-8-4 and ll-13-4. ll-9-3 uses the same code (map line checked), but was not watched. The ll-wD tester watched the ll-13-4 fake Bowser (`ll-13-4-end` column 20, XML `BowserType=Hammer`, `fake=1`) pace at about columns 18-21, inside the predicted 17.1-20.6 window for its left edge, and throw hammer volleys (`gauntlet/notes/llwD/m2.png`). The original was checked by reading its code. Its ll-8-4 loads in Ruffle, but the tester could not reach this room there.
- Not checked: whether walls or ledges cut the original's 10-tile range short in ll-9-3 and ll-13-4.
- Related: the bridge Bowser's own window, speed and fire stop are in `2026-10-05-bowser-pacing-speed-and-range.md`. That is a different window (`getXMaxMin`), so this is not a duplicate. A fix should give fake Bowsers the `±5 tiles` rule and the bridge Bowser the `getXMaxMin` rule. The walk speed is shared code: `WALK_SPEED` is 0.25 px/frame in the original and 0.5 in ours, as the pacing report says. The chase is in `2026-10-05-bowser-no-chase.md`, and the jump schedule is in `2026-10-05-bowser-jumps-too-rarely.md`.
- The converter's `shiftRight` report (`2026-10-05-converter-ignores-shiftup-shiftright.md`) lists the ll-8-4 fake Bowser at e 23,9 with no position effect, so it does not change the numbers above.
- Hit points match: in the original, Mario always needs 5 fireballs (`MARIO_FIRE_BALL*5`), and ours has `hp = 5` (ll-w8 notes).
- Source: `ll-w8/2026-10-05-ll-8-4-fake-bowser-paces-like-bridge-bowser.md`.
- PR #24 check: still applies on main 2225155. `git diff b8379f9 HEAD` is empty for `bowser.ts`, `world.ts` and the three maps.
- Reviewed: verified against `com/smbc/enemies/BowserFake.as`, `com/smbc/enemies/Bowser.as` (lines 99, 148, 202-206, 251-260), `levelDataLostLevels.xml` (lines 422, 448, 652), and ours: `src/game/entities/enemies/bowser.ts`, `src/game/world/world.ts` (lines 339, 1407), `ll-8-4-end3.map`, `ll-9-3.map`, `ll-13-4-end.map`.

Status: fixed — a fake Bowser now paces within 5 tiles either side of its spawn centre (BowserFake.as `WALK_DISTANCE`, `setXMinMax`), turns at the right end only in its normal state and re-centres its window after a chase (`returnToNormalStateFromChase`); the bridge Bowser uses `getXMaxMin`.
