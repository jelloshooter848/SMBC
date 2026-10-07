# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) with the pre-1.0 rules in
[docs/RELEASING.md](docs/RELEASING.md). Every pull request with a user-facing change adds a line
under `## [Unreleased]`.

## [Unreleased]

### Added

- Hero tributes in the campaign: each freed hero's level takes on the look and music of their own game, coin heavens
  included. 2-1 becomes a Zelda II field, 3-1 a Mega Man stage, 4-2 Metroid's Brinstar, 5-4 a Castlevania hall
  and 6-2 a Ninja Gaiden city street. Layouts, enemies and physics are unchanged, the music plays for every hero,
  and classic play keeps the original look.
- 2-1's Top Secret Area route now works for Simon too: a one-way cloud ledge by the tower, and two cloud steps that
  appear with the cloud path.

### Changed

- The mini games are truer to their heroes' own games:
  - Their own HUDs: bars only for Mega Man, energy tanks and a missile count for Samus, Castlevania's three rows for
    Simon, Ninja Gaiden's for Ryu, Zelda's for Link, and the SMB HUD for Luigi's race.
  - Their own deaths: Mega Man bursts into orbs, Samus explodes, Simon collapses, Ryu falls.
  - Their own starts: Mega Man beams in after READY, Samus materialises, Luigi's race opens on a WORLD 1-1 card,
    and the hero drops into Larry's cabin from the ceiling.
  - Three lives with checkpoints for Mega Man, Samus, Simon and Ryu; TRY AGAIN appears only on game over.
  - Mini-game-only physics for Simon (rooted while whipping, the fixed knockback arc) and Mega Man.
  - Samus's escape opens on "TIME BOMB SET / GET OUT FAST!" with a TIME counter.
  - Link fires a sword beam at full hearts.
  - Dracula's real second form: his head flies off, the beast drops in with a full bar, leaps and spits fire, and
    only its head can be hurt. His room gets barred windows and a coffin on a dais.

## [0.4.10] - 2026-10-07

### Added

- A secret in 2-1 (campaign): get over the flagpole without touching it (a hidden block lays a cloud
  path) and a Moblin in a cave past the castle shows you a secret path: "IT'S A SECRET TO
  EVERYBODY." It opens World 2's hidden spot, the Top Secret Area, with five ? blocks (two Fire
  Flowers, a Yoshi egg that hatches a 1-up for now, two Mushrooms) that refill on every visit.
- Dev mode: a Safety floor assist. Deadly pits get an invisible floor at the pit's rim and lava turns
  solid, so testing a level can't end in a fall. Falls that lead somewhere (coin heavens, the 7-3
  bridge, the 5-4 lift ride) still work.

## [0.4.9] - 2026-10-07

### Added

- Bill is hidden under 7-3. In the campaign, 7-3 now looks like a Contra jungle stage (same layout).
  One steel bridge with a blinking red light, marked by an arrow of coins, blows up piece by piece
  when you step on it. Fall through it to reach Bill's jungle camp, then climb the waterfall back
  into 7-3. His mini game, Jungle Assault, plays by NES Contra's rules:
  - a stage card where the Konami code gives 30 lives;
  - one hit costs a life;
  - falcon weapons, lost when you die;
  - aiming in eight directions, lying flat, dropping through ledges, wading and ducking in the
    river;
  - soldiers, snipers, wall guns, pillboxes and exploding bridges;
  - two bosses: the defense wall, then Red Falcon's heart in the alien lair.
- Campaign looks for levels (`campaignTheme:`, `campaignMusic:`, `[campaign-decor]`), plus original
  Contra-style art and music (contra-jungle, contra-falls and alien-lair looks).

### Fixed

- Larry's Airship in the Mini Game Arena (and Dev → Mini games) now opens character select so
  you can pick which freed hero to play the round as; the save's hero is unchanged.

## [0.4.8] - 2026-10-07

### Added

