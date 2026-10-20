# Build Sir Arthur as a Classic-only hero: armour as the Mushroom, boxers when hit, lance / dagger / torch / axe, committed jumps

- **Severity:** feature request (new character, Classic mode only; owner wishlist NC-3)
- **Build:** V0.4.56 (3955a1c8)
- **Where:** title → CLASSIC → character select, second row; every level
- **How to get there:** `?dev=1&mode=classic&rules=classic&level=1-1&char=arthur` (once built; today `char=arthur` falls back to Mario)
- **Character and power:** Arthur, all power states (boxers = small, Steel armour = Mushroom, Gold armour = Fire Flower)
- **Input:** keyboard and touch
- **Browser and device:** any

## Steps

1. Open `?dev=1&mode=classic&rules=classic&level=1-1&char=arthur`. Arthur is on the select's second row. He starts the level in his boxers (small).
2. Press Right: he walks at once at 1.25 px/f; there is no run. Press Attack: a lance flies forward; he stops for 12 frames while throwing. Two lances at most are on screen.
3. Jump while walking right, then press Left in the air: nothing changes; he lands where the arc goes. Jump again in mid-air with Left held: a second jump that now goes left, as committed as the first.
4. Hit the `?` block: the Mushroom puts him in Steel armour (no size change). Take a hit from a Goomba: the armour bursts off, he is thrown back and lands in his boxers. Another hit: he crumbles into bones.
5. Get the Flower: Gold armour. Lances now pass a Buzzy Beetle's armour. Press Special: after a 40-frame wind-up, two lightning columns strike either side of him.
6. Kill enemies until one drops a pot: touching it swaps the lance for the weapon shown (dagger, torch or axe).

## Expected

Arthur is a Classic-only extra (owner decision 2026-10-19): in `CLASSIC_EXTRAS`, shown only on the Classic mode's second
select row and in dev Classic starts, never in the campaign (TG-41). He was never in SMBC 3.1.21, so there is no original
source to match. His rules come from **Ghosts 'n Goblins** (arcade and NES) with one element of its sequel **Super Ghouls
'n Ghosts** (the double jump, D-AR-2), translated to SMB's scale and the Classic power model. **Every number marked (T)
is an invented tuning value.**

The Classic power model fits him naturally: SMB's three states are GnG's armour → boxers → bones. Lose Everything
(PS-C8) is exactly GnG: one hit takes all the armour, the next one kills.

Shared systems referenced: PS-C (`2026-10-07-classic-power-states.md`), HP-C (`2026-10-07-classic-enemy-hp-and-armour.md`),
BR-C (`2026-10-07-classic-bricks-and-shots.md`), SW-C (`2026-10-07-classic-swimming.md`). Units: px, px/f, px/f², f at
60 fps; fixed point 0x1000 = 1 px/f; take-offs on the tier path are given as our `initial` (the arc speed less one
frame of gravity, as SI-C5). Damage in Classic units (a Goomba has 250 HP).

### 1. Identity and roster

**AR-1. `ARTHUR_CLASSIC` in `src/game/characters/arthur/classic.ts`.** Most of it is already supported by fields Classic
Simon, Ryu and Link use. Sketch:

```ts
export const ARTHUR_CLASSIC: CharacterDef = {
  id: 'arthur',
  name: 'Arthur',
  hudName: 'ARTHUR',
  rules: 'classic',
  movement: ARTHUR_CLASSIC_PROFILE,                 // AR-5, AR-6
  damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
  stomps: false,
  crouches: true,
  canBreakBricks: () => false,                      // BR-C3
  hitbox: (p) => (p.crouching ? { w: 12, h: 16 } : { w: 12, h: 24 }), // AR-3
  sprite: arthurSprite,                             // frames chosen by power state (AR-27)
  blockPowerUp: classicBlockPowerUp,
  powerIcon: true,
  drawLook: (p, frame, reduce) => classicLook(p, reduce, KIT.response.look),
  starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
  portrait: { sheet: 'arthur', palette: 'arthur', frame: 'stand' },
  drop: (rng, _e, killer) => (killer ? arthurPotDrop(rng, killer) : null), // AR-21
  devKit: () => ({ arthurAll: 1 }),                 // TG-44, AR-22
  guide: ARTHUR_CLASSIC_GUIDE,
  touchLabels: arthurTouchLabels,
  behaviour: { update, rooted, onPowerUp, onHurt, onPickup, onRespawn, contactDamage: () => null },
};
```

