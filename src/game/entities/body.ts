import type { AABB } from '@engine/math/aabb';
import { px, tileAt, tileToSub, TILE_SUB } from '@engine/math/units';
import type { TileMap } from '../world/tilemap';

/** Physics body: AABB in subpixels plus velocity in 1/4096 px/frame. */
export interface Body extends AABB {
  vx: number;
  vy: number;
  onGround: boolean;
  hitHead: boolean;
  hitWall: -1 | 0 | 1;
  /** Bottom edge before this frame's vertical move (one-way platform rule). */
  prevBottom: number;
}

export function makeBody(x: number, y: number, wPx: number, hPx: number): Body {
  return {
    x,
    y,
    w: px(wPx),
    h: px(hPx),
    vx: 0,
    vy: 0,
    onGround: false,
    hitHead: false,
    hitWall: 0,
    prevBottom: y + px(hPx),
  };
}

/** How close (px) to a block edge a head bump gets nudged sideways instead of stopping (SMB1 corner forgiveness). */
const CORNER_NUDGE = px(4);

export function moveX(b: Body, map: TileMap, dx: number): void {
  b.hitWall = 0;
  if (dx === 0) return;
  b.x += dx;
  const top = tileAt(b.y);
  const bottom = tileAt(b.y + b.h - 1);
  if (dx > 0) {
    const col = tileAt(b.x + b.w - 1);
    for (let ty = top; ty <= bottom; ty++) {
      if (map.isSolid(col, ty)) {
        b.x = tileToSub(col) - b.w;
        b.vx = 0;
        b.hitWall = 1;
        return;
      }
    }
  } else {
    const col = tileAt(b.x);
    for (let ty = top; ty <= bottom; ty++) {
      if (map.isSolid(col, ty)) {
        b.x = tileToSub(col + 1);
        b.vx = 0;
        b.hitWall = -1;
        return;
      }
    }
  }
}

export interface MoveYOptions {
  onHeadBump?: (tx: number, ty: number) => void;
  /** Ignore one-way ('top') tiles. */
  ignoreOneWay?: boolean;
  /**
   * A head bump strikes every block the head touches that frame, not only one (the original's
   * `canHitMultipleBricks`: Sophia III's wide body). Default: one.
   */
  bumpAll?: boolean;
  /**
   * Free tiles needed beside a block (same row, on the slip side) before the head-bump corner
   * slip nudges the body past it (HitTester.as: 2 for Sophia III's wide body). Default 1.
   */
  cornerFreeTiles?: 1 | 2;
}

export function moveY(b: Body, map: TileMap, dy: number, opts: MoveYOptions = {}): void {
  b.prevBottom = b.y + b.h;
  b.onGround = false;
  b.hitHead = false;
  if (dy === 0) return;
  b.y += dy;
  const left = tileAt(b.x);
  const right = tileAt(b.x + b.w - 1);
  if (dy > 0) {
    const row = tileAt(b.y + b.h - 1);
    const rowTop = tileToSub(row);
    for (let tx = left; tx <= right; tx++) {
      const c = map.collisionAt(tx, row);
      if (c === 'solid' || (c === 'top' && !opts.ignoreOneWay && b.prevBottom <= rowTop)) {
        b.y = rowTop - b.h;
        b.vy = 0;
        b.onGround = true;
        return;
      }
    }
  } else {
    const row = tileAt(b.y);
    const center = tileAt(b.x + (b.w >> 1));
    const two = opts.cornerFreeTiles === 2;
    /** A wide body slips only where its shifted box is clear in every row it covers. */
    const clearAt = (x: number): boolean => {
      if (!two) return true;
      for (let ty = tileAt(b.y); ty <= tileAt(b.y + b.h - 1); ty++)
        for (let tx = tileAt(x); tx <= tileAt(x + b.w - 1); tx++) if (map.isSolid(tx, ty)) return false;
      return true;
    };
    let bumpCol = -1;
    if (map.blocksFromBelow(center, row)) bumpCol = center;
    else if (map.blocksFromBelow(left, row)) {
      const overlap = tileToSub(left + 1) - b.x;
      if (
        overlap <= CORNER_NUDGE &&
        !map.blocksFromBelow(right, row) &&
        !(two && (map.blocksFromBelow(left + 1, row) || map.blocksFromBelow(left + 2, row))) &&
        !map.isSolid(left + 1, tileAt(b.y + b.h - 1)) &&
        clearAt(b.x + overlap)
      ) {
        b.x += overlap; // slip past the corner
        return;
      }
      bumpCol = left;
    } else if (map.blocksFromBelow(right, row)) {
      const overlap = b.x + b.w - tileToSub(right);
      if (
        overlap <= CORNER_NUDGE &&
        !(two && (map.blocksFromBelow(right - 1, row) || map.blocksFromBelow(right - 2, row))) &&
        !map.isSolid(right - 1, tileAt(b.y + b.h - 1)) &&
        clearAt(b.x - overlap)
      ) {
        b.x -= overlap;
        return;
      }
      bumpCol = right;
    }
    if (bumpCol >= 0 && opts.bumpAll) {
      b.y = tileToSub(row + 1);
      b.vy = 0;
      b.hitHead = true;
      for (let tx = left; tx <= right; tx++) if (map.blocksFromBelow(tx, row)) opts.onHeadBump?.(tx, row);
      return;
    }
    if (bumpCol >= 0) {
      b.y = tileToSub(row + 1);
      b.vy = 0;
      b.hitHead = true;
      opts.onHeadBump?.(bumpCol, row);
    }
  }
}

/** True when the tile directly under the body's feet is solid or one-way (used for "standing" checks). */
export function groundBelow(b: Body, map: TileMap): boolean {
  const row = tileAt(b.y + b.h);
  const left = tileAt(b.x);
  const right = tileAt(b.x + b.w - 1);
  for (let tx = left; tx <= right; tx++) {
    const c = map.collisionAt(tx, row);
    if (c === 'solid' || c === 'top') return true;
  }
  return false;
}

export const bodyBottom = (b: Body): number => b.y + b.h;
export const bodyCenterX = (b: Body): number => b.x + (b.w >> 1);
export const bodyTileRow = (b: Body): number => Math.floor((b.y + b.h - 1) / TILE_SUB);
