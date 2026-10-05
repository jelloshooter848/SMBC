import type { Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { Entity, type View } from '../entity';

/** The princess waiting past the axe in the last castle. Scenery: no collision. */
export class Princess extends Entity {
  readonly kind = 'princess';

  constructor(tx: number, ty: number) {
    // Anchored on the tile her feet stand on.
    super(px(tx * 16), px((ty + 1) * 16 - 24), 16, 24);
    this.layer = 'back';
    this.despawnMargin = null;
    this.body.vx = 0;
    this.facing = -1;
  }

  update(): void {}

  render(r: Renderer, view: View): void {
    r.sprite(view.assets.sheet('items'), 'princess', this.screenX(view), this.screenY(), true);
  }
}
