# Build Sophia III as a Classic SMBC character: a wide tank that drives on walls and ceilings, hovers, swims with thrust and fires a 3-level cannon and missiles (Jason is cosmetic)

- **Severity:** feature request (new character, Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=sophia` (once the toggle exists; today `?dev=1&level=1-1&char=sophia` shows the Current behaviour)
- **Character and power:** Sophia III, all power states (Normal = small, Hyper = Mushroom, Crusher = Fire Flower)
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=sophia` (Current). Mario starts: we have no Sophia, and an unknown `char` falls back to the first hero.
2. Once Phase 1 is built, open `?dev=1&rules=classic&level=1-1&char=sophia`. The select screen shows Sophia III on the second row. Hold Right: she reaches 1.54 px/f in 14 frames and never runs. Let go: she rolls about 13 px and stops after 32 frames.
3. Tap Jump: the tank squats for 4 frames, rises at a constant speed, and peaks about 45 px up. Hold Jump: about 72 px. The height is the same at any speed.
4. Press Attack next to a Goomba: 3 shots kill it, at most 3 shots are on screen. Hold Up for 9 frames, then fire: the shot goes straight up. Two shots break a brick. A Buzzy Beetle ignores the cannon.
5. Take the Mushroom (hull turns magenta): a Goomba now takes 2 shots. Jump, then press Jump again in the air: she hovers up slowly while the 8-cell bar drains. Take the Flower (hull red): drive into the first pipe while holding Up: she drives up its side and over the top. Jump under a row of `?` blocks: she grips the ceiling and drives along it upside down. Press Special: three missiles fly out.
6. Open `?dev=1&rules=classic&level=4-4&char=sophia` and compare with `char=mario`: at column 161, row 10 the floor tile is gone for Sophia, so the drop at column 160 is 2 tiles wide, not 1.

## Expected

Sophia III is a Classic-only character. She has no Current version. She appears on the select screen only while dev
mode is on and Rules is Classic SMBC (TG-41 to TG-43 in `2026-10-07-dev-classic-smbc-rules-toggle.md`). Jason, her
pilot, is cosmetic only.

Shared systems are only referenced here:
- power states, Lose Everything, hit response, drops and Star: `2026-10-07-classic-power-states.md` (PS-C);
- enemy HP, armour and damage numbers: `2026-10-07-classic-enemy-hp-and-armour.md` (HP-C);
- bricks, `?` blocks and shots against solid ground: `2026-10-07-classic-bricks-and-shots.md` (BR-C);
- water: `2026-10-07-classic-swimming.md` (SW-C);
- the constant-rise jump model: `2026-10-07-mario-luigi-classic-smbc-rules.md` (ML-C8, ML-C9).

Units: px, px/frame (px/f), px/frame² (px/f²) and frames (f) at 60 fps. Fixed point is 0x1000 = 1 px/f, as in
`src/engine/math/units.ts`. Original values convert as Flash px ÷ 2, Flash px/s ÷ 120, Flash px/s² ÷ 7200 and
ms ÷ 16.67. A per-second decay factor `k^dt` becomes `k^(1/60)` per frame. "Anchor" means the original's registration
point: the middle of the hitbox's bottom edge when upright.

Original line numbers below are for files converted with `tr '\r' '\n'` (copies in `$S/chars/work-sj/`).

### 1. Status in 3.1.21

**SO-1. Sophia III is fully playable in 3.1.21; Jason is not.**
- `Sophia extends Character` (`Sophia.as:59`). She has her own select slot on the second row, after Ryu.
- Jason (`Jason.as`, 57 lines) extends `AnimatedObject`, not `Character`. He is created only by
  `Sophia.chooseCharacter()` (`Sophia.as:3381-3394`): on the select screen the hatch opens and he hops out. He never
  leaves the tank in a level. There is no on-foot mode, no dungeon mode and no Jason damage model.
- She has 11 skins (Blaster Master NES, SNES, GB, 16-bit, X1, Atari; Sophia J-7 NES, SNES, GB; Tetrimino NES and
  SNES). None changes gameplay (`Sophia.as` has no skin branch). Skins are out of scope.
- **Fidelity.** Every rule here comes from the original's source, its level XML and its SWF. Nobody played Sophia
  for this report. Jump heights are a re-simulation of the source. The original's art is not in our repo and our
  heroes use our own art, so all sprites are a new art job (section 11).
- **She is the original's only wide hero and the only one that changes surfaces.** Our engine has neither. This is the
  largest build of the six missing characters (FU-6 in `2026-10-07-classic-follow-ups.md`).

### 2. Character definition

**SO-2. A new `CharacterDef`, `SOPHIA_CLASSIC`, in `src/game/characters/sophia/classic.ts`.** It follows our interface
(`src/game/characters/character.ts:103-147`) plus the toggle's `rules` field (TG-18) and one new optional field
(SO-5). Sketch:

```ts
export const SOPHIA_CLASSIC: CharacterDef = {
  id: 'sophia',
  name: 'Sophia III',
  hudName: 'SOPHIA',
  rules: 'classic',                                   // TG-18, TG-41
  movement: SOPHIA_PROFILE,                           // SO-9; mode: 'sophia' (SO-10)
  damage: { kind: 'powerup', states: ['small', 'big', 'fire'] }, // TG-21: Normal, Hyper, Crusher
  stomps: false,                                      // HP-C22
  crouches: false,
  canBreakBricks: () => false,                        // head bumps only, every state (SO-42)
  hitbox: (p) => (onWall(p) ? { w: 15.5, h: 19 } : { w: 19, h: 15.5 }), // SO-3
  sprite: sophiaSprite,                               // SO-50, SO-51: base + 2 wheels, rotated by surface
  blockPowerUp: (p) => (p.powerState === 'small' ? 'mushroom' : 'flower'), // PS-C2
  jumpSfx: () => 'sophia-jump',
  behaviour: SOPHIA_BEHAVIOUR,                        // cannon, missiles, hover, surfaces (sections 7-8)
  portrait: { sheet: 'sophia', palette: 'sophia', frame: 'idle' },
  meter: hoverMeter,                                  // SO-55: the hover bar, only once she owns Hover
  drop: sophiaDrop,                                   // SO-25, through PS-C's classicDrop
  devKit: () => ({ hover: 1, wallClimb: 1, ceilingClimb: 1, triple: 60, homing: 20 }), // TG-44
  guide: SOPHIA_GUIDE,                                // SO-56
  touchLabels: sophiaTouchLabels,                     // B "SHOOT", C "MISSILE" (hidden with no missile)
  levelFlags: { horz: true, vert: true, wide: true, goodSwimmer: true }, // SO-5, SO-47
};
```

`SOPHIA_PROFILE` is a full `MovementProfile` (`src/game/characters/profile.ts:57-94`) so shared code that reads it
keeps working: `walkAccel` and `runAccel` 0x001C7, `maxWalk` and `maxRun` 0x018AB, `canRun: false`,
`airControl: 'full'`, `instantAccel: false`, `variableJump: false`, `coyoteFrames: 0`, `maxFall` and `fallReset`
0x042AB, one jump tier `{ maxVx: Infinity, initial: 0x03555, holdGravity: 0x00255, fallGravity: 0x00255 }`,
`crossGapMinVx` undefined, plus the new `mode: 'sophia'` (SO-10). Her own driving code (SO-10) reads her constants
from `sophia/profile.ts`, not from these shared fields.

**SO-3. Hitbox.**
- Upright (floor, air, water, vine): **19 × 15.5 px**. The original's hit rectangle is 38 × 31 Flash px at (−19, −31)
  from the anchor (`smbc3.swf` sprite 187 `MovieClipInfo_SophiaMc`, the 8 × 8 `HRect` scaled 4.75 × 3.875).
- On a wall: **15.5 × 19 px** (the same box turned 90°). On a ceiling: 19 × 15.5, hanging below the ceiling.
- The same in every power state: she never shrinks or crouches.
- 15.5 px is 3968 subpixels; `px(15.5)` in `makeBody` is exact. See SO-M4 if a whole number is wanted.
- Her art is wider than her box (about 26 px, SO-50). Draw it centred on the box, bottom-aligned when upright.

**SO-4. Name, slot and portrait.**
- `name` "Sophia III" (menus), `hudName` "SOPHIA". The original's dialogue name is "Jason" (`CharacterInfo.as:54`); our
  shared castle text stays as it is (SO-M13).
- Select slot: second row, after Bass, in TG-41's `CLASSIC_EXTRAS` order (Bass, Sophia III, Proto Man, Pit, Vic Viper,
  Warriors of Light). Never in `CHARACTERS`.
- Portrait: her `idle` frame (the original uses a separate 23 × 23 `portrait` frame in `SophiaIconMc`; one is optional).

**SO-5. Level flags.** Add an optional `levelFlags?: { horz?: boolean; vert?: boolean; wide?: boolean;
goodSwimmer?: boolean; poorBowser?: boolean }` to `CharacterDef`. These are the original's `usesHorzObjs`,
`usesVertObjs`, `isWideCharacter`, `isGoodSwimmer` and `poorBowserFighter` (`Sophia.as:379-382`). Sophia sets
`horz`, `vert`, `wide` and `goodSwimmer`. No Current def sets the field. Section 10 uses it.

### 3. Controls

**SO-6. Directions are read relative to the surface she is on.** The original keeps four "Sophia" direction flags
and fills them from the real keys by surface (`Sophia.as:2016-2119`). In words: **forward and back** run along the
surface, **"up"** points away from the surface, **"down"** points into it.

| Key | Floor | Wall on her left | Wall on her right | Ceiling |
|---|---|---|---|---|
| Left | drive left | "down" (into the wall) | "up" (away: raise the cannon) | drive left |
| Right | drive right | "up" (away: raise the cannon) | "down" (into the wall) | drive right |
| Up | "up": raise the cannon; with Wall Climb, climb a wall ahead | drive up | drive up | "down" (into the ceiling) |
| Down | "down": wrap down a ledge (Wall Climb); in the air, don't grip ceilings | drive down | drive down | "up" (away: aim the cannon down) |

- When her surface changes, the held keys are read again at once (`setSophiaDirBtns`, `Sophia.as:1846-1860`). So
  holding Up and Left into a left wall keeps her climbing after the turn: Up now means "drive up".
- On a wall the cannon faces the way she drives (up or down the wall).

**SO-7. What each control does.**

| Control | Does |
|---|---|
| Left / right | Drive (SO-10). No run button. |
| Up ("up") | Raise the cannon to fire straight away from the surface (SO-28). On the floor with Wall Climb, held with the direction toward a wall: drive up it (SO-36). On a vine: climb. |
| Down ("down") | No crouch. On the floor with Wall Climb, held with the direction while driving off a ledge: wrap down onto the cliff face (SO-36). In the air: do not grip a ceiling (SO-37). Under water: thrust down (SO-18). On a wall or ceiling, with Jump: drop off (SO-36). |
| Jump | On the floor, a wall or a ceiling: squat 4 f, then jump away from the surface (SO-12, SO-36). In the air with Hover: hover while held (SO-35). Under water: hold for the speed boost (SO-18). |
| Attack | Fire the cannon. At most 3 shots on screen (SO-28). Not on a vine, not during a surface turn. |
| Special | Fire the missile weapon she owns (SO-30, SO-31). Not on a vine, not during a surface turn. |
| Select | Swap Triple and Homing Missile when she owns both (only with the dev full kit in Classic, SO-32). Plays the select sound. |

- Down + Attack does **not** fire the missile: the original's `classicSpecialInput` option is off by default
  (`GameSettings.as:112, 211`).
