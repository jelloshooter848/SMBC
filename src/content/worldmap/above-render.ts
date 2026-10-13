import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { AboveLookId, MapNode, MapProp, WorldExit, WorldMapPage } from '@game/map/types';
import { drawnFromAbove } from '@game/map/rules';
import type { AboveGround } from '@content/sprites/above-kit';
import { kingdomGround, ROAD_FRAMES } from '@content/sprites/kingdom';
import { HYRULE_ROAD_FRAMES, hyruleGround, hyruleNodeFrame } from '@content/sprites/hyrule-above';
import { MEGACITY_ROAD_FRAMES, megacityGround, megacityNodeFrame } from '@content/sprites/megacity-above';

/*
 * The map kit for pages drawn from above (campaign play): World 1 from the `kingdom` sheet since
 * 0.4.48, Worlds 2 and 3 from `hyrule-above` and `megacity-above` since 0.4.50. A page's look
 * (AboveLook) names its sheet, its ground (tiles → ground frames, water, standing scenery), its 16
 * road joins and its node markers; everything else is shared: the ground and flat landmarks, the
 * roads drawn in as they open, the standing scenery and landmarks by their feet. Everything a page
 * needs is worked out once (per page, per open-roads view) and kept; nothing here allocates per
 * frame (render.ts's rule). A look's sheet is painted the first time its page shows (the asset
 * registry reads its frames on the first draw from it), never when the game loads.
 *
 * Roads are drawn as they open: an unopened road is just ground. A road tile joins only the tiles
 * before and after it on the same road (and the node tiles every road through them), so two roads
 * side by side never merge. A road being drawn in keeps the dot reveal's timing (REVEAL_DOT_FRAMES,
 * two dots a tile): tile k shows (its far end rounded off) with its road's dot 2k, and reaches on
 * to the next tile with the dot between them.
 */

/** The water's two frames swap every this many frames. */
export const ABOVE_WATER_TICKS = 32;

/** What a node marker shows: cleared (a bonus spot: used), a warp open, a secret exit. */
export interface AboveNodeState {
  cleared: boolean;
  warpOpen: boolean;
  secret: boolean;
}

/** How a page drawn from above looks: its sheet and how its ground, roads and markers come from it. */
export interface AboveLook {
  sheet: string;
  /** The page's ground, worked out once per page (cached by its tiles). */
  ground(page: WorldMapPage): AboveGround;
  /** The 16 road joins by mask (1 n, 2 e, 4 s, 8 w). */
  roads: readonly string[];
  /** A node's marker frame, or null for a kind it has none for (the map's own then). */
  node(kind: MapNode['kind'], s: AboveNodeState): string | null;
}

/**
 * World 1's node markers (a `kingdom` frame), like the spaces of a party board: an open level a red
 * space, a cleared one blue with a white star, a level with a secret exit pink with a keyhole (pale
 * once cleared), the warp spot a pipe mouth (lidded while locked), the castle Bowser's fort (his flag
 * down and a pink one up once cleared). Null for a kind it has no marker for (the map's own then).
 */
export function kingdomNodeFrame(kind: MapNode['kind'], s: AboveNodeState): string | null {
  if (kind === 'warp') return s.warpOpen ? 'warp' : 'warp-locked';
  if (kind === 'castle') return s.cleared ? 'fort-cleared' : 'fort';
  if (kind !== 'level' && kind !== 'start') return null;
  if (s.secret) return s.cleared ? 'node-secret-cleared' : 'node-secret';
  return s.cleared ? 'node-cleared' : 'node-open';
}

/** World 1, the Mushroom Kingdom (sprites/kingdom.ts). */
export const KINGDOM_LOOK: AboveLook = {
  sheet: 'kingdom',
  ground: (page) => kingdomGround(page.tiles),
  roads: ROAD_FRAMES,
  node: kingdomNodeFrame,
};

