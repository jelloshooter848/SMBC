# Bloopers sink too slowly and rise again after 1 s even when still above Mario, so a Blooper above Mario never comes down to him

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every Blooper; seen in 7-2 (water area, Bloopers from column 22). Level list in Notes
- **How to get there:** `?level=7-2&char=mario`, sink to the seabed around column 20 and watch the Bloopers
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=7-2&char=mario`, sink to the seabed and stand still near column 20.
2. Watch a Blooper that is several tiles above Mario.
3. Clearest test: use a copy of 7-2 with the Blooper at column 22 moved to row 3 (`blooper 23 3`) and
   the start at `20,12`. Watch for 9 seconds.

## Expected

`com/smbc/enemies/Bloopa.as` (Flash units: 32 px tiles, per second; our px = half, /60 for per frame).
Its position `ny` is its bottom edge: `Level.as` lines 1250-1251 place every enemy at the bottom centre of
its tile, and the player is placed the same way (lines 618-619).

- **Sink:** `ySpeed = 80` (line 62), set as `vy = ySpeed` (lines 66 and 120), with `defyGrav = true`
  (line 60). That is 40 px/s = **0.67 px/frame**, steady. The Blooper keeps sinking in both the 200 ms
  `"wait"` state (`moveDelTmrDur = 200`, line 67) and the `"ready"` state.
- **Rise trigger** (line 93): only in `"ready"`, and only when `player.ny < ny` (Mario's feet are higher
  than the Blooper's bottom edge) or `ny > MAX_BOTTOM_Y`. `MAX_BOTTOM_Y = STAGE_HEIGHT - TILE_SIZE*3.5`
  (line 28) = 480 - 112 = 368 Flash px, which is y 184 at our scale (row 11.5). There is no time limit:
  a Blooper above Mario keeps sinking until it is below his feet or its bottom reaches y 184.
- **Rise** (lines 105-127): from a standstill it accelerates up and toward Mario's side at `axy = 700`
  (line 55), 0.097 px/frame², on both axes. Once it has risen more than `yMaxDist = 50` Flash px (25 px,
  line 57), or its bottom is within 4 tiles of the top of the screen (line 112), it also loses speed to
  friction (`fxy = .000001` per second, line 56, about ×0.79 per frame). It goes back to `"wait"` when
  |vy| < 50 Flash px/s (line 117). Worked out frame by frame at 60 fps: about 33 px up and 33 px sideways
  in the first 28 frames, then a slow tail to about 40 px each way at frame 40. Fast at first, not steady.

## Actual

`build/src/game/entities/enemies/blooper.ts`:

- **Sink:** `SINK_SPEED = 0x00800` (line 8), **0.5 px/frame**, 25% slower.
- **Rise trigger** (lines 47-53): it rises when `b.y > pl.y + px(16)` (its top is more than 16 px below
  Mario's top) after at least 12 frames, **or after `SINK_MAX = 60` frames (line 9) no matter where Mario
  is.** With the Blooper 20 px tall and Mario 16 px (small) or 24 px (big), that means its bottom edge must
  be more than 20 px (small) or 12 px (big) below Mario's feet, where the original needs it to be lower at
  all.
- **Rise:** `RISE_SPEED = 0x01800` (line 7), 1.5 px/frame up and sideways, for `RISE_FRAMES = 20`
  (line 6). That is a steady 30 px up and 30 px sideways.
- **Limits:** clamped to `waterTop + 8` at the top and to the floor (`13 * 16`) at the bottom
  (lines 57-59).

Consequences:

- **A Blooper above Mario never comes down to him.** Each cycle sinks 60 × 0.5 = 30 px and then rises
  30 px, so the net change is zero. In the test above, the Blooper stayed at rows 3-4 for the whole 9 s,
  swaying toward Mario, while he stood on the seabed (screenshot). In the original it sinks at
  0.67 px/frame without stopping and reaches Mario's level in about 3 s.
- **It can sink onto a small Mario on the seabed.** Ours sinks down to the floor (line 59) when its timer
  allows. In the original the Blooper's bottom edge stops at about y 184 (it rises as soon as it passes
  `MAX_BOTTOM_Y`), 8 px above the head of a small Mario standing on the seabed (top at y 192).
- **It rises late and less sharply when level with or just below Mario** (the trigger above), and its
  rise is a steady glide instead of a quick burst that slows down. The rise size is close: about 33-40 px
  in the original against 30 px in ours, each way.

## How often

every time

## Notes

- **Evidence:** code reading in both games, plus playtesting:
  - In both games, Bloopers rose toward a Mario swimming along the surface in 7-2 (orig
    `gauntlet/shots/smb-w7/orig/116_sw.png`-`121_sw.png`, reviewer only).
  - The stuck Blooper above a seabed Mario was seen in ours only, in a test copy of 7-2 where only the
    start and one Blooper were moved (share link `gauntlet/notes/72-bl3.url`; screenshot
    (screenshot not committed: the repo's `check:assets` bans image files), HUD reads WORLD 1-1 because it is a share-link
    copy). The tester didn't test the same setup in the original.
- **Reviewer checks:** the tester asked to confirm that `ny` is the bottom edge. It is (`Level.as` lines
  1250-1251; `AnimatedObject.setHitPoints` uses `hBot = ny` when there is no hit rectangle). The
  Blooper's own hit rectangle is in the SWF art and was not checked, so the 8 px gap above a small Mario
  is for its bottom-centre point. Right after spawning, a Blooper placed on map row 12 starts with its
  bottom on the seabed (y 208) and rises when its first 200 ms wait ends. The reviewer also corrected the
  rise worked out by the tester (32 px over 30 frames) to the frame-by-frame figures above, and restated
  our trigger in bottom-edge terms (the tester wrote "16 px lower").
- **Levels with Bloopers on the normal layer** (`levelDataSmb.xml` / `levelDataLostLevels.xml`; our maps
  have the same count in each):
  - SMB: 2-2 (6), 5-2 water (3; `5-2-water`), 6-2 water (3; `6-2-water`), 7-2 (13), 8-4 water area (3;
    `8-4-water`).
  - Lost Levels: ll-1-3 (2), ll-2-3 (1), ll-3-2 (11), ll-4-1 water (3; `ll-4-1-water`), ll-5-3 (3), ll-6-1
    water (2; `ll-6-1-water`), ll-6-2 (11), ll-8-1 water (2; `ll-8-1-water`), ll-8-4 water and castle areas
    (2 + 2; `ll-8-4-water`, `ll-8-4-end2`), ll-9-1 (2), ll-9-4 (1), ll-10-3 (1), ll-11-2 (6), ll-12-2 (3),
    ll-13-4 (2 + 3; `ll-13-4-exit`, `ll-13-4-end`).
  - Several Lost Levels ones are out of water. There the original makes them stompable (`Bloopa.as`
    lines 50-53) and the same sink and rise rules apply. The stomp is filed separately as
    `2026-10-05-blooper-out-of-water-not-stompable.md`, which lists the 17 out-of-water Bloopers.
- **Out-of-water ceiling** (from the ll-w2 tester, added by the ll-w1/w2 reviewer, code only): out of
  water ours clamps the Blooper's top at y 32 (`AIR_TOP`, `blooper.ts` lines 11 and 57-58). The original
  has no hard ceiling: it only starts the rise's friction once its bottom is within 4 tiles of the stage
  top (`Bloopa.as` line 112) and then drifts on until |vy| < 50. In the original's ll-2-3 the Blooper was
  seen as high as about row 1 (reviewer only: `gauntlet/shots/ll-w2/orig/146_lb.png`-`150_bw4.png`).
- Source: `smb-w7/2026-10-05-blooper-sink-speed-and-rise-rule.md`.
- Reviewed: verified against `com/smbc/enemies/Bloopa.as`, `com/smbc/level/Level.as` (spawn point),
  `com/smbc/main/AnimatedObject.as` (`updateObj`, `updateLoc`, `setHitPoints`), `com/smbc/main/GlobVars.as`
  and `com/smbc/data/ScreenSize.as` (480 px stage, 32 px tiles), both level XMLs, and ours:
  `src/game/entities/enemies/blooper.ts`, `src/game/characters/mario/index.ts` (hitbox 16/24 px),
  the `blooper` lines in `src/content/levels/`.
