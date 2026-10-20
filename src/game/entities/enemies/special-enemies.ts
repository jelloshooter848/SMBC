import { px, vel } from '@engine/math/units';
import { Enemy } from './enemy';
import { ENEMY_SCORES, type KillScores } from '../../rules/score';
import type { World } from '../../world/world';
import type { DamageSource } from '../../rules/damage';
import type { View } from '../entity';

/*
 * Super Mario Bros. Special's enemies (G-021): Icicle, Crab, Fly, Barrel and FireEnemy
 * (com/smbc/enemies/*.as). Normal in the Special map set; on Hard in SMB1 and The Lost Levels
 * (their HideOnDifficulties layers). Their art is our own (content/sprites/special-enemies.ts).
 *
 * The original's speeds are Flash px/s at twice our scale: `flashVel` and `flashGrav` turn them
 * into our velocity units (1/4096 px per frame at 60 frames a second).
 */

/** Flash px/s to velocity units (half the pixels, 60 frames a second). */
const flashVel = (v: number): number => vel(v / 120);
/** Flash px/s² to velocity units per frame. */
const flashGrav = (g: number): number => vel(g / 7200);

/** ScoreValue.as entries these use (BARREL_*, FLY_*; Crab and FireEnemy use SPINEY_*). */
export const SPECIAL_SCORES = {
  BARREL: { stomp: 100, attack: 100, star: 200, below: 100 },
  FLY: { stomp: 100, attack: 100, star: 100, below: 100 },
} as const satisfies Record<string, KillScores>;

/** Goomba.setStats: gravity 1400, the corpse's fall too. */
const GOOMBA_GRAVITY = 0x0031c;

/**
 * The Goomba-based ones (Crab, Barrel, FireEnemy `extends Goomba`): a 12x14 walker that cannot be
 * stomped (`stompable = false`, `stomp()` does nothing, so landing on it hurts) and that a block
 * bumped under it pops up instead of killing (`gBounceHit`: BOUNCE_AMT 350, BOUNCE_GRAVITY 1500,
 * the shared bump pop), turning it when its middle is left of the block's.
 */
abstract class GoombaKin extends Enemy {
  /** That fall was a pop off a bumped block (`bounced`). */
  protected bounced = false;

  constructor(x: number, y: number) {
    super(x, y, 12, 14);
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.corpseGravity = GOOMBA_GRAVITY;
    this.stompable = false;
    this.vulnerability = { ...this.vulnerability, stomp: 'hurtAttacker', bump: 'bounce' };
  }

  protected override onBounce(src: DamageSource, _world: World): void {
    const mid = this.body.x + this.body.w / 2;
    if (mid < (src.fromX ?? mid)) this.body.vx = -this.body.vx;
    this.bounced = true;
    this.bumpPop();
  }

  /** Turns to face where it walks, and is gone below the level. */
  protected finish(): void {
    if (this.body.vx !== 0) this.facing = this.body.vx > 0 ? 1 : -1;
    if (this.isBelowLevel()) this.destroy();
  }
}

/**
 * Barrel (Barrel.as): a rolling Goomba that cannot be stomped, is armoured
 * (`PR_PIERCE_PAS, PIERCE_STR_ARMORED`: fireballs bounce off under Current rules as off a Buzzy
 * Beetle) and hops off a bumped block. HealthValue.BARREL 400; BARREL_* scores.
 */
export class Barrel extends GoombaKin {
  readonly kind = 'barrel';

  constructor(x: number, y: number) {
    super(x, y);
    this.sheet = 'special-enemies';
    this.currentFrame = 'barrel-0';
    this.scores = SPECIAL_SCORES.BARREL;
    this.vulnerability = { ...this.vulnerability, fireball: 'immune' };
  }

  update(world: World): void {
    this.patrol(world);
    if (this.body.onGround) this.bounced = false;
    // It rolls: four frames a turn (the art turns its staves), every 6 frames.
    this.currentFrame = `barrel-${(world.frame >> 2) & 3}`;
    this.finish();
  }
}

/**
 * Crab (Crab.as): a Goomba-sized sidestepper that cannot be stomped. HealthValue.CRAB 600; the
 * first hit that leaves it at 400 or less makes it angry (Mario's fireball does only that: it sets
 * 400), as does a bumped block: it then has 400, walks ×1.66 (ANGRY_SPEED_MULTIPLIER) towards the
 * player, and turns to the player each time it lands from a fall that was not a pop. SPINEY_*
 * scores. Under Current rules its first hit only angers it (hp 2).
 */
export class Crab extends GoombaKin {
  readonly kind = 'crab';
  static readonly ANGRY_SPEED = 1.66;
  static readonly HP = 600;
  static readonly ANGRY_HP = 400;
  angry = false;
  private falling = false;

