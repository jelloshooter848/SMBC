# Arriving in the 4-2 vine warp area, Mario hangs at the bottom of the vine instead of climbing up on his own

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 4-2 vine brick at column 64, row 5 → `4-2-warp` column 4 (also the other vine areas: 2-1, 3-1, 5-2, 6-2, and the Lost Levels ones; seen in ll-3-1-sky, ll-4-1-sky, ll-5-1-sky, ll-10-1-sky, ll-11-1-sky and ll-12-1-sky)
- **How to get there:** `?level=4-2&char=mario`, hit the vine brick at column 64 (via the hidden blocks at
  columns 63–66) and climb the vine; or open `?level=4-2-warp&char=mario` directly (same start)
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Climb the vine from column 64 in 4-2 until the screen changes to the sky area.
2. Let go of all keys.

## Expected

The original takes control away and plays the climb for you: on arrival the level is in WATCH mode, the
timer is hidden and `upBtn = true` (Level.as lines 1441–1449; `Character.climbVineStarter`, Character.as
lines 1827–1837). Mario rises from below the screen to the top of the vine, then steps off to the right
automatically (`checkVinePosition`, Character.as lines 1857–1876: `rhtBtn = true`, `getOffVine()`), and
only then does play resume (`GS_PLAY`) and the timer reappear (`showTime()`). This is also what the NES does.

## Actual

Mario starts hanging near the bottom of the vine (column 4, row 14 area) and stays there; the timer keeps
running. He only climbs while the player holds up, and the player has to jump off himself
(`ours/344_shot.png`, `345_shot.png`: same spot 3 s apart with no input, timer 395 → 388).
`src/game/world/world.ts` lines 181–188: the `climb` start mode only hangs the player on the vine
(`p.vine`, `p.anim = 'climb'`); nothing drives the climb or the step-off.

## How often

every time

## Notes

- Ours playtested (both by the real vine from 4-2 and by loading `4-2-warp` directly); original found by
  reading code.
- The rest of the vine route matched: vine brick at 64,5, the hidden coin blocks at 64,7, 63,8, 65,8 and
  66,9, and the warp pipes at 50, 54 and 58 lead to 8-1, 7-1 and 6-1 (6-1 checked by playing).
- Every SMB vine area starts this way in ours (`startMode: climb`): `2-1-sky`, `3-1-sky`, `4-2-warp`,
  `5-2-sky`, `6-2-sky`, matching the original's `vineStart` in 2-1 b, 3-1 c, 4-2 c, 5-2 c and 6-2 d. Lost
  Levels vine areas use the same start mode. Only 4-2 was playtested.
- **Lost Levels (folded in by the ll-w3 to ll-w5 review):** the same start in ll-3-1-sky (ll-w3 tester, ours played through the real vine), ll-4-1-sky (ll-w4, ours) and ll-5-1-sky (ll-w5, ours, reached with a test map that adds three blocks under the vine brick). Holding right at the top of the vine does not step Mario off; only a jump does (ll-w5, as ll-w2 noted). That applies to every vine, not only arrivals, and is now filed separately as `2026-10-05-vine-left-right-does-not-step-off.md`. This report keeps the automatic climb and step-off. Every Lost Levels vine area uses `startMode: climb`: ll-1-2-warp, ll-2-1-sky, ll-3-1-sky, ll-4-1-sky, ll-5-1-sky, ll-5-2-warp, ll-8-2-warp, ll-8-3-sky, ll-9-3-sky, ll-10-1-sky, ll-11-1-sky, ll-12-1-sky and ll-13-2-sky.
- **Worlds A and B (folded in by the ll-w6/w9/wB review, ours only):** the same start in ll-10-1-sky (ll-wA notes, reached through the vine at column 37) and ll-11-1-sky (ll-wB notes, vine brick at 89,5, played with a test map). Both maps use `startMode: climb`.
- **The arrival vine is also too tall: 8 tiles in ours, 5 in the original** (from the ll-w5 notes, verified by the reviewer). In the original, `vineStart` builds a `Vine` (`Level.as` lines 1015-1016) whose `initiate()` calls `growFromStgBot()` (`com/smbc/level/Vine.as` lines 78-87: `y = GLOB_STG_BOT`, `targetHeight = y - TILE_SIZE*5`, rising at `riseSpeed` 60): it grows up from the bottom of the screen and stops when its top is 5 tiles up, whatever row the `vineStart` cell is on, and the auto-climb ends at that top. Ours: the converter writes every `vineStart` as `vine x y len=8` (`tools/levelgen/convert-smbc.mjs` line 705), and `Vine` (`src/game/entities/objects/vine.ts`, constructor) makes it 8 tiles tall above the bottom of row 14, so its top is at row 7 instead of row 10. This applies to all 18 vine areas (5 SMB, 13 Lost Levels). Fix it with the auto-climb, since the climb's end point is the vine's top.
- **World C (folded in by the ll-wC review, ours only):** the same start in ll-12-1-sky (ll-wC notes, reached through the vine brick at ll-12-1 column 197, row 5 with a test map, and loaded directly). `ll-12-1-sky.map` uses `startMode: climb`. Related: `2026-10-05-vine-left-right-does-not-step-off.md` covers the player's own left/right and jump on any vine, which the original handles in `movePlayer` / `getOffVine` and ours in `Player.climb()`.
- Reviewed: verified against `com/smbc/level/Level.as` (1441–1449, `watchModeOverrideVine`), `com/smbc/characters/Character.as` (`climbVineStarter`, `checkVinePosition`), `levelDataSmb.xml` (`vineStart`), and ours: `src/game/world/world.ts` (climb start mode), `src/content/levels/world4/4-2-warp.map`
