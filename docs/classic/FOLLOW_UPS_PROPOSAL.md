# Classic mode follow-ups: proposal (FU-3, FU-4, FU-7, FU-8)

A proposal for the owner, turning the parking-lot items of `bug-reports/2026-10-07-classic-follow-ups.md` into
release-sized slices. Nothing here is built yet. Facts about the original come from SMBC 3.1.21's source
(`GameSettings.as`, `DifficultySettingsMenu.as`, `NewGameOptionsMenu.as`, `CharacterSelectBox.as`, `StatManager.as`,
`ScreenManager.as`, `Cheats.as`, `SkinDescriptions.as`, `BmdInfo.as`, the hero classes).

**Owner constraints this proposal keeps:**

1. Classic mode plays like the original **by default**. Anything that changes rules is an option whose default is the
   original's value; a player who never opens the menu gets today's Classic mode exactly.
2. **Original art and music only.** A skin is our own pixel art in the repo's text format, never a rip. Per-skin
   music (the original swaps the music set with the skin) is **parked**.
3. **The campaign is untouched.** Every option lives in Classic mode's settings, is read only in a Classic run, and
   the parity fixture (`tests/sim/current-parity.test.ts`) stays green.

## Where we are

- **On main:** Classic mode (title > CLASSIC: Super Mario Bros., The Lost Levels once SMB is beaten, Options with the
  Classic rules switch), the Classic rules (power states with When Hit = Lose Everything, enemy HP and armour,
  bricks and shots, swimming, drops, scoring), and 9 Classic heroes: Mario, Luigi, Link, Mega Man, Samus, Simon,
  Ryu, Bill, Sophia III.
- **Held PRs:** #150 Bass, Proto Man, Break Man, Pit, Dark Pit; #151 Vic Viper and the Warriors of Light; #153
  original art for the #150 heroes; #154 a Classic patch. Proto Man and Pit are built as **variant factories**
  (`classicMegaMan({...options})`, `classicSamus({variant})`) with their own select slots on a second row. That
  pattern is what FU-3 reuses.
- **Hooks that already exist** and that the options below plug into: `rules/hooks.ts` (`enemyHit`,
  `enemySpawned`, `strikeBlock`, `levelEdits`, which may rewrite the area's spawn list), `classic/power.ts`
  (`classicOnHurt`, `classicDrop` with `CLASSIC_DROP_RATES`, `classicRespawn`), `Game.liveRules` / `Game.roster` /
  `Game.classicRun`, `Settings.classicRules` and `ClassicOptionsScene`, and every Classic def's full kit (TG-44:
  every original weapon is built; today only `&kit=full` reaches the non-default ones).

## One shared piece: Classic settings

Add `Settings.classic: ClassicSettings` (normalised on load, every field defaulting to the original) and an
optional `GameContext.classic?: ClassicSettings` that `Game` fills **only for a Classic run with Classic rules**
(campaign and Current rules: absent, so nothing reads it). Each consumer reads it in the one hook it already
owns, never in shared code. The CLASSIC > Options menu grows sub-menus that mirror the original's:
**Game Mode**, **Customize Weapons**, **More Settings**, **Cheats**. Each row says what it changes; a row whose
value differs from the original shows it (so a run is never silently non-original), and a "Restore originals"
row resets them.

## The items

### FU-7a More Settings (difficulty rows)

The original's `DifficultySettingsMenu` under Classic power-ups (its `classicMode`) shows these rows; Start With
Mushroom is hidden there and forced off. Our implementation, per row:

