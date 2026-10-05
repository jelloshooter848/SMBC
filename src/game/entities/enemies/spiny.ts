import { px } from '@engine/math/units';
import { Enemy } from './enemy';
import { ENEMY_SCORES } from '../../rules/score';
import type { World } from '../../world/world';
import { moveX } from '../body';
import type { DamageSource } from '../../rules/damage';

/**
 * Spiny: thrown by Lakitu as a spiked egg that falls and hatches on landing into a walker that
 * heads for the nearest player. Its spikes hurt anyone who stomps it.
 */
export class Spiny extends Enemy {
  readonly kind = 'spiny';
  egg: boolean;

  constructor(x: number, y: number, egg = true) {
    super(x, y, 12, 14);
    this.egg = egg;
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.scores = ENEMY_SCORES.SPINEY;
    this.vulnerability = { ...this.vulnerability, stomp: 'hurtAttacker', bump: 'bounce' };
    this.currentFrame = egg ? 'spiny-egg' : 'spiny-0';
    this.activated = true;
    if (egg) this.body.vx = 0;
  }

  /**
   * A block bumped under it only pops it up (Spiney.gBounceHit): no death and no score, and its
   * walking direction flips when its middle is left of the block's (`if (nx < g.hMidX) vx = -vx`).
   */
  protected override onBounce(src: DamageSource, _world: World): void {
    const mid = this.body.x + this.body.w / 2;
    if (mid < (src.fromX ?? mid)) this.body.vx = -this.body.vx;
    this.bumpPop();
  }

  update(world: World): void {
    const b = this.body;
    if (this.egg) {
      moveX(b, world.map, b.vx >> 4);
      this.fall(world, 0x00300);
      this.currentFrame = 'spiny-egg';
      if (b.onGround) {
        // Hatch facing the player.
        this.egg = false;
        const pl = world.nearestPlayer(b.x).body;
        b.vx = (pl.x + pl.w / 2 < b.x + b.w / 2 ? -1 : 1) * this.walkSpeed;
      }
    } else {
      this.patrol(world);
      this.currentFrame = `spiny-${(world.frame >> 3) & 1}`;
    }
    if (this.isBelowLevel() || b.y > px(240)) this.destroy();
  }
}
