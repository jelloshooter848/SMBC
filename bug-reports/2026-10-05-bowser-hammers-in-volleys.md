# Hammer-throwing Bowser throws volleys of five with long pauses; the original throws single hammers every 40-199 ms, at most 6 alive

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 6-4, Bowser on the bridge (columns 128-140, Bowser starts at column 136); watched from column 125. Same code in every hammer Bowser: SMB 7-4 (column 328) and 8-4 (`8-4-end`, column 40, hammers and fire); Lost Levels ll-6-4, ll-7-4, ll-8-4 (`ll-8-4-end3`, fake Bowser at 23, real one at 119 with hammers and fire), ll-9-3 (fake Bowser at 183), ll-10-4, ll-11-4, ll-12-4 and ll-13-4 (`ll-13-4-end`, fake Bowser at 20, real one at 103)
- **How to get there:** `?level=6-4&char=mario&dev=1`, turn on the Dev assist No damage, play to column 125 (the high ground before the bridge)
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=6-4&char=mario&dev=1` with No damage on, press F1, and go to column 125.
2. Stand still and watch Bowser for 8 seconds.

## Expected

As in the original. On NORMAL the 6-4 Bowser is the Hammer type (`levelDataSmb.xml` 6-4, column
136 row 9: `enemyBowser&&HideOnDifficulties=easy&&BowserType=Hammer`). While he is in his normal
(not chasing) state, he throws one hammer each time a millisecond timer runs out. The handler sets
the next delay to a random **40-199 ms** (`int(Math.random() * 160 + 40)`) and throws only if
`cState == ST_NORMAL` and fewer than **6** of his own hammers are alive (`HAMMER_DCT`; a hammer
removes itself in `Hammer.cleanUp` when it leaves the screen). `updateStats` restarts the timer every
frame he is in the normal state. The result is a steady stream of single hammers, capped at 6, and
no hammers at all while he chases a player who got behind him.
`com/smbc/enemies/Bowser.as` line 40 `MAX_HAMMERS_ON_SCREEN = 6`, lines 49-50
`THROW_HAMMER_TMR_DUR_MIN/MAX = 40/200`, lines 234-239 (timer restart in `updateStats`), lines
379-391 (`throwHammerTmrHandler`). Every hammer uses `com/smbc/projectiles/Hammer.as` lines 36-38:
fixed horizontal speed `xSpeed = 120` (1.0 px/frame in our units), `jumpPwr = 200`, `gravity = 500`.

## Actual

He throws **volleys of 5 hammers** 8 frames apart, then pauses **80-139 frames** (1.3-2.3 s)
before the next volley. There is no cap on how many of his hammers are in the air, and each
hammer gets a random horizontal speed of 0.625-1.375 px/frame. `src/game/entities/enemies/bowser.ts`
lines 11-12 `HAMMER_VOLLEY = 5`, `HAMMER_GAP = 8`; `throwHammers()` lines 109-127: random vx and
vy at lines 116-117, `hammerTimer = 80 + rng.int(60)` at line 123 (the pause counts down only after
the volley ends). On screen you see bursts of five hammers, then nothing for over a second
(screenshot: one volley in the air).

## How often

every time

## Notes

- Evidence: our game playtested (shots `smb-w6/ours/210_bw1`-`225_bw16`, taken every 0.5 s from a
  share-link copy of 6-4 with only the start moved to column 125, so the HUD reads WORLD 1-1; frames
  `213_bw4` and `223_bw14` have no hammers in the air). The original is from code and data
  only: 6-4 froze on load in Ruffle twice (`TypeError: Error #1009` in `addedToStage`), the same
  emulator problem seen in 1-4, 3-4 and 4-4.
- Which Bowsers throw hammers is right in ours. The original takes the type from the XML `BowserType`
  property (`Bowser.as` `determineType`, lines 150-169; the old world-number rule at lines 171-179 is
  commented out). On NORMAL the SMB set has Hammer in 6-4 and 7-4 and FireballHammer in 8-4, and
  Fireball in 1-4 to 5-4. The Lost Levels have Hammer in 6-4, 7-4, 10-4, 11-4, 12-4 and 13-4 (plus the
  fake Bowsers in 8-4, 9-3 and 13-4), and FireballHammer in 8-4. Our maps match all of these
  (`attack=hammer` / `attack=both`, converted from `BowserType` in `tools/levelgen/convert-smbc.mjs`
  line 466). A fake Bowser (`BowserFake.as`) uses the same hammer timer, and so does ours.
- Ours keeps throwing hammers while Mario stands behind him at column 140 (shots
  `smb-w6/ours/254_ax1`-`262_ax9`); the original would be chasing then and would not throw. The chase
  itself is in `2026-10-05-bowser-no-chase.md`.
- Not filed again: the hammers' high arc. Ours lobs them at vy -3.5 to -4.5 px/frame (`bowser.ts`
  line 117) against the original's 1.67 px/frame, the same problem as
  `2026-10-05-hammer-bro-hammer-arc-too-high.md`. Bowser has his own copy of these numbers, so a fix
  to `hammer-bro.ts` alone will not fix him.
- Correct already: the Hammer-type Bowser doesn't breathe fire himself (`bowser.ts` line 93; the
  original's `determineType` sets only `throwHammers`). The long-range flames from column 92 come
  only while he is off screen, as in the original (`Level.as` lines 1935-1941; ours
  `src/game/world/bowser-fire.ts`). The flame in the screenshot is one of those, sent just before
  Bowser came on screen.
- Screenshot: not committed (the repo's `check:assets` bans image files) (one volley of five in the air).
- 8-4 (smb-w8), playtested in ours: the `8-4-end` Bowser (fire and hammers) throws the same volleys with gaps. Contact sheet (screenshot not committed: the repo's `check:assets` bans image files) (frames `gauntlet/shots/smb-w8/ours/085_sh.png` to `116_sh.png`, Mario at column 32 with No damage; reviewer checked: bunches of hammers, then frames with none). The smb-w8 tester first filed this and withdrew it as a duplicate of the 6-4 report.
- 7-4 (smb-w7): the tester saw the same volleys of five from the column-328 hammer Bowser (`gauntlet/notes/smb-w7.md`; no shot cited). Both folded in during the smb-w7/w8 consolidation.
- Source report: `smb-w6/2026-10-05-6-4-bowser-hammers-in-volleys.md`.
- Reviewed: verified against `com/smbc/enemies/Bowser.as`, `com/smbc/enemies/BowserFake.as`, `com/smbc/projectiles/Hammer.as`, `com/smbc/level/Level.as` (1935-1941), `levelDataSmb.xml` and `levelDataLostLevels.xml` (every `enemyBowser` token on NORMAL), and ours: `src/game/entities/enemies/bowser.ts`, `src/game/world/bowser-fire.ts`, `src/game/world/world.ts` (`case 'bowser'`), `tools/levelgen/convert-smbc.mjs`, every `bowser` line in `src/content/levels/**/*.map`