  constructor(x: number, y: number) {
    super(x, y);
    this.sheet = 'special-enemies';
    this.currentFrame = 'crab-0';
    this.scores = ENEMY_SCORES.SPINEY;
    this.hp = 2;
    this.vulnerability = {
      ...this.vulnerability,
      fireball: 'hp',
      sword: 'hp',
      buster: 'hp',
      weapon: 'hp',
      bomb: 'hp',
    };
  }

  /**
   * Angry now (Crab.takeDamage / gBounceHit): 400 hit points under Classic rules (raised to it
   * if a hit left fewer), faster, towards `world`'s nearest player. Not while frozen.
   */
  anger(world: World): void {
    if (this.angry || this.frozen > 0) return;
    this.angry = true;
    if (this.classicHp !== null) this.classicHp = Crab.ANGRY_HP;
    const b = this.body;
    const pl = world.nearestPlayer(b.x).body;
    const speed = Math.round(this.walkSpeed * Crab.ANGRY_SPEED);
    b.vx = (pl.x + pl.w / 2 < b.x + b.w / 2 ? -1 : 1) * speed;
  }

  protected override onBounce(src: DamageSource, world: World): void {
    super.onBounce(src, world);
    // gBounceHit: angry after the pop, keeping the direction the pop gave it.
    if (!this.angry) {
      const dir = Math.sign(this.body.vx) || -1;
      this.anger(world);
      this.body.vx = dir * Math.abs(this.body.vx);
    }
  }

  /** A hit it lives through: angry at 400 or fewer Classic hit points (any hit under Current). */
  protected override onHpHit(_src: DamageSource, world: World): void {
    if (world.rules !== 'classic' || (this.classicHp ?? 0) <= Crab.ANGRY_HP) this.anger(world);
  }

  update(world: World): void {
    const b = this.body;
    this.patrol(world);
    // Crab.checkState: landing from a fall (not a pop) while angry, it turns to the player.
    if (!b.onGround) this.falling = true;
    else {
      if (this.falling && !this.bounced && this.angry) {
        const pl = world.nearestPlayer(b.x).body;
        const speed = Math.round(this.walkSpeed * Crab.ANGRY_SPEED);
        b.vx = (b.x + b.w / 2 > pl.x + pl.w / 2 ? -1 : 1) * speed;
      } else this.bounced = false;
      this.falling = false;
    }
    // A wall turn (patrol) puts back the plain walk speed: an angry crab keeps its own.
    if (this.angry && Math.abs(b.vx) === this.walkSpeed)
      b.vx = Math.sign(b.vx) * Math.round(this.walkSpeed * Crab.ANGRY_SPEED);
    const step = (world.frame >> (this.angry ? 2 : 3)) & 1;
    this.currentFrame = `crab${this.angry ? '-angry' : ''}-${step}`;
    this.finish();
  }
}

/**
 * FireEnemy (FireEnemy.as): a living flame that cannot be stomped and that only the strongest
 * attacks get through (`PR_PIERCE_PAS, 11`: the Star, or the Hammer). Every 250 ms it picks at
 * random to walk left, walk right or stand (a third each), and hops off a bumped block. A hit-stun
 * never holds it (checkState clears `stunned`). The Goomba's 250 hit points (its own HealthValue
 * line is commented out); SPINEY_* scores.
 */
export class FireEnemy extends GoombaKin {
  readonly kind = 'fire-enemy';
  /** changeDirectionTimer: 250 ms. */
  static readonly TURN_FRAMES = 15;
  /** The pierce that gets through it (PR_PIERCE_PAS 11). */
  static readonly ARMOUR = 11;
  private turnT = 0;

  constructor(x: number, y: number) {
    super(x, y);
    this.sheet = 'special-enemies';
    this.currentFrame = 'fire-enemy-0';
    this.scores = ENEMY_SCORES.SPINEY;
    // Current rules: nothing but the Star (and the Hammer, which hits as one) puts it out.
    this.vulnerability = { star: 'kill', bump: 'bounce', stomp: 'hurtAttacker' };
  }

  update(world: World): void {
    const b = this.body;
    if (++this.turnT >= FireEnemy.TURN_FRAMES) {
      this.turnT = 0;
      const r = world.rng.float();
      b.vx = r < 0.33 ? -this.walkSpeed : r < 0.66 ? this.walkSpeed : 0;
    }
    this.stunned = 0;
    this.stopFrames = 0;
    this.patrol(world);
    if (b.onGround) this.bounced = false;
    this.currentFrame = `fire-enemy-${(world.frame >> 2) & 1}`;
    this.finish();
  }

  /** It glows: the same colours in every area (the castle's palette has the flame's reds). */
  override palette(_view: View): string {
    return 'enemies-castle';
  }
}

/**
 * Fly (Fly.as): a hopping insect that cannot be stomped. It waits 150 ms on the ground, then jumps
 * towards the player (vy 240, vx the walk speed ×1.25) under gravity 560; past the top of its
 * jump, falling below where it took off, its sideways speed dies away (×0.1 a second). It stands
 * still on landing. HealthValue.FLY 350; FLY_* scores.
 */
