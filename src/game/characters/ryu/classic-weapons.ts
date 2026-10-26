import { px, velToSub } from '@engine/math/units';
import { overlaps } from '@engine/math/aabb';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { FIRE_WHEEL, THROWING_STAR, WINDMILL } from './weapons';

/**
 * Classic SMBC Ryu's ninpo arts and sword (2026-10-07-ryu-classic-smbc-rules.md RY-C23..RY-C36;
 * RyuProjectile.as, DamageValue.as 57-62). Damage is in the original's units (a Goomba has 250).
 * Flash px/s ÷ 120 = px/f; velocities in 1/4096 px/f. Every thrown art flies through solid ground
 * and strikes only bricks, ? blocks and hidden blocks (RY-C36, the BR report's `classicBlocks`).
 */

/** The armour sound a blocked hit plays (RY-C24). */
const BLOCKED = 'armour';

/** The sword (RY-C25): 400, pierce 0. */
export const CLASSIC_SWORD_DAMAGE = 400;
/** The Jump Slash's contact hit (RY-C31): 800, pierce 0. */
export const CLASSIC_JUMP_SLASH_DAMAGE = 800;
/** Armour-pierce strength of the Windmill and the Dragon Ball (LevObj pierce 6). */
const PIERCE = 6;

// The Campaign specs without their Campaign-only motion (the Windmill's timed return, the ring).
const { returns: _returns, ...WINDMILL_BODY } = WINDMILL;
const { orbit: _orbit, ...FIRE_BODY } = FIRE_WHEEL;

/** Shuriken (RY-C26): cost 3, 300, 5 px/f straight; gone on anything it hits. */
export const CLASSIC_SHURIKEN: ProjectileSpec = {
  ...THROWING_STAR,
  kind: 'classic-shuriken',
  amount: 300,
  speed: 0x05000,
  hitsTiles: false,
  classicHit: { pierce: 0, blockedSfx: BLOCKED },
  onBlocked: 'remove',
  classicBlocks: { ground: 'pass', afterBlock: 'end', strikesBlocks: true },
};

/**
 * Windmill Shuriken (RY-C28): cost 5, 300 each pass, pierces armour, passes through everything,
 * breaks bricks and bumps ? blocks as it goes. Its swing is WindmillShot's own motion.
 */
export const CLASSIC_WINDMILL: ProjectileSpec = {
  ...WINDMILL_BODY,
  kind: 'classic-windmill',
  amount: 300,
  speed: 0x06aab, // 800 px/s: 6.6667 px/f
  pierce: true,
  lifetime: null,
  rehitAfter: 1,
  classicHit: { pierce: PIERCE },
  classicBlocks: { ground: 'pass', afterBlock: 'continue', strikesBlocks: true },
};

/** The Fire Wheel's and Dragon Ball's speed in x and in y (450 px/s: 3.75 px/f). */
export const CLASSIC_FIRE_SPEED = 0x03c00;

/**
 * Art of the Fire Wheel (RY-C29): cost 5, 400, one fireball up and forward with no gravity; on
 * through what it kills, stopped by what it does not (or by armour); breaks bricks and flies on.
 */
export const CLASSIC_FIRE_WHEEL: ProjectileSpec = {
  ...FIRE_BODY,
  kind: 'classic-fire-wheel',
  amount: 400,
  speed: CLASSIC_FIRE_SPEED,
  vy: -CLASSIC_FIRE_SPEED,
  lifetime: null,
  pierce: false,
  pierceKillsOnly: true,
  blocks: false,
  classicHit: { pierce: 0, blockedSfx: BLOCKED },
  onBlocked: 'remove',
  classicBlocks: { ground: 'pass', afterBlock: 'continueIfBroken', strikesBlocks: true },
};

/** Fire Dragon Ball (RY-C30): the Fire Wheel going down and forward, and it pierces armour. */
export const CLASSIC_DRAGON_BALL: ProjectileSpec = {
  ...CLASSIC_FIRE_WHEEL,
  kind: 'classic-dragon-ball',
  vy: CLASSIC_FIRE_SPEED,
  frames: ['dragon-ball-0', 'dragon-ball-1'],
  w: 12,
  h: 12,
  classicHit: { pierce: PIERCE },
};

