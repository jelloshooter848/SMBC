# Super Mario Bros. Crossover: browser rebuild plan

## In flight (9:50 AM PDT Oct 7)
- **0.4.9:** QA passed. A fix agent is fixing the camp HUD decor and the bridge pace. Then merge, run the checks, and
  open the PR.
- **0.4.10:** Safety floor is ready on worktree-agent-abad9234131a362c4 (caaa4ea). Merge it only after the 0.4.9 PR
  merges, then add the CHANGELOG line and open the PR.
- **0.4.11 Sophia:** S1 (character), S2 (mini game) and S3 (art and music) started early at the owner's request.
  - Brief: scratchpad/sophia-brief.md.
  - No level map edits until 0.4.9 and 0.4.10 merge. S4, the 8-4 campaign route, comes after that.
  - S2 waits on S1's def for the tank section; tell S2 when S1 has merged.
- **0.4.13 story:** STORY.md script agent running (scratchpad: none, writes docs/STORY.md).

## Separate sessions (other machines)
- **0.4.13 story build:** session_01XQfydteGJKAYoJQGdUsjbh, started 12:17 PM PDT.
  - Base: claude/admiring-galileo-quy3ri. Outcome branch: claude/wip-0.4.13-story.
  - Scope: Chapter 1 only, with Sophia's lines guarded until she lands.
  - It does not report back on its own: check it during the 15-minute updates with get_session / list_events
    (status_bucket) and git ls-remote. Send it merge instructions with send_message when the base moves.

## Owner decisions, about 12:35 PM PDT Oct 7
- Sophia (0.4.11) and hero tributes (0.4.12) ship in whichever order is ready first.
- The story build (0.4.13) starts without waiting for Sophia; her lines are added later. Hold the start until a couple
  of the running agents finish, because of machine load (full tests take ~25 min).
- Chapter plan: 0.5.0 is Chapter 1 plus the rebrand "SMB Crossover REMIX". 0.4.14 and 0.4.15 are the mini game
  rebuilds, 0.4.16 the finishing pass. 0.5.1 is the Classic rules. Chapter 2 is released as 0.6.0, Chapter 3 as 0.7.0.
- Owner updates every 15 minutes, in Pacific time, with time remaining; the gates for releases not yet started.

## Owner decisions, about 12:30 PM PDT Oct 7
- The Koopaling airships become their own release, 0.4.14. They unlock Lost Worlds A–D and the true ending.
- Restyled levels keep their look after the hero is freed. Toad remarks on the change on the first visit
  (STORY.md 2.3b).
- The restyle's own music plays for every hero.
- The coin heavens above restyled levels share the look (2-1-sky, 2-1-sky2, 3-1-sky, 6-2-sky). Bonus rooms and
  water areas keep their own look.
- The Plutonium Boss is a side-view tank fight. The overhead fight becomes the dungeon guardian.
- The main story ends at Lost 8-4. The six pieces unlock A–D, and D-4 is the true ending. World 9 keeps the NES rule.
- The Lost castles' fake Bowsers get reveal pages.

## In flight (about 11:00 AM PDT Oct 7)
- **0.4.9:** released and live.
- **0.4.10:** Safety floor merged into the branch (bc0014e), CHANGELOG done. The Top Secret Area is built (3bd5fcd on
  worktree-agent-a24fe51564b732b3c, wip branch claude/wip-0.4.10-top-secret-area) and IN REVIEW. Then: merge, browser
  QA of both, CHANGELOG, then the 0.4.10 PR.
- **0.4.11 Sophia:**
  - S3 art is done and reviewed (b38c6dc, claude/wip-0.4.11-sophia-art).
  - S1 (character) and S2 (mini game) are running. S2 must fix the boss frame names and set tilesDark.
  - S4 (8-4 route) comes after 0.4.10 merges.
- **0.4.12 restyles**, started at the owner's request:
  - fidelity audit (read-only, report in scratchpad/fidelity-audit/REPORT.md);
  - RA art for 2-1 zelda2, 3-1 megaman-stage, 4-2 brinstar (claude/wip-0.4.12-restyle-art-a);
  - RB art for 5-4 castlevania, 6-2 ninja-city (claude/wip-0.4.12-restyle-art-b);
  - map edits only after 0.4.10 merges.
- **0.4.13 story:** a revision agent is applying the owner's review notes to docs/STORY.md.

## Release order (owner, 9:10 AM PDT Oct 7)
- 0.4.9: Bill.
- 0.4.10: the Safety floor tool.
- 0.4.11: Sophia III, a new playable hero unlocked in World 8. The owner's priority, and big.
- 0.4.12: the level restyles, plus the mini game fidelity pass.
- Then PR #51.
- The ideas list is in docs/ROADMAP.md: Koopaling airships, backward-warp traps, uses for the ??? pads.

## Owner decisions, 7:00 AM PDT Oct 7: order after 0.4.8
1. 0.4.8 Ryu: QA fixes are under review, then the PR.
2. **0.4.9 Bill, in World 7:**
   - All of 7-3 gets a Contra look (campaign only). The layout, tiles and enemy placements stay the same.
   - One steel bridge blows up piece by piece. Falling through it leads to a hidden jungle camp. Falling
     anywhere else still kills.
   - The way back is a waterfall climb using the vertical camera.
   - The villain is Red Falcon: in Super C his aliens take over the soldiers' minds, which fits our
     brainwashing story. The boss has two phases: the defense wall, then Red Falcon's heart.
   - The mini game is as true to Contra as possible:
     - one hit costs a life, starting with 3 lives;
     - the Konami code in the intro gives 30 lives;
     - respawn drops in from the top of the screen with a moment of safety;
     - Bill starts with the basic rifle;
     - flying capsules and pillbox sensors drop falcon letters M, S, L, F, R and B;
     - getting hit loses the current weapon;
     - lying flat and 8-way aim.
   - No Lance and no co-op: the game has no working two-player mode yet.
3. **Reskin batch** (campaign only): each earlier hero's level gets their game's look.
   - 2-1: Zelda II for Link
   - 3-1: Mega Man
   - 4-2: Metroid for Samus
   - 5-4: Castlevania for Simon
   - 6-2: Ninja Gaiden for Ryu

   - Uses B1's hook: the `campaignTheme:` and `campaignMusic:` headers plus a `[campaign-decor]` section.
   - Caveat: the theme drives some gameplay. `isWaterTheme` turns on swimming, and level.ts:92 plays a hero's own
     music only when the theme is `overworld`. So no reskin may use a water theme, and check how hero music
     behaves.

   1-1 stays as it is. Open question: does a level keep the look after the hero is freed? I lean yes.
4. **0.4.10, dev tool "Safety floor"** (owner request; start once the 0.4.9 PR is up):
   - **Where it lives:** a row in Dev → Assists, off by default, active only in dev mode.
   - **Pits:** a deadly fall is caught by an invisible floor AT THE PIT'S RIM, at the height of the ground beside the
     gap (the lower side, so you can't be trapped in a well). Where no ground is near, as over 7-3's bridges, use the
     standard ground row (row 13). Draw it as a faint dashed line.
   - **Lava:** lava acts as solid ground.
   - **Unchanged:** pits and zones that lead somewhere still work (coin-heaven returns, the 7-3 camp, 5-4 descent).
   - **Vertical levels:** the floor sits at the bottom of the level.
   - **Mini games:** the ones built on World (Shadow Duel, Dracula's Castle, Zebes Escape, Station Escape, the airship)
     get it too.
   - **Tests:** every hero, every deadly pit and lava pool, assist on, survives and gets out; assist off is unchanged.
5. **Then PR #51's Classic SMBC rules reports.**

General rule from the owner: make each mini game as true to the hero's real game as possible.

Reference material from the owner (reference only, never committed: it is Nintendo or Konami art):
- `scratchpad/refimg/` holds 20 screenshots with a caption index in `INDEX.md`: Zelda 1 and II, Mega Man 2, Metroid,
  Castlevania, Lost Levels and SMB3. Contra and Ninja Gaiden screenshots are still to come from the owner.
- `scratchpad/smb-maps/SM Maps/` holds full NES level maps: `SMB1/` has all 32 levels and `SMBLL/` has all 52.
  - Each map is pixel-exact at 16 px per tile, 240 px tall per area, with sub-areas stacked (1-1 is 3584×480).
- `scratchpad/refimg3/` holds the owner's gap-fill page: 23 images with captions in `INDEX.md`.
  - Contra: Stage 1 jungle, bridges, pillbox, capsule, defense wall, waterfall, the stage 1 and 8 cards, the lair and
    heart room. Image 01 is really the final-boss gameplay still.
  - Ninja Gaiden: Act 1-1 HUD still, street strip, Barbarian room and sprites.
  - Mega Man 2: the Metal Man gate and arena.
  - Metroid: Tourian.
  - Castlevania: Dracula's room and both forms.
  - SMB3: World 1 airship map.
  - Idea for the PR #51 / classic-accuracy phase: an automated audit that compares each of our levels tile by
    tile against these maps. Propose it to the owner then.

## Update 4:57 AM PDT Oct 7
- PR #53 is merged into main (80520ba). The Release v0.4.7 PR, jelloshooter848/SMBC#54, is merged too.
- Next:
  1. The owner publishes tag `v0.4.7` with target main.
  2. I check the release.yml run, the release assets and the deploy sha.
  3. I fast-forward `claude/admiring-galileo-quy3ri` to main.
- Then 0.4.8: Ryu in 6-2, starting when the owner says go.

## Status (2:04 AM PDT Oct 7) and next steps

### Context
The 0.4.7 batch is finished and up for the owner as PR jelloshooter848/SMBC#53 (head 12149e0, CI green,
3715 tests). It contains the Lost Levels story extension, the Mini Game Arena, Simon in 5-4 with Dracula's Castle,
and the Hammer Bro timing fix. Every piece was reviewed and browser-QA'd, and the QA findings are fixed. Nothing is
left to build for 0.4.7; it waits on the owner to test and merge.

### Next steps (in order)
1. **PR #53:** keep watching (subscribed; safety-net check-in armed). Fix CI or review findings if any appear.
   Once merged: fast-forward `claude/admiring-galileo-quy3ri` to main and cancel the check-in.
2. **Release:** only when the owner asks. The owner names the version (expected 0.4.7). Follow the usual flow:
   - a "Release vX.Y.Z" PR that bumps package.json and dates CHANGELOG with compare links;
   - `pnpm release:check --tag`;
   - the owner publishes the tag AFTER the release PR merges;
   - I verify the release.yml run and assets.
3. **0.4.8: Ryu in 6-2** (design below). Run the same team shape as 0.4.7:
   - R1 campaign: the trick wall in a 6-2 bonus room, the dojo, the way back, `DIALOGUE.ryu`, map hint, tests for
     every hero;
   - R2 mini game: a Ninja Gaiden stage built around wall cling, the Masked Ninja boss, the letterboxed intro
     cutscene, pass-rate sims;
   - R3 art and music: a `dojo` theme, ninja sheet, Masked Ninja, enemies, cutscene panels, music.
   Write a shared brief first (contract names, as in simon-brief.md). Then: a reviewer per agent, merge, browser QA,
   CHANGELOG, PR.
4. **After that: PR #51's Classic SMBC rules reports** (19 reports, already merged into main as docs). Read them,
   propose a build order to the owner, then batch per the toggle report's suggested order.

### Verification for each batch
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, using `set -o pipefail` so a grep on test output can't
  hide failures.
- A reviewer per agent.
- A browser QA pass for every area, in single player and co-op, on desktop and phone, with reduce flashing on.
- CI green on the PR.

## Queued for 0.4.8: Ryu Hayabusa in 6-2 (owner approved my picks, 11:25 PM PDT Oct 6)
- World 6, 6-2. ENTRANCE: a ninja TRICK WALL (karakuri revolving panel) in one of 6-2's underground bonus rooms:
  a back-wall section marked by a stuck shuriken / faint crack, a few coins pointing at it; walking into it ~1 s spins
  the panel and flips you through (every hero can do it). Behind: Ryu's night dojo hideout (paper lanterns, round moon
  window), `captive x y hero=ryu`, way back into 6-2.
- VILLAIN: the MASKED NINJA, an original cursed masked rival (inspired by Ninja Gaiden's possessed Masked Devil;
  not a dark copy of Ryu). Intro: a letterboxed Tecmo-style cutscene of the moonlit field duel.
- MINI GAME: Ninja Gaiden-style stage + boss built around Ryu's wall cling (tall walls, wall jumps), lanterns with
  ninpo, knife throwers, dogs, pit-knocking hawks (original designs); boss = the Masked Ninja.
- Starts after the 0.4.7 batch (LL extension, Arena, Simon, Hammer Bro fix) ships.

## Current batch 0.4.7 (started 11:10 PM PDT Oct 6): Lost Levels extension + Mini Game Arena + Simon in 5-4
Briefs: scratchpad/ll-arena-brief.md (W1 LL extension, W2 arena code, W3 arena art) and scratchpad/simon-brief.md
(S1 5-4 dungeon/crypt, S2 mini game + stairs + Dracula 2 phases, S3 Castlevania art/music). Owner answers: arena shows
only found games (??? otherwise), arena is its own map page, LL warp zones keep NES behaviour for now, Dracula two
phases. PR #51 (Classic SMBC rules reports) is next after this batch. v0.4.6 released (a7f193a).

## Queued after Samus + Larry: Simon in 5-4 (owner brainstorm, 7:45 PM PDT, not final)
- 5-4 (one hero per world: W5). Owner: ride the DOWN lift (5-4 lift shaft ~cols 84-91) down into a secret dungeon
  (campaign only; riding the lift down, not falling, is what takes you there; falling still kills).
- Dungeon room: a cracked wall to break. Heroes with attacks break it; small Mario/Luigi kick a Koopa shell into it.
  A single block on the far side so a shell kicked the wrong way bounces back to the wall; the Koopa must come back if lost.
  Behind the wall: stairs down to Simon's crypt.
- Mini game: Castlevania castle stage + boss (stairs as new mini-game engine piece), "going down the castle into a secret dungeon".
  Not a dark copy. Villain under discussion (Dracula recommended: vampire thrall = brainwashing).

## Queued after Mega Man: 4-2's two warp zones become secrets (owner design, 5:45 PM PDT)

- **Upper warp zone (vine) → Samus's area.** It is no longer a warp zone: one pipe, no warp numbers and
  no warp-zone road. That pipe leads down into a Metroid-style cavern with Samus as a captive.
  - Her mini game is "Zebes Escape". You play as Samus with her existing kit: morph ball, bombs,
    missiles and beams. A countdown starts and you escape through vertical shafts.
  - New engine work: a camera that follows up and down. The owner wants to remove all warp pipes
    eventually.
