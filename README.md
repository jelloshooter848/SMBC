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

Keyboard: arrows move, **Z** jump, **X** run / attack, **C** special, **Enter** start/pause.
Gamepads use the standard mapping. Press **F1** for the debug overlay and **F2** for a free
camera (arrows scroll) when checking level layouts.

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
music you may load them locally: see `user-packs/README.md`. Packs are never committed.

## License

MIT for code and the original assets in this repository.
