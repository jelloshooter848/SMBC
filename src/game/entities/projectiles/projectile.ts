import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import { Entity, type View } from '../entity';
import { overlaps } from '@engine/math/aabb';
import { moveX, moveY } from '../body';
import type { World } from '../../world/world';
import type { ClassicHitProps, DamageKind } from '../../rules/damage';
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
  /**
   * Goes on through an enemy it defeats, stops (bursts) on one it only hurts or can't hurt (the
   * original's PR_PASSTHROUGH_DEFEAT: Mega Man's full charge shot).
   */
  pierceDefeat?: boolean;
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
  /**
   * Takes the coins, items and drops it touches and carries them back to its owner, who gets
   * them when it returns (Link's boomerang, Zelda's fetch: World.boomerangFetch / deliverFetch).
   */
  fetches?: boolean;
  /** A wall hit on a brick breaks it (as the owner's head bump would). */
  breaksBricks?: boolean;
  /** Destroys enemy projectiles it touches (shields, leaf guards). */
  blocks?: boolean;
  /** Ignores tiles while still being a player shot that stops on enemies. */
  piercesTiles?: boolean;
  /**
   * Flying through tiles, it bumps the blocks it crosses, each once, as its owner's head would
   * (0.4.46, owner #23): 'all' every ? block and brick (Mega Man's campaign charge shot), 'question'
   * only ? blocks (Simon's campaign axe). Its centre decides which tile it is crossing.
   */
  bumpsBlocks?: 'all' | 'question';
  /** Snakes up and down around its launch height (px amplitude, frames per cycle). */
  wave?: { amplitude: number; period: number };
  /** An arcing projectile leaves this behind where it lands (holy water's flame). */
  spawnOnLand?: ProjectileSpec;
  /**
   * Classic rules: what a hit does beyond its `amount` (pierce, hit-stun, flash, invulnerability,
   * freeze, blocked sound; classic-enemy-hp-and-armour HP-C16). Only Classic weapon specs set it.
   */
  classicHit?: ClassicHitProps;
  /**
   * Classic rules: what the shot does when armour blocks it (HP-C14): 'burst' (the default: ends
   * with its burst), 'remove' (gone), 'continue' (flies on) or 'deflect' (bounces back up and
   * hits nothing more: Mega Man's buster and Metal Blade).
   */
  onBlocked?: 'burst' | 'deflect' | 'continue' | 'remove';
  /**
   * Classic rules: how the shot meets tiles and blocks (TG-26, classic-bricks-and-shots BR-C2).
   * Specs that leave it out keep the flags above, so Current shots are unchanged.
   */
  classicBlocks?: ClassicBlocks;
  /**
   * Classic rules (HP-C20, Ryu's Windmill Shuriken): an enemy it has hit can be hit again once the
   * shot has left it and this many frames have passed since that hit. Without it each enemy is
   * hit once.
   */
  rehitAfter?: number;
}

/** A Classic shot's tile rules (BR-C2, BR-C9, BR-C16). */
export interface ClassicBlocks {
  /**
   * 'pass': flies through every solid tile but still strikes bricks, ? blocks, item bricks and
   * hidden blocks; 'collide': stops at (or bounces on) every solid tile, striking a block it hits;
   * 'none': touches no tile at all (Link's boomerang).
   */
  ground: 'pass' | 'collide' | 'none';
  /**
   * After striking a block: 'end' (removed, broken or not), 'continue' (flies on, striking each
   * block once per contact) or 'continueIfBroken' (flies on when the block's HP is now 0 or less:
   * a broken brick or a bumped item block).
   */
  afterBlock: 'end' | 'continue' | 'continueIfBroken';
  /** False when blocks are only ground to it (Mario's fireball). */
  strikesBlocks: boolean;
}