- **Right warp zone → Larry Koopa.** He is SMB3's Koopaling who fires magic blasts from a wand, and
  his stolen wand is what brainwashed the heroes.
  - The pipe leads to an SMB3-style airship cabin. The fight is SMB3's: wand blasts, shell spin and
    3 stomps.
  - Beating him gives three things:
    1. **The crystal ball:** the silhouettes of every hero not yet freed appear on the map.
    2. **A new map road** to an SMB3 bonus spot that rotates between a Toad House (pick 1 of 3
       chests), N-spade memory match (two misses and it's over) and the spade slot game (one try).
       A Hammer Bro guards it, SMB3-style: beat him in a one-screen battle and the bonus reopens
       for another go.
    3. **An SMB3 item inventory:** prizes are kept on the save file and used from the world map
       before entering a level. Dev mode must be able to unlock it immediately.

## Next: Mega Man, hidden in a space station above 3-1's coin heaven (target 0.4.5)

### Context
Mega Man is the next hero to unlock. The owner wants him found in 3-1's coin heaven, which is at
night, in a **space station** reached from there. Owner decisions:
- **Entrance: a hidden teleporter.** Past the end of the cloud floor, a coin trail leads to a hidden
  block. Bumping it reveals a Mega Man-style teleport pad. Stepping on it beams you up, with Mega
  Man's beam-in streak, to the station. This is deliberately different from Link's vine.
- **Mini game: a station stage plus a boss**, in NES Mega Man style. You play as Mega Man fighting
  through a short space-station stage to a boss gate with the classic filling life bar, then
  defeat **Dark Mega Man**, the brainwashing copy of himself. This replaces the "Wily Gate" pilot
  plan below, keeping its theme/HUD/music ideas and using a station look instead of a fortress.
- **Kit:** the owner asked whether the weapons need coding. They don't. Mega Man's whole arsenal
  already exists in `src/game/characters/megaman/`: buster, charge shot, slide, Saw Disc, Leaf
  Guard, Flame Wave, Homing Knuckle, Bolt, Rush Coil, the weapon energy bar and E-tanks. The mini game
  only chooses his starting kit (`state.kit`).
  - Recommended: start with buster, charge and slide, and pick up one weapon capsule mid-stage (for
    example the Saw Disc). That shows off switching with no new weapon code.
  - The boss takes `weapon` damage, so every weapon works on him.

### Build (agents in parallel worktrees, reviewer for each, then QA and a PR)
- **M1, campaign side:**
  - **3-1-sky:** coin trail past the cloud floor; a hidden "teleporter" block reusing the hidden-block
    mechanism, the way `HIDDEN_VINE` was added. It reveals a teleport-pad entity.
  - **The pad:** standing on it and pressing UP, or on landing, plays a beam-up and transfers to
    **`3-1-station`**. The station area is a sub-area: `parent: 3-1`, `time: inherit`. It has
    - a space theme: metal floor and panels, a starfield and Earth in the window, using the new
      `station` theme or decor;
    - `captive x y hero=megaman`;
    - a way back via a beam-down pad that drops you exactly where the coin heaven's pit does
      (`3-1 162 0`), with the timer carrying over.
  - **Wiring:** map hints pick it up automatically from the captive scan. `DIALOGUE.megaman` in
    `free-hero.ts`, and a Toad-free story hint is fine. Reachability sims for every hero.
- **M2, mini game code:** `src/game/minigames/megaman/`.
  - Uses the platformer World with `newGameState(MEGAMAN)` and the chosen kit.
  - The stage map is loaded `?raw`.
  - Robot enemies: a hopper, a turret and a flying drone (new Enemy subclasses).
  - A weapon capsule pickup.
  - The boss gate: a shutter, then a camera lock, then the life bar filling with a tone.
  - **Dark Mega Man boss:** deterministic patterns covering run/jump, a 3-shot volley, a slide and a
    charge shot. His second bar has 28 points. He takes weapon damage.
  - Pass, fail and quit outcomes; the shared `MiniGameMenuScene`; assists (No damage); touch labels.
  - Tests, plus a cautious-human sim like the keep's.
  - Possible small engine hooks: the entity factory for mini-game-only entities, a vertical camera
    lock for the boss room, and a boss bar on the HUD.
- **M3, art and music (in Mega Man's style, original work):**
  - the `station` theme tiles: panels, girders, a window with stars and Earth;
  - the teleport pad, plus beam-in and beam-out frames if Mega Man's existing `teleport-0` isn't
    enough;
  - the robot enemies and the weapon capsule;
  - the `megaman-dark` palette;
  - the boss shutter;
  - MML music: `mm-station` (stage) and `mm-boss`;
  - sfx: boss bar fill, beam-in and capsule.
- Update the CHANGELOG and docs/HEROES.md. No release unless the owner asks; the owner names the
  version.

### Verification
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Sims:
  - the hidden block reveals the pad, the pad beams up, every hero can reach it, and the way back
    lands at 3-1 162;
  - the captive spawns in campaign mode only;
  - the mini game: a scripted pass, standing still fails, Give up quits, `done` is called once,
    the boss is deterministic, the capsule gives a weapon, and No damage works;
  - map hints for the 3-1 node.
- Browser QA:
  - the 3-1 coin heaven, then the pad and beam-up, then the station, then talking to Mega Man, the
    stage, the boss and freedom;
  - Dev → Mini games → Mega Man;
  - the phone layout.

## Done: owner's v0.4.3 feedback (6 items) — shipped in v0.4.4

### Context
The owner played v0.4.3 and reported six things: two bugs, one tutorial gap, a difficulty problem
with Link's keep, and two feature asks. Owner decisions are folded in below.

### The six items
1. **The level-end time tally is far too slow.** We match the original's measured pace of about
   30 units/s, so 400 left takes about 13 s (`world.ts` ~1714, the `countdown` phase).
   - Owner choice: **fast and skippable**. Count about 4× faster, so a full 400 takes about 3 s:
     2 units a frame, with the tick sound kept at a sane rate.
   - JUMP or OK during the tally finishes it at once, with exactly the same points.
   - Applies to the flagpole tally and to any castle or axe tally that uses the same code.
   - Tests:
     - the points are identical whether it runs to the end or is skipped;
     - the new duration;
     - the skip works.
   - Update the comment that cites the original.
2. **Mario's tutorial never teaches running on touch.** The 1-0 run lesson
   (`src/game/tutorial/mario-1-0.ts`) says "[RUN:attack]". On touch the prompt should explain that
   pushing the d-pad farther to the side runs, and that the RUN button runs too. The text is
   input-aware, so keyboard and gamepad keep the current text. Apply the same wording in Luigi's
   practice lesson and anywhere else a lesson says RUN.
   - Test: in touch mode the prompt mentions the push-far run.
3. **Freed heroes celebrate on the map.**
   - Every so often the trophy jumps for joy: a hop of about 8 px using the hero's jump frame,
     with a small sparkle.
   - The first time the trophy appears after freeing, it does a short burst of hops.
   - It works for any hero, through `heroHint`/trophy drawing in `world-map.ts`.
   - With reduce flashing on, there is no sparkle; the hops stay.
4. **Luigi's slippery-stop lesson (2/3) is too hard to pass.** Lesson `slippery-stop`,
   `LUIGI_COAST_PX = 48`, `maxRunCoast` in `src/game/tutorial/lessons.ts`.
   - Reproduce it with real input on keyboard and touch (push far to run, then let go) in the
     one-screen room. Likely causes: the room is too short to reach run speed and still coast
     48 px; the touch d-pad passes through walk speed as the thumb comes back; or the coast is
     cut off by the dummy or the gap.
   - Fix whatever is actually wrong:
     - room or start position;
     - count the coast from the moment run speed was reached;
     - a threshold that is clearly Luigi but reachable, about 36 px or proportional;
     - clearer prompt wording.
   - Add a sim per input style, keyboard and touch-like, that passes on the first honest try.
5. **Link's keep is too hard; the sword feels wrong; more items.** Owner decisions:
   - **Sword fix:**
     - The stab hitbox covers the whole tile in front of Link and a little to the sides, so it
       catches monsters coming in at an angle.
     - A monster touched by the blade is knocked back and can't deal contact damage that frame.
     - A slightly longer active window.
     - Add a test for a monster approaching diagonally while Link holds a stab.
   - **Boomerang:** in a chest early on (after the bat room). It stuns monsters for a few seconds
     (the Keeper is immune or only briefly stunned), comes back to Link and grabs pickups it
     touches. Use it with the second button: SPECIAL, with the touch label BOOMERANG.
   - **Bombs:**
     - Found in a chest.
     - Set one down, and it blows up after a fuse, hurting monsters and opening **cracked walls**.
     - Uses the item button; switch items with the tool-select button, as the belt does elsewhere.
     - Bomb count shows in the HUD, and refills drop from monsters sometimes.
   - **Cracked wall → secret room with a SHIELD.** Owner's words: "bombs found in a chest can
     open a cracked wall which gives you a shield". Link starts **without** a shield. The shield
     found there blocks frontal rocks and spells, as today. Without it, rocks hit.
   - **Extra heart container:** found mid-dungeon, raising max hearts from 3 to 4 and filling them.
   - **Layout changes:**
     - Rework the 8 rooms (or add 1–2) for the item chests, the cracked wall and the secret room.
     - Update the minimap, the bot plan and the "all rooms reachable" test.
     - The full bot run must still pass. Add a "realistic human" difficulty sim if cheap.
   - **Art (Z2's style, original):**
     - the boomerang (4-frame spin);
     - the bomb with fuse and the explosion;
     - a cracked wall tile and a hole for it;
     - the shield pickup;
     - the heart container;
     - HUD icons for the item slot (a B-item box like Zelda's, beside the sword box).
   - **Sfx:** boomerang whirr, bomb fuse and blast. Reuse `secret` when the wall opens.
   - Fold in the old QA nits:
     - the Keeper banner covers the boss on entry;
     - a spell lingers after the Keeper dies.
6. **Mini games in dev mode.** Dev menu → **Mini games**: lists every registered mini game
   (`MINIGAMES`) and plays one round, then shows a result card (PASS, FAIL or QUIT) and returns
   to the list. It never touches a save file and works on the live site with dev mode on. It is
   reachable from the title's dev menu and from pause → Dev mode.

Also from the QA polish list:
- The Luigi trophy's outline against grass, which item 3 makes more visible.
- The training skip strip.
- Toad's OK hint going stale when switching input.

### Agents (parallel worktrees, reviewer per agent, QA, PR, no release unless asked)
- **F1 (small fixes):**
  - items 1, 2, 4 and 6;
  - the polish nits: the trophy outline, the skip strip, Toad's hint.

  About 35–45 min.
- **F2 (map):** item 3, trophy celebration. About 15–20 min. It could be folded into F1 if it is
  short of work.
- **K1 (Link keep code):** item 5 code. That covers the sword hitbox, knockback and invulnerability,
  the item system (B slot, select), the boomerang, bombs and explosion, cracked walls, chests, the
  shield pickup, the heart container, the room rework, the bot plan and tests. About 50–70 min.
- **K2 (Link keep art and sfx):** item 5 art and sfx, against a frame-name contract in the brief.
  About 25–35 min.

Wall time is about 1.5 h with reviews and QA, based on the last batch's actual times.

### Verification
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Sims:
  - tally duration, skip and points;
  - the touch run prompt;
  - Luigi's stop passes with a realistic input for both input styles;
  - the sword catches a diagonal approach;
  - each item works;
  - the cracked wall opens only to a bomb;
  - the shield blocks only once found;
  - the full keep bot passes;
  - the dev Mini games entry plays each game and never saves.
- Browser QA on desktop and phone:
  - finish a level with lots of time left, then skip the tally;
  - the 1-0 run prompt on touch;
  - Luigi's training on touch;
  - play the keep by hand to the shield and the Keeper;
  - the map trophy celebration;
  - Dev → Mini games.

## Status: PR #44 merged at 2:17 PM PDT (tutorials, training, Link's Shadow Keep, map hints, clouds)

Housekeeping next:
1. Cancel the "PR 44 check-in" trigger (trig_01XhhTcAjXoo712wGWjKo1bn).
2. Fast-forward `claude/admiring-galileo-quy3ri` to `origin/main` and push.
3. No release unless the owner asks. If they ask, open a "Release vX.Y.Z" PR as usual; the owner picks the number
   (last time they chose patch numbers over minor ones).

Polish backlog, all from QA and cosmetic:
- The Luigi trophy blends into the grass. Add a dark outline or ground shadow.
- The Keeper banner covers the boss as you enter.
- One spell lingers after the Keeper dies.
- The training skip strip draws over the floor.
- Toad's "OK (Z)" hint stays the same when the player switches from keyboard to touch mid-dialogue.
- Optional: show keyboard and gamepad hints only when the Key hints setting is on. This is an owner decision.

On hold: the Mega Man pilot (plan below), and the next heroes' placements and mini games.

## Done (12:05 PM PDT): tutorials batch + cloud fix + Link's Shadow Keep

- T1 dev All heroes toggle: merged (d448967).
- T2 Mario 1-0 tutorial stage: running.
- T3 practice rooms: done (010ef99); a reviewer is running.
- C1 coin-heaven floors become clouds in every sky area. This is the owner's bug report on 2-1-sky; it fixes the
  converter at the source and regenerates the maps. Running.
- Link (owner design):
  - A top-down Zelda 1-style dungeon, "Escape the Shadow Keep". You play as Link escaping the
    brainwashing, with puzzles and monsters.
  - Z1 builds the reusable top-down kit plus the dungeon (src/game/topdown/, src/game/minigames/link/).
  - Z2 does the art (src/content/sprites/dungeon.ts) and the music (dungeon, keeper, sfx).
  - The brief is scratchpad/zelda-brief.md.
- Z3, after C1 merges (it touches the same 2-1-sky map):
  - Past the end of the 2-1-sky cloud floor, coins in an up-arrow shape hint at a hidden vine block
    above one of the last cloud platforms on the right. Bump it to reveal a vine.
  - The vine climbs to a new Link-themed sky area, `2-1-sky2`: Zelda-ish floating ruins in the clouds, with
    `captive x y hero=link`.
  - The way out drops you exactly where the existing 2-1-sky pit does (`2-1 162 0`).
  - A reachability sim and landmark tests.

## Next batch: dev "All heroes" toggle + tutorials (Mario's tutorial stage, hero practice rooms)

### Context
The owner asked for two things:
1. In dev mode on the world map, a toggle that unlocks every hero, like the existing
   "Unlock all" for the map.
2. A short tutorial the first time each hero is played, counted per save file.
   - **Mario's** tutorial is its own stage. It sits at the spot where he stands when a new game starts
     (World 1's `start` node at (0,10), which today is not a stage). 1-1 only opens after it's done.
     It is the general game tutorial and starts the story.
   - **Every other hero** gets a short practice room before their first level on that file. Prompts
     teach each ability one at a time and advance when the player does it. It can be skipped.

The Mega Man pilot is on hold (plan below, unchanged).

### 1. Dev "All heroes" toggle
- `SaveFile.devAllHeroes?: boolean`, an optional field that defaults to off. Older saves load it as
  off, so no migration is needed. It works like `devUnlockAll` (`game.ts:107`, `:546`, `:639`;
  `world-map.ts:635-656`).
- The world map's dev menu gets an "All heroes: on/off" row next to "Unlock all".
  `Game.heroLocked(def)` returns false when `devMode && devAllHeroes`. The `freed` list is never
  written, so turning it off brings back the real roster.
- Character select drops the "N heroes to find" line while the toggle is on.
- Tests:
  - the toggle unlocks every hero in the next pick;
  - the save's `freed` is unchanged;
  - turning it off locks them again;
  - it has no effect with dev mode off.

### 2a. Mario's tutorial stage, "the first step"
- New level `1-0`, in `src/content/levels/world1/1-0.map`, with an overworld theme and a calm
  variant of the music.
  - World 1's map: the `start` node becomes a level node for `1-0`, or a new node next to it.
    1-1 opens only after 1-0 is cleared. Roads: start → 1-0 → 1-1.
  - The hero stands on 1-0 when a new file starts.
- The stage, about 4–5 screens, teaches in this order:
  1. walk;
  2. jump, with a low and a higher step;
  3. run and jump over a gap, with the fall pit made safe in the tutorial (respawn just before it);
  4. stomp a Goomba;
  5. bump a ? block for a coin, then a mushroom (grow);
  6. break a brick when big;
  7. enter a pipe;
  8. the flagpole.
  Each lesson shows an on-screen prompt with ability names (RUN, JUMP, …, never letters) and is
  announced. The prompt changes when the player does the thing. Lessons are data driven (shared
  with 2b).
- **Story:** the three intro cards move into the stage as story moments.
  - Toad (the existing `toad.ts`) greets Mario at the start: "Bowser has brainwashed the heroes of
    other worlds…".
  - A short scene near the end shows a silhouette hero leaving the screen with a Bowser shadow
    (simple, in engine). It teases the roster.
  - `story.ts`'s separate card sequence on a new file is replaced by the stage.
- **Rules:**
  - the timer is off;
  - no lives are lost, because a death respawns at the last lesson;
  - MENU → "Skip tutorial" clears it and goes to the map with 1-1 open;
  - dev mode and `?level=1-0` can play it any time.
- **Old saves:** 1-0 counts as cleared when the file already has any cleared level, so existing
  players aren't sent back. The check runs on load, without a migration: it is derived from
  `cleared`.

### 2b. Hero practice rooms (every hero except Mario)
- Per save file: `SaveFile.tutorials?: string[]`, the heroes whose practice is done. It is
  optional and older saves load it as empty.
  - A migrated or older file already "knows" its last-played heroes: mark `character`/`character2`
    as done on load, so a file that has been playing as Link isn't interrupted.
  - Campaign only.
- **When (owner: optional):** the first time a hero is picked in character select on a file (map
  pick or death pick), a small menu pops up: "<HERO> TRAINING? YES / NO".
  - YES runs the practice room, then the level starts as normal.
  - NO goes straight to the level.

  Either way the hero goes into `tutorials`, so the question is never asked again for them on that
  file. Freeing a hero doesn't trigger it; their first pick does. The practice can also be
  replayed any time from the pause menu ("Training", campaign only).
- **Room:** one generic single-screen room `src/content/levels/practice.map`, loaded `?raw` and kept out
  of the library. It has a floor, a step, a gap, a brick row, a ? block, a target dummy enemy that
  respawns, and an exit door.
- **Lessons:** `CharacterDef.lessons: Lesson[]` in each hero's `guide.ts` (or a new `lessons.ts`):
  `{ prompt: string; done(t: LessonTracker): boolean }`. A small `LessonTracker` watches the
  player and world each frame:
  - `jumped`, `jumpHeight`, `ranSpeed`;
  - `attacked`, plus projectiles spawned with kind;
  - `charged`, `slid`, `crouched`;
  - `usedTool`, `cycledTool`;
  - `hitDummy` by damage kind;
  - `wallClung`, `aimedUp`, `morphed`, `bombed`, and so on.

  Each hero lists the 3–5 things that make them different. For example:
  - **Luigi:** high jump, slippery stop.
  - **Link:** sword, down-thrust, shield blocks a shot, up-thrust, boomerang.
  - **Mega Man:** shoot, slide, and charge once he has the helmet (shown as "later").
  - **Samus:** shoot, aim up, morph ball, bomb.
  - **Simon:** whip, the committed jump, a sub-weapon.
  - **Ryu:** sword, wall cling and jump.
  - **Bill:** aim in eight directions, prone.

  The text reuses the hero's guide wording. Lessons that need power-ups the hero hasn't got give
  the kit temporarily inside the room only, and are restored afterwards.
- **Flow:**
  1. A title card: "<HERO> TRAINING".
  2. The prompts in sequence, each ticking off with a sound.
  3. "READY!", then the level starts.
  4. Skip: MENU → Skip training (marks it done).

  The run's state (lives/score/power) is snapshotted and restored, as `free-hero.ts` does.
- A test checks that every hero in `CHARACTERS` except Mario has 3+ lessons. Lessons use ability
  names only, and every lesson is completable: a scripted sim per hero finishes its room.

### Agents (parallel worktrees, reviewer per agent, QA, PR, no release unless asked)
- **T1 (small):** the dev All heroes toggle. About 15 min.
- **T2:** Mario's 1-0 stage:
  - the map, the world1 map node and roads;
  - the lesson prompts and the story moments (Toad, the silhouette tease);
  - the skip option, the old-save rule, replacing the story cards;
  - tests and the 1-1 bot still passing.

  About 35–45 min.
- **T3:** practice rooms:
  - the room map, `LessonTracker`, lessons for the 7 heroes, the flow and hook in the pick, `tutorials` on the save;
  - a sim per hero.

  About 40–50 min.
- T2 and T3 share the lesson prompt and tracker module. T3 owns it, and the brief fixes its API
  up front so T2 can use it in parallel.
- Estimates come from the last batch's actuals (framework 23 min, race 21 min, reviews 3–18 min).
  Wall time is about 1–1.5 h, with actuals reported against it.

### Verification
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Sims:
  - a new file starts on 1-0 and 1-1 is locked until 1-0 is cleared;
  - skip opens 1-1;
  - an old file with clears has 1-0 cleared;
  - a scripted Mario finishes 1-0;
  - each hero's practice room can be finished, runs once per file and is skippable;
  - the dev toggle cases above.
- Browser QA (desktop and phone):
  - new file → 1-0 → map → 1-1;
  - free Luigi → pick Luigi → practice room → 1-1;
  - the dev toggle on the map.

## On hold: Mega Man pilot, a mini game in his own game's style ("Wily Gate")

### Context
v0.4.2 shipped the unlock framework with Luigi's Mirror Race. The owner wants to see whether a
mini game can look and play like the hero's original NES game, and asked how to try the Mega Man
pilot. It doesn't exist yet, so this plan builds it. It also adds a way to launch any mini game
directly on the live site (Dev mode → Mini games), so the owner can try it without hunting for
the captive.

Defaults (the owner can change any of these after seeing it):
- **Game:** a short Wily-style stage, then a boss door, then a fight against brainwashed Mega Man
  with his own life bar.
- **Placement:** in the 2-1 bonus room, so the second hero is unlocked early.
- **Kit:** plain buster plus charge shot, like the start of an NES Mega Man game.

### What it looks and plays like (all original art and music, in Mega Man's style)
- **Player:** Mega Man, using his existing `MEGAMAN` CharacterDef (`src/game/characters/megaman/`).
  Start with `newGameState(MEGAMAN)` and the kit `{ helmet: 1 }`, so the charge shot works and there are no
  extra weapons. Full HP is 28, which the existing `hudStyle 'bar'` life bar shows (src/game/hud/hud.ts).
- **New `wily` theme** (a metal fortress):
  - `schema.ts` `THEMES`;
  - `tiles-wily` palette and the `ground@wily`, `hard@wily`, `brick@wily` and `wall@wily` frames in
    `src/content/sprites/tiles.ts`: riveted steel panels, pipes, a dark blue/teal palette;
  - `SKY.wily` (near black) in `src/game/world/tile-render.ts`;
  - defaults in `enemyPalette`/`decorPalette`;
  - update `themes.test.ts`.
  The theme stays out of the campaign; it only appears in the editor's theme list, which is harmless.
- **Stage:** `src/game/minigames/megaman/stage.map` (about 4 screens, loaded `?raw` like the Luigi
  course, so it is not in the level library). It has platforms and gaps, plus two kinds of small robot
  enemies, new `Enemy` subclasses under `src/game/minigames/megaman/`:
  - a hopping "Hopper" bot;
  - a "Turret" that fires pellets.
  They are registered through a small hook, so the mini game's own entity types don't bloat
  `World.makeEntity`; the hook takes an optional `extraEntities` factory on the World start or the
  level. Pickups drop through Mega Man's existing `drop` (health pellets).
- **Boss gate:** a two-tile shutter at the end of the stage.
  1. It opens when Mega Man touches it, then closes behind him.
  2. The camera locks to the 16-wide boss room.
  3. The boss's life bar fills segment by segment with a rising tone, NES style.
- **Boss:** "Dark Mega Man", brainwashed Mega Man drawn with his own sprites and a new dark palette
  (`megaman-dark`).
  - It has 28 HP, a second vertical bar at x=24, buster-only damage, and is stunned briefly after each hit.
  - Its pattern is a small state machine: run and jump toward the player, fire 3 shots, slide
    under jumps, and hold a charge shot when the player is far away. It is deterministic and seeded so tests can win.
  - Contact does 4 damage, shots 2, a charge shot 6.
- **Music:** two new original MML tracks in `songs.ts`, in Mega Man's style:
  - `mm-stage`, fast with an arpeggiated lead;
  - `mm-boss`, a short loop.

  Plus a "boss bar fill" sfx. Add them to the music test list.
- **Endings:**
  - Boss destroyed: the existing death-orb burst, a short victory jingle, then `done('pass')`.
  - Mega Man dies or falls in a pit: `done('fail')`.
  - Menu → Give up: `done('quit')`, which reuses the Luigi race's menu pattern.

  Touch labels come from the level labels (BUSTER etc. already exist for Mega Man).

### Wiring
- `MINIGAMES.megaman` in `src/game/minigames/index.ts`.
- Rules lines: `DEFEAT DARK MEGA MAN!` and `CHARGE THE BUSTER FOR BIG HITS.`
- Captive `captive x y hero=megaman` in `src/content/levels/world2/2-1-bonus.map`, on a spot every hero
  can reach, proven by a sim like Luigi's.
- **Dev mode → Mini games** (`src/game/scenes/dev.ts`): lists every mini game and plays one round, with a
  result card afterwards. It never touches a save file and works on the deployed site with dev mode on.
  It replaces the dev-server-only `?minigame=` hook, or keeps that hook as a shortcut.
- Story line for him in the dialogue (the existing free-hero flow, no changes).
- CHANGELOG `[Unreleased]`, `docs/HEROES.md` (the wily theme and the extra-entities hook).

### Agents (parallel worktrees, then the usual review loop, QA and PR)
- **M1, art and music:** the wily theme tiles and palette, the Hopper and Turret sprites,
  `megaman-dark`, the boss door, and the `mm-stage`/`mm-boss` tracks and sfx. All goes in content
  files, plus the theme registration.
- **M2, gameplay:** the stage map, the enemies, the boss AI and life bar, the boss gate and
  camera lock, the scene and its endings, the entity hook, and tests. It uses placeholder frames until M1 lands,
  with frame names agreed in the brief.
- **M3, wiring:** the dev menu Mini games entry, the 2-1 bonus captive and reachability sim, the
  registry, and the docs.
- A reviewer per agent, then a final browser QA covering:
  - Dev → Mini games → Mega Man, win and lose;
  - the campaign route to the 2-1 bonus.

### Estimate (from this batch's actuals: framework 23 min, race 21 min, reviews 3–18 min)
About 30–45 min of agent work per agent in parallel, plus reviews and QA. That is roughly 1–1.5 h
of wall time. I'll report actual times against this.

### Verification
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Sims:
  - a scripted Mega Man clears the stage and beats the boss, which passes;
  - standing still dies, which fails;
  - Give up quits;
  - `done` is called once;
  - the boss pattern is deterministic.
- Theme test, music test, and the 2-1 bonus reachability sim.
- Playwright screenshots: the stage, the boss bar filling, the fight, the victory, and the dev menu entry.

## Status: Release v0.4.2 published and live (deploy b25ac1f)

The owner chose 0.4.2, not 0.5.0, even though the save format changed. Next steps:
1. The owner publishes tag `v0.4.2` (target main).
2. I watch the release.yml run for v0.4.2 and confirm it succeeds.
3. I check the GitHub Release assets, and that the Pages deploy sha differs from v0.4.1's.
4. I sync `claude/admiring-galileo-quy3ri` to `origin/main`.
5. I cancel the pending "PR 43 check-in" trigger (trig_0165bhQMzeFFNPDGK6DZcBWg).

## Previous: "Free the heroes" first slice is in PR #42 (merged)

[PR #42](https://github.com/jelloshooter848/SMBC/pull/42) is at head 37ffa77. It contains:
- the unlock framework: save v3, silhouettes, captive, the dialogue/retry/freed flow, and the story intro;
- Luigi on the ledge in the 1-1 bonus room;
- the Mirror Race.

Each piece passed review, plus a QA pass in the browser.

Next steps, all waiting on the owner:
1. They merge #42.
2. The owner says this is NOT 0.5.0 yet: no release after #42. 0.5.0 waits for more of the
   heroes feature; release only when the owner asks. (Former step:) "Release v0.5.0" PR. It's a minor release because the save format changed.
   The PR bumps package.json from 0.4.1 to 0.5.0, gives the CHANGELOG section a date and compare links, and must pass
   `pnpm release:check --tag v0.5.0`.
3. They publish the tag, then I watch release.yml.

After that come the next heroes. Each needs the owner to choose a placement and a mini game. A full-style
mini game pilot (Mega Man) is optional, per the section below.

## Next feature (proposed 0.5.0): unlock heroes through play, "Free the heroes" story

### Context
Today every hero can be picked from the start. The owner wants:
- a new save to start with **Mario only**, with the other heroes shown as silhouettes in character
  select (teased but not selectable);
- each hero to be found somewhere in the campaign, brainwashed. Talking to them starts a
  **mini game themed on that hero's own game**. Passing it frees them, they join the roster,
  and the mini game can be retried any number of times;
- the first to be **Luigi, in the 1-1 bonus room**, on a platform at the top right.

The owner's choices:
- unlocks are **per save file**;
- locks apply **only in the campaign** (custom levels, shared links, `?level=` and dev mode keep everyone);
- **existing saves are locked too**: they keep Mario plus the hero they were last using.

### Feasibility (from the code as it stands)
Moderate, and most of it fits existing pieces:
- **Roster lock:** `CharacterSelectScene` (src/game/scenes/character-select.ts) already gets a
  hero list from `CHARACTERS` (src/game/characters/registry.ts). Add a `locked` predicate and draw
  locked heroes with a black palette swap. The palette transforms already used for
  colour-blind and high-contrast modes (src/content/sprites/index.ts) give silhouettes almost for free.
  Locked heroes are skipped by the cursor, with a "???" label.
- **Save state:** an optional `freed: string[]` on `SaveFile` (src/game/save/save-files.ts). A v2→v3
  migration sets `['mario', <last character(s)>]` for old files, per the owner's choice. That is
  a format change, so a minor release.
- **The hero in the level:** a new entity `captive` (`entity captive x y hero=luigi` in the .map
  `[entities]`, as `princess`/`peach` work today). It draws the hero's sprite with a
  "brainwashed" palette and plays an idle animation.
  - Approaching it shows a prompt (TALK / the up key, ability-named).
  - Interacting pauses the level, then:
    1. a dialogue card (`CardScene` in src/game/scenes/message.ts already does paged text with the
       input rules);
    2. the mini game scene;
    3. on a pass, a "freed" card, the hero added to `freed`, saved;
    4. back in the level, where the captive is gone.
  - On a fail: retry or leave, in any number of rounds.
  - Already freed: the captive no longer spawns.
- **Mini games:** a small `MiniGame` scene contract: `start`, `update(input)`, `render(r)`, then the result
  `'pass' | 'fail' | 'quit'`. Each runs on the existing engine (renderer, sprite sheets, MML music,
  input, touch labels) and has its own short ruleset. Each one is a self-contained, easily tested
  piece of work. Heroes and themes (ideas to confirm one at a time):
  - Luigi: an SMB-style quick challenge;
  - Link: a sword-parry rhythm;
  - Mega Man: dodge a boss pattern;
  - Samus: a morph-ball maze;
  - Simon: a whip-timing candle run;
  - Ryu: wall-jump climbing;
  - Bill: a shooting gallery.
- **Built to be replaced:** each mini game lives in its own folder (`src/game/minigames/<hero>/`)
  behind the `MiniGame` contract, with its own scene, rules, art and music. The unlock flow only
  sees `pass | fail | quit`. A later full-style version (below) swaps the folder's contents, and
  the captive, dialogue, save and roster code stay untouched.

### Later: mini games that look and play like the hero's own game
**Feasible.** The deciding fact is that every one of these heroes comes from an NES game. Our
engine already draws NES-style graphics: 256×240, palettes and pixel art kept as text, and MML
music on a pulse/triangle/noise synth. So a Zelda or Mega Man look is a matter of art and rules,
not a new engine. The engine layer is shared (loop, scenes, renderer, sprite sheets, palettes,
input, touch labels, audio). Only the SMB-specific game layer (World, the side-view player
physics, the right-only camera) would be replaced per style.

By original game, from easiest to hardest:
- **Side-scrollers** (Mega Man, Castlevania, Ninja Gaiden, Contra): these reuse the existing World,
  tile collision and the hero's own `CharacterDef`, which already plays like its game. They need a
  new tileset theme, a few enemies, a boss with its own life bar, a HUD in that game's layout and a
  music track in that style. Mega Man would get a Wily-style stage, the boss gate and
  the two-bar HUD.
- **Metroid:** the same, plus vertical rooms. The camera follows x only today, so it needs y-follow
  or flip-screen rooms (a small, contained camera change).
- **Zelda, top-down:** the most new code, in a small reusable **top-down kit**:
  - 4-way movement with collision on both axes;
  - flip-screen room transitions;
  - 4-direction sprites (our Link is the side-view Zelda II Link, so he needs new top-down
    frames);
  - an overhead tileset (trees, rocks, water, a dungeon);
  - the Zelda-style HUD (hearts, item boxes, a minimap).
  After the kit exists, more top-down games are cheap.

**Content rule (unchanged):** all art and music stay original, in each game's *style*, drawn and
composed for us. That means its perspective, palette limits, HUD layout and sound. No copied
sprites, music or level layouts. The local asset-pack override keeps working for anyone with
their own copies.

**Cost:** art is the bulk of it, not code.
- A full-style side-scroller (tileset, about 4 enemies, a boss, a HUD and a track): about 1–2 h of
  agent work with reviews.
- The first top-down game: about 2–3 h, because it builds the kit.
- These are first guesses. I'll compare them with the actual time of the first one and correct
  them from there.

**Recommended order:**
1. Ship the unlock framework with simple engine-native mini games.
2. Build one full-style mini game as the pilot. Mega Man is cheapest, since he already plays like
   Mega Man.
3. Upgrade the others one batch at a time, saving Zelda (the top-down kit) for when the pilot
   shows what the art costs.

- **Story:** text only, through cards, at the first-time intro on a new file and at each meeting.
  No engine changes are needed.
- **Hooks already in place:** the map's secret-exit and node machinery, `secrets` on the save, the
  campaign/non-campaign split in `game.ts`, and the touch label and ability-named text rules.

**Estimated size:** the framework (lock, silhouettes, save v3, captive entity, dialogue, MiniGame
contract, unlock flow, tests) is about one world-map-sized batch, around 1–1.5 h of agent work with
reviews. Each mini game is about 20–40 min of agent work including its art and music.

### Proposed first slice (one batch, when the owner says go)
1. The framework above, plus Luigi in `1-1-bonus` (the top-right platform, adding one
   platform tile if needed), plus Luigi's mini game, plus the intro story card.
2. The other heroes stay silhouettes, with their captives placed in later batches. Each needs an owner
   decision on where it is placed and what its mini game is.

## Status: mushroom bump fix merged (#41, main 3277f80); release held for the next batch

The owner chose to hold v0.4.2. The fix stays in `main` under CHANGELOG `[Unreleased]`, and nothing
else is pending. When the next batch's work lands and the owner asks for a release, follow the usual steps:
a "Release vX.Y.Z" PR (bump package.json, date the changelog, add compare links, run
`pnpm release:check --tag`), then the owner publishes the tag, and I watch the release workflow.

## Previous step: mushrooms don't hop when the block under them is bumped (0.4.2 fix)

### Context
The owner reports that a mushroom sitting on a block doesn't react when the player bumps that
block from below. In the original it pops up. Our `World.strikeBlock` (`src/game/world/world.ts`
~986-1003) already finds Enemies and PowerUps standing on the bumped tile and sets
`b.vy = -0x03000` on a PowerUp. Something cancels it: most likely `PowerUp.update`
(`src/game/entities/objects/powerup.ts`) resetting vy or snapping it to the ground, a mismatch
between hitbox and tile top in the ±2 px check, or the bump not reaching that code path
(head bumps vs `strikeBlock`, and broken bricks).

### Original behaviour (verified in source)
`com/smbc/pickups/Mushroom.as gBounceHit(g)`:
- `vy = -BOUNCE_AMT` (350 Flash px/s, 2.92 px/frame);
- `gravity = BOUNCE_GRAVITY` (1500, 0.208 px/frame²) until it lands, then `FALL_GRAVITY` again (5000);
- `onGround = false`;
- `if (nx < g.hMidX) vx = -vx`: a mushroom left of the block's middle flips its direction.

`Brick.hitObjectsAbove()` runs on every bounce *and* when a brick breaks, so both cases hop.
This covers red, green (1-up) and poison mushrooms. `Coin.gBounceHit` exists too: check what it
does, and that a coin on a bumped block behaves the same in ours.

### Plan (one fix agent, then reviewer, loop until ACCEPT)
1. Write a failing sim first: a mushroom walking on a ? block or brick, with Mario bumping from below. Expect
   it to rise about 20 px (2.92²/(2·0.208)) and land again, with its direction flipped when left of the block's middle.
   Cover a breaking brick, the 1-up and the poison mushroom, and a head bump from every hero that can
   bump (Mario, Luigi; Link's up-thrust `strikeBlock`).
2. Find why today's `vy = -0x3000` is lost, then port `gBounceHit`: the bounce velocity and bounce gravity
   until landing, and the direction flip. Apply it to every PowerUp kind that walks (mushrooms, 1-up, poison).
   The star keeps its own hop, and the fire flower doesn't move (check the original's Flower/Star for
   gBounceHit; neither has one).
3. Coins on a bumped block, as `Coin.gBounceHit`: port it if ours differs.
4. Append a report file `bug-reports/2026-10-06-mushroom-not-bumped-by-block-below.md` from
   the template, with a Status line. Changelog `[Unreleased]` → Fixed.
5. Checks: lint, typecheck, test, build. A reviewer checks the constants against the source and that the tests
   catch mistakes. Then merge, open a PR, and once merged the Release v0.4.2 PR.

### Verification
New sims fail before the fix and pass after; the full suite passes; a quick headless capture or Playwright
screenshot sequence of a mushroom hopping off a bumped block in 1-1 (column 21–22 area).

## Previous step: Release v0.4.1 (PR #39 merged)

1. Fast-forward `claude/admiring-galileo-quy3ri` to `origin/main`.
2. Bump `package.json` 0.4.0 → 0.4.1. In CHANGELOG, change `## [Unreleased]` to
   `## [0.4.1] - <today>` and add the compare links (`[Unreleased]` → v0.4.1...HEAD, and
   `[0.4.1]` → v0.4.0...v0.4.1).
3. Run `pnpm release:check --tag v0.4.1` and `pnpm lint`, then commit "Release v0.4.1" with the
   trailers, push, and open the "Release v0.4.1" PR.
4. Watch the release workflow (Monitor on release.yml runs for `v0.4.1`). After the owner merges
   and publishes tag `v0.4.1` (target main), confirm the release assets and that the deploy commit
   differs from v0.4.0's, then sync the branch.

## Previous step: 0.4.1 fixes to the Warp Zone and Lost Levels maps

### Context

The owner played v0.4.0 on a phone and reported five issues with the new map features. They want
them fixed for a 0.4.1 release, using the usual loop: fix agents, then a reviewer per agent, sent
back until the review passes, then a final review, browser QA, PR, and release PR.

### The five fixes
1. **Unlock all must reveal the warp spot.** Today hidden secret nodes (World 1's warp spot, key
   `bonus-1`) stay hidden under dev Unlock all, so the 1-2 secret had to be found by hand. Under
   `unlockAll`, nodes hidden only by an unlock key must show, along with their roads. Pads with
   `requires: 'never'` stay locked. As before, Unlock all never writes progress or secrets.
   Rules live in `src/game/map/rules.ts` (`isOpen`, `isWarpOpen`, `openPaths`; secret visibility checks `unlock`
   against `progress.secrets`).
2. **Only Lost World 1 links to the hub.** Remove the hub warp nodes and their roads from
   `src/content/worldmap/lost/world2..9.ts` and `worldB..D.ts`. Keep `ll-1`'s, which is where the hub's
   Lost Levels pad lands.
3. **The World A portal links back to World 8.** Lost A's portal (`worldA.ts`) becomes a warp to
   `ll-8`, arriving at `warp-ll-10`, the World 8 pad that leads to A. It is labelled e.g. "LOST WORLD 8".
   World 8's pad is unchanged. B, C and D have no portal. The page tests must check that only ll-1
   has a `to: 'hub'` warp, and that ll-10's portal targets ll-8.
4. **The road to the warp spot starts at 1-2,** not 1-1. In `src/content/worldmap/world1.ts`, the road
   `1-1 → bonus-1` becomes `1-2 → bonus-1`. 1-2 is at (6,4), the spot at (6,11). Route it on walkable
   tiles without overlapping or crossing existing roads, e.g. left along row 4 and down column 5.
   Move the spot if needed. Reveals then draw from 1-2. Saves with the old road id
   (`smb-1:1-1>bonus-1` in `pendingReveal`/`lastNode`) must load cleanly: map the old id or drop it.
   Revealed roads come from `secrets` and `cleared`, so nothing is lost.
5. **Secret-exit glow, Super Mario World style.** Every level with more than one way out gets a
   different node colour, always shown (owner's choice), even after the secret is found:
   - 1-2: the warp spot;
   - 4-2: its warp zones;
   - every Lost Levels level with a warp zone, found from the level data (warp zones or
     cross-world pipes).
   Add a node flag, e.g. `secretExit: true`, set by a data pass over the level index (`src/content/levels`) or
   listed per page. Draw open and cleared nodes in the secret colour, e.g. red where normal is yellow, as
   SMW does. That needs an icon variant in `src/content/sprites/map-icons.ts`, and the colours must be
   accessible: a shape or outline difference too, not colour alone. The announcer says
   "secret exit". Include it in the legend if the guide or map menu lists node types.

### Agents (worktrees off `claude/admiring-galileo-quy3ri` at `main` e747efd)
- **F1 map rules and World 1 road:** items 1 and 4 (`rules.ts`, `world1.ts`, save load of the
  old road id, tests).
- **F2 Lost Levels portals:** items 2 and 3 (`lost/*.ts`, lost-pages tests, campaign sims that
  used ll-N hub warps).
- **F3 secret-exit glow:** item 5 (the node flag and data pass, icons, `world-map.ts` drawing,
  announcer, tests). After F1 merges it rebases onto the new 1-2 road.
- A reviewer for each agent's report; fixes go back to the agent until accepted; I merge.
- Final review over the merged diff, browser QA (desktop plus a phone, including Unlock all), CHANGELOG
  `[Unreleased]` → Fixed and Changed, the PR, and after merge the "Release v0.4.1" PR.

### Verification
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Sims:
  - Unlock all shows the warp spot and road, and saves nothing;
  - the 1-2 secret draws the road from 1-2;
  - an old save with the 1-1 road id loads;
  - only ll-1 has a hub warp;
  - the A portal returns to ll-8's pad;
  - secret-exit nodes are flagged for 1-2, 4-2 and the expected Lost Levels levels.
- Playwright screenshots on a phone of the World 1 map under Unlock all (the warp spot and the 1-2 road
  visible, 1-2 and 4-2 glowing) and of Lost 8 and Lost A.

## Previous feature (0.4.0): Warp Zone hub + Lost Levels campaign

### Owner decisions
- In the campaign, the 1-2 warp zone no longer skips worlds. The room shows a **single** pipe
  (no world numbers); taking it clears 1-2 and returns to the World 1 map, where a new path
  draws in to a **warp spot** (reuse World 1's hidden bonus slot, key `bonus-1`, at (6,11)).
- The warp spot leads to a new **Warp Zone hub** map page (its own look, built with existing map
  tiles plus a new warp-pad icon). Pads at first:
  - **Lost Levels**: locked until SMB 8-4 is beaten (`gameCleared`). Standing on it locked shows
    "LOST LEVELS - BEAT 8-4 TO UNLOCK".
  - **Mystery pads**: "???", locked, for future content.
  - **Return to World 1**.
- **Lost Levels maps**: 13 new pages (worlds 1-8, 9, A-D) with new layouts, reusing the existing
  themes and art. Same rules as SMB: levels open in order, and a castle opens the next world.
  9 and A-D follow the existing NES unlock rules.
- **Keep as they are, noted as future secret hooks:**
  - SMB 4-2's warp zones (to 5, and up the vine to 6/7/8) still skip worlds.
  - The Lost Levels warp zones, including backward warps, behave as on the NES, with the warpless
    World 9 rule.
- Done separately: Return to map on the death select (3b8dccb, on the branch).

### Engineering notes (from the map survey)
- **The map model is keyed by a numeric world 1-8.** That covers `WorldMapPage.world`,
  `MapProgress.worlds/position`, reveal ids, `WorldExit.toWorld`, `mapPage()`, `MAP_WORLDS = 8`, and
  save validation clamping to 1..8. It needs string page ids ('smb-1'…'smb-8', 'hub', 'll-1'…'ll-13')
  with a display label, plus a save migration (v1 → v2: numbers → 'smb-N'). That makes it a
  minor release.
- **New node kind `warp`** with a target page and an optional lock (`requires: 'gameCleared' |
  'secret:<key>' | 'never'`) and a hint text. Jumping on it slides or fades to the target page.
  WorldMapScene draws a visible hint line, which is new: today node text goes only to the
  announcer.
- **`secrets` is saved but nothing sets it today.** Add a campaign hook in LevelScene when the
  1-2 warp-zone pipe is taken: `secrets += 'bonus-1'`, clear 1-2, then `addReveal` for the path.
  The warp zone in `1-2.map` (`warp` zone, 3 pipes) needs a campaign variant with one pipe.
  Non-campaign play (dev select, ?level=) keeps the classic three pipes.
- **The Lost Levels campaign** needs:
  - `level.ts` pipe handling to stop treating a cross-world `ll-` pipe as an SMB campaign warp,
    and map its warps to `ll-N` pages;
  - `levelCleared`/`clearLevel` with `ll-` nodes;
  - `showLostEnding` to know about the campaign (8-4 → card → 9 map if warpless, A-D after 8
    beaten).
- **Tests:** `pages.test.ts` assumes exactly 8 pages; extend it for the hub and the 13 Lost
  Levels pages. Add campaign sims for 1-2 warp → path → hub → locked pad hint → beat 8-4 (set
  `gameCleared`) → pad opens → LL 1-1.

## Status: d-pad fix done in PR #35 (merged)

Next, once the owner merges #35 (and only if they want it live now):
1. Fast-forward `claude/admiring-galileo-quy3ri` to `origin/main`.
2. Open a "Release v0.3.1" PR that bumps `package.json` 0.3.0 → 0.3.1, renames `[Unreleased]` to
   `[0.3.1] - <date>` and adds the compare links. Check it with `pnpm release:check --tag v0.3.1` and `pnpm lint`.
3. The owner merges it and publishes tag `v0.3.1` (target main). I watch the release workflow
   run and confirm the deploy commit differs from v0.3.0's.

Otherwise the fix waits in `main` for the next batch.

## Previous step: touch d-pad "down" needs a much longer push than other directions

### Context

Reported on v0.3.0: pressing down on the touch d-pad requires pushing much further from the
centre than any other direction. Cause, in `dpadDirs` (`src/engine/input/touch-logic.ts:46-57`):
every direction turns on past the 0.2 dead zone (`DPAD_DEAD`), but down also needs
`r >= DPAD_DOWN_MIN_R` (0.55 of the radius). That gate was added so a thumb sagging downward
while running right/left doesn't crouch. Applied to straight-down pushes too, it makes down feel
broken. Both the fixed pad and the floating stick use `dpadDirs`, so the fix covers both.

### Who does it

One fix subagent works in a worktree off the branch head. It makes the change and tests below,
checks the Playwright touch drag, and commits; it never commits `node_modules`. I review the
diff, merge it into `claude/admiring-galileo-quy3ri`, re-run the checks, push and open the PR.

### Change

- `dpadDirs`: a **straight-down** push (outside the left/right band, `elev > DPAD_HORIZONTAL_MAX_DEG`,
  i.e. within ±30° of vertical) holds down from the dead zone, exactly like up.
  Keep the radius gate only for the **down-diagonals** (45°–60°), where a running thumb sags.
  ```ts
  const down = dy > 0 && elev >= DPAD_DOWN_MIN_DEG && (!horizontal || r >= DPAD_DOWN_MIN_R);
  ```
  Update the constant's doc comment ("down-diagonals also need a deliberate push").
- Tests in `src/engine/input/touch-logic.test.ts` ("down needs a deliberate push…", lines 64-71):
  - straight down at `DPAD_DEAD + 0.05` → `down`, the same threshold as straight up;
  - down at 300°/240° (30° off vertical) at 0.3 → `down`;
  - keep: a down-right sag at -50° and 0.5 stays `right`, 0.7 gives `right+down`, and -30° at 1 gives `right+run`;
  - add a matching up check so the two are symmetric: up and down both engage at the same radius straight on.
  The 8-direction coverage test and the edge-clamp test stay as is.
- CHANGELOG `[Unreleased]` → `### Fixed`: "Touch d-pad: down engages as easily as the other
  directions (only the down-diagonals still need a firmer push, so running doesn't crouch)."

### Verification

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. The new straight-down test must fail
  on the current code (r 0.25 gives `none` today).
- A quick Playwright touch check on 844×390: a short downward drag (about 30% of the radius)
  makes Mario crouch, and a sagging run to the right does not crouch.
- Commit and push on `claude/admiring-galileo-quy3ri`, then open a small PR to `main`. It is a
  fix, so it can ship as a 0.3.1 patch when the owner wants.

## Previous step: gauntlet loop on the 65 bug reports from PR #27 → release 0.2.2

### Context

PR #27 added 65 reviewed reports (`bug-reports/2026-10-05-*.md`, 3 blocking, 59 wrong behaviour,
3 cosmetic) comparing every SMB and Lost Levels level with the original Crossover 3.1.21. The
owner wants a gauntlet loop: as many parallel fix agents as practical, every fix reviewed and sent
back until solved, then a final review and a **0.2.2** release (fixes only → patch, per
docs/RELEASING.md). Owner decisions already recorded in the reports' Notes (Lost Levels NES
progression, 8-4 quest-over + credits, warps clear the old checkpoint, campaign warps go through
the map) are followed as written.

### Setup

Fast-forward `claude/admiring-galileo-quy3ri` to `origin/main` (release v0.2.1 merge); that commit
is BASE for every agent. Reuse `scratchpad/bugfix-brief.md` (reproduce with a failing test first,
verify against the original ActionScript, append `Status: fixed — …` / `Status: not a bug — …` to
each report, small additive edits, no browser port 4173, checks must pass, commit with trailers),
plus: **don't edit CHANGELOG.md** (I write the 0.2.2 section from the Status lines) and **only the
converter agent regenerates maps**.

### Fix agents (8, in parallel, worktrees)

- **A Converter & level data**: converter-ignores-shiftup-shiftright (half-tile offsets, lifts
  centred), ll-9-1-clock-block-missing, ll-5-3-checkpoint-respawn-falls-into-pit; regenerates all
  SMB1 + Lost Levels maps and updates landmark tests.
- **B Lifts**: lifts-sideways…, lifts-vertical-swinging…, lifts-carry-player-through-walls,
  1-2-vertical-lifts-too-fast, 2-4-castle-lift-wrap-height, 3-3-balance-lift-motion,
  3-3-balance-lift-no-1000-points, 3-3-falling-lift-keeps-falling, ll-12-4-lava-lift-never-reaches-
  drop-shaft (re-verified after A merges, since it depends on lift anchoring).
- **C Castles & Bowser**: the eight bowser-* reports, lava-kills-on-touch-with-death-hop,
  firebar-rotation-direction-reversed, firebar-rotation-too-slow, 3-4-podoboo-jumps-too-high.
- **D Cannons, Lakitu, Hammer Bros**: blaster-fire-rate-too-slow, blaster-no-two-bullet-limit,
  bullet-bill-too-slow, flying-bullet-bills-wrong-pattern, the four lakitu-* reports,
  4-1-lakitu-appears-before-start-column, the four hammer-bro-* reports.
- **E Water**: water-seabed-walk-speed, water-swim-stroke-and-sinking,
  water-swimming-cheep-setup-and-motion, 2-3-flying-cheep-direction-speed,
  2-3-flying-cheep-leap-too-low, blooper-sink-speed-and-rise-rule, blooper-out-of-water-not-stompable.
- **F Koopas, piranhas, springboards**: 3-3-red-paratroopa-flight,
  8-1-green-paratroopa-hops-low-and-short, paratroopa-sideways-sway-too-wide-no-bob,
  piranha-first-rise-delay-and-speed, enemies-knocked-out-fall-upright,
  springboard-not-solid-and-one-tile-tall, springboard-bounce-too-high.
- **G1 Pipes, vines, warps, respawn**: 1-2-warp-keeps-1-2-checkpoint, 1-2-warp-skips-world-card-
  and-hud, 1-2-intro-no-autowalk-timer-runs, 4-2-vine-area-no-auto-climb,
  vine-left-right-does-not-step-off, pipe-exit-rises-above-pipe, pipe-travel-too-fast,
  enemies-not-cleared-on-respawn-or-pipe-exit, ll-9-1-death-skips-start-room.
- **G2 Level end, ending, progression, player**: flag-touch-does-not-clear-enemies,
  flagpole-no-fireworks, 8-4-ending-no-quest-over-or-credits,
  lost-levels-progression-departs-from-nes-rules, player-run-falls-into-one-tile-gaps.

### Loop

For each agent's report: a **reviewer agent** checks the diff against the cited original source and
the reports, runs the checks, and returns ACCEPT or numbered problems; problems go back to the fix
agent (SendMessage) until ACCEPT; then I merge into the branch (resolving overlap in `world.ts` etc.,
or asking the later agent to merge the branch and resolve), re-run the full checks after each merge,
push. After A merges, tell B (and any agent whose tests read maps) to merge and re-verify.

### Final review and release

A final **review agent** over the whole merged diff (regressions across characters, co-op, campaign
and map, Lost Levels) and a **QA agent** browser pass (a handful of affected levels plus the
campaign loop). Every report must end with a Status line. Then I write CHANGELOG `[Unreleased]` →
`### Fixed` (one line per fix group), open one PR with a report → outcome table, and after the
owner merges, a **Release v0.2.2** PR; the owner publishes tag `v0.2.2` (target main).

## Previous step: a release and versioning standard

### Context

Every merge to `main` redeploys GitHub Pages (`.github/workflows/deploy.yml`), `package.json`
says 0.1.0 forever, there are no tags, releases or changelog; the title shows
`V0.1.0-<sha>` (`vite.config.ts` `__APP_VERSION__`). Testers file reports against builds,
so they need named versions. Owner's decisions: **the live site updates only on a release**
(version tag); **history starts with v0.1.0 = main before the world map (#24)**, and the world
map ships as **v0.2.0**.

### The standard (docs/RELEASING.md, linked from README)

- **SemVer, pre-1.0 rules:** `0.MINOR.0` for features or content (worlds, heroes, modes, the
  map) and for any save-file format change (must ship a migration); `0.x.PATCH` for fixes only.
  `1.0.0` when the owner calls the game complete. Optional `-rc.N` pre-releases for testers.
- **Changelog** `CHANGELOG.md` (Keep a Changelog): every PR adds a line under `## [Unreleased]`
  (Added / Changed / Fixed / Removed); a release renames it to `## [x.y.z] - YYYY-MM-DD`.
  PR template (`.github/pull_request_template.md`) carries the checklist item.
- **Release steps:** a "Release vX.Y.Z" PR bumps `package.json` and moves Unreleased into the
  new section → merge → push tag `vX.Y.Z` on that commit (or create the release in the GitHub UI)
  → the release workflow verifies, builds, deploys and publishes the GitHub Release.
- **Save and settings compatibility:** a release must load every older save
  (`SAVE_MIGRATIONS` in `src/game/save/save-files.ts`), never silently drop data.
- **Version shown in game:** a release build shows `V0.2.0`; any other build shows
  `V0.2.0-DEV.<sha>`. Bug reports quote it (bug-reports/README.md updated).

### Implementation

- `vite.config.ts`: version = `pkg.version` when `git describe --exact-match --tags` is
  `v<pkg.version>` (or `RELEASE_TAG` env equals it), else `<version>-dev.<sha>`.
- `tools/release/check.mjs` (`pnpm release:check`): package.json version is valid SemVer;
  CHANGELOG has `## [Unreleased]` and, if `--tag vX.Y.Z` is given, a `## [X.Y.Z] - date`
  section whose text it prints (for the release notes); tag equals `v` + package version.
  Unit-tested on fixture changelogs. CI (`ci.yml`) runs it on every PR (format only).
- `.github/workflows/release.yml` replaces `deploy.yml`: on `push: tags: ['v*']` and
  `workflow_dispatch` (input `tag`, to publish or redeploy an existing tag): checkout the tag,
  `pnpm install`, `release:check --tag`, lint/typecheck/test, build with `RELEASE_TAG`, deploy
  Pages, create the GitHub Release (notes = changelog section, `-rc` tags marked pre-release,
  attach a zipped `dist`). `main` pushes no longer deploy.
- `CHANGELOG.md`: `[0.1.0] - 2026-10-05` summarising everything up to #23 (World 1-8, heroes,
  Lost Levels, editor, co-op, bug fixes); `[Unreleased]` with the world map (#24) and this
  standard. `package.json` stays 0.1.0 in this PR.
- After merge (with the owner's go-ahead, since tags are public): tag `v0.1.0` on the #23 merge
  commit and publish it via `workflow_dispatch`; then a "Release v0.2.0" PR → merge → tag
  `v0.2.0` → live site updates.

### Verification

`pnpm lint && pnpm typecheck && pnpm test && pnpm build`; `release:check` tests; `actionlint`
-style review of the workflow YAML (or a dry run of its shell steps locally); build once with
`RELEASE_TAG=v0.1.0` and without, and check the title string in the bundle.

## Previous step: Super Mario World-style world map + save files (SMB1 worlds 1-8)

### Context

Today the game goes title → character select → 1-1 and then level to level; nothing is saved
except the Lost Levels unlock flags (`showEnding`, the only `saveProgress` call). The user wants a
Super Mario World-style map: the game starts on a world map, each SMB1 world has its own lively,
themed page, levels unlock in order (bonus-level slots reserved for secret unlocks later), and
picking a level goes to character select. Decisions from the user:
- clearing a level **returns to the map** (next node opens with a path animation);
- **3 save files, full state** (map progress plus lives, score, coins, hero(es) and power);
- a warp pipe **unlocks only its target world** (skipped worlds stay closed);
- game over → CONTINUE? YES returns **to the map with progress kept** (fresh lives); NO → title.
Lost Levels stay dev-select only. Dev mode, `?level=`, custom and shared levels bypass the map
and never touch save files.

### Data model (shared contract, written first so agents can work in parallel)

`src/game/map/types.ts`
- `MapNode { id; kind: 'start' | 'level' | 'castle' | 'bonus'; level?: string /* main id, e.g. '1-2' */;
  x; y /* tile on a 16×15 grid */; unlock?: string /* bonus only: secret key */ }`
- `MapPath { from; to; points: [x, y][] /* tile path incl. ends */ }`
- `WorldExit { from: nodeId; toWorld; points; side: 'right' | 'left' | 'top' }`
- `WorldMapPage { world; title /* e.g. 'GRASS LAND' */; theme: MapTheme; music; tiles: string[15] /*
  16 chars, map-tile legend */; nodes; paths; exits; actors: { type; x; y; props? }[] }`

`src/content/worldmap/world1.ts … world8.ts` (one page each) + `index.ts` (`MAP_PAGES`).
Each page has a start node, the four level nodes (the X-4 node is a `castle`), the paths between
them, an exit path to the next world (World 8's castle leads to the ending), and **one hidden
`bonus` node with an unlock key** (no bonus levels yet: the node stays hidden and its paths
undrawn until `save.secrets` contains the key).

`src/game/map/rules.ts` (pure, unit-tested):
- `isOpen(save, page, nodeId)`: start of World 1, or the end of a path whose `from` is cleared,
  or a world's start when the world is in `save.worlds`; bonus nodes need their key.
- `clearLevel(save, levelId)`: records the main level id (sub-areas map to `parent`), opens the
  next node; clearing a castle opens the world exit and adds the next world to `save.worlds`.
- `warpTo(save, world)`: adds that world (its start and first level open), nothing in between.
- `entryLevel(levelId)`: the id to load (`X-2-intro` when an intro exists).

### Save files

`src/engine/save/save-files.ts`: `SaveFile { v: 1; slot; created; updated; character;
character2 | null; lives; score; coins; powerState; hp; kit; powerState2; hp2; kit2;
cleared: string[]; worlds: number[]; secrets: string[]; position: { world; node }; gameCleared }`,
keys `smbc.save.1..3`, `loadSave/saveSave/eraseSave/listSaves`, a migrations array like
`settings.ts`, never throws (reuse `storage.ts`). Autosave whenever the map is shown (after a
clear, a game over, a quit to map) and when the file is first created. The existing global
`progress.ts` (Lost Levels flags) stays.

### Scenes and flow

- **Title** "Start game" → **FileSelectScene**: 3 files showing hero portrait, world reached,
  levels cleared (n/32), lives and score, a star when the game was cleared; NEW / CONTINUE /
  ERASE (with confirm). New file → character select (P2 can join) → World 1 map.
- **WorldMapScene(world)**: draws the page (tiles, decor, animated actors, open paths, nodes:
  closed = not drawn, open = yellow, cleared = red with flag, castle = castle icon with flag when
  cleared), the hero (current character's portrait/walk frames; P2 beside it) walking along open
  paths with the d-pad, a header bar (world title, `WORLD n`, lives, score, coins). Jump/start on
  an open level node → character select (pick mode, current hero preselected; P2 keeps theirs
  or can switch) → `goToLevel(entryLevel(...))`. Walking off a page along an open world exit
  slides to the next/previous page. Select/pause → small menu: Continue, Save & quit to title,
  Options. Announcer says the node ("World 1-2, cleared"). After a clear the hero is on the
  cleared node and the new path draws in dot by dot (skippable). Music: a new original `map`
  loop (MML, `src/content/music/songs.ts`; added to the music test list).
- **Level integration** (`src/game/scenes/level.ts` exit handler, `game.ts`): when the game
  is in campaign mode (`game.campaign = { slot }`): on `exit` → `clearLevel` + save + map
  (instead of `goToLevel(next)`); a warp pipe into another world → `warpTo` (play continues
  into the target level as today, then returns to that world's map); 8-4's ending → mark
  `gameCleared`, save, back to the World 8 map; pause gets "Quit to map" (no clear recorded).
  Deaths with lives left keep today's flow (select → respawn). Game over → CONTINUE? YES → map
  with 3 lives (5 co-op), score/coins 0, progress kept; NO → title (file already saved).
- Non-campaign starts (dev select, `?level=`, custom, shared, editor playtest) keep today's
  behaviour exactly.

### Themed pages (original art, text pixel arrays)

A new `map` sprite sheet (16×16 map tiles + small actors) with a `map-<theme>` palette per theme,
plus reuse of decor (hills, bushes, clouds, castles), items (coins, flags, stars) and enemy frames.
Animated: water/lava ripples, waving flags, drifting clouds, twinkling stars, wandering enemies
(decorative only). Pages:
1 Grass Land (green hills, river, small castle) · 2 Sea Side (beach, sea with jumping Cheep
Cheeps) · 3 Night Hills (night sky, moon, stars, snowy hills) · 4 Mushroom Woods (giant
mushrooms, Lakitu cloud) · 5 Sky Trees (tall treetops, Bullet Bills crossing) · 6 Snow Night
(snow fields, night) · 7 Cannon Coast (sea cliffs, blasters, Hammer Bro) · 8 Bowser's Land (dark
red sky, lava, castle walls, the big castle).

### Agents (orchestrated as before: brief file, worktrees, reviewer per branch, QA at the end)

Phase 1, in parallel, all against the contract above:
- **M1 save files + file select** (`save-files.ts`, `file-select.ts`, title change, tests).
- **M2 map engine** (`src/game/map/*`, `WorldMapScene`, rules, movement, path reveal, page
  slide, header, pause menu, announcer; uses a plain placeholder page until M3 lands; tests).
- **M3 map art + pages** (map sheet, palettes, the eight `worldN.ts` pages with nodes/paths/exits/
  bonus slot/actors, the `map` song; frame-list and validity tests; a test that every page's
  nodes cover levels X-1..X-4 and every path point is walkable).
Phase 2: **M4 integration** (campaign mode in `game.ts`/`level.ts`/`game-over.ts`/pause,
warp/ending hooks, README), on top of the merged Phase 1. Then reviewers, a **QA agent** (browser
pass: title → new file → map → 1-1 → clear → back to map with 1-2 open → quit → reload file
resumes; screenshots of all eight pages), one PR.

### Verification

Unit tests for rules and save files (migration, corrupt data, three slots independent); scene
sims with a real `Game` (as `tests/sim/death-continue.test.ts`, stubbed `localStorage`): new file
→ map → 1-1 → exit → map with 1-2 open and the file saved; locked node refuses; castle clear opens
World 2; warp from 1-2 opens World 4 only; game over → map with progress kept; load resumes at
the saved node with lives/score; dev/`?level=` starts never write a save. `pnpm lint && pnpm
typecheck && pnpm test && pnpm build`; the QA browser pass.

## Previous step: fix the two follow-up shell/bump reports (with the tester's addenda)

### Context

PR #22 is merged (main 5a0cdab). Its review filed two reports, and the tester added an addendum
to each on `origin/bug-reports/1-1-original-comparison` (commit 462fab6):
- `2026-10-05-bump-koopa-spiny-dies.md` + `2026-10-05-bump-koopa-shell-keeps-sliding.md`: a bump
  from below must not kill Koopas (green/red) or Buzzy Beetles: they go into their shell, which
  keeps sliding away from the block's middle at walking speed (`KoopaGreen.gBounceHit`:
  `vx = ±defaultWalkSpeed`, `bounced` keeps it in `enterShell()`), no score, shell timers start;
  touching it kicks it. A Spiny only bounces (`Spiney.gBounceHit`). Goombas still die. The test
  "a block bumped under an enemy scores the BELOW value (Koopa 100…)" in `tests/sim/scoring.test.ts`
  changes to 0 with the Koopa alive in its shell (Bullet Bill case unchanged). We follow the
  Crossover, as everywhere else (NES differences noted in the report, not adopted).
- `2026-10-05-still-shell-landing-bounces.md` + `2026-10-05-shell-no-hit-window-protects-all-players.md`:
  after any kick (side or from above) the shell gets a 15-frame no-hit window (`NO_HIT_SHELL_TMR`
  250 ms) during which no player is hurt by it or can stomp it (`Character.hitEnemy`,
  `KoopaGreen.stomp`); then the player no longer bounces when kicking a still shell from above.

### Setup

Fast-forward `claude/admiring-galileo-quy3ri` to `origin/main`, merge
`origin/bug-reports/1-1-original-comparison` (adds the two addenda), push.

### Agents (same brief as last round: `scratchpad/bugfix-brief.md`, base = the new head)

- **S1 bump** (`world.ts` block-bump path, `koopa.ts`/Buzzy, `spiny.ts`): the behaviour above,
  with sims for green Koopa, red Koopa, Buzzy (shell slides away from the block middle, both sides;
  no score; revives later; touching it kicks it), Spiny (bounces, survives), Goomba (still dies,
  100); update the scoring test.
- **S2 shell no-hit window** (`koopa.ts` shell state, `world.ts` stomp/contact branches): 15-frame
  window on the shell after every kick, protecting all players from contact and stomps; drop the
  kick bounce; sims for single player (land on still shell → kicked, no bounce, no damage) and
  two players (P2 touching/falling on the shell right after P1 kicks it is not hurt and doesn't
  stomp it; after 15 frames it hurts).
- Then a **reviewer agent** per branch (diff vs the original source, run checks, short verdict);
  send problems back; merge both (overlap in `koopa.ts`/`world.ts` resolved by me or by S2 on top
  of S1 if conflicts are real); a **QA agent** does a short browser check in 1-1 (bump the Koopa
  at ~col 107 from a block if reachable, kick shells); append `Status:` lines to all four reports;
  one PR to main.

### Verification

Reviewer verdicts; `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; QA pass/fail.

## Previous step: fix the first batch of tester bug reports (1-1 vs the original 3.1.21)

### Context

A tester pushed 11 reports on `origin/bug-reports/1-1-original-comparison` (commit af962fa, on
top of main 9623e8a), comparing our 1-1 with the original Crossover 3.1.21 and its source. The
user decided: **camera stays NES right-only** (that report closes as "not a bug: by design"),
and **every death with lives left goes to character select**, as in the original. Everything
else is a real mismatch; spot-checked in the original's source: `data/ScoreValue.as`
(KOOPA_ATTACK/STAR 200, KICK_SHELL_* 400/500/500/1000, FLAG_POLE_HEIGHT_1-5),
`ground/Brick.as` (COIN_BRICK_MAX_COINS 15, 6000 ms timer, one last coin after the timer).

### Setup

Restart `claude/admiring-galileo-quy3ri` from `origin/main` by merging (no force-push), then
merge `origin/bug-reports/1-1-original-comparison` so the reports are in the branch; every fix
appends `Status: fixed in <sha>` (or `not a bug — <why>`) to its report file.

### Work, as three parallel agents in worktrees (I review, send back, merge)

- **R1 scoring** (`src/game/world/world.ts` stomp/kick branches, enemy `scoreValue`s,
  `src/game/entities/objects/flagpole.ts`, `src/game/entities/effects/effects.ts`):
  - per-enemy STOMP/ATTACK/STAR/BELOW values from `ScoreValue.as` for every enemy we have
    (Koopa and paratroopa, piranha, cheeps, Blooper, Lakitu, Spiny, Bullet Bill, Hammer Bro,
    Buzzy, Bowser), with a table test;
  - shell kicks: 400 normal, 500 right after the stomp / while the legs are out, 1000 just
    before it walks (find each window in the original's Koopa/shell code), including landing on
    a still shell;
  - flagpole: score from the player's vertical middle against the pole's height from the bottom
    (≥90% 5000, ≥65% 2000, ≥40% 800, ≥20% 400, else 100);
  - the flagpole score popup floats up and expires during the clear sequence (effects keep
    updating while the flag phases run).
- **R2 level end, blocks, HUD** (`world.ts` countdown, `coins10` brick, `src/game/hud/hud.ts`,
  `src/game/scenes/intro.ts`):
  - time tally at the original's rate (verify in its source, then match; 50 points per unit);
  - multi-coin brick: a 6 s timer from the first hit, up to 15 coins, one last coin on the hit
    after the timer ends;
  - 7-digit score in the HUD, layout re-spaced so the coin counter, world and time still fit
    (check every hero's HUD extras and the two-player HUD);
  - the HUD row across the top of the lives card (score, coins, world, TIME from the level).
- **R3 flow** (`src/game/scenes/level.ts` death branch, `src/game/scenes/game.ts`,
  `src/game/scenes/game-over.ts`, character select scene):
  - death with lives left → character select (current hero preselected; checkpoint, score,
    coins and world kept; the chosen hero starts small / base power) → lives card → respawn;
    in two-player mode the player who died picks; playtests and the dev level select keep
    today's instant respawn;
  - game over → `CONTINUE? YES / NO`: YES restarts the current level from its start with 3
    lives and score and coins at 0 (hero kept, or via character select like a death); NO → title.
- Camera report: append `Status: not a bug — the NES-style right-only camera is the intended
  default; Dev mode → Assists → scroll back allows it.`

Each agent: sim/unit tests for every fix (reproduce the report first, then pass), full
`pnpm lint && pnpm typecheck && pnpm test && pnpm build`, commit, report.

### Keeping my context small

Agents do the reading, coding, testing and browser work; I only read their reports, diff stats
and test summaries. Reviews are delegated too: after each fix agent reports, a separate
**reviewer agent** (read-only, `Explore`/`general-purpose`) checks that branch's diff against
the cited original source and the report, runs the checks in the worktree, and returns a short
verdict with concrete problems; I send problems back to the fix agent with `SendMessage`. After
merging, one **QA agent** runs the full checks and the headless browser pass of 1-1 and returns
pass/fail with screenshot paths; I look at two or three screenshots at most.

### Verification

Reviewer verdicts for R1–R3; full `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
after merging; the QA agent's browser pass of 1-1 (HUD 7 digits, lives card HUD, flagpole
popup, death → character select, game over → continue); one PR to `main` listing every report
and its outcome.

## Previous step: a drop folder for bug reports from tester agents

### Context

The user will have other agents (separate Claude sessions, not in this container) test the game
and wants a folder they can drop bug reports into for me to review. Because testers run elsewhere,
the folder lives in the repo and reports reach me through git.

### Changes

- `bug-reports/README.md`: what to test against, and how to file a report:
  - One Markdown file per bug, named `YYYY-MM-DD-<area>-<short-slug>.md`
    (e.g. `2026-10-05-ll-8-4-bowser-falls-through-floor.md`).
  - Fields: title, severity (crash / blocks progress / wrong behaviour / cosmetic), build
    (commit sha or version from the title screen), how to reach it (dev URL such as
    `?dev=1&level=ll-8-4&char=link`, or menu path), character and power state, steps, expected,
    actual, how often, notes. Level ids and tile columns (debug overlay F1) make a report actionable.
  - Optional screenshots next to the report (`.png`, same base name, under 1 MB, of this game only).
  - Delivery: commit the files under `bug-reports/` on the tester's own branch and push it, then
    tell the user the branch name (or open a PR titled `Bug reports: <area>` against `main`).
    Never edit someone else's report; one bug per file so reports never conflict.
- `bug-reports/TEMPLATE.md`: the fields above as a copyable skeleton.
- `.prettierignore`: add `bug-reports` so testers' free-form Markdown never fails `pnpm lint`.
- Commit on `claude/admiring-galileo-quy3ri` and push (it reaches `main` with PR #20). Until
  #20 is merged, testers branching from `main` simply create `bug-reports/` themselves; the path
  is the same.

### How I'll review

Fetch the tester branches the user names, read every new file in `bug-reports/`, reproduce each
bug (headless sim or the browser), then fix or reply, and record the outcome by adding
`Status: fixed in <sha>` / `not a bug: <why>` to the report.

### Verification

`pnpm lint` passes with the new folder; `git ls-tree` shows `bug-reports/README.md` and
`TEMPLATE.md` on the pushed branch.

## Previous step: The Lost Levels, all 13 worlds, built by an orchestrated agent team ("gauntlet loop")

### Context

The user wants every Lost Levels map (`levelDataLostLevels.xml` in the original repo, cloned
read-only at `/home/user/jaypavlina/super-mario-bros-crossover`): 52 levels, 110 areas, worlds
1–8, 9 and A–D (stored as 10–13). Work is split into tasks run by parallel agents; I orchestrate,
review each result independently and send work back until it is right; everything lands in **one
PR**. Decisions: Lost Levels are reachable **only from the dev level select** for now; worlds
9 and A–D **unlock like the original** (8-4 ends the game; World 9 follows the ending only if the
run used no warp; A–D unlock in saved progress after a clear and are played from the dev select
until a game picker exists). PR #19 (World 8) must be merged first; if it is not when I start, I
branch from `origin/claude/admiring-galileo-quy3ri` and say so in the PR.

Survey of what Lost Levels needs beyond SMB1 (normal difficulty):
- **Upside-down pipes** (`groundPipeBottomLeft/Right`, 64 each) and **upside-down piranhas**
  (`enemyPiranhaRedUpsideDown`, 64) in worlds 5–13.
- **Poison mushrooms** (`ContainedItem=PoisonMushroom`, 42) in ? blocks, bricks and hidden blocks.
- **Green springboards** (`springGreen`, 23: launch far higher), **chasing Hammer Bros**
  (`enemyHamBroChase`, 32), **fake Bowsers** (`enemyBowserFake`, 3: plain Bowsers here),
  **Bloopers outside water** (~17, the current Blooper clamps to `waterTop`, which is
  `Infinity` outside water levels: a real bug), extra mushroom-platform pieces
  (`groundMushroomSin*`, `standardPlatformStem*Top` → existing `m`/`i`), `lakituEndMiddle`
  (another Lakitu end marker), warp-zone labels `sceneryText_1/B/C/D` (worlds 1 and B–D).
- Clock items (1) become coins. Everything else (mazes, balance lifts, Lakitu, blasters, bullet
  and cheep zones, vines, water) already exists.

### Phase 0: foundation (me, one commit, before any agent starts)

- Copy `levelDataLostLevels.xml` into `tools/levelgen/source/` (gitignored); agents read it by
  absolute path.
- Converter `tools/levelgen/convert-smbc.mjs`: `--prefix ll-` option that prefixes every
  generated id, `parent`, pipe/vine/pit target, warp target and `exit next=`; next-level chain
  for the Lost Levels file (1-1 … 8-4 → `end`; 9-1 … 9-4 → `end`; 10-1 … 13-4 → `end`; intros
  as today); warp zones label worlds 10–13 as A–D. SMB1 output must stay byte-identical (re-run
  Worlds 1–8, `0 tile cells differ`, `git status` clean).
- Level index `src/content/levels/index.ts`: also glob `./lost/world*/*.map` (ids `ll-…`).
- `worldLabel(world)` helper (10–13 → A–D) used by the HUD (`src/game/hud/hud.ts`) and the
  intro card (`src/game/scenes/intro.ts`).
- Ending flow (`src/game/scenes/game.ts` `showEnding`): after `ll-8-4`, continue to `ll-9-1` if
  `state.warped` is false; any `ll-8-4` clear sets `progress.lostLetters = true`, a no-warp
  clear also `progress.lostWorld9 = true` (saved through the existing progress store in
  `src/engine/save/`). `GameState.warped` is set by `LevelScene` when a pipe takes the player to a
  different world/stage that is not its own sub-area.
- Test scaffolding: `src/content/levels/lost/` with an empty README-style index test pattern each
  agent copies (`lost-worldN.test.ts` per world, so agents never edit the same test file).
- Commit and push; this commit is the base every agent's worktree starts from.

### Phase 1: engine mechanics (3 agents in parallel, `isolation: "worktree"`)

Each agent owns distinct features, symlinks `node_modules` from `/home/user/SMBC`, never runs
the browser smoke script (shared port), runs `pnpm lint && pnpm typecheck && pnpm test`, commits
on its worktree branch and reports changed files, test names and anything it could not do.

- **Agent M1 — upside-down pipes and piranhas**: tiles `PIPE_BOTTOM_L/R` (legend chars chosen
  from the free set and recorded in the report), original art (pipe rim flipped), converter
  mapping; `Piranha` variant that hangs from a pipe bottom and extends downward (hides while the
  player is near, like the upright one); converter places it under the pipe's bottom tile;
  editor entry; sim tests on a small text-map level.
- **Agent M2 — poison mushrooms**: block contents `poison` for ? blocks, bricks and hidden blocks
  (tile defs + legend chars + converter `ContainedItem=PoisonMushroom`), a `PowerUp` kind
  `poison` with original art that slides like a mushroom and **hurts** whoever touches it (power-
  up heroes shrink/die, hp heroes take a hit, no effect while starred), every character's
  `onPowerUp` path handles it; `Clock` → coin; tests.
- **Agent M3 — springs, chasers, Bowser fakes, flying Bloopers, odd tokens**: `spring` gets a
  `green` variant (launch ≈ 2× the red one, art = recoloured spring); `HammerBro` `chase` flag
  (advances immediately, converter `enemyHamBroChase`); `enemyBowserFake` → `bowser`;
  Blooper works outside water (no clamp when `waterTop` is infinite; drifts in air as in the
  original); converter: mushroom-platform variants → `m`/`i`, `lakituEndMiddle` → Lakitu end,
  `sceneryText_*` ignored; tests.

Orchestrator review per agent: read the diff, run the full checks in the worktree, try the
feature in a sim of my own, check art passes `validateDef` and looks right in a quick render;
send back with concrete fixes until clean; then merge the branch into
`claude/admiring-galileo-quy3ri` (resolving the additive conflicts in `world.ts`, `tiles.ts`,
`editor.ts` and the converter myself) and re-run everything.

### Phase 2: the maps (5 agents in parallel, worktrees from the merged Phase 1 commit)

Split by load: **W-A** worlds 1–3, **W-B** 4–6, **W-C** 7–8, **W-D** 9–11, **W-E** 12–13. Each
agent: runs the converter with `--prefix ll-` into `src/content/levels/lost/worldN/`, reads every
warning and skipped token, compares each area against the XML (sizes, start modes, every pipe /
vine / pit / loop target resolving to a real file, entity counts by type), writes
`src/content/levels/lost/lost-worldN.test.ts` landmark tests and `tests/sim/lost-worldN.test.ts`
(every area loads; one targeted sim per notable feature, e.g. a maze route, a green spring, an
upside-down piranha). Agents **do not change shared code**: a converter or engine problem goes
back to me in the report with the evidence, and I fix it centrally (or hand it to the owning
Phase 1 agent) and tell the world agents to regenerate.

Orchestrator review per world agent, independent of its own tests: my own script recounts
every entity type per area straight from the XML (normal difficulty) and diffs against the
generated maps; every zone target exists; the next-level chain is complete; maze loops have
the expected checkpoint lists; a headless run of every area for 600 frames with no exceptions;
spot screenshots of one area per world after merging (single browser at a time). Anything
missing or wrong goes back with exact file/line evidence; repeat until clean, then merge.

### Phase 3: integration and the single PR

Merge all branches, regenerate SMB1 to prove it is unchanged, run `pnpm lint && pnpm typecheck
&& pnpm test && pnpm build`, a browser pass through the dev level select (open one Lost Levels
level per world, check HUD labels 9 and A–D), README section on The Lost Levels (how to open
them, unlock rules, new mechanics), then one PR to `main` listing every world, the mechanics,
the review findings that were fixed, and anything left unresolved.

## Previous step: World 8, the last of the Worlds 2–8 series

### Context

PR #18 (World 7) is merged (`main` = `f161914`). World 8 on normal difficulty:
- **8-1** (400 wide, trees, four Buzzy Beetles, paratroopas, bonus pipe at 104),
- **8-2** (Lakitu over columns 8–40, blasters, beetles, many paratroopas, springboard, bonus pipe at 156),
- **8-3** (blasters, Hammer Bros, and long **castle walls** in the background: `castleWallTop{Lft,Mid,Rht}` / `castleWall{Lft,Mid,Rht}` tokens, ~580 cells, today skipped),
- **8-4** (331-wide castle, main area `a`): its pipes lead back into the same level (wrong pipes → column 19, the right ones → 126 and 206 via `VertEnd` #2/#3), three edge loops with **no checkpoints** (110→37 rows 3–12, 180→112, 317→253 rows 3–9), **two** leaping-Cheep zones (216–231 and 280–295), piranhas in most pipes; area `b` (72-wide water with fire bars) reached from pipes 239/303; area `c` (64-wide boss room) from `b`'s side pipe, with a `FireballHammer` Bowser at 40,9, the axe at 45,8, `levelExit` at 56 and **`peach` at 57**.

New work: the castle-wall scenery, several cheep zones per area, pipes inside one level, the **ending** (today 8-4 → `next=end` just returns to the title), and an existing bug found while planning: returning from any sub-area (bonus room, water detour, sky) to its main level **resets the timer** to the level's full time, because `World` takes `level.time` whenever it is not `null` (`src/game/world/world.ts`, `this.time = ...` in the constructor).

Start by restarting the branch from `main`; convert with
`node tools/levelgen/convert-smbc.mjs tools/levelgen/source/levelDataSmb.xml src/content/levels/world8 8-1 8-2 8-3 8-4`
and re-run Worlds 1–7 (no map changes expected).

### Changes

- **Castle walls (8-3)**: `src/game/level/tiles.ts` gains two non-solid tiles `WALL_TOP` ('wall-top', legend `A`) and `WALL` ('wall', legend `H`); the converter maps the `castleWallTop*` tokens to `A` and `castleWall*` to `H`. Art in `src/content/sprites/tiles.ts` (16×16, tile palette roles): `wall` = the existing `brick` rows, `wall-top` = crenellations over a brick lower half; add both to `src/content/sprites/tiles.test.ts`.
- **Several cheep zones**: the converter collects `flyingCheepStart/End` pairs in a list (sorted by x) and emits one `cheeps x w` per pair; `World.flyingCheeps` already checks every `cheeps` zone. 2-3 and 7-3 keep their single zone.
- **Pipes inside one level (8-4)**: the converter already resolves `pTransDest=a` with a `number` to the area's own `VertEnd` (giving `pipe x y down -> 8-4 19 10 exit=up`); `LevelScene` reloads the level at that point, which is what we want. Verify with a sim test.
- **Timer across transfers**: `WorldStart` (`src/game/world/world.ts`) gains `time?: number`; the constructor uses `start.time ?? (level.time === null ? state.time ?? 400 : level.time)`. `LevelScene`'s pipe handler (`src/game/scenes/level.ts`) passes `time: this.world.time` whenever the target is the same world and stage (bonus rooms, water detours, skies, 8-4's own pipes), through a small exported helper `carryTime(from, to, time)` so it can be unit-tested. Deaths and level exits still start a fresh timer.
- **Princess and ending**: converter `peach → entity 'princess' x y`; a `Princess` decoration entity (`src/game/entities/objects/princess.ts`, layer back, no collision) draws a new original 16×24 `princess` frame from the items sheet (crown, hair, pink gown, item palette roles 0/1/3/5/9/d; add to the items frame-size test). `LevelScene`'s exit handler, for `next === 'end'`, pushes an ending `MessageScene` instead of the title: `THANK YOU <HERO>!`, `THE PRINCESS IS SAFE`, `AND THE KINGDOM IS FREE.`, blank, `FINAL SCORE <score>`, `PRESS START` (original wording), plays the existing `world-clear` jingle, then `game.showTitle()`. Playtests (`game.playtestDone`) keep their current behaviour.
- **Bowser `both`** already exists (World 6); 8-4-end's Bowser uses it.
- README: "All eight worlds are playable"; mention the ending.

### Tests

- `src/content/levels/levels.test.ts` `describe('World 8 …')`: 8-1 width 400, four `buzzy`, bonus pipe 104 → `8-1-bonus`, exit → `8-2`; 8-2 Lakitu `{ end: 40 }`, blaster tiles, exit → `8-3`; 8-3 `WALL`/`WALL_TOP` tiles present (counts from the converted map), Hammer Bros, exit → `8-4`; 8-4 three loops with empty `checks`, two `cheeps` zones `216 15` and `280 15`, pipes 81 → `8-4 126 10 up`, 163 → `8-4 206 10 up`, 51/143/223/287 → `8-4 19 10 up`, 239/303 → `8-4-water 3 10 up`; water side pipe → `8-4-end 3 10 up`; 8-4-end Bowser `{ attack: 'both' }`, axe 45 8, `princess` 57 12, `exit 56 next=end`, back pipe 10 → `8-4 19 10 up`.
- `tests/sim/world8.test.ts`: walking past column 110 in 8-4 loops to 37 (no checkpoint needed); entering the pipe at 51 emits a pipe event to `8-4` (19,10); in 8-4-end, reaching the axe ends with an exit event `next: 'end'`; the 8-4-end Bowser throws both flames and hammers; every World 8 area loads.
- Unit test for `carryTime`: same stage → carries; different stage → `undefined`.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; screenshots of 8-1, 8-3 (walls) and 8-4; a browser check of the ending text by starting `?level=8-4-end` with the dev URL and walking to the axe is optional (the sim covers the event). Commit, push, open the PR (user merges).

## Previous step: World 7 (sixth of the Worlds 2–8 series)

### Context

PR #17 (World 6) is merged (`main` = `e71e41f`). World 7 on normal difficulty: 7-1 (208 wide,
13 blaster columns, four Hammer Bros, a beetle, a springboard, a bonus room), 7-2 (water, like
2-2 with 13 Bloopers, intro + exit area), 7-3 (treetop bridges with leaping Cheep Cheeps, plus
two **green paratroopas that fly side to side**, `enemyWingedKoopaHorizontalGreen` at (137,7)
and (153,9)), 7-4 (352-wide castle maze with a hammer Bowser at 328,9). Two things are new:
the side-to-side paratroopa and the **7-4 maze rules**, which use several checkpoints per
teleporter and a second start type.

**Maze semantics** (derived from the data; 4-4 keeps working the same): each numbered
teleporter has a start column (rows y0..y1), an end column, and checkpoint tokens grouped by
column (each column is one checkpoint with its own rows). `teleporterStart` fires only after
**all** its checkpoints were passed since the last teleport; `teleporterStartOne` fires after
**any** of them. In 7-4: #0 = start 79 (rows 3–5) → 143, checks at 43 (rows 10–12) and 60
(rows 7–9), so the right route is low, then middle, then up; #1 = start-one 143 (rows 3–12)
→ 79, checks at 107/123 (upper) and 124/135 (lower), so anyone who walked through the
repeated section loops back; #2 = start 208 (rows 3–5) → 272, checks 173 (upper) and 191
(middle); #3 = start-one 272 (rows 3–9) → 208, checks 240, 254, 255, 269.

Start by restarting the branch from `main`, then
`node tools/levelgen/convert-smbc.mjs tools/levelgen/source/levelDataSmb.xml src/content/levels/world7 7-1 7-2 7-3 7-4`
and re-run Worlds 1–6 (4-4's map must not change).

### Maze rules

- `src/game/level/schema.ts`: the `loop` zone's `check` becomes
  `checks: { x; y0; y1 }[]` plus `need: 'all' | 'any'`.
- `src/game/level/textmap.ts`: `loop x y0 y1 -> to [check=x:y0:y1[,x:y0:y1...]] [any]`
  (one checkpoint keeps today's syntax, so 4-4's lines are unchanged; `any` only when present).
- Converter: group `teleporterCheckPoint` tokens of a number by column into separate
  checkpoints; `teleporterStartOne` sets `any`.
- `World.checkLoops` (`src/game/world/world.ts`): `loopChecks` becomes a set of
  `zoneIndex:checkIndex` keys; a start fires when every (`all`) or some (`any`) of its
  checkpoints are in the set; still cleared on every teleport.
- Update the 4-4 landmark expectation in `src/content/levels/levels.test.ts` to the new zone
  shape (`checks: [...]`, `need: 'all'`); its sim tests in `tests/sim/world4.test.ts` must pass
  unchanged.

### Side-to-side paratroopa

- `Koopa` (`src/game/entities/enemies/koopa.ts`) gains a flight style: `'hop'` (green, today),
  `'bob'` (red, today) and new `'glide'`: sways ±56 px around its spawn x on a 256-frame sine,
  at a fixed height, ignoring tiles, facing its direction of travel. A stomp clips the wings
  like the others (then it walks and falls normally).
- Entity type `koopa-para-green-h` (converter: `enemyWingedKoopaHorizontalGreen`), spawned in
  `World.makeEntity` with the koopa offsets; editor entry with the `koopa-fly-0` frame.

### Tests

- `levels.test.ts` `describe('World 7 …')`: 7-1 blaster tops at the data's columns (count of
  `BLASTER_TOP` tiles matches the converted map, at least 6), four `hammer-bro`,
  one `buzzy`, spring (151,12), bonus pipe 93,10, exit → `7-2-intro`; 7-2 water with 13
  `blooper`s and the side exit; 7-3 `cheeps 9 173`, two `koopa-para-green-h` at (137,7) and
  (153,9); 7-4 width 352, four loops with the checkpoint lists above (`need` all/any/all/any),
  `bowser 328 9 attack=hammer`, exit → `8-1`.
- `tests/sim/world7.test.ts`: the glide paratroopa (on a small text-map test level) stays at
  its height while covering ≥ 80 px left and right, and a stomp leaves a wingless walker; 7-4:
  low (cross 43) → middle (cross 60) → upper (cross 79) teleports 79 → 143; walking the upper
  corridor across 79 does nothing, and then crossing 107 and 143 loops back to 79 (positions
  set in the controller, as in `tests/sim/world4.test.ts`); every World 7 area loads.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; screenshots of 7-1, 7-3, 7-4;
  README "Worlds 1 to 7"; commit, push, open the PR (user merges).

## Previous step: World 6 (fifth of the Worlds 2–8 series)

### Context

PR #16 (World 5) is merged (`main` = `f06c8a7`). World 6 on normal difficulty is almost
entirely built from existing pieces: 6-1 is a night Lakitu level (`lakitu 21 0 end=170`), 6-2
has four Buzzy Beetles, two bonus rooms (`6-2-bonus` from the pipe at 19, `6-2-bonus2` from
153), the underwater detour (`6-2-water` from 56) and a coin heaven with the rightward cloud,
6-3 is a snow-palette treetop level with three balance lifts (len 4), two springboards and a
short Bullet Bill stretch (columns 89 to 122), and 6-4 is a castle with Podoboos and fire bars.
The one new thing is **Bowser's attack type**: the data gives `BowserType=Hammer` for 6-4 (and
`FireballHammer` for a later castle). Today every Bowser only breathes fire.

Start by restarting the branch from `main`, then
`node tools/levelgen/convert-smbc.mjs tools/levelgen/source/levelDataSmb.xml src/content/levels/world6 6-1 6-2 6-3 6-4`
and re-run Worlds 1–5 to confirm no map changes (the Fireball Bowsers must keep their
prop-less `bowser x y` line).

### Hammer-throwing Bowser

- Converter (`tools/levelgen/convert-smbc.mjs`): take `enemyBowser` out of `ENTITIES` and handle
  it in the switch: `Fireball` (or no type) → `bowser x y` (unchanged); `Hammer` →
  `bowser x y attack=hammer`; `FireballHammer` → `bowser x y attack=both`. `enemyBowserFake`
  is hard-only, so normal difficulty never sees it.
- `src/game/entities/enemies/bowser.ts`: constructor gains `attack: 'fire' | 'hammer' | 'both' =
  'fire'`; `World.makeEntity` passes `String(s.props?.attack ?? 'fire')`
  (`src/game/world/world.ts`, the `bowser` case).
  - `fire` / `both`: the existing flame timer.
  - `hammer` / `both`: a hammer timer (every 80–140 frames) starts a volley of 5 hammers 8
    frames apart, each `new Projectile(..., HAMMER, this, { vx, vy })` reusing `HAMMER` from
    `src/game/entities/projectiles/projectile.ts` and the arc numbers from
    `HammerBro.throwHammer` (`src/game/entities/enemies/hammer-bro.ts`), thrown from above
    Bowser's head toward the player; mouth-open frame while throwing. Hammers stop when Bowser
    is falling dead or `world.bossClear` is set (the existing early returns cover both).
- Editor: the Bowser entry keeps `type: 'bowser'`; no new palette entry needed.

### Tests

- `src/content/levels/levels.test.ts` `describe('World 6 …')`: 6-1 night with
  `{ type: 'lakitu', x: 21, y: 0, props: { end: 170 } }`; 6-2 four `buzzy`, pipes 19 → `6-2-bonus`,
  56 → `6-2-water`, 153 → `6-2-bonus2` and each sub-area's way back (35, 115, 179), vine →
  `6-2-sky`, exit → `6-3`; 6-3 theme snow, three `balance` entities with `len: 4`
  (71/75, 79/82, 127/130), springs at 38 and 116, `bullets 89 33`, exit → `6-4`; 6-4 Bowser
  `{ attack: 'hammer' }` at 136 9, three Podoboos, exit → `7-1`.
- `tests/sim/world6.test.ts`: the 6-4 Bowser throws hammers (projectiles of kind `hammer`
  owned by it) and no flames within 400 frames; a 1-4 Bowser still throws flames and no
  hammers; every World 6 area loads and runs 60 frames.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; smoke screenshots of 6-1, 6-3,
  6-4; README "Worlds 1 to 6"; commit, push, open the PR (user merges).

## Previous step: World 5 (fourth of the Worlds 2–8 series)

### Context

PR #15 (World 4) is merged (`main` = `63e1064`). World 5 on normal difficulty needs, beyond
what Worlds 1–4 built: **Bullet Bill blasters** (5-1: columns 111 and 170; 5-2: column 107),
the **Bullet Bill stretch** of 5-3 (`bulletBillStart` col 0 → `bulletBillEnd` col 126: bills
fly in from the screen edges), the **long fire bar** in 5-4 (`fireBarLongRight` at 23,7), and
the coin-heaven **cloud that moves right once stepped on** (`movingPlatform type=StepConstantRight`
in 5-2's sky). Everything else already exists: Hammer Bros (5-2: two), Buzzy Beetles (5-2:
three), paratroopas, springboard (5-2 col 25), the 5-2 water area (`5-2-water`, entered by the
pipe at 55 and left by its side pipe at 62,8), vine + coin heaven, Podoboos, fire bars, lifts,
Bowser. 5-3 is a treetop level (the converter already draws world 5 platform levels as trees).

Start by restarting the branch from `main`, then
`node tools/levelgen/convert-smbc.mjs tools/levelgen/source/levelDataSmb.xml src/content/levels/world5 5-1 5-2 5-3 5-4`
and re-run Worlds 1–4 to confirm `0 tile cells differ`.

### Bullet Bill blasters (tiles + launchers)

- `src/game/level/tiles.ts`: two solid tiles `BLASTER_TOP` ('blaster-top', legend `^`) and
  `BLASTER_BASE` ('blaster-base', legend `|`); both chars are free in `DEFAULT_LEGEND`.
- Converter `tileChar`: `groundBillBlasterTop → '^'`, `groundBillBlasterMiddle` and
  `groundBillBlasterBottom → '|'`.
- Art (`src/content/sprites/tiles.ts`, 16×16, tile palette roles from the header comment so
  every theme recolours it): `blaster-top` = a dark barrel facing both ways with a pale skull
  badge (roles 0/1/2/3/8), `blaster-base` = a riveted pedestal (0/1/2/3). Add to the
  `tileFrames` list in `src/content/sprites/tiles.test.ts`.
- `src/game/entities/enemies/bullet-bill.ts`:
  - `BulletBill extends Enemy`: 14×12 body, sprite `bullet` (exists, 16×16, faces left),
    flies straight at 0x01400 (1.25 px/f) ignoring tiles, `despawnMargin` 32 and destroyed
    once 32 px past either camera edge; `vulnerability = { ...BASIC, fireball: 'immune',
    boomerang: 'immune', ice: 'immune' }`; a stomp kills it (falls as a corpse via `flipOut`),
    `scoreValue 200`; layer `'front'` so it draws over the barrel it leaves.
  - `BulletLauncher extends Entity` (no body collision, `layer 'back'`, `despawnMargin 64`):
    built by `World` at load from every `BLASTER_TOP` tile (scan next to the existing
    flagpole scan in the `World` constructor, `src/game/world/world.ts`). Every 150–270
    frames (`world.rng`) it fires a `BulletBill` toward the nearest player when the barrel is
    within the camera ±1 tile and the player is more than 2 tiles away horizontally (SMB1 does
    not fire at point-blank range); the bill starts just outside the barrel on the player's
    side, and plays the existing `kick` sfx as the cannon shot.
- Editor: `blaster-top`/`blaster-base` appear automatically through `TILES`; add `bullet-bill`
  to `ENTITY_FRAMES` and the entity list.

### Bullet Bill stretch (5-3)

- Schema/textmap: zone `bullets x w` (`{ kind: 'bullets'; x; w }`), parse/serialize next to
  `cheeps` in `src/game/level/textmap.ts` and `schema.ts`.
- Converter: `bulletBillStart`/`bulletBillEnd` → `bullets start (end - start)`, handled like
  `flyingCheepStart/End` (`cheepZone`).
- `World.flyingBullets()` (beside `flyingCheeps()`): while the lead player is inside a
  `bullets` zone, every 90–180 frames spawn a `BulletBill` at the right screen edge (or the
  left edge one time in four) at a random height between rows 3 and 11, aimed across the
  screen; at most 2 alive from the zone.

### Long fire bar and the rightward cloud

- Converter `ENTITIES` gains `fireBarLongRight → firebar-ccw` and `fireBarLongLeft → firebar`
  with `len=12` (the `Firebar` constructor already takes `len`, `src/game/entities/enemies/firebar.ts`).
  Emit via `b.entity(type, x, y, { len: 12 })`.
- `Lift` (`src/game/entities/objects/lift.ts`) gains kind `'lift-right'`: still until first
  ridden (`ridden` flag set in `carry()`), then moves right at `speed` (default 1 px/f)
  forever; `despawnMargin` 64. Converter `LIFTS.StepConstantRight = 'lift-right'`; editor
  entry.

### Tests

- `src/content/levels/levels.test.ts` `describe('World 5 …')`: 5-1 blaster tiles at
  (111,11)/(111,12) and (170,11), none at 159 (hard-only), bonus pipe 156,7, exit → `5-2`;
  5-2 two `hammer-bro` (124,4) and (81,8), three `buzzy` at 136–138, spring (25,12), pipe 55,10 →
  `5-2-water` and its side pipe back, vine zone → `5-2-sky`, sky has a `lift-right`, exit → `5-3`;
  5-3 `bullets 0 126` zone, trees, red paratroopas, exit → `5-4`; 5-4 a `firebar-ccw` with
  `len: 12` at (23,7), Podoboos, Bowser 136 9, axe 141 8, exit → `6-1`.
- `tests/sim/world5.test.ts` (same `at()` pattern as `tests/sim/world4.test.ts`): a 5-1
  launcher fires a bill toward a player 5 tiles away and not toward one standing right next
  to it; the bill ignores tiles, is immune to fireballs and dies to a stomp; inside the 5-3
  stretch bills appear at a screen edge and none appear before the zone/after it; the
  5-2 sky cloud waits until stepped on, then carries the player right; the 5-4 long bar has
  12 balls (hurts a player 11 balls out); every World 5 area loads and runs 60 frames.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; smoke screenshots of 5-1, 5-3,
  5-4; commit, push, open the PR (user merges). README: "Worlds 1 to 5".

## Previous step: World 3 (second of the Worlds 2–8 series)

### Context

PR #13 (World 2) is merged; `main` is at `f9a4da4`. The user asked for Worlds 2–8, one world per
PR. World 3 on normal difficulty needs, beyond what World 2 built: the night palette (already
exists for tiles/decor; the sky is black), **Hammer Bros** (3-1 has two), **balance lifts**
(3-3 has two pairs on ropes over pulleys), plus things that already work (springboard, vine +
coin heaven, bonus room, green paratroopas, Podoboos, fire bars, lifts, Bowser). Levels:
3-1 (224 wide, night, trees, bonus `b`, coin heaven `c` 96 wide), 3-2 (224, night, trees),
3-3 (176, night treetops, balance lifts, wave/step lifts), 3-4 (castle: 4 Podoboos, fire bars,
the lift before Bowser).

Start by restarting the branch from `main` (`git fetch origin main && git checkout -B
claude/admiring-galileo-quy3ri origin/main`), then convert with
`node tools/levelgen/convert-smbc.mjs tools/levelgen/source/levelDataSmb.xml src/content/levels/world3 3-1 3-2 3-3 3-4`
(re-run World 1/2 afterwards and confirm `0 tile cells differ`).

### Converter (`tools/levelgen/convert-smbc.mjs`)

- **Balance lifts**: pair the two `movingPlatform&&type=Pully` tokens that share a rope. The
  rope is `pullyCornerLeft` at column x1 and `pullyCornerRight` at x2 on the same row (row 2 in
  3-3), and the platforms' left columns equal the corner columns (82/89 and 137/141 in 3-3).
  Emit one entity line `balance x1 y1 x2=X2 y2=Y2 len=6 top=ROW`. `pullyRope`/`pullyCorner*`
  tokens are consumed by the pairing (ignored otherwise); warn on an unpaired Pully.
- `wavesNight` already maps to `w` (water in 3-1's pits; the night theme has no swimming
  because `World.waterTop` only applies to `theme === 'water'`).
- Night/snow sets already exist (`NIGHT = 3-1, 3-2, 3-3, 6-1`, `SNOW = 6-3`); music overworld.

### Hammer Bro (`src/game/entities/enemies/hammer-bro.ts`, marker `h` already maps to `@hammer-bro`)

- `extends Enemy`, hitbox 12×22 with sprite offsets (2,2) like `Koopa`
  (`src/game/entities/enemies/koopa.ts:34-41`), frames `hammer-bro-0` (arm up) / `hammer-bro-1`
  (walking), `scoreValue = 1000`, stomp kills (default `BASIC_VULNERABILITY`), spawn with the
  koopa convention `new HammerBro(x + px(2), y - px(6))` in `World.makeEntity`
  (`src/game/world/world.ts` ~line 247).
- Behaviour (SMB1-like, tuned): faces the nearest player (`world.nearestPlayer`); shuffles
  back and forth ±1 tile of its spawn at 0.25 px/f (uses `patrol` with `fallsOffLedges=false`,
  reversing on a timer); after 600 frames, or once the player has passed it, walks toward the
  player at 0.5 px/f. Volleys: every 90–150 frames (`world.rng`) throw 3 hammers 16 frames
  apart, arm-up frame during the wind-up. Hops every 180–300 frames: up if a solid row exists
  3–5 rows above (rise with tiles ignored until the apex, then normal `fall` lands on it), else
  down if there is ground 2–8 rows below (step off: skip tile collision for the first 16 px).
- Hammer: a `ProjectileSpec` `HAMMER` in `src/game/entities/projectiles/projectile.ts` next to
  `BOWSER_FLAME`: `damage 'contact'`, `hitsTiles:false`, `hitsPlayer:true`,
  `hitsEnemies:false`, `gravity 0x00200`, `lifetime 300`, 10×10 box, sheet `enemies`, frames
  `hammer-0/1`, frameRate 4. Thrown with `opts { vx: facing·(0x0c00 + rng), vy: -(0x3800 + rng) }`
  so it arcs ~4 tiles high and ~5 tiles far. Immune to the player's attacks (it is a projectile,
  not an enemy); Link's shield (`behaviour.blocks`) already blocks `hitsPlayer` projectiles.

### Balance lift (`src/game/entities/objects/balance-lift.ts` + `Lift` kind `'lift-balance'`)

- `Lift` (`src/game/entities/objects/lift.ts`) gains kind `'lift-balance'`: no autonomous
  motion; a `ridden` flag set in `carry()` and cleared at the start of `update()`; a
  `shift(dySub)` method; `drop()` sets `falling = true` (reuse the existing fall code).
- `BalanceLift extends Entity` (layer `'back'`, no collision body): created by `makeEntity`
  for `balance`; on its first `update(world)` it `world.spawn`s the two `Lift('lift-balance')`
  platforms (left at (x, y), right at (x2, y2), both `len`) and keeps the refs. Each frame:
  if exactly one platform is ridden it moves down 1 px/f and the other up 1 px/f (both ridden:
  nothing). When a platform's top rises to the pulley row (`y <= (top+1)*16`) both `drop()`
  and the rope goes slack (stop drawing vertical ropes). Render: `pulley` sprite (new 16×16
  items frame, drawn flipped for the right side) at each corner on row `top`, a 1-px rope line
  (`r.rect`, tan) along the top between the pulleys and down to each platform's centre.
- `World.resolveLifts` already carries players on every `Lift` instance, so the platforms
  work as soon as they are spawned.

### Art and registration

- `src/content/sprites/items.ts`: `pulley` (16×16: a grey wheel with a dark rim on a short
  cream bracket, indices 0/b/1/3); add to `tiles.test.ts` frame list.
- Editor (`src/game/scenes/editor.ts`): `hammer-bro` (enemies `hammer-bro-1`) and `balance`
  (items `pulley`) in `ENTITY_FRAMES` and the entity list.
- README: "Worlds 1 to 3"; mention Hammer Bros and balance lifts.

### Tests

- `src/content/levels/levels.test.ts`: `describe('World 3 …')`: 3-1 theme night, width 224,
  two `hammer-bro` entities at (113,8) and (116,12), spring at (126,12), vine brick (131,5)
  with zone to `3-1-sky` (4,14), pipe 38 9 → `3-1-bonus`, exit → `3-2`, `w` tiles in the pit at
  row 12 near column 77; 3-1 sky width 96 and `pit 0 -> 3-1 162 0`; 3-2 night with trees and
  exit → `3-3`; 3-3 two `balance` entities (82,6 → 89,8 and 137,5 → 141,8, `top: 2`), lifts,
  tree tops, exit → `3-4`; 3-4 castle with 4 Podoboos, fire bars, `lift-h 136 6`, Bowser 136 9,
  axe 141 8, exit → `4-1`.
- `tests/sim/world3.test.ts` (pattern from `tests/sim/world2.test.ts`, `at()` helper):
  Hammer Bro throws hammers that arc and hurt (big Mario → small) and is killed by a stomp for
  1000 points; it hops to another row within ~400 frames; a balance platform sinks while stood
  on and its partner rises by the same amount, stays put when left, and both fall when one is
  ridden past the pulley; every World 3 area loads and runs 60 frames; the 1-1 bot regression
  stays as is (World 3 is not bot-cleared).
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; smoke screenshots of 3-1, 3-3 and
  3-4; commit, push, open the PR (user merges).

## Previous step: regenerate World 1 from the original game's level data

The original Crossover source (MIT, github.com/JayPavlina/super-mario-bros-crossover) ships
`assets/documents/levelDataSmb.xml`: every SMB1 level as `<LEVEL ID TIME MAIN_AREA>` →
`<AREA ID TYPE>` → `<MAP>` with a flat comma list of 15 rows × W columns (row-major). A cell is
`0` or a stack of tokens joined by `()`, each `name&&Key=Value&&Flag…`, sometimes with a trailing
`]`. Difficulty variants use `HideOnDifficulties=easy|normal|hard|easynormal|normalhard|easyhard`;
we keep **normal** (drop tokens whose value contains `normal`). Our hand-made World 1 maps are
inaccurate; this step converts the original data into our `.map` files.

### Converter: `tools/levelgen/convert-smbc.mjs` (node, no deps)

- Usage: `node tools/levelgen/convert-smbc.mjs <path/to/levelDataSmb.xml> 1-1 1-2 1-3 1-4`.
  The XML is **not committed** (`tools/levelgen/source/` is gitignored; README says where to
  get it). The generated `.map` files are ours and are committed. The old generators
  `tools/levelgen/1-1.mjs` and `world1.mjs` are deleted (one source of truth); `lib.mjs` stays
  only if the converter reuses its text emitter, otherwise it goes too.
- Parsing: tokens → `{ name, params }`; filter by difficulty; strip `]`.
- **Tiles** (legend chars from `src/game/level/tiles.ts`): `groundNormal/groundWideNormal/
  groundSinglePiece → #`, `groundBlock → B`, `brick → =` (ContainedItem: `MultiCoin → C`,
  `Star → S`, `Mushroom → P`, `OneUpMushroom → L`, `Coin →` new legend char `E` = `BRICK_COIN`),
  `itemBlock → ?` (`Mushroom → M`, `OneUpMushroom → U`, `Star → *`; Crossover extras Clock/
  Atom/HudsonBee/PoisonMushroom → `?`), `itemBlockInvisible → 2` (`OneUpMushroom → 1`,
  `Mushroom → 3`), `coin → $`, vertical pipes `groundPipeTopLeft/Right → [ ]`,
  `groundPipeMidLeft/Right → { }`, horizontal pipe end `groundPipeEndLeftTop → (`,
  `groundPipeEndLeftBottom → <`, body/intersection top row → `)`, bottom row → `>`,
  `flagPole → !`, `flagPoleTop → o`, `groundFlagPoleBlock → B`, `groundMushroom → m`,
  `standardPlatformStem → i`, tree tops/trunks → `T`/`t`, `wavesLava → ~`,
  `bowserBridge → -`, `bridgeChain → :`. Castle areas keep `#` (the castle theme draws it).
- **Entities** (markers in the grid or `[entities]` lines): `enemyGoomba → g`,
  `enemyKoopaGreen → k`, `enemyKoopaRed → K`, `enemyPiranhaGreen/Red → r` (same column
  convention as our current maps, checked against `1-2.map`), `enemyBowser → b`,
  `bowserAxe → a`, `fireBarLeft → f`, `fireBarRight → F` (the `boxGray` under it → `B`),
  `springRed → s`, `enemyHamBro → h`, `lakituStart → l`, `movingPlatform` →
  `lift-h/lift-v/lift-fall len=<width>` by `type` (`WaveHorizontal → lift-h`, `WaveVertical →
  lift-v`, `StepFall → lift-fall`, `ConstantFall/ConstantRise → lift-v`), `castleSmall →
  decor-castle x 12`, `castleBig → decor-castle-big`. Crossover-only enemies (icicle, fly,
  crab, barrel) and podoboos are logged as skipped; on normal difficulty World 1 uses none.
- **Decor**: runs of `bushGreen` → `bush-1/2/3`, `hillSmall → hill-small`, `hillMedium →
  hill-big`, `cloudSingle/Double/Triple → cloud-1/2/3`, `railing/fence → fence`; `colorRed`
  and `sceneryText_*` (except the warp text) are ignored.
- **Zones and header**: `playerStart` → `start: x,y`; `halfwayPoint → checkpoint x`;
  `levelExit → exit x next=<next level>`; `scrollStop` at `width - 16`;
  `pipeTransporterGlobalVert&&pTransDest=<area|level>` on a pipe top → `pipe x y down ->
  <target> tx ty` where the target is the area's `pipeTransporterGlobalVertEnd` (matching
  `number`) or, for bonus rooms, the fall-in start; `pipeTransporterGlobalHorz&&pTransDest=a
  &&number=N` → `pipe x y right -> <main area> <VertEnd N position> exit=up`;
  `sceneryText_WelcomeToWarpZone` + `pTransDest=2-1|3-1|4-1` → the `warp` zone and three pipes.
- **Areas → ids/themes**: main area keeps the level id; sub-areas get our existing ids by a
  small table (`1-1 b → 1-1-bonus`, `1-2 a → 1-2-intro`, `1-2 c → 1-2-bonus`, `1-2 d →
  1-2-exit`) so other references keep working; theme/music from TYPE (`underGround`/`pipeBonus`
  → underground, `castle` → castle, else overworld); `time` from LEVEL for the main area,
  `inherit` for sub-areas; `startMode`: `pipeBonus → fall` (start column from playerStart,
  row 0), intro → `autowalk`, areas entered by a horizontal pipe → `pipe-exit` at the VertEnd,
  else `stand`; `camera: locked` for 16-wide areas; `parent` for sub-areas.
- Output written with the same layout as today's files (16-column screens with `;; N` rulers,
  `[entities]`, `[zones]`, `[decor]`), via `serializeTextMap`'s format so `parseTextMap` round-
  trips; the converter also prints, per level, how many tiles changed against the current file.

### Verification

- `pnpm check:levels` (the level test) parses the new files; landmark tests in
  `src/content/levels` are updated to the original's columns (first `?` block, pipe heights,
  hidden 1-up column, flagpole column, warp pipes, Bowser bridge) where ours were wrong.
- `tests/sim/world1.test.ts`: the autoplayer must still clear 1-1 to 1-4 with every hero; if a
  corrected layout defeats the bot, fix the bot, not the map.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; a Chromium drive through 1-1 as
  Mario with screenshots at the first pipe, the pyramid stairs and the flagpole; PR to `main`.

## Current step: title menu overflow + Link's sword-only block breaking

User feedback: (1) with Dev mode unlocked the title menu runs into the "ORIGINAL ART AND MUSIC"
footer; move **Level editor** and **How to play** into Options. (2) Link should not break blocks
with his head; the **up-thrust** opens them, and the up-thrust should be **hold up while
airborne** (like the down-thrust), no attack press.

### Menus

- `src/game/scenes/title.ts`: items become Start game, Custom levels, Options, Dev mode (when
  unlocked). Remove the How to play and Level editor entries (and the `GuideIndexScene` import).
- `src/game/scenes/options.ts` (`OptionsScene`): add **How to play** (pushes `GuideIndexScene`)
  after Controls and **Level editor** (calls `game.openEditor()`) before Back. The editor entry
  only appears when the menu is opened from the title (`!this.translucent`), since from pause it
  would abandon the level. The smoke script's menu navigation (`tools/smoke/screenshot.mjs`) is
  updated for the new order (Options is now the third title entry).
- README: Options list gains How to play and Level editor; the How to play paragraph says
  "Options → How to play".

### Link (`src/game/characters/link/index.ts`)

- `canBreakBricks: () => false`: a head bump only bumps a brick. Item blocks still pop their
  coin or power-up from a head bump (standard block behaviour); bricks only break with the sword.
- **Up-thrust**: `thrustingUp = !b.onGround && input.held('up') && p.attackTimer === 0 && p.stun === 0`
  (mirrors the down-thrust); while true, `p.scratch.upThrust = 1`, the melee box sits above the
  head (`x+2, y-10, 8×10`) and the update returns before the slash code, so pressing attack
  while holding up does nothing extra. Down takes precedence if both are held. Remove the
  old "up + attack press" branch and the `upThrust` reset tied to `attackTimer`.
- **Blocks from below with the sword**: while up-thrusting, look at the tile containing the top
  centre of the melee box (`tileAt(box.x + box.w/2)`, `tileAt(box.y)`). If it is a block tile
  (`tileDef(id).block`, hidden ones included so the sword can find hidden 1-ups like a head
  bump would) and `p.scratch.thrustTile` is not already that tile key, call a new public
  `World.strikeBlock(tx, ty, p, { breakBricks: true })` and remember the key; clear
  `thrustTile` when the box no longer overlaps a block. `strikeBlock` is `hitBlock` with an
  explicit `breakBricks` flag replacing the `p.def.canBreakBricks(p)` check (the head-bump path
  passes `p.def.canBreakBricks(p)`); `breakAt` keeps using the character default.
- Guide text (`link/guide.ts`): up-thrust row becomes `up` held in the air; mention that the
  sword, not the head, opens bricks.
- Tests (`tests/sim/link.test.ts`): existing up-thrust test keeps working (it holds up); add
  "a head bump leaves a brick intact" (jump under a brick with no up held: tile unchanged, bump
  only) and "an up-thrust breaks a brick overhead" (same jump holding up: tile becomes air,
  +50 score); and "an up-thrust pops a question block's coin" (coin count +1).

### Verification

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Smoke script: title screenshot with Dev mode unlocked shows four entries clear of the footer;
  Options shows How to play and Level editor. PR to `main`.

## Current step: per-character "How to play" guides

User request: a start-menu option that shows how each character plays (controls, power-ups,
tools). Decisions: the title menu lists every hero; the pause menu opens the guide for the hero
being played; a page shows the controls with the player's **actual** bindings, the power-ups and
tool belt, and a **live animated sprite** of the hero.

### Data: `CharacterDef.guide`

- `src/game/characters/character.ts`: add
  ```ts
  export interface CharacterGuide {
    tagline: string;                       // one line under the name
    controls: { action: Action | 'up+attack' | 'down+jump'; does: string }[];
    powerups: { item: 'mushroom' | 'flower' | 'star' | 'drops'; does: string }[];
    belt?: { name: string; icon: string; cost?: string; does: string }[];
    tips?: string[];
    /** Demo poses to cycle on the page, applied to a throwaway Player. */
    demo: ('idle' | 'walk' | 'jump' | 'attack' | 'crouch' | 'special')[];
  }
  ```
  and `guide: CharacterGuide` on `CharacterDef` (required, so every hero ships one).
- One `guide.ts` per hero folder (`characters/<id>/guide.ts`), imported into the def. Text is
  written for a 30-column bitmap-font page (the renderer wraps, so sentences can be natural).
  Mario and Luigi share one guide with the hero's name substituted.

### Rendering: `src/game/scenes/guide.ts`

- `GuideScene(game, def, onBack)`: opaque black page. Header: hero name (big, centred), tagline.
  Left column (x 16–120): the **live demo**: a throwaway `new Player(0, 0, def, power, hp)` with
  `scratch` from `def.devKit?.()` so the full kit shows (Fire Mario, helmet, white tunic...);
  every 90 frames it moves to the next `guide.demo` pose by setting `anim`, `walkFrame`
  (advanced every 6 frames), `body.onGround`, `attackTimer`, `crouching`, `scratch.ball` etc.
  through a small `applyPose(p, pose)` helper, then draws `def.sprite(p, frame, reduceFlashing)`
  via `assets.sheet(spec.sheet, spec.palette)` with flip and offsets (same math as
  `World.renderPlayer`). Right/below: the text pages.
- **Pages** (left/right or up/down flip, a `1/3` marker at the bottom, B/Select back,
  Start/A also goes to the next page):
  1. **Controls**: one row per `controls` entry: `JUMP  Z  (A)  [A]` — keyboard code from
     `settings.input.bindings[0].keyboard` (first code, via `describeCode`), gamepad in
     parentheses (new `describePad(code)` names the standard mapping: 0 A, 1 B, 2 X, 3 Y, 4 LB,
     5 RB, 8 Back, 9 Start, 12–15 d-pad, else `Button n`), touch label in brackets when the
     touch pad is on (`settings.input.touch !== 'off'`): jump A, attack B, special C, start
     START, select SELECT, d-pad for directions. Combined actions (`up+attack`) print both.
  2. **Power-ups**: mushroom / flower / star / drops rows with wrapped text.
  3. **Tool belt** (only for heroes with `belt`): icon from the `items` sheet, name, cost,
     effect; plus `tips`.
- Word wrap helper `wrapText(text, cols)` in `src/game/hud/text.ts` (unit-tested) shared with the
  page; lines that overflow the page scroll with up/down (keep `visibleRows` like `MenuScene`).
- Accessibility: on enter and on each page flip, `announcer.say` the page's lines joined.

### Entry points

- `src/game/scenes/title.ts`: new item **How to play** between Start game and Custom levels →
  `GuideIndexScene` (`MenuScene` subclass listing `game.deps.characters` by name, each → push
  `GuideScene`).
- `src/game/scenes/pause.ts`: new item **Guide** after Continue → `GuideScene(game.state.character)`
  (P2 is listed too when `state.character2`); returning pops back to pause.
- Character select: unchanged (no new button; the title and pause entries cover it).

### Verification

- Unit tests: `wrapText` (breaks on spaces, never exceeds the column count, keeps words);
  `guide.test.ts` asserts every character in `CHARACTERS` has a guide with a tagline, at least
  three controls whose actions are valid, mushroom/flower/star rows, and demo poses that
  `applyPose` accepts; `describePad` names.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Browser drive: title → How to play → Link → three pages with the live sprite cycling and real
  key names; pause in a level as Mega Man → Guide shows Mega Man; screenshots; no console
  errors. README: mention the guides.

## Previous step: reopen a PR for the commits the early merge missed

PR #8 was merged at commit 70655c4 (Samus art + Simon code). The seven commits pushed after
that (Simon art, Ryu code + lint fix + art, Bill code + art, select-screen underline) sit on
`claude/admiring-galileo-quy3ri` but not on `main`; a merged PR never reopens on later pushes.

- No code changes needed. Open a new pull request from the same branch to `main`; GitHub
  includes exactly the unmerged commits (`git log origin/main..origin/claude/admiring-galileo-quy3ri`).
- Body: Simon's art, Ryu and Bill in full, the select-screen cursor change, same test plan.
- Verification: the PR's commit list shows those seven commits and the checks run green; after
  the user merges, `main` fast-forwards to the branch head.

## Current step: more characters (Samus → Simon → Ryu → Bill), one PR each, full kits

User decision: build the rest of the original Crossover roster in this order, one complete
playable character per PR, each with its whole kit (like Link and Mega Man). Everything reuses
the Phase A–C systems: `CharacterDef` hooks (`tools`, `meter`, `drop`, `onPickup`, `blocks`,
`reserve`, `hudExtra`, `devKit`), `toolbelt.ts`, `Pickup`, `World.explode`, `ProjectileSpec`
options, `stun`, carried `kit`, `?kit=full`, the art-agent workflow and `tests/sim/*.test.ts`.

### Phase D: Samus (Metroid) — `src/game/characters/samus/{index,weapons}.ts`

**Shared additions (small)**

- `DamageModel.hudStyle` gains `'number'`: the HUD prints `EN` + the value padded to 2 under
  the name (Metroid style) instead of a bar; weapon `meter` for number-style characters is drawn
  as the horizontal bar at (24,33) (already the fallback path in `hud.ts`).
- `CharacterBehaviour.canJump?(p): boolean` consulted in `Player.update` next to `canJump`
  (ball form cannot jump).
- `World.explode(cx, cy, r, owner, opts?: { hurtsPlayers?: boolean; amount?: number })`:
  Samus's bombs do not hurt players and deal 1.
- `ProjectileSpec.wave?: { amplitude: number; period: number }`: in the free-move branch the y
  follows a sine around the spawn y (`originY` stored in the constructor); used with
  `piercesTiles`.
- `rules/damage.ts`: kind `'ice'` → `stun` in `BASIC_VULNERABILITY`; Bowser and Piranha immune;
  the Koopa `hit` override treats `ice` like `boomerang` (shells deflect it).
- `Pickup` kinds `energy-small` (+5 energy), `energy-large` (+20), `missile-pack` (+2
  missiles), frames `energy-orb-small` (8×8), `energy-orb-large` (16×16), `missile-pack`
  (16×16).

**Samus** (`scratch` keys: `varia`, `tanks` (0..2), `beam` (0 power, 1 long, 2 ice, 3 wave),
`missiles`, `tool`, `ball`, `aimUp`)

- Profile (TUNED): maxWalk 1.25 px/f, no run, walkAccel 0x100, releaseDecel 0x180, jump
  initial 0x4800 with hold/fall gravity 0x240 (apex ≈ 4.5 tiles), `variableJump: 'cut'`,
  `airControl: 'full'`. Damage model `hp`, `max: 99`, `hudStyle: 'number'`, start energy 30
  (`newGameState` uses `damage.max` for hp: add `CharacterDef.startHp?` read there and in
  `devStart`/`respawn`/death reset in `level.ts`), invulnFrames 40, knockback `{ vx: 0x1000,
  vy: 0x2000 }`. Contact costs 8 energy (Varia: 4); Bowser flame 15 (Varia 8). `stomps: false`,
  `crouches: false`.
- **Morph ball**: down on the ground → `scratch.ball = 1`, hitbox 12×12 (`hitbox` reads it), up
  → stand (only if there is head room: `map.isSolid` check on the two tiles above). In ball
  form `canJump` is false, movement is the walk speed, the sprite rolls (`ball-0..3` by x),
  B drops a **bomb** (`Bomb` entity with `fuse: 40`, radius 12, `hurtsPlayers: false`; if Samus
  is in ball form inside the blast she is pushed up at 2.5 px/f: bomb jumps). Up to 3 bombs.
- **Arm cannon** (B standing/airborne): holding up aims straight up (`aimUp`, `aim-up` frame,
  shot gets `vx: 0, vy: -speed`). Beams by `beam` level, one `beam` projectile on screen at
  a time plus one upward: Power (lifetime 20 frames at 4 px/f ≈ 5 tiles), Long (no lifetime),
  Ice (kind `ice`, stuns), Wave (`piercesTiles`, `wave { amplitude 8, period 24 }`, pierce).
  Frames `beam-0/1`, `ice-beam-0/1`, `wave-beam-0/1`.
- **Missiles** (C, or B when the belt has Missile selected): belt = Beam → Missile (count =
  `missiles`, start 0, max 30, `icon-beam`/`icon-missile`); straight, amount 3, breaks bricks
  on impact (`breaksBricks`), `missile` frame, `missile` sfx (reuse `buster` pitch-shifted MML).
- **Power-ups**: mushroom #1 → **Varia** (`samus-varia` palette, half damage, full heal); later
  mushrooms → **Energy Tank** (+30 max up to 99, full heal, max 2 tanks, then heal only).
  Flower → next beam (Long → Ice → Wave); afterwards +10 missiles. `blockPowerUp`: mushroom
  until Varia, then flower while beams remain, then alternate.
- **Drops**: `rng.int(12)`: < 4 energy-small, 4 energy-large, 5–6 missile-pack, else nothing.
- `devKit`: varia, tanks 2, beam 3, missiles 30. `hudExtra`: none (missiles show on the belt).
- Art (agent): sheet `samus` (16×32 frames facing right, feet on the bottom row): `idle`,
  `walk-0..2`, `shoot`, `walk-shoot-0..2`, `jump` (legs together, cannon forward), `spin-0..3`
  (somersault, 16×16 drawn in the lower half), `aim-up`, `ball-0..3` (16×16 lower half),
  `hurt`, `die`; palettes `samus` (orange/red suit, green visor), `samus-varia` (pink/orange),
  `samus-star-0..3`. Items: beams/missile/bomb frames above, `morph-bomb-0/1` (8×8), energy
  orbs, missile pack, `icon-beam`, `icon-missile`. Register in `src/content/sprites/index.ts`
  and `characters/registry.ts` (select screen spacing adapts; 5 heroes still fit at 44 px).
- Sim tests (`tests/sim/samus.test.ts`): ball rolls through a one-tile-high tunnel a standing
  Samus cannot enter; a bomb breaks a brick and bomb-jumps her; Power Beam dies after ~5 tiles
  while Long Beam reaches a far goomba; Ice Beam stuns and a second shot kills; Wave Beam passes
  through a wall to kill a goomba; a missile kills and decrements the count, none left refuses;
  up-aim hits a goomba overhead; Varia halves contact damage; a second mushroom raises max
  energy to 60; drops refill energy and missiles; cannot jump in ball form.
- README: Samus paragraph.

### Phase E: Simon Belmont (Castlevania) — outline, detailed when Phase D ships

Stiff committed jump (no air control, fixed arc), knockback on hit that can knock him into pits,
crouch; whip (B) with a wind-up of 8 frames and a 32 px reach, upgrades Leather → Chain (longer)
→ Morning Star from flowers; sub-weapons on the belt (Dagger, Axe arc, Holy Water that burns on
the floor, Cross boomerang, Stopwatch that freezes enemies) found in item blocks instead of
mushrooms once past the first; **hearts** dropped by enemies as sub-weapon ammo (heart-small
already exists, add `heart-large`); double/triple shot from flowers after Morning Star; 16 HP
bar; stairs are not needed in SMB levels. Art: `simon` sheet, whip frames, sub-weapon items.

### Phase F: Ryu Hayabusa (Ninja Gaiden) — outline

Fast run, `wallCling`: pressing toward a wall while airborne sticks to it (new Player state;
jump off it), sword (B) with a short wide arc; **ninpo** meter from drops: Windmill Shuriken
(returning, uses `returns`), Fire Wheel (three orbiting flames via `orbit`), Jump-and-Slash
(down + attack airborne: spinning blade); flowers add ninpo max, mushroom = extra heart. 16 HP.

### Phase G: Bill Rizer (Contra) — outline

Rifle with eight-way aim (held direction at fire, including straight up and diagonals while
jumping), prone with down (hitbox 8 tall, fires along the floor), unlimited bullets; flowers
cycle weapons (Machine Gun → Spread → Laser → Flame), mushroom = extra hit (barrier for 10 s
from the star); 3 HP (hits), contact-only damage; drops: weapon capsules.

### Verification (every phase)

`pnpm lint && pnpm typecheck && pnpm test && pnpm build`, the sim tests listed, a Chromium drive
with `?level=1-1&char=<id>&kit=full` and screenshots of the kit in use, README updated, PR to
`main`; the character joins `CHARACTERS` so the select screen, dev level select and co-op pick
it up.

## Previous step: character mechanics and power-ups

### Research summary

- **SMB1 jumps**: standing jump clears exactly 4 blocks, walking 5. Ours peaks at 62 px (gravity is
  applied before the first move) so 4-block pipes need a run. Fix: integrate position first, then
  gravity → standing 66 px, running ~82 px. Walking-jump "speed burst": `player.ts` lines 167 and
  253 use `>= maxWalk` to decide running, so a jump at exactly max walk speed gets the run air cap
  and run acceleration. Fix: `>`.
- **Original Crossover Link** = Zelda II Link: sword, down-thrust, stunning boomerang, never grows;
  mushroom = white tunic (defense), flower = red tunic + sword beam. Zelda II adds up-thrust,
  shield, magic (Jump/Shield/Fire/Life/Thunder), magic jars and P-bags. User wants the Zelda II kit
  plus **bombs** (Zelda I).
- **Original Crossover Mega Man**: mushroom = helmet (charge shot, break bricks), flower = weapon
  change; later versions: boss weapons with weapon energy from enemy drops, Select to switch, Rush
  Coil. User wants the full weapon set.
- **Mario**: user wants Luigi as a hero; Star and 1-Up already exist (1-1 col 101 brick, hidden
  block col 64) and must be verified.

### Phase A: physics fixes + Luigi (first PR)

- `src/game/entities/player.ts`: strict `>` for the run checks; move then apply gravity (hold
  gravity still chosen by the jump-held rule evaluated before the move). Update
  `player.test.ts` expectations: standing apex 64–70 px, running 80–88, walking jump clears a
  64 px wall in a new test (`flatMap` with a 4-high pipe).
- `src/game/characters/luigi/index.ts`: `CharacterDef` reusing Mario's sprite function with
  palettes `luigi`/`luigi-fire` (already exist) and `hudName: 'LUIGI'`; profile = Mario's with
  `initial` +0x600 on every tier, `releaseDecel`/`skidDecel` halved, `walkAccel`/`runAccel` ×0.85
  (Lost Levels feel). Register in `characters/registry.ts` (select screen + dev level select pick
  it up automatically; spacing already adapts).
- Tests: Luigi standing apex > Mario's; star makes contact kills (sim); hidden 1-Up block pops a
  1-Up that adds a life (sim). Star/1-Up are reachable via dev level select power/levels.

### Phase A: DONE (PR #5)

### Phase B: shared systems + Link's Zelda II kit with bombs (second PR)

Shared systems and Link ship together so the PR is playable (systems alone would have no visible
effect). Everything below reuses the existing `Player.scratch` record, `World.rng` (seeded),
`World.nearestPlayer`, `Enemy.hit` reactions, `World.hitBlock` (bricks/contents) and the
`Flash`/`Corpse` effects.

**Shared systems**

- `rules/damage.ts`: `DamageKind` gains `'bomb' | 'boomerang' | 'weapon'`; `Reaction` gains
  `'stun'`. `BASIC_VULNERABILITY`: bomb/weapon → kill, boomerang → stun. Bowser: bomb → hp (2),
  boomerang → immune; piranha/firebar: boomerang → immune. Koopa (walking) boomerang → stun.
- `entities/enemies/enemy.ts`: `stunned = 0` frames; `hit()` handles `'stun'` (sets 180 frames,
  `contactHurts` suspended while stunned, any later hit kills); the world's entity update loop
  skips `update()` for stunned enemies (they stand still, drawn with a palette flicker). Add a
  protected `onKilled(src, world)` called from `squash`/`flipOut`/hp-death that calls
  `world.enemyKilled(this, src)`.
- **Drops**: `CharacterDef.drop?(rng: Rng, enemy: Enemy): PickupKind | null`.
  `World.enemyKilled(e, src)` finds the killer (`src.owner` is a Player or a Projectile with a
  Player owner, else `nearestPlayer`) and spawns a `Pickup` at the enemy's position.
  `entities/objects/pickup.ts`: `PickupKind = 'bomb' | 'magic-small' | 'magic-large' |
  'heart-small' | 'health-small' | 'health-large' | 'weapon-small' | 'weapon-large' | 'e-tank'`;
  falls with `fall()`, no horizontal motion, lifetime 480 frames, blinks the last 90, collected on
  overlap → `behaviour.onPickup?(p, kind, world)` (returns false to leave it lying there, e.g.
  full ammo).
- **Tool belt** (`characters/toolbelt.ts`): `ToolInfo { id; icon: string (items frame); count:
  number | null; usable: boolean }`; `CharacterDef.tools?(p): ToolInfo[]`; helper
  `cycleTool(p, input, tools)` → `p.scratch.tool` index wraps on `pressed('select')`, plays the
  `select` sfx; `activeTool(p, tools)`. `special` (C) is handled by each character's `update`.
- **Projectile spec** (`entities/projectiles/projectile.ts`) optional fields: `vy` (initial
  vertical speed, 8-way aim), `homing: { turn, maxSpeed }` (steer toward the nearest live enemy),
  `orbit: { radius, step }` (follows the owner until `thrown`), `arc: true` (gravity, destroyed on
  landing), `breaksBricks: true` (a wall hit on a brick calls `world.hitBlock`), `blocks: true`
  (a player projectile that destroys enemy projectiles it overlaps), `returns: { after }`
  (boomerang: reverses after N frames, destroyed when it overlaps the owner), `piercesTiles`.
  `World.projectile` gains the enemy-projectile-vs-blocking-projectile check and asks
  `behaviour.blocks?(p, proj)` before hurting the player (Link's shield).
- `World.explode(x, y, radiusPx, owner)`: spawns `Explosion` (effects, 3 frames × 8), applies
  `bomb` damage to overlapping enemies (scored), calls `hitBlock` on bricks in the radius, and
  `hurtPlayer` on overlapping players.
- **HUD** (`hud/hud.ts`): active tool icon at (96,24) with `×NN` count when `count !== null`;
  `CharacterDef.meter?(p): { value, max, colour } | null` drawn as a horizontal 32×3 bar at
  (24,33) for P1 (Link's magic); Mega Man's weapon energy bar is left to Phase C.
- **Dev menu**: the Level select "Power" row for hp characters additionally sets the tool unlocks
  (`fullKit: boolean`) so bombs/magic can be tested without farming drops.

**Link** (`characters/link/index.ts`, `scratch` keys: `maxHp`, `beam`, `tunic`, `bombs`, `magic`,
`tool`, `jumpSpell`, `shieldSpell`, `fireSpell`)

- Mushroom: heart container + full heal as now **and** the white tunic (`link-white`, half
  damage: hurt costs a heart every other hit via a `scratch.halfHit` toggle) once hearts are
  maxed; flower: red tunic + beam (as now). Up-thrust: up + attack airborne, 8×8 box above the
  head (`up-thrust` frame). Shield: standing/walking and not attacking, `blocks()` returns true
  for projectiles arriving from the facing side.
- Tools (Select cycles, C uses): Boomerang (free; one in flight; `returns` after 36 frames,
  speed 3 px/f, `boomerang` damage) → Bomb (ammo `scratch.bombs`, max 8; placed at the feet,
  `Bomb` entity with a 90-frame fuse then `world.explode` radius 28 px; also hurts Link) →
  Jump spell (8 magic, 600 frames of jump `initial` ×1.25 via a `profile` swap) → Shield spell
  (8 magic, 600 frames of half damage) → Fire spell (4 magic, next sword swing fires a beam).
  Magic meter 0–32, starts full; `drop`: 1 in 4 kills bomb, 1 in 4 magic-small, 1 in 16
  heart-small (half heart); `onPickup` refills.
- Art (one agent, original work in the existing text format, validated by `validateDef`
  tests): items frames `bomb-0/1`, `explosion-0..2` (32×32), `boomerang-0..3` (8×8),
  `magic-jar-small/large`, `heart-small`, `icon-boomerang/bomb/jump/shield/fire` (8×8); Link
  frames `up-thrust`, `block`, `throw`; palette `link-white`.
- Sim tests (`tests/sim/link.test.ts`): boomerang stuns a goomba and a sword hit then kills it;
  bomb kills a goomba and breaks a brick; shield destroys a Bowser flame; up-thrust hits a koopa;
  Jump spell raises the apex and drains 8 magic; white tunic halves damage; a dropped bomb pickup
  raises the ammo count.

### Phase B: DONE (PR #6)

### Phase C: Mega Man's full weapon set (third PR) — `characters/megaman/index.ts`

Everything rides on the Phase B systems: `tools`/`cycleTool`/`activeTool`
(`characters/toolbelt.ts`), `meter`, `drop`/`onPickup` + `Pickup`, `ProjectileSpec` options
(`vy`, `homing`, `orbit`+`throw()`, `breaksBricks`+`piercesTiles`, `blocks`, `pierce`), the
`weapon` damage kind, `devKit`, carried `scratch` (`kit`).

**Power-ups** (scratch keys: `helmet`, `weapons` = how many unlocked 0..5, `tool`, `wsaw`,
`wleaf`, `wflame`, `wknuckle`, `wbolt`, `wrush` = energy 0..28 (`?? 28` when unset), `etanks`,
`chargeT`)

- Mushroom → **helmet** (`helmet = 1`): charge shot, bricks break, Rush Coil unlocked, full heal.
  Hits never remove it. Without the helmet the sprite uses a new `megaman-plain` palette (dull
  grey-blue armour); with it, the normal blue. Flower → unlocks the next weapon in order (saw,
  leaf, flame, knuckle, bolt) and heals; once all five are unlocked it refills every weapon.
  `blockPowerUp`: mushroom until helmeted, then flower while weapons remain, then mushroom.
  `canBreakBricks: (p) => !!p.scratch.helmet`.
- **Belt** (`tools`): Buster (`icon-buster`, count null) → each unlocked weapon → Rush Coil (when
  helmeted). B always fires the buster; **C fires the active tool** (buster when Buster is
  selected). `meter` shows the active weapon's energy (max 28, weapon colour, label `W`); for
  `hudStyle === 'bar'` the HUD draws it as a second vertical bar at x = 16 beside the health bar
  instead of the horizontal bar. Palette per active tool: `megaman-saw` (grey/white),
  `megaman-leaf` (green), `megaman-flame` (red/orange), `megaman-knuckle` (purple),
  `megaman-bolt` (yellow), `megaman-rush` (red); charge/star palettes still win.
- **Weapons** (`ProjectileSpec`s in `characters/megaman/weapons.ts`, all `damage: 'weapon'`,
  owner = player; an empty or too-low meter refuses with the `bump` sfx):
  1. **Saw Disc** (2 energy): 8-way aim from the d-pad held when firing (`vx`/`vy` option, 3
     px/f), `piercesTiles` + `breaksBricks`, `pierce`, lifetime 90, 16×16 `saw-disc-0/1`.
  2. **Leaf Guard** (4): `orbit { radius 20, step 12 }`, `blocks`, `pierce`, lifetime 240,
     `leaf`; pressing C again while it orbits calls `throw(facing)`. One at a time.
  3. **Flame Wave** (3): 2 px/f, `hitsTiles` with gravity and no bounce (hugs the floor, drops
     off ledges), `pierce`, lifetime 60 (≈ 5 tiles), `flame-wave-0/1`. Shells die to `weapon`
     via `BASIC_VULNERABILITY`.
  4. **Homing Knuckle** (4): 1.5 px/f, `homing { turn 0x200, maxSpeed 0x2000 }`, amount 3,
     `hitsTiles: false`, lifetime 180, `knuckle`.
  5. **Bolt** (5): 12 px/f (under the 16 px collision limit), 24×8, amount 2, `pierce`,
     `hitsTiles: false`, `bolt-0/1`: crosses the screen in ~20 frames.
- **Rush Coil** (3 energy, `entities/objects/rush-coil.ts`): placed one tile ahead, falls, lasts
  300 frames; a player whose feet land on its top while falling is launched at 1.6× their jump
  tier's `initial` (`jumping = true` so hold-gravity applies) with the `jump-big` sfx, and the
  coil leaves. One at a time.
- **Drops** (`drop`, `rng.int(60)`): < 12 `health-small` (+4), < 16 `health-large` (+10), < 28
  `weapon-small` (+4 to the active weapon's energy; left lying when Buster is selected or full),
  < 32 `weapon-large` (+10), 32 or 33 `e-tank` (stored, max 4), else nothing. `PickupKind` gains
  these five with frames `pellet-small/large`, `weapon-pellet-small/large`, `e-tank`.
- **E-tanks**: `CharacterDef.reserve?: { label(p): string | null; use(p, world): boolean }`;
  `LevelScene` passes its world to `PauseScene`, which adds a **Use E-tank (n)** entry when the
  label is non-null (full heal, `etanks--`, `powerup` sfx, pop). HUD shows `E×n` at (24,24) via
  `CharacterDef.hudExtra?(p): string | null` when n > 0.
- `devKit`: helmet, all five weapons, full energy, 2 E-tanks.
- Art (one agent, original, text format, tests updated): items `saw-disc-0/1`, `leaf`,
  `flame-wave-0/1`, `knuckle`, `bolt-0/1` (24×8), `rush-coil-0/1`, `pellet-small` (8×8),
  `pellet-large`, `weapon-pellet-small` (8×8), `weapon-pellet-large`, `e-tank`, icons
  `icon-buster/saw/leaf/flame/knuckle/bolt/rush` (8×8); palettes `megaman-plain`, `megaman-saw`,
  `megaman-leaf`, `megaman-flame`, `megaman-knuckle`, `megaman-bolt`, `megaman-rush` in
  `src/content/sprites/megaman.ts` (same index roles).
- Sim tests (`tests/sim/megaman.test.ts`): flowers unlock weapons in order and the belt grows;
  energy drops by the cost and an empty weapon refuses to fire; the saw disc breaks a brick in
  its path; the flame wave kills a resting shell; the knuckle turns to hit a goomba behind and
  above; the bolt kills a goomba at the far side of the screen; Rush Coil launch beats the normal
  apex by ≥ 1.4×; pickups heal, refill the active weapon and store an E-tank, and `reserve.use`
  restores full HP; bricks only break with the helmet. Update
  `tests/sim/characters.test.ts` where the charge shot moved from flower to mushroom.
- README: Mega Man paragraph (helmet, weapons, Rush, drops, E-tanks, Select/C).

### Verification

- Per phase: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, new sim tests above, a
  browser drive with screenshots (Luigi select, Link tool belt HUD, Mega Man weapon switch), PR
  to `main`.

## Previous step: assists move into dev mode; dev menu reachable from pause

User request: the "Assists" page (scroll back, infinite lives/time, no damage, keep big, coyote
time, slow motion) leaves Options and lives only in the dev menu, and the dev menu opens from the
pause menu during play when dev mode is unlocked.

### Changes

- `src/game/scenes/options.ts`: remove the **Assists** entry from `OptionsScene`; export
  `AssistOptionsScene` (unchanged content) so the dev menu can reuse it.
- `src/game/scenes/dev.ts`: `DevMenuScene(game, opts: { fromPause: boolean })`, translucent when
  opened from pause (same pattern as `OptionsScene`'s `translucent` flag; pass it on to the level
  select and assists sub-scenes). Rows: **Level select**, **Assists**, **Dev mode off**, **Back**.
  "Dev mode off" from pause pops back to the pause menu and rebuilds it (entry disappears); from
  the title it returns to the title.
- `src/game/scenes/pause.ts`: rebuild items on `enter()`; when `game.devMode` add **Dev mode**
  (between Options and Quit) that pushes `DevMenuScene` with `fromPause: true`.
- `src/game/scenes/dev-level-select.ts`: accept a `translucent` flag; starting a level from pause
  simply calls `game.devStart` (replaces the current level).
- Assists only take effect while dev mode is on: in `src/main.ts` `applySettings()`, apply
  `settings.assist` when `settings.dev`, otherwise `DEFAULT_ASSIST` and `stepDivider = 1`. The
  stored assist values are kept so re-enabling dev mode restores them.
- `src/game/scenes/level.ts`: each frame sync `world.camera.allowLeftScroll` from `ctx.assist`
  so toggling it in the pause-time dev menu applies immediately (other assists already read
  `ctx.assist` live; slow motion is the loop's `stepDivider`).
- README: update the Options list (assists now under Dev mode, with the unlock code).

### Verification

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Browser drive: Options no longer lists Assists; unlock dev mode, start a level, press Enter →
  pause shows **Dev mode** → Assists → toggle "No damage" → resume; the dev menu's Level select
  from pause starts the chosen level. Without dev mode, pause has no Dev mode entry and assists
  are inactive even if previously set.
- Push to the feature branch and open a PR to `main`.

## Previous step: secret developer mode with a level selector

The user wants a hidden developer mode for testing, starting with a level selector. Decisions:
unlock with a cheat code on the title screen (up up down down left right left right B A, works on
keyboard, gamepad and the touch d-pad) or `?dev=1`; the selector picks level, character and
starting power state, and starts with 99 lives.

### Changes

- `src/engine/save/settings.ts`: add `dev: boolean` (default false) to `Settings`; the merge loader
  fills it in for existing saves.
- `src/game/scenes/cheat.ts` (new): `CheatCode` class with `feed(input: InputFrame): boolean`
  that advances through a sequence of actions using `pressed()`, resets on a wrong press, and
  returns true on completion. Unit test `cheat.test.ts` with a fake InputFrame (correct sequence,
  wrong key resets, works after a reset).
- `src/game/scenes/title.ts`: feed each frame to the cheat code; on match set `settings.dev = true`,
  `applySettings()`, play the `1up` sfx, announce "Developer mode unlocked", rebuild the menu.
  When `settings.dev` is on, add a **DEV MODE** menu entry and draw a small `DEV` tag next to the
  version string.
- `src/main.ts`: `?dev=1` / `?dev=0` in the URL sets `settings.dev` before the title shows.
- `src/game/scenes/dev.ts` (new): `DevMenuScene extends MenuScene` with entries **Level select**,
  **Dev mode off** (sets `settings.dev=false`, saves, back to title), **Back**. Designed so later
  dev tools (free camera, hitboxes, invincibility toggles) are more rows here.
- `src/game/scenes/dev-level-select.ts` (new): `MenuScene` rows adjusted with left/right:
  - **Level**: cycles all built-in ids from `levelIds()` (`src/content/levels/index.ts`, sorted
    naturally so 1-1, 1-1-bonus, 1-2… order holds) plus custom library levels (`loadLibrary()`,
    ids via `customLevelId`). Passed in through a new `GameDeps.listLevels()`.
  - **Character**: cycles `game.deps.characters`.
  - **Power**: for `damage.kind === 'powerup'` cycles `small / big / fire`; for hp characters
    cycles `full / half / 1 hp`.
  - **Start**: `game.devStart(levelId, character, power)` → `newGameState(character)`,
    `lives = 99`, `powerState`/`hp` set from the choice, `playtestDone = null`,
    `goToLevel(levelId, { mode: 'stand' })`. The world intro card shows the real world/stage.
- `src/game/scenes/game.ts`: add `devStart(...)`, `showDevMenu()`, and `listLevels` in `GameDeps`.

### Verification

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (new tests: cheat matcher, settings
  default).
- Smoke: on the title, type the code on the keyboard → the DEV MODE entry appears and the DEV tag
  shows; open Level select, choose `1-4` + Link + full → the castle loads as Link with 99 lives.
  Chromium iPhone emulation shows no console errors.
- Push to the feature branch and open a PR to `main`.

## Previous step: no sound on iPhone

The site is live and plays on the phone, but there is no audio. Two iOS Safari behaviours explain
it, and the fix covers both:

1. Web Audio only starts inside a gesture Safari counts as user activation. We unlock on
   `pointerdown` (`src/main.ts:44-47`), which WebKit does not always treat as activation; the
   touch pad also calls `preventDefault()` on it. `touchend`, `click` and `keydown` are reliable.
2. With the ring/silent switch on, iOS mutes Web Audio entirely unless the page has played an
   HTML5 `<audio>` element once inside a gesture (this flips the audio session to "playback").

### Changes

- `src/engine/audio/audio-manager.ts`
  - `unlock()`: after creating/resuming the context, also play a one-sample silent buffer
    through `ctx.createBufferSource()` (the classic iOS unlock), and once per page play a tiny
    silent WAV data URI through a hidden `<audio playsinline>` element to defeat the silent
    switch (ignore the play() promise rejection). Keep both idempotent.
  - Resume on any later gesture when `ctx.state !== 'running'` (iOS reports `'interrupted'`
    after a phone call or backgrounding); also listen to `visibilitychange` and resume when the
    page becomes visible.
- `src/main.ts`: register `unlock` on `keydown`, `pointerdown`, `touchend`, `click` and
  `gamepadconnected`; keep the listeners (do not remove after first call) so interruptions recover.
- `src/game/scenes/options.ts` (Audio page): add a read-only "Status" row showing
  `not started / running / suspended` from `audio.state` so the user can see whether audio is
  unlocked, and a note line "Check the silent switch" when on iOS and not running.
- Expose `get state(): string` on `AudioManager` (and in `AudioSink` as optional).
- **Visible version on the title screen** (user request): in `vite.config.ts` add
  `define: { __APP_VERSION__: JSON.stringify(\`${pkg.version}-${shortSha}\`) }` where `pkg.version`
  comes from `package.json` (bump to `0.1.0`) and `shortSha` is `git rev-parse --short HEAD` via
  `child_process.execSync` (falls back to `dev` if git is unavailable). Declare the global in
  `src/vite-env.d.ts`. `TitleScene.render` draws it bottom-right in the bitmap font, e.g.
  `V0.1.0-E019862`, so every deploy is distinguishable at a glance. Also log it to the console on
  boot.

### Verification

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Chromium smoke (`tools/smoke/screenshot.mjs`) still runs clean; iPhone emulation shows no
  console errors (the silent WAV element must not throw when autoplay is refused).
- Real device: open the Pages URL, tap once; title music should play with the silent switch in
  either position. Options → Audio → Status reads "running".
- Push to the feature branch, open a PR to `main`, user merges, Pages redeploys.


## Context

Super Mario Bros. Crossover (Exploding Rabbit, 2010) was a Flash fan game that let you play the
Super Mario Bros. 1 levels as characters from other NES games (Link, Mega Man, Samus, Simon Belmont,
Bill Rizer, Ryu Hayabusa, Sophia III), each keeping their own game's mechanics. Flash is dead, the
original ActionScript source was never published, and the game is now only playable through
Flashpoint or Ruffle. The user wants a from-scratch reimplementation that is:

1. **More accessible**: runs in any modern browser and on phones, deploys as static files, supports
   gamepad/touch/remappable keys, and has real accessibility options.
2. **Improved**: modern engine, data-driven levels and characters, tests, saves.
3. **Expanded**: level editor with sharing, local co-op, more characters and worlds over time.

The repo `jelloshooter848/SMBC` is empty (no commits, no files, remote has no branches). Everything
is greenfield; there is nothing to reuse. Work goes on branch `claude/admiring-galileo-quy3ri`.

## Decisions made with the user

| Topic | Decision |
|---|---|
| Stack | TypeScript (strict) + Canvas 2D + Vite, no game framework, zero runtime deps. Static build to GitHub Pages. |
| Milestone 1 | World 1 (1-1 overworld + bonus room, 1-2 underground + warp zone + exit area, 1-3 treetops, 1-4 castle + Bowser) with **Mario, Link, Mega Man**. |
| Levels | Faithful tile-for-tile transcriptions of the SMB1 World 1 layouts, hand-authored from public maps (iterative, verified with a debug viewer). |
| Art & music | **Original** NES-style pixel art stored as text pixel arrays and rasterized at load; **original** chiptune synthesized with Web Audio (NES APU-lite). No ripped Nintendo/Capcom/Konami sprites or music are ever committed; CI rejects binary image/audio files. |
| Asset packs | Loader lets the user drop sprite sheets / audio into a gitignored `user-packs/` folder or load them in-browser (IndexedDB), overriding built-ins, so a local copy can use rips without the repo containing them. |
| Later phases | Mobile touch + gamepad + remapping; accessibility options; level editor + share links; local 2-player co-op; worlds 2-8 and more characters. |

Environment: npm registry and GitHub reachable; kenney.nl, OpenGameArt, itch.io blocked. So all
default assets are generated in-repo (which is the design anyway).

## Architecture

### Repo layout

```
.github/workflows/{ci.yml,deploy.yml}   lint+typecheck+test+build; Pages deploy on main
index.html  vite.config.ts  tsconfig.json  eslint.config.js  .prettierrc  package.json
user-packs/            gitignored (README kept)
tools/check-levels.ts  parses every .map, prints width/entity counts, fails on error
tools/export-sprites.ts  optional: pixel arrays -> PNG templates for pack authors (node:zlib, no deps)
tests/scripts/*.json   input scripts for the headless sim
tests/sim/*.test.ts    full-level regression runs
src/main.ts            bootstrap: viewport, input, audio unlock, assets, scene stack
src/engine/            game-agnostic
  loop.ts scene.ts viewport.ts rng.ts
  math/{units,aabb}.ts
  input/{actions,bindings,keyboard,gamepad,touch,input-manager}.ts
  gfx/{pixelart,spritesheet,palette,animation,tileatlas,renderer,font}.ts
  audio/{apu,mml,sequencer,sfx,audio-manager}.ts
  assets/{registry,manifest,builtin,pack-loader,idb}.ts
  save/{storage,settings,progress,migrations}.ts
src/game/
  constants.ts
  level/{schema,textmap,tiles,themes,zones,index}.ts
  world/{world,camera,tile-collision,spawner}.ts
  entities/{entity,body,player,player-states}.ts
  entities/enemies/{goomba,koopa,piranha,bowser,firebar}.ts
  entities/objects/{block,coin,powerup,lift,flagpole,axe,bridge,pipe}.ts
  entities/projectiles/{projectile,fireball,buster-shot,bowser-flame}.ts
  entities/effects/{brick-fragment,score-popup,block-bump}.ts
  characters/{character,registry}.ts + mario/ link/ megaman/ (def.ts, profile.ts, behaviour.ts)
  rules/{damage,kill-rules,scoring,powerups}.ts
  hud/hud.ts
  scenes/{title,character-select,level,pause,level-clear,castle-clear,game-over}.ts
  sim/{headless,input-script}.ts
src/content/
  levels/world1/{1-1,1-1-bonus,1-2,1-2-warp,1-2-exit,1-3,1-4}.map
  sprites/{font,tiles-overworld,tiles-underground,tiles-castle,mario,link,megaman,enemies,objects}.ts
  palettes.ts  music/*.ts  sfx/sfx.ts
```

npm scripts: `dev`, `build` (tsc --noEmit && vite build), `test` (vitest run), `lint`
(eslint + prettier --check), `typecheck`, `check:levels`. Dev deps only: vite, typescript, vitest,
eslint, typescript-eslint, prettier. Package manager: pnpm. Code license: MIT (confirm with user);
original art/music under the same repo license.

### Core engine

- **Units** (`engine/math/units.ts`): integers everywhere, NES style. Position in 1/256 px
  subpixels; velocity and acceleration in 1/4096 px/frame so SMB1 hex constants drop in unchanged.
  Per frame `x += vx >> 4`. Floor semantics like the NES. Determinism for the sim and replays.
- **Loop** (`engine/loop.ts`): fixed 60 Hz stepper on rAF, accumulator clamped at 250 ms, max 4
  catch-up steps, no render interpolation (positions are integer pixels). Assist "time scale"
  skips steps (0.5x = step every other frame) so physics stays deterministic.
- **Scenes** (`engine/scene.ts`): `Scene { enter, exit, update(input), render(r), translucent }`
  and a `SceneStack` (push/pop/replace). Pause renders over the level.
- **Viewport** (`engine/viewport.ts`): 256x240 backbuffer (OffscreenCanvas with hidden-canvas
  fallback), `imageSmoothingEnabled=false`, integer scale in device pixels, letterbox, optional
  stretch setting.
- **Camera** (`game/world/camera.ts`): x only (SMB1 never scrolls vertically). Pushes right when
  player passes screen x 80, clamped to level width, right-only unless the `allowLeftScroll`
  assist is on. Player clamped at the left screen edge.

### Input (`engine/input/`)

Actions: `left right up down jump attack special start select`. `attack` = run/fire for Mario,
sword for Link, buster for Mega Man; `special` = slide / down-thrust. `InputFrame` exposes
`held/pressed/released` plus a 4-frame jump buffer. Sources implement `poll(): Set<code>`:
keyboard (`e.code`, defaults arrows + Z/X/C, WASD alternates), gamepad (standard mapping, axis
deadzone 0.5), touch (phase 4). `InputManager` holds one `PlayerBindings` per player, samples once
per fixed step, and offers `captureNext()` for the remap UI. The sim substitutes a scripted
`InputFrame`. Coyote time off by default (SMB1 has none), available as an assist.

### Level format

Runtime `LevelData` (schema v1): id, name, theme, music, time, width, 15 rows of legend chars,
`entities[]`, `zones[]` (pipe links, warp area, checkpoint, exit, text trigger, scrollStop), start.
Entities spawn when their column enters `camera.x + 272`, despawn a screen to the left, never
respawn (tracked per column).

Hand-authored `.map` text files (`game/level/textmap.ts`, imported with `?raw`): a header block,
optional `[legend]` aliases over the shared vocabulary in `level/tiles.ts`, a `[tiles]` block of 15
rows written as space-separated 16-column screens with `;; screen N (x=..)` rulers, an
`[entities]` block for anything needing props, and `[zones]`. Lower-case chars on air cells are
entity markers (g goomba, k koopa); multi-tile objects (pipes, flagpole, castle) expand from an
anchor char. Ragged rows are parse errors with row/col. Sub-areas (bonus room, warp zone, pipe
exit) are separate files linked by pipe zones, like SMB1 itself.

### Physics and collision

- `Body { x y w h vx vy onGround hitHead hitWall carriedBy }`. Max speed is 5 px/frame < 16, so
  collision is: move X, resolve leading edge; move Y, resolve, report head-bumped tile (tile under
  body center; nudge sideways if within 4 px of a block edge next to air, SMB1 corner forgiveness).
- Tile collision kinds `none | solid | top`. Lifts are entities with a `top` surface; order per
  frame: lifts move, riders are carried, riders move, landing check. Kinds: `lift-v` (wraps),
  `lift-h` (bounded), `lift-fall` (drops when stood on).
- **Mario profile** (`characters/mario/profile.ts`), cited SMB1 values in 1/4096 px/frame:
  minWalk 0x130, walkAccel 0x98, runAccel 0xE4, releaseDecel 0xD0, skidDecel 0x1A0, maxWalk
  0x1900, maxRun 0x2900, skidTurnaround 0x900; jump tiers by |vx| at takeoff: <1.0 px/f: v0 4.0,
  gravity 0.125 held / 0.4375 falling; <2.3125: 4.0, 0.117/0.375; else 5.0, 0.156/0.5625; max fall
  4.5 resets to 4.0 (keep the quirk); run cap persists 10 frames after release. Expected results
  that become tests: standing jump apex 64 px, full-run jump 80 px.
- `MovementProfile` also has `airControl`, `canRun`, `variableJump: boolean | 'cut'`,
  `instantAccel`, `slide`. Link: fixed-height heavier jump, no run. Mega Man: instant accel,
  ~1.375 px/f, tall cut-able jump, slide (down+jump, 24 frames, 8 px hitbox). These two are tuned
  by feel and marked `// TUNED`.

### Character system (the main extension point)

One shared `Player` entity runs movement, states, invulnerability, pipes, flagpole, death.
Characters are data plus a small behaviour object:

```ts
interface CharacterDef { id; name; sprites; hitbox per state; movement: MovementProfile;
  damage: { kind:'powerup'; states:['small','big','fire'] } | { kind:'hp'; max; hudStyle:'hearts'|'bar'; invulnFrames; knockback? };
  stomps: boolean; attack?: projectile | melee; behaviour: CharacterBehaviour; music?; hud }
interface CharacterBehaviour { update(p, input, world); onPowerUp(p, kind, world);
  resolveEnemyContact(p, enemy, overlap): DamageSource | null; onHurt?(p, src): boolean }
```

`rules/damage.ts`: `DamageKind = stomp | fireball | shell | star | bump | sword | buster | contact`,
`Reaction = kill | flip | shell | hp | immune | hurtAttacker`, and a per-enemy `Vulnerability`
table. This single table is how non-stomping characters kill things.

Power-up mapping: Mario = SMB1 (mushroom grow, flower fire, star, 1-up; fire hit reverts to small
with an assist to revert to big). Link = 3 hearts, mushroom adds a heart container + full heal,
flower = sword beam at full health, contact damage with knockback, sword 16x8 melee hitbox active
frames 2-6 of 10. Mega Man = 28 HP bar, mushroom full refill, flower = charge shot, buster 3 on
screen at 4 px/f, slide, landing on an enemy hurts him.

Projectiles share one `Projectile` entity (speed, gravity, bounce, lifetime, damage, owner,
tile behaviour): Mario fireball bounces, buster shot is straight, Bowser flame ignores tiles.
Melee publishes `Player.activeMelee` AABB; World applies it once per enemy per swing.

### World 1 enemies and objects

Goomba (walk, stomp squash), Koopa Troopa green + shell (idle/wiggle/revive, kick, kills with combo
scoring 100..8000 then 1-up), Piranha Plant (hides when the player is near), fire bars (6 balls,
8-bit angle, CW/CCW), Bowser flame-only with 5 HP and axe/bridge collapse, blocks (question, brick,
hidden, multi-coin, break when big), coins, mushroom/flower/star/1-up, flagpole scoring, pipes with
enter/exit animation, lifts. Enemy timers use the seeded RNG.

### Rendering

`SpriteDef { palette; frames: Record<name, string[]> }` where each row is a string of palette
indices ('.' transparent). Rasterized at load into one OffscreenCanvas per (sheet, palette) with a
frame map. Palette swaps give themes, star flashing, and colorblind-safe / high-contrast modes.
8x8 bitmap font. `Renderer` interface (`sprite/tile/rect/text`) with `CanvasRenderer` and
`NullRenderer` (sim). Animator with named anims shared across characters (idle, walk, skid, jump,
crouch, die, attack). HUD mirrors SMB1 top rows, with a hearts row or 28-segment bar for HP
characters.

### Audio

`Apu` on Web Audio: 2 pulse voices (PeriodicWave per duty), triangle, LFSR noise buffer, 16-level
gain envelopes, scheduled with 100 ms lookahead from a 25 ms timer. Songs are a tiny MML dialect
(notes, lengths, octave, volume, duty, ties, loop point, drum macros) compiled to events at load;
unit-testable parser. Tracks: overworld, underground, castle, star, death, level-clear,
castle-clear, game-over, plus hurry-up (double tempo). SFX as short MML snippets that steal pulse
2 / noise like the NES. Audio unlocks on the first key/pointer/gamepad gesture ("PRESS ANY KEY").

### Asset packs

`PackManifest` (schema v1) maps sprite sheets + frame rects, tile atlases, music and sfx files.
`AssetRegistry` loads built-ins first, then packs in order, replacing matching ids with warnings on
frame-name mismatches. Sources: `user-packs/<name>/manifest.json` in dev (gitignored), a
directory file picker stored in IndexedDB for the deployed site, and `?pack=<url>` with CORS.
Packs replace art/audio only, never code or levels.

### Save and settings

`localStorage` keys `smbc.settings` and `smbc.progress`, both versioned with an ordered migrations
list and try/catch for private mode. Settings: video (integer scale, palette mode, reduce
flashing), audio volumes, per-player bindings, assists (allowLeftScroll, infiniteLives,
invulnerable, timeScale, coyoteFrames, fireRevertsToBig, infiniteTime), enabled packs.

## Phases and deliverables

Each phase ends with lint/typecheck/tests green and a commit pushed to the branch.

**Phase 0 – Scaffold.** Tooling, CI, Pages workflow, README, LICENSE, `.gitignore` with
`user-packs/`. Loop, viewport, scene stack, keyboard input, units/aabb, textmap parser,
tile-collision, camera, World with a rectangle Player on the Mario profile, debug overlay (grid,
column numbers, free camera, live profile editor), first draft of `1-1.map`.
Deliverable: a rectangle with SMB1 jump feel runs through 1-1 geometry.

**Phase 1 – Mario in 1-1.** Pixel-art pipeline, Mario sprites, overworld tiles, font, entity base
and spawner, Goomba, Koopa + shell, blocks/bricks/coins/power-ups, power states, death/lives/time,
flagpole and castle walk, bonus room via pipe, HUD, APU + MML + overworld/death/clear tracks + SFX,
title scene, scoring, pause.

**Phase 2 – World 1 complete.** Underground/castle/treetop themes and tiles, 1-2 (piranha,
multi-coin brick, lifts, exit area, warp zone), 1-3 (lift kinds, big gaps), 1-4 (fire bars,
Bowser, flames, axe, bridge collapse, castle-clear scene), transitions, game over, checkpoints,
progress save.

**Phase 3 – Characters.** Character registry, Link (hearts, sword, knockback, sword beam), Mega Man
(HP bar, buster pool, slide, cut jump, charge shot), character select, projectile system,
kill-rules table and tests, per-character music hook.

**Phase 4 – Accessibility and v0.1.** Gamepad, remap UI (DOM overlay with `aria-live` mirrored
menus), settings menu, asset packs (dev folder, file picker, IndexedDB), palettes and reduced
flashing, assists, touch controls MVP, headless sim regression suite. Tag v0.1.

**Phase 5 – Worlds 2-8.** Buzzy Beetle, Hammer Bro, Lakitu/Spiny, Bullet Bill, Cheep-cheep,
Blooper, water physics, springboards, balance lifts, night/water themes, Bowser variants with
hammers, ending, hard mode. Content plus ~10 entity files; no engine changes expected.

**Phase 6 – Editor and sharing.** `EditorScene` with DOM side panel, tile/entity/zone palettes,
playtest, JSON import/export, share links via `CompressionStream` + base64url in the URL hash,
IndexedDB level library, user-level select.

**Phase 7 – Co-op and more characters.** Second Player with its own bindings and camera rule,
revive bubble; Samus, Simon, Bill, Ryu, Sophia III as folders under `characters/`.

## Verification

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green at every phase; CI runs the same.
- Unit tests (vitest, node env, co-located): units math; Mario physics numbers (64 px standing
  apex, 80 px running apex, walk/run speeds, fall clamp); tile collision (landing snap, wall stop,
  head-bump tile choice, corner nudge, lift carry); textmap parsing and fixture errors; level
  landmark tests for 1-1..1-4 (first ? block column, pipe heights, hidden 1-up, flagpole column,
  warp zone pipe count, Bowser bridge length); kill-rules table across the three characters;
  damage models; MML parser; settings migrations.
- Headless sim (`game/sim/headless.ts`): `runSim({ level, character, script, maxFrames, seed })`
  returns outcome/frames/score. Regression scripts recorded in-game with a debug record key: each
  character clears 1-1, first Goomba stomp scores 100, running jump clears the big 1-1 gap.
- Manual: `pnpm dev`, play 1-1 through 1-4 as each character with keyboard and a gamepad; verify
  on a phone with touch; confirm the Pages deploy URL loads from a clean browser; load a sample
  user pack from the file picker and confirm it overrides a sheet.
- CI guard: a step that fails if any png/jpg/gif/wav/mp3/ogg is committed outside `public/favicon`.

## Risks

- **Physics feel**: cited Mario constants plus numeric tests; Link/Mega Man and enemy speeds are
  by feel and exposed in the debug profile editor.
- **Level accuracy**: maps are written from knowledge without downloads; expect correction passes,
  helped by the debug viewer and landmark tests. Sub-areas as separate files keep fixes local.
- **Scope**: Milestone 1 is phases 0-3 plus the phase 4 baseline. Later phases only hook into
  `CharacterBehaviour`, `Vulnerability` tables and the level schema; no general ECS.
- **Legal**: original art/music only, enforced by CI; faithful layouts are the user's decision and
  the README states the project is an unaffiliated fan reimplementation with no Nintendo assets.
