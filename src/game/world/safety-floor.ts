import type { Collision } from '../level/tiles';
import { T } from '../level/tiles';
import { isWaterTheme, type LevelData } from '../level/schema';
import { TileMap } from './tilemap';

/**
 * The Safety floor dev assist (AssistOptions.safetyFloor): an invisible one-way floor over every
 * deadly fall, so a level can be bug-tested without dying in its pits.
 *
 * A pit column is one whose bottom row is not solid (a fall there leaves the level). Each run of
 * pit columns gets one floor row, at its rim: the walkable ground surface beside the gap (the top
 * of the solid stack standing on the bottom row of the column just past each end of the run),
 * the LOWER of the two, so a caught hero can always walk out on at least that side. A run with no
 * ground beside it, or wider than RIM_SEARCH columns (7-3's long bridge gaps over the void), sits
 * on the standard ground row instead (the top of row 13 on a one-screen map; the row above the
 * bottom row on any map). So does every run in a water level: a swimmer is never trapped below a
 * rim, and a floor across the top of a flooded shaft (2-2's walled channel at 157) would shut him
 * out of it.
 *
 * The floor in a column exists only while nothing solid lies at or below its row there (a bridge
 * under the rim keeps its own surface), and never in a column a live `pit` zone covers: a fall
 * that leads somewhere (a coin heaven, 7-3's campaign bridge into Bill's camp) still falls.
 * World also drops it under a hero riding a live `descent` lift (5-4's shaft into the dungeon).
 * Lava tiles (scenery otherwise: the hero falls through and dies off the bottom) are solid from
 * above at their surface too. Only the players see any of it; enemies still fall.
 */

/** How far (columns) a pit's rim is looked for: a wider run of pit columns uses the ground row. */
export const RIM_SEARCH = 16;

/** The standard ground row's top (row 13 on a 15-row map): a floor with no rim to sit at. */
export const groundRow = (height: number): number => Math.max(0, height - 2);

/**
 * The walkable ground surface of column `tx`: the top row of the solid stack standing on the
 * map's bottom row, or null when the bottom row there is open (a pit column).
 */
export function groundSurface(map: TileMap, tx: number): number | null {
  let ty = map.height - 1;
  if (!map.isSolid(tx, ty)) return null;
  while (ty > 0 && map.isSolid(tx, ty - 1)) ty--;
  return ty;
}

/**
 * The rim row of every column (-1: not a pit column). Each run of pit columns shares the lower of
 * the surfaces beside it, or the ground row (RIM_SEARCH, groundRow; `water`: always).
 */
export function rimRows(map: TileMap, water = false): Int16Array {
  const rows = new Int16Array(map.width).fill(-1);
  const fallback = groundRow(map.height);
  let tx = 0;
  while (tx < map.width) {
    if (groundSurface(map, tx) !== null) {
      tx++;
      continue;
    }
    const a = tx;
    while (tx < map.width && groundSurface(map, tx) === null) tx++;
    const b = tx - 1;
    const sides: number[] = [];
    if (!water && b - a + 1 <= RIM_SEARCH) {
      if (a > 0) sides.push(groundSurface(map, a - 1) as number);
      if (b < map.width - 1) sides.push(groundSurface(map, b + 1) as number);
    }
    const row = sides.length ? Math.max(...sides) : fallback;
    rows.fill(row, a, b + 1);
  }
  return rows;
}

/**
 * One World's safety floor: the rims are worked out on first use from the level as it loaded
 * (so a broken brick never moves them), then read every frame.
 */
export class SafetyFloor {
  private rims: Int16Array | null = null;
  /** Columns a live `pit` zone covers: its fall is a transfer, never caught. */
  private readonly transfer: Uint8Array;

  constructor(
    private readonly map: TileMap,
    private readonly level: LevelData,
  ) {
    this.transfer = new Uint8Array(map.width);
    for (const z of level.zones) {
      if (z.kind !== 'pit' || z.campaign) continue;
      const end = z.w === undefined ? map.width : Math.min(map.width, z.x + z.w);
      this.transfer.fill(1, Math.max(0, z.x), Math.max(0, end));
    }
  }

  /** The floor row of column `tx` (its top is the surface), or -1 when there is none right now. */
  rowAt(tx: number): number {
    if (tx < 0 || tx >= this.map.width || this.transfer[tx]) return -1;
    const row = (this.rims ??= rimRows(new TileMap(this.level), isWaterTheme(this.level.theme)))[
      tx
    ] as number;
    if (row < 0) return -1;
    // Something solid at or below the rim (a bridge) keeps the column's own surface.
    for (let ty = row; ty < this.map.height; ty++) if (this.map.isSolid(tx, ty)) return -1;
    return row;
  }

  /** Whether cell (tx, ty) holds floor: the rim of a pit column, or a lava tile. */
  at(tx: number, ty: number): boolean {
    if (tx < 0 || tx >= this.map.width || this.transfer[tx]) return false;
    if (this.map.get(tx, ty) === T.LAVA) return true;
    return ty === this.rowAt(tx);
  }

  /**
   * The map as a player sees it with the floor on: every floor cell is one-way ('top': solid
   * from above only, never from below or the sides); everything else is the map itself (the
   * view shares its tiles, so a broken brick is broken in both).
   */
  view(): TileMap {
    const map = this.map;
    const view = Object.create(map) as TileMap;
    view.collisionAt = (tx: number, ty: number): Collision => {
      const c = map.collisionAt(tx, ty);
      return c === 'none' && this.at(tx, ty) ? 'top' : c;
    };
    return view;
  }

  /**
   * Where a hero in column `tx` who fell past the floor anyway (riding a sinking lift through it,
   * or the assist switched on mid-fall) is put back: the nearest column with a floor (searching
   * outward) and its row, or null when there is none.
   */
  nearest(tx: number): { tx: number; row: number } | null {
    for (let d = 0; d < this.map.width; d++) {
      for (const c of d ? [tx - d, tx + d] : [tx]) {
        const row = this.rowAt(c);
        if (row >= 0) return { tx: c, row };
      }
    }
    return null;
  }
}
