# Lakitu shows up as soon as his start column nears the screen edge, long before Mario reaches it

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 4-1, Lakitu start marker at column 19 (Lakitu arrives when Mario is at column 7); 6-1, start marker at column 21 (Lakitu arrives when Mario is at column 9 and is overhead by column 12); also 8-2 (start 8)
- **How to get there:** `?level=4-1&char=mario`
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=4-1&char=mario` and press F1.
2. Walk right from the start.
3. Watch the top of the screen.

## Expected

Lakitu does not appear until Mario himself passes column 19. In the original, the Lakitu spawner only
spawns while the player is inside its zone: `EnemySpawner.updateSpawner()` sets `inSpawnZone` only when
`player.nx > _enemyStartPos && player.nx < _enemyEndPos` (EnemySpawner.as lines 32–35), and
`LakituSpawner.updateSpawner()` spawns only when `inSpawnZone` is true (LakituSpawner.as lines 50–55).
`_enemyStartPos` is the x of the `lakituStart` tile (Level.as lines 1133–1143; column 19 in 4-1 and column 21 in 6-1 on NORMAL).
The new Lakitu then enters from just past the right edge of the screen (`x = locStgRht + width*.5`,
Lakitu.as line 74).

## Actual

Lakitu flies in while Mario is still next to the castle. The `lakitu` entry is an ordinary map spawn: the
`LakituZone` is created once column 19 is within `SPAWN_MARGIN_PX` (16 px) of the camera's right edge
(`spawnPending`, `src/game/world/world.ts` lines 271–272; `case 'lakitu'`, line 318). With the camera's push
point at 80 px, that happens when Mario reaches x = 112 px (column 7). `LakituZone.update()` then sends a
Lakitu at once from the right edge (`src/game/entities/enemies/lakitu.ts` lines 111–126). With F1 on, Lakitu
is already overhead when Mario is at column 8 (frame 120). So the player faces Lakitu about 12 columns
earlier than in the original. In 6-1 (start column 21) the same rule sends him once the camera reaches x = 64 px,
with Mario at x = 144 px (column 9); in shots taken every 0.5 s he is first overhead with Mario at column 12
(camera x 112, frame 310), 9 to 12 columns early.

## How often

every time

## Notes

- Playtested in both games. Original screenshots (reviewer only): `shots/smb-w4/orig/keep/056_lx1.png` …
  `067_lx12.png` show Mario walking up to the first pipe with no Lakitu; `keep/070_ly1.png` … `078_ly9.png`
  show Lakitu arriving only once Mario is next to that pipe (about column 19).
- 6-1, playtested in both games by smb-w6. Ours: `shots/smb-w6/ours/243_la1.png` … `250_la8.png` (0.5 s apart; at
  `245_la3` Mario is at column 9 with camera x 65, at `246_la4` he is at column 12 and Lakitu is overhead).
  Original (reviewer only): `shots/smb-w6/orig/034_o61p.png` has no Lakitu with Mario at about column 18 (screen
  showing columns 10–26); `orig/036_o61r.png` has Lakitu once Mario is past column 21 (about column 25).
- Screenshots: not committed (the repo's `check:assets` bans image files) (4-1, Mario at column 8, frame 120,
  Lakitu already overhead) and (screenshot not committed: the repo's `check:assets` bans image files) (6-1, Mario at column 12,
  camera x 112, Lakitu overhead).
- The smb-w4 tester wrote that Lakitu enters 4-1 with Mario at about column 3. The spawn code puts it at column 7
  (camera x ≥ 32 px), which matches the screenshot, so the column was corrected.
- Other SMB levels with a NORMAL Lakitu, same code path: 6-1 (columns 21–170, playtested above) and 8-2
  (columns 8–40, not playtested). Lost Levels Lakitus use the same `LakituZone`.
- Also seen in ll-4-1 (ll-w4 tester, ours only; folded in by the ll-w3 to ll-w5 review): Lakitu appears before Mario reaches column 19 and starts throwing early. No exact column was recorded. The Lakitu zones match the original's XML (ours `lakitu 19 0 end=50` and `lakitu 92 0 end=180`, `ll-4-1.map` lines 32 and 36).
- Related: `2026-10-05-lakitu-leaves-right-instead-of-left.md`, `2026-10-05-lakitu-respawn-delay.md`,
  `2026-10-05-lakitu-throw-rate-and-spiny-cap.md`, `2026-10-05-lakitu-falls-behind-running-player.md`.
- Merged from `smb-w4/2026-10-05-4-1-lakitu-appears-before-start-column.md` (4-1) and the arrival half of
  `smb-w6/2026-10-05-6-1-lakitu-arrives-early-and-returns-fast.md` (6-1; its respawn half is in
  `2026-10-05-lakitu-respawn-delay.md`). The smb-w6 tester gave 6-1 column 12, the first shot with Lakitu on
  screen; the spawn code puts the send at column 9 (camera x ≥ 64 px), so both are given.
- Reviewed: verified against `com/smbc/level/EnemySpawner.as`, `com/smbc/level/LakituSpawner.as`, `com/smbc/level/Level.as` (1133–1143), `com/smbc/enemies/Lakitu.as`, `levelDataSmb.xml` (4-1, 6-1, 8-2 Lakitu markers), and ours: `src/game/world/world.ts` (`spawnPending`), `src/game/world/camera.ts` (`pushX`), `src/game/constants.ts` (`SPAWN_MARGIN_PX`), `src/game/entities/enemies/lakitu.ts` (`LakituZone`)

Status: fixed — `LakituZone` now sends the first Lakitu only once the lead player's middle is past the start column (`EnemySpawner.updateSpawner`, `player.nx > _enemyStartPos`), entering from just past the right edge (`x = locStgRht + width*.5`).