**AR-2. Select slot and portrait.** Appended to `CLASSIC_EXTRAS` (order D-AR-11). Portrait: Steel `stand`.

**AR-3. Hitbox.** 12 × 24 standing, 12 × 16 crouched, **the same in armour, gold or boxers** (`grows: false`): the
armour is a look, not a size. Bowser-fighting, gaps and pipes are as for Simon.

### 2. Controls

**AR-4.**

| Control | Action |
|---|---|
| Left / Right | Walk 1.25 px/f, instant start and stop. On the ground only: no effect in the air (AR-6). |
| Down | Crouch (12 × 16, no walking). In the air with Attack: throw downward (AR-14). |
| Jump | Committed jump (AR-6). In the air: one second jump (AR-7). |
| Attack | Throw the current weapon (AR-10 to AR-14). Press only; no auto-fire. |
| Special | Gold armour: Lightning magic (AR-19). Otherwise nothing. |
| Select | nothing (under `&kit=full`: cycle the four weapons, AR-22) |
| On a vine | no throwing, as every hero |

### 3. Movement and jumping

**AR-5. `ARTHUR_CLASSIC_PROFILE`** (tier path):

| Field | Value | Note |
|---|---|---|
| Walk (`minWalk` … `maxRun`, `instantAccel`) | 0x01400 (1.25 px/f, T) | Simon's walk; GnG Arthur is slow |
| `canRun` | false | |
| `jump` | one tier, `initial` **0x05380**, hold and fall gravity **0x00355** (T) | apex **68 px**, 52 f in the air |
| `variableJump` | false | a fixed arc: releasing Jump changes nothing |
| `airControl` | **'none'** | the take-off vx is kept to landing |
| `turnInAir` | false | facing is fixed in the air (throws keep the take-off direction) |
| `jumpBuffer` | false | |
| `airJumps` | 1 (D-AR-2) | AR-7 |
| `maxFall`, `fallReset` | 0x05D55 (5.8333 px/f, clamp, T) | |
| `coyoteFrames` | 0 | |
| `swim` | `CLASSIC_SWIM.arthur` | AR-24 |

The 68 px apex clears a 4-tile pipe (64 px) from a standing jump; walking, a jump covers about 65 px (4 tiles).

**AR-6. Committed jump.** The direction is decided on the take-off frame: walking right → vx stays +1.25 px/f to
landing; standing still → straight up and down. In the air no input changes vx or facing (`airControl: 'none'`,
`turnInAir: false`), as GnG. A head bump ends the rise (vy 0) and he falls straight on with the same vx. Walking off a
ledge keeps the walk vx in the fall. This is all existing tier-path behaviour; nothing new.

