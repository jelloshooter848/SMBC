import type { Renderer, Rotation } from '@engine/gfx/renderer';
import { px, toPx, velToSub, tileAt } from '@engine/math/units';
import { Entity, type View } from '../../entities/entity';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import { Pickup } from '../../entities/objects/pickup';
import { Player } from '../../entities/player';
import type { Enemy } from '../../entities/enemies/enemy';
import type { World } from '../../world/world';
import type { TileMap } from '../../world/tilemap';
import { tileDef } from '../../level/tiles';
import {
  HOMING_DAMP,
  HOMING_IDLE,
  HOMING_THRUST_STEP,
  MISSILE_ACCEL,
  MISSILE_SIDE_DECAY,
  SHOT_SPEED,
} from './profile';
import { SOUNDS } from './state';

/*
 * Sophia III's projectiles (SO-28 to SO-34), mapped onto our damage kinds: the cannon is a
 * `fireball` (armour and fire shrug it off: Buzzy Beetles, Bullet Bills, cannons, Podoboos, fire
 * bars), 1 / 2 / 3 hit points for Normal / Hyper / Crusher against enemies with hit points
 * (Bowser, Larry); the Triple Missile is a `weapon` (it pierces armour); the Homing Missile is a
 * `fireball` that never picks an armoured or fiery target. Every kill shows her explosion instead
 * of the shared flip (SO-34) and rolls a second drop as it ends (SO-25).
 */

export const SOPHIA_SHEET = 'sophia';

const base = {
  gravity: 0,
  bounceVy: null,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  sheet: SOPHIA_SHEET,
  frameRate: 2,
} as const;

/** The cannon's three levels: Normal, Hyper, Crusher. */
export const CANNON: readonly ProjectileSpec[] = [0, 1, 2].map((lvl) => ({
  ...base,
  kind: 'sophia-cannon',
  damage: 'fireball',
  amount: lvl + 1,
  speed: SHOT_SPEED,
  hitsTiles: true,
  w: 4 + lvl * 2,
  h: 4 + lvl,
  frames: [`cannon-${lvl}`],
}));

export const TRIPLE: ProjectileSpec = {
  ...base,
  kind: 'sophia-missile',
  damage: 'weapon',
  amount: 2,
  speed: SHOT_SPEED,
  // Its own update ignores tiles; true makes an immune target end it (World.projectile).
  hitsTiles: true,
  w: 8,
  h: 4,
  frames: ['missile'],
};

export const HOMING: ProjectileSpec = {
  ...base,
  kind: 'sophia-homing',
  damage: 'fireball',
  amount: 2,
  speed: SHOT_SPEED,
  hitsTiles: true,
  w: 6,
  h: 6,
  frames: ['homing-0', 'homing-1'],
  frameRate: 4,
};

/* ---------- bricks a Normal shot has weakened ---------- */

const weakened = new WeakMap<TileMap, Set<number>>();
const key = (map: TileMap, tx: number, ty: number) => ty * map.width + tx;

/** A head bump or a Normal shot leaves a brick at 0 HP: the next shot breaks it (BR-C4). */
export function weakenBrick(map: TileMap, tx: number, ty: number): void {
  let s = weakened.get(map);
  if (!s) weakened.set(map, (s = new Set()));
  s.add(key(map, tx, ty));
}
export function isWeakened(map: TileMap, tx: number, ty: number): boolean {
  return weakened.get(map)?.has(key(map, tx, ty)) ?? false;
}

/* ---------- explosions ---------- */

/**
 * Her explosion (4 frames, 2 frames each, 16×16): a shot ending on a wall, an enemy she killed,
 * her own death. `then` runs as it ends (the kill's second drop roll).
 */
export class SophiaBoom extends Entity {
  readonly kind = 'sophia-boom';
  private t = 0;
  constructor(
    cx: number,
    cy: number,
    private readonly frames = 8,
    private readonly then?: (world: World) => void,
  ) {
    super(cx - px(8), cy - px(8), 16, 16);
    this.layer = 'front';
    this.despawnMargin = null;
  }
  update(world: World): void {
    if (++this.t >= this.frames) {
      this.then?.(world);
      this.destroy();
    }
  }
  render(r: Renderer, view: View): void {
    const name = `boom-${Math.min(3, Math.floor((this.t * 4) / this.frames))}`;
    const sheet = view.assets.sheet(SOPHIA_SHEET);
    const fr = sheet.frames.get(name);
    const cx = toPx(this.body.x) + 8 - view.camX;
    const cy = toPx(this.body.y) + 8;
    r.sprite(sheet, name, cx - ((fr?.w ?? 16) >> 1), cy - ((fr?.h ?? 16) >> 1));
  }
}

/** A shot of hers killed `e`: her explosion, and the second drop roll as it ends (SO-25, SO-34). */
function killBoom(world: World, e: Entity, owner: Entity | Player | null): boolean {
  const cx = e.body.x + (e.body.w >> 1);
  const cy = e.body.y + (e.body.h >> 1);
  world.audio.sfx(SOUNDS.kill);
  world.spawn(
    new SophiaBoom(cx, cy, 14, (w) => {
      if (!(owner instanceof Player) || owner.dead) return;
      const kind = owner.def.drop?.(w.rng, e as Enemy, owner);
      if (kind) w.spawn(new Pickup(cx, e.body.y + e.body.h, kind));
    }),
  );
  return true;
}

