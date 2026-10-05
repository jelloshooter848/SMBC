# Hammer Bros walk after Mario once he passes them, and start advancing after 10 s; the original never follows to the right and only advances after 27 s

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every Hammer Bro. Seen in 3-1 (Hammer Bro on the ground at column 116) and 5-2 (Hammer Bros at columns 45, 81, 120 and 124)
- **How to get there:** `?level=3-1&char=mario&dev=1` with Dev mode assist No damage on (to walk past it safely)
- **Character and power:** Mario, small (No damage assist on)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open 3-1 and run to column 110.
2. Run right past the Hammer Bro on the ground (column ~116) and stop at column 118-120.
3. Watch it for 3 s.

## Expected

`com/smbc/enemies/HammerBro.as` lines 190-243: while Mario is to its right
(`player.hLft > nx`) a normal Hammer Bro keeps pacing half a tile either side of its spot
(`xWaveLeft/Right = nx -/+ TILE_SIZE*.5`, lines 213-215) at 30 px/s and only turns to face Mario.
It only walks at Mario (65 px/s, leftwards only, line 196) after its 27 s chase timer
(`CHASE_TMR_DUR = 27000`, line 38) or with the Evil Hammer Bros cheat.

## Actual

`src/game/entities/enemies/hammer-bro.ts` lines 52-58: once Mario is 24 px past it
(`passed`), or after 600 frames (10 s, `ADVANCE_AFTER`), it walks at Mario at 0.5 px/frame in
either direction and walks off ledges. In play the floor Hammer Bro followed Mario from column 114
to column 117 within 2 s after he ran past. Its pacing range before that is also ±16 px (one
tile) instead of ±8 px.

## How often

every time

## Notes

- Evidence: code reading and a playtest of ours (shared copy of 3-1 starting at column 100, No
  damage assist). Not playtested in the original at this spot (too slow in Ruffle to reach).
- Also reported in 5-2 by smb-w5 (`smb-w5/2026-10-05-5-2-hammer-bro-chase.md`, code reading). The smb-w5 tester watched our Hammer Bro at column 45 from column 39 for 9.6 s without seeing it advance, and did not time the advance or the chase in either game. (`age` counts from when the Hammer Bro spawns, not from when you stop to watch.)
- Reviewed: verified against `com/smbc/enemies/HammerBro.as` (`updateStats`: walks at the player only when `chase || evil` and only leftwards unless `evil`; `xWaveLeft/Right = nx -/+ TILE_SIZE*.5`; `WALK_SPEED` 30; `CHASE_TMR_DUR` 27000; chase speed `Enemy.ENEMY_WALK_SPEED_NORMAL` 65) and ours: `src/game/entities/enemies/hammer-bro.ts` (`passed`, `ADVANCE_AFTER` 600, `ADVANCE_SPEED` 0.5 px/frame, shuffle ±16 px, `fallsOffLedges = true` while advancing).
