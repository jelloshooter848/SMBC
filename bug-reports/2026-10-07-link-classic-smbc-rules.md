# Classic SMBC rules for Link: power states instead of hearts, instant walk, variable jump, rooted 3-way stab, Zelda II thrusts, Red Ring beam, 8-way fetching boomerang, safe bombs

- **Severity:** feature request (Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=link` (once the toggle exists; today `?dev=1&level=1-1&char=link` shows the Current behaviour)
- **Character and power:** Link, all power states (small, Mushroom, Fire Flower)
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=link` (Current). The HUD shows 3 hearts and a magic meter. Tap jump, then hold jump: both jumps reach the same 75 px. Walk right and let go in mid-air: Link keeps drifting. Slash the first Goomba: it dies in one hit.
2. Stand next to the first brick row and slash it from the side: nothing happens. Hold Down on the ground: Link crouches.
3. Open `?dev=1&rules=classic&level=1-1&char=link` (Classic, once built). No hearts and no magic meter. Tap jump: a 21 px hop. Hold jump: about 67 px. Let go of Right in mid-air: he stops dead.
4. Stab the first Goomba: it flashes, freezes for 24 frames and survives. A second stab kills it. Hold Up and press Attack under a brick: the up-stab breaks it. Down on the ground does nothing by itself.
5. Take the Mushroom from the ? block: the tunic turns blue and the HUD shows 3 bombs. Press Select: a bomb drops 13 px ahead and blows up after 60 frames. Stand in the blast: Link is not hurt. A bomb placed on a brick breaks that brick.
6. Press C while holding Up+Right: the boomerang flies up-right, stops about 80 px out and comes back. Touch a Goomba: Link loses the Mushroom and keeps his bombs. Touch another: he dies.

## Expected

Classic Link plays like the original's **default** Link: Classic power-up mode, When Hit = Lose Everything, Link weapon = Bomb (the default Customize Weapons choice), no cheats, no skin (Link NES). The shared systems are specified in their own reports, linked below. This report gives Link's own values.

Conversions: Flash px/s ÷ 120 = px/f; Flash px/s² ÷ 7200 = px/f²; Flash px ÷ 2 = px; ms ÷ 16.67 = frames. Hex values are in our velocity units (1 px/f = `0x01000`). "Centre" is the centre of Link's hitbox in x. "Feet" is the bottom of his hitbox. Boxes are given for Link facing right; facing left mirrors x.

### Controls

- **LK-C1 Control map.**

  | Input | Classic SMBC |
  |---|---|
  | Left / Right | Walk at 1.458 px/f, starting and stopping at once (LK-C5). Also steers in the air. Turns Link to face that way, except during a ground stab (LK-C6). |
  | Run | None: Link never runs. |
  | Jump | Jump, from the ground only. Not during a ground stab or throw (LK-C10). Releasing it while rising cuts the jump (LK-C9). |
  | Attack (B) | Stab. On the ground: forward stab; with Up held, up-stab; with Down held, down-stab (LK-C22). In the air with neither held: forward stab. In the air with Up or Down held: no stab (the thrust continues), but the Red Ring fires a beam up or down (LK-C28). |
  | Up / Down held in the air | Up-thrust / down-thrust, while not stabbing or throwing (LK-C25, LK-C26). |
  | Down on the ground | Nothing by itself. No crouch. |
  | Special (C) | Throw the boomerang in one of 8 directions (LK-C30 to LK-C35). Always the boomerang in Classic, except with the dev `&kit=full`, where it uses the sub-weapon Select picked (LK-C38). |
  | Select | Place a bomb, once Link owns bombs (LK-C36). No tool cycling, except with the dev `&kit=full` (LK-C38). |
  | On a vine | No stab, boomerang, bomb or jump. Left/Right steps off as today. |
  | During knockback | All input ignored (LK-C17). |

- **LK-C2 Removed in Classic.** None of these exist in the Classic def. Current keeps all of them.
  - Hearts, heart containers and half-heart drops.
  - The magic meter, magic jars and the Jump, Shield and Fire spells.
  - The blocking shield. The shield is drawn but blocks nothing (LK-C39).
  - The crouch, the crouch slash and the 16 px crouch hitbox.
  - The tool belt and Select cycling (except the dev `&kit=full`, LK-C38). The white tunic and its glancing hits.
- **LK-C3 Guide and touch labels.** The Classic def has its own `guide` (TG-22). Short text is enough:
  - Attack "Stab. Up or Down + Attack stabs up or down." Up/Down "In the air: thrust." C "Boomerang. Aim with the arrows." Select "Bomb."
  - Mushroom "Blue Ring: stronger sword, and bombs." Flower "Red Ring sword beam, Magic Boomerang, Magic Sword, Bomb Bag, Quiver."
  - Touch labels: attack `SWORD`, special `BOOMERANG`, select `BOMB`.

### Movement

- **LK-C4 Hitbox.** 12 × 16 px in every power state, the same as small Mario. Link does not grow. The original's body rectangle is 13.5 × 15 px in every frame of `LinkMc` (SWF), the same as small Mario's (13 × 15 px), and our small Mario uses 12 × 16. The sprite is drawn bottom-aligned on the hitbox (see Open question 3).
- **LK-C5 Walking.** No acceleration, no skid and no slide.

  | Constant | Value |
  |---|---|
  | Walk speed | 1.458 px/f (`0x01755`), set on the first frame Left or Right is held |
  | Release | vx = 0 on the next frame, on the ground and in the air |
  | Left and Right both held | vx = 0 |
  | Run | none (`canRun: false`) |
  | Air control | the same as the ground: holding a direction sets ±1.458 px/f at once, nothing held sets 0 |

  This applies to every airborne state: jumps, walking off a ledge, spring launches, thrust bounces and falls. A wall on that side blocks the move.
- **LK-C6 Rooting.** While a stab or a throw is playing (the attack state, 15 f, LK-C23) and Link is on the ground, vx = 0 and Left/Right do not turn him. In the air he steers and turns freely during a stab or throw. If he lands during an air stab, vx = 0 from the landing until it ends.

### Jumping

- **LK-C7 Jump constants.**

  | Constant | Value |
  |---|---|
  | Takeoff speed | 5.0 px/f (`0x05000`), whatever the walk speed |
  | Gravity | 0.1806 px/f² (`0x002E4`), rising and falling alike |
  | Fall speed cap | 6.667 px/f (`0x06AAB`), clamped (no SMB1 reset) |
  | Takeoff frame | the original adds gravity before moving, so the first frame rises 4.819 px. In our move-then-gravity order, use an initial speed of `0x04D1C` (4.819 px/f) to get the same arc. |

  The same rule holds for every launch of Link's body in this report: the water jump (LK-C12) and the thrust bounce
  (LK-C25). Projectiles need no change: our projectile code already adds gravity before it moves
  (`projectile.ts:244-246, 265-270`).

- **LK-C8 Jump heights to hit** (frame-stepped from the constants):

  | Jump released after | Apex |
  |---|---|
  | never (held) | 66.8 px (4.2 tiles), apex on frame 28 |
  | 1 frame | 21 px |
  | 5 frames | 35 px |
  | 10 frames | 49 px |
  | 15 frames | 59 px |

- **LK-C9 Jump cut (soft).** The first release of Jump after a ground jump arms the cut. From then on, at the start of every frame while vy < 0, multiply vy by **0.8577** (`0.0001^(1/60)`). The cut stops once vy ≥ 0, and a later release does nothing. A down-thrust bounce or spring launch is cut only if that first release happens during its rise. Gravity still applies on top. This is a new mode, not our `variableJump: true` (hold gravity) or `'cut'` (zeroing).
- **LK-C10 When he can jump.** From the ground only. Not while a ground stab or throw plays (LK-C23). Not on a vine. No air jump, no coyote time and no jump buffer: a press during a ground stab is lost.
- **LK-C11 Springs.** Unchanged. The original's red and green springs use their own values, which `spring.ts` already copies (`SPRING_PLAIN`, `SPRING_BOOST`, `SPRING_GREEN_BOOST.link`, `SPRING_RISE_GRAVITY.link = 1300`). Link's own `DEF_SPRING_PWR 450` and `BOOST_SPRING_PWR 950` are dead code in the original.

### Swimming

Shared rules: [`2026-10-07-classic-swimming.md`](2026-10-07-classic-swimming.md). Link's values:

- **LK-C12 No stroke.** Jump works only from the floor, as on land (`floorJumpOnly`, TG-27).

  | Constant | Value |
  |---|---|
  | Water jump takeoff | 4.167 px/f (`0x042AB`); our initial speed `0x0418E` (4.097 px/f), as in LK-C7 |
  | Water gravity | 0.0694 px/f² (`0x0011C`) |
  | Sink cap | 2.083 px/f (`0x02155`). Link sets 500 px/s, but the shared water cap of 250 px/s wins. |
  | Floor jump height | about 123 px (7.7 tiles), frame-stepped |

  The jump cut (LK-C9) and air control (LK-C5) work the same in water. Every weapon works in water.

### Health and power-ups

Shared rules (power states, Lose Everything, invulnerability, drop rates, Star 12 s): [`2026-10-07-classic-power-states.md`](2026-10-07-classic-power-states.md). Link uses the stored tiers `small`, `big`, `fire` (TG-21).

- **LK-C13 Kit per power state.** No size change (LK-C4).

  | State | Tunic | Sword | Beam | Boomerang | Bombs | Bomb max | Arrow max |
  |---|---|---|---|---|---|---|---|
  | Small | green | 200 | no | short | only if kept from before (LK-C16) | 20, or 40 if the Bomb Bag was kept | 20 or 40 (unused) |
  | Mushroom (Blue Ring) | blue | 275 | no | short | yes | 20, or 40 if the Bomb Bag was kept | 20 or 40 (unused) |
  | Fire Flower (Red Ring) | red | 400 (Magic Sword) | yes | Magic | yes | 40 (Bomb Bag) | 40 (Quiver, unused) |

- **LK-C14 Mushroom.** Grants, in this order:
  - the Mushroom tier (sword 275);
  - the **Blue Ring** (blue tunic);
  - **Bombs**. If Link did not own bombs yet, set bomb ammo to **3**. If he did, his count is unchanged.
- **LK-C15 Fire Flower.** Grants the Fire tier plus:
  - the **Red Ring** (red tunic and the sword beam, LK-C28);
  - the **Magic Boomerang** (LK-C33);
  - the **Magic Sword** (sword 400);
  - the **Bomb Bag** (bomb max 40) and the **Quiver** (arrow max 40).

  A Fire Flower taken while Link already has the Fire tier adds **3 bombs** (up to the max). A ? block's choice between Mushroom and Flower follows the power-states report.
- **LK-C16 A hit (Lose Everything).** A hit while powered removes the Mushroom and Fire tiers, the Blue Ring, the Red Ring, the Magic Boomerang and the Magic Sword together. Link is small, green and back to sword 200. He **keeps** his bombs, his bomb count, the Bomb Bag and the Quiver (and the Bow, if ever owned). A hit while small kills him. Taking a Mushroom again later does not refill bombs (he already owns them).
- **LK-C17 Knockback.** Link's own hit response, applied by the shared helper (TG-28):

  | Constant | Value |
  |---|---|
  | Push speed | 4.167 px/f (`0x042AB`), horizontal, away from the source |
  | Vertical | none set: gravity keeps acting, so in the air he falls as he is pushed |
  | Facing | turned toward the source |
  | Ends when | he has moved **32 px**, or hits a wall on the push side, or after **72 f** (1200 ms), or grabs a vine |
  | During it | input ignored, no damage taken, no hits dealt; the attack state is cancelled |
  | Then | the shared 75 f invulnerability (power-states report) |

- **LK-C18 Ammo.**

  | Ammo | Start | Max | Max with upgrade | Per pickup | Per use |
  |---|---|---|---|---|---|
  | Bombs | 3 (first Mushroom) | 20 | 40 (Bomb Bag) | +2 | 1 |
  | Arrows | 5 (first Mushroom, only with the Bow choice); full with `&kit=full` | 20 | 40 (Quiver) | +2 | 1 |

  - An ammo pickup is always taken, even when full. The count is capped at the max.
  - During Star power, bombs and arrows cost nothing.
- **LK-C19 Drops.** Kills drop **bomb ammo only**, and only once Link owns bombs. Before that, nothing drops. Use the shared ammo-drop rates: 25 % per kill. Link also gets drops from bricks he breaks, at the shared brick rate (`_canGetAmmoFromBricks = true`). He gets none from coin blocks (`_canGetAmmoFromCoinBlocks` stays false). No hearts and no magic jars.
- **LK-C20 HUD.** No hearts and no meter. Once Link owns bombs, show the bomb icon and count. The power state shows as the shared Mushroom or Fire Flower icon (PS-C26), as well as the tunic colour (LK-C21). Nothing else.
- **LK-C21 Tunic palettes.** Green (`link`), blue and red (`link-red`). Add a blue palette (`link-blue`) in `content/sprites/link.ts`. `link-white` stays for Current.

### Weapons and attacks

Shared numeric damage, armour, piercing and hit-stun: [`2026-10-07-classic-enemy-hp-and-armour.md`](2026-10-07-classic-enemy-hp-and-armour.md). Damage below is in the original's units (Goomba 250 HP).

- **LK-C22 The stab.** Attack on the ground or in the air (LK-C1).

  | Pose | When | Box (relative to centre x, feet y) |
  |---|---|---|
  | Forward | Attack; on the ground or in the air with neither Up nor Down | x +6.8 to +19.3, y −9.5 to −3.5 (12.5 × 6 px, in front at waist height) |
  | Up-stab | Up + Attack on the ground | x −3.5 to +0.5, y −27 to −17 (4 × 10 px, above the head) |
  | Down-stab | Down + Attack on the ground | x −1.5 to +2.5, y 0 to +10 (4 × 10 px, under the feet) |

  - Half pixels are fine in subpixels. Boxes are from the SWF (`LinkMc` attack rectangle).
  - The down-stab reaches into the tile Link stands on. On a brick it breaks it and he drops (LK-C41). On a ? block it bumps it.
- **LK-C23 Stab timing.**
  - The box is live for the first **9 frames** (150 ms) from the press.
  - Then 3 recovery frames at 30 fps (6 f) play. The attack state lasts **15 frames** in all.
  - During the attack state: no second stab, no boomerang, no bomb, no ground jump, and rooted on the ground (LK-C6).
  - The boomerang throw and bomb placement use the same 15 f attack state, with no sword box.
  - Each enemy can be hit once per stab.
- **LK-C24 Sword damage.**

  | Sword | Damage | Goomba (250) | Koopa (600) | Hammer Bro (800) | Bowser, fire form (2400) |
  |---|---|---|---|---|---|
  | Small (Lv 1) | 200 | 2 | 3 | 4 | 12 |
  | Mushroom (Lv 2) | 275 | 1 | 3 | 3 | 9 |
  | Magic Sword (Lv 3) | 400 | 1 | 2 | 2 | 6 |

  - Every hit by the sword, beam, arrow or bomb also applies the **400 ms (24 f) stop and flash** to the enemy (HP report's hit-stun). A stopped enemy still hurts Link on contact (HP-C18).
  - **Pierce 0:** an armoured enemy takes no damage and no stop from the sword (the "armour" clink). A down-thrust still bounces off it.
  - Other enemies' HP and the hammer Bowser forms are in the HP report.
- **LK-C25 Down-thrust.**
  - Hold Down in the air while not stabbing or throwing. The down box (x −1.5 to +2.5, y 0 to +10) is live from the second frame of the hold, for as long as Down is held.
  - Landing on an enemy, or the box touching one, deals sword damage (LK-C24). Link bounces at **2.708 px/f (`0x02B55`), about 20 px** (our initial speed `0x02871`, LK-C7), and his feet snap to the enemy's top. Each landing counts as a new hit.
  - Landing on a brick or ? block: the brick breaks or the block is bumped, and he bounces the same way, his feet snapped to its top. Solid ground, pipes and used blocks do nothing.
  - The bounce does not use `stompBounce` (`0x04000`).
  - After an air stab ends with Up or Down still held, the thrust starts at once.
- **LK-C26 Up-thrust.**
  - Hold Up in the air while not stabbing or throwing. The up box (x −3.5 to +0.5, y −27 to −17) is live from the second frame of the hold.
  - It damages enemies (LK-C24), and Link's head hitting an enemy from below with Up held does too.
  - It breaks bricks and bumps ? blocks it touches, once per block per contact.
  - A hit on an enemy or a block while he is rising sets vy = 0 (the rise stops).
- **LK-C27 Thrusts and contact.**
  - Link cannot stomp. Landing on an enemy without a down-thrust hurts him, as today.
  - A thrust does not affect a still shell or a shell in its kick no-hit window, and that shell does not hurt him (as `thrustIgnoresShell` today).
- **LK-C28 Red Ring sword beam.**
  - Needs the Red Ring (Fire tier). Health is irrelevant.
  - **When it fires:**
    - after a stab, at the end of its 9 live frames (frame 9 from the press);
    - in the air with Up or Down held, at the moment Attack is pressed (no stab plays).
  - **Direction:**
    - Ground stab: forward, up or down, by the stab pose.
    - In the air: up if Up is held when it fires, down if Down is held, otherwise forward.

  | Constant | Value |
  |---|---|
  | Speed | 4.167 px/f (`0x042AB`) |
  | Damage | 200, pierce 0, plus the 24 f stop and flash |
  | Size | 16 × 3 px flying sideways, 3 × 16 px flying up or down |
  | Spawn, forward | centre x ± 10.5, feet − 6.5 |
  | Spawn, up | centre x − 1.5 (mirrored), feet − 20 |
  | Spawn, down | centre x + 0.5 (mirrored), feet + 3 |
  | On screen | **1**. A new beam can fire only when the last one has left the screen, or 21 f after it burst. |

  - On hitting an enemy (armoured or not) or a block, it **bursts** into 4 pieces. They fly diagonally at 0.958 px/f per axis for 20 px (21 f), starting 5 px out, and do no damage. The beam is free again when the burst ends.
  - A beam that leaves the screen is free again at once.
- **LK-C29 Beam vs ground and blocks.** The beam passes through solid ground, pipes and used blocks. It tests only enemies and bricks. The first empty brick it touches breaks (200 ≥ 125 HP). The first ? block it touches is bumped. Either way the beam bursts there. Our Current beam stops at the first solid tile (`hitsTiles: true` from `BUSTER`), so the Classic spec needs the "passes ground, stops at the first brick" flag from the bricks report (TG-26).
- **LK-C30 Boomerang throw.**
  - Special throws it in every power state.
  - Only one boomerang at a time.
  - It cannot be thrown while **2 or more** of Link's other projectiles are out (bombs, including exploding ones, beams and arrows). With exactly one non-boomerang projectile out, it can.
  - Throwing starts the 15 f attack state with no sword (LK-C23). Not on a vine or during a stab.
- **LK-C31 Boomerang directions** (by what is held at the press; diagonals use 0.75 × the speed on each axis):

  | Held | Direction | Starts at |
  |---|---|---|
  | Up only | straight up | centre x, top of head |
  | Up + Right / Up + Left | up-right / up-left | ± half the body width, top of head |
  | Neither Up nor Down | forward (facing) | ± half the body width, mid-body |
  | Down + Right / Down + Left | down-right / down-left | ± half the body width, feet |
  | Down only | straight down | centre x, feet |

- **LK-C32 Short boomerang (yellow), the default.**

  | Constant | Value |
  |---|---|
  | Speed | 2.5 px/f (`0x02800`); diagonal 1.875 px/f per axis |
  | Range | when the straight-line distance from the start point passes **75 px**, it brakes |
  | Brake | every frame, vx and vy × **0.7943** (`0.000001^(1/60)`); when either axis speed drops below 0.833 px/f it turns |
  | Reach | about 82 px (5 brake frames) |

  - **Turn:** reverse vx and vy, and switch to homing.
  - **Homing**, each frame:
    - On each axis, add `0.00694 × distance` px/f toward Link's centre (distance in px on that axis). Cap each axis at 2.5 px/f.
    - Within 15 px of Link on an axis: that axis also gets × 0.7943.
    - Within 40 px of Link (straight line): add 0.347 px/f (`0x0058E`) toward him on each axis.
  - It is caught (removed) when it touches Link's body after turning.
  - It also turns at once when its edge reaches the screen edge (top, bottom, left or right), or when it touches an enemy. It turns only once.
- **LK-C33 Magic Boomerang (blue), from the Fire Flower.** Speed 3.333 px/f (`0x03555`), diagonal 2.5 px/f per axis. No range limit: it flies until the screen edge or an enemy, then homes as in LK-C32 with `0.01667 × distance` instead of 0.00694, capped at 3.333 px/f per axis.
- **LK-C34 Boomerang effects.**
  - **No damage.** Stops each enemy it touches for **180 f** (3000 ms), with pierce 10, so it also stops armoured ones. It touches each enemy once per contact, both on the way out and back. A stopped enemy still hurts Link on contact (HP-C18).
  - It turns back on the first enemy it touches. Bowser and Lakitu resist the stop (HP-C15): Bowser is touched only once per throw and is not stopped (`LinkBoomerang.as:319-320`; `Bowser.as:95`).
  - It passes through all tiles. Bricks and ? blocks ignore it.
  - Size 8 × 8 px.
- **LK-C35 Boomerang fetch.**
  - It grabs every real item it touches: Mushroom, Fire Flower, Star, 1-up, bomb ammo, and items still rising out of a block. Level coins it passes through are taken off the map.
  - It does not grab vines, the flagpole, pipes or Bowser's axe.
  - Grabbed items hang under it and are delivered when Link catches it, exactly as if he had touched them (coins count then).
  - If the boomerang is removed any other way, the carried items are lost.
- **LK-C36 Bombs (Select).**
  - Needs bombs owned and at least 1 bomb (free during Star). At most **3** of Link's bombs on screen, counting exploding ones.
  - Placing one costs 1 and starts the 15 f attack state with no sword.
  - **Placement:** the bomb's centre x is centre x ± 13 px (ahead), and its bottom is at Link's feet. If that spot is inside a wall, it goes at Link's centre x.
  - **Fall:** gravity 0.139 px/f² (`0x00239`). It rests on any ground, brick or platform.
  - **Fuse:** **60 f** (1000 ms). Before it explodes it touches nothing but the ground.
  - Size 9 × 13 px.
- **LK-C37 Bomb blast.**

  | Constant | Value |
  |---|---|
  | Box | 32 px wide, centred on the bomb's x; from 24.5 px above to 15.5 px below the bomb's bottom (32 × 40 px) |
  | Duration | 32 f (16 animation frames at 30 fps); the bomb stops moving |
  | Damage | 800, pierce 10, plus the 24 f stop and flash |
  | Players | never hurts Link or player 2 |

  - Each enemy in the box is hit once. An enemy that walks in during the 32 f is hit too.
  - Every brick or ? block the box overlaps breaks (800 ≥ 125) or is bumped, including the block the bomb rests on. Hidden blocks are struck too (BR-C11).
- **LK-C38 Arrows (built, reached only through `&kit=full`).** With the default Link weapon (Bomb), the power-ups never give the Bow, so no arrows appear and the Quiver does nothing. Build them anyway. The dev `&kit=full` (TG-44) is the only way to reach them:
  - It gives the Fire Flower state, bombs and the Bow, with full bomb and arrow ammo.
  - **Select** cycles the sub-weapon among boomerang, bombs and arrows; **Special** uses the selected one (the original's non-Classic scheme, `Link.as:1191-1209, 1250-1265`). Drops stay bomb ammo while he owns bombs (`Link.as:1403-1411`).
  - Without `&kit=full`, Select places bombs and Special throws the boomerang (LK-C1).
  - For reference, the original's Bow choice (Customize Weapons, out of scope) makes the Mushroom grant the Bow instead of bombs, with **5** arrows, Select shoot an arrow, drops arrow ammo (+2) and a second Flower add 5 arrows.
  - **Arrow:** needs the Bow and 1 arrow (free during Star). It starts the 15 f attack state. Speed 4.167 px/f (`0x042AB`), damage 350, pierce 0, plus the 24 f stop and flash. Size 16 × 3 px (3 × 16 vertical). No on-screen cap.
  - **Direction:** up if Up is held, down if Down is held, otherwise forward. Same spawn points as the beam's forward, up and down (LK-C28).
  - **Ground and blocks:** it passes through solid ground, pipes and used blocks. The first enemy, empty brick (breaks: 350 ≥ 125) or ? block (bumped) it touches stops it.
  - Hits to kill: Goomba 1, Koopa 2, Hammer Bro 3, fire Bowser 7.

### Special abilities

- **LK-C39 Shield is cosmetic.** The shield is drawn (side, front, up or down poses as he stabs), but it never blocks a projectile. The Classic def has no `blocks` hook, and no `block` idle frame is needed.
- **LK-C40 No item-raise pose.** Mushroom, Flower and Star play the ordinary power-up pickup, not Link's arms-raised item pose. Going up a state still freezes the game for the shared 60 frames (PS-C4; `Character.as:1566, 1584, 1988-2002`); a Star or a repeat Flower does not.

### Interactions

Shared brick rules (125 HP, side bumps): [`2026-10-07-classic-bricks-and-shots.md`](2026-10-07-classic-bricks-and-shots.md).

- **LK-C41 What breaks bricks.**

  | Source | Empty brick | ? block / item brick | Solid ground, pipes, used blocks |
  |---|---|---|---|
  | Head (any state) | bumps only (`canBreakBricks: () => false`) | bumped from below | solid |
  | Forward stab, up-stab, down-stab, both thrusts | breaks at once (melee ignores HP) | bumped from the side, top or below | no effect |
  | Down-thrust landing | breaks, and Link bounces 20 px | bumped, and Link bounces | lands normally |
  | Sword beam (200) | breaks; beam bursts | bumped; beam bursts | passes through |
  | Arrow (350), `&kit=full` only | breaks; arrow stops | bumped; arrow stops | passes through |
  | Bomb blast (800) | breaks every brick in the box | bumped | no effect |
  | Boomerang | passes through | passes through | passes through |

- **LK-C42 Bowser.** Fire Bowser (2400): sword 12 / 9 / 6 stabs by tier, beam 12, bombs 3, arrows 7. The boomerang touches him once per throw but does not stop him (LK-C34). Other forms: HP report.
- **LK-C43 Vines.** On a vine: no stab, boomerang, bomb, arrow or jump. Grabbing a vine ends a knockback (LK-C17).
- **LK-C44 Two players.** Both Links play Classic. The boomerang count (LK-C30) and the bomb count (LK-C36) are per player. Neither player's bomb hurts the other.

### Feel

- **LK-C45** Taken together: digital "Zelda" control. He starts and stops dead, also in the air. A tap gives a 21 px hop, and a hold gives a snappy 67 px jump with a 6.67 px/f fall. Every ground stab or throw commits him for 15 f. Thrust bounces are small (20 px). No Classic setting adds a ramp, drift, coyote time or jump buffer.

## Actual

Current Link (stays the default):
- **Movement:** ramps to 1.5 px/f over about 19 frames (`minWalk 0x180`, `walkAccel 0x140`), and slides to a stop (`src/game/characters/link/index.ts:15-34`). In the air he keeps his speed when the d-pad is released (`src/game/entities/player.ts:455`). He walks and jumps while slashing (`index.ts:301-317`).
- **Jump:** fixed 4.75 px/f, gravity 0.156, fall cap 4.5 px/f, `variableJump: false`. It reaches 75 px played (`index.ts:25-31`).
- **Health:** 3 to 8 hearts (`index.ts:36, 221-227`). Half a heart per hit, with the white tunic glancing every other hit (`index.ts:374-392`). 60 f invulnerability and a 2.5 px/f pop-up knockback (`index.ts:225-226`; `src/game/world/world.ts:1440-1451`). Power-ups are never lost.
- **Extras:** a magic meter with 3 spells (`index.ts:37-44, 176-185`), a blocking shield (`index.ts:78-88, 322-325`), a crouch (`index.ts:229-231`) and a tool belt (`index.ts:132-140`).
- **Sword:** `{ kind: 'sword', amount: 1 }` kills ordinary enemies in one hit, with no hit-stun (`world.ts:1263-1275`; `src/game/rules/damage.ts:51`). Only the up-thrust strikes blocks (`index.ts:283-298`). The down-thrust bounces with `stompBounce` at 4 px/f, about 51 px (`index.ts:319-321`; `player.ts:517-523`).
- **Beam:** needs the red tunic and full hearts, or the Fire spell. Forward only, at 3 px/f (`index.ts:304-309`). It stops at the first solid tile without breaking it (`SWORD_BEAM` spreads `BUSTER`, `hitsTiles: true`; `src/game/entities/projectiles/projectile.ts:83-99, 110-118, 237-243`).
- **Boomerang:** forward only, 3 px/f, turns back after 36 frames (about 108 px), stuns 180 f, no item fetch, no Magic version (`index.ts:46-65, 157-164`; `damage.ts:56-61`).
- **Bombs:** up to 8 carried, +1 per drop, no on-screen cap, a 90 f fuse and a 56 px square blast that **hurts Link** and breaks bricks (`index.ts:38, 165-175`; `src/game/entities/objects/bomb.ts:7-8`; `world.ts:611-642`).
- **Others:** no arrows. Drops are bombs, magic and half hearts (`index.ts:240-246`). Hitbox 12 × 24 px (`index.ts:231`). Every hero gets the shared stroke in water (`player.ts:16`).

## How often

every time

## Notes

**Sources.** Original files are under `$S/orig/src/com/smbc/`. Line numbers are after `tr '\r' '\n'`.
- Controls, rooting, jump rules (LK-C1, C6, C9, C10): `characters/Link.as` 609-664 (`movePlayer`), 706-718 (`jump`), 774-780 (jump cut, `fy = .0001` at 422), 1168-1189 (jump buttons), 1191-1210 (Special), 1250-1265 (Select in Classic), 1267-1275 (Attack); `data/GameSettings` defaults per FINAL-REPORT C1/C12. Sub-weapon default: `managers/StatManager.as` 1136-1139 (null, so the boomerang).
- Constants (LK-C5, C7, C12, C17): `Link.as` 198-199, 211-221, 259, 401-438 (`setStats`; water 410-417); `characters/Character.as` 207 (75 f), 225 and 997-998 (water sink cap). Physics order: `main/AnimatedObject.as` 179-188 (`updateStats`, then gravity, then move), 254-283.
- Hitbox and sword boxes (LK-C4, C22, C25, C26): SWF `$S/flash/smbc3.swf`, symbol `MovieClipInfo_LinkMc`: `HRect` x −13.5..13.5, y −30..0 Flash px in every frame; `ARect` on `attackStart` x 13.6..38.6, y −19..−7; on `attackDownStart` and `dwnThrustEnd` x −3..5, y 0..20; on `attackUpStart` and `upThrustEnd` x −7..1, y −54..−34. Parsed with `$S/classic/link-work/swf/rects.py`. Box live only on those frames: `Link.as` 829-834. Frame lengths (LK-C23): `LinkMc` labels `attackStart` 6, `attack-2` 7, `attackEndGround` 8-9 (and the up/down equivalents); `ATK_DUR 150` (211); `ANIM_FAST_TMR` 33.3 ms (`data/AnimationTimers.as` 13, 20); `Link.as` 1277-1292, 1509-1533.
- Power states and kit (LK-C13 to C16, C18 to C21): `Link.as` 95-96, 112-136, 524-552 (`setSwordType`), 905-1030 (`hitPickup`), 1388-1420 (`updAmmoMax`, `updDrops`), 672-687 (tunics); `Character.as` 1902-1953 (ammo caps; free in Star at 1904 and 1940), 372-373 and `Link.as` 339 (drops from bricks, not coin blocks). Lose Everything keeps the bomb items: verify/B.md row 1.
- Knockback (LK-C17): `Link.as` 449-459, 728-737, 1077-1088, 1299-1311, 1327-1375.
- Damage and hit-stun (LK-C24): `data/DamageValue.as` 18-23; `Link.as` 327-328 (400 ms flash and stop); `Character.as` 449 (pierce property), 739-767; `enemies/Enemy.as` 594-626 (pierce checked first, `StatusProperty.as` 39 order).
- Thrusts (LK-C25 to C27): `Link.as` 781-827, 836-854, 1098-1165; `Character.as` 2645-2653 (`bounce`); `data/HitTester.as` 155-163 (attack box vs bricks); `ground/Brick.as` 211-222 (`hitByAttack`).
- Beam (LK-C28, C29): `Link.as` 225, 1273-1274, 1293-1297; `projectiles/LinkProjectile.as` 35-41, 100-110, 160-236, 237-263, 283-291; `projectiles/LinkSimpleGraphics.as` 21-23, 64-124; `projectiles/Projectile.as` 39-45 (player shots test only enemies and bricks), 135-147; `Brick.as` 174-192, 223-228. SWF `LinkProjectileMc` HRect 32 × 6 Flash px.
- Boomerang (LK-C30 to C35): `projectiles/LinkBoomerang.as` 35-39, 47-93, 94-159, 177-266, 293-352; `Link.as` 251, 1196-1204; `pickups/Pickup.as` (`_boomerangGrabbable` for `REG_` and `UPG_` types), `Coin.as` 37, `PipeTransporter.as`; `data/PickupInfo.as` 29-31, 40-50, 194-199.
- Bombs and arrows (LK-C36 to C38): `Link.as` 144, 1212-1248; `LinkProjectile.as` 34, 43, 66-98, 115-158. Blast box: SWF `LinkProjectileMc` HRect x −32..32, y −49..31 Flash px on `bombExplosionStart`..`bombExplosionEnd` (frames 6-21). Blast vs bricks: verify/B.md row 2 (`HitTester.as` 183-186, `Projectile.as` 98-104, `Brick.as` 181-192). No self-damage: `Character.as` 2632-2638; `Link.as` 893-898.
- Springs (LK-C11): `ground/SpringRed.as` 19-20, 68-73.
- Shield (LK-C39): `Link.as` 1628-1642; no hit code reads `LinkShield`.
- Where it lands in ours: a new `src/game/characters/link/classic.ts` (`LINK_CLASSIC`) and `link/classic-weapons.ts`; `content/sprites/link.ts` (blue palette); the optional profile and behaviour fields below in `src/game/characters/profile.ts`, `character.ts` and `src/game/entities/player.ts`.

**Implementation hints.**
- `LINK_CLASSIC` copies `LINK`'s `id`, `name`, `hudName`, `portrait` and `music` (TG-18). It has `damage: { kind: 'powerup', states: ['small', 'big', 'fire'] }`, `crouches: false`, `stomps: false`, `canBreakBricks: () => false`, `hitbox: () => ({ w: 12, h: 16 })`, and no `meter`, `blocks`, `devKit` hearts or spell code. Its `tools` returns only the bomb count, for the HUD (LK-C20), and Select places a bomb instead of `cycleTool`. With `&kit=full`, `tools` lists boomerang, bombs and arrows and Select calls `cycleTool` (LK-C38).
- Profile: `instantAccel: true`, `maxWalk 0x01755`, `canRun: false`, jump tier `initial 0x04D1C`, both gravities `0x002E4`, `maxFall`/`fallReset 0x06AAB`, `swim` with `floorJumpOnly`, stroke `0x0418E` (LK-C12), gravity `0x0011C`, sinkMax `0x02155`.
- Two optional profile fields that other Classic heroes also need. Absent means today's code runs:
  - `airStop: true`. `airMove` returns early on `dir === 0` (`player.ts:455`); with this flag set, vx = 0 instead. The Simon report proposes the same name.
  - A soft jump cut, for example `variableJump: 'soft'` with `jumpCutMul: 0.8577`. Apply it before the move (near `player.ts:233`), once armed by the first release (LK-C9). The Mega Man report needs a similar soft cut; share one field.
- Rooting (LK-C6): set `body.vx = 0` before movement while the attack timer runs and Link is on the ground. Use a `canWalk` hook, as in the Simon report, and block the ground jump in the same state.
- Melee damage: use TG-24's `meleeDamage` hook to return 200 / 275 / 400 with pierce 0 and the 24 f stop. Give `activeMelee` boxes per pose, and send melee-vs-block through TG-25's `strikeBlock` with "melee breaks at once".
- Down-thrust bounce: a Classic `onMeleeHit` sets `vy = -0x02871` (LK-C25) and snaps the feet. It does not call `stompBounce`. Do the same on a brick touched by the down box.
- Beam and arrow: specs in `classic-weapons.ts` with the bricks report's "passes ground, stops at the first brick" flag (TG-26). The burst and the one-beam lock live in Link's scratch (for example `beamLockT = 21` after a burst).
- Boomerang: a new entity class in `classic-weapons.ts`, not `Projectile.returns`, because of the brake, the homing and the fetch. Fetch can reuse the world's pickup path on catch.
- Bomb: reuse `Bomb` (`bomb.ts`) with `fuse: 60` and `hurtsPlayers: false`. Add an optional blast-box option and a blast that lasts 32 f, or a small `ClassicBlast` entity in `classic-weapons.ts`. Current `explode()` stays as it is.
- Knockback and invulnerability go in the shared Classic helper (TG-28), with Link's numbers from LK-C17.

**Acceptance checks** (headless where possible).
- Jump apex from standing: held 66-68 px; released after 1 f 20-23 px; after 10 f 48-50 px. Apex on frame 27-29. Fall speed never above 6.667 px/f.
- Walk: vx = `0x01755` on the first frame Right is held. vx = 0 on the frame after release, on the ground and in mid-air.
- Rooting: a ground stab with Right held keeps x unchanged for 15 f. A jump pressed on frame 5 of a ground stab does nothing.
- Small Link: 2 stabs kill a Goomba, 3 a Koopa. Mushroom: 1 stab kills a Goomba. Flower: 2 kill a Koopa. Each stab freezes the enemy for 24 f.
- A forward stab beside an empty brick breaks it. A down-stab while standing on a brick breaks it. A down-thrust onto a brick breaks it and bounces Link 19-21 px. An up-thrust into a ? block bumps it and sets vy = 0.
- With the Flower, a forward beam fired at a pipe passes through it and breaks a brick behind it. A second Attack while the first beam is on screen fires no beam.
- Bombs: 3 bombs out, a 4th Select does nothing. Link standing on the bomb is unhurt. The brick under the bomb and a brick beside it break. The count drops by 1 per bomb.
- Boomerang: the short one turns 80-84 px from its start and is caught. The Magic one reaches the screen edge. A Mushroom it touches is delivered to Link. A boomerang cannot be thrown with 2 bombs out.
- Lose Everything: Flower Link with 10 bombs takes a hit and is small with 10 bombs and a max of 40.
- Swimming: Jump in mid-water does nothing. A floor jump rises 120-128 px.
- Current unchanged: the golden parity test (TG-36) and all existing tests pass. `?dev=1&level=1-1&char=link` still shows hearts, magic, the crouch and the 75 px jump.

**Confidence.**
- The original was not played for Link. Every original number is from source or SWF data, cross-checked against `chars/link.md`, FINAL-REPORT 3.2 and the errata `verify/B.md`. The errata override the unit: bombs break bricks, a hit keeps the bomb items, our beam stops at tiles, and our ramp takes about 19 f.
- Computed estimates: jump heights (frame-stepped, gravity before move, 1/60 s steps), the water jump (125 px), boomerang reach (about 82 px), stab length (15 f, ±1 f with the 30 fps animation timer) and the beam lock after a burst (21 f).
- From my SWF parse (new, not in the unit): Link's 13.5 × 15 px body, the sword boxes and the 32 × 40 px blast box. These are the clip's own rectangles, so they should be exact, but no one has checked them in play.
- Ours: from source, plus the played numbers in `chars/link.md` (75 px jump, air drift, 76 px in the first 60 frames).

**Open questions** (each with a default to use meanwhile).
1. Physics step: the stage runs at 30 fps but the game loop timer at 60 Hz (FINAL-REPORT section 7). **Default:** 1/60 s steps, as above.
2. Armoured enemies vs the sword: by source the sword, beam and arrows do nothing to them, but a down-thrust still bounces. **Default:** as source (LK-C24); the HP report owns the armour list.
3. Hitbox 12 × 16 vs our 24 px tall Link art. The head will overlap tiles above him, and he will fit through 1-tile gaps, as in the original. **Default:** 12 × 16. If the owner dislikes it in play, keep 12 × 24 and note the difference.
4. Exactly which frame the beam fires relative to the 30 fps animation. **Default:** frame 9 from the press.
5. Whether weapons can reveal hidden blocks. **Default:** yes, as the bricks report says (BR-C11): neither the shot nor the melee path checks visibility.
6. Cosmetics left out on purpose: the somersault jump frames (140 ms flip), the Zelda death spin and the item fanfare. Not required; the follow-ups report can list them.

**Related reports.**
- [`2026-10-07-dev-classic-smbc-rules-toggle.md`](2026-10-07-dev-classic-smbc-rules-toggle.md): the toggle, `heroFor`, hooks TG-21 to TG-28, the parity test.
- [`2026-10-07-classic-power-states.md`](2026-10-07-classic-power-states.md): power states, Lose Everything, 75 f invulnerability, ammo drop rates, Star 12 s.
- [`2026-10-07-classic-enemy-hp-and-armour.md`](2026-10-07-classic-enemy-hp-and-armour.md): enemy HP, armour, piercing, the 400 ms stop, Bowser forms.
- [`2026-10-07-classic-bricks-and-shots.md`](2026-10-07-classic-bricks-and-shots.md): brick HP 125, side bumps, shots through solid ground.
- [`2026-10-07-classic-swimming.md`](2026-10-07-classic-swimming.md): floor-jump-only heroes.
- [`2026-10-07-simon-classic-smbc-rules.md`](2026-10-07-simon-classic-smbc-rules.md) and [`2026-10-07-megaman-classic-smbc-rules.md`](2026-10-07-megaman-classic-smbc-rules.md): the same `airStop`, rooting and soft-cut fields.
- [`2026-10-07-classic-follow-ups.md`](2026-10-07-classic-follow-ups.md): the Customize Weapons menu (Bow), the Princess Zelda skins, Modern mode.
- Existing: `2026-10-06-water-non-mario-heroes-stroke.md` (Link has no stroke; this report gives his Classic values) and `2026-10-06-water-surface-air-physics.md` (surface physics, shared).
