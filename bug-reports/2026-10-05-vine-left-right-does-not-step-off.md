# On a vine, left or right only turns Mario and jump leaps off; in the original a direction press (after letting go of it once) steps him off, and jump does nothing

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every vine, both the ones that grow from a vine brick and the ones you arrive on in a sky or warp area. Tested on ll-12-1-sky at column 4, rows 7-14 (the vine you arrive on from the vine brick at ll-12-1 column 197, row 5).
- **How to get there:** `?level=ll-12-1-sky&char=mario` (the same start as arriving from the vine in ll-12-1)
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=ll-12-1-sky&char=mario` and press F1. Mario hangs on the vine at column 4.
2. Hold up for about 1 s. He climbs to tile 4,9 or 4,10.
3. Tap right (300 ms) and let go. Then hold right for 1.5 s. Do the same with left.
4. Press jump while on the vine.

## Expected

The second direction press steps Mario off the vine to that side. He then falls or walks normally. Jump does nothing while he is on the vine.

- **Mario's move code:** `com/smbc/characters/base/MarioBase.as` `movePlayer()` (lines 418-458) overrides `Character.movePlayer()` (`com/smbc/characters/Character.as` lines 1095-1120) with the same vine rule. If right (or left) is held in the `vine` state and `exitVine` is set, it calls `getOffVine()`. Otherwise it returns, without moving or turning Mario.
- **Arming the step-off:** `relLftBtn()` / `relRhtBtn()` (`Character.as` lines 1323-1334) set `exitVine = true` when left or right is released while on the vine. `getOnVine()` (line 1824) clears it. So after grabbing a vine you release a direction once, and the next left or right press takes you off.
- **The step-off:** `getOffVine()` (lines 1798-1812) puts Mario just outside the vine's hit box on the pressed side (`vine.hLft - hWidth*.5` or `vine.hRht + hWidth*.5`). It sets the state back to `neutral` and turns gravity back on. `movePlayer` then goes on to add walking speed in that direction.
- **No jump or attack on a vine:** `MarioBase.as` `pressJmpBtn()` (lines 1253-1256) returns at once while `cState == ST_VINE`. `pressAtkBtn()` (lines 835-838) and `pressSpcBtn()` (lines 858-861) are blocked the same way.

## Actual

Left and right only turn Mario around. He stays on the vine at x 66, tile 4,9, however long the direction is held (screenshot (screenshot not committed: the repo's `check:assets` bans image files), taken after 1.5 s of holding right). He can only get off by jumping, which the original doesn't allow on a vine, or by climbing down onto the ground or past the bottom of the vine. With a direction held the jump leaps clear at walking speed. With no direction it is a small hop.

Code: `src/game/entities/player.ts`, `climb()` (lines 300-340; the doc comment reads "up/down climb, left/right turn, jump lets go"):
- `input.dirX` only sets `facing` (line 306).
- A buffered jump calls `letGo()` and launches a jump (lines 307-318), with `b.vx = facing * maxWalk` when a direction is held, or `minWalk << 2` without one.
- Nothing steps Mario off to the side.

## How often

every time

## Notes

- PR #24 check: still applies on main 2225155. `git diff b8379f9 HEAD -- src/game/entities/player.ts src/game/world/world.ts src/content/levels/lost/world12/ll-12-1-sky.map` is empty.
- **Evidence:** ours was playtested (ll-12-1-sky, and the ll-12-1 vine brick at 197,5 through to the sky area, using a test map with a gap cut in the brick row). The original comes from reading code. The tester did not play a vine in the original, because Ruffle runs it many times slower than real time.
- **Kept separate from `2026-10-05-4-2-vine-area-no-auto-climb.md`.** That final covers the automatic climb and the automatic step to the right when you arrive in a vine area (`climbVineStarter` / `checkVinePosition`, the arrival flow), and the arrival vine's height. This one covers the player's own left/right and jump on any vine, including the vine you climb up from a brick. The fix is in a different place: `Player.climb()`, not the `climb` start mode in `world.ts`. The ll-w2 and ll-w5 testers saw "holding right does not step Mario off" while arriving (ll-2-1-sky, ll-5-1-sky). That is the same bug as this one, and the vine-area final now points here.
- If you fix only the left/right part, ours still lets you jump off a vine (lines 307-318). The original doesn't.
- **Not checked:**
  - Other heroes. `Character.movePlayer` has the same step-off rule for every hero, but whether each hero's jump is blocked on a vine was not checked.
  - Climbing down. The original also stops Mario climbing down within 2 tiles of the bottom of the screen during play (`checkVinePosition`, `Character.as` lines 1846-1851). Ours lets go once his hands pass the vine's base (`climb()` line 339). This was not playtested.
- Source: `ll-wC/2026-10-05-vine-left-right-does-not-step-off.md`. The reviewer added the `MarioBase.movePlayer` override (the code that actually runs for Mario), the attack/special-button line numbers, and the climbing-down note.
- Reviewed: verified against `com/smbc/characters/Character.as` (`movePlayer` 1095-1120, `relLftBtn`/`relRhtBtn` 1323-1334, `getOffVine` 1798-1812, `getOnVine` 1813-1825, `checkVinePosition` 1838-1879), `com/smbc/characters/base/MarioBase.as` (`movePlayer` 418-468, `checkState` 588-595, `pressAtkBtn` 835-838, `pressSpcBtn` 858-861, `pressJmpBtn` 1253-1256), and ours: `src/game/entities/player.ts` (`climb`, `letGo`).
