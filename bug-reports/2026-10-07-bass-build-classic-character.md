# Build Bass as a Classic SMBC character: rooted 7-way rapid-fire buster, dash, dash jump, double jump, Water Shield on the Flower

- **Severity:** feature request (new character, Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=bass` (once the toggle exists; today `?dev=1&level=1-1&char=bass` shows the Current behaviour)
- **Character and power:** Bass, all power states (small, Mushroom, Fire Flower)
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=bass` (Current). Mario starts: we have no Bass, and an unknown `char` falls back to the first hero.
2. Open `?dev=1&level=1-1&char=megaman` (Current) for comparison. Hold Attack: one shot fires, then nothing. Hold Right and Attack: Mega Man walks while shooting.
3. Once built, open `?dev=1&rules=classic&level=1-1&char=bass`. The select screen shows Bass on a second row. In the level, hold Attack: shots fire about 13 times a second, at most 3 on screen, and Bass stands still. Hold Up, then Up + Right, then Down: the shots go up, up at an angle and down at an angle.
4. Let go of Attack and press Jump, then Jump again in the air: Bass double jumps (about 102 px in all).
5. Press Down + Jump: Bass dashes 62.5 px. Press Jump during the dash: a dash jump that keeps the dash speed in the air (about 130 px across).
6. Take the Mushroom, then the Flower. Press Special: a ring of 8 water drops circles Bass. Once all 8 are out (about 82 frames), press Special again: they fly outward. Press Select: Attack now fires the Water Shield and Special the buster. Take one hit: Bass is small again, with no shield.

## Expected

Bass is a Classic-only character. He has no Current version. He appears on the select screen only while dev mode is on and Rules is Classic SMBC (TG-41 to TG-43 in `2026-10-07-dev-classic-smbc-rules-toggle.md`). He is a Mega Man variant: most of his rules are Classic Mega Man's, so this report points to `2026-10-07-megaman-classic-smbc-rules.md` (MM-C) wherever the rule is the same, and states only what differs.

Shared systems are only referenced here:
- power states, Lose Everything, hit response and drops: `2026-10-07-classic-power-states.md` (PS-C);
- enemy HP, armour and damage numbers: `2026-10-07-classic-enemy-hp-and-armour.md` (HP-C);
- bricks, `?` blocks and shots against solid ground: `2026-10-07-classic-bricks-and-shots.md` (BR-C);
- water: `2026-10-07-classic-swimming.md` (SW-C).

Units: px, px/frame (px/f), px/frame² (px/f²) and frames (f) at 60 fps. Fixed point is 0x1000 = 1 px/f. Original
values convert as Flash px/s ÷ 120, Flash px/s² ÷ 7200, ms ÷ 16.67 and Flash px ÷ 2.

### 1. Status in 3.1.21

**BA-1. Bass is fully playable in 3.1.21.**
- He is a real class, `Bass extends MegaManBase`, with his own select slot: slot 8, the second row, right of Mega Man. Nothing locks him.
- He reuses Mega Man's animation timeline (`inheritedForceShortClassName = "MegaMan"`). So his pose list and his hitboxes are Mega Man's. His sprite sheets have the same layout as Mega Man's (386 × 313 px).
- He has 16 skins. The default is "Bass NES" (source game Mega Man 10). Skins are out of scope. The one skin pair with different rules (Quick Man) is in Notes as an optional variant.
- **Fidelity.** Every rule below is read from the original's source. The hitboxes and the pose list come from the original SWF. Nobody played Bass in the original for this report. His art must not be copied (the original's art is not in our repo, and our heroes use our own art), so the sprites are a new art job (section 11).

### 2. Character definition

**BA-2. A new `CharacterDef`, `BASS_CLASSIC`, in `src/game/characters/bass/classic.ts`.** It follows our interface
(`src/game/characters/character.ts:103-147`) plus the toggle's `rules` field (TG-18). Sketch:

```ts
export const BASS_CLASSIC: CharacterDef = {
  id: 'bass',
  name: 'Bass',
  hudName: 'BASS',
  rules: 'classic',                        // TG-18, TG-41
  movement: BASS_CLASSIC_PROFILE,          // BA-8 to BA-15
  damage: { kind: 'powerup', states: ['small', 'big', 'fire'] }, // TG-21, PS-C
  stomps: false,
  crouches: false,
  canBreakBricks: () => false,             // head bumps only (BA-27)
  hitbox: () => ({ w: 12, h: 22 }),        // every pose, the dash too (BA-3)
  sprite: bassSprite,                      // BA-32, BA-33
  blockPowerUp: (p) => (p.powerState === 'small' ? 'mushroom' : 'flower'), // PS-C
  jumpSfx: () => 'jump-small',
  portrait: { sheet: 'bass', palette: 'bass', frame: 'idle' },              // BA-4
  meter: waterShieldMeter,                 // only while the Flower is held (BA-18)
  drop: classicMegaDrop,                   // weapon energy only (BA-18, PS-C)
  devKit: () => ({ classicAll: 1 }),       // TG-44 (BA-25)
  guide: BASS_CLASSIC_GUIDE,               // BA-36, src/game/characters/bass/guide.ts
  touchLabels: bassTouchLabels,            // BA-36
  behaviour: { update, onPowerUp, contactDamage: () => null, onHurt, onPickup, onGrabVine },
};
```

Leave out `tools` (except under the dev full kit, TG-44), `hudExtra`, `reserve` and `startHp` (TG-22). No `music`
override (BA-M11).

**BA-3. Hitbox.** Use **12 × 22 px in every pose**, the same as Classic Mega Man (MM-C4). The dash does **not**
shrink it.

| Pose | Original (SWF `MegaManMc` hit rectangle) | Ours |
|---|---|---|
| Standing, walking, shooting, aiming | 13.5 × 24 px | 12 × 22 px |
| Jumping (`jump`, `jumpShoot`) | 13.5 × 27.5 px | 12 × 22 px |
| Dash (`dash`, Bass) | 13.5 × 24 px: full height | 12 × 22 px: full height |
| Slide (`slide`, Mega Man only) | 13.5 × 15 px | not used by Bass |

The dash keeping its full height is the important part. Bass cannot dash under a 1-tile gap. Mega Man's slide can.