- Ryu is hidden in 6-2: in the first underground bonus room, a few coins point at a section of the
  wall marked with a stuck shuriken. Push into it and the panel spins you through to his night
  dojo. His mini game, Shadow Duel, opens with a moonlit duel cutscene, then a Ninja Gaiden-style
  climb through a moonlit town (wall cling, lanterns, knife throwers, dogs and hawks) to a rooftop
  duel with the Masked Ninja.
- Trick walls for levels (`trick` zones), plus original Ninja Gaiden-style art and music (dojo and
  ninja-night looks).

### Fixed

- Holding left or right while dropping into a bonus room no longer lands the hero on top of the
  room's wall: the hero falls straight until clear of the top rows.
- The game font now has a semicolon.

## [0.4.7] - 2026-10-07

### Added

- Simon is hidden under 5-4: ride the down lift past the bottom of the shaft into a secret dungeon,
  break the cracked wall (small heroes can kick a Koopa shell into it) and take the stairs down to
  his crypt. His mini game, Dracula's Castle, is a Castlevania-style stage with stairs, candles,
  bats, Medusa heads and skeletons, ending in a two-phase fight with Dracula.
- Castlevania-style stairs for levels (`stairs` entities), plus original crypt art and music.
- The Mini Game Arena: the warp zone's first pad opens a stadium page with a pad for every mini
  game, tutorial, Larry's airship and the bonus games you have found. Play them for fun; nothing
  you do there changes your save.

### Changed

- The Lost Levels are now the rest of the story: beating 8-4 opens a road from World 8 to Lost
  World 1, and the Lost worlds are played in order through D-4, the final ending. Their warp zones
  still work as on the NES. Older saves keep their progress and get the new road.
- The warp zone's Lost Levels pad is now the Mini Game Arena pad.
- After a bonus game the Hammer Bro no longer appears at once: the spot stays closed until you play
  a level, and then he guards the road. A fight only starts when you walk into him.

## [0.4.6] - 2026-10-06

### Added

- Samus is hidden in 4-2: up the vine, the warp zone's single pipe drops into a Metroid-style
  cavern with a Chozo statue. Her mini game, Zebes Escape, is a race up vertical shafts against a
  self-destruct countdown, with morph-ball tunnels, bomb walls and her ship at the top.
- Larry Koopa's airship: in 4-2's other warp zone an anchor crashes down and smashes the pipe; climb
  its chain onto an auto-scrolling SMB3-style airship (cannons, Rocky Wrenches, Bullet Bills) and
  take the stern pipe down to Larry's cabin. Dying aboard never costs a life: try again, or give up
  and go back to 4-2. Beating Larry gives the crystal ball.
- The crystal ball shows every hidden hero's silhouette on the map, opens a road on World 4 and
  unlocks the item inventory. A cutscene shows the airship crash on the map and Toad building a
  bonus spot from the wreck.
- SMB3 bonus games at the new spot, in rotation: Toad House, N-Spade card match and the spade slot
  game. Each is one go; a wandering Hammer Bro guards the road, and beating him reopens the bonus
  and gives an item.
- An SMB3-style item inventory on the world map: mushrooms, fire flowers, stars and 1-ups are kept
  on the save file and given to the hero at the start of the next level. Dev mode can unlock it
  and hand out items without touching the save.
- An auto-scrolling camera (`camera: auto`) and a vertical camera (`camera: free`) for levels.
- New cavern, airship and airship-deck looks with original Metroid- and SMB3-style art and music.
- Dev → Mini games lists Zebes Escape and Larry's airship.

### Changed

- In the campaign, 4-2's warp zones no longer skip worlds; they lead to Samus's cavern and Larry's
  airship instead. Play outside the campaign keeps the original warps.

## [0.4.5] - 2026-10-06

### Added

- Mega Man is hidden above 3-1's coin heaven: follow the coins past the end of the clouds, bump the
  hidden block and step on the teleporter to beam up to a space station. His mini game, Station
  Escape, is a Mega Man-style stage (robots, the Saw Disc capsule, a boss gate with a filling life
  bar) ending in a fight with Dark Mega Man.
- A new space station look (tiles, decor, robots) with original Mega Man-style music.
- Teleport pads for levels (`teleport` zones) and decor from other sprite sheets (`sheet:frame`).

