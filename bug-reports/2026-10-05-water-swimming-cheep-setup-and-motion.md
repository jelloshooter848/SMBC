# Swimming Cheep Cheeps keep their map colour and spot, swim 10% slow and all bob; the original randomises colour, start tile and motion

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every swimming Cheep Cheep. Seen in 7-2 (water area), first group at columns 76, 79 and 81. Same code in 2-2, 5-2-water, 6-2-water, 7-2, ll-3-2, ll-6-2 and ll-11-2 (full list in Notes)
- **How to get there:** `?level=7-2&char=mario` (or `?level=7-2-intro&char=mario` and walk into the pipe), swim right to column ~70
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=7-2&char=mario` and swim right to column ~70 (F1 shows the column).
2. Watch the first group of Cheep Cheeps (map entries at columns 76, 79 and 81): note their colour, where each one appears, and how its height changes as it swims left.
3. Reload and repeat a few times.

## Expected

The original sets up every swimming fish at random, ignoring most of what the map says. Values below are Flash px on 32 px tiles, per second; half of that is our px, and /60 gives px per frame.

1. **Colour and speed.** `com/smbc/level/Level.as` lines 953-958: for any map item containing "Cheep",
   `if (Math.random() > .5) new CheepFast("enemyCheepRed") else new CheepSlow("enemyCheepGreen")`. The map's
   `enemyCheepFast` / `enemyCheepSlow` is ignored, so each fish is a 50/50 pick, new on every visit.
   `com/smbc/enemies/CheepFast.as` `setStats()` lines 151-154: grey `xSpeed = 50` (0.417 px/frame), red
   `xSpeed = 100` (0.833 px/frame), set as `vx = -xSpeed` (line 159).
2. **Motion.** `calcMovement()` (lines 91-101) picks `"wave"` or `"straight"` 50/50 per fish. A straight fish
   keeps its height (`vy = 0`, line 161). A wave fish starts moving up at `ySpeed = 20` (0.17 px/frame,
   lines 156 and 160; `defyGrav = true`, so no gravity) and turns at `yWaveTop` / `yWaveBot`, one tile
   (16 px) above and below its start (lines 123-128 and `updateStats()` lines 231-246). That is a triangle
   wave of ±16 px with a cycle of 64 px / 10 px/s = 6.4 s.
3. **Start position.** `calcPosition()` (lines 102-129, called at line 162) moves the fish by a random whole
   number of tiles from -2 to +2 horizontally and -2 to +2 vertically (`ranLocBuf = 5`; `xNum`/`yNum` 1-5
   minus 3). It then moves it back a tile at a time until its bottom edge is between y 64 and 192 of the
   screen (`GLOB_STG_TOP + TILE_SIZE*4` and `GLOB_STG_BOT - TILE_SIZE*3`, at our scale), so the fish swim
   in rows 3-11. The wave limits are taken after this move.

So on each visit the school has a different mix of red and grey fish, in different places, and about
half of them swim level while the rest drift slowly a tile up and down.

Playtested in the original's 7-2 (normal difficulty): the first group at columns 76, 79 and 81 showed a
red Cheep Cheep at about column 75, row 9, next to a grey one at about column 77, row 11, although all
three map entries there are `enemyCheepSlow` (`levelDataSmb.xml`, 7-2 area b). The fish there also held a
steady height between screenshots.

## Actual

Ours copies the map and uses one fixed motion for every fish:

1. **Colour and speed.** `build/src/game/world/world.ts` lines 302-304 create exactly the map's
   `cheep-grey` or `cheep-red`. `build/src/game/entities/enemies/cheep.ts` line 8:
   `SWIM_SPEED = { red: 0x00c00, grey: 0x00600 }`, 0.75 and 0.375 px/frame, 10% slower than the original
   for both. The 7-2 group at 76/79/81 is always three grey fish, and the red ones are always at the map's
   `enemyCheepFast` spots (97, 127, 150, 167, 183, 185).
2. **Motion.** `cheep.ts` lines 9-10 and 62-63: every fish follows
   `homeY + sin(t * 2π / 128) * 8`, a sine of ±8 px with a 128-frame (2.1 s) cycle. No fish swims level,
   and the bob is half as tall and three times as fast as the original's wave.
3. **Start position.** `world.ts` line 304, `new Cheep(x + px(2), y + px(2), ...)`: each fish starts on its
   map tile, every time.

## How often

every time

## Notes

- Evidence: the colour was playtested in both games (original screenshot for the reviewer only:
  `gauntlet/shots/smb-w7/orig/120_sw.png`, one red and one grey fish where the map has only grey ones).
  Speed, motion and start position were found by reading code; the original's Ruffle frame rate was too
  uneven to time a 10% speed difference or the wave. The level-hold seen in `orig/116_sw.png` to
  `121_sw.png` fits the slow wave or straight swim but was not measured.
- Our screenshot: not committed (the repo's `check:assets` bans image files) (7-2, column 77: only a grey fish
  in the first group).
- One fix: all four points come from `CheepFast.setStats()` (plus the colour pick in `Level.as`), which
  our `Cheep` constructor and swim branch of `update()` replace. `CheepFast.calcColor()` (lines 78-90) is
  never called; the colour comes only from `Level.as`.
- Levels with swimming Cheep Cheeps on the normal layer (`levelDataSmb.xml`, `levelDataLostLevels.xml`;
  our maps have the same count in each):
  - SMB: 2-2 area b (17: 11 slow, 6 fast; our `2-2.map`), 5-2 area b (4; `5-2-water.map`), 6-2 area c
    (4; `6-2-water.map`), 7-2 area b (17; `7-2.map`).
  - Lost Levels: 3-2 area b (25; `ll-3-2.map`), 6-2 area b (22; `ll-6-2.map`), 11-2 area b (19;
    `ll-11-2.map`).
- The world-2 tester's notes list "cheeps grey slow and red fast" as a match; that compared the map types,
  not the original's random pick.
- Not the leaping Cheep Cheeps of the bridge levels (`flying` fish, same class): those are
  `2026-10-05-2-3-flying-cheep-leap-too-low.md` and `2026-10-05-2-3-flying-cheep-direction-speed.md`.
- Merged from `smb-w7/2026-10-05-7-2-swimming-cheep-colour-not-random.md` (colour, playtested),
  `smb-w7/2026-10-05-7-2-swimming-cheep-speed.md`, `smb-w7/2026-10-05-7-2-swimming-cheep-motion.md` and
  `smb-w7/2026-10-05-7-2-swimming-cheep-start-position.md` (code). The reviewer added that the
  position limits apply to the fish's bottom edge and the full level list.
- Reviewed: verified against `com/smbc/level/Level.as` (lines 953-958, and 1250-1251 for the bottom-centre
  spawn point), `com/smbc/enemies/CheepFast.as` (`setStats`, `calcMovement`, `calcPosition`,
  `updateStats`), `com/smbc/enemies/CheepSlow.as`, `com/smbc/main/AnimatedObject.as` (`updateObj`,
  `updateLoc`), both level XMLs, and ours: `src/game/entities/enemies/cheep.ts`, `src/game/world/world.ts`
  (`spawn` switch), `src/engine/math/units.ts` (4096 = 1 px/frame), the `cheep-*` lines in
  `src/content/levels/`.
