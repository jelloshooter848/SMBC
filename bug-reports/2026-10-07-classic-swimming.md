# Classic SMBC rules: under water only Mario and Luigi swim; the other six heroes jump from the floor with their own water gravity, cannot stomp, and leave the water physics at a fixed surface line

- **Severity:** feature request (Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every water level (2-2, 5-2 and 6-2 water areas, 7-2, 8-4 water area, and the Lost Levels water areas)
- **How to get there:** `?dev=1&rules=classic&level=2-2&char=<id>` (once the toggle exists; today `?dev=1&level=2-2&char=<id>` shows the Current behaviour)
- **Character and power:** Mario, Luigi, Link, Samus, Simon, Mega Man, Bill and Ryu, all power states
- **Input:** keyboard
- **Browser and device:** any

This is a shared-system report (C8 of the comparison report). The hero reports link here and repeat only their own
values. Requirement IDs are `SW-C1` to `SW-C12`.

## Steps

1. Open `?dev=1&level=2-2&char=link` (Current). Let Link sink, then tap Jump several times in open water. Each tap
   is a 1.5 px/f stroke, so he swims like Mario.
2. Open `?dev=1&rules=classic&level=2-2&char=link` (Classic, once built). Tap Jump in open water: nothing happens.
   Land on the sea floor and press Jump: one tall, slow jump of about 123 px, then a slow sink at most 2.08 px/f.
3. In Classic, walk Link to column 131. The 9-tile gap in the floor now has two coral stepping stones at columns 134
   and 136.
4. Open `?dev=1&rules=classic&level=2-2&char=mario`. Mario still strokes anywhere below the surface. Swim up into a
   Blooper from below and then drop onto one from above: both hurt him (no stomp under water).
5. In Classic, with Mario, stroke up to the wave row. As soon as the top of his hitbox is at or above y = 32, his
   strokes stop working and he falls back under the lighter surface gravity, small or big alike.

## Expected

### Who swims

- **SW-C1 Only Mario and Luigi stroke.** Below the surface line (SW-C9), pressing Jump in mid-water gives Mario and
  Luigi a stroke, as Current does today: **1.6667 px/f** up (`0x01AAB`), water gravity **0.04861 px/f²**
  (`0x000C7`), sink cap **2.0833 px/f** (`0x02155`), **0.75 px/f** (`0x00C00`) on the sea floor, no running. These are
  Current's own values (`mario/profile.ts:34-39`), so nothing changes for them except SW-C7 and SW-C9.
- **SW-C2 Everyone else jumps from the floor only.** Link, Samus, Simon, Mega Man, Bill and Ryu have **no stroke**.
  Under water, Jump works only when they stand on something solid (the floor, a coral block, a pipe), plus Simon's one
  air jump and Ryu's wall jumps (SW-C4). Pressing Jump in mid-water does nothing, and a press is not buffered until
  landing beyond the normal jump buffer.

### Each hero's water numbers

- **SW-C3 Water physics per hero.** Under water (below the line, SW-C9):

  | Hero | Floor jump | Water gravity | Sink cap | Walk speed (floor and mid-water) | Floor jump apex (original's order) | Frames to apex |
  |---|---|---|---|---|---|---|
  | Mario, Luigi | stroke 1.6667 px/f (`0x01AAB`), any depth | 0.04861 px/f² (`0x000C7`) | 2.0833 px/f (`0x02155`) | 0.75 px/f on the floor | about 28 px per stroke | 34 |
  | Link | **4.1667 px/f** (`0x042AB`) | **0.06944 px/f²** (`0x0011C`) | 2.0833 px/f | 1.4583 px/f (`0x01755`) | **123 px** | 59 |
  | Samus | **4.1667 px/f** (`0x042AB`) | **0.05556 px/f²** (`0x000E4`) | 2.0833 px/f | 1.25 px/f (`0x01400`) | **154 px** | 74 |
  | Simon | **4.7083 px/f** (`0x04B55`) | **0.10417 px/f²** (`0x001AB`) | 2.0833 px/f | 1.25 px/f (`0x01400`) | **104 px**, plus the air jump | 45 |
  | Mega Man | **4.6667 px/f** (`0x04AAB`) | **0.06944 px/f²** (`0x0011C`) | 2.0833 px/f | 1.375 px/f (`0x01600`) | **154 px** | 67 |
  | Bill | **4.5833 px/f** (`0x04955`) | **0.06944 px/f²** (`0x0011C`) | 2.0833 px/f | 1.25 px/f (`0x01400`) | **149 px** | 65 |
  | Ryu | **3.3333 px/f** (`0x03555`) | **0.06944 px/f²** (`0x0011C`) | 2.0833 px/f | 1.5417 px/f (`0x018AB`) | **78 px** | 47 |

  - The sink cap is the original's shared `vyMaxPsvWater` (250 px/s). It holds every hero's falling speed under water,
    whatever the hero's own land cap is.
  - Only Mario and Luigi walk slowly on the sea floor. The other six keep their land walk speed under water.
  - Samus, Simon and Bill keep their land jump speed; only gravity changes. Link, Mega Man and Ryu have their own
    water jump speed. Mega Man's is 560 px/s, the value used when he has no double jump (Bass's is 500, out of scope).
  - The apex column steps the original's order: it adds gravity before it moves, so each apex is about 2 px under
    v² / 2g. Our player moves first, so each hero's water `initial` is the floor jump minus one frame of water
    gravity: Link `0x0418E`, Samus `0x041C7`, Simon `0x049AB`, Mega Man `0x0498E`, Bill `0x04839`, Ryu `0x03439`.
    With those, our arc matches the original's frame for frame. Simon's air jump and Ryu's wall hops get the same
    adjustment (hero reports). A jump that would rise past the surface line is cut short there (SW-C9).
- **SW-C4 Each hero's own jump rules still apply in water**, with the water numbers above:
  - **Jump release:** Link's and Samus's soft cut and Mega Man's soft cut work as on land; Simon's, Bill's and Ryu's
    jumps stay fixed (hero reports).
  - **Air control:** as on land (instant steering for Link, Samus, Simon, Bill and Ryu; full for Mega Man).
  - **Simon's air jump:** one, recharged as on land (Simon report), at 4.7083 px/f with water gravity, so up to about 104 px more.
  - **Ryu's wall cling and climb** work in water. His wall hops keep their speeds, **2.5 px/f** (`0x02800`) and
    **3.5833 px/f** (`0x03955`) from the top of a wall, under water gravity (about 44 px and 91 px).
  - **Mega Man's slide** works in water at the same speed and distance as on land.
  - **Samus's Morph Ball** and bombs work in water as on land.

### Weapons and stomping

- **SW-C5 Weapons are unchanged under water.** Every weapon of every hero fires, flies and hits exactly as on land:
  Mario's fireballs, Link's sword, beam, boomerang and bombs, Samus's beams, missiles and bombs, Simon's whip and
  sub-weapons, Mega Man's buster, charge and Metal Blade, Bill's guns, Ryu's sword and ninpo. No projectile changes its
  speed or gravity in water. Attack rooting (hero reports) also applies.
- **SW-C6 Nothing is lost or gained by entering water.** Power state, ammo and invulnerability carry on as they are.
- **SW-C7 No stomp under water.** While Mario or Luigi is below the surface line, landing on an enemy from above is
  not a stomp. It is plain contact: it hurts the hero (power-states report) unless the hero has Star power or is
  invulnerable. Above the line, stomps work as usual. The other six heroes never stomp in Classic anyway (hero
  reports).
- **SW-C8 Star under water** works as on land: contact kills the enemy.

### The surface line and leaving the water

- **SW-C9 The surface line is the hitbox top at y = 32 px.** In a water level, a hero is **under water** while the
  top of its hitbox is **below y = 32 px** (2 tiles from the top of the level). At y ≤ 32 the hero is **above the
  line**. The test uses the hitbox top, so small and big Mario switch at the same height. In every water map we ship,
  y = 32 is the top edge of the wave row (row 2).
- **SW-C10 Above the line.** The hero is not swimming:
  - nobody can stroke or jump there (Mario and Luigi only stroke under water; the others need a floor);
  - gravity is the hero's land gravity, except Mario and Luigi, who use 0.09722 px/f² (`0x0018E`);
  - the falling-speed cap is the hero's water-level cap below:

  | Hero | Gravity above the line | Fall cap above the line |
  |---|---|---|
  | Mario, Luigi | 0.09722 px/f² (`0x0018E`) | 3.3333 px/f (`0x03555`) |
  | Link | 0.18056 px/f² (`0x002E4`), his land gravity | **4.1667 px/f** (`0x042AB`) |
  | Samus | 0.09722 px/f² (`0x0018E`), her land gravity | 3.75 px/f (`0x03C00`) |
  | Simon | 0.20833 px/f² (`0x00355`), his land gravity | 16.6667 px/f (`0x10AAB`) |
  | Mega Man | 0.20833 px/f² (`0x00355`), his land gravity | 5.8333 px/f (`0x05D55`) |
  | Bill | 0.13889 px/f² (`0x00239`), his land gravity | 5.0 px/f (`0x05000`) |
  | Ryu | 0.19444 px/f² (`0x0031C`), his land gravity | 5.8333 px/f (`0x05D55`) |

  Except for Mario, Luigi and Link, these are the hero's Classic land values (hero reports). When the hitbox top drops
  below the line again, the hero is under water at once: water gravity, and the 2.0833 px/f sink cap.
- **SW-C11 Nobody leaves a water level through the top.** The way out is the level's exit pipe, as in Current.
  Samus, Mega Man and Bill can reach the line with a full floor jump from the sea floor; the heavier gravity above the
  line then brings them back.

### Level help for floor jumpers

- **SW-C12 Stepping stones in 2-2 and 7-2.** The original adds coral blocks to two SMB water levels when the hero is
  not a good swimmer (every hero except Mario and Luigi), so that floor jumpers can cross the wide floor gaps. Only
  while Rules is **Classic SMBC** (TG-45), and only when any player's hero is one of the six, add these cells at
  level load. Under Current the maps never change, whoever plays. Our 2-2 and 7-2 grids match the
  original's cell for cell (192 columns, 15 rows).

  | Level | Coral block (`B`, `T.HARD`) at column, row | Coins |
  |---|---|---|
  | 2-2 (water area) | (134, 13), (134, 14), (136, 13), (136, 14), (160, 12), (160, 13), (160, 14) | move the three coins at (159-161, 12) up to (159-161, 11) |
  | 7-2 (water area) | (68, 13), (68, 14), (134, 13), (134, 14), (137, 13), (137, 14), (160, 12), (160, 13), (160, 14) | move the three coins at (159-161, 12) up to (159-161, 11) |

  With Mario or Luigi alone, the maps stay as they are. This is the only map change in the Classic reports. If the
  owner wants Classic levels untouched, drop SW-C12 alone; the rest stands (Open question 2).

## Actual

Current, which stays the default:

- `Player.swim()` (`src/game/entities/player.ts:295-344`) lets every hero stroke at any depth. Heroes without a `swim`
  profile use `DEFAULT_SWIM` (`player.ts:16`): stroke 1.5 px/f, gravity 0.0625 px/f², sink cap 2.0833 px/f. Only
  Mario and Luigi have their own profile (`src/game/characters/mario/profile.ts:34-39`), which already matches the
  original.
- Under water every hero's walk cap is its `maxWalk` (`player.ts:306-309`); Mega Man cannot slide in water because
  the swim path returns before the slide code (`player.ts:198`).
- The surface: `p.inWater = p.body.y + (p.body.h >> 1) >= this.waterTop` (`src/game/world/world.ts:760`), with
  `waterTop` = the wave row + 8 px (`world.ts:386-397`). It tests the hitbox centre, so big Mario switches at a
  different height from small Mario. Above that, the normal land physics run (`player.ts:198` onwards).
- Stomps do not check water (`world.ts:1356-1373`), so Mario can stomp under water.
- 2-2 and 7-2 have no stepping stones (`src/content/levels/world2/2-2.map`, `world7/7-2.map`, rows 13-14).

## How often

every time

## Notes

### Sources

Original (`$S/orig/src/com/smbc/`, line numbers after `tr '\r' '\n'`):

- Shared water block (SW-C3, SW-C7, SW-C9, SW-C10): `characters/Character.as:222-226` (`vyMaxPsvWater = 250`,
  `vxMaxGroundWater = 90`), `:339` (`canStompUnderWater`), `:394` (`walksSlowUnderWater`), `:976-1012` (the
  per-frame block: line at `GLOB_STG_TOP + TILE_SIZE*2`, gravity switch, sink cap, `_canStomp = false` under water),
  `:1518-1521` (`hitEnemy`: no stomp means contact), `:2769-2776`, `:3247-3256` (`canStomp`); `level/Level.as:97`
  (`GLOB_STG_TOP = 0`); `main/GlobVars.as:34` (`TILE_SIZE = 32` Flash px = 16 of ours);
  `main/AnimatedObject.as:257-268` (speed caps applied every frame).
- Mario and Luigi (SW-C1, SW-C10): `characters/base/MarioBase.as:137` (`JUMP_PWR_WATER = 200`), `:207`
  (`_isGoodSwimmer`), `:247-279` (water gravity 350, `defGravity` 700, `vyMaxPsv` 400, `canStompUnderWater = false`),
  `:1254-1263` (`pressJmpBtn`: `onGround || (waterLevel && underWater)`).
- Link: `characters/Link.as:211-221` (gravity 1300 / water 500, jump 600 / water 500, `VY_MAX_PSV` 800 / water 500),
  `:401-418`, `:592-608`.
- Samus: `characters/Samus.as:207` (walk speed), `:398-411` (gravity 700 / water 400, `vxMax` 150, `vyMaxPsv` 450),
  `:458-468`; her jump power 500 (`JUMP_PWR_NORMAL`, `:223`, set at `:489`).
- Simon: `characters/Simon.as:197` (walk 150), `:420-437` (jump 565, gravity 1500 / water 750, `vyMaxPsv` 2000),
  `:515-526`, and the air jump in `pressJmpBtn`.
- Mega Man: `characters/base/MegaManBase.as:236-257` (gravity 1500 / water 500, jump 650 / water 560 without
  `doubleJumpSkill`), `:462-487` (`vyMaxPsv` 700), `:869-888`, `:1197-1209` and `:1284-1311` (slide in water).
- Bill: `characters/Bill.as:104` (walk 150), `:270-281` (jump 550, gravity 1000 / water 500, `vyMaxPsv` 600),
  `:304-315`.
- Ryu: `characters/Ryu.as:179-192` (walk 185, jump 565 / water 400, wall hops 300 and 430, gravity 1400 / water
  500, `VY_MAX_PSV` 700), `:388-399`, `:486-499`.
- Weapons (SW-C5): no projectile class reads `underWater` or `waterLevel` (searched across `com/smbc`).
- Stepping stones (SW-C12): `level/Level.as:122` (`PROP_BAD_SWIMMER`), `:666-674`, `:780-786`;
  `assets/documents/levelDataSmb.xml`, level 2-2 area b and level 7-2 area b, cells tagged `BadSwimmer=Show` /
  `BadSwimmer=Hide`. `Character.as:375, 3270-3274` (`isGoodSwimmer`: true only for MarioBase and Sophia).
- Comparison report: `$S/chars/FINAL-REPORT.md` C8, sections 3.1-3.7 (Swimming rows), MM-7, LK-10, SI-9, BI-9,
  RY-8, ML-9; units `link.md`, `samus.md`, `simon.md`, `megaman.md`, `bill.md`, `ryu.md`, `mario-luigi.md` section
  2.4.

Ours, where the change lands: `src/game/characters/profile.ts:20-29` (`SwimProfile`), `src/game/entities/player.ts:
198, 295-344`, `src/game/world/world.ts:760, 1356-1373` and level load near `:386-397`, each Classic hero's
`<id>/classic.ts` profile.

### Implementation hints

Following TG-27, swimming needs no rules branch. Every change is an optional field that only Classic profiles set:

- `SwimProfile.floorJumpOnly?: boolean`. When true, `swim()` (`player.ts:310-320`) starts a jump only when
  `b.onGround` (or a hero hook allows it: Simon's air jump, Ryu's wall). It sets `vy = -stroke`, where `stroke` holds
  the hero's water jump speed (SW-C3). Then the hero's own release and air-control rules run, as on land. When
  absent, today's stroke runs.
- `SwimProfile.slideInWater?: boolean` for Mega Man, or let the slide code run before the swim return when
  `floorJumpOnly` is set.
- `SwimProfile.noStomp?: boolean` (Classic Mario and Luigi). In `playerVsEnemy` (`world.ts:1361-1362`) treat
  `p.inWater && p.profile.swim?.noStomp` as "cannot stomp", so the code falls through to contact.
- `SwimProfile.surfaceTest?: 'top'`. At `world.ts:760`, when set: `p.inWater = this.waterTop !== Infinity &&
  p.body.y > px(32)`. When absent, keep the centre test.
- `SwimProfile.surface?: { gravity: number; fallMax: number }` for above the line in a water level (SW-C10): Classic
  Mario and Luigi (`0x0018E`, `0x03555`) and Link (his land gravity, `0x042AB`). Others leave it out, so their land
  values apply.
- Stepping stones: a small table in `src/game/rules/classic-water.ts` keyed by level id, applied to the tile map at
  load when `world.rules === 'classic'` and any player's Classic def has `swim.floorJumpOnly`. This is a level-load
  step, not a per-frame branch (TG-45).

### Acceptance checks

- Headless, Classic, `2-2`: Link stands on the floor, presses Jump once and holds it. The apex is 121-125 px above the
  floor; mid-water presses do nothing; the fall speed never exceeds 2.0833 px/f below the line.
- Same for each hero: measure the take-off speed and the per-frame gravity against SW-C3 (exact), and the apex within
  3 px of the table. Ryu: 76-80 px. Simon: a second press in mid-air adds one more jump, a third does nothing.
- Mario, Classic: strokes rise 1.6667 px/f at any depth below the line; at hitbox top y ≤ 32 a press does nothing and
  gravity is 0.09722 px/f²; small and big Mario switch at the same top y.
- Mario, Classic, under water: falling onto a Blooper hurts him. Above the line (2-2 has none there; use a test
  enemy) a stomp still bounces.
- Mega Man, Classic, `2-2`: the slide covers 62.5 px at 2.5 px/f on the sea floor.
- Weapons: in `2-2` each Classic hero's main shot has the same speed and range as in 1-1.
- Stepping stones: Classic Link in `2-2` has `B` at (134, 13) and coins at (159-161, 11); Classic Mario does not.
  Classic Link crosses the gap at columns 131-139 by floor jumps.
- Current is unchanged: all existing tests and sims pass with no edits; Current Link still strokes at 1.5 px/f;
  Current 2-2 has no `B` at (134, 13).

### Confidence

- All numbers are from the original's source; none of the water rules were played in the original.
- Exact: jump speeds, gravities, caps, walk speeds, the line at 32 px, the stepping-stone cells.
- Estimated: the apex heights (continuous formula), Ryu's wall-hop heights in water (inferred, not in a dedicated
  code path), and whether a hero reaches the line from the floor (depends on hitbox heights from the hero reports).

