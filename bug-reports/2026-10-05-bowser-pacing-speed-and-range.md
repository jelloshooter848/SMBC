# Bowser paces twice as fast over a 3.5-tile stretch and never stops to breathe fire; the original walks slowly over most of the bridge

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every bridge Bowser. Seen in 1-4 and 3-4: the bridge at columns 128-140, Bowser starts at column 136.
- **How to get there:** `?level=1-4&char=mario` (or `?level=3-4&char=mario`), reach column 124-126, before the bridge
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Stand at column 124-126, before the bridge, with F1 on.
2. Watch Bowser walk back and forth for about 10 seconds.

## Expected

From `com/smbc/enemies/Bowser.as`:
- Walk speed `WALK_SPEED = 30` px/s at 32 px tiles (line 37), which is 0.25 px per frame at our scale.
- Range: he stays between `xMin = bridgeStart + 3 tiles` and `xMax = bridgeEnd + 1 tile` (`getXMaxMin`, lines 202-206, called from `BowserAxe.setUpBridge` with the bridge pieces sorted right to left, so `bridgeEnd` is the rightmost piece). In 1-4 and 3-4 that is about columns 131 to 141, most of the bridge. He turns at `xMin`, and at `xMax` in his normal state.
- Before each fireball he stops (`vx = 0`) and holds the "prepareFire" frame for 450 ms (`FB_DEL_TMR`, `fbTmrLsr`). Then he fires, and picks a new direction: left with 40% chance, right with 60% (`fbDelTmrLsr`, lines 353-362).

## Actual

From `src/game/entities/enemies/bowser.ts` (lines 42 and 82-85), matching what both testers saw:
- He walks at 0x00800 = 0.5 px per frame, twice the original speed.
- He turns at `homeX - 48 px` and `homeX + 8 px`, about columns 133.1 to 136.6 (left edge). In play he stayed between columns ~133 and ~137.
- He keeps walking while he breathes fire: no stop, no wind-up, and the direction changes only at the ends of his stretch.

## How often

every time

## Notes

- Merged from `smb-w1/2026-10-05-bowser-pacing-speed-and-range.md` (1-4) and `smb-w3/2026-10-05-bowser-pacing-range-and-jumps.md` (3-4). Their jump parts are in `2026-10-05-bowser-jumps-too-rarely.md`; the fire timing and the on-screen fireball limit are in `2026-10-05-bowser-flames-aimed-at-player.md`.
- Ours: playtested in 1-4 and 3-4 (`shots/smb-w3/ours/051_bz1.png` ... `062_bz12.png`). Original: code reading only; 1-4 and 3-4 froze on load in Ruffle.
- Not verified: the exact x of the original's bridge pieces (tile left edge or centre), so the column range above is ±0.5 tile.
- Related: `2026-10-05-bowser-no-chase.md`.
- Reviewed: verified against `com/smbc/enemies/Bowser.as` (`WALK_SPEED`, `getXMaxMin`, `updateStats`, `pastXMax`, `fbTmrLsr`, `fbDelTmrLsr`), `com/smbc/pickups/BowserAxe.as` (`setUpBridge`, `sortBBVec`), `levelDataSmb.xml` (bridge 128-140, Bowser 136, axe 141 in 1-4 and 3-4), and ours: `src/game/entities/enemies/bowser.ts`.