### Changed

- The freed-hero card uses the hero's full name ("MEGA MAN IS FREE!").

## [0.4.4] - 2026-10-06

### Added

- Link's Shadow Keep, round two: a boomerang (stuns monsters, fetches pickups) and bombs from
  chests, a cracked wall hiding a shrine with the shield (blocks rocks and the Keeper's spells
  from the front, and monsters hurt you less), and a heart container. Link starts without a shield.
- Freed heroes hop for joy beside their level on the world map (with an outline so they stand out).
- Developer mode: Mini games (play any mini game directly, nothing is saved), and the assists
  (like No damage) work inside mini games, with Assists in their menus.

### Changed

- The end-of-level time tally counts about four times faster, and JUMP finishes it at once (same
  points).
- A secret exit only opens its own road: 1-2's warp-zone pipe draws the road to the warp spot, and
  1-3 opens when 1-2 is beaten at the flagpole.
- The tutorial and training explain running on touch (push the d-pad far to the side, or hold RUN).

### Fixed

- Link's sword covers the whole tile in front and a little to the sides, and wins ties, so
  monsters coming in at an angle no longer hit him through a swing.
- Luigi's training "slippery stop" lesson passes on a normal attempt (the room was too short).
- Toad's OK hint follows the controls in use; the training skip hint no longer covers the floor;
  the Keeper's name no longer covers him and his spells vanish when he falls.

## [0.4.3] - 2026-10-06

### Added

- Mario's tutorial stage, 1-0: a new file starts on it (1-1 opens once it's cleared). Toad tells
  the story and the stage teaches the basics step by step; falls cost no lives, and the pause menu
  can skip it. Files that already cleared a level count it as done.
- Optional hero training: the first time you pick a freed hero on a file you're asked whether to
  practise their signature moves in a training room (also in the pause menu as Training).
- Link is hidden above 2-1's coin heaven: follow the arrow of coins, find the hidden vine and climb
  to the sky ruins. His mini game, Escape the Shadow Keep, is a top-down dungeon with puzzles,
  monsters and a boss, in the style of his own game.
- World map hints for hidden heroes: a faint silhouette by a cleared level that still hides
  someone, and the hero standing beside it once freed.
- Developer mode: an "All heroes" toggle in the world map menu.

### Changed

- The story intro cards are replaced by Toad in 1-0.

### Fixed

- Coin heavens stand on cloud blocks, as in the original (2-1, 3-1, 5-2, 6-2 and the Lost Levels'
  sky areas).

## [0.4.2] - 2026-10-06

### Added

- Free the heroes: Bowser has brainwashed the other heroes. A new campaign file starts with Mario
  only (with a short story intro); the rest show as silhouettes in character select until found.
  Talk to a brainwashed hero (up, when close) to start a mini game from their world; win it to free
  them for that save file, or try again as often as you like.
- Luigi waits in the 1-1 bonus room. His mini game is the Mirror Race: beat him to the flagpole.

### Changed

- Save files move to format v3 (freed heroes). Older files convert and keep Mario plus the heroes
  they were last played with. Dev mode, custom and shared levels keep every hero.

### Fixed

- Mushrooms (and 1-ups and poison mushrooms) on a block hop when the block is bumped from below, as in the original.
- A coin on a block bumped from below is collected, as in the original.

## [0.4.1] - 2026-10-06

### Added

- Map levels with a second way out (a secret exit or warp zone) are drawn in pink with a keyhole,
  Super Mario World style, and the announcer says "secret exit": 1-2, 4-2 and Lost 1-2, 3-1, 5-1,
  5-2, 8-1, A-2, A-3 and B-4.
- The map header shows the level you stand on ("WORLD 1-2", "LOST A-2").

### Changed

- The road to the Warp Zone's warp spot now starts at 1-2, where the secret is (1-1's road to 1-2
  goes round so the roads never cross); older saves convert.
