# Bowser jumps about once every 6 s on average; the original jumps every 0.4-3 s

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every bridge Bowser. Seen in 1-4 and 3-4: the bridge at columns 128-140, Bowser starts at column 136.
- **How to get there:** `?level=3-4&char=mario` (or `?level=1-4&char=mario`), reach column 124-126, before the bridge
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Stand at column 124-126, before the bridge, with F1 on.
2. Watch Bowser for 10 s and count his jumps.

## Expected

`com/smbc/enemies/Bowser.as`: whenever he is on the ground and the jump timer is not running, it starts with a random 400-3000 ms (`JUMP_TMR_DUR_MIN/MAX`, lines 47-48 and 212-216), and when it ends he always jumps if he is on the ground in his normal state (`jumpTmrLsr`, lines 416-421). Jump power `jumpPwr = 280` px/s (line 142), 2.33 px/frame at our scale; with the default `AnimatedObject.gravity` of 500 px/s² that is a hop of about 39 px at our scale, about 1.1 s in the air.

## Actual

`src/game/entities/enemies/bowser.ts` lines 87-90: every 120-239 frames (2-4 s) he gets a 50% chance to jump, so on average he jumps about once every 6 s, and sometimes not for 8 s or more. The jump is -3 px/frame against 0.125 px/frame² (`fall(world, 0x00200)`): about 36 px high, 0.8 s in the air. In play he did not jump in the 6 s sampled in 3-4 (`shots/smb-w3/ours/051_bz1.png` ... `062_bz12.png`).

## How often

every time

## Notes

- Merged by the reviewer from the jump parts of `smb-w1/2026-10-05-bowser-pacing-speed-and-range.md` (1-4) and `smb-w3/2026-10-05-bowser-pacing-range-and-jumps.md` (3-4).
- Ours: playtested in 3-4. Original: code reading only; 1-4 and 3-4 froze on load in Ruffle.
- The jump height is close (36 px vs about 39 px); the frequency is the main difference. The airtime and gravity also differ.
- Related: `2026-10-05-bowser-pacing-speed-and-range.md`.
- Reviewed: verified against `com/smbc/enemies/Bowser.as` (`JUMP_TMR_DUR_MIN/MAX` 400/3000, `updateStats`, `jumpTmrLsr`, `jump`, `jumpPwr` 280), `com/smbc/main/AnimatedObject.as` (`gravity` 500; Bowser does not override it), and ours: `src/game/entities/enemies/bowser.ts` (`jumpTimer`).

Status: fixed — Bowser now jumps every time a 400-3000 ms timer (restarted whenever he is on the ground) runs out in his normal state, with `jumpPwr` 280 px/s against the default 500 px/s² gravity (Bowser.as `JUMP_TMR_DUR_MIN/MAX`, `jumpTmrLsr`).
