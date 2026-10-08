import type { Renderer } from '@engine/gfx/renderer';
import { toPx, velToPxf } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { World } from '../world/world';

/**
 * Developer overlay: tile grid, column numbers, player stats and a free camera for checking
 * level transcriptions. Toggled from the level scene with F1 (overlay) and F2 (free camera).
 */
const NO_SHIFT = { shiftY: 0, bottom: SCREEN_H };

export class DebugOverlay {
  enabled = false;
  freeCamera = false;
  freeCameraX = 0;

  /**
   * `view` is the part of the screen the world fills and how far up it is drawn: Larry's airship
   * and cabin draw it SMB3_WORLD_SHIFT px up with the status bar below (LevelScene.render), so
   * the grid, the column numbers and the hitbox move with it. A free camera's y moves them too.
   */
  render(r: Renderer, world: World, fps: number, view: { shiftY: number; bottom: number } = NO_SHIFT): void {
    if (!this.enabled) return;
    const camPx = world.camera.pxX;
    const camY = (world.camera.free ? world.camera.pxY : 0) + view.shiftY;
    const bottom = view.bottom;
    for (let x = -(camPx % 16); x < SCREEN_W; x += 16) r.line(x, 0, x, bottom, 'rgba(255,255,255,0.15)');
    for (let y = -(((camY % 16) + 16) % 16); y < bottom; y += 16)
      if (y >= 0) r.line(0, y, SCREEN_W, y, 'rgba(255,255,255,0.15)');
    for (let x = -(camPx % 16); x < SCREEN_W; x += 16) {
      const col = (camPx + x) >> 4;
      if (col % 2 === 0) r.debugText(String(col), x + 1, bottom - 2, '#ff0');
    }
    const b = world.player.body;
    const lines = [
      `x ${toPx(b.x)} y ${toPx(b.y)} tile ${toPx(b.x) >> 4},${toPx(b.y) >> 4}`,
      `vx ${velToPxf(b.vx).toFixed(3)} vy ${velToPxf(b.vy).toFixed(3)} ${b.onGround ? 'ground' : 'air'}`,
      `cam ${camPx} frame ${world.frame} fps ${fps.toFixed(0)}${this.freeCamera ? ' FREECAM' : ''}`,
    ];
    lines.forEach((l, i) => {
      r.rect(0, 2 + i * 9, l.length * 5 + 4, 9, 'rgba(0,0,0,0.6)');
      r.debugText(l, 2, 9 + i * 9);
    });
    // Player hitbox outline.
    const x = toPx(b.x) - camPx;
    const y = toPx(b.y) - camY;
    r.line(x, y, x + toPx(b.w), y, '#0f0');
    r.line(x, y + toPx(b.h), x + toPx(b.w), y + toPx(b.h), '#0f0');
    r.line(x, y, x, y + toPx(b.h), '#0f0');
    r.line(x + toPx(b.w), y, x + toPx(b.w), y + toPx(b.h), '#0f0');
  }
}