- **SO-8. Input locks.** During a surface turn (SO-36) every direction, Jump, Attack and Special press is ignored
  (`cState == ST_WALL_TRANS`, `Sophia.as:636-637, 1863-1864, 1948-1949, 1985-1986, 2019-2020`). Releases are still
  recorded. On a vine: no Attack, no Special, no hover.

### 4. Movement and jumping

**SO-9. Constants** (`Sophia.as:214-273`, `setStats` `:440-466`).

| Constant | Original | Ours | Fixed point |
|---|---|---|---|
| Drive top speed (floor, air, walls, ceiling) | 185 px/s | 1.5417 px/f | 0x018AB |
| Acceleration (same everywhere) | 800 px/s² | 0.11111 px/f² | 0x001C7 |
| Friction | `vx *= 0.001^dt` | ×0.89125 per frame | — |
| Minimum speed: below it speed snaps to 0 | 5 px/s | 0.04167 px/f | 0x000AB |
| Gravity | 1050 px/s² | 0.14583 px/f² | 0x00255 |
| Fall cap (clamp) | 500 px/s | 4.1667 px/f | 0x042AB |
| Take-off squat | 60 ms timer | 4 f | — |
| Rise speed | 400 px/s | 3.3333 px/f | 0x03555 |
| Rise height above take-off (rise cap = min line) | 82 Flash px | 41 px | — |
| Coast damping while jump is held (on upward speed) | `0.5^dt` | ×0.98851 per frame | — |
| Coast damping after release (on upward speed) | `1e-11^dt` | ×0.65564 per frame | — |
| Head bump | 100 px/s down | +0.8333 px/f | 0x00D55 |
| Wall-jump push away from a wall | 130 Flash px at 400 px/s | 65 px at 3.3333 px/f | — |
| Jump away from a ceiling | 82 Flash px at 400 px/s | 41 px at 3.3333 px/f | — |

**SO-10. Her own driving code.** Add `mode?: 'sophia'` to `MovementProfile`. When it is set, `Player.update` calls
`driveSophia(this, input, map, audio, onHeadBump)` (new, `src/game/characters/sophia/drive.ts`) right after the vine
check (`src/game/entities/player.ts:163`) and returns. Nothing else in `Player.update` changes, so Current is
untouched. On a vine she uses the shared climb (`player.ts:163`). Each frame, in this order (`checkState` then
`movePlayer` then gravity then `updateLoc`, `AnimatedObject.as:179-198, 255-277`):
1. **Squat.** If a take-off is pending, count it down; at 0 do the take-off (SO-12).
2. **Jump state** (SO-13 steps 1-3; on walls and ceilings, SO-36).
3. **Along the surface.** Forward only (and no wall touching that side): speed += 0.11111 px/f², face forward.
   Back only: the same the other way. **Both held: speed ×0.89125, on the ground or in the air.** **Neither held:
   speed ×0.89125 only on a surface; in the air she keeps her speed** (`Sophia.as:639-692`).
4. **Gravity**, unless she is in a jump rise, swimming off the floor, or on a wall or ceiling: `vy += 0.14583`.
   While hovering, gravity still applies after the thrust (SO-35).
5. **Clamp:** |speed along the surface| ≤ 1.5417 (water: SO-18); |vx| < 0.04167 → 0 (on walls the same for vy);
   `vy` ≤ 4.1667.
6. **Move** x, then y, with the wide-body tile rules of SO-17. Landing ends the jump and plays `sophia-land`.

- There is no skid state. Pressing the other way just accelerates against her speed: from full speed to 0 in
  14 frames, to full speed the other way in 28. Facing flips with the key at once.
- From rest she reaches top speed in 14 frames. Letting go at top speed, she is below 0.04167 px/f after 32 frames
  and travels about 13 px.
- **Turn art only:** a 2-frame turn plays on the base, 60 ms (4 f) per frame (`BASE_TURN_TMR`, `Sophia.as:204`).
- **Integration order: no launch correction needed.** `driveSophia` adds gravity (step 4) before it moves (step 6),
  in the original's order (`AnimatedObject.as:179-198`). So every launch speed in this report (the 3.3333 px/f jump
  rise and wall and ceiling pushes, the hover thrust, the water jump, spring launches) is used as written, and SO-14's
  heights come out frame for frame. The one-frame-of-gravity correction of MM-C10 and SA-C6 is only for heroes on the
  shared `Player.update` path, which moves first. If Sophia is ever moved onto that path, subtract one frame of the
  gravity in force from each launch that is followed by gravity, as MM-C10 does.

**SO-11. Air control** is full: the same 0.11111 px/f² and 1.5417 px/f cap in the air. No take-off cap.

**SO-12. Take-off.**
- Jump pressed while on a surface (and not turning, not on a vine) starts a **4-frame squat**. The base drops 2 px
  (art). She can still drive during it.
- On the 4th frame the jump starts, even if she drove off a ledge during the squat (the timer does not check;
  `Sophia.as:1861-1876, 3106-3107`).
- If Jump is no longer held at that moment, the jump counts as released (SO-13).
- A second Jump press during the squat does nothing.
- Walking off a ledge starts no jump: gravity applies at once. No coyote time.

**SO-13. The jump is ML-C8 / ML-C9 with Sophia's constants** (`Sophia.as:739-809, 967-1006, 1913-1937, 3423-3449`):
- Take-off: `vy = −3.3333`, gravity off, `rising = true`, record `y0`.
- Rise cap and min line are both **41 px**, so a release during the rise never shortens it.
- When `h ≥ 41`: put her at exactly 41 px above take-off, end the rise. If jump was released, damping starts.
- Coasting up with jump held: `vy ×= 0.98851`, then gravity. **This extra hold damping is Sophia's own** (Mario's
  model has none): add an optional `holdDamping` to the jump fields.
- Coasting up after a release: `vy ×= 0.65564`, then gravity. It stops once `vy ≥ 0`.
- Releasing while falling does nothing. The height does not depend on speed.
- Add an optional `takeoffDelay` (frames) to the jump fields for the squat.

**SO-14. Heights (re-simulated from source, not played; SO-M8).**

| Input | Apex above take-off | Apex frame after take-off |
|---|---|---|
| Tap (released before the rise ends) | **45.2 px** (2.8 tiles) | 18 |
| Held 20 f | 61.5 px | 24 |
| Held 25 f | 68.3 px | 28 |
| Held to the apex | **71.7 px** (4.5 tiles) | 33 |

Add 4 frames of squat before take-off.

**SO-15. Ceiling and falling.**
- Hitting a ceiling from below (without gripping it, SO-37) ends the rise and sets `vy = +0.8333` if she jumped; the
  bump sound plays (`Sophia.as:2943-2965`). Not while hovering.
- Fall cap 4.1667 px/f is a clamp (no SMB1 reset).

**SO-16. Springs** (`src/game/entities/objects/spring.ts:21-48`).
- Red springs give her the shared 500 / 1000 Flash px/s launches. The original's spring uses its own values
  (`SpringRed.as:19-20, 61-80`). Sophia's own `defSpringPwr` 400 and `boostSpringPwr` 930 (`Sophia.as:221-222`)
  are read only by the Bouncy Pits cheat (`Character.as:2937-2945`), which is out of scope.
- Green spring boost: add `sophia: flash(3500)` to `SPRING_GREEN_BOOST` (`SpringGreen.as:25-26`).
- Rise gravity: add `sophia: flashAccel(1050)` to `SPRING_RISE_GRAVITY`.
- During a launch her coast hold damping (×0.98851 per frame on upward speed) also applies. Estimates: plain
  ≈ 47 px, red boost ≈ 163 px, green boost far off the top of the screen.
- She cannot hover while standing on a spring.

**SO-17. Wide-body tile rules.** Our AABB code already handles any width in `moveX` and in landing
(`src/game/entities/body.ts:34-88`). These places need Sophia rules:
- **One-tile holes:** she cannot fall into a 1-tile (16 px) hole: her 19 px box always rests on one side. This is
  automatic. She has no small-gap running rule (`canCrossSmallGaps = false`, `Sophia.as:383`).
- **Head bump, every column** (`canHitMultipleBricks = true`, `Sophia.as:386`; `Level.as:2047-2059`): when her head
  meets blocks from below, strike **every** brick or block her box touches that frame, not only one (`body.ts:89-118`
  picks one `bumpCol`). Add `MoveYOptions.bumpAll?: boolean`.
- **Corner slip needs two free tiles:** the head-bump corner slip moves her sideways past a block only when her
  overlap is under 4.5 px (`CORNER_ROUNDING_AMOUNT` 9 Flash px, `HitTester.as:33`) **and both tiles beside the
  block on the slip side** (same row) are empty. Other heroes need one (`HitTester.as:360-365`). Add
  `MoveYOptions.cornerFreeTiles?: 1 | 2`.
- **Pit line:** the original kills her only when her whole box is below the screen bottom (`Character.as:2986`). Ours
  already tests the body top 8 px below the screen (`src/game/world/world.ts:820`). No change.
- **Down pipes:** her 19 px box fits the 32 px mouth test (`world.ts:1538-1540`). No change.

### 5. Swimming

**SO-18. She is a good swimmer with free thrust swimming** (`_isGoodSwimmer = true`, `Sophia.as:382, 693-729,
1695-1752`). She is not one of the six floor jumpers of SW-C2 and does not stroke like SW-C1. Under water (SW-C9's
line, the hitbox top below y = 32 px):

| Rule | Original | Ours |
|---|---|---|
| Off the floor, not in a jump rise | no gravity | no gravity |
| "Up" alone / "down" alone | `vy ∓= 900·dt` | ∓0.125 px/f² (0x00200) |
| Vertical cap | 190 px/s | 1.5833 px/f (0x01955) |
| Neither or both: upward speed | `×0.01^dt` | ×0.92612 per frame |
| Neither or both: downward speed | `×1e-7^dt` | ×0.76441 per frame |
| Neither or both: snap | \|vy\| < 5 px/s → 0 | \|vy\| < 0.04167 → 0 |
| Neither or both: sink | 1 Flash px per update (not scaled by dt) | **+0.5 px per frame**, a position shift, not a speed |
| "Down" pressed while `vy` = 0 off the floor | vy = 100 px/s | vy = +0.8333 px/f |
| Horizontal cap off the floor | 130 px/s; 200 px/s while Jump is held | 1.0833 px/f (0x01155); 1.6667 px/f (0x01AAB) with Jump held |
| Horizontal acceleration and friction | as on land | 0.11111 px/f²; friction only with both held (off the floor) |
| On the floor | `walksSlowUnderWater`, 90 px/s | 0.75 px/f (0x00C00) cap, as SW-C3's floor walk |
| On a wall or ceiling | 80 px/s | 0.6667 px/f (0x00AAB) cap |

- **Jump in water** (from the floor, a wall or a ceiling only): the squat, then a rise at 3.3333 px/f for **65 px**
  (130 Flash px), or **41 px** if "down" is held (`Sophia.as:769-772`). Horizontal cap 1.6667 during the rise. After
  the rise she swims freely. There is no mid-water jump.
- Water gravity (400 Flash px/s², 0.0556 px/f²) exists in the source but never acts: off the floor she has no
  gravity, on the floor she does not fall.

**SO-19. The surface.** In a water level, while upright and touching no wall, her hitbox top cannot go above
y = 32 px: she is held there, upward speed is set to 0, and a jump rise ends (`exitWater` override,
`Sophia.as:1722-1737, 1008-1009`). This matches SW-C9 and SW-C11. Touching a wall, or driving on one, she may rise
above it and leave the water by climbing.

