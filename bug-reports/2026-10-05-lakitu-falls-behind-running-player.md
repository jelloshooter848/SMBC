# Lakitu falls behind a running player and hangs at the left edge of the screen

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 4-1, columns 19–208 (any Lakitu; also 6-1, seen at column 34, and 8-2)
- **How to get there:** `?level=4-1&char=mario`
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=4-1&char=mario` and press F1.
2. Once Lakitu is on screen, hold right + run, hopping over the pits.
3. Watch where Lakitu is relative to Mario.

## Expected

In the original, when the player holds right (or left) for 0.8 s (`START_FOLLOW_DEL_TMR`, Lakitu.as line 47)
Lakitu starts "following": it accelerates in that direction at 200 px/s² (`ax`, line 99), and once the
player is faster than 100 px/s its top speed becomes the player's speed **plus 100 px/s**
(`vxMax = player.vx + VX_MAX_INCREASE_NUM`, lines 191–207; otherwise `DEF_VX_MAX = 200`). These are the
original's px on 32-px tiles, so at our scale that is 100 px/s² and "player + 0.83 px/frame". It therefore
catches up with and overtakes a running player and keeps dropping Spinies ahead of him. It is never left
behind: when it reaches the 2-tile edge buffer (line 70) it is held there and pushed along at the player's
speed (lines 159–182). When the player is not holding a direction it homes in on the player's x and
overshoots, which makes the back-and-forth swing (lines 226–242).

## Actual

Ours aims at a point 16 px ahead of the player plus a fixed sine swing (±72 px, 240-frame = 4 s period),
and steers toward a speed of 1/32 of the remaining gap per frame, capped at 2.75 px/frame
(`src/game/entities/enemies/lakitu.ts` lines 47–58, `Lakitu.update`). To keep pace with Mario's top run
speed (2.5625 px/frame) it has to trail its target by about 82 px, which puts it about 66 px behind Mario.
Because the camera holds a running Mario 80 px from the left edge, Lakitu ends up clamped at the left edge
(`cam.x`) and never gets ahead of him: in `ours/083_run4.png` … `091_run12.png` (Mario running from column
30 to 80) Lakitu is at the far left of every frame while Mario is about a third of the way across. Running
past a Lakitu is therefore much safer than in the original.

## How often

every time

## Notes

- Ours playtested; original found by reading code. In Ruffle the tester only got a short run before dying
  in the pit at column 32 (those shots were not kept), so the original's follow is from `Lakitu.as` only.
- 6-1 (smb-w6): the same in play. Mario running at 2.56 px/frame at column 34 has Lakitu pinned at the left edge of the screen: `gauntlet/shots/smb-w6/ours/009_d.png` (reviewer checked). Not compared with the original (slow emulator). Folded in from `review/smb-w6.md` during the smb-w7/w8 consolidation.
- 8-2 (smb-w8): the tester saw the same Lakitu behaviour there and did not refile (`gauntlet/notes/smb-w8.md`; no shots cited).
- The tester described our steering as "half the remaining gap per frame"; the velocity is gap/2 in
  velocity units (1/16 subpixel per frame), which is 1/32 of the gap in pixels per frame. Corrected.
- Reviewed: verified against `com/smbc/enemies/Lakitu.as` (`checkState`), `com/smbc/main/AnimatedObject.as` (`vxMax` clamp), and ours: `src/game/entities/enemies/lakitu.ts`, `src/engine/math/units.ts` (`velToSub`), `src/game/world/camera.ts` (`pushX`), `src/game/entities/player.test.ts` (max run 2.5625 px/f)

Status: fixed — Lakitu now steers as `Lakitu.checkState`: homes in at 200 px/s² with the overshoot swing, starts following after a direction is held 0.8 s (`START_FOLLOW_DEL_TMR`) with top speed the player's plus 100 px/s (`VX_MAX_INCREASE_NUM`), and is held at the 2-tile edge buffer and pushed along by the player.
