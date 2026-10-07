# Vic Viper (cut Gradius prototype): build a Classic-only flying hero with auto-scroll, a bullet and a Gradius power bar whose power-ups must be designed

- **Severity:** feature request (new character, Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=vicviper` (once the toggle exists; today `?dev=1&level=1-1&char=vicviper` shows the Current behaviour)
- **Character and power:** Vic Viper, all power states
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=vicviper`. Today the unknown id falls back to Mario (`src/game/characters/registry.ts:14-16`), and the select screen has no Vic Viper.
2. Once built, open `?dev=1&rules=classic&level=1-1&char=vicviper`.
3. Do nothing for 10 seconds. The screen scrolls right by itself and carries the ship along.
4. Fly in all 8 directions and press Attack. One bullet goes right per press and flies through the ground.
5. Hover over the first pipe you can enter and press Down while in mid-air. The ship enters the pipe.
6. Switch Rules back to Current. Vic Viper is gone from the select screen, and `char=vicviper` falls back to Mario again.

## Expected

### Three labels used below

Vic Viper was **never playable** in 3.1.21. Every requirement carries one of these labels:

- **Coded:** written in the original source. It would run if the class were compiled. Nobody ever played it.
- **Stub:** it has a name, art, an upgrade ID or a sound name, but no behaviour.
- **New design:** proposed here because the source has nothing. Each one also has an entry under
  "Missing information to fill in" (VV-M#), so the owner can accept or change it.

### 1. Status in 3.1.21

**VV-1. Cut prototype.** The roster row is commented out (`CharacterInfo.as:56-57`). The graphics sets are
commented out (`BmdInfo.as:1296-1323`). The class code (`VicViper.as`, `VicViperProjectile.as`,
`VicViperIcon.as`) is **not compiled into the shipped SWF**. Only the art shipped: the ship clip (SWF sprite
115), projectiles and shield (243), simple effects (114), pickups (126), HUD icons (281) and one sprite sheet
(bitmap 112, 449 × 141 px). Fidelity therefore means "what the code would do". There is no played behaviour to
match.

| Part | Status |
|---|---|
| 8-way flight with gravity off | Coded |
| Auto-scroll that carries the ship | Coded |
| Bullet (right only, through ground, breaks bricks) | Coded |
| Pipe entry in mid-air; auto-scroll pauses in pipes | Coded |
| Bowser axe forces the ship down | Coded |
| Power bar: capsules move a selector, maxed slots are skipped | Coded (counting and HUD only) |
| Spending the selected power-up | **Never written** (no button, no code) |
| Speed Up, Missile, Double, Laser, Option, Shield | **Stub** (upgrade IDs, art and a sound name; no behaviour) |
| Blue capsule (art `poewrupBomb`) | Stub (art only) |
| Sounds | Stub (all 10 entries commented out, `MusicInfo.as:868-877`) |
| Skins | Stub (6 commented sheets; only one names Gradius) |
| Right and top screen edges, being crushed by the scroll | **Never written** |
| Where capsules come from under Classic power-up mode | **Never written** (see VV-21) |

Corrections to the unit file (`missing-pit-vicviper.md`), found while re-reading the source for this report:
- It says normal follow-scrolling still applies on top of auto-scroll. It does not. While auto-scroll is on,
  `Level.scrollScreen` resets the screen to its position from the start of the call (`x = lastX`,
  `Level.as:2762`, `:2881`) and then moves it by the auto amount only. The camera ignores the ship.
- It says every upgrade block gives a capsule. That is true only in Modern mode. In Classic mode
  `canGetMushroom` is forced true (`Character.as:3282-3285`), so `StatManager.getRandomUpgrade` returns a
  Mushroom, then a Fire Flower, and never a capsule (`StatManager.as:1351-1362`).

### 2. Character definition

**VV-2. One Classic-only `CharacterDef`** in `src/game/characters/vicviper/classic.ts`, registered in
`CLASSIC_EXTRAS` and shown only while dev mode is on and Rules is Classic SMBC (TG-41 to TG-43). Sketch against `src/game/characters/character.ts:103-147`:

```ts
export const VICVIPER_CLASSIC: CharacterDef = {
  id: 'vicviper',
  name: 'Vic Viper',
  hudName: 'VIPER',                 // VV-M24; the original HUD name is VIC_VIPER
  rules: 'classic',                 // TG-18, TG-41
  movement: VIC_PROFILE,            // with the new `flight` block (VV-6)
  damage: { kind: 'powerup', states: CLASSIC_STATES }, // the shared Classic states (classic-power-states)
  stomps: false,                    // _canStomp is false for everyone but Mario (Character.as:338)
  crouches: false,
  canBreakBricks: () => false,
  bumpsBlocks: false,               // NEW flag, shared with the Warriors of Light (VV-25)
  pipesAirborne: true,              // NEW flag (VV-27)
  autoScroll: { speed: 0x00d55 },   // NEW (VV-9)
  hitbox: () => ({ w: 15, h: 10 }), // VV-3
  sprite: vicSprite,                // VV-38
  blockPowerUp: (p) => (p.powerState === 'small' ? 'mushroom' : 'flower'), // 'flower' = capsule, VV-M3
  jumpSfx: () => '',                // the ship never jumps
  behaviour: VIC_BEHAVIOUR,         // flight input, bullet, power bar
  portrait: { sheet: 'vicviper', palette: 'vicviper', frame: 'vic-portrait' },
  drop: vicDrop,                    // a capsule, VV-M3
  powerBar: vicPowerBar,            // NEW optional HUD hook (VV-20)
  guide: VIC_GUIDE,
  touchLabels: (p) => ({ attack: 'SHOOT', jump: barLabel(p), special: barLabel(p) }),
};
```

No `tools`, `meter`, `reserve`, `devKit` or `startHp`: the ship has no ammo, belt or HP. Its only original weapon is
the bullet, which it always has, so `&kit=full` (TG-8, TG-44) just starts it at the top power state and Select has
nothing to cycle.

**VV-3. Hitbox: 15 × 10 px, the same in every state.** The clip's hit rectangle is an 8 × 8 Flash-px `HRect`
scaled 3.75 × 2.5 and placed at (−15, −20) from the registration point (SWF sprite 115, frame 1). That is
30 × 20 Flash px, or 15 × 10 px, centred horizontally on the ship and resting on the registration point. The
ship never changes size with the Mushroom (no `SUFFIX_VEC`; every state uses the same frames).

**VV-4. Select-screen slot and portrait.** Vic Viper is the fifth entry of `CLASSIC_EXTRAS` (TG-41: Bass, Sophia
III, Proto Man, Pit, Vic Viper, Warriors of Light), on the select screen's second row. The portrait is a 16 × 16 px icon (the original
has a `portrait` frame in its HUD clip, SWF sprite 281 frame 1). Menu name "Vic Viper".

### 3. Controls

| Control | Classic | Label |
|---|---|---|
| D-pad | Fly in 8 directions at a fixed speed (VV-5). | Coded |
| Attack | One bullet per press (VV-14). Holding does not repeat. | Coded |
| Jump | Spend the selected power-up (VV-M1). The coded `pressJmpBtn` does nothing for the ship. | New design |
| Special | Same as Jump, so touch players have a labelled button (VV-M1). | New design |
| Select | Nothing. | Coded (no tools) |
| Down over a vertical pipe / Right into a side pipe | Enter it, in mid-air too (VV-27). | Coded |
| Pose | Up held (Down not held): `up` pose. Down held (Up not held): `down` pose. Otherwise the neutral pose. The code asks for a frame `idle` that the art doesn't have (the label is `normal`), so use the neutral pose. | Coded (bug fixed) |
| Facing | Always right. The ship never flips. | Coded |
| Run | None. Holding Attack does not run. | Coded |

### 4. Movement and jumping

**VV-5. Flight.** Gravity is off (`defyGrav = true`, `VicViper.as:114`). Each frame the input sets the speed
directly, with no acceleration (`movePlayer`, `VicViper.as:158-176`):

| Input | vx (before the carry) | vy |
|---|---|---|
| Right only, no wall on the right | +1.667 px/f (`0x01AAB`) | – |
| Left only, no wall on the left, auto-scroll on | −2.5 px/f (`0x02800`): 200 + 100 Flash px/s | – |
| Left only, auto-scroll off | −1.667 px/f | – |
| Both or neither | 0 | – |
| Up only | – | −1.667 px/f |
| Down only | – | +1.667 px/f |
| Both or neither | – | 0 |

Diagonals are not normalised: about 2.36 px/f. Walls stop the ship as solid tiles (the code checks
`wallOnRight` / `wallOnLeft`). There is no jump, run, crouch, slide, coyote time or fall cap on land. Speeds in
Flash: `MOVEMENT_SPEED = 200` (`:91`), `IDLE_X_SPEED = Level.SCROLL_SPEED_AUTO = 100` (`:90`).

**VV-6. A new `flight` movement mode.** Add `flight?: { speed: number; leftExtra: number }` to
`MovementProfile` (`src/game/characters/profile.ts:31-68`) with `speed: 0x01AAB` and `leftExtra: 0x00D55`.
When it is set, `Player.update` (`src/game/entities/player.ts:150`) uses VV-5 instead of the crouch, ground,
air, jump and gravity code (`player.ts:174-262`), still calls `moveX`/`moveY` for tile collision, and passes
no head-bump callback (VV-25). `p.body.onGround` stays false. The Speed Up power-up changes `speed`
(VV-M4).

**VV-7. Net speeds (coded, derived).**

| Input | World speed | Speed on screen |
|---|---|---|
| Right | +2.5 px/f | +1.667 px/f |
| None | +0.833 px/f | 0 |
| Left | −1.667 px/f | **−2.5 px/f** |

So the ship backs up faster than it advances. This is how it is coded. VV-M13 asks whether to keep it.

**VV-8. Jumping:** none. The ship has no jump, so the jump constants (`jump` tiers) are unused. Give the profile
one tier with zeros so shared code doesn't break.

### 4a. Auto-scroll (coded) and screen edges

**VV-9. Auto-scroll speed:** 100 Flash px/s = **0.833 px/f** (`0x00D55`) (`Level.as:346`). Each frame the camera
moves right by that amount, and the ship is moved right by the same amount (`Level.as:2879-2887`).

**VV-10. The camera ignores the ship while auto-scroll is on** (`x = lastX`, `Level.as:2881`). Our
`camera.follow` (`src/game/world/camera.ts:21-26`, called at `world.ts:818`) must not run then.

**VV-11. When it runs.** Auto-scroll starts every time the ship spawns: level start, respawn, and every area
entered through a pipe, vine or pit transfer (`VicViper.setStats` calls `level.autoScrollStart()`, `:118`).

**VV-12. When it stops.**
- At the camera's right limit: the map end, or the Bowser scroll stop (our `scrollStop` zone, the original's
  axe limit). It stops for good and the screen stays locked (`autoScrollStop(true)`, `Level.as:2925-2931`).
