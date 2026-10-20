# Build Princess Peach as a Classic-only hero: pluck vegetables, lift and throw enemies, ride on enemies, float

- **Severity:** feature request (new character, Classic mode only; owner wishlist NC-1)
- **Build:** V0.4.56 (3955a1c8)
- **Where:** title → CLASSIC → character select, second row; every level
- **How to get there:** `?dev=1&mode=classic&rules=classic&level=1-1&char=peach` (once built; today `char=peach` falls back to Mario)
- **Character and power:** Peach, all power states (small, Mushroom, Fire Flower)
- **Input:** keyboard and touch
- **Browser and device:** any

## Steps

1. Open `?dev=1&mode=classic&rules=classic&level=1-1&char=peach`. The select screen shows Peach on the second row (after the other built extras). Under Current or in a campaign file she is not on the select screen at all.
2. In 1-1, hold Right, then hold Attack: Peach walks, then runs, exactly like Classic Mario. Jump from standing: she rises about 65 px (Mario 67).
3. Jump and keep Jump held: once she starts to fall she hovers level for 1.5 s while Left/Right still steer her, then falls.
4. Stand on plain ground and press Special: she crouches for 20 frames and pulls a turnip out of the ground, then holds it over her head. Press Attack: the turnip flies forward in a low arc and kills a Goomba.
5. Jump onto the first Goomba: she is not hurt and the Goomba does not die. She stands on it and moves with it. Press Special: she lifts it. Press Attack: the thrown Goomba kills the next enemy it meets, and both fall off the screen.
6. Take a Mushroom (she grows), then a Fire Flower (white dress): plucks take 10 frames and a thrown turnip flies on through each enemy it kills. Take one hit: Lose Everything, she shrinks to small, and what she carried drops.
7. Set Classic rules to Current in the Classic mode's options: Peach is not offered.

## Expected

Peach is a Classic-only extra (owner decision 2026-10-19): an entry of `CLASSIC_EXTRAS`, shown only on the Classic mode's
second select row and in dev Classic starts, never in the campaign, never in `heroesToFind`, captives or the map
(TG-41). She was never a hero in SMBC 3.1.21 (the original only had a cosmetic "Peach" skin for Mario, FU-3), so there is
no original source to match. Her rules come from **Super Mario Bros. 2 (USA)**, translated to SMB's scale and the
Classic power model. **Every number marked (T) is an invented tuning value** for the owner's playtest.

Shared systems are only referenced here:
- power states, Lose Everything, hit response and drops: `2026-10-07-classic-power-states.md` (PS-C);
- enemy HP, armour, instant kills and contact: `2026-10-07-classic-enemy-hp-and-armour.md` (HP-C);
- bricks, `?` blocks and shots against ground: `2026-10-07-classic-bricks-and-shots.md` (BR-C);
- water: `2026-10-07-classic-swimming.md` (SW-C).

Units: px, px/frame (px/f), px/frame² (px/f²) and frames (f) at 60 fps; fixed point 0x1000 = 1 px/f. Damage is in
the Classic units (a Goomba has 250 HP, HP-C3).

**Toad (NC-5) will share her carry system.** Everything about plucking, lifting, carrying, throwing and riding lives in
one shared module with a per-hero `CarryProfile` (PE-9). Toad is then a second profile, not a copy.

### 1. Identity and roster

**PE-1. A new `CharacterDef`, `PEACH_CLASSIC`, in `src/game/characters/peach/classic.ts`.** Sketch:

```ts
export const PEACH_CLASSIC: CharacterDef = {
  id: 'peach',
  name: 'Peach',
  hudName: 'PEACH',
  rules: 'classic',                         // TG-18, TG-41
  movement: PEACH_CLASSIC_PROFILE,          // PE-4 to PE-7
  damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
  stomps: false,                            // she rides instead (PE-10)
  crouches: true,
  canBreakBricks: () => false,              // BR-C3: only big Mario and Luigi
  hitbox: (p) => (p.powerState === 'small' || p.crouching ? { w: 12, h: 16 } : { w: 12, h: 24 }),
  sprite: peachSprite,                      // PE-25
  blockPowerUp: classicBlockPowerUp,        // PS-C2
  powerIcon: true,                          // PS-C26
  drawLook: (p, frame, reduce) => classicLook(p, reduce, KIT.response.look),
  starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
  portrait: { sheet: 'peach', palette: 'peach', frame: 'stand' },
  jumpSfx: (p) => (p.powerState === 'small' ? 'jump-small' : 'jump-big'),
  guide: PEACH_CLASSIC_GUIDE,               // PE-23
  touchLabels: peachTouchLabels,            // PE-23
  standsOnEnemies: (p, e) => carryable(PEACH_CARRY, e) && !p.inWater, // PE-10, new optional field
  behaviour: { update, onPowerUp, contactDamage: () => null, onHurt, onRespawn, onGrabVine, onLevelClear },
};
```