export interface ProjectileOptions {
  vx?: number;
  vy?: number;
  /** Starting angle in degrees for orbiting projectiles. */
  angle?: number;
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

/**
 * Mega Man's full charge shot: a big blast, like the original Crossover's (MegaManProjectile
 * strongChargeShot: three times the buster's damage, MEGA_MAN_FULL_CHARGE_NORMAL 300 to
 * MEGA_MAN_MEGA_BUSTER 100, and PR_PASSTHROUGH_DEFEAT: on through what it defeats, stopped by
 * what it doesn't). 0.4.35: its own 24x16 art (items `charge-shot-0/1`) and body.
 */
export const CHARGED_BUSTER: ProjectileSpec = {
  ...BUSTER,
  kind: 'buster-charged',
  amount: 3,
  pierceDefeat: true,
  w: 24,
  h: 14,
  frames: ['charge-shot-0', 'charge-shot-1'],
  frameRate: 4,
};

/**
 * The campaign's full charge shot (0.4.46, owner #23): the same blast, flying through solid tiles
 * (blocks, pipes, walls) and bumping every ? block and brick it crosses, once each. Classic play
 * keeps CHARGED_BUSTER (the original's: a wall stops it).
 */
export const PIERCING_CHARGED_BUSTER: ProjectileSpec = {
  ...CHARGED_BUSTER,
  piercesTiles: true,
  bumpsBlocks: 'all',
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

/**
 * Link's Fire spell's shot (0.4.43): the sword beam's flight and hit as a fireball, so the spell
 * shows (a sword-beam all the same: one out at a time, and lessons count it as one).
 */
export const FIRE_BEAM: ProjectileSpec = {
  ...SWORD_BEAM,
  frames: ['spell-fire-0', 'spell-fire-1'],
  frameRate: 4,
};

/** Bowser's flame (BowserFireBall.as SPEED = 160 px/s: 1.33 px/f). */
export const BOWSER_FLAME: ProjectileSpec = {
  kind: 'bowser-flame',
  damage: 'contact',
  amount: 1,
  speed: 0x01555,
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

/**
 * A Hammer Bro's hammer: spins along an arc through everything, only the player minds it.
 * `com/smbc/projectiles/Hammer.as`: `xSpeed` 120 px/s, `jumpPwr` 200 px/s, `gravity` 500 px/s² on
 * 32-px tiles: 1.0 px/f across, 1.67 px/f up and 0.069 px/f² here, a low arc about 20 px high.
 */
export const HAMMER: ProjectileSpec = {
  kind: 'hammer',
  damage: 'contact',
  amount: 1,
  speed: 0x01000,
  vy: -0x01aab,
  gravity: 0x0011c,
  bounceVy: null,
  hitsTiles: false,
  hitsEnemies: false,
  hitsPlayer: true,
  lifetime: 300,
  w: 10,
  h: 10,
  sheet: 'enemies',
  frames: ['hammer-0', 'hammer-1'],
  frameRate: 4,
};

export class Projectile extends Entity {
  readonly kind: string;
  age = 0;
  /** Enemies already hit (piercing shots hit each enemy once). */
  readonly hitIds = new Set<number>();
  /** Blocks a block-bumping shot has bumped ("x,y"), each once (ProjectileSpec.bumpsBlocks). */
  readonly bumped = new Set<string>();
  /** Orbiting projectiles stay with the owner until thrown. */
  thrown = false;
  /** Boomerang on its way back. */
  returning = false;
  /** What a fetching boomerang carries (taken out of the level; drawn on it; World.deliverFetch). */
  readonly carried: Entity[] = [];
  /** Coins a fetching boomerang carries. */
  carriedCoins = 0;
  /** Classic: the frame each enemy was last hit (ProjectileSpec.rehitAfter; made on first use). */
  hitAt: Map<number, number> | null = null;
  /** Classic: deflected by armour (onBlocked 'deflect'); it hits nothing more. */
  deflected = false;
  /** Classic: block tiles ("x,y") the shot is touching now, each struck once per contact (made on first use). */
  touching: Set<string> | null = null;

  /** The Classic contact set, made on first use (Current shots never allocate it). */
  touchingTiles(): Set<string> {
    return (this.touching ??= new Set());
  }

  /** Classic re-hits: `id` was hit on `frame`. */
  markHit(id: number, frame: number): void {
    (this.hitAt ??= new Map()).set(id, frame);
  }
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
    if (spec.orbit) this.angle = opts.angle ?? (dirX > 0 ? 0 : 180);
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
    if (this.spec.lifetime !== null && this.age > this.spec.lifetime) return this.end(world);
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
      if (this.spec.fetches) world.boomerangFetch(this);
      if (overlaps(b, ob)) this.end(world);
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
    const cb = this.spec.classicBlocks;
    if (this.spec.hitsTiles && !this.spec.piercesTiles && (!cb || cb.ground === 'collide')) {
      moveX(b, world.map, velToSub(b.vx));
      if (b.hitWall !== 0) {
        const wx = b.x + (b.hitWall > 0 ? b.w : -1);
        if (this.spec.breaksBricks) world.breakAt(wx, b.y + (b.h >> 1), this.owner);
        if (cb) world.shotBlockAt(this, wx, b.y + (b.h >> 1));
        // Mega Man's airship: a cannon there takes the hit.
        world.shotWall(this, wx, b.y + (b.h >> 1));
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
        if (b.onGround || b.hitHead) {
          if (cb) world.shotBlockAt(this, b.x + (b.w >> 1), b.hitHead ? b.y - 1 : b.y + b.h);
          return this.burst(world);
        }
      }
      // A Classic shot that stops at ground still strikes the hidden blocks it flies into.
      if (cb && world.shotBlocks(this)) return this.burst(world);
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
      if (cb) {
        if (cb.ground === 'pass' && world.shotBlocks(this)) return this.burst(world);
      } else {
        if (this.spec.breaksBricks && this.spec.piercesTiles && (this.age & 3) === 0)
          world.breakAt(b.x + (b.w >> 1), b.y + (b.h >> 1), this.owner);
        if (this.spec.bumpsBlocks && world.pierceBlocks(this)) return this.burst(world);
      }
      if (this.spec.fetches) world.boomerangFetch(this);
    }
    // Off the right or left of the camera: gone.
    const camL = world.camera.x - px(16);
    const camR = world.camera.right + px(16);
    if (b.x + b.w < camL || b.x > camR || this.isBelowLevel()) this.end(world);
  }

  /**
   * Classic re-hits (ProjectileSpec.rehitAfter): enemies the shot no longer touches, hit at least
   * that long ago, can be hit again.
   */
  releaseHits(enemies: readonly Entity[], frame: number): void {
    const after = this.spec.rehitAfter ?? Infinity;
    for (const id of this.hitIds) {
      const e = enemies.find((x) => x.id === id);
      if (e && overlaps(e.body, this.body)) continue;
      if (frame - (this.hitAt?.get(id) ?? -Infinity) < after) continue;
      this.hitIds.delete(id);
      this.hitAt?.delete(id);
    }
  }

  /** Gone: what it carries goes to its owner first (World.deliverFetch). */
  private end(world: World): void {
    if (this.carried.length || this.carriedCoins) world.deliverFetch(this);
    this.destroy();
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
    // What it fetches rides on it, centred: its coins too (0.4.43: a coin it took from the level
    // used to vanish until the catch), each spinning, stacked a few pixels apart; the boomerang is
    // drawn over them, so it still shows.
    for (let i = 0; i < Math.min(this.carriedCoins, 3); i++)
      r.sprite(
        view.assets.sheet('items'),
        `coin-${((view.frame >> 2) + i) & 3}`,
        toPx(this.body.x + (this.body.w >> 1)) - 8 + i * 3 - view.camX,
        toPx(this.body.y + (this.body.h >> 1)) - 8 - i * 2,
      );
    for (const e of this.carried) {
      e.body.x = this.body.x + ((this.body.w - e.body.w) >> 1);
      e.body.y = this.body.y + ((this.body.h - e.body.h) >> 1);
      e.render(r, view);
    }
    r.sprite(
      view.assets.sheet(this.spec.sheet),
      f,
      toPx(this.body.x) - view.camX,
      toPx(this.body.y),
      this.facing > 0,
    );
  }
}
