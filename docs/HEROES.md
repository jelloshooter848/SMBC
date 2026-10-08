# Freeing the heroes (campaign, 0.5.0)

Bowser has brainwashed the heroes of other worlds. A new campaign file starts with **Mario
only**; every other hero is a captive somewhere in the campaign, and talking to one starts a mini
game themed on that hero's own game. Passing it frees the hero, who joins the file's roster.

## Freed heroes (`SaveFile.freed`)

- Save format v3 (`src/game/save/save-files.ts`): `freed: string[]`, CharacterDef ids, Mario
  always first. `newSave(slot, 'mario')` gives `['mario']` (a file made with other heroes frees
  them too). Validation keeps known ids only, each once, and always Mario; a value that is not
  an array falls back to Mario plus the file's heroes.
- Migration v2 → v3 (`migrateV2toV3`): older files are locked too. They keep Mario plus the
  hero(es) they last used (`character`, `character2`), deduped, with nulls and unknown ids dropped.
- `Game.freed` carries the list for the open file (`openFile` loads it, `autosave` writes it).
  `Game.heroLocked(def)` is true only in campaign mode (`game.campaign !== null`) for a hero not
  in the list. Dev starts, `?level=`, custom and shared levels and editor play-tests keep
  every hero. `Game.freeHero(id)` adds a hero and saves at once.
- A file whose current hero is locked (hand-edited) falls back to Mario when it opens.
- Dev mode's map menu **All heroes** (`SaveFile.devAllHeroes`, missing = off) makes `heroLocked` false for every hero while dev mode is on; it never writes `freed`, and turning it off restores the real roster (a player on a locked hero goes back to Mario).

### Character select

Locked heroes are drawn as black silhouettes with a grey rim (the `~silhouette` and `~rim`
palette effects) and `???` under them. Left/right skip them, and the screen and the announcer say
how many heroes are still to be found. Every pick follows the same rules: entering a level from
the map, the pick after a death, warps, and both players' picks on a two-player file.

### Palette effects

`PaletteBook.fx` (`src/engine/gfx/palette.ts`) recolours a whole palette when a sheet is asked
for with `<palette>~<fx>` (for example `assets.sheet('mario', 'luigi~silhouette')`). The effect
runs on the palette of the active colour mode, so colour-blind modes and asset-pack palette
overrides still apply. Effects chain left to right (`luigi~brainwashed~silhouette`), and an
unknown effect is an error. The effects are `silhouette`, `rim`, `brainwashed` and
`brainwashed-glow` (`src/content/sprites/palette-fx.ts`). A pack image that replaces a sheet does
not replace its `~fx` variants (`applyPack`): they stay the built-in art recoloured, so a pack
can't unhide a locked hero.

## The captive entity

```
[entities]
captive 13 6 hero=luigi
```

- `x y`: the tile the hero's feet stand in, so the hero stands on the tile below it.
- `hero`: a CharacterDef id that has a mini game (`miniGameFor`).
- It draws the hero's own idle sprite (its `sprite()` and sheet) in a dark purple trance with a
  slow one-pixel sway. A lighter pulse is added unless reduce flashing is on. It has no
  collision and never despawns.
- It spawns only in campaign play (`World.captives`, set by LevelScene), and only while that hero
  is not freed on the file.
- **Talking:** a player on the ground within 1.5 tiles (24 px, same floor) sees `TALK` with an
  up arrow above it, and the announcer says "Luigi. Up to talk." each time a player comes into
  reach. Pressing **up** talks (`World.checkTalk` raises a `talk` event). Up was
  picked because every control scheme has it, including the touch d-pad, so no face button
  changes its label or meaning. Heroes that also use up on the ground (Samus and Bill aim up)
  just talk as well while in reach. It does nothing on a vine.

Luigi waits in the 1-1 bonus room on a hard-block ledge at the top right (row 7, columns
12-14), 48 px above the top of the coin bricks. From the bricks a running or walking jump reaches
it for every hero but Ryu, who climbs walls instead (`tests/sim/heroes.test.ts` scripts Mario there).