/** The looks of pages with an `above` field, by it. */
const LOOKS: Readonly<Record<AboveLookId, AboveLook>> = {
  // World 2, Hyrule (sprites/hyrule-above.ts): sandy paths; board spaces in a stone collar, the
  // Top Secret Area's cave mouth (its sparkle gone once Kakariko is found), 2-4's palace.
  hyrule: {
    sheet: 'hyrule-above',
    ground: (page) => hyruleGround(page.tiles),
    roads: HYRULE_ROAD_FRAMES,
    node: hyruleNodeFrame,
  },
  // World 3, Mega City (sprites/megacity-above.ts): white steel walkways; board spaces in a steel
  // collar, the bonus spot's hatch (shut once used), Wily's gate.
  megacity: {
    sheet: 'megacity-above',
    ground: (page) => megacityGround(page.tiles, page.zones ?? []),
    roads: MEGACITY_ROAD_FRAMES,
    node: megacityNodeFrame,
  },
};

/** Whether `page` is drawn from above (rules.drawnFromAbove: theme 'kingdom' or an `above` look). */
export const isAbovePage = drawnFromAbove;

/** The look `page` is drawn from above with, or null for a page drawn side-on. */
export function aboveLook(page: WorldMapPage): AboveLook | null {
  if (page.above) return LOOKS[page.above];
  return page.theme === 'kingdom' ? KINGDOM_LOOK : null;
}

/** The road join bits (a look's `roads` mask). */
const N = 1;
const E = 2;
const S = 4;
const W = 8;

function joinBit(from: readonly [number, number], to: readonly [number, number]): number {
  if (to[0] > from[0]) return E;
  if (to[0] < from[0]) return W;
  if (to[1] > from[1]) return S;
  return N;
}

/** One road's part in a tile: its index along the road and the joins back and forward. */
interface RoadPart {
  run: string;
  i: number;
  /** The road's tile count and dot count (pathDots' length / 2). */
  tiles: number;
  dots: number;
  back: number;
  fwd: number;
}

/** A tile with road on it once open: where it is and every open road through it. */
export interface RoadCell {
  x: number;
  y: number;
  parts: RoadPart[];
}

/** A road as the map engine draws it: its reveal id, tiles, dot count and, for an exit, its side. */
export interface RoadRun {
  id: string;
  points: readonly (readonly [number, number])[];
  dots: number;
  side?: WorldExit['side'];
}

const SIDE_BIT: Readonly<Record<WorldExit['side'], number>> = { right: E, left: W, top: N };

/**
 * The road tiles of the open roads `runs` on `page` (built when the page's open roads change); none
 * on water (a bridge carries the road over it).
 */
export function aboveRoadCells(page: WorldMapPage, runs: readonly RoadRun[]): RoadCell[] {
  const look = aboveLook(page) ?? KINGDOM_LOOK;
  const wet = look.ground(page).wet;
  const cells = new Map<number, RoadCell>();
  for (const run of runs) {
    const pts = run.points;
    pts.forEach((p, i) => {
      const [x, y] = p;
      if (x < 0 || x > 15 || y < 0 || y > 14 || wet[y * 16 + x]) return;
      const prev = pts[i - 1];
      const next = pts[i + 1];
      const back = prev ? joinBit(p, prev) : 0;
      const fwd = next ? joinBit(p, next) : run.side ? SIDE_BIT[run.side] : 0;
      const key = y * 16 + x;
      let cell = cells.get(key);
      if (!cell) cells.set(key, (cell = { x, y, parts: [] }));
      cell.parts.push({ run: run.id, i, tiles: pts.length, dots: run.dots, back, fwd });
    });
  }
  return [...cells.values()];
}

/**
 * Whether tile `i` of a road shows with `shown` of its `dots` dots drawn (pathDots: tile i's
 * centre is dot 2i - 1; the first tile shows with the first dot, the last when the road is done).
 */
export function tileShown(i: number, dots: number, shown: number): boolean {
  return shown >= Math.min(Math.max(1, 2 * i), dots);
}

