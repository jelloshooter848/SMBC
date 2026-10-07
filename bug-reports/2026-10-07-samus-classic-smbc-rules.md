# Classic SMBC rules for Samus: power states instead of energy, the original jump, crouch, somersault and Screw Attack, the original beams, bombs and Ice platforms

- **Severity:** feature request (Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=samus` (once the toggle exists; today `?dev=1&level=1-1&char=samus` shows the Current behaviour)
- **Character and power:** Samus, all power states
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=samus` (Current). The HUD shows EN 30. Down curls her into the ball at once.
   A full jump peaks at about 74 px. One beam kills the first Goomba. Her head breaks a brick even when small.
2. Open `?dev=1&rules=classic&level=1-1&char=samus` (or Dev menu → Rules: Classic SMBC, then restart the level).
3. At the first Goomba, shoot standing, then crouch (Down) and shoot. It takes 2 beam hits. Press Down again
   while crouched to curl into the ball, and Attack to lay a bomb that hangs in the air.
4. Jump into a brick from below: it only bumps. Shoot it: it breaks. Shoot a ? block: the item comes out.
5. Take the Mushroom (Long Beam, 4 missiles in the HUD) and then a Flower (Varia colours, Wave Beam, Screw
   Attack). Do a running jump into a Goomba: the somersault kills it.
6. Touch an enemy while powered: she drops straight to small and keeps her missiles. Touch one again: she dies.

## Expected

Classic Samus plays as in SMBC 3.1.21 with its default settings (POWERUP MODE Classic, When Hit = Lose
Everything, Samus's Customize Weapons choice = Wave Beam). Units: px, px/frame (pf), px/frame² (pf²), frames
at 60 fps. Hex values are our 1/4096-px velocity units. Shared systems are specified elsewhere and only
Samus's own values are given here:
[power states](2026-10-07-classic-power-states.md),
[enemy HP and armour](2026-10-07-classic-enemy-hp-and-armour.md),
[bricks and shots](2026-10-07-classic-bricks-and-shots.md),
[swimming](2026-10-07-classic-swimming.md),
[the toggle](2026-10-07-dev-classic-smbc-rules-toggle.md).

### Controls

**SA-C1. Control map.** In Classic, each control does this:

| Input | Standing or walking | Crouched | In the air | Morph ball | On a vine |
|---|---|---|---|---|---|
| Left / Right | Walk at 1.25 pf at once (SA-C3) | Stand up and walk, but only if Down is released | Steer at 1.25 pf at once | Roll at 1.25 pf | Shared vine rules |
| Down (press) | Crouch (SA-C4) | Curl into the ball (SA-C25) | Curl into the ball | Nothing | Shared vine rules |
| Down (held, on the ground) | She cannot walk | She cannot walk | No effect on steering | Rolls normally | — |
| Up (held) | Aim straight up. She can walk while aiming up | Press: stand up | Aim up. Ends the somersault | Press: stand up if there is room (SA-C26) | Shared vine rules |
| Jump | Jump (SA-C6) | Jump | Nothing (no air jump) | Stand up into the jump pose, no jump speed (SA-C26) | Nothing |
| Attack | Fire the beam | Fire the beam at crouch height | Fire the beam | Lay a bomb (SA-C27) | Nothing |
| Special | Fire a missile (SA-C12, SA-C18) | Fire a missile at crouch height | Fire a missile | Nothing | Nothing |
| Select | Nothing (with `&kit=full`: Wave/Ice switch, SA-C11) | Same | Same | Nothing | Nothing |

**SA-C2. No tool belt.** Classic Samus has no belt, no beam/missile selection and no Select action (except
the dev kit's Wave/Ice switch, SA-C11). Attack
always fires the beam and Special always fires a missile. Touch labels: Attack `SHOOT` (`BOMB` in the ball),
Special `MISSILE` only while she has the Missile upgrade and is not in the ball, Select hidden.

### Movement

**SA-C3. Walking is digital.** Holding Left or Right sets her speed to 1.25 pf (`0x01400`) on the first frame.
Releasing sets it to 0 on the first frame. Holding both, or neither, stops her. The same rule applies in the air
and in the ball. There is no run.

| Constant | Classic | Original |
|---|---|---|
| Walk, air and ball speed | 1.25 pf (`0x01400`) | `WALK_SPEED` 185 clamped by `vxMax` 150 |
| Acceleration and stopping | instant | `vx = WALK_SPEED*dir` or `vx = 0` |

**SA-C4. Crouch.**
- Pressing Down while standing or walking on the ground (not while holding Up) crouches her. Her speed becomes 0.
- While crouched she cannot walk. Holding Down on the ground never lets her walk, in any pose except the ball.
- Releasing Down does **not** end the crouch. She leaves it with Up (stands, aiming up), Jump (a normal jump),
  or Left/Right with Down released (walks).
- Pressing Down again while crouched curls her into the ball (SA-C25).
- Beams and missiles fired while crouched come out at crouch height (SA-C20).
- The crouch hitbox is **12 × 15 px** (the original's crouch box is 13.5 × 15.5 px: SWF `SamusMc` frames `crouch`
  and `crouchShoot`, 27 × 31 Flash px; standing is 27 × 62 = 13.5 × 31). It is bottom-aligned, so the crouch fits
  under a one-tile ceiling. She cannot walk while crouched (above); she stands up (Up, Jump or walking) only where
  12 × 24 fits, and otherwise stays crouched.
- New poses: `crouch` and `crouch-shoot`.

**SA-C5. Ball movement.** The ball keeps today's 12 × 12 hitbox, fits one-tile gaps, and moves by SA-C3.
It cannot jump.

### Jumping

**SA-C6. Jump constants.** The original adds gravity before it moves the body; ours moves first. To get the
same frame-by-frame arc, Classic's `initial` is the original take-off speed minus one frame of gravity.

| Constant | Classic (our units) | Original |
|---|---|---|
| Take-off speed | 4.1667 pf; profile `initial` = 4.0693 pf (`0x0411C`) | `JUMP_PWR_NORMAL` 500 |
| Gravity (rising and falling, held or not) | 0.0972 pf² (`0x0018E`) | `gravity` 700 |
| Fall cap | 3.75 pf (`maxFall` = `fallReset` = `0x03C00`, a clamp) | `vyMaxPsv` 450 |
| Full-jump apex | 87 px (5.4 tiles), reached on frame 42 | computed |
| Coyote frames | 0 | — |

The same rule holds for every launch of her body in this report: the water jump (SA-C10), the knockback hop
(SA-C15, our initial `0x01FC7`) and the bomb boost (SA-C28). Projectiles need no change: our projectile code already
adds gravity before it moves (`projectile.ts:244-246, 265-270`).

Note: the "about 89 px" in the comparison report is already in **our** px (the continuous formula,
500² / (2 × 700) = 178.6 Flash px). Stepping the original's per-frame order gives 87.2 px. Our Current jump
peaks at 72-74 px.

**SA-C7. Soft jump cut.** When Jump is released while she is rising, her upward speed is multiplied by
0.8577 every frame (`fy` = 0.0001 per second, so 0.0001^(1/60)) until it reaches 0. Gravity keeps acting as
normal. The damping starts on the release frame, happens at most once per jump, and stops for good once she
falls. It replaces Current's hard cut (`vy = 0`). Expected heights:

| Jump released on frame | 1 | 5 | 10 | 20 | 30 | held |
|---|---|---|---|---|---|---|
| Apex (px) | 17 | 31 | 46 | 69 | 82 | 87 |

**SA-C8. Somersault state.** The somersault is a real state, not only a pose.
- It can happen only on a jump that started with Left or Right held on the take-off frame. Walking off a ledge,
  a bomb boost and a spring launch never somersault.
- It starts on the first frame on which all of these hold: she is rising; she is more than 30 px above her
  take-off height; she is not in the shooting pose (SA-C14); Up is not held; she is not in the ball.
- It ends when she sinks back below the line 30 px above her take-off height, when Up is held, when she fires
  a beam or missile, when she lands, grabs a vine, curls into the ball, or starts a flagpole slide. Default:
  a hit also ends it.
- It may start again in the same jump if all the start conditions hold again (for example the shooting pose ends
  while she is still rising).
- The `spin-0..3` frames show only in this state. Any other airborne frame uses `jump` (or `aim-up`).

**SA-C9. Springs.** No change: springs already use Samus's green boost (Flash 1750) and her gravity of 700.

### Swimming

**SA-C10. Water.** Samus has no swim stroke. Under water she can only jump from the floor. Her own values:

| Constant | Classic | Original |
|---|---|---|
| Jump from the floor | 4.1667 pf; `initial` 4.1111 pf (`0x041C7`) under water | `jumpPwr` 500 |
| Underwater gravity | 0.0556 pf² (`0x000E4`) | `gravity` 400 |
| Floor-jump apex | about 154 px (est.) | computed |
| Sink cap, entering and leaving water | per the swimming report | shared |

The soft cut (SA-C7) also applies under water.

### Health and power-ups

**SA-C11. Power states and kit.** No energy, no energy tanks, no EN number in the HUD. She uses the shared
power states. Her size and hitbox never change between states. What each state holds:

| State | Kit | Palette |
|---|---|---|
| Small (start) | Short beam (SA-C12), Morph Ball with bombs. Also Missiles and the Missile Expansion if she ever got them | Power Suit (`samus`) |
| Mushroom | Small kit + Long Beam + Missiles | Power Suit (`samus`) |
| Flower | Mushroom kit + Wave Beam + Screw Attack + Missile Expansion | Varia (`samus-varia`) |

- The Classic weapon is the **Wave Beam**. The Ice Beam (SA-C21) replaces it only when the original's
  Customize Weapons choice is Ice (that menu is out of scope). In normal play Ice and Wave never coexist.
- `devKit()` (`&kit=full`, toggle report TG-44): Flower state, Missiles with 99, the Missile Expansion, and
  both the Wave Beam and the Ice Beam. Only then does Select switch the Flower beam between Wave and Ice.
- One hit while powered removes the Flower set (Wave Beam, Screw Attack) **and** the Mushroom set (Long Beam)
  together, so she drops straight to small. Missiles, the missile count, the Missile Expansion and the Morph
  Ball are never lost.
- One hit while small kills her.

**SA-C12. Missiles and ammo.**

| Rule | Classic | Original |
|---|---|---|
| Before the first Mushroom | No missiles, no missile HUD | upgrade inactive |
| First Mushroom (she never had Missiles) | Gains Missiles, count set to 4 | `CLASSIC_MISSILE_DEFAULT_AMMO` 4 |
| A later Mushroom (she had Missiles) | Count unchanged | — |
| Missile cap | 40 | `AMMO_ARR` max 40 |
| Missile Expansion (from the first Flower) | Cap 99, never lost | `MISSILE_EXPANSION_MAX_AMMO` |
| A Flower while she already has the Flower | +4 missiles (up to the cap) | `increaseAmmoByValue(…, 4)` |
| Missile pickup | +2 (up to the cap) | `MISSILE_PICKUP_VALUE` 2 |
| Firing during Star | Costs nothing | `hasEnoughAmmo` true with `starPwr` |
| HUD | Missile icon and count, shown once she has Missiles | `updAmmoDisplay` |

**SA-C13. Drops.** Kills (and broken bricks) drop **missile packs only**, at the shared drop rate, and only
once she has the Missile upgrade. Before that she gets no drops. No energy drops exist.

**SA-C14. Shooting pose timers.** After a beam or missile she holds the shooting pose for 3 frames when she is
standing still on the ground or aiming up in the air (50 ms), and for 8 frames otherwise (140 ms). Firing
again restarts the timer. The pose blocks the somersault (SA-C8).

**SA-C15. Hit response (her values).**
- Knockback: 1.25 pf (`0x01400`) away from the source. Upward 2.08 pf (`0x02155`; our initial `0x01FC7`, SA-C6) only if she was on the
  ground; in the air her vertical speed is kept.
- For 15 frames (250 ms) she has no control and ignores enemies.
- Then 75 frames (1250 ms) of flickering invulnerability, 90 frames in all.
- If hit in the ball she stays in the ball.

**SA-C16. Varia, fire bars and Star.**
- There is no Varia Suit upgrade in Classic and no damage halving. The Flower state only uses the Varia
  colours. Fire bars hurt her in every state like any other hero.
  (In the original the Varia Suit, a Modern-mode upgrade, makes fire bars harmless and does nothing else.)
- Star: she is invincible, missiles are free (SA-C12), and the Star palette wins over the Screw Attack flash.
  Star length follows the power-states report.

### Weapons and attacks

**SA-C17. Shot caps.** Beams and missiles share one cap of **3 on screen per player**. With 3 out, Attack and
Special do nothing and no missile is spent. A beam's 3-frame burst (SA-C19) still counts until it is removed.
Bombs have their own cap of 3 per player. Special with no missiles left does nothing (no sound).

**SA-C18. Beam and missile table.**

| Shot | Speed | Range | Damage | Ground | Bricks and ? blocks | Enemies |
|---|---|---|---|---|---|---|
| Short beam (small Samus) | 4.1667 pf (`0x042AB`) | 50 px: removed after 12 frames | 150 | Stops | Breaks a brick, bumps a ? block, stops | Stops at the first enemy |
| Long Beam | 4.1667 pf | Until off screen | 150 | Stops | Same | Same |
| Wave Beam | 3.3333 pf (`0x03555`) | Until off screen | 225 | **Passes through** | Same (also stops at used blocks) | Same |
| Ice Beam | 4.1667 pf | Until off screen | 125 | Stops | Same | Freezes (SA-C21) |
| Missile | 4.1667 pf | Until off screen | 400, pierces armour | Stops with an explosion | Breaks, bumps, stops, in **every** direction | Stops at the first enemy |

- The 50 px range applies to whatever beam she fires while she lacks the Long Beam.
- Every shot is removed when it leaves the screen on **any** side, including the top.
- Shots fired up travel straight up. The missile sprite is rotated to point up (new frame).
- Brick HP is 125, so every Samus shot breaks a plain brick in one hit (bricks report).

**SA-C19. Shot end.** A beam that hits an enemy, a brick or solid ground stops and shows its burst frame for
3 frames (50 ms) in place, harmless, then disappears. A missile shows the explosion graphic and disappears at
once. The short beam simply vanishes at the end of its range.

**SA-C20. Muzzle positions** (the centre of the new shot, from her centre x and her feet y):

| Pose | x | y |
|---|---|---|
| Standing or walking, forward | 12.5 px ahead | 22 px above the feet |
| Crouched, forward | 12.5 px ahead | 12.5 px above the feet |
| Airborne, forward | 12.5 px ahead | 15 px above the feet |
| Aiming up (any pose) | 2 px toward her facing side | 36 px above the feet, moving up |

**SA-C21. Ice Beam.**
- The first Ice hit on an unfrozen enemy **freezes it and does no damage**.
- Frozen for 360 frames (6 s). It does not move or fall and does not hurt on contact.
- While frozen it carries a solid 16 × 16 block for players only. The block's left edge is the enemy's
  hitbox left edge and its bottom is the enemy's hitbox bottom. Players can stand on it and bump into its
  sides and underside. Enemies and shots ignore the block.
- From frame 285 (4750 ms) it flashes between the frozen colour and its own, switching every 40 ms (alternate
  2 and 3 frames). With reduced flashing on, it stays frozen-coloured.
- Any Samus beam, missile or bomb that hits a frozen enemy thaws it first and then damages it normally. So Ice
  alone takes 4 shots for a Goomba (freeze, 125, freeze, 125).
- When the 360 frames end, the block disappears and the enemy resumes its previous motion.
- Bowser and Lakitu cannot be frozen; each Ice hit just does 125 damage.
- Armoured enemies (Buzzy Beetle, Spike Top, Bullet Bill, Barrel) **can** be frozen, because the freeze is
  checked before armour. A later beam thaws them but still does no damage. A missile thaws and damages them.
- A hit landing during an enemy's 9-frame hit-stun invulnerability (SA-C23) does nothing, Ice included.

**SA-C22. Wave Beam path.**
- Fired forward it oscillates vertically: y = start y + 15 × sin(a), where a changes by 0.4167 rad per frame
  (25 rad/s), starting at 0. The period is 15.1 frames, ±15 px.
- Each player alternates the phase per Wave shot: the first Wave shot of a level goes **down** first, the next
  goes up first, and so on.
- Fired up it oscillates horizontally the same way (the first goes right first, the next left first).
- It ignores solid ground and pipes but collides with bricks, ? blocks and used blocks (bricks report).
- It stops at the first enemy. It does not pierce.

**SA-C23. Damage and hit-stun.**
- Samus's damage numbers are in SA-C18, plus bombs 400 (no armour piercing) and the Screw Attack (kills). The
  enemy HP model, armour and Bowser forms are in the enemy HP report.
- Every beam or missile hit on an enemy that survives freezes it in place for 9 frames (150 ms), flashes it for
  9 frames, and makes it ignore **all** damage for 9 frames.
- A bomb hit does the 9-frame stop and flash, but gives no invulnerability window.
- Bowser and Lakitu are not stopped, but they do flash and get the 9-frame window.
- Beams on armoured enemies do nothing: play a "bullet-proof" sound and the beam bursts (SA-C19).

Hits to kill (Normal attack strength):

| Enemy (HP) | Beam | Wave | Missile or bomb | Ice only |
|---|---|---|---|---|
| Goomba (250) | 2 | 2 | 1 | 4 |
| Koopa (600) | 4 | 3 | 2 | 10 |
| Buzzy Beetle (600, armoured) | never | never | 2 missiles; bombs never | never |
| Bowser, fire (2400) | 16 | 11 | 6 | 20 |
| Bowser, hammer (3600) | 24 | 16 | 9 | 29 |
| Bowser, fire and hammer (4400) | 30 | 20 | 11 | 36 |

**SA-C24. Screw Attack.**
- Active while she has the Screw Attack (Flower state) **and** is in the somersault state (SA-C8).
- On starting, play the Screw Attack sound once per jump, and cycle a flashing palette (like the Star flash)
  until the somersault ends. With reduced flashing on, show the Varia palette without cycling.
- Touching any enemy except Bowser kills it, armoured ones included, and she is not hurt. It does not touch
  frozen enemies (they are not contact targets).
- Touching Bowser hurts her as usual.
- It gives no protection from projectiles (hammers, fire, Bullet Bills count as enemies, so they die).
- During Star, contact uses the normal Star kill instead.

### Special abilities

**SA-C25. Entering the morph ball.**
- From a crouch: press Down again. If she is on the ground she pops up 2.5 px and is airborne for that drop.
- In the air: press Down (not on a vine, not in a pipe). No pop.
- Standing on the ground, Down crouches first (SA-C4). There is no direct ground entry.
- Entering ends the somersault and the Screw Attack.

**SA-C26. Leaving the morph ball.**
- Up stands her up in the aiming-up pose. Jump stands her up in the jump pose with **no** jump speed.
- Either is refused when any solid tile overlaps the band from 15 px above the ball's top to 5 px above the
  ball's bottom, within the ball's width.
- If she is on the ground she pops up 5 px and becomes airborne (she falls back).
- Grabbing a vine or the Bowser axe also leaves the ball (as today for vines).

**SA-C27. Bombs.**
- Attack in the ball lays a bomb, up to 3 out per player. Special lays nothing.
- The bomb's centre is at her centre x, 6 px above her feet. It **hangs there** with no gravity.
- Fuse: 57 frames (950 ms), with the 4-frame blink.
- Then it explodes: 400 damage to enemies in the blast (no armour piercing; hit-stun per SA-C23). Each bomb
  hits each enemy at most once. Blast area: keep today's 24 × 24 (default). Bricks and ? blocks in the blast
  follow the bricks report.
- The blast stays live for 12 frames (default), then blinks for 12 frames (200 ms) and is removed.

**SA-C28. Bomb boost.**
- While a blast is live, if Samus overlaps it and is not rising (vertical speed ≥ 0), set her vertical speed to
  1.9167 pf up (Flash 230). In our move-then-gravity order use 1.8194 pf (`0x01D1C`). She rises about 18 px.
- It works standing, walking, crouched or in the ball, on the ground or in the air.
- Each bomb boosts her at most once. Bombs never hurt her.

### Interactions

**SA-C29. Bricks.**
- Her head **bumps** bricks and ? blocks in every state. It never breaks them.
- In the ball her head neither bumps nor breaks: a ball pushed into a block from below by a bomb boost just stops.
- Beams and missiles break bricks and bump ? blocks per SA-C18. Bombs per SA-C27 and the bricks report.

**SA-C30. Enemies.** She cannot stomp. Touching an enemy hurts her unless the Screw Attack (SA-C24) or Star is
active, or the enemy is frozen (it is then a block).

**SA-C31. Vines, flagpole and axe.**
- On a vine Attack and Special do nothing. Grabbing a vine ends the somersault.
- A flagpole slide ends the Screw Attack. If she is in the air when the slide ends she leaves in the spin pose
  (no Screw Attack).
- Touching the axe leaves the ball.

**SA-C32. Death (cosmetic, low priority).** The suit bursts into 6 pieces and the Samus death jingle plays.
The death timer is 180 frames (3 s), 150 frames (2.5 s) in a pit. Until assets exist, the generic death is
acceptable.

**SA-C33. Two players.** Both players use these rules. Each player has their own shot cap, bomb cap, Wave phase
alternation and somersault state.

### Feel

Classic Samus is digital and floaty: full speed and dead stops, a tall slow arc with a soft cut, and a
somersault that turns into a weapon once she has the Flower. Shooting in the air cancels the spin, so a player
must choose between firing and screwing.

**SA-C34. Current untouched.** With Rules = Current nothing in this report applies. `SAMUS` in
`src/game/characters/samus/index.ts` and every test and headless sim stay as they are.

## Actual

Current (stays the default):
- **Energy model:** 30 energy, 8 per hit (4 with Varia), tanks to 90, upgrades never lost, 40 frames of
  invulnerability (`samus/index.ts:35-43`, `:166-173`, `:300-309`).
- **Power-ups:** Mushroom gives Varia then tanks; Flower steps the beam Long → Ice → Wave, then +10 missiles
  (`index.ts:179-186`, `:267-296`).
- **Movement:** ramps up over about 19 frames, 4.5 pf jump with gravity 0.14, apex 72-74 px, hard cut
  (`index.ts:14-33`; `entities/player.ts:233`). The spin is only a sprite (`index.ts:80`).
- **Controls:** Down on the ground curls her into the ball at once; no crouch, no air morph, Jump ignored in
  the ball (`index.ts:175`, `:214`, `:229-237`). Select switches beam/missile; Special always fires a missile
  (`:224`, `:243-248`).
- **Shots:** 2 beams, missiles uncapped (`index.ts:117-131`). Short beam lasts 20 frames (80 px). Wave ±8 px,
  24-frame period, pierces enemies and all tiles, no wave when fired up (`samus/weapons.ts:19-49`;
  `entities/projectiles/projectile.ts:263-277`). Ice stuns 180 frames, not solid, second hit shatters
  (`entities/enemies/enemy.ts:111-119`; `rules/damage.ts:56-61`). Every beam kills a basic enemy in one hit.
- **Bombs:** fall to the floor, fuse 40, bounce only in the ball (`index.ts:133-159`;
  `entities/objects/bomb.ts:48`).
- **Bricks:** her head breaks bricks even when small (`index.ts:176`; `world/world.ts:1106`); beams ignore
  blocks; only sideways missiles break them (`projectile.ts:237-243`).
- **Drops:** energy and missile packs (`index.ts:197-203`).

## How often

every time

## Notes

### Sources

Original line numbers are from the files after `tr '\r' '\n'`. `Samus.as` = `com/smbc/characters/Samus.as`,
`SamusShot.as` and `SamusBomb.as` in `com/smbc/projectiles/`.

| Req | Original | Ours (where it lands) |
|---|---|---|
| SA-C1, C2 | `Samus.as:906-916` (Up), `:918-927` (Jump), `:984-1025` (Attack), `:1032-1048` (Special, Select; `classicMode` there is the Classic Samus **cheat**, off by default), `:1094-1136` (Down) | `samus/index.ts:222-249`, `:205-212` |
| SA-C3 | `Samus.as:207`, `:407`, `:495-521`; clamp `main/AnimatedObject.as:257-260` | `index.ts:14-33` |
| SA-C4 | `Samus.as:504`, `:686-737` (crouch persists while `vx == 0`), `:909-913`, `:1101-1107`; tutorial text `TutorialManager.as` ("Press down while crouching") | `entities/player.ts:174-181` |
| SA-C6 | `Samus.as:223`, `:398`, `:408`, `:532-552`; order `AnimatedObject.as:179-187`, `:270-283` | `player.ts:216-262` |
| SA-C7 | `Samus.as:410` (`fy` .0001), `:832-838`, `:928-937` | `player.ts:233` |
| SA-C8 | `Samus.as:208`, `:538-542`, `:698-702`, `:803-830`, `:854-877`, `:452-457`, `:522-528`, `:1113` | `index.ts:80` |
| SA-C9 | `ground/SpringGreen.as:22` | `entities/objects/spring.ts:25-34` (already matches) |
| SA-C10 | `Samus.as:399-404`, `:458-469`, `:924-925` | `player.ts:16`, swimming report |
| SA-C11 | `Samus.as:90-107`, `:339-353`, `:1470-1481`; `Character.as:610-618`, `:2037-2085`; `StatManager.as:1192-1220`; `GameSettings.as:191`, `:221`, `:229` | `index.ts:166-186`, `:267-309` |
| SA-C12 | `Samus.as:102`, `:112`, `:139-141`, `:584-633`, `:655-659`, `:672-684`, `:1049-1054` | `index.ts:38`, `:123-131` |
| SA-C13 | `Samus.as:116`, `:309` (`_canGetAmmoFromBricks`), `:660-671` | `index.ts:197-203` |
| SA-C14 | `Samus.as:201-202`, `:1004-1015`, `:1076-1085` | `index.ts:40`, `:114` |
| SA-C15 | `Samus.as:210-211`, `:231`, `:1184-1207`, `:1227-1238`; `Character.as:207` | `index.ts:166-173`, `:300-309` |
| SA-C16 | `Samus.as:1152` (Varia vs `FireBar`), `:97` (Flower list has no Varia), `:1052` (Star) | `index.ts:301`; `entities/enemies/firebar.ts:55` |
| SA-C17 | `Samus.as:204-205`, `:998`, `:1019`, `:1054`; `SamusShot.as:323` | `index.ts:117-121`, `:133-135`; `world/world.ts:574` |
| SA-C18, C19 | `SamusShot.as:34`, `:51-54`, `:83-84`, `:104-175`, `:253-260`, `:261-264`, `:286-309`; `data/DamageValue.as:65-70`; `ground/Brick.as:174-191`; `projectiles/Projectile.as:39-44`, `:98-104` | `samus/weapons.ts:3-67`; `projectile.ts:237-282` |
| SA-C20 | `SamusShot.as:55-62`, `:176-223` | `index.ts:98-115` |
| SA-C21 | `Samus.as:237`; `SamusShot.as:158`; `statusEffects/StatFxFreeze.as:27-29`, `:45-79`, `:131-138`; `enemies/Enemy.as:175`, `:594-606`; `Bowser.as:96`; `Lakitu.as:68` | `enemy.ts:111-119`; `rules/damage.ts:56-61` |
| SA-C22 | `SamusShot.as:40-44`, `:83-84`, `:160-175`, `:224-252`, `:286-291` | `weapons.ts:40-49`; `projectile.ts:271-274` |
| SA-C23 | `Samus.as:239`, `:296-301`; `SamusBomb.as:41-47`; `Enemy.as:594-625`; `Bowser.as:95`; `Lakitu.as:67`; `main/LevObj.as:89`, `:660-673`; `SamusShot.as:277-284`; `data/HealthValue.as:9-11`, `:19`, `:23` | `enemy.ts:100-125` |
| SA-C24 | `Samus.as:199`, `:240`, `:321`, `:414`, `:560-569`, `:854-877`, `:1208-1226`, `:1370-1375`; `DamageValue.as:64`; `Character.as:739-747` | `character.ts:43` (`contactDamage`) |
| SA-C25, C26 | `Samus.as:156-157`, `:218-219`, `:878-904`, `:1108-1122`, `:1281-1286` | `index.ts:87-96`, `:229-237`, `:216-221` |
| SA-C27 | `Samus.as:205`, `:1019-1024`; `SamusBomb.as:27-30`, `:45-75`, `:76-79`, `:118-127` | `index.ts:133-159`; `bomb.ts:47-60`; `world.ts:612` |
| SA-C28 | `Samus.as:158`, `:1137-1151` | `index.ts:146-155` |
| SA-C29 | `Samus.as:1394-1400`; `ground/Brick.as:193-210` (head bump), `:229-235` | `index.ts:176`; `world.ts:1106` |
| SA-C31 | `Samus.as:452-457`, `:986-987`, `:1039`, `:1281-1286`, `:1359-1393` | `index.ts:216-221` |
| SA-C32 | `Samus.as:142-143`, `:1334-1358` | — |

### Implementation hints

- **Silo.** Add `src/game/characters/samus/classic.ts` exporting `SAMUS_CLASSIC: CharacterDef` (id `samus`) and
  `samus/classic-weapons.ts` for the Classic projectile specs. The registry picks it when `rules === 'classic'`.
  Do not edit `SAMUS`, `SAMUS_PROFILE` or `weapons.ts`.
- **Profile.** `SAMUS_CLASSIC_PROFILE`: `instantAccel: true`; `minWalk`, `maxWalk`, `maxRun` `0x01400`;
  `canRun: false`; `airControl: 'full'` plus the shared optional `airStop: true` (SA-C3: `airMove` otherwise keeps vx
  when no direction is held, `player.ts:452-458`; SI-C6, LK-C5); one jump tier `{ maxVx: Infinity, initial: 0x0411C, holdGravity:
  0x0018E, fallGravity: 0x0018E }`; `maxFall` and `fallReset` `0x03C00`; `coyoteFrames: 0`.
- **Soft cut.** Add a new `variableJump` value, for example `{ damp: 0.8577 }`, handled next to the hard cut
  at `player.ts:233`: on the release frame set a per-jump flag; while the flag is set and `vy < 0`, multiply
  `vy` by the factor (truncate toward 0). No Current profile uses it.
- **Crouch.** The shared crouch (`player.ts:174-181`) is "held" based and shrinks the hitbox. Samus's is latched.
  Keep `crouches: false` and hold a `scratch.crouch` flag in Classic `behaviour.update`; `hitbox` returns 12 × 15
  while it is set (SA-C4). Add one optional hook,
  for example `behaviour.holdsStill?(p, input): boolean`, read at `player.ts:181` to force `dir = 0`
  (crouched, or Down held on the ground outside the ball). Add `crouch` and `crouch-shoot` frames to
  `src/content/sprites/samus.ts:274-298`.
- **Ball entry in the air and Jump in the ball.** Today `canJump` is false in the ball (`index.ts:214`). In
  Classic keep it false and handle a Jump press in `update` as "leave the ball" (no jump speed).
- **Somersault.** Keep `scratch.takeoffY` (set on a jump with a direction held, cleared on landing) and
  `scratch.flip`. Drive `spin-*` from `scratch.flip`, not from `vx`.
- **Screw Attack.** Use `behaviour.contactDamage` (`character.ts:43`): return a killing, armour-piercing
  `DamageSource` when `flip && screw && !(enemy is Bowser)`; a non-null result already means she is not hurt.
- **Shots.** In `classic-weapons.ts` add specs for the short beam (`lifetime: 12`), Long, Wave, Ice and missile,
  with the speeds above. Count beams and missiles together (a shared kind, or two calls to
  `world.countProjectiles`, `world.ts:574`). New spec fields, used only by Classic specs: `bricksOnly` (Wave:
  free flight that still collides with brick and ? block tiles), `wave.axis` and `wave.phase` (vertical when
  fired up; alternate sign per shot), `destroyOffTop`, and an up-pointing missile frame. Keep the current
  `wave` code path for Current (`projectile.ts:271-274`).
- **Ice, hit-stun, damage.** Branch in one place in `enemy.ts` (the HP report's Classic path): a `frozen`
  timer separate from `stunned`, a 9-frame `hitStop` and a 9-frame `hitInvuln`. For the frozen block, add an
  off-grid solid rectangle that only players collide with. If the tile collider can't take off-grid solids
  quickly, start with a one-way top surface like `Lift` (`world.ts:1458`) and note it in the PR.
- **Bombs.** Bomb options: `floats: true` (skip `this.fall` at `bomb.ts:48`), `fuse: 57`, a 12-frame live blast
  that tracks enemies and players already hit, and an `onBlast` callback for the boost (any pose, `vy >= 0`,
  once per bomb).
- **Bricks.** `canBreakBricks: () => false`. Add an optional `bumpsBlocks?(p)` hook read in `world.ts:1106`
  (`strikeBlock`) that returns false in the ball.
- **No belt, no energy.** Omit `tools`, `meter` and energy pickups. Use the power-state damage model from the
  power-states report. Fire bars need no change (no Varia).
- **Sounds.** Screw Attack and bullet-proof sounds are new. Until they exist, play nothing for the Screw Attack
  and `bump` for bullet-proof.
- **Guide.** A Classic guide (`SAMUS_CLASSIC_GUIDE`) should describe these controls. Low priority.

### Acceptance checks

Headless, with `rules: 'classic'` unless noted:
1. **Jump.** Standing, hold Jump: apex 87 ± 1 px on frame 42 ± 1. Release on frame 1: apex 17 ± 1 px.
   Release on frame 10: 46 ± 1 px. Falling speed never exceeds 3.75 pf.
2. **Walk.** Holding Right gives vx = 1.25 pf on the first frame; releasing gives 0 on the next frame. Same in
   the air.
3. **Crouch and ball.** Down on the ground: vx 0, crouched; release Down: still crouched; Down again: ball,
   feet 2.5 px higher on that frame. The crouch hitbox is 12 × 15. Down in mid-air: ball. Jump in the ball under a 1-tile ceiling: refused.
4. **Somersault.** A running jump reaches the spin pose once 30 px above take-off; a standing jump never does.
   Firing ends it. With the Flower, a running jump into a Goomba at the spin height kills it and Samus takes
   no damage; the same into Bowser hurts her.
5. **Caps.** With 3 beams out, Attack spawns nothing; with 2 beams out, Special fires one missile and the count
   drops by 1; a fourth press does nothing and the count is unchanged.
6. **Damage.** Goomba: 2 beams. Koopa: 4 beams. Buzzy Beetle: beams do nothing, 2 missiles kill it. Bowser
   (2400 form): 16 beams.
7. **Ice** (`&kit=full`, Select to the Ice Beam): one hit freezes a Goomba with HP unchanged; Samus can stand on it
   for 360 frames; touching it does not hurt; a beam on it thaws it and removes 150 HP.
8. **Wave.** Fired at a ground column it passes through; fired at a brick it breaks it and stops; it waves
   ±15 px with a period of 15 frames; consecutive shots start in opposite directions.
9. **Bombs.** A bomb laid in mid-air stays at the same y for 57 frames; a balled Samus sitting on it rises
   18 ± 1 px; a standing Samus falling onto a live blast is boosted too.
10. **Power states.** Flower → one enemy touch → small: beam range 50 px, no Screw, missile count unchanged,
    missile cap still 99. A second touch kills her.
11. **Bricks.** Small or powered, a head hit bumps a brick and never breaks it; an upward beam breaks it.
12. **Current unchanged.** With `rules: 'current'`, all existing Samus tests and headless sims pass unchanged
    (apex 72-74 px, EN 30, 2-beam cap).

### Confidence

- **From source (not played):** every original number above. The original was not booted for Samus.
- **Computed:** jump heights and timings (stepped with the original's gravity-then-move order at dt = 1/60), the
  bomb boost height, the Wave period, and the hits-to-kill table.
- **Played (ours):** the Current behaviour in Actual (walk, jump, head-breaking, beams vs bricks, bomb jump, Wave
  one-shot), from the comparison unit.
- **Estimated or not extracted from the SWF:** hitbox sizes (standing, crouched, ball, shots, bomb blast), the
  shot registration point, the explosion's live length.

### Open questions

1. **Standing shots vs a Goomba.** The original fires standing shots 22 px above the feet. If that is the shot's
   centre, a standing beam passes over a 16 px Goomba and she must crouch, which fits the original giving her a
   crouch. **Default:** treat the listed heights as the shot centre. Playtest the original to confirm.
2. **Crouch hitbox.** Settled from the SWF: the crouch box is 13.5 × 15.5 px, so Classic uses 12 × 15 (SA-C4). The
   original has no ceiling check when leaving the crouch (`canExitCrouch` is never called). **Default:** she stays
   crouched until 12 × 24 fits, so she is never pushed into tiles.
3. **Bomb blast size and length, and bombs vs bricks.** The SWF rectangles and frame count were not extracted.
   The bomb can hit bricks from the moment it is laid (`HT_BRICK` with `PR_PASSTHROUGH_ALWAYS`).
   **Default:** 24 × 24 blast, live 12 frames, bricks per the bricks report.
4. **Hit during the somersault.** The original does not end the flip on a hit. **Default:** end it (SA-C8).
5. **Missiles after death.** Missiles are "never lose" upgrades, but the death reset is shared code.
   Settled from source (PS-C21): death resets the kit. `Character.cleanUp` calls
   `removeAllUpgradesForChar(charNum, false, true)`, which restores the default upgrade list (`StatManager.as:1322-1323`),
   and `setAllAmmoToDefault`, so she comes back small with the Morph Ball only.
6. **Physics step.** If the original steps at 1/30 s, the full jump is about 85 px instead of 87 px. **Default:**
   1/60 s, as in every report.

### Related reports

- [2026-10-07-dev-classic-smbc-rules-toggle.md](2026-10-07-dev-classic-smbc-rules-toggle.md) (the toggle, index).
- [2026-10-07-classic-power-states.md](2026-10-07-classic-power-states.md),
  [2026-10-07-classic-enemy-hp-and-armour.md](2026-10-07-classic-enemy-hp-and-armour.md),
  [2026-10-07-classic-bricks-and-shots.md](2026-10-07-classic-bricks-and-shots.md),
  [2026-10-07-classic-swimming.md](2026-10-07-classic-swimming.md).
- [2026-10-07-classic-follow-ups.md](2026-10-07-classic-follow-ups.md): Pit and Dark Pit (Samus skins),
  Modern mode (Varia Suit, random upgrades), Customize Weapons (Ice instead of Wave), the Classic Samus cheat.
- Open: `2026-10-06-water-non-mario-heroes-stroke.md` (Samus keeps jump power 500 with gravity 400 under water;
  overlaps SA-C10).
- Fixed: `2026-10-05-springboard-bounce-too-high.md` (Samus's green-spring boost 1750; SA-C9 relies on it).
