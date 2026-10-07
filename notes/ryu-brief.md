# 0.4.8: Ryu Hayabusa, hidden in 6-2 — shared brief (R1 campaign, R2 mini game, R3 art/music)
Conventions: /tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/tutorial-brief.md
(setup, ports, checks, trailers, never commit node_modules, no CHANGELOG edits, ability names not letters,
announcer, reduce flashing, failing tests first). Base: `git merge claude/admiring-galileo-quy3ri` (bd860e9 = v0.4.7).
Docs: docs/HEROES.md (captives, MiniGameDef, mini game references: Simon's Dracula's Castle (stairs, two-phase boss,
cautious-human sims), Mega Man's Station Escape, Samus's Zebes Escape; Mini Game Arena picks new MINIGAMES up
automatically; WorldStart.extraEntities; `scorePopups`; `Game.inRound` wording), docs/WORLD_MAP.md.
Ryu's existing kit: src/game/characters/ryu/ (sword, WALL CLING + wall jump, ninpo: windmill shuriken, fire wheel,
jump-and-slash). No new weapon code.

## Owner decisions
- Ryu is found in WORLD 6, 6-2 (one hero per world: Luigi 1, Link 2, Mega Man 3, Samus 4, Simon 5, Ryu 6).
- ENTRANCE (campaign only): a ninja TRICK WALL (karakuri revolving panel) in one of 6-2's two underground bonus rooms
  (`6-2-bonus` from the pipe at 19, `6-2-bonus2` from the pipe at 153; both have a solid brick LEFT WALL at column 0).
  A section of that wall (floor-height, 1-3 tiles tall) is marked by a stuck SHURIKEN and a faint crack, with a few
  coins pointing at it. Walking INTO it (pushing against it) for ~1 s makes the panel SPIN (a quick rotate/flip
  animation + whoosh) and flips the hero through to the other side = Ryu's hideout. Every hero can do it (it's just
  walking; small Mario too). Non-campaign play: plain wall.
- RYU'S HIDEOUT `6-2-dojo`: a night ninja dojo: wooden floor, paper lanterns, a round moon window, shoji screens,
  `captive x y hero=ryu`; a way back (spin through the same kind of trick panel back into the bonus room, or a door
  back into 6-2 — R1's call; the clock carries over like other secret areas; no secret/clear recorded).
- STORY: the Masked Ninja (a cursed masked rival, original — inspired by Ninja Gaiden's possessed "Masked Devil")
  holds Ryu under the curse. `DIALOGUE.ryu` in free-hero.ts (R1).
- MINI GAME (R2) "SHADOW DUEL" (or similar title, R2's call): opens with a LETTERBOXED TECMO-STYLE CUTSCENE — the
  moonlit field duel: two ninjas leap at each other under a huge moon, clash, a few lines of text (skippable with
  JUMP/OK, no flashing under reduce flashing). Then a NINJA GAIDEN-style stage played AS RYU with his existing kit,
  built around WALL CLING: tall walls to climb/jump between, ledges, LANTERNS (like Castlevania candles) that drop
  ninpo items / spirit points, enemies: knife throwers, attack dogs, and HAWKS that swoop (the infamous pit-knockers —
  keep it FAIR: avoid unavoidable knock-into-pit, fewer pits). Ninja Gaiden HUD: NINJA / ENEMY bars, ninpo count,
  timer. BOSS: THE MASKED NINJA — fast, original pattern (dashes, leaps wall-to-wall, throws shuriken, a sword
  slash; maybe a clone/afterimage move), not a dark copy of Ryu. Endings pass/fail/quit, MiniGameMenuScene, dev
  assists, touch labels, announcer, reduce flashing, `scorePopups` off, `Game.inRound` wording. Register
  `MINIGAMES.ryu`. Difficulty target: cautious-human sim ≥ 85% pass, clumsy > 0% (make the bot honest — a stuck bot
  is not stage difficulty).
- All art and music ORIGINAL in NES Ninja Gaiden style.

## Names (contract)
- Areas: `6-2-dojo` (R1). Trick panel mechanism: R1 owns (a new tile or entity `trick-wall x y h=` that spins on
  ~60 frames of push; campaign-only via the existing `campaignLevel` pattern like 5-4's `descent`/4-2's `goto`).
- Theme `dojo` (R3) for the hideout (and optionally the mini game's interior parts): wooden floor, beams, shoji
  (non-solid backdrop `wall`), `wall-top`, ground/hard/brick/used, plus a night-city/forest look for the stage if R3
  wants a second theme `ninja-night` (say so).
- Sheet `ninja` (R3): trick-wall-0..3 (16×16 spin frames of a brick panel turning; must match `brick@underground`
  look at frame 0), shuriken-mark (8×8 decor stuck in the wall), lantern-0/1 (16×16 paper lantern, hanging),
  moon-window (48×48 decor), shoji (32×32 decor), item-ninpo (8×8 spirit point), knife-thrower-0/1/2 (16×32),
  knife (8×8), dog-0/1 (16×16), hawk-0/1 (16×16), masked-ninja-0/1/2/3 (16×32: stand, run, leap, slash),
  masked-ninja-hurt (16×32), ninja-star (8×8 boss shuriken), afterimage (palette `ninja-ghost`), cutscene pieces:
  cut-moon (64×64), cut-field (256×48 grass silhouette strip, tiles horizontally ok), cut-ryu-0/1 and
  cut-masked-0/1 (32×32 silhouettes mid-leap), cut-clash (32×32 spark). Palettes `ninja`, `ninja-flash`.
- Music (R3): `dojo` (calm night koto-ish ambience for the hideout), `ng-stage` (driving Ninja Gaiden-style stage),
  `ng-boss` (Masked Ninja), `ng-cutscene` (short dramatic sting/loop). SFX: `panel-spin`, `slash`, `hawk`,
  `clang` (blade clash). Unknown ids must not throw until merged.
- Until R3 merges: `underground`/`castle` themes and rect fallbacks; switch when told.
