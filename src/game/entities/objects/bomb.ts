import type { Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';
import type { Player } from '../player';

export const BOMB_FUSE = 90;
export const BOMB_RADIUS = 28;

export interface BombOptions {
  fuse?: number;
  radiusPx?: number;
  /** Blast damage to enemies (default 2). */
  amount?: number;
  /** Whether the blast hurts players (default true). */
  hurtsPlayers?: boolean;
  /** Smaller blast art and sound. */
  small?: boolean;
  /** Sprite frames (unlit, lit) and size. */
  frames?: [string, string];
  size?: number;
  /** Called with the blast centre when it goes off. */
  onDetonate?: (world: World, cx: number, cy: number) => void;
}

/** A placed bomb: sits where it was dropped and explodes when the fuse runs out. */
export class Bomb extends Entity {
  readonly kind = 'bomb';
  fuse: number;
  private readonly opts: BombOptions;

  constructor(
    cx: number,
    bottom: number,
    readonly owner: Player,
    opts: BombOptions = {},
  ) {
    const size = opts.size ?? 14;
    super(cx - px(size >> 1), bottom - px(size), opts.size ?? 12, size);
    this.opts = opts;
    this.fuse = opts.fuse ?? BOMB_FUSE;
    this.spriteOffsetX = opts.size ? 0 : 2;
    this.spriteOffsetY = opts.size ? 0 : 2;
    this.layer = 'back';
  }

  update(world: World): void {
    this.fall(world);
    if (--this.fuse <= 0) {
      this.destroy();
      const cx = this.body.x + (this.body.w >> 1);
      const cy = this.body.y + (this.body.h >> 1);
      world.explode(cx, cy, this.opts.radiusPx ?? BOMB_RADIUS, this.owner, {
        amount: this.opts.amount ?? 2,
        hurtsPlayers: this.opts.hurtsPlayers ?? true,
        small: this.opts.small ?? false,
      });
      this.opts.onDetonate?.(world, cx, cy);
    } else if (this.isBelowLevel()) this.destroy();
  }

  render(r: Renderer, view: View): void {
    // The fuse spark flashes faster as the bomb is about to go.
    const rate = this.fuse < 30 ? 1 : 3;
    const lit = ((view.frame >> rate) & 1) === 1;
    const [unlit, litFrame] = this.opts.frames ?? ['bomb-0', 'bomb-1'];
    r.sprite(view.assets.sheet('items'), lit ? litFrame : unlit, this.screenX(view), this.screenY());
  }
}
