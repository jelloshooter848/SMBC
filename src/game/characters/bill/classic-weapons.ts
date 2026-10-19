import type { Renderer, Rotation } from '@engine/gfx/renderer';
import { frameSize } from '@engine/gfx/spritesheet';
import { px, toPx, velToSub } from '@engine/math/units';
import type { View } from '../../entities/entity';
import type { Player } from '../../entities/player';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import type { World } from '../../world/world';

/**
 * Classic SMBC Bill's guns (bug-reports/2026-10-07-bill-classic-smbc-rules.md, BI-C16..BI-C27;
 * the original's BillBullet.as). Speeds are in 1/4096 px/f, damage in the original's units.
 * Every shot is a BillShot: a 3 × 3 px hit box centred on its position, flying through solid
 * ground and pipes but striking bricks and ? blocks (classicBlocks 'pass'), exploding on the first
 * enemy or block it touches (armoured or not), and showing that explosion for 3 frames while it
 * still counts toward Bill's caps (BI-C26).
 */

export type ClassicGunId = 'rifle' | 'mg' | 'spread' | 'laser' | 'flare';

export interface ClassicGun {
  id: ClassicGunId;
  /** Speed of an axis shot (velocity units). */
  straight: number;
  /** Speed on each axis of a diagonal shot (0.75 × the original's speed). */
  diag: number;
  /** Damage per bullet, pellet or segment (DamageValue.as, Attack Strength Normal). */
  amount: number;
  /** Fires only while fewer than this many of Bill's shots are out (BI-C17). */
  cap: number;
  spec: ProjectileSpec;
  /** Touch caption and kit-belt icon. */
  label: string;
  icon: string;
}

const base: ProjectileSpec = {
  kind: 'bill-rifle',
  damage: 'buster',
  amount: 100,
  speed: 0x02666,
  gravity: 0,
  bounceVy: null,
  // With classicBlocks 'pass' the shot flies free; `hitsTiles` only makes an 'immune' enemy burst
  // it (BI-C26: every shot stops on its first hit).
  hitsTiles: true,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  w: 3,
  h: 3,
  sheet: 'items',
  frames: ['rifle-shot'],
  frameRate: 1,
  pierce: false,
  onBlocked: 'burst',
  classicBlocks: { ground: 'pass', afterBlock: 'end', strikesBlocks: true },
};

export const CLASSIC_GUNS: Readonly<Record<ClassicGunId, ClassicGun>> = {
  // 288 Flash px/s: 2.40 px/f; diagonal 1.80 px/f each axis.
  rifle: {
    id: 'rifle',
    straight: 0x02666,
    diag: 0x01ccd,
    amount: 100,
    cap: 4,
    label: 'RIFLE',
    icon: 'icon-rifle',
    spec: base,
  },
  // 315: 2.625 px/f.
  mg: {
    id: 'mg',
    straight: 0x02a00,
    diag: 0x01f80,
    amount: 125,
    cap: 6,
    label: 'M-GUN',
    icon: 'icon-mg',
    spec: { ...base, kind: 'bill-mg', amount: 125, speed: 0x02a00 },
  },
  // 333: 2.775 px/f.
  spread: {
    id: 'spread',
    straight: 0x02c66,
    diag: 0x0214d,
    amount: 125,
    cap: 10,
    label: 'SPREAD',
    icon: 'icon-spread',
    spec: {
      ...base,
      kind: 'bill-spread',
      amount: 125,
      speed: 0x02c66,
      frames: ['spread-shot-0', 'spread-shot-1'],
      frameRate: 2,
    },
  },
  laser: {
    id: 'laser',
    straight: 0x02c66,
    diag: 0x0214d,
    amount: 100,
    cap: Infinity,
    label: 'LASER',
    icon: 'icon-laser',
    spec: { ...base, kind: 'bill-laser', amount: 100, speed: 0x02c66, frames: ['bill-laser'] },
  },
  // 211: 1.758 px/f for the centre; armour-piercing (BillBullet.as:229).
  flare: {
    id: 'flare',
    straight: 0x01c22,
    diag: 0x0151a,
    amount: 200,
    cap: 6,
    label: 'FLARE',
    icon: 'icon-flame-gun',
    spec: {
      ...base,
      kind: 'bill-flare',
      amount: 200,
      speed: 0x01c22,
      frames: ['fireball-0', 'fireball-1', 'fireball-2', 'fireball-3'],
      frameRate: 2,
      classicHit: { pierce: 5 },
    },
  },
};

/** Frames a shot shows its explosion after a hit (DESTROY_TMR 50 ms; BI-C26). */
export const BLAST_FRAMES = 3;
/** The Flare's fireball circles its centre at this radius (FLARE_RADIUS 32 Flash px; BI-C24). */
export const FLARE_RADIUS = 16;
/** The Flare's turn per frame (FLARE_ROT_SPEED 22 rad/s at 60 fps). */
export const FLARE_STEP = 22 / 60;
/** Spread pellets grow +0.018 a frame up to 1.6 (drawn only; the hit box stays 3 × 3). */
const SPREAD_GROW = 0.018;
const SPREAD_MAX_SCALE = 1.6;

export interface BillShotOptions {
  /** Frames the shot flies invisible and harmless (Laser segments 2-4, BI-C23). */
  dormant?: number;
  /** A Flare: its fireball circles the shot's centre, from `angle` (rad), turning `spin` (±1). */
  flare?: { angle: number; spin: 1 | -1 };
}

