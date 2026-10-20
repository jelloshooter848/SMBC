import type { Renderer } from '@engine/gfx/renderer';
import { overlaps, type AABB } from '@engine/math/aabb';
import { px, tileAt, toPx, velToSub } from '@engine/math/units';
import { moveY } from '../../entities/body';
import { Entity, type View } from '../../entities/entity';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import { PowerUp } from '../../entities/objects/powerup';
import { HeroItem } from '../../entities/objects/hero-item';
import { Pickup } from '../../entities/objects/pickup';
import { Player } from '../../entities/player';
import type { ClassicHitProps } from '../../rules/damage';
import { T, tileDef } from '../../level/tiles';
import type { World } from '../../world/world';
import { heroSound } from '../classic/sounds';

/**
 * Classic SMBC Link's weapons (2026-10-07-link-classic-smbc-rules.md, LK-C28..LK-C38): the Red
 * Ring sword beam, the arrows (dev full kit), the 8-way fetching boomerang and the safe bombs.
 * Damage in the original's units (DamageValue.as; a Goomba has 250). Flash px/s ÷ 120 = px/f,
 * px/s² ÷ 7200 = px/f², Flash px ÷ 2 = px; velocities in 1/4096 px/f.
 */

/** Half pixels and other fractions to subpixels. */
export const sub = (pxf: number): number => Math.round(pxf * 256);

/** The 400 ms (24 f) stop and flash every sword, beam, arrow and bomb hit gives (Link.as 327-328). */
export const LINK_STRIKE: ClassicHitProps = { pierce: 0, stopFrames: 24, flashFrames: 24 };

/** Every Link shot's tile rule (LK-C29, BR-C9): through ground, ends at the first block it strikes. */
const PASS_TO_BLOCK = { ground: 'pass', afterBlock: 'end', strikesBlocks: true } as const;

/** The Red Ring's beam (LinkProjectile.as): 500 px/s, 200 damage, pierce 0, 32 × 6 Flash px. */
export const LINK_BEAM: ProjectileSpec = {
  kind: 'sword-beam',
  damage: 'sword',
  amount: 200,
  speed: 0x042ab,
  gravity: 0,
  bounceVy: null,
  hitsTiles: false,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  w: 16,
  h: 3,
  sheet: 'items',
  frames: ['sword-beam'],
  frameRate: 1,
  classicHit: LINK_STRIKE,
  classicBlocks: PASS_TO_BLOCK,
};
/** The beam flying up or down (3 × 16 px). */
export const LINK_BEAM_V: ProjectileSpec = { ...LINK_BEAM, w: 3, h: 16 };

/** An arrow (LK-C38, `&kit=full` only): 500 px/s, 350 damage, pierce 0, stopped by what it hits. */
export const LINK_ARROW: ProjectileSpec = { ...LINK_BEAM, kind: 'arrow', amount: 350, frames: ['arrow'] };
export const LINK_ARROW_V: ProjectileSpec = { ...LINK_ARROW, w: 3, h: 16 };

/** Beam burst (LinkSimpleGraphics.as): 4 sparks, 5 px out, 115 px/s per axis, 21 f. */
export const BEAM_BURST_FRAMES = 21;
const BURST_START = 5;
const BURST_SPEED = 0x00f55; // 0.958 px/f

/** Which way a Link shot flies. */
export type ShotDir = 'forward' | 'up' | 'down';

/**
 * Where a beam or arrow starts (LK-C28): its centre relative to Link's centre x and feet, facing
 * right (mirrored facing left).
 */
const SHOT_SPAWN: Record<ShotDir, { x: number; y: number }> = {
  forward: { x: 10.5, y: -6.5 },
  up: { x: -1.5, y: -20 },
  down: { x: 0.5, y: 3 },
};

/**
 * A beam or arrow (LK-C28, LK-C29, LK-C38): flies straight, through ground and used blocks; the
 * first brick or ? block it touches is struck and ends it; an enemy ends it (World.projectile).
 * Gone once it leaves the screen on any side.
 */
export class LinkShot extends Projectile {
  constructor(
    x: number,
    y: number,
    facing: -1 | 1,
    spec: ProjectileSpec,
    owner: Player,
    readonly dir: ShotDir,
  ) {
    const speed = spec.speed;
    super(x, y, facing, spec, owner, {
      vx: dir === 'forward' ? facing * speed : 0,
      vy: dir === 'up' ? -speed : dir === 'down' ? speed : 0,
    });
  }