- Portals are paired: each one lands on its partner. Only Lost World 1 links to the Warp Zone
  (landing on the hub's Lost Levels pad), and Lost World A's portal leads back to the World 8 pad.

### Fixed

- Developer mode's Unlock all now shows the warp spot and its road (still without saving anything).

## [0.4.0] - 2026-10-06

### Added

- **Warp Zone**: in the campaign, the 1-2 warp zone has a single pipe; taking it clears 1-2 and
  draws a new road on the World 1 map to a warp spot that leads to the Warp Zone hub. The hub
  links to the Lost Levels (unlocked by beating 8-4; a locked pad shows how to open it) and has
  three mystery pads reserved for future secrets.
- **The Lost Levels campaign**: 13 world maps (1-8, 9, A-D) with their own layouts, entered from
  the hub. Levels open in order like SMB; World A opens after beating Lost 8-4, World 9 after
  clearing every Lost level from 1-1 to 8-4 (the castle shows the count). Their warp zones work as
  on the NES. The 8-4, 9-4 and D-4 endings return to the map.
- Warp pads on the map show a hint line while you stand on them; the Worlds menu lists the Warp
  Zone (and the Lost Levels pages once you are there) and starts on the current page.
- After a death in a campaign level, the character select offers **Return to map**.

### Changed

- Save files move to format 2 (map pages by name); older files convert automatically and keep
  all their progress. SMB 4-2's warp zones still skip worlds.

### Fixed

- Touch d-pad: down engages as easily as the other directions (only the down-diagonals still need
  a firmer push, so running doesn't crouch).
- Lakitu kept throwing only four Spinies, and flying Bullet Bills stopped for good after scrolling
  (enemies that scrolled away were never marked gone).
- Hammer Bros keep pacing after touching a wall; swimming Cheep Cheeps change on every visit;
  balance lifts are centred on their spot as in the original; a stomped Blooper on land drops
  straight down.
- Remapping a key no longer fires its new action, and Esc cancels a capture; long key names show
  in full or as a clear short form; menu hints stay inside the panel over the map and levels;
  percentages show a % sign.

## [0.3.0] - 2026-10-06

### Added

- Touch controls revamp:
  - On-screen buttons say what they do for the current hero, power-up and tool (JUMP, RUN or
    FIRE, SWORD, BOOMERANG, SHOOT, BOMB, MENU…), hide when they do nothing, and read OK / BACK
    in menus.
  - Pushing the d-pad to its edge runs (without firing). The d-pad uses angle zones (wide left
    and right, a deliberate push for down), a larger touch area, lights up the pressed
    direction and vibrates on Android.
  - Options → Controls chooses a fixed d-pad or a floating stick that appears under the thumb.
  - A thumb can slide from one button to the next; the tool-belt button sits beside the tool
    button.
  - Auto mode shows the controls on phones and tablets only, brings them back on a touch and
    hides them on a key or gamepad press; the pause menu has a Touch controls row (Auto / On;
    Off from a keyboard or gamepad).
- How to play shows only the controls in use: touch buttons, the gamepad or the keyboard.
  Instructions name the ability (JUMP, BACK, TOOLS) and, on a keyboard or gamepad, the real
  bound key; on-screen buttons no longer carry A/B/C letters.
- Options → Controls → **Key hints**: on desktop, a see-through copy of the touch layout shows
  each ability with its bound key (follows remapping and the hero's labels).

### Changed

- The touch size setting now ranges from 100% to 160% so button text stays readable; smaller
  stored sizes load as 100%.
- A new save file opens straight on the World 1 map with Mario; the hero is picked only when
  entering a level. A new file is one player; new two-player save files are paused for now
  (older two-player files still load and play).
- Dev mode: the pause menu in a campaign level now has **Assists** (the full dev menu with level
  select stays outside campaign play).
- Lost Levels endings use the NES wording: 8-4 and D-4 show "THANK YOU <HERO>! / YOUR QUEST IS
  OVER. / WE PRESENT YOU A NEW QUEST. / PUSH BUTTON B / TO SELECT A WORLD", 9-4 shows "THANK
  YOU!", and D-4 now rolls the credits. B or Start continues, from either player.

### Fixed

- Fake Bowsers' true forms are redrawn: worlds 1-3 show the overturned enemy (Koopa and Buzzy as
  shells), worlds 4-7 the whole enemy upside down, at the enemy's size where Bowser's head was,
  with an outline that shows against the castle's black; the body keeps Bowser's facing.

## [0.2.2] - 2026-10-06

### Fixed

Every fix below follows the original Crossover 3.1.21 source; each report in `bug-reports/`
(2026-10-05 batch) ends with a Status line naming what changed.

- Level data: half-tile offsets from the original (shifted enemies, centred lifts), the 9-1
  clock block, the ll-5-3 checkpoint row, and fire bars named by the direction they really turn.
- Lifts: sideways, vertical, falling and balance lifts move on the original's paths and speeds;
  balance lifts snap for 1000 points; lifts no longer carry players through walls; 2-4 and
  ll-12-4 lifts reach where they should.
- Castles: Bowser paces, jumps, chases, throws single hammers and aims his flames as in
  the original, shows his true form after a fireball kill, and the axe no longer gives 5000;
  fake Bowsers stay near their spot; fire bars turn at the right speed and direction; Podoboos
  jump to the right height; lava drops the player in instead of killing with a hop.
- Cannons and air: blaster timing and the two-bill limit, Bullet Bill speed, the 5-3 flying
  bills, Lakitu's steering, throws, Spiny cap, start column, exit and respawn delay, and Hammer
  Bros' pacing, jumps, single throws and hammer arc.
- Water: swim stroke and sinking, sea-floor walking, swimming and leaping Cheep Cheeps, and
  Bloopers (sink speed, rise rule, stompable out of water).
- Enemies: paratroopa flight (red bob, green hops, sideways sway), piranha first rise, knocked-out
  enemies fall upside down; springboards are two tiles tall, solid to players, launch every hero
  with the original's power and gravity, and a second player can't ride someone else's.
- Pipes, vines and warps: pipe travel speed and the hidden wait, pipe exits stop on the pipe,
  vine areas start with an automatic climb, left/right steps off a vine, no attacks on a vine,
  warps clear the old checkpoint and show the new world's card, the 1-2 intro walks itself,
  enemies near a restart or pipe exit are cleared, and ll-9-1 restarts in its first room.
- Level end: touching the flag clears enemies on screen, fireworks follow when the time ends in
  1, 3 or 6, and the castle flag rises; 8-4 ends with "YOUR QUEST IS OVER." and a credits roll
  (original text and music), then saves the file as cleared.
- Mario and Luigi run across one-tile gaps at full speed.
- Lost Levels: worlds A-D open after eight games are beaten, and 8-4, 9-4 and D-4 have their own
  closing cards; saves that already had A-D open keep them.

## [0.2.1] - 2026-10-06

### Added

- Developer mode: an **Unlock all** switch in the map menu opens every world, level and road on
  the world map for that save file, without marking anything cleared.

### Changed

- The README links the online version at the top.
- The release standard counts developer-only changes and optional save fields as patch releases.

## [0.2.0] - 2026-10-05

### Added

- A Super Mario World-style world map: one themed page per world (Grass Land, Sea Side, Night
  Hills, Mushroom Woods, Sky Trees, Snow Night, Cannon Coast, Bowser's Land) with animated
  decorations, levels that open in order, roads that draw in after a clear, warp pipes that open
  only the world they lead to, and a map menu with Worlds travel and Save and quit.
- Three save files with a file select screen (hero, world reached, levels cleared, lives, score,
  a star once 8-4 is beaten; new, continue and erase). A file keeps map progress plus lives,
  score, coins, heroes and their power, and saves itself whenever the map is shown.
- Original map music.
- Campaign flow: clearing a level returns to the map, Pause → Quit to map, game over CONTINUE
  returns to the map with progress kept.
- A release and versioning standard ([docs/RELEASING.md](docs/RELEASING.md)), this changelog, a
  pull request template and `pnpm release:check`.

### Changed

- The live site updates only when a version is released (a `v*` tag), no longer on every merge to
  `main`. Release builds show their version on the title screen (`V0.2.0`); every other build
  shows `V0.2.0-DEV.<commit>`.

### Fixed

- Level `.map` files failed to load under the Vite dev server (`pnpm dev`).

## [0.1.0] - 2026-10-05

The first version: everything up to pull request #23.

### Added

- All eight worlds of Super Mario Bros., 1-1 to the princess at the end of 8-4, converted from the
  original Crossover's level data: water levels, treetop bridges, springboards, beanstalks and coin
  heavens, night levels with Hammer Bros and balance lifts, Lakitu and Spinies, Bullet Bill
  blasters, fire bars, paratroopas, castle mazes, Toad in the castles and the ending.
- The Lost Levels: all 13 worlds (1-8, 9 and A-D, 52 levels), for now in Dev mode → Level select,
  with upside-down pipes, poison mushrooms, green springboards, charging Hammer Bros, fake
  Bowsers, air Bloopers, their own themes and the World 9 and A-D unlocks.
- Eight heroes, each with its own kit and a "How to play" guide:
  - Mario with SMB1 physics, mushrooms, fire flowers and stars;
  - Luigi with the higher Lost Levels jump and longer slide;
  - Link (Zelda II): sword thrusts, shield, hearts, tunics, boomerang, bombs and spells;
  - Mega Man: slide, charge shot, Rush Coil, five weapons with their own energy and E-tanks;
  - Samus: morph ball and bombs, Varia suit, energy tanks, beam upgrades and missiles;
  - Simon: whip upgrades, five sub-weapons and hearts;
  - Ryu: wall climbing and four ninpo arts;
  - Bill: eight-way rifle, prone and four guns.
- Shared drop, tool-belt and projectile systems: enemies drop ammo, health and magic.
- A level editor (tiles, enemies, items, exits, checkpoints, pipe links) with play-test, a custom
  level library, `.map` import and export, and share links that carry the whole level in the URL.
- Local two-player co-op on one screen with a shared pool of lives.
- Touch controls, gamepad support and full keyboard and gamepad remapping.
- Accessibility options: colour-blind safe palettes, high contrast, reduced flashing, an FPS
  counter, screen-reader announcements and volume controls.
- Asset packs: export repaintable templates and import your own art and music, stored only in the
  browser.
- A hidden developer mode (level select, full kit, assists such as infinite lives and slow motion).
- Original pixel art and an MML-driven NES-style audio engine; the build version on the title
  screen; a bug-reports folder for testers.

### Fixed

- Tester reports from comparing 1-1 with the original: deaths go back through character select,
  game over offers CONTINUE? YES / NO, the time tally rate, the 15-coin brick, a seven-digit
  score, the HUD on the lives card, and scoring of kills, shell kicks and the flagpole as in the
  original.
- Bumped Koopas and Buzzy Beetles pop into their shells and bumped Spinies bounce; kicked shells
  get a short no-hit window and landing on a still shell no longer bounces.
- Jump physics matched to SMB1; audio unlocks on iOS; load errors show on screen; Safari support.

[Unreleased]: https://github.com/jelloshooter848/SMBC/compare/v0.4.10...HEAD
[0.4.10]: https://github.com/jelloshooter848/SMBC/compare/v0.4.9...v0.4.10
[0.4.9]: https://github.com/jelloshooter848/SMBC/compare/v0.4.8...v0.4.9
[0.4.8]: https://github.com/jelloshooter848/SMBC/compare/v0.4.7...v0.4.8
[0.4.7]: https://github.com/jelloshooter848/SMBC/compare/v0.4.6...v0.4.7
[0.4.6]: https://github.com/jelloshooter848/SMBC/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/jelloshooter848/SMBC/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/jelloshooter848/SMBC/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/jelloshooter848/SMBC/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/jelloshooter848/SMBC/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/jelloshooter848/SMBC/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/jelloshooter848/SMBC/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/jelloshooter848/SMBC/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/jelloshooter848/SMBC/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/jelloshooter848/SMBC/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/jelloshooter848/SMBC/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jelloshooter848/SMBC/releases/tag/v0.1.0
