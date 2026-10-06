# Hammer Bros jump only every 3-5 s; the original jumps every 0.6-2 s

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every Hammer Bro. Seen in 3-1 (columns 113 and 116) and 5-2 (columns 45, 81, 120 and 124)
- **How to get there:** `?level=3-1&char=mario`, go to column 104
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=3-1&char=mario`, go to column 104 and watch the two Hammer Bros for 10 s.
2. Count their jumps.

## Expected

`com/smbc/enemies/HammerBro.as` (lines 32-33, 172-180, 311-346): whenever it is on the ground a jump timer of 600-2000 ms runs (`JUMP_TMR_DUR_MIN/MAX`), and when it ends the Hammer Bro always jumps: a high jump (`jumpPwr` 625 px/s, up through bricks) or a low hop (`smallJumpPwr` 200 px/s) that drops it through the bricks to the row below. Standing on the floor (feet 2 tiles above the screen bottom) it always jumps high; with its feet 5 tiles below the screen top (the upper brick row) it always hops down; elsewhere it picks either at 50%. In castles and underground it always jumps high (`cannotPassThroughGround`).

## Actual

`src/game/entities/enemies/hammer-bro.ts` (lines 28, 80-84, `tryHop`): the first hop comes after 150 frames, then one every 180-299 frames (3-5 s).

In play our Hammer Bros stand on their row for several seconds between moves. In 5-2, watched from column 39 (`?level=5-2&char=mario&dev=1`, No damage assist), the Hammer Bro at column 45 jumped once in a 9.6 s recording; the original's timer would give about 5 to 15 jumps in that time. In the original (Ruffle) the Hammer Bro jumped down from the bricks within about a second of game time (`shots/smb-w3/orig/068_hb2.png`, `069_hb3.png`, reviewer only).

## How often

every time

## Notes

- Evidence: code reading, plus a short playtest of both games (the original runs at roughly a fifth of real time in Ruffle, so I could not time it precisely there). The Ruffle observation used the original's All Hammer Bros cheat, which only swaps which enemy class spawns.
- Split by the reviewer from `smb-w3/2026-10-05-hammer-bro-throw-and-jump-timing.md`. The throwing part is `2026-10-05-hammer-bro-throws-volleys-of-three.md`.
- Also reported in 5-2 by smb-w5 (`smb-w5/2026-10-05-5-2-hammer-bro-hops.md`): code reading for the original, playtest of ours only (same recording as (screenshot not committed: the repo's `check:assets` bans image files)). The smb-w5 tester could not reach a Hammer Bro in the original.
- Reviewed: verified against `com/smbc/enemies/HammerBro.as` (`JUMP_TMR_DUR_MIN/MAX` 600/2000, `updateStats`, `jumpTmrLsr`, `jump`) and ours: `src/game/entities/enemies/hammer-bro.ts` (`hopTimer`, `tryHop`).

Status: fixed — a 600-2000 ms (36-119 frame) jump timer runs whenever the Hammer Bro stands on something; it then always jumps: high (625 px/s) up through floors from the floor row or off non-brick ground, a low hop (200 px/s) down through up to 2 tiles from the top brick row, else either at 50%, and only straight up in castles and underground (`HammerBro.jump`, `passThroughGround`).
