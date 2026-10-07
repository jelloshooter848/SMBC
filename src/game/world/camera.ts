import { clamp, px, toPx } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';

/** Opt-in vertical following (a map's `camera: free`, with `height: N` rows). */
export interface CameraOptions {
  /** Follow up and down (and both ways sideways). */
  free?: boolean;
  /** The map's height in tiles (one screen is 15). */
  heightTiles?: number;
}

/**
 * The platformer camera: SMB1's right-only horizontal scrolling (left scroll is an accessibility
 * option). A `free` camera (tall maps with shafts) also scrolls left and follows the player up
 * and down, keeping the body's top inside a band of the screen; every other camera keeps y at 0.
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
  }

  /** Follow the lead player (`playerY`, the body's top, only matters to a free camera). */
  follow(playerX: number, playerY?: number): void {
    if (this.locked) return;
    if (playerX - this.x > this.pushX) this.x = playerX - this.pushX;
    else if ((this.allowLeftScroll || this.free) && playerX - this.x < this.pushX)
      this.x = playerX - this.pushX;
    this.x = clamp(this.x, 0, this.maxX);
    if (!this.free || playerY === undefined) return;
    if (playerY - this.y < this.pushTop) this.y = playerY - this.pushTop;
    else if (playerY - this.y > this.pushBottom) this.y = playerY - this.pushBottom;
    this.y = clamp(this.y, 0, this.maxY);
  }

  /** Jump the camera so the player is on screen (level start / pipe exit). */
  snapTo(playerX: number, playerY?: number): void {
    this.x = clamp(playerX - this.pushX, 0, this.maxX);
    if (this.free && playerY !== undefined) this.y = clamp(playerY - this.pushBottom, 0, this.maxY);
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