**SO-20. Other water rules.**
- Hover is off in water; entering water ends a hover (`Sophia.as:1707-1708, 1879`).
- Off the floor in water she cannot raise the cannon, so she fires only forward (`Sophia.as:2123`). On the sea
  floor she can.
- No head bumps while swimming (`brickState = BRICK_NONE`, `Sophia.as:950`). In a jump rise she bumps as on land.
- She cannot grip a ceiling while swimming, only during a water jump rise (`Sophia.as:2927`).
- Art: the back wheel becomes a propeller (`water-1`, `water-2`), 60 ms (4 f) per frame up to 1.0833 px/f, else
  30 ms (2 f).

**SO-21. SW-C interplay.** SW-C12's stepping stones (2-2, 7-2) are for bad swimmers. Sophia is a good swimmer, so she
does not get them, exactly as the original's `BadSwimmer` tags say (section 10). SW-C7 (no stomp under water) is moot:
she never stomps.

### 6. Health and power states

**SO-22. Three states, one size** (`Sophia.as:79-91, 1764-1831, 3296-3306`). The state shows only as the hull
colour. TG-21's stored ids are `small`, `big`, `fire`.

| State (id) | Hull | Cannon | Abilities gained |
|---|---|---|---|
| Normal (`small`) | pink `#e44a85` | Normal, 100 | none |
| Hyper (`big`), from a Mushroom | magenta `#e40058` | Hyper, 200 | **Hover**; the hover bar is filled to 8 |
| Crusher (`fire`), from a Flower | red `#b10000` | Crusher, 300 | **Wall Climb, Ceiling Climb, and the Triple Missile** (the default weapon choice, `GameSettings.as:232`) |

- Upgrades follow PS-C2 and PS-C3: a block gives a Mushroom when she is Normal, a Flower otherwise; any power-up
  taken while Normal acts as a Mushroom. PS-C4's power-up freeze applies.
- First Triple Missile: 9 ammo (3 volleys), max 60 (`AMMO_ARR`, `Sophia.as:97`).
- **Repeat Flower** (a Flower, or a Mushroom acting as one, while already Crusher): +12 Triple ammo (or +4 Homing with
  the non-default choice), no freeze (`Sophia.as:1783-1789`, PS-C6).

**SO-23. Taking a hit** (PS-C7, PS-C8, Lose Everything).
- Hit while Crusher or Hyper: she drops straight to **Normal**. She loses the Flower with Crusher, Wall Climb and
  Ceiling Climb, **and** the Mushroom with Hyper and Hover (`Character.as:2054-2067`; `Sophia.as:79-86`).
- **Kept on a hit:** the missile weapon and its ammo (`NEVER_LOSE_UPGRADES`, `Sophia.as:89`).
- Hit while Normal: she dies. So from full power she survives one hit.
- **Death resets everything,** missiles included: the missile weapon is removed and ammo returns to the start values
  (`Character.cleanUp` calls `setAllAmmoToDefault` and `removeAllUpgradesForChar(…, true)`, `Character.as:3109-3116`;
  PS-C21).
- **Hit response** (`takeDamageStart`, `Sophia.as:3312-3337`):
  - On a wall or ceiling, or mid-turn: she **detaches instead of being pushed** (upright, then falls). No push.
  - Otherwise, pushed away from the source: if she was still, vx = ±1.5417 px/f (the original sets ±1000 px/s and
    her 185 cap clamps it); if she was moving, vx = ±0.4167 px/f (50 px/s). No vertical change. She keeps control.
  - Hover ends, a jump rise ends.
  - **Invulnerable for 75 f** (1250 ms, `Character.as:207`).
  - **Looks:** no flicker and no transparency. The hull cycles through three flash palettes every 2 frames
    (33 ms): orange `#f87858` / light orange `#f8b7a6`, dark grey `#7c7c7c` / white, dark green `#00a844` /
    light green `#b8f8d8` (`Sophia.as:129-137`). Black stays black. Add her row to PS-C10.
  - Sound `sophia-hurt`.
- **Death:** her explosion (`playerDieStart`…`playerDieEnd`, 6 frames) replaces the sprite, then PS-C23's shared
  sequence. A pit death plays `sophia-die` with no explosion.

**SO-24. Star** (PS-C18, PS-C19). Star fills the hover bar to 8 (`Sophia.as:1574-1578`), the bar does not drain while
Star lasts (`:3070-3071`), and missiles cost nothing.

**SO-25. Drops** (PS-C15, PS-C16; `RandomDropGenerator.as:33-35`, `Sophia.as:369, 595-619`).
- Chance per roll: **25 %** per enemy killed, **6.25 %** per brick broken, **12.5 %** per coin from a block.
- **She gets drops only while she owns a missile weapon,** and only that weapon's ammo: Triple ammo **+6** (2 volleys,
  `missile-ammo`), or Homing ammo **+2** (`homing-ammo`). With no missile weapon a won roll gives nothing.
- **Shot kills roll twice (source fact).** `Enemy.die` rolls once for every enemy except Bowser (`dropsItems`,
  `Enemy.as:116, 333-336`; `Bowser.as:101-102`). When the killing hit comes from a `SophiaBullet` (her cannon and both
  missiles), `die` also spawns her enemy explosion (`Enemy.as:337-340`). That explosion rolls **again** in its
  `destroy`, when its `enemyDie` animation ends, with itself as the source, so at the 25 % enemy rate
  (`SophiaExplosion.as:65-79`). So a shot kill gets two independent 25 % rolls: at least one drop 43.75 % of the time,
  two drops 6.25 %. The second drop pops out where the enemy died, about 14 f after the kill (7 frames at 2 f). A Star
  contact kill rolls once. Build both rolls (SO-M15).
- Pickups are always taken (PS-C17).

**SO-26. HUD.** PS-C26's power icon and PS-C27's ammo counter (missile icon and count, hidden with no missile). The
hover bar is SO-55.

**SO-27. Level start** refills the hover bar to 8 (`StatManager.as:363-364`).

### 7. Weapons

**SO-28. The cannon** (`SophiaBullet.as:46-175`, `Sophia.as:1938-1961`; damage `DamageValue.as:81-83`).

| Item | Value |
|---|---|
| Damage | Normal **100**, Hyper **200**, Crusher **300** (by state at the moment of firing) |
| Speed | **3.5417 px/f** (0x038AB). The source sets 450 px/s, but `vxMax`/`vyMax` = 425 (`SophiaBullet.as:51-52, 99-100`) clamps every Sophia projectile to 425 px/s. Not 3.75. |
| Cap | 3 cannon shots on screen; missiles do not count (`MAX_BULLETS_ON_SCREEN`, `Sophia.as:261, 1950-1960`) |
| Rate | one shot per Attack press; no cooldown |
| Spawn, forward shot | 6 px ahead of the anchor, 12.5 px above it (`HORZ_X_OFS` 12, `HORZ_Y_OFS` 25) |
| Spawn, raised shot | 4 px behind the anchor, 25 px above it (`UP_X_OFS` 8, `UP_Y_OFS` 50) |
| Armour pierce | 0 |
| Gravity | none; straight line |
| Hit flash on enemies | 400 ms (24 f) (`Sophia.as:362`; HP-C16 `flashFrames: 24`) |
| Sound | `sophia-shoot-normal` / `-hyper` / `-crusher` |

- **Raising the cannon:** "up" pressed shows the diagonal base at once and the base rises over three 50 ms steps, so
  the cannon is up after **9 f** (`MOVE_PARTS_TMR`, `Sophia.as:205, 2120-2130, 3208-3263`). A shot fires away from the
  surface only once the base shows `up`; before that, and from the moment "up" is released, it fires forward.
- **Directions by surface** (`setDir`, `SophiaBullet.as:177-231`): floor and air, forward = left or right, raised =
  straight up. Ceiling: forward along the ceiling (spawned 12.5 px below it), raised = straight down. Wall: forward =
  up or down the wall (the way she faces), raised = straight away from the wall.
- Off the floor in water the cannon cannot be raised (SO-20).
- Not on a vine, not during a surface turn.

**SO-29. What the cannon hits.**
- **Solid ground and lifts:** it explodes (6-frame explosion, `sophia-explode`) and is removed (`HT_GROUND_NON_BRICK`,
  `HT_PLATFORM`, `SophiaBullet.as:93-98, 420-427`). BR-C2 `ground: 'collide'`.
- **Bricks** (BR-C7, BR-C9 `'end'`): Normal 2 shots, Hyper or Crusher 1 shot. A brick already head-bumped needs one
  (BR-C4). The shot ends at the brick.
- **Item blocks** (BR-C8): bumped, whatever the damage; the shot ends.
- **Armoured enemies** (Buzzy Beetle, Bullet Bill; HP-C12): blocked. No damage, the shot explodes
  (`attackObjNonPiercing`, `SophiaBullet.as:370-377`). **Spinies are not armoured.**
- **Fire** (Podoboos, fire bars, flames): cannot be hurt.

**SO-30. Triple Missile (Special; the Crusher weapon)** (`SophiaBullet.as:124-133, 238-265, 292-321, 379-385`;
`Sophia.as:2005-2013`).
- A volley is **three missiles from the cannon's spawn point** (SO-28; forward or raised, by surface):
  - **middle:** straight;
  - **top and bottom:** start with **1.0 px/f** sideways (120 px/s), the top one toward "up" on the floor (toward
    screen left for a raised shot), the bottom one the other way. The sideways speed decays ×0.99152 per frame
    (`0.6^dt`).
- Along the firing axis each starts at **0** and accelerates **0.09722 px/f²** (0x0018E, 700 px/s²) up to
  **3.5417 px/f** (reached after 37 f).
- **400 damage each, armour pierce 10:** they hurt Buzzy Beetles and Bullet Bills (2 missiles for a Beetle, 1 for a
  Bullet Bill). Fire still cannot be hurt (pierce 11). Each missile ends on its first hit (`Projectile.confirmedHit`).
- **Terrain:** they pass through ground, pipes and lifts (no ground test) but **still strike bricks and item blocks**
  (BR-C2 `ground: 'pass'`, `afterBlock: 'end'`): 400 breaks a brick; an item block is bumped. The missile ends there.
- They are removed when they leave the screen.
- **Cap: one volley.** A new volley fires only when none of the three is left (`MAX_MISSILES_ON_SCREEN = 1` counts
  missiles, `Sophia.as:263, 2007`).
- **Cost 3 ammo** per volley. Start 9, max 60. Free during Star.
- Art `missile` with a 3-frame flame; sound `sophia-missile`.

**SO-31. Homing Missile (non-default weapon: built, reached only through `&kit=full`, TG-44)** (`SophiaBullet.as:111-123, 232-237,
267-358, 386-419`; `Sophia.as:1989-2004`).
- **Fires only if** she has ammo, fewer than **4** homing missiles are on screen, and **an enemy is on screen that can be
  hit and is not armoured or fire** (no passive pierce property). Otherwise nothing happens and no ammo is spent.
- Spawns at the cannon's spawn point, **at rest**.
- **Steering, every frame while it has a target:** `thrust += 0.0069444` px/f² (3000 px/s² per second; it starts at 0
  and is never reset); `vx += cos(a) × thrust`, `vy += sin(a) × thrust`, where `a` is the angle to the target's
  centre; then `vx ×= 0.96235`, `vy ×= 0.96235` (`0.1^dt`); then clamp **each axis** to ±3.5417 px/f. Draw it rotated
  to `a`.
- **Target:** the nearest valid enemy on screen. When it dies or leaves the screen, pick a new one. (The original's
  search loop forgets to update the best distance, so it can pick a slightly farther enemy; use the true nearest.)
