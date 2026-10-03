import type { Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';
import type { Player } from '../player';

export const BOMB_FUSE = 90;
export const BOMB_RADIUS = 28;

/** A placed bomb: sits where it was dropped and explodes when the fuse runs out. */
export class Bomb extends Entity {
  readonly kind = 'bomb';
  fuse = BOMB_FUSE;

  constructor(
    cx: number,
    bottom: number,
    readonly owner: Player,
  ) {
    super(cx - px(6), bottom - px(14), 12, 14);
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.layer = 'back';
  }

  update(world: World): void {
    this.fall(world);
    if (--this.fuse <= 0) {
      this.destroy();
      world.explode(
        this.body.x + (this.body.w >> 1),
        this.body.y + (this.body.h >> 1),
        BOMB_RADIUS,
        this.owner,
      );
    } else if (this.isBelowLevel()) this.destroy();
  }

  render(r: Renderer, view: View): void {
    // The fuse spark flashes faster as the bomb is about to go.
    const rate = this.fuse < 30 ? 1 : 3;
    const lit = ((view.frame >> rate) & 1) === 1;
    r.sprite(view.assets.sheet('items'), lit ? 'bomb-1' : 'bomb-0', this.screenX(view), this.screenY());
  }
}
