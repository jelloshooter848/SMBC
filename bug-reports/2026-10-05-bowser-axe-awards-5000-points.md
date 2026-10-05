# Taking the axe awards 5000 points for Bowser; the original gives none

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every bridge Bowser. Seen in 1-4 and 3-4: the axe at column 141, row 8. Also seen in our 2-4 (axe at column 142), 4-4, 6-4, 7-4 (axe at column 333) and 8-4 (`8-4-end`, axe at column 45).
- **How to get there:** `?level=1-4&char=mario` (or `?level=3-4&char=mario`), cross the bridge or jump over Bowser, and touch the axe
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Note the score, then touch the axe without having hit Bowser.
2. Watch the score while the bridge collapses and Bowser falls.

## Expected

No points. In the original, `BowserAxe.touchPlayer()` only starts the bridge collapse and calls `bowser.breakBridgeStart()`; the collapse timer calls `breakBridgeInc()` per piece and `breakBridgeEnd()`, which sets `defyGrav = false` so Bowser drops (`BowserAxe.as` lines 90-145, `Bowser.as` lines 392-415). None of them adds score, and `die()` is not called. Bowser falls below the screen and is removed by `AnimatedObject.checkDosSides()` → `destroy()`, which gives no score either. The 5000 values in `ScoreValue.as` (`BOWSER_ATTACK`, `BOWSER_BELOW`, `BOWSER_STAR`, `BOWSER_STOMP`, lines 23-26) are only for killing him with attacks. Castle stages also skip the time-to-score tally (`EventManager.enterLevelExit()` converts time only when `level.flagPole != null`), so the score should not change at all at the end of the castle.

## Actual

A "5000" popup appears as Bowser falls, and the score goes from 0000000 to 0005000. `World.updateBossClear()` (`src/game/world/world.ts` lines 1407-1411) calls `bowser.fallDead()` and then `addScore(5000, ...)` 60 frames into the collapse. (Our Bowser also lists `axe: 'kill'` in its vulnerability table in `src/game/entities/enemies/bowser.ts`.)

## How often

every time

## Notes

- Merged from `smb-w1/2026-10-05-1-4-axe-awards-5000-points.md` (1-4) and `smb-w3/2026-10-05-bowser-axe-awards-5000-points.md` (3-4).
- Ours: playtested in 1-4 and 3-4. Original: code reading only; 1-4 and 3-4 froze on load in Ruffle.
- The 3-4 report said "Only the time bonus is added"; that is wrong for the original (no tally in castles, see Expected) and has been dropped. The 1-4 tester confirmed ours also skips the tally, so the 5000 is the only score change.
- The rest of the castle end matches (1-4): "THANK YOU MARIO!", then "BUT OUR PRINCESS IS IN / ANOTHER CASTLE!", the time is not tallied, and the game goes to the WORLD 2-1 card with time 400.
- Screenshots: `2026-10-05-bowser-axe-awards-5000-points.png` (3-4, score 0005000 right after the axe) and `2026-10-05-bowser-axe-awards-5000-points-2.png` (1-4, score 0005000, Toad in view).
- More sightings in ours, all after the axe (the original's castles were not played). Folded in during the smb-w7/w8 consolidation:
  - 2-4 (smb-w2): `gauntlet/shots/smb-w2/ours/585_ax3.png` shows the `5000` popup after the axe at column 142 (axe sequence `583_ax1.png` to `591_ax9.png`). Source: `review/smb-w2.md`.
  - 4-4 (smb-w4): the score reads 5000 right after the axe, `gauntlet/shots/smb-w4/ours/329_ax1.png` to `334_ax6.png` (share-link copy, HUD reads WORLD 1-1). Source: `review/smb-w4.md`.
  - 6-4 (smb-w6): the WORLD 7-1 card after the axe shows MARIO 0005000, `gauntlet/shots/smb-w6/ours/290_ay12.png`; the ending text and the move to 7-1 with time 400 are correct. Source: `review/smb-w6.md`.
  - 7-4 (smb-w7 notes): axe 5000, then THANK YOU MARIO / ANOTHER CASTLE, no time tally, WORLD 8-1 card.
  - 8-4 (smb-w8): the final score on our ending card is 0005000 from the axe alone (`2026-10-05-8-4-ending-no-quest-over-or-credits.png`).
- Reviewed: verified against `com/smbc/pickups/BowserAxe.as`, `com/smbc/enemies/Bowser.as` (`breakBridgeStart/Inc/End`), `com/smbc/main/AnimatedObject.as` (`checkDosSides`), `com/smbc/data/ScoreValue.as`, `com/smbc/managers/EventManager.as` (`enterLevelExit`; `convertTimeToScore` has no other caller), and ours: `src/game/world/world.ts` (`updateBossClear`).