- On pipe entry (vertical or side): stop and lock the screen (`VicViper.as:127-131`, `:146-150`). After a pipe
  exit finishes, it starts again (`:140-144`; `Level.as:1593-1598`).
- While the flagpole or the Bowser-axe sequence runs, and while the game is frozen (grow flash, pause).

**VV-13. Screen edges.**
- **Left (coded, shared):** the ship cannot pass the screen's left edge. The original keeps a 3 px buffer
  (`SCREEN_UNWALKABLE_BUFFER = 6` Flash px, `Level.as:173`, `:2015-2025`). Keep our clamp at
  `camera.x` (`world.ts:779-782`), which every hero already uses.
- **Right, top, crush:** never written. See VV-M11 and VV-M12.
- **Bottom (coded, shared):** falling below the screen bottom kills or transfers as for every hero
  (`world.ts:821-826`). The ship only goes there if the player flies down into a pit.

### 4b. How auto-scroll works in SMB levels built for walking

The original only defines VV-9 to VV-13. Everything else here follows from the shared level code, with the
proposed defaults marked "new design".

- **Timing.** At 0.833 px/f every SMB1 level fits in its timer. Checked from our `.map` widths
  (`src/content/levels/world*/`): the tightest is 8-1 (400 tiles, about 123 s of scrolling against a 160 s
  timer, 37 s spare). The castle loops in 4-4, 7-4 and 8-4 cost extra time on a wrong path. The Lost Levels
  were not checked.