/** Quarter turn for a sprite drawn nose-right flying (vx, vy). */
function heading(vx: number, vy: number): { rotate: Rotation; flip: boolean } {
  if (Math.abs(vy) > Math.abs(vx)) return { rotate: vy < 0 ? 270 : 90, flip: false };
  return { rotate: 0, flip: vx < 0 };
}

function drawTurned(r: Renderer, view: View, b: Entity['body'], frame: string, vx: number, vy: number): void {
  const sheet = view.assets.sheet(SOPHIA_SHEET);
  const f = sheet.frames.get(frame);
  const { rotate, flip } = heading(vx, vy);
  const w = f?.w ?? 8;
  const h = f?.h ?? 8;
  const side = rotate === 90 || rotate === 270;
  const bw = side ? h : w;
  const bh = side ? w : h;
  const cx = toPx(b.x + (b.w >> 1)) - view.camX;
  const cy = toPx(b.y + (b.h >> 1));
  if (rotate) r.sprite(sheet, frame, cx - (bw >> 1), cy - (bh >> 1), flip, false, rotate);
  else r.sprite(sheet, frame, cx - (bw >> 1), cy - (bh >> 1), flip);
}

/* ---------- the cannon ---------- */

/**
 * A cannon shot (SO-28, SO-29): a straight line at 3.54 px/f. Solid ground or a lift ends it in
 * an explosion; a brick takes two Normal shots (or one at Hyper and Crusher, or after a head
 * bump); an item block is bumped. It ends at the first block.
 */
export class CannonShot extends Projectile {
  constructor(
    cx: number,
    cy: number,
    vx: number,
    vy: number,
    readonly level: number,
    owner: Player,
  ) {
    const spec = CANNON[level] as ProjectileSpec;
    super(cx - px(spec.w >> 1), cy - px(spec.h >> 1), vx < 0 ? -1 : 1, spec, owner, { vx, vy });
  }

  override update(world: World): void {
    const b = this.body;
    this.age++;
    b.x += velToSub(b.vx);
    b.y += velToSub(b.vy);
    // The leading point.
    const x = b.vx > 0 ? b.x + b.w - 1 : b.vx < 0 ? b.x : b.x + (b.w >> 1);
    const y = b.vy > 0 ? b.y + b.h - 1 : b.vy < 0 ? b.y : b.y + (b.h >> 1);
    const tx = tileAt(x);
    const ty = tileAt(y);
    const map = world.map;
    if (map.inBounds(tx, ty) && map.isSolid(tx, ty)) {
      const def = tileDef(map.get(tx, ty));
      const p = this.owner instanceof Player ? this.owner : world.nearestPlayer(x);
      if (def.block && def.block.kind !== 'hidden') {
        const plain = def.block.kind === 'brick' && def.block.content === 'none';
        if (plain && this.level === 0 && !isWeakened(map, tx, ty)) {
          weakenBrick(map, tx, ty);
          world.strikeBlock(tx, ty, p, false);
        } else world.strikeBlock(tx, ty, p, plain);
      }
      return this.burst(world);
    }
    const camL = world.camera.x - px(16);
    const camR = world.camera.right + px(16);
    if (b.x + b.w < camL || b.x > camR || b.y > px(this.levelHeightPx + 16) || b.y + b.h < px(-64))
      this.destroy();
  }

  override burst(world: World): void {
    world.spawn(new SophiaBoom(this.body.x + (this.body.w >> 1), this.body.y + (this.body.h >> 1), 8));
    world.audio.sfx(SOUNDS.explode);
    this.destroy();
  }

  killEffect(world: World, e: Entity): boolean {
    return killBoom(world, e, this.owner);
  }

  override render(r: Renderer, view: View): void {
    drawTurned(r, view, this.body, this.spec.frames[0] as string, this.body.vx, this.body.vy);
  }
}

/* ---------- missiles ---------- */

/**
 * One of a Triple Missile volley (SO-30): from rest it speeds up along its axis to 3.54 px/f;
 * the outer two start with a sideways drift that dies away. It flies through ground, pipes and
 * lifts but strikes the first brick or item block it meets (a brick breaks), and ends there.
 */
export class TripleMissile extends Projectile {
  private along = 0;
  constructor(
    cx: number,
    cy: number,
    /** Unit axis it flies along. */
    private readonly ax: number,
    private readonly ay: number,
    /** Sideways start speed (perpendicular to the axis, velocity units, signed). */
    private side: number,
    owner: Player,
  ) {
    super(cx - px(TRIPLE.w >> 1), cy - px(TRIPLE.h >> 1), ax < 0 ? -1 : 1, TRIPLE, owner, { vx: 0, vy: 0 });
  }

