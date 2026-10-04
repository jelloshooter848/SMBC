import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import { Entity, type View } from '../entity';
import { overlaps } from '@engine/math/aabb';
import { moveX, moveY } from '../body';
import type { World } from '../../world/world';
import type { DamageKind } from '../../rules/damage';
import { Flash } from '../effects/effects';
import type { Player } from '../player';

export interface ProjectileSpec {
  kind: string;
  damage: DamageKind;
  amount: number;
  /** Horizontal speed (velocity units). */
  speed: number;
  gravity: number;
  /** Upward speed applied on landing, or null for no bounce. */
  bounceVy: number | null;
  /** Collide with tiles at all (Bowser flames pass through). */
  hitsTiles: boolean;
  hitsEnemies: boolean;
  hitsPlayer: boolean;
  /** Frames before it fades on its own; null = until off screen. */
  lifetime: number | null;
  w: number;
  h: number;
  sheet: string;
  frames: string[];
  frameRate: number;
  /** Frame shown briefly when the projectile dies on a wall. */
  burstFrame?: string;
  /** Keeps going after hitting an enemy (each enemy is hit once). */
  pierce?: boolean;
  /** Initial vertical speed (velocity units); callers can override per shot. */
  vy?: number;
  /** Falls under gravity and dies on landing (no bounce). */
  arc?: boolean;
  /** Steers toward the nearest live enemy: `turn` per frame up to `maxSpeed`. */
  homing?: { turn: number; maxSpeed: number };
  /** Circles the owner (radius px, degrees per frame) until thrown. */
  orbit?: { radius: number; step: number };
  /** Comes back to the owner after N frames and vanishes when it reaches them. */
  returns?: { after: number };
  /** A wall hit on a brick breaks it (as the owner's head bump would). */
  breaksBricks?: boolean;
  /** Destroys enemy projectiles it touches (shields, leaf guards). */
  blocks?: boolean;
  /** Ignores tiles while still being a player shot that stops on enemies. */
  piercesTiles?: boolean;
  /** Snakes up and down around its launch height (px amplitude, frames per cycle). */
  wave?: { amplitude: number; period: number };
  /** An arcing projectile leaves this behind where it lands (holy water's flame). */
  spawnOnLand?: ProjectileSpec;
}

export interface ProjectileOptions {
  vx?: number;
  vy?: number;
}

export const FIREBALL: ProjectileSpec = {
  kind: 'fireball',
  damage: 'fireball',
  amount: 1,
  speed: 0x04000,
  gravity: 0x00800,
  bounceVy: -0x03800,
  hitsTiles: true,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  w: 8,
  h: 8,
  sheet: 'items',
  frames: ['fireball-0', 'fireball-1', 'fireball-2', 'fireball-3'],
  frameRate: 2,
  burstFrame: 'fireball-3',
};

export const BUSTER: ProjectileSpec = {
  kind: 'buster',
  damage: 'buster',
  amount: 1,
  speed: 0x04000,
  gravity: 0,
  bounceVy: null,
  hitsTiles: true,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  w: 8,
  h: 6,
  sheet: 'items',
  frames: ['buster-0', 'buster-1'],
  frameRate: 3,
};

export const CHARGED_BUSTER: ProjectileSpec = {
  ...BUSTER,
  kind: 'buster-charged',
  amount: 3,
  pierce: true,
  w: 16,
  h: 12,
};

export const SWORD_BEAM: ProjectileSpec = {
  ...BUSTER,
  kind: 'sword-beam',
  damage: 'sword',
  speed: 0x03000,
  w: 16,
  h: 8,
  frames: ['sword-beam'],
  frameRate: 1,
};

export const BOWSER_FLAME: ProjectileSpec = {
  kind: 'bowser-flame',
  damage: 'contact',
  amount: 1,
  speed: 0x01800,
  gravity: 0,
  bounceVy: null,
  hitsTiles: false,
  hitsEnemies: false,
  hitsPlayer: true,
  lifetime: null,
  w: 24,
  h: 8,
  sheet: 'items',
  frames: ['bowser-flame-0', 'bowser-flame-1'],
  frameRate: 4,
};

export class Projectile extends Entity {
  readonly kind: string;
  age = 0;
  /** Enemies already hit (piercing shots hit each enemy once). */
  readonly hitIds = new Set<number>();
  /** Orbiting projectiles stay with the owner until thrown. */
  thrown = false;
  /** Boomerang on its way back. */
  returning = false;
  private angle = 0;
  private readonly originY: number;
  constructor(
    x: number,
    y: number,
    dirX: -1 | 1,
    readonly spec: ProjectileSpec,
    readonly owner: Entity | Player | null,
    opts: ProjectileOptions = {},
  ) {
    super(x, y, spec.w, spec.h);
    this.kind = spec.kind;
    this.body.vx = opts.vx ?? dirX * spec.speed;
    this.body.vy = opts.vy ?? spec.vy ?? 0;
    this.facing = dirX;
    this.layer = 'front';
    this.despawnMargin = 16;
    if (spec.orbit) this.angle = dirX > 0 ? 0 : 180;
    this.originY = y;
  }

  private get ownerGone(): boolean {
    const o = this.owner;
    if (!o) return true;
    return 'alive' in o ? !o.alive : o.dead || o.out;
  }

  /** Release an orbiting projectile in the owner's facing direction. */
  throw(dirX: -1 | 1): void {
    this.thrown = true;
    this.facing = dirX;
    this.body.vx = dirX * this.spec.speed;
    this.body.vy = 0;
  }

