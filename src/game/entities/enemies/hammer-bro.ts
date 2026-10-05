import { px, toPx, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import type { World } from '../../world/world';
import { moveX } from '../body';
import { Projectile, HAMMER } from '../projectiles/projectile';

const SHUFFLE_SPEED = 0x00400; // 0.25 px/f
const ADVANCE_SPEED = 0x00800; // 0.5 px/f
const ADVANCE_AFTER = 600; // frames of standing before walking at the player
const HOP_UP = 0x05000; // 5 px/f
const VOLLEY_SIZE = 3;
const VOLLEY_GAP = 16;

/**
 * Hammer Bro: shuffles on its row facing the player, throws hammers in volleys of three, and
 * hops between the brick rows it lives on. After a while (or once passed) it walks at you; a
 * chasing one (The Lost Levels) walks at you from the start.
 */
export class HammerBro extends Enemy {
  readonly kind = 'hammer-bro';
  private readonly homeX: number;
  private age = 0;
  private shuffleDir: -1 | 1 = -1;
  private throwTimer = 60;
  private volley = 0;
  private volleyTimer = 0;
  private hopTimer = 150;
  /** Frames left of tile-free rising (hopping up through a platform). */
  private rising = 0;
  /** Frames left of tile-free falling (dropping through the floor). */
  private dropping = 0;

  constructor(
    x: number,
    y: number,
    readonly chase = false,
  ) {
    super(x, y, 12, 22);
    this.homeX = x;
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.scoreValue = 1000;
    this.fallsOffLedges = false;
    this.currentFrame = 'hammer-bro-1';
    this.body.vx = 0;
  }

  update(world: World): void {
    const b = this.body;
    const pl = world.nearestPlayer(b.x).body;
    const passed = pl.x > b.x + px(24);
    this.age++;
    this.facing = pl.x + pl.w / 2 < b.x + b.w / 2 ? -1 : 1;

    // Horizontal: shuffle around home, or advance on the player.
    if (this.chase || this.age > ADVANCE_AFTER || passed) {
      b.vx = this.facing * ADVANCE_SPEED;
      this.fallsOffLedges = true;
    } else {
      if (b.x < this.homeX - px(16)) this.shuffleDir = 1;
      else if (b.x > this.homeX + px(16)) this.shuffleDir = -1;
      else if (this.age % 48 === 0) this.shuffleDir = world.rng.chance(0.5) ? -1 : 1;
      b.vx = this.shuffleDir * SHUFFLE_SPEED;
    }
    moveX(b, world.map, velToSub(b.vx));
    if (b.hitWall !== 0) this.shuffleDir = -b.hitWall as -1 | 1;

    // Vertical: hops through platforms, otherwise normal gravity.
    if (this.rising > 0) {
      this.rising--;
      b.vy += 0x00400;
      b.y += velToSub(b.vy);
      if (b.vy >= 0) this.rising = 0;
    } else if (this.dropping > 0) {
      this.dropping--;
      b.vy += 0x00400;
      b.y += velToSub(b.vy);
    } else {
      this.fall(world);
      if (b.onGround && --this.hopTimer <= 0) {
        this.hopTimer = 180 + world.rng.int(120);
        this.tryHop(world);
      }
    }

    // Hammers.
    if (this.volley > 0) {
      if (--this.volleyTimer <= 0) {
        this.volley--;
        this.volleyTimer = VOLLEY_GAP;
        this.throwHammer(world);
      }
    } else if (--this.throwTimer <= 0) {
      this.throwTimer = 90 + world.rng.int(60);
      this.volley = VOLLEY_SIZE;
      this.volleyTimer = 12;
    }
    const armUp = this.volley > 0 && this.volleyTimer > 4;
    this.currentFrame = armUp ? 'hammer-bro-0' : `hammer-bro-${(world.frame >> 3) & 1}`;
    if (this.isBelowLevel()) this.destroy();
  }

  private throwHammer(world: World): void {
    const b = this.body;
    const vx = this.facing * (0x00c00 + world.rng.int(0x00800));
    const vy = -(0x03800 + world.rng.int(0x01000));
    world.spawn(new Projectile(b.x + px(2), b.y - px(8), this.facing, HAMMER, this, { vx, vy }));
  }

  /** Hop up onto a solid row 3-5 tiles above, else drop through to ground 2-8 rows below. */
  private tryHop(world: World): void {
    const b = this.body;
    const col = toPx(b.x + (b.w >> 1)) >> 4;
    const feetRow = toPx(b.y + b.h) >> 4;
    for (let r = feetRow - 3; r >= feetRow - 5; r--) {
      if (world.map.isSolid(col, r) && !world.map.isSolid(col, r - 1)) {
        b.vy = -HOP_UP;
        b.onGround = false;
        this.rising = 40;
        return;
      }
    }
    for (let r = feetRow + 2; r <= feetRow + 8; r++) {
      if (world.map.isSolid(col, r)) {
        b.vy = 0;
        b.onGround = false;
        this.dropping = 12;
        b.y += px(1);
        return;
      }
    }
  }

  protected override squash(world: World): void {
    world.audio.sfx('stomp');
    this.flipOut({ kind: 'stomp', amount: 1, owner: null, dirX: this.facing }, world);
  }
}
