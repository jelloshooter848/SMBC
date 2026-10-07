import type { MapNode, MapPath, WorldMapPage } from '@game/map/types';
import { actor, poly } from './build';

/*
 * The MINI GAME ARENA (page 'arena', group 'arena'), reached from the Warp Zone hub's first pad:
 * a stadium where every game the file has found can be played for fun (src/game/arena). The hero
 * arrives on the middle of the field, on the Return pad (a start node carrying `to`, like the
 * hub's centre: arriving never warps, JUMP warps back to the hub's Arena pad).
 *
 * The pads are not written here: the game list comes from the registries (src/game/arena:
 * MINIGAMES, the heroes with training rooms, Larry's airship, the bonus games, 1-0), which
 * installs them with `installArenaGames`, so the arena grows by itself as games are added. Pad
 * slots, in fill order (ARENA_SLOTS):
 *
 *   - the running track around the field: 20 slots two tiles apart, from the bottom middle
 *     (8,12) round to the right, up, along the top and down the left side; each joined to the
 *     next, the ring closing once all 20 are used. The Return pad's roads go down to (8,12) and
 *     up to (8,4) (slot 10);
 *   - then 10 more on the field, off the Return pad's left and right roads (room to grow).
 *
 * A pad is a node `{ id: 'pad-<game>', kind: 'game', game: '<game>' }`. Games beyond the 30 slots
 * would be left out (arena.test.ts checks that every registered game has its slot).
 */
export const SKETCH_ARENA = [
  '................',
  '................',
  'VVVVVVVVVVVVVVVV',
  'WWWWWWWWWWWWWWWW',
  'WW:::::::::::::W',
  'WW:,#######*#,:W',
  'WW:#,#####,###:W',
  'WW:####,######:W',
  'WW:#*###,###*#:W',
  'WW:######,####:W',
  'WW:###,#####,#:W',
  'WW:,#*#######,:W',
  'WW:::::::::::::W',
  'WWWWWWWWWWWWWWWW',
  'VVVVVVVVVVVVVVVV',
];

type Pt = [number, number];

/** The Return pad (the page's start) in the middle of the field. */
export const ARENA_CENTRE: Pt = [8, 8];

/** The hub's pad that leads here, and that the Return pad leads back to (portals pair 1:1). */
export const HUB_ARENA_PAD = 'warp-arena';

/** The running track's slots, in fill order: bottom middle, right, up, along the top, down the left. */
export const ARENA_RING: readonly Pt[] = [
  [8, 12],
  [10, 12],
  [12, 12],
  [14, 12],
  [14, 10],
  [14, 8],
  [14, 6],
  [14, 4],
  [12, 4],
  [10, 4],
  [8, 4],
  [6, 4],
  [4, 4],
  [2, 4],
  [2, 6],
  [2, 8],
  [2, 10],
  [2, 12],
  [4, 12],
  [6, 12],
];

/** The ring slot the Return pad's upward road leads to (the top middle). */
const RING_TOP = 10;

/**
 * The field's slots after the ring, left and right in turn, each with the slot (index into
 * ARENA_SLOTS, or -1 for the Return pad) its road comes from.
 */
const FIELD: readonly { at: Pt; from: number }[] = [
  { at: [4, 8], from: -1 },
  { at: [12, 8], from: -1 },
  { at: [4, 6], from: 20 },
  { at: [12, 6], from: 21 },
  { at: [4, 10], from: 20 },
  { at: [12, 10], from: 21 },
  { at: [6, 6], from: 22 },
  { at: [10, 6], from: 23 },
  { at: [6, 10], from: 24 },
  { at: [10, 10], from: 25 },
];

/** Every pad slot, in fill order (the ring, then the field). */
export const ARENA_SLOTS: readonly Pt[] = [...ARENA_RING, ...FIELD.map((f) => f.at)];

/** A game's pad node id. */
export const arenaPadId = (game: string): string => `pad-${game}`;

/** The Return pad: the page's arrival node, and the warp back to the hub's Arena pad. */
const RETURN_NODE: MapNode = {
  id: 'start',
  kind: 'start',
  x: ARENA_CENTRE[0],
  y: ARENA_CENTRE[1],
  to: 'hub',
  toNode: HUB_ARENA_PAD,
  label: 'RETURN TO WARP ZONE',
};

/** The arena's nodes and roads for `games` (ArenaGame ids, in order; beyond the slots: left out). */
export function arenaLayout(games: readonly string[]): { nodes: MapNode[]; paths: MapPath[] } {
  const used = games.slice(0, ARENA_SLOTS.length);
  const nodes: MapNode[] = [
    { ...RETURN_NODE },
    ...used.map((game, i): MapNode => {
      const [x, y] = ARENA_SLOTS[i] as Pt;
      return { id: arenaPadId(game), kind: 'game', game, x, y };
    }),
  ];
  const id = (slot: number) => (slot < 0 ? 'start' : arenaPadId(used[slot] as string));
  const at = (slot: number): Pt => (slot < 0 ? ARENA_CENTRE : (ARENA_SLOTS[slot] as Pt));
  const road = (from: number, to: number): MapPath => ({
    from: id(from),
    to: id(to),
    points: poly(at(from), at(to)),
  });
  const n = used.length;
  const ring = Math.min(n, ARENA_RING.length);
  const paths: MapPath[] = [];
  if (ring > 0) paths.push(road(-1, 0));
  for (let i = 0; i + 1 < ring; i++) paths.push(road(i, i + 1));
  if (ring > RING_TOP) paths.push(road(-1, RING_TOP));
  if (ring === ARENA_RING.length) paths.push(road(ARENA_RING.length - 1, 0));
  FIELD.forEach((f, k) => {
    const slot = ARENA_RING.length + k;
    if (slot < n) paths.push(road(f.from, slot));
  });
  return { nodes, paths };
}

/** The arena page for `games` (see arenaLayout). */
export function arenaPage(games: readonly string[]): WorldMapPage {
  return {
    id: 'arena',
    group: 'arena',
    label: 'ARENA',
    title: 'MINI GAME ARENA',
    // Placeholder look until the arena's own theme and music land: a field and its stands.
    theme: 'grass',
    music: 'map',
    tiles: SKETCH_ARENA.slice(),
    ...arenaLayout(games),
    exits: [],
    actors: [
      actor('flag', 8, 32, { phase: 0 }),
      actor('flag', 56, 32, { phase: 7 }),
      actor('flag', 104, 32, { phase: 3 }),
      actor('flag', 136, 32, { phase: 11 }),
      actor('flag', 184, 32, { phase: 5 }),
      actor('flag', 232, 32, { phase: 9 }),
      actor('flag', 0, 112, { phase: 2 }),
      actor('flag', 240, 112, { phase: 6 }),
    ],
  };
}

/** The registered arena page: only the Return pad until the arena's games are installed. */
export const ARENA_PAGE: WorldMapPage = arenaPage([]);

/**
 * Lays the registered arena page out for `games` (src/game/arena installs the registries' games
 * when it loads). The page object stays the same, so the registry and caches keep pointing at it.
 */
export function installArenaGames(games: readonly string[]): void {
  const { nodes, paths } = arenaLayout(games);
  ARENA_PAGE.nodes = nodes;
  ARENA_PAGE.paths = paths;
}