- **No target:** it stops steering and animating, keeps its last velocity, and explodes after **120 f** (2 s) unless a
  target appears first, which re-activates it. While inactive it is removed if it leaves the screen; while active it
  may leave the screen and come back.
- **Terrain:** none. It passes through ground, lifts, bricks and blocks without touching them.
- **400 damage, armour pierce 0.** If it flies into an armoured enemy on the way, it explodes with no damage (HP-C14).
- **Cost 1.** Start 3, max 20. Pickup +2.

**SO-32. Missile selection and ammo** (`Sophia.as:501-537, 1962-1966`).
- Classic gives only the Triple Missile (the default weapon choice). Homing exists only with the dev full kit
  (TG-44, `devKit`).
- With both owned, **Select** swaps them and plays `sophia-select` (TG-44's Select cycle; with two weapons it is a
  swap). Special fires the selected one. The HUD counter shows the selected one.
- Ammo keys in `p.scratch`: `triple`, `homing`, `hasTriple`, `hasHoming`, `sub` (selected). They carry between levels
  (`carriedKit`).

**SO-33. Shots to kill** (HP-C8, Attack Strength ×1).

| Enemy (HP) | Normal 100 | Hyper 200 | Crusher 300 | Missile 400 |
|---|---|---|---|---|
| Goomba (250) | 3 | 2 | 1 | 1 |
| Piranha Plant (275) | 3 | 2 | 1 | 1 |
| Cheep, swimming (300) / leaping (200) | 3 / 2 | 2 / 1 | 1 / 1 | 1 / 1 |
| Spiny (350, not armoured) | 4 | 2 | 2 | 1 |
| Koopa, Blooper (600) | 6 | 3 | 2 | 2 |
| Hammer Bro, Lakitu (800) | 8 | 4 | 3 | 2 |
| Paratroopa (900) | 9 | 5 | 3 | 3 |
| Buzzy Beetle (600, armoured) | immune | immune | immune | 2 (Triple only) |
| Bullet Bill (400, armoured) | immune | immune | immune | 1 (Triple only) |
| Bowser fire / hammers / both (2400 / 3600 / 4400) | 24 / 36 / 44 | 12 / 18 / 22 | 8 / 12 / 15 | 6 / 9 / 11 |

HP-C6's shell rule applies: a Koopa left at 200 HP or less pulls into its shell.

**SO-34. Kill effect.** An enemy killed by her shots shows her enemy explosion (`enemyDieStart`…`enemyDieEnd`, 7 frames)
instead of the shared defeat animation, with `sophia-kill` (`Enemy.as:339-340`, `SophiaExplosion.as:48-55`). Score is
unchanged (HP-C21).

### 8. Special abilities

**SO-35. Hover (Hyper and up)** (`Sophia.as:94-95, 206-207, 264-265, 961-966, 1624-1659, 1877-1907, 1913-1933,
3059-3083`).
- **Engage:** press Jump while in the air, owning Hover, not on a spring, not under water, with the bar above 0 (or
  Star). It also engages during a wall jump; she then turns upright first.
- **Thrust, every frame while engaged and Jump is held:** `vy −= 0.3333` (40 px/s per update, not scaled by dt), then
  `vy = max(vy, −0.8333)` (100 px/s), then gravity +0.14583. **Steady climb: 0.6875 px/f**, reached in 4 frames from
  rest. (The source's per-update thrust depends on the update rate; SO-M7.)
- **Bar:** 8 cells. While hovering it loses 1 cell every **18 f** (300 ms): 144 f of hover from full. While not
  hovering it gains 1 cell every **120 f** (2 s): 960 f from empty. Each timer pauses and keeps its progress while the
  other runs. At 0 the hover stops as if Jump were released.
- **Release Jump:** thrust stops; upward speed is damped ×0.65564 per frame. Press Jump again to re-engage, any number of
  times until she lands, while the bar lasts.
- **No head bumps and no ceiling grip** from the first engage until she lands (`engagedHover`, `Sophia.as:934-944,
  2927`). Her head still stops at ceilings.
- **Ends on:** landing, entering water, a vine, the flagpole, a pit bounce.
- Fills to 8: Mushroom pickup, level start, Star.
- Art: the wheels show `hoverTrans`, then `hover`; flames alternate big and small every 25 ms (about 2 f). Sound
  `sophia-hover` loops while thrusting.

**SO-36. Wall Climb (Crusher): driving on walls** (`Sophia.as:1127-1563, 2277-2802, 2871-2987`). This is the biggest
part of the build. The model:
- **Surfaces:** floor, left wall, right wall, ceiling. On a wall or ceiling she has no gravity and is "on the ground"
  for friction, jumping and drops. She drives along it with the floor's constants (SO-9): 1.5417 px/f, 0.11111 px/f²,
  friction ×0.89125 when neither direction is held.
- **Box on a wall:** 15.5 × 19 px. On a left wall the box's left edge is on the wall face, centred on her anchor
  height; mirrored for a right wall. On a ceiling the box hangs with its top on the ceiling's underside.
- **Turns.** Each turn is an animation during which she does not move and inputs are locked (SO-8):
  - **Inside corner** (a wall ahead on the floor, a ceiling ahead on a wall, a wall ahead on a ceiling, the floor
    ahead driving down a wall): **12 f** (8 steps of 25 ms).
  - **Outside corner** (driving off an edge and wrapping around it): **14 f** (9 steps).
  - After a turn she is flush on the new surface and **already moving at 1.5417 px/f** in the new direction (0.6667
    in water), so she drives on without stopping (`wallTransEndVx/Vy = ±VX_MAX_DEF`, `Sophia.as:2434-2501`).
  - Inside corner end point: her centre 12 px from the corner along the new surface (`CLIMB_OFS` 24). Outside corner
    end point: her centre 4 px past the edge (`CLIMB_INVERTED_OFS` 8).
- **When a turn starts** (checked every frame on a surface, not during the squat, `checkWallsForClimb`):

  | From | Turn | Trigger |
  |---|---|---|
  | Floor | up a wall ahead (inside) | forward held toward the wall, **Up** held, Down not held; a solid tile in her row within 12 px ahead of her centre; the tile above the free cell next to the wall is empty; her centre more than 10 px from that wall tile's centre |
  | Floor | down a cliff face (outside) | forward held, **Down** held, Up not held; no tile ahead-below at the edge; her centre within 15 px of the edge tile's centre (`MAX_INVERTED_CLIMB_DIST` 30) |
  | Wall | onto a ceiling (inside, driving up) | **Ceiling Climb** owned; forward (up the wall) held; ceiling tile within 12 px ahead |
  | Wall | onto the floor (inside, driving down) | forward (down) held; floor within 12 px ahead. She ends upright and drives away from the wall |
  | Wall | over the top onto the floor (outside, driving up) | forward held at the wall's top edge |
  | Wall | under onto a ceiling (outside, driving down) | **Ceiling Climb** owned; forward held at the wall's bottom edge |
  | Ceiling | down a wall ahead (inside) | forward held; wall within 12 px ahead |
  | Ceiling | up around the end of the ceiling (outside) | forward held at the ceiling's end |

  With forward **not** held at an edge of a wall or ceiling, she **stops at the edge** (speed 0) instead of driving
  off (`Sophia.as:1349-1355, 1550-1557`).
- **Small gaps on walls and ceilings:** a 1-tile gap in the surface she drives along is driven straight across (she is
  wider than it). Holding "down" (into the surface) makes her wrap into the gap instead (`Sophia.as:1320-1357,
  1509-1533`). On the floor, Up held toward a wall with a 1-tile opening at her row treats the opening as wall, so she
  climbs past it (`falseGroundRect`, `Sophia.as:1204-1247, 1405-1457`).
- **Detach when the surface ends:** every frame on a wall or ceiling, three probe points are tested just beyond her
  back (her rear end, middle and front end, one tile outward). If none touches a visible solid tile, she detaches
  (`Sophia.as:1012-1050`).
- **Detaching** (`detachFromWall`, `Sophia.as:2599-2680`): she turns upright at once with the same box centre (from a
  wall, the upright box keeps its edge on the wall face), keeps her speed (capped at 1.5417), and falls.
- **Jump from a wall** ("down", i.e. into the wall, not held): the 4 f squat, then she is pushed **65 px straight away
  from the wall at 3.3333 px/f** with gravity off (`Sophia.as:782-793, 980-993`). During the push, up/down still
  accelerate her along the wall's axis (cap 1.5417). At 65 px she turns upright and falls. **If the push meets another
  wall face** whose near side is open, she grips it at once, with no turn animation (`groundOnSide` →
  `activateAttachToWall`, `Sophia.as:2871-2914, 2277-2331`). That is her wall-to-wall jump.
- **Jump from a ceiling** (Up not held): the squat, then pushed **41 px down at 3.3333 px/f**, then upright.
- **Drop off:** "down" (into the surface) + Jump. If the upright box would not overlap a solid tile, she turns upright
  at once and falls; otherwise nothing happens (`checkDropFromWall`, `Sophia.as:2768-2802`).
- **A hit, a vine, the flagpole or a pit bounce** detaches her (SO-23, SO-43).
- **No head bumps** on walls and ceilings.

**SO-37. Ceiling Climb (Crusher; needs Wall Climb too).**
- **Grip from a jump:** while rising (`vy < 0`), upright, not holding Down, not hovering, and on land or in a water jump
  rise, touching a visible ceiling tile from below grips it at once (no animation). She keeps her horizontal speed and
  drives along it upside down (`groundAbove`, `Sophia.as:2915-2942`).
- **Never grips** ground in the screen's bottom row or ground whose right edge is off the right of the screen
  (`Sophia.as:2342`).
- **A grip does not bump the block.** The grip sets her "on the ground" before the block's own hit runs, and
  `Brick.hitCharacter` ignores a hero on the ground (`HitTester.as:367-368` order, `Brick.as:194-200`). So with
  Ceiling Climb she opens `?` blocks only by **holding Down** while jumping into them. (Inferred from source; SO-M18.)
- On the ceiling the cannon's raised shot fires straight down.

**SO-38. Moving lifts (Phase 3b; SO-M12)** (`Sophia.as:1177-1196, 1385-1393, 2803-2870`).
- With Wall Climb she can wrap from a lift's top onto its sides and underside, and grip its underside from a jump.
- Attached, she rides it: her position follows the lift each frame.
- She detaches if she ends up more than 50 px from the lift (`MAX_PLAT_DIST` 100).
- Falling and pulley lifts behave as for other heroes while she is on their top.

**SO-39. Camera.** A turn moves her anchor by up to about 20 px in one step. Ease the camera so it does not jump: spread
the x change over the turn's frames, then decay any remainder ×0.926 per frame (`screenScrollPosOffset`, ease 5,
friction `0.01^dt`; `Sophia.as:303-308, 835-846, 2503-2516`). The camera's lead x is `world.ts:818`.

**SO-40. No other abilities.** `WALL_JUMP` is declared but unused. The pickup sheet's `thunder`, `thunderAmmo`,
`hoverAmmo` and `power` frames belong to a cut Thunder Break weapon. `revivalBoost` is never called. None of these is
built.

### 9. Interactions

**SO-41. Enemies.** She cannot stomp: landing on an enemy hurts her like any other contact (HP-C22, HP-C23;
`_canStomp` false, `Character.as:338`). Her `bounce` override only runs under the Everyone Can Stomp cheat, which is
out of scope. Star kills on contact (HP-C7).

**SO-42. Bricks and blocks from below.** Airborne, upright, not hovering and not swimming, her head **bumps** every
brick and block it touches that frame (SO-17), **never breaks** a brick in any state (`BRICK_BOUNCER`,
`Sophia.as:940-944`; BR-C3), and leaves bumped bricks at 0 HP (BR-C4). On walls and ceilings, while swimming and after
a hover she does not bump. A ceiling grip does not bump (SO-37).

