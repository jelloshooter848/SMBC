# Classic SMBC Mega Man: power states, Metal Blade on the Flower (9 weapons specified), 2-level charge, buster through ground, slide-jump and free Rush

- **Severity:** feature request (Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=megaman` (once the toggle exists; today `?dev=1&level=1-1&char=megaman` shows the Current behaviour)
- **Character and power:** Mega Man, all power states (small, Mushroom, Fire Flower)
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=megaman` (Current). See the 28-HP bar. Take 4 hits: you are still alive.
2. Shoot the first Goomba once: it dies. Shoot a brick: the shot stops at it and nothing happens. Slide (Down + Jump) and
   press Jump during the slide: nothing happens.
3. Open `?dev=1&rules=classic&level=1-1&char=megaman` (Classic, once built). There is no HP bar.
4. Shoot the first Goomba: it dies on the 3rd shot. Shoot a brick twice: it breaks. Shoot a `?` block from the side: it
   gives its item. Slide, let go of Down and press Jump: Mega Man jumps out of the slide.
5. Tap Select (Right Shift): Rush drops in from the top of the screen. Fall onto him: you bounce about 103 px.
6. Take the Mushroom and the Flower from blocks. Hold Attack for 1.5 s and let go: a full charge shot. Press Special
   (C): a Metal Blade. Take one hit: you are small again, with no charge and no Metal Blade.

## Expected

Classic Mega Man is a separate `CharacterDef` (`src/game/characters/megaman/classic.ts`, with
`classic-weapons.ts`). Units: px, px/frame (px/f), px/frame² (px/f²) and frames at 60 fps. Fixed point is
0x1000 = 1 px/f. Original Flash values are converted with px/s ÷ 120, px/s² ÷ 7200, ms ÷ 16.67 and Flash px ÷ 2.
Shared systems are only referenced here:
power states and hit response in `2026-10-07-classic-power-states.md` (PS-C), enemy HP and armour in
`2026-10-07-classic-enemy-hp-and-armour.md` (HP-C), bricks and shots through ground in
`2026-10-07-classic-bricks-and-shots.md` (BR-C), water in `2026-10-07-classic-swimming.md` (SW-C).

### Controls

**MM-C1. What each control does in Classic.**

| Control (our key) | Classic action |
|---|---|
| Left / Right | Walk at 1.375 px/f, starting and stopping at once. A press from standing first gives the step nudge (MM-C2). Full control in the air. |
| Jump (Z) | Jump (ground only). Down + Jump on the ground: slide. Jump during a slide with Down released: slide-jump (MM-C9). |
| Attack (X) | Fire the Mega Buster. With the Mushroom, hold to charge and let go to fire a charge shot (MM-C19). |
| Special (C) | Fire the Flower weapon (Metal Blade by default). Without the Flower it does nothing. If the Flower weapon is Charge Kick, Special toggles kick mode instead (MM-C26). |
| Select (Right Shift / Backspace) | **Tap** (let go within 20 frames): summon Rush Coil, or send a waiting Rush away (MM-C28). **Hold 21 frames** (350 ms): swap the Attack and Special roles (MM-C3). With the dev `&kit=full`, a tap cycles the Flower weapon instead (MM-C21). |
| Down | Only used for the slide and to aim the Metal Blade (and the Pharaoh Shot, Hard Knuckle). No crouch. |
| On a vine | Attack and Special do nothing. A held charge is dropped (keep our current rule, `index.ts:274-276`). |

Select no longer cycles a belt. There is no belt and no weapon menu (the dev `&kit=full` cycle, MM-C21, is the only exception).

**MM-C2. Step nudge.** When Left or Right is pressed on the ground, Mega Man is not already moving that way, and no
step is running: move him 2 px that way at once, show the step frame, and hold his horizontal speed at 0 for
**6 frames** (100 ms). If the button is still held after that, he walks normally. A step does not start during a slide
under a ceiling, or while the other direction is held during a slide.

**MM-C3. Button swap.** Holding Select for 21 frames toggles the swap, but only while the Flower weapon is held and it
is not Charge Kick. While swapped, Attack fires the Flower weapon and Special fires the buster (and charges, with the
Mushroom). Toggling the swap drops any charge in progress. Show the Flower weapon's icon in the HUD while swapped. The
swap is suspended while there is no Flower weapon and comes back with the next Flower (the original keeps the setting). The Select timer only runs in Classic mode.

### Movement

**MM-C4. Ground and air constants.**

| Constant | Classic value | Fixed point | Current (ours) |
|---|---|---|---|
| Walk speed | 1.375 px/f | 0x01600 | same |
| Acceleration / stop | instant | `instantAccel: true` | same |
| Air control | full and instant (held direction sets vx to ±1.375; none sets 0) | `airControl: 'full'` plus the optional `airStop: true` field (SI-C6, LK-C5) | **differs**: with no direction held, `airMove` keeps vx (`player.ts:452-458`) |
| Run | none | `canRun: false` | same |
| Hitbox | 12 × 22 px standing, 12 × 15 px sliding, in every power state (Mega Man does not grow). The original's slide box is 13.5 × 15 px, standing 13.5 × 24 (SWF `MegaManMc`) | | 12 × 22, 12 × 12 sliding |

**MM-C5. Slide speed and distance.** Down + Jump on the ground starts a slide at **2.5 px/f** (0x02800) in the facing
direction. It ends when he has moved **62.5 px** from where it started (25 frames). Use distance, not a frame count.
The slide is the same in water.

**MM-C6. Slide ends early** (when there is no ceiling, MM-C7) when:
- he runs into a wall;
- the opposite direction is pressed (he stops and stands; vx = 0);
- he leaves the ground. The slide becomes a normal fall with normal air control (no slide speed is kept).

He cannot start a slide while carrying a Super Arm brick or during the 12-frame stop after a thrown weapon (MM-C24).

**MM-C7. Slide under a low ceiling.** While a solid tile overlaps the band from 15 px above the slide hitbox's top
down to 5 px above its bottom, horizontally overlapping the hitbox, and its centre is within 25 px of his centre:
- the slide does not end at 62.5 px, at a wall in front, or on the opposite direction;
- pressing the opposite direction turns him round and he keeps sliding at 2.5 px/f that way, and the slide is marked to
  end as soon as the ceiling clears;
- otherwise he keeps sliding until the ceiling clears and the normal end rules apply.

This replaces any "stand up into the ceiling" risk: he never stands up under a 1-tile-high gap.

**MM-C8. Slide across one-tile gaps.** While sliding, Mega Man crosses a one-tile gap at ground level. A walking Mega
Man drops in. This is exactly the open report `2026-10-06-megaman-slide-crosses-one-tile-gaps.md`. Fix it there (or
here, gated on the Classic profile), using that report's rule. In Classic the gap rule must be on.

**MM-C9. Slide-jump.** Pressing Jump during a slide jumps when **no ceiling** is above (MM-C7) **and Down is not
held**. It is a normal jump (MM-C11): vy = −5.4167 px/f (our initial 0x05355, MM-C10). The slide speed is not kept: in the air his horizontal speed
is the walk speed in the held direction. Jump with Down still held during a slide does nothing (it does not restart
the slide).

### Jumping

**MM-C10. Jump constants.**

| Constant | Original | Classic value | Fixed point | Current (ours) |
|---|---|---|---|---|
| Jump speed | 650 px/s | 5.4167 px/f | 0x056AB | 0x05800 (5.5) |
| Gravity, rising and falling | 1500 px/s² | 0.20833 px/f² | 0x00355 | 0x00380 (0.219) |
| Fall cap | 700 px/s | 5.8333 px/f | 0x05D55 | 0x04800 (4.5) |
| Our `initial` | | 5.2083 px/f: the jump speed minus one frame of gravity | 0x05355 | |
| Full jump apex | | 67.7 px stepped (70.4 continuous) | | 72 px |
| Coyote frames, double jump | none | 0, none | | same |

The original adds gravity before it moves; ours moves first. So every launch of his body uses the original speed
minus one frame of the gravity in force: the jump and slide-jump (0x05355), the water jump (MM-C13, 0x0498E) and the
Rush bounce (MM-C31, 0x06755). That gives the original's arc frame for frame. Projectiles need no change: our
projectile code already adds gravity before it moves (`projectile.ts:244-246, 265-270`).

**MM-C11. Jump cut-off (soft).** When Jump is released while rising, multiply vy by **0.7943** every frame
(1e-6^(1/60), the original's `vy *= fy^dt`) until vy ≥ 0. Gravity still applies each frame. Only the first release in a
jump counts. It does not apply to Rush or spring launches. The shortest hop is about **13-17 px** (release on frame 1-2,
simulated). Today ours sets vy = 0 at once (`variableJump: 'cut'`, about 6 px).

**MM-C12. Springs.** No change. Red springs give 500 px/s (1000 boosted) and the green spring 3000 px/s to Mega Man.
Ours already matches (`entities/objects/spring.ts:22-49`).

### Swimming

**MM-C13. No swim stroke.** Mega Man never strokes. In water, Jump works **only on the floor**. Values (the shared
mechanism is in SW-C):

| Constant | Original | Classic value | Fixed point |
|---|---|---|---|
| Floor jump speed | 560 px/s | 4.6667 px/f (our initial 4.5972, MM-C10) | 0x04AAB (initial 0x0498E) |
| Water gravity | 500 px/s² | 0.06944 px/f² | 0x0011C |
| Sink cap | 250 px/s | 2.0833 px/f | 0x02155 |
| Jump apex | | about 154 px (156.8 continuous) | |
| Floor walk | | full speed, 1.375 px/f | 0x01600 |

The soft cut-off (MM-C11) and the slide (MM-C5 to MM-C9) work the same in water. All weapons work in water.

### Health and power-ups

**MM-C14. No health bar.** Mega Man uses power states (`damage: { kind: 'powerup', ... }`, PS-C). Small: one hit
kills. Mushroom or Flower: a hit takes away the Flower **and** the Mushroom together (Lose Everything), so 2 hits kill
from full power. No HP, no HP bar, no E-tanks, no reserve menu entry, no health drops, no full heals.

**MM-C15. Kit per power state.**

| State | Kit |
|---|---|
| Small | Mega Buster (3 shots), slide, slide-jump, Rush Coil (free) |
| Mushroom | + Charge Shot (2 levels, MM-C19). No other change: no head brick-breaking, no size change |
| Fire Flower | + the Flower weapon (Metal Blade by default) on Special, with its energy bar |

A `?` block gives the Mushroom when small and the Flower otherwise, including when he already has the Flower (PS-C).
Each Flower (first or repeat) adds **40 units** to the Flower weapon's energy, up to 112. Rush Coil is part of the
starting kit in every state.

**MM-C16. On a hit.** Besides the power loss:
- any charge in progress is dropped;
- the Flower weapon's projectiles on screen vanish (buster and charge shots stay);
- Rush stays;
- the button swap is suspended until the next Flower (MM-C3).

Hit response values (the shared mechanism is in PS-C): knockback **0.6667 px/f** (0x00AAB) **backwards from the way he
faces** (not away from the enemy), vy set to 0 (no upward pop; he falls if airborne), input locked for **27 frames**
(450 ms). Then **75 frames** (1250 ms) of invulnerability with flicker every 70 ms (5, 4, 4, 4, 4 frames, PS-C13). Total 102 frames. If he
is on the ground when the lock ends, vx = 0.

**MM-C17. Weapon energy.** Each weapon has **112 units** (28 bars of 4). It starts full. It is kept through hits and
levels and refilled to full on death (with the power-up loss). Only the Flower weapon uses energy; the buster, the
charge shot and Rush are free. During Star power, weapons cost nothing and fire even when empty. Show the Flower
weapon's 28-bar energy bar in the HUD while the Flower weapon is held; hide it otherwise.

**MM-C18. Drops and refills.** Mega Man's drops are weapon energy only: **82.5% small (8 units, 2 bars), 17.5% big (40
units, 10 bars)**, at the shared drop rate (PS-C). No health pellets, no E-tanks.
Picking one up while the Flower weapon is held and not full **freezes the game** and adds 4 units every **3 frames**
(50 ms) until the amount is in or the bar is full. A small pellet takes up to 6 frames and a big one up to 30. Pellets
taken during a refill queue up and refill after it. A pellet taken with no Flower weapon, or with a full bar, is
collected with no effect (see Open questions).

### Weapons and attacks

**MM-C19. Mega Buster.**
- Fires on the Attack press (or Special while swapped), in every state, on the ground or in the air. It does not stop
  his walk.
- Damage **100**. Speed **3.75 px/f** (0x03C00), straight ahead. Spawn 19 px ahead of his centre, 13 px above his feet on
  the ground and 17 px above them in the air.
- Cap: a new shot fires only while fewer than **3** of his projectiles are on screen, not counting Water Shield drops
  and Pharaoh shots/balloons (so buster shots and Metal Blades share the 3). No buster shot fires while a **full**
  charge shot is on screen.
- **Passes through solid ground**: floor, walls, pipes and stairs. It hits only enemies, bricks and `?`
  blocks (BR-C). An empty brick (125 HP) breaks on the **2nd** shot. A `?` or coin block hit from the side or below
  gives its item. The shot ends on the hit.
- It is destroyed off screen.
- Against armour it cannot hurt (HP-C), it bounces back: vx reversed, vy −2.9167 px/f (0x02EAB), harmless from then on.
- Hits to kill (HP-C): Goomba 3, Koopa 6, Hammer Bro 8, Bowser 24.

**MM-C20. Charge Shot (Mushroom only).** Pressing the buster button fires a normal shot (if the cap allows) and starts
the charge timer. Keep holding:

| Held for | State | On release |
|---|---|---|
| 0-32 frames | none | nothing extra |
| 33 frames (550 ms) | charge start: charge sound, palette flashing begins | nothing extra |
| 48 frames (800 ms) | weak charge | **weak shot**: 200 damage, 3.75 px/f, ends on any hit, vanishes against armour |
| 66 frames (1100 ms) | still weak (third outline) | weak shot |
| 87 frames (1450 ms) | **full charge** (3-colour flash) | **full shot**: 300 damage, 3.75 px/f, **passes on through an enemy it kills**, ends on an enemy that survives, vanishes against armour |

- Charge shots ignore the 3-shot cap. They pass through solid ground like the buster. Against an empty brick: the weak
  shot breaks it and ends; the full shot breaks it and keeps going. Against a `?` or coin block: the weak shot bumps it and
  ends; the full shot bumps it and keeps going (BR-C9). Spawn as the buster.
- The charge keeps running through a slide. Letting go **during** a slide fires nothing and drops the charge. Letting go
  after the slide fires normally. A press during a slide fires no shot but does start the charge.
- A hit, the button swap, a vine or losing the Mushroom drops the charge.
- Replace our single level (40 frames, `index.ts:41,291-299`).

**MM-C21. Getting weapons in Classic.** The Flower gives **exactly one** Robot Master weapon: the original's default
choice, **Metal Blade**. No power-up gives the other 8 in Classic with default settings. In the original they come from
the Customize Weapons option (out of scope, FU-7 in `2026-10-07-classic-follow-ups.md`) or from Modern mode (out of
scope). **Build all 9 now.** Keep the Flower weapon as one constant (`CLASSIC_FLOWER_WEAPON = 'metal-blade'`) so FU-7
can switch it. The dev `&kit=full` (TG-44) is the only way to reach the other 8:
- It gives the Fire Flower state, the Charge Shot and all 9 weapons, each with full energy (112).
- A Select **tap** cycles the Flower weapon in the order of the table below, then Rush Coil, then back to Metal Blade.
  Special fires the selected weapon (with Rush Coil selected, Special summons Rush; with Charge Kick, it toggles kick
  mode). This is the original's non-Classic scheme (`MegaManBase.as:1969-1981`). A Select hold still swaps (MM-C3).
- Without `&kit=full`, Select works as in MM-C1.

The table below is the spec for all 9.

**MM-C22. The 9 weapons.** Cost is in units (bars). "Cap" counts his projectiles on screen when the weapon is fired.
"Total" means all his projectiles, buster shots included. "Through kills" means the shot keeps going when the enemy it
hits dies. Armour pierce level 0 is the default; level 10 beats armour (HP-C).

| Weapon | Cost | Damage | Motion (Classic values) | Cap | Through kills | Armour pierce | Solid ground | Empty brick (125 HP) |
|---|---|---|---|---|---|---|---|---|
| **Metal Blade** (default) | 2 (½ bar) | 150 | 3.75 px/f (0x03C00) in 8 directions; diagonals 2.8125 px/f on each axis (0x02D00) | 3 total | yes | 0 | passes through | breaks it in 1 and keeps going |
| Super Arm | 8 (2 bars), on the throw | 800, then 4 debris × 250 | thrown brick: vx ±2.3333 (0x02555), vy −2.6667 (0x02AAB), gravity 0.2222 px/f² (0x0038E) | 1 carried brick | no | 0 | breaks into debris on contact | only empty bricks can be lifted |
| Hard Knuckle | 8 (2 bars) | 800 | starts still; accelerates 0.0625 px/f² (0x00100) to 2.9167 px/f (0x02EAB); Up/Down steer vy −/+0.4167 px/f (0x006AB) | 1 non-buster | no | **10** | passes through | breaks it in 1, ends |
| Pharaoh Shot | 4 (1 bar) per tap; +8 (2 bars) for a charged shot | small 150, medium 200, big 400 | 3.75 px/f forward; with Up or Down held, diagonal 2.8125 px/f per axis | 1 total (tap shot) | big only | 0 | passes through | small/medium break it and end; big breaks it and keeps going |
| Charge Kick | 4 (1 bar) per slide | 350 | the slide itself (2.5 px/f, 62.5 px) | n/a | n/a | 0 | n/a | breaks bricks it slides into (see Open questions) |
| Flame Blast | 4 (1 bar) | bullet 350, flame 350 | 3.75 px/f forward, gravity 0.18056 px/f² (0x002E4) | 3 total | no | 0 | **collides**: becomes a flame pillar | breaks it and ends |
| Magma Bazooka | 2 (½ bar); charged +12 (3 bars) | 3 × 100; charged 3 × 300 | 3 shots: forward 3.75 px/f, up-forward and down-forward 2.8125 px/f per axis | 1 volley (no other non-buster shot out) | charged only | 0 | passes through | normal: 2 hits each; charged breaks and keeps going |
| Water Shield | 16 (4 bars) | 275 per drop | 8 drops orbit his centre at 22.5 px radius, 0.0667 rad/f (one turn ≈ 94 frames) | 1 shield | no (each drop ends on a hit) | 0 | passes through | breaks it, that drop ends |
| Screw Crusher | 2 (½ bar) | 175 | spawns 24 px ahead at mid height; vx ±1.25 (0x01400), vy −4.6875 (0x04B00), gravity 0.20833 px/f² (0x00355) | 4 total | no | 0 | passes through | breaks it, ends |

All of them bump `?` and coin blocks (BR-C). A shot that goes on through kills ("yes", "big only" or "charged only"
above) also keeps flying after bumping one, as after breaking a brick (BR-C9); the others end there. None hurts other
players.

**MM-C23. Metal Blade details (required).**
- Fires on Special (Attack while swapped) if he has ≥ 2 units and fewer than 3 of his projectiles are on screen. Costs 2.
- Spawns at his hitbox centre.
- Aim from the d-pad at the moment of firing: Up gives straight up (0, −3.75); Down gives straight down; Left/Right
  plus Up or Down gives a diagonal at 2.8125 px/f on each axis; anything else gives straight ahead at 3.75 px/f.
- 150 damage. Passes on through an enemy it kills. Ends on an enemy that survives. Bounces back harmlessly off armour
  (as the buster, MM-C19). Passes through solid ground. Breaks an empty brick in 1 hit and keeps going. Destroyed off
  screen.
- Suit colour: while the Flower weapon is held, Mega Man wears its palette (reuse `megaman-saw` for Metal Blade until
  art exists), even when firing the buster. The charge flash overrides it as today.

**MM-C24. Rooting.** Thrown weapons stop Mega Man on the ground for **12 frames** (200 ms; vx = 0, no walking, no slide
start): Metal Blade, the Super Arm throw, Hard Knuckle, Pharaoh Shot and Screw Crusher. The buster, charge shots, Flame
Blast, Magma Bazooka and Water Shield never stop him.

**MM-C25. Other 8 weapons: behaviour notes** (built now, reached with `&kit=full`, MM-C21).
- **Super Arm.** Lift: hold the Flower-weapon button while touching an empty brick from any side, or press it while
  touching one (needs ≥ 8 units). The brick leaves the map and is carried over his head. Any attack press (either
  button, not Select) throws it (cost 8). It breaks into 4 debris pieces (250 each) when it touches ground or hits an
  enemy. Armour breaks it too.
- **Hard Knuckle.** Harmless while it appears (its appear animation, 32 ms per frame; see Open questions). If fired in
  the air, Mega Man freezes in place (no gravity, no movement) until it finishes appearing. Spawns like the buster.
- **Pharaoh Shot.** A tap fires a small shot (cost 4). If ≥ 4 units remain after it, the press also starts a balloon 15 px above his head; it
  becomes visible and harmful after 15 frames (250 ms). While held it grows to medium, then big (see Open questions for
  timing). It follows him with up to 10 px of lag at 0.625 px/f. It hurts enemies it touches at its current level and
  passes on through kills. On release at medium or big, fire a Pharaoh shot of that level (+8 units); below medium the
  balloon just vanishes. Released during a slide: it fires when the slide ends.
- **Charge Kick.** On the first Flower, kick mode turns on. Special toggles it (suit colour shows it). While on, each
  slide with ≥ 4 units costs 4 and hits enemies it touches for 350. Touching an enemy during a kick slide does not hurt Mega Man. The button swap is not available.
- **Flame Blast.** On touching ground (or a `?` block) from any side it becomes a flame pillar standing out of that
  surface (rotated for ceilings and walls), which lasts its animation and ends on its first enemy hit.
- **Magma Bazooka.** The charge needs no Mushroom: with ≥ 14 units (2 + 12) holding the button runs the same timer as
  the buster. The weak level does nothing; at 87 frames a release fires the 3 charged shots (+12).
- **Water Shield.** The first drop is live at once. Each other drop becomes visible and harmful when it first passes the
  starting angle, so all 8 are live after about 82 frames. Pressing again when all 8 are live sends them outward from
  that point: radius +2.5 px per frame, no longer following him, destroyed off screen. Pressing again with no energy is
  allowed for this. Armour destroys a drop.
- **Screw Crusher.** A lob up and forward that falls back down.

**MM-C26. Deflection off armour** (shots that can't hurt an armoured enemy, HP-C): the buster, Metal Blade, Pharaoh
shots and balloon, and Screw Crusher bounce back (vx reversed, vy −2.9167 px/f, harmless). Charge shots and Water Shield
drops vanish. A Flame Blast bullet reverses. A Super Arm brick breaks. Hard Knuckle pierces armour.

**MM-C27. Remove in Classic** (Current keeps all of these):
- the 5 invented weapons (Saw Disc, Leaf Guard, Flame Wave, Homing Knuckle, Bolt) and the belt (`cycleTool`, tools,
  touch belt label "WEAPON"), except the dev `&kit=full` cycle (MM-C21);
- the 28-HP bar, 4 damage per hit, the full heals on Mushroom and Flower;
- E-tanks: drops, the `E×n` HUD, and the pause-menu reserve;
- health pellets (small and large);
- the helmet gate: the Mushroom no longer unlocks Rush, and Mega Man never breaks bricks with his head;
- the Current guide text. Give Classic its own short guide (`MEGAMAN_CLASSIC_GUIDE`) describing MM-C1.

### Special abilities

**MM-C28. Rush Coil: summoning.** A Select tap summons Rush in every power state, on the ground or in the air, at no
cost. Only one Rush at a time. A tap while Rush is waiting (MM-C30) sends him away at once (exit animation, then he flies
up). A tap while he is still dropping in or leaving does nothing. Rush has no energy bar. (The original takes 4 units
per bounce from a Rush counter but never checks it in Classic, so it is free.)

**MM-C29. Rush Coil: arrival.**
- Target x: 20 px ahead of Mega Man's centre. If a solid tile sits in the second column ahead at his body row, 10 px
  ahead. If a solid tile sits in the column right in front at his body row, or Up is held, on his own x.
- He starts at the top of the screen and falls with acceleration **0.31944 px/f²** (0x0051C), capped at **8.3333 px/f**
  (0x08555).
- He ignores ground until he is 32 px (2 tiles) above Mega Man's feet (64 px if Mega Man stands on a lift). Then he lands
  on the first ground below and plays his landing animation. With no ground, he falls off the bottom and is gone.

**MM-C30. Rush Coil: timing.** After landing he waits **120 frames** (2 s), then **120 frames** at 75% opacity
(flashing warning), then plays his exit animation and flies up, accelerating at 0.31944 px/f², until he is above the
screen. Replace our 300-frame lifetime (`rush-coil.ts:8`).

**MM-C31. Rush Coil: bounce.** A falling hero (not on the ground, vy > 0) who touches Rush while he is landing or waiting
is put on Rush's top and launched at **vy −6.6667 px/f** (0x06AAB; our initial 0x06755, MM-C10), about **103 px** high. The launch can't be cut short.
Rush then springs and leaves **24 frames** (400 ms) later, so there is one bounce per summon. In 2-player, the other
hero can bounce on him too. Replace `RUSH_BOOST` 1.6 × jump (about 180 px).

**MM-C32. Energy Balancer: absent in Classic.** The original's Energy Balancer is only a Modern-mode `?` block reward,
so Classic never has it. For reference (Modern follow-up): an energy pellet that can't go to the current weapon fills
the weapon with the least energy. Do not build it now.

### Interactions

**MM-C33. Bricks with the head.** Mega Man bumps bricks from below in every state and never breaks them (BR-C).
Today he breaks them once he has the helmet (`index.ts:232`).

**MM-C34. Stomping and firebars.** No stomp (as today). Firebars hurt.

**MM-C35. Rush, Super Arm and weapon changes.** In Classic the weapon never changes during play (except the dev `&kit=full` cycle, MM-C21), so the original's
"switching weapons clears the screen" does not apply. Gaining or losing the Flower is not a switch.

### Feel

**MM-C36.** Instant walk with the 6-frame step stagger, a jump that eases out over about 5 frames after release, a
103 px Rush bounce, and a 102-frame hit sequence with no pop. Keep our sounds; play the charge sound at 33 frames and the
refill sound during the energy freeze.

## Actual

Current Mega Man, which stays the default:
- 28 HP, 4 per hit, 60 invulnerability frames, knockback 0.5 px/f away from the enemy with a 1.5 px/f pop and a 16-frame
  stun (`src/game/characters/megaman/index.ts:38-40,223-229,355-365`; `src/game/world/world.ts:1444-1449`). E-tanks
  (`index.ts:241-251,315-319`). Drops: health 20%/6.7%, weapon 20%/6.7%, E-tank 3.3% (`index.ts:253-261`).
- The Mushroom is a "helmet": charge, head brick-breaking, Rush on the belt, full heal (`index.ts:232,326-332`). Flowers
  unlock 5 invented weapons in order, 28 units each (`index.ts:333-341`; `weapons.ts:17,105-151`).
- Select cycles the belt (`index.ts:278`; `toolbelt.ts:29-34`). Special fires the belt item or drops Rush
  (`index.ts:284-290`).
- One charge level at 40 frames, 3 damage, piercing, reset while sliding (`index.ts:41,279-281,291-299`).
- The buster moves at 4 px/f and stops at every wall; it never breaks or bumps blocks
  (`entities/projectiles/projectile.ts:83-108`). It kills basic enemies in 1 shot.
- Jump 5.5 px/f, gravity 0.219, fall cap 4.5, hard cut-off (`index.ts:16-36`; `entities/player.ts:233`). In the air,
  letting go of the direction keeps vx (`airMove`, `player.ts:452-458`).
- No jump out of a slide (`player.ts:200-207`); the slide runs 26 frames and ignores ceilings and gaps
  (`player.ts:186-189,407-422`; `index.ts:35`).
- Water uses the shared stroke (`player.ts:16,304-320`).
- Rush appears at once 20 px ahead, lasts 300 frames, costs 3/28 and launches about 180 px
  (`index.ts:180-186`; `entities/objects/rush-coil.ts:8-47`).

## How often

every time

## Notes

- **Sources** (original; line numbers from `tr '\r' '\n'` copies; `$S/chars/_mmb.as`, `_mm.as`, `_mmp.as` and
  `_rush.as` are identical to those copies):
  - Controls, swap, Rush tap: `characters/MegaMan.as:128-129,143-191`; `characters/base/MegaManBase.as:377-397,1444-1478,1969-1981`.
  - Step nudge: `MegaManBase.as:280,309,934-935,1982-2007,2027-2030`.
  - Walk, slide, gravity, jump, water, fall cap, cut-off: `MegaManBase.as:236-257,461-497,869-888`; cut-off
    `:1162-1166,1343-1352` with `fy = .000001` at `:485`. Sink cap `characters/Character.as:225,997-998`.
  - Slide rules: `MegaManBase.as:898-977` (opposite direction, turn under a ceiling), `:1017-1064` (ceiling band,
    gap flag, end conditions), `:1115-1160`, `:1197-1209` (water), `:1263-1324` (start), `:1326-1340` (slide-jump),
    `:2236-2244` (wall). Gap crossing: `Level.as` `checkCrossSmallGap`, as cited in the open report.
  - Power states: `MegaManBase.as:329-333` (Classic Mushroom = Charge Shot, Flower = the chosen weapon);
    `MegaMan.as:35-37` (Rush from the start); `data/GameSettings.as:87,121,191,221,226` (Classic, Metal Blade,
    Lose Everything); `Character.as:2037-2090` (hit), `:3110-3116` (death reset); `managers/StatManager.as:1192-1222,1351-1360`
    (Flower from every block once the Mushroom is held).
  - On a hit: `MegaManBase.as:523-537,2389-2428,2481-2494`; `:260-261,276-279` (flicker, invulnerability, knockback).
  - Energy: `MegaManBase.as:86,112-113,539-544,2059-2185`; `MegaMan.as:52-57` (costs, drop split); star
    `Character.as:1902-1916,1938-1947`.
  - Buster and charge: `MegaManBase.as:166,244-247,1415-1433,1551-1571,1740-1797,2317-2349`;
    `projectiles/MegaManProjectile.as:89-91,101,433-507,757-795,852-891`; `projectiles/Projectile.as:39-45,136-152`
    (enemies and bricks only; no ground); `ground/Brick.as:174-190` (bricks take damage, item blocks bounce);
    `data/HealthValue.as:30` (brick 125); `data/DamageValue.as:27-44`.
  - Weapons: caps `MegaManBase.as:166-174,1522-1696`; rooting `:900,1883-1912`; Super Arm `:1585-1606,1705-1715,1821-1843`,
    `MegaManProjectile.as:187-202,1003-1006`, `projectiles/BrickPiece.as:35-56`; Metal Blade `MegaManProjectile.as:203-213,305-328`;
    Hard Knuckle `:277-294,806-820,846-851`; Pharaoh `MegaManBase.as:1627-1637,1727-1738`, `MegaManProjectile.as:519-621,977-994`;
    Charge Kick `MegaManBase.as:362-375,1263-1278,1698-1708`; Flame Blast `MegaManProjectile.as:387-417,623-635,1007-1008`;
    Magma Bazooka `MegaManBase.as:579-592,1647-1657,1783-1790`, `MegaManProjectile.as:636-665,716-732`;
    Water Shield `MegaManBase.as:1658-1685`, `MegaManProjectile.as:112-117,666-715,825-843`; Screw Crusher
    `MegaManProjectile.as:250-260,329-337`; pierce level 10 `:286`.
  - Rush: `pickups/Rush.as:36-53,54-107,114-156,181-204,223-255,271-281,294-317`; summon `MegaManBase.as:1535-1550`;
    free in Classic `MegaManBase.as:539-544,1931-1940`.
  - Energy Balancer: Modern only (`MegaMan.as:40-45` replacement list; `StatManager.as:1351-1360` returns the Flower in
    Classic before any random pick).
  - Springs match: `$S/chars/verify/A.md` row 1 (`ground/SpringRed.as:19-20,66-74`, `ground/SpringGreen.as:13-14`).
- **Where the change lands (ours):** new `src/game/characters/megaman/classic.ts` and `classic-weapons.ts`; a new
  Classic Rush entity next to `src/game/entities/objects/rush-coil.ts`; optional profile flags read by
  `src/game/entities/player.ts`; the registry picks the Classic def when `rules === 'classic'`.
- **Implementation hints:**
  - `MEGAMAN_CLASSIC: CharacterDef` with `id: 'megaman'`, `damage: { kind: 'powerup', states: ... }` (PS-C),
    `canBreakBricks: () => false`, no `reserve`, no `hudExtra`, no `tools`, and `meter` returning the Flower weapon's
    energy (max 112) only while the Flower is held.
  - `MEGAMAN_CLASSIC_PROFILE`: copy `MEGAMAN_PROFILE` and change jump, gravity and `maxFall` (MM-C10). Add **optional**
    profile fields that Current profiles never set, so `player.ts` behaves exactly as today without them:
    `variableJump: 'decay'` plus a factor (0.7943); `slide.distance` (62.5 px) in place of `frames`;
    `slide.ceilingHold`, `slide.jumpOut`, `slide.reverseCancel`, `slide.crossGaps`; `step: { px: 2, frames: 6 }`;
    and the swim fields SW-C defines (floor jump only, 0x04AAB, gravity 0x0011C).
  - The slide-jump needs `canJump` in `player.ts:200-203` to allow `sliding > 0` when the profile sets `jumpOut`, no
    ceiling is above and Down is up.
  - Select tap/hold: count frames while `select` is held in `behaviour.update`. Release before 21 frames: Rush. Reaching
    21 frames: toggle the swap. Do not call `cycleTool`, except under `&kit=full` (MM-C21).
  - Projectiles: give the buster, charge shots and Metal Blade the BR-C "through ground, hits bricks" flag (not
    `hitsTiles`). Damage amounts are in the original's scale (100, 150, 200, 300) as HP-C defines. Count the caps with
    `world.countProjectiles` over all of Mega Man's kinds (MM-C19, MM-C22).
  - Energy freeze: reuse whatever world freeze the power-up animation uses; otherwise add a frame counter that pauses
    everything except the HUD refill.
  - Keep scratch keys separate from Current (`energy`, `swap`, `selT`, `chargeT`), so a Current save or dev kit does
    not leak into Classic.
- **Acceptance checks** (headless where possible):
  - Jump: standing full jump apex 67-73 px. Release Jump on the first airborne frame: apex 12-18 px. Falling from a high
    ledge: vy never exceeds 0x05D55.
  - Step: tap Right for 1 frame from standing: x +2 px, then vx = 0 for 6 frames.
  - Slide: on flat ground it covers 62.5 ± 2.5 px. Under a 1-tile ceiling it continues to the end of the ceiling. Press
    Jump on slide frame 10 with Down up: vy = −0x056AB. With Down held: no jump. It crosses a one-tile gap (the open
    report's test).
  - Buster: a Goomba dies on the 3rd shot, a Koopa on the 6th. A brick breaks on the 2nd shot. A shot fired at a pipe
    comes out the other side. A side shot at a `?` block releases its item. A 4th shot does not fire with 3 out.
  - Charge (with Mushroom): release at 47 frames gives no charge shot; at 48 a weak shot (Goomba survives at 50 HP); at
    87 a full shot that kills a Goomba and goes on to hit a second one. Without the Mushroom, holding 100 frames fires
    nothing extra.
  - Metal Blade (Flower): Up + Right fires (0x02D00, −0x02D00). With 2 buster shots out only 1 blade fires. 56 blades
    empty a full bar. A small pellet adds 8 units with a freeze of 6 frames.
  - Power: small + 1 hit = death. Flower + 1 hit = small (no blade, no charge); a second hit kills.
  - Rush: tap Select (release on frame 5): Rush lands 20 px ahead after dropping from the screen top. Hold Select 21
    frames with the Flower: no Rush, buttons swapped. Bounce apex 103-111 px. Rush leaves 240 frames after his landing
    animation ends if unused.
  - Current unchanged: existing tests and headless sims stay green with `rules === 'current'`. `?dev=1&level=1-1&char=megaman`
    still shows the HP bar, the belt and the helmet, and the Saw still cuts bricks.
- **Confidence:** every original number is from source; the original was not played for this report. Ours (Current) was
  played in the comparison unit (`$S/chars/megaman.md`). Estimates: the shortest hop (simulated), the jump apex (depends
  on the integration order; stepped in the original's order, MM-C10), and the SWF animation lengths named in Open
  questions.
- **Open questions** (defaults to use meanwhile):
  1. Settled: build all 9 now; Metal Blade comes from the Flower and the other 8 only through `&kit=full` (MM-C21,
     TG-44). The Customize Weapons row (FU-7) can expose them later.
  2. Pharaoh balloon growth times come from SWF frame labels we can't read. **Default:** medium 30 frames and big 60
     frames after it appears.
  3. Hard Knuckle appear time (SWF frames × 32 ms). **Default:** 8 frames.
  4. Rush's landing and exit animation lengths (SWF). **Default:** 8 frames each.
  5. Charge Kick against bricks: the slide attacks "attackable ground", but how a brick takes it was not traced.
     **Default:** an empty brick takes 350 and breaks.
  6. A weapon pellet with no Flower weapon or a full bar: the original collects it with no effect (inferred from
     `Character.hitPickup`, not played). **Default:** collected, no effect.
  7. Settled from the SWF: the original's slide box is 13.5 × 15 px (30 Flash px tall; standing 13.5 × 24). Classic
     uses 12 × 15 sliding (MM-C4), which still fits a one-tile gap.
- **Related reports:** `2026-10-07-dev-classic-smbc-rules-toggle.md` (toggle and index),
  `2026-10-07-classic-power-states.md`, `2026-10-07-classic-enemy-hp-and-armour.md`,
  `2026-10-07-classic-bricks-and-shots.md`, `2026-10-07-classic-swimming.md`, `2026-10-07-classic-follow-ups.md`
  (FU-1 Proto Man, FU-3 Mega Man gameplay skins, FU-5 Bass, FU-7 Customize Weapons and Modern mode). Open reports:
  `2026-10-06-megaman-slide-crosses-one-tile-gaps.md` (MM-C8), `2026-10-06-water-non-mario-heroes-stroke.md` (MM-C13),
  `2026-10-06-water-surface-air-physics.md` (water edge physics).