- **Pits.** The ship flies, so pits only matter if it flies below the screen bottom (VV-13). Pit zones that
  transfer to another area still transfer.
- **Pipes.** Down while resting on a pipe top (the ship stops on the solid top, so its bottom touches it), or
  Right at a side-pipe mouth. Auto-scroll stops and the screen locks; it resumes after the exit (VV-12). A
  one-screen bonus room never scrolls, because the camera starts at its limit. Exit pipes at a map end still
  work, because the scroll stops with the pipe on screen.
- **Intro areas (1-2, 4-2 and others).** Our scripted auto-walk into the pipe (`world.autoWalk`) drives the
  ship right at its normal speed along the same row. No change is needed beyond VV-27.
- **Castles.** Auto-scroll runs. Narrow corridors and firebars are the danger. The castle loops shift the
  camera and the players back together (`world.ts:851-882`); auto-scroll continues from there.
- **Bowser.** Auto-scroll stops at the scroll stop, with the axe in view, and the fight is on a fixed screen.
  The ship can shoot Bowser (VV-14 hit counts) or fly over him to the axe. Nothing prevents flying over him;
  keep it (it is how the code behaves).
- **Bowser axe.** Coded: touching the axe turns screen scrolling back on and presses Down, so the ship drops
  towards the floor (`VicViper.as:152-157`). Ours: use the shared sequence (`world.ts:1919-2008`). It already
  lowers the hero to the floor (`bossWalkFall`, `:2014`) and moves it right at 1 px/f to Toad. Draw the ship
  in its neutral pose with the jet flame. Toad says "THANK YOU VIPER!".
- **Flagpole.** Coded: the generic slide. Whether the ship then sinks or stays level was never settled. Ours:
  use the shared scripted sequence (`world.ts:1752-1910`: slide, hop, walk to the castle) with the neutral
  pose. The ship can always reach the top of the pole (5000 points); see VV-M23.
- **Vines, springs, water:** VV-29, VV-30 and VV-17.

### 5. Swimming