| Row             | Original values (**default**)                                         | What it does in the original                                                                        | Our hook                                                                                               | Size                 |
| --------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------- |
| Lives           | 1, **3**, 5, 7, 10                                                    | Lives at a new game                                                                                 | `newGameState` lives for a Classic run                                                                 | S                    |
| When Hit        | **Lose Everything**, Previous State, Instant Death                    | Lose Everything: any hit ends small. Previous State: Fire goes to Big. Instant Death: any hit kills | `classicOnHurt` takes the response from the run (today hard-wired to Lose Everything)                  | S                    |
| Attack Strength | Very Weak 0.66, Weak 0.75, **Normal 1**, Strong 1.75, Very Strong 3   | Multiplies every hero's damage (`DamageValue.dmgMult`)                                              | One multiply in `classicHit` (all Classic damage is already in the original's units)                   | S                    |
| Item Drop Rate  | Very Low −5 %, Low −2.5 %, **Normal 0**, High +7.5 %, Very High +15 % | Added to the hero's base 25 % before the brick (×0.25) and coin-block (×0.5) factors                | `classicDrop`: rate = (0.25 + offset) × source factor                                                  | S                    |
| Enemy Speed     | **Normal**, Fast                                                      | Walking enemies use speed 90 instead of 65 (×1.38)                                                  | `enemySpawned` scales `walkSpeed`                                                                      | S                    |
| Replace Goombas | **Off**, Buzzy Beetle, Spiny, Spike Top                               | Every Goomba in the level data spawns as that enemy (never on the title)                            | `levelEdits` rewrites the spawn list; Buzzy and Spiny exist; **Spike Top is a new enemy with new art** | S (+M for Spike Top) |
| Piranhas        | **Some Pipes**, All Pipes, and Green/Red versions of each             | All Pipes adds a plant to every pipe top that lacks one; Green/Red forces the colour                | `levelEdits` adds and recolours piranha spawns (green and red plants exist)                            | S                    |

**Risks:** Fast enemies and All Pipes can make sections unfair or soft-locking (plants on the pipes you must
enter are hidden only while you stand close, as in the original, so this matches it). Piranhas on warp pipes need a
level sweep. Low risk to the campaign: all reads are behind `ctx.classic`.

### FU-7b Game Mode

| Mode                         | Original behaviour                                                                                                                                                                                                                                                             | Our work                                                                                                     | Size |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---- |
| **All Characters** (default) | Pick a hero at every level and after every death                                                                                                                                                                                                                               | **Already Classic mode's flow**                                                                              | done |
| Single Character             | Pick once at the start; that hero plays every level and every life                                                                                                                                                                                                             | `Game` skips the select screen after the first pick                                                          | S    |
| Single Random                | No select screen; a random enabled hero at every level start and restart (pre-level card with a random look)                                                                                                                                                                   | Same skip, plus a seeded random pick (FU-4's helper)                                                         | S    |
| Survival                     | Every hero is one life. All heroes start fallen; at the start (and after each castle) lives are spent to **revive** heroes (reviving a living hero instead gives it two random upgrades). A death makes that hero fall; game over when all have fallen. The lives card shows 1 | A revive mode on the select screen, a per-hero fallen state in `GameState`, castle hooks, and game-over rule | M    |

**Risks:** Survival is the one mode with new UI and save-shaped state; two players need a rule the original
never had (proposal: shared pool, each player picks from the living). Accessibility: revive mode needs its own
spoken instructions.

### FU-4 Random slot

The original's last grid slot is "?": it picks a random hero among the selectable ones (not fallen, enabled). Pressing
**Special** on any slot also picks a random skin. Ours: one more portrait at the end of the last row, our own "?"
art, a seeded pick from `Game.roster` (so tests and replays are stable), spoken as "Random". Special-for-random-skin
waits for FU-8. **Size S. Value:** high for little work, and Single Random reuses it. **Risk:** two players both on
Random may draw the same hero, which the original allows; keep it.

### FU-7c Customize Weapons

11 choices, enabled only under Classic power-ups. Defaults (= what our Classic heroes already get): Mega Man Metal
Blade; Bass Water Shield; Link Bomb; Samus Wave Beam; Simon Axe start, Cross extra; Ryu Shuriken start, Windmill
Shuriken extra; Bill Machine Gun and Spread; Sophia Triple Missile. Every alternative is **already built** (TG-44);
today only `&kit=full` reaches them. Work: each Classic def's power-up kit reads its slot from `ctx.classic.weapons`
instead of a constant, and a menu lists each hero's choices by name. **Size M** (11 rows, 9 defs; most of it is test
coverage). **Risk:** the drop tables and HUD ammo icons that assume the default weapon (e.g. Link's arrow drop needs
the Bow) must follow the choice; each hero's tests already cover the full kit, so this is mostly wiring.

### FU-7d Powerup Mode: Modern