/** The Windmill's swing (RyuProjectile.as 252-345): pull 0.3194 px/f², reverse 25 px out. */
export const WINDMILL_PULL = 0x0051c;
export const WINDMILL_REVERSE = 25;
/** Its vertical follow toward Ryu's centre: 0.7083 px/f. */
export const WINDMILL_FOLLOW = 0x00b55;
/** Ryu catches it from this many frames after the throw (300 ms). */
export const WINDMILL_CATCH_FROM = 18;

/**
 * The Windmill Shuriken in flight (RY-C28). While within WINDMILL_REVERSE px of Ryu's centre on
 * its side it speeds away from him; once it has been that far out it is pulled back until it
 * crosses to his other side, where the rule starts again. It follows his height, flies through
 * everything, is never removed off-screen, and goes when he touches it (from frame 18) or dies.
 */
export class WindmillShot extends Projectile {
  /** The side of Ryu the swing rule is on now. */
  private side: -1 | 1;
  /** It has been WINDMILL_REVERSE px out on this side: pulled back now. */
  private turned = false;

  constructor(x: number, y: number, dirX: -1 | 1, owner: Player) {
    super(x, y, dirX, CLASSIC_WINDMILL, owner);
    this.side = dirX;
    this.despawnMargin = null;
  }

  override update(world: World): void {
    const o = this.owner as Player;
    if (o.dead || o.out) return this.destroy();
    this.age++;
    const b = this.body;
    const ob = o.body;
    const cx = b.x + (b.w >> 1);
    const ocx = ob.x + (ob.w >> 1);
    let d = (cx - ocx) * this.side;
    if (d < 0) {
      this.side = -this.side as -1 | 1;
      this.turned = false;
      d = -d;
    }
    if (!this.turned && d < px(WINDMILL_REVERSE)) b.vx += this.side * WINDMILL_PULL;
    else {
      this.turned = true;
      b.vx -= this.side * WINDMILL_PULL;
    }
    const max = CLASSIC_WINDMILL.speed;
    if (b.vx > max) b.vx = max;
    else if (b.vx < -max) b.vx = -max;
    const cy = b.y + (b.h >> 1);
    const ocy = ob.y + (ob.h >> 1);
    const dy = ocy - cy;
    const f = velToSub(WINDMILL_FOLLOW);
    b.y += Math.abs(dy) <= f ? dy : Math.sign(dy) * f;
    b.x += velToSub(b.vx);
    if (b.vx !== 0) this.facing = b.vx > 0 ? 1 : -1;
    world.shotBlocks(this);
    if (this.age >= WINDMILL_CATCH_FROM && overlaps(b, ob)) this.destroy();
  }
}

/** One ninpo art (RY-C2): its cost, and the spec it throws (null: the Jump Slash). */
export interface ClassicArt {
  id: 'shuriken' | 'windmill' | 'fire-wheel' | 'dragon-ball' | 'jump-slash';
  /** HUD icon on the items sheet. */
  icon: string;
  /** Touch caption (the art's name). */
  label: string;
  cost: number;
  spec: ProjectileSpec | null;
}

/** The five arts in the dev full kit's Select order (RY-C2, RY-C38). */
export const CLASSIC_ARTS: readonly ClassicArt[] = [
  { id: 'shuriken', icon: 'icon-star', label: 'SHURIKEN', cost: 3, spec: CLASSIC_SHURIKEN },
  { id: 'windmill', icon: 'icon-windmill', label: 'WINDMILL', cost: 5, spec: CLASSIC_WINDMILL },
  { id: 'fire-wheel', icon: 'icon-fire-wheel', label: 'WHEEL', cost: 5, spec: CLASSIC_FIRE_WHEEL },
  { id: 'dragon-ball', icon: 'icon-dragon-ball', label: 'DRAGON', cost: 5, spec: CLASSIC_DRAGON_BALL },
  { id: 'jump-slash', icon: 'icon-slash', label: 'SPIN', cost: 5, spec: null },
];

/**
 * Throw spawn points (RY-C27): the shot's centre, px ahead of his centre and px above his feet.
 * `wallAway` is behind him (away from the wall).
 */
export const CLASSIC_THROW_SPAWN = {
  stand: { ahead: 15, up: 21 },
  crouch: { ahead: 13, up: 16 },
  air: { ahead: 13, up: 21 },
  wallInto: { ahead: 10, up: 22.5 },
  wallAway: { ahead: 20, up: 22.5 },
} as const;