No `drop` (she never gets ammo drops, like Mario, PS-C15), no `meter`, no `tools`.

**PE-2. Hitbox.** 12 × 16 small or crouching, 12 × 24 with the Mushroom or Flower: Mario's boxes, so she fits every gap
Mario fits. A carried thing does **not** add to her hitbox (PE-13).

**PE-3. Select slot and portrait.** Appended to `CLASSIC_EXTRAS` after the extras already built (order is the owner's, D-PE-12). Portrait: her `stand` frame.

### 2. Controls

**PE-4. What each control does.**

| Control | Action |
|---|---|
| Left / Right | Walk; with Run held, run (Classic Mario's inertia model, ML-C3/ML-C4). Full air control. |
| Down | Crouch (12 × 16), Mario's crouch rules. Held for 60 f (T) on the ground: Power Squat (PE-8). |
| Jump | Jump (rise path, PE-5). Held while falling: Float (PE-6). |
| Attack (hold) | Run, while she carries nothing. |
| Attack (press) while carrying | Throw (PE-12). With Down held on the ground: set it down in front of her instead. |
| Special | LIFT: pluck from the ground, lift the enemy she stands on, or (D-PE-3) lift the brick she stands on (PE-10, PE-11). |
| Select | nothing (no tools; `&kit=full` gives nothing extra) |
| On a vine | no lift or throw (as every hero, shared vine code) |

The run button doubling as throw is SMB2's own layout (B runs and throws). Lift is on Special rather than SMB2's
"B on a tuft" because every ground tile here is pluckable, so a plain Attack press would pluck every time she starts to
run (D-PE-1 has the alternative Down + Attack).

### 3. Movement and jumping

**PE-5. Profile.** `PEACH_CLASSIC_PROFILE = plumberClassicProfile(PEACH_CONSTANTS)` (the function Classic Mario uses,
`src/game/characters/mario/classic.ts:80-131`), so walk, run, inertia, rise path, soft cut, no jump buffer, crouch jump
and gap crossing are Mario's. Only the rise caps change:

| Constant | Classic Mario | Peach | Note |
|---|---|---|---|
| Walk / run cap | 1.4583 / 2.5 px/f | same | |
| Accel, release, brake, skid | Mario's | same | |
| Rise speed, stand / run | 0x03555 / 0x03800 | same | |
| Rise cap, stand / run | 42 / 56 px | **40 / 47 px** (owner 2026-10-20; was 50) | apex about 65 / 75 px (Mario 67 / 83.7) |
| Rise cap while carrying | — | **32 / 42 px (T)** | apex about 57 / 67 px |
| Min line | 19 px | **16 px (T)** | |
| Gravity, fall cap | 0x00355, 0x05000 | same | |
| Soft cut | 52057 | same | |
| Stomp bounce | 0x02800 | unused (no stomp) | |

The 40 px standing cap is chosen so a standing jump still clears the 4-tile pipes of 1-1 (64 px). Carrying, she has to
run for them, as in SMB2 where carrying weighs you down. She cannot run while carrying (Attack throws), so carrying caps
her at the walk speed and the stand tier.

**PE-6. Float.** A new optional profile field (`float?: { frames: number }`, read on the rise path only):
- Once per airborne spell. It starts on the first frame she is falling (vy ≥ 0 after the rise) with Jump held, either
  held from the take-off or pressed again while falling. That is SMB2's hold-to-float.
- While floating: vy = 0, no gravity, Left/Right steer as normal air control, Attack throws, Special does nothing.
- It lasts **90 frames (T)** (SMB2's float is about 1.5 s), then gravity resumes. Releasing Jump ends it early; it cannot
  be resumed in that airborne spell.
- Readied by landing on ground, a lift, or an enemy she rides. Not readied by a spring.
- Not after walking off a ledge with Jump not pressed since (needs a Jump press while falling: allowed, D-PE-5).
- Not under water (SW-C2: no float there), not on a vine, not during the hit freeze.
- Pose: `float-0`/`float-1` alternating every 8 f (skirt flutter). A 1 px bob is sprite-only; the body stays level.

**PE-7. Springs.** No spring entry: an unknown hero gets Mario's spring values (`spring.ts`), which suits her Mario
model. A spring launch can float at its end.

**PE-8. Power Squat (SMB2's charged super jump).** Crouch on the ground for 60 f (T): she flashes (palette swap every
4 f; with Reduce flashing a steady `peach-star` palette instead). A jump from the charged crouch uses one tier
`{ speed: 0x03555, cap: 72 }` (T): apex about 97 px (6 tiles). Standing up or walking clears the charge. Not while
carrying, not under water. Optional (D-PE-6), but it is a few lines on the rise path (a tier override).

### 4. Pluck, lift, carry and throw (the shared carry system)

**PE-9. One shared module, `src/game/characters/classic/carry.ts`,** used by Peach now and Toad later. Per hero:

```ts
export interface CarryProfile {
  liftFrames: (p: Player) => number;   // Peach 20, 10 with the Flower (T); Toad about 8 (T)
  carryCap?: { stand: number; run: number }; // rise caps while carrying; Toad: absent = no penalty
  carryRun: boolean;                   // may run while carrying (Peach false; Toad TBD)
  throwVx: number;                     // 0x04000 (4 px/f, T)
  throwVy: number;                     // -0x01000 (T)
  throwGravity: number;                // 0x00200 (0.125 px/f², T)
  enemyThrowVx: number;                // 0x03800 (3.5 px/f, T)
  liftBricks: boolean;                 // D-PE-3
  pierceVeg: (p: Player) => boolean;   // Peach: Flower state
}
```

It owns: the lift state (rooted, PE-10), the carried thing (an entity riding above the owner's head, as Classic Mega
Man's `CarriedBrick`, `megaman/classic-weapons.ts:623-657`), the pluck roll (PE-14), throw and set-down, the dropping
rules (PE-13), and the `standsOnEnemies` test.

**PE-10. Lift (Special on the ground, carrying nothing, not crouch-charged).** What is under her, in this order:
1. **The enemy she stands on** (PE-11) → lift it.
2. **(D-PE-3) A plain brick under her centre** (`brick`, content `none`) → take it out of the map, as Super Arm's
   `liftBrick` does, and carry it.
3. **A pluckable tile under her centre**: `ground`, `hard`, `tree-top`, `mushroom-top`, `castle-brick` (D-PE-2) →
   pluck (PE-14). Not from `?` blocks, used blocks, item bricks, pipes, bridges, clouds, lifts, springs or blasters.
4. Anything else → nothing (no sound).

During the lift she is rooted (`behaviour.rooted` returns `true`: no walk, no jump) for `liftFrames` frames in the
`lift` pose; the thing appears over her head on the last frame. She can still be hit; a hit cancels the lift.

**PE-11. Riding and lifting enemies.**
- **Liftable** (the `CarryProfile` list): Goomba; Koopa and Paratroopa (green, red; walking, flying or in the shell;
  a lifted Paratroopa loses its wings); Buzzy Beetle and its shell; Bullet Bill; Hammer Bro.
- **Not liftable**: Spiny and Spiny egg (spikes hurt, as SMB2's Porcupo), Piranha Plant, Lakitu (never reachable),
  Cheep Cheeps, Blooper, Podoboo, Bowser and fake Bowser, firebars, hammers and fire.
- **Riding (the SMB2 core, an exception to HP-C23).** Landing on a liftable enemy from above is neither a stomp nor a
  hit: she lands on its top as on a moving floor, moves with its vx each frame, and can walk, jump, float off and lift.
  Contact from the side or below hurts as for any non-stomper (HP-C23). A Star still kills on touch (HP-C7). Under water
  there is no riding (SW-C7: plain contact).
- The ridden enemy keeps its own rules: a Koopa turns at walls and ledges (red) with her on top; a Bullet Bill carries
  her across a gap; a Paratroopa lifts and drops her with its flight; a Hammer Bro's jumps throw her (she is airborne
  from the moment it leaves her feet). Hammers still hurt her.
- **Lifting** removes the enemy from the world into the carried slot with its HP kept (HP-C5). It does nothing while
  carried (no timers, no shell wake-up, no damage to anyone). Setting it down (Down + Attack) puts it back 12 px ahead,
  facing away, and it resumes; a Koopa set down in its shell is a still shell.

**PE-12. Throw (Attack press while carrying; in the air too, also while floating).** Spawned at the carried thing's
position, in her facing direction:

| Thrown | Velocity | Damage and effect | Against ground and blocks |
|---|---|---|---|
| Turnip | vx ±4 px/f plus half her |vx| (T), vy −1 px/f, gravity 0.125 px/f², fall cap 4 px/f | **400 (T)**, pierce 0: Goomba 1, Piranha 1, Koopa 2, Hammer Bro 2, Paratroopa 3, Bowser (fire) 6. Ends on the hit. **Flower:** passes on through each enemy it kills (`pierceDefeat`). Blocked by armour (Buzzy, Bullet Bill) with the blocked behaviour (HP-C14). | `classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: true }`: a plain brick breaks (400 > 125), a `?` block bumps (BR-C7, BR-C8); a wall ends it. |
| Enemy | vx ±3.5 px/f (T), vy −1 px/f, same gravity; drawn as that enemy upside down | **Kills the first enemy it touches outright**, armour included, as a kicked shell (HP-C7, shell-kick score). Both flip out. Against Bowser: 1000 (T), then it flips out. | Ends on a wall (it flips out, 100 points); passes over blocks without striking them. |
| Brick (D-PE-3) | as the turnip | 400; it shatters on its first hit or on ground (the 4 brick pieces, 50 points) | as the turnip |
| POW block | as the turnip | the POW jolt where it lands (PE-14) | ends on ground or a wall with the jolt |

Cap: one thing in the air per Peach (SMB2 feel; T). Throwing is instant (a 10 f `throw` pose, not rooted). Down +
Attack on the ground **sets it down** instead: a turnip set down lies still as a liftable object for 300 f (T), then
vanishes; an enemy resumes (PE-11). Thrown things are removed off screen.

**PE-13. When she loses what she carries.**
- A hit: it drops straight down (turnip and brick vanish on landing; an enemy resumes; a POW jolts).
- Entering a pipe, grabbing a vine or Castlevania stairs, the flagpole or the axe (`onLevelClear`, `onGrabVine`): it
  vanishes (an enemy is simply gone, no score). D-PE-7.
- Death and level end: gone.
- Her head still bumps blocks while carrying (BR-C3/BR-C5); the carried thing has no collision of its own.

**PE-14. What a pluck gives.** A per-level counter `p.scratch.pluckRun` of turnips in a row (reset by any other lift,
by death and by a new area):
- **Stopwatch** if this would be the **6th** turnip in a row (SMB2: the stopwatch after five big vegetables). It is
  used at once: every enemy and enemy projectile stops for **300 f (T)** (5 s); Lakitu resists. Reuse Classic Simon's
  freeze (`simon/classic.ts:160-172`), moved to a shared `classic/freeze.ts` with the length as a parameter. The counter
  resets.
- Else **POW block**, 1 chance in 32 (T): carried and thrown like a turnip. When it lands (or is dropped) the screen
  jolts (2 px for 16 f; skipped with Reduce flashing as a motion-reduction courtesy) and **every on-screen enemy that is
  standing on ground** gets the block-bump hit (HP-C7: dies, except Koopas, Beetles and Spinies, which pop up as today).
- Else **turnip**.
- A sprout (2 leaves) shows on the plucked tile for 20 f (cosmetic). Plucks are unlimited (D-PE-4).

### 5. Power states

**PE-15. Kit per state** (PS-C1, PS-C5). Lose Everything: one hit while powered returns her to small (PS-C8).

| State | Body | Kit |
|---|---|---|
| Small | 12 × 16 (SMB2's one-heart size) | everything: lift, carry, throw, ride, float, Power Squat |
| Mushroom | 12 × 24, grows with Mario's grow animation | survives one hit |
| Fire Flower | 12 × 24, white dress (`peach-flower`) | **Power Pluck (T):** lifts take 10 f, not 20; thrown turnips pierce what they kill |

A `?` block gives a Mushroom when small, else a Flower (PS-C2). Repeat Flower: points only (no `repeat`). D-PE-8 has
alternatives for the Flower.

**PE-16. Hit response.** Mario's row (PS-C10): `{ kind: 'freeze', frames: 60, invuln: 150, look: { alpha: true } }`,
with `grows: true` for the shrink animation. Add `peach` to `CLASSIC_HIT_RESPONSES` (`classic/power.ts:96`). She drops
what she carries (PE-13). Death: Mario's death hop with her `hurt` frame.

**PE-17. Star, 1-ups, drops.** Star 720 f (PS-C19): riding is replaced by the Star kill on touch. No ammo, so no drops
(PS-C14 to PS-C16 do not apply) and no ammo counter (PS-C27).

### 6. Interactions

**PE-18. Bricks and blocks.** Head bumps never break bricks (BR-C3), bump item blocks (BR-C5). Thrown turnips and
bricks strike blocks as in PE-12 (BR-C2 spec flag `strikesBlocks`, source `shot`, damage 400). The lift itself never
strikes a block.

**PE-19. Enemies.** No stomp (HP-C22). Landing: rides a liftable enemy (PE-11), else takes the HP-C23 hit (a Spiny
hurts). Thrown enemies are instant kills; turnips use HP. Armour blocks turnips (pierce 0), never thrown enemies.

**PE-20. Water** (SW-C2 to SW-C7). No stroke and no float: she jumps from the floor only, `CLASSIC_SWIM.peach =
floorJumper(0x0418e, 0x0011c)` (Link's numbers, T): apex about 123 px. Floor walk at her walk speed. Plucking works on
the seabed (`ground` there); throws are unchanged (SW-C5); no riding (SW-C7). D-PE-9 offers Mario's stroke instead.

**PE-21. Pipes, vines, springs, flagpole, axe, Bowser.** Shared code. Carried things vanish on pipes, vines, stairs,
flagpole and axe (PE-13). Bowser (fire, 2400): 6 turnips, or 3 thrown enemies (1000 each), or the axe. Fake Bowsers
the same. Bowser is never liftable and never ridden; his fire and hammers hurt.

**PE-22. Co-op (dev only, TG-30).** Each Peach has her own carry slot and throw cap. She cannot lift or ride the other
player (D-PE-10). A thrown enemy never hurts a player. A ridden enemy can carry both players.

### 7. HUD, guide and touch

**PE-23. Guide** `src/game/characters/peach/classic-guide.ts` (tagline ≤ 30 chars, actions from `GuideAction`, no
button letters; TG-40):

```ts
export const PEACH_CLASSIC_GUIDE: CharacterGuide = {
  tagline: 'Pluck, carry, throw and float',
  controls: [
    { action: 'left/right', does: 'Walk. Hold RUN to run, when your hands are free.' },
    { action: 'jump', does: 'Jump. Keep holding it as you fall to float for a moment.' },
    { action: 'special', touch: 'LIFT', does: 'Pull a vegetable from the ground, or lift the enemy you stand on.' },
    { action: 'attack', touch: 'THROW', does: 'Throw what you carry.' },
    { action: 'down+attack', does: 'Set down what you carry.' },
    { action: 'down', does: 'Crouch. Stay crouched to charge a super jump.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Grow and survive one hit.' },
    { item: 'flower', does: 'Pluck faster. Vegetables fly through what they defeat.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
  ],
  tips: ['Land on most enemies to ride them.', 'Spiny enemies hurt to stand on.'],
  demo: ['idle', 'walk', 'jump', 'special', 'attack'],
};
```

Touch labels: attack `RUN`, or `THROW` while carrying; special `LIFT`; select hidden. Every new text (labels, guide) is
announced to the screen reader as the other guides are. HUD: name `PEACH`, power icon (PS-C26), nothing else.

### 8. Art and sound

**PE-24. Drafts** in `tools/mockups/classic/peach.ts` (not registered; storyboard `peach-sheet.png`, kept out of the
repo). Big frames 16 × 32, small 16 × 16, palette roles 0 outline, 1 dress, 2 dress shade, 3 skin, 4 hair, 5 crown,
6 gloves, 7 jewel/eyes, 8 lips/shoes.

**PE-25. Pose list** (`src/content/sprites/peach.ts`, offset as Mario's frames):

| Frame | When | Drafted |
|---|---|---|
| `stand`, `walk-0..2`, `skid` | ground | stand, walk-0, walk-1 |
| `jump` | rising / falling | yes |
| `float-0`, `float-1` | floating | yes |
| `crouch`, `squat-charged` (palette) | crouch, Power Squat | no (crouch = small-stand art at 24 px, coder) |
| `lift` | plucking / lifting | yes |
| `carry`, `carry-walk-0..2`, `carry-jump` | carrying | carry, carry-walk |
| `throw` | 10 f after a throw | yes |
| `hurt` | death, hit | yes |
| `climb-0/1` | vine, flagpole | no |
| `small-*` (stand, walk, jump, carry, float, lift, throw) | small state | stand, walk, carry, float, lift |
| `grow` | Mushroom | reuse Mario's alternation of small and big |

Items (`items` sheet): `turnip` 16 × 16, `sprout` 8 × 4, `pow` 16 × 16, `watch` 16 × 16 (all drafted). Palettes: `peach`,
`peach-flower`, `peach-star-0..3`.

**PE-26. Sound.** Reuse: `jump-small`/`jump-big`, `kick` for the lift and throw, `stomp` for a thrown-enemy kill,
`bump` for the POW jolt, `magic` for the stopwatch, `powerup`, `pipe`. New (MML, optional): a soft rising `float`
chirp (D-PE-11). No music override.

### 9. Engine work

**PE-27. Optional fields and hooks** (unset by every Current def, TG-23; one `world.rules` branch per shared system):

| Change | Where | Size |
|---|---|---|
| `MovementProfile.float?: { frames }` | `profile.ts`; read once on Player's rise path | S (≈40 lines) |
| `RiseJump.squat?: { frames, tier }` and a `carryTiers` override (caps while carrying) | `profile.ts`, Player rise path | S (≈40) |
| `CharacterDef.standsOnEnemies?(p, e)` and enemy-as-floor riding | the Classic contact code (HP-C23 branch) plus Player ground probe; the enemy's vx carries her | M (≈150) |
| `classic/carry.ts`: `CarryProfile`, lift/carry/throw/set-down, `CarriedThing` entity, `ThrownEnemy` projectile, pluck table | new, shared with Toad | L (≈400) |
| `Enemy.liftable` metadata and a `world.takeEnemy(e)` / `world.putEnemy(e)` pair that removes and restores an enemy with its state | `enemy.ts`, `world.ts` (no rules branch: only Classic code calls it) | M (≈80) |
| POW jolt (bump every grounded on-screen enemy) | `classic/carry.ts`, calling the existing bump kill | S (≈40) |
| Shared stopwatch freeze `classic/freeze.ts` (moved from Simon, length as a parameter) | Simon keeps 180 f | S (≈30) |
| Def, guide, touch labels, `CLASSIC_HIT_RESPONSES.peach`, `CLASSIC_SWIM.peach`, `CLASSIC_EXTRAS` | `peach/`, `classic/power.ts`, `rules/classic-swim.ts`, `registry.ts` | S |
| Sprites and items | `src/content/sprites/peach.ts`, `items.ts`, `index.ts` | M (art ≈400 lines) |

**Total: L**, about 1,300 lines with tests and art. The carry module is the bulk and is reused by Toad.

### 10. Tests and acceptance checks

New file `tests/sim/peach-classic.test.ts` (headless, `rules = 'classic'`, `char = peach`):
- Roster: with Classic mode, the select's second row lists Peach; under Current or in a campaign, `heroFor` never
  returns her and `?char=peach` gives Mario (TG-41).
- Jump: standing apex 64-66 px; running apex 74-76 px; carrying 56-58 / about 70 px (the carry caps stay 32 / 42).
- Float: held Jump, vy = 0 for 90 frames after the apex, then falls; a release on frame 20 ends it; a second float in
  the same air spell does not start; none under water.
- Lift: on `ground`, Special roots her 20 f, then `p.scratch` shows a carried turnip; on a `?` block nothing happens;
  Flower lift 10 f.
- Throw: the turnip moves +4 px/f; it kills a Goomba (250) in one hit and a Koopa (600) in two; with the Flower it
  passes a dead Goomba and kills the Goomba behind; a Buzzy blocks it.
- Riding: landing on a Goomba leaves Peach unhurt and the Goomba alive; after 30 f she has moved with it; landing on a
  Spiny hurts her.
- Thrown enemy: kills a Buzzy Beetle outright; both are removed; Bowser loses 1000.
- Brick (D-PE-3): Special on a plain brick removes the tile; the thrown brick breaks on a Goomba.
- Pluck table: the 6th turnip in a row is a stopwatch and freezes enemies 300 f; a seeded RNG gives a POW, which kills
  two grounded Goombas and pops a Koopa.
- Power: small + hit = death; Flower + hit = small, the carried enemy is back in the world.
- Guide: tagline length, no button letters (TG-40 cases).
- Current unchanged: `tests/sim/current-parity.test.ts` passes; no existing test edited.

### Decisions for the owner

| ID | Question | Recommended | Alternatives |
|---|---|---|---|
| D-PE-1 | Which control lifts? | **Special = LIFT** (clean for touch, no clash with run) | Down + Attack (SMB2-like, frees Special); Attack press when standing still |
| D-PE-2 | Which tiles can be plucked? | **ground, hard, tree top, mushroom top, castle floor** (castles need ammo for Bowser) | outdoor tiles only; only new "grass tuft" cells placed by a TG-45 level variant (big level-data job) |
| D-PE-3 | May she lift the plain brick she stands on (SMB2 mushroom blocks)? | **Yes**, plain bricks only (Super Arm precedent) | no bricks; bricks only while big |
| D-PE-4 | Pluck limit | **Unlimited**; the rooted lift time is the cost | each tile once per visit; a pluck cap per screen |
| D-PE-5 | Float after walking off a ledge (no jump)? | **Yes** with a Jump press while falling | only after a jump (strict SMB2) |
| D-PE-6 | Power Squat super jump | **Include** (cheap, iconic) | leave out |
| D-PE-7 | Carried thing on a pipe or vine | **Vanishes** | carried through pipes (SMB2 carries keys through doors; needs pipe code changes) |
| D-PE-8 | What the Fire Flower gives | **Power Pluck**: 10 f lifts and piercing turnips | turnips at 600 damage; a POW chance of 1 in 8; Fire Mario-style fireballs (off-theme) |
| D-PE-9 | Water | **Floor jump only** (SW-C2, like every non-plumber) | Mario's stroke (she is a Mario-model hero) |
| D-PE-10 | Co-op: lift or ride the other player (SMB2 multiplayer style)? | **No** | ride only; ride and lift |
| D-PE-11 | New float sound | **Yes**, short MML chirp | silent float |
| D-PE-12 | Select order in `CLASSIC_EXTRAS` | after the extras already built | first in the second row |
| D-PE-13 | Every (T) number (caps, float 90 f, lift 20/10 f, throw speeds, 400 / 1000 damage, 1/32 POW, 6th-turnip stopwatch, 300 f freeze) | build as written, playtest | adjust after play |

## Actual

- There is no Peach. `?char=peach` starts Mario (`src/game/characters/registry.ts`, `characterById`). `CLASSIC_EXTRAS` is
  empty (`registry.ts:69`).
- Parts that carry over: Classic Mario's whole movement (`plumberClassicProfile`, `mario/classic.ts:80-131`), Classic
  Mega Man's lift-and-carry of a brick (`megaman/classic-weapons.ts:623-657`, `CarriedBrick`, `ArmBrick`), Classic Simon's
  stopwatch freeze (`simon/classic.ts:160-172`), `behaviour.rooted` (`character.ts:72-79`), ProjectileSpec's
  `classicBlocks`, `pierceDefeat` and armour handling (HP-C14).
- Missing: a float, enemies as moving floors, lifting an enemy out of the world, a thrown-enemy projectile, a pluck
  source, a POW effect.

## How often

every time

## Notes

- **Source game feel (no original SMBC source exists):** SMB2 (USA) Peach: the lowest jump of the four, the float
  (about 1.5 s), standing on enemies, picking up enemies and vegetables with B, the stopwatch after five big vegetables,
  POW blocks, mushroom blocks, the charged crouch super jump, B as run and throw. Numbers are translated, not measured.
- **Mockups:** `tools/mockups/classic/peach.ts` (drafts), `storyboard.ts` and `render.mjs` (copied from
  `claude/classic-wip-mockups`). Render: `node tools/mockups/classic/render.mjs <outDir> <port>`; never into the repo.
- **Related reports:** `2026-10-07-classic-follow-ups.md` (NC-1, NC-5; FU-3 for the original's cosmetic Peach skin),
  `2026-10-07-dev-classic-smbc-rules-toggle.md` (TG-17, TG-23, TG-30, TG-40, TG-41, TG-45),
  `2026-10-07-mario-luigi-classic-smbc-rules.md` (ML-C3 to ML-C12, the model she reuses),
  `2026-10-07-megaman-classic-smbc-rules.md` (MM-C25, Super Arm), `2026-10-07-simon-classic-smbc-rules.md` (SI-C25,
  Stopwatch), and the four shared Classic reports.
