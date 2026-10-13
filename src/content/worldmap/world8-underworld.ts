import type { MapProp, WorldExit, WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly } from './build';
import { VALLEY_LIVE, VALLEY_PAGE_ID } from './valley-of-bowser';
import { WORLD_8 } from './world8';

/*
 * World 8 in campaign play (0.4.54, TD58's approved design): THE UNDERWORLD (owner, Oct 13: the
 * world is purely the tank game's, no longer "Bowser's Underworld"), drawn from above in the 3/4
 * view of World 1's Mushroom Kingdom (world1-kingdom.ts), from the `underworld-above` sheet
 * (sprites/underworld-above.ts). Classic play keeps WORLD_8 (world8.ts) and its title.
 *
 * Bowser's Castle is not on this page: 8-4, the plutonium fortress (an eighth fake Bowser), is the
 * last node. Its road on leaves the page east:
 *   - once the VALLEY OF BOWSER is live (valley-of-bowser.ts VALLEY_LIVE: its castle's level
 *     exists), on row 10 to the Valley's start, as every world's exit does;
 *   - until then (0.4.54), as today: on to Lost World 1, up the stairs through the cliff and off the
 *     right edge on row 5 (Lost World 1's start row).
 * Either way it is WORLD_8's exit with Sophia's gate (the rift's): the same `from`, `side` and
 * `gate`; only where it leads, and its tiles, follow the switch.
 *
 * Everything else the save files key on is WORLD_8's own: the page id 'smb-8', its six node ids,
 * kinds and fields in the same order, its five roads (World 8 keeps its order: start, 8-1, 8-2,
 * 8-3, 8-4, the bonus off 8-2), the start on the left edge on row 10 (World 7's exit row).
 *
 * Where the tank game's areas sit:
 *   start   area 1's red-rock cavern by the underground lake (the miner beside it, at 1,11)
 *   8-1     area 1's forest on the moss ledges: gnarled trees, the pipe tunnel, the moss shaft and
 *           the hole Jason drops into (Sophia's garage is reached from 8-1: her hint west of the
 *           node, at 1,6, over the hole; the hatch is a level detail, not on the map)
 *   8-2     area 2's techno castle on its teal decks, down the cliff
 *   bonus-8 a dungeon hatch in the techno castle's yard (the bonus spot)
 *   8-3     area 6's frozen ruins along the north ledge, up the steps
 *   8-4     area 8's plutonium fortress, the deepest and darkest ground; the exit east
 *
 * Tiles (above: 'underworld', underworldGround):
 *   .  under the header: the surface's night sky over its ridge
 *   #  cave dirt    ,  moss ledge    o  ice    :  techno deck    *  plutonium floor
 *   ^  red-rock cliff    G  steps    ~  the underground lake
 *   T  gnarled tree    H  moss shrub    R  boulder    A  ice spire    S  ice block    Z  stone ruin
 *   X  techno pylon    P  deck vent    Y  plutonium growth    J  plutonium eggs
 * In BASE a '.' below the header is a tile of its zone's ground (filled in by `sketch`).
 */
const BASE: readonly string[] = [
  '................',
  '................',
  'T,T,Zoo.ooo.A...', // the frozen ruins run on east along the north ledge
  ',T,H,oo.oSoS....', // the frozen ruins (8-3) on the north ledge
  ',,,,ToA.ooo....A',
  ',,,T,ooo.oA.Z...', // (until the Valley is live) the road on to Lost World 1 leaves east on row 5
  'T,,,,oS.o.oo...S', // 8-1 on the moss ledges, Sophia's hint west of it
  ',,,H,^^G^G^^^G^^', // the cliff down from the ruins to the decks and the fortress ground; its steps
  ',,,,,::.P.:*J***', // the hole Jason drops into, west of 8-1's road
  ',T,,,:::X.::**YJ',
  '#....::P:.:*****', // the start; the techno castle (8-2); the fortress (8-4), the exit east
  '##R..........*J*',
  '#######::::***Y*',
  '~~~~~~#::::***Y*', // the underground lake; the dungeon hatch (bonus-8)
  '~~~~~~#::::*****',
];

/** The base with each '.' below the header filled with its zone's ground. */
function sketch(rows: readonly string[]): string[] {
  const zone = (x: number, y: number): string => {
    if (y >= 7 && x >= 11) return '*';
    if (y >= 8 && x >= 5) return ':';
    if (y <= 6 && x >= 5) return 'o';
    if (y >= 10) return '#';
    return ',';
  };
  return rows.map((row, y) => [...row].map((ch, x) => (y >= 2 && ch === '.' ? zone(x, y) : ch)).join(''));
}

export const SKETCH_8_UNDERWORLD: readonly string[] = sketch(BASE);

