# Super Mario Bros. Crossover (browser rebuild)

A from-scratch, browser-based reimplementation inspired by the 2010 Flash fan game
_Super Mario Bros. Crossover_: play the Super Mario Bros. levels as characters from other
NES-era games, each with their own mechanics. Flash is gone; this runs anywhere a modern
browser does, including phones, and deploys as static files.

**This is an unaffiliated fan project.** It contains no Nintendo, Capcom, Konami or other
third-party art, music or code. All sprites and tiles are original pixel art stored as text in
`src/content/sprites`, and all music is original chiptune synthesized at runtime from
`src/content/music`. Character names are used only to describe gameplay styles.

## Play

```sh
pnpm install
pnpm dev          # http://localhost:5173
```

Keyboard: arrows move, **Z** jump, **X** run / attack (and _back_ in menus), **C** special
(use the selected tool), **Right Shift** select (cycle tools), **Enter** start/pause. Gamepads use the standard mapping. Phones and tablets get on-screen
controls automatically. Press **F1** for the debug overlay and **F2** for a free camera
(arrows scroll) when checking level layouts.

### World map and save files

**Start game** opens the file select: three save files, each showing its hero, the world
reached, levels cleared (out of 32), lives and score (a star once the game is beaten); pick a
file to continue it, start a new one (character select, player two can join) or erase one.
A file plays on a Super Mario World-style map with one page per world (1-8). Walk the d-pad
along open paths and press jump on a level to play it (character select first; the
current hero is preselected). Clearing a level, at the flagpole or by Toad in a castle, returns
to the map and draws in the road to the next one; a castle opens the next world's page. A warp
pipe opens only the world it leads to; the map menu's **Worlds** list travels between open
worlds (back to the spot you left in each). **Pause → Quit to map** leaves any level without
clearing it. Game over offers CONTINUE: yes returns to the map with fresh lives (score and coins
reset, cleared levels kept), no goes to the title. The file saves itself whenever the map is
shown, after each death and on a warp; the map menu (start or select) has **Save and quit**, and the
level pause menu **Quit to title** saves too.
Beating 8-4 marks the file with a star and returns to the World 8 map. Developer mode,
`?level=`, custom and shared levels and editor play-tests skip the map and never write a save.

### Characters

**Options → How to play** opens a guide for every hero: its controls with the keys
you have bound, what the mushroom, flower and star do for it, and its tool belt. The pause menu
has the same guide for the hero you are playing.

- **Mario**: SMB1 physics, mushrooms, fire flowers, stars, stomps.
- **Luigi**: the same kit with a higher jump, slower acceleration and a longer slide (Lost
  Levels style).
- **Link**: Zelda II style. Fixed-height jump, hearts, sword with down-thrust (bounces) and
  up-thrust (up + attack in the air), a shield that stops projectiles from the front while
  standing. Mushrooms add a heart container and the white tunic (every other hit glances off);
  flowers give the red tunic and a sword beam at full health. **Select** cycles the tool belt
  and **C** uses it: boomerang (stuns), bombs (ammo dropped by enemies; break bricks, hurt
  Link too), and the Jump, Shield and Fire spells, which spend the magic meter that enemy
  drops refill. Can't stomp.
- **Mega Man**: instant acceleration, cut-able jump, slide (down + jump), arm cannon with
  three shots on screen, 28-point health bar. A mushroom fits the helmet: charge shot, brick
  breaking and the Rush Coil spring. Each flower unlocks the next weapon: Saw Disc (eight-way
  aim, cuts bricks), Leaf Guard (orbits and blocks shots, press again to throw), Flame Wave
  (runs along the floor, burns shells), Homing Knuckle and Bolt. **Select** cycles the belt,
  **C** fires the selection and **X** always fires the buster; each weapon has its own energy
  bar beside the health bar. Enemies drop health and weapon pellets and the odd E-tank, used
  from the pause menu. Can't stomp.
