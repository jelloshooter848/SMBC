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

Link waits beside the temple doorway of the 2-1 sky ruins (`2-1-sky2`, column 30 on the cloud floor; TALK shows against the sky there), reached by the hidden vine block (`7` in maps) over the middle cloud platform past the end of the 2-1 coin heaven; the drop at the ruins' right end lands in 2-1 at column 162 like the coin heaven's (`tests/sim/heroes-link-sky.test.ts`, `tests/sim/sky-ruins.test.ts`).

Mega Man waits on the command deck of the space station above 3-1 (`3-1-station`, column 38 on the floor, under the big window). Past the end of the 3-1 coin heaven (`3-1-sky`) a coin trail hops over two small cloud platforms to a hidden teleporter block (`8` in maps, at 91,7 over the second platform); bumped, it reveals a teleport pad that rises out of the platform two tiles to its right (93,10). Standing on the pad beams the hero up (hidden, a `station:beam-*` streak rises, sfx `beam`) and down onto the station's arrival pad; the clock runs on. The return pad just past Mega Man (column 44), and the arrival pad once stepped off, beam the hero back down into 3-1 at column 162, dropping in like the coin heaven's own drop. The pads are `teleport` zones (docs/WORLD_MAP.md "Teleport pads"). Every hero reaches the pad and crosses the station (`tests/sim/space-station.test.ts`); his lines before the round make the brainwashing a rogue program in his systems that built a dark copy of him (`DIALOGUE.megaman`).

