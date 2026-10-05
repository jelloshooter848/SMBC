import { px, toPx, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import { ENEMY_SCORES } from '../../rules/score';
import type { World } from '../../world/world';
import type { DamageSource } from '../../rules/damage';
import { Projectile, BOWSER_FLAME, HAMMER } from '../projectiles/projectile';
import { moveX } from '../body';

export type BowserAttack = 'fire' | 'hammer' | 'both';

const HAMMER_VOLLEY = 5;
const HAMMER_GAP = 8;

/**
 * The castle boss: paces, hops and breathes fire; later castles' Bowsers throw volleys of
 * hammers instead of (or as well as) fire. Five hits from fire/buster/sword, or the axe.
 */
export class Bowser extends Enemy {
  readonly kind = 'bowser';
  private readonly homeX: number;
  private jumpTimer = 0;
  private flameTimer = 120;
  private mouthOpen = 0;
  private dead = false;
  private hammerTimer = 90;
  private volley = 0;
  private volleyTimer = 0;

  constructor(
    tx: number,
    ty: number,
    readonly attack: BowserAttack = 'fire',
    /** The Lost Levels' fake Bowser: a plain fight, not the bridge boss the axe drops. */
    readonly fake = false,
  ) {
    super(px(tx * 16 + 2), px((ty + 1) * 16 - 30), 28, 30);
    this.homeX = this.body.x;
    this.hp = 5;
    this.scores = ENEMY_SCORES.BOWSER;
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
      bomb: 'hp',
      weapon: 'hp',
      boomerang: 'immune',
      ice: 'immune',
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
    const p = world.nearestPlayer(b.x).body;
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
    if (this.attack !== 'fire') this.throwHammers(world);
    if (this.attack !== 'hammer' && --this.flameTimer <= 0) {
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

  /** Volleys of hammers lobbed from above the head toward the player. */
  private throwHammers(world: World): void {
    const b = this.body;
    if (this.volley > 0) {
      if (--this.volleyTimer > 0) return;
      this.volley--;
      this.volleyTimer = HAMMER_GAP;
      this.mouthOpen = Math.max(this.mouthOpen, 6);
      const vx = this.facing * (0x00a00 + world.rng.int(0x00c00));
      const vy = -(0x03800 + world.rng.int(0x01000));
      const x = this.facing < 0 ? b.x + px(2) : b.x + b.w - px(12);
      world.spawn(new Projectile(x, b.y - px(10), this.facing, HAMMER, this, { vx, vy }));
      return;
    }
    if (--this.hammerTimer <= 0) {
      this.hammerTimer = 80 + world.rng.int(60);
      this.volley = HAMMER_VOLLEY;
      this.volleyTimer = 1;
    }
  }

  get hpPx(): number {
    return toPx(this.body.x);
  }
}
