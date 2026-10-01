import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Enemy } from './enemy';
import type { View } from '../entity';
import type { World } from '../../world/world';
import { overlaps } from '@engine/math/aabb';

/** Rotating chain of fireballs anchored to a block. Immune to everything; each ball hurts. */
export class Firebar extends Enemy {
  readonly kind = 'firebar';
  private angle = 0; // 0..255
  constructor(
    tx: number,
    ty: number,
    readonly dir: -1 | 1,
    readonly len = 6,
  ) {
    super(px(tx * 16 + 4), px(ty * 16 + 4), 8, 8);
    this.vulnerability = {};
    this.stompable = false;
    this.body.vx = 0;
    this.despawnMargin = 128;
    this.layer = 'front';
  }

  private ballPos(i: number): { x: number; y: number } {
    const a = (this.angle / 256) * Math.PI * 2;
    const cx = toPx(this.body.x);
    const cy = toPx(this.body.y);
    return { x: cx + Math.round(Math.cos(a) * i * 8), y: cy + Math.round(Math.sin(a) * i * 8) };
  }

  update(world: World): void {
    this.angle = (this.angle + this.dir * 1 + 256) % 256;
    // Collision is done here against every ball (the base body is just the anchor ball).
    const p = world.player.body;
    for (let i = 1; i < this.len; i++) {
      const b = this.ballPos(i);
      if (overlaps(p, { x: px(b.x + 1), y: px(b.y + 1), w: px(6), h: px(6) })) {
        world.hurtPlayer(b.x < toPx(p.x) ? 1 : -1);
        break;
      }
    }
  }

  override render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('items');
    for (let i = 0; i < this.len; i++) {
      const b = this.ballPos(i);
      r.sprite(sheet, 'firebar', b.x - view.camX, b.y);
    }
  }
}
