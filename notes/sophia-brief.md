# 0.4.11: Sophia III, shared brief (S1 character, S2 mini game, S3 art and music; S4 campaign route comes later)

## Conventions and setup
- **Conventions:** /tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/tutorial-brief.md
  - setup and ports;
  - run all checks with `set -o pipefail`;
  - commit trailers;
  - never commit node_modules;
  - no CHANGELOG edits;
  - ability names in player text, never button letters;
  - announcer and reduce flashing;
  - write a failing test first.
- **Base:** `git merge claude/admiring-galileo-quy3ri`. It holds 0.4.9 (Bill), which is about to become a PR.
- **Merging later:** 0.4.10's Safety floor sits on branch `worktree-agent-abad9234131a362c4` and lands after 0.4.9.
  Merge the main branch again before your final commit, and whenever the orchestrator tells you to.
- **Do NOT edit any SMB or Lost Levels level map** (`src/content/levels/**`), and don't touch the converter. Level
  changes wait until 0.4.9 and 0.4.10 are merged (owner rule). The 8-4 campaign route is agent S4's job, later.
- **Docs to read:**
  - docs/ROADMAP.md, Sophia section: the owner's decisions;
  - docs/HEROES.md: CharacterDef, the guide, the training lessons, captives, MiniGameDef, the mini games; Jungle
    Assault and Link's Shadow Keep are the closest models;
  - **the full original spec:** bug-reports/2026-10-07-sophia-build-classic-character.md. Its SO-* IDs come from
    the original Crossover 3.1.21 source. Use its numbers and behaviour.

## Owner decisions
- Sophia III, the tank from Blaster Master, is the 9th hero. She's hidden in World 8. The route there is S4, later:
  - 8-4-end's trap pipe at column 10 leads to Jason, who is looking for his frog Fred;
  - you follow Fred through water to Sophia's garage.
- **She is a normal campaign hero**, in `CHARACTERS` and locked until freed, like the others. The spec was written for
  a dev-only Classic rules mode. Ignore its Classic prerequisites (TG-*, PS-C, HP-C, BR-C, SW-C, `CLASSIC_EXTRAS`,
  `rules: 'classic'`) and map them onto our current systems.
- **Jason can hop out of the tank** in the main game. This goes beyond the original, where Jason is decoration only.
  It's our own design (see S1).
- **The mini game uses both of Blaster Master's modes:**
  1. Sophia in side view;
  2. Jason on foot through a gateway into an **overhead dungeon**, reusing Link's top-down kit in
     src/game/topdown/;
  3. the boss fight, overhead.

  The villain is the **Plutonium Boss**, Blaster Master's final boss. In our story, the radiation of the Underworld
  carried Bowser's spell to Sophia.
- **Owner rule:** be as true to the real game as possible. All art and music is ORIGINAL, in NES Blaster Master style.

## S1: the character (src/game/characters/sophia/)
- **`SOPHIA` CharacterDef**, registered in `CHARACTERS` after Bill.
  - Damage model: `powerup`, Normal / Hyper / Crusher, matching small / big / fire.
  - `stomps: false`; she never shrinks.
  - Follow the spec for:
    - the movement profile, her own driving code and the wide 19×15.5 hitbox (SO-2 to SO-15);
    - the squat-then-constant-rise jump;
    - the 3-level cannon (SO-28, SO-29);
    - Triple and Homing missiles (SO-30 to SO-32), as ammo on the tool belt;
    - Hover with the 8-cell meter, from the Mushroom (SO-35, SO-55);
    - Wall Climb and Ceiling Climb, from the Flower (SO-36 to SO-38, with lifts last);
    - thrust swimming (SO-18 to SO-21);
    - the pipe, flagpole and axe rules (SO-43);
    - death and kill explosions.
  - She needs sprite rotation for walls and ceilings (SO-51), which is a renderer change.
  - **Defer** the Sophia-only level tiles and variants (SO-45 to SO-48, `WideCharacter` and similar). They are a
    level-data and converter change. Note in your report what is lost without them, such as the 4-4 two-tile drop.
- **Jason on foot (our design, propose details in your report):**
  - **Getting out:** press a clear ability while standing on the ground, for example "EXIT" on the special/select
    side. The tank stays parked: solid to stand on, ignored by enemies.
  - **Size:** Jason is small, about 8×16. He fits 1-tile gaps.
  - **Moves:** a low jump, a weak gun, climbing vines and ladders.
  - **Danger:** a fall of more than about 5 tiles hurts him, as in Blaster Master.
  - **Getting back in:** walk to the tank and press UP or EXIT.
  - **Damage:** Jason shares the hero's power state. Decide how hits work while he's outside and say what you chose.
  - **Continuity:** pipes, the flagpole, exits and deaths work for both. A level exit taken while Jason is on foot
    carries the tank along.
  - **Co-op** must keep working.
