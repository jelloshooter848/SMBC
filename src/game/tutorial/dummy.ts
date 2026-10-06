import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Enemy } from '../entities/enemies/enemy';
import type { View } from '../entities/entity';
import { Explosion } from '../entities/effects/effects';
import type { DamageSource, Reaction } from '../rules/damage';
import type { World } from '../world/world';

/** Hits a dummy takes before it pops (the practice room puts up a new one). */
export const DUMMY_HP = 3;

/**
 * The practice room's target dummy: a straw figure on a post that never moves and never hurts.
 * Every hero's attacks connect with it (stomps, swords, shots, bombs; a boomerang or ice beam
 * freezes it like any enemy). Each hit is reported to `onHit` and makes it wobble; after
 * DUMMY_HP hits it pops in a puff, and the room puts up a fresh one. Drawn with rectangles, so it
 * needs no sprite sheet.
 */
export class TargetDummy extends Enemy {
  readonly kind = 'dummy';
  /** Frames of wobble left after a hit. */
  private wobble = 0;

  constructor(
    x: number,
    feet: number,
    private readonly onHit: (src: DamageSource) => void = () => undefined,
  ) {
    super(x, feet - px(24), 12, 24);
    this.hp = DUMMY_HP;
    this.contactHurts = false;
    this.body.vx = 0;
    this.walkSpeed = 0;
    this.despawnMargin = null;
    this.fallsOffLedges = false;
  }

  update(world: World): void {
    if (this.wobble > 0) this.wobble--;
    this.body.vx = 0;
    this.fall(world);
    if (this.isBelowLevel()) this.destroy();
  }

  override hit(src: DamageSource, world: World): Reaction {
    this.onHit(src);
    this.wobble = 16;
    // A freezing hit holds it still for a moment, as it would any enemy; it still counts.
    if ((src.kind === 'boomerang' || src.kind === 'ice') && this.stunned === 0) {
      this.stunned = 60;
      return 'stun';
    }
    this.hp -= Math.max(1, src.amount);
    if (this.hp > 0) return 'hp';
    const b = this.body;
    world.spawn(new Explosion(b.x + (b.w >> 1), b.y + (b.h >> 1), true));
    world.audio.sfx('stomp');
    this.destroy();
    return 'kill';
  }

  override render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    // A sway of a pixel either way while it wobbles.
    const dx = this.wobble > 0 ? ((this.wobble >> 2) & 1 ? 1 : -1) : 0;
    const post = '#8c4a18';
    // Post and base.
    r.rect(x + 5, y + 14, 2, 10, post);
    r.rect(x + 1, y + 22, 10, 2, post);
    // Straw body with a cross-bar for arms.
    r.rect(x + 1 + dx, y + 4, 10, 11, '#e4b860');
    r.rect(x - 1 + dx, y + 7, 14, 2, post);
    // Head.
    r.rect(x + 3 + dx, y, 6, 5, '#e4b860');
    // A red and white target on the chest.
    r.rect(x + 3 + dx, y + 8, 6, 5, '#d82800');
    r.rect(x + 4 + dx, y + 9, 4, 3, '#fcfcfc');
    r.rect(x + 5 + dx, y + 10, 2, 1, '#d82800');
    // Hits taken: a dark notch per hit on the base.
    for (let i = 0; i < DUMMY_HP - this.hp; i++) r.rect(x + 2 + i * 3, y + 22, 2, 1, '#000');
  }
}
