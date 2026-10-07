import { clamp, px, toPx } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';

/**
 * Opt-in camera modes: vertical following (a map's `camera: free`, with `height: N` rows) or
 * auto-scroll (`camera: auto`, with `scroll: <px per frame>`).
 */
export interface CameraOptions {
  /** Follow up and down (and both ways sideways). */
  free?: boolean;
  /** The map's height in tiles (one screen is 15). */
  heightTiles?: number;
  /**
   * Auto-scroll (SMB3's airships): the camera moves right this many px per frame (decimals are
   * fine) on its own, whatever the players do, until its end (the scroll stop or the map's end).
   */
  autoScroll?: number;
}

/** An auto-scroll map's speed when its header names none (`camera: auto` without `scroll:`). */
export const DEFAULT_AUTO_SCROLL = 0.5;

/**
 * The platformer camera: SMB1's right-only horizontal scrolling (left scroll is an accessibility
 * option). A `free` camera (tall maps with shafts) also scrolls left and follows the player up
 * and down, keeping the body's top inside a band of the screen; every other camera keeps y at 0.
 * An `auto` camera (SMB3 airships) ignores the players: World calls `scroll()` once a live frame
 * and it moves right at its own speed until its end; World pushes the players along with its
 * left edge (squashing one against a wall) and keeps them from leaving past its right edge.
 */
export class Camera {
  /** Subpixels. */
  x = 0;
  /** Subpixels; always 0 unless `free`. */
  y = 0;
  /** Right-most allowed camera x in subpixels. */
  maxX: number;
  /** Lowest allowed camera y in subpixels (0 for a one-screen map). */
  readonly maxY: number;
  allowLeftScroll = false;
  /** Screen x at which the player starts pushing the camera. SMB1 uses 0x50. */
  pushX = px(80);
  /** Free camera: the band (screen y of the body's top) the player is kept inside. */
  pushTop = px(72);
  pushBottom = px(128);
  locked: boolean;
  readonly free: boolean;
  /** Auto-scroll speed in subpixels per frame; 0 for every camera but an `auto` one. */
  readonly autoSpeed: number;
  /**
   * A room the camera keeps inside (subpixels, right and bottom exclusive), as in Metroid, where
   * the screen never shows past a room's walls: a mini game sets it; null is the whole map.
   */
  room: { x0: number; y0: number; x1: number; y1: number } | null = null;

  constructor(
    levelWidthTiles: number,
    scrollStopTile: number | null,
    locked = false,
    opts: CameraOptions = {},
  ) {
    const endTile = scrollStopTile ?? levelWidthTiles;
    this.maxX = Math.max(0, px(endTile * 16 - SCREEN_W));
    this.locked = locked;
    this.free = opts.free ?? false;
    this.maxY = this.free ? Math.max(0, px((opts.heightTiles ?? 15) * 16 - SCREEN_H)) : 0;
    this.autoSpeed = opts.autoScroll ? Math.max(1, Math.round(px(opts.autoScroll))) : 0;
  }

  /** An auto-scroll camera (`camera: auto`). */
  get auto(): boolean {
    return this.autoSpeed > 0;
  }

  /** An auto camera has reached its end (the scroll stop or the map's end) and stays there. */
  get autoDone(): boolean {
    return this.auto && this.x >= this.maxX;
  }

  /** One frame of auto-scroll: right by the speed, up to the end. Does nothing for other cameras. */
  scroll(): void {
    if (!this.auto || this.locked) return;
    this.x = Math.min(this.maxX, this.x + this.autoSpeed);
  }

  /** Follow the lead player (`playerY`, the body's top, only matters to a free camera). */
  follow(playerX: number, playerY?: number): void {
    // An auto camera moves on its own (scroll()), never after the players.
    if (this.locked || this.auto) return;
    if (playerX - this.x > this.pushX) this.x = playerX - this.pushX;
    else if ((this.allowLeftScroll || this.free) && playerX - this.x < this.pushX)
      this.x = playerX - this.pushX;
    this.x = clamp(this.x, 0, this.maxX);
    if (this.free && playerY !== undefined) {
      if (playerY - this.y < this.pushTop) this.y = playerY - this.pushTop;
      else if (playerY - this.y > this.pushBottom) this.y = playerY - this.pushBottom;
      this.y = clamp(this.y, 0, this.maxY);
    }
    this.keepInRoom();
  }

  /** Jump the camera so the player is on screen (level start / pipe exit). */
  snapTo(playerX: number, playerY?: number): void {
    this.x = clamp(playerX - this.pushX, 0, this.maxX);
    if (this.free && playerY !== undefined) this.y = clamp(playerY - this.pushBottom, 0, this.maxY);
    this.keepInRoom();
  }

  /** Inside the room, if one is set. */
  private keepInRoom(): void {
    const r = this.room;
    if (!r) return;
    this.x = clamp(this.x, r.x0, Math.max(r.x0, r.x1 - px(SCREEN_W)));
    this.y = clamp(this.y, r.y0, Math.max(r.y0, r.y1 - px(SCREEN_H)));
  }

  get pxX(): number {
    return toPx(this.x);
  }
  get pxY(): number {
    return toPx(this.y);
  }
  get right(): number {
    return this.x + px(SCREEN_W);
  }
  get bottom(): number {
    return this.y + px(SCREEN_H);
  }
}
