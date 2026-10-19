import type { Renderer } from '@engine/gfx/renderer';
import { overlaps, type AABB } from '@engine/math/aabb';
import { px, toPx, velToSub } from '@engine/math/units';
import { Entity, type View } from '../../entities/entity';
import { groundBelow, moveX, moveY } from '../../entities/body';
import { Enemy } from '../../entities/enemies/enemy';
import { Projectile, type ClassicBlocks, type ProjectileSpec } from '../../entities/projectiles/projectile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';

/**
 * Vic Viper's weapons (2026-10-07-vicviper-build-classic-character.md VV-14, VV-15 and the approved
 * designs VV-M5..VV-M9, docs/classic/VIC_VIPER.md). Speeds in 1/4096 px/f; damage in the original's
 * units (a Goomba has 250, a brick 125).
 */

/** VicViperProjectile SPEED 600 Flash px/s: 5 px/f, always right, no gravity (VV-14). */
export const BULLET_SPEED = 0x05000;
/** DamageValue.VIC_BULLET (VV-14). */
export const BULLET_DAMAGE = 200;
/** The Double's 45° shot: 5 px/f split evenly, 3.5355 px/f each way (VV-M6). */
export const DOUBLE_SPEED = 0x03892;
/** The laser bolt: 8 px/f, at most 2 on screen per gun (VV-M7). */
export const LASER_SPEED = 0x08000;
export const LASER_CAP = 2;
/** The ground missile: down-forward 1.5 / 2.0 px/f, then 2.0 px/f along the floor (VV-M5). */
export const MISSILE_DIVE = { vx: 0x01800, vy: 0x02000 } as const;
export const MISSILE_RUN = 0x02000;
export const MISSILE_DAMAGE = 400;

/** Flies through ground and pipes; the first brick or block it meets is struck and ends it (VV-15). */
const PASS_END: ClassicBlocks = { ground: 'pass', afterBlock: 'end', strikesBlocks: true };
/** The laser flies on through bricks it breaks and blocks it bumps (VV-M7). */
const PASS_ON: ClassicBlocks = { ground: 'pass', afterBlock: 'continue', strikesBlocks: true };

/** The bullet (VV-14): 10 x 7, 5 px/f, 200, non-piercing; armoured enemies take nothing. */
export const VIC_BULLET: ProjectileSpec = {
  kind: 'vic-bullet',
  damage: 'buster',
  amount: BULLET_DAMAGE,
  speed: BULLET_SPEED,
  gravity: 0,
  bounceVy: null,
  hitsTiles: true,
  piercesTiles: true,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  w: 10,
  h: 7,
  sheet: 'vicviper',
  frames: ['bullet'],
  frameRate: 1,
  burstFrame: 'shot-hit',
  classicBlocks: PASS_END,
  classicHit: { blockedSfx: 'armour' },
};

/** The laser bolt (VV-M7): 16 x 6, 8 px/f, 200, through every non-armoured enemy (each hit once). */
export const VIC_LASER: ProjectileSpec = {
  ...VIC_BULLET,
  kind: 'vic-laser',
  speed: LASER_SPEED,
  w: 16,
  h: 6,
  frames: ['laser'],
  pierce: true,
  classicBlocks: PASS_ON,
};

/** Laser level 2: 32 x 6, 300. */
export const VIC_LASER_2: ProjectileSpec = { ...VIC_LASER, w: 32, amount: 300, frames: ['laser-long'] };

/** The ground missile (VV-M5): 10 x 10, 400, pierces armour as Samus's missile does. */
export const VIC_MISSILE: ProjectileSpec = {
  ...VIC_BULLET,
  kind: 'vic-missile',
  amount: MISSILE_DAMAGE,
  speed: MISSILE_DIVE.vx,
  piercesTiles: false,
  w: 10,
  h: 10,
  frames: ['missile-down'],
  classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: true },
  classicHit: { pierce: 5, blockedSfx: 'armour' },
};

/**
 * The Gradius ground missile (VV-M5): dives down and forward with no gravity; on the top of solid
 * ground it runs right along the surface, and falls again off an edge. A wall (a brick it breaks,
 * a ? block it bumps) or the first enemy ends it; unlike the bullet it meets the ground.
 */
