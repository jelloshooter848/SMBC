# Dev menu "Rules: Current / Classic SMBC": one switch that makes every hero play as in SMBC 3.1.21, leaving Current untouched

- **Severity:** feature request (Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=<id>` (once the toggle exists; today `?dev=1&level=1-1&char=<id>` shows the Current behaviour)
- **Character and power:** all heroes (Mario, Luigi, Link, Mega Man, Samus, Simon, Ryu, Bill), all power states; one and two players
- **Input:** keyboard
- **Browser and device:** any

This is the umbrella report. Read it first. It specifies:
- the switch;
- how the Classic heroes plug into our code;
- the shared-system hooks;
- the six Classic-only heroes on the select screen;
- the tests that keep Current unchanged;
- the index of all 19 reports;
- a build order;
- how the owner tests Classic.

## Steps

1. Open `?dev=1&level=1-1&char=link`. Link has hearts and a magic meter, and the HUD has no rules tag. This is Current.
2. Press Start → Dev mode. Today the menu has Level select, Mini games, Assists, Dev mode off and Back. It has no Rules row.
3. Once built: in the same menu, set **Rules** to **Classic SMBC**, close the menus and lose a life (or use Level select → Start).
   The level restarts. The HUD shows **CLASSIC** at the top right, and Link starts small, with no hearts.
4. Open `?dev=1&rules=classic&level=1-1&char=link` in a fresh tab. It starts in Classic straight away.
5. Dev menu → Dev mode off, then turn dev mode on again (Konami code at the title). Rules reads **Current**, and the next level plays as in step 1.

## Expected

Requirement IDs are `TG-1` … `TG-45` (plus `TG-17a`, `TG-17b` and `TG-17c`; TG-44 sits next to TG-8 because both are about `kit=full`, and TG-45 sits with the shared-system hooks). "The resolved def" means `heroFor(def, rules)` from TG-17.

### Controls: the Rules row (`src/game/scenes/dev.ts`)

- **TG-1** The Dev mode menu gets a row **Rules**, placed directly after **Assists** and before **Dev mode off**
  (`dev.ts:25-30`). Its value reads **Current** or **Classic SMBC**. Left, right and select all flip it.
  Hint: "Classic SMBC: heroes play as in SMBC 3.1.21". The menu fits the value: the value column holds
  18 characters after "RULES" (`menu.ts:191-199`), and "CLASSIC SMBC" is 12. The screen reader line comes free from
  `menu.ts:125-126` ("Rules: Classic SMBC. Classic SMBC: heroes play as in SMBC 3.1.21").
- **TG-2** Flipping the row writes `settings.rules` and calls `game.deps.applySettings()`, as Assists do
  (`options.ts:241-247`). That saves the setting and updates `ctx.rules` at once.
- **TG-3** When the Dev menu was opened from the pause menu (`fromPause`, `dev.ts:12`), flipping the row also
  sets the menu status line to **APPLIES AT NEXT START** (21 characters; the status line holds 28, `menu.ts:202-208`).
  The level under the menu keeps its rules (TG-10).
- **TG-4** The campaign pause menu keeps hiding the Dev mode entry (`pause.ts:106-113`). In campaign play,
  Rules can only be changed from the title's Dev menu. No new pause rows are added.

### URL parameter (`src/main.ts`)

- **TG-5** `rules=classic` and `rules=current` are read after the `dev` parameter is applied (`main.ts:168-173`)
  and before any level starts (`main.ts:175-185`). The value is honoured only when `settings.dev` is true at that
  point, so `?dev=1&rules=classic` always works. `?rules=classic` with dev mode off, or `?dev=0&rules=classic`, is
  ignored, plays Current and logs `console.info('[dev] rules=classic ignored: dev mode is off')`. Any other value is ignored.
- **TG-6** An honoured `rules=` value is stored in `settings.rules` and saved through `applySettings()`, just as
  `dev=1` persists dev mode today (`main.ts:169-173`). `&rules=current` switches back.
- **TG-7** Put the parsing in a small pure helper, for example `urlRules(params, dev): Rules | null` in
  `src/game/dev-url.ts`, so a unit test can cover it without booting `main.ts`.
- **TG-8** `&kit=full` (`main.ts:181-184`) uses the resolved def's `devKit()`. Under Classic it also sets the
  carried power to that def's top state (`'fire'`). The `maxHp` line stays for Current only.
- **TG-44** **`&kit=full` reaches the non-default weapons.** The Customize Weapons menu is out of scope, so with the
  Classic defaults some original weapons and arts can't be reached. Examples: Ryu's Fire Wheel, Fire Dragon Ball and
  Jump Slash; Mega Man's other Robot Master weapons; Samus's Ice Beam; Simon's other sub-weapons; Bill's other guns;
  Link's Bow and arrows. **One rule for every hero:** every original weapon and art is built; the power-ups hand out
  only the Customize Weapons defaults; every other one is reached only through `&kit=full`.
  - **What `kit=full` gives under Classic** (dev only): each Classic def's `devKit()` grants every original weapon and
    art that hero can carry, at the top power state, with full ammo.
  - **Select cycles them:** **Select** steps through the granted weapons with the shared `cycleTool`
    (`toolbelt.ts:29-34`). The def's `tools(p)` lists them only while that full kit is carried (for example a kit key
    `classicAll: 1`), and the HUD shows the selected one as it does today (`hud.ts:73-83`).
  - **Without `kit=full`,** a Classic hero has only its Classic default weapons and no belt (TG-22).
  - **The dev Level select's Kit = full** (`dev-level-select.ts:41-46`) does the same.
  - **Rules change:** the kit is dropped like any other carried kit (TG-16).
  - **Hero reports** list which weapons this unlocks, what Select cycles, and which button then fires the selected
    weapon; they cite TG-44 as the only way to reach non-default weapons.

### State, persistence and the dev-off reset

- **TG-9** `src/game/context.ts` exports `type Rules = 'current' | 'classic'`. `GameContext` gets
  `rules?: Rules` (`context.ts:26-32`). The field is **optional**, and when it is absent the rules are `'current'`.
  Add a helper `rulesOf(ctx): Rules`. The reason it must be optional: 26 test files and harnesses build `GameContext`
  literals without it (for example `tests/sim/heroes-harness.ts`, `tests/sim/coop.test.ts`, `src/game/sim/headless.ts:95`).
  Those must compile and pass unedited.
- **TG-10** `Settings` (`src/engine/save/settings.ts:29-51`) gets `rules: Rules`, default `'current'` in
  `defaultSettings()` (`settings.ts:55-80`). It must be in the defaults, because `merge()` drops stored keys that the
  defaults lack (`settings.ts:85-96`). `loadSettings()` turns any value other than `'classic'` into `'current'`
  (next to the touch checks, `settings.ts:110-113`). There is no version bump and no migration (`v` stays 1).
- **TG-11** `applySettings()` (`main.ts:127-151`) sets `ctx.rules = settings.dev ? settings.rules : 'current'`,
  next to the assists line (`main.ts:140`). The `ctx` literal (`main.ts:65`) starts with `rules: 'current'`.
- **TG-12** **Dev-off reset.** When `settings.dev` is false, `applySettings()` also sets `settings.rules = 'current'`
  before `saveSettings()` (`main.ts:128`). That one line covers Dev menu → Dev mode off (`dev.ts:30-43`), `?dev=0`
  and any later path. This is unlike Assists, which keep their values while dev mode is off (`main.ts:138-140`).
  The reason: if dev mode came back already in Classic, without anyone noticing, bug reports would name the wrong rules.

### When a switch takes effect

- **TG-13** Each `World` reads the rules once, in its constructor (`world/world.ts:277-319`), into
  `readonly rules: Rules`. A World never changes rules. The switch takes effect at the next new World:
  - a level start (`game.ts:788-835`, `goToLevel` → `IntroScene` → `startLevel`);
  - an area transfer (pipe, vine, bonus room, sky; all go through `startLevel`);
  - a respawn after a death, with dev quick respawn or with character select (`game.ts:843-849`);
  - a continue (`game.ts:917-927`).

  Flipping the row in the middle of a level changes nothing on screen until then.
- **TG-14** `WorldStart` gets an optional `rules?: Rules` override, used instead of `ctx.rules` when given.
  These always pass `'current'`, because they are scripted around Current kits:
  - the mini games: Luigi race (`minigames/luigi/race.ts:59`), Mega Man station (`minigames/megaman/scene.ts:98`,
    which gives Mega Man `kit = { helmet: 1 }`) and Link's keep;
  - training rooms (`tutorial/room.ts:202`).

  This holds whether they are reached from the map, the Dev menu → Mini games, or `?minigame=`. The stage tutorial 1-0
  is a normal level and follows the toggle.

### Carried power, HP and kit when the rules change

- **TG-15** `GameState` (`context.ts:35-60`) gets `rules?: Rules`: the rules under which `powerState`, `hp`, `kit`
  and their player-2 copies were earned. When it is absent the rules are `'current'`. `newGameState(c, c2, rules = 'current')`
  (`context.ts:66-85`) computes the default power and HP from the resolved defs. It writes `rules` **only** when it is
  `'classic'`, so every Current state stays deep-equal to today's.
- **TG-16** **Safe default: reset to small when the rules change.** Do this when a `LevelScene` is built, before
  `new World` (`level.ts:43`). If `(state.rules ?? 'current') !== rulesOf(ctx)`, then for each player:
  - `powerState` becomes the resolved def's default (`'small'` for every Classic def; `'small'` or `'full'` for Current);
  - `hp = startHp(resolved)`;
  - `kit = {}`.

  Then set `state.rules` to the new rules. Lives, score, coins, checkpoint, time, world, stage and `warped` are kept.
  Announce "Rules changed. Power reset." through the announcer. **Why:**
  - The models don't map one to one. Link's hearts and Samus's energy tanks have no Classic tier.
  - Current kit keys (`maxHp`, `magic`, weapon energy, `helmet`, tool index) would leak into a Classic hero's
    `scratch` through `Object.assign(p.scratch, state.kit)` (`world.ts:319`), and Classic keys would leak back.
  - It matches what a death does in both games. The original's `StatManager.playerDie` sets `PS_NORMAL`
    (`StatManager.as:1560-1566`), and ours has `setHero` (`game.ts:876-890`).
  - It is dev-only, so the lost power costs nothing.
- **TG-17a** Fresh runs set `state.rules` to the live rules: `newGame`, `devStart`, `playtest`, `playShared`, the
  campaign `gameOver` reset and `continueGame` (`game.ts:632-702, 897-927`). `setHero` (`game.ts:876-890`) uses the
  resolved def's default. The dev Level select's Power list (`dev-level-select.ts:61-63`) reads the resolved def's
  `damage`, so under Classic every hero offers small, big and fire.
- **TG-17b** **Campaign saves.** `SaveFile` gets `rules?: 'classic'`. `saveFromState` (`save-files.ts:393-408`)
  writes it only when `state.rules === 'classic'`, so Current files stay field for field as today. The loader keeps it
  only when it equals `'classic'` (`save-files.ts:245-320`). `stateFromSave` (`save-files.ts:368-390`) checks power,
  HP and kit against `heroFor(c, save.rules ?? 'current')`, not the Current def. Without that, a Classic Link saved
  as `'big'` would fail `validPower` (`save-files.ts:360-362`) even while Classic is still on. A file whose rules
  differ from the live rules is reconciled by TG-16 at the next level start. Map progress, freed heroes, lives and
  score are never touched.
- **TG-17c** The stage-tutorial hero swap stashes `state.rules` with the file's hero (`game.ts:339-344`), and
  `endTutorial` (`game.ts:421-430`) puts it back. A mismatch is then reset by TG-16.

### The registry chooses `classic.ts`

- **TG-17** In `src/game/characters/registry.ts`:
  - `CHARACTERS` stays exactly as it is (`registry.ts:12`).
  - Add `CLASSIC_CHARACTERS: Partial<Record<string, CharacterDef>>`, filled from `src/game/characters/<id>/classic.ts`.
    Each file exports `<ID>_CLASSIC` (Luigi gets his own `luigi/classic.ts` with the original's constants).
  - Add `heroFor(def, rules)`. It returns `CLASSIC_CHARACTERS[def.id]` when `rules === 'classic'` and one exists,
    else `def`.
- **TG-18** A Classic def keeps the Current def's `id`, `name`, `hudName`, `portrait` and `music`. It sets a new
  optional field `rules: 'classic'` on `CharacterDef` (`character.ts:119-163`). Weapons that only Classic has go in
  `<id>/classic-weapons.ts`. Classic files may import Current helpers (sprite and palette functions, sheets). No
  Current file imports a `classic*` module.
- **TG-19** `GameState.character` and `character2` always hold the **Current** def. They are the roster identity
  used by the select screen, the map, saves, captives, tutorials and the identity checks at `game.ts:324-325, 340`
  and `world-map.ts:1078`. Only the World resolves:
  - `world.ts:304-317` builds each Player with `heroFor(def, this.rules)` and that def's `movement`.
  - In-level code reads the Player's def. Switch `hud.ts:35, 49, 74, 84, 86, 109-111` to `players[i].def`, falling
    back to the state's def when `players` is empty (the intro card, `intro.ts:37`).
  - Pause → Guide uses `world.players[i].def` when a world is given (`pause.ts:27-32`). E-tanks already read `p.def`
    (`pause.ts:46-47`).
  - The level music reads `world.player.def.music` (`level.ts:62-65`).

  Under Current `players[i].def === state.character`, so all of these draw exactly what they draw today.
- **TG-20** While a hero has no `classic.ts`, `heroFor` returns its Current def, so it plays Current under Classic
  rules. This lets the heroes land one at a time. The tag (TG-31) and the F1 overlay (TG-33) show it.
- **TG-21** Every Classic def uses `damage: { kind: 'powerup', states: ['small', 'big', 'fire'] }`, with the
  Mushroom tier stored as `'big'` and the Flower tier as `'fire'`. These are the ids that the dev select
  (`dev-level-select.ts:5`), saves (`validPower`), the co-op drop-in (`world.ts:1514`) and the HUD already
  understand. The power-states report may name the tiers per hero in text, but the stored ids stay these three.
- **TG-22** Each Classic def has its own `guide` (Classic controls and power-ups; a short one is enough at first) and
  `touchLabels`. A Classic def leaves out `tools`, `meter`, `hudExtra`, `reserve`, `startHp` and `drop` unless its hero
  report asks for one. So the tool belt, meters, E-tanks and health drops are absent with no extra branches. The one exception is `tools`
while the dev full kit is carried (TG-44).

### Shared-system hooks (each branches in one place)

- **TG-23** **The rule.** Each shared system branches on `world.rules` in exactly **one** place, listed below.
  Everything else that differs in Classic lives in the Classic defs, their profiles and their weapon specs.
  - New player physics (a constant-speed jump rise, a soft jump cut, instant air steering, an air jump, rooting,
    semi-transparent invulnerability) are **optional** fields on `MovementProfile` (`profile.ts:31-68`),
    `SwimProfile` (`profile.ts:20-29`) or `CharacterDef`.
  - When such a field is absent, today's code path runs unchanged. No Current def sets one.
- **TG-24** **Enemy HP, armour, hit-stun and Bowser forms:** `Enemy.hit` (`entities/enemies/enemy.ts:86-125`) is
  the single door for damage to enemies. Stomps, the star, melee (`world.ts:1269-1273`), shots (`world.ts:1418-1431`),
  blasts (`world.ts:625`) and block bumps (`world.ts:1124`) all come through it. Its first line becomes
  `if (world.rules === 'classic') return classicHit(this, src, world);`, with the table and logic in
  `src/game/rules/classic-enemies.ts`. The classic HP counter is kept apart from `Enemy.hp`, which Current Bowser
  uses (`bowser.ts:105`). `DamageSource.amount` carries the Classic damage in the original's units (a Goomba has 250).
  The melee source is hard-coded as `{ kind: 'sword', amount: 1 }` (`world.ts:1269`). Add an optional
  `CharacterBehaviour.meleeDamage?(p, e): DamageSource`, used when present; Current defs don't define it.
- **TG-25** **Bricks and ? blocks:** `World.strikeBlock` (`world.ts:1110-1155`) is the only place a block reacts.
  These all reach it:
  - head bumps through `hitBlock` (`world.ts:1105-1107`, using each def's `canBreakBricks`, so Classic heads are per def);
  - shots through `breakAt` (`world.ts:646-653`);
  - blasts (`world.ts:641`);
  - melee (`link/index.ts:295`).

  The Classic brick rules (125 HP, weapons that damage or bump a block from the side) branch here on `this.rules`.
  An optional `damage?: number` parameter carries the hit's strength.
- **TG-26** **Shots through solid ground:** this needs no rules branch. `Projectile.update`'s tile block
  (`entities/projectiles/projectile.ts:237-277`) already reads per-spec flags (`hitsTiles`, `piercesTiles`,
  `breaksBricks`). Classic weapon specs set them. If "passes ground but still hits bricks and ? blocks" needs a new
  behaviour, add one optional spec flag there.
- **TG-27** **Swimming:** this needs no rules branch. `Player.swim` (`entities/player.ts:295-344`) gets one optional
  `SwimProfile` field (for example `floorJumpOnly: true` with that hero's water jump speed). When it is set, jump works
  only from the floor (`player.ts:310-320`). Classic profiles set it for every hero except Mario and Luigi.
  `DEFAULT_SWIM` (`player.ts:16`) stays as it is for Current.
- **TG-28** **Power states, hit response, drops and Star:** these need no rules branch. Classic defs implement
  `onHurt`, `onPowerUp` and `drop` with a shared helper module, `src/game/characters/classic/power.ts`. It holds
  Lose Everything, the hit response and invulnerability, ammo-only drops, and a Star of 12.0 s = 720 frames (Current
  keeps `STAR_FRAMES = 600`, `constants.ts:11`). `World.hurtPlayer` (`world.ts:1440-1452`) stays as it is. Its
  knockback branch is for `hp` heroes only (`world.ts:1444`), so it never fires for a Classic def; Classic knockback
  is applied inside the helper.
- **TG-29** **Assists under Classic:**
  - "Fire keeps big" (`mario/index.ts:139`) is **ignored**, because Lose Everything is a decided Classic rule.
  - The others still apply: scroll back, infinite lives and time, no damage, coyote time (`world.ts:317`) and slow motion.
- **TG-45** **Per-rules level variants.** A level may carry cells, entities and zones that exist only under Classic SMBC (or only for one Classic hero, as Sophia's `WideCharacter` edits in `2026-10-07-sophia-build-classic-character.md` do). Today there is
  one set for every Classic hero: the coral stepping stones and moved coins of 2-2 and 7-2 for heroes who are not good swimmers (SW-C12).
  - They live in a table in `src/game/rules/classic-water.ts` (keyed by level id), never in the `.map` files.
  - They are applied once, when a World builds its tile map at a level or area load (`world.ts:277-319`, near the
    water setup at `:386-397`), only when `this.rules === 'classic'` and the owning report's condition holds.
  - Under Current (and with dev mode off) the map is exactly today's map: TG-36's tile-map hash must not change.
  - A rules change shows at the next World, as everything else (TG-13).
  - Test (in `rules-toggle.test.ts`): Classic Link in 2-2 has `B` at (134, 13); Current Link and Classic Mario do not.

### Co-op and the map

- **TG-30** Both players always run the same rules (one World, one `rules`). Player 2 is resolved by the same
  `heroFor` call (`world.ts:304-305`). The co-op drop-in (`world.ts:1506-1523`) already uses `p.def`, so a Classic
  hero drops back in small. Mixed rules are impossible by construction. The world map, scoring, enemy AI and levels
  are not touched, apart from the shared systems above.

### Visible indicator

- **TG-31** While `world.rules === 'classic'`, `LevelScene.render` (`level.ts:252-258`) draws **CLASSIC** in the HUD
  font at x = 196, y = 0. That is the top-right corner, above TIME (TIME is at 200, 8, `hud.ts:46`), and clear of the
  F1 overlay at the top left. It is drawn after the HUD and the debug overlay, so it shows under the translucent
  pause menu too and is in every screenshot. If any player's hero has no Classic def yet (TG-20), it reads
  **CLASSIC?** at x = 188 instead. The font has `?` but no `*`.
- **TG-32** The intro card (`intro.ts:31-40`) draws the same tag when `rulesOf(ctx)` is Classic. The title draws
  **DEV CLASSIC** where it draws **DEV** today (`title.ts:84`).
- **TG-33** The F1 overlay (`debug-overlay.ts:25-33`) adds a line such as `rules classic p1 link classic p2 mario current`.
- **TG-34** `bug-reports/TEMPLATE.md` adds this to the Character and power line: "add `Rules: Classic SMBC` when the
  CLASSIC tag shows". `bug-reports/README.md` adds `&rules=classic` next to `?dev=1`.

### Current stays unchanged, and the tests that prove it

- **TG-35** With `rules === 'current'` (the default, and always when dev mode is off), the game behaves exactly as
  at d3ad397. Every existing test (`tests/sim/*`, `tests/release/*`, `src/**/*.test.ts`) passes with **no edits**.
  `pnpm typecheck` and `pnpm lint` pass. A PR that changes an existing test to make it pass does not meet this
  requirement.
- **TG-36** **Golden parity test.** Before any Classic code lands, record `tests/sim/fixtures/current-parity.json` at
  d3ad397 with a recorder behind an environment flag (`RECORD_PARITY=1 pnpm vitest run tests/sim/current-parity.test.ts`).
  - **Runs**, through `runSim` (`sim/headless.ts:90-137`) with fixed scripts and seeds:
    - every one of the 8 heroes in 1-1 (900 frames of run right with jumps and attacks every 40 frames), in 1-2
      (900 frames) and in 2-2 (400 frames of strokes);
    - each hero once from its top power state with `kit=full`;
    - one co-op run, Mario + Link in 1-1.
  - **Recorded:** per frame, x, y, vx, vy, `powerState` and `hp`; at the end, score, coins, lives, the event list, a
    hash of the tile map (bricks broken, blocks used) and the alive enemies' ids.
  - After every Classic PR, the same runs **with and without** `rules: 'current'` must match the fixture exactly.
- **TG-37** `SimOptions` (`sim/headless.ts:60-75`) gets `rules?: Rules`, default `'current'`. `runSim` puts it in
  the ctx (`headless.ts:95`) and in `state.rules`, so `runSim({ character: LINK, rules: 'classic', … })` plays
  Classic Link. Each hero report's acceptance checks use this.
- **TG-38** New file `tests/sim/rules-toggle.test.ts` covers:
  - **Settings:** `defaultSettings().rules` is `'current'`; a stored `'classic'` survives `loadSettings()`; `'bogus'`
    loads as `'current'`.
  - **Dev-off reset:** with `dev: false`, `applySettings` gives `ctx.rules === 'current'` and stores `'current'`.
    The URL helper honours `rules=classic` only with dev mode on.
  - **Resolution:** under Current, `world.players[0].def === state.character` for all 8 heroes. Under Classic, the def
    has the same `id` and `rules === 'classic'` (or is the Current def for a hero not yet built).
  - **When it takes effect:** flipping `ctx.rules` while a `LevelScene` runs leaves `world.rules` alone; the next
    `goToLevel` uses the new rules.
  - **Carry reset (TG-16):** a fire Mario with 12 coins and 2 lives is small after the switch and keeps his coins and
    lives. With no switch, nothing is reset.
  - **Saves:** a Current campaign save has no `rules` key. A Classic save round-trips its power through
    `stateFromSave`.
  - **Mini games and training rooms** build Current defs while `ctx.rules` is `'classic'`.
  - **Tag:** a spy renderer sees `CLASSIC` only in Classic worlds, and `CLASSIC?` when a hero has no Classic def.
  - **Co-op:** both players are Classic.
  - **Full kit (TG-44):** under Classic, `kit=full` gives each built hero more than one tool, and Select changes the
    selected one. Without it, `tools` is empty or absent.
- **TG-39** A guard test checks that no `CHARACTERS` entry has `rules` set, that `CHARACTERS` ids and order are
  unchanged, and that no file outside `classic*.ts`, `characters/classic/` and `rules/classic-*.ts` imports a classic
  module. It scans the import lines under `src/`.
- **TG-40** `guide.test.ts` and `no-button-letters.test.ts` already check the Current guides and menus. Extend them
  in **new** test cases (not by editing the existing ones) to cover every Classic def's guide and the Rules row text.

### Classic-only heroes on the select screen

These are the six missing characters with their own build reports (see the index): Bass, Sophia III, Proto Man,
Pit, Vic Viper and the Warriors of Light. They have only a Classic def; there is no Current version.

- **TG-41** **Shown only with dev mode on and Rules = Classic SMBC.**
  - **Registry:** add `CLASSIC_EXTRAS: CharacterDef[]` to `registry.ts`, in this order: Bass, Sophia III, Proto Man,
    Pit, Vic Viper, Warriors of Light. Each def has `rules: 'classic'`. Only the heroes that are built get registered.
    `CHARACTERS` never contains them (TG-39).
  - **Roster:** add `Game.roster`, which returns `CHARACTERS` followed by `CLASSIC_EXTRAS` when
    `devMode && rulesOf(ctx) === 'classic'`, and `deps.characters` otherwise.
  - **Who reads the roster:** the character select (`character-select.ts:52, 59, 76, 111, 199`), the dev Level select's
    Character row (`dev-level-select.ts:32, 58`), Options → How to play (`guide.ts:62`), and `?char=` / `?char2=` in
    `main.ts:177-179`. Read `?char=` after the rules are applied, so `?dev=1&rules=classic&level=1-1&char=bass` works.
    Everything else (`heroesToFind`, captives, the map, tutorials) keeps reading `deps.characters`, so the extras never
    count as heroes to find.
  - **Layout:** the select screen draws the extras on a **second row**, 40 px below the first, with the same spacing
    rule (`character-select.ts:199-201`), like the original's two-row grid. Left and right walk through the whole
    roster in order and wrap. The first row is drawn exactly as today.
  - **Under Current, or with dev mode off,** `Game.roster === deps.characters`. The select screen, the dev select and
    How to play are the same as at d3ad397.
- **TG-42** **Locking and carried extras.**
  - **Locking:** `heroLocked(def)` (`game.ts:570-573`) returns true for a Classic extra unless dev mode is on and the
    rules are Classic. Otherwise it returns false: an extra has no captive to free, so in campaign play it can be
    picked as if freed. It is never added to `freed`.
  - **Rules change:** if the carried hero is an extra and the live rules become Current (or dev mode goes off), the
    TG-16 reconcile replaces it with the first hero, as `dropLockedHeroes` does (`game.ts:576-580`), at default power.
    `openFile` already calls `dropLockedHeroes` (`game.ts:728`).
  - **Saves:** `stateFromSave` gets the Classic roster when `save.rules === 'classic'`, so a saved Bass loads as Bass.
    Under Current he falls back to Mario through the existing unknown-id path (`save-files.ts:369-372`) and the
    reconcile.
- **TG-43** **Rooms they don't have.** Extras have no captive room, freeing mini game or training room.
  `trainingOffered` (`pause.ts:37`) and the "TRAINING?" question return false for them. If dev Level select starts
  1-0 with an extra, the stage tutorial still swaps in Mario (`game.ts:333-347`).
- **Tests (added to `rules-toggle.test.ts`):**
  - Under Current, and under Classic with dev mode off, the select shows the 8 heroes and `?char=bass` falls back to
    Mario.
  - Under dev mode with Classic, the select shows 8 plus every registered extra, in order, on the second row.
  - A carried Bass becomes small Mario after the rules switch to Current.
  - A Classic campaign save with Bass round-trips.

## Actual

There is no rules switch.
- The Dev menu has Level select, Mini games, Assists, Dev mode off and Back (`src/game/scenes/dev.ts:18-45`).
- `GameContext` holds only `assets`, `audio`, `assist` and `reduceFlashing` (`src/game/context.ts:26-32`).
- `main.ts` reads only `dev`, `level`, `char`, `char2`, `kit` and `minigame` from the URL (`src/main.ts:168-202`).
- The registry has one definition per hero (`src/game/characters/registry.ts:12`).
- Each World builds its players straight from `state.character` (`src/game/world/world.ts:304-319`).

All heroes play Current: six have health bars, our kits and the tool belt, and they share our brick, enemy and
swimming rules.

## How often

every time

## Notes

- **Sources.**
  - Original defaults: `GameSettings.as:87` (`powerupMode = PowerupMode.Classic`), `:186-215` (`setDefaults` calls
    `resetClassicSettings`), `:219-221` (`classicDamageResponse = LoseEverything`); a death resets power,
    `StatManager.as:1560-1566`.
  - Our code: as cited in each requirement, all at `$S/main` (d3ad397). The Classic numbers themselves live in the
    shared and hero reports.
- **Implementation hints.**
  - **Order inside the toggle PR:** `Rules` type and optional ctx field → settings default and coercion →
    `applySettings` line plus dev-off reset → URL helper → Dev menu row → `World.rules`, `heroFor` and the player
    build → HUD, pause and music reading `p.def` → carried-state reconcile → saves → `WorldStart.rules` for mini games
    and training → tag and F1 line → `SimOptions.rules` → tests.
  - **Record the parity fixture first** (TG-36), on an untouched checkout.
  - **Keep `GameState.character` as the Current def.** Swapping it for the Classic def would break the identity
    checks in `game.ts:324-325, 340` and `world-map.ts:1078`, and would leak Classic defs into the select screen,
    which is out of scope.
  - **Keep `Enemy.hp` untouched** for Current; Classic uses its own counter (TG-24).
  - **Physics:** prefer an optional field that a Classic profile sets over a `world.rules` check in `player.ts`.
    `Player` has no world reference in `update()`.
- **Acceptance checks.**
  - TG-36 to TG-40 pass.
  - Played: `?dev=1&rules=classic&level=1-1&char=mario` shows CLASSIC.
  - Played: flipping the row in a level and dying gives the new rules.
  - Played: Dev mode off and on again reads Current.
  - Played: `?rules=classic&level=1-1` without `dev=1`, on a profile with dev mode off, plays Current with no tag.
  - Current unchanged: the full suite green with zero diffs under `tests/` other than new files.
- **Confidence.** Our code was read at d3ad397; nothing was played. The line numbers were checked against that commit.
  The original's defaults were confirmed in source.
- **Open questions.** Each has a default to use meanwhile.
  1. Should `&rules=` persist like `dev=1`? Default: yes, so a test link sets up the session and the tag makes it obvious.
  2. Should Dev mode off forget Classic? Default: yes (TG-12).
  3. Should mini games and training rooms stay Current? Default: yes (TG-14). A later report can add Classic training.
  4. Should 1-0 follow the toggle? Default: yes (only Mario plays it).
  5. Where should the tag go? Default: top right, y = 0. Move it if the owner finds it in the way.
- **Related reports.** Everything listed in the index below. Existing open reports that the Classic switch touches:
  - `2026-10-06-water-non-mario-heroes-stroke.md`: C8, fixed for Classic by the swimming report.
  - `2026-10-06-water-surface-air-physics.md`.
  - `2026-10-06-simon-no-air-control-after-green-spring.md`: Classic Simon has full air control.
  - `2026-10-06-megaman-slide-crosses-one-tile-gaps.md`.

  These stay valid for Current. Each should say whether its fix also applies to Classic.

### Index of the 19 reports (all in `bug-reports/`, dated 2026-10-07)

| # | File | IDs | Purpose |
|---|---|---|---|
| 1 | `2026-10-07-dev-classic-smbc-rules-toggle.md` | TG- | This report: the switch, how Classic plugs in, the shared hooks, the parity tests, the index, the build order, how to test |
| 2 | `2026-10-07-classic-power-states.md` | PS-C | C1, C10, C11: small/Mushroom/Flower for every hero with Lose Everything, the hit response and invulnerability, ammo-only drops, Star 12 s, and what each tier gives per hero |
| 3 | `2026-10-07-classic-enemy-hp-and-armour.md` | HP-C | C2: enemy HP table, armour list, piercing, hit-stun and Bowser's forms, behind `Enemy.hit` |
| 4 | `2026-10-07-classic-bricks-and-shots.md` | BR-C | C3 and C4: heads bump (only big Mario and Luigi break), weapons break and bump blocks, shots that pass through ground; a per-hero table |
| 5 | `2026-10-07-classic-swimming.md` | SW-C | C8: only Mario and Luigi stroke; everyone else jumps from the floor with their own water jump and gravity |
| 6 | `2026-10-07-mario-luigi-classic-smbc-rules.md` | ML-C | Mario's rocket jump arc, stomp bounce, air control and fireball; Luigi's own constants |
| 7 | `2026-10-07-link-classic-smbc-rules.md` | LK-C | Link without hearts, magic, shield or crouch: rooted stabs, Zelda II thrusts, boomerang, arrows, bombs, sword beam |
| 8 | `2026-10-07-samus-classic-smbc-rules.md` | SA-C | Samus's beams, missiles, Wave Beam through ground, Screw Attack, jump and soft cut, no energy tanks |
| 9 | `2026-10-07-simon-classic-smbc-rules.md` | SI-C | Simon's lower jump plus air jump, full air control, whip tiers, sub-weapons (Axe, Cross), rooting |
| 10 | `2026-10-07-megaman-classic-smbc-rules.md` | MM-C | Mega Man's buster through ground, charge on the Mushroom, Metal Blade on the Flower, no E-tanks, HP bar or invented weapons |
| 11 | `2026-10-07-bill-classic-smbc-rules.md` | BI-C | Bill's rifle, Machine Gun and Spread tiers, bullets through ground, instant start and stop, hit freeze |
| 12 | `2026-10-07-ryu-classic-smbc-rules.md` | RY-C | Ryu's fixed jump, sword extension, ninpo (Shuriken plus Windmill), wall climbing, Fire Dragon Ball |
| 13 | `2026-10-07-classic-follow-ups.md` | FU- | Parked for later: skins, Modern mode, Customize Weapons, More Settings, cheats, other select-screen changes (the missing heroes now have the build reports below) |
| 14 | `2026-10-07-protoman-build-classic-character.md` | PM- | Proto Man and Break Man as a Classic Mega Man variant (dev + Classic only, TG-41) |
| 15 | `2026-10-07-pit-build-classic-character.md` | PI- | Pit and Dark Pit as a Classic Samus variant, plus what is known of the cut standalone Pit |
| 16 | `2026-10-07-bass-build-classic-character.md` | BA- | Bass, playable in 3.1.21: 7-way rapid buster, double jump, dash and dash jump, Mega Man's weapons |
| 17 | `2026-10-07-sophia-build-classic-character.md` | SO- | Sophia III (Jason cosmetic): wall and ceiling driving, hover, cannon, missiles, free swimming, `WideCharacter` level data |
| 18 | `2026-10-07-vicviper-build-classic-character.md` | VV- | Vic Viper, a cut prototype: what the source has and the design gaps the owner must fill |
| 19 | `2026-10-07-warriors-of-light-build-classic-character.md` | WL- | The Warriors of Light, a cut Final Fantasy prototype: what the source has and the design gaps |

### Suggested build order (sizes are estimates, for one coder familiar with the code)

| Step | Item | Reports | Size (estimate) | Why here |
|---|---|---|---|---|
| 1 | Parity fixture recorded on an untouched checkout | TG-36 | Small, about 0.5 day | It proves every later step leaves Current alone |
| 2 | The toggle: settings, URL, Dev row, `World.rules`, `heroFor`, HUD/pause reading `p.def`, carry reset, saves, mini games forced Current, tag, `SimOptions.rules`, tests | TG | Medium, about 1.5-2 days, about 400 lines plus tests | Everything else plugs into it; with no Classic defs yet, Classic plays Current and the tag reads CLASSIC? |
| 3 | Classic power-state helper (Lose Everything, invulnerability, Star 720 f, drops) | PS-C | Small-medium, about 1 day | Every Classic hero's `onHurt` and `onPowerUp` uses it |
| 4 | Enemy HP and armour in `Enemy.hit`, plus the `meleeDamage` hook | HP-C | Medium, about 1.5 days | Damage numbers in every hero report assume it |
| 5 | Brick HP and block rules in `strikeBlock`, plus the projectile flag | BR-C | Small-medium, about 1 day | Weapons that break and bump blocks are in five hero reports |
| 6 | Swimming `floorJumpOnly` | SW-C | Small, about 0.5 day | One optional field in `Player.swim` |
| 7 | Mario and Luigi Classic defs (constant-speed rise jump model, stomp bounce, air cap, fireball) | ML-C | Small-medium, about 1-1.5 days | Smallest hero: same kit, physics only. It also builds the new jump-model fields others reuse |
| 8 | Mega Man | MM-C | Medium, about 2 days | Already instant movement; Classic drops weapons and E-tanks (buster, charge, Metal Blade) |
| 9 | Bill | BI-C | Medium, about 2 days | Three gun tiers and through-ground bullets; exercises C4 well |
| 10 | Simon | SI-C | Medium, about 2-2.5 days | Air jump, full air control, rooting, sub-weapons; the only hero the original was played for |
| 11 | Ryu | RY-C | Medium-large, about 3 days | Wall climbing and Fire Dragon Ball are new mechanics |
| 12 | Samus | SA-C | Large, about 3-4 days | Beams, missiles, Screw Attack, morph ball, soft jump cut |
| 13 | Link | LK-C | Large, about 3-4 days | The kit differs most from ours: 8-way boomerang, arrows, beam, thrusts, rooted stabs, no hearts or magic |
| 14 | The select-screen roster for Classic-only heroes (TG-41 to TG-43) | TG | Small, about 0.5-1 day | Needed before the first extra can be picked; it can land with the first extra |
| 15 | Proto Man | PM- | Small, about 1 day, plus a palette swap of Mega Man | A variant of Classic Mega Man (step 8): mostly flags |
| 16 | Pit | PI- | Small, about 1-1.5 days, plus a palette swap of Samus | A variant of Classic Samus (step 12): crouch-walk, no ball or bombs |
| 17 | Bass | BA- | Medium, about 3 days, plus a sprite sheet (a palette swap of Mega Man is enough to test) | Reuses Classic Mega Man's weapons and power states; adds the double jump, dash and held 7-way fire |
| 18 | Sophia III | SO- | Large, about 6-8 days, plus art | Surface-relative movement, a wide body, hover, thrust swimming and new level data |
| 19 | Vic Viper | VV- | Unknown until the owner fills the design gaps; roughly medium, 3-5 days, once designed | The original's power-ups were never written |
| 20 | Warriors of Light | WL- | Unknown until the owner fills the design gaps; roughly large, 5+ days, once designed | A cut prototype; the White Mage has no attack |

All sizes are estimates. Steps 1-13 total about 25-30 coder-days. Steps 14-18 add about 12-15 coder-days, and steps
19-20 depend on the owner's design decisions. Steps 3-6 can run in parallel once step 2 is merged. Each hero
step is one PR and must keep TG-36 green.

### How the owner tests it

**URL pattern.** `?dev=1&rules=classic&level=<level>&char=<id>`. The ids are `mario`, `luigi`, `link`, `megaman`,
`samus`, `simon`, `ryu` and `bill`. Once they are built, the Classic-only heroes add `bass`, `sophia`, `protoman`,
`pit`, `vicviper` and `warriors`; the exact ids are set in their build reports.
- Add `&kit=full` to start at the top tier (Flower) with full ammo **and every original weapon the hero can carry**.
  Select cycles them (TG-44). Use it for Ryu's Fire Wheel, Fire Dragon Ball and Jump Slash, Mega Man's other
  weapons, Samus's Ice Beam, Simon's other sub-weapons, Bill's other guns and Link's arrows.
- Use `&char2=<id>` for two players.
- To compare, open the same link with `&rules=current` (or without `rules`) in a second tab. That also switches the
  stored setting back, so reload the Classic tab before you play it again.
- Check that **CLASSIC** shows at the top right. **CLASSIC?** means that hero isn't built yet and is playing Current.

**What to try in 1-1 and 1-2.** Press F1 for tile columns. In 1-1 the first power-up block is at column 21 and the
second at column 109. In 1-2 the power-up block is at column 10 and the brick rows start at column 16. For water, use
2-2. For Bowser's HP, use 1-4.

Every hero:
- Take a hit while big or fire: you should drop straight to small.
- Take a hit while small: you die.
- No hearts, bars, magic, E-tanks, tool belt or health drops appear.
- Grab a Star and count about 12 seconds.

| Hero | 1-1 | 1-2 |
|---|---|---|
| Mario | A jump at walking speed is as high as a running jump. A stomp gives a small fixed bounce, held or not. A Mushroom while big gives Fire. Fireballs start already falling and bounce lower and slower | Big breaks bricks with his head, small only bumps. You can't turn around in mid-air; holding run in the air raises the speed cap |
| Luigi | Higher, floatier jump; releasing jump does not cut it short. He slides when he stops | The same brick rules as Mario; the slippery stop near ledges |
| Link | He starts and stops instantly, even in the air. The jump height varies with how long you hold jump. A stab roots him. Count the stabs a Goomba and a Koopa take | Every sword pose breaks bricks; his head only bumps them. Bombs break bricks and never hurt him. The boomerang passes through blocks |
| Mega Man | Buster shots fly through the ground and pipes. The Mushroom gives the charge shot and the Flower gives Metal Blade. No HP bar | Two buster shots break a brick; his head only bumps. Count the shots per Goomba |
| Samus | Higher jump than Current; releasing jump softens the rise rather than cutting it. The Flower gives the Wave Beam and Screw Attack | Her head bumps bricks instead of breaking them; beams and missiles break them. The Wave Beam passes through the ground |
| Simon | Lower jump plus an air jump. Full steering in the air, and releasing stops him. The whip roots him for about 21 frames | The whip breaks bricks and his head only bumps. The Axe and Cross pass through the ground |
| Ryu | Fixed-height jump (about 55 px, so tapping doesn't shorten it). The sword extends with the Mushroom | The sword and ninpo break bricks and his head only bumps. He climbs walls. Ninpo passes through the ground |
| Bill | He starts and stops instantly. The Mushroom gives the Machine Gun and the Flower the Spread. A hit freezes the game for about 1 second | Bullets fly through the ground and break bricks; his head only bumps |

Each hero report's Steps and Acceptance checks give the exact numbers to compare against.

**Select screen.** With `?dev=1&rules=classic`, start a game from the title. The character select shows the 8
heroes, plus a second row with the Classic-only heroes that are built. With `&rules=current`, the second row is gone.
For each new hero, its build report's Steps say what to try.

**How to report a Classic bug.**
- Use the usual template, and name the file `2026-10-xx-classic-<hero>-<short-slug>.md`.
- In **Character and power**, write the hero and power, then **Rules: Classic SMBC**. For example:
  `Link, big — Rules: Classic SMBC`.
- In **How to get there**, paste the URL with `&rules=classic`.
- In **Notes**, say:
  - whether the tag read CLASSIC or CLASSIC?;
  - whether the same thing happens with `&rules=current` (if it does, it's a Current bug: leave out the Rules line);
  - the requirement ID that fails, if you know it (for example `LK-C12`).
