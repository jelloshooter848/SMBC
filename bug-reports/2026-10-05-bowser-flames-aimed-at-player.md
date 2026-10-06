# Bowser's flames are aimed at Mario's height and direction, with no limit on screen; the original's fly left at one of three fixed heights, at most two at a time

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every fire-breathing bridge Bowser. Seen in 3-4 (bridge at columns 128-140); the same code runs in 1-4.
- **How to get there:** `?level=3-4&char=mario`, reach column 124 and wait in front of the bridge. For the backwards flame: `?level=3-4&char=mario&dev=1` with the No damage assist, jump over Bowser and stand at column 140.
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Stand on the floor at column 124-128 facing Bowser and watch several of his flames.
2. Then get behind him (column 138-140, No damage assist on) and watch where he breathes fire.

## Expected

`com/smbc/projectiles/BowserFireBall.as`:
- Direction and speed: `vx = -sx` with `SPEED = 160` px/s (lines 23 and 36-37), so a flame always flies **left**, at 1.33 px/frame at our scale. It starts at Bowser's left side (line 53).
- Height: each flame picks one of three heights at random (lines 42-50), `fbLev1-3` = half a tile, one and a half and two and a half tiles above Bowser's starting y (`Bowser.as` lines 145-147), and drifts up or down to it 3 original px per frame (lines 97-110). Where Mario stands does not matter, so some flames pass over a small Mario.
- Timing: the first flame comes as soon as the timer first starts; after that a 1.5-3.5 s timer (`FB_TMR_DUR_MIN/MAX`), and the timer only restarts while fewer than `MAX_FIREBALLS_ON_SCREEN = 2` of his flames exist (`Bowser.as` lines 241-245, `startFbTmr`, `fbDelTmrLsr`).
- With Mario behind him Bowser chases instead of firing (see the chase report), and even when he does fire, the flame goes left, away from Mario.

## Actual

`src/game/entities/enemies/bowser.ts` lines 93-102:
- Each flame spawns at Mario's own height, clamped to between 32 px above Bowser's top and 8 px below it, and flies straight in the direction Bowser faces, which is toward Mario, at 1.5 px/frame (`BOWSER_FLAME.speed` 0x01800 in `src/game/entities/projectiles/projectile.ts`).
- First flame after 120 frames, then every 90-179 frames (1.5-3 s), with no limit on how many are on screen.

In play every flame came at small Mario's head height while he stood on the bridge or the floor before it, so he has to jump every one. With Mario behind Bowser at column 140, Bowser breathed a flame to the right at him.

## How often

every time

## Notes

- Merged from `smb-w3/2026-10-05-bowser-flame-aims-at-player.md`, the "fires backwards" part of `smb-w3/2026-10-05-bowser-does-not-chase-and-fires-backwards.md`, and the fire-timing lines of `smb-w1/2026-10-05-bowser-pacing-speed-and-range.md`.
- Evidence: code reading and a playtest of ours (flames observed in `shots/smb-w3/ours/051_bz*.png` ... `062_bz12.png`, all at Mario's row; backwards flame in (screenshot not committed: the repo's `check:assets` bans image files)). Not seen in the original (1-4 and 3-4 froze Ruffle on load).
- The long-range flames before the bridge (`bowser-fire.ts`) already use three random heights; only Bowser's own on-screen flame is aimed.
- The 450 ms stop before each flame is in `2026-10-05-bowser-pacing-speed-and-range.md`.
- Reviewed: verified against `com/smbc/projectiles/BowserFireBall.as` (`SPEED` 160, `vx = -sx`, `yFinal`, `updateStats`), `com/smbc/enemies/Bowser.as` (`fbLev1-3`, `FB_TMR_DUR_MIN/MAX` 1500/3500, `MAX_FIREBALLS_ON_SCREEN` 2, `startFbTmr`, `fbTmrLsr`, `fbDelTmrLsr`) and ours: `src/game/entities/enemies/bowser.ts` (`flameTimer`), `src/game/entities/projectiles/projectile.ts` (`BOWSER_FLAME`).

Status: fixed — Bowser's own flames now always fly left at 160 px/s (1.33 px/f) from his left side, starting centred on the top of his hit box, and drift 0.75 px/f (3 px per frame at the original's 30 fps) to one of three random heights half, one and a half or two and a half tiles above his spawn feet (BowserFireBall.as, `fbLev1-3`), on a 1.5-3.5 s timer that only restarts while fewer than two of his flames exist; the long-range zone flames also use the 160 px/s speed.