**BA-4. Select-screen slot and portrait.** Bass is the first entry of `CLASSIC_EXTRAS` (TG-41), so he is first on the
second row. His portrait is his `idle` frame on the `bass` sheet, as Mega Man's is his `idle` frame. (The original's
portrait is a 33 × 33 head shot in the sheet's top-left cell; our select screen draws body frames.)

### 3. Controls

**BA-5. What each control does.**

| Control (our key) | Classic action |
|---|---|
| Left / Right | Walk at 1.375 px/f, starting and stopping at once (BA-8). On the ground while the buster button is held: no walking; Left or Right only turns him (BA-9). Full control in the air: a held direction sets the speed, none sets 0. |
| Up / Down | Aim the buster while it fires (BA-20). Down + Jump on the ground: dash (BA-10). No crouch. |
| Jump (Z) | Jump on the ground. One double jump in the air (BA-12). During a dash: dash jump (BA-11). On the ground while the buster button is held: Jump still jumps, but Down + Jump does nothing. |
| Attack (X) | Hold: the Bass Buster fires at once, then every 75 ms while held (BA-21). |
| Special (C) | Small or Mushroom: nothing. Fire Flower: Water Shield (BA-23). |
| Select (Right Shift / Backspace) | Fire Flower: swap the Attack and Special roles at once, on the press (BA-6). Otherwise nothing. No Rush. |
| On a vine | Attack, Special and Jump do nothing (as Classic Mega Man, MM-C1). |

