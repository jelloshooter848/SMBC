# Touching the flagpole leaves every enemy and projectile frozen on screen; the original removes all on-screen enemies and projectiles at the touch

- **Severity:** cosmetic
- **Build:** V0.1.0-B8379F9
- **Where:** every flagpole. Seen in ll-7-1 (flag at column 202): Bullet Bills stayed frozen on screen through the flag sequence (ll-w7 tester).
- **How to get there:** `?level=ll-7-1&char=mario&dev=1`, reach the flagpole at column 202 with an enemy or a Bullet Bill on screen. Any flagpole with an enemy, a Bullet Bill, a hammer or a fireball on screen shows it.
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Reach a flagpole with an enemy or a projectile on screen, for example a Bullet Bill in flight.
2. Touch the pole and watch the screen during the slide, the walk to the castle and the time tally.

## Expected

At the touch, the original removes every enemy and every projectile near the screen:

- `EventManager.touchedFlagPole()` (`com/smbc/managers/EventManager.as` lines 275-288) calls `level.destroyAllEnemiesAndProjectilesOnScreen()` first, before the slide starts.
- That function (`com/smbc/level/Level.as` lines 3173-3181) calls `destroy()` on every object in `AO_STG_DCT` that `is Enemy || is Projectile`.
- `destroy()` (lines 3064-3072) hides the object and queues it for removal, with no score and no death animation.
- `AO_STG_DCT` holds the objects on the stage. An object joins it when it is added to the display list and leaves it when it is removed (`AnimatedObject.as` lines 104-112). `AnimatedObject.checkStgPos` (lines 503-516) keeps an object on stage while its x is within 2 tiles beyond either screen edge. Objects flagged `updateOffScreen` stay on stage once added.
- **Enemies** include Goombas, Koopas, Piranha Plants, Cheep Cheeps, Lakitu and Bullet Bills (`BulletBill extends Enemy`).
- **Projectiles** include hammers (`Hammer`), fire bars (`FireBar`), Podoboos (`LavaFireBall`), Bowser's flames (`BowserFireBall`) and the player's own fireballs (`MarioFireBall`). Player shots are kept in `PLAYER_PROJ_DCT`, but they are still `Projectile`s. Brick pieces, air bubbles and coins popping out of blocks (`BrickPiece`, `Bubble`, `FlyingCoin`) also extend `Projectile`, so they vanish too.
- Not removed: the spawners (`BulletBillSpawner`, `LakituSpawner` and `FlyingCheepSpawner` extend `EnemySpawner`, which extends `LevObj`), and pickups and coins.

## Actual

Nothing is removed. `World.startClear` (`src/game/world/world.ts` lines 1269-1289) freezes and places the players, scores the grab and starts the clear sequence. While `this.clear` is set, `World.update` (lines 516-519) only moves the score popups and runs `updateClear`. No other entity is updated, but `render` (lines 1469-1484) still draws every live entity. So enemies, Bullet Bills, hammers and fireballs hang still in mid-air through the slide, the walk and the tally, until the next level loads. The ll-w7 tester saw this with Bullet Bills in ll-7-1.

There is no gameplay effect: during the sequence, nothing checks contact between the player and enemies (`updateClear` touches only the player, the flag and the castle flag). The difference is what the player sees.

## How often

every time

## Notes

- Evidence: the original by reading its code only. Ours by reading the code, plus the ll-w7 tester's playtest note (`gauntlet/notes/ll-w7.md`, ll-7-1 section: "In ours the bullet bills freeze during the flag sequence"). The tester did not check the original. No screenshot of the frozen Bullet Bills was cited.
- Severity is cosmetic because the frozen objects cannot touch the player. If the coordinator counts any visible difference in a sequence as wrong behaviour, raise it.
- Related: the same "destroy nearby enemies" idea at the midpoint and on pipe arrivals is in `2026-10-05-enemies-not-cleared-on-respawn-or-pipe-exit.md`. That routine is different: within 6 tiles, enemies only. The flag clear is everything on stage, including projectiles. A fixer could share the helper with a filter.
- Related: `2026-10-05-flagpole-no-fireworks.md` (the same clear sequence).
- Raised by the orchestrator from the ll-w7 notes.
- Reviewed: verified against `com/smbc/managers/EventManager.as` (`touchedFlagPole`), `com/smbc/level/Level.as` (`destroyAllEnemiesAndProjectilesOnScreen`, `destroy`, `addObj`), `com/smbc/main/AnimatedObject.as` (`addedToStageHandler`, `removedLsr`, `checkStgPos`), the class headers of `BulletBill`, `Hammer`, `FireBar` and `EnemySpawner`, and ours: `src/game/world/world.ts` (`update`, `startClear`, `updateClear`, `render`).