**SO-43. Pipes, vines, flagpole, springs, axe.**
- **Pipes:** she enters a pipe only while upright and not turning (`Sophia.as:1675-1694`). Our pipe checks run only on
  the floor (`world.ts:1527-1555`); also skip them while she is on a wall, on a ceiling or turning. Our auto-walk
  speed into the end pipe stays shared.
- **Vines:** she uses the shared climb (`player.ts:163`, 130 Flash px/s = 1.0833 px/f, `Character.as:84`). Grabbing a
  vine detaches her and ends hover. She is drawn turned 90° with the nose up; her box stays upright (only her parts
  are rotated, `Sophia.as:3153-3175`).
- **Flagpole:** ends hover, detaches her, shows the level base (`Sophia.as:2249-2261`).
- **Springs:** SO-16.
- **Castle axe:** after taking the axe in any x-4 castle, her floor friction becomes ×0.76441 per frame
  (`FX_DUNGEON_GOT_AXE` 1e-7, `DUNGEON_LEVEL_NUM` = 4; `Sophia.as:3264-3269`, `StatManager.as:104`). She stops faster
  for the scene.

**SO-44. Bowser.** No special case. His HP follows HP-C4 for a non-Mario hero (SO-33).

### 10. Level data needs

**SO-45. The original builds every level per hero.** `Level.as:779-791` hides or shows each map token by four
hero-flag properties:
- `charHorz=Hide|Show` and `charVert=Hide|Show` (`determineHelperVisibility`, `Level.as:676-693`): `Hide` hides the
  token from heroes who use that flag; `Show` shows it only to them; a token with both `Show` values shows if the hero
  uses either.
- `BadSwimmer=Hide|Show`: `Hide` hides it from bad swimmers, `Show` shows it only to them (`getPropertyVisibility`,
  `Level.as:666-674`).
- `WideCharacter=Hide|Show`: the same for wide heroes. **Only Sophia is wide.**
- `poorBowserFighter`: shown only to Simon and Ryu.

Sophia uses `horz`, `vert` and `wide` and is a good swimmer (`Sophia.as:379-382`). So for her: every `charHorz`,
`charVert` and `WideCharacter` `Show` token appears and every `Hide` token disappears; `BadSwimmer` tokens look exactly
as they do for Mario.

**SO-46. Token counts per level** (`$S/orig/assets/documents/levelDataSmb.xml` and `levelDataLostLevels.xml`; script
`$S/classic/sophia-work/table.py`). Each cell counts flag occurrences on tokens (a token with two flags counts twice).
"All" is every difficulty layer; "On Normal" excludes tokens with `normal` in `HideOnDifficulties`, the only layer we
convert.

SMB (27 of 32 levels have tokens):

| Level | Wide Hide | Wide Show | Horz Hide | Horz Show | Vert Hide | Vert Show | BadSw Hide | BadSw Show | All | On Normal |
|---|---|---|---|---|---|---|---|---|---|---|
| 1-1 |  |  |  | 2 |  |  |  |  | 2 | 1 |
| 1-2 |  |  |  | 2 |  |  |  |  | 2 | 1 |
| 1-3 |  |  |  | 2 |  |  |  |  | 2 | 1 |
| 2-1 |  |  |  | 1 |  |  |  |  | 1 | 1 |
| 2-2 |  |  |  | 2 |  |  | 3 | 10 | 15 | 14 |
| 2-3 |  |  |  | 4 |  |  |  |  | 4 | 3 |
| 3-1 |  |  |  | 1 |  |  |  |  | 1 | 1 |
| 3-2 |  |  |  | 1 |  |  |  |  | 1 | 1 |
| 3-3 |  |  |  | 5 |  |  |  |  | 5 | 5 |
| 3-4 |  |  | 2 | 2 |  |  |  |  | 4 | 4 |
| 4-1 |  |  |  | 1 |  |  |  |  | 1 | 1 |
| 4-2 |  |  | 4 | 11 |  |  |  |  | 15 | 6 |
| 4-3 |  |  |  | 1 |  | 10 |  |  | 11 | 11 |
| 4-4 | 2 |  |  |  |  |  |  |  | 2 | 2 |
| 5-1 |  |  |  | 2 |  |  |  |  | 2 | 1 |
| 5-2 |  |  |  | 1 |  |  |  |  | 1 | 1 |
| 5-3 |  |  |  | 1 |  |  |  |  | 1 | 1 |
| 6-1 |  |  |  | 1 |  |  |  |  | 1 | 1 |
| 6-2 |  |  |  | 26 |  |  |  |  | 26 | 18 |
| 6-3 |  |  |  | 3 |  |  |  |  | 3 | 2 |
| 7-1 |  |  |  | 1 | 4 | 4 |  |  | 9 | 7 |
| 7-2 |  |  |  | 2 |  |  | 3 | 12 | 17 | 16 |
| 7-3 |  |  |  | 4 |  |  |  |  | 4 | 3 |
| 8-1 |  |  |  | 8 |  |  |  |  | 8 | 7 |
| 8-2 |  |  |  | 3 |  |  |  |  | 3 | 3 |
| 8-3 |  |  |  | 2 |  |  |  |  | 2 | 1 |
| 8-4 |  |  |  |  | 2 | 2 |  |  | 4 | 4 |
| **Total** | **2** | **0** | **6** | **89** | **6** | **16** | **6** | **22** | **147** | **117** |

The Lost Levels (52 of 52 levels have tokens):

| Level | Wide Hide | Wide Show | Horz Hide | Horz Show | Vert Hide | Vert Show | BadSw Hide | BadSw Show | All | On Normal |
|---|---|---|---|---|---|---|---|---|---|---|
| ll-1-1 |  |  |  | 2 |  |  |  |  | 2 | 1 |
| ll-1-2 | 6 | 2 | 8 | 18 |  | 1 |  |  | 35 | 26 |
| ll-1-3 |  |  | 23 | 59 |  |  |  |  | 82 | 61 |
| ll-1-4 |  |  | 2 | 10 | 1 | 1 |  |  | 14 | 6 |
| ll-2-1 |  |  | 11 | 33 |  |  |  |  | 44 | 41 |
| ll-2-2 | 2 | 1 | 2 | 24 | 14 | 14 |  |  | 57 | 32 |
| ll-2-3 |  |  |  | 14 |  |  |  |  | 14 | 7 |
| ll-2-4 | 16 | 2 | 6 | 6 | 1 | 1 |  |  | 32 | 31 |
| ll-3-1 |  |  |  | 2 | 12 | 10 |  |  | 24 | 21 |
| ll-3-2 | 1 |  |  | 2 |  |  | 2 | 36 | 41 | 14 |
| ll-3-3 |  |  | 1 | 24 | 18 | 13 |  |  | 56 | 45 |
| ll-3-4 | 20 |  | 18 | 28 | 28 | 18 |  |  | 112 | 38 |
| ll-4-1 |  |  | 14 | 12 | 4 | 4 | 26 | 37 | 97 | 29 |
| ll-4-2 |  |  |  | 1 | 14 | 12 |  |  | 27 | 21 |
| ll-4-3 |  |  |  | 29 |  | 2 |  |  | 31 | 28 |
| ll-4-4 | 3 | 2 | 2 | 5 |  |  |  |  | 12 | 12 |
| ll-5-1 |  |  | 52 | 161 | 15 | 13 |  |  | 241 | 221 |
| ll-5-2 | 3 | 1 |  | 4 | 14 | 13 |  |  | 35 | 28 |
| ll-5-3 |  |  | 11 | 39 |  | 2 |  |  | 52 | 45 |
| ll-5-4 | 4 | 2 | 8 | 12 |  |  |  |  | 26 | 25 |
| ll-6-1 | 2 | 1 | 12 | 15 | 1 | 1 |  | 20 | 52 | 35 |
| ll-6-2 | 1 |  |  | 2 |  |  | 8 | 13 | 24 | 14 |
| ll-6-3 |  |  |  | 20 |  | 10 |  |  | 30 | 25 |
| ll-6-4 |  |  | 10 | 35 |  |  |  |  | 45 | 18 |
| ll-7-1 |  |  |  | 26 |  | 1 |  |  | 27 | 25 |
| ll-7-2 |  |  |  | 1 | 2 | 4 |  |  | 7 | 7 |
| ll-7-3 |  |  | 1 | 8 |  | 2 |  |  | 11 | 8 |
| ll-7-4 | 8 |  | 2 | 7 |  |  | 6 | 6 | 29 | 29 |
| ll-8-1 |  |  | 4 | 14 | 4 | 12 |  | 12 | 46 | 29 |
| ll-8-2 |  |  | 11 | 19 |  |  |  |  | 30 | 24 |
| ll-8-3 | 9 | 6 | 6 | 17 | 12 | 16 |  |  | 66 | 42 |
| ll-8-4 |  |  | 18 | 30 |  |  |  |  | 48 | 40 |
| ll-9-1 |  |  |  | 4 |  |  |  |  | 4 | 4 |
| ll-9-2 |  |  |  |  |  |  | 4 | 24 | 28 | 20 |
| ll-9-3 |  |  |  | 1 | 4 | 4 |  |  | 9 | 5 |
| ll-9-4 |  |  |  |  | 2 | 5 |  | 3 | 10 | 7 |
| ll-10-1 |  |  |  | 6 |  |  |  |  | 6 | 4 |
| ll-10-2 |  |  |  | 2 |  |  |  |  | 2 | 1 |
| ll-10-3 |  |  | 2 | 14 |  |  |  |  | 16 | 10 |
| ll-10-4 |  |  | 10 | 12 |  |  |  |  | 22 | 21 |
| ll-11-1 | 1 | 1 | 20 | 27 | 8 | 8 |  |  | 65 | 49 |
| ll-11-2 |  |  |  | 2 | 2 |  |  | 21 | 25 | 15 |
| ll-11-3 |  |  | 1 | 46 | 3 | 5 |  |  | 55 | 54 |
| ll-11-4 | 34 | 4 | 6 | 7 | 1 | 1 | 1 | 1 | 55 | 44 |
| ll-12-1 |  |  |  | 12 | 1 | 1 |  |  | 14 | 13 |
| ll-12-2 |  |  | 1 | 48 |  | 3 |  |  | 52 | 40 |
| ll-12-3 |  |  |  | 14 |  | 1 |  |  | 15 | 13 |
| ll-12-4 | 8 |  | 6 | 8 | 3 |  | 6 | 6 | 37 | 34 |
| ll-13-1 |  |  | 1 | 6 |  |  |  |  | 7 | 4 |
| ll-13-2 |  |  |  | 12 |  |  |  |  | 12 | 3 |
| ll-13-3 | 1 | 1 |  | 2 |  |  |  |  | 4 | 3 |
| ll-13-4 | 11 | 3 | 102 | 105 | 38 | 51 | 1 | 1 | 312 | 165 |
| **Total** | **130** | **26** | **371** | **1007** | **202** | **229** | **54** | **180** | **2199** | **1580** |

- On the normal layer: SMB has 2 `WideCharacter=Hide` (4-4 only); the Lost Levels have 99 `Hide` and 16 `Show`, in
  ll-2-4, 3-2, 3-4, 4-4, 5-4, 6-1, 6-2, 7-4, 11-1, 11-4, 12-4, 13-3 and 13-4.
