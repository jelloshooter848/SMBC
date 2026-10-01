import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import { Entity, type View } from '../entity';
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
  pierce?: boolean;
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
  private age = 0;
  constructor(
    x: number,
    y: number,
    dirX: -1 | 1,
    readonly spec: ProjectileSpec,
    readonly owner: Entity | Player | null,
  ) {
    super(x, y, spec.w, spec.h);
    this.kind = spec.kind;
    this.body.vx = dirX * spec.speed;
    this.facing = dirX;
    this.layer = 'front';
    this.despawnMargin = 16;
  }

  update(world: World): void {
    const b = this.body;
    this.age++;
    if (this.spec.lifetime !== null && this.age > this.spec.lifetime) return this.destroy();
    if (this.spec.hitsTiles) {
      moveX(b, world.map, velToSub(b.vx));
      if (b.hitWall !== 0) return this.burst(world);
      if (this.spec.gravity) {
        b.vy += this.spec.gravity;
        if (b.vy > 0x04000) b.vy = 0x04000;
        moveY(b, world.map, velToSub(b.vy));
        if (b.onGround && this.spec.bounceVy !== null) b.vy = this.spec.bounceVy;
        else if (b.onGround) b.vy = 0;
        if (b.hitHead) b.vy = 0;
      }
    } else {
      b.x += velToSub(b.vx);
      b.y += velToSub(b.vy);
    }
    // Off the right or left of the camera: gone.
    const camL = world.camera.x - px(16);
    const camR = world.camera.right + px(16);
    if (b.x + b.w < camL || b.x > camR || this.isBelowLevel()) this.destroy();
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
