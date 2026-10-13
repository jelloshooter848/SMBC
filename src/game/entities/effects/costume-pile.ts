import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import { Entity, ENTITY_GRAVITY, type View } from '../entity';
import type { World } from '../../world/world';

/** Px the pile lies toward the fake's back, so his true form stands in front of it. */
export const PILE_NUDGE = 6;

/**
 * A fake Bowser's villain costume, shed (0.4.47, roadmap #31; content/sprites/costumes.ts): the
 * `costume-drop-N` pile lies where he stood once his disguise bursts (Bowser.unmask), behind his
 * true form, and goes down with the bridge when the axe drops it. A still prop: no collision.
 * `(x, y)` is the top left of its 32x32 frame, in subpixels.
 */
export class CostumePile extends Entity {
  readonly kind = 'costume-pile';

  constructor(
    x: number,
    y: number,
    /** The castle's world (2-7): its `costume-drop-N` frame. */
    readonly world: number,
    /** Drawn mirrored (the fake faced right). */
    readonly flip: boolean,
  ) {
    super(x, y, 32, 32);
    this.layer = 'back';
    this.despawnMargin = null;
  }

  /** Rests on the floor under its middle; falls once that floor is gone (the bridge). */
  update(world: World): void {
    const b = this.body;
    const col = Math.floor(toPx(b.x + (b.w >> 1)) / 16);
    const row = Math.floor((toPx(b.y + b.h) + 1) / 16);
    if (b.vy === 0 && world.map.collisionAt(col, row) !== 'none') return;
    b.vy += ENTITY_GRAVITY;
    b.y += velToSub(b.vy);
    if (this.isBelowLevel()) this.destroy();
  }

  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('costumes');
    r.sprite(
      sheet,
      `costume-drop-${this.world}`,
      toPx(this.body.x) - view.camX,
      toPx(this.body.y),
      this.flip,
    );
  }

  /** The pile's frame top for a fake whose sprite's top left is (sx, sy) px, facing `facing`. */
  static at(sx: number, sy: number, facing: number): { x: number; y: number } {
    return { x: px(sx + (facing > 0 ? -PILE_NUDGE : PILE_NUDGE)), y: px(sy) };
  }
}