The original's second power-up system (3.0's): Mushrooms and ? blocks hand out each hero's own upgrade list one at a
time, only Mario and Luigi get Fire Flowers, Start With Mushroom becomes available, When Hit becomes Lose Some / Lose
All / Keep Most / Instant Death, and Customize Weapons is disabled. Our Current rules are **not** this system. It
needs every hero's Modern upgrade order, the upgrade pool per hero, its own hit rules and HUD. **Size L. Value:** low
for "play the original"; most players know Classic. **Recommendation: park.**

### FU-7e Cheats

The original has 18, all off, most locked behind goals (beat the game and stomp N enemies, and so on).

- **Already covered by our Assists** (all options): Infinite Lives, Infinite Time, Invincible. Map them; no new code.
- **Small rule cheats** (each S, read in an existing hook): Everyone Can Stomp, All Weapons Pierce, Always Break
  Bricks, Infinite Ammo, Bouncy Pits, Extra Checkpoints, All Hammer Bros, Evil Hammer Bros.
- **Level edits** (M): All Ground Is Bricks, Water Mode (every area swims; our swim rules exist, but levels were not
  designed for it).
- **No-ops in 3.1.21:** Classic Samus and Classic Simon appear in the menu but nothing reads them. Do not build.
- **Classic Screen Scroll:** in the original the camera **follows back left by default**; this cheat turns that off.
  Our Classic runs today lock the left edge (the Allow left scroll assist is off). Under constraint 1, Classic runs
  should default to scrolling left. **Owner decision needed** (S to change).
- **Unlocks:** propose all unlocked from the start (the goals need stat tracking the Classic progress store lacks).
  Owner may prefer the original's goals (M).

**Risk:** cheats multiply test combinations; keep each to one hook and one guard test.

### FU-3 Gameplay skins as Classic variants

Skins with rule changes in 3.1.21 (`SkinDescriptions.as` and the hero classes):

