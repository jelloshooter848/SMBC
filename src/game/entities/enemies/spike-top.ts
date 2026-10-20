import { Enemy } from './enemy';
import { ENEMY_SCORES } from '../../rules/score';
import type { World } from '../../world/world';
import type { DamageSource } from '../../rules/damage';

/**
 * Spike Top (com/smbc/enemies/SpikeTop.as; Classic mode's Replace Goombas choice): a Goomba
 * (`extends Goomba`: its size, walk, gravity and two walking frames) that cannot be stomped
 * (`stompable = false`, `stomp()` does nothing, so landing on it hurts), is armoured
 * (`PR_PIERCE_PAS, PIERCE_STR_ARMORED`), pops up off a block bumped under it (`gBounceHit`, as a
 * Spiny), and turns to face the player each time it lands from a fall that was not a pop.
 *
 * Its scores and hit points are the Goomba's: SpikeTop.overwriteInitialStats sets the BEETLE_*
 * scores and HealthValue.SPIKE_TOP (600), then calls Goomba's, which sets the GOOMBA_* ones and
 * HealthValue.GOOMBA (250) over them (as Buzzy Beetles end up with the Koopa's).
 */
export class SpikeTop extends Enemy {
  readonly kind = 'spike-top';
  /** Off the ground last frame (`falling`). */
  private falling = false;
  /** That fall was a pop off a bumped block (`bounced`): it lands without turning. */
  private bounced = false;

  constructor(x: number, y: number) {
    super(x, y, 12, 14);
    this.sheet = 'spike-top';
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.currentFrame = 'spike-top-0';
    this.scores = ENEMY_SCORES.GOOMBA;
    this.corpseGravity = 0x0031c; // Goomba.setStats: gravity = 1400 Flash px/s² (0.194 px/f²)
    this.stompable = false;
    // Current rules (a custom level's): fireballs bounce off its shell, as off a Buzzy Beetle's.
    this.vulnerability = { ...this.vulnerability, fireball: 'immune', bump: 'bounce' };
  }

  /** A block bumped under it pops it up and turns it when its middle is left of the block's. */
  protected override onBounce(src: DamageSource, _world: World): void {
    const mid = this.body.x + this.body.w / 2;
    if (mid < (src.fromX ?? mid)) this.body.vx = -this.body.vx;
    this.bounced = true;
    this.bumpPop();
  }

  update(world: World): void {
    const b = this.body;
    this.patrol(world);
    // SpikeTop.checkState: in the air it is falling; landing from a fall (not a pop) it turns to
    // the player (`if (nx > player.nx) vx = -xSpeed else vx = xSpeed`).
    if (!b.onGround) this.falling = true;
    else {
      if (this.falling && !this.bounced) {
        const pl = world.nearestPlayer(b.x).body;
        b.vx = (b.x + b.w / 2 > pl.x + pl.w / 2 ? -1 : 1) * this.walkSpeed;
        this.facing = b.vx > 0 ? 1 : -1;
      } else this.bounced = false;
      this.falling = false;
    }
    this.currentFrame = `spike-top-${(world.frame >> 3) & 1}`;
    if (this.isBelowLevel()) this.destroy();
  }
}
