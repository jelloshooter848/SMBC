import { px, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import type { World } from '../../world/world';

const RISE_FRAMES = 20;
const RISE_SPEED = 0x01800; // 1.5 px/f diagonal
const SINK_SPEED = 0x00800; // 0.5 px/f
const SINK_MAX = 60;
/** Out of water (The Lost Levels) it swims through the air, never above the HUD line. */
const AIR_TOP = px(32);

/**
 * Blooper: squirts diagonally up toward the player, then drifts down until it is below them
 * and squirts again. Never surfaces above the water line and ignores tiles. Not stompable.
 * Outside water levels it swims through the air the same way, below the HUD.
 */
export class Blooper extends Enemy {
  readonly kind = 'blooper';
  private phase: 'rise' | 'sink' = 'sink';
  private t = 0;

  constructor(x: number, y: number) {
    super(x, y, 12, 20);
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.currentFrame = 'blooper-0';
    this.scoreValue = 200;
    this.stompable = false;
    this.vulnerability = { ...this.vulnerability, stomp: 'hurtAttacker' };
    this.body.vx = 0;
  }

  update(world: World): void {
    const b = this.body;
    const pl = world.nearestPlayer(b.x).body;
    this.t++;
    if (this.phase === 'rise') {
      b.x += velToSub(b.vx);
      b.y -= velToSub(RISE_SPEED);
      if (this.t >= RISE_FRAMES) {
        this.phase = 'sink';
        this.t = 0;
      }
      this.currentFrame = 'blooper-0';
    } else {
      b.y += velToSub(SINK_SPEED);
      const belowPlayer = b.y > pl.y + px(16);
      if (this.t >= SINK_MAX || (belowPlayer && this.t >= 12)) {
        this.phase = 'rise';
        this.t = 0;
        b.vx = (pl.x + pl.w / 2 < b.x + b.w / 2 ? -1 : 1) * RISE_SPEED;
      }
      this.currentFrame = 'blooper-1';
    }
    // Stay under the surface (or the HUD out of water) and above the floor.
    const top = Number.isFinite(world.waterTop) ? world.waterTop + px(8) : AIR_TOP;
    if (b.y < top) b.y = top;
    if (b.y + b.h > px(13 * 16)) b.y = px(13 * 16) - b.h;
    this.facing = b.vx > 0 ? 1 : -1;
  }
}
