# 0.4.9: Bill Rizer, hidden under 7-3: shared brief (B1 campaign, B2 mini game, B3 art and music)

## Conventions and starting point
- Conventions: /tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/tutorial-brief.md
  - setup and ports;
  - run all checks with `set -o pipefail`;
  - commit trailers;
  - never commit node_modules;
  - no CHANGELOG edits;
  - player text uses ability names, never letters;
  - announcer, reduce flashing;
  - write failing tests first.
- Base: `git merge claude/admiring-galileo-quy3ri` (5ecc82e = the 0.4.8 Ryu batch, PR #55).
- Docs:
  - docs/HEROES.md covers captives and the MiniGameDef. Use these mini games as references:
    - Ryu's Shadow Duel in 6-2: the letterboxed cutscene, the banner slots, the cautious and clumsy human sims, the
      `trick` zone;
    - Simon's Dracula's Castle: the two-phase boss;
    - Samus's Zebes Escape: `camera: free`, `height:`.
  - The Mini Game Arena picks up new MINIGAMES entries automatically.
  - `WorldStart.extraEntities`, `scorePopups`, and the `Game.inRound` wording.
  - Also read docs/WORLD_MAP.md.
- Campaign-only level changes go through `campaignLevel` in src/game/level/campaign.ts. Examples: 5-4's `descent`,
  6-2's `trick`, `World.descentBarLen`.
- Bill's main-game kit is in src/game/characters/bill/ (index.ts, weapons.ts, guide.ts):
  - 8-way rifle, prone;
  - flowers cycle the weapons;
  - 3–5 hits;
  - the star gives a barrier.
  - In the main game it must not change. Run the existing bill tests.

## Owner decisions
- Bill is found in **World 7, 7-3**, one hero per world: Luigi 1, Link 2, Mega Man 3, Samus 4, Simon 5, Ryu 6,
  Bill 7.
- **7-3 looks like a Contra level, in campaign play only.**
  - Same layout: every tile, gap, enemy and coin stays where it is, and the collision is identical. Only the look and
    the music change, to a jungle stage in NES Contra style:
    - bridges become steel girder bridges;
    - tree-top platforms become jungle cliffs and palm canopy;
    - the background is jungle canopy, distant mountains and palms (in place of clouds);
    - original jungle music.
  - It must stay readable: ? blocks, bricks, coins, the flagpole and enemies keep their shape and meaning. The
    Paratroopas and the leaping Cheep Cheeps stay SMB enemies. Only the surroundings get a Contra paint job (they may
    take themed palettes).
  - Outside the campaign (level select, `?level=7-3`, classic rules), 7-3 looks exactly as in v0.4.8.
  - This is the first of a series. The next batch reskins 2-1 (Zelda II), 3-1 (Mega Man), 4-2 (Metroid), 5-4
    (Castlevania) and 6-2 (Ninja Gaiden) the same way. So build the hook generically: a level header key such as
    `campaignTheme: contra-jungle` / `campaignMusic: contra-jungle`, or a campaign table keyed by level id. B1 owns the
    hook.
- **Entrance: an exploding bridge (campaign only).**
  - ONE bridge in 7-3 is marked: steel girders with a blinking red light on its end post, and a few coins pointing at
    it. B1 picks a long bridge with open sky below and easy reach for every hero. A suggestion is the bridge after the
    checkpoint, or the long one at columns 16–31 / 32–47.
  - When a hero steps onto it, it blows up segment by segment, Contra stage 1 style:
    - each segment flashes, then explodes (an explosion sprite and a boom) and becomes air;
    - the explosions run in a chain at a pace a running hero can just about outrun.
  - Falling through that bridge's gap leads (with a campaign-only `pit`-style zone over that column range) to the
    hidden jungle camp. Falling ANYWHERE else in 7-3 still kills, the same rule as Simon's lift in 5-4.
  - The bridge comes back on respawn or re-entry. Anyone who ran across can still drop into the gap deliberately.
  - Co-op: both players arrive (`World.fallSpot`).
  - Outside the campaign the bridge is a normal bridge.
- **Hidden area `7-3-camp`**, Bill's jungle camp under 7-3:
  - a riverbank with shallow water, palms, a sandbag base, searchlight decor, and `captive x y hero=bill`;
  - arrival: falling in from the top (start `fall`; the 0.4.8 fall-in steering lock applies);
  - the clock carries over (`time: inherit`, `parent: 7-3`), and no secret or clear is recorded.
- **The way back: a waterfall climb `7-3-falls`** in Contra stage 3 style:
  - a vertical area (`camera: free`, `height:`) climbing up rock ledges beside a waterfall;
  - it comes out further along 7-3 on solid ground (B1 picks the spot, e.g. the tree platform at 112–119 near the
    checkpoint, or the ground at 192+). Make sure no hero can get stuck and every hero can climb it, including small
    Mario and Simon's stiff jump.
  - Getting from the camp to the falls is B1's call (walk right into it, or a door).
- **Story: Red Falcon.** In Super C, Red Falcon's alien warriors seep into the brains of the army, so the soldiers are
  possessed.
  - In our story Bowser's brainwashing reaches Bill through Red Falcon: Bill is under the alien's control.
  - `DIALOGUE.bill` in free-hero.ts (B1). Use the real name "Red Falcon", as with Dracula and Larry. All art is
    original.

## Mini game (B2), "as true to the real game as possible" (owner rule)
- An NES **Contra stage 1-style** run-and-gun, played as Bill. Working title "JUNGLE ASSAULT" (B2's call).
- **Intro:** a Contra-style stage card with:
  - a small island map with a route line, "STAGE 1 / JUNGLE";
  - a short briefing that Red Falcon's aliens have taken Bill's mind;
  - SKIP / OK with ability names.
- **Konami code:** entering the Konami code during the intro card (UP UP DOWN DOWN LEFT RIGHT LEFT RIGHT, then the
  attack and jump buttons in Contra order) gives 30 lives for that round, with a sound and an announcer line.
  - It works on keyboard, pad and the touch d-pad and buttons.
  - The title-screen dev-mode cheat must not fire from inside the mini game, and vice versa.
- **Rules, true to NES Contra:**
  - Lives: 3, shown as medal icons top left. NES Contra has no health bar.
  - ONE HIT KILLS: Bill flips backward in the Contra death animation.
  - Respawn: he drops in from the top of the screen at the current scroll position, with about 2 s of blinking
    invulnerability.
  - Out of lives: fail, then the shared retry or give-up menu.
- **Bill in Contra form, a mini-game-only variant of his def or kit, the main game unchanged:**
  - He starts with the DEFAULT gun only (single slow shots, a few on screen).
  - Aim: standing aims left/right, up and the up-diagonals; while running he can aim at the down-diagonals; in the
    air he can aim in all 8 directions; prone shoots low along the floor.
  - The jump is a spinning somersault: a fixed apex with limited air steering, as in Contra.
  - He can drop through thin platforms with down + jump, and he swims in water, ducking under the surface to dodge.
  - Check all of this against NES Contra and match it; deviations need a reason.
- **Falcon weapons, carried by flying capsules (sine flight) and pillbox sensors (they open and close; shoot them while
  open):**
  - M machine gun (auto fire while held);
  - S spread (5-way);
  - L laser;
  - F fire (corkscrew);
  - R rapid (a bullet speed and rate upgrade);
  - B barrier (temporary invincibility).

  Getting another weapon replaces the current one. DEATH LOSES THE WEAPON (back to the default gun).
- **Stage:** about 3 minutes for a careful player.
  - Jungle ground with grass tiers to jump between, water sections, palm trees, and EXPLODING BRIDGES.
  - Enemies, all original designs in Contra style, all possessed soldiers or alien defences:
    - running soldiers spawning from the screen edges, who jump down tiers;
    - riflemen, standing and in the bushes;
    - rotating wall guns (turn toward Bill in 12 steps, then fire);
    - pop-up cannons;
    - (optional) a scuba diver in the water.
  - The scroll is right-only, like Contra.
- **Boss, two phases** (as with Dracula):
  1. **The defense wall** at the stage end. Two wall cannons and a sniper on top, with a glowing sensor core in the
     door. Destroy the core and the wall blows apart.
  2. **Red Falcon** behind it: a pulsing alien HEART set in organic walls, the alien's lair, reached by a short drop
     or the wall opening into it. Alien mouths or pods spit larvae that crawl and leap at Bill. Shoot the heart until
     it bursts.
- **Endings:**
  - Win: a Contra-style end (the explosion chain, then the freed banner).
  - Pass, fail or quit go through MiniGameMenuScene.
  - The dev assists (No damage) work.
- Touch labels and other settings:
  - touch labels: JUMP, FIRE (or the weapon letter's name), and MENU;
  - the announcer;
  - reduce flashing: no screen flashes and no strobing core or heart; a softer explosion flash;
  - `scorePopups` off;
  - `Game.inRound` wording.
- Register `MINIGAMES.bill`.
- **Difficulty targets:**
  - a cautious-human sim with 3 lives passes ≥ 85%;
  - a clumsy one passes > 0% and < 100%.
  - Report the numbers over 30 seeds. Make the bot honest: it uses the falcons and the drops as a person would (see
    the Ryu bot lessons), and a stuck bot is not stage difficulty.

## Names (contract)
- **Areas (B1):** `7-3-camp`, `7-3-falls`.
- **Exploding bridge (B1):** an entity or tile set in 7-3, campaign only, e.g. `bridge-blast x y w=` plus a
  campaign-only `pit` zone over it.
- **Themes (B3):**
  - `contra-jungle`: the 7-3 reskin plus the camp and the mini game's ground.
    - Frames `ground`, `hard`, `brick`, `used`, the `bridge` (`-`) steel girder, `tree-top`/`tree` (`T`/`t`) as
      jungle cliff top and trunk, `wall` (backdrop), `wall-top`, and `water`.
    - A sky entry with a jungle backdrop colour.
    - Decor: `palm` (32×48), `canopy` (32×16, replaces clouds), `mountain` (64×32), `sandbags`, `searchlight`.
  - `contra-falls`: waterfall, rock ledges, mist.
  - `alien-lair`: organic walls and floor for phase 2.
  - Register each in schema.ts THEMES/themeMusic, the tiles.ts palette and `@theme` frames, the SKY in
    tile-render.ts, and the decor and enemy palette defaults (themes.test.ts).
  - B3 decides whether the 7-3 castle decor gets a Contra base-gate look with the same size and flag position, or stays.
- **Sheet `contra` (B3):**
  - Bridge: `blast-bridge-0..1` (16×16, the intact girder with the red light blinking), `boom-0..3` (32×32
    explosion).
  - Soldiers: `soldier-run-0..2`, `soldier-jump` (16×32); `rifleman-0/1`, `rifleman-bush` (16×32).
  - Guns: `wall-gun-0..11` (32×32 rotation steps, or 0..2 plus a turret if 12 is too many: say so); `popup-cannon-0..2`.
  - Pickups: `pillbox-0..2` (32×32 closed, half, open), `capsule-0/1` (24×16 flying pod), `falcon-M`, `-S`, `-L`,
    `-F`, `-R`, `-B` (24×16 eagle badge with letter).
  - Shots: `bullet-small` (4×4), `bullet-big` (6×6), `spread-ball`, `laser` (16×4), `fire-ring` (8×8), `enemy-bullet`
    (4×4).
  - Defense wall: `defense-wall` pieces (B3 sizes them), `wall-cannon-0/1`, `core-0..2` (32×32 pulsing sensor).
  - Red Falcon: `falcon-heart-0..2` (64×64 pulsing), `larva-0/1` (16×16), `pod-0/1` (32×32 spitting mouth).
  - Bill: `bill-death-0..3` (Contra flip, if Bill's sheet lacks it) and `medal` (8×16 life icon).
  - Cutscene and card: `card-island` (96×64 map), `card-route` dots.
  - Palettes `contra`, `contra-flash`, `alien`.
- **Music (B3), original NES Contra style:**
  - `contra-jungle`: the 7-3 reskin and the camp;
  - `contra-stage`: the mini game, a driving jungle march;
  - `contra-boss`: the defense wall;
  - `contra-lair`: Red Falcon;
  - `contra-card`: a short stage-card sting.
- **SFX (B3):** `bridge-boom`, `falcon` (pickup), `contra-death`, `spread`, `laser`, `konami` (30 lives).
- Unknown ids must not throw until merged. Until B3 merges, use `overworld`/`castle` themes and rect fallbacks;
  switch when told.

## Agents (parallel worktrees, a reviewer each, then merge, browser QA, CHANGELOG, PR)
- **B1 campaign:**
  - the generic campaign-look hook;
  - the 7-3 campaign look (using B3's theme names);
  - the exploding bridge (entity, chain timing, campaign-only pit);
  - `7-3-camp`, `7-3-falls`, `DIALOGUE.bill`, the map hint;
  - reachability and route sims for every hero, plus co-op;
  - non-campaign 7-3 is unchanged (a tile-for-tile and look test).
- **B2 mini game:** src/game/minigames/bill/:
  - the scene, stage map, card and Konami code;
  - the Contra Bill variant, enemies, falcons and pillboxes;
  - the defense wall, Red Falcon and the lair;
  - HUD, bot and harness;
  - tests: duel-style tests, human sims, and the font test (all text in font).
- **B3 art and music:** the themes, the sheet, the palettes, music and sfx; frame and validity tests; theme registration.
