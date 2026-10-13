import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { MapNode, MapProp, WorldExit, WorldMapPage } from '@game/map/types';
import { kingdomGround, ROAD_FRAMES } from '@content/sprites/kingdom';

/*
 * Drawing a top-down page (theme 'kingdom', World 1 in campaign play since 0.4.48) from the
 * `kingdom` sheet: its ground grid, its flat landmarks, its roads as sandy paths and its standing
 * scenery. Everything a page needs is worked out once (per page, per open-roads view) and kept;
 * nothing here allocates per frame (render.ts's rule).
 *
 * Roads are drawn as they open: an unopened road is just grass. A road tile joins only the tiles
 * before and after it on the same road (and the node tiles every road through them), so two roads
 * side by side never merge. A road being drawn in keeps the dot reveal's timing (REVEAL_DOT_FRAMES,
 * two dots a tile): tile k shows with its road's dot 2k, and the tip has its open end.
 */

/** The river's two frames swap every this many frames. */
export const KINGDOM_WATER_TICKS = 32;

/** Whether a page is drawn top-down from the `kingdom` sheet. */
export const isKingdomPage = (page: WorldMapPage): boolean => page.theme === 'kingdom';

/** The road join bits (ROAD_FRAMES' mask). */
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

/** The road tiles of the open roads `runs` on `page` (built when the page's open roads change). */
export function kingdomRoadCells(page: WorldMapPage, runs: readonly RoadRun[]): RoadCell[] {
  const wet = kingdomGround(page.tiles).wet;
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
 * Draws the open roads' tiles at page offset `ox`: every road in full, but those in `shown`
 * (reveal ids → dots drawn so far) up to their reveal.
 */
export function drawKingdomRoads(
  r: Renderer,
  assets: AssetRegistry,
  cells: readonly RoadCell[],
  ox: number,
  shown: ReadonlyMap<string, number> | null,
): void {
  const sheet = assets.sheet('kingdom');
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
      if (p.i + 1 >= p.tiles || tileShown(p.i + 1, p.dots, s)) mask |= p.fwd;
    }
    if (any) r.sprite(sheet, ROAD_FRAMES[mask] as string, ox + cell.x * 16, cell.y * 16);
  }
}

/** A page's standing things, back to front: its scenery and standing props by their feet. */
const standing = new WeakMap<WorldMapPage, readonly { frame: string; x: number; y: number }[]>();

function standingOf(
  page: WorldMapPage,
  assets: AssetRegistry,
): readonly { frame: string; x: number; y: number }[] {
  let list = standing.get(page);
  if (list) return list;
  const sheet = assets.sheet('kingdom');
  const props = (page.props ?? []).filter((p) => !p.flat);
  const feet = (p: MapProp): number => p.y + (sheet.frames.get(p.frame)?.h ?? 16);
  list = [
    ...kingdomGround(page.tiles).scenery.map((s) => ({ frame: s.frame, x: s.x, y: s.y, feet: s.feet })),
    ...props.map((p) => ({ frame: p.frame, x: p.x, y: p.y, feet: feet(p) })),
  ]
    .sort((a, b) => a.feet - b.feet)
    .map(({ frame, x, y }) => ({ frame, x, y }));
  standing.set(page, list);
  return list;
}

/** The ground and the flat landmarks (the plaza, the castle's walk) at page offset `ox`. */
export function drawKingdomGround(
  r: Renderer,
  assets: AssetRegistry,
  page: WorldMapPage,
  ox: number,
  t: number,
): void {
  const sheet = assets.sheet('kingdom');
  const g = kingdomGround(page.tiles);
  const frames = g.frames[Math.floor(Math.max(0, t) / KINGDOM_WATER_TICKS) & 1] as readonly string[];
  for (let i = 0; i < frames.length; i++)
    r.sprite(sheet, frames[i] as string, ox + (i & 15) * 16, (i >> 4) * 16);
  const props = page.props ?? [];
  for (let i = 0; i < props.length; i++) {
    const p = props[i] as MapProp;
    if (p.flat) r.sprite(sheet, p.frame, ox + p.x, p.y);
  }
}

/** The standing scenery and landmarks, back to front, at page offset `ox`. */
export function drawKingdomScenery(r: Renderer, assets: AssetRegistry, page: WorldMapPage, ox: number): void {
  const sheet = assets.sheet('kingdom');
  const list = standingOf(page, assets);
  for (let i = 0; i < list.length; i++) {
    const s = list[i] as { frame: string; x: number; y: number };
    r.sprite(sheet, s.frame, ox + s.x, s.y);
  }
}

/**
 * A node's marker on a top-down page (a `kingdom` frame), like the spaces of a party board: an
 * open level a red space, a cleared one blue with a white star, a level with a secret exit pink with
 * a keyhole (pale once cleared), the warp spot a pipe mouth (lidded while locked), the castle
 * Bowser's fort (his flag down and a pink one up once cleared). Null for a kind it has no marker
 * for (the map's own then).
 */
export function kingdomNodeFrame(
  kind: MapNode['kind'],
  s: { cleared: boolean; warpOpen: boolean; secret: boolean },
): string | null {
  if (kind === 'warp') return s.warpOpen ? 'warp' : 'warp-locked';
  if (kind === 'castle') return s.cleared ? 'fort-cleared' : 'fort';
  if (kind !== 'level' && kind !== 'start') return null;
  if (s.secret) return s.cleared ? 'node-secret-cleared' : 'node-secret';
  return s.cleared ? 'node-cleared' : 'node-open';
}
