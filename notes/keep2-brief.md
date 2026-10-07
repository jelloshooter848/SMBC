# Shadow Keep v2 (owner feedback) — shared brief for K1 (code) and K2 (art/sfx)
Conventions: /tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/tutorial-brief.md
(setup, ports, checks, trailers, never commit node_modules, no CHANGELOG edits, ability names, announcer,
reduce flashing). Base: `git merge claude/admiring-galileo-quy3ri` (48ae838 = v0.4.3).
Existing code: src/game/topdown/ (kit), src/game/minigames/link/ (keep, dungeon rooms, keeper, bot plan),
art src/content/sprites/dungeon.ts (sheets `dungeon`, `link-td`, `dungeon-enemies`), sfx src/content/sfx/sfx.ts.

## Owner feedback (verbatim gist)
"The Link mini game is pretty hard. I failed multiple times. I think attacking with the sword is flawed. You
attack a very narrow pixel range so if I stand still attacking, a monster can approach me slightly at an angle
and still hit me even though I'm swinging. Landing attacks is way too hard. Are there any weapons or items
besides the sword? I got to the boss but then died."
Owner chose: Boomerang, Bombs, Extra heart container, and "bombs found in a chest can open a cracked wall which
gives you a shield".

## Design
- Sword: stab hitbox covers the full tile in front of Link plus a few px to each side (catches angled
  approaches); a slightly longer active window; a monster touched by the blade is knocked back and cannot deal
  contact damage on that frame (blade wins ties). Test: a monster approaching diagonally into a held stab is hit,
  Link isn't.
- Items, Zelda-style: an item slot (B box in the HUD beside the sword box). ATTACK = sword. SPECIAL = use the
  item in the slot. SELECT (tool select) cycles owned items. Touch labels: SWORD, the current item name
  (BOOMERANG / BOMB), MENU; plus the select button labelled ITEM if the touch pad has it.
  - Boomerang: in a chest soon after the bat room. Thrown in the facing direction, flies ~5 tiles, returns to
    Link; stuns monsters ~3 s (the Keeper: immune or 0.5 s); collects hearts/keys it touches. One in flight.
  - Bombs: in a chest (a later room). Place one in front of Link; 1.5 s fuse; explosion radius ~1.5 tiles hurts
    monsters (2 damage) and Link (half heart) and opens CRACKED WALLS (a wall tile variant; becomes a passable
    hole/doorway). Count shown on the HUD (start 4, max 8); bomb refills drop from monsters sometimes.
  - Cracked wall → a secret room with the SHIELD. Link starts WITHOUT a shield; once found, the shield blocks
    frontal rocks/spells as today. Make the cracked wall noticeable (a crack pattern) and hint it (e.g. the
    dungeon's statues point at it, or the minimap shows a gap).
  - Heart container: mid-dungeon (e.g. after the knights), max hearts 3 → 4, full refill.
- Rooms: rework/add rooms for the two chests, the cracked wall + secret room, the heart container. Keep the
  existing puzzles. Update minimap, bot plan (bot must still finish), "all rooms reachable" test.
- Fold in old QA nits: the Keeper's name banner covers the boss on entry (move/shorten it); a spell lingers
  after the Keeper dies (clear projectiles on death).

## Art contract (K2 adds these to src/content/sprites/dungeon.ts; K1 renders by these names)
Sheet `dungeon` (16×16 unless noted): wall-cracked (north-wall orientation like `wall`/`wall-top`; K1 rotates
with the existing withSideFrames helper), wall-hole (the blown-open passage, north orientation), chest-open,
shield-pickup, heart-container, bomb-pickup (8×16), boomerang-icon (8×16), bomb-icon (8×16), item-box (24×32
HUD frame, same style as the sword box if one exists — else K1 draws the box with rects; then skip it).
Sheet `link-td`: boomerang-0..3 (8×8 spin), bomb-0, bomb-1 (16×16, fuse flicker), blast-0..2 (32×32
explosion), link without shield: down-0-ns, down-1-ns, up-0-ns, up-1-ns, side-0-ns, side-1-ns,
attack-down-ns, attack-up-ns, attack-side-ns (same poses as the current frames, shield removed), and
throw-down, throw-up, throw-side (with shield; K1 uses the -ns walk frames + throw pose without shield if no
-ns throw frames — K2 may also add throw-*-ns).
SFX (src/content/sfx/sfx.ts): `boomerang` (whirr loop-friendly short), `bomb-fuse`, `bomb-blast`,
`item-get` (a short fanfare when a chest item is taken; may reuse key-get's style). Reuse `secret` for the
cracked wall opening. Add to the music/sfx tests.
