import { px, tileAt, velToSub } from '@engine/math/units';
import { overlaps } from '@engine/math/aabb';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import { moveX, moveY } from '../../entities/body';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { CROSS, DAGGER, HAND_AXE, HOLY_FIRE, HOLY_WATER } from './weapons';

/**
 * Classic SMBC Simon's weapons (2026-10-07-simon-classic-smbc-rules.md SI-C14..SI-C28), from
 * Simon.as and SimonProjectile.as (SMBC 3.1.21). Flash px/s ÷ 120 = px/f, px/s² ÷ 7200 = px/f²,
 * Flash px ÷ 2 = px, ms ÷ 16.67 = frames; velocities in 1/4096 px/f. Damage is in the original's
 * units (DamageValue.as; a Goomba has 250 HP), read by the Classic enemy and brick rules.
 */

/** The whip's three 115 ms steps at 60 fps (SI-C14): live from frame 14, over at frame 21. */
export const WHIP_LIVE_FROM = 14;
export const ACTION_FRAMES = 21;
/** A thrown weapon appears on this frame of the throw, when the hearts are paid (SI-C18). */
export const THROW_AT = 14;
/** The 400 ms hit freeze of every whip and sub-weapon hit (SI-C17). */
export const HIT_FREEZE = 24;
/** The Stopwatch's level-wide freeze (3000 ms, SI-C25) and cost. */
export const STOPWATCH_FRAMES = 180;
export const STOPWATCH_COST = 5;

/** Whip damage by power state (SI-C16): Leather, Morning Star, Flame Whip. */
export const WHIP_DAMAGE: Readonly<Record<string, number>> = { small: 200, big: 275, fire: 400 };
/** Whip reach in px from his centre (SI-C15): Leather and Morning Star 36, Flame Whip 51. */
export const WHIP_REACH: Readonly<Record<string, number>> = { small: 36, big: 36, fire: 51 };
/** The whip box starts this far ahead of his centre (px, 15 Flash px). */
export const WHIP_NEAR = 7.5;
/** The whip box's height above the feet (px): standing 24 to 17, crouching 15 to 8 (SI-C15). */
export const WHIP_Y = { stand: [24, 17], crouch: [15, 8] } as const;
/** Shot cap by power state (SI-C19): 1, Double, Triple. */
export const SHOT_CAP: Readonly<Record<string, number>> = { small: 1, big: 2, fire: 3 };
/** A thrown weapon's centre (SI-C20): px ahead of his centre, px above the feet (crouched 15). */
export const THROW_AHEAD = 11;
export const THROW_UP = 25;
export const THROW_UP_CROUCH = 15;

const HIT = { stopFrames: HIT_FREEZE } as const;
/** Holy Water pierces armour (PIERCE_STR_ARMOR_PIERCING 6; HP report pierce table). */
const PIERCING_HIT = { stopFrames: HIT_FREEZE, pierce: 6 } as const;

/** Axe (SI-C21): 1 heart, 350. vx 250, vy −560, gravity 1500, fall cap 900; through everything. */
export const AXE_CLASSIC: ProjectileSpec = {
  ...HAND_AXE,
  amount: 350,
  speed: 0x02155,
  vy: -0x04aab,
  gravity: 0x00355,
  maxFall: 0x07800,
  lifetime: null,
  pierce: true,
  classicHit: HIT,
  onBlocked: 'continue',
  classicBlocks: { ground: 'pass', afterBlock: 'continue', strikesBlocks: true },
};

/** Cross (SI-C22): 2 hearts, 300. 200 px/s out to 220 Flash px, then back at 700 px/s². */
export const CROSS_CLASSIC: ProjectileSpec = {
  ...CROSS,
  amount: 300,
  speed: 0x01aab,
  lifetime: null,
  pierce: true,
  classicHit: HIT,
  onBlocked: 'continue',
  classicBlocks: { ground: 'pass', afterBlock: 'continue', strikesBlocks: true },
};
/** px the Cross flies past its spawn point before it slows (CROSS_DISTANCE 220 Flash px). */
export const CROSS_DISTANCE = 110;
/** The Cross's turn-back acceleration (CROSS_AX 700 px/s²: 0.0972 px/f²). */
export const CROSS_AX = 0x0018e;

/** Dagger (SI-C23): 1 heart, 300, 500 px/s; through plain ground, stopped by blocks and enemies. */
export const DAGGER_CLASSIC: ProjectileSpec = {
  ...DAGGER,
  amount: 300,
  speed: 0x042ab,
  classicHit: HIT,
  onBlocked: 'remove',
  classicBlocks: { ground: 'pass', afterBlock: 'end', strikesBlocks: true },
};

/**
 * Holy Water's flame (SI-C24): 200, armour-piercing, still; re-hits an enemy every 400 ms, lasts
 * 9 animation frames of 130 ms (70 f); ignores plain ground, strikes bricks it touches.
 */
export const HOLY_FLAME_CLASSIC: ProjectileSpec = {
  ...HOLY_FIRE,
  kind: 'holy-fire',
  amount: 200,
  lifetime: 70,
  frameRate: 8,
  pierce: true,
  rehitAfter: HIT_FREEZE,
  classicHit: PIERCING_HIT,
  onBlocked: 'continue',
  classicBlocks: { ground: 'pass', afterBlock: 'continue', strikesBlocks: true },
};

/**
 * Holy Water's bottle (SI-C24): 1 heart, 50, armour-piercing, through enemies; vx 250, vy −100,
 * gravity 1200. Any ground, wall, ceiling or block turns it into the flame (HolyWaterBottle).
 */
