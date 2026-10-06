# Mega Man's slide drops into one-tile gaps; the original carries a sliding Mega Man across

- **Severity:** wrong behaviour
- **Build:** a217e10 (integration branch after the one-tile-gap fix for Mario and Luigi)
- **Where:** every one-tile gap in a walking surface, for example ll-7-1 columns 58 and 67 (rows 13-14) and the other gaps listed in `2026-10-05-player-run-falls-into-one-tile-gaps.md`
- **How to get there:** `?level=ll-7-1&char=megaman&dev=1`, stand a few tiles before the gap at column 67 and slide (Down + Jump) towards it
- **Character and power:** Mega Man, full energy
- **Input:** none in a browser yet; reproduced with a throwaway unit test that drives `Player.update` (see Notes)
- **Browser and device:** none (headless unit test on Linux, cloud container)

## Steps

1. Stand Mega Man on the ground a few tiles before a one-tile gap with ground at the same height on both sides.
2. Hold Right and slide (Down + Jump) so the slide reaches the gap.

## Expected

The slide carries Mega Man over the gap at ground level, as in the original:

- `MegaManBase.as` lines 1033-1037: on the ground, while `cState == ST_SLIDE`, it sets `canCrossSmallGaps = true`. Lines 1115-1118 set it back to `false` on the ground when he is not sliding. The constructor sets it to `true` (line 345).
- `Level.as` lines 1888-1889 then call `checkCrossSmallGap(player)` on the first frame he has left the ground. That function (lines 2230-2272) puts him back on the ground to the right of the gap when the tiles one column left and right of him both have ground at his feet (not a `Platform`).
- So a sliding Mega Man crosses a one-tile gap. A walking one drops in, because `canCrossSmallGaps` is `false` while he walks.

## Actual

He drops into the gap and stops against its far side. Our one-tile-gap rule (`Player.crossSmallGap`, gated by `MovementProfile.crossGapMinVx`) is only set for Mario and Luigi. `MEGAMAN_PROFILE` has no `crossGapMinVx`, and the slide (`Player.startSlide`, `slide.speed` 0x02800 = 2.5 px/f for 26 frames) never checks for gaps. The throwaway test slid him into a one-tile gap at column 30 from 16 sub-tile starting positions. He started the slide every time and fell in every time: x 484 (= 30 × 16 + 4, the gap's far wall minus his 12 px hitbox), y 208 (below the ground's top).

## How often

every time (16 of 16 starting positions)

## Notes

- Evidence: the original by reading its code only (`com/smbc/characters/base/MegaManBase.as` lines 345, 1033-1037 and 1115-1118, and `com/smbc/level/Level.as` `checkCrossSmallGap`). Ours from a throwaway headless test of `Player.update` at a217e10 (not committed). Not playtested in either game.
- A fix could gate `crossSmallGap` on `sliding > 0` for profiles with a slide (a per-profile flag), rather than on a speed. Per the original, only sliding counts, not walking.
- Related: `2026-10-05-player-run-falls-into-one-tile-gaps.md` (fixed for Mario and Luigi). Sophia sets `canCrossSmallGaps = false` (`Sophia.as` line 383). No other character sets it, so in the original Link, Ryu, Simon, Samus and Bill drop in too (a test covers Link and Ryu).
- Filed by fix agent G2 at the coordinator's request; not fixed.