  override update(world: World): void {
    const b = this.body;
    this.age++;
    this.along = Math.min(SHOT_SPEED, this.along + MISSILE_ACCEL);
    this.side = Math.trunc(this.side * MISSILE_SIDE_DECAY);
    // The side drift is perpendicular: (-ay, ax).
    b.vx = Math.round(this.ax * this.along - this.ay * this.side);
    b.vy = Math.round(this.ay * this.along + this.ax * this.side);
    b.x += velToSub(b.vx);
    b.y += velToSub(b.vy);
    const tx = tileAt(b.x + (b.w >> 1));
    const ty = tileAt(b.y + (b.h >> 1));
    const def = tileDef(world.map.get(tx, ty));
    if (def.block && def.block.kind !== 'hidden' && world.map.isSolid(tx, ty)) {
      const p = this.owner instanceof Player ? this.owner : world.nearestPlayer(b.x);
      world.strikeBlock(tx, ty, p, true);
      return this.burst(world);
    }
    const camL = world.camera.x - px(16);
    const camR = world.camera.right + px(16);
    if (b.x + b.w < camL || b.x > camR || b.y > px(this.levelHeightPx + 16) || b.y + b.h < px(-64))
      this.destroy();
  }

  override burst(world: World): void {
    world.spawn(new SophiaBoom(this.body.x + (this.body.w >> 1), this.body.y + (this.body.h >> 1), 8));
    world.audio.sfx(SOUNDS.explode);
    this.destroy();
  }

  killEffect(world: World, e: Entity): boolean {
    return killBoom(world, e, this.owner);
  }

  override render(r: Renderer, view: View): void {
    const ax = this.ax === 0 && this.ay === 0 ? 1 : this.ax;
    drawTurned(r, view, this.body, 'missile', ax, this.ay);
  }
}

/** An enemy a Homing Missile may lock on to: hittable, not armoured, not fire (SO-31). */
export function homingTarget(e: Enemy): boolean {
  const v = e.vulnerability.fireball;
  return e.alive && e.contactHurts && v !== undefined && v !== 'immune' && v !== 'hurtAttacker';
}

/** The nearest such enemy on screen. */
export function nearestHomingTarget(world: World, x: number, y: number): Enemy | null {
  let best: Enemy | null = null;
  let bd = Infinity;
  for (const e of world.enemies) {
    if (!homingTarget(e)) continue;
    if (e.body.x + e.body.w < world.camera.x || e.body.x > world.camera.right) continue;
    const dx = e.body.x + (e.body.w >> 1) - x;
    const dy = e.body.y + (e.body.h >> 1) - y;
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/**
 * A Homing Missile (SO-31): from rest, its thrust grows every frame toward the nearest valid
 * enemy's centre, damped and capped per axis. With no target it coasts and blows up after 2 s.
 * It ignores every tile.
 */
export class HomingMissile extends Projectile {
  private thrust = 0;
  private idle = 0;
  constructor(cx: number, cy: number, owner: Player) {
    super(cx - px(HOMING.w >> 1), cy - px(HOMING.h >> 1), 1, HOMING, owner, { vx: 0, vy: 0 });
  }

  override update(world: World): void {
    const b = this.body;
    this.age++;
    const cx = b.x + (b.w >> 1);
    const cy = b.y + (b.h >> 1);
    const target = nearestHomingTarget(world, cx, cy);
    this.thrust += HOMING_THRUST_STEP * 4096;
    if (target) {
      this.idle = 0;
      const a = Math.atan2(
        target.body.y + (target.body.h >> 1) - cy,
        target.body.x + (target.body.w >> 1) - cx,
      );
      b.vx = Math.cos(a) * this.thrust + b.vx;
      b.vy = Math.sin(a) * this.thrust + b.vy;
      b.vx = Math.round(Math.max(-SHOT_SPEED, Math.min(SHOT_SPEED, b.vx * HOMING_DAMP)));
      b.vy = Math.round(Math.max(-SHOT_SPEED, Math.min(SHOT_SPEED, b.vy * HOMING_DAMP)));
    } else if (++this.idle >= HOMING_IDLE) return this.burst(world);
    b.x += velToSub(b.vx);
    b.y += velToSub(b.vy);
    const camL = world.camera.x - px(16);
    const camR = world.camera.right + px(16);
    const off = b.x + b.w < camL || b.x > camR || b.y > px(this.levelHeightPx + 16) || b.y + b.h < px(-64);
    // Locked on it may swing off screen and back; idle it is gone once off screen.
    if (off && (!target || b.x + b.w < camL - px(256) || b.x > camR + px(256))) this.destroy();
  }

  override burst(world: World): void {
    world.spawn(new SophiaBoom(this.body.x + (this.body.w >> 1), this.body.y + (this.body.h >> 1), 8));
    world.audio.sfx(SOUNDS.explode);
    this.destroy();
  }

  killEffect(world: World, e: Entity): boolean {
    return killBoom(world, e, this.owner);
  }

  override render(r: Renderer, view: View): void {
    drawTurned(r, view, this.body, `homing-${(this.age >> 2) & 1}`, this.body.vx, this.body.vy);
  }
}
