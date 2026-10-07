# Warriors of Light (cut Final Fantasy prototype): build a Classic-only hero with four job classes, and design the White Mage, MP and class choice the original never finished

- **Severity:** feature request (new character, Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=warriors` (once the toggle exists; today `?dev=1&level=1-1&char=warriors` shows the Current behaviour)
- **Character and power:** Warriors of Light (Fighter, Thief, Black Mage, White Mage), all power states
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=warriors`. Today the unknown id falls back to Mario (`src/game/characters/registry.ts:14-16`), and the select screen has no Warriors of Light.
2. Once built, open `?dev=1&rules=classic&level=1-1&char=warriors`. You start as the Fighter.
3. Walk to the first Goomba and press Attack: one sword swing kills it, and you stand still while swinging.
4. Hold Right and press Special: you become the Black Mage. Press Attack: after a short wind-up a fireball flies out.
5. Jump under the first ? block: nothing happens (no head bump).
6. Switch Rules back to Current. The hero is gone from the select screen.

## Expected

### Labels used below

The Warriors of Light were **never playable** in 3.1.21. Every requirement carries one of these labels:

- **Coded:** written in the original source and compiled into the SWF, but never run (nothing constructs the
  class).
- **Disabled:** written, then commented out.
- **Stub / never written:** named or drawn, with no behaviour, or absent.
- **New design:** proposed here. Each one also has an entry under "Missing information to fill in" (WL-M#).

### 1. Status in 3.1.21

**WL-1. Cut prototype.** The roster row is commented out (`CharacterInfo.as:58-59`; its game list was copied
from Blaster Master), the six sheets are inside a `/* */` block (`BmdInfo.as:1328-1350`), and nothing ever
constructs `WarriorOfLight` or a subclass. Unlike Vic Viper, the code **is** compiled into the SWF, along with
its clip (SWF sprite 101), the spell clip (255) and one sprite sheet (bitmap 99, 1307 × 383 px). Constructing it
would probably throw: it never sets `CHAR_NUM` and lacks the static tables other heroes define. Fidelity
therefore means "what the code would do".

| Part | Status |
|---|---|
| Walk, jump, gravity, water gravity, spring power | Coded |
| Rooted while acting on the ground | Coded |
| No head bump, no stomp | Coded |
| Fighter sword (300), Thief swing (50) | Coded |
| Black Mage Fire, Ice, Bolt with a wind-up | Coded |
| Fire Flower outfit change (sprite column) | Coded (art only effect) |
| Class switch with Special + direction | **Disabled** (`WarriorOfLight.as:467-476`; spawn mapping `CharacterInfo.as:125-126`) |
| Thief stun | Disabled (`Thief.as:18`) |
| FF hand pointer for aiming Ice and Bolt | Coded but unreachable (its timer is never started) |
| **White Mage attack or spell** | **Never written** (`WhiteMage.as` only sets its sprite row) |
| **MP or any spell cost** | **Never written** (spells are free) |
| Sounds | Never written (no Warrior entries in `SoundNames.as`) |
| Skins | Disabled (6 sheets, no games listed) |

Correction to the unit file (`missing-final-fantasy.md` 2.1), from fact-check C: **a ground jump does cancel a
melee swing.** `pressJmpBtn` sets `idle = true` and removes the swing's timer listener (`WarriorOfLight.as:363-365`,
`:605-608`); `setState(ST_JUMP)` then clears the swing's hit list (`:483-486`).

Settled here from the SWF (open questions 1 and 2 of the unit file): the swing's attack box, the body box, and
the spell boxes are read from the clips' `HRect`/`ARect` shapes (8 × 8 Flash px each, scaled). **Bolt is a
full-screen-height column**, and **Ice is one 48 × 48 px burst**. The sheet's right half does hold the Fire
Flower outfits (Knight, Ninja, Black Wizard and White Wizard art, bitmap 99).

### 2. Character definition

**WL-2. One Classic-only `CharacterDef` with a job field** in `src/game/characters/warriors/classic.ts`,
registered in `CLASSIC_EXTRAS` and shown only while dev mode is on and Rules is Classic SMBC (TG-41 to TG-43). All four classes share movement, hitbox and power states, so one
definition with `p.scratch.job` (0 Fighter, 1 Thief, 2 Black Mage, 3 White Mage) is enough; `sprite`,
`behaviour.update`, `hudExtra` and `touchLabels` branch on it. Sketch against
`src/game/characters/character.ts:103-147`:

```ts
export const WARRIORS_CLASSIC: CharacterDef = {
  id: 'warriors',
  name: 'Warriors of Light',
  hudName: 'WARRIOR',               // WL-M13; the original HUD name is WAR_OF_LIGHT
  rules: 'classic',                 // TG-18, TG-41
  movement: WARRIOR_PROFILE,        // WL-6
  damage: { kind: 'powerup', states: CLASSIC_STATES }, // shared Classic states; no size change
  stomps: false,
  crouches: true,                   // Down while idle on the ground
  canBreakBricks: () => false,
  bumpsBlocks: false,               // NEW flag, shared with Vic Viper (WL-20)
  hitbox: (p) => (p.crouching ? { w: 14, h: 15 } : { w: 14, h: 26 }), // WL-3
  sprite: warriorSprite,            // row by job, column by power state (WL-26)
  blockPowerUp: classicBlockPowerUp, // the shared Classic rule
  jumpSfx: () => 'jump',
  behaviour: WARRIOR_BEHAVIOUR,     // swing, spells, class switch, Cure
  portrait: { sheet: 'warriors', palette: 'warriors-fighter', frame: 'war-stand' },
  hudExtra: (p) => jobLabel(p),     // FIGHTER, THIEF, B.MAGE, W.MAGE (+ Cure charges, WL-M2)
  guide: WARRIORS_GUIDE,
  touchLabels: (p) => jobTouchLabels(p), // SWORD / SPELL / CURE and CLASS
};
```

No `drop` (the original drops ammo only, and this hero has none), no `tools`, `meter`, `reserve` or `startHp`.

**WL-3. Hitbox, the same in every state and class.**
- Standing: **14 × 26 px**. The clip's `HRect` is scaled 3.5 × 6.5 at (−14, −52) Flash px: 28 × 52 Flash px,
  centred on the hero, resting on the feet (SWF sprite 101, frame 1).
- Crouching: **14 × 15 px** (`HRect` 3.5 × 3.75 at (−14, −30), frame 17).
- The hero never changes size with the Mushroom (no `SUFFIX_VEC`; the line is commented out,
  `WarriorOfLight.as:31`). Our other heroes use 12 px widths; this report keeps the original's 14 px. See WL-M14.

**WL-4. Select-screen slot and portrait.** One slot, the last entry of `CLASSIC_EXTRAS` (TG-41: Bass, Sophia III,
Proto Man, Pit, Vic Viper, Warriors of Light), on the select screen's second row. The portrait shows the class currently chosen (WL-M3). Menu name
"Warriors of Light" (the original's menu text was "L. Warriors").

### 3. Controls

| Control | Fighter | Thief | Black Mage | White Mage | Label |
|---|---|---|---|---|---|
| Left/right | Walk 1.667 px/f, instant (WL-6) | same | same | same | Coded |
| Jump | Ground only; fixed arc. On the ground it **cancels** a swing, a wind-up or a cast pose | same | same | same | Coded |
| Attack (no Up/Down) | Sword swing (WL-12) | Swing, 50 damage | Fire (WL-14) | Staff swing (WL-M1) | Coded; WM new design |
| Up + Attack | Nothing | Nothing | Bolt | Nothing | Coded |
| Down + Attack | Nothing (so no attack from a crouch) | Nothing | Ice (also from a crouch) | Cure (WL-M1) | Coded; WM new design |
| Up + Down + Attack | Nothing | same | same | same | Coded (`:451-456`) |
| Special + one direction | Switch class: Up Fighter, Right Black Mage, Down Thief, Left White Mage | same | same | same | Disabled; enabled by WL-M3 |
| Special alone | Nothing | same | same | same | Coded |
| Select | Nothing | same | same | same | Coded |
| Down (idle, on the ground) | Crouch; no walking | same | same | same | Coded (`:235-239`, `:145`) |
| Vine | Climb; no attacks; Left or Right steps off once released and pressed again | same | same | same | Coded (`:159-211`, `:222-227`) |

**WL-5.** Rules that apply to every action (`WarriorOfLight.as:143-149`, `:315-325`, `:433-458`):
- An action (swing, wind-up, cast) can start only while the hero is **idle**. A press during an action is
  ignored, not buffered.
- Actions can start on the ground or in the air.
- **Rooted on the ground:** while an action runs and the hero is on the ground, its speed is held at 0. In the
  air it steers normally. Landing during an action roots it until the action ends.
- A ground jump cancels the action (it sets idle). In the air Jump does nothing, so an air action can't be
  cancelled.

### 4. Movement and jumping

**WL-6. Profile** (`src/game/characters/warriors/classic.ts`, in our units; Flash value → our value):

| Constant | Original | Ours |
|---|---|---|
| Walk | `MOVEMENT_SPEED` 200 px/s (`:36`) | **1.667 px/f** (`0x01AAB`), `minWalk = maxWalk = maxRun` |
| Acceleration / friction / skid | none: speed is set directly (`:166`, `:185`) | `instantAccel: true`, `canRun: false` |
| Air control | full: the same instant speed in the air | `airControl: 'full'` |
| Jump launch | `JUMP_PWR` 630 px/s (`:34`) | **5.25 px/f** (`0x05400`); our `initial` **5.0556 px/f** (`0x050E4`): one frame of gravity less, because the original adds gravity before it moves and our player moves first (MM-C10, SA-C6, BI-C10). Use the same rule for the water jump (WL-8) |
| Gravity | `GRAVITY` 1400 px/s² (`:35`) | **0.1944 px/f²** (`0x0031C`), the same rising and falling |
| Variable height | none (`relJmpBtn` only clears the flag, `Character.as:1336-1339`) | `variableJump: false` |
| Jump tiers | one | one tier, `maxVx: Infinity` |
| Height / air time | 70.9 px, 54 f (continuous); stepped in the original's order: **68.3 px**, apex on frame 26, lands on frame 53. Our engine gives the same with the corrected `initial` (the raw 0x05400 would give 73.5 px) | – |
| Max fall | **none coded** (`vyMaxPsv` is never set; `AnimatedObject.as:266`) | 10 px/f (`0x0A000`) as a safety cap (WL-M6) |
| Coyote time | none | `coyoteFrames: 0` |
| Springs | the spring's own values; the hero's `defSpringPwr` 500 and `boostSpringPwr` 1000 (`:137-138`) are never read (`SpringRed.as:61-80`). Red 500 / 1000. Green boost also 1000: `SpringGreen` names no Warrior class (`SpringGreen.as:8-27`) | 4.167 px/f (`0x042AB`) and 8.333 px/f (`0x08555`). Add `warriors: flash(1000)` to `SPRING_GREEN_BOOST` and `warriors: flashAccel(1400)` to `SPRING_RISE_GRAVITY` (`spring.ts:24-49`); without them he gets Mario's 2750 |
| Crouch | ground only, idle only, no movement | the shared crouch (`player.ts:174-181`) already does this |
| Slide, dash, double jump, run | none | – |

**WL-7. Rooting needs a flag.** Our `Player.update` moves the hero before `behaviour.update` runs
(`player.ts:150-200`). Use the shared before-movement rooting hook the Classic Simon report adds (SI-C4; Bass uses it too,
BA-9), or add `p.rooted` that makes `groundMove` set `vx = 0` while it is set and the hero is on the
ground.

### 5. Swimming

**WL-8. No stroke** (link: `2026-10-07-classic-swimming.md`). In a water level, gravity under water is 750 px/s²
= **0.1042 px/f²** (`0x001AB`) (`WarriorOfLight.as:131-136`). Jump still needs the floor and gives the normal
5.25 px/f launch (our `initial` under water **0x05255**, one frame of water gravity less, WL-6), so a floor jump
rises about **130 px** (129.7 px stepped in the original's order; 132 px continuous). The sink cap is the shared 2.083 px/f (`0x02155`, `Character.as:997`). Attacks and spells work
under water. Stomping is irrelevant (no stomp).

### 6. Health and power states

Link: `2026-10-07-classic-power-states.md` (Lose Everything, the 75-frame invulnerability, Star 12 s).

**WL-9. The generic Classic states (coded).**

| State | What it gives | Label |
|---|---|---|
| Small | Dies to the first hit. Same size and art as big. | Coded |
| Mushroom | One extra hit. No kit change (no `classicGetMushroomUpgrades`). | Coded |
| Fire Flower | The upgraded outfit only: the sheet's right half, x offset 423 px (`UPGRADE_X_OFS`, `:25`, `:108-109`, `:512-528`). Fighter → Knight, Thief → Ninja, Black Mage → Black Wizard, White Mage → White Wizard (from the art). **No stat or weapon change.** | Coded |

A hit with Lose Everything removes the Flower and the Mushroom together; the outfit goes back to the base one.
The class is kept. The hit response is the generic one (no custom knockback).

**WL-10. A class switch keeps the power state** (`charPState = pState` before the respawn, `:467`, and
`firstCall` reapplies the outfit, `:106-111`).

### 7. Weapons

Links: `2026-10-07-classic-enemy-hp-and-armour.md` and `2026-10-07-classic-bricks-and-shots.md`.

**WL-11.** Damage is at Normal attack strength. For scale: Goomba 250, Koopa 600, Hammer Bro 800, Bowser 2400 / 3600 / 4400, brick 125.

**WL-12. The swing (Fighter and Thief).**

| Property | Value | Source |
|---|---|---|
| Length | 5 steps of 100 ms: **30 frames**. No wind-up. | `animationTmr` 100 ms, frames 6-10 (`:59`, `:89-95`, `:587-604`) |
| Attack box | **15 × 25 px**, from 7.5 px to 22.5 px in front of the body's centre, and from 1 px to 26 px above the feet. Live for all 30 frames. | `ARect` 3.75 × 6.25 at (15, −52) Flash, sprite 101; `checkAtkRect` in `ST_ATTACK` (`:289-292`) |
| Hits | Each target once per swing. | `ATK_DCT` (`Fighter.as:30-40`) |
| Damage | Fighter **300**; Thief **50**. | `DamageValue.as:88-89` |
| Hit counts | Fighter: Goomba 1, Koopa 2, Hammer Bro 3, Bowser 8 / 12 / 15. Thief: Goomba 5, Koopa 12, Hammer Bro 16, Bowser 48. | calculated |
| Bricks | A plain brick the box touches breaks; a ? block bumps (`Brick.hitByAttack` breaks regardless of damage). | `Brick.as:211-221`; inferred, as for Link's sword |
| Armour | Default pierce strength: armoured enemies ignore it (the enemy report's melee rule applies). | `Enemy.as` `checkAttackProps`; inferred |
| Cancel | A ground jump ends it at once; nothing more is hit. | `:363-365`, `:483-486` |

**WL-13. Spell timing (Black Mage).** A **30-frame wind-up** (500 ms, pose `prepareSpell`, `:53-54`,
`:576-585`), then the spell appears and an **18-frame cast pose** (300 ms, `:549-561`). The hero is rooted for
**48 frames** on the ground. A ground jump during the wind-up cancels it and no spell appears; a jump during the
cast pose ends the pose but the spell stays. The spell is placed from the hero's position and facing at the end
of the wind-up. Spells are free, uncapped, and limited only by this timing.

**WL-14. The three spells** (`BlackMageSpell.as`, `BlackMage.as:19-55`). All have no gravity, ignore solid ground,
pierce enemies (`confirmedHit` never destroys them, `:85-94`) and hit each target once. Each brick they touch
takes their damage (all break a 125-HP brick) and each ? block bumps once; they keep going.

| Spell | Input | Damage | Box | Where | Motion and life | Kills |
|---|---|---|---|---|---|---|
| Fire | Attack | **400** | 16 × 18 px | Spawned 19 px ahead of the body's centre and 13.5 px above the feet (`FIRE_X_OFS 38`, `FIRE_Y_OFS 27` Flash) | **3.75 px/f** (`0x03C00`) forward; 3 frames looping every 2 f; removed off screen | Goomba 1, Koopa 2, Hammer Bro 2, Bowser 6 / 9 / 11 |
| Ice | Down + Attack | **400** | **48 × 48 px**, one burst | Centred 50 px ahead and 13.5 px above the feet (`ICE_OFS_PNT (100, 27)`) | Stationary; 5 frames at 75 ms: **22 frames**, then gone | as Fire |
| Bolt | Up + Attack | **600** | **27 × 240 px column** | Centred 50 px ahead; vertically centred 125 px below the screen top (`(GLOB_STG_TOP + GLOB_STG_BOT)/2 + 10`), so it covers the whole screen height | Stationary; 6 frames at 75 ms: **27 frames**, then gone | Koopa 1, Hammer Bro 2, Bowser 4 / 6 / 8 |

Box sizes are from SWF sprite 255 (`HRect` 4 × 4.5 for Fire, 12 × 12 for Ice, 6.75 × 60 for Bolt, centred).
Timers: `AnimationTimers.as:11` (75 ms), `:13` (33 ms). Armour: as WL-12 (default pierce strength).

**WL-15. Our projectiles.** Fire maps onto `ProjectileSpec` (`speed: 0x03C00`, `gravity: 0`,
`hitsTiles: false`, `pierce: true`). Ice and Bolt are zero-speed specs with `lifetime` 22 and 27. Brick
contact must be checked against **every tile the box overlaps, every frame, once per tile** (like the blast loop
at `world.ts:637-642`), not the every-4th-frame centre point that `piercesTiles + breaksBricks` uses today
(`projectile.ts:272-273`). Bolt is anchored to the screen vertically (camera top + 5 px to + 245 px).

**WL-16. White Mage:** no attack is coded. See WL-M1.

### 8. Special abilities

**WL-17. Class switch** (disabled; enabled by WL-M3). The original stores the class in
`StatManager.currentWarriorType` (default Fighter, `StatManager.as:217`) and respawns the hero as that class.

**WL-18. FF pointer** (coded, unreachable): it would open 250 ms after Attack is held and move at 3.33 px/f;
Jump would confirm, Attack cancel (`FinalFantasyPointer.as:13`, `:54-83`). Even if opened, the spell ignores
its position (`BlackMageSpell.as:62-63`, `:75` commented). **Leave it out** (WL-M12).

**WL-19. Nothing else.** No run, slide, charge, tool belt, meter, ammo or drops. Select does nothing. Every
original attack is reached through the class switch (WL-M3), so `&kit=full` (TG-8, TG-44) only starts the hero at
the top power state; there is nothing extra to unlock and no `devKit`.

### 9. Interactions

**WL-20. No head bump (coded).** `brickState = BRICK_NONE` (`WarriorOfLight.as:76`): bricks and ? blocks are solid
ceilings from below; nothing bumps, breaks or pops out (`Brick.as:199`). Hidden blocks are passed through and
never revealed (`Character.as:1464-1466`). Coins and items come only from swings and spells. Our player always
calls `hitBlock` on a head hit (`player.ts:252` → `world.ts:1105-1107`): add `bumpsBlocks: false` (shared with
Vic Viper and with the bricks report's `BRICK_NONE` case, BR-C3).

**WL-21. No stomp (coded).** Landing on an enemy hurts (`_canStomp` false, `Character.as:338`).

**WL-22. Pipes, vines, flagpole, Bowser, axe, lava:** shared, as for every hero. Springs: WL-6's row (the
spring tables need a `warriors` entry).

**WL-23. Two players:** each player has their own class.

### 10. Level data needs

**WL-24.** None.

### 11. Sprites and sound

The original sheet (bitmap 99) is at our scale (1 sheet pixel = 1 of our px): **47 × 47 px cells**, two rows per
class (Fighter, Thief, Black Mage, White Mage, top to bottom), base classes in the left half and Fire Flower
outfits in the right half. The figures are about 16 × 24 px. It is not in our repo, and our heroes use our own
art, so everything below must be drawn as original pixel art in `src/content/sprites/warriors.ts`.

| Pose | Frames per class and outfit | SWF label (sprite 101) |
|---|---|---|
| Stand | 1 | `stand` (1) |
| Walk | 4 | `walkStart`-`walkEnd` (2-5) |
| Swing (weapon drawn in the frame, up to 32 px wide) | 5 | `attackStart`-`attackEnd` (6-10) |
| Spell wind-up | 2 | `prepareSpellStart`-`End` (11-12) |
| Jump | 1 | `jump` (13) |
| Cast | 1 | `castSpell` (14) |
| Fall | 1 | `fall` (15) |
| Hurt | 1 | `takeDamage` (16) |
| Crouch | 1 | `crouch` (17) |
| Die | 1 | `die` (18) |

That is 18 frames × 4 classes × 2 outfits = 144 frames. Spells (sprite 255): Fire 3 frames (about 24 × 12 px),
Ice 5 frames (up to 48 × 48 px), Bolt 6 frames (a 27 px wide column; draw a 16 px tall segment repeated down the
screen). The sheet also has an unlabelled 2-frame green sparkle next to the White Mage rows; it may have been
meant for Cure (inferred).

**Minimum to make it testable:** one original figure in 4 palettes (Fighter red, Thief green, Black Mage blue
with a dark face, White Mage white with red trim), 8 poses (stand, walk × 2, swing × 2 with a 12 px blade,
wind-up, jump, crouch); the Fire Flower outfit as a palette swap; Fire 1 frame, Ice 1 frame, a Bolt segment.

**Sounds:** none exist in the original. Needed: swing, spell wind-up, Fire, Ice, Bolt, Cure, class change.
Placeholders from our current sfx are fine. Music: the level's own (the row lists no game).

### 12. Guide text (`src/game/characters/warriors/guide.ts`)

```ts
export const WARRIORS_GUIDE: CharacterGuide = {
  tagline: 'Four heroes, one party',
  controls: [
    { action: 'left/right', does: 'Walk. Starts and stops at once. You stand still while you attack.' },
    { action: 'jump', does: 'A fixed jump. On the ground it also cancels a swing or a spell.' },
    { action: 'attack', touch: 'ACT', does: 'Fighter and Thief swing. Black Mage casts Fire. White Mage swings a staff.' },
    { action: 'up+attack', touch: 'ACT', does: 'Black Mage: Bolt strikes the whole screen height ahead.' },
    { action: 'down+attack', touch: 'ACT', does: 'Black Mage: Ice bursts ahead. White Mage: Cure brings back the Mushroom.' },
    { action: 'special', touch: 'CLASS', does: 'Hold a direction and press: Up Fighter, Right Black Mage, Down Thief, Left White Mage.' },
    { action: 'down', does: 'Crouch.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Survive one extra hit.' },
    { item: 'flower', does: 'A new outfit for every class.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
  ],
  tips: [
    'You cannot stomp, and blocks do nothing when you hit them from below. Strike or blast them.',
    'Spells take a moment to cast and pass through walls.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack'],
};
```

Adjust the White Mage lines if the owner changes WL-M1 or WL-M2.

### 13. Build steps (in order, files in `$S/main`)

1. Prerequisites: the toggle (`2026-10-07-dev-classic-smbc-rules-toggle.md`) and the four shared Classic reports.
2. `src/game/characters/character.ts`: `bumpsBlocks` (optional). `src/game/entities/player.ts` and
   `src/game/world/world.ts:1105-1107`: skip the head bump when it is false; keep hidden blocks non-solid for it.
3. The rooted flag (WL-7) in `player.ts`, unless a hero report has added it already.
4. `src/game/characters/warriors/classic.ts`: profile, `CharacterDef`, `p.scratch.job`, the swing, the
   wind-up/cast state machine, the class switch, Cure.
5. `src/game/characters/warriors/classic-weapons.ts`: Fire, Ice, Bolt and the per-tile brick check (WL-15).
6. `src/content/sprites/warriors.ts` and its entry in `src/content/sprites/index.ts`.
7. `src/game/characters/warriors/guide.ts`; `src/game/characters/registry.ts` (`CLASSIC_EXTRAS`, last, TG-41);
   `src/game/entities/objects/spring.ts` (the `warriors` entries, WL-6);
   `src/game/scenes/character-select.ts` (the portrait shows the current class).
8. Tests: `src/game/characters/warriors/warriors.test.ts` (the acceptance checks in Notes).

### Missing information to fill in

"Owner" means the owner should confirm or change the default; "coder" means the coder may decide.

| ID | Gap | Suggested default | Decides |
|---|---|---|---|
| WL-M1 | **What the White Mage does.** `WhiteMage.as` has no attack, no spell and no override; Attack does nothing. | Two moves (new design). **Attack: staff swing**, the shared swing (30 f, the same 15 × 25 px box) for **100 damage**, between the Thief (50) and the Fighter (300); FF1's White Mage fights with hammers and staves. **Down + Attack: Cure**, with the Black Mage's 30-frame wind-up and 18-frame cast. When it lands, a small hero gains the Mushroom (the shared grow flash). It can only start while small and with a charge left (WL-M2); otherwise the press does nothing. Up + Attack does nothing. Alternatives: Cure only (no attack, as near to the code as possible), or Cure also gives the partner in 2-player a Mushroom when within 48 px. | owner |
| WL-M2 | **Whether MP exists.** None is coded: spells are free and limited only by the 48-frame cast. | **No MP pool.** The Black Mage stays free, as coded. Cure alone uses FF1-style **spell charges**: 1 charge, refilled at every level start and after every death; pipe and vine transfers inside a level don't refill it. The HUD extra line shows `W.MAGE C1` / `W.MAGE C0`. Alternative: an 8-point MP meter (`meter()`), Fire 1, Ice 2, Bolt 3, Cure 4, refilled at level start. | owner |
| WL-M3 | **How a class is chosen.** The switch is written but commented out; the spawn mapping too. | Enable the written design. **Special while holding exactly one direction**, while idle, on the ground or in the air: Up Fighter, Right Black Mage, Down Thief, Left White Mage. The hero changes in place: same position, speed, facing, power state, invulnerability and Star. Pressing the current class's direction does nothing. Feedback: an 8-frame palette flash and a sound; no cooldown. The class is remembered across deaths and levels (as `StatManager.currentWarriorType`) and starts as the **Fighter**. The select screen has one slot that shows the remembered class. Alternative: four separate select-screen slots and no switching. | owner |
| WL-M4 | **Thief stun.** Commented out. The Thief is very weak (5 swings per Goomba). | No stun, as coded. Optional: a 400 ms hit-stun (24 f), like Simon's and Link's (C2). | owner |
| WL-M5 | **Fire Flower outfits do nothing but change art.** | Keep that (as coded). Optional upgrades if the owner wants them: Knight sword 400, Ninja swing 100, Black Wizard spells +100, White Wizard 2 Cure charges. | owner |
| WL-M6 | **No fall cap** in the original. | 10 px/f (`0x0A000`) as a collision safety cap. A fall from the top of the screen reaches about 9.7 px/f, so it never binds in normal play. | coder |
| WL-M7 | **When the swing's box is live.** The code tests it for all 30 frames; the art may suggest fewer. | All 30 frames, as coded. | coder |
| WL-M8 | **A hit during an action.** The generic damage code doesn't say what happens to a swing, wind-up or cast. | A hit ends the action (idle again); a wind-up in progress casts nothing. | coder |
| WL-M9 | **Bricks under a big spell.** As coded, Ice breaks every plain brick in a 48 × 48 px box (up to 3 × 3 tiles) and Bolt every plain brick in a 2-to-3-tile-wide column of the whole screen. This can strip a level. | Keep it as coded. Alternative: spells bump ? blocks but don't break plain bricks. | owner |
| WL-M10 | **Sounds.** None exist. | Placeholders from our sfx for the 7 sounds in section 11. | coder |
| WL-M11 | **Art.** None in our repo. | The list and minimum in section 11. Draw original figures, not copies of the FF1 sprites. | owner |
| WL-M12 | **FF pointer** (unreachable in the original). | Leave it out. | owner |
| WL-M13 | **Names.** Menu "L. Warriors", HUD `WAR_OF_LIGHT` (too wide). | Menu "Warriors of Light", HUD `WARRIOR`; Toad says "THANK YOU WARRIOR!". | owner |
| WL-M14 | **Hitbox width.** The original is 14 px wide; our heroes are 12 px. | 14 × 26 / 14 × 15 as in the SWF (WL-3). Use 12 if the owner wants the roster to match. | owner |
| WL-M15 | **The huge underwater jump** (about 130 px, no stroke). | Keep it, as coded and as the other non-Mario Classic heroes do (classic-swimming). | owner |

## Actual

Current has no Final Fantasy hero. The roster is 8 heroes (`src/game/characters/registry.ts:12`) and an unknown
`char` id falls back to Mario (`:14-16`). `Player.def` is fixed for the run (`player.ts:113-114`), which is
why the class lives in `p.scratch`. Every head hit bumps a block (`world.ts:1105-1107`), there is no rooted
state, and `piercesTiles + breaksBricks` projectiles check one point every 4th frame (`projectile.ts:272-273`).
With `rules === 'current'` all of this must stay exactly as it is.

## How often

every time

## Notes

- **Sources:**
  - Original (after `tr '\r' '\n'`, under `$S/orig/src/com/smbc/`): `characters/WarriorOfLight.as` (all,
    cited by line above), `characters/Fighter.as:11-41`, `characters/Thief.as:12-36`,
    `characters/BlackMage.as:11-55`, `characters/WhiteMage.as:1-12`, `projectiles/BlackMageSpell.as:17-110`,
    `data/Spell.as:7-9`, `displayInterface/FinalFantasyPointer.as:13-83`, `data/DamageValue.as:88-92`,
    `data/HealthValue.as:9-11`, `:19`, `:30`, `data/AnimationTimers.as:10-13`, `data/CharacterInfo.as:58-59`,
    `:125-126`, `managers/StatManager.as:217`, `characters/Character.as:338`, `:993-998`, `:1336-1339`,
    `:1464-1466`, `:2037-2066`, `ground/Brick.as:174-228`, `projectiles/Projectile.as:34-53`,
    `main/AnimatedObject.as:35`, `:266`.
  - SWF (`$S/flash/smbc3.swf`): frame labels and hit rectangles of sprites 101 (`WarriorOfLightMc`) and 255
    (`BlackMageSpellMc`), read with `$S/classic/tools/swf_bounds.py`. The sheet was extracted to
    `$S/classic/art/bmp_99.png` with `$S/chars/work/py/bmp.py` (reference only, not for our repo).
  - Comparison: `$S/chars/missing-final-fantasy.md`, `FINAL-REPORT.md` 4.6, `verify/C.md` (the jump cancels a
    swing).
  - Ours: `src/game/characters/character.ts:103-147`, `profile.ts:31-68`, `registry.ts:12-16`,
    `entities/player.ts:113-114`, `:150-262`, `world/world.ts:637-653`, `:1105-1107`,
    `entities/projectiles/projectile.ts:262-276`.
- **Implementation hints:**
  - Keep the class in `p.scratch.job` and the action state in `p.scratch` (`act`: 0 idle, 1 swing, 2 wind-up,
    3 cast; `actT`: frames left; `spell`). `behaviour.update` runs the state machine, sets the rooted flag,
    and publishes `p.activeMelee` during a swing.
  - The swing is the same code for Fighter, Thief and (by WL-M1) White Mage, with damage 300 / 50 / 100.
  - Read Special + direction on the frame Special is pressed; require exactly one of the four directions.
- **Acceptance checks** (headless, `?rules=classic`):
  - Standing jump apex 68.3 ± 1 px; land after 53 ± 1 f; no difference between a tapped and a held jump.
  - Right held 60 frames from rest: 100 ± 1 px, full speed on the first frame; release: stops on that frame.
  - Fighter: one swing kills a Goomba, two a Koopa. Thief: five swings per Goomba.
  - Swing on the ground: x unchanged for 30 frames even with Right held. Jump on frame 5 of a swing: the swing
    ends and an enemy entering the box afterwards is not hit.
  - Black Mage Fire: the fireball appears on frame 30 after the press; the hero is rooted 48 frames; the
    fireball passes a Koopa and a pipe and keeps going; it breaks a brick and keeps going.
  - Bolt: kills a Koopa 50 px ahead at any height on screen. Ice: one burst, 22 frames.
  - Jump under a ? block: no item, no bump. The hidden 1-up block in 1-1 is not revealed.
  - Special + Right: becomes the Black Mage, keeps the Mushroom.
  - Water level: a floor jump rises about 130 px.
  - Current unchanged: run the existing test suite and headless sims with `rules === 'current'`; all stay green.
- **Confidence:** source only. The hero never ran in any build of the original. Boxes and the Bolt/Ice shapes are
  read from the SWF. Heights, frame counts and hit counts are calculated. Melee breaking bricks and armour
  immunity are inferred from the shared code. Everything labelled "new design" is a proposal.
- **Open questions** (defaults in the table above):
  - Whether the green sparkle cells on the sheet were meant for Cure. Default WL-M1 does not depend on it.
  - Whether the owner wants this hero at all. The comparison report (D9) suggested skipping both cut prototypes.
- **Related reports:** `2026-10-07-dev-classic-smbc-rules-toggle.md`, `2026-10-07-classic-power-states.md`,
  `2026-10-07-classic-enemy-hp-and-armour.md`, `2026-10-07-classic-bricks-and-shots.md`,
  `2026-10-07-classic-swimming.md`, `2026-10-07-vicviper-build-classic-character.md` (shares `bumpsBlocks`),
  `2026-10-07-classic-follow-ups.md`. Open reports that touch the same code:
  `2026-10-06-water-non-mario-heroes-stroke.md`, `2026-10-06-water-surface-air-physics.md`,
  `2026-10-05-vine-left-right-does-not-step-off.md`, `2026-10-05-springboard-bounce-too-high.md`.
