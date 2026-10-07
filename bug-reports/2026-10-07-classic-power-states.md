# Classic SMBC rules: every hero has the small / Mushroom / Fire Flower power states with Lose Everything, the original's hit response, ammo-only drops and a 12.0 s Star

- **Severity:** feature request (Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=<id>` (once the toggle exists; today `?dev=1&level=1-1&char=<id>` shows the Current behaviour)
- **Character and power:** Mario, Luigi, Link, Samus, Simon, Mega Man, Bill and Ryu, all power states
- **Input:** keyboard
- **Browser and device:** any

This is a shared-system report. The hero reports link here and give only their own values. It covers C1 (power
states), C10 (hit response) and C11 (drops, ammo and Star) of the comparison report, plus 1-ups, death, the pit and
the Classic HUD. Requirement IDs are `PS-C1` to `PS-C27`.

## Steps

1. Open `?dev=1&level=1-1&char=link` (Current). The HUD shows hearts. Walk into the Goomba at column 22. Link loses
   half a heart, is pushed back and blinks for 60 frames.
2. Open `?dev=1&rules=classic&level=1-1&char=link` (Classic, once built). The HUD shows no hearts and no power
   icon. Walk into the same Goomba: small Link dies.
3. Restart. Bump the ? block at column 21 and take the Mushroom. The game freezes for 60 frames, the tunic turns blue,
   a Mushroom icon appears under the score, and the bomb count reads ×03. Bump the block at column 78 and take the Fire
   Flower: the icon becomes a flower.
4. Touch a Goomba. Link drops straight to small (the icon disappears). He is pushed 32 px back, flashes for 75
   frames, and still has his bombs.
5. Take the Star from the brick at column 101 with any hero. Current: Star lasts 600 frames. Classic: it lasts 720
   frames, flashes slowly for the last 150, and the level music comes back 78 frames before the end.

## Expected

### Power states

- **PS-C1 Three states for every hero.** Every Classic hero has three states: **small**, **Mushroom** and **Fire
  Flower**. They are stored as `small`, `big` and `fire` (TG-21). Only Mario and Luigi change size. Nothing else
  counts as health: no HP, hearts, energy, tanks or E-tanks.
- **PS-C2 What a ? block gives.** A power-up block gives a **Mushroom** when the hero who bumped it is small, and a
  **Fire Flower** otherwise. This is the same for all eight heroes (`blockPowerUp`).
- **PS-C3 What a pickup does.** The item's effect is decided when it is touched, not when it appears:

  | Hero's state when touching | Mushroom | Fire Flower |
  |---|---|---|
  | small | Mushroom state | **Mushroom state** (a Flower acts as a Mushroom) |
  | Mushroom | **Fire Flower state** (a Mushroom acts as a Flower) | Fire Flower state |
  | Fire Flower | acts as a Flower: the repeat bonus in PS-C6 | the repeat bonus in PS-C6 |

  So big Mario or Luigi who touches a Mushroom becomes fire. Every Mushroom, Flower and Star scores **1000**.
- **PS-C4 Power-up freeze.** Going up a state (small → Mushroom, Mushroom → Flower) freezes the whole game for
  **60 frames** (1000 ms). The hero flashes the power-up palette (Mario and Luigi play their grow animation). The new
  kit applies when the freeze ends. A repeat Flower (PS-C6) does not freeze.
- **PS-C5 Kit per state.** The Customize Weapons choices are fixed to the original's defaults. The menu itself is out
  of scope.

  | Hero | Small (start kit) | Mushroom adds | Fire Flower adds | Customize Weapons default used |
  |---|---|---|---|---|
  | Mario, Luigi | small body | big body: head breaks bricks, crouch | fireballs (2 on screen) | none |
  | Link | wooden sword (200), boomerang on Special | Blue Ring (sword 275, blue tunic) and **bombs** on Select (3 bombs if he had none) | Red Ring (sword beam, red tunic), Magic Boomerang, Magic Sword (400), Bomb Bag (bomb max 40), Quiver (arrow max 40) | Link weapon = **Bomb** |
  | Samus | short Power Beam, Morph Ball with bombs | Long Beam and **missiles** (4 missiles if she had none) | **Wave Beam**, Screw Attack, Missile Expansion (missile max 99); the Varia colours only, never the Varia Suit (SA-C16) | Samus beam = **Wave** |
  | Simon | leather whip, **Axe**, **10 hearts**, 1 sub-weapon on screen | Morning Star (whip level 2), Double (2 on screen) | Flame Whip (level 3), Triple (3 on screen), **Cross** on Select | start = **Axe**, extra = **Cross** |
  | Mega Man | Mega Buster, Rush Coil (Select tap) | Charge Shot | **Metal Blade** on Special | weapon = **Metal Blade** |
  | Bill | rifle | **Machine Gun** (replaces the rifle) | **Spread** on Attack, Machine Gun on Special, Select swaps them | first = **Machine Gun**, second = **Spread** |
  | Ryu | sword, **Shuriken** on Special, **25 ninpo** (max 99) | Sword Extension | Scroll (ninpo max 200), **Windmill Shuriken** on Select | start = **Shuriken**, extra = **Windmill Shuriken** |

  The Select weapons of Simon and Ryu, and Bill's Special gun, need the Fire Flower state. They are not separate
  items, so they go when the Flower goes. The hero reports give each weapon's numbers.
  Every other original weapon and art (Link's Bow, Samus's Ice Beam, Simon's Dagger, Holy Water and Stopwatch, Mega
  Man's other 8 weapons, Bill's Laser and Flare, Ryu's Fire Wheel, Fire Dragon Ball and Jump Slash) is built too, but
  no power-up hands it out: it is reached only through the dev `&kit=full` (TG-44).
- **PS-C6 Repeat Fire Flower.** A Flower (or a Mushroom, PS-C3) taken in the Fire Flower state gives:

  | Hero | Repeat bonus |
  |---|---|
  | Mario, Luigi, Bill | nothing (1000 points only) |
  | Link | +3 bombs |
  | Samus | +4 missiles |
  | Simon | +5 hearts |
  | Mega Man | +40 Metal Blade energy (the original's units; 112 = full) |
  | Ryu | +15 ninpo |

  Every bonus is capped at that ammo's maximum.

### What a hit does (Lose Everything)

- **PS-C7 The code path.** Classic follows the original's `Character.takeDamage` with When Hit = Lose Everything:
  1. Ignore the hit if the hero is invulnerable (PS-C11).
  2. If the hero is **small**, the hero **dies**.
  3. Otherwise, if the hero has the Fire Flower: remove the Fire Flower and that hero's "lose with the Flower" list.
  4. Then, always (this is Lose Everything): remove the Mushroom and that hero's "lose with the Mushroom" list.
  5. Start the hero's hit response (PS-C10).

  So one hit while powered always ends **small**, from either powered state. A hit while small always kills. Every
  damage source takes this path: enemy contact, enemy shots, fire bars, Bowser's fire and hammers, and the Poison
  Mushroom. Pits (and lava, which is a pit) kill in any state (PS-C24).
- **PS-C8 What a hit removes and keeps.**

  | Hero | Removed by the hit | Kept |
  |---|---|---|
  | Mario, Luigi | big body, fire | nothing else to keep |
  | Link | Blue Ring, Red Ring, Magic Boomerang, Magic Sword | **bombs and their count, Bomb Bag (max 40), Quiver (max 40)**; the Bow too if he ever owned it (only through `&kit=full`, TG-44) |
  | Samus | Long Beam, Wave Beam, Screw Attack | **missiles and their count, Missile Expansion (max stays 99)**, Morph Ball and bombs |
  | Simon | Morning Star, Flame Whip (back to leather), Double, Triple, the Select Cross | **Axe and his hearts** |
  | Mega Man | Charge Shot, Metal Blade | Rush Coil |
  | Bill | Machine Gun, Spread | nothing (back to the rifle) |
  | Ryu | Sword Extension, the Select Windmill | **Shuriken, Scroll (ninpo max stays 200), his ninpo count** |

  Ammo counts never change on a hit. When a kept item comes back with the next Mushroom or Flower, the "if he had
  none" starting amounts in PS-C5 do not apply again.
- **PS-C9 The "Fire keeps big" assist is ignored in Classic** (TG-29). There is no Previous State or Instant Death
  option in Classic; the When Hit menu is out of scope.

### Hit response and invulnerability

- **PS-C10 Hit response per hero.** After a survived hit (PS-C7 step 5):

  | Hero | Push | Input locked | Game freeze | Then invulnerable | Look while invulnerable | Total |
  |---|---|---|---|---|---|---|
  | Mario, Luigi | none (the shrink plays in place) | during the freeze | **60 f** | **150 f** (2500 ms) | 65 % opacity from the hit to the end | 210 f |
  | Link | **4.1667 px/f** (`0x042AB`) away from the enemy, no vertical push (gravity acts as normal); faces the enemy | until he has moved **32 px**, or hits a wall on the push side, or **72 f** pass | none | **75 f** (1250 ms) | palette flash every 2 f, from the hit to the end | about 83 f |
  | Samus | **1.25 px/f** (`0x01400`) away from the enemy; **−2.0833 px/f** (`0x02155`) up only if she was on the ground | **15 f** (250 ms) | none | **75 f** | flicker (PS-C13), from the hit to the end | 90 f |
  | Simon | **1.25 px/f** (`0x01400`) away, **−2.5 px/f** (`0x02800`) up; faces the enemy | **until he lands** (or a spring or vine ends it) | none | **75 f**, from landing | 65 % opacity after landing | about 99 f on flat ground |
  | Mega Man | **0.6667 px/f** (`0x00AAB`) **backwards from his facing** (not from the enemy); vy set to 0 | **27 f** (450 ms); then vx = 0 if on the ground | none | **75 f** | flicker (PS-C13), from the hit to the end | 102 f |
  | Bill | none | during the freeze | **60 f** | **120 f** (2000 ms) | 65 % opacity and palette flash, from the hit to the end | 180 f |
  | Ryu | **1.25 px/f** (`0x01400`) away, **−3.2083 px/f** (`0x03355`) up; faces the enemy; lets go of a wall | **until he lands** (or a spring ends it) | none | **75 f**, from landing | 65 % opacity after landing | about 108 f on flat ground |

  "Away from the enemy" means away from the damage source's x position. With no source (the Poison Mushroom touched
  from inside), push away from the facing. The hero reports repeat their own row and give extra end conditions.
- **PS-C11 Invulnerable means:** from the hit until the "Then invulnerable" window ends, contact with enemies, enemy
  shots, fire bars and the Poison Mushroom do nothing to the hero. Pits still kill. The hero can still collect
  items.
- **PS-C12 During the push:** the hero cannot stomp, cannot bump blocks with the head, and deals no melee hits. Any
  attack in progress ends. Normal control returns when the lock ends; these heroes have an instant walk, so the push
  stops at once unless a direction is held.
- **PS-C13 The looks.**
  - **65 % opacity:** draw the hero at alpha 0.65.
  - **Flicker:** the hero is shown and hidden in turn. Use a millisecond accumulator, as the original's
    `GameLoopTimer` does: add 16.667 ms each frame, and each time it reaches the delay, subtract the delay and toggle.
    Samus's delay is **25 ms** (toggles after 2, 1, 2, 1... frames). Mega Man's is **70 ms** (after 5, 4, 4, 4, 4,
    5... frames). Mega Man's damage splash is shown while he is hidden (his report).
  - **Palette flash:** cycle the hero's flash palettes, one step every **2 frames** (33.3 ms). Use the hero's Star
    palettes until the original's power-up flash palettes are extracted (Open question 2).
  - With **reduce flashing** on, draw flicker and palette-flash heroes at 65 % opacity instead.

### Drops and ammo

- **PS-C14 No health drops.** In Classic nothing restores health, because there is none. No hearts for Link, no
  energy for Samus, no health pellets, no E-tanks, no magic jars and no gun capsules.
- **PS-C15 Drop rates.** One roll per killed enemy, broken brick or coin given:

  | Source | Chance | Heroes |
  |---|---|---|
  | enemy killed | **25 %** | Link, Samus, Simon, Mega Man, Ryu |
  | brick broken (by head or weapon) | **6.25 %** (25 % × 0.25) | Link, Samus, Simon, Ryu |
  | coin taken from a ? block or coin brick (each coin) | **12.5 %** (25 % × 0.5) | Simon, Ryu |

  Mario, Luigi and Bill never get drops. Link drops nothing until he owns bombs; Samus drops nothing until she owns
  missiles. The drop pops out of the enemy or block.
- **PS-C16 What drops.** After the chance roll, a second roll picks the item:

  | Hero | Item (our pickup kind) | Gives |
  |---|---|---|
  | Link | bomb ammo (`bomb`); arrow ammo only if he owns the Bow and no bombs, which the defaults never give (with `&kit=full` bombs win, `Link.as:1403-1411`) | +2 |
  | Samus | missile ammo (`missile-pack`) | +2 |
  | Simon | small heart (`heart-small`) 80 %, big heart (`heart-large`) 20 % | +1 / +5 |
  | Mega Man | small energy (`weapon-small`) 82.5 %, big energy (`weapon-large`) 17.5 % | +8 / +40 (112 = full) |
  | Ryu | small ninpo (`ninpo-small`) 80 %, big ninpo (`ninpo-large`) 20 % | +5 / +10 |

- **PS-C17 Pickups are always taken.** Touching an ammo pickup always collects it, even when that ammo is full (the
  extra is lost). Current leaves some pickups lying when full; Classic does not.
- **PS-C18 Ammo is free during Star.** While Star is active, no ammo is spent (bombs, arrows, missiles, hearts,
  weapon energy, ninpo), and a weapon needs no ammo to fire. Pickups still add ammo.

### Star

- **PS-C19 Star lasts 720 frames (12.0 s).** Phases, counted from the pickup:

  | Frames | What happens |
  |---|---|
  | 0-569 (9.5 s) | invincible; fast flash: next Star palette every **2 frames** |
  | 570-719 | invincible; slow flash: next Star palette every **6 frames** (100 ms) |
  | at 642 (10.7 s) | the Star music stops and the level music returns |
  | at 720 | Star ends; normal palette |

  Contact kills enemies as in Current. A second Star during Star restarts the 720 frames (Open question 1).

### 1-ups

- **PS-C20 1-ups are unchanged.** The green Mushroom gives a life and changes no state. 100 coins give a life.
  Lives start at 3 (5 with two players), as in Current. Classic touches none of this.

### Death and the pit

- **PS-C21 Death resets the kit.** When a hero dies, every upgrade and every ammo count is reset. The hero comes back
  small with the start kit of PS-C5 (Simon's 10 hearts, Ryu's 25 ninpo, Mega Man's Rush, Samus's Morph Ball, and so
  on). Current already resets `powerState` and `kit` on death; the Classic def's start kit then applies.
- **PS-C22 Co-op drop-in.** A dead player who drops back in beside the other comes back small with the start kit
  (TG-30), with the 150-frame drop-in invulnerability that Current uses.
- **PS-C23 Death sequence.** Classic keeps Current's shared death sequence (freeze, hop, end at frame 200) for every
  hero except where a hero report gives its own (Mario and Luigi: ML-C18). Per-hero death animations are cosmetic.
- **PS-C24 The pit.** Falling off the bottom of the screen kills in any state, with no hop, as in Current. Lava is a
  pit. Star does not protect from a pit.

### HUD

- **PS-C25 No health display.** A Classic hero shows no hearts, no HP bar, no `EN` number, no magic meter and no
  E-tank text. Classic defs leave out `tools` for belts, `meter`, `hudExtra` and `reserve` unless a hero report asks
  for one (TG-22).
- **PS-C26 Power icon.** The state shows as one 8 × 8 icon in the third HUD row:

  | State | Player 1 at (24, 24) | Player 2 at (144, 32) |
  |---|---|---|
  | small | nothing | nothing |
  | Mushroom | Mushroom icon | Mushroom icon |
  | Fire Flower | Fire Flower icon | Fire Flower icon |

  Add two HUD icons to the items sheet, `icon-mushroom` and `icon-flower`, drawn without black like the other HUD
  icons. The original shows no other upgrade icons in Classic.
- **PS-C27 Ammo counter.** A hero with ammo shows one icon and its count in the tool slot at (96, 24), drawn as today
  (`icon`, then `×NN`; Ryu's ninpo can show 3 digits). Which ammo shows, and when, is in each hero report: Link's bombs
  once owned, Samus's missiles once owned, Simon's hearts always, Ryu's ninpo always. Mega Man's Metal Blade energy
  is his bar (Mega Man report). Mario, Luigi and Bill show no counter.

### Feel

- A powered hero dies in two hits at most, and the first hit always takes the whole kit.
- Every power-up freezes the game for a moment, as in SMB1.
- Non-Mario heroes are pushed back hard (Link) or knocked into a hop (Simon, Ryu) and must wait to land.

## Actual

Current, which stays the default:

- Only Mario and Luigi have power states (`src/game/characters/mario/index.ts:137-144, 158`;
  `src/game/characters/luigi/index.ts:21`). The other six use HP models: Link hearts (`link/index.ts:221-227`),
  Samus energy (`samus/index.ts:166-172`), Simon (`simon/index.ts:142-148`), Mega Man (`megaman/index.ts:223-229`),
  Bill (`bill/index.ts:123-129`) and Ryu (`ryu/index.ts:161-167`). Upgrades are never lost.
- A Mushroom taken while big gives 1000 points only (`mario/index.ts:103-112`). Each non-Mario hero has its own
  block rule (`blockPowerUp`: `link/index.ts:233`, `megaman/index.ts:235`, `ryu/index.ts:173`, `samus/index.ts:179`,
  `simon/index.ts:154`, `bill/index.ts:136`).
- Hit response: the shared knockback for HP heroes with a 16-frame stun (`src/game/world/world.ts:1440-1452`), 40-90
  invulnerable frames (`invulnFrames` above) and blinking every 2 frames (`src/game/entities/player.ts:535-537`).
  Mario and Luigi pause for a 48-frame shrink (`player.ts:139-148`) and then get 150 blinking frames
  (`mario/index.ts:141`).
- Drops: per-hero tables with health, magic, E-tanks and capsules (`link/index.ts:240-246`,
  `samus/index.ts:197-203`, `simon/index.ts:171-176`, `megaman/index.ts:253-261`, `ryu/index.ts:179-185`,
  `bill/index.ts:141-146`), from kills only (`world.ts:600-609`). Bricks and coins drop nothing.
- Star: `STAR_FRAMES = 600` (`src/game/constants.ts:11`); the level music returns at the last frame (`world.ts:820`).
  Ammo is still spent under Star.
- HUD: hearts, `EN`, bars and meters (`src/game/hud/hud.ts:49-105`). No power icon.

## How often

every time

## Notes

### Sources

Original (`$S/orig/src/com/smbc/`, line numbers after `tr '\r' '\n'`):

- Defaults (PS-C1, PS-C5, PS-C7): `data/GameSettings.as:48` (`DEBUG_MODE = false`), `:87` (Classic),
  `:115` (static `LoseCurrent`, overridden), `:186-233` (`setDefaults`, `resetClassicSettings`: `LoseEverything` at
  221, weapon defaults at 222-232); `SuperMarioBrosCrossover.as:116-117` (calls `setDefaults` at boot);
  `enums/ClassicDamageResponse.as:9-11`.
- Block contents (PS-C2): `managers/StatManager.as:1357-1362` (`getRandomUpgrade`).
- Pickup conversion and score (PS-C3): `characters/Character.as:1540-1586`, `base/MarioBase.as:375-400`;
  `data/ScoreValue.as:80` (`POWER_UP = 1000`).
- Freeze (PS-C4): `Character.as:204` (`FREEZE_GAME_TMR_DEL = 1000`), `:1988-2020` (`getMushroom`), `:2279-2299`;
  `MarioBase.as:895-933`.
- Kits (PS-C5, PS-C8): `Character.as:377-385` (the four list getters; "lose" defaults to "get");
  `managers/StatManager.as:1192-1225` (`addCharUpgrade` adds the lists); `Link.as:95-96, 112-127, 562-583,
  1191-1262`; `Samus.as:90-107`; `Simon.as:83-100, 458-459, 483-490, 880-890`; `base/MegaManBase.as:329-333`,
  `MegaMan.as:35`; `Bill.as:61-69, 203-228, 501-531`; `Ryu.as:72-98, 425-426, 451-458, 945-958`.
- Repeat Flower (PS-C6): `Link.as:933-948`; `Samus.as:611-618`; `Simon.as:1101-1106`; `MegaManBase.as:2076-2090`
  (+40 = `WEAPON_ENERGY_BIG_RECOVERY`, 112); `Ryu.as:790-797`; `Bill.as:458-474` (nothing).
- Lose Everything (PS-C7): `Character.as:2027-2090` (`shouldDieInstantly`, `takeDamage`), `:1510-1521`
  (`hitEnemy`), `:1592-1597` (Poison Mushroom).
- Hit response (PS-C10 to PS-C13): `Character.as:144` (`TD_ALPHA = .65`), `:206-207` (1250 ms), `:2102-2142`
  (`takeDamageEnd`, flicker), `:2358-2368`; `main/AnimatedObject.as:257-260` (the `vxMax` clamp that holds Samus's
  push at 150); `utils/GameLoopTimer.as` (`update` keeps the remainder); `MarioBase.as:83, 284, 942-967`;
  `Link.as:198-199, 259, 728-736, 1081-1086, 1299-1375`; `Samus.as:207-211, 231-232, 320, 445-450, 1184-1238`;
  `Simon.as:197, 209, 432, 938-1006, 1314-1321`; `MegaManBase.as:260-261, 276-279, 2389-2428, 2481-2502`;
  `Bill.as:178, 298, 880-919`; `Ryu.as:198-199, 1252-1265, 1267-1307, 1328-1349`; `ground/Brick.as:199` and
  `enemies/Enemy.as:220` (`nonInteractive`: no head bumps, no stomps).
- Drops (PS-C14 to PS-C17): `data/RandomDropGenerator.as:28-85`; `Character.as:372-373, 391-392, 424-426`;
  `enemies/Enemy.as:333-336`; `ground/Brick.as:259-260, 319-320, 353-354`; flags in `Link.as:339`,
  `Samus.as:309`, `Simon.as:299-300`, `Ryu.as:306-307`; tables in `Link.as:139-141, 1402-1420`,
  `Samus.as:660-670`, `Simon.as:103, 214-215`, `MegaMan.as:54-57`, `MegaManBase.as:112-113`, `Ryu.as:98, 223-224`;
  `Link.as:249-250`, `Samus.as:141`; `pickups/Pickup.as:207-212` (always destroyed on touch).
- Star (PS-C18, PS-C19): `Character.as:193-203, 1898-1946` (`setAmmo`, `hasEnoughAmmo` with `starPwr`),
  `:2421-2484`; `data/AnimationTimers.as:10-20` (slow 100 ms, fast 33.3 ms). Errata: `verify/D.md` (slow flash
  lasts 2.5 s).
- Death and pit (PS-C21 to PS-C24): `Character.as:2326-2342, 2370-2410, 2980-3008, 3109-3116` (`cleanUp`:
  `setAllAmmoToDefault`, `removeAllUpgradesForChar`).
- HUD (PS-C25 to PS-C27): `graphics/TopScreenText.as:46-50, 60, 64-65, 170-185, 262-279` (`updateUpgIcons` returns
  early in Classic); `graphics/UpgradeIcon.as:36-91` (one icon: Mushroom, or Flower in Classic; moved to
  `UPG_ICONS_START_PNT` = (70, 48) Flash px = (35, 24) ours; ours uses x 24 to line up with our HUD).
- Comparison report: `$S/chars/FINAL-REPORT.md` C1, C10, C11, C12; units `link.md`, `samus.md`, `simon.md`,
  `megaman.md`, `bill.md`, `ryu.md`, `mario-luigi.md` sections 2.5-2.6; errata `verify/A.md` rows 11, 16;
  `verify/B.md` rows 9, 18; `verify/C.md` rows 10-11, 20; `verify/D.md` row 12.

Ours, where the change lands: `src/game/characters/classic/power.ts` (new, TG-28), each `<id>/classic.ts`,
`src/game/world/world.ts:600-609, 820, 1106-1200, 2083-2096`, `src/game/entities/player.ts:133-148, 531-537`,
`src/game/hud/hud.ts:49-105`, `src/content/sprites/items.ts` (HUD icons).

### Implementation hints

- **Helper module** `src/game/characters/classic/power.ts` (TG-28). It exports:
  - `CLASSIC_STAR_FRAMES = 720` and `CLASSIC_STAR_MUSIC_LEFT = 78` (music returns when 78 frames remain);
  - `classicPowerUp(p, kind, world, kit)`: PS-C3, PS-C4 and PS-C6, where `kit` is the hero's table row (what the
    Mushroom and Flower add, the repeat bonus);
  - `classicHurt(p, world, fromDir, response)`: PS-C7, PS-C8 and PS-C10, returning `'dead'` or `'hurt'`;
  - `classicDrop(rng, p, table)` and the shared rates;
  - `spendAmmo(p, key, cost)`: returns true and spends nothing while `p.star > 0` (PS-C18).
- **Hurt.** Each Classic def's `onHurt` calls `classicHurt`. `World.hurtPlayer` (`world.ts:1440-1452`) stays as it
  is: its knockback branch only runs for `hp` heroes. The helper sets `body.vx`, `body.vy` and `facing`, and keeps
  `p.invuln > 0` from the hit to the end of the window. For "until he lands", set `p.stun` to a large value and clear
  it on landing; set `p.invuln = 75` at that moment. `hurtPlayer` needs the source position only as `fromDir`, which
  it already passes.
- **Freezes.** Reuse `Player.transition` (`player.ts:133-148`): give `Transition` an optional length (default 48, so
  Current is unchanged) and a kind `'hit'` with no size change for Bill. Classic sets 60. Start the 150 (Mario) or 120
  (Bill) invulnerable frames when the freeze ends.
- **Looks.** Add an optional `CharacterDef.drawLook?(p, frame): { visible: boolean; alpha: number }`. When absent,
  `renderPlayer` keeps `p.visible(frame)` (`world.ts:2085`). Add an optional `alpha` argument to `Renderer.sprite`
  (canvas `globalAlpha`; the headless renderer ignores it).
- **Drops.** `World.enemyKilled` passes the killer as a third argument: `killer.def.drop?.(this.rng, e, killer)`.
  Current defs ignore it. For bricks and coins, add an optional `CharacterDef.blockDrop?(rng, p, 'brick' | 'coin')`
  and call it from `strikeBlock` (`world.ts:1138-1177`) where a brick breaks and where a coin is given. Current defs
  do not define it, so nothing changes for them. Classic defs leave pickups `onPickup` returning true (PS-C17).
- **Star.** Classic defs set `p.star = CLASSIC_STAR_FRAMES`. For the music, `world.ts:820` reads
  `p.star === (p.def.starMusicLeft ?? 1)` with a new optional `starMusicLeft` field (78 on Classic defs). The sprite
  function picks the flash speed: `(720 - p.star) < 570` → palette index `(frame >> 1) & 3`, else
  `Math.floor(frame / 6) & 3`.
- **HUD.** Branch on the player's def (`def.rules === 'classic'`, TG-18), not on `damage.kind`, because Current Mario
  is also `powerup` and must keep today's HUD. Draw the icon at (24, 24) (player 2 at (144, 32)).

### Acceptance checks

- Headless, Classic, each hero: give the Fire Flower state, hit once → `powerState === 'small'`; hit again after the
  window → dead.
- Link (Fire Flower, 7 bombs): one hit → small, bombs 7, bomb max 40, no Magic Sword. Samus (Fire Flower, 30
  missiles): one hit → small, 30 missiles, missile max 99. Ryu (Fire Flower, 150 ninpo): one hit → 150 ninpo, max
  200, Select does nothing.
- Pickup table: small + Flower → `big`; `big` + Mushroom → `fire` (Mario, then Link); `fire` + Flower → Simon +5
  hearts, no freeze. Every power-up freezes the world for 60 frames.
- Count frames from a hit until a second contact hurts: Mario 210, Link 83 (8 push + 75), Samus 90, Mega Man 102,
  Bill 180. Simon and Ryu: frames to land + 75.
- Samus's flicker pattern over 12 frames is 2, 1, 2, 1... toggles; Mega Man's over 40 frames is 5, 4, 4, 4, 4.
- Drops: 10 000 seeded Goomba kills by Simon → about 2500 drops, about 20 % big hearts. Mario and Bill: 0. Link
  before owning bombs: 0.
- Star: 720 frames; slow flash from frame 570; level music at frame 642.
- HUD: Classic Link small → no icon; Mushroom → `icon-mushroom` at (24, 24).
- Current is unchanged: all existing tests and headless sims pass with no edits; `STAR_FRAMES` stays 600; Current
  Mario's HUD has no icon.

### Confidence

- Everything here comes from the original's source. None of it was played in the original, except Simon's 10 starting
  hearts (played in the Simon unit).
- Exact: state lists, Lose Everything, timers (ms ÷ 16.67), speeds (Flash px/s ÷ 120), drop rates, Star phases.
- Estimated: the "Total" column for Simon and Ryu (depends on where they land); the palette-flash colours (PS-C13).
- Timers run on game-loop time in the original, so the frame counts hold even if its physics stepped at 30 fps.

### Open questions

1. A Star taken during the slow-flash phase: the original's `activateStarPwr` calls `reset()` on a timer that is
   already null there (`Character.as:2423-2427`), which would throw and leave the old timers running. **Default:
   restart at 720.**
2. Link's and Bill's power-up flash palettes are in the SWF, not in the source. **Default: the hero's Star palettes,
   one step every 2 frames.**
3. `nonInteractive` is described as "disables interaction with everything", but the code only uses it for stomps,
   thrusts and brick bumps. **Default: items can still be collected during a push.**
4. The original is single-player, so the player 2 icon position is ours. **Default: (144, 32), where player 2's
   hearts are today.**
5. The original's pit triggers when the hero's top reaches the screen bottom (240 px); ours at 248 px
   (`world.ts:821`). **Default: keep 248** (not a power-state rule).

### Related reports

- `2026-10-07-dev-classic-smbc-rules-toggle.md` (TG-18, TG-21, TG-22, TG-28, TG-29, TG-30).
- Hero reports: `2026-10-07-mario-luigi-classic-smbc-rules.md` (ML-C17 timings, ML-C18 death),
  `2026-10-07-link-classic-smbc-rules.md` (LK-C14 to LK-C20), `2026-10-07-samus-classic-smbc-rules.md` (SA-C11),
  `2026-10-07-simon-classic-smbc-rules.md`, `2026-10-07-megaman-classic-smbc-rules.md`,
  `2026-10-07-bill-classic-smbc-rules.md` (BI-C14, BI-C31), `2026-10-07-ryu-classic-smbc-rules.md` (RY-C22).
- Shared: `2026-10-07-classic-enemy-hp-and-armour.md`, `2026-10-07-classic-bricks-and-shots.md` (bricks that drop
  ammo), `2026-10-07-classic-swimming.md`, `2026-10-07-classic-follow-ups.md` (When Hit, Customize Weapons, Modern).
- Existing: `2026-10-05-lava-kills-on-touch-with-death-hop.md` (fixed: lava is a pit, used by PS-C24).
