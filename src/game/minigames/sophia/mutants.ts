import type { Renderer } from '@engine/gfx/renderer';
import { DIR_VEC, centre, dirToward, type Box, type Dir } from '../../topdown/geometry';
import { TdEnemy, TdEntity, pickupSize } from '../../topdown/entity';
import { Projectile } from '../../topdown/enemies';
import type { TdView } from '../../topdown/view';
import type { Mover, TopDownWorld } from '../../topdown/world';
import { drawPiece, LOOK } from './art';
import { CAPSULE_LIFE, Capsule, type CapsuleKind } from './jason';

/*
 * The dungeon's mutants, Blaster Master overhead style (original designs): blobs that creep at
 * Jason in bursts, floating eyes that glare and spit an aimed orb, and wall turrets that turn
 * their barrel a quarter at a time and fire when it points at him. Each one bursts into a boom and
 * may leave a capsule (seeded).
 */

/** A boom where a mutant burst (four frames). */
export class Boom extends TdEntity {
  override layer = 3;
  t = 0;
  update(): void {
    if (++this.t >= 20) this.dead = true;
  }
  render(r: Renderer, view: TdView, ox: number, oy: number): void {
    const k = Math.min(3, Math.floor(this.t / 5));
    drawPiece(r, view.sheet(view.sheets.enemies), `boom-${k}`, ox + this.x, oy + this.y, 16, 16, LOOK.boom);
  }
}

/** A mutant's orb: a slow shot (no shield to stop it). */
export class Orb extends Projectile {
  constructor(x: number, y: number, vx: number, vy: number, frames: readonly string[] = ['orb-0', 'orb-1']) {
    super(x, y, vx, vy, null);
    this.blockable = false;
    this.frames = frames;
    this.color = LOOK.orb[1];
  }
  override render(r: Renderer, view: TdView, ox: number, oy: number): void {
    const f = this.frames[(view.frame >> 2) % this.frames.length] as string;
    drawPiece(r, view.sheet(view.sheets.enemies), f, ox + this.x, oy + this.y, this.w, this.h, LOOK.orb);
  }
}

/** An orb from (cx, cy) at `speed` toward a point. */
export function aimedOrb(cx: number, cy: number, to: { x: number; y: number }, speed: number): Orb {
  const a = Math.atan2(to.y - cy, to.x - cx);
  return new Orb(cx - 4, cy - 4, Math.cos(a) * speed, Math.sin(a) * speed);
}

/** Frames a mutant can't be hurt again after a hit. */
export const MUTANT_INVULN = 6;

/** The chance a capsule is a G (the rest are P). */
export const GUN_SHARE = 0.45;

/**
 * A mutant: on death a boom, and maybe a capsule (its `capsuleChance`, then GUN_SHARE for a G),
 * lasting CAPSULE_LIFE frames.
 */
export abstract class Mutant extends TdEnemy {
  override dropChance = 0;
  capsuleChance = 0.4;

  /** Shots come in volleys: a mutant is untouchable only MUTANT_INVULN frames after a hit. */
  override hurt(world: TopDownWorld, damage: number, dir: Dir): boolean {
    const hit = super.hurt(world, damage, dir);
    if (hit && !this.dead) this.invuln = Math.min(this.invuln, MUTANT_INVULN);
    return hit;
  }

  override die(world: TopDownWorld): void {
    this.dead = true;
    world.emit({ type: 'kill', kind: this.kind });
    const c = centre(this.body());
    world.add(new Boom(Math.round(c.x - 8), Math.round(c.y - 8)));
    if (this.capsuleChance <= 0 || !world.rng.chance(this.capsuleChance)) return;
    const kind: CapsuleKind = world.rng.chance(GUN_SHARE) ? 'gun' : 'pow';
    const size = pickupSize(kind);
    const x = Math.round((c.x - size.w / 2) / 8) * 8;
    const y = Math.round((c.y - size.h / 2) / 8) * 8;
    const at = world.openSpotNear({ x, y, ...size });
    world.add(new Capsule(at.x, at.y, kind, CAPSULE_LIFE));
  }

  protected blink(view: TdView): boolean {
    return this.blinkHidden(view);
  }
}

/* ------------------------------------------------------------------------------------------ */

/** A blob creeps for this long, then rests for BLOB_REST. */
export const BLOB_CREEP = 48;
export const BLOB_REST = 28;

/**
 * A blob: creeps straight at Jason in bursts (a pixel every other frame, sliding along walls),
 * rests a moment, creeps again. Two hits.
 */
export class Blob extends Mutant {
  readonly kind = 'blob';
  hp = 2;
  override capsuleChance = 0.25;
  t: number;

  constructor(x: number, y: number, phase = 0) {
    super(x, y);
    this.t = phase;
  }

  override hurtbox(): Box {
    return { x: this.x + 2, y: this.y + 4, w: 12, h: 10 };
  }

  get resting(): boolean {
    return this.t % (BLOB_CREEP + BLOB_REST) >= BLOB_CREEP;
  }

  protected think(world: TopDownWorld): void {
    this.t++;
    if (this.resting || (this.t & 1) === 0) return;
    const me = centre(this.hurtbox());
    const to = centre(world.hero.hurtbox());
    const dx = Math.sign(Math.round(to.x - me.x));
    const dy = Math.sign(Math.round(to.y - me.y));
    const first = Math.abs(to.x - me.x) >= Math.abs(to.y - me.y);
    const tryX = () => dx !== 0 && world.moveEntity(this, dx, 0, this.mover);
    const tryY = () => dy !== 0 && world.moveEntity(this, 0, dy, this.mover);
    if (first ? !tryX() : !tryY()) {
      if (first) tryY();
      else tryX();
    }
    if (dx !== 0) this.facing = dx < 0 ? 'left' : 'right';
  }

