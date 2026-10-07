# 0.4.7 batch B: Simon Belmont, hidden under 5-4 — shared brief (S1 campaign, S2 mini game, S3 art/music)
Conventions: /tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/tutorial-brief.md
Base: `git merge claude/admiring-galileo-quy3ri` (a7f193a = v0.4.6). Docs: docs/HEROES.md (captives, MiniGameDef,
mini game references: Mega Man's Station Escape = platformer stage + boss with life bar; Samus's Zebes Escape;
Larry's airship flow; WorldStart.extraEntities hook; free/auto cameras), docs/WORLD_MAP.md (secret exits, zones).
Simon's existing kit: src/game/characters/simon/ (whip Leather→Chain→Morning Star, sub-weapons dagger/axe/holy
water/cross/stopwatch, hearts as ammo). No new weapon code.

## Owner decisions
- Simon is found in WORLD 5's castle, 5-4 (one hero per world: Luigi W1, Link W2, Mega Man W3, Samus W4, Simon W5).
- ENTRANCE (campaign only): 5-4 has two lifts in a shaft (src/content/levels/world5/5-4.map: `lift-up 86 6/14` and
  `lift-down 89 4/12`, len 3, the open shaft is columns 84-91 rows 10-14 over the bottom). RIDING THE DOWN LIFT as it
  sinks past the bottom takes you down into a secret DUNGEON (`5-4-dungeon`). Falling into the shaft without the lift
  still kills. Subtle hint on that lift (a chain/skull look, or candles at the shaft top) — your call, tell me.
- THE DUNGEON ROOM (one screen): a CRACKED WALL on one side. Heroes with attacks break it. For small Mario/Luigi
  (no attack) there's a KOOPA: stomp it and kick the shell into the wall to break it. A SINGLE BLOCK on the opposite
  side of the screen, which you must jump over to reach the Koopa, so a shell kicked the wrong way bounces back
  toward the wall. If the Koopa/shell is lost (falls, killed), it comes back so nobody is stuck. Behind the wall:
  STAIRS going DOWN to SIMON'S CRYPT (`5-4-crypt`): gothic room, stained glass, candles, Simon kneeling under the
  spell (`captive x y hero=simon`). Owner: "like we're going down the castle into a secret dungeon".
  Way back: drops you back into 5-4 past the lift section, clock carrying over (like other secret areas).
  Candles in the dungeon/crypt can be hit for coins (Castlevania nod).
- STORY: Larry's wand woke Dracula's curse inside Simon (Simon's Quest). Simon is Dracula's thrall.
- MINI GAME (S2): a Castlevania-style CASTLE STAGE + BOSS, played AS SIMON with his existing whip and one
  sub-weapon found in a candle (hearts from candles are ammo). Bats, Medusa heads, skeletons (original designs).
  NEW engine piece: CASTLEVANIA STAIRS — diagonal stairs you climb by holding UP (or DOWN) near the stair base/top,
  Simon walks along them; used in the mini game (generic enough to reuse; jumping off/onto stairs NES-style rules:
  can't jump while on stairs). Castlevania HUD: PLAYER / ENEMY bars, hearts count, a timer if it fits.
  BOSS: DRACULA, TWO PHASES. Phase 1 (NES-style): he teleports around his throne room, appears, throws a 3-fireball
  spread, vanishes; only his HEAD can be hurt. Phase 2: he transforms into a giant original monster form with its
  own pattern (e.g. leaps, fire spit, ground stomp). Enemy bar drains through both phases. Not a dark copy of Simon.
  Ending: pass/fail/quit, shared MiniGameMenuScene, dev assists work, touch labels, announcer, reduce flashing.
  Register `MINIGAMES.simon`; `DIALOGUE.simon` in free-hero.ts (S1 writes the dialogue).
- All art and music ORIGINAL in NES Castlevania style.

## Names (contract)
- Areas: `5-4-dungeon`, `5-4-crypt` (S1). Theme `crypt` (S3) for both areas and the mini game: castle stone in
  Castlevania colours, plus tiles: ground, hard, brick, used, wall (non-solid backdrop), wall-top, and `stairs`
  pieces (S3 draws `stair-l`/`stair-r` decor/tiles; S2 defines how stairs are encoded in maps — suggestion: a map
  entity `stairs x y len dir=ur|ul` that draws stair steps and is climbable — S2 owns, tells S3 the frame needs).
- Cracked wall: S1 decides mechanism (a breakable tile variant that any attack / bump / shell breaks, like Link's
  keep's cracked walls but in the platformer). Frame `crypt:wall-cracked` (S3).
- Sheet `crypt` (S3): candle-0/1 (8×16 wall candle), candelabra-0/1 (16×32), stained-glass (32×48 decor),
  coffin (32×16 decor), wall-cracked (16×16), rubble-0/1 (8×8 pieces), bat-0/1/2 (16×16), medusa-0/1 (16×16),
  skeleton-0/1/2 (16×32 walk/throw), bone (8×8 projectile), heart-small (8×8) heart-big (16×16), sub-weapon icons if
  Simon's sheet lacks them (check src/content/sprites/simon*.ts first), dracula-cape-0/1 (32×48 phase 1 stand/cape),
  dracula-head (16×16 his hurtable head part if drawn separately — S2/S3 agree), dracula-fireball-0/1 (8×8),
  dracula-beast-0/1/2 (48×48 phase 2 monster: idle/leap/spit), beast-fire-0/1 (16×16), throne (32×32 decor),
  stairs pieces as above. Palettes: `crypt`, `crypt-flash`.
- Music (S3): `crypt` (dungeon/crypt ambience for the campaign areas), `cv-stage` (driving Castlevania-style stage
  loop), `cv-boss` (Dracula), `cv-beast` (phase 2, or reuse cv-boss faster). SFX: `whip-wall` (wall crumbles),
  `candle` (candle snuffed), `dracula-teleport`, `beast-roar`. Unknown ids must not throw until merged.
- Until S3 merges: use `castle` theme and rect fallbacks; switch when told.