  /** A shot from `p` flying `dir`, centred on its spawn point. */
  static fire(p: Player, dir: ShotDir, arrow: boolean): LinkShot {
    const vertical = dir !== 'forward';
    const spec = arrow ? (vertical ? LINK_ARROW_V : LINK_ARROW) : vertical ? LINK_BEAM_V : LINK_BEAM;
    const at = SHOT_SPAWN[dir];
    const cx = p.centerX + p.facing * sub(at.x);
    const cy = p.feetY + sub(at.y);
    return new LinkShot(cx - px(spec.w) / 2, cy - px(spec.h) / 2, p.facing, spec, p, dir);
  }

  override update(world: World): void {
    super.update(world);
    if (!this.alive) return;
    const b = this.body;
    if (b.y + b.h < world.camera.y || b.y > world.camera.bottom) this.destroy();
  }

  /** A beam bursts into 4 sparks (the one-beam lock lasts until they are gone); an arrow just stops. */
  override burst(world: World): void {
    if (this.kind === 'sword-beam' && this.owner instanceof Player) {
      const b = this.body;
      world.spawn(new BeamBurst(b.x + (b.w >> 1), b.y + (b.h >> 1), this.owner));
    }
    this.destroy();
  }

  override render(r: Renderer, view: View): void {
    const base = this.spec.frames[0] as string;
    const frame = this.dir === 'forward' ? base : `${base}-${this.dir}`;
    const sheet = view.assets.sheet('items');
    const f = sheet.frames?.get(frame);
    const w = f?.w ?? 16;
    const h = f?.h ?? 8;
    const b = this.body;
    const x = toPx(b.x + (b.w >> 1)) - (w >> 1) - view.camX;
    const y = toPx(b.y + (b.h >> 1)) - (h >> 1);
    r.sprite(sheet, frame, x, y, this.dir === 'forward' && this.facing < 0);
  }
}

/** The beam's 4-spark burst (no damage). While it lasts no new beam fires (LK-C28). */
export class BeamBurst extends Entity {
  readonly kind = 'beam-burst';
  age = 0;
  constructor(
    readonly cx: number,
    readonly cy: number,
    readonly owner: Player,
  ) {
    super(cx, cy, 1, 1);
    this.layer = 'front';
  }
  update(): void {
    if (++this.age >= BEAM_BURST_FRAMES) this.destroy();
  }
  render(r: Renderer, view: View): void {
    const d = BURST_START + (this.age * BURST_SPEED) / 4096;
    const x = toPx(this.cx) - view.camX;
    const y = toPx(this.cy);
    const colour = view.reduceFlashing || (this.age & 2) === 0 ? '#a4e4fc' : '#fcfcfc';
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const)
      r.rect(Math.round(x + sx * d) - 1, Math.round(y + sy * d) - 1, 3, 3, colour);
  }
}

/** A beam of `p`'s is on screen or bursting: no new one (LK-C28). */
export function beamLocked(p: Player, world: World): boolean {
  return (
    world.countProjectiles(p, 'sword-beam') > 0 ||
    world.entities.some((e) => e instanceof BeamBurst && e.alive && e.owner === p)
  );
}

/* ---------- boomerang ---------- */

/** One boomerang's numbers (LinkBoomerang.as; LK-C32, LK-C33). */
export interface BoomerangKind {
  spec: ProjectileSpec;
  /** Brakes once this far (px, straight line) from its start; null: no range (the Magic one). */
  range: number | null;
  /** Homing pull a frame per px of distance on each axis (px/f per px). */
  pull: number;
}

/** Brake and near-damp factor a frame (0.000001^(1/60)). */
export const BOOMERANG_BRAKE = 0.7943;
/** Below this speed (px/f) on an axis that moves, a braking boomerang turns. */
const TURN_SPEED = 0.8333;
/** Within this many px of Link on an axis, that axis is damped. */
const NEAR_AXIS = 15;
/** Within this many px of Link, it gets an extra pull on each axis (px/f). */
const NEAR = 40;
const NEAR_PULL = 0x0058e / 4096;
/** Diagonal throws: this much of the speed on each axis (`diagMult`). */
export const BOOMERANG_DIAG = 0.75;

const BOOMERANG_SPEC: ProjectileSpec = {
  kind: 'boomerang',
  damage: 'boomerang',
  amount: 0,
  speed: 0x02800,
  gravity: 0,
  bounceVy: null,
  hitsTiles: false,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  w: 8,
  h: 8,
  sheet: 'items',
  frames: ['boomerang-0', 'boomerang-1', 'boomerang-2', 'boomerang-3'],
  frameRate: 2,
  pierce: true,
  // Touches each enemy once per contact, out and back (World.projectile's releaseHits).
  rehitAfter: 0,
  // No damage; a 3000 ms stop that gets through armour (pierce 10). Bowser and Lakitu resist it.
  classicHit: { pierce: 10, stopFrames: 180 },
  classicBlocks: { ground: 'none', afterBlock: 'continue', strikesBlocks: false },
};

