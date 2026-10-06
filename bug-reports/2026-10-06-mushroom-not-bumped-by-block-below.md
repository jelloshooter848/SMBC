# A mushroom on a block doesn't react when the block is bumped from below

- **Severity:** wrong behaviour
- **Build:** V0.4.1
- **Where:** any ? block or brick with a mushroom on it, for example the first mushroom block in 1-1 (column 21) before the mushroom walks off it
- **How to get there:** `?level=1-1&char=mario`, knock the mushroom out of the block at column 21, then jump into the block again while the mushroom is still on it (or on any brick it walks over)
- **Character and power:** any hero that can bump blocks (reported with Mario, small)
- **Input:** keyboard
- **Browser and device:** reported by the owner

## Steps

1. Knock a mushroom (red, 1-up or poison) out of a block, or let one walk onto a brick.
2. While it stands on the block, bump that block from below (head bump, Link's up-thrust, or big Mario breaking the brick).

## Expected

The mushroom pops up, as in the original (`com/smbc/pickups/Mushroom.as` `gBounceHit`, called from `Brick.hitObjectsAbove` on every bounce and when a brick breaks):

- `vy = -BOUNCE_AMT` (350 px/s = 2.92 px/frame), so it rises about 20 px;
- `gravity = BOUNCE_GRAVITY` (1500 px/s² = 0.208 px/frame²) until it lands (`groundBelow` puts `FALL_GRAVITY` back);
- `if (nx < g.hMidX) vx = -vx`: it turns round when it was left of the block's middle, and keeps its way when right of it.

A coin standing on the bumped block is collected (`Coin.gBounceHit`: a FlyingCoin, a coin and 200 points). Star and FireFlower have no `gBounceHit`, so they ignore the bump.

## Actual

Nothing happens: the mushroom keeps walking along the block. A coin on the block also stays.

## How often

every time

## Notes

- Root cause: `World.strikeBlock` found the item and set `vy = -0x03000`, but left `body.onGround` set. `Entity.fall` moves a grounded body by `max(velToSub(vy), 1)`, i.e. one subpixel down onto the block, which grounds it again and zeroes `vy`. The pop only showed when the brick broke (no ground left to snap to). Enemies were not affected: `Enemy.bumpPop` already clears `onGround`. It also set `vy` on stars, flowers and clocks, which the original leaves alone.
- Coins are map tiles here, and `strikeBlock` never looked at the tile above the block.

Status: fixed — `PowerUp.bounceHit` ports Mushroom.gBounceHit for the red, 1-up and poison mushrooms (vy −0x02eab, clears onGround, gravity 0x00355 until it lands, turns round when left of the block's middle); stars, flowers and clocks ignore the bump; a coin tile on the bumped block is collected as a coin pop (a coin and 200 points). Covered by `tests/sim/mushroom-bump.test.ts`.
