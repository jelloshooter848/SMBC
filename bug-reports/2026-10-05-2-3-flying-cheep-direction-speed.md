# 2-3: flying Cheep Cheeps always fly toward Mario at 0.25–0.75 px/frame; in the original they follow his walking direction at up to 2 px/frame

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 2-3, the `cheeps 9 173` zone (columns 9–181). Every other `cheeps` zone uses the same code (list in Notes).
- **How to get there:** `?level=2-3&char=mario`, then walk or run right along the bridges from column 16
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=2-3&char=mario` and walk right along the bridges, holding right.
2. Watch which way the leaping Cheep Cheeps travel and how fast.
3. Repeat while running (holding run).
4. Stop and stand still, and watch the fish that leap up to Mario's right.

## Expected

In `CheepFast.as` `calcFlyingStats()` (lines 169-218) and `FlyingCheepSpawner.as`:
- Sideways speed is random between `MIN_HORZ_FLY_SPEED = 50` and `MAX_HORZ_FLY_SPEED = 250` Flash px/s (lines 27-28, 181), which is 0.42–2.08 NES px/frame.
- Direction follows the player's movement (lines 183-203): if Mario is moving right, the fish fly right; if he is moving left, left. When he stands still, they head toward him (lines 204-213). If Mario moves faster than his walk speed (`MarioBase.MAX_WALK_SPEED = 175`), the fish use the full 250 so they keep pace with a running player.
- A fish may only fly left once Mario has not moved right for 2 s (`FlyingCheepSpawner.canReverseDirection`, `CAN_REVERSE_DIRECTION_DELAY = 2000`, lines 26-27, 63-67 and 86-93; applied in `CheepFast.as` lines 214-218). Until then, a fish that would fly left is turned to fly right. So while Mario walks right and for 2 s after he stops, every fish flies right, even one that leaps up ahead of him.
- Fish spawn only near the screen edges: a random screen x from 0 to 512 Flash px, re-rolled while it is within 120 Flash px of the centre (lines 171-177). That is NES x 0–68 or 188–256, never in the middle 120 px.
- At most 3 fish on NORMAL (`MAX_CHEEP_NORMAL`, line 18). Whenever fewer than 3 are out and no spawn is pending, the spawner waits a random 600–1050 ms (36–63 frames) and then spawns one (lines 58-61; the formula is `random × (600 − 150) + 600`).

## Actual

In `build/src/game/world/world.ts` `flyingCheeps()` (lines 712-729):
- Every fish flies toward the lead player (`x < lead.body.x ? 1 : -1`) at 0x00400 + rand(0x00800), which is 0.25–0.75 px/frame. A fish that spawns ahead of a walking Mario comes back at him instead of travelling with him, and no fish can keep up with a running Mario.
- Spawns can appear anywhere from 32 to 224 px across the screen, including right above Mario at the centre.
- The spawn timer is 24–63 frames (0.4–1.05 s) and is reset every time it runs out, even when 3 fish are already out, so a new fish can follow sooner after one leaves.

## How often

every time

## Notes

Found by reading code and data. In my playtest of the original, Mario stood still, which is the only case where both games aim the fish at the player, so I could not confirm the moving cases by screenshot. Related report: `2026-10-05-2-3-flying-cheep-leap-too-low.md`.
- Other levels with a `cheeps` zone in our maps, all spawned by the same `flyingCheeps()`: 7-3 (`cheeps 9 173`), 8-4 (two zones), ll-2-3, ll-6-3, ll-7-1, ll-10-3, ll-12-2 and ll-13-4.
- Source: `smb-w2/2026-10-05-2-3-flying-cheep-direction-speed.md`. The reviewer added the 2-second "no flying left" rule (`canReverseDirection`), which the tester's report left out, the spawn x range in NES px, and the level list.
- Reviewed: verified against `com/smbc/enemies/CheepFast.as` (`calcFlyingStats`, `MIN_HORZ_FLY_SPEED`, `MAX_HORZ_FLY_SPEED`), `com/smbc/level/FlyingCheepSpawner.as` (`updateSpawner`, `canReverseDirection`, `MAX_CHEEP_NORMAL`, spawn delay), `com/smbc/characters/base/MarioBase.as` (`MAX_WALK_SPEED`), `com/smbc/data/ScreenSize.as` (512 × 480), and ours: `src/game/world/world.ts` (`flyingCheeps`).
