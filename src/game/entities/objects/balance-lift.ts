import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';
import { Lift } from './lift';

const SINK_SPEED = 0x00100; // 1 px/f in subpixels
const ROPE_COLOUR = '#d8b878';

/**
 * Two platforms on a rope over a pair of pulleys. Standing on one lowers it and raises the
 * other; pull one up to its pulley and both drop. This entity owns the rope and pulleys and
 * spawns the two `lift-balance` platforms it drives.
 */
export class BalanceLift extends Entity {
  readonly kind = 'balance';
  private left: Lift | null = null;
  private right: Lift | null = null;
  private slack = false;
  private readonly x2: number;
  private readonly y2: number;
  private readonly len: number;
  private readonly topRow: number;

  constructor(tx: number, ty: number, props: Record<string, string | number | boolean>) {
    super(px(tx * 16), px(ty * 16), 16, 8);
    this.x2 = Number(props.x2 ?? tx + 4);
    this.y2 = Number(props.y2 ?? ty);
    this.len = Number(props.len ?? 6);
    this.topRow = Number(props.top ?? ty - 4);
    this.layer = 'back';
    this.despawnMargin = 64;
    this.body.vx = 0;
  }

  /** px: y of the rope line over the pulleys. */
  get ropeY(): number {
    return this.topRow * 16 + 8;
  }

  get platforms(): [Lift, Lift] | null {
    return this.left && this.right ? [this.left, this.right] : null;
  }

  update(world: World): void {
    if (!this.left || !this.right) {
      this.left = new Lift('lift-balance', toPx(this.body.x) >> 4, toPx(this.body.y) >> 4, { len: this.len });
      this.right = new Lift('lift-balance', this.x2, this.y2, { len: this.len });
      world.spawn(this.left);
      world.spawn(this.right);
      return;
    }
    if (this.slack) return;
    const l = this.left;
    const r = this.right;
    if (l.ridden === r.ridden) return;
    const sinking = l.ridden ? l : r;
    const rising = l.ridden ? r : l;
    sinking.shift(SINK_SPEED);
    rising.shift(-SINK_SPEED);
    // The rising platform reaching its pulley snaps the rope: both fall.
    if (toPx(rising.body.y) <= this.ropeY + 8) {
      l.drop();
      r.drop();
      this.slack = true;
    }
  }

  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('items');
    const lx = toPx(this.body.x) - view.camX;
    const rx = this.x2 * 16 - view.camX;
    const ropeY = this.ropeY;
    const halfW = (this.len * 8) / 2;
    // Rope across the top, then down to each platform's centre.
    r.rect(lx + halfW, ropeY, rx - lx, 1, ROPE_COLOUR);
    if (!this.slack && this.left && this.right) {
      r.rect(lx + halfW, ropeY, 1, toPx(this.left.body.y) - ropeY, ROPE_COLOUR);
      r.rect(rx + halfW, ropeY, 1, toPx(this.right.body.y) - ropeY, ROPE_COLOUR);
    }
    r.sprite(sheet, 'pulley', lx + halfW - 8, ropeY - 8);
    r.sprite(sheet, 'pulley', rx + halfW - 8, ropeY - 8, true);
  }
}
