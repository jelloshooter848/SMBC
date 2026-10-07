import { Rng } from '@engine/rng';
import type { WorldMapPage } from './types';

/*
 * The wandering Hammer Bro of World 4's bonus spot (SMB3 style; docs/WORLD_MAP.md "The bonus spot
 * and its Hammer Bro"). Once the bonus has been used he walks the road to the bonus node, tile by
 * tile, never onto the level node the road starts from; touching him (or him walking into the
 * hero) starts the Hammer Bro battle (scenes/hammer-battle.ts). Pure: the map scene steps and
 * draws him.
 */

/** Walking speed between two road tiles (px per frame). */
export const GUARD_SPEED = 1;
/** He stands on a tile for this many frames (plus up to as many again) before the next step. */
export const GUARD_STEP_FRAMES = 50;
/** How close (px, on both axes) the hero's tile position must come to touch him. */
export const GUARD_REACH = 12;

/**
 * The road a guard walks: the tiles of the first road leading into node `nodeId`, from the tile
 * after its far end (a level node, which the guard never stands on) to the node itself.
 */
export function guardRoad(page: WorldMapPage, nodeId: string): [number, number][] {
  const road = page.paths.find((p) => p.to === nodeId);
  if (road) return road.points.slice(1).map(([x, y]): [number, number] => [x, y]);
  const n = page.nodes.find((x) => x.id === nodeId);
  return n ? [[n.x, n.y]] : [];
}

export class MapGuard {
  /** Top-left of the 16×16 tile he stands on (px), like the hero's map position. */
  x: number;
  y: number;
  /** Index on the road of the tile he stands on or walks to. */
  private at: number;
  private wait: number;
  private readonly rng: Rng;
  facingLeft = false;

  private constructor(
    private readonly road: readonly [number, number][],
    start: number,
    seed: number,
  ) {
    this.at = start;
    const [x, y] = road[start] as [number, number];
    this.x = x * 16;
    this.y = y * 16;
    this.rng = new Rng(seed);
    this.wait = GUARD_STEP_FRAMES;
  }

  /** A guard on the road tile farthest from the hero's tile `hero`. */
  static spawn(road: readonly [number, number][], hero: [number, number], seed: number): MapGuard {
    let best = 0;
    let bestD = -1;
    road.forEach(([x, y], i) => {
      const d = Math.abs(x - hero[0]) + Math.abs(y - hero[1]);
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    });
    return new MapGuard(road, best, seed);
  }

  /** The tile he stands on (the one he walks to while walking). */
  get tile(): [number, number] {
    return this.road[this.at] as [number, number];
  }

  get walking(): boolean {
    const [tx, ty] = this.tile;
    return this.x !== tx * 16 || this.y !== ty * 16;
  }

  /** One frame: walk to the next tile, or stand and then pick a neighbour along the road. */
  update(): void {
    const [tx, ty] = this.tile;
    const dx = tx * 16 - this.x;
    const dy = ty * 16 - this.y;
    if (dx || dy) {
      if (dx) this.facingLeft = dx < 0;
      this.x += Math.sign(dx) * Math.min(GUARD_SPEED, Math.abs(dx));
      this.y += Math.sign(dy) * Math.min(GUARD_SPEED, Math.abs(dy));
      return;
    }
    if (--this.wait > 0) return;
    this.wait = GUARD_STEP_FRAMES + this.rng.int(GUARD_STEP_FRAMES);
    const last = this.road.length - 1;
    if (last <= 0) return;
    const dir = this.at === 0 ? 1 : this.at === last ? -1 : this.rng.chance(0.5) ? 1 : -1;
    this.at += dir;
  }

  /** The hero standing or walking at (hx, hy) (its tile position, px) touches him. */
  touches(hx: number, hy: number): boolean {
    return Math.abs(hx - this.x) <= GUARD_REACH && Math.abs(hy - this.y) <= GUARD_REACH;
  }
}
