import type { Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { Entity, type View } from '../entity';

/** The mushroom retainer waiting past the axe in every castle but the last. Scenery: no collision. */
export class Toad extends Entity {
  readonly kind = 'toad';

  constructor(tx: number, ty: number) {
    // Anchored on the tile his feet stand on, like the princess.
    super(px(tx * 16), px((ty + 1) * 16 - 24), 16, 24);
    this.layer = 'back';
    this.despawnMargin = null;
    this.body.vx = 0;
    this.facing = -1;
  }

  update(): void {}

  render(r: Renderer, view: View): void {
    r.sprite(view.assets.sheet('items'), 'toad', this.screenX(view), this.screenY(), true);
  }
}