/** The tank game's landmarks: the pipe tunnel, the moss shaft, the hole by 8-1, the ruins, the decks' tower. */
export const PROPS_8_UNDERWORLD: readonly MapProp[] = [
  { frame: 'pipe-tunnel', x: 0, y: 56 }, // cols 0-2 rows 3.5-5.5: the tree-lined pipe tunnel
  { frame: 'moss-shaft', x: 48, y: 24 }, // cols 3-4 rows 2-3: a moss shaft down from the ledges
  { frame: 'rad-pit', x: 0, y: 120 }, // cols 0-1 rows 8-9: the hole Jason drops into (8-1's)
  { frame: 'ice-arch', x: 96, y: 32 }, // cols 6-7 rows 2-3: the frozen ruins
  { frame: 'ice-arch', x: 208, y: 40 }, // cols 13-14 rows 2.5-4.5: more of them east
  { frame: 'techno-tower', x: 144, y: 176 }, // cols 9-10 rows 11-13: the techno castle
  { frame: 'hatch', x: 96, y: 200 }, // a dungeon hatch in the techno yard (scenery)
];

/** Each node's tile on this page, by id (WORLD_8's nodes keep their order and every other field). */
const AT: Readonly<Record<string, [number, number]>> = {
  start: [0, 10], // area 1's cavern by the lake (World 8's local, the miner, stands at 1,11)
  '8-1': [2, 6], // the moss ledges; Sophia's silhouette or trophy stands on 1,6, over the hole
  '8-2': [6, 11], // the techno castle's decks
  '8-3': [7, 4], // the frozen ruins
  '8-4': [11, 10], // the plutonium fortress
  'bonus-8': [8, 13], // the dungeon hatch
};

/** Each road's tiles, by road id (WORLD_8's five, in its unchanged order). */
const ROADS: Readonly<Record<string, [number, number][]>> = {
  'start>8-1': poly([0, 10], [2, 10], [2, 6]),
  '8-1>8-2': poly([2, 6], [4, 6], [4, 11], [6, 11]),
  '8-2>8-3': poly([6, 11], [6, 8], [7, 8], [7, 4]),
  '8-3>8-4': poly([7, 4], [9, 4], [9, 10], [11, 10]),
  '8-2>bonus-8': poly([6, 11], [8, 11], [8, 13]),
};

const at = (id: string): [number, number] => {
  const p = AT[id];
  if (!p) throw new Error(`world8-underworld: no tile for node ${id}`);
  return p;
};

/**
 * World 8's road on, from the fortress: east on row 10 to the VALLEY OF BOWSER (`valley`), else on
 * to Lost World 1 as today, up the east steps (13,7) and off the edge on row 5.
 */
export function underworldExit(e: WorldExit, valley: boolean): WorldExit {
  if (valley) return { ...e, to: VALLEY_PAGE_ID, points: poly(at(e.from), [15, 10]) };
  return { ...e, points: poly(at(e.from), [13, 10], [13, 5], [15, 5]) };
}

/** World 8 from above, its road on leading to the Valley (`valley`) or on to Lost World 1. */
export function underworldPage(valley: boolean): WorldMapPage {
  return {
    ...WORLD_8,
    title: 'THE UNDERWORLD',
    // Drawn from above from the `underworld-above` sheet; the theme stays 'blaster' (its actors' looks).
    above: 'underworld',
    tiles: autoShore(SKETCH_8_UNDERWORLD),
    nodes: WORLD_8.nodes.map((n) => {
      const [x, y] = at(n.id);
      return { ...n, x, y };
    }),
    paths: WORLD_8.paths.map((p) => {
      const points = ROADS[`${p.from}>${p.to}`];
      if (!points) throw new Error(`world8-underworld: no road ${p.from}>${p.to}`);
      return { ...p, points };
    }),
    exits: WORLD_8.exits.map((e) => underworldExit(e, valley)),
    // Mutants hopping on the moss ledges, the ruins and the fortress ground, bubbles rising in the
    // lake, a pennant on the fortress.
    actors: [
      actor('mutant-hopper', 16, 48, { range: 16, speed: 0.25, period: 56 }),
      actor('mutant-hopper', 176, 80, { range: 16, speed: 0.3, period: 50 }),
      actor('mutant-hopper', 208, 200, { range: 16, speed: 0.2, period: 64 }),
      actor('bubble', 32, 216, { height: 14, period: 90 }),
      actor('bubble', 72, 224, { height: 12, period: 110, phase: 40 }),
      actor('flag', 172, 108, { phase: 0 }),
    ],
    props: [...PROPS_8_UNDERWORLD],
  };
}

/** World 8 as campaign play draws it: THE UNDERWORLD, its road on following VALLEY_LIVE. */
export const WORLD_8_UNDERWORLD: WorldMapPage = underworldPage(VALLEY_LIVE);
