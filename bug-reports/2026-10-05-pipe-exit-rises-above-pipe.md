# Coming up out of a pipe, player 1 rises 20 px above the pipe top and then drops onto it (the original stops level with the top)

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every arrival that comes up out of a pipe: the 69 `exit=up` pipe links and the 22 areas with `startMode: pipe-exit` in our maps. Seen at ll-7-2 column 147 (back from ll-7-2-bonus), ll-7-1 column 163 (back from ll-7-1-bonus2) and ll-7-1-exit column 3.
- **How to get there:** `?level=ll-7-2&char=mario&dev=1`, enter the pipe at column 51 (row 4), then walk right into the side pipe of the bonus room. For a quick test the tester used a copy of ll-7-2-bonus with only the start moved to column 11, row 12, and then walked right into the pipe (the HUD then says WORLD 1-1).
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Enter the bonus room's exit pipe so that you arrive at ll-7-2 column 147, coming up out of the pipe (pipe at columns 147-148, top at row 11).
2. Watch Mario, 100 ms per screenshot, without pressing anything.

## Expected

As in the original, Mario rises out of the pipe until his feet reach the top, and the exit ends there. In `com/smbc/characters/Character.as`:

- `exitPipeVert` (line 1180) sets `startPipeLoc = pt.y - pt.height` (line 1194) and starts the player one body height below it (`y = startPipeLoc + height`).
- The `pType == "exitVert"` branch (line 932) moves him up by `vertPipeSpeed*dt` each frame and calls `completePipeExit()` as soon as `hBot <= startPipeLoc`.
- `completePipeExit` (line 1227) puts his feet at `startPipeLoc` and sets `onGround = true`.

So he rises exactly one body height and never goes past the end point.

## Actual

Mario keeps rising past the pipe top, floats about 1¼ tiles above it, and falls back onto the pipe once he is unfrozen. Attached PNG: Mario in the air above the pipe at 147.

The cause is in `src/game/world/world.ts`:

- The spawn code sets `feet = tileToSub(sy + 1)`, the top of the pipe for an arrival at `147 10`.
- The `pipe-exit` start (lines 189-195) puts the body top 8 px below that (`p.body.y = feet + px(8)`). It sets `pipeExit = { frames: hb.h + 8 }`, which is exactly the distance to the pipe top: 24 px for small Mario.
- `updatePipeExit` (line 1235) moves every player for whom `p.index === 0 || e.t > 20` up 1 px per frame until `e.t >= e.frames + 20`.

Player 2 starts on frame 21 and rises `frames` px, which is right. Player 1 rises from frame 1, so he rises `frames + 20` px: 44 px instead of 24 for small Mario, and 52 instead of 32 for big Mario. That leaves him 20 px above the pipe top. The 20-frame head start was meant only for player 2.

## How often

every time

## Notes

- PR #24 check: still applies on main 2225155 (campaign and ?level=). `src/game/world/world.ts` is unchanged between b8379f9 and 2225155.
- Dev assist No damage was on. While Mario floats, an enemy walking past or a Piranha Plant rising out of the pipe can touch him from an unexpected height.
- Ours: playtested. Original: found by reading the code; the tester didn't watch a pipe exit in Ruffle. The transporter's height comes from its graphic, which isn't in the source, so "level with the pipe top" is inferred from the transporter sitting in the pipe-top cell. The no-overshoot rule (stop once the feet reach `startPipeLoc`) is explicit in the code.
- **Rise speed (reviewer, from code only, not playtested):** the original's `vertPipeSpeed` is 50 Flash px/s (`Character.as` line 238, used for entering at line 908 and leaving at line 934; `dt` is in seconds). That is 25 of our px/s, about 0.42 px per frame, so a one-tile-tall body takes about 0.64 s to come up. Ours moves 1 px per frame (60 px/s) both ways (`updatePipeExit`, and `updatePipeAnim` line 1223 for entering), about 2.4 times faster. Now filed separately as `2026-10-05-pipe-travel-too-fast.md` (entering playtested by the ll-w8 reviewer).
- The tester also noticed that the original clears nearby enemies on every pipe arrival (`Level.changePlayerLoc` calls `destroyNearbyEnemies(true)`). That is folded into `2026-10-05-enemies-not-cleared-on-respawn-or-pipe-exit.md`, which covers the same routine at the midpoint respawn.
- Seen again (folded in by the ll-w6/w9/wB review, ours only): ll-10-1 column 147 (back from `ll-10-1-bonus`, `pipe 13 12 right -> ll-10-1 147 10 exit=up`) and `ll-10-2-exit` column 3 (ll-wA notes), and `ll-11-2-exit` column 3 (ll-wB notes). Both exit areas use `startMode: pipe-exit`.
- Source: `ll-w7/2026-10-05-pipe-exit-rises-above-pipe.md`.
- Reviewed: verified against `com/smbc/characters/Character.as` (lines 238, 908, 932-942, 1180-1205, 1227-1244) and ours at b8379f9: `src/game/world/world.ts` (spawn lines 166-195, `updatePipeExit` 1235-1248, `enterPipe`/`updatePipeAnim` 1199-1233) and `src/content/levels/lost/world7/ll-7-2.map` / `ll-7-2-bonus.map` (pipe link `pipe 13 12 right -> ll-7-2 147 10 exit=up`, pipe top at row 11).
