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

Keyboard: arrows move, **Z** jump, **X** run / attack (and _back_ in menus), **C** special,
**Enter** start/pause. Gamepads use the standard mapping. Phones and tablets get on-screen
controls automatically. Press **F1** for the debug overlay and **F2** for a free camera
(arrows scroll) when checking level layouts.

### Characters

- **Mario**: SMB1 physics, mushrooms, fire flowers, stars, stomps.
- **Luigi**: the same kit with a higher jump, slower acceleration and a longer slide (Lost
  Levels style).
- **Link**: fixed-height jump, hearts, sword (down-thrust in the air bounces), heart
  containers from mushrooms, a sword beam at full health from flowers. Can't stomp.
- **Mega Man**: instant acceleration, cut-able jump, slide (down + jump), arm cannon with
  three shots on screen, charge shot from flowers, 28-point health bar. Can't stomp.

### Options (title screen or pause)

- **Video**: integer scaling, colour-blind safe palettes (deuteranopia, protanopia,
  tritanopia) and high contrast, reduced flashing, FPS counter, screen-reader announcements.
- **Audio**: master, music and sound volumes, mute.
- **Controls**: full keyboard and gamepad remapping, touch pad on/off and size.
- **Asset packs**: import a folder, export repaintable templates, toggle packs.

### Developer mode

Enter up, up, down, down, left, right, left, right, B, A on the title screen (or open the game
with `?dev=1`) to unlock **Dev mode** on the title and in the pause menu:

- **Level select**: any built-in or custom level, any character, starting power, 99 lives.
- **Assists** (active only while dev mode is on): scroll back, infinite lives, infinite time, no
  damage, keep big when losing fire, coyote time, half-speed slow motion.
- **Dev mode off** hides it again.

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
node tools/smoke/screenshot.mjs out/   # headless Playwright smoke run with screenshots
```

Levels are text files (`src/content/levels/world1/*.map`); see `src/game/level/textmap.ts`
for the format. World 1-1 is generated from coordinates by `tools/levelgen/1-1.mjs` and the
resulting `.map` is committed.

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
