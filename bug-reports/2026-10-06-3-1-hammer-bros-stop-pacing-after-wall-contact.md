# Hammer Bros stop pacing for good after their first wall contact

- **Severity:** wrong behaviour
- **Build:** V0.3.0-DEV.8F4BF1A (main 8f4bf1a)
- **Where:** 3-1 column 116 (both Hammer Bros); 5-2 column 45; any Hammer Bro that passes through a brick row or hops beside a block
- **How to get there:** `?level=3-1&char=mario`, or a copy of 3-1 with only `start: 100,12`, then stand at column 108
- **Character and power:** Mario, small
- **Input:** keyboard
- **Browser and device:** headless Chromium on Linux (cloud container, scripted through Playwright)

## Steps

1. Stand at column 108 in 3-1 and watch the Hammer Bros at column 116.
2. Wait for one to jump up or down through the row-9 bricks (around frame 537).
3. Watch its x position after that.

## Expected

Hammer Bros keep shuffling ±8 px at about 0.25 px/frame for as long as they are in range, as described in `2026-10-05-hammer-bro-follows-player-right.md`. They don't follow the player right, and they walk left after 27 s.

## Actual

Pacing starts correctly: ±8 px at about 0.25 px/frame (5-2 column 45: x 727↔743 over frames 98-164). After the first wall contact, the Hammer Bro's x never changes again. This happens in 3-1 to both Hammer Bros after their first jump through the brick row, and in 5-2 after the column-45 one hops off the stair edge beside a block. The 27-second chase to the left still works (0.56 px/frame), and they never follow right.

## How often

every time

## Notes

- This is what's left of `2026-10-05-hammer-bro-follows-player-right.md` (status: fixed): the follow-right part is fixed, but pacing breaks.
- Cause, by code: in `src/game/entities/enemies/hammer-bro.ts` (`update()`, around line 121), `moveX` sets `vx = 0` on a wall hit, and then `b.vx = -b.hitWall * Math.abs(b.vx)` keeps it at 0. The wall hit happens while the Hammer Bro passes through a brick row, or when it hops beside a block. The older code set the shuffle speed every frame, so it never got stuck.
- Fix ideas: keep a pacing direction instead of deriving it from `b.vx`; or skip wall collisions while passing through (`through`), as the original removes the brick hit tests while passing through.
- Found by the build review of V0.3.0-DEV.8F4BF1A. Screenshot names in the review: `hb_pacing_strip.png`, `h1`…`h300`, `m1`…`m200`. Not committed (`check:assets` bans image files).
