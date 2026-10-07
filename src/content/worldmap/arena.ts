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
 * slots, in fill order (SLOTS): three rows of pads three tiles apart, two tiles apart in a row, the
 * middle row out from the Return pad, then the far row, then the near row (see SLOTS). Each hero
 * stands on its pad (src/game/arena drawArenaPad), up to 32 px tall, so a road never reaches a
 * pad from above.
 *
 * A pad is a node `{ id: 'pad-<game>', kind: 'game', game: '<game>' }`. Games beyond the 22 slots
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

/**
 * A pad slot: where it stands, the slot its road comes from (an index into ARENA_SLOTS, or -1 for
 * the Return pad) and the corners that road turns at on the way (none: a straight road).
 */
interface Slot {
  at: Pt;
  from: number;
  via?: Pt[];
}

/**
 * The pad slots, in fill order: three rows three tiles apart (a 32 px hero standing on a pad
 * stays clear of the pads and roads of the row above), pads two tiles apart in each row. Every
 * road reaches a pad from the side or from below, never from above, where the hero stands.
 *
 *   - the middle row (9) out from the Return pad, left then right, to the touchlines;
 *   - the far row (6) out from (7,6), which the Return pad's road goes up to;
 *   - the near row (12), its pads at even columns: its road comes down the left touchline from
 *     (1,9) and turns in at (1,12), and the row closes back up to (15,9) once it is full.
 */
const SLOTS: readonly Slot[] = [
  { at: [5, 9], from: -1 },
  { at: [9, 9], from: -1 },
  { at: [3, 9], from: 0 },
  { at: [11, 9], from: 1 },
  { at: [1, 9], from: 2 },
  { at: [13, 9], from: 3 },
  { at: [15, 9], from: 5 },
  { at: [7, 6], from: -1 },
  { at: [5, 6], from: 7 },
  { at: [9, 6], from: 7 },
  { at: [3, 6], from: 8 },
  { at: [11, 6], from: 9 },
  { at: [1, 6], from: 10 },
  { at: [13, 6], from: 11 },
  { at: [15, 6], from: 13 },
  { at: [2, 12], from: 4, via: [[1, 12]] },
  { at: [4, 12], from: 15 },
  { at: [6, 12], from: 16 },
  { at: [8, 12], from: 17 },
  { at: [10, 12], from: 18 },
  { at: [12, 12], from: 19 },
  { at: [14, 12], from: 20 },
];

/** Once the near row is full, its last pad joins (15,9) round the right touchline. */
const CLOSE = { from: 6, to: SLOTS.length - 1, via: [[15, 12]] as Pt[] };

/** Every pad slot, in fill order. */
export const ARENA_SLOTS: readonly Pt[] = SLOTS.map((s) => s.at);

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
  const road = (from: number, to: number, via: Pt[] = []): MapPath => ({
    from: id(from),
    to: id(to),
    points: poly(at(from), ...via, at(to)),
  });
  const paths: MapPath[] = SLOTS.slice(0, used.length).map((s, i) => road(s.from, i, s.via));
  if (used.length > CLOSE.to) paths.push(road(CLOSE.from, CLOSE.to, CLOSE.via));
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