- **What the `WideCharacter` edits do:** they widen 1-tile shafts and drops to 2 tiles, or swap a pillar for lava or a
  block for a coin, so a 19 px tank fits. Examples: 4-4 removes the floor pieces at (161, 10) and (225, 10) next to
  1-tile drops at columns 160 and 224; ll-2-4 removes the column at x = 25 (rows 3-9) and turns (25, 13) into lava;
  ll-12-4 column 30 gives "a 2-tile shaft" (noted in `2026-10-05-ll-12-4-lava-lift-never-reaches-drop-shaft.md`).
- The `charHorz=Show` tokens add help: for example a falling lift near the flagpole in most SMB levels
  (1-1 adds `lift-fall 193 4`), and ground under 6-2's gaps.

**SO-47. What our converter does today, and what it must emit instead.**
- **Today:** `helperOnly` (`tools/levelgen/convert-smbc.mjs:70-80`) returns true for any `Show` value of the four flags
  and for `poorBowserFighter`, and the area loop skips those tokens (`:482-486`, logged as `name(helper)`). `Hide`
  tokens are kept. So every map we ship is the Mario/Luigi build. A run with the original XML reproduces all 110 Lost
  Levels maps and 55 of the 61 SMB maps byte for byte (the other 6 were hand-edited since).
