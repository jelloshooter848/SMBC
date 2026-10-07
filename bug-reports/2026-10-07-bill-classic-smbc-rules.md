# Classic SMBC rules for Bill: two-gun power states, slow bullets that pass through ground but hit blocks, instant 1.25 px/f walking, and the original muzzle points

- **Severity:** feature request (Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=bill` (once the toggle exists; today `?dev=1&level=1-1&char=bill` shows the Current behaviour)
- **Character and power:** Bill, all power states (small, Mushroom, Fire Flower)
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=bill` (Current). Walk right, hold Down+Right, and shoot the first Goomba and the first `?` block.
   Bill goes prone and stops. One shot kills the Goomba. Shots stop on the block and on the ground.
2. Take the Mushroom, then a Fire Flower. Press Attack, Special and Select. Current: Special fires the same gun, and
   Select cycles a belt of guns.
3. Get hit once. Current: Bill loses one hit point of 3, is knocked back, and keeps every gun.
4. Open `?dev=1&rules=classic&level=1-1&char=bill` and repeat steps 1-3. Classic: Bill walks while aiming diagonally down.
   The Goomba takes 3 rifle shots. A shot opens the `?` block from range and flies through the ground. The
   Mushroom gives the Machine Gun, and the Flower adds the Spread on Attack with the Machine Gun on Special. Select
   swaps them. One hit freezes the game for 1 s and puts him back to the rifle.
5. Switch Rules back to Current and check that steps 1-3 behave as before.

## Expected

Classic Bill follows SMBC 3.1.21 with its default settings: POWERUP MODE Classic, When Hit = Lose Everything,
first gun Machine Gun and second gun Spread. Units: px, px/frame (px/f), px/frame², frames at 60 fps. Profile values
are also given in our velocity units (1/4096 px/f). "Forward" means in the facing direction. "Up" means above the
feet, which are the bottom of the hitbox. "Centre" means the hitbox's horizontal centre.

Shared systems are specified in their own reports, and this report gives only Bill's values for them:
[power states](2026-10-07-classic-power-states.md),
[enemy HP and armour](2026-10-07-classic-enemy-hp-and-armour.md),
[bricks and shots](2026-10-07-classic-bricks-and-shots.md) and
[swimming](2026-10-07-classic-swimming.md).

### Controls

**BI-C1. What each button does in each power state.** The shared power-state model has three states. "Mushroom" also
covers big Bill without a Flower.

| State | Attack | Special | Select |
|---|---|---|---|
| Small (no item) | Rifle | nothing | nothing |
| Mushroom | first gun (Machine Gun) | nothing | nothing |
| Fire Flower | second gun (Spread) | first gun (Machine Gun) | swaps the Attack gun and the Special gun |

- Every gun fires once on the press of its button.
- The Machine Gun also auto-fires while its button is held (BI-C21). This is Attack when it is the Attack gun, and
  Special when it is the Special gun. Releasing that button stops the auto-fire.
- After a Select swap, the Machine Gun is on Attack and the Spread is on Special. The swap stays until the next swap
  or until the Flower is lost.
- Picking up a Fire Flower when Bill did not already have one resets the swap, so the new Flower gun is on Attack.
  Picking up a Flower while he already has one leaves the swap as it is.
- A swap stops any auto-fire in progress.
- Classic has no tool belt. Select never cycles guns, except with the dev `&kit=full` (BI-C2).

**BI-C2. Weapon choice constants.** `classic.ts` defines `CLASSIC_FIRST_GUN = 'mg'` (the Mushroom gun) and
`CLASSIC_SECOND_GUN = 'spread'` (the Flower gun). Each can be `'mg'`, `'spread'`, `'laser'` or `'flare'`, which are
the original's Customize Weapons choices. The menu that changes them is in the follow-up report. The Laser and the
Flare are built too; the dev `&kit=full` (TG-44) is the only way to reach them: it gives the Flower state and all four
guns, Special keeps the Machine Gun, and **Select** cycles the Attack gun through Spread, Laser, Flare and Machine Gun
instead of swapping. The rifle is never a choice. Rapid (R1, R2) does not exist in Classic.

**BI-C3. Aim on the ground.** If Up and Down are both held, Up wins.

| Input on the ground | Pose and movement | Shot direction |
|---|---|---|
| nothing | stand | forward |
| Left or Right | walk at 1.25 px/f | forward |
| Up only | stand still | straight up |
| Up + Left/Right | walk at 1.25 px/f | diagonally up-forward |
| Down + Left/Right | **walk at 1.25 px/f**, gun pointed down-forward | diagonally down-forward |
| Down only | prone (BI-C9) | forward, low |
| Left + Right together | stand still (vx = 0) | as for Up/Down alone |

**BI-C4. Aim in the air.** Classic tells a **somersault** apart from a **fall**.
- A somersault is any time in the air after a jump-button take-off or a spring launch. On a spring the original sets
  `jumped`.
- A fall is any time in the air after walking off a ledge, or after anything else that leaves the ground without a
  jump.
- Landing ends both.

| Input in the air | Somersault | Fall |
|---|---|---|
| nothing / Left or Right | forward | forward |
| Up only | straight up | straight up |
| Up + Left/Right | diagonally up | diagonally up |
| Down + Left/Right | diagonally down | diagonally down |
| Down only | **straight down** | **forward** (same as no input) |

**BI-C5. Vine.** On a vine Bill cannot shoot or jump. This matches today's behaviour, so keep it.

### Movement

**BI-C6. Ground walking is instant.** The Classic profile uses `instantAccel: true`, `canRun: false` and
`maxWalk = maxRun = 0x1400` (1.25 px/f).
- Holding a direction sets vx to ±1.25 px/f on the first frame.
- Releasing it on the ground sets vx to 0 on the next frame.
- Turning is instant, with no skid.
- There is no run, so the B / run button does nothing for movement.
- `minWalk`, `walkAccel`, `runAccel`, `releaseDecel`, `skidDecel` and `skidTurnaround` are unused with
  `instantAccel`. Set them all to 0x1400.

**BI-C7. Air steering is instant, and momentum is kept.** Use `airControl: 'full'` with `instantAccel: true`. This is
the existing `airMove` instant branch.
- Holding a direction in the air sets vx to ±1.25 px/f at once and turns Bill to face it.
- With no direction held in the air, vx keeps its value. It is not reduced.

**BI-C8. Down plus a direction walks.** Bill goes prone only when Down is held with no Left or Right, he is on the
ground and Up is not held. With Down + Left/Right he walks at full speed with the down-diagonal aim (BI-C3). This
replaces today's "prone on Down whatever the direction".

**BI-C9. Prone.**
- Bill cannot move while prone. Pressing a direction ends prone and he walks (BI-C8).
- The prone hitbox is **12 × 15 px**: the original's 13.5 × 15, at our standard 12 px width. Today it is 12 × 8.
- Standing, walking and falling keep our **12 × 24 px**. See Open questions.
- The answer to "does lying flat dodge shots?" is **yes, but only by height**. While prone, Bill is as tall as
  small Mario, so anything that passes 15 px or more above the floor misses him. Anything lower still hits him.
- Prone gives no invulnerability and no other protection.
- Walking enemies (Goombas, Koopas) still touch him while prone.

### Jumping

**BI-C10. Fixed jump with the original's numbers.**

| Constant | Original | Classic value (ours) |
|---|---|---|
| Launch speed | `jumpPwr 550` = 4.583 px/f | `initial: 0x471C` (4.444 px/f; see below) |
| Gravity, rising and falling | `gravity 1000` = 0.1389 px/f² | `holdGravity: 0x239`, `fallGravity: 0x239` |
| Fall cap | `vyMaxPsv 600` = 5.0 px/f, a clamp | `maxFall: 0x5000`, `fallReset: 0x5000` |
| Variable height | none | `variableJump: false` |
| Coyote time | none (`onGround` only) | `coyoteFrames: 0` |
| Jump tiers | one | one tier, `maxVx: Infinity` |

- **Why the launch is 0x471C.** The original applies gravity **before** it moves (`AnimatedObject.updateObj`: gravityPull,
  then updateLoc). Our player moves first and then adds gravity. With `initial = 4.583 − 0.139 = 4.444 px/f`, our
  per-frame positions match the original's exactly. Do the same for every other launch of Bill's body (the water
  jump, BI-C11; the death hop, BI-C15). Projectiles need no change: our projectile code already adds gravity before it
  moves (`projectile.ts:244-246, 265-270`).
- **Result:** apex **73.3 px** (4.6 tiles) above the take-off height. Flat ground to flat ground takes **66 frames**
  (a headless integer sim of our engine gives 73.4 px and 66 frames).
- Jump works only from the ground and never from a vine.
- Springs use the shared spring code, which is already fixed per hero (Bill's gravity is 1000). A spring launch counts
  as a somersault for BI-C4 and BI-C24.

### Swimming

**BI-C11. No swim stroke.** Use the swimming report's floor-jump mode with these values:
- A jump tap does nothing unless Bill stands on the floor.
- **Floor jump:** launch 4.583 px/f in the original, which is `0x4839` (4.514 px/f) with the same gravity-first
  adjustment.
- **Water gravity:** 500 = 0.0694 px/f², which is `0x11C`.
- **Sink cap:** 2.083 px/f, which is `0x2155`, the same as today.
- **Apex of a floor jump:** about 149 px (9.3 tiles), unless the swimming report's rule near the top of the screen
  (gravity returns to normal within 2 tiles of the top) cuts it.
- He walks the floor at full speed (1.25 px/f), and every gun works underwater.

### Health and power-ups

**BI-C12. Power states, not HP.**
- Classic Bill uses the shared power-state model with When Hit = Lose Everything. A hit while he has the Mushroom or
  the Flower takes away both, and Bill is back to small with the rifle. **Any hit loses the gun.**
- A hit while small kills him.
- There is no HP bar, no `maxHp`, and no `START_HITS` or `MAX_HITS`.
- Bill's size does not change with the power state, so the hitbox follows BI-C9 only.

**BI-C13. Pickups.**
- A `?` block gives a **Mushroom** when Bill is small and a **Fire Flower** otherwise.
- A Mushroom gives the Mushroom state and the first gun.
- A Fire Flower gives the Flower state and the second gun (BI-C1).
- A Flower while Bill already has the Flower gives only the score.
- Star and 1-up use the shared rules. The Star lasts 12 s in Classic.
- **No drops.** Classic Bill's `drop()` returns `null`, because the original Bill has no `DROP_ARR`.
- There are no `capsule` or `health-small` pickups in Classic.

**BI-C14. Hit response.** When a hit removes the power-ups:
- The whole game freezes for **60 frames** (1000 ms, `FREEZE_GAME_TMR_DEL`), with Bill in his electrocuted flash.
- Bill is then invulnerable for **120 frames** (2000 ms, `NO_DAMAGE_TMR_DEL`), drawn at **65 % opacity**.
- There is **no knockback and no stun**, and vx and vy are kept.
- Any Machine Gun auto-fire stops.

**BI-C15. Death.**
- Bill is thrown away from what hit him: vx = 1.25 px/f away from it, or away from his facing if no source is known,
  and vy = −2.5 px/f (`DIE_BOOST 300`).
- He falls with his normal gravity (0x239) and lands on the ground. He does not fall through it.
- The death sequence ends **90 frames** (1500 ms) after he lands, or **360 frames** (6000 ms) after death if he never
  lands.
- A pit death uses the shared pit timing.
- Death removes every power-up.

### Weapons and attacks

**BI-C16. Gun table.**
- "Straight" is the speed along an axis shot. "Diagonal" is the speed on each axis; the original uses 0.75 × speed per
  axis, so a diagonal shot is 1.06 × faster.
- Damage is at the default Attack Strength (Normal).
- Every bullet's hit box is **3 × 3 px**, centred on its position (the original's 6 × 6 `hRect`).

| Gun | Straight speed | Diagonal (each axis) | Damage | Fires | Cap (BI-C17) |
|---|---|---|---|---|---|
| Rifle | 2.40 px/f = `0x2666` | 1.80 px/f = `0x1CCD` | 100 | on press only | fires only if fewer than **4** are out |
| Machine Gun | 2.625 px/f = `0x2A00` | 1.969 px/f = `0x1F80` | 125 | on press, then auto (BI-C21) | fewer than **6** |
| Spread (5 pellets) | 2.775 px/f = `0x2C66` | 2.081 px/f = `0x214D` | 125 per pellet | on press only | fewer than **10**, with partial fans (BI-C22) |
| Laser (4 segments) | 2.775 px/f = `0x2C66` | 2.081 px/f = `0x214D` | 100 per segment | on press only | **no cap**: firing clears Bill's shots (BI-C23) |
| Flare | centre moves at 1.758 px/f = `0x1C22` | 1.319 px/f = `0x151A` | 200, **armour-piercing** | on press only | fewer than **6** counted, so 3 Flares (BI-C17) |

Classic speeds against today's: the rifle is 2.1× slower and the Machine Gun 2.3× slower. The Spread and the
Flare/Flame are only about 1.4× slower (4.0 → 2.775 and 2.5 → 1.758). The Laser is 2.9× slower.

**BI-C17. Caps count all of Bill's shots together.**
- Every cap compares against the number of **this Bill's projectiles of any gun** on screen. This is not a per-gun
  count like today's `countProjectiles(p, kind)`.
- A Flare counts as **2**, because the original counts its invisible centre.
- Each Laser segment counts as 1.
- A bullet that has hit something still counts while it shows its 3-frame explosion (BI-C26).
- Example with Flower and a swap: with 4 Spread pellets out, the Machine Gun can still fire (4 < 6).
- In 2-player, each Bill counts only his own shots.

**BI-C18. Shots fly through solid ground and pipes.** All five guns ignore solid tiles, pipes and used (empty) blocks.
They are removed when they leave the screen. See BI-C27 for bricks and `?` blocks.

**BI-C19. Rifle.** Bill has it when small. A tap fires one bullet if fewer than 4 of his shots are out.

**BI-C20. Hits to kill (Normal attack strength).**
- Each bullet, pellet or segment is a separate hit, and each explodes on its first hit (BI-C26).
- Armoured enemies take **no damage** from the Rifle, Machine Gun, Spread or Laser. The bullet still explodes on them.
- Enemy HP and armour are in the HP report. This table is for acceptance checks.

| Enemy (HP) | Rifle | MG or Spread pellet | Flare | Laser segments |
|---|---|---|---|---|
| Goomba (250) | 3 | 2 | 2 | 3 |
| Piranha Plant (275) | 3 | 3 | 2 | 3 |
| Spiny (350) | 4 | 3 | 2 | 4 |
| Koopa (600) | 6 | 5 | 3 | 6 |
| Hammer Bro, Lakitu (800) | 8 | 7 | 4 | 8 |
| Flying Koopa (900) | 9 | 8 | 5 | 9 |
| Buzzy Beetle (600, armoured) | immune | immune | 3 | immune |
| Spike Top (600, armoured) | immune | immune | 3 | immune |
| Bullet Bill (400, armoured) | immune | immune | 2 | immune |
| Bowser, fire only (2400) | 24 | 20 | 12 | 24 (6 full shots) |
| Bowser, hammers only (3600) | 36 | 29 | 18 | 36 (9 full shots) |
| Bowser, fire and hammers (4400) | 44 | 36 | 22 | 44 (11 full shots) |

Firebars and Podoboos are immune to everything, as today.

**BI-C21. Machine Gun timing.**
- **Press:** if fewer than 6 shots are out, one bullet fires at once. The press also (re)starts a repeat timer from 0.
- **Repeat timer:** it ticks every 110 ms (6.6 frames). Keep the remainder: tick *n* happens on frame
  `ceil(6.6 × n)` after the press, which is frames 7, 14, 20, 27, 33, 40, 47, 53, ... (gaps 7, 7, 6, 7, 6).
- **On a tick:**
  - if 6 or more shots are out, no shot fires and the burst counter resets to 0;
  - otherwise, if the counter is below 6, one bullet fires and the counter goes up by 1;
  - otherwise (the counter is 6), this tick fires nothing and the counter resets to 0.
- So a long hold fires 6 timer shots, skips one tick, fires 6 more, and so on. The press shot is not counted.
- **Stopping:** releasing the button the Machine Gun is on stops the timer and resets the counter. So do a Select
  swap, a hit, and losing the Mushroom.
- Each new press fires again at once, so fast tapping can beat the hold rate. This is allowed.

**BI-C22. Spread.**
- **Pellets.** A press fires 5 pellets with fan indexes *k* = 0, +1, −1, −2, +2.
- **Fan width.** Each pellet moves at the Spread speed along the aim, plus a sideways speed:
  - Straight shots: k × 0.5 px/f (`k × 0x800`), which gives about ±10° and ±20°.
    - Right/left and prone: the sideways speed is vy, and +k is **down**.
    - Up, and Down in a somersault: the sideways speed is vx, and +k is **screen-right**.
  - Diagonal shots: k × 0.4167 px/f on both axes (`0x6AB` for k = ±1 and `0xD55` for k = ±2), at right angles to the
    aim:
    - up-right: vx = +D + k·d, vy = −D + k·d
    - up-left: vx = −D − k·d, vy = −D + k·d
    - down-right: vx = +D − k·d, vy = +D + k·d
    - down-left: vx = −D + k·d, vy = +D + k·d

    Here D = `0x214D` and d = 0.4167 px/f.
- **Start points.** Pellet *k* starts 3 × |k| px **behind** the muzzle, on each axis the shot moves along. The fan
  starts as a shallow V.
- **Partial fans.** Let *n* be Bill's shots already out (BI-C17):

  | n | Pellets fired |
  |---|---|
  | 0-5 | all 5 |
  | 6 | 4 (k = 0, +1, −1, −2) |
  | 7 | 3 (k = 0, +1, −1) |
  | 8 | 2 (k = 0, +1) |
  | 9 | 1 (k = 0) |
  | 10 or more | none |

- **Growth.** Pellets are drawn bigger each frame: scale +0.018 per frame from 1.0, capped at 1.6 (reached after 34
  frames). This is **visual only**. The hit box stays 3 × 3 px, because the original's `HRect.getHitPoints` resets
  the width and height to the unscaled size.

**BI-C23. Laser.**
- **Clears the screen.** Each press first **removes every projectile of this Bill** on screen, then fires one laser
  of **4 segments**. There is no cap.
- **Layout.** All 4 segments move at the Laser speed in the aim direction. Segment 1 starts at the muzzle. Segments 2,
  3 and 4 start 1, 2 and 3 steps **behind** it along the aim. A step is **13 px** on straight shots and **9 px on
  each axis** on diagonals: `LASER_SEP 26`, `LASER_SEP_ROTATED 18` Flash px. Vertical shots use the 13 px step.
- **Appearing.** Segments 2-4 are invisible and harmless until each reaches a point **3 px behind the muzzle** on each
  moving axis. Then they switch on, so the beam comes out of the gun. On straight shots that happens 4, 9 and 13
  frames after the press.
- **Damage.** Each segment deals 100 and explodes on its first hit (BI-C26). A full laser into one target is up to
  400 damage. It does not pierce armour.
- Draw each segment rotated 45° on diagonals and 90° on vertical shots.

**BI-C24. Flare.**
- **Centre.** A press creates an invisible centre at the muzzle. The centre moves in the aim direction at the Flare
  speed (BI-C16), passes through everything and hits nothing.
- **Fireball.** The visible fireball sits **16 px** from the centre at angle *a*: x = cx + 16·cos a, y = cy + 16·sin a,
  with screen y pointing down.
- **Spin.** Each frame, *a* changes by 0.3667 rad (22 rad/s, about 3.5 turns per second).
  - Facing right, *a* starts at −1.0 rad and increases, which is clockwise on screen.
  - Facing left, *a* starts at −π/2 (straight up) and decreases, which is counter-clockwise.
- **Damage.** The fireball deals **200** and is **armour-piercing**. It explodes on its first hit, and its centre is
  removed with it.
- When the fireball leaves the screen, the Flare and its centre are removed.

**BI-C25. Muzzle points.** Every shot starts at these points, for every gun. Each point is the bullet's centre,
measured from Bill's centre and feet: forward, then up. These replace today's "body centre + 10 px along the aim,
13 px up". The original's values are halved Flash px from `BillBullet.OFS_ARR` (default skin).

| Pose | Aim | Forward | Up |
|---|---|---|---|
| Ground (stand or walk) | up | 4.5 | 46.5 |
| Ground | diagonal up | 13.5 | 34.5 |
| Ground | forward | 17.5 | 22.5 |
| Ground (walking) | diagonal down | 15 | 13 |
| Prone | forward | 18 | 7.5 |
| Somersault | up | 0 | 22.5 |
| Somersault | diagonal up | 9.5 | 19.5 |
| Somersault | forward | 12.5 | 12.5 |
| Somersault | diagonal down | 9.5 | 3 |
| Somersault | down | 0 | 0 |
| Fall | up | 0 | 39 |
| Fall | diagonal up | 12.5 | 30.5 |
| Fall | forward (also Down alone) | 12.5 | 22.5 |
| Fall | diagonal down | 12.5 | 13 |

- A standing forward shot flies 21-24 px above the feet, so it **passes over a Goomba** (ours is 14 px tall). Bill
  must go prone (7.5 px) or aim diagonally down to hit one.
- Prone shots and shots fired diagonally down go through the floor (BI-C18).

**BI-C26. Every shot stops on its first hit.**
- Rifle bullets, Machine Gun bullets, Spread pellets, Laser segments and the Flare all explode on the first enemy,
  brick or `?` block they touch. This includes an armoured enemy they cannot hurt.
- The explosion shows for **3 frames** (50 ms), deals no damage and still counts toward the caps.
- Nothing pierces.

### Interactions

**BI-C27. Bricks and `?` blocks.** This uses the bricks report's rules for player shots that pass through ground.
- A bullet that touches a `?` block or a brick holding an item **bumps it open** and releases the item. A multi-coin
  brick gives one coin per hit.
- A plain brick takes the shot's damage and breaks at 125:

  | Gun | Shots to break a brick |
  |---|---|
  | Rifle | 2 |
  | Machine Gun | 1 |
  | Spread pellet | 1 |
  | Flare | 1 |
  | Laser | 2 segments, so one laser shot. Later segments go on through the gap. |

- The bullet explodes on the block either way.
- Used (empty) blocks are passed through like ground.

**BI-C28. Head bumps, never breaks.** Classic Bill's `canBreakBricks` returns `false` in every power state. His head
bumps bricks and opens `?` blocks from below, like small Mario.

**BI-C29. 2-player.** Both Bills use these rules. Caps and the Laser's clear only count or remove that player's own
shots.

### Feel

**BI-C30. Sprite poses.**
- **Somersault.** The spin frames play only during a somersault (BI-C4).
- **Fall.** A fall shows a still pose with the gun forward. Use the `shoot` frame if no fall frame exists.
- **Walking diagonally down.** Walking with Down + Left/Right shows the `aim-diag-down` frame while walking.
- **Shooting while walking.** The torso holds the shooting pose for **15 frames** (250 ms, `SHOOT_TMR`) after each
  shot. Today it holds 10.

**BI-C31. HUD and touch labels.**
- There is no HP bar and no belt.
- Touch labels:
  - Attack: `SHOOT`.
  - Special: the Special gun's caption, or `-` when Bill has no Flower.
  - Select: `SWAP` with the Flower, or `-` without it.
- The power state shows as the shared Mushroom or Fire Flower icon (PS-C26). The original shows no other upgrade icons
  in Classic (`TopScreenText.as:277-278`).

**BI-C32. Sound (optional).** The original plays no jump sound for Bill and has its own sound for each gun. Use
existing sounds for the guns. Leave the jump silent if the audio API allows it, otherwise keep `jump-small`. Neither
is a blocker.

## Actual

Current (stays the default; all in `src/game/characters/bill/` unless noted):
- `index.ts:15-34`:
  - walk `maxWalk 0x1800` (1.5 px/f) with a ramp (`instantAccel: false`, accel 0x400, release 0x800);
  - jump `0x5000` with gravity `0x300` (about 70 px, about 54 frames);
  - fall cap `0x4800`, reset `0x4000`;
  - air control that accelerates (`airControl: 'full'`).
- `index.ts:36-37`, `:123-129`, `:225-234`: 3 hits up to 5, 90 invulnerable frames, knockback 0.5 / 2.0 px/f, and
  `world.ts:1440-1452` adds a 16-frame stun.
- `index.ts:136`, `:191-221`:
  - the Mushroom adds 1 max hit;
  - the Flower unlocks the next gun on the belt (Machine Gun, Spread, Laser, Flame Thrower);
  - drops are 1 in 12 a capsule and 2 in 12 small health (`:141-146`).
- `index.ts:157-173`: Select cycles the belt (`cycleTool`, `:158`), and Special fires the same gun as Attack
  (`:165-168`).
- `index.ts:52-63`, `entities/player.ts:174-181`:
  - Down goes prone even with a direction held, and Bill cannot move;
  - Down in the air always shoots straight down.
- `index.ts:88-107`:
  - caps are per gun kind (`world.countProjectiles(p, kind)`, `world/world.ts:574-579`);
  - the Spread fans 15° apart and fires only when 5 or fewer are out;
  - shots start 10 px along the aim from a point 13 px (prone 4 px) above the feet.
- `weapons.ts:17-104`:
  - speeds are rifle 5, Machine Gun 6, Spread 4, Laser 8 (one piercing 24 × 6 bar, 1 out) and Flame Thrower 2.5
    (straight, 2 out);
  - every shot stops on any tile (`hitsTiles: true`, `:22`; `entities/projectiles/projectile.ts:237-262`) and never
    affects blocks;
  - any shot kills any normal enemy, including Buzzy and Bullet Bill.
- `index.ts:133`: the head breaks bricks. `index.ts:134`: the hitbox is 12 × 24, or 12 × 8 prone.
- Underwater Bill gets the shared stroke (`entities/player.ts:16`, `:295-345`).

## How often

every time

## Notes

**Sources.** Original paths are under `$S/orig/src/com/smbc/`. Line numbers are from `tr '\r' '\n'`.
- Buttons, power states, swap: `characters/Bill.as`:
  - weapons by state: 61-65, 203-228 (`getClassicWeapon`), 503-532 (`primaryAttack`, `secondaryAttack`);
  - buttons: 591-613 (`pressAtkBtn`, `pressSpcBtn`, `pressSelBtn`);
  - swap reset on a new Flower: 459-476 (`hitPickup`); `attacksAreSwapped`: 478-493;
  - defaults: `data/GameSettings.as:118-119`, `:223-224`; choices: `enums/BillWeapon.as:9-12`;
  - `?` block contents: `managers/StatManager.as:1351-1360`;
  - hit handling: `characters/Character.as:2037-2075` (`takeDamage`, Lose Everything) and `:3282-3290`
    (`canGetMushroom` is true in Classic).
- Aim: `Bill.as:354-457` (`checkState`); `projectiles/BillBullet.as:352-560` (`setDir`).
- Movement: `Bill.as:104`, `:282-283` (WALK_SPEED 150, vxMax); `:316-351` (`movePlayer`).
- Jump: `Bill.as:270-271`, `:280`, `:574-589`. Integration order: `main/AnimatedObject.as:179-190`, `:254-283`
  (gravityPull before updateLoc). Spring `jumped`: `ground/SpringRed.as:75` (`springLaunch`).
- Water: `Bill.as:272-277`, `:304-315`; `Character.as` `vyMaxPsvWater 250`.
- Hit and death:
  - hit response: `Bill.as:178`, `:298`, `:880-902` (`takeDamage`, `takeDamageStart`, `freezeGame`);
  - timers: `Character.as` `FREEZE_GAME_TMR_DEL 1000`, `TD_ALPHA .65`, `:2279-2297`;
  - death: `Bill.as:964-987` (`initiateNormalDeath`), `:924-931` (death timer after landing).
- Guns:
  - caps and fire logic: `Bill.as:105-107`, `:117`, `:629-715` (`createBulletIfPossible`);
  - Machine Gun timer: `:86-87`, `:114-118`, `:773-860`;
  - speeds: `BillBullet.as:64-72` (`int(320 − 32) = 288`, and so on; the `// 340` comments are stale);
  - Flare: `:204-231`, `:270-275`;
  - Laser: `:75-78`, `:233-249`, `:262-269`, `:312-339`, `:540-558`;
  - Spread: `:34-36`, `:253-261`, `:294-311`;
  - explosion: `:340-351` (`blowUp`, `DESTROY_TMR 50`), `:561-565`;
  - damage: `data/DamageValue.as:12-16`; armour piercing: `BillBullet.as:229`, `projectiles/Projectile.as:134-145`
    (`confirmedHit`).
- Muzzle points: `BillBullet.as:84-100` (default skin). The Game Boy skins' set (`:101-117`) is out of scope.
- Bricks: `ground/Brick.as:174-192` (passthrough shots reach `confirmedHitProj`), `:223-228` (`takeDamage`);
  `data/HealthValue.as:30` (BRICK 125); `Projectile.as:98-104`. Head bump: `Character.as` `brickState = BRICK_BOUNCER`,
  which Bill never changes.
- Enemy HP: `data/HealthValue.as`; Bowser forms: `enemies/Bowser.as:187-195`.
- Hitboxes: the `HRect` instance (an 8 × 8 shape) placed in each frame of the `Bill` symbol, read from
  `$S/flash/smbc3.swf` (sprite 284) for this report:
  - `main`: scale 3.38 × 7.88, so 27 × 63 Flash px = 13.5 × 31.5 px;
  - `crouch` / `crouchShoot`: 27 × 30 = 13.5 × 15 px;
  - `jumpStart`-`jumpEnd`: 27 × 32.5 = 13.5 × 16.25 px;
  - all bottom-aligned to the feet;
  - `BillBullet` (sprite 246): 6 × 6 = 3 × 3 px in every frame;
  - Goomba 28 × 30 (15 px tall), green Koopa 28 × 28, small Mario 26 × 30.

  The script is in `$S/classic/billtools/hrect.py`.
- Fact-check overrides used: `$S/chars/verify/B.md`:
  - the Spread and the Flare/Flame are only about 1.4× faster in ours;
  - Laser spacing is 13 px, or 9 px on diagonals;
  - Bowser's HP depends on his form.
- Our landing points:
  - new `src/game/characters/bill/classic.ts` and `classic-weapons.ts`;
  - the registry picks it in `src/game/characters/registry.ts`.

**Implementation hints.**
- Build `BILL_CLASSIC: CharacterDef` in `bill/classic.ts` and leave `bill/index.ts`, `weapons.ts` and `guide.ts`
  untouched. Reuse the sprite sheet.
  - Profile (BI-C6, BI-C10): `instantAccel: true`, `airControl: 'full'`, `maxWalk/maxRun 0x1400`, one jump tier
    `{ maxVx: Infinity, initial: 0x471C, holdGravity: 0x239, fallGravity: 0x239 }`, `maxFall/fallReset 0x5000`,
    `variableJump: false`, `coyoteFrames: 0`, `canRun: false`, and `swim` per the swimming report's floor-jump mode.
  - `damage`: the shared Classic power-state kind (`small` / Mushroom / Flower), per the power-states report.
    `blockPowerUp`: `small` gives `'mushroom'`, anything else `'flower'`.
  - `canBreakBricks: () => false`, `drop: () => null`, and no `tools` (no belt).
- **Prone with no direction (BI-C8).** `player.ts:175-176` decides prone from `input.held('down')` alone. Add an
  optional `CharacterDef` hook, for example `crouchNeedsNoDirection?: boolean`, read there as
  `&& !(def.crouchNeedsNoDirection && input.dirX !== 0)`. It must default to off, so Current and every other hero are
  unchanged.
- **Somersault flag (BI-C4).** Keep a scratch flag `p.scratch.somersault`:
  - set it to 1 on the frame a jump or spring launch leaves the ground (`p.jumping` is already true after a jump; a
    spring launch sets `launched`);
  - clear it on landing.
  - `aim()` and the muzzle table read it.
- **Shots.** Spawn every shot through one `classicFire(p, gun, dir, world)` that:
  1. computes the muzzle from BI-C25 using `b.x + b.w/2` and `b.y + b.h` (the feet);
  2. counts `world` projectiles with `owner === p` of **any** kind, a Flare counting 2 (BI-C17);
  3. sets velocities from BI-C16 and BI-C22. Do not use `cos`/`sin` for diagonals: use 0.75 × speed per axis.
  - The specs use `piercesTiles: true` (BI-C18) plus the bricks report's "hits bricks and `?` blocks" behaviour.
  - Use `pierce: false` and `w: 3, h: 3`.
  - Today `world.ts:1425-1427` bursts a shot on an `'immune'` enemy only when `hitsTiles && !pierce`. Classic Bill's
    shots must burst on `'immune'` too (BI-C26). Branch on the spec, for example `burstOnImmune: true`, not on Bill.
- **Damage amounts.** Damage amounts (100/125/200) and armour come from the enemy-HP report's numeric damage. The
  Flare carries the armour-piercing flag.
- **Flare.** It needs a new projectile mode: a straight-moving centre plus a circling offset. The existing
  `orbit` circles the owner, so it does not fit. A field such as `circle: { radius: 16, step: 0.3667 }`, with the
  centre stored on the projectile, is enough. There is no need for a second entity, as long as the cap counts the
  Flare as 2.
- **Laser.** Spawn 4 projectiles sharing a `segment` index. Give segments 2-4 a `dormantUntil` point (3 px behind the
  muzzle) during which they neither draw nor hit.
- **Machine Gun timer.** Keep `p.scratch.mgT` (frames since the press) and `p.scratch.mgN` (ticks done). Tick *n* = `mgN + 1` is due
  when `mgT * 10 >= 66 * n`, which is frame `ceil(6.6 × n)`. Keep `p.scratch.mgBurst` for the
  6-shot counter. Clear all three on release, Select, a hit, or losing the Mushroom.
- **Hit response.** Hit response (BI-C14) uses the power-states report's hook with Bill's values: freeze 60, invuln
  120, alpha 0.65, no knockback.
- **Dev kit.** `devKit` in Classic gives the Flower state and all four guns, so `&kit=full` shows Spread + Machine Gun,
  and Select cycles the Attack gun through Spread, Laser, Flare and Machine Gun (BI-C2, TG-44).

**Acceptance checks** (headless, `rules: 'classic'`, `char=bill`, on flat ground in 1-1 unless noted):
1. **Walk.** vx is exactly 1.25 px/f on the first frame Right is held, and 0 on the first ground frame after release.
   In the air with no input, vx keeps its take-off value.
2. **Jump.** Jumping from rest on flat ground: apex 73 px (±1) above the start, landing 66 frames (±1) later. Fall
   speed never exceeds 5.0 px/f.
3. **Down + Right.** On the ground x increases 1.25 px/f, the hitbox stays 24 tall, and a rifle shot moves (+1.80,
   +1.80) px/f from (centre + 15, feet − 13). Down alone gives a 15 px tall hitbox and no movement.
4. **Air down-shot.** A shot with Down alone goes straight down during a jump. After walking off a ledge it goes
   forward from (12.5, 22.5).
5. **Rifle.** The 5th press with 4 out fires nothing.
   - A standing shot at a Goomba passes over it, and a prone shot kills it on the 3rd hit. A Koopa takes 6 hits.
   - A Buzzy Beetle takes no damage, and each bullet explodes on it.
   - A brick breaks on the 2nd shot, and a `?` block releases its item on the 1st shot fired from 5 tiles away.
   - A shot fired into a pipe or the ground keeps flying.
6. **Machine Gun** (Mushroom, start at the left screen edge, no targets).
   - Bullets appear on frames 0, 7, 14, 20, 27 and 33 after the press. The tick at frame 40 is blocked by the cap of 6.
   - Releasing Attack stops it.
7. **Spread** (Flower).
   - One press makes 5 pellets with vy of 0, ±0.5 and ±1.0 px/f.
   - With 6 shots out the next press makes 4, and with 10 out it makes none.
   - Special fires the Machine Gun; after Select, Attack fires the Machine Gun.
8. **Laser and Flare** (`&kit=full`, Select to the Laser, then the Flare).
   - A second Laser press removes all of the first laser's segments. The segments are 13 px apart on a straight
     shot.
   - The Flare's fireball stays 16 px (±0.5) from its centre, which moves 1.758 px/f.
   - The Flare kills a Buzzy Beetle in 3 hits. A 4th Flare press with 3 out fires nothing.
9. **Hit with the Flower.** Bill becomes small with the rifle. The world does not advance for 60 frames, then Bill is
   invulnerable for 120 frames. He gets no knockback.
10. **Head.** Bill's head bumps a brick and does not break it, in any state.
11. **Current is unchanged.** With `rules: 'current'`:
    - every existing test passes unchanged, including `touch-labels.test.ts:104-108`;
    - the headless sims match their baselines;
    - Bill still walks at 1.5 px/f, has 3 hits, and his shots stop on tiles.

**Confidence.**
- **Every original number here comes from source.** Nobody played the original for this report.
- **Hitbox sizes** were read from the SWF's per-frame hit rectangles for this report. They were not measured in play.
- **"The standing shot passes over a Goomba"** follows from those rectangles and the muzzle table. It is inferred,
  not seen.
- **Machine Gun ticks.** The original's Flash `Timer` runs on wall-clock time. The 6.6-frame tick pattern is the ideal
  at 60 fps.
- **Flare spin.** The rate assumes the original's `dt` is 1/60 s.
- **Jump.** The jump arc was checked by integer simulation of our engine's update order (73.4 px, 66 frames) against
  the original's float order (73.3 px, 65-66 frames).
- **Current** behaviour was played in the comparison (walk speed, jump height, prone with a direction, shots stopping
  on tiles).

**Open questions** (each has a default the coder can use meanwhile):
1. **Standing hitbox.** It is 13.5 × 31.5 px in the original, and ours is 12 × 24. Our 24 matches every other
   2-tile-tall hero, and the original's big Mario is 28 tall against our 24. **Default: keep 12 × 24.** A playtest
   decides whether Classic Bill should be 32 tall, which would put him much nearer firebars and hammers.
2. **Somersault hitbox.** It is 13.5 × 16.25 px in the original, so a jumping Bill is only one tile tall. Our engine
   has no push-out when a hitbox grows into a ceiling on landing. **Default: keep 12 × 24 in the air.** Revisit once
   the engine can refit safely.
3. **Our enemies are taller than the original's.** Our Koopa and Hammer Bro are 22 tall. The original's Koopa is
   14 and its Hammer Bro 18. With the original muzzle (21-24 px), a standing shot clips the top of our Koopa but
   passes over the original's. **Default: keep the muzzle numbers as written.** Enemy hitboxes are not in scope.
4. **Flare start angle.** Facing left, the original starts at −π/2 because of `flareAngle *= Math.PI/2` on −1. This
   looks like a quirk, but it is what ships. **Default: reproduce it.**
5. **Prone Spread facing left.** `BillBullet.as:495` has a stray `;` that drops the pellet start offset when facing
   left. **Default: mirror the right-facing behaviour** (apply the offset). The difference is at most 6 px at launch.
6. **HUD icons.** Settled: the shared Mushroom or Fire Flower icon only (PS-C26); in Classic the original draws no
   other upgrade icons.

**Related reports.**
- The toggle: `2026-10-07-dev-classic-smbc-rules-toggle.md`.
- The shared systems: `2026-10-07-classic-power-states.md`, `2026-10-07-classic-enemy-hp-and-armour.md`,
  `2026-10-07-classic-bricks-and-shots.md`, `2026-10-07-classic-swimming.md`.
- Out of scope, in the follow-up report: Customize Weapons (the BI-C2 choices), Modern mode (capsules, Rapid R1/R2,
  one hit kills) and Bill's 18 skins (the Game Boy muzzle set). See `2026-10-07-classic-follow-ups.md`.
- `2026-10-06-water-non-mario-heroes-stroke.md` covers Bill's missing floor-only water jump in Current. BI-C11 is the
  Classic half of it.
- `2026-10-06-water-surface-air-physics.md` covers the gravity change near the water surface, which Bill's floor
  jump reaches.
- `2026-10-05-springboard-bounce-too-high.md` (fixed) is where the spring launch with Bill's 1000 gravity is already
  handled.
