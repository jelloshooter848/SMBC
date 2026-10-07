import type { MapNode, MapPath, WorldMapPage } from '@game/map/types';
import { actor, poly } from './build';

/*
 * The MINI GAME ARENA (page 'arena', group 'arena', 0.4.7), reached from the Warp Zone hub's first
 * pad: a stadium at night where every game the file has found can be played for fun
 * (src/game/arena). Bunting over the stands, two rows of cheering crowds with banners, the barrier
 * wall, and the chequered pitch below; the scoreboard and two light towers stand over the crowd.
 * The hero arrives in the middle of the pitch, on the Return pad (a start node carrying `to`, like
 * the hub's centre: arriving never warps, JUMP warps back to the hub's Arena pad).
 *
 * The pads are not written here: the game list comes from the registries (src/game/arena:
 * MINIGAMES, the heroes with training rooms, Larry's airship, the bonus games, 1-0), which
 * installs them with `installArenaGames`, so the arena grows by itself as games are added. Pad
 * slots, in fill order (ARENA_SLOTS):
 *
 *   - a ring round the pitch: 20 slots two tiles apart (rows 6 and 12, columns 1 and 15), from
 *     (7,12) on the near side round to the right, up, along the far side and down the left; each
 *     joined to the next, the ring closing once all 20 are used. The Return pad's roads go down
 *     to (7,12) and up to (7,6) (slot 11);
 *   - then 5 more across the middle of the pitch, off the Return pad's left and right roads.
 *
 * A pad is a node `{ id: 'pad-<game>', kind: 'game', game: '<game>' }`. Games beyond the 25 slots
 * would be left out (arena.test.ts checks that every registered game has its slot).
 */
export const SKETCH_ARENA = [
  '................',
  '................',
  'wwwwwwwwwwwwwwww',
  'MNMNMEMNMNEMNMNM',
  'NMNMNMNMNMNMNMNM',
  'BBBBBBBBBBBBBBBB',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'MNMNMNMNMNMNMNMN',
];

type Pt = [number, number];

/** The Return pad (the page's start) in the middle of the pitch. */
export const ARENA_CENTRE: Pt = [7, 9];

/** The hub's pad that leads here, and that the Return pad leads back to (portals pair 1:1). */
export const HUB_ARENA_PAD = 'warp-arena';

/** The ring's slots, in fill order: near side from the middle, right, up, along the far side, down the left. */
export const ARENA_RING: readonly Pt[] = [
  [7, 12],
  [9, 12],
  [11, 12],
  [13, 12],
  [15, 12],
  [15, 10],
  [15, 8],
  [15, 6],
  [13, 6],
  [11, 6],
  [9, 6],
  [7, 6],
  [5, 6],
  [3, 6],
  [1, 6],
  [1, 8],
  [1, 10],
  [1, 12],
  [3, 12],
  [5, 12],
];

/** The ring slot the Return pad's upward road leads to (the far side's middle). */
const RING_TOP = 11;

/**
 * The pitch's slots after the ring, across its middle, each with the slot (index into
 * ARENA_SLOTS, or -1 for the Return pad) its road comes from.
 */
const FIELD: readonly { at: Pt; from: number }[] = [
  { at: [5, 9], from: -1 },
  { at: [9, 9], from: -1 },
  { at: [3, 9], from: 20 },
  { at: [11, 9], from: 21 },
  { at: [13, 9], from: 23 },
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
    theme: 'arena',
    music: 'arena',
    tiles: SKETCH_ARENA.slice(),
    ...arenaLayout(games),
    exits: [],
    actors: [
      actor('scoreboard', 104, 40, { phase: 0 }),
      actor('light-tower', 0, 64, { phase: 0 }),
      actor('light-tower', 240, 64, { phase: 100 }),
      // Fans' flags waving in the stands.
      actor('flag', 32, 56, { phase: 0 }),
      actor('flag', 64, 48, { phase: 7 }),
      actor('flag', 176, 48, { phase: 3 }),
      actor('flag', 208, 56, { phase: 11 }),
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
