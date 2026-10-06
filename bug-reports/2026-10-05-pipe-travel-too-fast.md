# The player goes into and out of pipes at 1 px per frame, about 2.4 times faster than the original's 50 Flash px/s, and the next area loads with no 0.5 s pause

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every pipe the player enters (down or sideways) and every pipe exit (`exit=up` links and `startMode: pipe-exit` areas). Playtested at 1-1, the bonus pipe at columns 57-58 (top at row 9).
- **How to get there:** `?level=1-1&char=mario`, reach the pipe at column 57, stand on it and hold down. For the measurement, the reviewer used a share-link copy of 1-1 with only `start:` moved to `57,8`, on the pipe top.
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Stand on the 1-1 bonus pipe at column 57 with F1 on, and pause the game.
2. Hold down and step the game 3 frames at a time, noting `y` and `frame` in the overlay.
3. Note the frame where Mario is fully inside the pipe and the frame where the bonus room appears.

## Expected

The original moves the player through pipes at a fixed 50 Flash px/s in every direction (`com/smbc/characters/Character.as`):

- `vertPipeSpeed = 50` and `horzPipeSpeed = 50` (lines 238-239). No character overrides them.
- They are used for entering downwards (`ny += vertPipeSpeed*dt`, line 908; first step at line 1172), entering sideways (`nx += horzPipeSpeed*dt`, line 921; line 1219), and coming up out of a pipe (`ny -= vertPipeSpeed*dt`, line 934). `dt` is in seconds.
- With 32 px Flash tiles and 16 px tiles in ours, that is 25 of our px per second, about **0.42 px per frame** at 60 fps.
- Entering downwards ends when the hit box's top is 6 Flash px (`HRECT_PADDING_Y`) below where the feet started (line 909). Entering sideways ends when its left edge is 4 Flash px (`HRECT_PADDING_X`) past where its right edge started (line 922). The player is then hidden. The new area loads after a further `PIPE_LEV_TRANS_DELAY` = 500 ms (line 142, passed to `EventManager.levelTransfer`, lines 143-153, which starts a timer when the delay is nonzero).

For small Mario going down, that is about 38 frames (0.64 s) to sink one tile, then the last 3 px and 30 frames of waiting, so roughly 1.3 s from pressing down to the next area. This assumes a 16 px hit box; the real hit box comes from the art, which is not in the source.

## Actual

Ours moves the player 1 px every frame (60 px/s) in all three cases (`src/game/world/world.ts`):

- **Entering:** `updatePipeAnim` (lines 1218-1233) moves the body 1 px per frame for `toPx(body.h) + 8` frames going down (24 for small Mario, 32 for big), or 24 frames going right (`enterPipe`, lines 1199-1216). Then it pushes the pipe event, and `LevelScene` starts the next area on the spot (`src/game/scenes/level.ts` lines 88-107), with no pause.
- **Exiting:** `updatePipeExit` (lines 1235-1248) raises the players 1 px per frame.

Playtest (1-1, small Mario, the reviewer): down was pressed at frame 224. The overlay `y` went 128 → 130 (frame 226) → 134 (230) → 137 (233) → 140 (236) → 143 (239) → 151 (247), 1 px per frame. Mario was fully below the pipe top (y 144) after **16 frames (0.27 s)**. The bonus room was on screen in the next screenshot after frame 248 (24 frames, **0.4 s**). That is about a third of the original's roughly 1.3 s.

Screenshot: not committed (the repo's `check:assets` bans image files) (frame 233, 9 frames after pressing down: Mario already half inside the pipe).

## How often

every time

## Notes

- PR #24 check: still applies on main 2225155 (campaign and ?level=). `src/game/world/world.ts` is unchanged; the `pipe` case in `src/game/scenes/level.ts` (now lines 88-109) only gained the campaign warp bookkeeping and still starts the next area at once.
- Evidence: ours playtested going down (above). Going sideways and coming up were checked by reading the code only. The original was checked by reading its code only; the reviewer did not time a pipe in Ruffle, and Ruffle's slowdown would make that unreliable anyway.
- Related: `2026-10-05-pipe-exit-rises-above-pipe.md` is about where the exit stops: player 1 rises 20 px too far. It first noted this speed difference. Fix both in `updatePipeExit`: rise at about 0.42 px/frame and stop when the feet reach the pipe top.
- Related: `2026-10-05-enemies-not-cleared-on-respawn-or-pipe-exit.md` (enemies near a pipe exit are not removed).
- A slower pipe also means more time with the timer stopped. The original calls `STAT_MNGR.stopTimeLeft()` on entering and exiting (lines 1178, 1204 and 1225), and ours does not tick the timer during either animation (`World.update` returns before `tickTimer`), so the extra time does not cost the player any of the level timer.
- Raised by the orchestrator, from the ll-w7 review's note on rise speed.
- Reviewed: verified against `com/smbc/characters/Character.as` (lines 142, 238-239, 904-942, 1160-1225), `com/smbc/managers/EventManager.as` (`levelTransfer`, lines 143-175), and ours: `src/game/world/world.ts` (`enterPipe`, `updatePipeAnim`, `updatePipeExit`, the `pipe-exit` start at lines 189-195), `src/game/scenes/level.ts` (the `pipe` case), `src/game/characters/mario/index.ts` (hit box 12×16 small, 12×24 big), `src/content/levels/world1/1-1.map` (`pipe 57 9 down -> 1-1-bonus`). Playtest shots: `gauntlet/shots/review/ours/003_shot.png` to `017_pipe14.png`.

Status: fixed — entering and leaving pipes moves at 50 Flash px/s (25/60 px a frame), entering ends at the HRECT_PADDING_Y/X margins, and the player then stays hidden for PIPE_LEV_TRANS_DELAY (30 frames) before the next area loads.