Samus waits in her cavern under the 4-2 vine area (`4-2-cavern`, an area of 4-2: `parent: 4-2`, `time: inherit`), on the dais of the Chozo statue's chamber (column 41, feet in row 11, the statue `zebes:chozo-0` at 37). In campaign play the vine area's warp zone shows one unlabelled pipe (column 54) that drops the player into the cavern's entry shaft (docs/WORLD_MAP.md "Campaign warp zones"); outside the campaign it keeps its three warps. The cavern is short and Metroid-flavoured: blue rock, an entry chamber, a bubble door (`zebes:bubble-door` in a three-tile doorway), a low tunnel with a ledge, the statue's chamber (a ? block over the orb in the statue's hand), a second bubble door and a side pipe that brings the player up out of 4-2's pipe at column 72, the first pipe past the vine block (64,5), so nothing is skipped (the checkpoint at 98 still lies ahead). The clock runs on throughout. Every hero reaches Samus and crosses to the pipe (`tests/sim/samus-cavern.test.ts`); her lines before the round make the brainwashing a parasite feeding on her will the way a Metroid feeds, which set off a countdown (`DIALOGUE.samus`). Theme and music: `cavern` (the `zebes` sheet's statue faces right, toward Samus). World 4's tree left of 4-2 stands one tile out, clear of her map hint (she is drawn on the left: 4-2's roads leave right, up and down).

Simon waits in his crypt under 5-4 (`5-4-crypt`, an area of 5-4: `parent: 5-4`, `time: inherit`), kneeling on the floor under the stained glass (column 11, feet in row 11). The way in is campaign only: 5-4's lift shaft (columns 84-91) has a sleeping `descent` zone the campaign variant wakes (docs/WORLD_MAP.md "Descent shafts"), so riding the down lift (column 89) on past the bottom of the shaft carries the player down, out of sight, and drops them into **the dungeon** (`5-4-dungeon`, one locked screen) from above at column 13. Falling into the shaft without the lift still kills. The hint is a faint bone-grey skull on the down lift's middle plank (campaign only). In the campaign the fire bar at (92, 10) is three balls short (3), so its tip clears the lift plus a tile of overhang each side: a rider whose body overlaps the lift at all, even hanging off either end, rides down unhurt; co-op riders all go down together. In the dungeon a single hard block (11,10) stands between the landing and a Koopa pacing up to a **cracked wall** (column 5, rows 8-10, tile `&`, `T.CRACKED`). Behind the wall, three steps lead down to a hole (columns 0-1) whose `pit` zone drops the player into the crypt's top-left landing; a castle-stone stair leads down to the floor, past Simon, to a dark doorway in the right wall (rows 10-11; a side `pipe` zone at column 16, just off the locked screen) that drops the player back into 5-4 at column 99, past the lift section (in co-op player 2 drops in 12 px to player 1's right, clear of the fire bar at (103, 11): see docs/WORLD_MAP.md "Co-op fall arrivals"). The clock runs on throughout; nothing is recorded on the map. Candles (`candle x y`, 8×16) in both rooms are snuffed for a coin by any attack, a kicked shell or a hero jumping into them. His lines make the brainwashing Dracula's curse, woken in his blood by Larry's wand (Simon's Quest): he is Dracula's thrall (`DIALOGUE.simon`). Tests: `tests/sim/simon-crypt.test.ts` (every hero rides down, breaks the wall, reaches Simon and gets back).

- **The cracked wall** (`T.CRACKED`, a solid brick-kind block): it crumbles, with every cracked tile joined to it (one hit opens the whole doorway), to any hero attack: a melee hit (`Player.activeMelee`: sword, whip, Ryu's blade), any shot or thrown weapon a hero owns (`Projectile`), a kicked shell (which plows on through the opening instead of bouncing back), a blast (`World.explode`), or a head bump from a hero who breaks bricks (big Mario). A small hero's bump only jolts it (`World.crackWalls`, `World.strikeBlock`, `World.shatterWall`; the `whip-wall` sound once it exists, else `break`). It draws `crypt:wall-cracked` once that sheet exists, else the theme's castle brick with a dark crack.
- **The Koopa** (`koopa-green 8 10 respawn=true`): small Mario and Luigi have no attack, so they stomp it and kick the shell into the wall. Kicked the wrong way, the shell bounces off the single block and comes back to the wall (a player standing between them is hit, as ever). A spawn with `respawn` is kept by a `Respawner` (`objects/crypt.ts`): a lost Koopa (killed, or fallen down the hole) walks back in at its spot 90 frames later, once no player stands there, for as long as a cracked wall stands.
- **Art and sound** (S3's): theme and music `crypt` in both rooms; the `crypt` sheet's `wall-cracked`, `candle-0/1`, `rubble-0/1` (the wall's pieces, through `World.breakPieces`), decor `crypt:candelabra-0` (dungeon), `crypt:stained-glass` and `crypt:coffin` (crypt); sfx `whip-wall` and `candle`. Without the sheet the candles and crack fall back to rects and the rubble to the brick piece.

Ryu waits in his hideout behind 6-2's first bonus room (`6-2-dojo`, an area of 6-2: `parent: 6-2`, `time: inherit`), kneeling on the dojo's floor (column 5, feet in row 12) under the moon window. The way in is campaign only: the bonus room under the pipe at 19 (`6-2-bonus`) has a **ninja trick wall** in its left wall (column 0, rows 10-12, tile `N`), marked by a shuriken stuck in it and a faint seam, with a coin arrow pointing at it. Pushing into it for about a second (every hero: just walking into it; Ryu clinging to it and Samus rolling into it in her morph ball count too) spins the panel and flips the player through into the dojo, stepping out beside the dojo's own panel in its right wall (column 15, rows 10-12); pushing into that one flips him back into the bonus room beside its panel (column 1), so the room's pipe leads on into 6-2 as ever. A short push does nothing, and outside the campaign the panel is a plain wall (docs/WORLD_MAP.md "Trick walls"). In co-op both players go through together and step out inside the room, player 2 further in. The clock runs on throughout; nothing is recorded on the map. His lines make the brainwashing the curse of the Masked Ninja, a cursed masked rival whose mask rules Ryu's blade; the round is their duel under the moon (`DIALOGUE.ryu`). Art and sound: theme `castle` and music `underground` until R3's `dojo` theme and music land (its `wall`/`wall-top` rows are the shoji band); decor `ninja:moon-window`, `ninja:lantern-0` (drawn once the `ninja` sheet exists); the panel's `ninja:trick-wall-0..3` and `ninja:shuriken-mark` with rect fallbacks; sfx `panel-spin` (`card-flip` until then). Tests: `tests/sim/ryu-dojo.test.ts` (every hero pushes through, small and big; Ryu's cling, Samus's ball; a short push does nothing; campaign only; co-op; every hero reaches Ryu and gets back out of 6-2).

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
3. **Freed:** the hero stands beside the node in full colour, facing it, with a small idle hop.
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

Story: Larry Koopa stole a magic wand, and its spell is what brainwashed the heroes. In the
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
  (7,12) and its post at (7,13). The hero rises out of the pipe in the floor at columns 2-3 (from
  the deck's stern pipe); Larry starts on the floor at the right (`larry 12 12 next=4-3`: the
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
- **No clock aboard**: `LevelScene` sets the world's time to null (the HUD leaves it blank).
- **A death** never costs a life: `TRY AGAIN?` YES / NO (announced). **YES** (`retryAirship`)
  restarts the deck as it was boarded, or Larry's room once it has been reached (rising out of its
  pipe again), with the run as it was when that area was first entered. **NO** (`leaveAirship`)
  restores the pre-boarding snapshot and goes back to 4-2 at its last checkpoint (4-2's own respawn
  rules: its start without one, a fresh clock, the WORLD card; no hero select).
- **MENU** aboard is `MiniGameMenuScene` titled LARRY'S AIRSHIP: Continue / Give up (= NO) and, in
  dev mode, Assists.
- **Held items** (mushroom/flower/Starman used on the map) given at an airship area's start are
  folded into the run's snapshots (`AirshipRun.itemsGiven`), so a retry or NO keeps them once.
- **Beating Larry**: the crystal ball exactly as before. The run ends in the card's OK
  (`airshipWon`), then `Game.takeCrystalBall(levelId)` is the campaign's hand-off to the map.
- **Dev → Mini games → "Larry's airship"** (`AIRSHIP_CHALLENGE`): deck + room as one round over the
  dev list with the current hero; the ball is PASS, a death FAIL (no retry prompt), Give up QUIT,
  then the dev result card; nothing is saved.
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
  Training rooms pass when every lesson is done (Skip training quits); bonus games pass with a
  prize; the airship passes with the crystal ball. No best results are kept.
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
with only his sword: a stab hits the whole tile in front of him plus 4 px to each side (and 6 px
back into his own tile), is out for 12 of its 14 frames, and wins ties: a monster the blade
touches is knocked back and does no touch damage that frame, so monsters coming in at an angle
meet the blade (owner feedback: "attacking with the sword is flawed"). Items, Zelda style: an
item box labelled ITEM beside the SWORD box on the HUD; SPECIAL uses the item in it, SELECT
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
wasting the bombs can cost the optional shield, by design), behind it the secret shrine (a chest
with the
magic **shield**, owner decision "make it worth the secret room": from then on it stops rocks and
the keeper's spells coming at Link's front while he isn't stabbing (an angled spell by its main
axis), and its guard halves monsters' touch damage, never below half a heart; the banner says
"FACE ROCKS AND SPELLS TO BLOCK" / "MONSTERS HURT YOU LESS"),
rock-spitters with a floor switch behind water (it opens the way on and shows a heart refill), the
keeper (drifts across the top, glows, then fans three spells at Link; eight hits, a bomb counts
two; its name shows between it and Link; its spells vanish when it falls) and the shining exit.
The cellar and the shrine are side rooms; only the shrine is hidden. Exit reached: `pass`; no
hearts left: `fail` after the death spin; menu Give up: `quit`. Hearts, keys and items live in the
keep, never in `game.state`. Music `dungeon` and `keeper`; sounds `secret` (also a wall breaking
open), `sword-stab`, `door-open`, `key-get`, `item-get`, `boomerang`, `bomb-fuse`, `bomb-blast`,
`select`. Dev mode's assists apply: **No damage** (`invulnerable`) keeps Link's hearts against
monsters, rocks, spells and his own bombs (he is still knocked back), read each time he is hurt,
so switching it mid-round counts at once; **slow motion** slows the whole loop, the keep
included; the others have nothing to act on here.
Dev: `?minigame=link` (the scene is `window.__miniGame`; `world.warpTo(roomId, x, y)` jumps,
`world.grant('bomb')` gives an item, a pickup kind or `shield`).

Difficulty (a "cautious human" sim, `human-sim.test.ts`: the bot's plan seen through a 15-frame
reaction delay, monster positions misjudged by up to 4 px, pauses and early swings; `KEEP_SIM=30
pnpm vitest run human-sim --silent=false` prints the report, with and without the shrine; it
knows the whole plan, so it measures combat difficulty, not puzzles or finding the way): before v2 it escaped
40% of 30 seeds (70% at a 12-frame reaction, 27% at 18), mostly falling to the keeper. With v2
and the magic shield 97-100% (about 1.8 of four hearts lost to the keeper); skipping the shrine
93-100% (about 2.2 lost). The keeper got two more hit points to keep it a fight. The sim dodges
spells rather than facing them, so a player who learns to block does better than it does.

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
- `hero.ts`, `entity.ts`, `enemies.ts`: the hero (corner rounding into gaps, `swordReach`, a
  `shield` flag, the throw and hold-up poses, `-ns` frames without the shield), enemies with
  knockback, stuns (`stunFor` lets a boss shorten them), invulnerability and drops (bat, knight,
  spitter), shots, pickups (`heart`, `key`, `heart-container`, `refill`, `shield`, ammo, items),
  chests (`c`, contents in the room's `chests`), push blocks, switches, torches. A game adds its
  own spawn kinds (the keeper) through `spawners`.
- `items.ts`: `TdItem` (label, icon, optional ammo, `ready`, `use`), the `Inventory` (owned items,
  the slot, SELECT cycling, ammo caps), and the kit's boomerang and bombs with the `Explosion`
  entity (`world.blast` hurts monsters and the hero in a radius and opens cracked walls).
  Cracked walls (`C`) are a tile kind: inside a room a wall cell, on the border a doorway (door
  kind `cracked`, opened on both sides by a blast); `wall-cracked` / `wall-hole` frames.
  `world.grant(what)` gives anything; `noDamage` (a world option) keeps the hero's hearts.
- `render.ts`, `hud.ts`, `frames.ts`: tiles drawn for the north wall are flipped for the south
  and rotated for the sides (`withSideFrames` derives `-side` and the doorway halves `-l`/`-r`
  when the sheet is registered); the Zelda-style HUD (map, keys and ammo, item boxes, life).
- `bot.ts`: a breadth-first-search player driven by a per-room plan (a list of steps, or a
  function of the world for rooms passed twice): fights (stunning with a boomerang it owns),
  pushes, opens chests, bombs walls. `CautiousBot` wraps it as a cautious first-time player for
  difficulty tuning.

## Mega Man's mini game: Station Escape (`src/game/minigames/megaman/`)

An NES Mega Man style stage on the space station above 3-1, played **as Mega Man**, ending in a
fight with **Dark Mega Man**, the brainwashing's copy of him. It runs in a real `World` of its own
(stage.map, loaded with `?raw`, not in the level library) with a fresh GameState: Mega Man with the
helmet kit (`{ helmet: 1 }`: buster, charge shot, slide, and Rush Coil, which comes with the
helmet), full 28 hit points on the usual bar, one life, no clock, and a camera that scrolls both
ways. READY shows first (Mega Man cannot move, the press that started the round never jumps).

- **The stage** (five screens, theme `station`: steel floor, bulkhead plating behind a corridor
  band, space above, the station sheet's windows, consoles and girders as `deco` entities drawn in
  front of the plating): floor, steps, three three-tile pits, and the robots (the station sheet's
  frames; they face left and are flipped to face right; a hit flashes them in `station-flash`), each a station `Robot` (an `Enemy` with hit points that blows up
  in a small explosion and drops from Mega Man's own drop table, an E-tank turned into a big health
  pellet since the round has no pause menu to use one from):
  **Hopper** (3 HP: crouches, then hops toward Mega Man, short and tall in turn),
  **Turret** (3 HP: on the floor, or hung upside down under a ceiling; shut, its armour turns
  shots away; it opens and fires a burst of three pellets aimed at Mega Man, a floor turret never
  aims down, a ceiling turret never up) and
  **Drone** (2 HP: sways in a sine while drifting over, dives straight down on Mega Man when he
  stands below it, never at him mid-jump, and climbs back). Pellets take 2 hit points, a robot's
  touch Mega Man's usual 4.
- **The weapon capsule** sits on the pillar halfway (on the path): touching it, or passing anywhere
  above it (a jump over the pillar cannot skip it; Rush Coil can), unlocks the **Saw Disc** (`weapons: 1`, full energy; no new weapon code). The station holds still for a second, the
  `capsule` sound plays and a banner (24 columns, clear of the bars) and the announcer say WEAPON
  switches to it, USE WEAPON fires it and a held direction aims it (`abilityHint`; a line falls back
  to the bare ability names when its keys don't fit).
- **The boss gate**: column 80's doorway is a two-tile shutter (solid in the map, a `Shutter` drawn
  over it). A `scrollStop` keeps the room out of sight. Mega Man touching it on the floor opens it;
  the robots and shots vanish (a screen change), he walks through on his own while the camera
  scrolls 4 px a frame onto the 16-wide room and locks; the shutter shuts behind him (solid again).
  Dark Mega Man beams down, then his bar fills one segment every 3 frames with a `boss-fill` tick,
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
  Mega Man at 0 hit points or in a pit: `fail` once the death has played. Menu (`StationMenuScene`)
  Give up: `quit`. `done` is called once; `game.state` is never touched.
- Music `mm-station` on the stage and `mm-boss` from the boss's entrance, `castle-clear` for the
  win; sounds `boss-fill` (each bar notch), `beam` (his entrance, Mega Man's exit), `capsule`
  (`art.ts` names them all).
- Touch labels: Mega Man's level labels while he plays (`levelTouchLabels`: JUMP, SHOOT, the
  weapon's name, WEAPON with two or more), only MENU while READY, the capsule, the gate and the
  entrance run, none once the round is decided. Dev assists: No damage keeps every hit point (a pit
  still fails, as in a level). Dev: `?minigame=megaman` (the scene is `window.__miniGame`), or Dev →
  Mini games.
- **World hook** `WorldStart.extraEntities(spawn, world)`: a mini game's own entity types without a
  case in `makeEntity`. Asked first for every spawn: an entity takes it, `null` drops it, `undefined`
  leaves it to World's own types. The station's `hopper`, `turret` (`mount=ceiling`), `drone`
  and `capsule` come through it (`stationEntities`).

Difficulty (a "cautious human" sim, `human-sim.test.ts`: `StationBot` with a 15-frame reaction
delay, robots and shots misjudged by up to 6 px, pauses and jumps a little early; it knows the
plan, switches to the Saw Disc and fires it, jumps Dark Mega Man's shots; without the saw it uses
charge shots from afar; `MM_SIM=30 pnpm vitest run megaman/human-sim --silent=false` prints the
report): with the Saw Disc it wins 93 / 93 / 93 / 97% of 30 seeds at a 12 / 15 / 18 / 21-frame
reaction, losing about 20-22 of 28 hit points in all (about 12 to Dark Mega Man; half the wins end
on 8 or less). With the buster alone: 90 / 80 / 23 / 20%, so the weakness matters for slower
players.

## Samus's mini game: Zebes Escape (`src/game/minigames/samus/`)

The cavern under 4-2 starts to self-destruct, played **as Samus**: get from the Chozo statue's
chamber to her ship before the countdown runs out. It runs in a real `World` of its own
(stage.map, loaded with `?raw`, not in the level library) with a fresh GameState: Samus with a
toned-down dev kit (`ESCAPE_KIT`: one energy tank, 60 energy, the Long Beam, ten missiles; the
morph ball and its bombs are always hers; no Varia suit), one life, no level clock. READY shows
first (Samus cannot move, the countdown waits, the press that started the round never jumps).

- **The stage** (theme `cavern`, music `zebes-escape`; three screens wide and three high, the
  first map with `camera: free`, see below): the chamber (the `zebes` sheet's Chozo statue,
  facing right) at the bottom left; a corridor with a three-tile pit (out of the map's bottom) and
  a **morph-ball tunnel** (a one-tile gap at the floor, with a bomb block inside); **shaft 1** up
  the right side; the middle corridor left through a **bomb wall** (three bricks: a bomb opens
  the bottom one, enough to roll under; a missile opens any); **shaft 2** up the left side (with
  platforms back up from its floor); the top corridor right through a second tunnel; down into the
  hangar and the **ship**. Shaft platforms step up three rows at a time, each beside the last and
  never right above a take-off spot, so every climb is a jump beside a ledge and a drift onto it
  (Samus's floaty jump; no wall jump). Bomb blocks are plain bricks (World's own blast and missile
  rules), so nothing new opens them. Fourteen alarm lights (`alarm-0/1`) hang on the back wall.
- **The creatures** (`creatures.ts`, an `Enemy` each through `extraEntities`; they face left in the
  sheet and are flipped going right, flash in `zebes-flash` when hit (not with reduce flashing),
  blow up in a small explosion, drop Samus's energy and missiles, and never despawn, since the
  escape runs back left): **Zoomer** (2 HP) creeps round whatever it clings to, tile by tile:
  floors, walls (its frames turned a quarter, `ZEBES_WALL_DEF`, made from the sheet at first use),
  ceilings (upside down) and round both kinds of corner; the stage's two circle free platforms; one
  that loses its surface falls and crawls on. **Ripper** flies straight wall to wall at one height;
  beams glance off, a missile or a bomb stops it, the ice beam freezes it. **Skree** (1 HP) hangs
  under a ceiling and drops on Samus passing within 40 px below, veering toward her, digs in for
  24 frames and bursts into four shards. A touch or a shard takes Samus's usual 8 energy
  (`World.hurtPlayer`: the no-damage assist, blinking and knockback as in a level).
- **The countdown** (`COUNTDOWN_SECONDS`, 90): big block digits (rects, no sheet) at the top of
  the HUD (`ZEBES` in the place slot, `EN` below the name), red in the last ten seconds (pulsing
  between two reds, steady with reduce flashing). The announcer says "Escape! 90 seconds." and
  calls 60, 30 and 10 seconds. The `alarm` sound plays every 2 s and every half second in the last
  ten, when the music also speeds up (tempo 1.2; reset when the round ends). A red wash swells and
  fades over the cavern about once a second (twice in the last ten); with reduce flashing it is a
  steady light tint, and the alarm lights stay lit.
- **Outcomes**: touching the ship (its hull, all but the wing tips) boards it: the countdown stops,
  the creatures go, Samus hides inside, the ship lifts off (`beam` sound, the win jingle, "SAMUS
  ESCAPED!", the announcer gives the seconds to spare) and the round passes after 150 frames. The
  countdown reaching zero: the cavern blows up (the `explosion` sound; white and orange flicker
  for 40 frames, then a fade to white; with reduce flashing only the fade) and the round fails
  after 120 frames. A pit or losing all energy fails once the death has played. Menu
  (`EscapeMenuScene`, a `MiniGameMenuScene`; it pauses the countdown) Give up: `quit`. `done` is
  called once; `game.state` is never touched.
- **Assists** (dev mode, from the menu): No damage keeps every point of energy (a pit still
  fails). Infinite time holds the countdown where it is (said once: "Infinite time: the countdown
  holds."); turned off, it runs on from there.
- Touch labels: Samus's level labels while she runs (`levelTouchLabels`: JUMP, SHOOT, MISSILE,
  WEAPON; BOMB in the ball, no JUMP), only MENU while READY, none once the round is decided.
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

Difficulty (a "cautious human" sim, `human-sim.test.ts`: `EscapeBot` knows the route as a table of
surfaces and what to do from each, so a fall down a shaft just resumes from where it lands; it
baits Skrees and shoots them once down, shoots Zoomers in line, waits for Rippers to clear a jump
and for a Zoomer to leave the landing. As a careful first-timer it sees the creatures 15 frames
late, misjudges take-off spots by up to 6 px (halving the error after a failed jump), lets go of
12% of jumps early (a third of that at the pit) and pauses now and then;
`ZEBES_SIM=30 pnpm vitest run samus/human-sim --silent=false` prints the report). With 90 seconds
it escapes 100 / 97 / 90 / 93% of 30 seeds at a 12 / 15 / 18 / 21-frame reaction, with a median of
28 / 22 / 20 / 22 seconds to spare (the closest 1-12 s); the misses are the pit (2 in 30 at the
slower reactions) and, rarely, the clock. A clumsier player (21 frames, 10 px, a quarter of jumps
let go early) escapes 63% of the time, mostly losing to the clock in shaft 2. A sharp run leaves
about 43 seconds.

## Simon's mini game: Dracula's Castle (`src/game/minigames/simon/`)

Simon is Dracula's thrall; the round is an NES Castlevania-style castle stage and Dracula's
throne room, played **as Simon** with his own kit (no new weapon code): the chain whip (`whip: 1`)
and five hearts; a candle in the entrance hall drops the **dagger** (`subs: 1`, a banner and the
announcer say how to throw it; each throw takes a heart). It runs in a `World` of its own
(stage.map with `?raw`, not in the level library) with a fresh GameState, one life, no level clock:
the scene keeps its own **300-second clock** (held by the Infinite time assist; at 0 Simon falls).
READY shows first. Theme `crypt` and the `crypt` sheet (`art.ts`: `drawCrypt` draws a crypt frame,
or a plain box for one that does not exist; nothing throws).

- **The stage** (112 columns; rows 0-1 stay empty under the HUD; below them every empty cell is
  the crypt's black-brick `wall` backdrop under a `wall-top` cornice, with four open windows,
  stained glass and Dracula's throne as decor): the entrance hall (candles, a bat),
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
- **The HUD** (`hud.ts`; no score, so its World has `scorePopups: false`: kills float no "200", as in Zebes and Station Escape): a black band with PLAYER and ENEMY bars (16 segments each), TIME, the
  sub-weapon box and the hearts.
- **Dracula** (`dracula.ts`), one ENEMY bar over two phases (`BOSS_HP` 14: 6 for the Count, 8
  for the beast). **Phase 1, the Count** (music `cv-boss`): gone, appears (sfx `dracula-teleport`)
  at one of four spots (never the last one, never within 48 px of Simon, preferring within 100),
  opens his cape and 28 frames later throws a **three-fireball spread** from his low hand (level
  at lash height, one rising over Simon, one dropping to the floor), lingers ~2 s, vanishes. Only
  his **head** can be hurt (a separate 16x16 hit box over his 20x42 body; the body clinks), and
  only while he stands there; 24 frames of grace after a hit. **Phase 2**: the transformation
  (2 s, sfx `beast-roar`, no screen tint with reduce flashing), then the **beast** (48x48 art,
  36x40 body, hurt anywhere; music `cv-beast`) rises and cycles walk → spit (three aimed
  fireballs) → walk → spit → walk → crouch and **leap** at Simon → a landing stomp (a screen
  shake, not with reduce flashing) with a **shock wave** running along the floor each way.
- **Endings**: beating the beast passes (banner DRACULA IS DEFEATED! THE CURSE IS BROKEN., the
  jingle, 5 s); losing every hit point, a pit or the clock fails; the menu's Give up quits
  (`CastleMenuScene`, the shared MiniGameMenuScene with the dev assists). `done` is called once.

Difficulty (`human-sim.test.ts`, `CastleBot`: it follows the route, lashes candles and whatever
its prediction puts in the lash after the wind-up, keeps clear of Medusa heads until it can lash
them, stands off while Dracula casts, lashes the level fireball, then steps in and jump-lashes his
head on the way down; against the beast it throws daggers from a distance, flees its leaps and
jumps its shock waves; `CV_SIM=30 pnpm vitest run simon/human-sim --silent=false` prints the
report): a sharp run passes unhurt with ~250 s left. As a careful first-timer (sees things 15
frames late, misjudges by up to 6 px and its jump-lash by up to 2 frames, pauses now and then,
steps closer to a candle its lash fell short of, judges Dracula more closely after each hit or
missed lash) it passes all 30 seeds at a 12, 15 and 18-frame reaction, losing 6-8 hit points a run
(3-4 of them to Dracula) with a median of about 210 of the 300 seconds left; a clumsy player (21
frames, 10 px, more pauses) passes 93%, losing 10.5 (7 to Dracula; the two misses are Dracula).
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
- **The room.** `src/content/levels/practice.map`, one locked screen loaded with `?raw` (kept out
  of the level library and the dev select): a floor, a step up to a high ledge, a brick row with a
  ? block, a target dummy (`dummy x y` in the map; `TargetDummy` never moves or hurts, pops after
  three hits and comes back), a gap (falling in puts the hero back at the start) and a tall wall to
  cling to. It runs in a World of its own with a fresh GameState for the hero and its full kit
  (`devKit`: Mega Man's helmet, Samus's missiles, Simon's sub-weapons...), and the run's GameState
  is snapshotted and restored around it (as the mini games do), so lives, score and power are never
  touched. Hit points stay topped up, so nothing in the room can end it. The HUD shows TRAINING
  where WORLD and TIME go, and no score or coins (`drawHud`'s `place` option).
- **Lessons** (`lessons.ts`). `TrainingLesson { id, prompt, done(tracker), setup?(room) }` per hero in
  `LESSONS`; `MoveStats` watches the player and world each frame (jumps and their height,
  ground speed and glide, attacks, shots by kind and direction, charge shots, slides, crouching,
  tool changes, wall cling and wall jumps, scratch flags like the morph ball, bombs, shield blocks,
  gap crossings, and how the dummy was hit). The tracker is reset when a lesson comes up, so each
  is done while its prompt shows. Prompts name abilities as the guide and touch buttons do (never
  button letters); a button's ability is written `[SHOOT:attack]` and shown through `abilityHint`
  ("SHOOT (X)" with keys or a pad, "SHOOT" on touch), falling back to the bare names when that
  would not fit 3 lines of 25 columns (`promptText`). They come one at a time in a centred box
  under the HUD (`drawRoomBox`: the stage tutorials' `drawPromptBox` from `stage-prompts.ts`,
  24 px margins, with a green tick), announced; each ticks off with a sound and GOOD!, and after
  the last READY! ends the room. MENU in the room: Continue / Skip training. Walking, jumping and
  the basic attack never tick a move lesson (tested per hero): Luigi's stop counts only from a run,
  Bill's aim counts once per shot (a Spread fan is one direction) and needs two aimed directions.

| Hero     | Lessons                                                                                     |
| -------- | ------------------------------------------------------------------------------------------- |
| Luigi    | high jump, slippery stop, fireball (the lesson gives fire power)                            |
| Link     | sword, down-thrust, up-thrust, shield blocks the dummy's shot, boomerang (USE TOOL / TOOLS) |
| Mega Man | buster, slide, charge shot, special weapon (WEAPON, USE WEAPON)                             |
| Samus    | beam, aim up, morph ball, bomb, missile                                                     |
| Simon    | whip, crouch whip, sub-weapon (THROW), the committed jump over the gap                      |
| Ryu      | sword slash, wall cling, wall jump, ninpo (CAST)                                            |
| Bill     | shoot, 8-way aim (three directions), prone, jump and shoot                                  |

To add a hero's training: a list in `LESSONS` (3-5 lessons, tested by
`src/game/tutorial/lessons.test.ts`) and a scripted run in `tests/sim/training-room.test.ts`.
