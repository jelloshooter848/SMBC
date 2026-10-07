import type { Renderer } from '@engine/gfx/renderer';
import type { InputFrame } from '@engine/input/input-manager';
import { px, tileToSub } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { Player } from '../player';

/*
 * Castlevania stairs (docs/HEROES.md "Castlevania stairs"): a diagonal flight of steps, scenery the players
 * walk through until they get on. Map entity: `stairs x y len=N dir=ur|ul [sheet=crypt]`.
 *
 * - `x y`: the tile of the BOTTOM step; its foot stands on the floor of row y+1.
 * - `len`: tiles of rise (each tile is two 8 px steps, 16 px up and 16 px across).
 * - `dir`: `ur` rises to the right (tiles (x+i, y-i)), `ul` to the left (tiles (x-i, y-i)).
 *   The top landing is the floor beside the top step: row y-len+1's top, from column x+len on
 *   (ur) or up to column x-len (ul); the map makes it solid.
 * - `sheet`: the sheet whose `stair-r` / `stair-l` frames draw the steps (16×16, one tile of a
 *   flight rising right / left: two 8×8 steps, the lower one in the bottom quarter on the low
 *   side, the upper one in the top quarter on the high side). Without that frame the steps are
 *   drawn as plain stone boxes.
 *
 * Getting on: on the floor, the body's centre within STAIR_REACH px of the foot, hold UP (or at
 * the top landing hold DOWN). The player then walks the diagonal (Player.stairs): UP or the
 * direction the flight rises climbs, DOWN or the other direction descends; letting go stands
 * still. No jumping, no crouching, no knockback when hit; attacks still work (the walk pauses
 * while one swings). Reaching the foot or the top landing steps off onto the floor.
 */

/** px from the foot (or the top) within which UP (DOWN) gets on. */
export const STAIR_REACH = 8;
/** Diagonal walk speed along each axis (subpixels a frame: 0.75 px). */
export const STAIR_SPEED = 192;
/** Frames after stepping off during which the same end can't be got on again. */
export const STAIR_LOCK = 8;

export type StairDir = 'ur' | 'ul';

/** A flight's line in subpixels: the foot point (bottom) and the top point, both feet positions. */
export interface StairLine {
  /** +1 rises to the right, -1 to the left. */
  readonly sx: 1 | -1;
  readonly footX: number;
  readonly footY: number;
  /** Length along each axis (subpixels; len × 16 px). */
  readonly span: number;
}

/** Where a player is on a flight: `pos` subpixels up from the foot (0..span). */
export interface StairRide {
  line: StairLine;
  pos: number;
}

export function stairLine(tx: number, ty: number, len: number, dir: StairDir): StairLine {
  const sx = dir === 'ur' ? 1 : -1;
  return {
    sx,
    footX: tileToSub(sx > 0 ? tx : tx + 1),
    footY: tileToSub(ty + 1),
    span: tileToSub(len),
  };
}

/**
 * Puts `p` on the line at `pos` (centre on the line, feet on it), standing (no gravity, on
 * "ground" so sprites and attacks behave as on a floor). Feet at `pos`: x = footX + sx * pos,
 * y = footY - pos.
 */
export function placeOnStairs(p: Player, ride: StairRide): void {
  const b = p.body;
  const line = ride.line;
  b.x = line.footX + line.sx * ride.pos - (b.w >> 1);
  b.y = line.footY - ride.pos - b.h;
  b.vx = 0;
  b.vy = 0;
  b.onGround = true;
}

/** A flight of stairs (scenery; see the header). Built with the world, never despawns. */
export class Stairs extends Entity {
  readonly kind = 'stairs';
  readonly line: StairLine;
  constructor(
    readonly tx: number,
    readonly ty: number,
    readonly len: number,
    readonly dir: StairDir,
    readonly sheet = 'crypt',
  ) {
    const x0 = dir === 'ur' ? tx : tx - len + 1;
    super(tileToSub(x0), tileToSub(ty - len + 1), len * 16, len * 16);
    this.line = stairLine(tx, ty, len, dir);
    this.despawnMargin = null;
  }

  /**
   * Whether `p` (on the floor, not on stairs) gets on with `input` this frame, and where:
   * UP at the foot, DOWN at the top.
   */
  mount(p: Player, input: InputFrame): StairRide | null {
    const b = p.body;
    if (!b.onGround) return null;
    const line = this.line;
    const feet = b.y + b.h;
    // The end of this flight just stepped off, if any (not got on again for a moment).
    const lockedEnd = p.stairLock && p.stairLock.line === line ? p.stairLock.end : null;
    // The foot is (footX, footY), the top (footX + sx * span, footY - span).
    if (
      input.held('up') &&
      lockedEnd !== 'foot' &&
      Math.abs(p.centerX - line.footX) <= px(STAIR_REACH) &&
      Math.abs(feet - line.footY) <= px(2)
    )
      return { line, pos: 0 };
    if (
      input.held('down') &&
      lockedEnd !== 'top' &&
      Math.abs(p.centerX - (line.footX + line.sx * line.span)) <= px(STAIR_REACH) &&
      Math.abs(feet - (line.footY - line.span)) <= px(2)
    )
      return { line, pos: line.span };
    return null;
  }

  update(): void {}

  render(r: Renderer, view: View): void {
    const frame = this.dir === 'ur' ? 'stair-r' : 'stair-l';
    let sheet = null;
    try {
      if (view.assets.has(this.sheet)) sheet = view.assets.sheet(this.sheet);
    } catch {
      sheet = null;
    }
    // The steps, bottom first: tile (tx + s*i, ty - i).
    const s = this.dir === 'ur' ? 1 : -1;
    const art = sheet?.frames.has(frame) ? sheet : null;
    for (let i = 0; i < this.len; i++) {
      const x = (this.tx + s * i) * 16 - view.camX;
      const y = (this.ty - i) * 16;
      if (x < -16 || x > 272) continue;
      if (art) {
        r.sprite(art, frame, x, y);
        continue;
      }
      // Two stone steps: the low one on the low side, the high one on the high side.
      this.drawStep(r, s > 0 ? x : x + 8, y + 8);
      this.drawStep(r, s > 0 ? x + 8 : x, y);
    }
  }

  private drawStep(r: Renderer, x: number, y: number): void {
    r.rect(x, y, 8, 8, '#6c6c6c');
    r.rect(x, y, 8, 2, '#bcbcbc');
    r.rect(x + 7, y + 2, 1, 6, '#383838');
  }
}