  render(r: Renderer, view: TdView, ox: number, oy: number): void {
    if (this.blink(view)) return;
    const f = this.resting ? 'blob-0' : `blob-${(this.t >> 3) & 1}`;
    drawPiece(r, view.sheet(view.sheets.enemies), f, ox + this.x, oy + this.y, 16, 16, LOOK.blob);
  }
}

/* ------------------------------------------------------------------------------------------ */

/** An eye glares every EYE_EVERY frames: still for EYE_GLARE frames, then it spits. */
export const EYE_EVERY = 150;
export const EYE_GLARE = 24;
export const EYE_ORB_SPEED = 1.5;
/** Its drift: a slow loop this wide round where it was placed. */
export const EYE_LOOP = 16;

/**
 * A floating eye: loops slowly round its post (over water and blocks), and every EYE_EVERY
 * frames stops and glares (EYE_GLARE frames: its warning), then spits an orb at Jason. Three hits.
 */
export class Eye extends Mutant {
  readonly kind = 'eye';
  hp = 3;
  override mover: Mover = 'fly';
  override capsuleChance = 0.4;
  t: number;
  private readonly homeX: number;
  private readonly homeY: number;

  constructor(x: number, y: number, phase = 0) {
    super(x, y);
    this.homeX = x;
    this.homeY = y;
    this.t = phase;
  }

  override hurtbox(): Box {
    return { x: this.x + 2, y: this.y + 2, w: 12, h: 12 };
  }

  get glaring(): boolean {
    return this.t % EYE_EVERY >= EYE_EVERY - EYE_GLARE;
  }

  protected think(world: TopDownWorld): void {
    this.t++;
    const k = this.t % EYE_EVERY;
    if (k === 0) {
      const me = centre(this.hurtbox());
      world.add(aimedOrb(me.x, me.y, centre(world.hero.hurtbox()), EYE_ORB_SPEED));
      world.emit({ type: 'spit' });
    }
    if (this.glaring) return;
    const a = (this.t / 90) * 2 * Math.PI;
    const tx = Math.round(this.homeX + Math.cos(a) * EYE_LOOP);
    const ty = Math.round(this.homeY + Math.sin(a) * (EYE_LOOP / 2));
    world.moveEntity(this, Math.sign(tx - this.x), Math.sign(ty - this.y), this.mover);
  }

  render(r: Renderer, view: TdView, ox: number, oy: number): void {
    if (this.blink(view)) return;
    const f = this.glaring ? 'eye-1' : 'eye-0';
    drawPiece(r, view.sheet(view.sheets.enemies), f, ox + this.x, oy + this.y, 16, 16, LOOK.eye);
    if (this.glaring && !view.sheet(view.sheets.enemies)?.frames.has(f))
      r.rect(ox + this.x + 6, oy + this.y + 6, 4, 4, '#f83800');
  }
}

/* ------------------------------------------------------------------------------------------ */

/** A turret turns a quarter every TURRET_TURN frames; pointing at Jason it aims TURRET_AIM, then fires. */
export const TURRET_TURN = 48;
export const TURRET_AIM = 20;
export const TURRET_ORB_SPEED = 2;
/** The barrel's quarters, clockwise from up (its frames `turret-o-0..3`). */
const BARREL: readonly Dir[] = ['up', 'right', 'down', 'left'];

/**
 * A turret set into the floor: solid, it never moves. Its barrel turns clockwise a quarter at a
 * time; when it comes round to point at Jason (his main direction from it) it holds there
 * TURRET_AIM frames, then fires an orb along the barrel. Four hits.
 */
export class Turret extends Mutant {
  readonly kind = 'turret';
  hp = 4;
  override knockable = false;
  override solid = true;
  override capsuleChance = 0.5;
  /** The barrel's quarter (0 up, 1 right, 2 down, 3 left). */
  barrel: number;
  t = 0;
  /** Frames into its aim (0: turning). */
  aimT = 0;

  constructor(x: number, y: number, barrel = 0) {
    super(x, y);
    this.barrel = barrel & 3;
  }

  override hurtbox(): Box {
    return { x: this.x + 1, y: this.y + 1, w: 14, h: 14 };
  }

  get pointing(): Dir {
    return BARREL[this.barrel] as Dir;
  }

  protected think(world: TopDownWorld): void {
    if (this.aimT > 0) {
      if (++this.aimT >= TURRET_AIM) {
        this.aimT = 0;
        this.fire(world);
      }
      return;
    }
    if (++this.t % TURRET_TURN !== 0) return;
    this.barrel = (this.barrel + 1) & 3;
    if (this.pointing === dirToward(this.body(), world.hero.hurtbox())) this.aimT = 1;
  }

  private fire(world: TopDownWorld): void {
    const v = DIR_VEC[this.pointing];
    const cx = this.x + 8 + v.dx * 12;
    const cy = this.y + 8 + v.dy * 12;
    world.add(new Orb(cx - 4, cy - 4, v.dx * TURRET_ORB_SPEED, v.dy * TURRET_ORB_SPEED));
    world.emit({ type: 'spit' });
  }

  render(r: Renderer, view: TdView, ox: number, oy: number): void {
    if (this.blink(view)) return;
    const sheet = view.sheet(view.sheets.enemies);
    const f = `turret-o-${this.barrel}`;
    drawPiece(r, sheet, f, ox + this.x, oy + this.y, 16, 16, LOOK.turret);
    if (!sheet?.frames.has(f)) {
      const v = DIR_VEC[this.pointing];
      r.rect(
        ox + this.x + 6 + v.dx * 6,
        oy + this.y + 6 + v.dy * 6,
        4,
        4,
        this.aimT > 0 ? '#f83800' : '#000000',
      );
    }
  }
}
