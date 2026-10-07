# Classic SMBC rules for Mario and Luigi: constant-rise jumps, exponential friction, no mid-air turn, a fixed 14 px stomp bounce, the original fireball and crouch-jump, and Luigi's own slippery, floaty constants

- **Severity:** feature request (Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=mario` or `&char=luigi` (once the toggle exists; today `?dev=1&level=1-1&char=mario` shows the Current behaviour)
- **Character and power:** Mario and Luigi, all power states (small, big, fire)
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=mario` (Current). Press F1 for the overlay. Stand still and hold jump: the apex is 66 px. Walk at full speed without B and hold jump: 70 px.
2. Jump to the right and press left in mid-air: Mario turns around, and a fireball thrown now goes left.
3. Stomp the first Goomba with jump held: Mario bounces about 66-70 px.
4. Once the toggle exists, open `?dev=1&rules=classic&level=1-1&char=mario` and repeat steps 1-3. Expect 67 px standing, 84 px at walking speed, no mid-air turn, and a 14 px bounce whether or not jump is held.
5. Repeat with `char=luigi` in both modes. Classic Luigi starts slowly, slides far, and jumps 87 px standing and 99 px at walking speed or faster.

## Expected

Units: px; px/f = px per frame at 60 fps; px/f² per frame squared. "Hex" is our fixed point: velocity and
acceleration in 1/4096 px/f (`src/engine/math/units.ts`), positions in 1/256 px. Per-frame friction factors are
also given as 16.16 integers: apply them as `v = Math.trunc(v * K / 65536)`. "B" is the attack button (or the run
button). "Ground" means standing on something; "air" means not on the ground and not under water.

**Frame step.** Every number here assumes the original steps its physics at **dt = 1/60 s**, which is our fixed
frame. Flash px/s ÷ 120 = px/f, Flash px/s² ÷ 7200 = px/f², a per-second factor `f` becomes `f^(1/60)` per
frame, and Flash px ÷ 2 = px. (If the original really ran at 1/30, every apex below would be 1.5-1.8 px lower;
see Open questions.)

### Controls

- **ML-C1 Buttons.** Left/right walk. Holding B runs (not under water, and not in the crouch pose). With the
  Fire Flower, each B press also throws a fireball. Jump jumps (under water it strokes). Down crouches, only when
  big or fire and on the ground. Up does nothing (the original only shows a look-up pose; not required). There is
  no special-button action. On a vine, jump and fire do nothing (unchanged).
- **ML-C2 No jump buffer.** A jump starts only when jump is pressed while on the ground (or under water). A press
  in the last frames before landing does nothing, and holding jump through a landing does not jump again
  (`MarioBase.as:1253-1258`). Coyote time stays 0.

### Movement

- **ML-C3 Horizontal constants.**

| Constant | Mario | Luigi | Hex / 16.16 (Mario; Luigi) |
|---|---|---|---|
| Walk top speed | 1.4583 px/f | same | `0x1755` |
| Run top speed (B held) | 2.5 px/f | same | `0x2800` |
| Acceleration, B not held | 0.04861 px/f² | 0.02778 px/f² | `0xC7`; `0x72` |
| Acceleration, B held | 0.04861 px/f² | 0.03958 px/f² | `0xC7`; `0xA2` |
| Release friction (no direction on the ground, or both directions anywhere) | ×0.95775 per frame | ×0.97353 | `62767`; `63801` |
| Crouch friction, and B held with no direction on the ground (or both directions) | ×0.95130 | ×0.96888 | `62344`; `63496` |
| Skid friction (on the ground, pressing against the motion) | ×0.94323 | ×0.98169 | `61816`; `64336` |
| Run-to-walk decay (B released above walk speed, a direction held) | ×0.93688 | same | `61399` |
| Stop snap: after a friction step, \|vx\| below this becomes 0 | 0.3333 px/f | same | `0x555` |
| Skid pose threshold | 0.3333 px/f | same | `0x555` |
| Crossing one-tile gaps on the ground | \|vx\| > 1.8333 px/f (unchanged) | same | `crossGapMinVx` as today |
| Release friction after taking the axe in an x-4 castle | ×0.85770 | same | `56210` |

- **ML-C4 Horizontal step, every frame** (after the jump checks of ML-C9, before gravity). `ax` is updated only
  while on the ground: `ax` = B-held acceleration if B is held, else the B-not-held acceleration. In the air the
  hero keeps the last ground value. `cap` starts at walk top speed.
  1. If exactly one direction is held and the hero is not crouching: `vx += ax` toward it. If on the ground and
     `vx` points the other way, then also `vx *= skid friction`. In the air there is no skid friction.
     There is no minimum starting speed: from rest the first frame gives `vx = ax`.
  2. Else, if crouching, or B is held and (both directions are held, or no direction is held on the ground):
     `vx *= crouch friction`, then snap to 0 below 0.3333 px/f.
  3. Else, if both directions are held, or no direction is held on the ground: `vx *= release friction`, then snap.
  4. (No direction in the air: `vx` is unchanged.)
  5. If B is held, not under water, and not in the crouch pose: `cap` = run top speed.
  6. Clamp `vx` to ±`cap`.
  7. If B is not held: if \|vx\| > walk top speed and a direction is held, `vx *= run-to-walk decay`; if
     \|vx\| ≤ walk top speed, `cap` = walk top speed. (So with B released and no direction held, a running
     hero keeps the run cap until friction brings him to walking speed.)
  8. On the frame Down is released after crouching, the whole horizontal step is skipped once
     (`justCrouched`).
- **ML-C5 Facing and skid pose.** Facing changes only on the ground or under water, to the direction held
  (even while still sliding the other way). It **never changes in the air**, so fireballs keep the take-off
  direction. Standing still against a wall, pressing toward it turns the hero to face it. On the ground the skid
  pose shows while \|vx\| > 0.3333 px/f and the opposite direction is held.
- **ML-C6 Crouch on the ground.** Big or fire only. Left/right do nothing while crouched (crouch friction from
  ML-C3 applies, with or without B). Small heroes cannot crouch (the small-crouch skins are out of scope; see
  the follow-ups report).

### Jumping

- **ML-C7 Jump constants.**

| Constant | Mario | Luigi | Hex |
|---|---|---|---|
| Running jump if \|vx\| at take-off ≥ | 1.4583 px/f (walk top speed) | same | `0x1755`, the same constant as walk top speed |
| Rise speed, standing jump | 3.3333 px/f | 3.0833 px/f | `0x3555`; `0x3155` |
| Rise speed, running jump | 3.5 px/f | 3.5833 px/f | `0x3800`; `0x3955` |
| Rise cap above take-off, standing | 42 px | 64 px | |
| Rise cap above take-off, running | 56 px | 68 px | |
| Minimum rise (the "min line") | 19 px | 15 px | |
| Gravity | 0.20833 px/f² | 0.19444 px/f² | `0x355`; `0x31C` |
| Release damping of upward speed (soft cut) | ×0.79433 per frame | none (×1) | `52057`; none |
| Fall speed cap (clamp; no SMB1 reset) | 5.0 px/f | 4.0 px/f | `0x5000`; `0x4000` |
| Head bump | vy = +0.8333 px/f (down) | same | `0x0D55` |
| Stomp bounce | vy = −2.5 px/f | same | `0x2800` |

- **ML-C8 Take-off** (on the jump press, while on the ground and not under water). Pick standing or running by
  \|vx\| (ML-C7). Set `vy = −rise speed`. Record the take-off feet height `y0`. Set `rising = true`,
  `released = false`, `damping = false`. Leave the ground. If Down is held and the hero is big or fire, enter
  the crouch-jump (ML-C22). The body moves by the full rise speed on the take-off frame, with no gravity.
- **ML-C9 The jump, every airborne frame (not under water), in this order.** Let `h` = `y0` − feet y, the
  height above take-off (positive is up).
  1. **Release.** If jump is not held and `released` is false: set `released = true`. If `h` ≥ min line, set
     `damping = true` and `rising = false`.
  2. **Rise check.** If `rising`:
     - if `h` ≥ rise cap: move the body down so `h` = rise cap exactly, set `rising = false`, and if `released`,
       set `damping = true`;
     - else if `released` and `h` ≥ min line: move the body down so `h` = min line exactly, set
       `rising = false` and `damping = true`.
  3. **Damping.** If `damping`: if `vy < 0`, `vy = trunc(vy × release damping)`; else `damping = false`.
  4. **Horizontal step** (ML-C4).
  5. **Gravity.** If not `rising`: `vy += gravity`. While `rising`, gravity is off and `vy` stays at the rise
     speed.
  6. **Fall cap.** If `vy` > fall cap, `vy` = fall cap.
  7. **Move** x, then y, with tile collision. Landing sets `vy = 0` and ends the jump.

  In words: the hero rises at a constant speed with gravity off until he is a fixed height above the take-off
  point, then coasts upward under gravity. The snap in step 2 only moves the body back over space it has just
  crossed (at most one frame's rise, 3.6 px), so it cannot push him into a ceiling.
- **ML-C10 Releasing jump.**
  - Released **before** the min line: the constant rise continues to the min line, then stops, and the soft cut
    starts.
  - Released **after** the min line (rising or already coasting up): the rise stops at once and the soft cut
    starts.
  - **Mario's soft cut:** upward speed is multiplied by 0.79433 every frame until he starts to fall.
  - **Luigi has no cut:** the factor is 1. Releasing still ends his constant rise, so he coasts up from his
    current speed under gravity. This is why his jumps float.
  - Releasing while already falling does nothing.
- **ML-C11 Head bump.** Hitting a ceiling ends the rise (`rising = false`; `damping = true` if released) and,
  after a jump, stomp or spring, sets `vy` = +0.8333 px/f downward. Brick breaking and bumping are unchanged.
- **ML-C12 Falling.** Walking off a ledge starts no rise: gravity and the fall cap apply at once. The fall cap
  is a clamp. Do not use the SMB1 4.5 → 4.0 px/f reset.
- **ML-C13 Air control.** Use ML-C4 in the air as written: a held direction accelerates by the kept `ax`, either
  way, with no skid friction and no turn (ML-C5). Holding B in mid-air raises the cap to 2.5 px/f, so a hero who
  took off at walking speed can speed up to running speed in the air. No direction held: speed is kept. Releasing
  B above walking speed with a direction held decays toward walking speed (×0.93688 per frame, about 9 frames
  from 2.5 to 1.4583 px/f).
- **ML-C14 Acceptance heights.** With ML-C7 to ML-C9 implemented in our integer units, a jump on flat ground
  with no ceiling must give these apex heights (feet above take-off) and airtimes (frames from the take-off
  frame to the landing frame, both counted). "Tapped" means jump held on the take-off frame only.

| Jump | Mario apex | Mario apex frame / airtime | Luigi apex | Luigi apex frame / airtime |
|---|---|---|---|---|
| Standing (vx = 0), held | **67.0 px** | 29 / 54 f | **87.0 px** | 36 / 69 f |
| Standing, tapped | **25.5 px** | 12 / 28 f | **38.0 px** | 20 / 41 f |
| Just under walk top speed (1.4 px/f), held | 67.0 px | 29 / 54 f | 87.0 px | 36 / 69 f |
| Walk top speed (1.4583 px/f), held | **83.7 px** | 32 / 62 f | **99.3 px** | 37 / 73 f |
| Walk top speed, tapped | **26.0 px** | 12 / 28 f | **46.3 px** | 23 / 45 f |
| Running (2.5 px/f), held | **83.7 px** | 32 / 62 f | **99.3 px** | 37 / 73 f |
| Running, tapped | **26.0 px** | 12 / 28 f | **46.3 px** | 23 / 45 f |
| Standing, released on the 11th airborne frame (held for 10) | 43.2 px | | 56.9 px | |

  Tolerance ±0.5 px and ±1 frame. In tiles: Mario 4.2 standing and 5.2 at walking speed or faster; Luigi 5.4 and 6.2.

### Swimming

- **ML-C15 Water.** The stroke and water numbers already match and stay as they are
  (`mario/profile.ts:34-39`): stroke 1.6667 px/f (`0x1AAB`) at any depth, water gravity 0.04861 px/f²,
  sink cap 2.0833 px/f, sea-floor walk cap 0.75 px/f. Mario and Luigi are the only heroes with a stroke in
  Classic. Hero values that differ from Current under water:
  - Horizontal acceleration is the B-not-held value (Mario 0.04861, Luigi 0.02778 px/f²), with ML-C4 rules.
    B never raises the cap under water; B still throws fireballs.
  - Facing turns freely under water (ML-C5).
  - **No stomping under water.** Landing on an enemy while under water is ordinary contact and hurts
    (`canStompUnderWater = false`).
  - The constant-rise jump (ML-C8) is not used under water; a jump press is a stroke.
  - The shared water rules (who strokes, the surface line, gravity above the surface) belong to the swimming
    report.

### Health and power-ups

- **ML-C16 Power states and pickups** (shared rules in the power-states report).

| State | What it gives | A hit (Lose Everything, the Classic default) |
|---|---|---|
| Small | walk, run, jump, stomp; head bumps bricks; no crouch | death |
| Big (Mushroom) | head breaks bricks; crouch and crouch-jump | to small |
| Fire (Fire Flower) | as big, plus fireballs (ML-C19, ML-C20) | to small |

  - A ? block gives a Mushroom when small, otherwise a Fire Flower (unchanged).
  - A Fire Flower taken while small gives big only (unchanged).
  - **A Mushroom taken while big turns into a Fire Flower: big becomes fire.** Current only scores 1000.
  - Star: 12.0 s, from the power-states report. 1-up unchanged.
- **ML-C17 Hit and grow timings.** The shrink after a hit and the grow from a Mushroom or Flower each freeze
  the game for **60 frames** (1000 ms; Current: 48). After a hit, 150 frames (2500 ms) without damage follow,
  as now. The look during those frames (65% opacity in the original, not blinking) is set by the
  power-states report.
- **ML-C18 Death.** Freeze 15 frames (250 ms; Current 30). Then a hop at −4.1667 px/f (`0x42AB`), gravity
  0.16667 px/f² (`0x2AB`), fall cap 4.5 px/f (`0x4800`). The death ends 180 frames (3000 ms) after the freeze,
  so 195 frames in all (Current 200). A pit death has no hop and ends 180 frames after the fall.

### Weapons and attacks

- **ML-C19 Fireball motion.**

| Constant | Classic | Hex |
|---|---|---|
| Horizontal speed | 3.9583 px/f | `0x3F55` |
| Vertical speed when thrown | +2.5 px/f (already falling at its cap) | `0x2800` |
| Gravity | 0.1875 px/f² | `0x300` |
| Fall cap | 2.5 px/f | `0x2800` |
| Bounce off the top of the ground | vy = −2.25 px/f | `0x2400` |
| Spawn point (fireball centre) | 5 px ahead of the hero's centre on the facing side; 21 px above the feet | |

  On flat ground this gives a bounce 12.4 px high every 23 frames (Current: 12.3 px every 14 frames).
- **ML-C20 Fireball rules.**
  - At most 2 on screen; no cooldown (unchanged).
  - Not thrown in the crouch pose (on the ground or in a crouch-jump), and not on a vine.
  - Direction is the facing, which cannot change in the air (ML-C5).
  - Landing on the top of ground or a platform bounces it. Hitting a wall **or a ceiling** bursts it (Current
    stops at a ceiling and falls).
  - It never breaks or bumps bricks or ? blocks (unchanged; bricks report).
  - Damage 1000: it kills any ordinary enemy, and Bowser takes 5 in every form. An armoured enemy makes it burst
    with no damage. Values and the armour list are in the enemy HP report.
  - Throw pose lasts 5 frames (75 ms; Current 8). Cosmetic.
- **ML-C21 Stomp bounce.** A stomp sets `vy` = −2.5 px/f with normal gravity, no rise and no hold boost. It
  peaks **13.8 px** above the stomp point for Mario and **14.9 px** for Luigi, whether jump is held or not, at any
  speed. A stomp does not reset `released` or the min line of the last jump: a Mario still holding jump from that
  jump who lets go during the bounce, while above that jump's min line, gets the soft cut (ML-C10). Under water
  there is no stomp (ML-C15).

### Special abilities

- **ML-C22 Crouch-jump (big and fire).** If Down is held when the jump starts, the hero keeps the crouch pose and
  the crouch hitbox (12 × 16 px) for the whole jump, even if Down is released, until he lands. During it:
  left/right accelerate normally (ML-C13), B does not raise the cap, and no fireballs. On landing he crouches if
  Down is held, otherwise he stands (see Open questions for a low ceiling). The jump itself is the normal one
  (ML-C8).

### Interactions

- **ML-C23 Springs.** Launch speeds stay as in `spring.ts` (already ported). The launch is not a jump rise:
  `rising = false`. The rise uses Classic gravity (the same values `spring.ts` uses today) and the Classic fall
  cap. Like a stomp, it does not reset `released`.
- **ML-C24 Bricks.** Big and fire heads break bricks; small heads bump them (unchanged). The fireball never
  touches them (ML-C20). Full rules in the bricks report.
- **ML-C25 Blooper on the sea floor.** A Blooper cannot hurt Mario or Luigi while they stand on the ground with
  their feet 2 tiles above the stage bottom (y = 208 px, the top of the sea floor).
- **ML-C26 Axe stop.** After the axe in an x-4 castle, Mario and Luigi walk to Toad at the Classic walk speed,
  1.4583 px/f (Current: 1 px/f). When the walk ends they slow to a stop with ×0.85770 per frame and the 0.3333 px/f
  snap: 10 frames and about 6.6 px. This is a **quicker** stop than normal. They do not slide. (An earlier unit file
  said they slide; the fact-check corrected it.)
- **ML-C27 Unchanged.** Vines, pipes, the flagpole, one-tile gap crossing (above 1.8333 px/f) and the head-bump
  sound and brick bump stay as in Current.

### Feel

- **ML-C28 No SMB1 leftovers in Classic.** The Classic profiles must not use the SMB1 jump tiers, hold or fall
  gravity, the 4.5 → 4.0 fall reset, the 0.074 px/f start snap, linear deceleration, the 10-frame run timer, the
  take-off air cap or the facing-follows-speed rule. Expected feel: a sharp "rocket" rise with a short, flat top.
  Mario's full jumps match Current within 2 px, but a jump at walking speed is a tile higher. Luigi is slow to
  start, slides a long way, and floats high.

## Actual

Current (the default; unchanged by this report):
- SMB1 NES constants (`src/game/characters/mario/profile.ts:9-43`): walk 1.5625 and run 2.5625 px/f; acceleration
  0.037 / 0.056 px/f²; linear release 0.051 and skid 0.102 px/f²; a 0.074 px/f start snap; a 10-frame run timer.
- Luigi is "Lost Levels style, tuned by feel" (`src/game/characters/luigi/profile.ts:4-16`): Mario's accel ×0.85,
  half the deceleration, +0.375 px/f on every take-off.
- Jumps use three tiers by take-off speed, < 1.0, < 2.3125 and ≥ 2.3125 px/f (`mario/profile.ts:18-22`;
  `src/game/entities/player.ts:218-225`), with hold and fall gravity (`player.ts:235-263`). The fall cap is 4.5 px/f,
  reset to 4.0 (`player.ts:262`). Heights: Mario 66 / 70 / 82.5 px (standing / walking / running), tapped 23-28 px;
  Luigi 79 / 84 / 95 px, tapped 27-32 px.
- Jump presses are buffered for 4 frames (`src/game/constants.ts:6`, `player.ts:204`).
- The air speed cap is fixed at take-off (`player.ts:225`, `452-465`). Facing follows vx, so a mid-air turn flips
  fireballs (`player.ts:242-245`). Crouching ends on leaving the ground (`player.ts:175-180`).
- The stomp bounce is −4 px/f with the tier's hold gravity (`player.ts:516-523`): 66 / 70 / 53 px held, 20 / 23 /
  16 px released (standing / walking / running).
- The fireball starts level at 4.0 px/f, gravity 0.5, bounce 3.5, cap 4.0 (`src/game/entities/projectiles/projectile.ts:64-81`,
  `244-258`). It spawns at the body edge, 8 px below the top (`mario/index.ts:93-101`).
- A Mushroom while big gives 1000 points only (`mario/index.ts:105-112`). Shrink and grow last 48 frames
  (`player.ts:142`); 150 frames of blinking follow (`mario/index.ts:141`).
- Death: freeze 30 f, hop −4.0 px/f, gravity 0.156, ends at frame 200 (`src/game/world/world.ts:1478-1488`).
- After the axe, a scripted walk at 1 px/f stops dead (`world.ts:1919-1931`, `1966-1981`).

## How often

every time

## Notes

**Sources (original, line numbers after `tr '\r' '\n'`; all in `$S/orig/src/com/smbc/`).**
- ML-C1, ML-C2: `characters/base/MarioBase.as:835-869` (fire, special), `1253-1265` (jump only when on the ground
  or under water), `483-486` (run cap); `ButtonManager.as:56-64`.
- ML-C3, ML-C4: `characters/Mario.as:53-59`, `characters/Luigi.as:41-47`; `MarioBase.as:80-81` (175 / 300),
  `86` (MIN_WALK_SPEED 40), `128` (FX_RUN_TO_WALK .02), `130` (FX_DUNGEON_GOT_AXE .0001), `418-500`
  (movePlayer), `598-603` (`ax` set only on the ground), `423-427` (`justCrouched`), `529-532` (gap crossing).
- ML-C5: `MarioBase.as:436-443`, `460-467` (scaleX only on the ground or in water), `551-557`, `624-637` (skid).
- ML-C6, ML-C22: `MarioBase.as:618-623`, `720-725` (canCrouch), `779-796` (crouch frame kept on take-off),
  `701`, `712` (the air state never replaces the crouch frame), `483` and `840` (no run cap, no fire in it).
- ML-C7 to ML-C12: `Mario.as:47-52`, `57`, `60`; `Luigi.as:35-40`, `43`, `48`; `MarioBase.as:82`
  (JUMP_HEIGHT_RUN_SPEED 175), `253-273` (setStats), `680-711` (rise check and frictionY), `752-773` (jump),
  `809-822` (release), `1011-1046` (head bump, setJumpRise); `Character.as:171` (CIELING_DISPLACE 100),
  `1464-1478`; `AnimatedObject.as:179-187` (gravity skipped while defyGrav), `254-285` (cap, move, gravity).
- ML-C15: `MarioBase.as:255-260`, `279`, `663-679`; `Character.as:976-1009`, `225-226`, `3247-3256`.
- ML-C16, ML-C17: `MarioBase.as:83` (2500 ms), `375-380`, `898-911`, `935-966`; `Character.as:1540-1552`
  (Mushroom while big → Fire Flower in Classic), `144` (alpha .65), `204` (freeze 1000 ms), `2106-2121`, `2279-2299`.
- ML-C18: `MarioBase.as:41-42`, `141-145`, `1163-1186`, `1240-1252`.
- ML-C19, ML-C20: `projectiles/MarioFireBall.as:26-31`, `34-55`, `56-77`, `88-117`; `MarioBase.as:87`, `147`,
  `835-857`; `ground/Brick.as:174-180`; `data/DamageValue.as:25` (1000).
- ML-C21: `Character.as:172` (bouncePwr 300), `1510-1522`, `2645-2653`.
- ML-C23: `ground/SpringRed.as:61-81`; `Character.as:3067-3070` (springLaunch is empty for Mario).
- ML-C25: `MarioBase.as:158`, `999-1004`.
- ML-C26: `MarioBase.as:1202-1207`; `Character.as:2864-2883` (auto-walk at vxMax with right held);
  `managers/StatManager.as` (DUNGEON_LEVEL_NUM = 4). Errata: `$S/chars/verify/D.md`, first row.
- Comparison: `$S/chars/mario-luigi.md`, section 3.1 of `$S/chars/FINAL-REPORT.md` (gaps ML-1 to ML-10), and the
  errata `$S/chars/verify/D.md`, which override the unit file (axe, stomp heights, Luigi skid, frame step).

**Where the change lands (ours).**
- New `src/game/characters/mario/classic.ts`: `MARIO_CLASSIC: CharacterDef = { ...MARIO, movement:
  MARIO_CLASSIC_PROFILE, behaviour: PLUMBER_CLASSIC_BEHAVIOUR }`. New `luigi/classic.ts`: the same with Luigi's
  constants and palettes. New `mario/classic-weapons.ts`: `FIREBALL_CLASSIC`.
- `src/game/characters/registry.ts:12-16`: pick the Classic defs when `rules === 'classic'` (toggle report).
- `src/game/characters/profile.ts:31-68`: add one optional field, for example `plumber?: PlumberPhysics`, holding
  every ML-C3 and ML-C7 constant. Only the Classic profiles set it.
- `src/game/entities/player.ts`: when `profile.plumber` is set, `update()` runs a new `plumberUpdate()`
  (ML-C2, ML-C4, ML-C5, ML-C8 to ML-C13, ML-C22). `stompBounce()` (`516-523`) and `springLaunch()` (`510-514`)
  branch on the same field. `tickTransition()` (`138-148`) needs a per-def length (60 in Classic, default 48).
- `src/game/entities/projectiles/projectile.ts:11-55`, `244-258`: add optional `maxFall` (default `0x04000`,
  today's value) and `burstOnCeiling` (default false). The Classic fireball sets `vy: 0x2800` (field exists).
  Spawn in `PLUMBER_CLASSIC_BEHAVIOUR.update` (today `mario/index.ts:93-101`).
- `mario/index.ts:103-145` → `PLUMBER_CLASSIC_BEHAVIOUR`: Mushroom while big → fire (ML-C16); onHurt as now.
- `src/game/world/world.ts:1362-1373` (stomp): skip the stomp under water for a `plumber` profile (ML-C15).
  `world.ts:1478-1488` (death) and `1966-1981` (axe walk): read per-def values when the profile is Classic.
  Blooper contact (ML-C25): where contact damage is applied, `world.ts:1377-1380`.

**Implementation hints.**
- Keep Current untouched: every new field is optional, and its absence means today's code path. Do not edit the
  existing profiles, `MARIO`, `LUIGI` or `FIREBALL`.
- Track the jump in feet coordinates (`b.y + b.h`), so the rise lines survive the crouch-jump hitbox change.
- Use integer math throughout: the hex values above, positions in 1/256 px, `v >> 4` per move as now, and
  `Math.trunc(v * K / 65536)` for every friction or damping factor. The acceptance numbers were computed this way.
- The release test (ML-C9 step 1) reads the jump button at the start of each airborne frame. A tap that lasts
  only the take-off frame is "released" on the first airborne frame.
- Facing must stay a separate state from `vx` in the Classic path (ML-C5).

**Acceptance checks.**
- **Headless jump test** for each of `MARIO_CLASSIC` and `LUIGI_CLASSIC`: flat floor, no ceiling, set `vx`, press
  jump, hold for N frames, log the minimum feet y. Check every row of ML-C14 (±0.5 px, ±1 frame). Include a
  run at 1.4 px/f (standing height) and at exactly `0x1755` (running height).
- **Ground test**, on a flat floor:

| Check | Mario | Luigi |
|---|---|---|
| From rest to walk top speed (B off) | 31 f, 24.0 px | 53 f, 39.7 px |
| From rest to run top speed (B held) | 52 f, 66.8 px | 64 f, 82.1 px |
| Stop from walk top speed, nothing held | 35 f, 25.3 px | 55 f, 40.8 px |
| Stop from run top speed, nothing held | 47 f, 48.7 px | 75 f, 79.0 px |
| Stop from run top speed, B held, no direction | 41 f, 42.1 px | 64 f, 67.0 px |
| Skid from run top speed to vx = 0, B held, opposite held | 25 f, 22.0 px | 43 f, 44.5 px |
| Skid from walk top speed to vx = 0, B off, opposite held | 18 f, 9.9 px | 37 f, 23.0 px |

  Tolerance ±1 frame, ±0.5 px.
- **Stomp:** stomp a Goomba with jump held all the way, then again with it released: both peaks 13.8 px above the
  stomp point for Mario (14.9 px for Luigi), ±0.5 px. Under water, landing on a Cheep Cheep hurts.
- **Air control:** take off at walk top speed holding right, press B at the apex: vx rises to 2.5 px/f before
  landing. Take off right and hold left: facing stays right, vx falls by 0.0486 px/f per frame (Mario), and a
  fireball thrown then still goes right.
- **Fireball:** thrown on flat ground, it bounces every 23 frames, 12.4 px high; it moves 3.96 px per frame; it
  bursts on a ceiling; a third one is not thrown while two are out.
- **Crouch-jump:** big Mario holds Down and jumps: the hitbox is 16 px tall until landing, B does not raise the
  cap, and attack throws no fireball.
- **Power-up:** big Mario takes a Mushroom and becomes fire; the grow freeze is 60 frames.
- **Current unchanged:** with `rules` unset or `'current'`, all existing tests and headless sims stay green with no
  edits, and Mario's standing held jump still peaks at 66 px.

**Confidence.**
- From source: every constant, the order of operations within a frame (read from `Character.as`,
  `MarioBase.as` and `AnimatedObject.as`), and the power-up, fireball, stomp, axe and Blooper rules.
- Computed, not played: the original was never booted. Two independent sims (`$S/chars/ml-scripts/sim.mjs` and
  `$S/chars/verify/Dwork/jumps.mjs`) and my own integer sim of exactly the ML-C9 algorithm
  (`$S/classic/ml-work/classic-sim.mjs`) agree on the heights to within 0.1 px at dt = 1/60.
- Played (ours): Current Mario 66 px and Luigi 79 px standing jumps, walk top speed 1.563 px/f.
- Inferred: that the crouch pose's hitbox is smaller (the hit rectangles live in the SWF).

**Open questions** (each has a default to use meanwhile).
- **Frame step.** The game loop timer is 1000/60 ms, but the stage frame rate defaults to 30 fps
  (`GameSettings.as:79`). At dt = 1/30 the apexes drop by 1.5-1.8 px (Mario 65.3 / 82.0, Luigi 85.4 / 97.5).
  **Default: dt = 1/60**, which is our fixed frame. A playtest of the original measuring a standing jump would settle it.
- **Crouch-jump hitbox.** Default: our crouch hitbox, 12 × 16 px, for the whole crouch-jump.
- **Landing from a crouch-jump under a low ceiling with Down released.** The source does nothing special.
  Default: stay crouched until there is room to stand, so the hero is never pushed into tiles.
- **No jump buffer (ML-C2).** It matches the original but may feel stricter than Current. Default: no buffer in
  Classic; the owner can ask for it back.
- **Look-up pose and 65% opacity.** Cosmetic. Default: no look-up pose; opacity per the power-states report.

**Related reports.**
- `2026-10-07-dev-classic-smbc-rules-toggle.md` (the toggle, registry and test plan).
- `2026-10-07-classic-power-states.md` (Lose Everything, Star 12 s, hit look and timings).
- `2026-10-07-classic-enemy-hp-and-armour.md` (fireball 1000, Bowser 5 fireballs, armour).
- `2026-10-07-classic-bricks-and-shots.md` (head breaking, fireball ignores bricks).
- `2026-10-07-classic-swimming.md` (who strokes, the surface line).
- `2026-10-07-classic-follow-ups.md` (FU-3: the small-crouch skins).
- Open: `2026-10-06-water-surface-air-physics.md` (above the surface of a water level the original uses gravity
  0.0972 px/f² and a 3.33 px/f cap for Mario and Luigi; this report does not change it).
- Fixed, kept as is: `2026-10-05-springboard-bounce-too-high.md` (spring launches and per-hero rise gravity),
  `2026-10-05-water-swim-stroke-and-sinking.md`, `2026-10-05-water-seabed-walk-speed.md`,
  `2026-10-05-player-run-falls-into-one-tile-gaps.md`, `2026-10-05-bowser-axe-awards-5000-points.md`.
