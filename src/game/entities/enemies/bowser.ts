import { px, toPx, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import type { World } from '../../world/world';
import type { DamageSource } from '../../rules/damage';
import { Projectile, BOWSER_FLAME } from '../projectiles/projectile';
import { moveX } from '../body';

/** The castle boss: paces, hops and breathes fire. Five hits from fire/buster/sword, or the axe. */
export class Bowser extends Enemy {
  readonly kind = 'bowser';
  private readonly homeX: number;
  private jumpTimer = 0;
  private flameTimer = 120;
  private mouthOpen = 0;
  private dead = false;

  constructor(tx: number, ty: number) {
    super(px(tx * 16 + 2), px((ty + 1) * 16 - 30), 28, 30);
    this.homeX = this.body.x;
    this.hp = 5;
    this.scoreValue = 5000;
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.walkSpeed = 0x00800;
    this.vulnerability = {
      fireball: 'hp',
      buster: 'hp',
      sword: 'hp',
      stomp: 'hurtAttacker',
      star: 'immune',
      shell: 'immune',
      bump: 'immune',
      axe: 'kill',
    };
    this.body.vx = -this.walkSpeed;
    this.currentFrame = 'bowser-0';
  }

  protected override onHpHit(_src: DamageSource, _world: World): void {
    this.mouthOpen = 10;
  }

  fallDead(): void {
    this.dead = true;
    this.contactHurts = false;
    this.stompable = false;
    this.body.vx = 0;
  }

  update(world: World): void {
    const b = this.body;
    if (this.dead) {
      b.vy += 0x00400;
      b.y += velToSub(b.vy);
      if (this.isBelowLevel()) this.destroy();
      return;
    }
    if (world.bossClear) return;
    const p = world.player.body;
    // Pace within 3 tiles left of home, facing the player.
    moveX(b, world.map, velToSub(b.vx));
    if (b.x < this.homeX - px(48) || b.hitWall < 0) b.vx = this.walkSpeed;
    if (b.x > this.homeX + px(8) || b.hitWall > 0) b.vx = -this.walkSpeed;
    this.facing = p.x < b.x ? -1 : 1;
    if (--this.jumpTimer <= 0 && b.onGround) {
      this.jumpTimer = 120 + world.rng.int(120);
      if (world.rng.chance(0.5)) b.vy = -0x03000;
    }
    this.fall(world, 0x00200);
    if (--this.flameTimer <= 0) {
      this.flameTimer = 90 + world.rng.int(90);
      this.mouthOpen = 40;
      // Flame aims at the player's height.
      const y = Math.min(b.y + px(8), Math.max(b.y - px(32), p.y + px(4)));
      world.spawn(
        new Projectile(this.facing < 0 ? b.x - px(24) : b.x + b.w, y, this.facing, BOWSER_FLAME, this),
      );
      world.audio.sfx('bowser-flame');
    }
    if (this.mouthOpen > 0) this.mouthOpen--;
    const walk = (world.frame >> 4) & 1;
    this.currentFrame = this.mouthOpen > 0 ? `bowser-${2 + walk}` : `bowser-${walk}`;
  }

  get hpPx(): number {
    return toPx(this.body.x);
  }
}
