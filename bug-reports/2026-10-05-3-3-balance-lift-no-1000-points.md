# Snapping a balance-lift rope in 3-3 gives no points; the original awards 1000

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 3-3, balance lifts at columns 82 and 89 (rope at row 2), and again at columns 137 and 141; also 4-3 (the pair at columns 49 and 56)
- **How to get there:** `?level=3-3&char=mario`, reach the mushroom at columns 77-79 (row 4)
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Jump onto the left balance lift (column 82, row 6) and stand still on it.
2. It sinks and the right one (column 89) rises until the rope snaps and both fall.
3. Watch the score.

## Expected

`com/smbc/ground/Platform.as` lines 378-397: when the platform you stand on has bottomed out
(`pullyLoc == "bottom"`), the game pops `ScoreValue.PULLY_FALL` (1000, `ScoreValue.as` line 81) at
the player and both platforms fall.

## Actual

`src/game/entities/objects/balance-lift.ts` lines 61-66 drop both lifts when the rising one reaches
its pulley, but award nothing. In play the score stayed at 400 (two coins) before and after the
rope snapped (screenshot).

## How often

every time

## Notes

- Evidence: code reading and a playtest of ours (shared copy of 3-3 starting at column 78). Not
  playtested in the original.
- Our screenshot: not committed (the repo's `check:assets` bans image files) (rope gone, score 0000400).
- 4-3 (smb-w4): the tester's notes say the rope snapped with no 1000 points there too (score stayed 0), in a share-link copy of 4-3: `gauntlet/shots/smb-w4/ours/276_bal0.png` to `283_bal7.png` (snap between frames 251 and 281). The reviewer could not read the score in these frames because the F1 overlay covers it, so this rests on the tester's note. Folded in from `review/smb-w4.md` during the smb-w7/w8 consolidation.
- The way the lifts move also differs: see `2026-10-05-3-3-balance-lift-motion.md`.
- Reviewed: verified against `com/smbc/ground/Platform.as` `setCharOnPlat` (`level.scorePop(ScoreValue.PULLY_FALL, ...)` when `pullyLoc == "bottom"`), `com/smbc/data/ScoreValue.as` (`PULLY_FALL = 1000`), and ours: `src/game/entities/objects/balance-lift.ts` `update()` (drops both lifts, no `addScore`).