/**
 * Whether tile `i` of a road of `tiles` tiles reaches on to the next with `shown` dots drawn: once
 * the dot half way to it is (dot 2i); the last tile (an exit's, off the page) when the road is done.
 */
export function tileReaches(i: number, tiles: number, dots: number, shown: number): boolean {
  return shown >= (i + 1 < tiles ? Math.min(2 * i + 1, dots) : dots);
}

/**
 * Draws the open roads' tiles in `look` at page offset `ox`: every road in full, but those in
 * `shown` (reveal ids → dots drawn so far) up to their reveal.
 */
export function drawAboveRoads(
  r: Renderer,
  assets: AssetRegistry,
  look: AboveLook,
  cells: readonly RoadCell[],
  ox: number,
  shown: ReadonlyMap<string, number> | null,
): void {
  const sheet = assets.sheet(look.sheet);
  for (let c = 0; c < cells.length; c++) {
    const cell = cells[c] as RoadCell;
    let mask = 0;
    let any = false;
    for (let k = 0; k < cell.parts.length; k++) {
      const p = cell.parts[k] as RoadPart;
      const s = shown?.get(p.run) ?? p.dots;
      if (!tileShown(p.i, p.dots, s)) continue;
      any = true;
      mask |= p.back;
      if (tileReaches(p.i, p.tiles, p.dots, s)) mask |= p.fwd;
    }
    if (any) r.sprite(sheet, look.roads[mask] as string, ox + cell.x * 16, cell.y * 16);
  }
}

/** A page's standing things, back to front: its scenery and standing props by their feet. */
const standing = new WeakMap<WorldMapPage, readonly { frame: string; x: number; y: number }[]>();

function standingOf(
  page: WorldMapPage,
  look: AboveLook,
  assets: AssetRegistry,
): readonly { frame: string; x: number; y: number }[] {
  let list = standing.get(page);
  if (list) return list;
  const sheet = assets.sheet(look.sheet);
  const props = (page.props ?? []).filter((p) => !p.flat);
  const feet = (p: MapProp): number => p.y + (sheet.frames.get(p.frame)?.h ?? 16);
  list = [
    ...look.ground(page).scenery.map((s) => ({ frame: s.frame, x: s.x, y: s.y, feet: s.feet })),
    ...props.map((p) => ({ frame: p.frame, x: p.x, y: p.y, feet: feet(p) })),
  ]
    .sort((a, b) => a.feet - b.feet)
    .map(({ frame, x, y }) => ({ frame, x, y }));
  standing.set(page, list);
  return list;
}

/** The ground and the flat landmarks (a plaza, a bridge) of `page` in `look` at page offset `ox`. */
export function drawAboveGround(
  r: Renderer,
  assets: AssetRegistry,
  look: AboveLook,
  page: WorldMapPage,
  ox: number,
  t: number,
): void {
  const sheet = assets.sheet(look.sheet);
  const g = look.ground(page);
  const frames = g.frames[Math.floor(Math.max(0, t) / ABOVE_WATER_TICKS) & 1] as readonly string[];
  for (let i = 0; i < frames.length; i++)
    r.sprite(sheet, frames[i] as string, ox + (i & 15) * 16, (i >> 4) * 16);
  const props = page.props ?? [];
  for (let i = 0; i < props.length; i++) {
    const p = props[i] as MapProp;
    if (p.flat) r.sprite(sheet, p.frame, ox + p.x, p.y);
  }
}

/** The standing scenery and landmarks of `page` in `look`, back to front, at page offset `ox`. */
export function drawAboveScenery(
  r: Renderer,
  assets: AssetRegistry,
  look: AboveLook,
  page: WorldMapPage,
  ox: number,
): void {
  const sheet = assets.sheet(look.sheet);
  const list = standingOf(page, look, assets);
  for (let i = 0; i < list.length; i++) {
    const s = list[i] as { frame: string; x: number; y: number };
    r.sprite(sheet, s.frame, ox + s.x, s.y);
  }
}