- **Samus**: floaty somersault jump, energy counter (starts at 30), arm cannon that aims
  straight up while holding up. Down curls into the **morph ball** (fits through one-tile gaps,
  can't jump) where fire drops small bombs that open blocks and bomb-jump her; up stands back
  up. The first mushroom is the **Varia suit** (half damage), later ones are energy tanks
  (+30, up to 90). Flowers upgrade the beam: Long → Ice (freezes; a second shot shatters) →
  Wave (snakes through walls), then add missiles. **Select** picks beam or **missiles**
  (3 damage, open bricks; **C** always fires one); enemies drop energy orbs and missile packs.
  Can't stomp.
- **Simon**: stiff committed jump (no steering in the air), heavy knockback when hit, 16-point
  health bar, crouch. The **whip** (X) winds up then strikes; flowers lengthen it (leather →
  chain → morning star) and then add double and triple shot. Mushrooms unlock the
  **sub-weapons** in order: dagger, axe (arcs over walls), holy water (burns on the floor),
  cross (comes back) and the stopwatch (freezes everything on screen). **Select** picks one,
  **C** or up + X throws it, and each throw costs **hearts** (the watch costs five), which
  enemies drop. Can't stomp.
- **Ryu**: fast run, a quick sword (X) and **wall climbing**: hold toward a wall in the air to
  cling, jump to kick off it (chain wall jumps to scale anything). Mushrooms unlock the
  **ninpo arts** in order: throwing star, windmill shuriken (comes back), fire wheel (three
  orbiting flames) and the jump-and-slash somersault; **Select** picks one and **C** casts it
  from the ninpo meter (the second bar), which flowers enlarge and enemy drops refill. 16-point
  health bar. Can't stomp.
- **Bill**: a commando with a somersault jump and a rifle (X) that aims in **eight directions**
  from the d-pad (up, diagonals, straight down in the air); down on the ground goes **prone**.
  Flowers and dropped capsules unlock guns in order: machine gun (hold to fire), spread (five
  shots), laser (pierces everything in a line) and the flame thrower; **Select** switches
  between the guns you have. Starts with three hits; mushrooms add one (up to five). Can't
  stomp.

### Options (title screen or pause)

- **Video**: integer scaling, colour-blind safe palettes (deuteranopia, protanopia,
  tritanopia) and high contrast, reduced flashing, FPS counter, screen-reader announcements.
- **Audio**: master, music and sound volumes, mute.
- **Controls**: full keyboard and gamepad remapping, touch pad on/off and size.
- **How to play**: the per-hero guides (also in the pause menu for the hero you are playing).
- **Asset packs**: import a folder, export repaintable templates, toggle packs.
- **Level editor** (title screen only): build and share your own levels.

### Developer mode

Enter up, up, down, down, left, right, left, right, B, A on the title screen (or open the game
with `?dev=1`) to unlock **Dev mode** on the title and in the pause menu:

- **Level select**: any built-in or custom level, any character, starting power, a full kit
  (all tools, ammo and magic) and 99 lives.
- **Assists** (active only while dev mode is on): scroll back, infinite lives, infinite time, no
  damage, keep big when losing fire, coyote time, half-speed slow motion.
- **Dev mode off** hides it again.

### The Lost Levels

All 13 worlds of _The Lost Levels_ (1–8, 9 and A–D, 52 levels) are in the game, for now
reachable only from **Dev mode → Level select** (their ids start with `ll-`; the HUD shows worlds
10–13 as A–D). They bring upside-down pipes with hanging Piranha Plants, poison mushrooms (they
hurt like an enemy), green springboards that launch far higher, Hammer Bros that charge
straight at you, fake Bowsers, Bloopers in the air, mid-screen Lakitus and warp pipes that send
you backwards. As in the original, 8-4 ends the game: a run that used no warp pipe continues
into World 9, and clearing 8-4 saves the unlock of Worlds A–D.

Settings persist in the browser.

### Two players

On the character select, player two presses **Start** (numpad 0/Enter, or a second gamepad's
start button) to join and picks their own hero. Both play on one screen with a shared pool
of lives; a fallen player drops back in beside the survivor. Player two's default keys are on
the numpad (4/6 move, 8 up, 5 down, 0 jump, . attack, Enter special, + start) and can be
remapped in Options → Controls.

### Level editor and sharing

**Level editor** on the title screen opens a tile editor: paint tiles, place enemies, items and
scenery, set exits, checkpoints and pipe links, then **Play test**, **Save** (levels are stored
in the browser and appear under **Custom levels**), **Export .map** / **Import .map**, or
**Copy share link**. A share link carries the whole level compressed in the URL, so anyone
who opens it plays it immediately; nothing is uploaded anywhere.

## Develop

```sh
pnpm test         # unit tests (physics, collision, level parsing, rules)
pnpm lint         # eslint + prettier
pnpm typecheck
pnpm build        # static site in dist/
pnpm check:levels # parse every bundled .map and check level landmarks
pnpm check:assets # refuse binary art/audio in the repo
pnpm release:check # package.json version and CHANGELOG.md format (docs/RELEASING.md)
node tools/smoke/screenshot.mjs out/   # headless Playwright smoke run with screenshots
```

Levels are text files (`src/content/levels/world*/*.map`); see `src/game/level/textmap.ts`
for the format. All eight worlds are playable, from 1-1 to the princess at the end of 8-4 (World 2 brings the water levels with
swimming, Cheep Cheeps and Bloopers, the treetop bridges with leaping fish, springboards,
beanstalks up to the coin heaven, and Podoboos in the castle; World 3 adds the night
palette, Hammer Bros and the balance lifts; World 4 adds Lakitu and his Spinies, Buzzy
Beetles, the vine to the warp zone and the 4-4 castle maze; World 5 adds Bullet Bill
blasters, the 5-3 Bullet Bill stretch and the long fire bar; World 6 adds the
hammer-throwing Bowser; World 7 adds gliding paratroopas and the 7-4 maze; World 8 adds the castle walls of 8-3, the
last castle with its pipes, loops and water detour, and the ending). The maps are converted from the level data of the original game's
[source release](https://github.com/JayPavlina/super-mario-bros-crossover) (MIT, no art or
sound) by `tools/levelgen/convert-smbc.mjs`; download its `assets/documents/levelDataSmb.xml`
into `tools/levelgen/source/` (gitignored) and run
`node tools/levelgen/convert-smbc.mjs tools/levelgen/source/levelDataSmb.xml src/content/levels/world2 2-1 2-2 2-3 2-4`
(one world per output folder).
The Lost Levels come from `levelDataLostLevels.xml` with `--prefix=ll-` into
`src/content/levels/lost/worldN/` (worlds A–D are 10–13). They bring their own looks: orange
and red giant-mushroom land (`mushroom`, `mushroom-red`), sky levels on cloud ledges (`clouds`,
`clouds-overworld`), World 9's flooded overworld (`overworld-water`, `water-gray`, still swum
through), a castle under the daylight sky (`castle-overworld`) and the swim through 8-4's
castle (`castle-water`).
Only the normal-difficulty layer is used; the generated `.map` files are committed.