/**
 * LK-C34: no damage, a 180-frame stop through armour; Bowser and Lakitu resist it (resistsStop).
 */
/** The yellow boomerang (LK-C32): 300 px/s, brakes 75 px out, pull 0.00694 per px. */
export const SHORT_BOOMERANG: BoomerangKind = { spec: BOOMERANG_SPEC, range: 75, pull: 0.00694 };
/** The Magic Boomerang (LK-C33): 400 px/s, no range, pull 0.01667 per px. */
export const MAGIC_BOOMERANG: BoomerangKind = {
  spec: {
    ...BOOMERANG_SPEC,
    speed: 0x03555,
    frames: ['magic-boomerang-0', 'magic-boomerang-1', 'magic-boomerang-2', 'magic-boomerang-3'],
  },
  range: null,
  pull: 0.01667,
};

/**
 * Link's boomerang (LinkBoomerang.as; LK-C30..LK-C35): flies out, brakes past its range (the
 * yellow one), turns once at its range, the screen edge or the first enemy it touches, then homes
 * on Link and is caught when it touches him. It passes through every tile and fetches what it
 * touches (World.deliverFetch on the catch). Velocities kept as floats in px/f for the homing.
 */
export class LinkBoomerang extends Projectile {
  private fx: number;
  private fy: number;
  private readonly startX: number;
  private readonly startY: number;
  private braking = false;
  turned = false;
  /** World frame of the last update: enemy hits since then turn it. */
  private checked = -1;

  constructor(
    cx: number,
    cy: number,
    dx: -1 | 0 | 1,
    dy: -1 | 0 | 1,
    owner: Player,
    readonly type: BoomerangKind,
  ) {
    const spec = type.spec;
    const s = spec.speed / 4096;
    const k = dx !== 0 && dy !== 0 ? BOOMERANG_DIAG : 1;
    super(cx - px(spec.w >> 1), cy - px(spec.h >> 1), dx < 0 ? -1 : 1, spec, owner, { vx: 0, vy: 0 });
    this.fx = dx * s * k;
    this.fy = dy * s * k;
    this.startX = cx;
    this.startY = cy;
  }

  /** The point a throw starts from and its direction, by what is held (LK-C31). */
  static throwFrom(
    p: Player,
    up: boolean,
    down: boolean,
    dirX: -1 | 0 | 1,
    type: BoomerangKind,
  ): LinkBoomerang {
    const b = p.body;
    const half = b.w >> 1;
    let dx: -1 | 0 | 1;
    let dy: -1 | 0 | 1 = 0;
    let cy: number;
    if (up) {
      dy = -1;
      dx = dirX;
      cy = b.y;
    } else if (down) {
      dy = 1;
      dx = dirX;
      cy = b.y + b.h;
    } else {
      dx = p.facing;
      cy = b.y + (b.h >> 1);
    }
    const cx = p.centerX + dx * half;
    return new LinkBoomerang(cx, cy, dx, dy, p, type);
  }

