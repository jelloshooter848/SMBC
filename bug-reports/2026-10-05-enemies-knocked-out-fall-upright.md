# Enemies knocked out by fireballs, stars, shells or block bumps fall upright instead of upside down

- **Severity:** cosmetic
- **Build:** V0.1.0-B8379F9
- **Where:** every level; any enemy killed by a fireball, star, kicked shell or block bump (not a stomp)
- **How to get there:** `?level=1-1&char=mario`, then take the fire flower from the ? block at column 78 while big, or the star from the brick at column 101
- **Character and power:** Mario, fire or star
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Get fire power or a star in 1-1.
2. Kill a Goomba with a fireball, or run into it with the star.
3. Watch the defeated Goomba fall off the screen.

## Expected

As in the original, the defeated enemy turns upside down while it pops up and falls off the screen. `com/smbc/enemies/Enemy.as` `die()` sets `scaleY = -1` along with the pop-up (`vy = -DIE_BOOST_Y`) and sideways boost (`vx = ±DIE_BOOST_X`, or 0 in water levels). In the 1-1 comparison playthrough of the original, Goombas killed by the star "flip upside-down and fall through the floor".

## Actual

The enemy pops up and falls, but stays upright.

- `Enemy.flipOut` in `src/game/entities/enemies/enemy.ts` (documented as "Knocked off the screen upside down") spawns a `Corpse` with `flipV = true` and `mirrorY = this.corpseFlipY`.
- `Corpse.render` in `src/game/entities/effects/effects.ts` only draws upside down when the sprite sheet has a `<frame>-flip` frame, and no sprite in `src/content/sprites` defines one.
- `corpseFlipY` defaults to `false` and is only set by the hanging Piranha Plant (`src/game/entities/enemies/piranha.ts`).
- So every other corpse is drawn upright, although `Renderer.sprite` already supports `flipY` (`src/engine/gfx/renderer.ts`).

## How often

every time

## Notes

- Found by the smb-w5 reviewer reading the code; confirmed by the orchestrator in both codebases.
- Not seen in our game: a quick 1-1 attempt failed because `&kit=full` does not give Mario fire power.
- A fix probably belongs in `Corpse.render`, using the renderer's `flipY` when no `-flip` frame exists. Take care with the hanging Piranha Plant, which already uses `mirrorY`.
- Also worth checking against the original: water-level corpses get no sideways boost there (`vx = 0`).
- Reviewed: verified against `com/smbc/enemies/Enemy.as` (`die`), and ours: `src/game/entities/enemies/enemy.ts` (`flipOut`, `corpseFlipY`), `src/game/entities/effects/effects.ts` (`Corpse.render`), `src/game/entities/enemies/piranha.ts`, `src/engine/gfx/renderer.ts`.