**AR-7. Second jump (Super Ghouls 'n Ghosts).** `airJumps: 1` as Classic Simon (SI-C7): a Jump press in the air jumps
again with the ground jump's `initial`, and, because air control is 'none', **takes the direction held at that moment**
(vx ±1.25 px/f, or 0 with none held) and turns him to face it; then it is committed again. Readied on landing. Not on a
spring launch's way up (as Bass, BA-12), not during the hit push. A double jump at the apex reaches about 136 px. Without
it (pure GnG) many SMB gaps and the 8-x stairs become very hard with a walk-speed arc (D-AR-2).

**AR-8. Throwing roots him.** On the ground, a throw roots him for **12 f (T)** (`behaviour.rooted` returns `true`: no
walk, no jump), as GnG's throw stops Arthur. In the air a throw does not change the arc. Crouched throws stay crouched.

**AR-9. Springs.** No entry: Mario's spring values. After a spring launch the arc keeps the vx he had on the spring.

### 4. Weapons

**AR-10. One weapon at a time.** `p.scratch.weapon` ∈ lance, dagger, torch, axe. He starts every life with the
**lance** (PS-C21); a pot replaces it (AR-21); a hit never changes it (GnG keeps the weapon after losing armour). Throws
are free (no ammo). The weapon leaves 11 px ahead of his centre, 18 px above his feet standing (9 px crouched) (T).

**AR-11. Weapon table** (all T; steel/boxers values, Gold in AR-18):

| Weapon | Damage | Path | On screen (boxers / steel / gold) | Delay between throws | Ground and blocks (BR-C) | Enemies |
|---|---|---|---|---|---|---|
| **Lance** | 300 | straight, 4 px/f (0x04000) | 2 / 2 / 3 | 12 f | stopped by walls (`collide`, `end`), breaks a plain brick, bumps `?` | ends on the hit |
| **Dagger** | 200 | straight, 5.5 px/f (0x05800) | 3 / 3 / 4 | 8 f | as the lance | ends on the hit |
| **Torch** | 250 (the torch); floor fire 150 a touch | lob: vx 2 px/f, vy −2.5 px/f, gravity 0.1667 px/f² | 1 / 1 / 2 | 16 f | the torch ends on ground, wall or block and leaves a **floor fire** (AR-12); it strikes the block it hits | the torch ends on the hit (and lights the fire there) |
| **Axe** | 400 | upward arc: vx 2.5 px/f, vy −3.5 px/f, gravity 0.15 px/f², fall cap 6 px/f | 1 / 1 / 2 | 20 f | through ground (`pass`), strikes bricks and flies on (as Simon's Axe, SI-C21) | through every enemy it kills (`pierceDefeat`); ends on one it does not kill |

Hits to kill (HP-C8): lance 300 → Goomba 1, Koopa 2, Hammer Bro 3, Paratroopa 3, Bowser fire 8; dagger 200 → Goomba 2,
Koopa 3, Bowser 12; axe 400 → Koopa 2, Bowser 6. Every steel weapon has pierce 0: a Buzzy Beetle or Bullet Bill blocks
it with the blocked behaviour (HP-C14). Hit-stun: none (T). All are removed off screen.

**AR-12. The torch's floor fire.** Where the torch lands, a 16 × 10 fire burns for **73 f** (owner 2026-10-20: 4 touches at 0/24/48/72; was 60 f) on that spot (2 frames,
8 f each), re-hitting an enemy every 24 f (`rehitAfter`) for 150, **pierce 6** (it gets through armour, as Simon's Holy
Water, SI-C24). It strikes a brick it touches. It does not hurt Arthur. The torch landing on a pit edge burns where it
stops; a torch falling into a pit is gone. Spec: `HOLY_FLAME_CLASSIC` (`simon/classic-weapons.ts:100-115`) with these
numbers; the torch is `HOLY_WATER_CLASSIC`'s bottle pattern with a lob. So the "bad" GnG torch has a real use here (armour).

**AR-13. Rate.** A throw needs the delay since the last throw to have passed and the on-screen count below the cap; a
press that cannot throw is lost (no buffer).

**AR-14. Throwing down in the air (Super Ghouls).** Down + Attack while airborne throws straight down: lance and dagger
with vy +speed, vx 0; the torch dropped (vy 0, gravity); the axe falls with vx 0. Spawn under his feet. Optional
(D-AR-5).

### 5. Power states

**AR-15. Kit per state** (PS-C1, PS-C5):

| State | Look | Kit |
|---|---|---|
| Small = **boxers** | bare chest, white shorts with red hearts | the current weapon, its boxers cap; one hit kills |
| Mushroom = **Steel armour** | silver armour, red plume | survives one hit |
| Fire Flower = **Gold armour** | gold palette of the steel frames | Gold weapons (AR-18) and Lightning (AR-19) |

He starts each life in boxers (PS-C21, D-AR-1). A `?` block gives a Mushroom in boxers, else a Flower (PS-C2). Repeat
Flower: points only. The 60-frame power-up freeze (PS-C4) shows the armour clanking on (alternating boxers and armour
frames every 4 f, the shared grow alternation with `grows: false` art).

**AR-16. Hit response** (PS-C10): a push like Simon's, added as `CLASSIC_HIT_RESPONSES.arthur`:
`{ kind: 'push', vx: 0x01400, from: 'source', vy: 0x03000, faceSource: true, lock: { untilLand: true }, invuln:
CLASSIC_PUSH_INVULN, look: { alpha: true, from: 'land' } }` (vy 3 px/f, T). GnG's backward hop.

**AR-17. The armour bursts.** On the hit that takes Steel or Gold: 4 armour pieces (`piece-0/1`, in the armour's
palette) fly out from his body (vx ±1 to ±2 px/f, vy −3 to −2 px/f, gravity 0.2 px/f², 40 f; cosmetic particles, no
collision), and he is in boxers from that frame. Gold goes straight to boxers (Lose Everything, PS-C8). Nothing else is
lost: the weapon stays.

**AR-18. Gold armour weapons (T).** Damage +100 (lance 400, dagger 300, torch 350 / fire 200, axe 500), **pierce 6**
(through Buzzy and Bullet Bill armour), cap +1 (table AR-11), drawn in gold (`arthur-gold` on the fx sheet).

**AR-19. Lightning (Gold armour, Special).** A 40 f (T) wind-up (rooted; he raises his weapon, a small spark; Reduce
flashing: no spark flicker), then two bolt columns, 24 px wide, 56 px (T) ahead and behind his centre, from the top of the
screen to the ground, for 20 f: 600 damage, pierce 6, each enemy hit once. Cooldown 90 f (T) from the cast. Not in the air
(a press in the air does nothing); it works under water (SW-C5). Hurt during the wind-up cancels it.
SGnG's magic is charged by holding Attack; Special is simpler on touch (D-AR-4).

**AR-20. Star, 1-ups.** Star 720 f (PS-C19). No ammo, no ammo counter (PS-C27).

**AR-21. Weapon pots (his "drops").** Using the shared drop roll (PS-C15) with his own rate: **1 kill in 8 (T)** drops a
pot (no brick or coin drops). The pot shows one of the three weapons he does **not** hold, picked evenly. It pops out of
the enemy, rests on the ground, lies **480 f (T)** and vanishes (it blinks for its last 120 f; with Reduce flashing it
does not blink). Touching it always takes it (PS-C17) and replaces the weapon, with the `powerup` sound and no freeze.
Shots already in the air keep flying. New pickup kinds `pot-lance`, `pot-dagger`, `pot-torch`, `pot-axe` (one each, so
the drop needs no extra data). D-AR-6 covers whether the torch belongs in the pool.

**AR-22. Dev full kit** (TG-44): `&kit=full` gives Gold armour and lets Select cycle the four weapons.

### 6. Interactions

**AR-23. Bricks, blocks and enemies.** Head bumps never break bricks (BR-C3). Weapons against blocks per AR-11 (source
`shot`, their damage; a lance breaks a plain brick in one throw, 300 > 125). No stomp: landing on an enemy hurts
(HP-C23). Armour blocks steel weapons (HP-C13); the torch fire and Gold weapons pierce.

**AR-24. Water** (SW-C2 to SW-C7). No stroke: `CLASSIC_SWIM.arthur = floorJumper(0x0418e, 0x0011c)` (T, Link's water
numbers): a floor jump of about 123 px, still committed, his second jump too. Walk 1.25 px/f on the floor. Weapons
unchanged (SW-C5); the torch fire still burns on the seabed (D-AR-8).

**AR-25. Pipes, vines, springs, flagpole, axe, Bowser.** Shared code, nothing Arthur-specific. On a vine he climbs and
cannot throw. Bowser fire form 2400: 8 lances (6 gold), 6 axes. The axe on the bridge ends the fight as for all.

**AR-26. Co-op (dev only, TG-30).** Caps and weapon are per player; a pot goes to whoever touches it first.

### 7. HUD, guide and touch

**AR-27. HUD.** `ARTHUR`, the power icon (PS-C26), and the current weapon's icon under the name (like Simon's
sub-weapon icon). Announce a weapon change to the screen reader ("Dagger").