- **The rest of the kit:**
  - `guide.ts`, `lessons` for training (3–5 lessons, among them hover, a wall climb and Jason hopping out);
  - touch labels: SHOOT, MISSILE, EXIT;
  - `devKit`, a portrait, and the announcer.
- **Tests:** `tests/sim/sophia.test.ts` with physics numbers from the spec and every ability. Also make the existing
  every-hero sweeps pass with her added. This includes fall-arrival, Bill's camp and others; after 0.4.10 merges, the
  safety-floor sweep too. If a sweep can't apply to a wide tank, make a principled exception and explain it.
- **Until S3 lands:** placeholder art is fine (SO-53). Use the sheet name `sophia`; frame names are below.

## S2: the mini game (src/game/minigames/sophia/), working title "UNDERWORLD"
- **Intro:** Blaster Master's opening in brief, as a short letterboxed cutscene: Fred touches the glowing chest and
  jumps down the hole, and Jason follows. It can be skipped.
- **Section 1, side view in the tank** (Blaster Master Area 1 style):
  - a cavern with mutants (crawlers, hoppers, flyers);
  - breakable blocks;
  - a ladder Jason must climb, or a gap only Jason fits through, so the hop-out is taught;
  - ending at a gateway the tank can't enter.
  - **It uses S1's real Sophia def** through World. Until S1 lands, build sections 2 and 3 first, then plug section 1
    in when told. Keep the structure ready for it.
- **Section 2, Jason overhead (the dungeon):** reuse src/game/topdown/ (Link's Shadow Keep).
  - Jason's GUN meter has 8 levels. Powering up widens and strengthens the shot; each hit drops it a level, as in
    Blaster Master.
  - Grenades.
  - A HOV/POW-style health bar.
  - A few rooms with Blaster Master-style overhead enemies, a gun-capsule drop, and the boss door.
- **Section 3, the Plutonium Boss, overhead:** an original design in Blaster Master style with two phases, readable
  and fair, on its own fight clock.
- **Endings:** pass / fail / quit, MiniGameMenuScene, the dev assists, touch labels, the announcer, reduce flashing,
  `Game.inRound` wording. Register `MINIGAMES.sophia`.
- **Bot and human sims:** cautious ≥ 85% over 30 seeds; clumsy above 0 and below 100%; an honest bot. Also a font
  test.

## S3: art and music (all original, NES Blaster Master style)
- **Sheet `sophia`:**
  - the tank: `idle`, `drive-0..3`, `jump`, `hover-0/1` (with flame), `open` (hatch);
  - wall and ceiling poses, or rotation-ready frames (agree with S1);
  - `turn-*` if needed;
  - shots: `cannon-0..2` (levels), `missile`, `homing-0/1`;
  - `boom-0..3`;
  - icons: `icon-cannon`, `icon-triple`, `icon-homing`, `icon-exit`;
  - `hover-cell`.
  - Palettes `sophia`, `sophia-hyper`, `sophia-crusher` and `sophia-star-0..3`.
- **Jason, side view:** `jason-stand`, `jason-walk-0..2`, `jason-jump`, `jason-climb-0/1`, `jason-hurt`, `jason-die`,
  `jason-shot`.
- **Jason, overhead:** `jason-o-{down,up,left,right}-0..1`, `jason-o-shoot-*`, `grenade-0/1`, `gun-capsule`,
  `pow-capsule`.
- **Fred the frog:** side view `fred-0..2` (hop and swim), and a "mutated" `fred-big` for the cutscene.
- **Mutants:**
  - side view: `crawler-0/1`, `hopper-0/1`, `flyer-0/1`;
  - overhead: `blob-0/1`, `eye-0/1`, `turret-o-0..3`.
- **The Plutonium Boss:** large frames, sized by S3, for both phases; `boss-shot-*`.
- **Cutscene pieces:** `cut-chest`, `cut-hole`, `cut-fred-jump`, `cut-jason`.
- **Themes:**
  - `underworld`: the side-view cavern for the garage and section 1. Roots, dark rock and mutant-stained gateways;
    ground, hard, brick, ladder, a `gateway` decor, water.
  - `bm-dungeon`: overhead tiles for the top-down kit.
  - Register them everywhere themes are registered (see the 0.4.9 Contra themes as the pattern).
- **Music:** `bm-area` (the stage march), `bm-dungeon`, `bm-boss`, `bm-garage` (calm) and `bm-cutscene`.
- **Sound effects:** `sophia-jump`, `sophia-cannon`, `sophia-hover`, `sophia-open`, `jason-shot`, `grenade`,
  `mutant-die`, `frog`.
- Unknown ids must never throw.

## S4: the campaign route (LATER, after 0.4.9 and 0.4.10 merge)
- 8-4-end's trap pipe leads, in the campaign only, to Jason's area.
- Fred through the water, then Sophia's garage with `captive hero=sophia`.
- Back to 8-4-end. `DIALOGUE.sophia` and the map hint.