export class VicMissile extends Projectile {
  running = false;

  constructor(x: number, y: number, owner: Player) {
    super(x, y, 1, VIC_MISSILE, owner, { vx: MISSILE_DIVE.vx, vy: MISSILE_DIVE.vy });
  }

  override update(world: World): void {
    const b = this.body;
    if (this.bursting > 0) return super.update(world);
    this.age++;
    moveX(b, world.map, velToSub(b.vx));
    if (b.hitWall !== 0) {
      world.shotBlockAt(this, b.x + b.w, b.y + (b.h >> 1));
      return this.burst(world);
    }
    if (this.running && !groundBelow(b, world.map)) {
      this.running = false;
      b.vx = MISSILE_DIVE.vx;
      b.vy = MISSILE_DIVE.vy;
    }
    if (!this.running) {
      moveY(b, world.map, velToSub(b.vy));
      if (b.onGround) {
        this.running = true;
        b.vx = MISSILE_RUN;
        b.vy = 0;
      }
    }
    const camL = world.camera.x - px(16);
    const camR = world.camera.right + px(16);
    if (b.x + b.w < camL || b.x > camR || this.isBelowLevel()) this.destroy();
  }

  override render(r: Renderer, view: View): void {
    r.sprite(
      view.assets.sheet('vicviper'),
      this.running ? 'missile-run' : 'missile-down',
      toPx(this.body.x) - view.camX,
      toPx(this.body.y),
    );
  }
}

/** Frames of the Option trail between one Option and the next (VV-M8). */
export const OPTION_GAP = 12;
export const OPTION_MAX = 4;

/** One trail per ship: its past centres in screen coordinates (subpixels), newest last. */
interface Trail {
  world: World;
  pts: { x: number; y: number }[];
}
const trails = new WeakMap<Player, Trail>();

/** The ship's centre on screen (subpixels). */
function screenCentre(p: Player, world: World): { x: number; y: number } {
  const b = p.body;
  return { x: b.x + (b.w >> 1) - world.camera.x, y: b.y + (b.h >> 1) };
}

/**
 * Records the ship's path for its Options (VV-M8): in screen coordinates, and only on frames when the
 * ship moved on screen, so the Options bunch up while it holds still and the scroll doesn't stretch
 * them. A new area starts the trail afresh.
 */
export function recordTrail(p: Player, world: World): void {
  const at = screenCentre(p, world);
  let t = trails.get(p);
  if (!t || t.world !== world) {
    t = { world, pts: [at] };
    trails.set(p, t);
    return;
  }
  const last = t.pts[t.pts.length - 1] as { x: number; y: number };
  if (last.x === at.x && last.y === at.y) return;
  t.pts.push(at);
  if (t.pts.length > OPTION_GAP * OPTION_MAX + 1) t.pts.shift();
}

/** Option `n`'s (1-based) centre in world subpixels: where the ship's centre was 12 x n moves ago. */
export function optionCentre(p: Player, world: World, n: number): { x: number; y: number } {
  const pts = trails.get(p)?.pts;
  if (!pts || !pts.length) {
    const c = screenCentre(p, world);
    return { x: c.x + world.camera.x, y: c.y };
  }
  const pt = pts[Math.max(0, pts.length - 1 - OPTION_GAP * n)] as { x: number; y: number };
  return { x: pt.x + world.camera.x, y: pt.y };
}

/** Options the ship has (scratch `vvOption`). */
const optionCount = (p: Player): number => Math.min(OPTION_MAX, p.scratch.vvOption ?? 0);

/**
 * An Option orb (VV-M8): 12 x 8, trailing the ship, with no hitbox (it ignores enemies, terrain
 * and enemy shots). It fires a copy of every shot (classic.ts `fire`). Gone with the ship's death.
 */
export class VicOption extends Entity {
  readonly kind = 'vic-option';
  constructor(
    readonly owner: Player,
    readonly n: number,
    world: World,
  ) {
    const c = optionCentre(owner, world, n);
    super(c.x - px(6), c.y - px(4), 12, 8);
    this.despawnMargin = null;
    this.layer = 'main';
  }

  update(world: World): void {
    const p = this.owner;
    if (p.dead || p.out || optionCount(p) < this.n) return this.destroy();
    const c = optionCentre(p, world, this.n);
    this.body.x = c.x - px(6);
    this.body.y = c.y - px(4);
  }

