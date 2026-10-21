# 0.5.0 release-candidate audit (v0.4.67)

This audit checks SMBC REMIX **v0.4.67** (tag `v0.4.67`, commit `62644cb` on main) against the original **Super
Mario Bros. Crossover 3.1.21** (the MIT source at `JayPavlina/super-mario-bros-crossover`). It is the last check
before 0.5.0. It re-checks every P0 and P1 item of [GAP_LIST_0.5.0.md](GAP_LIST_0.5.0.md) and lists what the build
batches broke or missed.

## Verdict: not ready yet. Two blockers, both small to medium

| Area             | P0/P1 re-checked | done | partly | owner decision only | New: blocker | should-fix | polish |
| ---------------- | ---------------- | ---- | ------ | ------------------- | ------------ | ---------- | ------ |
| Levels and sets  | 15               | 15   | 0      | 0                   | 1            | 0          | 3      |
| Menus and modes  | 9                | 8    | 1      | 0                   | 1            | 1          | 4      |
| Heroes and looks | 6                | 5    | 1      | 0                   | 0            | 1          | 3      |
| Audio            | 12               | 10   | 2      | 0                   | 0            | 0          | 5      |
| Release          | 15               | 12   | 1      | 2                   | 0            | 3          | 4      |
| Test suite       | -                | -    | -      | -                   | 0            | 0          | 1      |
| **Total**        | **57**           | 50   | 5      | 2                   | **2**        | **5**      | **20** |

The "done" column includes items done the way an owner decision (D1-D4) set. Polish counts table rows; some rows group several small findings. The two "owner decision only" items are
G-109 and G-110: D5 kept the repo name, so there is nothing to build.

### Blockers

- **RC-001: On Hard, six Lost Levels bonus rooms drop the hero onto their roof, and four of them trap him there
  until TIME UP.** The rooms are 3-1, 5-3 (both pipes), 7-1, 8-2, 12-1 and 13-2, and every look is affected. Size
  M. Confirmed: played, and a sweep over every look.
- **RC-002: CLASSIC > Continue loses the run's Map Difficulty (and Game mode).** After a reload, a Hard or Easy
  run goes on as Normal, and its BEATEN mark and the Level Select goal are recorded as Normal. Size S. Confirmed:
  played and code.

Everything else that was checked holds:

- **Chapter 1 gate:** it does not leak, and saves are byte-identical before and after.
- **Dev mode on the release build:** `?dev=1` is ignored, the Konami code opens the passphrase prompt, and a dev flag
  saved by an earlier version is turned off.
- **Offline zip:** it plays from `file://` with no network requests.
- **Errors:** no console errors in about 150 played sessions.
- **Tests:** typecheck passes, and 11,450 of 11,451 tests pass; the one failure is a timeout under load (RC-036).

### How this was checked

- **Release builds:** the real release zips `smbc-remix-v0.4.67.zip` (served at `/SMBC/`) and
  `smbc-remix-v0.4.67-offline.zip` (opened from `file://`), both played with Playwright and Chromium.
- **Dev build:** the same commit on a local dev server, played with dev URLs. The checks read the game's state
  (`window.__game`), the screen-reader announcements and the current song.
- **Sim and level tests:**
  - The full suite (`pnpm test`).
  - Targeted reruns: `tests/sim/classic-*` (1,480 tests), `src/content/levels` and the level sims (1,603), and the
    menu and audio sims.
- **Code:** read side by side with the original's ActionScript, for behaviour and numbers only. None of the original's
  art or music was opened.

Original paths are relative to `src/com/smbc/` unless they start with `com/explodingRabbit/`. Their line numbers
are editor lines after converting CR line ends to newlines. Our paths are relative to this repo at `62644cb`.

## 1. Blockers and should-fix

| ID     | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Original                                                                                                                                                      | Ours                                                                                                                                                                                                                                          | Priority    | Size | Status                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---- | ------------------------------------------------------------------------------------------ |
| RC-001 | **Hard Lost Levels bonus rooms: the pipe in drops the hero on the roof.**<br>On Hard, each room's own layer closes the ceiling and puts an entry pipe at the top left. Our pipe in still drops the hero from row 0 at the room's start column, so he lands on the outside.<br>He is trapped until TIME UP at: 3-1 (the pipe at column 66), 5-3 (columns 38 and 102), 7-1-exit (column 109) and 8-2 (column 170).<br>He lands on the roof at: 12-1 (column 96) and 13-2 (column 118).<br>Easy, Normal, SMB and Special are fine. Special's rooms already arrive at the room's matching pipe end, so the same arrival rule should apply to SMB and Lost Levels rooms on Hard. Re-check Hard 1-2 and 4-2 at the same time (RC-022) | The hero arrives at the room's pipe end or playerStart (`level/Level.as`, map links); the room's Hard tiles are in `assets/documents/levelDataLostLevels.xml` | `tools/levelgen/convert-smbc.mjs:972-976,1081-1082` (`pipeBonus && !SPECIAL`: start at x,0, falling); e.g. `src/content/levels/lost/world3/ll-3-1.map:53`; `src/content/level-layers/lost/world3/ll-3-1-bonus.layers` `[layer hard]` rows 0-2 | **blocker** | M    | confirmed (played Hard 3-1 to TIME UP; sweep of all 34 looks; layer data read)             |
| RC-002 | **Continue loses the Map Difficulty and the Game mode.** The resume slot stores neither. `resumeClassic` never sets `classicDifficulty`, so after a reload it is the default `'normal'`, while the menu still shows HARD. A win then records BEATEN on Normal, which also breaks the "beat every set on Hard" goal of the Level Select cheat. In the same session the run inherits whatever difficulty was last picked (for example a Level Select pick). Fix: save `difficulty` and `gameMode` in the resume slot and restore them in `resumeClassic`                                                                                                                                                                          | The save holds the map set, map difficulty and game mode with the run (`data/GameSettings.as:407-414`)                                                        | `src/game/run-resume.ts:16-36` (no field); `src/game/scenes/game.ts:228` (default), `:2092-2135` (resumeClassic)                                                                                                                              | **blocker** | S    | confirmed (played Hard, reloaded, Continue gave `World.mapDifficulty = normal`; code read) |
| RC-003 | **The dev lock can be opened without the passphrase.** The browser stores the lock's own hash (`settings.devUnlock`), and the same hash is in the public bundle. Writing `dev:true` and that hash into `smbc.settings` keeps dev mode on at boot, and Chapter 1 then opens the file select. It needs devtools. Fix: store a value that only a correct entry can produce, for example a second hash of the entry with another salt, never the hash the bundle checks against                                                                                                                                                                                                                                                     | n/a                                                                                                                                                           | `src/game/dev-lock.ts:64-70` (`enforceDevLock` compares `devUnlock === lock.hash`)                                                                                                                                                            | should-fix  | S    | confirmed (played on the release build; code read)                                         |
| RC-004 | **A shared `?level=` link silently replaces the player's Continue run.** Seeded resume: World 4-2, Luigi, 50,000 points. After opening `?level=ll-9-1` the slot holds ll-9-1, Mario, 0 points, with no prompt. Fix: don't write the slot for a link run, or ask first                                                                                                                                                                                                                                                                                                                                                                                                                                                           | n/a                                                                                                                                                           | `src/main.ts:315`, then `src/game/scenes/game.ts:2072` (`saveClassicResume`)                                                                                                                                                                  | should-fix  | S    | confirmed (played on release)                                                              |
| RC-005 | **A `?level=custom-…` link to a level this browser doesn't have** shows the old "THANK YOU FOR PLAYING! WORLD [blank] IS NOT BUILT YET" card. Nothing is announced, and the name is blank because lowercase letters don't render. This is always what happens with someone else's custom link, since the library is per browser                                                                                                                                                                                                                                                                                                                                                                                                 | n/a                                                                                                                                                           | `src/game/scenes/game.ts:2340-2362`                                                                                                                                                                                                           | should-fix  | S    | confirmed (played on release)                                                              |
| RC-006 | **Select navigation is not the original's.** Ours: Left and Right run through every cell across both rows (Simon to Mega Man, Random to Mario); Up on the top row or Down on the bottom row only bumps. Original: Left and Right wrap within the row (Simon to Mario), and Up or Down from either row jumps to the other row                                                                                                                                                                                                                                                                                                                                                                                                    | `messageBoxes/CharacterSelectBox.as:809-907` (`getNearestPortrait`, `determineSelection`)                                                                     | `src/game/scenes/character-select.ts` (grid movement)                                                                                                                                                                                         | should-fix  | S    | confirmed (played; code read)                                                              |
| RC-007 | **The pick show clips tall heroes.** Simon's and Bill's heads are cut off at the top of their cells, and Ryu's wall cling leaves only his legs in the top-right corner, on every pick                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | The whole hero acts out the move in his cell (`level/CharacterSelect.as:183-195`)                                                                             | `src/game/scenes/character-select.ts:1110-1130` (`renderShow` draws bottom-aligned art taller than the cell); `src/game/scenes/pick-show.ts:80-81` (cling offset)                                                                             | should-fix  | S    | confirmed (played all 10 picks)                                                            |

