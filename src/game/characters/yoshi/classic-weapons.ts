import { px, tileAt, toPx, velToSub } from '@engine/math/units';
import type { Renderer } from '@engine/gfx/renderer';
import { moveX, moveY } from '../../entities/body';
import type { View } from '../../entities/entity';
import type { Player } from '../../entities/player';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import type { World } from '../../world/world';
import { tileDef } from '../../level/tiles';
import { handPoint, mouthPoint, type MouthFill } from '../classic/yoshi-tongue';

/**
 * Classic Yoshi's eggs and spit (bug-reports/2026-10-19-yoshi-build-classic-character.md YO-20,
 * YO-21, YO-22). Damage in the original's units (Classic enemy HP, HP-C8): a Goomba has 250.
 */

/** Egg speed along the aim line: 4 px/f, no gravity (YO-22). */
export const EGG_SPEED = 0x04000;
/** At most two eggs on screen (YO-21). */
export const EGG_CAP = 2;
/** An egg ends 120 frames after the throw (YO-22). */
export const EGG_LIFETIME = 120;
/** The throw pose (YO-21). */
export const THROW_FRAMES = 12;

const EGG_BASE: ProjectileSpec = {
  kind: 'yoshi-egg',
  damage: 'weapon',
  amount: 400,
  speed: EGG_SPEED,
  gravity: 0,
  bounceVy: null,
  hitsTiles: true,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: EGG_LIFETIME,
  w: 8,
  h: 8,
  sheet: 'yoshi',
  frames: ['egg-green'],
  frameRate: 1,
  // A green egg is stopped by armour (a Buzzy Beetle): it ends with the armour sound (HP-C14).
  classicHit: { pierce: 0, blockedSfx: 'armour' },
  onBlocked: 'burst',
  classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: true },
};

/** Small and Mushroom: green eggs, 400, no pierce (YO-22). */
export const EGG_GREEN: ProjectileSpec = EGG_BASE;
/** Fire Flower: red eggs, 800, pierce 6: through armour (YO-22). */
export const EGG_RED: ProjectileSpec = {
  ...EGG_BASE,
  amount: 800,
  frames: ['egg-red'],
  classicHit: { pierce: 6, blockedSfx: 'armour' },
};

/**
 * An egg in flight (YO-22): straight along its line; it bounces once off solid ground (the
 * velocity reflected), and ends at the second contact, after 120 frames or off screen. A brick
 * or an item block it meets is struck (a brick breaks, an item block bumps) and the egg ends.
 */
export class YoshiEgg extends Projectile {
  bounced = false;
  override update(world: World): void {
    const b = this.body;
    this.age++;
    if (this.age > EGG_LIFETIME) return this.destroy();
    const map = world.map;
    moveX(b, map, velToSub(b.vx));
    if (b.hitWall !== 0) {
      const wx = b.x + (b.hitWall > 0 ? b.w : -1);
      if (this.contact(world, wx, b.y + (b.h >> 1))) return;
      b.vx = -b.vx;
      this.facing = b.vx > 0 ? 1 : -1;
    }
    if (b.vy !== 0) {
      const vy = b.vy;
      moveY(b, map, velToSub(vy));
      if (b.onGround || b.hitHead) {
        const wy = b.onGround ? b.y + b.h : b.y - 1;
        if (this.contact(world, b.x + (b.w >> 1), wy)) return;
        b.vy = -vy;
        b.onGround = false;
      }
    }
    // Hidden blocks it flies into (BR-C17).
    if (world.shotBlocks(this)) return this.burst(world);
    const camL = world.camera.x - px(16);
    const camR = world.camera.right + px(16);
    if (b.x + b.w < camL || b.x > camR || this.isBelowLevel() || b.y + b.h < px(-16)) this.destroy();
  }

  /** Touched solid ground at (x, y): true when the egg ends (a block, or its second contact). */
  private contact(world: World, x: number, y: number): boolean {
    const block = tileDef(world.map.get(tileAt(x), tileAt(y))).block;
    if (block && block.kind !== 'hidden') {
      world.shotBlockAt(this, x, y);
      this.burst(world);
      return true;
    }
    if (this.bounced) {
      this.burst(world);
      return true;
    }
    this.bounced = true;
    world.audio.sfx('yoshi-egg-bounce');
    return false;
  }
}

/** Throws an egg from the mouth at `deg` above level in the facing direction (YO-21). */
export function throwEgg(p: Player, world: World, deg: number): YoshiEgg {
  const spec = p.powerState === 'fire' ? EGG_RED : EGG_GREEN;
  const m = handPoint(p);
  const rad = (deg * Math.PI) / 180;
  const vx = p.facing * Math.round(Math.cos(rad) * EGG_SPEED);
  const vy = -Math.round(Math.sin(rad) * EGG_SPEED);
  const egg = new YoshiEgg(m.x - px(spec.w >> 1), m.y - px(spec.h >> 1), p.facing, spec, p, { vx, vy });
  world.spawn(egg);
  return egg;
}

/** The spit catch (YO-20): 3 px/f straight ahead, no gravity, 600 with pierce 10. */
export const SPIT: ProjectileSpec = {
  kind: 'yoshi-spit',
  damage: 'weapon',
  amount: 600,
  speed: 0x03000,
  gravity: 0,
  bounceVy: null,
  hitsTiles: true,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  w: 12,
  h: 12,
  sheet: 'enemies',
  frames: ['goomba-0'],
  frameRate: 1,
  classicHit: { pierce: 10 },
  classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: true },
};

/** A spat enemy (YO-20): its own frame, tumbling upside down, until it hits something. */
export class YoshiSpit extends Projectile {
  constructor(
    x: number,
    y: number,
    dir: -1 | 1,
    owner: Player,
    readonly fill: MouthFill,
  ) {
    super(x, y, dir, SPIT, owner);
  }
  override render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet(this.fill.sheet, this.fill.palette);
    const f = sheet.frames.get(this.fill.frame);
    const ox = f ? (f.w - 12) >> 1 : 0;
    const oy = f ? f.h - 12 : 0;
    r.sprite(
      sheet,
      this.fill.frame,
      toPx(this.body.x) - ox - view.camX,
      toPx(this.body.y) - oy,
      this.facing > 0,
      true,
    );
  }
}

/** Spits the catch straight ahead from the mouth (YO-20). */
export function spit(p: Player, world: World, fill: MouthFill): YoshiSpit {
  // Out of the mouth and down to the height of what it hits on the ground (12 x 12, its bottom
  // 4 px above the feet).
  const m = mouthPoint(p);
  const s = new YoshiSpit(m.x - px(6), p.feetY - px(16), p.facing, p, fill);
  world.spawn(s);
  return s;
}