**AR-28. Guide** `src/game/characters/arthur/classic-guide.ts`:

```ts
export const ARTHUR_CLASSIC_GUIDE: CharacterGuide = {
  tagline: 'Armour, lances, no going back',
  controls: [
    { action: 'left/right', does: 'Walk. Your jump keeps the direction you take off in.' },
    { action: 'jump', does: 'Jump. Press again in the air for one more jump, in the direction you hold.' },
    { action: 'attack', touch: 'THROW', does: 'Throw your weapon. You stop for a moment on the ground.' },
    { action: 'down', does: 'Crouch. Throws go low.' },
    { action: 'down+attack', does: 'In the air: throw straight down.' },
    { action: 'special', touch: 'MAGIC', does: 'In gold armour: lightning on both sides.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Steel armour. One hit knocks it off.' },
    { item: 'flower', does: 'Gold armour: stronger weapons that pierce, and magic.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
    { item: 'drops', does: 'Weapon pots. Touch one to change weapons.' },
  ],
  tips: ['One hit takes all your armour.', 'The torch fire burns through armour.'],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch'],
};
```

The tagline is 29 characters (limit 30). Touch labels: attack `THROW`; special `MAGIC` in Gold armour, hidden otherwise; select hidden (shown as `WEAPON` under the
full kit). All announced.