Link waits in his sky palace above 2-1 (`2-1-sky2`, five screens), on the altar in the middle of its hall (column 52, feet on the altar's top in row 9, three one-tile steps up from the hall floor), under a gold triad crest between two knight statues. It is reached by the hidden vine block (`7` in maps) over the middle cloud platform past the end of the 2-1 coin heaven: the vine lands on the clouds among broken columns, a sky stair of floating palace blocks (one-tile gaps, each a step up) leads to the great gate, and the hall's floor is broken once by a two-tile gap. Past the hall a balcony ends in a drop, signposted by a down-arrow of coins, that lands in 2-1 at column 162 like the coin heaven's; any fall in the palace lands there too. Campaign look: theme `zelda2`, music `zelda2-field`, and the palace art of the `zelda2-sky` sheet (`src/content/sprites/zelda2-sky.ts`: gate, columns, back wall, windows, curtains, banners, crest, statues, braziers, a sea of clouds; drawn behind the tiles, nothing animates); outside the campaign the same tiles carry plain ruins. Every hero, small and big, reaches Link and gets back to 2-1 (`tests/sim/sky-palace.test.ts`; also `tests/sim/heroes-link-sky.test.ts`, `tests/sim/sky-ruins.test.ts`).

Mega Man waits on the command deck of the space station above 3-1 (`3-1-station`, column 38 on the floor, under the big window). Past the end of the 3-1 coin heaven (`3-1-sky`) a coin trail hops over two small cloud platforms to a hidden teleporter block (`8` in maps, at 91,7 over the second platform); bumped, it reveals a teleport pad that rises out of the platform two tiles to its right (93,10). Standing on the pad beams the hero up (hidden, a `station:beam-*` streak rises, sfx `beam`) and down onto the station's arrival pad; the clock runs on. The return pad just past Mega Man (column 44), and the arrival pad once stepped off, beam the hero back down into 3-1 at column 162, dropping in like the coin heaven's own drop. The pads are `teleport` zones (docs/WORLD_MAP.md "Teleport pads"). Every hero reaches the pad and crosses the station (`tests/sim/space-station.test.ts`); his lines before the round make the brainwashing a rogue program in his systems that built a dark copy of him (`DIALOGUE.megaman`).

Samus waits in her cavern under the 4-2 vine area (`4-2-cavern`, an area of 4-2: `parent: 4-2`, `time: inherit`), on the dais of the Chozo statue's chamber (column 41, feet in row 11, the statue `zebes:chozo-0` at 37). In campaign play the vine area's warp zone shows one unlabelled pipe (column 54) that drops the player into the cavern's entry shaft (docs/WORLD_MAP.md "Campaign warp zones"); outside the campaign it keeps its three warps. The cavern is short and Metroid-flavoured: blue rock, an entry chamber, a bubble door (`zebes:bubble-door` in a three-tile doorway), a low tunnel with a ledge, the statue's chamber (a ? block over the orb in the statue's hand), a second bubble door and a side pipe that brings the player up out of 4-2's pipe at column 72, the first pipe past the vine block (64,5), so nothing is skipped (the checkpoint at 98 still lies ahead). The clock runs on throughout. Every hero reaches Samus and crosses to the pipe (`tests/sim/samus-cavern.test.ts`); her lines before the round make the brainwashing a parasite feeding on her will the way a Metroid feeds, which set off a countdown (`DIALOGUE.samus`). Theme and music: `cavern` (the `zebes` sheet's statue faces right, toward Samus). World 4's tree left of 4-2 stands one tile out, clear of her map hint (she is drawn on the left: 4-2's roads leave right, up and down).

Simon waits in his crypt under 5-4 (`5-4-crypt`, an area of 5-4: `parent: 5-4`, `time: inherit`), kneeling on the floor under the stained glass (column 11, feet in row 11). The way in is campaign only: 5-4's lift shaft (columns 84-91) has a sleeping `descent` zone the campaign variant wakes (docs/WORLD_MAP.md "Descent shafts"), so riding the down lift (column 89) on past the bottom of the shaft carries the player down, out of sight, and drops them into **the dungeon** (`5-4-dungeon`, one locked screen) from above at column 13. Falling into the shaft without the lift still kills. The hint is a faint bone-grey skull on the down lift's middle plank (campaign only). In the campaign the fire bar at (92, 10) is three balls short (3), so its tip clears the lift plus a tile of overhang each side: a rider whose body overlaps the lift at all, even hanging off either end, rides down unhurt; co-op riders all go down together. In the dungeon a single hard block (11,10) stands between the landing and a Koopa pacing up to a **cracked wall** (column 5, rows 8-10, tile `&`, `T.CRACKED`). Behind the wall, three steps lead down to a hole (columns 0-1) whose `pit` zone drops the player into the crypt's top-left landing; a castle-stone stair leads down to the floor, past Simon, to a dark doorway in the right wall (rows 10-11; a side `pipe` zone at column 16, just off the locked screen) that drops the player back into 5-4 at column 99, past the lift section (in co-op player 2 drops in 12 px to player 1's right, clear of the fire bar at (103, 11): see docs/WORLD_MAP.md "Co-op fall arrivals"). The clock runs on throughout; nothing is recorded on the map. Candles (`candle x y`, 8×16) in both rooms are snuffed for a coin by any attack, a kicked shell or a hero jumping into them. His lines make the brainwashing Dracula's curse, woken in his blood by the wand King Koopa stole from Larry (Simon's Quest): he is Dracula's thrall (`DIALOGUE.simon`). Tests: `tests/sim/simon-crypt.test.ts` (every hero rides down, breaks the wall, reaches Simon and gets back).

- **The cracked wall** (`T.CRACKED`, a solid brick-kind block): it crumbles, with every cracked tile joined to it (one hit opens the whole doorway), to any hero attack: a melee hit (`Player.activeMelee`: sword, whip, Ryu's blade), any shot or thrown weapon a hero owns (`Projectile`), a kicked shell (which plows on through the opening instead of bouncing back), a blast (`World.explode`), or a head bump from a hero who breaks bricks (big Mario). A small hero's bump only jolts it (`World.crackWalls`, `World.strikeBlock`, `World.shatterWall`; the `whip-wall` sound once it exists, else `break`). It draws `crypt:wall-cracked` once that sheet exists, else the theme's castle brick with a dark crack.
- **The Koopa** (`koopa-green 8 10 respawn=true`): small Mario and Luigi have no attack, so they stomp it and kick the shell into the wall. Kicked the wrong way, the shell bounces off the single block and comes back to the wall (a player standing between them is hit, as ever). A spawn with `respawn` is kept by a `Respawner` (`objects/crypt.ts`): a lost Koopa (killed, or fallen down the hole) walks back in at its spot 90 frames later, once no player stands there, for as long as a cracked wall stands.
- **Art and sound** (S3's): theme and music `crypt` in both rooms; the `crypt` sheet's `wall-cracked`, `candle-0/1`, `rubble-0/1` (the wall's pieces, through `World.breakPieces`), decor `crypt:candelabra-0` (dungeon), `crypt:stained-glass` and `crypt:coffin` (crypt); sfx `whip-wall` and `candle`. Without the sheet the candles and crack fall back to rects and the rubble to the brick piece.

Ryu waits in his hideout behind 6-2's first bonus room (`6-2-dojo`, an area of 6-2: `parent: 6-2`, `time: inherit`), standing on the dojo's floor (column 5, feet in row 12) under the moon window. The way in is campaign only: in campaign play the bonus room under the pipe at 19 (`6-2-bonus`) has a **ninja trick wall** in its left wall (column 0, rows 10-12), its middle tile cracked with a shuriken stuck in it, and a coin arrow pointing at it (outside the campaign the room is exactly as it was: plain bricks, no arrow). Pushing into it for about a second (every hero: just walking into it; Ryu clinging to it and Samus rolling into it in her morph ball count too) spins the panel and flips the player through into the dojo, stepping out beside the dojo's own panel in its right wall (column 15, rows 10-12). Pushing into that one flips him out into 6-2 itself, rising out of the pipe at 35 where the bonus room's pipe leads, so the trick wall is one way and the bonus room's coins are not restocked by going round. A short push does nothing (docs/WORLD_MAP.md "Trick walls"). In co-op both players go through together and step out inside the dojo, player 2 further in. The clock runs on throughout; nothing is recorded on the map. His lines make the brainwashing the curse of the Masked Ninja, a cursed masked rival whose mask rules Ryu's blade; the round is their duel under the moon (`DIALOGUE.ryu`). Art and sound (R3's): theme and music `dojo`; the `ninja` sheet's `trick-wall-0..3`, `trick-wall-back`, `trick-wall-cracked` and `shuriken-mark` for the panel, decor `ninja:moon-window`, two `ninja:lantern-0` and two `ninja:shoji` screens (columns 1 and 12); sfx `panel-spin`. Tests: `tests/sim/ryu-dojo.test.ts` (every hero pushes through, small and big; Ryu's cling, Samus's ball; a short push does nothing; campaign only, the room otherwise v0.4.7's; one way; co-op; every hero reaches Ryu and gets out into 6-2).

Bill waits in his jungle camp under 7-3 (`7-3-camp`, an area of 7-3: `parent: 7-3`, `time: inherit`), standing by the sandbags of his base under a searchlight (column 5, feet in row 12). In campaign play 7-3 is a Contra jungle stage: the same tiles, enemies, coins and collision in the `contra-jungle` theme and music, under a hanging jungle canopy and a black starry sky (no clouds, as NES Contra's), distant snow-capped mountains under the bridges, palms and a band of palms and undergrowth (`jungle-band`) along the ground (its campaign look, docs/WORLD_MAP.md "Campaign looks"). The girder bridge just past the checkpoint (columns 128-142, walled to the bottom by the pillars at 127 and 143) is marked: a red light blinks on its post and a coin arrow points down at it. A hero stepping on sets off a chain of explosions, Contra stage 1 style (`bridge-blast`, docs/WORLD_MAP.md "Exploding bridges"): segment after segment flashes and blows, at a pace a hero who keeps running just about outruns; whoever stops or walks falls through the gap, which a campaign-only `pit` turns into the drop into the camp (dropping in from above at column 2; co-op, both players). Anyone who ran across can still drop in on purpose; every other fall in 7-3 kills, and the bridge is whole again on any new visit. Outside the campaign 7-3 is exactly v0.4.8's (a plain bridge, no pit, its own look). In the camp a shallow river (one tile deep: a hop gets out) runs at the foot of a waterfall; past it, the cave mouth under the cliff (a side `pipe` at column 16) leads into **the waterfall climb** (`7-3-falls`, Contra stage 3 style: `camera: free`, 16 by 32 tiles): rock ledges three rows up and one tile apart beside the waterfall climb right to a jungle vine on the right wall, which rises nine rows to the ledges climbing left to a vine on the left wall; that one leads off the top of the screen into 7-3 at column 199, climbing up out of the jungle onto the tree platform past the bridge (a climb arrival). No ledge hangs over another's take-off, the floor catches every fall and walls close both sides, so nobody gets stuck. The clock runs on throughout; nothing is recorded on the map. His lines make the brainwashing Red Falcon's (Super C): King Koopa's spell let the alien take his mind (`DIALOGUE.bill`). Art and sound (B3's): theme and music `contra-jungle` (7-3's look and the camp), theme `contra-falls` (the climb: its falling water slides down); decor `canopy-hang` (the ceiling, every 2 columns on row 0), `canopy`, `palm`, `mountain`, `sandbags`, `searchlight`; the `contra` sheet's `blast-bridge-0/1` (lamp lit, dark) and `boom-0..3`; sfx `bridge-boom` (rect, item-blast and `explosion` fallbacks without them). Tests: `tests/sim/bill-camp.test.ts` (7-3 outside the campaign tile for tile and in look; the campaign variant's collision unchanged; the look hook; the chain's pace and order; every hero, small and big, falls in standing still, outruns it running, drops in on purpose; co-op; every hero reaches Bill and the cave, climbs the falls from the pool and from every ledge, and lands in 7-3; the whole way through the Game).

Sophia III waits in her garage under 8-4 (`8-4-garage`, an area of 8-4: `parent: 8-4`, `time: inherit`), the tank parked under a mutant-stained gateway (column 8, feet in row 12). The way in is campaign only (the owner's design): after the water section the hero comes up a pipe into `8-4-end`, whose next pipe (column 10) is the trap that leads back into the castle maze (8-4 at column 19). In campaign play a sleeping `pipe ... campaign` zone on the same mouth takes its place (docs/WORLD_MAP.md "Hidden paths and campaign pipes"), so that pipe leads instead to **Jason's secret area** (`8-4-jason`, one locked Underworld screen, music `bm-cutscene`): the hero rises out of a pipe at the left; **Jason** (Sophia's pilot on foot, a story partner: her sheet's side-view `jason-stand`, looking about for his frog) stands by it, and **Fred** sits on the edge of a pool at the right (columns 10-13, water over an open bottom). Talking to Jason (his three pages, docs/STORY.md 2.11), or coming within 2 tiles of Fred, sends Fred hopping into the pool and out of sight (`objects/fred.ts`; the `frog` croak; the announcer: "Fred dives into the pool. Follow him!"). The pool is a `pit` into **Fred's flooded tunnel** (`8-4-fred`, music `bm-area`): the hero drops in through a hole in its roof and swims as in 8-4's water (the map's `swim: true` header: docs/WORLD_MAP.md "Swimming in any theme"), murky Underworld water from the roof down, with Fred swimming on ahead (darting when the hero comes close, waiting when left behind) to a side pipe on the floor at the far end (column 36). Rows 8-12 are open from end to end, so every hero swims through (Mega Man and Samus walk the floor and jump: "Water" below). That pipe leads up into the garage (Fred rests there, hopping and croaking now and then); its other pipe (column 13) brings the hero back up out of 8-4-end's trap pipe, so 8-4 goes on from there as before: a secret detour, not a shortcut. The clock runs on throughout; nothing is recorded on the map. Outside the campaign 8-4-end is exactly v0.4.12's (the trap pipe as ever). Her lines: a tank can't talk, so the spell speaks through her computer: PILOT NOT FOUND, the Plutonium Boss has the wheel (`DIALOGUE.sophia`); the round is her mini game, Underworld. Tests: `tests/sim/sophia-garage.test.ts` (8-4-end outside the campaign tile for tile, its pipe still the trap for Mario and the tank; every hero, small and big, down the campaign pipe, through Jason's area into the pool, through the tunnel, past Sophia III and back up out of 8-4-end's pipe; Fred; co-op; the whole way through the Game with the clock carried; captive only in the campaign and until freed; her words; the map hint; her missed card, hint line and joined card; her Arena pad once met) and `tests/sim/partners.test.ts` (Jason).

## The map hint (`src/game/map/captives.ts`)

The world map hints at levels that still hide a hero, in three stages (campaign play only, read
from the file's `cleared` and `freed`):

1. **Before the level's node is cleared:** nothing (unless the file has Larry Koopa's crystal
   ball, below: then the silhouette of stage 2 shows at once).
2. **Cleared, the hero not freed yet:** the hero's idle sprite as a faint silhouette peeking from
   behind the node (drawn before the dot, so the dot hides part of it). Its colour is the page's
   ground shade lifted a little toward the ground colour (`<palette>~shade-<theme>`, `mapShadeFx`
   in `palette-fx.ts`), so it is just barely visible. Every 6 seconds it shimmers faintly toward
   the trance's lilac for half a second (`~shade-<theme>-glow`); never with reduce flashing.
   Standing on the node, the announcer adds "Someone is hiding in this level." to the node's name
   and the hint line shows `SOMEONE IS HIDING IN THIS LEVEL`. Nothing says where in the level.
3. **Freed:** a statue of the hero stands beside the node in full colour, facing it: the
   portrait at half size on a small stone pedestal (0.4.22, owner note 13: it must never read
   as the player's marker), with a small idle hop (`map/trophy.ts`).
   A hero freed some other way (a file started with that hero) shows here too, once the node is
   open.

Where heroes hide is found from the level data alone (`hiddenHeroes()`): every `captive` entity
of every bundled level, through its level's `parent` chain to the main level, to the map node
that names it (`rules.findLevelNode`). So a new captive gets its hint with nothing else to write.
The hero stands on the right of the node unless a road leaves it to the right (then the left);
a node can choose with `heroSpot: 'left' | 'right'` (`MapNode`). Dev mode's "All heroes" never
shows a trophy (it does not touch `freed`), and "Unlock all" shows no silhouette (it opens nodes
without clearing them). Toad's greeting in 1-0 tells the player where heroes hide (pipes, vines,
hidden blocks) and to look closely at the map for a level hiding someone missed.

## Larry Koopa and the crystal ball (4-2's airship, campaign)

Story (docs/STORY.md 2.7): King Koopa stole Larry Koopa's magic wand, and its spell is what
brainwashed the heroes; Larry fights with a "lousy spare" and wants his own back. In the
campaign, 4-2's right warp zone first looks classic (WELCOME TO WARP ZONE!, the pipe and its 5,
though the pipe is dead), until the hero drops in and lands: then his **anchor** crashes down,
smashes the pipe and rests on the floor, its **chain** rising through the ceiling off the top of
the screen. Climbed (vine mechanics) to the top,
it leads aboard his airship: the auto-scrolling **deck** `4-2-airship`, arriving up the chain at
the bow (wired in `level/campaign.ts`; docs/WORLD_MAP.md "Campaign warp zones"), whose stern
pipe drops into **Larry's room** `4-2-larry` (`pipe x y down -> 4-2-larry 2 12`). Dev select and
`?level=` reach both as plain levels. See "Larry's airship challenge" below for how a run aboard
ends.

- **The anchor's drop** (`entities/objects/anchor-drop.ts`, an `anchor-drop` spawn built by
  `level/campaign.ts`): the room shows the classic warp zone, but its pipe (column 214) is no pipe
  zone, so it never warps (its 5 is drawn through the warp zone's `labelAt`). Once a player stands
  on the room's floor (row 13, columns 208-223; not on the pipe, not on the ceiling) the anchor
  shows at the top 20 frames later and falls (4 px/f gaining 0.5 up to 10), trailing its chain,
  breaks the ceiling brick in its column (brick pieces, `break`), smashes the pipe (its tiles gone
  in `pipe-piece` chunks of the items sheet, through `World.breakPieces` like a broken brick; the
  `cannon` boom and a `break`, a 16-frame screen shake that reduce flashing skips, the 5 and the
  welcome text gone, the announcer: "An anchor crashes down and smashes the pipe! Climb its
  chain: UP." with the UP ability's key as other prompts give it) and rests on the floor: about
  a second in all. Nothing of it is solid or hurts; the players keep control (a player on the
  ceiling over it just drops into the room). It plays on every visit (each new 4-2 world starts
  from the level's own tiles: the whole pipe and a waiting drop).
- **After Larry is beaten** (`until=larry` on the warp zone and `larry` in the file's secrets: the
  airship has crashed on the map) the room is **sealed**: no pipe, the ceiling gap it is entered
  by (columns 220-221) closed with the ceiling's brick, its left wall (column 208) raised to the
  top of the screen and the camera stopped there (a `scrollStop` at 208), so a hero walking the
  ceiling stops at the screen's edge and walks back; no anchor, no chain, no warp, no text.
- **The anchor chain**: the anchor is `smb3:anchor` (32×32, its ring under the chain, drawn at x =
  column×16 − 8, standing on the floor); the chain is a placed `Vine` drawn in `smb3:chain` links
  (`VineArt` in `entities/objects/vine.ts`, theme-free; also a `chain x y len=N` map entity),
  standing on the floor at column 214 and reaching a tile above the screen. A `vine` zone on its
  foot (column 214, row 12) links its top to the airship like a vine brick's, and the arrival's
  vine is a chain too (`WorldStart.chain`). **Arrival point**
  (`goto=4-2-airship,2,3,climb`): the chain rises from the screen bottom at **column 2** (faster
  than a beanstalk, 1.5 px/f) and the hero climbs it, through any hull in the way, until he can
  step off to the right onto the **first solid tile in column 3 below row 3** (the bow deck). The
  chain's top is two tiles above that tile only when that is higher than the classic arrival vine
  (5 tiles up from the screen bottom); otherwise it stays at the classic height and the hero drops
  onto the floor from there (`arrivalVineTop` in `world/world.ts` takes the higher of the two, so
  the classic sky-area vine, start row 14, is unchanged). `World.arriving` is true until everyone
  is off it (the deck's auto-scroll waits for it). The airship run boards with this start, so TRY
  AGAIN? YES climbs the chain again. Every hero drops in, climbs it and lands on the deck
  (`tests/sim/anchor-chain.test.ts`).
- **The airship's crash on the map** (`map/airship-crash.ts`, the map's `cutscene` mode; campaign,
  the first time the ball is taken): after the crystal ball's card `Game.takeCrystalBall` sets
  `Game.mapCutscene = 'airship-crash'` (never saved), and World 4's map plays it before the reveal
  of the bonus road: the airship (smb3 `map-airship-0/1`, 32×16, bow left) flies in from the right
  smoking (`map-smoke-0/1/2`) and hovers over 4-2, tips bow-down (`map-airship-tilt`); the hero
  jumps out in an arc and lands on 4-2 (`map-dust-0/1`); the ship dives onto the bonus spot and
  crashes (`cannon` boom, `map-wreck`, dust, smoke); Toad walks in from the left (`toad-map-0/1`),
  hammers three blows facing right (`toad-map-hammer-0/1`, planks fly), the wreck becomes the bonus
  node, Toad waves and walks off (6.5 s, `CRASH_FRAMES`); then the road draws in as before. The
  announcer narrates each beat. JUMP (or MENU) skips to the end: the road drawn, the hero on 4-2,
  the node shown. With reduce flashing the crash has no white flash. It never replays (a reload
  mid-way only draws the road; taking the ball again plays nothing) and nothing plays without
  beating Larry (`tests/sim/airship-crash.test.ts`).

- **The deck** (`src/content/levels/world4/4-2-airship.map`, parent 4-2, theme `airship-deck`,
  music `airship`, `camera: auto` at `scroll: 0.375` px/f: about 58 s): SMB3 World 1's airship
  transcribed onto one 15-row screen, 98 columns. The bow (raised bow platform, the start and the
  anchor chain's step-off at column 3, over a stair-stepped prow), the fore deck (two `ul`
  cannons, a Rocky Wrench, a blaster step right against the tall 2×3 post), the long low middle
  deck on two hull segments (a 2-wide gap, a 3-tall blaster post at column 44 whose bills fly
  over a standing hero, a post, a mushroom ? block 5 rows up) under the plank overhang with two
  `dl` cannons and a three-cannon turret, the thick block over the gateway, then the lower stern deck (a Rocky
  Wrench), four 2-wide steps up to the railed stern deck with portholes and THE PIPE. Every pit is
  2 wide. `tests/sim/airship-deck.test.ts`: every hero crosses under the auto-scroll, and with
  damage on every hero reaches the pipe (small Mario and Luigi unhit); over 20 random blaster
  timings (10 seeds, each from a standing start and after 200 idle frames) small Mario, small
  Luigi, Link and Mega Man each reach it at least 19 times of 20; standing still, the scroll
  carries the hero off the bow and squashes them against the first cannon (~12 s). The bot is `tests/sim/airship-bot.ts` (also `rideToStern`'s driver).
- **Cannons** (`cannon x y dir=r|l|ul|ur|dl|dr [period=150] [delay=]`, entities/enemies/cannon.ts):
  a solid block (its cell is made solid) that fires a cannonball out of its barrel every `period`
  frames while on screen (first shot staggered by position, or `delay`), with the `cannon` sfx; it
  holds a point-blank shot while a hero is at its muzzle. The ball flies straight through
  everything (1 px/f, or 0.75 px/f per axis on a diagonal), hurts on contact, drops when stomped
  (100 points) and, like a Bullet Bill, shrugs off fire, boomerangs and ice.
- **Rocky Wrench** (`rocky x y`, entities/enemies/rocky-wrench.ts): hides in a manhole in the deck
  under cell (x, y); pops up when a hero is within 8 tiles (never within 2 tiles of one, so it
  never rises into a hero nor throws point-blank), faces them, throws a wrench that flies flat at
  1.25 px/f, and ducks back for ~1.7 s. Only while up (half out on the way up, until it starts
  ducking) can it hurt or be hit (any attack, a stomp; 100 points).
- **The room** (`src/content/levels/world4/4-2-larry.map`, parent 4-2): one locked screen,
  enclosed like SMB3's (the owner's reference, built to the SMB3 art's frames and mock), no sky. The
  log back wall (`H`, not solid) fills the room (rows 0-1 under the HUD stay clear), with two `smb3:porthole`
  windows at (5,6) and (10,6). The ceiling row (row 2) and both edge columns (0 and 15) are solid
  (`%`) and covered by 16×16 smb3 decor, one per tile: `smb3:ceiling-beam` along row 2 (columns
  1-14) and `smb3:pillar` down columns 0 and 15 (rows 2-12). The floor is log posts: `#` the post
  tops on row 13, `%` the posts carrying on below on row 14, and one raised post with its top at
  (7,12) and its post at (7,13). As in SMB3, the hero drops in from the ceiling (`startMode: fall`,
  from the deck's stern pipe): out of a green pipe hanging from it at the left (`smb3:ceiling-pipe`
  at (1,3), 40×32, its 32-px pipe 8 px in; decor drawn over the players, so he comes out of its
  mouth), down the open ceiling over column 2 onto the floor; Larry starts on the floor at the right (`larry 12 12 next=4-3`: the
  tile his feet stand in; `next` is where the ball leads outside the campaign). Theme `airship`,
  music `smb3-boss`.
- **Larry** (`src/game/entities/enemies/larry.ts`, an `Enemy`): a second's wait, then hops at the
  hero (12 px high, 0.75 px/f across), a high jump now and then (30%, about 60 px; always when
  the hero is within 24 px, so he jumps over), and after every two moves he stops, raises his wand
  and fires a **wand blast** (`WandBlast`, a ring flying in a straight line at 1.5 px/f toward the
  hero's middle where he was; through walls; at most two out; it hurts like any enemy shot).
  **Hits**: 6 hit points in half-stomps. A **stomp** takes 2 and sends him into his **shell**: he
  spins on the spot (24 frames), slides at the hero at 2 px/f bouncing off walls (80 frames), and
  comes out (20 frames). In the shell nothing hurts him: a stomp bounces the hero off unhurt
  (reaction `'bounce'`, which `World` now treats as a harmless bounce for stomps; no score), and
  everything else is immune; the sliding shell hurts to touch. **Fireballs and the other heroes'
  attacks** (sword, whip and every melee hit, buster, weapons, bombs, and Samus's Ice Beam, which
  can't freeze him) take 1 each (2 for a heavy hit, amount 3 or more, like Mega Man's charge shot),
  then he flashes for 40 frames (`smb3-flash`), immune to attacks (a stomp still counts).
  Boomerangs, bumps and the star do nothing. So: three stomps, or six fireballs. Every hero's main
  attack hurts him (a table test over the roster, `larry.test.ts`).
- **Beaten**: his rings vanish, the music stops, "BWAH!" rises over him (5000 points), he holds
  the hurt pose for half a second, then vanishes in a puff and flies off spinning in his shell.
  The **crystal ball** (`objects/crystal-ball.ts`) drops where he was and lands on the floor.
- **Touching the ball** (`crystal-ball` world event): the cabin freezes, the `castle-clear` jingle,
  and the card "THE CRYSTAL BALL SHOWS / WHERE YOUR FRIENDS / ARE HIDDEN!" (`CRYSTAL_BALL_CARD`,
  announced; OK goes on). Then, in the campaign, `Game.takeCrystalBall`: a **secret exit of 4-2**
  (`rules.secretExit`, key `larry` = `CRYSTAL_BALL` in `map/captives.ts`): back on World 4 with the
  hero on 4-2, only the road to the bonus spot drawn in (docs/WORLD_MAP.md "The bonus spot and its
  Hammer Bro"); 4-2 is **not** cleared. The file's `inventoryUnlocked` is set (the SMB3 item
  inventory; a file with `larry` in its secrets counts as unlocked). Outside the campaign play
  goes on to `next` (4-3); an editor play-test ends.

### Larry's airship challenge (`scenes/airship.ts`)

The deck and the room play with the current hero(es) as real levels, but end like a mini game
round. Co-op works (both players board; a partner's respawn aboard is free).

- **Boarding** (campaign only): `Game.startLevel` into `4-2-airship` or `4-2-larry` from any other
  level starts a run (`Game.airship`, an `AirshipRun`) and snapshots the run state as it was
  before (`snapshot()` from free-hero.ts: lives, power, hp, kit, score, coins, 4-2's checkpoint).
  Any other level, the map or the title ends the run. Dev select / `?level=` never start one.
- **No clock aboard**: `LevelScene` sets the world's time to null (the status bar leaves it blank).
- **SMB3's status bar** (0.4.14, `hud/smb3-status.ts`): aboard (deck and room, any way in) the
  level draws SMB3's bar along the bottom (WORLD, the P-meter, coins; the hero's badge and lives,
  the score, the clock; three end-card slots) instead of the HUD across the top, and its world
  32 px higher (`renderSmb3World`), so rows 2-14 fill the screen above the bar. The Hammer Bro
  battle and the bonus games use the same bar.
- **A death** never costs a life: `TRY AGAIN?` YES / NO (announced). **YES** (`retryAirship`)
  restarts the deck as it was boarded, or Larry's room once it has been reached (dropping in from
  its ceiling pipe again), with the run as it was when that area was first entered. **NO** (`leaveAirship`)
  restores the pre-boarding snapshot and goes back to 4-2 at its last checkpoint (4-2's own respawn
  rules: its start without one, a fresh clock, the WORLD card; no hero select).
- **MENU** aboard is `MiniGameMenuScene` titled LARRY'S AIRSHIP: Continue / Give up (= NO) and, in
  dev mode, Assists.
- **Held items** (mushroom/flower/Starman used on the map) given at an airship area's start are
  folded into the run's snapshots (`AirshipRun.itemsGiven`), so a retry or NO keeps them once.
- **Beating Larry**: the crystal ball exactly as before. The run ends in the card's OK
  (`airshipWon`), then `Game.takeCrystalBall(levelId)` is the campaign's hand-off to the map.
- **Dev → Mini games → "Larry's airship"** (`AIRSHIP_CHALLENGE`): character select first (every
  hero outside a campaign, the current one preselected; Back is the list), then deck + room as one
  round over the dev list as the picked hero; the ball is PASS, a death FAIL (no retry prompt), Give
  up QUIT, then the dev result card; nothing is saved.
- **The crystal ball's hint**: from then on every hero not freed yet shows its silhouette by its
  level's node (stage 2 above) even before that level is cleared, with the same announcer line and
  hint line (`heroHint` in `map/captives.ts`). A node the file has not reached (its page not open, or
  open only through developer "Unlock all") still shows nothing.
- **Art** (the SMB3 sheet `smb3`, `content/sprites/smb3.ts`): Larry's frames face left (flipped to
  face right) and are bottom-anchored, drawn bottom-centred on his body: `larry-0` standing and
  aiming, `larry-1` in the air (feet tucked up, wand raised), `larry-hurt` (no wand) for the first
  10 frames after a stomp and while beaten, `larry-shell-0..3` spinning. A hit flash blinks him in
  the `smb3-flash` palette; with reduce flashing he stays in it, without blinking, for the flash
  time. `wand-blast-0/1` and `crystal-ball` (bottom-centred on its body).

## The unlock flow (`src/game/scenes/free-hero.ts`)

Every step is a scene pushed over the paused level, so the level's clock and world stand still.
Talking to the captive first marks the hero as **met** on the file (`SaveFile.met`, below), which
puts its mini game in the Mini Game Arena:

1. Dialogue cards in a box over the level. The hero says "...LUIGI SERVES KING KOOPA..." and then
   the challenge (per hero in `DIALOGUE`, with a generic line built from the title, wrapped to
   the box). The challenge names the hero of the player who talked (player 2's in co-op). OK, B
   or MENU goes on; the box shows OK once it takes input, and each card is announced with "OK to
   continue."
2. A rules card: `MiniGameDef.title` and `rules`. It waits for OK; it never starts the round by
   itself.
3. One round: `def.create(game, done)` is pushed.
   - `pass`: the "LUIGI IS FREE!" card (the hero's full name: "MEGA MAN IS FREE!"). The hero is added to `freed` and saved at once, and
     the captive leaves in a puff. Then back to the level.
   - `fail`: TRY AGAIN? YES starts a fresh round (a new `create`), NO goes back with the captive
     still there.
   - `quit`: back to the level.
4. Back: the level resumes exactly as left, with its music restarted. The press that closed the
   last card does not make the hero jump. The run's GameState is restored after each round, so
   a mini game cannot change lives, power or score.

## Met heroes and the Mini Game Arena (0.4.7)

- **`SaveFile.met?: string[]`** (optional, no format bump): hero ids whose captive was talked to at
  least once (`Game.meet(id)` from `talkToCaptive`, saved at once), plus `'larry'` once Larry
  Koopa's airship is boarded (`boardAirship`). Freed heroes always count as met. Older files derive
  it on load from `freed` (and `'larry'` from the secret `larry`): `save-files.ts metIds`.
- **The Mini Game Arena** (`src/game/arena/`, the `arena` map page off the Warp Zone hub's first
  pad; docs/WORLD_MAP.md): one pad per game, built from the registries, so a new `MINIGAMES` entry
  or a new hero with training lessons gets its pad by itself. Found rules: a hero's mini game once
  the hero is met; 1-0 once cleared or skipped; a training room once the hero is in `tutorials` or
  freed; Larry's airship once boarded (or beaten); the three bonus games once the bonus spot exists
  (secret `larry`). Unfound games are dark "???" pads (the hero's black silhouette and a `?`) whose
  hint line says what to find; JUMP bumps.
- **A round** is Dev → Mini games' round (`scenes/dev-minigames.ts playRound`) over the map: no file
  is open while it runs, and the run, freed and met heroes, training answers, map progress and
  bonus state and items are put back after, so playing never changes progress, lives, items or
  the save (`tests/sim/arena.test.ts` checks the file byte for byte for every game). Then the
  same result card (PASS / FAIL / QUIT) and the map again, on that pad. The 1-0 pad plays the stage
  as a round (`arena/stage-round.ts`, `Game.stageRound`): its exit passes, pause → Give up quits.
  Training rooms pass when every lesson is done (Skip training or a skipped chapter quits); bonus games pass with a
  prize; the airship passes with the crystal ball. No best results are kept.
- **Larry's airship is played as a hero of your choosing**, the one arena game that is: its pad
  opens character select first (`DevRound.asHero`, `pickRoundHero`; the file's freed heroes, the
  others silhouettes, dev "All heroes" frees them; the current hero preselected; no training
  question). Player one plays that round as the picked hero (keeping the current hero keeps its
  power, another starts from its default), player two keeps theirs, and the file's own hero, power
  and lives are put back after like everything else. Back is the arena again with nothing started.
  Every other game starts at once.
- **Words in a round** stay neutral (`Game.inRound`, set by `playRound`, so the arena and Dev →
  Mini games alike): a mini game's Give up says "Ends the round" (not "Luigi stays brainwashed for
  now"), a bonus prize says "YOU GOT A FIRE FLOWER! (JUST FOR FUN)" (nothing goes to the items),
  and a win says nothing of a spell or curse breaking (Link: "YOU ESCAPED THE KEEP!"; Simon:
  "DRACULA IS DEFEATED!" alone; Samus and Mega Man without "The spell ... breaks").

## The `MiniGameDef` contract (`src/game/minigames/types.ts`)

```ts
interface MiniGameDef {
  hero: string; // the CharacterDef id it frees
  title: string; // rules card and announcer, e.g. 'MIRROR RACE'
  rules: string[]; // rules card lines: ability names, never button letters, at most 26 columns
  create(game: Game, done: (result: 'pass' | 'fail' | 'quit') => void): Scene;
}
```

- `create` builds one round as a scene. The flow pushes it and pops it (along with any scenes
  the round pushed itself) when `done` is called. `done` must be called exactly once.
- The round owns its music, touch labels and its own menu (Continue / Give up → `done('quit')`).
- Register it in `MINIGAMES` (`src/game/minigames/index.ts`); the Mini Game Arena gives it a pad. The flow looks it up only through
  `miniGameFor(hero)`, so a mini game folder can be replaced, for example by one in the hero's
  own game style, without touching the flow.

## Adding a captive (checklist)

1. A `MiniGameDef` for the hero in `src/game/minigames/<hero>/`, registered in `MINIGAMES`.
2. Optionally, the hero's own challenge lines in `DIALOGUE` (`free-hero.ts`).
3. `captive x y hero=<id>` in a campaign level's `[entities]`, on a spot the player can reach.
   Prove it with a sim.
4. Check the map hint on its node's page: the silhouette and trophy must not cover a road or
   decoration (set the node's `heroSpot`, or move the decoration). No other wiring is needed.

## Link's mini game: the Shadow Keep (`src/game/minigames/link/`)

A small dungeon in the style of the first Zelda game, the spell's prison in Link's mind. You play
Link (overhead, four-way walking on a half-tile grid, three hearts taken in halves). He starts
with only his sword, no beam and no shield (0.4.22, owner note 22): a stab hits the whole tile in front of him plus 4 px to each side (and 6 px
back into his own tile), is out for 12 of its 14 frames, and wins ties: a monster the blade
touches is knocked back and does no touch damage that frame, so monsters coming in at an angle
meet the blade (owner feedback: "attacking with the sword is flawed"). Once he has the **white
sword** from the secret shrine, with every heart full a stab also throws a **sword beam**
(`topdown/beam.ts`, as in Zelda; one on screen at a time, 3 px a
frame [M]): it hurts the first monster it meets like the sword and bursts at walls into four
pieces flying apart diagonally; it flickers through four tints (one steady tint with reduce
flashing; sound `sword-beam`). The HUD is Zelda's (0.4.12 fidelity pass): LEVEL-1 over the map,
the key and bomb counts in a column (bombs from the start, 0 until found; there are no rupees),
the **B** box with the item in the slot and the **A** box with the sword (the letters are the
HUD's art, an owner-approved exception; rules and instructions still name abilities), and
-LIFE- in red over the hearts. Items, Zelda style: SPECIAL uses the item in the B box, SELECT
switches items; touch labels SWORD, the item's name (BOOMERANG / BOMB, hidden while it can't be
used), ITEM (with two items) and MENU. Walking into a chest opens it; Link holds the prize up for
a moment while the room waits, with a banner and announcement saying how to use it (`item-get`).

Eleven rooms, in order: the start (the wake-up line), bats, the cellar (a chest with the
**boomerang**: flies five tiles along Link's facing and back, one out at a time, stuns monsters
for three seconds, the keeper for half a second; brings back hearts, keys and bombs it touches),
a push-block room (one loose block onto a plate opens the shutter; if it gets stuck, leaving and
coming back puts it back), skeleton knights (two hits each; the key appears when they are gone),
a locked door into a room whose shutters open when every monster is gone (a **heart container**
appears there too: three hearts become four, all refilled), the armory (a chest with **bombs**:
four, up to eight, refills dropped by monsters; set one down in front, it blows after 1.5 s,
2 damage to monsters and half a heart to Link within a tile and a half, and opens **cracked
walls**; statues point at the cracked west wall; owner decision: no refill waits there, so
wasting the bombs can cost the optional white sword, by design), behind it the secret shrine (a
chest with the **white sword**, owner decision "make it worth the secret room"; 0.4.22, owner
note 22, replacing the magic shield of 0.4.12-0.4.21, which is gone with its blocking, its
halved touch damage and the shieldless `-ns` frames: from then on a stab at full hearts throws
the sword beam; the banner says "YOU GOT THE WHITE SWORD!" / "AT FULL HEARTS THE SWORD" /
"SHOOTS A BEAM", announced "You got the white sword! At full hearts the sword shoots a beam."),
rock-spitters with a floor switch behind water (it opens the way on and shows a heart refill), the
keeper (drifts across the top, glows, then fans three spells at Link; eight hits, a bomb counts
two; no name on screen, as a Zelda boss has none; its spells vanish when it falls) and the
shining exit.
The cellar and the shrine are side rooms; only the shrine is hidden. Exit reached: `pass`; no
hearts left: `fail` after the death spin; menu Give up: `quit`. Hearts, keys and items live in the
keep, never in `game.state`. Music `dungeon` and `keeper`; sounds `secret` (also a wall breaking
open), `sword-stab`, `sword-beam`, `door-open`, `key-get`, `item-get`, `boomerang`, `bomb-fuse`, `bomb-blast`,
`select`. Dev mode's assists apply: **No damage** (`invulnerable`) keeps Link's hearts against
monsters, rocks, spells and his own bombs (he is still knocked back), read each time he is hurt,
so switching it mid-round counts at once; **slow motion** slows the whole loop, the keep
included; the others have nothing to act on here.
Dev: `?minigame=link` (the scene is `window.__miniGame`; `world.warpTo(roomId, x, y)` jumps,
`world.grant('bomb')` gives an item, a pickup kind or `white-sword`).

Difficulty (a "cautious human" sim, `human-sim.test.ts`: the bot's plan seen through a 15-frame
reaction delay, monster positions misjudged by up to 4 px, pauses and early swings; `KEEP_SIM=30
pnpm vitest run human-sim --silent=false` prints the report, with and without the shrine; it
knows the whole plan, so it measures combat difficulty, not puzzles or finding the way): before v2 it escaped
40% of 30 seeds (70% at a 12-frame reaction, 27% at 18), mostly falling to the keeper. With v2
and the magic shield 97-100% (about 1.8 of four hearts lost to the keeper); skipping the shrine
93-100% (about 2.2 lost). The keeper got two more hit points to keep it a fight. With the sword
beam (0.4.12, `KEEP_SIM=40`): with the shield 100% at every reaction (about 1.4-2.0 hearts lost
to the keeper), without it 93-98% (about 2.1-2.4), the same band as before. 0.4.22 (no beam at the
start, the white sword instead of the shield; `KEEP_SIM=20`): 70-85% with the white sword and
70-95% without the shrine, nearly every loss to the keeper, so the keeper casts a little less
often once it is angry (`CAST_EVERY_ANGRY` 76 → 92 frames): with the white sword 100% at
reactions 12-18 and 85% at 21 (about 1.7-2.0 hearts lost to the keeper), without the shrine
95-100% (about 1.6-2.0).

### The top-down kit (`src/game/topdown/`)

Reusable for later top-down mini games; it knows no particular game.

- `room.ts`: rooms as 11 strings of 16 characters (legend in the file: walls, blocks, water,
  doors `O`/`L`/`X` on the border, spawns such as `b` `n` `r` `P` `o` `_` `k`). Room options:
  `shutters` and `reveal` conditions (`clear`, `plates`, `switches`, `torches`), `music`, `hint`,
  `dark`. `buildDungeon` checks that every door meets a doorway that lines up in the next room.
  North and south doorways are two cells holding one 16-px door in the middle (its jambs are solid).
- `world.ts`: `TopDownWorld` (seeded `Rng`, deterministic): tile collision per mover (hero,
  walkers, flyers, shots, blocks), doors and keys (a key opens both sides of a locked door),
  shutters that close once the hero has stepped in, room memory (conditions met stay met,
  cleared rooms stay empty, a solved block stays put, an unsolved one resets), room slides and
  events for the game to turn into sounds and announcements. The update order is documented there.
- `hero.ts`, `entity.ts`, `enemies.ts`: the hero (corner rounding into gaps, `swordReach`, the
  throw and hold-up poses; no shield since 0.4.22), enemies with
  knockback, stuns (`stunFor` lets a boss shorten them), invulnerability and drops (bat, knight,
  spitter), shots, pickups (`heart`, `key`, `heart-container`, `refill`, `white-sword`, ammo, items),
  chests (`c`, contents in the room's `chests`), push blocks, switches, torches. A game adds its
  own spawn kinds (the keeper) through `spawners`.
- `items.ts`: `TdItem` (label, icon, optional ammo, `ready`, `use`), the `Inventory` (owned items,
  the slot, SELECT cycling, ammo caps), and the kit's boomerang and bombs with the `Explosion`
  entity (`world.blast` hurts monsters and the hero in a radius and opens cracked walls).
  Cracked walls (`C`) are a tile kind: inside a room a wall cell, on the border a doorway (door
  kind `cracked`, opened on both sides by a blast); `wall-cracked` / `wall-hole` frames.
  `world.grant(what)` gives anything; `noDamage` (a world option) keeps the hero's hearts. A
  blast with no self damage (0) leaves the hero alone (no knock, no blink). The `hero` world
  option builds a game's own `TdHero` subclass (Jason in Underworld).
- `render.ts`, `hud.ts`, `frames.ts`: tiles drawn for the north wall are flipped for the south
  and rotated for the sides (`withSideFrames` derives `-side` and the doorway halves `-l`/`-r`
  when the sheet is registered); the Zelda-style HUD (the level over the map, keys and ammo,
  lettered item boxes, -LIFE- in red over the hearts).
- `beam.ts`: the sword beam (`swordBeam`, a world option, default off; a `white-sword` pickup
  turns it on) and its burst.
- `bot.ts`: a breadth-first-search player driven by a per-room plan (a list of steps, or a
  function of the world for rooms passed twice): fights (stunning with a boomerang it owns),
  pushes, opens chests, bombs walls. `CautiousBot` wraps it as a cautious first-time player for
  difficulty tuning.

## Mega Man's mini game: Station Escape (`src/game/minigames/megaman/`)

An NES Mega Man style stage on the space station above 3-1, played **as Mega Man**, ending in a
fight with **Dark Mega Man**, the brainwashing's copy of him. It runs in a real `World` of its own
(stage.map, loaded with `?raw`, not in the level library) with a fresh GameState: Mega Man with the
helmet kit (`{ helmet: 1 }`: buster, charge shot, slide, and Rush Coil, which comes with the
helmet), full 28 hit points, three lives, no clock, and Mega Man 2's camera (screens, below). Each
life starts with READY blinking on the empty start spot (the stage music already playing; the
press that started the round never jumps), then Mega Man beams down onto it (World's `beam`
arrival) and only then moves. The HUD is Mega Man 2's: bars only (`hud.ts`: the selected weapon's
energy at x 16 while a weapon is selected, life at x 24, the boss at x 40, tops at y 24), no name,
score or lives.

- **NES form** (`nes-form.ts`, `NES_MEGAMAN`; the campaign's `MEGAMAN` is untouched, as Bill's
  Contra form in `bill/commando.ts`): Mega Man 2's jump, 4.87 px/f up under 0.25 px/f² either way
  (an apex of about 3 tiles, 50 px, against the campaign's 4.3), a hit's push back with no upward
  pop (a jump stops rising), and shots (buster, charge shot) that pass through walls. Walking
  (1.375 px/f) already matched.
- **Ladders** (0.4.15, `ladder.ts`, NES form only): ladder tiles are `chain` (the ladder) and
  `cloud-ledge` (its top in a floor: one-way solid, stood on from above, climbed through from
  below), drawn as a ladder in the station theme (`chain@station`, `cloud-ledge@station`). UP with
  a ladder behind his middle takes hold (on the floor or catching it in the air), DOWN on a ladder's
  top takes it down; he snaps to its centre and climbs at 0.75 px a frame, hanging still with
  nothing held. LEFT / RIGHT only turn him; SHOOT fires that way (frame `climb-shoot`) and the
  shot's pose holds him still. JUMP lets go (a drop, no jump up); a hit knocks him off. Down onto a
  floor stands him there; down past a ladder's foot drops him. At the top the last 8 px show the
  climb-over (`climb-top`), then he stands on the ladder's top. While he holds a ladder his Player
  is `frozen` and the ladder code moves him (`scratch.ladder`, `scratch.ladderTop`).
- **Screens** (0.4.15, Mega Man 2's camera; the map is `camera: free`, 45 rows, but the scene moves
  the camera, never World): `screen x y w=N` lines in stage.map are the sections (15 rows from row
  y, N columns from column x). Inside one the camera follows Mega Man sideways (80 px from the
  left) within its columns; his middle going off its top or bottom onto another section starts a
  flip: the station holds still while the camera moves a whole screen up or down in 60 frames
  (4 px a frame) and he is nudged just inside the new one (still on his ladder, or still
  falling). The last screen's robots, shots and drops vanish at the start of a flip and the new
  screen's robots are spawned fresh at its end (World never spawns them: `isRobotSpawn`), so going
  back to a screen brings its robots back, as in Mega Man 2. A beam down starts at the camera's
  top (`World.alignBeam`).
- **Lives** (`minigames/lives.ts`, `MiniLives`, on Bill's REST model): a life lost (orb burst,
  `WorldStart.deathStyle: 'orbs'`, the `mm-death` sound instead of Mario's jingle) restarts in a
  new World at the last checkpoint: the stage start, column 40 (past the capsule), the top of the
  shaft (column 77 of the top run, reached at 66 in its rows), or the boss door (the landing room
  under the drop, column 116, reached on landing: through the shutters again, and his bar fills
  again). Full hit
  points; the Saw Disc stays his with the energy it had (back on the buster), and the capsule
  stays gone. Losing the last life is GAME OVER (180 frames), then `fail`.

- **The stage** (0.4.15, laid out as Mega Man 2's stages go; theme `station`: steel floor,
  bulkhead plating behind a corridor band, space above, the station sheet's windows, consoles and
  girders as `deco` entities drawn in front of the plating): a run of five screens along the
  bottom (floor, steps, three three-tile pits, the capsule halfway), a shaft at its end (the
  ladder at column 71 climbs two screens through the ceiling to a ledge with a Met, the ladder at
  75 on up through the floor of the top run), the top run (three more screens: a step, a pillar
  with a ceiling turret), a hole at columns 119-121 that drops two screens down a chute into the
  landing room (a Met), then the shutters. The robots (the station sheet's
  frames; they face left and are flipped to face right; a hit flashes them in `station-flash`), each a station `Robot` (an `Enemy` with hit points that blows up
  in a small explosion and drops from Mega Man's own drop table, an E-tank kept for the weapon
  screen):
  **Hopper** (3 HP: crouches, then hops toward Mega Man, short and tall in turn),
  **Met** (0.4.14, Mega Man 2's hard hat, 1 HP, six over the screens: hidden under its hat every shot
  bounces off with a `dink`; with Mega Man within 96 px it lifts the hat after 70 frames, fires a
  three-way spread at him, level and up and down a slant of about 27°, and hides again 40 frames
  later; one hit while it is up; frames `met-0` hidden, `met-1` up),
  **Turret** (3 HP: on the floor, or hung upside down under a ceiling; shut, its armour turns
  shots away; it opens and fires a burst of three pellets aimed at Mega Man, a floor turret never
  aims down, a ceiling turret never up) and
  **Drone** (2 HP: sways in a sine while drifting over, dives straight down on Mega Man when he
  stands below it, never at him mid-jump, never below its screen's floor line, and climbs back).
  Pellets take 2 hit points, a robot's
  touch Mega Man's usual 4.
- **The weapon capsule** sits on the pillar halfway (on the path): touching it, or passing anywhere
  above it (a jump over the pillar cannot skip it; Rush Coil can), unlocks the **Saw Disc** (`weapons: 1`, full energy; no new weapon code). The station holds still for a second, the
  `capsule` sound plays and a banner (24 columns, clear of the bars) and the announcer say WEAPON
  switches to it, USE WEAPON fires it and a held direction aims it (`abilityHint`; a line falls back
  to the bare ability names when its keys don't fit).
- **The boss gate** (Mega Man 2's two shutters, 0.4.14): columns 128's and 143's doorways (rows
  41-42, off the landing room) are two-tile shutters (solid in the map, a `Shutter` drawn over
  each). The landing room's screen ends at the first, so the corridor stays out of sight. Mega Man
  touching the first on the floor opens it; the robots and shots vanish (a screen change), he walks
  through on his own while the camera scrolls 4 px a frame onto the one-screen corridor (columns
  128-143, both shutters in sight) and locks; the shutter shuts behind him (solid again) and he
  walks the corridor himself, the stage music still playing. The second shutter, at its end, does
  the same into the 16-wide boss room (columns 143-158); the music stops there. Dark Mega Man beams
  down, then his bar fills one segment every 3 frames with a `boss-fill` tick,
  NES style, while Mega Man waits (input ignored); the fight starts when it is full.
- **Dark Mega Man** (`dark-megaman.ts`): Mega Man's body, moves (walk, jump, slide speeds from
  `MEGAMAN_PROFILE`) and sprites in palette `megaman-dark`; his shots are dark violet boxes.
  28 HP shown as a third bar beside Mega Man's health and weapon bars (red). A seeded pattern
  (`BOSS_SEED`, it reads only the fight, so the same inputs replay the same fight; `log` records it):
  short stands between moves (his tell), runs toward or away, jumps, three-shot buster volleys, a
  charge shot when Mega Man is far; reflexes: he may jump a buster shot coming at him (30%, a charge
  shot 60%, each judged once, then not again for 70 frames; never the Saw Disc) and may slide under
  Mega Man jumping close (50%). He hurts like Mega Man is hurt: touch 4, buster shot 2, charge shot
  6 (`hurtHero`: the no-damage assist, blinking and knockback as `World.hurtPlayer`). He takes the
  buster (2), the charge shot (4) and the Saw Disc (3, his weakness), with 20 frames of
  invulnerability after a hit (flicker, not with reduce flashing).
- **Outcomes**: beating him bursts him into Mega Man's death orbs (the `death-orb` frame, two rings
  of eight) with "DARK MEGA MAN IS BEATEN!", the victory jingle, Mega Man beams out, then `pass`.
  Mega Man at 0 hit points or in a pit costs a life; `fail` after GAME OVER. Menu
  (`StationMenuScene`, from the weapon screen's MENU row) Give up: `quit`.
- **The weapon screen** (0.4.14, `weapon-menu.ts`, `StationWeaponScene`): MENU opens Mega Man 2's
  START screen in place of the menu: a dark blue panel with the weapons he carries (P, the Mega
  Buster, whose bar shows his life as in Mega Man 2; the Saw Disc once taken; Rush Coil), each with
  its energy as a row of 28 ticks, the E-tanks (`×n` and four boxes; OK there fills his life when
  he has one and is not full; they last across lives), MEGA MAN ×lives, and a MENU row that opens
  the round's menu (Continue goes straight back to play). Up / down choose (wrapping, announced
  with the energy), OK on a weapon equips it and play goes on. MENU closes the screen from any row
  as START does in Mega Man 2 (taking the weapon under the cursor; never using a tank or opening
  the round's menu, which replaces the screen rather than stacking over it). The chosen label blinks
  (held lit with reduce flashing). The campaign's Mega Man keeps the usual pause menu. `done` is called once; `game.state` is never touched.
- Music `mm-station` on the stage and `mm-boss` from the boss's entrance, `castle-clear` for the
  win; sounds `boss-fill` (each bar notch), `beam` (his entrance, Mega Man's exit), `capsule`
  (`art.ts` names them all).
- Touch labels: Mega Man's level labels while he plays (`levelTouchLabels`: JUMP, SHOOT, the
  weapon's name, WEAPON with two or more), only MENU while READY, the capsule, the gate and the
  entrance run, none once the round is decided. Dev assists: No damage keeps every hit point (a pit
  still costs a life, as in a level, unless the Safety floor assist catches it); Infinite lives
  keeps the count. Dev: `?minigame=megaman` (the scene is `window.__miniGame`), or Dev →
  Mini games.
- **World hook** `WorldStart.deathStyle` (`world/death-style.ts`): `hop` (the default, Mario's
  jingle and hop, unchanged), `orbs` (Mega Man), `explode` (Samus: flashes, steady with reduce
  flashing, then her suit's pieces fly apart), `collapse` (Simon: no hop, he drops to the floor
  and lies in his `die` frame) and `ninja` (Ryu: thrown up and back, then lies there). Each has its
  own sound (`content/sfx/deaths.ts`; `WorldStart.deathSfx` overrides it) and length before `died`
  (`DEATH_FRAMES`); `World.deathTime(p)` and `p.scratch.deathT` give a sprite the death's clock.
- **World hook** `WorldStart.extraEntities(spawn, world)`: a mini game's own entity types without a
  case in `makeEntity`. Asked first for every spawn: an entity takes it, `null` drops it, `undefined`
  leaves it to World's own types. The station's `capsule` and decor come through it
  (`stationEntities`); its robots (`hopper`, `met`, `turret` with `mount=ceiling`, `drone`) are
  dropped there (`null`) and spawned by the scene with their screens.

Difficulty (a "cautious human" sim, `human-sim.test.ts`: `StationBot` with a 15-frame reaction
delay, robots and shots misjudged by up to 6 px, pauses and jumps a little early; it knows the
plan, switches to the Saw Disc and fires it, jumps Dark Mega Man's shots; without the saw it uses
charge shots from afar; `MM_SIM=30 pnpm vitest run megaman/human-sim --silent=false` prints the
report). With the NES form and three lives (0.4.12; the two floor turrets past pits and the
hopper after the last pit moved two columns on, so a stop to wait for one is not at a pit's
edge, where a hit's push back, with no upward pop now, drops him in), with the Saw Disc it wins 100% of 40 seeds at a 12 / 15 / 18 / 21-frame
reaction (on the first life 100 / 100 / 98 / 98%); with the buster alone 100 / 100 / 98 / 95%
(first life 95 / 85 / 57 / 43%). Hit points lost across lives: about 16-21
with the saw, 20-44 without (most of it to Dark Mega Man).
With the 0.4.15 layout (the bot climbs the ladder leading off the top of its screen, the nearest
one at its own level first, shooting from a ladder only what a shot can hurt, and walks into holes
with a floor below), with the saw 100% of 40 at every reaction (first life 88 / 95 / 65 / 88%);
with the buster alone 100 / 100 / 98 / 95% (first life 65 / 55 / 40 / 20%). Hit points lost: about
21-32 with the saw, 27-51 without.

## Samus's mini game: Zebes Escape (`src/game/minigames/samus/`)

The NES Metroid's ending, played **as Samus** (0.4.16): fight through Tourian to the brain,
destroy it, and climb out to the surface before the time bomb goes off. It runs in a real `World`
of its own (stage.map, loaded with `?raw`, not in the level library) with a fresh GameState: Samus
with a toned-down dev kit (`ESCAPE_KIT`: one energy tank, 60 energy, the Long Beam, thirty
missiles, enough for the red door, the barriers and the brain (23); the morph ball and its bombs
are always hers; no Varia suit), three lives, no level clock. No READY: each life starts with
Samus materialising on her spot to her start jingle (`zebes-start`, 2.5 s: sparkles, her grey
outline, then herself; the sparkles hold still with reduce flashing), while she cannot move (the
press that started the round never jumps). The HUD is Metroid's (`hud.ts`): energy-tank boxes
(filled while full) over `EN..nn` (the energy in the tank in use; 30 a tank), the missile icon
with a 3-digit count, and once the bomb is set the escape's TIME counter at the top middle; no
name, place or score. All the art is original (`tourian-look.ts`, `tourian-zebes.ts`), as is the
`tourian` music (MML); the escape keeps `zebes-escape`.

- **The stage** (theme `tourian`: bolted green machine panels, ribbed tube platforms, cracked
  panels for bomb blocks; six screens wide and four high, `camera: free`) is four **rooms**
  (`stage.ts ROOMS`), each a whole number of screens; the camera keeps inside the one Samus is in
  (`Camera.room`), as Metroid's screens never show past a room's walls. The **corridor** (two
  screens): the start, a step, a wall with a **morph-ball tunnel** at the floor (a bomb block
  inside), a cannon and a Rinka spawner. The **hall** (one screen): a cannon, a Rinka spawner and
  the **red door**. The **brain's chamber** (two screens): three **barriers** in the gaps under
  walls hung from the ceiling, cannons, Rinkas, and the **brain's tank** under a wall (the door to
  the shaft is behind it). The **escape shaft** (one screen wide, four high): tube platforms three
  rows apart, each beside the last and never right above a take-off spot, up to the **surface**
  (row 3, a mouth onto the open sky); alarm lights (`alarm-0/1`) on its walls. No pits.
- **Doors** (`Door`, 16x48, in pairs in the wall gaps between rooms): a closed bubble is a wall.
  A blue one opens to any shot (beam, missile or bomb); the red one takes five missiles (beams
  glance off; the NES Metroid's red doors take five) and is a plain door from then on. Open, it
  shuts again after 4 s unless Samus is in it; walking in starts the **scroll**: the world holds
  still while the camera slides to the next room over 64 frames (a screen at 4 px a frame) and
  Samus moves through the tube; the bubble she came through shuts, and the one behind her shuts
  20 frames after she clears it. Going through the red door is a checkpoint.
- **Barriers** (`Zebetite`, 16x48, original art): a wall to Samus until broken; only missiles
  wear one down (four, a stage of damage each, drawn thinner and darker); left alone for 150
  frames it grows back a stage. **The brain** (`BrainTank`, 48x64: an original brain, no face, in
  a glass tank): a wall while it lives; beams glance off; six missiles (the glass cracks at
  three) destroy it in a string of explosions, leaving its wreck (`TankWreck`, glass on the floor,
  back-layer scenery no shot stops on) and the way open.
- **The guards** act only while Samus is in their room (and stop once the bomb is set):
  **cannons** (`Cannon`, under the ceiling, indestructible) fire every 90 frames, turning their
  barrel down-left, down, down-right, down; a shot is gone on the rock or out of its room.
  **Rinkas** (`Rinka`, from a `RinkaSpawner` in the rock): a ring comes out, pauses 8 frames and
  flies straight at where Samus was, through the rock, until it leaves the room; one beam shot
  downs it (it may drop energy or missiles); the spawner sends the next 90 frames after. A touch
  or a shot takes Samus's usual 8 energy (`World.hurtPlayer`: the no-damage assist, blinking and
  knockback as in a level).
- **The bomb and the countdown** (`COUNTDOWN_SECONDS`, 60): destroying the brain sets the time
  bomb: TIME BOMB SET / GET OUT FAST!, "Time bomb set! Get out fast! 60 seconds.", the escape
  music and the alarm. TIME runs 999 down to 0 over the 60 seconds (`timeShown`); the announcer
  calls 30 and 10 seconds. The `alarm` sound plays every 2 s and every half second in the last
  ten, when the music also speeds up (tempo 1.2; reset when the round ends). A red wash swells and
  fades about once a second (twice in the last ten); with reduce flashing it is a steady light
  tint, and the alarm lights stay lit. Nothing of this runs before the bomb.
- **Outcomes**: standing on the surface ends the round: the countdown stops, the HUD goes, Samus
  stands still,
  stars come out over the sky and a column of light rises from the shaft (it pulses; a steady
  swell with reduce flashing), "SAMUS ESCAPED!" and the win jingle, the announcer gives the
  seconds to spare, and the round passes after 240 frames (no ship: the NES escape ends on the
  surface). The countdown reaching zero: Tourian blows up (the `explosion` sound; white and orange
  flicker for 40 frames, then a fade to white; with reduce flashing only the fade) and a life is
  lost after 120 frames. Losing all energy (she explodes, `WorldStart.deathStyle: 'explode'`, the
  `samus-death` sound) costs a life too. The next life starts in a new World at the last
  checkpoint with the kit full: the start, the brain's chamber (after the red door), or once the
  bomb is set the foot of the shaft, with the clock full again and the brain still dead. Losing
  the last is GAME OVER (180 frames), then `fail`. Menu (`EscapeMenuScene`, a
  `MiniGameMenuScene`; it pauses everything) Give up: `quit`. `done` is called once; `game.state`
  is never touched. (NES Metroid has no lives, only continues; the three lives follow the other
  World mini games.)
- **Assists** (dev mode, from the menu): No damage keeps every point of energy. Infinite lives
  keeps the count. Infinite time holds the countdown where it is (said once: "Infinite time: the
  countdown holds."); turned off, it runs on from there.
- Touch labels: Samus's level labels while she plays (`levelTouchLabels`: JUMP, SHOOT, MISSILE,
  WEAPON; BOMB in the ball, no JUMP), only MENU while she materialises, none once a life or the
  round is decided.
  Dev: `?minigame=samus` (the scene is `window.__miniGame`), or Dev → Mini games.

**The auto-scroll camera** (generic, `world/camera.ts`, SMB3's airships): a map's header
`camera: auto` with `scroll: <px per frame>` (decimals fine, above 0 and at most 16; 0.5 when left
out; `scroll:` without `camera: auto` and unknown `camera:` values are parse errors; one screen high
only; `serializeTextMap` writes `scroll:` for auto maps only). The camera ignores the players and
moves right at that speed (`Camera.scroll()`, called once per live `World.update` frame) until its
end (a `scrollStop x` zone or the map's end; `Camera.autoDone`). Its left edge pushes every player
along. Only a wall ahead squashes: a pushed player dies (whatever the assists, as in a pit) when the
column under the body's leading (right) edge holds a solid tile between 4 px below its top and 4 px
above its feet, in a row where the body was not already inside something solid before the push. So
a ceiling a rising lift carries the hero into, a block grown into, the floor, a vine or a pipe being
entered never kill at the edge. No one can run past its right edge. Spawning and despawning work as
in any level (by the camera's edges). The scroll holds while the pause menu is open (the scene is
not updated) and on every frame `World.update` returns early: a death with no one left, a pipe
being entered or left, growing/shrinking, a teleport beam, a level clear; it also holds while a
vine or pit transfer is leaving and while the players climb in on an arrival vine (`World.arriving`,
an anchor chain too). Every other level is untouched (camera tests: no library level but the deck
is `auto` or has a speed).

**The vertical camera** (generic, `world/camera.ts`): a map's header `camera: free` with
`height: N` (at least 15 rows; the text map then needs exactly N rows, and `serializeTextMap`
writes `height:` only when it is not 15) makes a camera that scrolls both ways sideways and follows
the lead player up and down, keeping the body's top between screen y 72 and 128, clamped to the
map. World draws the map through an `OffsetRenderer` (y minus the camera; only the rows on screen
are drawn), while the backdrop and the castle text stay screen-fixed; a pit is the bottom of the
map (`World.heightPx`), and entities fall out at the map's bottom (`Entity.levelHeightPx`, which
World sets before each update). Every other level keeps `y = 0`, draws straight to the screen and
dies at the first screen's bottom exactly as before (camera tests: every library level is one
screen high with a horizontal camera, and a normal World hands entities the screen renderer
itself). Spawning is still by column, so a tall map's creatures should keep `despawnMargin` null.
A scene can also set `Camera.room` (subpixel bounds): the camera then keeps inside that room
whatever it follows (Zebes Escape's rooms); null, the default, is the whole map.

Difficulty (a "cautious human" sim, `human-sim.test.ts`: `EscapeBot` knows the route as a table of
surfaces and what to do from each (walk, roll and bomb a tunnel, shoot a door open and walk
through, missiles into a barrier or the brain, climb), so a fall down the shaft just resumes from
where it lands; it shoots Rinkas that come level with it or straight above. As a careful
first-timer it sees the Rinkas 15 frames late, misjudges take-off spots by up to 6 px (halving the
error after a failed jump), lets go of 12% of jumps early and pauses now and then;
`ZEBES_SIM=30 pnpm vitest run samus/human-sim --silent=false` prints the report). With the 60-second
escape and three lives it gets out 100% of 30 seeds at a 12 / 15 / 18 / 21-frame reaction, 100% on
the first life, with a median of 24-30 seconds to spare (the closest 3-12 s), losing about 40-47
energy on the way (the brain's chamber is where lives go). A clumsier player (21 frames, 10 px, a
quarter of jumps let go early) gets out 93%, 57% on the first life, with a median of 19 seconds.
A sharp run leaves about 34 seconds. Both sims also check that at least 70% of cautious runs win
on the first life.

## Simon's mini game: Dracula's Castle (`src/game/minigames/simon/`)

Simon is Dracula's thrall; the round is an NES Castlevania-style castle stage and Dracula's
throne room, played **as Simon** with his own kit (no new weapon code): the chain whip (`whip: 1`)
and five hearts; a candle in the entrance hall drops the **dagger** (`subs: 1`, a banner and the
announcer say how to throw it; each throw takes a heart). It runs in a `World` of its own
(stage.map with `?raw`, not in the level library) with a fresh GameState, three lives, no level
clock: the scene keeps its own **300-second clock** (held by the Infinite time assist; at 0 Simon
falls).
READY shows first. Theme `crypt` and the `crypt` sheet (`art.ts`: `drawCrypt` draws a crypt frame,
or a plain box for one that does not exist; nothing throws).

- **The stage** (112 columns; rows 0-1 stay empty under the HUD; below them every empty cell is
  the crypt's black-brick `wall` backdrop under a `wall-top` cornice, with four open windows,
  stained glass, and in Dracula's room barred windows and his coffin on its dais, as decor): the entrance hall (candles, a bat),
  **stairs up** (`stairs 18 12 len=5 dir=ur`) onto the battlement walk (a brick block from column
  23, so the flight must be climbed; a roast candle at its start; Medusa heads), **stairs down** (`stairs 50 12 len=5 dir=ul`)
  into the bone hall (two skeletons, a bat), the gallery (Medusa heads low), the **door**
  (column 96, rows 11-12) and the 16-wide throne room (`scrollStop 97`: the camera locks there
  as the door opens; Simon walks in, it shuts).
- **Candles** (`candle x y [drop=heart|big|dagger|meat]`, 8x16, 4 px down in their tile so a
  standing lash reaches them): harmless; the whip or a dagger snuffs one (sfx `candle`) and it
  leaves a small heart (1), a big heart (5), the dagger or a **wall roast** (+8 hit points).
- **Creatures** (stage-creature hits cost one bar of 16; Dracula's two): **bats** (`bat x y`)
  roost until Simon is within 96 px, swoop to his head height and fly straight on, bobbing;
  **Medusa heads** (`medusa x y len=N`: while Simon is in columns x..x+N-1, one every 220
  frames, one at a time, from the edge he faces, a 16 px sine wave around row y at 0.625 px/f); both
  **crumble when they strike** (no chain of hits as one drifts along with him). **Skeletons**
  (`skeleton x y`, two lashes) pace by their post facing Simon and lob a bone in an arc timed to
  land where he stood. A lash knocks bones and fireballs out of the air.
- **The HUD** (`hud.ts`), Castlevania's three lines on a black band: SCORE-000000, TIME and
  STAGE 18; PLAYER with its bar, the sub-weapon box (over the two lower lines) and the hearts;
  ENEMY with its bar and P (lives). 16 segments a bar. Kills float no "200" (`scorePopups:
false`); the score is on the HUD.
- **Simon's Castlevania form** (`hunter.ts`, `SIMON_HUNTER`, this mini game only; the campaign's
  `SIMON` is untouched and a test checks it): full walking speed (1 px/f) from the first frame
  and a dead stop on release; a lash on the ground roots him (no walking, turning or jumping until
  it is done; in the air the arc carries on); a hit turns him to face it and throws him back in a
  fixed arc (1 px/f back, 2.75 px/f up: about 24 px high and 35 px long) with no control until he
  lands (none on stairs). The jump is his committed arc, as before.
- **Dracula** (`dracula.ts`), two forms, each with a full ENEMY bar (8 hit points each, two
  segments a lash). **Phase 1, the Count** (music `cv-boss`): gone, appears (sfx `dracula-teleport`)
  at one of four spots (never the last one, never within 48 px of Simon, preferring within 100),
  opens his cape and 28 frames later throws a **three-fireball spread** from his low hand (level
  at lash height, one rising over Simon, one dropping to the floor), lingers ~2 s, vanishes. Only
  his **head** can be hurt (a separate 16x16 hit box over his 20x42 body; the body clinks), and
  only while he stands there; 24 frames of grace after a hit. **Between the forms** (no screen
  tint with reduce flashing): his bar empty, his **head flies off** (`FlyingHead`, sfx
  `beast-roar`), the headless body (`dracula-headless`) stands 50 frames and bursts, and 80
  frames in the **beast** drops in through the ceiling's line (music `cv-beast`) as the ENEMY
  bar **fills again** (a hit point every 4 frames, sfx `boss-fill`); the fight goes on once it has
  landed and the bar is full. **Phase 2, the beast** (48x48 art, 36x40 body): it spits first,
  then two hops, a fan, two hops... A **hop** lands 56 px short of Simon (back to 104 px if it is
  there already), too low to run under (about 33 px). Cornered (his centre within 24 px of a
  wall) or crouching, it takes a **high leap** (about 96 px) that comes down on him, and he can
  run under it. Its **fan** (after a 40-frame roar with its maw open) is three fireballs at once,
  the middle one at Simon, 0.35 rad apart; a lash knocks them away. Only its **head** can be hurt
  by the whip and the dagger (`BeastHead`, 16x16 at its front, above a standing lash: jump and
  lash it); holy water burns it anywhere; the body clinks. No shock wave (Castlevania has none).
  The room is dressed as Castlevania's: two tall barred windows and the coffin on its dais.
- **Lives and death** (`minigames/lives.ts`): three lives (P-03 on the HUD). Simon dies
  Castlevania's way (World `deathStyle: 'collapse'`, sfx `cv-death`, no Mario hop or jingle): he
  drops and lies in his `die` frame. With a life left the next one starts at READY at the last
  checkpoint, as a fresh World: the entrance hall, the bone hall (`CASTLE_MID`, once he is down
  the second flight) or the door to Dracula's room (`CASTLE_BOSS`, once it has opened), with his
  start kit (no dagger, five hearts), every hit point, a full clock and Dracula whole again.
  Infinite lives (dev assist) keeps the count.
- **Endings**: beating the beast passes (banner DRACULA IS DEFEATED! THE CURSE IS BROKEN., the
  jingle, 5 s); losing the last life shows GAME OVER (`GAME_OVER_FRAMES`) and then fails (the
  shared TRY AGAIN); the menu's Give up quits (`CastleMenuScene`, the shared MiniGameMenuScene
  with the dev assists). `done` is called once.

Difficulty (`human-sim.test.ts`, `CastleBot`: it follows the route, lashes candles and whatever
its prediction puts in the lash after the wind-up, keeps clear of Medusa heads until it can lash
them, stands off while Dracula casts, lashes the level fireball, then steps in and jump-lashes his
head on the way down; against the beast it reads where a leap will land off the arc it sees (with its misjudging), moves to lashing range of it (under
a high one when the wall is too close), jumps and lashes its head as it lands, and backs off when
its maw opens; `CV_SIM=30 pnpm vitest run simon/human-sim --silent=false` prints the report): a
sharp run passes unhurt. As a careful first-timer (sees things 15 frames late, misjudges by up to 6
px and its jump-lash by up to 2 frames, pauses now and then, steps closer to a candle its lash fell
short of, judges Dracula more closely after each hit or missed lash) it passes all 30 seeds at a
12, 15 and 18-frame reaction, losing 6-7 hit points a run (about 4 of them to Dracula) with a
median of about 155 of the 300 seconds left; a clumsy player (21 frames, 10 px, more pauses)
passes 87% with the three lives (57% on the first life; 0.6 lives lost a run; every game over is
the beast).
The stage is gentle (one-bar creature hits, three roasts); the fight is the test.

### Castlevania stairs (`src/game/entities/objects/stairs.ts`, any level)

`stairs x y len=N dir=ur|ul [sheet=crypt]`: `x y` is the **bottom** step's tile (its foot stands
on the floor of row y+1); `len` tiles of rise (two 8 px steps a tile); `ur` rises to the right
(tiles (x+i, y-i)), `ul` to the left (tiles (x-i, y-i)). The top landing is the floor beside the
top step (row y-len+1's top, from column x+len on, or up to column x-len), solid in the map. The
steps are scenery (walked through until got on), drawn with the sheet's `stair-r` / `stair-l`
frames (plain stone boxes until they exist). World builds every flight up front and never
despawns them. **Getting on**: on the floor within 8 px of the foot, hold UP; within 8 px of the
top, hold DOWN (`World.grabStairs`). **On them** (`Player.stairs`, `stairWalk`): UP or the way the
flight rises climbs at 0.75 px/f along each axis, DOWN or the other way descends, nothing stands;
no jumping or crouching; attacks work (the walk pauses while one swings); a hit never knocks the
player off. Reaching the foot or the top steps off onto the floor (that end is locked for 8
frames). Vines are never grabbed from stairs. The screen's edges (the camera's left edge, the
co-op and auto-scroll right edge, the level's end) move a player along the flight instead of
off it; the auto-scroll's pushing edge knocks a player off the stairs and pushes (or squashes)
them like anyone else. Anything that moves players itself (a vine grab, pipes, transfers,
teleports, a respawn, the castle maze's loops, the flagpole and the axe) takes them off the
stairs first. Getting on calls the hero's `onGrabStairs` (Samus unrolls a morph ball; she never
curls up on stairs), and on stairs Simon's UP + whip lashes (it throws the sub-weapon elsewhere).
The touch JUMP button hides while player 1 is on stairs, whoever the hero (`levelTouchLabels`).

## Ryu's mini game: Shadow Duel (`src/game/minigames/ryu/`)

Ryu is under the Masked Ninja's curse; the round is a Tecmo-style cutscene, a Ninja Gaiden-style
stage and a duel with the Masked Ninja on a moonlit rooftop, played **as Ryu** with his own kit (no new weapon code): the
sword, his wall cling and wall kick, and ninpo (`arts: 1`, the throwing star, 10 of 40 spirit
points). It runs in a `World` of its own (stage.map with `?raw`, theme `ninja-night`) with a
fresh GameState, three lives and a **150-second clock** (held by the Infinite time assist). Art: the
`ninja` sheet (`art.ts drawNinja`; a missing frame or palette draws a plain box, nothing throws).

- **The cutscene** (`cutscene.ts`, music `ng-cutscene`): letterboxed (40 px bars), a big moon over
  tall grass; the two ninja run in, leap, clash in mid-air in front of the moon (sfx `clang`, the spark
  `cut-clash`; a 3-frame white flash only without reduce flashing) and land back to back; the
  lines come up under the picture a page at a time (`CUT_BEATS`, `minigames/captions.ts`): the
  picture plays on to the page's rest frame and waits there; OK (JUMP) turns the page, on the
  last one ends the cutscene (text never moves on by itself, 0.4.22). SKIP (SLASH) ends it at
  any time; neither press makes Ryu jump. SKIP (with its key) sits right-aligned in the top bar,
  OK at the bottom right once the page waits. Touch: OK, SKIP and MENU. Then READY.
- **The stage** (128 columns, rows 0-1 under the HUD; cling walls are `%`, the dressed stones): the
  street (lanterns, a knife thrower), **building A** (columns 20-27, 7 tiles: too tall to jump;
  climb its face), its roof, the ground (a dog, a hawk, a knife thrower), **the shaft** (a 5-tall
  pillar at 50-51 and the 9-tall tower at 55-63, three tiles apart: up the pillar, then kicks
  between the faces onto the tower), **two 2-wide pits** (70, 76; nothing hostile within ten
  columns), the yard (a dog, a hawk, a thrower), **the last wall** (104-107, the art lantern on
  top), the rooftops (`T`, from 108), the heal lantern, and the doorway in the arena's left
  tower (column 112, rows 10-12). Climbing is Ryu's own kit, taught in the rules card's words
  (HOLD TOWARD A WALL IN THE AIR TO CLING; KEEP HOLDING AND TAP JUMP TO CLIMB) and again, once,
  by a banner and the announcer the first time he clings (building A): each kick off the wall
  brings him back to it about 49 px higher.
- **Lanterns** (`lantern x y [drop=ninpo|big|life|heal|art]`, hung in their tile, a 12x14 body):
  harmless; the sword or an art breaks one: +5 or +10 spirit points, +4 hit points, two of those
  (`heal`), or the next **ninpo art** (`art`: the windmill shuriken; a banner and the announcer
  say NINPO changes art; NINPO shows on touch from then on). Throwing an art is CAST.
- **Creatures** (2 hit points a hit): **knife throwers** (`thrower x y`, two hits) pace by their
  post and, every 120 frames with Ryu in range, wind up for 20 frames and throw a flat knife at
  chest height (crouch under it, jump it, or slash it away); **dogs** (`dog x y`, low: only a
  crouching slash reaches one) wait until Ryu is within 136 px on their own level, bark for 18
  frames and run straight at him; **hawks** (`hawk x y`) circle until he is within 112 px, cry
  and hover (20 frames), swoop down to his chest height and glide level through where he stood
  (a standing slash meets them), climb away and come again; they crumble when they strike.
  **Fair play over pits**: a hawk never turns on Ryu within 80 px of a pit and pulls out of a cry,
  swoop or glide once he is within 48 px of one (a knock carries him about 21 px). Nor does one
  turn on Ryu while he clings to a wall, and one mid-pass pulls up when he clings. Ryu's blade
  knocks any shot away within 8 px (`SHOT_SLACK`).
- **The HUD** (`hud.ts`), Ninja Gaiden's three lines: SCORE-000000 and STAGE-6-2; TIMER, the
  ninpo box (the art in hand, over the two lower lines) and the NINJA bar; P (lives), the spirit
  mark with the points and the ENEMY bar (16 segments each). Points float up nowhere
  (`scorePopups: false`); the score is on the HUD.
- **Banners** (the first cling's two lines, the art's for 2.5 s, the win's) sit in fixed slots
  (`BANNER_SLOTS`, from the strip under the HUD down to low over the street). One keeps its slot
  while it covers neither Ryu (16 px round him, plus where his rise or fall takes him in 12
  frames) nor a lantern, drop, creature or the Masked Ninja, and otherwise moves to the first
  clear slot, so it never creeps and moves about once as he climbs through it.
- **The rooftop arena** (columns 112-127; the camera locks there as the doorway shuts behind
  Ryu): open night sky with the big `ninja:cut-moon` hanging over it, as in the cutscene, a tiled
  rooftop floor, and an 11-tile dressed-stone tower on each side (his wall run, Ryu's cling). The
  screen's top is a ceiling there (`SKY_TOP`): Ryu can't climb out over a tower.
- **The Masked Ninja** (`masked.ts`, music `ng-boss`, 10 hit points; an original rival, never a
  copy of Ryu: he neither slashes nor casts as Ryu does). His round: **stand** → **crouch** (30
  frames: a dash is coming) → **dash** along the floor at Ryu and on to the wall behind him (jump
  him) → **turn** at that wall → **run up** it → on the **wall**: three ninja stars, each aimed at
  Ryu (slash them away, or keep moving) → **aim** (a steady glint at his mask, 20 frames) →
  **dive** in a straight line at where Ryu stood → **recover**, kneeling where he landed → stand.
  Blades clang off him while he dashes, runs up and dives; he can be hurt while he stands,
  crouches, turns, clings to the wall (a jumping slash or an art), aims and kneels (20 frames of
  grace after a hit). From 5 hit points down he is quicker (dash and dive, shorter rests) and his
  **afterimage** (`ninja-ghost` palette) runs each dash and dive 14 frames behind him, hurting
  like him: a jump over the dash has to clear both. Touching him or it costs 2, whatever he is
  doing.
- **Lives and death** (`minigames/lives.ts`): three lives (P-03 on the HUD). Ryu dies Ninja
  Gaiden's way (World `deathStyle: 'ninja'`, sfx `ng-death`): thrown up and back, then he lies in
  his `die` frame. With a life left the next one starts at READY at the last checkpoint, as a
  fresh World: the street, the ground past the tower (`DUEL_MID`) or the rooftops before the
  arena's doorway (`DUEL_BOSS`, once he has gone through), with every hit point, the start's
  spirit points and only the start's art (as in Ninja Gaiden, a death loses the ninpo art he
  picked up), a full clock and the Masked Ninja whole again. Infinite
  lives (dev assist) keeps the count.
- **Endings**: beating him passes (banner THE MASKED NINJA FALLS! THE CURSE IS BROKEN., only the
  first line in a round for fun, the jingle, 5 s); losing the last life shows GAME OVER and then
  fails; the menu's Give up quits (`DuelMenuScene`, the shared MiniGameMenuScene with the dev
  assists), from the cutscene too. A trade (Ryu falling in the update that fells him) passes.
  `done` is called once.

Difficulty (`human-sim.test.ts`, `DuelBot`: it walks right, climbs every wall by clinging and
kicking, jumps the pits and dogs, crouches under knives, slashes lanterns, throwers and hawks in
reach, turns back for a lantern it just passed (the art lantern on the last wall, the health
lantern at its foot, braking in the air to land short of it) and picks up what they leave close
by, the windmill included; on the rooftop it times its jump over each dash (for the afterimage too), waits well across
the room slashing his stars while he is on the wall, walks on away from his wall when his mask
glints, and slashes him while he stands or kneels; `RYU_SIM=30 pnpm vitest run ryu/human-sim
--silent=false` prints the report): a sharp run passes unhurt with 99 of the 150 seconds left.
A careful first-timer (sees things 12-18 frames late, misjudges by up to 6 px, its jump timing by
up to 2 frames, pauses now and then) passes 100% of 30 seeds with the windmill in hand, losing
about 11-12 hit points (about 5 to the Masked Ninja); a clumsy player (21 frames, 10 px, more
pauses) passes 100% of 30 seeds with the three lives (80% on the first life, as before the lives;
0.2 lives lost a run).

## Bill's mini game: Jungle Assault (`src/game/minigames/bill/`)

Red Falcon's aliens have taken Bill's mind; the round is an NES Contra stage 1-style run-and-gun
played **as Bill in Contra form**, a mini-game-only variant (`commando.ts`; his main-game kit in
`characters/bill` is untouched). It runs its own simulation (`jungle.ts`, seeded and
deterministic, no `World`: Contra's ground is one-way floors and a river, not SMB tiles), with a
fresh state, so lives, score and power in the campaign are never touched. Art: B3's `contra` sheet
and the `contra-jungle` / `alien-lair` themes (`art.ts`: a missing sheet, frame, palette, theme or
sound draws a box, falls back to the overworld/castle tiles or a stock sound; nothing throws).

- **The stage card** (`card.ts`, sting `contra-card`): the island map with the route drawn dot by
  dot, 1P / REST 2, STAGE 1 / JUNGLE and a typed briefing. JUMP skips the drawing (SKIP), then
  starts (OK); it never starts by itself (0.4.22: text waits for a key). **The Konami code** on the card (UP UP DOWN DOWN
  LEFT RIGHT LEFT RIGHT, FIRE, JUMP: the title's `CheatCode` sequence, its own instance) gives 30
  lives (REST 29, sfx `konami`, announced); its last JUMP does not start the stage, and a START
  within half a second after it (the NES code's last press) opens no menu. Keys, pad and
  touch send the same actions; FIRE stays on the touch pad (blank) for it. It works only on the
  card; the title's developer code never fires here and never carries in.
- **Contra rules**: 3 lives (the medals top left are Contra's REST, the lives in reserve, at most 4
  drawn), **one hit kills**: the backward death flip (`bill-death-0..3`), then the next life drops
  in from the top of the screen 48 px in from the left with ~2 s of blinking invulnerability
  (steady with reduce flashing). Out of lives: GAME OVER (3 s), then `fail`. The scroll is
  right-only; Bill starts the stage dropping in.
- **Bill in Contra form**: walks 1 px/f; a fixed somersault jump (40 px apex, small round hit box,
  steered at walking pace in the air, no momentum); aim: standing ahead / straight up (UP) /
  up-diagonals (UP + direction, running), running with DOWN the down-diagonals, DOWN alone prone
  (shots low along the floor), all eight in the air. Every grass ledge and bridge is one-way: jump
  up through it, **DOWN + JUMP** drops through (not through a bank or the base floor). In the
  river he wades head-and-gun high, cannot jump, shoots ahead/up/up-diagonally, **DOWN ducks
  under** (no bullet reaches him; no shooting) and climbs out walking into a bank.
- **Falcons** from flying capsules (sine flight in from the left) and pillbox sensors (shut 90,
  half 10, open 80 frames; only open can be hit, 5 hits): **M** auto fire while FIRE is held, **S**
  five-way spread, **L** one beam (a new one replaces it), **F** a corkscrewing fireball, **R**
  faster shots and presses (kept with the gun), **B** a 16 s barrier (touching soldiers or larvae
  fells them). M S L F replace the gun; **death loses the weapon** (default gun, no R, no B). The
  default gun: a shot a press, four on screen.
- **Foes** (`foes.ts`, original designs; they face left in the sheet): running soldiers from the
  screen edge (`SoldierZone`s; some from the left), who hop down at a ledge end and drown in the
  river; riflemen standing and in bushes (they pop up to fire; no point-blank shots); rotating wall
  guns (open once in view, turn one 30° step every 8 frames toward Bill, 12 steps, fire when on
  him; 8 hits); pop-up cannons (hatch, rise, fire left / 30° / 60° up; 8 hits); **exploding
  bridges** (`BlastBridge`: once Bill steps on, a segment every 16 frames flashes 12 frames then
  blows; a running Bill just outruns it; falling lands in the river).
- **The stage** (`stage.ts`, built from spans; 224 columns): the drop zone, bridge 1, the first
  pillbox (on the lower ledge: drop through to it), bridge 2, tiers down to the river and a crag
  with a wall gun, the bank and up, riflemen, a bush sniper and a second wall gun, the second
  river, the spread gun's pillbox, the last ledges (a wall gun, the barrier capsule, a third
  pillbox, a cannon), the base floor. Every stretch of river ends at a bank. Fixed foes come in at
  the screen's right edge as it scrolls; capsules have a queue of their own.
- **The look** (as NES stage 1, original art): a black night sky with sparse fixed stars
  (`tile-render.ts STARRY_SKIES`/`drawStars`, shared with 7-3's jungle look), snow-capped
  mountains far off, a band of palms and undergrowth along every cliff top and bank (decor
  `jungle-band` / `jungle-band-half`), and from column 112 a wall of dark trunks (`jungle-trunks`)
  under the hanging canopy. The defense wall is a tall blue plated wall with two gun towers
  (`defense-wall-tower`, armour too) on its crown.
- **Boss, two phases** (`boss.ts`, on the fight's own clock: the same every round). The **defense
  wall** (camera locked at column 192, music `contra-boss`): two wall cannons lob shells to land
  where Bill stands (every 96 frames each, by turns), a sniper on its crown fires at him (every 110),
  the core glows in the door (24 hits; it beats slowly, steady with reduce flashing); shots stop
  on the wall's face and its towers. The core
  destroyed, the wall blows apart (2 s of booms), and Bill walks on through it, a short drop into
  **Red Falcon's lair** (camera locked again, music `contra-lair`): the heart beats in the back wall
  (48 hits), two mouths overhead open by turns and spit larvae (at most 3) that crawl at Bill and
  leap when near (prone shots meet them).
- **Endings**: the heart bursts: a chain of booms over the lair (a soft flash at most every 24
  frames, only without reduce flashing), the banner RED FALCON'S HEART BURSTS! BILL'S MIND IS HIS OWN! (the first line only in a
  round for fun), the jingle, then `pass`. The menu (`JungleMenuScene`, the shared
  MiniGameMenuScene with the dev assists: No damage, Infinite lives) gives Give up = `quit`. `done`
  is called once. No score (no popups: the HUD is the medals, on a dark backing in the lair).
- **Touch**: card SKIP/OK, a blank FIRE (for the code), MENU; in play JUMP (hidden in the river),
  the gun's name (FIRE, M-GUN, SPREAD, LASER, FIREBALL; hidden under water), MENU; nothing while
  Bill is down or once the round is decided.

Difficulty (`human-sim.test.ts`, `JungleBot`: it runs the route, jumps gaps and up tiers, wades the
river, shoots whatever Contra's aims line up with (never through the wall's armour), stops for
guns and shoots every capsule and pillbox (it cannot see a letter until the falcon is out), drops
through a ledge to the first pillbox, goes back or down for falcons, keeps the spread gun, turns
to what comes up behind it, and dodges by lying flat, jumping, stepping back or ducking under; at
the wall it shoots the core while dodging, in the lair it lies flat for larvae;
`BILL_SIM=1 pnpm vitest run bill/human-sim --silent=false` prints the report): over 30 seeds a
sharp run passes 100% (~93 s); a careful first-timer (15-frame reactions, 6 px misjudging, pauses)
passes 100% (~101 s; 100% at 12 frames, 87% at 18), a clumsy one (21 frames, 10 px, more pauses)
40%.

## Sophia's mini game: Underworld (`src/game/minigames/sophia/`)

Bowser's spell reached Sophia III through the Underworld's radiation; the round is Blaster
Master in brief, both of its modes (owner rule: as true to the NES game as possible; all art and
music original, S3's `sophia` sheet, `underworld` and `bm-dungeon` themes and `bm-*` songs;
`art.ts`: a missing sheet, frame, palette or sound draws a box or plays a stock sound, the
dungeon falls back to the Shadow Keep's tiles; nothing throws). Five parts: the opening, the
tank's cavern, Jason's dungeon and its guardian, the run back to the tank, and the Plutonium Boss
fought in the tank (owner decision: as in Blaster Master, side view). Three lives across the
round (Blaster Master's), the REST shown; one GAME OVER fails the round.

- **The opening** (`cutscene.ts`, music `bm-cutscene`): letterboxed, a night yard: Fred, Jason's
  pet frog, hops in, touches the glowing chest, swells up (`fred-big`) and leaps down the hole;
  Jason runs after him and jumps in. Lines under the picture, ending on the radiation carrying
  Bowser's spell. The lines come a page at a time, each waiting for OK (JUMP) while the picture
  rests on its beat (`CUT_BEATS`, `minigames/captions.ts`; 0.4.22); SHOOT skips the rest (SKIP
  with its key, top right; OK bottom right once the page waits); each page is read out. The glow
  keeps pulsing while a page waits, steady with reduce flashing.
- **The tank** (S1's real `SOPHIA` def) plays the two side-view parts, each in a World of its own
  with a fresh GameState (the campaign is never touched). Its kit is chosen so the lessons hold:
  **Hyper** (the Mushroom: the hover, the stronger cannon, one hit to spare before Normal) with 8
  homing missiles, never Crusher (the Flower's wall climb). Each part and each new life starts
  with it. The round leaves the tank's parts out while no `sophia` CharacterDef is registered
  (`tankHero`; tests use a stand-in hero).
- **1. The tank's cavern** (`area.ts`, `area.map`, `cavern.ts`, music `bm-area`): five screens: a
  crawler, a step and a wall of bricks under a low roof (the cannon breaks it), ledges with flyers,
  the open cavern (a hopper, a crawler, a flyer), then the gateway's shaft: a ladder (a vine in the
  `underworld` look, which only Jason climbs) up a shaft one tile wide to a roofed ledge where the
  `gateway` stands; the tank can't go through a gateway (Blaster Master's rule). Nearing the shaft
  in the tank shows, once, GATEWAYS ARE FOR JASON. / EXIT: JASON HOPS OUT (announced). Jason on
  foot walking into the doorway (12×20 at the bottom of the 32×32 decor) goes in: the cavern
  fades, then the dungeon. Mutants (side view, face left): **crawlers** creep along the floor and
  turn at ledges (2 hits), **hoppers** crouch, then leap at the player within 96 px (2 hits),
  **flyers** bob, then swoop at the player within 112 px and climb back (1 hit); any attack hurts
  them, nothing stomps them, World's contact rules hurt the player. A life lost starts again at the
  start, or at column 48 once passed. Row 1 is the cavern's roof all along (row 0 is under the
  HUD), so the tank can't jump and hover over a wall behind the HUD (tested).
- **The tank's bar** (the side-view parts, Blaster Master's POW and HOV): POW, the tank's power
  (Normal, Hyper, Crusher in three cells and by name; Jason on foot shares it), HOV, the hover
  gauge (S1's `meter`; empty without the hover or while Jason is out), the missile in hand and its
  count (S1's `tools`), and REST.
- **2. Jason's overhead dungeon** (`dungeon.ts`, `jason.ts`, `mutants.ts`, music `bm-dungeon`) on
  the top-down kit: eight rooms on a 4×3 map, walked from the gateway up (the gateway room with a
  G capsule, the hall's blobs and eyes, the turrets round a pool, the crossing whose statues point
  at a cracked wall, the cache behind it (two G, a P), the antechamber's P, the guardian's chamber,
  and the way out). Every door is open (no keys, as in the original) but the guardian's shutters.
  **Jason** walks eight ways at 1.25 px a frame (sliding round corners into doorways), faces the
  way last pressed and fires along it (SHOOT; tap, or hold for auto fire). **GUN**: 8 levels,
  shown as Blaster Master's upright meter: 1 a short pellet, 2 longer, 3 a double shot, 4 full
  range, 5-6 the wave beam, 7 two waves crossing, 8 through walls; every hit he takes drops it a
  level (never below 1), G capsules raise it. **POW**: 8 bars of health; P capsules give 3 back.
  **Grenades** (SPECIAL; endless, as in the original; one in the air at a time) skip along his
  facing and blast mutants and cracked walls, never him. Mutants: **blobs** creep at him in bursts
  (2 hits), **eyes** loop at their post and glare (stand still) for 24 frames before spitting an
  aimed orb (3 hits), **turrets** turn a quarter every 48 frames and fire along the barrel when it
  comes round to him, after a 20-frame aim (4 hits). Each may leave a capsule (seeded; dropped ones
  blink out after 7 s, dimmed instead with reduce flashing). A life lost in the dungeon starts again
  at the doorway he came in by, with full POW. The HUD: GUN and POW meters, UNDERWORLD over the map
  of rooms seen, REST and the grenade.
- **The guardian** (`guardian.ts`, music `bm-boss`): an original area guardian in the style of the
  original's overhead dungeon bosses, in S3's `boss-a` / `boss-b` frames (64×64, facing down);
  asleep until Jason steps past its door (the shutters close behind him), then on its own fight
  clock. **The shell** (24 hit points) drifts along the top; shut, shots clang off while its vents
  drip two orbs straight down (frames 40 and 90 of 246); it runs hot (`plutonium-hot`, 30 frames:
  the warning), opens with a ring of 8 orbs and can be hurt for 96 frames, spitting one big aimed
  orb halfway. **The core** (20 hit points): the shell cracks (90 frames of booms, every orb gone,
  nothing hurts), then the beating core bounces round the room on the diagonals at 0.75 px a frame
  (1 below half), stopping every 200 frames to run hot for 30 and fan 5 orbs at Jason. A hit
  flashes it white (`sophia-hit`; not with reduce flashing). Its fall (THE GUARDIAN FALLS!,
  announced) opens the shutters; the corridor east leads up to the way out.
- **3. Back to the tank**: Jason runs back to Sophia (JASON RUNS BACK / TO SOPHIA..., the tank
  with its hatch open; 2 s), then the boss's chamber.
- **4. The Plutonium Boss** (`plutonium.ts`, `boss.map`, music `bm-boss`; owner decision: side
  view, in the tank, as in Blaster Master; an original design): one locked screen, open overhead
  (the raised cannon reaches the core anywhere). It wakes a moment after the tank arrives
  (PLUTONIUM BOSS, announced), then on its own fight clock. **The mass** (`pluto-a-0/1`, 64×64 against the right wall, 30 hit
  points): shut for 120 frames (shots do nothing), lobbing two globs that come down where the
  tank stood (70 frames in the air); it runs hot for 30, opens its maw and rolls a
  ball of plutonium along the floor (the tank jumps it driving into it: a standing jump can't hang
  over it long enough), and can be hurt for 90 frames (no globs then: the ball is enough; a third
  lob over the ball took the cautious player under 85%). **The core**
  (`pluto-b-0/1`, 32×32, 24 hit points): the mass bursts (90 frames of booms, every shot gone,
  nothing hurts) and the core loops a slow figure of eight over the upper half of the chamber,
  always clear of the ceiling (aim up, hover, or send homing missiles); every 160 frames it holds still and runs hot for 30,
  then rains three drops. Below half it loops faster. A hit flashes it white. Until its frames
  exist it is drawn as boxes, its core shut grey or open green in the maw. A life lost here starts
  the chamber again, the boss whole, the tank with the round's kit.
- **Endings**: the Plutonium Boss falls: THE PLUTONIUM BOSS FALLS! / THE SPELL ON SOPHIA BREAKS!
  (the first line only in a round for fun), the jingle, then `pass`; out of lives: GAME OVER, then
  `fail`; the menu (`UnderworldMenuScene`, the shared MiniGameMenuScene with the dev assists: No
  damage keeps the tank's power, POW and the GUN level; Infinite lives) gives Give up = `quit`.
  `done` is called once.
- **Touch**: OK, SKIP and MENU in the opening; the tank's own buttons (S1: SHOOT, HOMING, EXIT) and
  MENU in its parts; SHOOT, GRENADE and MENU in the dungeon; nothing once the round is decided.

Difficulty (`human-sim.test.ts`): Jason's dungeon is played by `HumanJason` over `JasonBot` (it
walks an 8-px grid by breadth-first search, steps in line with a mutant (in range, a clear line of
fire, not too close; the guardian's shell only from below), faces it and taps SHOOT, leads the
bouncing core, steps out of the way of orbs, takes G capsules (P when hurt), grenades the cracked
wall and visits the cache); the tank by `TankBot` (`tankbot.ts`: it drives right firing the
cannon, stops to shoot a mutant ahead on its level, jumps what stops it, hops Jason out at the
shaft and climbs to the gateway; against the Plutonium Boss it faces the mass from the left and
fires while it is open, jumps the ball driving into it, drives to the nearest spot clear of where
globs and drops come down, and under the core raises the cannon and sends homing missiles). The
human sees mutants and shots `reaction` frames late but judges their paths from there, misjudges
by a few pixels, taps at a thumb's pace and pauses now and then;
`SOPHIA_SIM=30 pnpm vitest run sophia/human-sim --silent=false` prints the report.
Over 30 seeds, the whole round (the cavern to the Plutonium Boss): sharp 100% (~145 s), a careful
first-timer (15-frame reactions, a few px misjudged, pauses) 97% (~151 s), at 12 or 18 frames 97%,
a clumsy one (21 frames, 10 px, more pauses) 37%. The dungeon and guardian alone: sharp, careful
100%, at 18 frames 97%, clumsy 60%.

## Water: every hero their own way (0.4.25)

Wherever a level swims (`isSwimLevel`: a water theme, or a map's `swim: true` such as 2-2's
`zelda2-water` lake in the campaign and Fred's tunnel `8-4-fred`), each hero meets the water the
way their own game does. It is all in the hero's `MovementProfile.swim` (`SwimProfile` in
`characters/profile.ts`), run by the shared `Player.swim` (`entities/player.ts`); nothing in
world.ts knows a hero.

- **Mario and Luigi**: unchanged. The SMB1 stroke (MarioBase water stats: a tap of jump strokes
  up about 28 px, slow sinking, the sea-floor walk at 0.75 px/f), no running, the swim frames.
- **Sophia III**: unchanged. Her own water drive (`sophia/drive.ts`, SO-18): up and down steer,
  jump rises, no hover.
- **Mega Man and Samus** walk the seabed (`swim.mode: 'seabed'`), as in Bubble Man's stage and
  Metroid's liquids: no stroke. They walk the floor at full speed with every shot and tool, and
  jump off it about 9 tiles high (low gravity), floating down slowly (sink caps 1.5 and 1.33 px/f).
  Mega Man's jump still cuts short on release and he still slides; Samus still rolls. A jump in
  mid-water does nothing, except over water with no floor below at all (a pit under the sea, World
  9-2's 44 bottomless tiles): there, once sinking, they may push off again, so no water level is
  left without a way across. Their normal walk and jump sprites read well under water, so they keep
  them. The touch jump button still says JUMP.
- **Bill** swims, Contra style turned into a real swim for a full-water level: a stroke on jump
  (his own tuning), kicking swim frames (`swim-0/1`), and he fires while swimming, forward,
  diagonally up and straight up but never down (`swim-shoot`, `swim-aim-diag-up`,
  `swim-aim-up`). On the floor he walks and shoots as on land.
- **Link** swims with a steady stroke (`swim-0/1`: the guard pose with a scissor kick). The sword
  and the thrusts still work in the water, and his shield stays up in front of him while he swims,
  so it still blocks.
- **Simon** swims with a heavy, short stroke and a quick sink (the original's 2.08 px/f), and can
  steer while swimming (`swim.airControl: 'full'`; on land his jump arc is still committed). His
  whip and sub-weapons work in the water. Frames `swim-0/1` (a flutter kick).
- **Ryu** swims with a strong, quick stroke and a slow sink (`swim-0/1`, the scarf streaming back);
  his sword and ninpo work in the water. He no longer clings to walls under water (he strokes
  along them); above the water line his wall cling is as before.

The swimmers' touch jump button says SWIM. All the swim art is original, drawn from each sheet's
own parts and palette roles (no new colours), with no flashing.

Tests: `tests/sim/hero-water.test.ts` (the seabed jump height, no stroke in mid-water, the push-off
over bottomless water, the full-speed walk and shots, the swimmers' strokes and swim frames,
steering, Bill's aims, Link's shield, Ryu not clinging, the touch labels) and
`tests/sim/water-routes.test.ts`: a route bot (`tests/sim/water-bot.ts`: it plans a way through the
water on the tile grid and follows it with real inputs, strokes for the swimmers, floor jumps and
push-offs for the seabed walkers) takes every hero but Sophia III, small and big, through every
level that swims (2-2, 5-2 and 6-2's water, 7-2, 8-4's water and Fred's tunnel, the Lost Levels'
3-2, 4-1, 6-1, 6-2, 8-1, 8-4, 9-1, 9-2, 9-4 and 11-2 water) to its pipe or exit. Sophia III has
her own completability search (`sophia-sweep.test.ts`, `sophia-routes.test.ts`).

## Hero training (optional practice rooms)

Mario's tutorial is stage 1-0. Every other hero has an optional practice room (owner decision:
"tutorials other than Mario's can be optional"). Code: `src/game/tutorial/`.

- **The question.** The first time a hero other than Mario is picked on a file (entering a level
  from the map, the pick after a death, player two's pick), "<HERO> TRAINING?" asks YES / NO
  (`TrainingQuestionScene`, announced). YES plays the room, then the pick goes on exactly as it
  would have (the level starts, or the respawn); NO goes on at once. Either answer is recorded and
  saved at once, so each hero is asked once per file. Never asked outside campaign play, in an
  editor play-test, for Mario, or for a hero the file has not freed (one picked through dev mode's
  "All heroes" keeps its real question for when it is freed). The hook is in
  `CharacterSelectScene` (`needsTraining`, `askTraining`), so every campaign pick follows it. After
  the room the map's music comes back (`HeroPick.music`) for player two's pick.
- **The save.** `SaveFile.tutorials?: string[]`: hero ids whose question was answered, each once,
  known ids only. It is optional (no format bump); validation (and `openFile`) adds the file's
  current `character` / `character2` when freed, so players already using a hero are never
  interrupted.
  `Game.tutorials` carries it, `Game.answerTraining(id)` records and saves.
- **Pause → Training.** In a campaign level the pause menu offers Training (one entry per hero
  in co-op, Mario excluded). The room plays over the paused level; afterwards the pause menu
  closes and the level goes on as it was left (its clock stood still, its music restarts).
- **The rooms.** Three one-screen maps, locked and loaded with `?raw` (kept out of the level
  library and the dev select), each built afresh when its chapter starts (`practiceRoom(id)`):
  `practice.map` (a floor, a step up to a high ledge, a brick row with a ? block, a target dummy, a
  gap where falling in puts the hero back at the start, and a tall wall to cling to);
  `practice-gear.map` (a ledge for the Rush Coil to aim at, and a wall from the ceiling down with a
  one-tile tunnel under it for the slide and the morph ball: `RoomGeometry.tunnel`); and
  `practice-water.map` (`swim: true` from the wave row down: Link and Bill swim, Mega Man walks the
  seabed). The dummy (`dummy x y` in each map; `TargetDummy` never moves or hurts, pops after three
  hits and comes back; `Enemy.practiceTarget`, so Sophia III's homing missile seeks it) stands in
  each. The room runs in a World of its own with a fresh GameState for the hero and its full kit
  (`devKit`: Mega Man's helmet, Samus's missiles, Simon's sub-weapons...); ammo and magic are
  topped up at each lesson; what the hero carries (power, health, kit) goes on into the next
  chapter's room. The run's GameState is snapshotted and restored around it (as the mini games
  do), so lives, score, power and kit are never touched. Hit points stay topped up, so nothing in
  the room can end it. The HUD shows TRAINING where WORLD and TIME go, and no score or coins
  (`drawHud`'s `place` option).
- **Chapters** (0.4.32, owner note 24: the whole kit, not 3-5 basics). `CHAPTERS` in `lessons.ts`:
  per hero, short chapters (1-6 lessons) each in one room. A chapter opens with a card
  (`<HERO> TRAINING`, `CHAPTER 2/4`, its title, ANY BUTTON TO START), announced with its lesson
  count; it holds the room still and waits for a button (after `CARD_GUARD_FRAMES`). The heading
  over a lesson is `<HERO> <CHAPTER> 2/5`. After the last chapter READY! also waits for a button.
  No text moves on by itself: a prompt goes only when the player does the thing or skips (GOOD!
  is a 50-frame tick between lessons, not a prompt). MENU in the room: Continue / Skip chapter (on
  to the next card, or READY! after the last; the room then ends as skipped) / Skip training.
- **Lessons** (`lessons.ts`). `TrainingLesson { id, prompt, done(tracker), setup?(room),
unlocked?(run) }`; `lessonsFor(id)` is every chapter's lessons in order. `MoveStats` watches the
  player and world each frame (jumps and their height, the highest point, ground speed and glide,
  attacks, shots by kind, direction and selected tool, shots in flight at once, charge shots,
  slides, the tunnel, crouching, tool changes, ammo or magic spent per tool, wall cling and wall
  jumps, bomb jumps, scratch flags like the morph ball and a sprung Rush Coil, bombs, shield
  blocks, gap crossings, and how the dummy was hit: the damage kind, the shot's kind, `wave` for
  the Wave Beam, `far` from FAR_HIT_PX away). The tracker is reset when a lesson or a card comes
  up, so each is done while its prompt shows. Prompts name abilities as the guide and touch
  buttons do (never button letters); a button's ability is written `[SHOOT:attack]` and shown
  through `abilityHint` ("SHOOT (X)" with keys or a pad, "SHOOT" on touch), falling back to the
  bare names when that would not fit 3 lines of 25 columns (`promptText`). They come one at a
  time in a centred box under the HUD (`drawRoomBox`), announced; each ticks off with a sound and
  GOOD!. Walking, jumping and the basic attack never tick a move lesson (tested per hero).
- **Unlocks (PREVIEW).** `runTraining` passes the training player's kit in the run (`runKit`: the
  carried kit and power when that player plays this hero, else a fresh hero's: nothing yet). A
  lesson whose `unlocked(run)` is false still runs, with the kit lent in the room, and its prompt
  starts "(PREVIEW)" (prompts are tested to fit with the mark). The Arena's training rooms pass
  no run, so nothing is marked there. The order never changes, so the room from the pause menu
  plays the same lessons in the same order. Owner decision pending: hide locked kit instead.

| Hero     | Chapters and lessons (PREVIEW until unlocked: in brackets)                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Luigi    | Moves: high jump, slippery stop. Fire: [fireball] (gives fire)                                                                                                                 |
| Link     | Sword: sword, down-thrust, up-thrust, shield. Tools (gear): boomerang, bomb. Magic: jump, shield and fire spells. Water: swim                                                  |
| Mega Man | Buster: buster, [charge]. Moves (gear): slide through the tunnel, [Rush Coil]. Weapons: [switching], [saw, leaf, flame, knuckle, bolt]. Water: seabed jump                     |
| Samus    | Beams (gear): beam, aim up, [Long Beam from afar], [Ice Beam], [Wave Beam]. Missiles: missile, switch to missiles. Morph ball (gear): roll through the tunnel, bomb, bomb jump |
| Simon    | Whip: whip, crouch whip, committed jump. Sub-weapons: [dagger, axe, holy water, cross, stopwatch], [hearts as ammo]. Upgrades: [chain whip], [morning star], [double shot]     |
| Ryu      | Sword: slash, wall cling, wall jump. Ninpo: [throwing star, windmill, fire wheel, jump and slash]                                                                              |
| Bill     | Aim: shoot, 8-way aim, prone, jump and shoot. Guns: [machine gun, spread, laser, flame thrower]. Water: swim and shoot                                                         |
| Sophia   | Drive: drive and jump the gap, cannon, cannon up. Power-ups: [hover], [missiles], [homing], [wall climb]. Jason: Jason on foot (EXIT)                                          |

Not in the training because the campaign code has no such kit: Bill's R and B capsules (only in
his mini game, Jungle Assault). Link's bomb lesson blasts the dummy rather than a cracked wall (a
cracked wall crumbles to any attack, so it would not show the bomb).

To add a hero's training: chapters in `CHAPTERS` (a lesson for every kit piece, tested by
`src/game/tutorial/lessons.test.ts`) and a scripted run in `tests/sim/training-room.test.ts`.

## Sophia III in the campaign levels

Sophia III's tank is wider than a tile (19 × 15.5), cannot stomp, and at Normal jumps about 4.5
tiles high and 6 across, so the levels built for Mario need her own ways through:

- **Nose first down a one-tile hole** (down while driving over it, every power state): her turned
  15.5 × 19 box drops through, and she rights herself as soon as there is room: on the floor, on
  a lift, or in the air where the shaft opens to one side (4-4's maze, castle drops). A fall into
  an area down a one-tile gap (Larry's cabin) starts nose first too (`CharacterBehaviour.narrowFall`).
- **Jason on foot** (EXIT, our design): 8 × 16, a hop of about three tiles (49 px with jump
  held), fits one-tile gaps and climbs ladders (an Underworld vine). The parked tank keeps the
  camera: the screen never scrolls past it (`camera.x <= tank.x - 32 px`, `Entity.anchorsCamera`),
  he is held at the right edge like a co-op partner, and EXIT is refused on an auto-scrolling
  screen and anywhere but solid ground (a lift, a spring). A pipe takes him on with the tank into
  the next area; the flagpole and the axe work on foot (the anchor lets go once the level is won).
- **Hyper's hover** and **Crusher's wall and ceiling climbing**.

The completability sweep (`tests/sim/sophia-reach.ts`) searches each level with the real game
(enemies removed, invulnerable, endless time) for a route at Normal, then Hyper, then Crusher:
`SOPHIA_SWEEP=1 POWERS=small,big,fire pnpm vitest run tests/sim/sophia-sweep.test.ts`
(about half an hour split over four runs with `GROUP=<file>`). `tests/sim/sophia-routes.test.ts`
replays some of the routes it found on every test run. A level it cannot finish is not proof
that no route exists (it tries fixed moves from standing spots, and a block it reveals or a lift
it rides is gone again at its next try), so the table says which places were checked by hand.

The search plays every level with Sophia's variant laid (below). Besides its fixed moves it
drives off a ledge with the direction held until she lands, and on a springboard presses jump
afresh for the boosted launch (`boost<k>`). `reach()` and `replay()` also take a start spot,
past a stretch that only a scripted sim gets through.

### Her level variants (`[variant sophia]`)

A level can change for a hero (`level/variants.ts`, owner decision for the Chapter 1 finishing
pass). A map's `[variant <hero>]` section lists runs of tiles, `x y tiles [*N]` (map characters
from (x, y) rightward; `.` opens a tile; `*N` repeats the run on N rows going down). It also
lists spawns added (`+ type x y [key=val]`, or a marker such as a spring's `s` in a run) or
taken out (`- type x y`). `Game.levelScene` lays the variant after the campaign variant when
any player is that hero, so a co-op partner plays it too.

- `[variant sophia]` would be ours and apply in campaign play only, its tiles only filling open
  air away from the other heroes' routes. No map has one: every Sophia variant is the
  original's.
- `[variant sophia classic]` holds the original's own pieces for her and applies in classic
  play too. Crossover builds each level per hero (`Level.as` determineHelperVisibility). Sophia
  sees the pieces marked `charHorz` or `charVert` (heroes who jump short or low) and
  `WideCharacter` (wide heroes), and loses the ones those hide. In a level that needed one, the
  section holds all of the original's pieces for her in that area: its walls, lowered blocks,
  extra ground, springs and lifts. It leaves out only the flagpole's step-fall lift, which
  nearly every level has. `tools/levelgen` still converts the maps for the classic hero, so the
  pieces were taken from the same data with her visibility.

Tests: `src/game/level/variants.test.ts` (parse, serialize, laying) and
`tests/sim/sophia-variants.test.ts`. The second file covers the game laying the variant (both
co-op seats, campaign and classic). Every variant map is checked to be the level itself for
Mario, and our own tiles (if any) to land in open air. A replayed route (or a scripted sim)
takes Normal Sophia past each variant's spot, and up 8-4's hidden block onto its hanging pipe.

**Results (2026-10-08, the Chapter 1 finishing pass).** Every level of the table below, at
Normal, with her variants:

- SMB 8-4 (with no variant) and 24 of the 27 Lost Levels rows are finished, all checked by the sweep or by sims
  (the "How" column).
- **ll-7-3** and **ll-12-3** are not followed past their first green super spring. A braked
  flight lands on the next tree. Not verified: Chapter 2.
- **ll-8-3** stops at 140. The search does not find the jump onto the original's red spring in
  the 12-tile gap at 147. Not verified: Chapter 2.

A bug fix came out of it. A hop's released jump damped a spring's launch to almost nothing; as
in `Sophia.as`, the release damping now ends once a rise is over.

8-4 has no variant (owner decision): its hanging pipe had a way up all along, the hidden coin
block at 161 (row 9), a step to its top as in the original. The original's one Sophia piece in
8-4 is ground in 8-4-end's lava at 21, which she does not need; it is not laid.

Her red spring launch is the spring's own, as every hero's: 500, or 1000 boosted (Flash px/s).
`Sophia.as` sets 400 / 930, but `SpringRed.springLaunch` reads the spring's values (the lines
reading the character's are commented out); the character's values only serve the bouncy-pits
cheat (`Character.bouncePit`). A test pins it (`tests/sim/sophia.test.ts`).

**Follow-up (a later 0.4.2x, owner decision):** the original's Sophia pieces in the levels she
finishes without them are not laid. These are SMB 2-3, 3-3, 3-4, 4-2, 4-3, 6-2, 6-3, 7-1, 8-1,
8-2 and 8-4-end, and the Lost Levels outside the table. The flagpole's step-fall lift is not
laid either; nearly every level has one.

| Level   | Variant                                                                    | At Normal                | How                                                                                                                   |
| ------- | -------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 8-4     | none: the hidden coin block at 161 is a step to the hanging pipe           | yes                      | sim up the hidden block onto the pipe at 163, the search for the rest (0.4.13's Crusher route still replays)          |
| ll-1-2  | original: the falling lifts over the pit set closer, steps at 21-26        | yes                      | sweep                                                                                                                 |
| ll-2-2  | original: the crossing's hidden block at 186 a row lower, ground in gaps   | yes                      | sim over the hidden blocks at 185-186, then the search                                                                |
| ll-2-4  | original: the one-tile shafts at 17 and 24 two wide                        | yes                      | sweep                                                                                                                 |
| ll-3-3  | original: the first platform (13-15) two rows lower                        | yes                      | sweep                                                                                                                 |
| ll-3-4  | original: blocks at 23 and 87 a row lower, lava filled at 19 and 83        | yes                      | sweep                                                                                                                 |
| ll-4-1  | original: ground in the gap after the springboard, blocks a row lower      | yes                      | search to the water area's pipe at 163, the search from there                                                         |
| ll-4-2  | original: the pipe at 117 a tile lower                                     | yes                      | sweep                                                                                                                 |
| ll-4-3  | original: longer ground and a wider platform at 16-23, a platform at 69-72 | yes                      | search to 27, sim on the spring and over the lifts to 63, the search from there                                       |
| ll-4-4  | none                                                                       | yes                      | search to 94, sim off the block under the pillar at 95, the search from there                                         |
| ll-5-1  | original: the pillars at 136-159 closer, the hidden block at 317 lower     | yes                      | sweep to 319, sim up the hidden blocks at 317-318, the search from the wall's top                                     |
| ll-6-1  | original: a step and pillar at 175-178, a lift moved                       | yes                      | sim up the hidden block onto the pipe at 79, the search from there                                                    |
| ll-6-3  | original: a bridge at 193 (row 6)                                          | yes                      | sweep                                                                                                                 |
| ll-7-1  | original: the ground longer at 37 and 146, a hidden block at 114           | yes                      | sweep                                                                                                                 |
| ll-7-2  | original: hidden blocks under the raised pipes (53, 117)                   | yes                      | sim up the hidden block into the pipe at 115 (past the loop), the search to 238, jumps over the lifts to the flagpole |
| ll-7-3  | original: red springs at 181 and 211, blocks at 287-300                    | not verified (Chapter 2) | the first green spring by sim (a braked flight lands on 45-48); not followed further                                  |
| ll-8-1  | original: red springs in the long gaps, the Paratroopas moved              | yes                      | search to 176, jumps onto the pipe at 183, the search from there                                                      |
| ll-8-2  | original: the steps at 112-116 reworked                                    | yes                      | search to 173; sim: bump the vine block at 127, up onto it and up the vine; the search in the warp area               |
| ll-8-3  | original: springs, a platform and lifts in the gaps, Paratroopas moved     | not verified (Chapter 2) | the search stops at 140: it does not find the jump onto the red spring at 147                                         |
| ll-8-4  | original: lava filled and a lift in the first area, lifts in 8-4-end2      | yes                      | search to the pipe at 47; sims over 8-4-end's wall and end3's gap; the search for the rest                            |
| ll-11-3 | original: platforms at 12-21, 73-87 and 165-181                            | yes                      | search to 22, jumps over the lifts to 63, the search to 102, the green spring and lifts by jumps to the flagpole      |
| ll-11-4 | original: the one-tile shafts at 64 and 68 two wide                        | yes                      | sweep                                                                                                                 |
| ll-12-1 | original: ground in the gap at 145 and at 193, 197                         | yes                      | sweep                                                                                                                 |
| ll-12-2 | original: a bridge in the gap at 24-26                                     | yes                      | sweep                                                                                                                 |
| ll-12-3 | original: red springs and platforms by the green super springs             | not verified (Chapter 2) | as ll-7-3                                                                                                             |
| ll-13-1 | none                                                                       | yes                      | sweep                                                                                                                 |
| ll-13-3 | none                                                                       | yes                      | sweep (the boosted spring)                                                                                            |
| ll-13-4 | original: lifts at 43 and 55; the exit area's staircase five tiles right   | yes                      | sweep                                                                                                                 |

"Sweep" is `SOPHIA_SWEEP=1 LVLS=<level>` from the level's start. "Sim" and "jumps" are scripted
runs, made while checking. The ones in `tests/sim/sophia-variants.test.ts` cover each variant's
spot.