/** One of Classic Bill's shots (see the file comment). `x`, `y` is its centre (subpixels). */
export class BillShot extends Projectile {
  /** Explosion frames left (BI-C26); 0 while flying. */
  blast = 0;
  /** Frames left before a Laser segment switches on. */
  dormant: number;
  private readonly flare: { angle: number; spin: 1 | -1 } | null;
  /** A Flare's invisible centre (subpixels). */
  private cx: number;
  private cy: number;
  constructor(
    readonly gun: ClassicGunId,
    cx: number,
    cy: number,
    owner: Player,
    vx: number,
    vy: number,
    opts: BillShotOptions = {},
  ) {
    const spec = CLASSIC_GUNS[gun].spec;
    const half = px(spec.w) >> 1;
    super(cx - half, cy - half, vx < 0 ? -1 : 1, spec, owner, { vx, vy });
    this.dormant = opts.dormant ?? 0;
    this.flare = opts.flare ? { ...opts.flare } : null;
    this.cx = cx;
    this.cy = cy;
    // A dormant segment or an exploding shot hits nothing (World.projectile skips `deflected`).
    if (this.dormant > 0) this.deflected = true;
    if (this.flare) this.placeFlare();
  }

  /** How much this shot counts toward Bill's caps: a Flare 2, for its invisible centre (BI-C17). */
  get weight(): number {
    return this.gun === 'flare' ? 2 : 1;
  }

  override update(world: World): void {
    const b = this.body;
    if (this.blast > 0) {
      this.age++;
      if (--this.blast <= 0) this.destroy();
      return;
    }
    if (this.dormant > 0) {
      this.age++;
      b.x += velToSub(b.vx);
      b.y += velToSub(b.vy);
      if (--this.dormant === 0) this.deflected = false;
      return;
    }
    if (this.flare) {
      this.age++;
      this.cx += velToSub(b.vx);
      this.cy += velToSub(b.vy);
      this.flare.angle += this.flare.spin * FLARE_STEP;
      this.placeFlare();
      if (world.shotBlocks(this)) return this.burst(world);
    } else {
      super.update(world);
      if (!this.alive || this.blast > 0) return;
    }
    // Gone once off the screen, on any side (BI-C18).
    const cam = world.camera;
    if (
      b.x + b.w < cam.x - px(16) ||
      b.x > cam.right + px(16) ||
      b.y + b.h < cam.y - px(16) ||
      b.y > cam.bottom + px(16)
    )
      this.destroy();
  }

  private placeFlare(): void {
    const f = this.flare as { angle: number };
    const b = this.body;
    b.x = this.cx + Math.round(Math.cos(f.angle) * px(FLARE_RADIUS)) - (b.w >> 1);
    b.y = this.cy + Math.round(Math.sin(f.angle) * px(FLARE_RADIUS)) - (b.h >> 1);
  }

  /** The fireball's centre (subpixels) and the Flare's centre, for tests. */
  flareCentre(): { x: number; y: number } | null {
    return this.flare ? { x: this.cx, y: this.cy } : null;
  }

  /** A hit: it stops and shows its explosion for 3 frames, hitting nothing more (BI-C26). */
  override burst(_world: World): void {
    if (this.blast > 0 || !this.alive) return;
    this.blast = BLAST_FRAMES;
    this.body.vx = 0;
    this.body.vy = 0;
    this.deflected = true;
  }

  override render(r: Renderer, view: View): void {
    if (this.dormant > 0) return;
    const sheet = view.assets.sheet(this.spec.sheet);
    const b = this.body;
    let frame: string;
    let rotate: Rotation = 0;
    let flip = false;
    let scale = 1;
    if (this.blast > 0) frame = 'bill-blast';
    else {
      const fr = this.spec.frames;
      frame = fr[Math.floor(this.age / this.spec.frameRate) % fr.length] as string;
      if (this.gun === 'laser') {
        if (b.vx === 0) rotate = 90;
        else if (b.vy !== 0) {
          frame = 'bill-laser-diag';
          flip = b.vx * b.vy < 0;
        }
      } else if (this.gun === 'spread') scale = Math.min(SPREAD_MAX_SCALE, 1 + SPREAD_GROW * this.age);
      else flip = b.vx < 0;
    }
    const size = frameSize(sheet, frame);
    const w = rotate ? size.h : size.w * scale;
    const h = rotate ? size.w : size.h * scale;
    const x = Math.round(toPx(b.x + (b.w >> 1)) - w / 2) - view.camX;
    const y = Math.round(toPx(b.y + (b.h >> 1)) - h / 2);
    if (rotate) r.sprite(sheet, frame, x, y, false, false, rotate);
    else if (scale !== 1) r.sprite(sheet, frame, x, y, flip, false, 0, scale);
    else r.sprite(sheet, frame, x, y, flip);
  }
}

/** This Bill's shots on screen, a Flare counting 2 (BI-C17, BI-C29: only his own). */
export function billShotsOut(world: World, p: Player): number {
  let n = 0;
  for (const e of world.entities) if (e instanceof BillShot && e.alive && e.owner === p) n += e.weight;
  return n;
}

/** The Laser's clear: every projectile of this Bill goes (BI-C23). */
export function clearBillShots(world: World, p: Player): void {
  for (const e of world.entities) if (e instanceof Projectile && e.alive && e.owner === p) e.destroy();
}