  override update(world: World): void {
    const b = this.body;
    this.age++;
    const owner = this.owner as Player;
    if (owner.dead || owner.out) return this.destroy();
    const s = this.type.spec.speed / 4096;
    if (!this.turned) {
      // The first enemy touched (World.projectile records it in hitAt after this update) turns it.
      if ([...(this.hitAt?.values() ?? [])].some((f) => f >= this.checked)) this.turn();
      else if (this.atScreenEdge(world)) this.turn();
      else if (this.type.range !== null) {
        const cx = b.x + (b.w >> 1);
        const cy = b.y + (b.h >> 1);
        if (!this.braking && Math.hypot(cx - this.startX, cy - this.startY) > px(this.type.range))
          this.braking = true;
        if (this.braking) {
          this.fx *= BOOMERANG_BRAKE;
          this.fy *= BOOMERANG_BRAKE;
          const moving = [this.fx, this.fy].filter((v) => v !== 0).map(Math.abs);
          if (moving.length === 0 || Math.max(...moving) < TURN_SPEED) this.turn();
        }
      }
    }
    if (this.turned) {
      // Homing on Link's centre (LK-C32): a pull growing with the distance on each axis, a damp
      // near him on an axis, and an extra pull within 40 px.
      const ob = owner.body;
      const dxPx = (ob.x + (ob.w >> 1) - (b.x + (b.w >> 1))) / 256;
      const dyPx = (ob.y + (ob.h >> 1) - (b.y + (b.h >> 1))) / 256;
      this.fx += this.type.pull * dxPx;
      this.fy += this.type.pull * dyPx;
      if (Math.abs(dxPx) < NEAR_AXIS) this.fx *= BOOMERANG_BRAKE;
      if (Math.abs(dyPx) < NEAR_AXIS) this.fy *= BOOMERANG_BRAKE;
      if (Math.hypot(dxPx, dyPx) < NEAR) {
        this.fx += Math.sign(dxPx) * NEAR_PULL;
        this.fy += Math.sign(dyPx) * NEAR_PULL;
      }
      this.fx = Math.max(-s, Math.min(s, this.fx));
      this.fy = Math.max(-s, Math.min(s, this.fy));
    }
    this.checked = world.frame;
    b.vx = Math.round(this.fx * 4096);
    b.vy = Math.round(this.fy * 4096);
    b.x += velToSub(b.vx);
    b.y += velToSub(b.vy);
    if (b.vx !== 0) this.facing = b.vx > 0 ? 1 : -1;
    fetchItems(world, this);
    if (this.turned && overlaps(b, owner.body)) {
      world.deliverFetch(this);
      this.destroy();
    }
  }

  private turn(): void {
    this.turned = true;
    this.braking = false;
    this.fx = -this.fx;
    this.fy = -this.fy;
  }

  private atScreenEdge(world: World): boolean {
    const b = this.body;
    const c = world.camera;
    return (
      (this.fx < 0 && b.x <= c.x) ||
      (this.fx > 0 && b.x + b.w >= c.right) ||
      (this.fy < 0 && b.y <= c.y) ||
      (this.fy > 0 && b.y + b.h >= c.bottom)
    );
  }
}

/**
 * The boomerang's fetch (LK-C35): level coins it passes come off the map (counted on the catch);
 * Mushrooms, Flowers, Stars, 1-ups and clocks (also still rising out of their block, not a poison
 * mushroom), hero items and drops ride on it until Link catches it.
 */
export function fetchItems(world: World, pr: Projectile): void {
  const b = pr.body;
  for (let ty = tileAt(b.y); ty <= tileAt(b.y + b.h - 1); ty++)
    for (let tx = tileAt(b.x); tx <= tileAt(b.x + b.w - 1); tx++)
      if (tileDef(world.map.get(tx, ty)).pickup === 'coin') {
        world.map.set(tx, ty, T.AIR);
        pr.carriedCoins++;
      }
  for (const e of world.entities) {
    if (!e.alive || !overlaps(b, e.body)) continue;
    const item =
      (e instanceof PowerUp && e.item !== 'poison') ||
      (e instanceof HeroItem && e.out) ||
      e instanceof Pickup;
    if (!item) continue;
    e.destroy();
    pr.carried.push(e);
  }
}

/* ---------- bombs ---------- */

/** LinkProjectile.as bomb: fuse 1000 ms, gravity 1000 px/s², 18 × 26 Flash px. */
export const BOMB_FUSE_FRAMES = 60;
export const BOMB_GRAVITY = 0x00239;
const BOMB_MAX_FALL = 0x04000;
export const BOMB_W = 9;
export const BOMB_H = 13;
/** The blast (frames 6-21 of `LinkProjectileMc` at 30 fps): 32 f, 32 × 40 px, 800 damage, pierce 10. */
export const BLAST_FRAMES = 32;
export const BLAST_DAMAGE = 800;
/** The blast box relative to the bomb's centre x and bottom (px). */
export const BLAST_BOX = { left: -16, right: 16, top: -24.5, bottom: 15.5 };

/**
 * Link's bomb (LK-C36, LK-C37): falls, rests on ground, goes off after 60 f into a 32 f blast that
 * hits each enemy in its box once (one that walks in too), strikes every block it overlaps
 * (bricks break: 800 ≥ 125; hidden blocks too) and never hurts a player.
 */
export class LinkBomb extends Entity {
  readonly kind = 'link-bomb';
  fuse = BOMB_FUSE_FRAMES;
  /** Frames into the blast (0: not yet). */
  blast = 0;
  private readonly hit = new Set<number>();