- **Required:**
  1. Replace `helperOnly` with `visibleFor(params, flags)` that implements `Level.as:779-791` exactly:

     ```js
     function visibleFor(p, f) {            // f: { horz, vert, wide, goodSwimmer, poorBowser }
       if (p.charHorz === 'Hide' && f.horz) return false;
       if (p.charVert === 'Hide' && f.vert) return false;
       const sh = p.charHorz === 'Show', sv = p.charVert === 'Show';
       if (sh && sv ? !(f.horz || f.vert) : sv ? !f.vert : sh ? !f.horz : false) return false;
       if (p.BadSwimmer === (f.goodSwimmer ? 'Show' : 'Hide')) return false;
       if (p.WideCharacter === (f.wide ? 'Hide' : 'Show')) return false;
       if (p.poorBowserFighter !== undefined && !f.poorBowser) return false;
       return true;
     }
     ```

     With `f = { goodSwimmer: true }` it equals today's `helperOnly` (checked: the output is identical for all 171
     areas).
  2. Convert each area twice: once with `{ goodSwimmer: true }` (the `[tiles]`, `[entities]` and `[zones]` written
     today, **unchanged**) and once with Sophia's flags `{ horz, vert, wide, goodSwimmer }`.
  3. Write the difference **into a generated table, never into the `.map` files** (TG-45's per-rules level-variant
     mechanism, the one SW-C12's coral stones use): `src/game/rules/classic-level-variants.ts`, keyed by flag key, then
     by area id, one entry per area that differs:

     ```ts
     // Generated by tools/levelgen/convert-smbc.mjs --variants=wide+horz+vert. Do not edit.
     export const CLASSIC_LEVEL_VARIANTS: Record<string, Record<string, AreaVariant>> = {
       'wide+horz+vert': {
         '1-1': { addEntities: ['lift-fall 193 4 len=2 dx=8'] },
         '4-4': { tiles: [[161, 10, '.'], [225, 10, '.']] },
         'll-8-3': { addZones: ['vine 98 9 -> ll-8-3-sky 4 14'], removeZones: ['vine 98 8 -> ll-8-3-sky 4 14'] },
       },
     };
     ```

     `tiles` are `[x, y, tile]` with the map's tile characters. Entity and zone strings use the `.map` file's own line
     syntax, so the World parses them with the line parsers `textmap.ts` already uses for `[entities]` and `[zones]`
     (export them if they are private). The flag key is the sorted `+`-joined set of the true flags other than
     `goodSwimmer` (written `badSwimmer` when false). Take `--variants=wide+horz+vert` on the command line (default:
     just that one) so other profiles can be added later without code changes (SO-49).
  4. The `.map` files the converter writes stay byte-identical to today's. Log `variants: N cells, +E/−E entities`
     per area, separately from the "N tile cells differ" count.
- **Size of the change** (prototype run in scratch, `$S/classic/sophia-work/conv/`): **92 areas** get a table
  entry. SMB: 28 areas, 58 tile cells, 24 entities added. Lost Levels: 64 areas, 1125 tile cells, 80 entities added
  and 36 removed (mostly moved), 1 zone moved (ll-8-3's vine block). Per area (cells, then entities +added/−removed
  where any):
  - SMB: 1-1 0 +1; 1-2-exit 0 +1; 1-3 0 +1; 2-1 0 +1; 2-2-exit 0 +1; 2-3 2 +1; 3-1 0 +1; 3-2 0 +1; 3-3 4 +1; 3-4 2;
    4-1 0 +1; 4-2 5; 4-2-exit 0 +1; 4-3 10 +1; 4-4 2; 5-1 0 +1; 5-2 0 +1; 5-3 0 +1; 6-1 0 +1; 6-2 14 +1; 6-3 1 +1;
    7-1 6 +1; 7-2-exit 0 +1; 7-3 2 +1; 8-1 6 +1; 8-2 2 +1; 8-3 0 +1; 8-4-end 2.
  - Lost Levels: ll-1-1 0 +1; 1-2 9 +5/−4; 1-2-exit 0 +1; 1-2-under 0 +1/−1; 1-2-warp 2; 1-3 59 +1; 1-4 6;
    2-1 29 +2/−1; 2-2 31 +1; 2-3 6 +1; 2-4 21 +1/−1; 3-1 4 +2/−1; 3-2 1; 3-2-exit 0 +1; 3-3 40 +2/−1; 3-4 34;
    4-1 19 +1; 4-2 4 +2/−1; 4-3 27 +1; 4-4 8 +1/−1; 5-1 204 +2/−1; 5-2 5 +1/−1; 5-2-exit 0 +1; 5-2-warp 2;
    5-3 40 +3/−2; 5-4 17 +2/−2; 6-1 17 +2/−1; 6-2 1; 6-2-exit 0 +1; 6-3 13 +1; 6-4 14; 7-1 19 +1; 7-2 6 +1;
    7-3 5 +2/−1; 7-4 15; 8-1 8 +5/−4; 8-2 10; 8-2-warp 10 +1; 8-3 21 +6/−5 (zone moved); 8-4 19 +2/−1;
    8-4-end2 0 +3; 8-4-end3 0 +1; 9-1 4; 9-3 4 +1; 9-4 5 +1/−1; 10-1 4; 10-2-exit 0 +1; 10-3 10; 10-4 14 +1;
    11-1 42 +4/−3; 11-2 2; 11-2-exit 0 +1; 11-3 51 +2/−1; 11-4 32; 12-1 12 +1; 12-2 36 +1; 12-3 12 +1; 12-4 19;
    13-1 3 +1; 13-2 2 +1; 13-3 2 +1; 13-4 14 +3/−1; 13-4-end 41 +1/−1; 13-4-exit 90.
- The Special map pack (`levelDataSpecial.xml`) is not in our game and is not converted.

**SO-48. Applying the variants (TG-45).**
- Apply them in the same World step as TG-45: once, when a World builds its tile map at a level or area load
  (`world.ts:277-319`), only when `this.rules === 'classic'` and **any** player's def has `levelFlags` whose key
  matches a table entry (Sophia: `wide+horz+vert`). Set the tiles, add and remove the entities and zones, before the
  area's entities spawn. Do the same on every area load and respawn. Default for co-op: SO-M11.
- The `.map` files, `textmap.ts` and `schema.ts` do not change. Under Current (and with dev mode off) nothing reads
  the table, so TG-36's tile-map hash is unchanged.
- `levels.test.ts` and the level select read the maps exactly as today, so every Current test stays green.
- SW-C12's coral stones stay in `src/game/rules/classic-water.ts` (TG-45); both tables go through this one load step.

**SO-49. Other heroes are not changed by this report.** The original also gives Samus, Simon, Mega Man (`horz`), Link,
Ryu and Bill (`horz` + `vert`) their own variants, poor swimmers the `BadSwimmer` ones, and Simon and Ryu
`poorBowserFighter`. The brief keeps levels as they are for them, and SW-C12 already hand-places the 2-2 and 7-2
stepping stones. The `--variants` option makes their profiles a one-line addition if the owner wants them (SO-M10).

### 11. Sprites and sound

**SO-50. Frames needed.** SWF labels from `smbc3.swf` (script `$S/chars/work-sj/py/sophia.py`). Sizes are measured on
the extracted sheet `$S/chars/shots/missing-sophia-jason/skins/sophia_000.png`, whose pixels are our px (approximate).
She is drawn from three parts: a base (hull and cannon) and two wheels.

| Part (SWF symbol) | Labels | Count | Size (about) | Notes |
|---|---|---|---|---|
| Base (`SophiaBaseMc`, 185) | `horz`, `turnStart`, `turn-2`, `turnEnd`, `diag`, `up`, `open` | 7 | 26 × 16 (`horz`); `diag` 25 × 24; `up` 21 × 26 | turn 60 ms (4 f) per frame; `open` is the select-screen hatch |
| Front and back wheel (`SophiaFrontWheelMc` 186, `SophiaBackWheelMc` 153) | `start`, `roll-1`, `roll-3`, `roll-4`, `end`, `water-1`, `water-2`, `hoverTrans`, `hover`, `hoverBigFlame`, `hoverSmallFlame` | 11 each | 8 × 8; flame frames about 6-10 × 10-16 | roll delay by speed: 100 ms (6 f) below 0.333 px/f, 70 ms (4 f) below 1.0 px/f, else 45 ms (3 f); the back wheel runs one frame behind the front; flames are not recoloured |
| Whole tank (`SophiaMc`, 187) | `main`; `wallTransStart`, `wallTrans-2`…`-7`, `wallTransEnd` (8); `wallTransInvStart`, `wallTransInv-2`…`-8`, `wallTransInvEnd` (9); `vineTrans*`, `climbVine` (unused by the code) | 1 + 8 + 9 | about 26 × 20 assembled | the turn frames show the tank rotating through the corner |
| Shots (`SophiaBulletMc`, 241) | `normalStart`…`normalEnd` (3); `missile`; `missileFlameStart`…`End` (3); `hyperStart`; `crusherStart`…`crusherEnd` (4) | 12 | normal about 8 × 6; missile about 16 × 6 | Crusher shots also flash every 2 f |
| Explosions (`SophiaExplosionMc`, 253) | `bulletExplode` (6), `enemyDie` (7), `playerDie` (6) | 19 | 16 × 16 to 24 × 24; death up to 64 × 47 | fast timer, 33 ms (2 f) per frame |
| Pickups (`SophiaPickupMc`, 251) | Classic needs `missileAmmo` and `homingMissileAmmo` | 2 | 16 × 16 | the other 11 labels are Modern or cut |
| Icons (`SophiaIconMc`, 282) | `portrait`, `missile`, `homingMissile` (HUD); `hyper`, `crusher`, `hover`, `wallClimb`, `ceilingClimb` (optional) | 3-8 | 16 × 16; portrait 23 × 23 | |
| Hover bar (`SophiaHoverBarMc`, 260) | 9 frames: 0-8 cells | 9 | 8 × 32 | SO-55 |
| Jason (`JasonMc`, 105) | `stand`, `walk` | 2 | about 10 × 16 | select screen only (Phase 4) |

Part offsets (ours, from the anchor; `Sophia.as:243-260`): wheels at x = ±8 px, y = −4 px, dropping to y = 0 in a jump,
tucking in to ±5 px while the cannon is up; base at y = −2 px, bobbing 1 px on the suspension while driving (150, 125
or 100 ms by speed), up to −8 px when the cannon is raised.

**SO-51. Rotation.** Our renderer only flips (`src/engine/gfx/renderer.ts:43-50`); `SpriteSpec` has no rotation
(`character.ts:24-32`). Add an optional `rotate?: 0 | 90 | 180 | 270` to `SpriteSpec` and to `Renderer.sprite`
(canvas `rotate`; the headless renderer ignores it). 180° can also be flipX + flipY. The turn animations can use one 45°
frame per direction, or snap at the midpoint (SO-M2).

**SO-52. Palettes.** Three hull palettes (pink, magenta, red, SO-22), white and black fixed. Three flash palettes for
invulnerability (SO-23). Star uses the shared Star cycle.

**SO-53. Minimum testable art (Phase 1).** One 26 × 16 base drawn from simple shapes (hull, cockpit, cannon), its `up`
variant (cannon vertical), and two 8 × 8 wheel frames. Recolour per state. No turn frames: snap the rotation. A 4 × 4
shot dot. Reuse the shared explosion for now.

**SO-54. Sounds** (`SoundNames.as:238-252`; the original plays Blaster Master NES effects). Add MML entries to
`src/content/sfx/sfx.ts`; until written, map them to existing ids:

| New id | Original | Placeholder |
|---|---|---|
| `sophia-jump` | `SophiaJump` | `jump-big` |
| `sophia-land` | `SophiaLand` | `bump` (quiet) |
| `sophia-shoot-normal`, `-hyper`, `-crusher` | `SophiaShootNormal` / `Hyper` / `Crusher` | `fireball` |
| `sophia-missile` | `SophiaMissile` | `fireball` |
| `sophia-explode` | `SophiaBulletExplode` | `bump` |
| `sophia-hit-enemy` | `SophiaHitEnemy` (a hit that does not kill) | `bump` |
| `sophia-kill` | `SophiaKillEnemy` | `stomp` |
| `sophia-hover` (loop) | `SophiaHover` | `swim` repeated |
| `sophia-hurt` | `SophiaTakeDamage` | `pipe` |
| `sophia-die` | `SophiaDie` | the shared death sound |
| `sophia-select` | `SophiaSelectWeapon` | `select` |
| `sophia-pickup` | `SophiaGetPickup` | `coin` |
| `sophia-open` | `SophiaOpen` (Jason, select screen) | `pipe` |

No music override: she plays our level music (SO-M6).

**SO-55. HUD meter.** `meter(p)` returns `{ value: cells, max: 8, colour: '#e40058', label: 'H' }` while she owns
Hover, else null. The original draws it at (15, 50) px, a vertical 8-cell bar.

### 12. Guide text

**SO-56. `src/game/characters/sophia/guide.ts`** (TG-22, TG-40):

```ts
export const SOPHIA_GUIDE: CharacterGuide = {
  tagline: 'Tank that climbs walls and ceilings',
  controls: [
    { action: 'left/right', does: 'Drive. No run. She keeps her speed in the air.' },
    { action: 'jump', does: 'A short squat, then a fixed jump. Hold for higher. In the air with the hover: hover.' },
    { action: 'attack', touch: 'SHOOT', does: 'Fire the cannon, three shots at a time. Two shots break a brick.' },
    { action: 'up+attack', touch: 'SHOOT', does: 'Raise the cannon and fire straight up.' },
    { action: 'special', touch: 'MISSILE', does: 'Fire three missiles. They fly through walls and pierce armour.' },
    { action: 'up', does: 'With the wall climb, drive into a wall to climb it. On walls the keys follow the wall.' },
    { action: 'down', does: 'With the wall climb, drive off a ledge to wrap down its side.' },
    { action: 'down+jump', does: 'On a wall or ceiling: let go.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Hyper cannon and the hover. A hit takes everything back.' },
    { item: 'flower', does: 'Crusher cannon, wall and ceiling climbing, and missiles. Another flower gives more missiles.' },
    { item: 'star', does: 'Invincible, free missiles and a full hover bar.' },
    { item: 'drops', does: 'Missile ammo, once you have missiles.' },
  ],
  tips: [
    'She cannot stomp. Shoot enemies instead.',
    'Jump into a ceiling to grab it. Hold down to bump blocks instead.',
    'Under water, up and down steer freely. Hold jump to go faster.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack'],
};
```

"down+jump" is the guide's name for "into the surface + Jump" on a wall or ceiling (SO-6). Wording is for the owner to
approve (SO-M16).

### 13. Build steps

**SO-57. Prerequisites** (all paths in `$S/main`): the toggle with `CLASSIC_EXTRAS` and the second select row
(TG-1 to TG-45; TG-45 is the level-variant load step); PS-C's `src/game/characters/classic/power.ts`; HP-C's numeric damage with `pierce`; BR-C's
`strikeBlock` damage and the `classicBlocks` spec field; SW-C9's surface line; ML-C's constant-rise jump fields.

**SO-58. Phase 1: a playable test version (driving, jump, cannon).** Goal: `?dev=1&rules=classic&level=1-1&char=sophia`
plays 1-1 to 1-3 on the floor.
1. `src/game/characters/profile.ts`: optional `mode?: 'sophia'`; jump fields `holdDamping?` and `takeoffDelay?` if
   ML-C's model does not have them yet.
2. `src/game/entities/player.ts`: the one delegation line after the vine check (SO-10). Nothing else.
3. `src/game/entities/body.ts`: `MoveYOptions.bumpAll` and `cornerFreeTiles` (SO-17), default off.
4. `src/game/characters/sophia/profile.ts` (SO-9 constants), `drive.ts` (SO-10 to SO-15, floor and air only).
5. `src/game/characters/sophia/classic-weapons.ts`: the cannon spec (SO-28, SO-29).
6. `src/game/characters/sophia/classic.ts` (SO-2): power states via PS-C (SO-22, SO-23), `stomps: false`,
   `canBreakBricks: () => false`; `guide.ts` (short).
7. `src/content/sprites/sophia.ts` (SO-53 placeholder art, three hull palettes) and its registration in
   `src/content/sprites/index.ts`.
8. `src/game/characters/registry.ts`: `CLASSIC_EXTRAS` gets `SOPHIA_CLASSIC` after Bass (TG-41).
9. Tests: `tests/sim/sophia-classic.test.ts`, Phase 1 checks in Acceptance checks.

**SO-59. Phase 2: the rest of the floor game.**
1. Level variants (SO-45 to SO-48): `tools/levelgen/convert-smbc.mjs` (`visibleFor`, the `--variants` table output),
   the generated `src/game/rules/classic-level-variants.ts`, and the TG-45 load step in `src/game/world/world.ts`.
   The `.map` files are not regenerated.
2. `src/game/characters/character.ts`: `levelFlags` (SO-5).
3. Water (SO-18 to SO-21) in `drive.ts`.
4. Hover (SO-35) with `meter` (SO-55).
5. Triple Missile (SO-30, SO-32), ammo in `p.scratch`, drops (SO-25), repeat Flower (SO-22).
6. `src/game/entities/objects/spring.ts`: the `sophia` entries (SO-16). Pipes, flagpole and axe rules (SO-43). Kill and
   death explosions (SO-34, SO-23).

**SO-60. Phase 3: Wall Climb and Ceiling Climb.**
1. `src/game/characters/sophia/surface.ts`: the surface state (floor, left, right, ceiling), the input remap (SO-6),
   the box swap (SO-3), the turn table and timers (SO-36), detach, wall jump, drop, ceiling grip (SO-37). Port
   `Sophia.as:1127-1563, 2277-2802, 2871-2987` with tile queries 1:1 (Flash px ÷ 2, `TILE_SIZE` 32 → 16).
2. Head-bump and pipe rules while not upright (SO-42, SO-43).
3. `src/engine/gfx/renderer.ts` and `SpriteSpec`: rotation (SO-51); rotated art.
4. Camera easing (SO-39) at `world.ts:818`.
5. Phase 3b: lifts (SO-38).

**SO-61. Phase 4: polish.** Homing Missile (SO-31; required, reached through `&kit=full`, TG-44); Select swap; the select-screen hatch and
Jason hop (SO-62); final art and sounds (SO-50, SO-54); full guide.

**SO-62. Jason on the select screen (optional, Phase 4).** When Sophia is chosen: the base shows `open`, and Jason
appears 10 px above her anchor with `vy = −1.25 px/f` (150 px/s) and gravity 0.14583 px/f², shown as `walk` in the
air and `stand` once he lands, drawn in front of the tank; sound `sophia-open` (`Jason.as:10-35`,
`CharacterSelect.as:171-177`). He has no other role.

### Missing information to fill in

| ID | Gap | Suggested default | Decides |
|---|---|---|---|
| SO-M1 | All of Sophia's art (SO-50): base, wheels, turn frames, shots, missiles, explosions, hover flames, propellers, icons, hover bar, Jason | SO-53 placeholder shapes until drawn | owner (art) |
| SO-M2 | The 8 + 9 turn frames, which the source keeps only in the SWF | snap from the old surface to the new one at the turn's midpoint (frame 6 of 12, 7 of 14) | coder; owner approves |
| SO-M3 | Her box during a turn (each SWF turn frame may move the hit rectangle) | keep the old surface's box until the turn ends, then place the new one | coder |
| SO-M4 | 15.5 px box height is not a whole pixel | 15.5 (3968 subpixels); 15 only if something breaks | coder |
| SO-M5 | The 15 sound effects (SO-54) | the placeholders in SO-54 | owner |
| SO-M6 | Music: the original plays Blaster Master tracks for her (`MusicInfo.as:1244-1262`) and Mega Man's hurry/win jingles | no `music` override | owner |
| SO-M7 | Update rate: the original's loop timer is 1000/60 ms (`Level.as:147`) but the stage is locked to 30 fps by default (`GameSettings.as:79-80, 99`). Hover thrust and the water sink are per update, not per second | 60 updates a second, as BA-M8 and every other Classic report (hover 0.6875 px/f, sink 0.5 px/f) | coder |
| SO-M8 | Jump heights and timings are a re-simulation (SO-14) | as specified; one playtest of the original (tap and hold beside a pipe) | owner |
| SO-M9 | Which missile is selected first under `&kit=full`. The original's choice comes from Customize Weapons (out of scope); the Homing Missile itself is built and reached through `&kit=full` (TG-44) | the Triple Missile, the Classic default | coder |
| SO-M10 | Level variants for the other Classic heroes (`horz`, `vert`, `BadSwimmer`, `poorBowserFighter`) | Sophia only; SW-C12 stays | owner |
| SO-M11 | Co-op: the original is one player, its level is built for that hero | apply Sophia's variant when either player is Sophia | owner |
| SO-M12 | Gripping and riding lifts (SO-38) is intricate | build last (Phase 3b); she may simply fall off lift edges until then | owner |
| SO-M13 | Dialogue name "Jason" and the ending's thank-you line | keep our shared castle text | owner |
| SO-M14 | Exact NES colours for hull and flash palettes in our palette table | the hex values in SO-22 and SO-23, nearest NES entries | coder |
| SO-M15 | The second drop roll on shot kills (SO-25) is in the source, but it looks like a side effect of the explosion class rather than a design choice | follow the source: two rolls | owner |
| SO-M16 | Guide wording and touch labels (SO-56) | as written | owner approves |
| SO-M17 | Slot on the second row | after Bass (TG-41 order) | owner |
| SO-M18 | Ceiling grip suppressing the block bump (SO-37) is read from hit order, not played | as specified | owner (playtest) |

## Actual

- We have no Sophia and no Jason. `characterById('sophia')` returns Mario (`src/game/characters/registry.ts:14-16`);
  grep finds no "sophia", "jason" or "blaster" under `src/`.
- Every body is an axis-aligned box with one gravity direction (`src/game/entities/body.ts:5-14`). The nearest thing to
  wall driving is Ryu's cling, which only freezes him on a wall (`src/game/entities/player.ts:81-83, 207-216, 237-240`).
- Jumps are an impulse plus hold and fall gravity (`profile.ts:6-17`); there is no squat, no constant rise and no
  hover.
- A head bump strikes one block (`body.ts:89-118`), and the corner slip needs one free tile.
- Swimming is the shared stroke model (`player.ts:12-16, 295-345`).
- Projectiles have no acceleration, no growing-thrust homing and no "through ground but not bricks" mode
  (`src/game/entities/projectiles/projectile.ts:11-56, 225-277`).
- The renderer only flips (`src/engine/gfx/renderer.ts:43-50`).
- The converter drops every `Show` helper token and keeps every `Hide` token (`tools/levelgen/convert-smbc.mjs:70-80,
  482-486`), so a 19 px tank would meet 1-tile drops it cannot fit through (4-4, many Lost Levels castles).
- The map parser rejects unknown sections (`src/game/level/textmap.ts:68-79`).

## How often

every time

## Notes

- **Sources.**
  - Sophia (`$S/orig/src/com/smbc/characters/Sophia.as`, converted copy `$S/chars/work-sj/Sophia.as`): constants
    94-98, 189-273; flags 369-386; `setStats` 426-499; sub-weapon 501-537; drops 595-619; `movePlayer` 634-732; `jump`
    739-809; `bounce` 824-831; `checkState` 833-1053 (hover 961-966, rise end 967-994, coast 995-1006, surface pin
    1008-1009, floating check 1012-1050); `checkWallsForClimb` 1127-1563; hover timers 1624-1659, 3059-3083; pipes
    1675-1694; water 1695-1752; pickups 1764-1831; jump press and release 1861-1937; attack 1938-1961; Select
    1962-1966; Special 1977-2015; key remap 2016-2195; death 2226-2248; flagpole 2249-2261; attach, turn and detach
    2277-2680; drop 2768-2802; lifts 2803-2870; `groundOnSide`, `groundAbove`, `groundBelow` 2871-2987; landing
    2988-3012; squat timer 3089-3135; vine 3136-3207; cannon raise 3208-3263; axe 3264-3269; hull colours 3296-3306;
    hit 3312-3337; select screen 3381-3394; `setJumpRise` 3423-3449.
  - Projectiles: `projectiles/SophiaBullet.as` 46-102 (speeds, `vxMax` 425), 109-175, 177-266 (`setDir`), 267-358
    (homing), 379-427; `Projectile.as` 33-50, 135-152; `DamageValue.as` 81-84; `HealthValue.as` 5-30;
    `Brick.as` 181-192, 194-200, 223-228, 260, 320, 354.
  - Shared: `Character.as` 84, 140, 171, 207, 226, 338, 380-385, 1000-1008, 1505-1521, 1528-1560, 2036-2097,
    2937-2945, 2986, 3109-3116; `AnimatedObject.as` 179-198, 255-277; `HitTester.as` 33, 360-375;
    `Level.as` 115-126, 147, 666-693, 779-791, 1819-1860, 2047-2059; `SpringRed.as` 19-20, 61-80; `SpringGreen.as`
    25-26; `RandomDropGenerator.as` 28-80; `Enemy.as` 333-340; `SophiaExplosion.as` 15-79; `GameSettings.as` 79-80,
    99, 112, 211, 221, 232; `StatManager.as` 104, 363-364, 1290-1330; `Jason.as` 1-57; `CharacterSelect.as` 171-177.
  - SWF: labels from `$S/chars/work-sj/py/sophia.py`; hitbox from `place.py`; sheet sizes from
    `$S/chars/shots/missing-sophia-jason/skins/sophia_000.png`.
  - Level data: `$S/orig/assets/documents/levelDataSmb.xml`, `levelDataLostLevels.xml`; scripts
    `$S/classic/sophia-work/table.py` (counts), `pos.py` (positions), `conv/convert-flags.mjs` and `conv/diff.py`
    (the converter prototype and its diff against today's output).
  - Comparison: `$S/chars/missing-sophia-jason.md`, `$S/chars/FINAL-REPORT.md` section 4.2, `$S/chars/verify/C.md`
    (Sophia rows).
  - Ours, where the change lands: `src/game/characters/sophia/` (new), `registry.ts`, `character.ts:103-147`,
    `profile.ts:57-94`, `entities/player.ts:150-163`, `entities/body.ts:63-120`, `entities/objects/spring.ts:21-48`,
    `world/world.ts:277-319, 760-768, 818, 1527-1555`, `rules/classic-level-variants.ts` (new),
    `engine/gfx/renderer.ts:43-50`, `content/sprites/`, `content/sfx/sfx.ts`, `tools/levelgen/convert-smbc.mjs:70-80,
    482-486`.
- **Corrections to the unit file** (`missing-sophia-jason.md`), all from source:
  - She **cannot stomp**; Lose Everything strips both tiers in one hit; Spinies are not armoured; `Jason.as` is 57 lines;
    friction also applies with both directions held, in the air too; a hit **detaches** her from a wall instead of
    pushing (all from `verify/C.md`).
  - Cannon speed is **3.5417 px/f**, not 3.75: `vxMax`/`vyMax` 425 clamps the 450 set in `setDir`.
  - Red springs use the shared 500 / 1000; her 400 / 930 are only read by the Bouncy Pits cheat.
  - Hover's steady climb is **0.6875 px/f**, not 0.83: gravity is added after the −100 cap.
  - The castle-axe friction is **stronger**, not near zero (×0.764 per frame).
  - Death removes her missiles and resets ammo; only a hit keeps them.
  - Unit open question 2 (ceiling grip and blocks) is answered from source: the grip suppresses the bump.
- **Implementation hints.**
  - Keep Current untouched: every new field (`mode`, `holdDamping`, `takeoffDelay`, `bumpAll`, `cornerFreeTiles`,
    `levelFlags`, `rotate`) is optional and absent from every Current def, and the variant table is read only under
    Classic (SO-48).
  - Put all of Sophia's movement in `drive.ts` and `surface.ts`. Treat "along" and "away" as axes so the floor, walls
    and ceiling share one code path; only the remap and the box swap know the surface.
  - Store her state in `p.scratch`: `surface` (0 floor, 1 left, 2 right, 3 ceiling), `turn` (frames left), `squat`,
    `hoverCells`, `hoverTimer`, `engaged`, ammo keys (SO-32).
  - Her projectiles are her own classes in `classic-weapons.ts` (acceleration, side decay, thrust homing), so the
    shared `Projectile` keeps its behaviour.
  - Port the turn conditions line for line. They are long but self-contained: they only read tiles around her and her
    four direction flags.
- **Acceptance checks** (headless, `tests/sim/sophia-classic.test.ts`).
  - Phase 1:
    - From rest, Right held: `vx` reaches 0x018AB at frame 14 and never exceeds it.
    - Right released at full speed: `vx` is 0 by frame 33.
    - Jump tapped: take-off on frame 4; apex 45 ± 1 px above take-off on frame 18 ± 1. Held: 72 ± 1 px on frame 33 ± 1.
      Running and standing heights are equal.
    - Cannon: 3 shots on screen, the 4th press does nothing; a shot moves 3.5417 px/f; Up held 9 f then Attack fires
      straight up, Up held 8 f fires forward.
    - Goomba: 3 Normal shots, 2 Hyper, 1 Crusher. Brick: 2 Normal shots, 1 Hyper. A Buzzy Beetle takes no damage from
      the cannon.
    - Landing on a Goomba hurts her. A hit at Crusher leaves her Normal; the next kills.
    - Jumping under two adjacent bricks bumps both.
  - Phase 2:
    - 4-4 loaded for Sophia: cell (161, 10) is empty; for Mario it is solid. 1-1 for Sophia has `lift-fall` at
      (193, 4); for Mario it does not.
    - Re-running the converter leaves every `.map` file byte-identical (TG-36's hash unchanged) and reproduces
      `classic-level-variants.ts` exactly.
    - Water: neutral input from rest sinks 0.5 px per frame; Up held reaches −1.5833 px/f and no faster; Jump held
      raises the horizontal cap to 1.6667.
    - Hover: steady climb 0.6875 px/f; the bar empties after 144 hover frames and refills one cell per 120 frames.
    - Triple Missile: 3 missiles, cost 3, no second volley until all 3 are gone; one kills a Bullet Bill, two a
      Buzzy Beetle; a missile passes a pipe and breaks the first brick it meets.
  - Phase 3:
    - On a flat floor next to a 3-tile wall, Right + Up held: after 12 frames she is on the wall moving up at
      1.5417 px/f; at the top she wraps onto it in 14 frames.
    - Wall jump between two walls 4 tiles apart grips the far wall.
    - Jump under a 3-tile ceiling with Down not held: she grips it, no block is bumped; with Down held: the block is
      bumped and she falls.
  - **Current unchanged:** the whole suite is green with no edits to existing tests; the TG-36 parity fixture is
    unchanged; the 8-hero select screen is unchanged under Current.
- **Confidence.**
  - Source-only: no one played the original's Sophia or any build of ours with her.
  - Movement constants, damage, caps, ammo, timers and level-data counts are read directly from source and data.
  - Jump heights and spring heights are re-simulations (SO-14, SO-16).
  - The turn rules (SO-36) are summarised from a long routine; port the source rather than the summary where they differ.
  - The ceiling-grip/no-bump rule (SO-37) is inferred from call order. The double drop roll (SO-25) is read directly
    from its two call sites.
  - The converter prototype ran on the real XML; the per-area counts are its output.
- **Open questions.** SO-M7, SO-M8, SO-M11, SO-M15 and SO-M18 need a playtest or an owner call; each has a default in
  the table. One more: should the dev Level select offer a "Sophia variant" preview for Mario (to see the edited
  maps)? Default: no.
- **Related reports.**
  - `2026-10-07-dev-classic-smbc-rules-toggle.md` (TG-18, TG-21, TG-22, TG-41 to TG-44), `2026-10-07-classic-power-states.md`,
    `2026-10-07-classic-enemy-hp-and-armour.md`, `2026-10-07-classic-bricks-and-shots.md`, `2026-10-07-classic-swimming.md`,
    `2026-10-07-mario-luigi-classic-smbc-rules.md` (the jump model), `2026-10-07-classic-follow-ups.md` (FU-6),
    `2026-10-07-bass-build-classic-character.md` (slot order).
  - Existing open reports: `2026-10-05-converter-ignores-shiftup-shiftright.md` (same converter; its counts already
    exclude the helper tokens), `2026-10-05-ll-12-4-lava-lift-never-reaches-drop-shaft.md` (mentions the
    `WideCharacter` shaft at column 30), `2026-10-06-water-non-mario-heroes-stroke.md` and
    `2026-10-06-water-surface-air-physics.md` (Current water; Sophia uses SO-18 instead).
- **Also for the coordinator** (the shared report needs a change; not edited here):
  - `2026-10-07-classic-power-states.md` PS-C15 and PS-C16 do not list Sophia. Add her: 25 % per enemy killed,
    6.25 % per brick, 12.5 % per coin (`SOPHIA_DROP_RATE`, `RandomDropGenerator.as:33-35`), only while she owns a
    missile weapon; the item is Triple ammo +6 or Homing ammo +2 (SO-25).
  - PS-C15's "one roll per killed enemy" needs her exception: an enemy killed by a Sophia shot rolls twice
    (`Enemy.as:333-340`, `SophiaExplosion.as:65-79`; SO-25).
  - PS-C10 needs her hit-flash row (three palettes, no flicker; SO-23).