### 8. Art and sound

**AR-29. Drafts** in `tools/mockups/classic/arthur.ts` (storyboard `arthur-sheet.png`, out of the repo). 16 × 32 cells,
palette roles 0 outline, 1 metal light, 2 metal dark, 3 skin, 4 white, 5 red, 6 beard/hair, 7 shine, 8 boots/belt.

| Frame | When | Drafted |
|---|---|---|
| `stand`, `walk-0..2` | armour on the ground | stand, walk-0, walk-1 |
| `jump` | armour in the air | yes |
| `throw`, `crouch`, `crouch-throw`, `throw-down` | throws | throw, crouch, crouch-throw |
| `magic` | Lightning wind-up | no (reuse `throw` with a raised arm, coder) |
| `boxers-stand`, `boxers-walk-0..2`, `boxers-jump`, `boxers-throw`, `boxers-crouch` | boxers | stand, walk, jump, throw |
| `boxers-hurt` | the armour hit, every hit push | yes |
| `bones` | death (16 × 16) | yes |
| `climb-0/1` (armour, boxers) | vine, flagpole | no |
| fx: `lance`, `dagger`, `torch-0/1`, `flame-0/1`, `axe-0/1` (4 turns by flipping), `piece-0/1`, `bolt`, `pot` | weapons and effects | all |

Palettes `arthur`, `arthur-gold`, `arthur-star-0..3`; fx palettes steel and gold.

**AR-30. Sound.** Reuse: `fireball` for a throw, `kick` for a blocked hit (HP-C14), `powerup` for armour and pots,
`break` for the armour burst, `magic` for Lightning, `bump`. Death: the shared death sting. No music override (D-AR-10).

### 9. Engine work

**AR-31. Almost all of it exists.** Committed jump (`airControl: 'none'`, `turnInAir: false`), the redirectable air
jump (`airJumps`), `rooted`, the push hit response, `classicBlocks`, `pierce`, `pierceDefeat`, `rehitAfter`, the drop
roll, floor-jumping water. New:

| Change | Where | Size |
|---|---|---|
| Def, profile, weapon specs (lance, dagger, torch + fire, axe, gold variants), throw/cap/delay logic, Lightning | new `arthur/classic.ts`, `arthur/classic-weapons.ts` | M (≈450 lines) |
| Pot pickups `pot-*` (4 kinds), their sprites, `onPickup` | `entities/objects/pickup.ts` (kinds only), `power.ts` drop table row | S (≈60) |
| Armour-burst particles (cosmetic) | reuse the brick-piece particle with new frames | S (≈30) |
| `CLASSIC_HIT_RESPONSES.arthur`, `CLASSIC_SWIM.arthur`, `CLASSIC_EXTRAS` | `classic/power.ts`, `rules/classic-swim.ts`, `registry.ts` | S |
| Per-state frame choice with `grows: false` and the power-up alternation | `arthur/classic.ts` sprite function | S |
| Sprites | `src/content/sprites/arthur.ts`, `index.ts` | M (art ≈350 lines) |

**Total: M**, about 900 lines with tests and art. **No new `MovementProfile` field** is needed.

### 10. Tests and acceptance checks

`tests/sim/arthur-classic.test.ts` (headless, `rules = 'classic'`, `char = arthur`):
- Roster: on the Classic second row; never under Current or in a campaign (TG-41).
- Jump: standing apex 67-69 px, landing on frame 52 ± 1; Jump released on frame 2: same apex (fixed arc).
- Committed: jump with Right held, then hold Left for the whole jump: vx stays +0x01400 and facing stays right; a
  standing jump has vx 0 throughout.
- Second jump: at the apex with Left held, vy = −0x05380, vx = −0x01400, facing left; a third press does nothing.
- Rooting: Attack with Right held on the ground: x unchanged for 12 frames.
- Lance: 2 on screen; a 3rd press does nothing; a Goomba dies to 1, a Koopa to 2; a Buzzy blocks it; a lance at a
  pipe ends there; a plain brick breaks.
