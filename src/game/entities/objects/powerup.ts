import type { Renderer } from '@engine/gfx/renderer';
import { px, velToSub } from '@engine/math/units';
import { Entity, type View } from '../entity';
import { moveX } from '../body';
import type { World } from '../../world/world';

/** `poison` (Lost Levels) slides like a mushroom but hurts on touch (see World.collisions). */
export type PowerUpKind = 'mushroom' | '1up' | 'flower' | 'star' | 'poison';

/** An item rising out of a block, then behaving per kind. */
export class PowerUp extends Entity {
  readonly kind = 'powerup';
  private emerging = 32;
  private readonly targetY: number;

  constructor(
    tx: number,
    ty: number,
    readonly item: PowerUpKind,
  ) {
    super(px(tx * 16 + 2), px(ty * 16), 12, 16);
    this.targetY = px((ty - 1) * 16);
    this.layer = 'back';
    this.spriteOffsetX = 2;
    this.body.vx = 0;
  }

  update(world: World): void {
    const b = this.body;
    if (this.emerging > 0) {
      this.emerging--;
      b.y -= px(16) / 32;
      if (this.emerging === 0) {
        b.y = this.targetY;
        this.layer = 'main';
        if (this.item !== 'flower') b.vx = 0x01000;
        if (this.item === 'star') b.vy = -0x04000;
      }
      return;
    }
    if (this.item === 'flower') return;
    moveX(b, world.map, velToSub(b.vx));
    if (b.hitWall !== 0) b.vx = -b.hitWall * 0x01000;
    this.fall(world, this.item === 'star' ? 0x00300 : undefined);
    if (this.item === 'star' && b.onGround) b.vy = -0x04000;
    if (this.isBelowLevel()) this.destroy();
  }

  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('items');
    let frame: string = this.item;
    if (this.item === 'flower') frame = `flower-${(view.frame >> 3) & 1}`;
    if (this.item === 'star') frame = `star-${(view.frame >> 2) & 3}`;
    if (this.item === 'poison') frame = 'poison-mushroom';
    r.sprite(sheet, frame, this.screenX(view), this.screenY());
  }
}
