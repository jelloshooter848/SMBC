# Larry's airship: a full SMB3-style airship level (owner decision, 8:15 PM PDT) — shared brief
Conventions: /tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/tutorial-brief.md
(setup, ports, checks, trailers, never commit node_modules, no CHANGELOG edits, ability names not letters,
announcer, reduce flashing, failing tests first). Also read samus-larry-brief.md (same folder) for the batch so far.
Base: `git merge claude/admiring-galileo-quy3ri` (it has C1's 4-2 campaign pipes, L1's Larry fight + crystal ball +
Hammer Bro, S3/L3 art). Docs: docs/HEROES.md (Larry section, mini games), docs/WORLD_MAP.md.
Owner's cabin reference image: /tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/images/14.png.
The owner also showed SMB3 World 1's whole airship map (not on disk). Its layout, left to right, ~90 columns, ~14 rows tall:
- BOW (cols ~0-30): a short raised bow platform at the very front (cols ~0-9), then the fore deck (cols ~2-30); under it the
  hull steps down and back in a stair-stepped prow (each lower row starts a column or two further right), bottom hull
  ending around col ~20 with a PROPELLER screw sticking out backwards under the hull. On the fore deck: two cannonball
  cannons aimed diagonally up, a Rocky Wrench manhole, and a short post with a Bullet Bill blaster at its right end.
- A tall thick wooden post (2 wide, ~3 tall) where the fore deck steps DOWN to the long middle deck (around col ~33).
- MIDDLE (cols ~29-70): a long low main deck 3 rows lower than the fore deck, on separate hull segments each with a
  propeller under it (props around cols ~40 and ~61). Narrow posts on it (one with a blaster on top ~col 44, one ~col 59).
  A ? block (fire flower / mushroom) floating mid-way (~col 53, 4 rows above the deck).
- UPPER DECK OVERHANG (cols ~40-75): a long plank ceiling high above the middle deck, with cannons hanging UNDER it aimed
  diagonally down, and a big multi-cannon turret hanging under it near col ~57; at its right end it thickens into a
  3-row-thick block (cols ~61-75) over a grey metal door frame (an open gateway on the main deck, cols ~61-68).
- STERN (cols ~65-95): the main deck continues, then the hull drops to a lower deck (cols ~66-80) with cannons, a Rocky
  Wrench, a blaster post; then the stern rises in steps up to a high stern deck (cols ~83-95) with a RAILING along it,
  round PORTHOLES in the stern hull, a propeller under the stern, and THE PIPE on the stern deck (down into Larry's room).
- Light sky behind with a few small clouds. Hazards: cannonballs (straight-line), Bullet Bills, Rocky Wrenches' wrenches.
Fit it into our 15-row screen (keep the HUD rows clear). Exact columns are guidance; make it play well with auto-scroll.

## Owner decisions
- 4-2's right campaign warp leads to LARRY'S AIRSHIP, a full SMB3-style airship level (layout transcribed in the spirit of
  the reference map like we transcribed SMB1 levels; ALL art and music original, SMB3 style).
- AUTO-SCROLL like SMB3: the camera moves right at a steady pace; the left edge pushes the player; being squashed
  between the edge and a wall kills; the player can't run past the right edge. Scrolling stops at the stern.
- At the stern a pipe drops into LARRY'S ROOM (L1's existing enclosed cabin) → the fight → crystal ball (unchanged).
- You play your CURRENT hero (it's a level, every hero's kit works; co-op works if cheap, else P1 only — say which).
- Endings like other mini games: dying (deck or Larry's room) never costs a life; it shows TRY AGAIN? YES / NO.
  YES = retry (from the deck's start; from Larry's room if the player already reached it). NO = back to 4-2 at its last
  checkpoint (normal 4-2 respawn rules, run state as before the airship). MENU in the airship/room = Continue / Give up
  (Give up = same as NO). Beating Larry = crystal ball as today.
- The clock does not run on the airship / in the room (show it held, or hide it); giving up restores 4-2 as left.
- Entrance from 4-2: still the C1 pipe for now; the owner is choosing a more logical entrance (likely an anchor chain to
  climb). Keep the entrance isolated (C1's `goto=` in 4-2.map) so it can change later.

## Names (contract)
- Areas: `4-2-airship` = the DECK level (new, auto-scroll, theme `airship-deck`, music `airship`).
  `4-2-larry` = Larry's room (RENAME L1's current `4-2-airship.map` cabin; theme `airship`, music `smb3-boss`).
  4-2's campaign `goto=` target stays `4-2-airship 2 12` unless A1 changes it (then update C1's map + tests).
