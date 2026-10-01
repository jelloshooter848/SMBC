import type { Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { Entity, type View } from '../entity';

/** The axe behind the bridge; touching it ends the castle. */
export class Axe extends Entity {
  readonly kind = 'axe';
  constructor(tx: number, ty: number) {
    super(px(tx * 16 + 2), px(ty * 16), 12, 16);
    this.spriteOffsetX = 2;
    this.despawnMargin = null;
  }
  update(): void {}
  render(r: Renderer, view: View): void {
    r.sprite(view.assets.sheet('items'), `axe-${(view.frame >> 3) % 3}`, this.screenX(view), this.screenY());
  }
}