### Open questions

1. Ryu's cling under water is inferred from the shared code; no water-specific branch exists. **Default: cling,
   climb and hops work as on land, with water gravity.**
2. SW-C12 changes two maps for six heroes. The brief keeps levels as they are except for the shared systems; the
   original treats these cells as part of its swimming rules. **Default: include them.** The Lost Levels have more
   such cells (`levelDataLostLevels.xml`: 3-2, 4-1, 6-1, 6-2, 8-1, 9-2, 9-4, 11-2 water areas; also Beetle → Koopa
   swaps in castles 7-4 and 12-4, and a brick in 11-4 and 13-4). They are tied to the original's map-difficulty
   setting. **Default: leave them to the follow-ups report**, together with the converter work for `BadSwimmer`,
   `WideCharacter`, `charHorz` and `charVert` cells (FU-6).
3. In 2-player Classic with Mario and a non-swimmer, SW-C12 adds the stones for both. **Default: yes; they only
   help.**

### Related reports

- **`2026-10-06-water-non-mario-heroes-stroke.md` (open).** It asks Current to remove the stroke for the six heroes and
  use their own water jump and gravity. Classic does exactly that (SW-C2 to SW-C4). If Current adopts that fix, Current
  and Classic swim the same way, `floorJumpOnly` becomes Current behaviour, and Classic simply matches with no Classic
  swim fields left except SW-C7 and SW-C12. One correction to that report: Mega Man's water jump is **560** px/s
  (4.6667 px/f), not 500. The 500 belongs to heroes with `doubleJumpSkill` (Bass); Mega Man uses 560
  (`MegaManBase.as:471-479`).
- **`2026-10-06-water-surface-air-physics.md` (open).** It asks Current for the hitbox-top line and Mario's 700 / 400
  above it. Classic does that (SW-C9, SW-C10). If Current adopts it, Classic simply matches and `surfaceTest` and
  Mario's `surface` values move into the Current profile. SW-C10 adds Link's water-level fall cap above the line,
  which that report does not cover.
- `2026-10-05-water-swim-stroke-and-sinking.md` (fixed): Mario's stroke, gravity and sink cap, which Classic keeps.
- `2026-10-07-dev-classic-smbc-rules-toggle.md` (TG-27), `2026-10-07-classic-power-states.md` (contact damage for
  SW-C7), `2026-10-07-classic-follow-ups.md` (FU-6).
- Hero reports with their water values: `2026-10-07-mario-luigi-classic-smbc-rules.md`,
  `2026-10-07-link-classic-smbc-rules.md`, `2026-10-07-samus-classic-smbc-rules.md`,
  `2026-10-07-simon-classic-smbc-rules.md` (SI-C9), `2026-10-07-megaman-classic-smbc-rules.md` (MM-C13),
  `2026-10-07-bill-classic-smbc-rules.md`, `2026-10-07-ryu-classic-smbc-rules.md` (RY-C17).