- Map header: `camera: auto` + `scroll: <px per frame, decimal ok>` (A1 owns). Default 0.5 px/f, A2 tunes.
- Theme `airship-deck` (A3 registers in the 4 places: schema THEMES+themeMusic → `airship`, tiles palette `tiles-airship-deck`
  + `<tile>@airship-deck` frames, SKY entry (SMB3 daytime airship sky), decor/enemy palette defaults, themes.test.ts).
  Tiles to draw @airship-deck: ground (hull/deck planks, tiles both ways), hard (solid wooden post / crate block),
  brick, used, bridge (thin plank), wall (non-solid dark hull behind), wall-top. A3 says which tile means what.
- Sheet `smb3` new frames (A3): cannon-r, cannon-l, cannon-ul, cannon-ur, cannon-dl, cannon-dr (16×16 cannons: right, left,
  up-left, up-right, down-left, down-right — the down ones hang under a deck), cannonball (16×16), rocky-hide (16×16 closed manhole), rocky-0 (peek), rocky-1 (throw) (16×16 Rocky Wrench),
  wrench-0, wrench-1 (8×8 spinning), propeller-0/1/2 (16×16 screw under the hull), bolt (8×8 decor), railing (16×16 decor),
  anchor (32×32) + chain (16×16, vertical, for a future climbable anchor chain).
- SFX (A3): `cannon` (boom). Reuse existing sfx otherwise.
- Entities (A2): `cannon x y dir=r|l|ul|ur|dl|dr [period=frames]`, `rocky x y` (Rocky Wrench in its manhole). Bullet Bill
  blasters already exist (tiles `^`/`|`).
- Until A3 merges: code must not throw on missing frames/sfx/theme (use `castle` theme; unregistered `sheet:frame`
  decor already draws nothing; fall back to rects for entities).

## Update 8:25 PM PDT (owner decisions)
- ENTRANCE = ANCHOR CHAIN (campaign only). In 4-2's hidden right zone (4-2.map warp zone near col 208-214) the pipe goes
  away: an `smb3:anchor` rests on the ground and a climbable CHAIN (vine mechanics, chain art from A3) runs up off the top
  of the screen. Climbing it to the top takes you to `4-2-airship` arriving at the bow (like a vine arrival into a sky
  area). Replaces C1's `goto=` pipe for that zone (keep `goto` support for the vine-area/cavern one). Non-campaign
  play keeps the classic warp zone.
- MAP CUTSCENE after beating Larry (campaign, after the crystal-ball card, replacing the plain return to the map):
  on World 4's map the airship (map-scale) flies in, smokes and tilts nose-down; the hero jumps out and lands on 4-2
  (dust); the ship crashes at the bonus spot's tile (smoke, `map-wreck`); Toad walks in from off-screen to the wreck,
  hammers (a few hits, planks fly), the wreck turns into the bonus node (Toad House icon), Toad waves and walks off;
  then the existing secret-road reveal draws the road from 4-2 to the bonus spot. Skippable with JUMP/OK (jumps to the
  end state). ~6-8 s. Announcer narrates briefly. Reduce flashing: no flicker. Plays once (the save already records
  `larry`); never in dev-only paths that don't save. Frames in `smb3`: map-airship-0/1, map-airship-tilt, map-wreck,
  map-smoke-0/1/2, toad-map-0/1, toad-map-hammer-0/1, map-dust-0/1.
