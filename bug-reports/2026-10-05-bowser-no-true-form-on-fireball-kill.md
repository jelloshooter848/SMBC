# Bowser killed with fireballs falls as plain Bowser; the original switches to a per-world death frame (die_1 to die_8)

- **Severity:** cosmetic
- **Build:** V0.1.0-B8379F9
- **Where:** 5-4, Bowser at column 136 on the bridge (columns 128 to 140); the same code runs in every castle with a Bowser (1-4 to 8-4)
- **How to get there:** Dev Mode > Level Select: Level 5-4, Character Mario, Power Fire, Start. Then cross the castle to the bridge at column 128.
- **Character and power:** Mario, fire
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Start 5-4 as fire Mario from the Dev level select.
2. Reach Bowser on the bridge and hit him with 5 fireballs (do not touch the axe).
3. Watch how he dies.

## Expected

The original has two different Bowser deaths:
- **Fireballs (or other attacks):** `com/smbc/enemies/Bowser.as` `die()` (lines 454-462) runs `Enemy.die`, which turns him upside down (`scaleY = -1`) and pops him up, then sets the stop frame `FL_DIE + level.worldNum` (`FL_DIE = "die_"`, line 59) and `vx = 0`, so he falls straight down showing that world's `die_N` frame: `die_5` in 5-4.
- **Axe:** the axe never calls `die()`. `BowserAxe.as` calls `breakBridgeStart()`, `breakBridgeInc()` and `breakBridgeEnd()` (`Bowser.as` lines 392-415), and Bowser shows his own `fallStart`/`fallEnd` frames as the bridge falls away.

The Bowser movie clip in the game file (`scratchpad/flash/smbc3.swf`, `com.smbc.data.MovieClipInfo_BowserMc`, sprite 213) has one labelled death frame per world, `die_1` to `die_8`, after `walkStart` … `fallEnd` and `close`/`open`. Because the frame is chosen by world number, each castle has its own fireball death frame.

**Assumption, not verified:** the frames' artwork is placed by skin-swapping code, so nobody has seen what each `die_N` shows. That they show the NES "true forms" (world 1 Goomba, 2 Koopa, 3 Buzzy Beetle, 4 Spiny, 5 Lakitu, 6 Blooper, 7 Hammer Bro, 8 the real Bowser) is the NES behaviour, assumed here. What is verified is only that the original switches to a separate, per-world frame.

## Actual

Ours has one look for a dead Bowser.
- `Bowser` (`src/game/entities/enemies/bowser.ts` lines 38 and 44) has `hp = 5` and takes `fireball: 'hp'`.
- On the fifth hit, `Enemy.hit` (`src/game/entities/enemies/enemy.ts` lines 92-97, `case 'hp'`) calls `flipOut`, which spawns a `Corpse` with `this.currentFrame` (lines 154-172), the normal Bowser frame (`bowser-0` to `bowser-3`, `src/content/sprites/enemies.ts` lines 744-747).
- The `Corpse` (`src/game/entities/effects/effects.ts` lines 158-200) hops up, drifts sideways at 1 px per frame and falls off the screen. It only draws an upside-down frame if a `<frame>-flip` frame exists, and there is none for Bowser, so he falls upright.
- Nothing in our code picks a frame by world number: there is no `die_`, true-form or per-world frame in `bowser.ts`, `enemy.ts` or `world.ts`.
- The axe route (`src/game/world/world.ts` lines 1408-1411, `bowser.fallDead()` at `c.t === 60`) also uses the plain Bowser frame. The original's axe fall also uses ordinary Bowser frames (`fallStart`/`fallEnd`), so the axe route is not part of this bug.

So in every castle a fireball kill shows plain Bowser, where the original shows that world's `die_N` frame, upside down and falling straight down.

## How often

every time (by code; see Notes)

## Notes

- Found by reading the code of both games and the original's SWF frame labels. Not seen in either game: the tester twice failed to reach our Bowser with fire power (a fire bar at column 22 took it), and the original's 5-4 does not load in Ruffle.
- Severity changed from "wrong behaviour" to "cosmetic" by the reviewer: only the death sprite differs, and Bowser is dead either way.
- `die_1` to `die_8` cover worlds 1 to 8 only. What the Lost Levels' worlds 9 to 13 show (there is no `die_9`) is not checked.
- The reviewer added the original's upside-down, straight-down fall (`Enemy.die` `scaleY = -1`, then `vx = 0` in `Bowser.die`) and corrected the tester's "flipped upside down" for ours: our corpse is drawn upright.
- Related: `2026-10-05-bowser-axe-awards-5000-points.md` (the axe route).
- Source: `smb-w5/2026-10-05-bowser-no-true-form-on-fireball-kill.md`.
- Reviewed: verified against `com/smbc/enemies/Bowser.as` (`FL_DIE`, `die`, `breakBridgeStart/Inc/End`), `com/smbc/enemies/Enemy.as` (`die`), the SWF frame labels of sprite 213 (`gauntlet/notes/swflabels.py`), and ours: `src/game/entities/enemies/bowser.ts`, `src/game/entities/enemies/enemy.ts` (`hit`, `flipOut`), `src/game/entities/effects/effects.ts` (`Corpse`), `src/game/world/world.ts`.

Status: fixed — a fireball (or other hit-point) kill now drops Bowser straight down (vx 0), upside down, showing a per-world `bowser-die-N` frame (Bowser.as `die`, `FL_DIE + level.worldNum`): new 32x32 frames built from our own enemy art (worlds 1-7: toadstool, turtle, steel beetle, spiked crawler, cloud rider, squid, hammer-thrower; world 8 and the Lost Levels' worlds 9-13, which have no `die_N` frame, the king himself).