  render(r: Renderer, view: View): void {
    if (this.owner.hidden) return;
    const f = view.reduceFlashing ? 'option-0' : `option-${(view.frame >> 2) & 1}`;
    r.sprite(view.assets.sheet('vicviper'), f, this.screenX(view), this.screenY());
  }
}

/** Hits each Shield piece takes (VV-M9); with this many or fewer left it shows its worn frames. */
export const SHIELD_HP = 4;
export const SHIELD_WORN = 2;
/** An enemy pressing on a piece costs it 1 at most this often. */
export const SHIELD_CONTACT_FRAMES = 30;
const SHIELD_PX = 13;

/** The two Shield pieces' boxes (VV-M9): 6 px right of the hitbox, 1 px above its top / below its bottom. */
export function shieldBoxes(p: Player): { top: AABB; bot: AABB } {
  const b = p.body;
  const cx = b.x + b.w + px(6);
  const half = px(SHIELD_PX) >> 1;
  const w = px(SHIELD_PX);
  return {
    top: { x: cx - half, y: b.y - px(1) - half, w, h: w },
    bot: { x: cx - half, y: b.y + b.h + px(1) - half, w, h: w },
  };
}

/**
 * The NES Gradius front barrier (VV-M9): two pieces in front of the nose, each taking 4. An enemy
 * shot touching a piece is destroyed and costs it 1; an enemy touching it is not hurt and costs
 * it 1 (at most once per 30 frames per enemy). With both gone the Shield slot is open again. Hits
 * on the ship's own hitbox are not blocked. The pieces' hits left are in scratch (`vvShieldTop`,
 * `vvShieldBot`), so they carry from area to area.
 */
export class VicShield extends Entity {
  readonly kind = 'vic-shield';
  private readonly pressed = new Map<number, number>();
  constructor(readonly owner: Player) {
    super(owner.body.x, owner.body.y, 1, 1);
    this.despawnMargin = null;
    this.layer = 'front';
  }

  update(world: World): void {
    const p = this.owner;
    const s = p.scratch;
    if (p.dead || p.out || !s.vvShield) return this.destroy();
    const boxes = shieldBoxes(p);
    for (const [key, box] of [
      ['vvShieldTop', boxes.top],
      ['vvShieldBot', boxes.bot],
    ] as const) {
      if ((s[key] ?? 0) <= 0) continue;
      for (const e of world.entities) {
        if (!e.alive || (s[key] ?? 0) <= 0) continue;
        if (e instanceof Projectile && e.spec.hitsPlayer && overlaps(e.body, box)) {
          e.destroy();
          s[key] = (s[key] ?? 0) - 1;
        } else if (e instanceof Enemy && e.contactHurts && overlaps(e.body, box)) {
          const at = this.pressed.get(e.id);
          if (at !== undefined && world.frame - at < SHIELD_CONTACT_FRAMES) continue;
          this.pressed.set(e.id, world.frame);
          s[key] = (s[key] ?? 0) - 1;
        }
      }
    }
    if ((s.vvShieldTop ?? 0) <= 0 && (s.vvShieldBot ?? 0) <= 0) {
      s.vvShield = 0;
      this.destroy();
    }
  }

  render(r: Renderer, view: View): void {
    const p = this.owner;
    if (p.hidden || p.dead) return;
    const sheet = view.assets.sheet('vicviper');
    const boxes = shieldBoxes(p);
    for (const [key, box, frame] of [
      ['vvShieldTop', boxes.top, 'shield-top'],
      ['vvShieldBot', boxes.bot, 'shield-bot'],
    ] as const) {
      const hp = p.scratch[key] ?? 0;
      if (hp <= 0) continue;
      const f = hp <= SHIELD_WORN ? `${frame}-hurt` : frame;
      r.sprite(sheet, f, toPx(box.x) - view.camX, toPx(box.y));
    }
  }
}

/** The ship's Options and Shield in the current world, made again in each new area. */
interface Escort {
  world: World;
  options: VicOption[];
  shield: VicShield | null;
}
const escorts = new WeakMap<Player, Escort>();