## Releases and versions

The live site updates only when a version is released. Versions follow SemVer (pre-1.0: a minor
bump for new content or a save-format change, a patch for fixes), every pull request notes its
user-facing changes in [CHANGELOG.md](CHANGELOG.md), and pushing a tag `vX.Y.Z` builds, deploys
and publishes the GitHub Release. The title screen shows `V0.2.0` on a release and
`V0.2.0-DEV.<commit>` on any other build. See [docs/RELEASING.md](docs/RELEASING.md) for the
rules and the release steps.

## Asset packs

The game is playable out of the box with its built-in art. If you own other sprite sheets or
music you may load them locally without them ever entering the repository:

- **In the game**: Options → Asset packs → _Export template_ downloads one PNG per sprite sheet
  (with the frame layout) plus a `manifest.json`. Repaint the PNGs, keep the layout, put them in
  a folder with the manifest and use _Import pack_. Packs are stored in the browser (IndexedDB).
- **In development**: drop pack folders in `user-packs/` (gitignored) and list them in
  `user-packs/index.json`; `pnpm dev` imports them automatically.

A manifest can also recolour built-in art with `palettes`, and replace songs or sound effects
with audio files (`music`, `sfx`). See `src/engine/assets/manifest.ts` for the format.

## License

MIT for code and the original assets in this repository.