  constructor(
    cx: number,
    bottom: number,
    readonly owner: Player,
  ) {
    super(cx - sub(BOMB_W / 2), bottom - px(BOMB_H), BOMB_W, BOMB_H);
    this.layer = 'back';
  }

  /** The blast box (subpixels). */
  blastBox(): AABB {
    const b = this.body;
    const cx = b.x + (b.w >> 1);
    const bottom = b.y + b.h;
    return {
      x: cx + sub(BLAST_BOX.left),
      y: bottom + sub(BLAST_BOX.top),
      w: sub(BLAST_BOX.right - BLAST_BOX.left),
      h: sub(BLAST_BOX.bottom - BLAST_BOX.top),
    };
  }

  update(world: World): void {
    if (this.blast > 0) {
      this.hurtEnemies(world);
      if (++this.blast > BLAST_FRAMES) this.destroy();
      return;
    }
    const b = this.body;
    b.vy = Math.min(b.vy + BOMB_GRAVITY, BOMB_MAX_FALL);
    moveY(b, world.map, b.onGround ? Math.max(velToSub(b.vy), 1) : velToSub(b.vy));
    if (b.onGround) b.vy = 0;
    if (this.isBelowLevel()) return this.destroy();
    if (--this.fuse > 0) return;
    this.blast = 1;
    world.audio.sfx('explosion');
    this.strikeBlocks(world);
    this.hurtEnemies(world);
  }

  private hurtEnemies(world: World): void {
    const box = this.blastBox();
    const cx = box.x + (box.w >> 1);
    for (const e of world.enemies) {
      if (this.hit.has(e.id) || !overlaps(box, e.body)) continue;
      this.hit.add(e.id);
      const src = {
        kind: 'bomb' as const,
        amount: BLAST_DAMAGE,
        owner: this.owner,
        dirX: (e.body.x < cx ? -1 : 1) as -1 | 1,
        ...LINK_STRIKE,
        pierce: 10,
      };
      const res = e.hit(src, world);
      world.scoreKill(e, 'bomb', res);
      if (res === 'hp' || res === 'stun') world.audio.sfx(heroSound(this.owner.def, 'hit', 'hurt-enemy'));
    }
  }

  private strikeBlocks(world: World): void {
    const box = this.blastBox();
    for (let ty = tileAt(box.y); ty <= tileAt(box.y + box.h - 1); ty++)
      for (let tx = tileAt(box.x); tx <= tileAt(box.x + box.w - 1); tx++) {
        const block = tileDef(world.map.get(tx, ty)).block;
        if (!block || (block.kind === 'hidden' && block.content === 'teleporter')) continue;
        world.strikeBlock(tx, ty, this.owner, true, { source: 'blast', damage: BLAST_DAMAGE });
      }
  }

  render(r: Renderer, view: View): void {
    const items = view.assets.sheet('items');
    if (this.blast > 0) {
      const box = this.blastBox();
      const f = Math.min(2, Math.floor(((this.blast - 1) * 3) / BLAST_FRAMES));
      const cx = toPx(box.x + (box.w >> 1)) - view.camX;
      const cy = toPx(box.y + (box.h >> 1));
      r.sprite(items, `explosion-${f}`, cx - 16, cy - 16);
      return;
    }
    const rate = this.fuse < 20 ? 1 : 3;
    const lit = ((view.frame >> rate) & 1) === 1;
    const b = this.body;
    r.sprite(items, lit ? 'bomb-1' : 'bomb-0', toPx(b.x + (b.w >> 1)) - 8 - view.camX, toPx(b.y + b.h) - 16);
  }
}

/** `p`'s bombs on screen, exploding ones too (LK-C36). */
export function bombsOut(p: Player, world: World): number {
  let n = 0;
  for (const e of world.entities) if (e instanceof LinkBomb && e.alive && e.owner === p) n++;
  return n;
}

/**
 * Where a bomb goes (LK-C36): its centre 13 px ahead of Link's centre, bottom at his feet; at his
 * centre when that spot is inside a wall.
 */
export function bombSpot(p: Player, world: World): { cx: number; bottom: number } {
  const bottom = p.feetY;
  const ahead = p.centerX + p.facing * px(13);
  const l = ahead - sub(BOMB_W / 2);
  const r = l + sub(BOMB_W) - 1;
  const top = bottom - px(BOMB_H);
  let blocked = false;
  for (let ty = tileAt(top); ty <= tileAt(bottom - 1); ty++)
    for (let tx = tileAt(l); tx <= tileAt(r); tx++) if (world.map.isSolid(tx, ty)) blocked = true;
  return { cx: blocked ? p.centerX : ahead, bottom };
}
