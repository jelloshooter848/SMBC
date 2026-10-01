import { clamp, px, toPx } from '@engine/math/units';
import { SCREEN_W } from '@engine/viewport';

/** Horizontal-only camera with SMB1's right-only scrolling (left scroll is an accessibility option). */
export class Camera {
  /** Subpixels. */
  x = 0;
  /** Right-most allowed camera x in subpixels. */
  maxX: number;
  allowLeftScroll = false;
  /** Screen x at which the player starts pushing the camera. SMB1 uses 0x50. */
  pushX = px(80);
  locked: boolean;

  constructor(levelWidthTiles: number, scrollStopTile: number | null, locked = false) {
    const endTile = scrollStopTile ?? levelWidthTiles;
    this.maxX = Math.max(0, px(endTile * 16 - SCREEN_W));
    this.locked = locked;
  }

  follow(playerX: number): void {
    if (this.locked) return;
    if (playerX - this.x > this.pushX) this.x = playerX - this.pushX;
    else if (this.allowLeftScroll && playerX - this.x < this.pushX) this.x = playerX - this.pushX;
    this.x = clamp(this.x, 0, this.maxX);
  }

  /** Jump the camera so the player is on screen (level start / pipe exit). */
  snapTo(playerX: number): void {
    this.x = clamp(playerX - this.pushX, 0, this.maxX);
  }

  get pxX(): number {
    return toPx(this.x);
  }
  get right(): number {
    return this.x + px(SCREEN_W);
  }
}