export const HOLY_WATER_CLASSIC: ProjectileSpec = {
  ...HOLY_WATER,
  amount: 50,
  speed: 0x02155,
  vy: -0x00d55,
  gravity: 0x002ab,
  arc: false,
  pierce: true,
  classicHit: PIERCING_HIT,
  onBlocked: 'continue',
  classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: true },
};

/** Every Classic sub-weapon kind, for the shot cap (SI-C19). */
export const SIMON_SHOT_KINDS: ReadonlySet<string> = new Set([
  AXE_CLASSIC.kind,
  CROSS_CLASSIC.kind,
  DAGGER_CLASSIC.kind,
  HOLY_WATER_CLASSIC.kind,
  HOLY_FLAME_CLASSIC.kind,
]);

/**
 * The Classic Cross (SimonProjectile TYPE_CROSS, SI-C22): straight out with no gravity; past
 * CROSS_DISTANCE it slows and comes back along the same line, up to its speed again. The screen
 * edge on the way out turns it at once at full speed. Only on the way back does it touch Simon,
 * who catches it (it vanishes); it can hit an enemy again on the way back. It passes ground and
 * enemies and strikes the blocks it crosses.
 */
export class ClassicCross extends Projectile {
  private readonly endX: number;
  private readonly dir: -1 | 1;
  private ax = 0;
  constructor(x: number, y: number, dir: -1 | 1, owner: Player) {
    super(x, y, dir, CROSS_CLASSIC, owner);
    this.dir = dir;
    this.endX = x + dir * px(CROSS_DISTANCE);
  }

  override update(world: World): void {
    const b = this.body;
    this.age++;
    b.x += velToSub(b.vx);
    const max = this.spec.speed;
    if (!this.returning) {
      if (this.ax === 0) {
        if ((this.dir > 0 && b.x > this.endX) || (this.dir < 0 && b.x < this.endX))
          this.ax = -this.dir * CROSS_AX;
      } else {
        b.vx += this.ax;
        if (Math.sign(b.vx) === -this.dir) this.turn();
      }
      const cx = b.x + (b.w >> 1);
      if (cx + (b.w >> 1) >= world.camera.right || cx - (b.w >> 1) <= world.camera.x) {
        b.vx = -this.dir * max;
        this.turn();
      }
    } else {
      if (this.ax !== 0) b.vx = Math.max(-max, Math.min(max, b.vx + this.ax));
      const o = this.owner as Player;
      if (o.dead || o.out) return this.destroy();
      if (overlaps(b, o.body)) return this.destroy();
    }
    world.shotBlocks(this);
    const camL = world.camera.x - px(16);
    const camR = world.camera.right + px(16);
    if (b.x + b.w < camL || b.x > camR) this.destroy();
  }

  private turn(): void {
    this.returning = true;
    this.facing = -this.dir as -1 | 1;
    // It can hit each enemy again on the way back.
    this.hitIds.clear();
  }
}

/**
 * The Holy Water bottle (SI-C24, SI-C28): arcs with gravity; on touching any ground, wall,
 * ceiling or block it becomes the flame where it is, and the burst strikes a block it hit with
 * the flame's 200 (a brick breaks, a ? block bumps).
 */
export class HolyWaterBottle extends Projectile {
  constructor(x: number, y: number, dir: -1 | 1, owner: Player) {
    super(x, y, dir, HOLY_WATER_CLASSIC, owner);
  }

  override update(world: World): void {
    const b = this.body;
    this.age++;
    b.vy += this.spec.gravity;
    if (b.vy > 0x04000) b.vy = 0x04000;
    moveX(b, world.map, velToSub(b.vx));
    if (b.hitWall !== 0) return this.explode(world, b.x + (b.hitWall > 0 ? b.w : -1), b.y + (b.h >> 1));
    moveY(b, world.map, velToSub(b.vy));
    if (b.onGround) return this.explode(world, b.x + (b.w >> 1), b.y + b.h);
    if (b.hitHead) return this.explode(world, b.x + (b.w >> 1), b.y - 1);
    const camL = world.camera.x - px(16);
    const camR = world.camera.right + px(16);
    if (b.x + b.w < camL || b.x > camR || this.isBelowLevel()) this.destroy();
  }

  private explode(world: World, x: number, y: number): void {
    const b = this.body;
    const s = HOLY_FLAME_CLASSIC;
    const flame = new HolyFlame(b.x + (b.w >> 1) - px(s.w >> 1), b.y + b.h - px(s.h), this.owner as Player);
    world.spawn(flame);
    world.shotBlockAt(flame, x, y);
    // The flame does not strike that block again while it touches it.
    flame.touchingTiles().add(`${tileAt(x)},${tileAt(y)}`);
    world.audio.sfx('fireball');
    this.destroy();
  }
}

/** The Holy Water flame: re-hits an enemy inside it every HIT_FREEZE frames (SI-C24). */
export class HolyFlame extends Projectile {
  constructor(x: number, y: number, owner: Player) {
    super(x, y, owner.facing, HOLY_FLAME_CLASSIC, owner, { vx: 0, vy: 0 });
  }

  override update(world: World): void {
    for (const id of [...this.hitIds]) {
      if (world.frame - (this.hitAt?.get(id) ?? -Infinity) < HIT_FREEZE) continue;
      this.hitIds.delete(id);
      this.hitAt?.delete(id);
    }
    super.update(world);
  }
}
