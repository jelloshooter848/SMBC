# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) with the pre-1.0 rules in
[docs/RELEASING.md](docs/RELEASING.md). Every pull request with a user-facing change adds a line
under `## [Unreleased]`.

## [Unreleased]

### Changed

- The README links the online version at the top.

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

[Unreleased]: https://github.com/jelloshooter848/SMBC/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/jelloshooter848/SMBC/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jelloshooter848/SMBC/releases/tag/v0.1.0
