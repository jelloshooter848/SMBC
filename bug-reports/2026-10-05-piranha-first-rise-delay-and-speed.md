# Piranha Plants stay in their pipe for a full second after they appear, then rise faster than in the original

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every Piranha Plant, upright or upside-down, in both map sets (414 plants on the normal layer: 111 in SMB, 303 in the Lost Levels; see Notes). Seen at ll-6-1 column 80 (red plant in the tall pipe at 80-81) and ll-6-4 column 24 (red plant in the pipe at 24-25).
- **How to get there:** `?level=ll-6-1&char=mario`, run right to column 70 and watch the pipe at column 80 as it scrolls in. Faster: a share-link copy of `ll-6-4.map` with only the start moved to `start: 18,12`, so the pipe at 24 is on screen from the first frame.
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Load the ll-6-4 copy with `start: 18,12`. Press F1 and don't move. Mario stands at column 18, more than 1.4 tiles from the pipe at 24-25.
2. Note the frame counter while the plant in the pipe at 24 comes out.
3. Or play the real ll-6-1: run right from the start and note when the plant at column 80 first shows after its pipe comes into view.

## Expected

The plant starts to rise as soon as it is on screen, unless the player is close. It then rises at 0.625 px per frame.

In `com/smbc/enemies/PiranhaGreen.as` (`PiranhaRed` extends it and only narrows the stop-rise zone to ±1.4 tiles; the upside-down plants use the same class with `upsideDown = true`):

- **No wait before the first rise.** `setStats()` sets `readyToRise = true` (line 93), and so does `rearm()` (line 109). `checkState()` starts the rise right away when `readyToRise && onScreen` and the player is outside the stop-rise zone and not standing over the pipe (lines 135-144). `onScreen` turns true when the object is added to the stage (`com/smbc/main/LevObj.as` line 323). The 1000 ms `WAIT_TMR` (line 22) only starts when a rise or a sink has finished (lines 122 and 130).
- **Speed.** `ySpeed = 75` Flash px per second (line 91) over `PIR_HEIGHT = 46` Flash px (line 32). At our scale (Flash tiles are 32 px, ours 16 px) that is 37.5 px/s, or 0.625 px per frame over 23 px. A rise or sink takes about 37 frames. One full cycle (rise, 1 s up, sink, 1 s down) is about 194 frames (3.23 s).

## Actual

In `src/game/entities/enemies/piranha.ts`:

- Every plant starts in the `hidden` phase with `t = HIDDEN_FRAMES` (lines 34-35; `HIDDEN_FRAMES = 60`, line 12). So it stays in its pipe for 1 s after it spawns, even when the player is far away.
- It rises `HEIGHT = 24` px in `RISE_FRAMES = 32` frames (lines 9-10). That is 0.75 px per frame, 20% faster than the original. One cycle is 32 + 60 + 32 + 60 = 184 frames (3.07 s).

Measured in ours:

- **ll-6-4 copy, start 18,12:** the plant at 24 spawns with the level (the pipe is on screen). It is still fully hidden at world frame 61, shows its head at frame 70, is about half out at frame 79 and nearly fully out at frame 88.
- **Real ll-6-1:** the pipe at 80 enters the spawn range at about frame 585 (camera x 1018). The plant is still hidden at frame 627 and first shows at frame 651. Mario was more than 5 tiles away the whole time.

## How often

every time

## Notes

- Ours: playtested (frame counter from the F1 overlay). Original: found by reading the code. In the original 6-1, the pipe at 80 is off screen in `shots/ll-w6/orig/keep/028_q.png` (TIME 381). In `keep/029_q.png` (TIME 378, about 1.2 s of game time later) it is at the right edge with the plant's head already coming out. That fits the code, but the two shots are too far apart to time the rise.
- **The delay is the bigger effect.** A plant that scrolls into view stays hidden for 60 frames, and a running player covers about 9 tiles in that time. Earlier testers (smb-w1, ll-w1 notes) saw the faster rise (32 frames against about 37) and called it small. The 1 s wait before the first rise is new.
- **Plant counts (reviewer, normal layer, tokens that Mario sees):**
  - SMB, `levelDataSmb.xml`: 111, all `enemyPiranhaGreen` (upright).
  - Lost Levels, `levelDataLostLevels.xml`: 303 (64 green upright, 175 red upright, 64 red upside-down). There are 311 tokens on normal, but 8 of them are `charHorz=Show` / `charVert=Show` helper plants for other heroes, which the converter rightly drops.
  - Our maps have the same counts: 111 `piranha` lines in `src/content/levels/world*`, and 239 `piranha` plus 64 `piranha-down` lines in `src/content/levels/lost`.
  - World 6 of the Lost Levels has 26: 12 in ll-6-1, 1 in ll-6-2-exit, 13 in ll-6-4. The ll-wA tester also saw it on every World A plant.
- The hide radius (±1.4 tiles for red, ±2 for green) and the "player above the pipe" rule already match the original.
- Minor, not part of this report: our plant is 24 px tall, the original's 23 px (`PIR_HEIGHT` 46 / 2).
- Steps 1-2 use a share-link copy of `ll-6-4.map` with only `start:` changed. Step 3 uses the real level.
- Source: `ll-w6/2026-10-05-piranha-first-rise-delay-and-speed.md`. The reviewer added the plant counts and the cycle arithmetic.
- Reviewed: verified against `com/smbc/enemies/PiranhaGreen.as` (lines 22, 32, 91-99, 102-112, 115-147, 148-160), `com/smbc/enemies/PiranhaRed.as`, `com/smbc/main/LevObj.as` (line 323), both level XMLs (every `enemyPiranha*` token on the normal layer), and ours at b8379f9: `src/game/entities/enemies/piranha.ts` and every map's `piranha` / `piranha-down` lines.