/** Keeps the ship's Options and Shield in `world` matching its kit (spawns what is missing). */
export function keepEscort(p: Player, world: World): void {
  let e = escorts.get(p);
  if (!e || e.world !== world) {
    e = { world, options: [], shield: null };
    escorts.set(p, e);
  }
  e.options = e.options.filter((o) => o.alive);
  for (let n = 1; n <= optionCount(p); n++)
    if (!e.options.some((o) => o.n === n)) {
      const o = new VicOption(p, n, world);
      e.options.push(o);
      world.spawn(o);
    }
  if (e.shield && !e.shield.alive) e.shield = null;
  if (p.scratch.vvShield && !e.shield) {
    e.shield = new VicShield(p);
    world.spawn(e.shield);
  }
}

/** The ship's live Options in `world`, in order. */
export function optionsOf(p: Player, world: World): VicOption[] {
  const e = escorts.get(p);
  if (!e || e.world !== world) return [];
  return e.options.filter((o) => o.alive).sort((a, b) => a.n - b.n);
}

/** Which gun (0 the ship, n Option n) fired each shot, for the per-gun caps. */
const gunOf = new WeakMap<Projectile, number>();

/** Live shots of `kind` from gun `gun` of `p`. */
function shotsFrom(p: Player, world: World, gun: number, kind: string): number {
  let n = 0;
  for (const e of world.entities)
    if (e instanceof Projectile && e.alive && e.owner === p && e.kind === kind && gunOf.get(e) === gun) n++;
  return n;
}

function shoot(world: World, p: Player, gun: number, spec: ProjectileSpec, cx: number, cy: number, vx: number, vy = 0): void {
  const s = new Projectile(cx - px(spec.w >> 1), cy - (px(spec.h) >> 1), vx < 0 ? -1 : 1, spec, p, { vx, vy });
  gunOf.set(s, gun);
  world.spawn(s);
}

/**
 * One SHOOT press (VV-14, VV-M5..VV-M8): from the ship and each Option, the forward shot (the bullet,
 * or the laser at most 2 per gun), the Double's 45° shot (and level 2's rear shot), and with the
 * Missile one ground missile per gun when none of that gun's is out.
 */
export function fire(p: Player, world: World): void {
  const s = p.scratch;
  const b = p.body;
  // Each gun: where the forward shot's centre starts, the rear shot's, and the missile's bottom centre.
  const guns: { cx: number; cy: number; lx: number; mx: number; bottom: number }[] = [
    // The bullet's centre at the hitbox's right edge, 4 px above its bottom (VV-14).
    { cx: b.x + b.w, cy: b.y + b.h - px(4), lx: b.x, mx: b.x + (b.w >> 1), bottom: b.y + b.h },
  ];
  for (const o of optionsOf(p, world)) {
    const ob = o.body;
    const cy = ob.y + (ob.h >> 1);
    guns.push({ cx: ob.x + ob.w, cy, lx: ob.x, mx: ob.x + (ob.w >> 1), bottom: ob.y + ob.h });
  }
  const laser = s.vvLaser ?? 0;
  const double = s.vvDouble ?? 0;
  let sound = laser ? 'buster' : 'beam';
  guns.forEach((g, gun) => {
    if (laser) {
      const spec = laser >= 2 ? VIC_LASER_2 : VIC_LASER;
      if (shotsFrom(p, world, gun, spec.kind) < LASER_CAP) shoot(world, p, gun, spec, g.cx, g.cy, LASER_SPEED);
    } else shoot(world, p, gun, VIC_BULLET, g.cx, g.cy, BULLET_SPEED);
    if (double >= 1 && !laser) shoot(world, p, gun, VIC_BULLET, g.cx, g.cy, DOUBLE_SPEED, -DOUBLE_SPEED);
    if (double >= 2 && !laser) shoot(world, p, gun, VIC_BULLET, g.lx, g.cy, -BULLET_SPEED);
    if (s.vvMissile && shotsFrom(p, world, gun, VIC_MISSILE.kind) === 0) {
      const m = new VicMissile(g.mx - px(5), g.bottom - px(5), p);
      gunOf.set(m, gun);
      world.spawn(m);
      if (gun === 0) sound = 'missile';
    }
  });
  world.audio.sfx(sound);
}