export class Fly extends Enemy {
  readonly kind = 'fly';
  static readonly WAIT_FRAMES = 9;
  static readonly JUMP_VY = flashVel(240);
  static readonly GRAVITY = flashGrav(560);
  /** FRICTION_X per frame: 0.1 ^ (1/60). */
  static readonly AIR_FRICTION = Math.pow(0.1, 1 / 60);
  private waitT = 0;
  private jumpStartY = 0;

  constructor(x: number, y: number) {
    super(x, y, 12, 14);
    this.sheet = 'special-enemies';
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.currentFrame = 'fly-stand';
    this.scores = SPECIAL_SCORES.FLY;
    this.stompable = false;
    this.corpseGravity = Fly.GRAVITY;
    this.vulnerability = { ...this.vulnerability, stomp: 'hurtAttacker' };
    this.body.vx = 0;
  }

  update(world: World): void {
    const b = this.body;
    if (b.onGround) {
      b.vx = 0;
      if (++this.waitT >= Fly.WAIT_FRAMES) {
        this.waitT = 0;
        const pl = world.nearestPlayer(b.x);
        const dir = pl.centerX >= b.x + b.w / 2 ? 1 : -1;
        this.facing = dir;
        b.vx = dir * Math.round(this.walkSpeed * 1.25);
        b.vy = -Fly.JUMP_VY;
        b.onGround = false;
        this.jumpStartY = b.y;
      }
    } else if (b.y > this.jumpStartY) b.vx = Math.trunc(b.vx * Fly.AIR_FRICTION);
    this.walk(world);
    if (b.hitWall !== 0) b.vx = 0;
    this.fall(world, Fly.GRAVITY);
    this.currentFrame = b.onGround ? 'fly-stand' : `fly-${(world.frame >> 1) & 1}`;
    if (this.isBelowLevel()) this.destroy();
  }
}

/**
 * Icicle (Icicle.as): hangs where it is (`defyGrav`) until the player comes within three tiles
 * (`player.nx > nx - TILE_SIZE*3`) or the brick it hangs from is bumped or broken, then falls at
 * gravity 400, through everything: it touches only heroes and their attacks (it hit-tests nothing
 * else). It cannot be stomped (`stompable` stays false). HealthValue.ICICLE 25; GOOMBA_* scores.
 */
export class Icicle extends Enemy {
  readonly kind = 'icicle';
  static readonly GRAVITY = flashGrav(400);
  /** DETECTION_ZONE_OFFSET: three tiles. */
  static readonly REACH = px(48);
  falling = false;
  /** The brick it hangs from (the tile above its cell), if it is one. */
  private readonly anchor: { tx: number; ty: number };

  /** `tx`, `ty`: its map cell (it hangs from the tile above it). */
  constructor(x: number, y: number, tx: number, ty: number) {
    super(x, y, 10, 14);
    this.sheet = 'special-enemies';
    this.spriteOffsetX = 3;
    this.spriteOffsetY = 1;
    this.currentFrame = 'icicle';
    this.scores = ENEMY_SCORES.GOOMBA;
    this.stompable = false;
    this.fallsOffLedges = true;
    this.corpseGravity = Icicle.GRAVITY;
    this.corpseFlipY = false;
    this.vulnerability = { ...this.vulnerability, stomp: 'hurtAttacker', bump: 'immune' };
    this.body.vx = 0;
    this.anchor = { tx, ty: ty - 1 };
  }

  update(world: World): void {
    const b = this.body;
    if (!this.falling) {
      const p = world.nearestPlayer(b.x);
      // The brick it hangs from was bumped or broken (BRICK_BOUNCE / BRICK_BREAK): it drops.
      const tile = world.map.get(this.anchor.tx, this.anchor.ty);
      if (p.centerX > b.x + b.w / 2 - Icicle.REACH || this.anchorMoved(tile)) this.falling = true;
      this.anchorTile ??= tile;
      return;
    }
    // Through everything: no tile collision.
    b.vy = Math.min(b.vy + Icicle.GRAVITY, 0x04000);
    b.y += b.vy >> 4;
    if (this.isBelowLevel()) this.destroy();
  }

  /** The tile it first hung from. */
  private anchorTile: number | null = null;

  private anchorMoved(tile: number): boolean {
    return this.anchorTile !== null && tile !== this.anchorTile;
  }

  /** It never turns other enemies round, nor is turned (it hit-tests only heroes). */
  override bounceOff(_other: Enemy): void {}
}

/** Kinds that walk at the Goomba's speed (Enemy Speed: Fast speeds them up too). */
export const GOOMBA_KIN: ReadonlySet<string> = new Set(['crab', 'barrel', 'fire-enemy']);