| Hero         | Skin                                      | Rule changes                                                           | Engine work                                                   |
| ------------ | ----------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| Mega Man     | Rock                                      | No charge, no slide                                                    | `classicMegaMan` options (no-charge, no-slide)                |
| Mega Man     | Francesca, Doropie                        | No slide                                                               | same                                                          |
| Mega Man     | Rokko Chan                                | Dash instead of slide, dash jump, no charge                            | Bass's dash jump fields (`jumpSpeed`, `keepSpeedInAir`, #150) |
| Mega Man     | Cut Man                                   | Shots pierce enemies and bricks, head breaks bricks, 2 shots at a time | pierce + `canBreakBricks` + shot cap (Proto Man's cap option) |
| Mega Man     | Ice Man                                   | Charged shots freeze enemies, normal shots weaker                      | Samus's Ice Beam freeze (built) on the charge shot            |
| Mega Man     | Fire Man                                  | Normal shots stronger, immune to fire bars, 2 shots, double knockback  | Proto Man's options + a fire-bar immunity flag                |
| Link         | Zelda                                     | Arrows stronger; sword 150 / 225 / 350 instead of Link's               | damage table override                                         |
| Ryu          | Haggle Man                                | Attacks hit faster (own attack frames)                                 | frame timing override                                         |
| Bass         | Quick Man                                 | Walks ×1.3, no double jump, no dash                                    | profile override (needs #150)                                 |
| Mario, Luigi | SMB2, Toad, Peach, SML2, Space, SMW looks | **Small** Mario can crouch (the skin has a small crouch frame)         | one `smallCrouch` flag                                        |

Each is a few options on an existing factory, the way Proto Man and Pit are. **Each S**; the work is the original
art (a palette swap is enough to test, never to ship). **Value:** medium, mostly for fans of the original.

**Design choice (owner):** the original put these **behind a skin picker**, not in the grid. Proto Man and Pit got
grid slots; doing that for 14 more would make a four-row grid. **Recommendation:** a variant picker on the select
screen (Up/Down or Special on a portrait cycles "Mega Man / Rock / Cut Man ..."), i.e. the first piece of FU-8.
`GameState` gains a per-player `variant` id and `heroFor(def, rules, variant)` resolves it, so the World stays the
only place that resolves a def. Proto Man, Pit and their dark twins could later move into the picker too
(owner's call; their slots can stay).

### FU-8 Skin system

The original has ~200 character sheets across 14 heroes (Mega Man 27, Link 25, Mario 19, Simon 19, Bill 18) and 17
map skin sets, each with a source-game label and its own music set. Under constraint 2 every skin is new original
pixel art, so this is an **art programme**, not an engine task.

- **Engine (M, once):** a `skins` list per Classic def (id, name, sheet/palette, optional variant rules from FU-3),
  the picker above, a random-skin roll (FU-4's Special), and the choice remembered per hero in Classic settings.
  Draw code already takes a sheet and palette per def.
- **Art (L, ongoing):** a few skins per release, starting with the FU-3 gameplay ones. Cosmetic-only skins
  (Dark Link, NES/SNES/GB palettes) are the cheapest: palettes on existing sheets.
- **Map skins (L):** park. **Per-skin music:** parked (owner).

## Summary

| ID    | Item                                                                                   | Default kept        | Size                | Player value                              | Main risk                             | Slice   |
| ----- | -------------------------------------------------------------------------------------- | ------------------- | ------------------- | ----------------------------------------- | ------------------------------------- | ------- |
| FU-7a | More Settings: Lives, When Hit, Attack Strength, Item Drop Rate, Enemy Speed, Piranhas | original values     | S each, M total     | High (difficulty for everyone)            | Pipe and warp sweep for All Pipes     | **1**   |
| FU-7a | Replace Goombas (Buzzy, Spiny)                                                         | Off                 | S                   | Medium                                    | none                                  | **1**   |
| FU-7e | Cheats covered by Assists + Classic left scroll                                        | off / owner call    | S                   | Medium                                    | default scroll is an owner decision   | **1**   |
| FU-4  | Random slot                                                                            | not chosen          | S                   | High                                      | none                                  | **2**   |
| FU-7b | Single Character, Single Random                                                        | All Characters      | S                   | Medium                                    | none                                  | **2**   |
| FU-7c | Customize Weapons                                                                      | original weapons    | M                   | High (the built weapons become reachable) | drops and HUD follow the choice       | **3**   |
| FU-8  | Skin picker engine                                                                     | hero's default skin | M                   | Medium                                    | 2-player and save shape               | **4**   |
| FU-3  | Gameplay variants (Rock, Rokko, Cut, Ice, Fire, Zelda, Haggle, Quick, small crouch)    | default skin        | S each + art        | Medium                                    | art volume; Bass ones wait for #150   | **4-5** |
| FU-7b | Survival                                                                               | All Characters      | M                   | Medium                                    | new select-screen mode, 2-player rule | **5**   |
| FU-7e | Rule cheats (stomp, pierce, bricks, ammo, pits, checkpoints, Hammer Bros)              | off                 | S each              | Low-medium                                | test combinations                     | **5**   |
| FU-7a | Spike Top (Replace Goombas)                                                            | Off                 | M (new enemy + art) | Low                                       | new enemy                             | **6**   |
| FU-7e | Level-edit cheats (Water Mode, All Ground Is Bricks), cheat unlock goals               | off                 | M                   | Low                                       | unfair levels                         | **6**   |
| FU-7d | Powerup Mode: Modern                                                                   | Classic             | L                   | Low                                       | a second power system                 | park    |
| FU-8  | Cosmetic skins, map skins, per-skin music                                              |                     | L                   | Low-medium                                | art volume; music parked              | park    |

## Recommended order (release-sized PRs)

1. **Classic options I: More Settings.** `Settings.classic` + `ctx.classic`, the More Settings menu, the six rows and
   Buzzy/Spiny Goombas, the Assist-backed cheats, and the left-scroll default once the owner decides. One PR, each
   row with a guard test that its default changes nothing.
2. **Hero choice: Random slot + Game Mode** (All Characters, Single Character, Single Random).
3. **Customize Weapons.**
4. **Skin picker + first variants** (Mega Man family and Zelda with their art).
5. **Survival, rule cheats, remaining variants** (Haggle Man, Quick Man after #150, small crouch looks).
6. **Spike Top, level-edit cheats, unlock goals.** Park Modern, map skins, per-skin music.

## Questions for the owner

1. Classic runs: scroll back left by default, as the original does? (Recommended: yes.)
2. Variants: a picker on each portrait (recommended) or more grid slots like Proto Man and Pit?
3. Cheats: all unlocked from the start (recommended), or the original's unlock goals?
4. Survival with two players: one shared pool of heroes (recommended)?
