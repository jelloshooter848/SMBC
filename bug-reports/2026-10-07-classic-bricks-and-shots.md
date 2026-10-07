# Classic SMBC block rules: only big Mario and Luigi break bricks with their heads, weapons break bricks (125 HP) and open blocks from the side, many shots pass through solid ground

- **Severity:** feature request (Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=<id>` (once the toggle exists; today `?dev=1&level=1-1&char=<id>` shows the Current behaviour)
- **Character and power:** all heroes (Mario, Luigi, Link, Samus, Simon, Mega Man, Bill, Ryu), all power states
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=samus` (Current). Jump under the brick at column 20, row 9: small Samus's head breaks it.
   Shoot the brick at column 22 from the side: the beam stops and the brick stays.
2. Open `?dev=1&level=1-1&char=megaman` (Current). Stand left of the `?` block at column 16 and shoot it: nothing
   happens. Shoot through the first pipe (column 28): the shot stops at the pipe.
3. Open `?dev=1&rules=classic&level=1-1&char=samus` (Classic, once built). Jump under the brick at column 20: it only
   bumps. Jump and shoot it from the side: one beam breaks it (50 points).
4. Open `?dev=1&rules=classic&level=1-1&char=megaman`. Jump and shoot the `?` block at column 16 from the side: the coin
   pops out of its top. Shoot the brick at column 20 twice: the 1st shot does nothing visible, the 2nd breaks it.
5. In the same run, shoot along the ground at the first pipe: the shot flies through it and hits the Goomba beyond.
6. Open `?dev=1&rules=classic&level=1-1&char=simon`. Whip the brick at column 22 from below-side: it breaks in one hit.
   Break bricks until a heart drops (about 1 brick in 16).

## Expected

All of this is one shared system that runs only while `world.rules === 'classic'`. Units: px, px/frame (px/f) and
frames at 60 fps; 1 tile = 16 px; ms ÷ 16.67 = frames. Damage is in the original's units (HP report). "The original" is
SMBC 3.1.21 with default settings and no cheats ("Always Break Bricks" is off).

### Where it lives

- **BR-C1 One door for blocks.** `World.strikeBlock` (`world/world.ts:1110-1155`) stays the only place a block reacts
  (TG-25). In Classic it gets an optional `damage?: number` and a `source: 'head' | 'melee' | 'shot' | 'blast'`.
  Plain-brick HP lives in a per-level map in the world, keyed `"tx,ty"`, default 125, cleared when a level or area
  loads.
- **BR-C2 One spec flag for shots.** Classic weapon specs carry an optional `classicBlocks` field read in
  `Projectile.update`'s tile block (`entities/projectiles/projectile.ts:237-277`, TG-26):
  - `ground: 'pass' | 'collide' | 'none'`: `'pass'` ignores every solid tile that is not a block, but still hits bricks,
    `?` blocks, brick item blocks and hidden blocks; `'collide'` stops at (or bounces on) every solid tile; `'none'`
    touches no tile at all.
  - `afterBlock: 'end' | 'continue' | 'continueIfBroken'` (BR-C9).
  - `strikesBlocks: boolean` (false for Mario's fireball).
  Current specs don't set it, so Current shots are unchanged.

### Heads

- **BR-C3 Only big Mario and Luigi break bricks with their heads.** `canBreakBricks` in the Classic defs:
  - Mario and Luigi: true with the Mushroom or the Flower, false when small (`MarioBase.changeBrickState`,
    `MarioBase.as:935-941`). This is today's rule.
  - Link, Samus, Simon, Mega Man, Bill, Ryu: **false in every power state** (`Character.brickState = BRICK_BOUNCER`,
    `Character.as:344`; `MegaManBase.as:2015-2020`; `Samus.as:1394-1400`). Their heads bump bricks and open `?` blocks.
  - No head reaction at all (the block is solid but does not bump): Samus in the morph ball (`Samus.as:1394-1397`) and
    Ryu while clinging to a wall (`Ryu.as:1250`). This is `BRICK_NONE`: `Brick.hitCharacter` ignores them
    (`Brick.as:199`), and a hidden block does not even stop them from below (`Character.groundAbove`,
    `Character.as:1466`).
  - (Mega Man's Cut Man skin breaks bricks with his head. Skins are out of scope.)
- **BR-C4 A head bump leaves the brick at 0 HP.** The bounce sets its HP to 0 (`Brick.startBounce`, `Brick.as:367-378`),
  so the next weapon hit of any strength breaks it (one Mega Buster shot instead of two).
- **BR-C5 What a bump does** stays as today (`strikeBlock`): the brick hops, the `bump` sound plays, enemies standing on
  it are hit from below, coins on it fly off, and `?`/item blocks give their item.

### Weapons against bricks and blocks

- **BR-C6 Melee breaks a plain brick in one hit, whatever its damage**, and bumps any item block
  (`Brick.hitByAttack`, `Brick.as:211-222`; reached through `HitTester.groundHitTest`, `HitTester.as:155-164`, whenever
  the attack box overlaps a block that is not used up). Each block is struck at most once per swing. This covers
  every sword pose (Link's stabs and both thrusts, Ryu's slashes), Simon's whip at every level, and Ryu's Jump Slash
  for the bricks his body touches (`Ryu.as:712-718`). A Link down-thrust that breaks a brick still bounces him
  (`Link.as:1124-1138`).
- **BR-C7 A shot on a plain brick** subtracts its damage from the brick's HP (`Brick.confirmedHitProj` and
  `takeDamage`, `Brick.as:181-192, 223-228`):
  - At 0 or less the brick breaks: 4 pieces, the `break` sound, 50 points (`ScoreValue.BREAK_BRICK`), and whatever
    stands on it is hit from below (`Brick.breakBrick`, `:242-294`). Use the existing break code in `strikeBlock`.
  - A hit that leaves HP above 0 is **silent**: no hop, no sound, no particle. Only a 100-damage shot can do this
    (Mega Buster, Bill's rifle and Laser); the 2nd such shot breaks it.
- **BR-C8 A shot on any item block** (`?` block, brick with a coin, coins, star, Mushroom, 1-up, vine or poison
  Mushroom) **bumps it, whatever its damage** (`Brick.confirmedHitProj`, `:185-186`; `ItemBlock.breakBrick` calls
  `bounce`, `ItemBlock.as:88-91`). The block reacts exactly as to a head bump (BR-C5, BR-C12).
- **BR-C9 What happens to the shot** after it hits a block (`Projectile.confirmedHit`, `Projectile.as:135-147`):
  - `'end'`: an ordinary shot is removed on any block it hits, broken or not.
  - `'continueIfBroken'`: a "through kills" shot (the original's `PASSTHROUGH_DEFEAT`) keeps flying when the brick's HP
    is now 0 or less. A bumped item block also counts: its HP is set to 0 when it bumps (`Brick.bounce`,
    `Brick.as:304-305`). So these shots open a `?` block **and fly on**. A plain brick that survives the hit stops
    them (none of these shots does less than 125, so in practice they always fly on).
  - `'continue'`: a shot that passes through everything (`PASSTHROUGH_ALWAYS`) keeps flying after every block, and
    strikes each block it overlaps once per contact.
  - A used block (already emptied) is plain solid ground from then on (`Brick.bounce` turns its hit type into
    `HT_GROUND_NON_BRICK`, `Brick.as:357-359`): `'pass'` shots go through it and `'collide'` shots stop at it.
- **BR-C10 Multi-coin bricks** (`coins10`): each weapon strike gives one coin, under the existing 15-coin / 360-frame
  rule (`Brick.as:79, 317-347`). One coin per swing for melee; one per shot; a "through kills" shot gives only one coin
  per shot (`Brick.hitProj`, `:178`).
- **BR-C11 Hidden blocks.** Shots and melee also strike hidden blocks (coin, 1-up, Mushroom, poison, vine): the block
  appears and gives its item, as from a head bump. Neither `Brick.hitProj` nor `HitTester.groundHitTest` checks
  visibility, and `ItemBlock.bounce` makes the block visible (`ItemBlock.as:93-99`). Mario's fireball is the exception:
  it ignores invisible ground (`MarioFireBall.as:90-91`). Our own `hidden-teleporter` keeps today's behaviour. Current
  skips hidden blocks for shots (`world.ts:641, 650`).
- **BR-C12 Where items and coins appear when a block is hit from the side or from range: exactly as for a head
  bump.** Mushrooms, Flowers, Stars, 1-ups, poison Mushrooms and vines rise out of the **top** of the block
  (`Pickup.exitBrickStart`, `Pickup.as:93-108`) and then move **right**, whatever side was hit (`Mushroom.exitBrickEnd`,
  `Mushroom.as:98-103`; `Star.as:41-46`). A coin flies up from the block's top and is collected at once
  (`FlyingCoin.getFlyingCoinInfo`, `FlyingCoin.as:86-95`). The block hops. Enemies and coins on top of it are bumped.
  Our `strikeBlock` already does all of this; a side hit just calls it.

### The exceptions

- **BR-C13**
  - **Mario's and Luigi's fireball** never breaks or bumps a block (`doesntHitBricks`, `MarioFireBall.as:39`). Bricks and
    blocks are solid to it like any ground: it bounces on their tops and explodes against their sides and bottoms
    with the `bump` sound (`:88-99`). As today.
  - **Link's boomerang** touches no tile at all: it flies through bricks, blocks and ground alike
    (`removeAllHitTestableItems`, `LinkBoomerang.as:68-70`).
  - **Link's bombs do break bricks.** The blast strikes every brick and block it overlaps, including the one the bomb
    rests on: 800 damage breaks a brick, and item blocks are bumped (`LinkProjectile.as:138-158`;
    `Projectile.hitGround`, `Projectile.as:98-104`). Before it explodes, the bomb rests on bricks and ground like
    solid floor and does not touch them (`LinkProjectile.as:87-96`).
  - **Samus's bombs** take the same path: from the moment one is placed it strikes, once, any brick or block it
    overlaps (400 damage) (`SamusBomb.as:45`).
  - Out of scope (skins and missing heroes; see `2026-10-07-classic-follow-ups.md`): Mega Man's **Cut Man** skin, whose
    shots pass through bricks without touching them (`Brick.as:174-177`); the **Bass Buster**, which collides with
    non-brick ground; Sophia's Homing Missile.

### Per-hero table

- **BR-C14 Every hero's weapons against blocks.** "Brick" is a plain brick at full HP (125). "Hits" is how many of
  that weapon break it (1 if the brick was head-bumped first, BR-C4). "Item block" means `?` blocks, brick item blocks,
  coin bricks and hidden blocks. "Ground" is every other solid tile: floor, pipes, hard blocks, used blocks, castle
  walls.

  | Hero | Weapon (dmg) | Brick | Hits | Item block | Ground (BR-C16) | After a block (BR-C9) |
  |---|---|---|---|---|---|---|
  | Mario, Luigi | head, big | breaks | 1 | bumps | — | — |
  | Mario, Luigi | head, small | bumps | — | bumps | — | — |
  | Mario, Luigi | fireball (1000) | **ignores** (solid) | — | **ignores** (solid) | collides, bounces | bounces or explodes |
  | Link | head | bumps | — | bumps | — | — |
  | Link | sword, every pose and thrust (200/275/400) | breaks | 1 | bumps | — | swing goes on |
  | Link | sword beam (200), Flower | breaks | 1 | bumps | **passes** | ends (4-way burst) |
  | Link | arrow (350), option | breaks | 1 | bumps | **passes** | ends |
  | Link | bomb blast (800) | breaks | 1 | bumps | stays put | — |
  | Link | boomerang (0) | **ignores** | — | **ignores** | **ignores** | flies on |
  | Samus | head | bumps | — | bumps | — | — |
  | Samus | Short / Long Beam (150) | breaks | 1 | bumps | collides | ends |
  | Samus | Ice Beam (125), option | breaks | 1 | bumps | collides | ends |
  | Samus | Wave Beam (225), Flower | breaks | 1 | bumps | **passes** | ends |
  | Samus | missile (400), any direction | breaks | 1 | bumps | collides | ends |
  | Samus | bomb (400) | breaks | 1 | bumps | stays put | — |
  | Samus | Screw Attack | ignores | — | ignores | — | — |
  | Simon | head | bumps | — | bumps | — | — |
  | Simon | whip, every level (200/275/400) | breaks | 1 | bumps | — | swing goes on |
  | Simon | Axe (350) / Cross (300) | breaks | 1 | bumps | **passes** | **continues** |
  | Simon | Dagger (300), option | breaks | 1 | bumps | **passes** | ends |
  | Simon | Holy Water bottle, option | breaks (bursts into a 200 flame on it) | 1 | bumps | collides, bursts | becomes the flame |
  | Simon | Holy Water flame (200), option | breaks | 1 | bumps | **passes** (stays put) | stays; re-strikes every 24 f |
  | Mega Man | head | bumps | — | bumps | — | — |
  | Mega Man | Mega Buster (100) | breaks | **2** | bumps | **passes** | ends |
  | Mega Man | weak Charge Shot (200), Mushroom | breaks | 1 | bumps | **passes** | ends |
  | Mega Man | full Charge Shot (300), Mushroom | breaks | 1 | bumps | **passes** | **continues if broken** |
  | Mega Man | Metal Blade (150), Flower | breaks | 1 | bumps | **passes** | **continues if broken** |
  | Bill | head | bumps | — | bumps | — | — |
  | Bill | rifle (100) | breaks | **2** | bumps | **passes** | ends (bursts) |
  | Bill | Machine Gun (125), Mushroom | breaks | 1 | bumps | **passes** | ends (bursts) |
  | Bill | Spread (125 each), Flower | breaks | 1 | bumps | **passes** | each bullet ends |
  | Bill | Flare (200) / Laser (100 per segment), option | breaks | 1 / 2 | bumps | **passes** | ends |
  | Ryu | head (on a wall: nothing) | bumps | — | bumps | — | — |
  | Ryu | sword (400) | breaks | 1 | bumps | — | swing goes on |
  | Ryu | Jump Slash (800) | breaks | 1 | bumps | — | goes on |
  | Ryu | Shuriken (300) | breaks | 1 | bumps | **passes** | ends |
  | Ryu | Windmill Shuriken (300), Flower | breaks | 1 | bumps | **passes** | **continues** |
  | Ryu | Fire Wheel / Fire Dragon Ball (400), option | breaks | 1 | bumps | **passes** | **continues if broken** |

  Source per row: `MarioFireBall.as:38-53, 88-99`; `Link.as:1117-1164`, `LinkProjectile.as:64-111, 138-158`,
  `LinkBoomerang.as:61-70`; `SamusShot.as:82-88, 104-175, 261-291`, `SamusBomb.as:37-63`;
  `SimonProjectile.as:70-131, 167-182, 243-248`; `MegaManProjectile.as:419-507, 852-891, 1003-1012`;
  `BillBullet.as:151-244, 561-565`; `RyuProjectile.as:116-166, 322-345, 397-401`, `Ryu.as:705-718`; melee through
  `HitTester.as:155-164` and `Brick.hitByAttack`. The hero reports own each weapon's speed, size and timing.

### Shots through solid ground

- **BR-C15 Why they pass.** In the original a player shot only tests the tiles it is told to. The base class tests
  bricks and enemies only (`Projectile.as:39-45`). A shot collides with other ground only if it adds that test
  (`addAllGroundToHitTestables`, `LevObj.as:401-406`, or `HT_GROUND_NON_BRICK`).
- **BR-C16 The list.**
  - **Pass through ground and pipes, but still strike blocks:** Mega Buster and both Charge Shots, Metal Blade, all of
    Bill's guns, Ryu's Shuriken, Windmill, Fire Wheel and Fire Dragon Ball, Simon's Axe, Cross and **Dagger**, Holy
    Water's flame, Samus's **Wave Beam**, Link's **sword beam** and **arrows**. They also pass through lifts.
  - **Collide with ground:** Mario's fireball (bounces, and lands on lifts), Samus's Short, Long and Ice Beams and her
    missiles (they burst on any solid tile or lift, `SamusShot.as:82-85, 286-291`), and Simon's Holy Water bottle
    (it bursts into the flame). The Bass Buster collides too (out of scope).
  - **Touch nothing:** Link's boomerang.
  - **Blasts that stay put:** Link's and Samus's bombs.
  - The Dagger, sword beam and arrows are not in FINAL-REPORT C4's list. They add no ground test in source, so they pass.
- **BR-C17 A brick inside a wall.** A ground-passing shot that meets a brick in a wall of ground strikes the brick as
  usual. With `'end'` it stops there (a Mega Buster shot breaks a brick wall one brick per 2 shots); with `'continue'`
  it breaks every brick in its path. Ryu clinging to a brick that breaks follows the Ryu report (RY-C16).

### Drops from bricks and coin blocks

- **BR-C18 Ammo drops from blocks** (`Brick.breakBrick`, `Brick.as:259-260`; `Brick.bounce`, `:319-320, 353-354`;
  `RandomDropGenerator.checkDropItem`, `RandomDropGenerator.as:40-85`). The base rate is 25 % per enemy kill
  (`Character.dropRate`, `Character.as:391`; Item Drop Rate Normal adds 0).
  - A **plain brick** that breaks rolls at 25 % × 0.25 = **6.25 %**, for Link, Samus, Simon and Ryu
    (`_canGetAmmoFromBricks`: `Link.as:339`, `Samus.as:309`, `Simon.as:300`, `Ryu.as:307`).
  - Each **coin** a block gives (`?` coin block, coin brick, each coin of a multi-coin brick) rolls at
    25 % × 0.5 = **12.5 %**, for Simon and Ryu only (`_canGetAmmoFromCoinBlocks`, `Simon.as:299`, `Ryu.as:306`). Blocks
    that hold a Mushroom, Star, 1-up or vine roll nothing.
  - Mario, Luigi, Mega Man and Bill get nothing from blocks.
  - It does not matter what broke or bumped the block (head, whip, shot, bomb).
  - **What drops:** Simon: a small heart (+1) 80 % of the time, a big heart (+5) 20 % (`Simon.as:103, 1118-1127`).
    Ryu: small ninpo 80 %, big ninpo 20 % (`Ryu.as:98`). Link and Samus: their ammo table (bombs or arrows; missiles),
    as in `2026-10-07-classic-power-states.md`. A table that is empty right now (for example Samus before she owns
    missiles) drops nothing.
  - **Where:** the drop appears at the block's centre (`Pickup.appearFromObject`, `Pickup.as:117-135`) and falls to
    the ground. It turns 65 % opaque after 4000 ms (240 f) and vanishes 3000 ms (180 f) later
    (`Pickup.as:46-48, 153-165`).
  - Current has no block drops; health drops stay absent in Classic (decided).

### Feel

- **BR-C19** Gun heroes open `?` blocks from a distance and through the floor; a brick wall gives way to two buster
  shots per brick, or one swipe of a sword or whip. Heads no longer clear a path except for big Mario and Luigi. Keep
  the silent first hit on a brick (BR-C7): it is how the original feels.

## Actual

Current (stays the default, unchanged):

- Heads: Samus, Simon, Ryu and Bill always break bricks, even small; Mega Man does once he has the helmet; Link
  bumps; Mario and Luigi break when big (`canBreakBricks`: `samus/index.ts:176`, `simon/index.ts:151`,
  `ryu/index.ts:170`, `bill/index.ts:133`, `megaman/index.ts:232`, `link/index.ts:230`, `mario/index.ts:161`,
  `luigi/index.ts:24`; `world.ts:1105-1107`).
- Weapons: bricks have no HP. A shot with `breaksBricks` breaks a brick outright on a wall hit (`projectile.ts:237-243`,
  `world.ts:646-653`); most specs don't set it, so most shots stop on any tile and leave blocks alone. Blasts break
  every block they cover (`world.ts:638-642`). Link's up-thrust strikes blocks (`link/index.ts:295`). Hidden blocks are
  skipped by shots and blasts (`world.ts:641, 650`).
- Ground: shots with `hitsTiles` stop at every solid tile; a few specs use `piercesTiles` and then ignore every tile,
  bricks included (`projectile.ts:262-277`).
- Blocks drop nothing.

## How often

every time

## Notes

- **Sources.**
  - Original: `com/smbc/ground/Brick.as` (`hitProj` 174-180, `confirmedHitProj` 181-192, `hitCharacter` 193-209,
    `hitByAttack` 211-222, `takeDamage` 223-228, `hitCharacterBounceOrBreak` 229-236, `breakBrick` 242-294, `bounce`
    295-366, `startBounce` 367-378, `addObj` 387-454), `ground/ItemBlock.as:36-99`, `data/HealthValue.as:30`,
    `data/HitTester.as:155-192`, `projectiles/Projectile.as:30-151`, the projectile classes named in BR-C14,
    `characters/Character.as:87-89, 344, 391, 1466, 3258-3268`, `characters/base/MarioBase.as:935-941`,
    `level/Level.as:1906-1929` (bumps and breaks are applied once per frame), `pickups/Pickup.as:46-48, 93-165`,
    `pickups/Mushroom.as:98-103`, `projectiles/FlyingCoin.as:86-95`, `data/RandomDropGenerator.as:28-85`.
  - Ours: `src/game/world/world.ts:620-653, 1105-1155`, `src/game/entities/projectiles/projectile.ts:10-56, 237-277`,
    `src/game/level/tiles.ts:29-111`, the `canBreakBricks` lines above.
- **Implementation hints.**
  - Brick HP: `world.brickHp: Map<string, number>`. `strikeBlock(tx, ty, p, breakBricks, { damage, source })`: in Classic,
    for a plain brick with `source !== 'head'`, melee breaks at once, shots and blasts subtract `damage`; a head bump
    that doesn't break sets the entry to 0. Return `{ broken, bumped, hp }` so the projectile can apply `afterBlock`.
  - Ground-passing shots: in the `'pass'` branch, move freely like `piercesTiles` today, then check the tiles under the
    shot's box each frame and call `strikeBlock` for each block tile (bricks, item blocks, hidden blocks) not struck
    during the current contact. Remember the struck tiles in a set on the projectile and clear a tile once the shot
    has left it.
  - Melee: give `World` one Classic helper that strikes every block tile the active melee box overlaps, once per swing
    (reuse the `p.scratch` "hit" keys pattern of `world.ts:1264-1276`).
  - Drops: Classic defs implement `drop` for kills (power-states report); add an optional
    `CharacterDef.blockDrop?(rng, kind: 'brick' | 'coin')` called from `strikeBlock`.
- **Acceptance checks** (headless, `rules: 'classic'`):
  - Every non-Mario hero, small and with the Flower: a jump into the brick at 1-1 column 20 leaves it in the map
    (bumped); big Mario breaks it.
  - Mega Buster: brick HP 125 → 25 after one shot, no sound event; broken by the 2nd. After a head bump, one shot breaks it.
  - Mega Buster fired level along row 12 of 1-1 from column 25: the shot reaches past the pipe at column 28.
  - Samus Short Beam fired the same way: removed at the pipe. Wave Beam: passes.
  - Simon's Axe thrown through a row of 3 bricks: all 3 break and the Axe is still alive.
  - Metal Blade at a `?` block: the block gives its coin and the blade is still alive one frame later.
  - Link's boomerang through a brick: the brick is unchanged.
  - Mario's fireball against a brick's side: it explodes; the brick is unchanged.
  - Shooting a hidden 1-up block in 1-1 (column 64) from the side reveals it and a 1-up rises from its top.
  - 10 000 bricks broken by Simon with a fixed seed: about 6.25 % drop a heart, about 1 in 5 of those big.
  - Current: the same scripts without `rules` give today's results (existing tests unchanged).
- **Confidence.** Source only; none of this was played in the original. These follow from the code paths but were not
  confirmed by the earlier fact-check: the silent first hit (BR-C7), shots and melee revealing hidden blocks
  (BR-C11), Samus's bomb striking at once (BR-C13), and the Dagger, sword beam and arrows passing through ground
  (BR-C16). The consistency pass confirmed BR-C9 from source:
  `Brick.confirmedHitProj` bumps the item block first (`Brick.bounce` sets its HP to 0, `Brick.as:304-305`), then
  `Projectile.confirmedHit` keeps a `PASSTHROUGH_DEFEAT` shot alive because HP ≤ 0 (`Projectile.as:144`); the full
  Charge Shot, Metal Blade, Fire Wheel and Fire Dragon Ball carry that flag (`MegaManProjectile.as:209, 747`;
  `RyuProjectile.as:119, 130`).
- **Open questions.**
  1. Hidden blocks opened by shots (BR-C11) could make hidden 1-ups easy to find with a gun. Default: build it as the
     source says.
  2. A kicked Koopa shell breaks a plain brick it hits from the side in the original (`KoopaGreen.hitGround`,
     `KoopaGreen.as:513-521`); ours doesn't. It affects every hero, so it is left for the follow-up report. Default:
     unchanged.
  3. Bill's Laser is four segments; whether each segment strikes a brick separately is in the Bill report. Default:
     each segment is a shot (2 segments break a brick).
- **Related reports.** `2026-10-07-dev-classic-smbc-rules-toggle.md` (TG-25 and TG-26 place this code),
  `2026-10-07-classic-enemy-hp-and-armour.md` (damage values; what a shot does to an enemy before or after a block),
  `2026-10-07-classic-power-states.md` (ammo drop tables), every hero report (BR-C14 rows), and
  `2026-10-07-classic-follow-ups.md` (Cut Man, Bass, Sophia, cheats). Existing open reports nearby:
  `2026-10-05-1-1-multi-coin-brick-too-few-coins.md`, `2026-10-06-mushroom-not-bumped-by-block-below.md`.