**VV-17. No change in water.** Flight works the same; there is no stroke (link: `2026-10-07-classic-swimming.md`,
the ship is not a swimmer). The shared water rule caps downward speed at 250 Flash px/s = 2.083 px/f
(`Character.as:993-998`). At the base speed (1.667) it never binds. With Speed Up level 2 or more (VV-M4) it
clips downward flight to 2.083 px/f in water; keep that. Stomping is irrelevant (the ship can't stomp).

### 6. Health and power states

Link: `2026-10-07-classic-power-states.md` for the shared states, Lose Everything, the 75-frame invulnerability
and the 12 s Star.

**VV-18. Classic gives the ship a Mushroom (coded).** The class sets `canGetMushroom = false` (`:109`), but
Classic power-up mode overrides it (`Character.as:3282-3285`). So in Classic:

| State | What it gives the ship | Label |
|---|---|---|
| Small | Dies to the first hit. | Coded |
| Mushroom | One extra hit. No size or palette change (`PAL_ORDER_ARR` holds only the power-up flash). | Coded; visual cue VV-M10 |
| Fire Flower | Nothing extra (no `classicGetFireFlowerUpgrades`). | Coded; see VV-M3 |

**VV-19. What a hit keeps.** With Lose Everything a hit removes the Mushroom and the Flower. Capsules on the bar
are kept: they are not in the lose lists, and `startAndDamageFcts` does nothing on damage (`:121-125`). The
power-ups themselves (new design) are also kept on a hit. **Death clears everything:** `Character.cleanUp`
removes every upgrade of a dead character (`Character.as:3110-3116`), so the bar empties. Death also removes
speed, options and the other power-ups (new design, same rule).

### 7. Weapons

Links: `2026-10-07-classic-enemy-hp-and-armour.md` (HP, armour) and `2026-10-07-classic-bricks-and-shots.md`
(shots through ground, bricks).

**VV-14. Bullet (coded).**

| Property | Value | Source |
|---|---|---|
| Speed | 600 Flash px/s = **5 px/f** (`0x05000`), always right, no gravity | `VicViperProjectile.as:17-18`, `:23` |
| Spawn | Centre at the hitbox's right edge, 4 px above the hitbox bottom (`ny - 8` Flash) | `:19-20` |
| Box | 10 × 7 px (`HRect` 2.5 × 1.75 at (−10, −7) Flash), centred | SWF sprite 243, frame 1 |
| Damage | **200** (`DamageValue.VIC_BULLET`) | `DamageValue.as:86` |
| Cap / rate | No on-screen cap, no fire-rate limit: one per Attack press | `VicViper.as:277-284` |
| Ground | Never collides with solid ground or pipes | no ground hit tests |
| Bricks | Hits the first brick or block it touches: a plain brick takes 200 (brick HP 125) and breaks; a ? block or item brick bumps and gives its item. **The bullet is destroyed** either way. | `Projectile.as:44`; `Brick.as:181-192`; `Projectile.as:135-151` |
| Enemies | Non-piercing: destroyed on the first enemy. Armoured enemies (Buzzy Beetle, Spike Top, Bullet Bill, Barrel) take nothing. | `Projectile.as:42`, `:135-151` |
| Off screen | Removed | `destroyOffScreen` |

Hit counts at Normal attack strength (estimates): Goomba 2, Koopa 3, Hammer Bro 4, Bowser 12 (2400 HP),
18 (3600) or 22 (4400). The ship cannot hurt armoured enemies with the coded kit and cannot stomp them; it must
avoid them (the Missile, VV-M5, would fix that).

**VV-15. Our projectile for the bullet.** `piercesTiles: true` and `breaksBricks: true` (`projectile.ts:269-273`)
come close, but today the shot keeps flying and only checks for bricks every 4th frame (`(this.age & 3) === 0`).
At 5 px/f that skips 20 px between checks and can miss a 16 px brick. The Classic bullet must check every frame,
strike the first brick or block it overlaps through `world.breakAt` (which bumps item blocks, `world.ts:646-653`),
then be destroyed.

**VV-16. Planned weapons:** Missile, Double, Laser, Option, Shield. All are stubs; see VV-M4 to VV-M9.

### 7a. The power bar (coded part)

**VV-20. Bar and selector.** Six slots in this order: 1 Speed, 2 Missile, 3 Double, 4 Laser, 5 Option, 6 Shield
(`PL_*`, `VicViper.as:74-82`). The art labels them SPEED, MISSILE, DOUBLE, LASER, OPTION and **?** (the shield
slot shows "?", as in NES Gradius; bitmap 112). Slot 0 means nothing selected. Add an optional
`powerBar?(p): { slots: { label: string; available: boolean }[]; selected: number } | null` to
`CharacterDef`, drawn by `src/game/hud/hud.ts` on the third HUD row (y 24, where the tool belt goes): 6 cells
of 16 × 8 px from x 24, the selected cell drawn highlighted, and the selected slot's full name in text at x 128.
A maxed slot shows blank (the original's name plate is blank for an unavailable slot, `VicViperIcon.as:41-52`).

**VV-21. How it fills (coded).** Each capsule moves the selector one **available** slot to the right. A slot is
unavailable once maxed: Speed at level 5, Missile at 1, Double at 2, Laser at 2, Option at 4, Shield at 1
(`powerLevelIsAvailable`, `:255-275`). Get sound: "get power-up". What happens past the last slot is VV-M2.
**Where capsules come from in Classic is never written** (VV-1); see VV-M3.

**VV-22. Spending (never written).** Nothing in the source spends the selected power-up. `SFX_VIC_USE_POWER_UP`
is named but never played. See VV-M1.

### 8. Special abilities

**VV-23.** Free flight (VV-5), the auto-scroll (VV-9), mid-air pipe entry (VV-27) and the power bar (VV-20). No
others are coded.

**VV-24. Nothing else.** No crouch, slide, charge, tool belt, meter, ammo or E-tank. Select does nothing.

### 9. Interactions

**VV-25. No head bump (coded).** `brickState = BRICK_NONE` (`VicViper.as:108`). Flying into a brick or ? block
from below neither bumps nor breaks it; the block is a solid ceiling (`Brick.as:199`). Hidden blocks are passed
through and never revealed (`Character.as:1464-1466`). Our player always calls `hitBlock` on a head hit
(`player.ts:252` → `world.ts:1105-1107`). Add a `bumpsBlocks: false` flag (the bricks report's
`BRICK_NONE` case, BR-C3, needs the same for Samus's ball and Ryu's cling, so share it) so the callback is not passed; hidden blocks must not become solid for this hero.

**VV-26. No stomp (coded).** Touching any enemy from any side hurts the ship (`stomps: false`).

**VV-27. Pipes in mid-air (coded).** `canEnterPipesUngrounded = true` (`:117`; `Character.as:1308-1313`). In
`world.checkPipes` (`world.ts:1527-1529`) skip the `onGround` test when `def.pipesAirborne` is set. Keep the
rest of the test (inside the pipe's 2 tiles, bottom within 1 px of the top for down pipes; the feet row in the
mouth rows for side pipes). Exiting a pipe turns gravity back off (`:133-138`).

**VV-28. Lava, firebars, Podoboos, Bowser's fire, hammers:** shared, as for every hero.

**VV-29. Vines.** Not handled in the original (the class never mentions them). Default in VV-M16.

**VV-30. Springs.** Not handled. Default: a spring is a solid block for the ship and never launches it
(`world.ts:762-767` must skip the ride for a flying hero).

**VV-31. Two players.** The original is single-player. Default in VV-M14.

### 10. Level data needs

**VV-32.** None. The ship uses the normal levels. No tiles or zones are added.

### 11. Sprites and sound

The original sheet (bitmap 112) is drawn at our scale (1 sheet pixel = 1 of our px). It is not in our repo, and
our heroes use our own art, so everything below must be drawn as original pixel art in
`src/content/sprites/vicviper.ts`. SWF labels are given where they exist.

| Sprite | Frames | Size (our px) | SWF label |
|---|---|---|---|
| Ship, neutral | 2 | about 26 × 12 drawn, 32 × 16 cell | `normal` (VicViperMc frames 1-2) |
| Ship, tilting up | 4 | same | `up` (3-6) |
| Ship, tilting down | 4 | same | `down` (7-10) |
| Jet flame | 4 | about 6 × 3 | `jetFlame` (VicViperSimpleGraphicsMc 1-4) |
| Jet flame with Speed Up | 4 | about 8 × 3 | `jetFlameSpeed` (5-8) |
| Ship explosion (death) | 4 | about 24 × 24 | `deathExplosion` (9-12) |
| Enemy explosion (optional) | 8 | about 16 × 16 | `enemyDeath` (13-20) |
| Shot hits a wall | 1 | 8 × 8 | `shotHitWall` (25) |
| Bullet, forward / rear | 1 + 1 | 10 × 7 | `bulletFront`, `bulletBack` |
| Laser | 1 | 16 × 6 | `laser` |
| Missile | 4 (+4 spare) | 10 × 10 | `missileDown-1..4` (`missileUp-1..4` spare) |
| Option orb | 4 | 12 × 8 | `option` (SimpleGraphics 21-24) |
| Shield top / bottom, normal and damaged | 4 each, 16 in all | 13 × 13 | `shieldTop`, `shieldBot`, `shieldTopDamaged`, `shieldBotDamaged` |
| Red capsule | 4 | 16 × 16 | `powerup` (VicViperPickupMc 1-4) |
| Blue capsule (optional) | 4 | 16 × 16 | `poewrupBomb` [sic] (5-8) |
| Power bar cells, selector, slot names | 6 cells + selector | 16 × 8 per cell | `powerUpBar`, `powerUpSelectorStart/End`, `nameBar-0..6` |
| Portrait | 1 | 16 × 16 | `portrait` (VicViperIconMc 1) |
| Vic-specific Toad and princess (optional) | 1 + 1 | 16 × 24 | `toad`, `princess` (VicViperIconMc 22-23) |

**Minimum to make it testable:** the neutral ship (1 frame, one palette), the bullet, the red capsule and the
HUD bar drawn with our 8 px font (two-letter cells SP, MS, DB, LS, OP, ?). The tilt frames, flames, options,
shield, missile and laser frames can follow.

**Sounds** (the original's names, all commented out and taken from the Life Force NSF): shoot, laser, get
power-up, use power-up, die, damage enemy, kill enemy, armoured (no damage), damage boss, new life. Placeholders
from our current sfx are fine for testing. Music: the level's own (VV-M21).

### 12. Guide text (`src/game/characters/vicviper/guide.ts`)

```ts
export const VIC_GUIDE: CharacterGuide = {
  tagline: 'A starfighter in a walking world',
  controls: [
    { action: 'left/right', does: 'Fly. The screen scrolls by itself and carries you along.' },
    { action: 'up', does: 'Fly up.' },
    { action: 'down', does: 'Fly down. Over a pipe, go in, even in mid-air.' },
    { action: 'attack', touch: 'SHOOT', does: 'Fire a shot to the right. It flies through walls and breaks bricks.' },
    { action: 'jump', touch: 'POWER', does: 'Take the power-up lit on the bar.' },
    { action: 'special', touch: 'POWER', does: 'Also takes the lit power-up.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Survive one extra hit.' },
    { item: 'flower', does: 'A power capsule: lights the next slot on the bar.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
    { item: 'drops', does: 'Defeated enemies sometimes leave a power capsule.' },
  ],
  tips: [
    'You cannot stomp. Shoot or steer clear.',
    'Bumping blocks from below does nothing. Shoot them instead.',
    'Do not get pinned against a wall by the scrolling screen.',
  ],
  demo: ['idle', 'walk', 'attack'],
};
```

Adjust the power-up lines if the owner changes VV-M1 to VV-M9.

### 13. Build steps (in order, files in `$S/main`)

1. Prerequisites: the toggle (`2026-10-07-dev-classic-smbc-rules-toggle.md`) and the four shared Classic reports.
2. `src/game/characters/profile.ts`: add `flight`. `src/game/entities/player.ts`: the flight branch (VV-6).
3. `src/game/characters/character.ts`: add `bumpsBlocks`, `pipesAirborne`, `autoScroll` and `powerBar`
   (optional fields, so Current heroes are untouched).
4. `src/game/world/camera.ts`: an `auto` speed and a `stopped` flag. `src/game/world/world.ts`: advance the
   camera and carry the ship (VV-9 to VV-12), skip `follow` while auto, pause it for pipes and clear sequences,
   the edge rules (VV-13, VV-M11, VV-M12), the airborne pipe test (VV-27), no spring ride (VV-30).
5. `src/game/world/world.ts` `hitBlock` / `player.ts:252`: no head bump when `bumpsBlocks === false` (VV-25).
6. `src/game/characters/vicviper/classic.ts`, `classic-weapons.ts` (bullet, then the power-ups) and
   `guide.ts`.
7. `src/game/entities/objects/pickup.ts`: a new `PickupKind` `'power-capsule'` (not the existing `'capsule'`,
   which is Bill's weapon pickup). `src/game/hud/hud.ts`: the power bar.
8. `src/content/sprites/vicviper.ts` and its entry in `src/content/sprites/index.ts`.
9. `src/game/characters/registry.ts`: add it to `CLASSIC_EXTRAS` after Pit (TG-41). Never add it to `CHARACTERS`.
10. Tests: `src/game/characters/vicviper/vicviper.test.ts` (the acceptance checks in Notes).

### Missing information to fill in

Each gap has a suggested default the coder can build now. "Owner" means the owner should confirm or change it;
"coder" means the coder may decide.

| ID | Gap | Suggested default | Decides |
|---|---|---|---|
| VV-M1 | **How a power-up is spent.** No button and no code exist. | **Jump** spends it, and **Special** does too. This matches NES Gradius (A = power-up, B = shoot): our Jump key Z sits where A does, our Attack key X where B does. Spending gives the selected slot's next level, empties the bar (selector to 0, capsule count 0) and plays "use power-up". With nothing selected, the press does nothing. | owner |
| VV-M2 | **What happens past the last slot.** Coded: the bar resets to 0 and all capsules are removed (`updatePowerLevel`, `:218-242`). A bug then stores the capsule anyway, so the next capsule jumps 2 slots (6 → 0 → 2). | The next capsule after the last available slot selects **slot 1 (Speed)**, as in Gradius. This is also what the original's capsule count works out to; only its display was wrong. If every slot is maxed, a capsule gives 1000 points instead. | owner |
| VV-M3 | **Where capsules come from in Classic.** Coded: in Classic a block gives a Mushroom, then Fire Flowers, never a capsule (`StatManager.as:1351-1362`). So under Classic rules the bar never fills. | (a) The first power-up block gives the Mushroom (the Classic extra hit). Every later one gives a **capsule** in place of the Fire Flower (Vic's `onPowerUp('flower')` adds a capsule; draw the rising item as the capsule for this hero). (b) Defeated enemies drop a capsule at the shared Classic drop rate (PS-C15 in `2026-10-07-classic-power-states.md`: 25% per kill, with the brick and coin-block fractions). The ship has no ammo, so the capsule takes the place of the ammo drop. The commented `maxTierUpgrades` case for the ship returned a capsule (`StatManager.as:1285-1286`), which supports blocks giving capsules. | owner |
| VV-M4 | **Speed Up.** Upgrade IDs `UPG_speed1-5` only. Developer note: Gradius allows unlimited speed-ups, Gradius II 7, Life Force 10 (`:56-58`). | 5 levels, each adding 0.333 px/f (`0x00555`) to `flight.speed`: 1.667 (base), 2.0, 2.333, 2.667, 3.0, 3.333 px/f. The extra 0.833 px/f when flying left stays. The jet flame switches to `jetFlameSpeed` from level 1. | owner |
| VV-M5 | **Missile.** Art only (`missileDown-1..4`, `missileUp-1..4`). Cap 1 level. | Gradius ground missile. While held, each Attack press also launches one missile if none of the ship's own is on screen. Spawn at the hitbox's bottom centre. It flies down and forward at vx 1.5, vy 2.0 px/f (`0x01800`, `0x02000`) with no gravity. On touching the top of solid ground it runs right along the surface at 2.0 px/f; off an edge it falls at 2.0 px/f again. Box 10 × 10 px. Damage 400 (as Samus's and Sophia's missiles). **Pierces armour** (pierce strength as Samus's missile), so the ship can finally hurt Buzzy Beetles. Destroyed by the first enemy, by a wall, or by a brick (which it breaks, or a ? block it bumps). Unlike the bullet, it collides with ground. Animation 4 frames, 4 f each. `missileUp` frames stay spare. | owner |
| VV-M6 | **Double.** Art `bulletBack`. Cap 2 levels. | Level 1: each Attack press also fires a shot up and forward at 45° (vx +3.54, vy −3.54 px/f, `0x03892`), same rules as the bullet. Level 2: adds a rear shot (vx −5 px/f, frame `bulletBack`). **Double and Laser exclude each other**: taking one removes the other (Gradius), which makes that slot available again. | owner |
| VV-M7 | **Laser.** Art `laser` (box 16 × 6 px, SWF sprite 243 frame 3). Cap 2 levels. | Level 1: the forward shot becomes a laser bolt: 16 × 6 px, 8 px/f (`0x08000`), damage 200, pierces non-armoured enemies (each enemy hit once), passes through ground, breaks every brick it touches and keeps flying. At most 2 on screen. Level 2: 32 × 6 px and damage 300. Excludes Double (VV-M6). | owner |
| VV-M8 | **Option.** Art `option` (4 frames). Cap 4. | Each option is a 12 × 8 px orb trailing the ship. Option N sits where the ship's centre was 12 × N frames earlier. Record the trail **in screen coordinates**, and only on frames when the ship moved on screen, so options bunch up when the ship holds still (Gradius) and the auto-scroll does not stretch them. Options have no hitbox: they ignore enemies, terrain and enemy shots. Each fires a copy of every shot the ship fires (bullet, Double shots, laser, missile), with each cap counted per option. Kept on a hit, lost on death. | owner |
| VV-M9 | **Shield.** Art `shieldTop` / `shieldBot` with damaged frames (13 × 13 px cells). Cap 1. | The NES Gradius front barrier ("?"). Two pieces in front of the nose, each a 13 × 13 px box: the top piece centred 6 px right of the hitbox's right edge and 1 px above the hitbox top, the bottom piece the same distance right and 1 px below the hitbox bottom. An enemy shot touching a piece is destroyed and costs that piece 1. An enemy touching a piece is not hurt and costs the piece 1 (at most once per 30 frames per enemy). Each piece takes 4. With 2 or fewer left it shows its damaged frames; at 0 it vanishes. When both are gone, the Shield slot is available again. Hits that reach the ship's own hitbox are not blocked. | owner |
| VV-M10 | **No visible Mushroom.** The ship doesn't grow or change palette. | A second palette while the Mushroom is held (for example the cockpit and stripes turn from red to blue). The grow and shrink transition flashes the palette for 48 frames with no hitbox change. | owner |
| VV-M11 | **Right and top edges.** Never written: the ship can fly off the right side (the camera ignores it) and above the screen. | Clamp the hitbox's right edge to 3 px inside the camera's right edge, and the hitbox top to y ≥ 0 (the top of the screen, under the HUD). No bottom clamp (pits still kill, VV-13). | owner |
| VV-M12 | **Crushed by the scroll.** Never written: the left-edge push just shoves the ship into the wall. | If the left screen edge pushes the ship into a solid tile and it can't be placed free (above, below or right), the ship dies (as in SMB3's auto-scrolling stages). | coder; owner confirms |
| VV-M13 | **Left is faster than right on screen** (−2.5 vs +1.667 px/f, VV-7). | Keep it as coded. The alternative is a symmetric 1.667 px/f on screen (`leftExtra` = 0 on screen, that is world −0.833 px/f). | owner |
| VV-M14 | **Two players.** The original is single-player. | Auto-scroll runs while any live player in the level is the ship. Only ship players are carried; a walking partner is pushed by the left edge like everyone else, and the camera follows nobody. With no live ship (a ship player is out), the normal camera returns at the next respawn or area. | owner |
| VV-M15 | **Flagpole and axe poses.** Coded behaviour after the flagpole is unsettled. | Use our scripted sequences (4b) with the neutral ship pose and the jet flame. No climb pose. | coder |
| VV-M16 | **Vines.** Not handled. | The ship cannot grab vines. A vine that leads to a sky area is skipped. Alternative: Up while overlapping a fully grown vine starts the vine transfer. | owner |
| VV-M17 | **Springs.** Not handled. | Solid block, no launch (VV-30). | coder |
| VV-M18 | **Blue capsule** (art only). | Leave it out. If wanted: 1 capsule in 8 is blue; taking it defeats every non-boss enemy on screen and adds no bar step. | owner |
| VV-M19 | **Art.** None in our repo. | The list and minimum in section 11. Draw an original ship, not a copy of the Konami sprite. | owner |
| VV-M20 | **Sounds.** None usable. | Placeholders from our sfx; the 10 names in section 11. | coder |
| VV-M21 | **Music.** The Gradius playlist was only reachable through a commented skin. | The level's own music. | owner |
| VV-M22 | **Hitboxes not in the SWF:** option orb, missile path, shield placement. | The sizes in VV-M5 to VV-M9 (missile 10 × 10, laser 16 × 6 and shield 13 × 13 come from the SWF; the rest are estimates). | coder |
| VV-M23 | **Flagpole score.** The ship can always reach the top. | Keep the shared scoring (5000 at the top). | owner |
| VV-M24 | **HUD name.** The original's is `VIC_VIPER`, too wide next to the coin counter. | `VIPER`; Toad says "THANK YOU VIPER!". | owner |

## Actual

Current has no Vic Viper. The roster is 8 heroes (`src/game/characters/registry.ts:12`) and an unknown `char` id
falls back to Mario (`:14-16`). The engine has no flight mode (gravity always applies unless the ninja clings,
`player.ts:256-262`), no auto-scrolling camera (`camera.ts` only follows, snaps or locks), pipe entry needs the
ground (`world.ts:1529`), every head hit bumps a block (`world.ts:1105-1107`), and the HUD has no power bar
(`hud.ts:72-100`). With `rules === 'current'` all of this must stay exactly as it is.

## How often

every time

## Notes

- **Sources:**
  - Original (after `tr '\r' '\n'`, under `$S/orig/src/com/smbc/`): `characters/VicViper.as` (all, cited by line
    above), `projectiles/VicViperProjectile.as:13-26`, `graphics/VicViperIcon.as:11-52`,
    `pickups/VicViperPickup.as`, `data/PickupInfo.as:163-190`, `data/SoundNames.as:255-264`,
    `sound/MusicInfo.as:868-877`, `level/Level.as:173`, `:345-346`, `:1593-1598`, `:2015-2025`, `:2743-2752`,
    `:2762`, `:2879-2931`, `characters/Character.as:338`, `:993-998`, `:1308-1313`, `:1464-1466`,
    `:2037-2066`, `:2810-2850`, `:3110-3116`, `:3282-3285`, `managers/StatManager.as:1285-1286`,
    `:1351-1362`, `projectiles/Projectile.as:34-53`, `:135-151`, `ground/Brick.as:174-228`,
    `data/DamageValue.as:86`, `data/HealthValue.as:9-11`, `:19`, `:30`, `data/CharacterInfo.as:56-57`.
  - SWF (`$S/flash/smbc3.swf`): frame labels and hit rectangles read with a new script,
    `$S/classic/tools/swf_bounds.py` (sprites 114, 115, 126, 243, 281; `HRect` is an 8 × 8 Flash-px shape).
    The sheet was extracted to `$S/classic/art/bmp_112.png` with `$S/chars/work/py/bmp.py` (reference only, not
    for our repo).
  - Comparison: `$S/chars/missing-pit-vicviper.md` section 2B, `FINAL-REPORT.md` 4.5, `verify/B.md` (which
    confirmed 1.67 / 0.83 / 5.0 px/f). Two unit-file claims are corrected in VV-1.
  - Ours: `src/game/characters/character.ts:103-147`, `profile.ts:31-68`, `registry.ts:12-16`,
    `entities/player.ts:150-262`, `world/camera.ts`, `world/world.ts:762-767`, `:779-782`, `:818-828`,
    `:851-882`, `:1105-1107`, `:1527-1550`, `:1752-1910`, `:1919-2025`,
    `entities/projectiles/projectile.ts:262-276`, `entities/objects/pickup.ts:7-41`, `hud/hud.ts:72-100`.
- **Implementation hints:**
  - Keep every new engine field optional and default it to today's behaviour, so no Current hero changes.
  - Flight replaces the movement block only. Collision (`moveX`, `moveY`), invulnerability, Star, and the
    freeze for the grow flash stay shared.
  - Auto-scroll: do the carry in `World.update` after the players move and before `collisions`, so the
    left-edge clamp and the crush check (VV-M12) see the final position. Store the carry speed on the camera.
  - The power bar is per player state (`p.scratch`): `capsules`, `selected`, and one level per power-up.
    Reset all of them when the player dies.
- **Acceptance checks** (headless, `?rules=classic`):
  - Idle 600 frames in 1-1 from the start: `camera.x` rises by 500 ± 1 px; the ship's screen x is unchanged.
  - Right held 60 frames: the ship's screen x rises by 100 ± 1 px. Left held 60 frames: falls by 150 ± 1 px
    (or stops at the left edge).
  - No input for 120 frames: the ship's screen y is unchanged (no gravity).
  - The camera stops at `maxX` and stays there; a scroll-stop level stops at the stop.
  - Press Attack once below a brick row in 1-1, flying under it: no bump. Fire into a brick: it breaks and the
    bullet is gone. Fire into a ? block: it gives its item. Fire through the ground: the bullet keeps going.
  - Goomba takes 2 bullets, Koopa 3, Buzzy Beetle takes none.
  - Mid-air Down over the first enterable pipe in 1-1: the ship enters; the camera does not move during the pipe
    and resumes scrolling after the exit.
  - Small ship hit: dies. With the Mushroom: survives once, the bar is unchanged. Death empties the bar.
  - Capsules: 6 capsules light slots 1 to 6 in turn; the 7th selects slot 1 (VV-M2).
  - Current unchanged: run the existing test suite and headless sims with `rules === 'current'`; all stay green.
- **Confidence:** source only. Nobody can play Vic Viper: no build of the original contains its class code, and
  ours has none. The hitbox, bullet box, laser, missile and shield sizes are read from the SWF. Hit counts and
  the timer margins are calculated. Everything labelled "new design" is a proposal, not a port.
- **Open questions** (defaults in the table above):
  - What the ship does after the flagpole slide in the original (it never ran). Default VV-M15.
  - Whether the original's generic vine code would have let the ship grab a vine. Default VV-M16.
  - Whether the owner wants this hero at all. The comparison report (D9) suggested skipping both cut prototypes.
- **Related reports:** `2026-10-07-dev-classic-smbc-rules-toggle.md` (toggle, roster, TG requirements),
  `2026-10-07-classic-power-states.md`, `2026-10-07-classic-enemy-hp-and-armour.md`,
  `2026-10-07-classic-bricks-and-shots.md`, `2026-10-07-classic-swimming.md`,
  `2026-10-07-warriors-of-light-build-classic-character.md` (shares `bumpsBlocks: false`),
  `2026-10-07-classic-follow-ups.md`. Open reports that touch the same code:
  `2026-10-05-pipe-exit-rises-above-pipe.md`, `2026-10-05-springboard-not-solid-and-one-tile-tall.md`,
  `2026-10-06-springboard-not-solid-for-enemies-and-items.md`, `2026-10-05-camera-no-scrolling-back-left.md`.