**BA-6. Button swap.** A press of Select toggles the swap at once. There is no hold timer and no Rush tap (that is
Mega Man's, MM-C3 and MM-C28). The swap works only while the Flower weapon is held and it is not Charge Kick. While
swapped, Attack fires the Water Shield and Special fires the Bass Buster, with the same auto-fire, aiming and rooting
(the "buster button" is then Special). Toggling the swap stops the auto-fire. Show the Water Shield icon in the HUD
while swapped. The swap is suspended while there is no Flower and comes back with the next Flower (as MM-C3).

**BA-7. Step nudge.** As Classic Mega Man (MM-C2: 2 px nudge, 6 frames held still), except that **no step starts
while the buster button is held**.

### 4. Movement and jumping

**BA-8. Constants.** `BASS_CLASSIC_PROFILE` starts from Classic Mega Man's profile (MM-C4, MM-C10) and changes the
jump.

| Constant | Original | Classic value | Fixed point | Classic Mega Man |
|---|---|---|---|---|
| Walk speed | 165 px/s | 1.375 px/f, instant start and stop | 0x01600 | same |
| Air control | `vx = ±vxMax` held, 0 released | full and instant; no direction sets vx = 0 | `airControl: 'full'` plus the SI-C6 "air stop" field | same |
| Gravity (rise and fall) | 1500 px/s² | 0.20833 px/f² | 0x00355 | same |
| Fall cap | 700 px/s | 5.8333 px/f (clamp) | 0x05D55 | same |
| **Jump speed** | **565** px/s (`JUMP_PWR`, used because `doubleJumpSkill`) | **4.7083 px/f**; our `initial` **4.5 px/f** | 0x04B55; **initial 0x04800** | 650 (initial 0x05355) |
| Dash jump speed | 650 px/s (`JUMP_PWR_HIGH_JUMP`) | 5.4167 px/f; our initial 5.2083 px/f | 0x056AB; initial 0x05355 | n/a |
| Double jump speed | 565 px/s (`jumpPwr`) | 4.7083 px/f; our initial 4.5 px/f | 0x04B55; initial 0x04800 | none |
| Dash speed | 300 px/s | 2.5 px/f | 0x02800 | same (slide) |
| Dash length | 125 Flash px | 62.5 px (about 25 frames) | distance, not frames | same (slide) |
| Coyote frames | none | 0 | | same |

**Launch speeds are corrected for our integration order.** The original adds gravity before it moves the body; ours
moves first. With the raw speeds our jumps come out 5-11 px too high. So every launch of Bass's body uses the
original speed **minus one frame of the gravity in force** as our `initial`: the jump and the double jump 0x04800,
the dash jump 0x05355 (the same as MM-C10's jump), and in water 0x0418E and 0x0558E (BA-15). This is the rule of
MM-C10, SA-C6, SI-C5 and BI-C10, and it gives the original's arc frame for frame. Projectiles need no change: our
projectile code already adds gravity before it moves (`projectile.ts:244-246, 265-270`).

Heights, stepped in the original's order (our engine gives the same with the initials above):

| Jump | Height |
|---|---|
| Normal jump, held | 50.9 px, apex on frame 22, lands on frame 45 |
| Released on the first airborne frame | 14.5 px (a rougher re-check gave about 10.6 px; confirm with the acceptance sim and use whatever the original's release rule produces) |
| Double jump at the apex of a normal jump | 102 px in all |
| Dash jump, held | 67.7 px, airtime 52 frames, so about 130 px across at 2.5 px/f |
| Dash jump, then double jump at the apex | 118 px in all |

**BA-9. Rooted while firing on the ground.** While the buster button is held (Attack, or Special when swapped) and
Bass is on the ground and not dashing:
- vx = 0 every frame. Left and Right do not move him. They set his facing at once.
- Up, Down, Left and Right only aim (BA-20). The pose shows the aim (BA-32).
- Down + Jump does nothing (no dash and no jump). Jump without Down jumps normally. In the air he moves freely while
  firing.
- Landing while still holding the button roots him at once (vx = 0 on the landing frame).
- The root also holds while the shot cap is full and no shot comes out.
- Letting go frees him on the same frame.
- In the air, holding the button never stops him.

Rooting must act **before** the frame's movement. Use the same before-movement hook as Classic Simon's rooting
(SI-C4), not `behaviour.update`, which runs after movement.

**BA-10. Dash** (Bass's slide). Down + Jump on the ground, not while rooted (BA-9):
- He moves at **2.5 px/f** in his facing direction and stops **62.5 px** from the start (MM-C5). Same speed and length
  in water.
- Ends early on a wall, or when the opposite direction is pressed (he stops and stands; vx = 0) (MM-C6).
- **His hitbox stays 12 × 22** (BA-3), unlike Mega Man's slide.
- The low-ceiling rule of MM-C7 is in the shared code, but it never triggers for Bass: he cannot enter a 1-tile gap,
  and a 2-tile corridor's ceiling tile is 29 px from his centre, beyond its 25 px reach.
- It crosses one-tile gaps at ground level, as Mega Man's slide (MM-C8).
- No shots come out during a dash. A held buster button resumes firing (and rooting) when the dash ends.
- Pose: `dash` (BA-32), not `slide`.

**BA-11. Dash jump.** Jump during a dash:
- Allowed with Down still held (Mega Man needs Down released, MM-C9). Not allowed with a ceiling above (MM-C7; never
  in practice, BA-10).
- vy = −5.4167 px/f (0x056AB), the tall jump, on land and in water alike. Our `initial`: 0x05355 on land, 0x0558E in
  water (one frame of the gravity in force less, BA-8).
- **The air speed cap stays 2.5 px/f** until he lands or uses the double jump. A held direction sets vx = ±2.5 px/f,
  either way, so he can reverse at full dash speed. No direction sets vx = 0.
- The same carried speed applies when a dash runs off a ledge: he falls with a 2.5 px/f cap.
- A normal jump (not from a dash) resets the cap to 1.375 px/f.

**BA-12. Double jump.** Pressing Jump in the air with the double jump ready:
- sets vy = −4.7083 px/f (0x04B55) on land, −4.1667 px/f (0x042AB) in water, whatever vy was (our `initial`
  0x04800 and 0x0418E, BA-8);
- resets the air speed cap to 1.375 px/f (it ends a dash jump's carried speed);
- makes the soft jump cut (BA-13) available again for this rise;
- clears the ready flag: one per stay in the air.

It is **ready again** when he lands on solid ground or a lift, and at a ground take-off. Walking off a ledge or
dashing off one leaves it ready. A spring does **not** ready it: landing on a spring is not a landing, so after a
spring launch he has it only if he had it before. It is **not available** while touching a spring (Jump boosts the
spring there), on a vine, or during knockback. If he spawns in the air (level start, pipe exit), it is not ready until
he first lands. Act on the press only: no jump buffer for the double jump. Reuse Classic Simon's air-jump field
(SI-C7, for example `airJumps: 1`) with Bass's speeds.

**BA-13. Soft jump cut.** As Classic Mega Man (MM-C11): when Jump is released while rising, multiply vy by **0.7943**
each frame (a decay of about 21% per frame, `vy *= 1e-6^dt`) until vy ≥ 0. Gravity still applies. Only the first
release per rise counts. It applies to the normal jump, the dash jump and the double jump. It does not apply to
spring launches.

**BA-14. Springs.** Springs use their own values, never the character's (`$S/chars/verify/A.md`). Bass is a
`MegaManBase`, so: red springs 500 px/s (1000 boosted), green spring 3000 px/s, as Mega Man. Add `bass` to
`SPRING_GREEN_BOOST` (`flash(3000)`) and `SPRING_RISE_GRAVITY` (`flashAccel(1500)`) in
`src/game/entities/objects/spring.ts:26-49`. Without the entry he would get Mario's 2750.

### 5. Swimming

**BA-15. No swim stroke.** Bass jumps from the floor only, plus his double jump (shared mechanism: SW-C).

| Constant | Original | Classic value | Fixed point |
|---|---|---|---|
| Floor jump | 500 px/s (`JUMP_PWR_WATER`) | 4.1667 px/f; our initial 4.0972 px/f | 0x042AB; initial 0x0418E |
| Double jump in water | 500 px/s | 4.1667 px/f; our initial 4.0972 px/f | 0x042AB; initial 0x0418E |
| Dash jump in water | 650 px/s (not reduced in water) | 5.4167 px/f; our initial 5.3472 px/f | 0x056AB; initial 0x0558E |
| Water gravity | 500 px/s² | 0.06944 px/f² | 0x0011C |
| Sink cap | 250 px/s | 2.0833 px/f | 0x02155 |
| Floor walk | full speed | 1.375 px/f | 0x01600 |
| Dash | same as on land | 2.5 px/f, 62.5 px | 0x02800 |

Heights, stepped in the original's order (our engine gives the same with the initials above): floor jump about
123 px; floor jump plus double jump at the apex about 246 px; dash jump about 209 px. In a normal water level the last two reach the surface line, where SW-C's surface rule takes
over. The soft cut, rooting, the buster and the Water Shield work the same in water. Bass is a "bad swimmer" for level
data (BA-31).

### 6. Health and power states

**BA-16. Kit per state.** Power states with Lose Everything (PS-C): one hit while powered removes the Flower **and**
the Mushroom together. One hit when small kills. So 2 hits kill from full power.

| State | Kit |
|---|---|
| Small | Bass Buster, **3** shots on screen; dash; dash jump; double jump |
| Mushroom | Survives one hit. Bass Buster cap **4**. Nothing else (no charge, no size change) |
| Fire Flower | + Water Shield on Special, with its energy bar; Select swaps the buttons |

A `?` block gives the Mushroom when small and the Flower otherwise, including when he has the Flower (PS-C). The
original's Classic Mushroom also grants "Charge Shot", but Bass can never charge, so it does nothing.

**BA-17. On a hit.** As Classic Mega Man (MM-C16):
- knockback 0.6667 px/f (0x00AAB) **backwards from his facing**, vy = 0, input locked **27 frames** (about 18 px);
- then **75 frames** of invulnerability with flicker (102 frames in all);
- the Water Shield drops vanish; buster shots stay;
- the button swap is suspended until the next Flower.

The lock releases the buttons, so the auto-fire stops. If the buster button is still held when the lock ends, firing
and rooting resume, with the first shot 75 ms (one auto-fire step, BA-21) later.

**BA-18. Weapon energy and drops.** As Classic Mega Man (MM-C17, MM-C18):
- the Water Shield has **112 units** (28 bars of 4) and costs **16** per shield, so 7 shields per full bar;
- each Flower adds 40 units, up to 112;
- the energy is kept through hits and levels, and refilled on death;
- the buster is free;
- during Star power the shield is free;
- show the 28-bar meter only while the Flower is held (`meter`).

Drops are weapon energy only: 82.5% small (8 units), 17.5% big (40 units), at the shared rate (PS-C). The original
maps Bass to Mega Man's drop table. Refills freeze the game as MM-C18 describes. No health drops, no E-tanks.

### 7. Weapons

**BA-19. Bass Buster.**

| Property | Original | Classic value |
|---|---|---|
| Damage | 50 (`DamageValue.MEGA_MAN_BASS_BUSTER`, the game's weakest weapon) | 50, in HP-C's scale |
| Speed, forward | 580 px/s | 4.8333 px/f (0x04D55) |
| Speed, straight up | 580 px/s on y | vy −4.8333 px/f |
| Speed, diagonal | 580 × 0.75 on each axis | 3.625 px/f on each axis (0x03A00) |
| Size | SWF `bassBuster` hit rectangle 16 × 16 Flash px | 8 × 8 px, centred on the spawn point |
| Cap | 3 small; 4 with the Mushroom or Flower | counts all of Bass's projectiles on screen **except Water Shield drops** (and Pharaoh shots under the full kit) |
| Rate | first shot on the press, then one every 75 ms while held | BA-21 |
| Gravity | none | 0 |
| Charge | never (`canChargeWeapon` returns false for Bass) | none |

Behaviour:
- It is **stopped by solid ground**: floor, walls, pipes, stairs and lifts end it. This is the opposite of the Mega Buster, which passes through ground (C4; BR-C's per-hero table).
- It hits bricks and `?` blocks (BR-C): an empty brick (125 HP) breaks on the **3rd** shot; a `?` or coin block gives its item. The shot ends on the hit.
- It ends on any enemy hit. It does not pierce.
- Against armour (HP-C) it bounces back as the Mega Buster does (MM-C19): vx reversed, vy −2.9167 px/f (0x02EAB), harmless from then on.
- It is destroyed off screen.
- No shot fires during a dash or on a vine.

**BA-20. Aim and spawn point.** The direction is read from the d-pad **at the moment each shot fires**. Positions are
from Bass's centre line, measured up from his feet. "Ahead" means in his facing direction.

| Held | Direction | Velocity (px/f) | Spawn, on the ground | Spawn, in the air |
|---|---|---|---|---|
| nothing, or Left/Right only | forward | (±4.8333, 0) | 19 px ahead, 13 px up | 19 px ahead, 17 px up |
| Up only | straight up | (0, −4.8333) | 5 px ahead, 23 px up | 5 px ahead, 27 px up |
| Up + Left or Right | up and forward | (±3.625, −3.625) | 16 px ahead, 20 px up | 16 px ahead, 24 px up |
| Down, with or without Left/Right | down and forward | (±3.625, +3.625) | 16 px ahead, 6 px up | 16 px ahead, 10 px up |

That is 7 directions over both facings. There is no straight down. While rooted, Left or Right also turns him first,
so Up + Left aims up-left.

**BA-21. Auto-fire cadence.** The buster button's press fires at once, if the cap allows. While it stays held, a
timer fires again every **75 ms**, carrying the remainder: count 2 per frame, fire when the count reaches 9, then
subtract 9. That gives shots on frames 0, 5, 9, 14, 18, 23 and so on (alternating 5 and 4 frames, 13.3 shots a
second). A tick with the cap full fires nothing and the timer keeps running. Letting go stops the timer. Each new
press fires at once and restarts the timer, so fast tapping can fire faster than holding.

**BA-22. Hits to kill** with the buster (HP-C table, damage 50; the Water Shield's 275 per drop for comparison).

| Target | HP | Bass Buster | Water Shield drops |
|---|---|---|---|
| Brick (empty) | 125 | 3 | 1 |
| Goomba | 250 | 5 | 1 |
| Piranha | 275 | 6 | 1 |
| Spiny | 350 | 7 | 2 |
| Koopa | 600 | 12 | 3 |
| Hammer Bro, Lakitu | 800 | 16 | 3 |
| Flying Koopa | 900 | 18 | 4 |
| Bowser (fire / hammer / both) | 2400 / 3600 / 4400 | 48 / 72 / 88 | 9 / 14 / 16 |

**BA-23. Water Shield (his Classic Flower weapon).** Bass's Classic default weapon is the **Water Shield**
(`GameSettings.bassWeapon`). Mega Man's is Metal Blade. Build it to the spec in MM-C22 (row "Water Shield") and
MM-C25. Summary: costs 16 units; 8 drops orbit his centre at 22.5 px, 0.0667 rad/f, turning the way he faced when he
fired; 275 damage per drop, each drop ends on its hit; a second press when all 8 are live sends them outward at
+2.5 px/f from that point, free of cost; drops pass through ground and break bricks; armour destroys a drop; one
shield at a time. It never roots him. Drops do not count towards the buster cap. Bass wears a Water Shield palette
while he holds the Flower (BA-33). Classic Mega Man builds all 9 weapons in the shared Mega Man weapons file
(MM-C21, MM-C22); Bass uses its Water Shield from there.

**BA-24. The other 8 weapons.** Bass shares Mega Man's 9 Robot Master weapons with the same costs and behaviour (the
original's tables in `Bass.as` match `MegaMan.as`). See MM-C22 to MM-C26. They are all built (MM-C21). In Classic
the Flower gives only the Water Shield; the other 8 are reached only through `&kit=full` (BA-25, TG-44).

**BA-25. Dev full kit.** Under `&kit=full` (TG-44), `devKit()` grants all 9 Robot Master weapons (MM-C21), at the
Fire state with 112 units each. A Select press cycles the Flower weapon through them in MM-C22's order with the shared
`cycleTool` (there is no Rush to add to the cycle), and Special fires the selected weapon. While that kit is carried,
Select cycles instead of swapping buttons, so the buster stays on Attack. Without it Bass has only the Water Shield.

**BA-26. What Bass does not have.** No charge shot (even with the Mushroom). No Rush Coil, no Rush tap. No stomp. No
shield block. No E-tanks, HP bar or health drops.

### 8. Special abilities

The double jump (BA-12), the dash and dash jump (BA-10, BA-11) and the rooted 7-way auto-fire (BA-9, BA-19 to BA-21)
are his special abilities. He has nothing else.

### 9. Interactions

**BA-27. Bricks and blocks.** His head bumps bricks in every state and never breaks them (`brickState =
BRICK_BOUNCER`; BR-C). Buster shots break bricks in 3 hits and open `?` blocks from the side or below (BA-19).

**BA-28. Enemies and hazards.** No stomp: landing on an enemy hurts him (PS-C). Firebars hurt. Bowser is fought with
the buster (48 shots for the 2400 form) or the shield. Nothing about Bowser is Bass-specific.

**BA-29. Vines, pipes, flagpole, Star.** Shared code, as Classic Mega Man. On a vine: no attacks and no jump; a held
buster stops firing. On the flagpole the shooting pose ends. Star lasts 12 s (PS-C).

**BA-30. 2-player.** Either player can be Bass under Classic (TG-30). Buster caps count each player's own shots.

### 10. Level data needs

**BA-31. No Bass-only level data.** The original's helper-object flags for Bass are `usesHorzObjs = false` and
`usesVertObjs = false`, the same as Mario (Mega Man is true/false). So Bass sees the level variant Mario sees. He is
not a "wide character" and not a "poor Bowser fighter". He is a "bad swimmer" (`isGoodSwimmer` false, like every
hero except Mario, Luigi and Sophia), so water levels show him whatever SW-C decides for non-swimmers. Needed:
- the one-tile-gap crossing for dashes (MM-C8);
- the spring entries (BA-14).

### 11. Sprites and sound

**BA-32. Poses.** Our Mega Man frames are 16 × 32 px canvases (24 × 32 for shooting frames), drawn with offset
(2, 10) over the 12 × 22 hitbox (`src/content/sprites/megaman.ts:164-317`; `megaman/index.ts:73-117`). Bass's frames
use the same canvas and offsets. The SWF labels are from the shared `MegaManMc` timeline.

| Our frame | SWF label | Shown when | Canvas |
|---|---|---|---|
| `idle` | `stand` | standing | 16 × 32 |
| `step` | `walk-0` | the step nudge (BA-7) | 16 × 32 |
| `walk-0` … `walk-2` (3, as our Mega Man) | `walk-1` … `walk-4` (4 labels) | walking | 16 × 32 |
| `walk-shoot-0` … `walk-shoot-2` | `walkShoot-1` … `walkShoot-4` | walking within 12 frames of a shot (after letting go of the buster, or after a Water Shield) | 24 × 32 |
| `shoot` | `shoot` | rooted, aiming forward | 24 × 32 |
| `shoot-up` | `shootUp` | rooted, Up | 16 × 32 (arm above the head, inside the top 8 rows) |
| `shoot-diag-up` | `shootDiagUp` | rooted, Up + Left/Right | 24 × 32 |
| `shoot-diag-down` | `shootDiagDwn` | rooted, Down | 24 × 32 |
| `jump` | `jump` | in the air | 16 × 32 |
| `jump-shoot` | `jumpShoot` | in the air, firing forward | 24 × 32 |
| `jump-shoot-up` | `jumpShootUp` | in the air, Up | 16 × 32 |
| `jump-shoot-diag-up` | `jumpShootDiagUp` | in the air, Up + Left/Right | 24 × 32 |
| `jump-shoot-diag-down` | `jumpShootDiagDwn` | in the air, Down | 24 × 32 |
| `dash` | `dash` | dashing; upright and leaning forward, it must fill the 22 px tall hitbox | 24 × 32 |
| `hurt` | `takeDamage` | knockback, death | 16 × 32 |
| `climb-0`, `climb-1` | `climbStart`, `climbEnd` | on a vine or the flagpole | 16 × 32 |
| `death-orb` | (`MegaManParticleMc`) | the death ring of orbs, 8 × 8 | 8 × 8 |

Not needed: `slide`, `throw`, `jumpThrow` (Proto Man only), `climbShoot*` (no attacks on a vine), the teleport
frames, and Rush/Treble frames. The original Bass sheet has Treble (wolf) frames in Rush's cells, but 3.1.21 never
uses them for Bass.

**BA-33. Projectile and palettes.**
- `bass-buster` on the `items` sheet: one 8 × 8 frame, no animation. The default skin does not rotate it.
- Palettes on the `bass` sheet, with the same 6 index roles as Mega Man's (`megaman.ts:9-12`): `bass` (default), `bass-water` (Water Shield suit, worn while the Flower is held, as Mega Man's suit changes with his weapon), and `bass-star-0` … `bass-star-3` (Star cycle). No charge palettes.
- Register the sheet, palettes and fallbacks in `src/content/sprites/index.ts` (like `megaman`, lines 38, 59, 97, 111).

**BA-34. Minimum to make him testable.** A palette swap of our Mega Man frames:
- point the `bass` sheet at `megamanDef` with new palettes, for example `bass: [NES.black, NES.darkGray, NES.orange, NES.skin, NES.white, NES.yellow]` and `bass-water: [NES.black, NES.skyLight, NES.blueMid, NES.skin, NES.white, NES.white]`;
- use `shoot` for every ground aim pose and `jump-shoot` for every air aim pose;
- use `walk-1` for `dash`;
- use `buster-0` (8 × 6, `items.ts:1804`) for the shot.

That is enough to test every rule. Final art is BA-M1 to BA-M4.

**BA-35. Sound.** Reuse Classic Mega Man's sounds: the buster sound for every Bass shot (the original plays Mega Man's
shoot sound for each one), Mega Man's hit, death, landing, pickup and energy-refill sounds, and the Water Shield
sounds MM-C25 uses. No new sound is required.

### 12. Guide text

**BA-36. `BASS_CLASSIC_GUIDE`** in `src/game/characters/bass/guide.ts`. Keep within the guide tests: tagline at most 30
characters, actions from the allowed list, no button letters, font-safe characters (`guide.test.ts`; TG-40).

```ts
export const BASS_CLASSIC_GUIDE: CharacterGuide = {
  tagline: 'Rapid fire, dash, double jump',
  controls: [
    { action: 'left/right', does: 'Walk. Starts and stops at once. While you shoot on the ground, it only turns you.' },
    { action: 'jump', does: 'Jump. Press again in the air for one double jump.' },
    { action: 'down+jump', does: 'Dash along the ground. Jump while dashing for a long, fast dash jump.' },
    { action: 'attack (hold)', touch: 'SHOOT', does: 'Rapid fire, 3 shots at a time. On the ground you stand still while firing.' },
    { action: 'up', does: 'While shooting: aim up. Add left or right to aim up at an angle.' },
    { action: 'down', does: 'While shooting: aim down at an angle.' },
    { action: 'special', touch: 'WATER', does: 'With the Flower: Water Shield. Press again to send it out.' },
    { action: 'select', touch: 'SWAP', does: 'With the Flower: swap the shot and Water Shield buttons.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Survive one hit. Four shots at a time.' },
    { item: 'flower', does: 'The Water Shield and its energy bar.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
    { item: 'drops', does: 'Weapon energy for the Water Shield.' },
  ],
  tips: ['One hit takes the Mushroom and the Flower together.', 'Bass cannot charge his buster.'],
  demo: ['idle', 'walk', 'jump', 'attack'],
};
```

Touch labels: attack `SHOOT`; special `WATER` while the Flower is held, hidden otherwise; select `SWAP` while the Flower
is held, hidden otherwise.

### 13. Build steps

**BA-37. Order** (all paths in `$S/main`):
1. **Prerequisites:** the toggle (TG-1 to TG-44, with `CLASSIC_EXTRAS` and the second select row from TG-41); the
   shared Classic helpers from PS-C (`src/game/characters/classic/power.ts`), HP-C (`src/game/rules/classic-enemies.ts`),
   BR-C and SW-C; Classic Mega Man (`megaman/classic.ts`, `classic-weapons.ts`) with its new profile fields (soft cut,
   slide by distance, gap crossing, step nudge); Classic Simon's `airJumps` and air-stop fields (SI-C6, SI-C7) and his
   before-movement rooting hook (SI-C4).
2. `src/game/characters/profile.ts` and `src/game/entities/player.ts`: add the optional dash fields, unset in every
   Current profile:
   - `slide.jumpWithDown` (a jump from a slide is allowed with Down held);
   - `slide.jumpSpeed` (the dash jump: our initial 0x05355 on land, 0x0558E in water, BA-8);
   - `slide.keepSpeedInAir` (the 2.5 px/f air cap after a dash jump or a dash off a ledge, until landing or the air jump);
   - an air-jump initial per medium (0x04800 land, 0x0418E water, BA-8).
   `canJump` (`player.ts:200-203`) must allow `sliding > 0` when the profile says so.
3. `src/game/characters/megaman/classic-weapons.ts`: nothing to add. Bass reuses the 9 weapons Classic Mega Man
   builds there (MM-C21, BA-23, BA-25).
4. `src/game/characters/bass/classic-weapons.ts`: the `BASS_BUSTER` spec (BA-19) with tiles that stop it and bricks
   it damages (BR-C), plus the aim table (BA-20).
5. `src/content/sprites/bass.ts` (palettes and frames, BA-32 to BA-34) and its registration in
   `src/content/sprites/index.ts`; `bass-buster` in `src/content/sprites/items.ts`.
6. `src/game/characters/bass/guide.ts` (BA-36) and `src/game/characters/bass/classic.ts` (BA-2), whose
   `behaviour.update` runs the swap (BA-6), the auto-fire timer and cap (BA-21), the shot spawns (BA-20) and the
   Water Shield.
7. `src/game/characters/registry.ts`: `CLASSIC_EXTRAS = [BASS_CLASSIC]` (TG-41). Never add him to `CHARACTERS`.
8. `src/game/entities/objects/spring.ts`: the `bass` entries (BA-14).
9. Tests: `tests/sim/bass-classic.test.ts` (Acceptance checks in Notes) and the TG-40 guide cases.

### Missing information to fill in

| ID | Gap | Suggested default | Decides |
|---|---|---|---|
| BA-M1 | Bass's body art: every frame in BA-32 | Palette swap of our Mega Man frames (BA-34) until drawn | owner (art) |
| BA-M2 | The 6 aim poses (`shoot-up`, `shoot-diag-up`, `shoot-diag-down` and the 3 jumping ones). Our Mega Man has none | `shoot` and `jump-shoot` | owner (art) |
| BA-M3 | The `dash` pose, upright and leaning (not a low slide) | `walk-1` | owner (art) |
| BA-M4 | The Bass Buster shot sprite, 8 × 8 | `buster-0` | owner (art) |
| BA-M5 | Palette colours for `bass`, `bass-water` and the Star cycle | the values in BA-34; Star reuses Mega Man's star rows | coder, owner approves |
| BA-M6 | Hitbox: the original is 13.5 × 24 px (27.5 px tall in jump poses); ours for Mega Man is 12 × 22 | 12 × 22 in every pose, the dash included (BA-3) | owner |
| BA-M7 | Integration order: our engine moves before adding gravity, the original after, so raw launch speeds give jumps 5-11 px too high | every launch uses the original speed minus one frame of the gravity in force (BA-8), as MM-C10, SA-C6, SI-C5 and BI-C10 | coder |
| BA-M8 | Whether the original steps physics at 1/60 s (the stage frame rate default is 30 fps) | 1/60 s, as every other Classic report | coder |
| BA-M9 | Sound for each of up to 13 shots a second: the original plays one per shot | play `buster` per shot; owner may thin it after a playtest | owner |
| BA-M10 | Weapon pellets taken with no Flower, or a full bar | collected with no effect (MM-C open question 6) | coder |
| BA-M11 | Music: the original's Bass skin plays a Mega Man 10 / Mega Man & Bass set | no `music` override (our default level music, as Mega Man) | owner |
| BA-M12 | The original's select-screen entrance (Bass dashes, then dash jumps; Mega Man teleports) | none | owner |
| BA-M13 | The castle text: the default Bass skin renames the princess to "Dr. Wily" | keep our shared text | owner |
| BA-M14 | The guide wording (BA-36) and touch labels | as written in BA-36 | owner approves |
| BA-M15 | Feel: the rooting turret and the short 51 px jump are unplayed | build as specified; playtest before promoting to Current | owner |

## Actual

- We have no Bass. `?char=bass` starts the first hero, Mario (`src/main.ts:178`). `characterById` also falls back to
  Mario (`src/game/characters/registry.ts:14-16`). The roster is 8 heroes (`registry.ts:12`).
- Parts that carry over from our Mega Man:
  - the instant 1.375 px/f walk (`src/game/characters/megaman/index.ts:16-36`);
  - the slide at 2.5 px/f (`index.ts:35`; `src/game/entities/player.ts:186-189, 205-207, 407-422`);
  - `Projectile` with per-shot `vx`/`vy` (`src/game/entities/projectiles/projectile.ts:57-64`), which the Saw already uses for 8-way aim (`index.ts:159-169`);
  - the weapon energy meter (`index.ts:188-198`).
- Missing in our player code:
  - `canJump` forbids a jump while sliding (`player.ts:200-203`);
  - there is no air jump;
  - the jump cut is hard (`player.ts:233`);
  - with no direction held, `airMove` keeps vx (`player.ts:452-458`);
  - the buster fires only on a press (`index.ts:283`);
  - nothing roots a hero while firing.
- The green spring table has no `bass` entry, so an unknown hero gets Mario's 2750 (`spring.ts:26-35, 119-121`).

## How often

every time

## Notes

- **Sources** (original; line numbers from `tr '\r' '\n'` copies in `$S/classic/bass-work/`, matching `$S/chars/work-bp/`):
  - Class, flags and kit: `characters/Bass.as:21-46` (weapons, ammo costs, drops, no Rush, empty Mushroom upgrades),
    `:96-114` (`canDashJump`, `doubleJumpSkill`, `defWeapon = MM_BASS_BUSTER`, helper flags), `:122-132` (Classic
    weapon, Select swap). Unused `BULLET_Y_PAD_*` at `:91-92`.
  - Constants: `characters/base/MegaManBase.as:166-168` (caps 3/4), `:236-261` (slide, gravity, jumps, walk, flicker,
    invulnerability), `:276-279` (knockback), `:306` (75 ms), `:461-497` (`setStats`: jump choice, `fy`, fall cap).
  - Movement: `MegaManBase.as:898-981` (rooting `:900`, slide turns), `:990-1015` (jump, dash jump, double jump,
    speed cap), `:1017-1172` (slide end, ceiling band, air cap `:1123-1124`, soft cut `:1162-1166`, stance
    `:1168-1169`), `:1197-1209` (water slide), `:1263-1324` (slide start, `dash` frame `:1317-1318`), `:1326-1352`
    (jump press, double jump not on a spring `:1337`, release), `:2744-2759` (`landOnGround` readies the double jump
    and roots).
  - Water: `MegaManBase.as:250-254, 471-480, 869-888`; sink cap `characters/Character.as:225, 997-998`.
  - Firing: `MegaManBase.as:1251-1262` (auto-fire), `:1415-1433`, `:1572-1584` (Bass Buster and cap),
    `:1740-1757` (release stops the timer and the root), `:1883-1912` (`shootStart`), `:1941-1967` (stance and aim
    frames), `:1982-2007` (no step while firing), `:2736-2743` (`shootTmrHandler` keeps the pose while held);
    `utils/GameLoopTimer.as` (`update` carries the remainder).
  - Projectile: `projectiles/MegaManProjectile.as:89-91, 101-102` (spawn pads, speeds), `:338-386` (aim, offsets,
    ×0.75), `:419-432` (damage 50, collides with all ground), `:757-795` (`setDir`), `:852-877` (deflect,
    `VY_DEFLECT` 350), `:1003-1012` (ground ends it, bricks don't); `projectiles/Projectile.as:34-45, 135-147`;
    `ground/Brick.as:174-190, 219-223`; `data/DamageValue.as:27, 42`; `data/HealthValue.as` (brick 125, Goomba 250 …).
  - Water Shield: `MegaManBase.as:1658-1685`; `MegaManProjectile.as:112-117, 666-715, 825-843`.
  - Kit and power: `MegaManBase.as:329-333` (Classic Mushroom and Flower), `:563-592` (secondary weapon; Bass can't
    charge, `:586`), `:723-753`, `data/GameSettings.as:117, 222` (Water Shield default, reset at boot), `:221` (Lose
    Everything); hit `MegaManBase.as:2389-2428, 2481-2494`, `Character.as:2037-2090`; buttons released and re-sent
    `managers/ButtonManager.as:918-958`; energy and drops `MegaManBase.as:2059-2185`, `data/RandomDropGenerator.as:42-43` (Bass uses Mega Man's drops).
  - Swap and Select: `MegaManBase.as:377-397, 1455-1478, 1495-1509, 1969-1981`; Mega Man's hold timer for contrast
    `characters/MegaMan.as:143-191`.
  - Springs: `ground/SpringRed.as:19-20, 66-74`, `ground/SpringGreen.as:13-14` (MegaManBase 3000), via
    `$S/chars/verify/A.md`; spring landings skip `landOnGround` (`Character.as:1450-1460`).
  - Level helpers: `Bass.as:100-109`; `MegaMan.as:136-137`; `level/Level.as:676-694, 781-783`;
    `Character.as:330-331, 374-375`; `characters/base/MarioBase.as:207`.
  - Select slot and tutorial: `messageBoxes/CharacterSelectBox.as:71-74`; `managers/TutorialManager.as:88-90`.
  - Skins: `graphics/BmdInfo.as:455-523` (16 entries, sheet `bass_000`-`bass_015`, names, music sets);
    `data/SkinDescriptions.as:6`.
  - SWF (`$S/flash/smbc3.swf`, parsed with `$S/classic/bass-work/hrect.py` and `mmlabels.py`): `MegaManMc` (id 169)
    frame labels and `HRect` sizes; `MegaManProjectileMc` (id 137) `bassBuster` 16 × 16; Bass sheets
    `BmdInfo_Bass000`-`015` are 386 × 313 px, the same as `BmdInfo_MegaMan000`. Extracted reference images (not for
    shipping): `$S/classic/bass-work/img/`.
  - Unit and errata: `$S/chars/missing-bass-protoman.md` (Bass parts); `$S/chars/FINAL-REPORT.md` section 4.1;
    `$S/chars/verify/A.md` (Lose Everything, the 3-to-4 cap, the gradual cut, springs, Quick Man).
- **Where the change lands (ours):** new `src/game/characters/bass/` (`classic.ts`, `classic-weapons.ts`,
  `guide.ts`), new `src/content/sprites/bass.ts`; optional fields in `src/game/characters/profile.ts` and their use
  in `src/game/entities/player.ts`; `registry.ts` (`CLASSIC_EXTRAS`); `spring.ts`.
- **Implementation hints:**
  - Build Bass on top of Classic Mega Man: import its profile and change the jump, the dash fields and the air jump.
    Do not touch `MEGAMAN` or `MEGAMAN_PROFILE`.
  - Every new physics field is optional and unset in Current profiles (TG-23). Then `player.ts` runs today's path for
    every Current hero.
  - Auto-fire: keep `p.scratch.bbT` (the 75 ms counter) and `p.scratch.swap`. Fire from `behaviour.update`, but set
    the root before movement (BA-9).
  - Cap: count Bass's projectiles over all his kinds except the Water Shield drops (and Pharaoh shots under the full
    kit). `world.countProjectiles` counts one kind (`world.ts:574-579`), so sum it or add a helper.
  - Aim pose: choose the frame from `p.scratch.aim` (set when firing) while the buster button is held, and for
    12 frames after a shot (the original's 200 ms `shootTmr`).
  - The 7-way vectors are fixed values (BA-20), not a normalised 8-way like the Saw's 0.7071.
- **Acceptance checks** (headless, `rules = 'classic'`, `char = bass`, unless noted):
  - Roster: with dev mode and Classic, the select shows Bass first on the second row. Under Current, `?char=bass`
    gives Mario (TG-41 tests).
  - Jump: standing apex 50-52 px, landing on frame 45 ± 1. Released on the first airborne frame: 13-16 px. Double jump
    at the apex: 101-103 px in all. A third press changes nothing. Walk off a ledge and press Jump: vy = −0x04800 (the
    original's −0x04B55 less one frame of gravity, BA-8).
  - Spring: land on a red spring after a double jump; after the launch, Jump in the air does nothing.
  - Dash: 62.5 ± 2.5 px on flat ground; the hitbox stays 22 px tall; it stops at a 1-tile-high gap's wall. Jump on
    dash frame 10 with Down held: vy = −0x05355, and with Right held vx stays 0x02800 until landing (about 130 px
    across). Press Left in the air during it: vx = −0x02800.
  - Rooting: hold Attack and Right on flat ground for 60 frames: x does not change and Bass faces right. Let go of
    Attack: he walks on the next frame. Hold Attack in the air with Right: x grows by 1.375 px a frame.
  - Cadence: hold Attack with no target in range: shots spawn on frames 0, 5, 9 and then wait for the cap (3 out);
    with the Mushroom 4 out.
  - Aim: Up gives (0, −0x04D55); Up + Right gives (+0x03A00, −0x03A00); Down + Left gives (−0x03A00, +0x03A00).
  - Ground: a shot fired at a pipe ends at it (unlike the Mega Buster). A brick breaks on the 3rd shot. A Goomba dies
    on the 5th shot, a Koopa on the 12th. A shot at a Buzzy Beetle bounces back up.
  - Power: small + 1 hit = death; Flower + 1 hit = small with no shield and no swap; a second hit kills.
  - Water Shield (Flower): Special makes 8 drops; a second Special sends them out; 7 shields empty a full bar; the
    buster still fires 4 shots with the shield up.
  - Swap: with the Flower, one Select press makes Attack fire the shield and Special fire the rooted buster.
  - Water: floor jump vy = −0x0418E; dash jump vy = −0x0558E; Jump in mid-water does nothing after the double jump
    is spent.
  - Current unchanged: the TG-36 parity fixture and every existing test pass with `rules === 'current'`.
- **Confidence:** every rule and number comes from the original's source. The hitboxes and pose list come from the
  SWF; the same parser gives a plausible 13 × 15 px for small Mario. Jump heights, hit counts and the cadence on
  frames are computed, not played. Nobody played Bass in the original. Our code was read at d3ad397, not played.
- **Open questions** (defaults to use meanwhile):
  1. Should the aim poses be drawn before Bass is tried? **Default:** no; test with BA-34's placeholder.
  2. Hitbox fidelity (BA-M6). **Default:** 12 × 22, so Bass and Mega Man fit the same gaps.
  3. Should the double jump be allowed after a spring launch when it was ready before? The source says yes.
     **Default:** yes.
- **Optional variant: the Quick Man skin** (Bass skins 7 and 8; `MegaManBase.as:811-836`, `Bass.as:100-109`,
  `SkinDescriptions.as:6` "Moves faster, jumps higher, can't double jump or dash"). Build it only if the owner wants
  skin variants (FU-3 in `2026-10-07-classic-follow-ups.md`). It is the same Bass with:
  - walk ×1.3: 214.5 px/s = **1.7875 px/f** (0x01C9A);
  - the tall jump **650** px/s (our initial 0x05355, 67.7 px), and **560** in water (our initial 0x0498E, about 154 px),
    corrected as BA-8;
  - **no double jump**, **no dash and no dash jump**: Down + Jump is a normal jump (a slide only with Charge Kick
    active, which needs Customize Weapons), and no dash speed is carried;
  - the level helper objects on (`usesHorzObjs` and `usesVertObjs` true). Our converter drops the `charHorz` and
    `charVert` items, so this part needs level data first;
  - the rapid-fire buster, rooting, cap, Water Shield and power states unchanged;
  - cosmetic: the shot sprite rotates with the aim, colour death orbs and the alternate death sound.
  The original applies it everywhere except on the select screen. If built, make it a dev-only flag on the Bass def
  (for example `variant: 'quickman'`), not a skin system.
- **Related reports:** `2026-10-07-dev-classic-smbc-rules-toggle.md` (TG-18, TG-21 to TG-23, TG-30, TG-36, TG-40 to
  TG-44), `2026-10-07-megaman-classic-smbc-rules.md` (MM-C2 to MM-C26, the shared Mega Man code and the 9 weapons),
  `2026-10-07-simon-classic-smbc-rules.md` (SI-C4, SI-C6, SI-C7: rooting hook, air stop, air jump),
  `2026-10-07-classic-power-states.md`, `2026-10-07-classic-enemy-hp-and-armour.md`,
  `2026-10-07-classic-bricks-and-shots.md`, `2026-10-07-classic-swimming.md`, `2026-10-07-classic-follow-ups.md`
  (FU-3, FU-5, FU-7), `2026-10-07-protoman-build-classic-character.md` (the other Mega Man variant). Open reports:
  `2026-10-06-megaman-slide-crosses-one-tile-gaps.md` (the dash crosses gaps too, BA-10),
  `2026-10-06-water-non-mario-heroes-stroke.md` and `2026-10-06-water-surface-air-physics.md` (BA-15).
