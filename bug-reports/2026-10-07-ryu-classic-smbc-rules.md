# Classic SMBC rules for Ryu: wall climbing, fixed jump, instant walk, power states with Sword Extension and Scroll, the original's five ninpo arts, sword and ninpo that break bricks

- **Severity:** feature request (Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=ryu` (once the toggle exists; today `?dev=1&level=1-1&char=ryu` shows the Current behaviour)
- **Character and power:** Ryu, all power states
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=ryu` (Current). Walk right to the first pipes (F1 shows the columns). Jump at the side of a pipe and hold toward it. He clings. Press Up: nothing happens. Press Jump: he kicks off into a full 70 px jump.
2. Open `?dev=1&rules=classic&level=1-1&char=ryu` and do the same. He clings, and stays on when you let go of the arrow. Up and Down climb at 1 px/f. Jump alone does nothing on the middle of the wall. Away + Jump is a 15 px hop. At the top of the pipe, Jump without away is a 31 px hop that lands him on top.
3. In both modes, walk and press X. Current: he keeps walking while slashing. Classic: he stops for the slash. Tap and hold Z. Current: 19 px tap, 70 px hold. Classic: about 55 px every time.
4. In both modes, jump under the first brick row. Current: his head breaks a brick. Classic: the brick only bumps. In Classic, jump beside a brick and slash it: it breaks. Press C: the HUD shows ninpo 25, one shuriken flies at 5 px/f, and a second press does nothing until the first is gone.
5. In Classic, take a Mushroom and then a Fire Flower (Dev mode `&kit=full` is quicker). Press Select: a Windmill Shuriken flies out and swings back to him.

## Expected

Classic Ryu is a separate `CharacterDef` (`src/game/characters/ryu/classic.ts`, plus `classic-weapons.ts`) chosen by the registry when `ctx.rules === 'classic'`. All numbers are in our units. 1 tile = 16 px. Hex speeds are in our velocity units (1 px/f = `0x01000`). The original's Flash px/s ÷ 120 = px/f, and its px/s² ÷ 7200 = px/f². Times are in frames at 60 fps. "Centre" is the centre of his hitbox in x; "feet" is the bottom of his hitbox.

Shared rules that this report only states Ryu's values for:
- Power states, Lose Everything, hit response, drops and Star length: [`2026-10-07-classic-power-states.md`](2026-10-07-classic-power-states.md).
- Enemy HP and armour: [`2026-10-07-classic-enemy-hp-and-armour.md`](2026-10-07-classic-enemy-hp-and-armour.md).
- Bricks, ? blocks and shots through solid ground: [`2026-10-07-classic-bricks-and-shots.md`](2026-10-07-classic-bricks-and-shots.md).
- Water: [`2026-10-07-classic-swimming.md`](2026-10-07-classic-swimming.md).

### Controls

- **RY-C1 Buttons.**

  | Button | On the ground | In the air | On a wall | On a vine |
  |---|---|---|---|---|
  | Left / Right | Walk (instant, RY-C4) | Full air control | Nothing (Away matters only with Jump or a throw) | Climb off, as today |
  | Up / Down | Down: crouch | Nothing | Climb up / down (RY-C11) | Climb |
  | Jump (Z) | Fixed jump (RY-C7) | Nothing | See RY-C12 | Nothing |
  | Attack (X) | Sword slash; he stops (RY-C25) | Air slash; air control stays | Throws the main art (RY-C14) | Nothing |
  | Special (C) | Throws the main art | Throws the main art, or starts the Jump Slash if that is the main art | Throws the main art (Jump Slash: nothing) | Nothing |
  | Select | With the Fire Flower: throws the extra art. Without it: nothing. With the dev `&kit=full`: cycles the main art instead (RY-C2) | Same; starts the Jump Slash if that is the extra art | Same as Special, for the extra art | Nothing |

  - Attack, Special and Select are ignored during a slash or a throw. Attack is also ignored during a Jump Slash.
  - Jump during a ground slash or ground throw cancels it and jumps. If the throw had not reached its spawn frame (RY-C34), nothing is thrown and no ninpo is spent.
  - Landing ends an air slash or air throw at once (the same rule: an unspawned throw is lost, nothing spent).
  - During knockback (RY-C22) all input is ignored.
  - "Up + Attack acts as Special" is an original option that is off by default. It is absent.
- **RY-C2 Two art slots, no belt.** Classic Ryu has a **main art** (thrown by Attack-on-wall and Special) and an **extra art** (thrown by Select, only while he has the Fire Flower). There is no belt, no cycling (except the dev `&kit=full` cycle below) and no art menu.
  - Defaults: main = **Shuriken**, extra = **Windmill Shuriken** (`GameSettings.as` 227-228). Put both in `classic.ts` as constants (`CLASSIC_MAIN_ART`, `CLASSIC_EXTRA_ART`) so the Customize Weapons follow-up can change them.
  - The Art of the Fire Wheel, the Fire Dragon Ball and the Jump Slash must be fully built (RY-C29 to RY-C31). With the default choices no Classic pickup hands them out. The original's blocks give only the Mushroom or the Fire Flower in Classic (`StatManager.getRandomUpgrade`).
  - The dev `&kit=full` (TG-44) is the only way to reach them (RY-C38). **Select** then cycles the main art (the one
    Special and Attack-on-wall use) through Shuriken, Windmill Shuriken, Fire Wheel, Fire Dragon Ball and Jump Slash,
    instead of throwing the extra art.
  - If a later change lets him pick up an art, it replaces the main art (the original's `SINGLE_UPGRADES_ARR`).
- **RY-C3 Touch and guide.** The touch labels read SLASH (Attack), the main art's name (Special) and the extra art's name (Select, greyed out without the Fire Flower). The in-game guide gets a Classic variant that describes these rules.

### Movement

- **RY-C4 Instant walk.** The speed is **1.5417 px/f (`0x018AB`)** at once, with no acceleration and no deceleration. It is the same on the ground and in the air. No input, or Left + Right together, sets vx to 0 the same frame. There is no run (`WALK_SPEED 185`, `Ryu.as` 179, 401-402, 567-596).
- **RY-C5 He stops while attacking on the ground.** On the ground, vx = 0 for the whole slash or throw, and while Down is held (crouch). In the air, the slash and the throw keep full air control (`Ryu.as` 546-552).
- **RY-C6 Crouch.** Down on the ground crouches. He cannot walk while crouching. Attack gives the crouch slash and Special gives the crouch throw. Keep our crouch hitbox (12 × 16 px).

### Jumping

- **RY-C7 Fixed jump.**

  | Constant | Original | Ours (Classic) |
  |---|---|---|
  | Jump speed | 565 px/s | **4.7083 px/f (`0x04B55`)** |
  | Gravity, rising and falling | 1400 px/s² | **0.1944 px/f² (`0x0031C`)** |
  | Fall cap | 700 px/s | **5.8333 px/f (`0x05D55`)**, a clamp (`fallReset` = the same value) |
  | Our `initial` | — | **4.5139 px/f (`0x04839`)**: the jump speed minus one frame of gravity. The original adds gravity before it moves; ours moves first, so this gives the original's arc frame for frame |
  | Apex | 114 Flash px continuous | **about 55 px** (54.7 px stepped in the original's order; 3.4 tiles) |
  | Variable height | none | none: releasing Jump does nothing |
  | Coyote time | none (jump needs `onGround`) | 0 frames |

  Source: `Ryu.as` 180, 184, 188, 850-859. The jump height is the same while walking and standing.

  The same rule holds for every launch of his body in this report: the wall hops (RY-C12), the water jump (RY-C17)
  and the knockback (RY-C22). Projectiles need no change: our projectile code already adds gravity before it moves
  (`projectile.ts:244-246, 265-270`).
- **RY-C8 Springs.** These are unchanged. Ours already uses his values (red 4.17 / 8.33 px/f, green 22.9 px/f, `Ryu.as` 186-187).
- **RY-C9 Stomping.** He cannot stomp (as today, `stomps: false`).

### Wall cling and climb (Special abilities)

- **RY-C10 Grabbing a wall.** He grabs a wall when **all** of these hold (`Ryu.as` 1151-1211):
  - He is airborne, and was also airborne on the previous frame.
  - He is pressing toward the wall (or he was just re-attached after his brick broke, RY-C16).
  - His side touches the wall.
  - The wall is beside his **upper probe** (10 px below the top of his hitbox) or his **lower probe** (12.5 px above his feet). The lower probe may be up to 5 px below the bottom of the wall.
  - He is not in knockback.

  On the grab:
  - If his lower probe hangs below the bottom of the wall, raise him in 1 px steps until the probe is level with the wall's bottom edge. The original does this only when he touches a single ground piece. For tiles, apply it when the wall column ends above the probe.
  - vx = vy = 0, gravity off, and he faces the wall.
  - An air slash or a Jump Slash ends.
  - His head stops bumping blocks (RY-C35).
  - The jump sound plays.

  Any wall works: pipes, blocks, bricks, ? blocks, used blocks and the screen-edge walls our tiles report as solid.
- **RY-C11 Holding and climbing.** Once on, he **stays on with no input**. Letting go of the arrow does not drop him (`movePlayer` returns early in `ST_CLIMB`, `Ryu.as` 554-565).
  - **Up** climbs at **1 px/f (`0x01000`)** while the wall is beside his upper probe.
  - **Down** climbs at 1 px/f while the wall is beside his lower probe.
  - With neither, both, or at a limit, vy = 0.
  - He does not slide.
  - Source: `CLIMB_SPEED 120`, `CLIMB_TOP_OFS 20`, `CLIMB_BOT_OFS 25` Flash px; `Ryu.as` 189, 194-195, 719-765.
- **RY-C12 Leaving the wall** (`Ryu.as` 825-849, 864-879). "Top of the wall" means the wall does not reach the point 5 px above the top of his hitbox (`CLIMB_TOP_JUMP_OFS -10`).

  | Input | Mid-wall | At the top of the wall |
  |---|---|---|
  | Away + Jump | Hop: vy **−2.5 px/f (`0x02800`; our initial `0x024E4`)**, about **15 px** high, vx 1.5417 px/f away (from RY-C4 input) | The same 15 px hop |
  | Jump alone (or toward + Jump) | **Nothing** | Hop: vy **−3.5833 px/f (`0x03955`; our initial `0x03639`)**, about **31 px** high. vx follows input, so toward + Jump carries him onto the top |
  | Down + Jump | Lets go: vy 0, he falls | Lets go |

  - After the 31 px top hop he cannot re-grab the **same wall edge** for **15 frames** (`CANCEL_GRAPPLE_TMR` 250 ms). Other walls can be grabbed at once.
  - There is no lock after the 15 px hop.
  - Every hop uses normal gravity and the fall cap (RY-C7).
  - Wall hops are not cut by releasing Jump.
- **RY-C13 Other ways off.** He lets go (vy 0, falling state) when:
  - He climbs down onto the floor. He stands.
  - A knockback starts (RY-C22).
- **RY-C14 Throwing from the wall.** Attack or Special throws the main art. Select throws the extra art (Fire Flower only). Limits, costs and one-per-type apply as on the ground (RY-C32) (`Ryu.as` 887-891, 1020-1031).
  - **Default direction: his facing, which is into the wall.** The shot spawns 10 px from his centre toward the wall, 22.5 px above his feet, and flies through the wall (thrown ninpo ignore solid ground, RY-C36).
  - **Holding Away:** the shot goes away from the wall. It spawns 20 px from his centre on the away side, 22.5 px above his feet (`RyuProjectile.as` 25-28, 173-203).
  - During the wall throw he cannot climb, hop or throw again. vy = 0. The throw lasts as long as a ground throw (RY-C34).
  - The Jump Slash cannot be started on a wall.
- **RY-C15 Lifts.** He grabs the side of a moving lift the same way (airborne, pressing toward it, touching its side) (`Ryu.as` 500-541, 829-847, 1143-1180).
  - When he grabs it, his centre goes to the lift's vertical centre, flush against its side.
  - He rides it: each frame his x stays flush and his vertical centre stays on the lift's centre.
  - He **cannot climb** on a lift. Up and Down do nothing.
  - **Any Jump except Down + Jump gives the 31 px top hop**, with or without Away. Down + Jump lets go.
  - After that hop he cannot grab **any** lift for 15 frames.
  - He lets go if the lift's side or centre ends up more than 15 px from where he should be (`MAX_PLAT_DIST 30` Flash px), or if his head hits a ceiling.
  - Balance lifts and falling lifts count as lifts.
- **RY-C16 The brick he clings to breaks.** If a brick in the wall he holds breaks (for example, a shot of his passes through it), he lets go and re-grabs at once if wall is still beside a probe. Otherwise he falls (`Brick.as` 276-288).

### Swimming

- **RY-C17 No swim stroke.** In water, Jump works only from the floor or from a wall. There is no mid-water stroke (`Ryu.as` 180-185, 390-396, 486-499). Water constants:

  | Constant | Original | Ours |
  |---|---|---|
  | Jump from the floor | 400 px/s | **3.3333 px/f (`0x03555`)**; our initial `0x03439` (RY-C7) |
  | Gravity | 500 px/s² | **0.0694 px/f² (`0x0011C`)** |
  | Sink cap | 250 px/s | **2.0833 px/f (`0x02155`)** (the shared value) |
  | Floor-jump apex | 160 Flash px continuous | **about 78 px** (stepped in the original's order) |

  - Wall cling, climbing and throws work in water as on land.
  - Wall hops keep their speeds (2.5 / 3.5833 px/f) but use water gravity. That gives about 44 px and 91 px (inferred).
  - Walking speed is unchanged.
  - The rest follows the swimming report.

### Health and power-ups

- **RY-C18 Power states (PS report rules, Ryu's kit).**

  | State | What he has | Size and hitbox |
  |---|---|---|
  | Small (start) | Sword (normal reach), main art, ninpo max 99 | 12 × 24 px (crouch 12 × 16), as today |
  | Mushroom | + **Sword Extension** (RY-C25) | **Unchanged: Ryu does not grow** (`Character.as` 299) |
  | Fire Flower | + **Scroll** (ninpo max **200**) + the **extra art on Select** | Unchanged |

  - ? blocks give the Mushroom while he has none, and the Fire Flower after that.
  - A **Fire Flower while he already has one gives +15 ninpo** (`Ryu.as` 790-797).
  - The first Flower raises the maximum to 200 and does not refill the meter.
  - Getting a power-up does not heal or refill otherwise.
  - Score and the power-up pause follow the PS report.
- **RY-C19 Ninpo meter.**
  - He starts a game with the Shuriken and **25 ninpo**, maximum **99** (`CLASSIC_DEFAULT_AMMO 25`, `Ryu.as` 89-91, 425-426, 960-966).
  - Ninpo carries over between levels.
  - On death, ninpo resets to **25**, the Scroll is lost (maximum back to **99**) and the main art goes back to the Shuriken.
  - The HUD shows ninpo as a number with the ninpo icon. There is no HP bar.
- **RY-C20 Taking a hit (Lose Everything).**
  - Small: he dies.
  - Powered: he loses the Fire Flower, the Mushroom and the Sword Extension, and with them the Select extra art.
  - He **keeps** his main art, his current ninpo and the **Scroll**. The maximum stays 200 (`Ryu.as` 78-82; `Character.as` 2047-2068).
- **RY-C21 Pickups and drops (PS report C11 rules).**
  - 25% of kills drop ninpo: 80% a small one (+5), 20% a big one (+10).
  - Broken bricks drop at 1/4 of that rate (6.25%). Coin and ? blocks drop at 1/2 (12.5%).
  - Ninpo pickups are **taken even when the meter is full** (the excess is lost).
  - There are no health drops (`Ryu.as` 98, 223-224, 306-307, 805-815; `RandomDropGenerator.as` 30-35).
- **RY-C22 Knockback.** A hit that he survives does this (`Ryu.as` 1267-1291, 1328-1349):
  - It ends any wall cling.
  - vy = **−3.2083 px/f (`0x03355`; our initial `0x03039`, RY-C7)** and vx = **1.25 px/f (`0x01400`)** away from the source. With no source he goes backward.
  - He faces the source.
  - Input is off and he cannot be hurt **until he lands**.
  - Then he gets the shared 75 frames of invulnerability (PS report).
  - A spring, a pit bounce or a vine also ends the knockback.
- **RY-C23 Star.**
  - **Ninpo costs nothing** during Star power. Throws and the Jump Slash work at 0 ninpo, and the meter does not go down (`Character.as` setAmmo, hasEnoughAmmo).
  - Touching an enemy during a Jump Slash with the Star is the normal Star kill (`Ryu.as` 705-711).
  - Star length follows the PS report.

### Weapons and attacks

Damage values are in the original's HP scale (HP report). Ryu's weapons (`DamageValue.as` 57-62):

| Weapon | Cost | Damage | Pierces armour | Speed | Removed when | Bricks / ? blocks |
|---|---|---|---|---|---|---|
| Sword | 0 | 400 | no | — | — | breaks / bumps |
| Shuriken | 3 | 300 | no | 5 px/f straight | it hits anything, or leaves the screen | breaks and stops / bumps and stops |
| Windmill Shuriken | 5 | 300 per pass | **yes** | 6.6667 px/f, swings (RY-C28) | Ryu catches it | breaks / bumps, keeps going |
| Art of the Fire Wheel | 5 | 400 | no | 3.75 px/f in x and in y, up | it hits something it does not kill, or leaves the screen | breaks and keeps going / bumps and keeps going |
| Fire Dragon Ball | 5 | 400 | **yes** | 3.75 px/f in x and in y, down | same as the Fire Wheel | same as the Fire Wheel |
| Jump Slash | 5 | 800 | no | — (his own fall) | he lands or grabs a wall | breaks / bumps |

- **RY-C24 Hits to kill (from the HP report's table).** Goomba 250 takes 1 slash. Koopa 600 takes 2 slashes or 1 Jump Slash. Hammer Bro 800 takes 2 slashes. Bowser 2400 takes 6 slashes, 8 shurikens or 3 Jump Slashes.
  - **Armoured:** Buzzy Beetle, Spike Top, Bullet Bill and Barrel. The sword, Shuriken, Fire Wheel and Jump Slash do nothing to them: a shot is removed, and the armour sound plays. Only the Windmill and the Fire Dragon Ball hurt them.
  - **The Crab is not armoured.** All his weapons hurt it.
  - Hit-stun and Bowser forms follow the HP report.
- **RY-C25 Sword** (`Ryu.as` 165-168, 204, 209-242, 598-698, 880-915).
  - 400 damage, pierce strength 0. Each target is hit at most once per swing.
  - **Timing:** the animation steps every 45 ms. The hitbox is live on **frames 3-8** of the swing (45-135 ms; frame 1 is the press). The swing ends after **14 frames** (225 ms).
  - **Reach** (x measured ahead of his centre in his facing direction, y above his feet):

    | Swing | Without Sword Extension | With Sword Extension |
    |---|---|---|
    | Standing, and every air slash | x 8 to 32 px, y 18.5 to 25 px | x 8 to 45.5 px, y 9 to 25 px |
    | Crouching | x 8 to 32 px, y 11.5 to 19 px | x 8 to 47.5 px, y 3 to 19 px |

  - **Low targets.** The original tests this box against each enemy's separate attack box (`hRect2`, `HitTester.as` 84, 104). That box lives in the SWF and is probably taller than the enemy's body. Against our body boxes, the 18.5 px bottom edge would pass over a 16 px Goomba. Until open question 6 is settled, put the bottom edge of the standing and air box (without the Extension) at **13 px above the feet**, our current sword's bottom edge. The x reach and every other edge stay as in the table.
  - The Sword Extension also shows the wave graphic during the hit frames.
  - The sword's box also hits bricks and ? blocks (RY-C35).
- **RY-C26 Shuriken.** It costs 3 and does 300 damage. It flies straight at **5 px/f (`0x05000`)** in his facing direction, with no gravity (`RyuProjectile.as` 51, 139-146).
- **RY-C27 Throw spawn points** (projectile centre, from his centre and feet; `RyuProjectile.as` 25-34, 167-251):

  | Pose | x ahead | y above feet |
  |---|---|---|
  | Standing | 15 px | 21 px |
  | Crouching | 13 px | 16 px |
  | Airborne | 13 px | 21 px |
  | On a wall, into the wall | 10 px | 22.5 px |
  | On a wall, away (behind him) | 20 px | 22.5 px |

  The Fire Wheel and the Dragon Ball spawn at the same points.
- **RY-C28 Windmill Shuriken** (`RyuProjectile.as` 52-63, 147-166, 252-309, 310-345, 365-376).
  - Cost 5. 300 damage each time it passes through an enemy: once per overlap, and again on a later pass. It **pierces armour** (strength 6).
  - It **passes through everything**: enemies, walls, bricks.
  - **Launch:** 6.6667 px/f (`0x06AAB`) in his facing direction. Speed is capped at 6.6667 px/f in x.
  - **Horizontal motion each frame:**
    - While it is within 25 px of his centre x (measured on its side of him), it accelerates away from him at **0.3194 px/f² (`0x0051C`)**.
    - Once it has been 25 px or more away, it accelerates back toward him at the same rate.
    - That pull lasts until it crosses to his other side. The rule then starts again on that side.
    - With Ryu standing still it goes about 95 px out and is back at him after about 45 frames (simulated from the constants).
  - **Vertical motion:** each frame it moves toward his vertical centre at **0.7083 px/f (`0x00B55`)**, or stays level when level.
  - **Catch:** from **18 frames** (300 ms) after the throw, touching Ryu removes it. If he dodges it, it keeps swinging back and forth through his position.
  - It is **never removed off-screen** and has no lifetime. It is removed only by a catch, a death or the level ending.
  - It breaks every brick it passes through and bumps every ? block it passes through.
- **RY-C29 Art of the Fire Wheel** (`RyuProjectile.as` 60, 116-126).
  - Cost 5, 400 damage, pierce strength 0.
  - **One** fireball, launched diagonally **up and forward**: vx ±**3.75 px/f (`0x03C00`)** and vy **−3.75 px/f**, with no gravity. It flies in a straight line.
  - It **passes through enemies it kills** and is removed by one it does not kill, or by an armoured one.
  - It is removed off-screen.
  - Absent in Classic: our orbiting three-flame ring, which blocks shots.
- **RY-C30 Fire Dragon Ball** (`RyuProjectile.as` 59, 127-138).
  - The same as the Fire Wheel, with two differences: it goes diagonally **down** and forward (vy **+3.75 px/f**), and it **pierces armour** (strength 6).
  - Cost 5, 400 damage.
  - It passes through enemies it kills.
- **RY-C31 Jump Slash** (`Ryu.as` 705-718, 937-945, 968-983, 1236, 1263).
  - **Start:** Special (main art) or Select (extra art) pressed while **airborne** and not in a slash or throw. It works after a jump, a fall, a wall hop or a spring. It needs 5 ninpo (free with the Star). On the ground it does nothing.
  - **Duration:** until he **lands** or **grabs a wall**. There is no frame limit, and there is no hop.
  - **Effect:** while it lasts, **touching an enemy damages the enemy (800, pierce strength 0)** instead of hurting Ryu. Each enemy is hit once per overlap.
  - Armoured enemies take no damage. Touching one still does not hurt him (`hitEnemy` takes the attack branch). Enemy **shots** still hurt him.
  - **Bricks** he touches from the side or from below are attacked: bricks break and ? blocks bump.
  - Movement and air control are unchanged. The sword cannot be used during it.
  - Select can still throw the extra art during it, and the Jump Slash stays active.
  - The somersault frames play.
  - Absent in Classic: our ground start with a 4 px/f hop, the 36-frame timer and the 4 px melee box.
- **RY-C32 Limits and cost checks** (`Ryu.as` 220, 1033-1054, 1415-1425).
  - **One projectile of each type** on screen: one Shuriken, one Windmill, one Fire Wheel and one Dragon Ball can all be out at once.
  - The limit is checked when the throw starts and again on the spawn frame. A throw that is refused by the limit does nothing: no pose, no stop.
  - Ninpo is checked and spent **on the spawn frame**. With too little ninpo he still plays the throw pose (and stops on the ground), but nothing comes out and nothing is spent.
  - The Jump Slash checks its cost before it starts.
- **RY-C33 No other projectile changes.** Shots have no gravity and are not stopped by solid ground (RY-C36).
- **RY-C34 Throw timing.** A throw takes **14 frames**, like the slash. The projectile spawns on **frame 3** (45 ms, the `throw-2` label). Use the same timing for the crouch, air and wall throws.

### Interactions

- **RY-C35 Blocks and bricks (BR report rules, Ryu's values).**
  - **His head only bumps** bricks and ? blocks, in every power state. It never breaks a brick (`brickState BRICK_BOUNCER`, never changed). While he clings, his head does not bump at all (`Ryu.as` 878, 1250).
  - **The sword** breaks bricks and bumps ? blocks (releasing their item) when its live box overlaps them, from any side, standing, crouching or in the air (`HitTester.as` 160; `Brick.hitByAttack`).
  - **The Shuriken** breaks a brick and stops there, or bumps a ? block and stops.
  - **The Fire Wheel and the Dragon Ball** break bricks and keep flying, or bump a ? block and keep flying (BR-C9: the
    bumped block's HP is 0, so a "through kills" shot goes on).
  - **The Windmill** breaks bricks and bumps ? blocks as it passes, and keeps going.
  - **The Jump Slash** breaks or bumps the bricks it touches (RY-C31).
  - Used blocks and solid ground are not attacked; shots pass through them.
- **RY-C36 Thrown ninpo pass through solid ground.** Every Ryu projectile ignores walls, floors and pipes. Projectiles only interact with enemies, bricks and ? blocks (`RyuProjectile.as` 397-401; `Projectile.as`). This follows the BR report's C4 rules.
- **RY-C37 Absent in Classic.**
  - The 16 HP bar, healing on power-ups and health drops.
  - The ninpo belt and Select cycling.
  - Mushroom-unlocked arts and the Flower's +20 maximum.
  - The orbiting Fire Wheel ring.
  - The ground-start 36-frame spin.
  - Walk acceleration and the variable jump.
  - The wall kick into a full jump.
  - Head-breaking bricks.
  - All of these stay untouched in Current.
- **RY-C38 Dev kit.** `&kit=full` in Classic gives the Mushroom and the Fire Flower (Sword Extension, Scroll), 200 ninpo
  and all five arts; Select cycles the main art (RY-C2, TG-44).

### Feel

- He is precise and stop-start. He stops to slash, walks at a constant speed and always jumps the same height.
- Walls are climbable but not springboards. Getting over a tall wall means climbing to the top and doing the 31 px top hop.
- The somersault on jumps, hops, springs and bounces is art only. It is optional, and the plain jump frame is fine.

## Actual

Current behaviour, which stays the default:
- **Movement:** he accelerates to 1.5 px/f in about 5 frames and keeps walking while slashing. The jump is variable: 5 px/f, gravity 0.1875, cut on release, 19-70 px. The fall cap is 4.5 px/f (`src/game/characters/ryu/index.ts:14-33`).
- **Wall:** he clings only while holding toward the wall, cannot climb and cannot attack. Jump kicks off into a full 70 px jump (`index.ts:206-210, 222`; `src/game/entities/player.ts:200-222, 237-240`).
- **Health:** a 16 HP bar, 2 HP per hit, 60 invulnerability frames (`index.ts:35-42, 161-167, 282-293`).
- **Power-ups:** Mushrooms unlock arts in order and heal. Flowers add 20 to the ninpo maximum, up to 99 (`index.ts:173, 252-268`).
- **Weapons:**
  - A belt cycled with Select.
  - Shuriken at 4 px/f, two on screen.
  - Windmill at 3 px/f, returns after 40 frames.
  - The Fire Wheel is three orbiting flames for 240 frames.
  - There is no Dragon Ball.
  - The spin starts from the ground and lasts 36 frames (`index.ts:97-143, 211-217`; `src/game/characters/ryu/weapons.ts:28-71`).
- **Sword:** amount 1, 6-18 px ahead, enemies only (`index.ts:222-233`; `src/game/world/world.ts:1264-1275`).
- **Bricks:** his head always breaks them (`index.ts:170`).
- **Drops:** they include health (`index.ts:179-185`). Ninpo pickups are refused when full (`index.ts:239`).
- **Water:** he strokes like every hero (`player.ts:16, 295-344`).

## How often

every time

## Notes

- **Sources.**
  - Original (CR-to-LF view of `$S/orig/src/com/smbc`; the same line numbers as `$S/chars/work-ryu/*.txt`):
    - `characters/Ryu.as`: constants 67-100 and 165-206; kit and ninpo 72-98, 422-470, 766-824, 960-966; movement 542-597; sword boxes and frames 598-698; Jump Slash 705-718, 937-983; climb limits 719-765; jump and wall hop 825-863; detach 864-879; attack 880-915; Special and Select 931-958; throws 1002-1088; wall grab 1143-1251; landing 1252-1265; knockback 1267-1349; spawn and frames 1415-1514.
    - `projectiles/RyuProjectile.as` 25-166, 167-251, 252-309, 310-376, 397-401.
    - `projectiles/Projectile.as` 34-152.
    - `characters/Character.as`: 299 (no size change), 378-385 (lose lists), 1898-1957 (ammo and Star), 2047-2068 (Lose Everything); `cleanUp` (death resets ammo and upgrades).
    - `data/DamageValue.as` 57-62, `data/HealthValue.as` (Brick 125), `data/RandomDropGenerator.as` 30-35, `data/GameSettings.as` 112, 122-123, 211, 227-228, `ground/Brick.as` 174-228, 270-288, `data/HitTester.as` 150-160, `managers/StatManager.as` 1290-1330, 1351-1360.
  - Fact-check overrides from `verify/C.md`:
    - The Crab is not armoured (`Crab.as` 34 commented out).
    - At the top of the wall, Away + Jump is the 16 px hop and Jump alone is 33 px (`Ryu.as` 841); 15 px and 31 px
      stepped in the original's order (RY-C12).
    - Ryu does not grow.
    - The Windmill's reverse distance is 50 Flash px = 25 px.
  - Ours: `src/game/characters/ryu/index.ts`, `weapons.ts`, `guide.ts`; `src/game/entities/player.ts:16-17, 198-245, 295-344`; `src/game/world/world.ts:574 (countProjectiles), 1105 (hitBlock), 1264-1275 (melee), 1456 (resolveLifts)`; `src/game/entities/objects/lift.ts`.
- **Implementation hints.**
  - **Files:** new `src/game/characters/ryu/classic.ts` (`RYU_CLASSIC` CharacterDef and `RYU_CLASSIC_PROFILE`) and `classic-weapons.ts` (four `ProjectileSpec`s plus the Jump Slash constants). `index.ts`, `weapons.ts` and `guide.ts` stay as they are.
  - **Profile:** `instantAccel: true`, `minWalk = maxWalk = maxRun = 0x018AB`, `canRun: false`, `airControl: 'full'`, `variableJump: false`, one jump tier `{ initial: 0x04839, holdGravity: 0x0031C, fallGravity: 0x0031C }` (RY-C7), `maxFall = fallReset = 0x05D55`, `coyoteFrames: 0`. `instantAccel` covers air movement but not the stop: `airMove` keeps vx when no direction is held (`player.ts:452-458`), so also set the shared optional `airStop: true` field (SI-C6, LK-C5).
  - **Wall climbing:**
    - Do not reuse `player.clinging` and the wall-kick branch in `player.ts:210-222`. Current depends on them.
    - Add an optional `CharacterDef` field (for example `wallClimb: true`, set only by `RYU_CLASSIC`).
    - Give `player.ts` a separate `wallClimb()` path, entered like `climb()` for vines (`player.ts:163`). It owns the grab, the climb at `CLIMB_SPEED`, the hop table, the lift ride and the regrab lock.
    - The jump block must skip its wall-kick branch when this field is set.
    - Lifts: the grab needs the lift's side box. `Lift.carry` (`world.ts:1456`) handles riding on top only, so add a side-cling carry for this path.
  - **Sword and Jump Slash damage:** `world.ts:1264-1275` builds `{ kind: 'sword', amount: 1 }`. Let `activeMelee` carry an optional damage amount and pierce strength (400 / 800, strength 0) that the HP report's numeric damage reads. Current leaves it unset. The Jump Slash's "contact hurts the enemy, not Ryu" needs a hook in `playerVsEnemy` (`world.ts:1347` already skips contact when the melee box overlaps). Make the Jump Slash melee box his own hitbox and keep that skip.
  - **Sword vs bricks:** the BR report adds a melee-vs-tile check. Classic Ryu's sword and Jump Slash opt in.
  - **Projectiles:**
    - Use `ProjectileSpec` with `vx`/`vy`, `hitsTiles: false` (through ground), `breaksBricks`, and `pierce` for the pass-through.
    - The Fire Wheel and the Dragon Ball need "pass through if the hit killed": add a spec flag (for example `passThroughOnKill`).
    - The Windmill needs its own motion (the spring rule and the vertical follow). A small update function in `classic-weapons.ts` or a new spec mode is better than `returns`.
    - Use `world.countProjectiles(p, kind)` for one-per-type.
  - **State in `p.scratch`:** `ninpo`, `ninpoMax` (99/200), `scroll`, `sword` (Extension), `mainArt`, `extraArt`, `jumpSlash`, `throwT`, `wallRegrab`. Make sure `carriedKit` (`player.ts:20`) carries ninpo and the Scroll between levels, and that death resets them as in RY-C19.
  - **Head bumps:** `canBreakBricks: () => false`.
  - **Water:** the Classic def sets a no-stroke swim profile with the RY-C17 constants. Use whatever shape the swimming report defines.
- **Acceptance checks** (headless, in a new `tests/sim/ryu-classic.test.ts` built like `tests/sim/ryu.test.ts`):
  - Walk: vx = 0x018AB on the first frame Right is held, and 0 on the first frame it is released, on the ground and in the air.
  - Jump: the apex is 55 ± 1 px for a tapped and for a held Jump (the same value both times).
  - The fall speed never exceeds 0x05D55.
  - Slash while walking: vx = 0 during all 14 frames. A Goomba whose near edge is 30 px ahead of his centre dies. A Koopa takes 2 slashes. A Buzzy Beetle takes no damage from 10 slashes.
  - Wall (the 9-tile `tallWall()` field):
    - He grabs, stays on with no input for 120 frames, and climbs 60 px in 60 frames with Up.
    - Jump alone mid-wall leaves him on the wall.
    - Away + Jump hops 15 ± 1 px.
    - At the top, Jump alone rises 31 ± 1 px. Toward + Jump lands him on top.
    - Down + Jump drops him.
    - The Current test "chains wall jumps to climb a nine-tile wall" must fail under Classic rules and pass under Current.
  - Wall throw: with Away held, the shuriken moves away from the wall. Without Away, it passes through the wall.
  - Limits: a second Special press while a shuriken is out spawns nothing and spends nothing.
  - Ninpo: it starts at 25. The first Flower gives max 200 and leaves ninpo at 25. A second Flower gives 40. A hit with the Flower leaves max 200 and removes the Select throw. Death resets to 25/99.
  - Star: 5 throws leave ninpo unchanged.
  - Fire Wheel: after 10 frames its position changed by (+37.5, −37.5) px. It kills two Goombas in a diagonal line.
  - Dragon Ball: (+37.5, +37.5) px, and it kills a Buzzy Beetle.
  - Windmill: from a standing Ryu it reaches 90-100 px and is caught within 60 frames. It breaks a brick on the way.
  - Jump Slash: Special on the ground does nothing. In the air it kills a Koopa on contact (800 ≥ 600), and Ryu takes no damage. It ends on landing.
  - Bricks: a head bump leaves the brick, the sword breaks it, and a shuriken thrown at a brick through a pipe breaks it.
  - Current is unchanged: `tests/sim/ryu.test.ts` and every other test and headless sim pass with `rules === 'current'` and no edits.
- **Confidence.**
  - The original's rules here come from source reading. The original was not played for this report.
  - Current's figures were played (`$S/chars/ryu.md` §5).
  - Estimated:
    - The 14-frame throw length on the wall and in the air (the labels were read only for the stand slash and throw).
    - The Windmill's 95 px and 45 frames (simulated from the constants).
    - The wall-hop heights in water.
    - The single-ground lift on the grab, adapted to tiles.
    - The 55 px apex is stepped in the original's order (57 px by v²/2g); the hop heights likewise.
- **Open questions** (each with a default to build meanwhile).
  1. Ryu's original hitbox size is not extracted (it comes from the SWF). Default: keep 12 × 24 px, and 12 × 16 px crouching.
  2. A Jump Slash landing on a brick: the source calls `landAttack` on any brick he touches (`Ryu.as` 712-718). That may break the brick under his feet and drop him through. Default: attack bricks touched from the sides and from below only. He lands normally on brick floors. A playtest of the original should settle this.
  3. Settled: the Fire Wheel, the Dragon Ball and the Jump Slash cannot be reached with the default Classic choices; they are reached through the dev `&kit=full` (RY-C2, TG-44) until the Customize Weapons follow-up.
  4. Jump buffering: the original fires on the press only. Default: keep our shared jump buffer for all Classic jumps, including wall hops.
  5. Wall-throw length: default 14 frames, spawn on frame 3.
  6. Enemy attack boxes (`hRect2`) are in the SWF and were not extracted. Default: the standing and air sword box reaches down to 13 px above the feet (RY-C25). Every other box is tested against our enemy bodies. Shot spawn heights (RY-C27) are kept as written, so a shuriken thrown standing passes over a Goomba unless he crouches. Check the original for that.
- **Related reports.**
  - [`2026-10-07-dev-classic-smbc-rules-toggle.md`](2026-10-07-dev-classic-smbc-rules-toggle.md) (toggle and index).
  - [`2026-10-07-classic-power-states.md`](2026-10-07-classic-power-states.md).
  - [`2026-10-07-classic-enemy-hp-and-armour.md`](2026-10-07-classic-enemy-hp-and-armour.md).
  - [`2026-10-07-classic-bricks-and-shots.md`](2026-10-07-classic-bricks-and-shots.md).
  - [`2026-10-07-classic-swimming.md`](2026-10-07-classic-swimming.md).
  - [`2026-10-07-classic-follow-ups.md`](2026-10-07-classic-follow-ups.md) (Customize Weapons, Haggle Man skin timing).
  - Existing: `2026-10-06-water-non-mario-heroes-stroke.md` (Ryu's stroke, the same as RY-C17). `2026-10-05-lifts-carry-player-through-walls.md` (lift carry code that RY-C15 extends). `2026-10-05-springboard-bounce-too-high.md` (Ryu's spring values, already matched, RY-C8).