  update(world: World): void {
    const b = this.body;
    this.age++;
    if (this.spec.lifetime !== null && this.age > this.spec.lifetime) return this.destroy();
    if (this.spec.orbit && !this.thrown) return this.orbitOwner();
    if (this.spec.returns && this.age > this.spec.returns.after) this.returning = true;
    if (this.returning) {
      if (this.ownerGone) return this.destroy();
      const ob = (this.owner as Entity | Player).body;
      const tx = ob.x + (ob.w >> 1) - (b.w >> 1);
      const ty = ob.y + (ob.h >> 1) - (b.h >> 1);
      this.steerTo(tx, ty, this.spec.speed, this.spec.speed);
      b.x += velToSub(b.vx);
      b.y += velToSub(b.vy);
      if (overlaps(b, ob)) this.destroy();
      return;
    }
    if (this.spec.homing) {
      const e = world.nearestEnemy(b.x, b.y);
      if (e) {
        const h = this.spec.homing;
        this.steerTo(
          e.body.x + (e.body.w >> 1) - (b.w >> 1),
          e.body.y + (e.body.h >> 1) - (b.h >> 1),
          h.turn,
          h.maxSpeed,
        );
      }
    }
    if (this.spec.hitsTiles && !this.spec.piercesTiles) {
      moveX(b, world.map, velToSub(b.vx));
      if (b.hitWall !== 0) {
        if (this.spec.breaksBricks)
          world.breakAt(b.x + (b.hitWall > 0 ? b.w : -1), b.y + (b.h >> 1), this.owner);
        return this.burst(world);
      }
      if (this.spec.gravity || this.spec.arc) {
        b.vy += this.spec.gravity || 0x00400;
        if (b.vy > 0x04000) b.vy = 0x04000;
        moveY(b, world.map, velToSub(b.vy));
        if (b.onGround && this.spec.arc) {
          const s = this.spec.spawnOnLand;
          if (s) {
            const x = b.x + (b.w >> 1) - px(s.w >> 1);
            world.spawn(new Projectile(x, b.y + b.h - px(s.h), this.facing, s, this.owner, { vx: 0 }));
          }
          return this.burst(world);
        }
        if (b.onGround && this.spec.bounceVy !== null) b.vy = this.spec.bounceVy;
        else if (b.onGround) b.vy = 0;
        if (b.hitHead) b.vy = 0;
      } else if (b.vy !== 0) {
        moveY(b, world.map, velToSub(b.vy));
        if (b.onGround || b.hitHead) return this.burst(world);
      }
    } else {
      // Free flight: tiles are ignored, but gravity still applies when the spec asks for it.
      if (this.spec.gravity) {
        b.vy += this.spec.gravity;
        if (b.vy > 0x04000) b.vy = 0x04000;
      }
      b.x += velToSub(b.vx);
      b.y += velToSub(b.vy);
      if (this.spec.wave && b.vx !== 0) {
        const w = this.spec.wave;
        b.y = this.originY + Math.round(Math.sin((this.age * 2 * Math.PI) / w.period) * px(w.amplitude));
      }
      if (this.spec.breaksBricks && this.spec.piercesTiles && (this.age & 3) === 0)
        world.breakAt(b.x + (b.w >> 1), b.y + (b.h >> 1), this.owner);
    }
    // Off the right or left of the camera: gone.
    const camL = world.camera.x - px(16);
    const camR = world.camera.right + px(16);
    if (b.x + b.w < camL || b.x > camR || this.isBelowLevel()) this.destroy();
  }

  private orbitOwner(): void {
    const o = this.spec.orbit;
    if (!o || this.ownerGone) return this.destroy();
    this.angle = (this.angle + o.step) % 360;
    const rad = (this.angle * Math.PI) / 180;
    const ob = (this.owner as Entity | Player).body;
    const b = this.body;
    b.x = ob.x + (ob.w >> 1) - (b.w >> 1) + Math.round(Math.cos(rad) * px(o.radius));
    b.y = ob.y + (ob.h >> 1) - (b.h >> 1) + Math.round(Math.sin(rad) * px(o.radius));
  }

  /** Turn the velocity toward a target point by at most `turn` per axis, capped at `max`. */
  private steerTo(tx: number, ty: number, turn: number, max: number): void {
    const b = this.body;
    const dx = tx - b.x;
    const dy = ty - b.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const wantX = (dx / len) * max;
    const wantY = (dy / len) * max;
    b.vx += Math.max(-turn, Math.min(turn, wantX - b.vx));
    b.vy += Math.max(-turn, Math.min(turn, wantY - b.vy));
    b.vx = Math.round(b.vx);
    b.vy = Math.round(b.vy);
    if (b.vx !== 0) this.facing = b.vx > 0 ? 1 : -1;
  }

  /** Dies with a little burst (wall hit or enemy hit). */
  burst(world: World): void {
    if (this.spec.burstFrame) {
      world.spawn(new Flash(this.body.x, this.body.y, this.spec.sheet, this.spec.burstFrame, 6, -4, -4));
    }
    this.destroy();
  }

  render(r: Renderer, view: View): void {
    const f = this.spec.frames[
      Math.floor(this.age / this.spec.frameRate) % this.spec.frames.length
    ] as string;
    r.sprite(
      view.assets.sheet(this.spec.sheet),
      f,
      toPx(this.body.x) - view.camX,
      toPx(this.body.y),
      this.facing > 0,
    );
  }
}
