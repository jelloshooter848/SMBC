import type { Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';
import type { Player } from '../player';

export const RUSH_LIFETIME = 300;
/** Launch speed as a multiple of the player's normal jump takeoff speed. */
export const RUSH_BOOST = 1.6;

/** A spring pad dropped in front of the player: landing on it fires them high into the air. */
export class RushCoil extends Entity {
  readonly kind = 'rush-coil';
  private life = RUSH_LIFETIME;
  private sprung = 0;

  constructor(
    cx: number,
    bottom: number,
    readonly owner: Player,
  ) {
    super(cx - px(7), bottom - px(14), 14, 14);
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 2;
    this.layer = 'back';
  }

  /** It has just launched someone (the spring is up). */
  get springing(): boolean {
    return this.sprung > 0;
  }

  update(world: World): void {
    if (this.sprung > 0) {
      if (--this.sprung === 0) this.destroy();
      return;
    }
    if (--this.life <= 0 || this.isBelowLevel()) return this.destroy();
    this.fall(world);
    const top = this.body.y;
    for (const p of world.activePlayers()) {
      const pb = p.body;
      // Feet coming down onto the top of the coil.
      if (p.fallSpeed <= 0 || !overlaps(pb, this.body)) continue;
      if (pb.prevBottom > top + px(6)) continue;
      pb.y = top - pb.h;
      p.launch(RUSH_BOOST);
      world.audio.sfx('jump-big');
      this.sprung = 12;
      break;
    }
  }

  render(r: Renderer, view: View): void {
    if (this.life < 60 && !view.reduceFlashing && (view.frame & 2) === 0) return;
    const frame = this.sprung > 0 ? 'rush-coil-1' : 'rush-coil-0';
    r.sprite(view.assets.sheet('items'), frame, this.screenX(view), this.screenY());
  }
}
