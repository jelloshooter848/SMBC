import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Enemy } from './enemy';
import type { View } from '../entity';
import type { World } from '../../world/world';
import { overlaps } from '@engine/math/aabb';

/** A full turn in `angle` units. */
const TURN = 65536;
/**
 * FireBar.as ROTATE_SPEED = 106 degrees a second ("three rotations 10 seconds"): 3.40 s a turn,
 * 106 / 360 / 60 of a turn per frame.
 */
const STEP = Math.round((106 / 360 / 60) * TURN);

/**
 * Rotating chain of fireballs anchored to a block. Immune to everything; each ball hurts.
 * Every bar starts pointing straight up (FireBar.as sets no initial rotation and the bar's art
 * points up); a `fireBarRight` turns clockwise and a `fireBarLeft` counter-clockwise.
 */
export class Firebar extends Enemy {
  readonly kind = 'firebar';
  /** Angle in 1/65536 of a turn, y down (so increasing turns clockwise on screen); up is 3/4. */
  angle = (TURN * 3) / 4;
  constructor(
    tx: number,
    ty: number,
    /** +1 turns clockwise, -1 counter-clockwise. */
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
    const a = (this.angle / TURN) * Math.PI * 2;
    const cx = toPx(this.body.x);
    const cy = toPx(this.body.y);
    return { x: cx + Math.round(Math.cos(a) * i * 8), y: cy + Math.round(Math.sin(a) * i * 8) };
  }

  update(world: World): void {
    this.angle = (this.angle + this.dir * STEP + TURN) % TURN;
    // Collision is done here against every ball (the base body is just the anchor ball).
    for (const pl of world.activePlayers()) {
      const p = pl.body;
      for (let i = 1; i < this.len; i++) {
        const b = this.ballPos(i);
        if (overlaps(p, { x: px(b.x + 1), y: px(b.y + 1), w: px(6), h: px(6) })) {
          world.hurtPlayer(pl, b.x < toPx(p.x) ? 1 : -1);
          break;
        }
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