## 2. Re-check of the gap list's P0 and P1 items

Status: **done** = matches the original. **partly** = says what is missing. **Dn** = done the way owner decision Dn
set.

| ID    | Item                                         | Status               | Evidence (ours; how verified)                                                                                                                                                                                                              | Missing                                                                                                                                                                                                                                                                                                           | St      |
| ----- | -------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| G-001 | Lost Levels 1-1 to D-4 in one run            | done                 | Played: 9-4 leads to WORLD A-1; D-4 shows "YOUR QUEST IS OVER.", then the credits, then the title (`src/game/scenes/original-game.ts:78-103`; `game.ts:1538-1542`)                                                                         | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-002 | 8-4 an ordinary castle, no warp gate         | done                 | Played 8-4: Toad, then 9-1. The sim `classic-lost-run` covers a warped run                                                                                                                                                                 | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-003 | Every map set open from the start            | done (D3)            | Played on a fresh profile: SMB, SMB SPECIAL, THE LOST LEVELS, MAP DIFFICULTY                                                                                                                                                               | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-004 | After the credits, the title                 | done (D3)            | Played SMB 8-4, Special 8-4 and LL D-4                                                                                                                                                                                                     | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-005 | Beat status per set and difficulty           | done                 | Played with a seeded store; best difficulty kept (`src/engine/save/progress.ts:115-122`)                                                                                                                                                   | The screen says only BEATEN (RC-019)                                                                                                                                                                                                                                                                              | C       |
| G-006 | Map Difficulty Easy / Hard                   | done                 | Played: each difficulty builds its own 1-1. Lakitu 48/40/16 × 397 ms, Spinies 2/4/6 and the Cheep cap 2/3/4 match `level/LakituSpawner.as:28-41`, `enemies/Lakitu.as:244-255` and `level/FlyingCheepSpawner.as`                            | RC-001, RC-002                                                                                                                                                                                                                                                                                                    | C       |
| G-007 | Level Select cheat                           | done                 | Played: on the pause menu and the Cheats page. Rows: Map set, Map difficulty, World (to D), Level, Go (`messageBoxes/LevelSelectMenu.as:58-66`)                                                                                            | Row order on the Cheats page (RC-025)                                                                                                                                                                                                                                                                             | C       |
| G-008 | Save and resume a run                        | partly               | Played: the slot is written at each WORLD card. It keeps lives, score, coins, hero, power and Survival's fallen heroes, and is cleared by a game over or the credits (`src/game/run-resume.ts`; `game.ts:2053-2135`)                       | Map Difficulty and Game mode (RC-002); overwritten by links (RC-004)                                                                                                                                                                                                                                              | C       |
| G-010 | Per-hero helper pieces                       | done                 | Played 1-1: the flagpole lift is there for Link, Samus, Simon, Mega Man, Bill, Ryu and Sophia, not for Mario, Luigi or Bass. All 34 looks' flags match the original's classes and skins (Quick Man both, Pit as Samus, the Zeldas as Link) | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-011 | Bad-swimmer pieces                           | done                 | Played ll-6-2 (Link vs Mario); bad-swimmer layers in 10 Lost Levels areas                                                                                                                                                                  | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-012 | Extra pieces before Bowser for Simon and Ryu | done                 | Played 8-4: the ? block for Simon and Ryu, not Mario                                                                                                                                                                                       | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-013 | Water pits pull the hero in                  | done                 | Mario-based heroes only, as `enemies/PitVacuum.as:44-45`; 600/400 (`src/game/world/world.ts:2010-2012`). Sim `classic-pit-vacuum` (9 tests)                                                                                                | -                                                                                                                                                                                                                                                                                                                 | C (sim) |
| G-020 | Super Mario Bros. Special                    | done (D1)            | Played several castles and 8-4: the princess, the credits, the title. Sims: 32 levels, the links, and sweeps on every difficulty for all looks                                                                                             | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-021 | Special's enemies                            | done                 | Hard and Special layouts place them. The numbers match `enemies/Crab.as:17,29` and `enemies/Icicle.as:15-17`. Sim `classic-special-enemies`                                                                                                | Hand feel not played                                                                                                                                                                                                                                                                                              | C (sim) |
| G-022 | Atom, Hammer, Wing                           | done                 | 1000 points each; Hammer and Wing last 10 s (`src/game/entities/objects/special-items.ts:22`)                                                                                                                                              | -                                                                                                                                                                                                                                                                                                                 | C (sim) |
| G-023 | Hudson Bee                                   | done                 | Hard 1-1 `block-item … item=bee`, 8000 points                                                                                                                                                                                              | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-030 | TIME UP card                                 | done                 | Played: announced, waits for OK past 5 s (`src/game/scenes/game.ts:2190`)                                                                                                                                                                  | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-031 | Cheats from the pause menu                   | done                 | Played: Invincible and Water Mode apply at once (`src/game/scenes/pause.ts:37-80`)                                                                                                                                                         | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-032 | Disable heroes                               | done                 | Played: the last hero can't be turned off; disabled heroes leave the select, Random and Single random                                                                                                                                      | Shown as a list, not the original's grid; RC-027                                                                                                                                                                                                                                                                  | C       |
| G-040 | Classic Samus and Classic Simon cheats       | done                 | Unlocked from the start; sim `classic-hero-cheats` (7 tests)                                                                                                                                                                               | Three small differences (RC-028 to RC-030)                                                                                                                                                                                                                                                                        | C       |
| G-050 | Zelda looks                                  | done                 | Sword 150/225/350, 400-damage arrows that pass through (`src/game/characters/link/classic-zelda.ts:13`). Played all three looks                                                                                                            | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-051 | Quick Man looks                              | done                 | Walks ×1.3, 650 jump, no dash or double jump, both helper flags. Played                                                                                                                                                                    | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-052 | Haggle Man looks                             | done                 | The sword hits one 45 ms step sooner. Played                                                                                                                                                                                               | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-053 | Small-crouch looks                           | done (SMB3 looks)    | Played: small Mario 3 and Luigi 3 crouch; plain Mario, Luigi and Peach don't                                                                                                                                                               | The original decides it from each skin's art (a `crouch_1` frame, `characters/base/MarioBase.as:1086-1092`), so whether other looks qualify can't be read from code; they are after 0.5.0 anyway                                                                                                                  | C / U   |
| G-054 | Mega Man and Bass orb death                  | done                 | Sim `classic-megaman-orbs`: Mega Man 12 orbs, Bass 16, his own sound, a pit death plays the sound only                                                                                                                                     | Not watched on screen                                                                                                                                                                                                                                                                                             | C (sim) |
| G-055 | Select pick performances                     | partly               | Played all 10: each cell shifts or blinks a still pose for the original's wait                                                                                                                                                             | The real moves: Simon's whip, Ryu's wall cling, Jason hopping out of Sophia, Mario hitting the block. Also RC-007                                                                                                                                                                                                 | C       |
| G-060 | Per-hero music sets                          | done (D2)            | Played 25 loads, reading the current song; the matrix matches. Types with no hero song fall back to the SMB set (Star, hurry, game over, credits, Samus's water)                                                                           | Mood details are polish (RC-031)                                                                                                                                                                                                                                                                                  | C       |
| G-061 | Select music                                 | done                 | Played                                                                                                                                                                                                                                     | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-062 | Choose jingle                                | done                 | Played; Proto Man whistles                                                                                                                                                                                                                 | Bass and Proto Man details (RC-032)                                                                                                                                                                                                                                                                               | C       |
| G-063 | Intro and coin-heaven tunes                  | done                 | Played                                                                                                                                                                                                                                     | The intro repeats some heroes' choose jingle (RC-033)                                                                                                                                                                                                                                                             | C       |
| G-064 | Boss and final-boss switch                   | done                 | Sim `classic-audio` (my sweeps never reached Bowser alive)                                                                                                                                                                                 | Details in RC-034                                                                                                                                                                                                                                                                                                 | C (sim) |
| G-065 | Hero death sounds and music                  | done                 | Played and code                                                                                                                                                                                                                            | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-066 | Music set option                             | done                 | Character, Map and Random (`src/game/scenes/game.ts:422-441`)                                                                                                                                                                              | Random rolls once per area (RC-035)                                                                                                                                                                                                                                                                               | C       |
| G-070 | Missing hero action sounds                   | done                 | Mega Man's landing and teleport, Bill's landing and shock, Samus's steps, landing, morph ball and Screw Attack                                                                                                                             | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-071 | Per-hero hurt sounds                         | done                 | Code and played                                                                                                                                                                                                                            | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-072 | Per-hero hit and kill sounds                 | partly               | Link, Mega Man, Simon and Ryu have their own; Samus has her own hit sound                                                                                                                                                                  | **Bill** still uses the shared hit and kill sounds (the original has SFX_BILL_SHOT_HIT and SFX_BILL_ENEMY_EXPLODE, `data/SoundNames.as:105,114`)                                                                                                                                                                  | C       |
| G-073 | Per-hero pickup sounds                       | done                 | Code and played                                                                                                                                                                                                                            | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-074 | Weapons using other heroes' sounds           | partly               | Fixed: Link's arrow and bomb, every Samus beam and her bomb set, Simon's sub-weapons, Ryu's arts, Metal Blade, Bill's guns                                                                                                                 | Still borrowed: Mega Man's Hard Knuckle (`kick`), Pharaoh Shot (`buster`), Flame Blast and Magma Bazooka (Mario's `fireball`), Water Shield (`swim`), Screw Crusher, Rush and Super Arm (`src/game/characters/megaman/classic-weapons.ts:727-807`); Samus's bomb blast (`bump`); Ryu's sword (the shared `sword`) | C       |
| G-090 | WORLD card                                   | done (D4)            | Played: 2.0 s, and 2.5 s in Single Character; announced; a press skips it; written up in `docs/ACCESSIBILITY.md`                                                                                                                           | The original's music fade over the last 0.5 s (G-035, P2)                                                                                                                                                                                                                                                         | C       |
| G-091 | Remap refuses a bound key                    | done                 | Played: "Num 4 is already P2 Left. Press another key"                                                                                                                                                                                      | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-092 | Reduce flashing under Current rules          | done                 | Sim `reduce-flashing-hurt-blink` (3 tests)                                                                                                                                                                                                 | -                                                                                                                                                                                                                                                                                                                 | C (sim) |
| G-093 | Classic guide                                | done                 | Played: pause > Guide opens the Classic hero's page; How to play from Classic options lists the 10 Classic heroes                                                                                                                          | From the title it still shows the campaign heroes (RC-023)                                                                                                                                                                                                                                                        | C       |
| G-100 | Chapter 1 gate                               | done                 | Played on release: CHAPTER 1 / COMING SOON!, announced, OK closes it (`src/game/scenes/title.ts:151-152`; `chapter1-gate.ts:41`)                                                                                                           | Closing it is silent (RC-024)                                                                                                                                                                                                                                                                                     | C       |
| G-101 | `#save=` links gated                         | done                 | Played: the link card shows and the hash stays in the address (`src/game/scenes/game.ts:1300-1307`)                                                                                                                                        | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-102 | Saves kept                                   | done                 | Played the title, Classic, Options and Save files: `smbc.save.N` and `smbc.progress` are byte-identical afterwards; only the `dev` flag is cleared                                                                                         | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-103 | No CHAPTER 1 or freed count on the title     | done                 | Played on release                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-104 | No PRE-RELEASE                               | done                 | 0 hits in the release bundle                                                                                                                                                                                                               | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-105 | Version 0.5.0                                | partly               | 0.4.67 is consistent everywhere; `node tools/release/check.mjs --tag v0.4.67` passes                                                                                                                                                       | To cut 0.5.0: bump `package.json`, turn `[Unreleased]` into `## [0.5.0] - date` (`--tag v0.5.0` fails on just those two today), and confirm the `DEV_MODE_PASSPHRASE` secret is set and long (RC-020)                                                                                                             | C       |
| G-106 | ROADMAP                                      | done                 | `docs/ROADMAP.md:7-21`: 0.5.0 Classic, 0.6-0.9 heroes, 1.0 Chapter 1                                                                                                                                                                       | One stale line (RC-021)                                                                                                                                                                                                                                                                                           | C       |
| G-107 | README                                       | done                 | `README.md:13-18,65-71`                                                                                                                                                                                                                    | One stale line (RC-021)                                                                                                                                                                                                                                                                                           | C       |
| G-108 | Zip rename                                   | done (D5)            | The release assets are `smbc-remix-v0.4.67.zip` and `smbc-remix-v0.4.67-offline.zip` (`.github/workflows/release.yml:75,85`)                                                                                                               | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-109 | Repo rename                                  | D5 (repo stays SMBC) | Nothing to change                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-110 | Old `/SMBC/` address                         | moot (D5)            | Same origin and path, so old links and installed apps keep working                                                                                                                                                                         | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-111 | Title hero row                               | done                 | Every hero in colour, no "?"                                                                                                                                                                                                               | It is the campaign roster (RC-023)                                                                                                                                                                                                                                                                                | C       |
| G-112 | Classic first on the title                   | done                 | Played on release: Classic, Chapter 1, Custom levels, Options, with Classic highlighted                                                                                                                                                    | -                                                                                                                                                                                                                                                                                                                 | C       |
| G-113 | RELEASING and offline README                 | done                 | The offline zip's README.txt matches `tools/offline/README.txt`                                                                                                                                                                            | One stale line (RC-021)                                                                                                                                                                                                                                                                                           | C       |
| G-114 | Custom levels and the editor                 | done (shipped)       | Reachable on release; they play Current rules and reach no campaign content (`src/game/scenes/game.ts:806-811`)                                                                                                                            | -                                                                                                                                                                                                                                                                                                                 | C       |

## 3. Release-level checks

- **Title and branding:**
  - The menu is Classic, Chapter 1, Custom levels and Options, with Classic highlighted.
  - It shows the version (V0.4.67) and announces it, and every hero stands in colour.
  - There is no PRE-RELEASE text and no CHAPTER 1 under the logo.
  - The page title and manifest say "REMIX", but their descriptions don't mention Classic yet (G-116, P2).
- **Chapter 1 gate:** it doesn't leak.
  - The Chapter 1 row and `#save=` links show the card.
  - `?level=` with a campaign id, `?mode=classic`, `?dev=1&level=1-0` and `404.html?level=` all go to the title.
  - An SMB, Special or Lost Levels id starts a Classic run.
  - `?char=peach`, `pit` and `protoman` play as their Classic looks. Expansion heroes in a link play as Mario while the
    option is off.
  - Options > Save files can show and copy codes, but pasting one over a game is refused.
  - The only way in found is RC-003.
- **Dev lock on the release build:**
  - `?dev=1` is ignored, silently (RC-026).
  - The Konami code opens the passphrase grid, announced. A wrong entry says "Wrong passphrase.", on screen and aloud.
  - A dev flag saved by an earlier version is turned off at boot.
  - The bypass is RC-003; passphrase strength is RC-020.
- **Offline zip from `file://`:** it loads, the title works and a Classic 1-1 run plays. There are no network
  requests and no console errors. Its README.txt describes the plan.
- **README and ROADMAP:** both describe the new plan (0.5.0 Classic, 0.6-0.9 heroes, 1.0 Chapter 1). One line is stale
  in each of README, RELEASING and ROADMAP (RC-021).
- **Exploding Rabbit logo:**
  - It is drawn only for Special's full power-up under Classic rules. It doesn't appear on the title, in the campaign
    or under Current rules.
  - It is credited in `src/game/scenes/credits.ts`, `README.md` and `docs/ART_EXCEPTIONS.md`, and allow-listed in
    `tools/check-no-binaries.mjs`.
  - `pnpm check:assets` passes.

## 4. Polish

| ID     | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Original                                                                                                                                                             | Ours                                                                                           | Size | St                               |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---- | -------------------------------- |
| RC-018 | After a game over, the continue's select HUD reads WORLD 1-1 while the run goes on at that world's first level (LL 5-3 game over shows 1-1, then WORLD 5-1)                                                                                                                                                                                                                                                                                                                                           | The level is set to (world, 1) before the select (`managers/StatManager.as:334-337,543-547`)                                                                         | Continue path in `src/game/scenes/game.ts`                                                     | S    | C (played)                       |
| RC-019 | The CLASSIC menu shows only BEATEN. The difficulty is only in the spoken hint, although CHANGELOG 0.4.66 says each line shows it (our own feature; the original shows nothing)                                                                                                                                                                                                                                                                                                                        | n/a                                                                                                                                                                  | `src/game/scenes/original-game.ts:105-108`                                                     | S    | C (played)                       |
| RC-020 | The dev passphrase may be as short as 6 characters, and its hash is in the bundle, so it could be brute-forced offline. Use 16 or more characters (advice only; not attempted)                                                                                                                                                                                                                                                                                                                        | n/a                                                                                                                                                                  | `src/game/dev-lock.ts:14-16`                                                                   | S    | U                                |
| RC-021 | README, RELEASING and ROADMAP say the zips are renamed "from 0.5.0"; the rename shipped in 0.4.66                                                                                                                                                                                                                                                                                                                                                                                                     | n/a                                                                                                                                                                  | `README.md:233`, `docs/RELEASING.md:73-74`, `docs/ROADMAP.md:102-103`                          | S    | C                                |
| RC-022 | Hard ll-1-2-bonus (14 looks) and ll-4-2-bonus (Ryu, Haggle Man): the sweep finds no way out from where the hero lands. Probably the original's design (a hidden block at 26,8 the sweep can't model); check it with RC-001                                                                                                                                                                                                                                                                            | `assets/documents/levelDataLostLevels.xml` 1-2 and 4-2 bonus areas (Hard)                                                                                            | `src/content/level-layers/lost/world1/ll-1-2-bonus.layers`                                     | S    | U                                |
| RC-023 | The title's hero row and title > Options > How to play use the campaign roster (9 heroes, no Bass, Current moves). Classic is the game now                                                                                                                                                                                                                                                                                                                                                            | n/a                                                                                                                                                                  | `src/game/scenes/title.ts:118`, `options.ts:37`, `guide.ts:70-72`                              | S    | C (played)                       |
| RC-024 | Missing announcements:<br>- The first select doesn't name the highlighted hero.<br>- Its "OK to begin" is wrong on a hero with looks, where OK opens the skin menu.<br>- Opening the pause says only "Continue".<br>- Going back from Guide or Cheats is silent.<br>- Closing the Chapter 1 card is silent.                                                                                                                                                                                           | n/a                                                                                                                                                                  | `src/game/scenes/character-select.ts:782-788`, `pause.ts:59-66,152,219-224`, `menu.ts:127-135` | S    | C (played)                       |
| RC-025 | Small menu text and order slips:<br>- The Continue hint doesn't name SMB Special (`original-game.ts:225`).<br>- The Options hint leaves out Expansion heroes, Disable heroes and Cheats (`:250`).<br>- Level Select sits last on the Cheats page; the original puts it first (`messageBoxes/CheatMenu.as:41,64-65`; ours `src/game/scenes/cheats-menu.ts:62-72`).<br>- The skin menu reads "Mario, Super Mario Bros. 2 looks.", running the game name into the count (`character-select.ts:453-455`). | see the item                                                                                                                                                         | see the item                                                                                   | S    | C (played)                       |
| RC-026 | `?dev=1` on a release build is ignored without a console note (`?rules=` gets one)                                                                                                                                                                                                                                                                                                                                                                                                                    | n/a                                                                                                                                                                  | `src/main.ts:284-289`                                                                          | S    | C                                |
| RC-027 | Classic options also list campaign-only rows: Save files, the backup reminders and Level editor. They reach no campaign content. With one hero left on, the select still says "the other row" and keeps its full panel size                                                                                                                                                                                                                                                                           | `messageBoxes/CharacterSelectBox.as:255` (resizeBox)                                                                                                                 | `src/game/scenes/options.ts:24-44`; `character-select.ts`                                      | S    | C (played)                       |
| RC-028 | Classic Samus cheat: Down in mid-air curls her into the morph ball; the original allows that only on the ground                                                                                                                                                                                                                                                                                                                                                                                       | `characters/Samus.as:1088-1118`                                                                                                                                      | `src/game/characters/samus/classic.ts:647-664`                                                 | S    | C (code)                         |
| RC-029 | Classic Samus cheat: rolling into the ball from the ground plays no morph-ball sound                                                                                                                                                                                                                                                                                                                                                                                                                  | `characters/Samus.as:1113-1118`                                                                                                                                      | `src/game/characters/samus/classic.ts:647-650`                                                 | S    | C (code)                         |
| RC-030 | Pit or Dark Pit with the Classic Samus cheat in missile mode fire a missile from the crouch; the original fires nothing there                                                                                                                                                                                                                                                                                                                                                                         | `characters/Samus.as:978-982`                                                                                                                                        | `src/game/characters/samus/classic.ts:685`                                                     | S    | C (code)                         |
| RC-031 | Music moods that differ from the original's types:<br>- Ryu's castle is a night-street tune.<br>- Bill's underground is his castle tune.<br>- Mega Man's water is a forest tune.<br>- Sophia's water is a slow cutscene loop.<br>Nothing is silent or wrong-situation. Separately, Pit and Dark Pit play Samus's set (the original: Kid Icarus) and Peach the SMB set (the original: SMB2); per-look music is parked by the owner.                                                                    | `com/explodingRabbit/cross/games/GameNinjaGaiden.as:62`, `GameContra.as:55,62`, `GameMegaMan.as:58`, `GameBlasterMaster.as:180`; `graphics/BmdInfo.as:758,1127,1147` | `src/game/scenes/original-music.ts`                                                            | M    | C (code)                         |
| RC-032 | Bass (and Quick Man) play Mega Man's teleport when chosen; the original Bass doesn't teleport. Proto Man has no teleport; the original plays it with his whistle                                                                                                                                                                                                                                                                                                                                      | `characters/Bass.as:93-120`; `characters/MegaMan.as:154-158`; `managers/SoundManager.as:1004-1009`                                                                   | `src/game/scenes/original-music.ts:207-211`                                                    | S    | C (code)                         |
| RC-033 | The x-2 walk-in replays the choose jingle for Mega Man, Samus, Simon and Bill, so it is heard twice in a row; the original has its own intro song                                                                                                                                                                                                                                                                                                                                                     | `GameMegaMan.as:53,63`; `GameMetroid.as:50,61`; `GameCastlevania.as:123,133`; `GameContra.as:58,69`                                                                  | `src/game/scenes/original-music.ts:98,111,124,151`                                             | S    | C (code)                         |
| RC-034 | The boss switch:<br>- Lost Levels world 8 plays the boss tune, where the original plays the final-boss tune in worlds 8 and 13 of every set.<br>- Link and Samus switch to a boss tune, where the original keeps the castle song (Samus changes only for the final boss).                                                                                                                                                                                                                             | `level/Level.as:2804-2807`; `GameZelda.as:60,65`; `GameMetroid.as:59`                                                                                                | `src/game/scenes/original-music.ts:84-85,119,269-271`                                          | S    | C (code)                         |
| RC-035 | Hurry speeds the song up 1.4×; the original swaps to its HURRY song. Music set Random rolls once per area; the original rolls at every song change                                                                                                                                                                                                                                                                                                                                                    | `managers/SoundManager.as:1010-1019`; `data/GameSettings.as:990-993`                                                                                                 | `src/game/world/world.ts:2686-2692`; `src/game/scenes/game.ts:422-441`                         | M    | C (code)                         |
| RC-036 | Under heavy load, two long sims hit vitest's 30 s timeout (`tests/sim/top-secret.test.ts` Bill full; `transylvania-looks`). Both pass on their own (102/102, 48/48). Raise their timeouts so CI can't flake                                                                                                                                                                                                                                                                                           | n/a                                                                                                                                                                  | `tests/sim/top-secret.test.ts:345`                                                             | S    | C                                |
| RC-037 | Long read-outs (the Guide pages, the credits) are sent in capitals, with runs of spaces left over from line wrapping. Some screen readers spell capital words out or pause                                                                                                                                                                                                                                                                                                                            | n/a                                                                                                                                                                  | `src/game/scenes/guide.ts`, `credits.ts`                                                       | S    | U (depends on the screen reader) |

RC-008 to RC-017 are not used, so the blocker and should-fix ids stay fixed. The remaining polish items:

- the P2 items of the gap list that are still open as listed (G-009 world themes, G-033 to G-047, G-067, G-068,
  G-075 to G-077, G-116);
- G-035's music fade on the WORLD card.

None of these regressed.

**Not a finding:** a death in an All Characters run going back to the hero select. This is the original's default
mode, where you pick a hero at every level and after every death.

## 5. Suggested fix batches

1. **0.5.0 blockers (one PR, M):** RC-001 and RC-002, with RC-004 because it touches the same resume slot.
   - RC-001: Hard SMB and Lost Levels bonus rooms arrive at the room's own pipe end, as Special's do. Add a sim sweep
     on every difficulty and look, and re-check RC-022.
   - RC-002: the resume slot keeps the difficulty and game mode.
   - RC-004: a link run doesn't overwrite the Continue slot.
2. **Should-fix (one PR, S to M):**
   - RC-003: store a token the bundle doesn't reveal.
   - RC-005: an announced "level not found" card.
   - RC-006: the original's select navigation.
   - RC-007 and G-055: pick performances that fit their cells and show the real moves.
   - G-072 and G-074: Bill's own hit and kill sounds, and the last borrowed weapon sounds.
3. **Cut 0.5.0 (release PR, S):**
   - G-105: bump to 0.5.0 and add the `## [0.5.0]` CHANGELOG section.
   - RC-020: confirm the passphrase secret is long.
   - RC-021: fix the stale doc lines.
   - G-116: mention Classic in the descriptions.
   - RC-036: raise the two sim timeouts.
4. **After 0.5.0 (0.5.x polish):** RC-018, RC-019 and RC-022 to RC-035, RC-037, and the open P2 items.

Batches 1 and 3 are enough for 0.5.0 if the owner accepts the should-fix items as 0.5.1.

## Addendum: owner items O-01 to O-16 (v0.4.67)

The owner tested v0.4.67 and reported these items. Each was checked against v0.4.67 (at commit `ff397ce9`) and, where
it applies, against 3.1.21. The checks used code side by side, Playwright runs of the release build and the dev build,
and the menus' screen-reader text. The path and line-number conventions are the same as in the rest of this file.

### Summary

**Blocker (1):**

- O-12: lock the Expansion heroes, and make Classic rules and Expansion dev-only.

**Should-fix (10):**

- O-01: move Custom levels into Options.
- O-02: rename the title row to Campaign.
- O-04: a CLASSIC menu in the original's style.
- O-05: a hierarchical dev Level select.
- O-06: a dev Classic heroes submenu.
- O-07: hide Save files outside dev mode.
- O-10: drop the select's prompt line.
- O-11: redraw the select faces and the worst sprites.
- O-14: no campaign guides in Classic.
- O-16: Back on the mid-run select.

**Polish (3):**

- O-03: remove the line from the gate card.
- O-08: backup reminders off by default.
- O-13: rename All options.

**Answers only, nothing to change (2):**

- O-09: every map set is open from the start, as in the original.
- O-15: the original shows no first-play guide by default.

### O-01. Custom levels off the title menu (should-fix, S, confirmed)

- **Now:**
  - The title menu is Classic, Chapter 1, Custom levels, Options (`src/game/scenes/title.ts:149-156`).
  - `showCustomLevels` replaces the title, so Back returns to the title (`src/game/scenes/game.ts:1765-1777`).
  - Options also has Level editor (`src/game/scenes/options.ts:24-44`). That row shows in Classic's All options too
    (RC-027).
  - Links (`#level=`, `?level=custom-`) open custom levels directly.
- **Original:** it has no custom levels or editor. The start menu is NEW GAME, LOAD GAME, OPTIONS, LINKS
  (`messageBoxes/StartMenu.as:31-41`).
- **Recommendation:**
  - Remove the title row.
  - Add a "Custom levels" row next to Level editor in the title's Options only, never in Classic's options.
  - Open it on top of Options, so Back returns there.
  - Keep the links.
  - `tools/smoke/screenshot.mjs:60-64` presses Down three times to reach Options; that becomes two.

### O-02. "Chapter 1" on the title becomes "Campaign" (should-fix, S, confirmed)

- **Now:** the row reads "Chapter 1" (`src/game/scenes/title.ts:149`). Its card reads "CHAPTER 1 / COMING SOON!"
  (`src/game/scenes/chapter1-gate.ts:19,28`). The row's name is also in `title.test.ts`, `tests/sim/chapter1-gate.test.ts`,
  `README.md` and `tools/offline/README.txt`.
- **Recommendation:**
  - Label the row "Campaign".
  - Make the card "CAMPAIGN / CHAPTER 1 COMING SOON!", which fits the card's 28 columns. The owner should confirm the
    card may still name Chapter 1.
  - Update the tests and both READMEs.
  - The story's own "END OF CHAPTER 1" stays.

### O-03. Remove "YOUR SAVE FILES ARE KEPT." from the gate card (polish, S, confirmed)

- **Now:** it is a line of the card (`src/game/scenes/chapter1-gate.ts:23`). The announcement is built from the card,
  and `tests/sim/chapter1-gate.test.ts:144` expects it.
- **Recommendation:** delete the line and update the test.
- **Keep:** the resume-link card's "THIS RESUME LINK IS KEPT." is a different message: it tells the player the link
  in the address still works.

### O-04. The CLASSIC menu in the original's style (should-fix, M; L with a live demo; confirmed, apart from the box colours)

**What the original shows, screen by screen** (3.1.21, from code):

1. **Boot:** the Exploding Rabbit logo grows in on black while the sounds load (`managers/ScreenManager.as:179-200`;
   `managers/SoundManager.as:1291`).
2. **Title:** a live SMB 1-1 demo with the HUD hidden (`level/TitleLevel.as:221`; `graphics/TopScreenText.as:351-352`).
   - The logo is centred at y 60 (`TitleLevel.as:77,245-248`), and "Ver 3.1.21" sits bottom-left at (16, 454) in a
     512 x 480 stage (`:79,249-257`).
   - After 5 s Mario runs right and jumps by himself, and never takes damage (`:84,311-339,449-472`). The nine other
     heroes stand powered-up along 1-1 and replay recorded inputs as the screen reaches them (`:90-188,340-366`). At
     the end of the level the demo starts again (`:515-520`).
   - "Click screen or press any key to begin" blinks every 500 ms (`:78,86,279-309`).
   - The news ticker and funding box appear only with online data (`:289-291`).
3. **Start menu** (`messageBoxes/StartMenu.as:31-41`): NEW GAME, LOAD GAME, OPTIONS, LINKS. Attack closes it back to
   the demo (`:83-86`), and it remembers its cursor (`:49`).
4. **New Game** opens the New game options box (`messageBoxes/NewGameOptionsMenu.as:41-53`). Each row reads
   `Label:  value` and steps with Left/Right; Attack goes back (`messageBoxes/MenuBox.as:149-157,429-451`). Its rows:
   - Map Set (Smb / Special / Lost Levels)
   - Map Difficulty
   - Game Mode
   - Powerup Mode
   - customize weapons (greyed out and skipped unless Powerup Mode is Classic, `:71-96`)
   - More Settings
   - full screen mode
   - Start Game
5. **Start Game:** the character-select level (9-1a, themed like the next level, with the select music:
   `level/CharacterSelect.as:40,81-96,123`), then the black WORLD screen, then the level (`ScreenManager.as:289-323`).
6. **Other entries:** LOAD GAME opens a file dialog for `smbc_save_data.txt` (`managers/StatManager.as:185,960+`).
   OPTIONS is Buttons, General, Sound, Skins, Cheats, Back (`messageBoxes/OptionsMenu.as:32-37`).

**How a box looks and moves:**

- **Frame and size:** a 9-slice frame from the interface skin around a fill (`graphics/MessageBoxBackground.as:11-19`;
  `messageBoxes/MessageBox.as:120-249`). It is centred, as wide as its text plus a 20 px margin, and at most 300 tall,
  scrolling past 9 rows (`MenuBox.as:45-53,98,215-232`).
- **Rows:** 34 px apart.
- **Cursor:** an animated mushroom.
- **Text:** the highlighted row turns pink (0xFFCEC7, `main/GlobVars.as:40-41`) and disabled rows grey (0xAAAAAA,
  `MenuBox.as:67-69`).
- **Motion:** a box grows from 1 % to full size in about 0.14 s, and the old one shrinks first
  (`MessageBox.as:35,112-118,316-383`).
- **Sounds:** fireball when the cursor moves, coin to choose, bump to cancel (`messageBoxes/MessageBoxSounds.as:7-10`).
- **Colours:** the frame and fill colours are skin art, so code can't show them (unverified). We use our own select
  theme.

**Now:**

- ClassicMenuScene is a plain black MenuScene (`src/game/scenes/original-game.ts:202-287`; `menu.ts:200-238`).
- Its rows: Continue, Super Mario Bros., SMB Special, The Lost Levels, Map difficulty, Options, Back. They are white
  8 px text 14 px apart with a ">" cursor.
- The select already uses a box look in the original's style: `drawPanel` with `DEFAULT_SELECT_THEME`
  (`src/game/scenes/select-grid.ts:194-245`) and a name box that grows open (`character-select.ts:1388-1403`).

**Recommendation:**

- **New scene:** a `BoxMenuScene extends MenuScene` that only changes `render`. It reuses `drawPanel`, the pink tint
  and the grow timer, over a still SMB 1-1 backdrop (lift `renderClassicGround` from `character-select.ts:1487-1513`).
  It shows our logo and the version text.
- **Boxes:**
  - **Start box:** CONTINUE (greyed out with no slot), NEW GAME, OPTIONS, BACK.
  - **New game box:** MAP SET (BEATEN after the value), MAP DIFFICULTY, GAME MODE, CUSTOMIZE WEAPONS, MORE SETTINGS,
    START GAME. RULES joins only in dev mode (O-12).
  - **Options box:** the rest.
- **Details:**
  - Our own mushroom cursor, held still with Reduce flashing.
  - Fireball, coin and bump sounds.
  - Leave out LINKS and full screen.
  - No "press any key" step, since the player already chose Classic.
- **Keep:** every announcement, the touch labels, the ability-named BACK line, the Continue slot and the Current-rules
  status line.
- **Later (L):** a live 1-1 demo. No code in the repo drives a level by itself yet.

### O-05. Dev mode Level select (should-fix, M for the Classic branch, L with the Campaign branch; confirmed)

**Now:**

- Dev > Level select is one flat page of rows (`src/game/scenes/dev-level-select.ts:36-100`):
  - **Level:** steps one at a time, with no key repeat, through 263 raw area ids plus the village, starting at `1-0`.
  - **Character:** lists 38 entries under Classic rules, one per skin.
  - **Power, Rules, Mode, Kit.** Changing Rules or Character resets Power.
- **Press counts (played):** SMB 1-1 as Mario takes 8 presses. Lost Levels D-4 as Samus with the Fire Flower in a
  Classic run takes **105**.
- **Hard can't be reached:** `devStart` sets `classicDifficulty = 'normal'` (`src/game/scenes/game.ts:1728`), and
  `startRun` sets no difficulty (`:1978`).
- **No Level Select cheat:** the cheat's menu stays hidden in dev mode until it is earned (`cheats-menu.ts:65`).
- **No campaign:** there is no campaign branch. The world map, story levels, village and training rooms are reachable
  only through Chapter 1 and a real save file. Mini games and bonus games have their own Dev menu pages.

**Recommendation:** a hierarchical Play flow built from MenuScene pages, so touch and announcements keep working.

```
DEV MODE
├─ Again: <last pick>                (replays the last start in 1 press)
├─ Classic ▸  map set ▸ world (1-8; 1-9 and A-D for the Lost Levels) ▸ level (+ Areas ▸ for sub-areas) ▸ START
├─ Campaign ▸ World map ▸ | Story level ▸ world ▸ level ▸ START | Village | Tutorial 1-0 | Training rooms ▸ |
│             Mini games ▸ | Bonus games ▸ | Open a file… (all on a scratch file that never saves)
├─ Classic heroes ▸   (O-06)
├─ Assists ▸ · Dev mode off · Back
START page: Start · Hero (the select's slot heroes, not 38 skins) · Look · Power · Difficulty · Rules · Mode · Kit · Yoshi
```

- **Reuse:** `MAP_SETS`, `levelSelectTarget` and `worldName` (`level-select-cheat.ts`), and `mapDifficultyItem`.
- **Result:** about 25 presses to D-4 on Hard, and 3 for a repeat.
- **Quick win (S):** a Difficulty row, plus making the dev start honour it.

### O-06. Dev mode Classic heroes submenu (should-fix, S; M with the release flags in O-12; confirmed)

- **Now:**
  - The rows "Classic: Yoshi mount" (off) and "Classic: Vic Viper / Warriors / Arthur / Yoshi" (on) sit directly in
    the Dev menu (`src/game/scenes/dev.ts:104-144`; `classicDev.heroesOff`).
  - A hero shows only if the player option Expansion heroes is on AND (dev mode is off OR its dev row is on)
    (`game.ts:588-616,776-811`). So the dev rows can hide a hero but never add one.
  - The dev Level select ignores the option.
  - Peach has no row; she is a Luigi look.
- **Recommendation:** a **Dev > Classic heroes** page with these rows:
  - One row per hero, each with three values:
    - **Release:** what players get, the O-12 released flag together with the option.
    - **On:** always shown in dev mode, even when unreleased.
    - **Off:** hidden.
  - **All:** cycles Release, All on and All off, and reads "Mixed" when the heroes differ.
  - **Yoshi mount:** Off / On / Ride.
- **Rule:** `devMode ? (override ?? releaseRule) : releaseRule`, applied in one function that the select, Random,
  Survival, Disable heroes, the guides and the dev Level select all call.
- **Migration:** move the old `heroesOff` list into the new override map.
- **Model:** `disable-heroes.ts`.

### O-07. Save files: what saves exist, and one system or two? (should-fix, S for option c; confirmed)

- **Now:**
  - Options > Save files lists the three campaign files (`smbc.save.N`, `src/game/save/save-files.ts:150`) and their
    codes (`src/game/scenes/save-codes.ts:80-110`). It is reachable on release from the title's Options and from
    Classic's All options.
  - Classic has one automatic **Continue** slot (`src/game/run-resume.ts`, G-008), written at each WORLD card.
  - Classic's beaten marks, cheat unlocks and options live in `smbc.progress` and `smbc.settings`. No save code
    carries them, so they can't move between the browser, the Home Screen app and the offline copy.
- **Original:** one manual save file and no slots.
  - Pause > "load / save" (`messageBoxes/PauseMenu.as:28`) and title > LOAD GAME (`StartMenu.as:34`) use the
    browser's file dialogs to save or load `smbc_save_data.txt` (`managers/StatManager.as:185,884-906,960-985`).
  - The file holds the level, the lives, score and coins at the level's start, each hero's power, upgrades, ammo and
    skins, the beaten marks, keys, settings, tutorials and cheats.
  - There is no autosave and no browser storage anywhere in the source.
- **Options for the owner:**
  - **(a) One shared system:** save codes and files also carry the Classic state. L.
  - **(b) Two visible systems:** campaign files, plus a Classic save code for progress and the run. M-L.
  - **(c) For 0.5.0 (recommended):** Classic keeps only its Continue slot. Save files shows only in dev mode, until
    the campaign opens. S.
- **What (c) changes:**
  - The Home Screen and offline notices (`src/game/scenes/home-screen.ts:61-85`) and `tools/offline/README.txt` point
    players to Save files, so they need the same gate or new wording.
  - Nothing is deleted.
  - A Classic save code can follow in 0.5.x, which gives the original's portability back.
- **Risk of (c):** a 0.4.x campaign player can't copy their files out until the campaign opens. The files stay in
  browser storage, but clearing site data would lose them.

### O-08. Save-backup reminders off by default (polish, S, confirmed)

- **Now:**
  - The default is on (`src/engine/save/settings.ts:254`).
  - The Options row is at `save-codes.ts:98-107`, and its helper treats a missing value as on (`:63`).
  - The reminder card itself only appears in the campaign (`game.ts:1280-1290`), so a release player never sees it.
    The row still shows in Classic's options (RC-027).
- **Recommendation:**
  - Default it to off.
  - Add a settings migration that turns it off once: older versions saved `true`, which can't be told apart from a
    player's choice.
  - Hide the row with Save files (O-07).

### O-09. Why every map set is open from the CLASSIC menu (answer only, confirmed)

- **Original:** the original offers all three sets from the start, so owner decision D3 matches it.
  - The Map Set row is always built (`messageBoxes/NewGameOptionsMenu.as:42`).
  - Choosing a value runs `GameSettings.mapPack = GameSettings.mapPack.GetAtIndex(gsOvRdNum)` with no check (`:103-108`).
  - `GetAtIndex` steps through every `MapPack` value with no filter (`com/explodingRabbit/utils/Enum.as:55-78`;
    `data/MapPack.as:10-12`: Smb, Special, Lost Levels).
  - The beaten marks (`StatManager.as:499-502,1874-1885`) are read only for cheat unlocks: Level Select
    (`:510-513,532-539`) and the stat cheats (`:1807-1811`). No code anywhere reads them to lock a map set.
- **Now:** `src/game/scenes/original-game.ts:50-55,214-233`, the same as the original.
- **Recommendation:** no change. The only difference is the label: the original says "Lost Levels", ours "The Lost
  Levels".

### O-10. The select's "OK LOOKS" / "OK TO PICK" line (should-fix, S, confirmed)

- **Now:**
  - Added in 0.4.67 (`CHANGELOG.md:141-142`). It is one ability-named prompt on the ground under the hero:
    `OK (Z) LOOKS` on a hero with looks, otherwise `OK (Z) TO PICK`. In revive mode it reads `OK TO REVIVE` or
    `TO POWER UP` (`src/game/scenes/character-select.ts:1394-1414`).
  - On touch, the pad's buttons already read OK, BACK and SKIN (`:938-949`).
  - The spoken text says "OK to begin" even where OK opens the looks (RC-024).
- **Original:** the select shows **no prompt**. Its only instruction is the character-select tutorial box, which shows
  only with Tutorials on, and Tutorials is off by default (`messageBoxes/CharNameBox.as`;
  `managers/TutorialManager.as:49-51`; `data/GameSettings.as:89`).
- **Recommendation:**
  - Remove the line in pick mode.
  - Keep the revive-mode lines, since Survival needs them.
  - Fix the spoken line to say what OK does: "OK: looks" or "OK: play".
  - If a visual cue is still wanted, show it once, at a run's first select. Name the ability without the key, for
    example "OK: LOOKS".

### O-11. Select faces and hero sprites against the original's style (should-fix, faces S each, sprite sets M-L; confirmed)

**How this was checked:**

- Every select face (`src/content/sprites/select-faces.ts`, 24 x 24, 38 faces) and every frame of the 10 base heroes'
  Classic sheets was rendered at 4-12x, along with the skins.
- They were rated against the authentic NES look the original used:
  - 3 colours plus transparent per sprite layer;
  - clean outlines;
  - readable silhouettes.
- No original art was opened.

| Hero      | Face (1-5) and main defect                                                     | Sprite set (1-5) and main defect                                                           | Effort (face / set)            |
| --------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------ |
| Mario     | 2: generic template, the moustache bar swallows the mouth, blob cap badge      | 3: big Mario's legs too long for his head                                                  | S / M                          |
| Luigi     | 2: a pure recolour of Mario                                                    | 3: palette swap (authentic)                                                                | S / -                          |
| Link      | 2: flat skin, square-eye template, no ear point                                | 3: believable Zelda 1 look                                                                 | S / M                          |
| Samus     | 3: the helmet reads, the visor is flat                                         | **2**: one flat orange on dark red, legs a flat bar in the air, a stick arm when aiming up | S / **L** (34 frames)          |
| Simon     | **1**: long hair and a smooth face read as a woman, and don't match the sprite | 3: reads as Castlevania                                                                    | S / M                          |
| Mega Man  | 3: the best human face, too wide                                               | 4: clean outline and ramp                                                                  | S / -                          |
| Bass      | 2: grey helmet, but **orange** in game (mismatch)                              | **2**: a generic robot in the wrong colours                                                | S / **L** (24)                 |
| Bill      | **1**: bare chest with pink blobs, reads as a generic man                      | 3: the Contra silhouette works                                                             | S / M                          |
| Ryu       | 4: mask, eye slit, blue ramp                                                   | 4: crisp outline, readable spin and slash                                                  | - / -                          |
| Sophia    | 3: grey with red lights, but the tank is **pink** (mismatch)                   | 4: full outline, three-tone pink ramp                                                      | S / -                          |
| Zelda ×3  | 2: a recolour of Peach                                                         | 2: "pink Link" (Link's tunic and sword)                                                    | S / L if she gets her own body |
| Quick Man | 2: Bass recoloured                                                             | 2: Bass recoloured with a crest                                                            | S / M                          |

- **Why most faces look "Atari-era":**
  - Most human faces share one template: square 2 x 2 eyes with a white dot, a 1 px nose, a black bar mouth and flat
    skin with no shade.
  - Their black outline is the same colour as the box's black fill, so the head has no silhouette in its cell.
- **The bar, which Ryu and Sophia meet:**
  - One hue per material in three tones (base, shade, highlight).
  - A complete 1 px outline in a dark shade of the hue, not black.
  - One accent colour.
  - Space between the limbs.
- **Style guide:**
  - Per hero, an NES palette of 3 colours plus transparent per layer.
  - Outlines in the hue's darkest shade.
  - A face template for the 24 px portrait: 3 skin tones, eyes 2 px wide with the hero's own shape, a shaded jaw, and
    a 1 px rim in a colour that differs from the box fill.
  - Each face must match its sprite's colours.
- **For 0.5.0:** about 14 faces, each S, since the faces are the first thing players see and two of them don't match
  their sprites. Then Samus's broken poses (L) and Bass's colours (M).
- **Then in 0.5.x:** big Mario and Luigi, Simon, Bill and Link (M each), then Zelda's own body if wanted.
- **Not a blocker:** every hero is our own art, playable and readable.

### O-12. Lock the Expansion heroes, and make Classic rules and Expansion dev-only (**blocker**, M, confirmed)

**Now:** both rows show on release (`src/game/scenes/original-game.ts:305-311,324-332`;
`src/game/scenes/original-options.ts:65,168-180`).

**Ways to reach an Expansion hero on the release build today**, all played:

- The Options row.
- A setting saved from an earlier visit (`classic.expansion: 'on'`): the select shows all four, and Disable heroes
  lists 14 slots.
- `?level=1-1&char=vicviper` plays Vic Viper when the setting is on (`src/main.ts:303-316`).
- A Continue slot resumes as Yoshi (`game.ts:2075-2135`).
- Random, Single random, Survival, Disable heroes and the Classic guide lists. All of these go through `slotsFor`
  (`game.ts:561-616`), gated by the same setting.

With the setting off, the link and the Continue slot both fall back to Mario (played, via `restoreSlotHero`,
`game.ts:627-640`).

**Current rules** are read straight from `settings.classicRules` in about 9 places:

- `game.ts:1974-1976` and `:2098`
- `main.ts:307`
- `guide.ts:71`
- `disable-heroes.ts:23`
- `level-select-cheat.ts:63`
- `original-game.ts:197,237-238,369`

**Original:** it has neither, no rules switch and only its 12 select slots (`messageBoxes/CharacterSelectBox.as:70-74`).

**Recommendation:**

1. Hide both rows unless `game.devMode`.
2. Route every read through two getters:
   - `Game.classicRules` gives `'classic'` outside dev mode.
   - `Game.expansionHeroes` is false outside dev mode.
3. Add the per-hero "released" switch: `RELEASED_EXPANSION_HEROES: readonly string[] = []` in the registry, checked in
   `slotsFor`. Each later release adds one id, and the player row returns once the list isn't empty.
   - Keep `rosterFor` as it is, so a locked hero falls back to Mario and a Continue slot still works.
   - O-06's dev overrides sit on top.
4. **Migration:** never rewrite the stored values; outside dev mode they are ignored. A Continue slot saved under
   Current rules resumes under Classic rules with its level, lives, score and coins, and with its power and kit reset.
5. **Tests:** update `classic-resume`, `classic-mode`, `classic-pause-guide-cheats`, `classic-select-match`,
   `classic-arthur`, and the 13 test sites that set Current rules. They need dev mode on, or the getters.

### O-13. Rename "All options" (polish, S, confirmed)

- **Now:** the Classic options row "All options" opens the full options: Video, Audio, Controls, Accessibility, Save
  files, Level editor, How to play (`src/game/scenes/original-game.ts:360`; hint `:250`; `options.ts:24-44`).
- **Original:** its Options box is Buttons, General, Sound, Skins, Cheats (`messageBoxes/OptionsMenu.as:32-37`).
- **Recommendation:** rename it **"Video, audio, controls"** (22 characters; rows fit 24) and fix its hint.

### O-14. Campaign guides in Classic (should-fix, S, confirmed)

- **Now:**
  - Title > Options > How to play always lists the 9 campaign heroes with their campaign guides (`options.ts:37`;
    `guide.ts:70-72`). This is the main leak on release.
  - Classic pause > Guide and pause > Options > How to play show campaign guides only when Current rules are saved.
    O-12 fixes those.
  - RC-023 notes the same roster on the title's hero row.
- **Original:** it has no in-game guide (see O-15).
- **Recommendation:**
  - While the campaign is closed, the title's How to play lists the Classic select's heroes with their Classic pages.
    Or, more simply, it becomes campaign-only and Classic's options get their own How to play row.
  - Pause > Guide already covers the hero being played.

### O-15. A guide the first time you play a hero? (answer only; polish if built, M = G-042; confirmed)

- **Original:** the TutorialManager has boxes for the character select, the first start, each hero's start and each
  upgrade (`managers/TutorialManager.as:41-120,276-341`). They show only with General > Tutorials on, and the default
  is off (`data/GameSettings.as:89`; `messageBoxes/GeneralOptions.as:25`). So by default a first play shows nothing.
- **Now:** the same. Classic never shows explainers (`src/game/tutorial/explainers.ts:24`), and only the campaign offers
  training rooms (`training.ts:30-32`). Pause > Guide gives each hero's page on demand.
- **Recommendation:** no change for 0.5.0. If the owner wants it, build the Tutorials option, off by default. It must
  name abilities, wait for a press and be announced.

### O-16. Back on the select between levels and after deaths (should-fix, S; M with the pause Quit; confirmed)

- **Original:** the select has no back.
  - Attack and Pause do nothing useful there (`messageBoxes/CharacterSelectBox.as:596-613,1227-1230`).
  - You can only leave from a level, through Pause > Quit Game. That asks "Are you sure ... lose any unsaved data"
    with CANCEL / OKAY (`messageBoxes/MenuBox.as:320-330`).
  - Leaving costs everything since the last manual file save, since there is no autosave.
- **Now:**
  - Ours has no Back on the mid-run select either (`game.ts:1495,2498` pass no `onCancel`).
  - The Continue slot is already written before both mid-run selects (`game.ts:1479,2474`), so leaving would cost
    nothing.
  - Pause > Quit to title has no confirmation, and goes to our title rather than the CLASSIC menu (`pause.ts:85-89`).
- **Recommendation:**
  - In Classic, pass `onCancel` at both selects. BACK then opens a NO/YES card: "QUIT TO THE CLASSIC MENU? YOUR RUN
    WAITS IN CONTINUE." It is announced, with NO first. YES returns to the CLASSIC menu.
  - Give Pause > Quit the same card and the same destination.
  - What it costs: nothing, since Continue resumes at that level's start with the run's lives, score, coins, hero and
    power. That is kinder than the original, where quitting lost everything unsaved.

### Suggested fix batching (with the RC items)

1. **0.5.0 blockers:** RC-001, RC-002 and RC-004 (section 5, batch 1), plus **O-12**, the Expansion lock, the dev-only
   rules and the released list.
2. **Title and menus (S each):**
   - O-01, O-02 and O-03.
   - O-07 option (c), with O-08.
   - O-13, O-14 and O-16.
   - O-10, with RC-024's spoken line.
3. **CLASSIC menu look:** O-04, as box menus on a still 1-1 backdrop.
4. **Art pass:** O-11's 14 faces, then Samus's poses and Bass's colours.
5. **Dev tools:** O-05 and O-06. This can follow 0.5.0, since only the developer sees it. Its difficulty quick win helps
   test RC-001.