- Axe: passes through a pipe and kills two Goombas in a line.
- Torch: lands, the fire lasts 73 f and one fire kills a Buzzy Beetle (600) in 4 touches 24 f apart (0/24/48/72).
- Power: boxers + hit = death (bones); Steel + hit = boxers with the push, weapon kept; Gold + hit = boxers.
- Gold: the lance passes Buzzy armour and deals 400; Lightning kills a Goomba 56 px behind him.
- Pots: a seeded RNG drops a pot; touching it changes `p.scratch.weapon`; it is never the held weapon.
- Water: floor jump vy = −0x0418E; no stroke mid-water.
- Guide and labels: TG-40 cases. Current unchanged: the parity fixture passes; no existing test edited.

### Decisions for the owner

| ID | Question | Recommended | Alternatives |
|---|---|---|---|
| D-AR-1 | Start state | **Boxers**, as every Classic hero (PS-C21); the first Mushroom is his armour | start every life in Steel armour (GnG feel, breaks PS-C21) |
| D-AR-2 | Second jump | **Yes** (Super Ghouls, redirectable) | none (pure GnG; many SMB jumps then need precise timing); only in Gold armour |
| D-AR-3 | Does the armour change his size? | **No**, 12 × 24 always | boxers 12 × 16 like small Mario (more forgiving, less GnG) |
| D-AR-4 | Magic control | **Special**, 40 f wind-up | hold Attack to charge and release (SGnG, harder on touch); no magic, Gold = weapons only |
| D-AR-5 | Down-throw in the air | **Include** | leave out (pure GnG) |
| D-AR-6 | The torch in the pot pool | **Yes**, with the armour-piercing fire making it useful | no torch; torch as the Gold armour's special weapon |
| D-AR-7 | Pot rate | **1 kill in 8** | 1 in 4 (the shared 25%); pots also from bricks |
| D-AR-8 | Torch fire under water | **Burns** (SW-C5: weapons unchanged) | fizzles out |
| D-AR-9 | Walk speed | **1.25 px/f** (Simon) | 1.0 px/f (closer to GnG; slow on SMB levels) |
| D-AR-10 | Music | **none** (default level music) | an original GnG-flavoured Star or level theme in MML |
| D-AR-11 | Select order in `CLASSIC_EXTRAS` | after the extras already built | — |
| D-AR-12 | Every (T) number (jump 0x05380, rooting 12 f, weapon speeds, damage, caps, delays, fire 60 f, Lightning, push vy) | build as written, playtest | adjust after play |

## Actual

- There is no Arthur: `?char=arthur` starts Mario (`registry.ts`); `CLASSIC_EXTRAS` is empty (`registry.ts:69`).
- Parts that carry over: Classic Simon's profile shape and air jump (`simon/classic.ts:69-96`, SI-C7: with no air
  control the air jump takes the held direction), his Axe, Dagger and Holy Water specs (`simon/classic-weapons.ts:56-128`),
  `behaviour.rooted` (`character.ts:72-79`), the push hit response (`classic/power.ts:129-138`), the drop roll
  (`classicDrop`, `power.ts`), `floorJumper` water (`rules/classic-swim.ts`).
- Missing: the weapon pots, the armour-burst particles, the Lightning, the art.

## How often

every time

## Notes

- **Source game feel (no SMBC source):** Ghosts 'n Goblins: the armour lost in one hit leaving Arthur in his boxers,
  death in boxers as a heap of bones, the slow walk, the committed fixed-arc jump with no turning, one weapon at a time
  replaced by pickups (lance, dagger, torch, axe; the torch infamous), throwing stops him, two lances on screen. Super
  Ghouls 'n Ghosts: the redirectable double jump, Gold armour with stronger weapons and magic, the downward throw.
  Numbers are translated by feel, not measured.
- **Mockups:** `tools/mockups/classic/arthur.ts`, rendered with `storyboard.ts` / `render.mjs` (from
  `claude/classic-wip-mockups`); PNGs never in the repo.
- **Related reports:** `2026-10-07-classic-follow-ups.md` (NC-3), `2026-10-07-dev-classic-smbc-rules-toggle.md`
  (TG-23, TG-30, TG-40, TG-41, TG-44), `2026-10-07-simon-classic-smbc-rules.md` (SI-C4, SI-C5, SI-C7, SI-C21 to
  SI-C24), the four shared Classic reports.
