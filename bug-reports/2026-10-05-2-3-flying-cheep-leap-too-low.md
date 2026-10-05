# 2-3: flying Cheep Cheeps leap only to about row 6; in the original they reach the top of the screen (about row 2)

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 2-3, the `cheeps 9 173` zone (columns 9–181); measured standing on the bridge at column 50. Also playtested in 7-3 (`cheeps 9 173`, standing at column 9). Every other `cheeps` zone uses the same code (list in Notes).
- **How to get there:** `?level=2-3&char=mario`, walk onto the first bridge (column 16 or later) and stand still
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=2-3&char=mario` and walk right to the bridge (column 16 or later).
2. Stand still and step the game 100 ms at a time for about 3 s.
3. Note the highest point each leaping Cheep Cheep reaches.

## Expected

In the original (`CheepFast.as`), a flying Cheep Cheep starts below the screen (`y = GLOB_STG_BOT + height`, line 139) with `FLYING_JUMP_PWR = 555` (line 31) under `FLYING_GRAVITY = 375` (line 29). In NES units that is 4.6 px/frame against 0.052 px/frame², a rise of about 205 px. Each fish peaks about 2 tiles below the top of the screen and stays in the air for about 3 s.

Playtested in the original's 2-3 (standing on the first mushroom, `orig/110_oc1.png`–`133_oc24.png`): the top of the fish sprite peaked at NES y 28–35 again and again, which is rows 1.7–2.2.

## Actual

Ours spawns the fish at y 248 with `vy` of -4.5 to -5.5 px/frame under `FLY_GRAVITY = 0x00180` (0.094 px/frame²). See `build/src/game/world/world.ts` `flyingCheeps()` lines 724-727 and `build/src/game/entities/enemies/cheep.ts` line 11. Each fish peaks at y 87–140 (rows 5.4–8.8), only 20–73 px (1.3–4.6 tiles) above the bridge deck at y 160, and stays in the air 1.6–2.0 s. In testing, the fish peaked at y 92–95 (screenshot `2026-10-05-2-3-flying-cheep-leap-too-low.png`, column 50). So our fish skim at Mario's jump height instead of arcing high overhead and dropping onto him from above.

## How often

every time

## Notes

Playtested in both games, and confirmed in the original's source. The sideways speed and direction differ too; that is filed separately in `2026-10-05-2-3-flying-cheep-direction-speed.md`.
- Arithmetic: the original's values are Flash px/s at 32 px tiles, so 555 / 2 / 60 = 4.63 px/frame and 375 / 2 / 3600 = 0.052 px/frame²; rise 4.63² / (2 × 0.052) ≈ 205 px; time up and down ≈ 178 frames. The flying fish has no fall-speed cap (`vyMaxPsv` is only set for swimming fish, line 157). Ours: 4.5² / (2 × 0.094) = 108 px to 5.5² / (2 × 0.094) = 161 px.
- Other levels with a `cheeps` zone in our maps, all spawned by the same `flyingCheeps()`: 7-3 (`cheeps 9 173`), 8-4 (two zones), ll-2-3, ll-6-3, ll-7-1, ll-10-3, ll-12-2 and ll-13-4. 2-3 and 7-3 were playtested.
- 7-3 (smb-w7), playtested in both games: in the original the fish leap to about row 1, right under the HUD (`gauntlet/shots/smb-w7/orig/049_cs.png` to `064_cs.png` and `065_ls.png`, reviewer only); in ours, standing at column 9, they peak around rows 4-6 (`gauntlet/shots/smb-w7/ours/378_cs.png` to `393_cs.png`). The reviewer checked four frames from each set. Source: `gauntlet/notes/smb-w7.md`, folded in during the smb-w7/w8 consolidation.
- Source: `smb-w2/2026-10-05-2-3-flying-cheep-leap-too-low.md`. The reviewer corrected the height above the deck (the tester wrote 1 to 3.5 tiles) and added the level list.
- Reviewed: verified against `com/smbc/enemies/CheepFast.as` (`FLYING_JUMP_PWR`, `FLYING_GRAVITY`, `setStats`), `com/smbc/enemies/CheepFlying.as`, `com/smbc/level/FlyingCheepSpawner.as`, and ours: `src/game/world/world.ts` (`flyingCheeps`), `src/game/entities/enemies/cheep.ts` (`FLY_GRAVITY`, `update`), the `cheeps` lines in `src/content/levels/`.
