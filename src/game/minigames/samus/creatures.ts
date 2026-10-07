import type { Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, tileAt, tileToSub, toPx, velToSub } from '@engine/math/units';
import { Entity, type View } from '../../entities/entity';
import { Enemy } from '../../entities/enemies/enemy';
import { moveX, moveY } from '../../entities/body';
import { Explosion } from '../../entities/effects/effects';
import type { DamageSource, Reaction, Vulnerability } from '../../rules/damage';
import type { World } from '../../world/world';
import { drawZebes, drawZebesWall, ZEBES_FLASH } from './art';

/*
 * Zebes's creatures and fixtures (docs/HEROES.md, Samus's mini game): the Zoomer crawling round
 * every surface, the Ripper flying straight (only missiles and bombs stop it), the Skree diving
 * from the ceiling and bursting into shards, the alarm lights, the Chozo statue and Samus's ship.
 * They are the mini game's own entity types, made through World's `extraEntities` (stage.ts).
 */

/** Is a body inside the camera's view (both ways), with a margin in px? */
export function inView(world: World, e: Entity, margin = 0): boolean {
  const b = e.body;
  const c = world.camera;
  return (
    b.x + b.w > c.x - px(margin) &&
    b.x < c.right + px(margin) &&
    b.y + b.h > c.y - px(margin) &&
    b.y < c.bottom + px(margin)
  );
}

/** What the cavern's creatures take hits from: Samus's beam, missiles and bombs (and a star). */
export const CREATURE_VULNERABILITY: Vulnerability = {
  buster: 'hp',
  weapon: 'hp',
  bomb: 'hp',
  fireball: 'hp',
  sword: 'hp',
  star: 'kill',
  ice: 'stun',
};

/**
 * A creature of Zebes: hit points, blows up in a small explosion (no SMB-style flip), leaves
 * Samus's drops now and then (energy, missiles), and stays alive however far the camera goes
 * (the escape runs up and down and back left through the cavern).
 */
export abstract class Creature extends Enemy {
  constructor(x: number, y: number, w: number, h: number, hp: number) {
    super(x, y, w, h);
    this.hp = hp;
    this.body.vx = 0;
    this.vulnerability = { ...CREATURE_VULNERABILITY };
    this.stompable = false;
    this.fallsOffLedges = false;
    this.despawnMargin = null;
  }

  protected override flipOut(_src: DamageSource, world: World): void {
    const b = this.body;
    world.spawn(new Explosion(b.x + (b.w >> 1), b.y + (b.h >> 1), true));
    world.audio.sfx('kick');
    this.destroy();
  }

  override hit(src: DamageSource, world: World): Reaction {
    const r = super.hit(src, world);
    if (r === 'hp' && this.alive) this.flash = 6;
    return r;
  }

  /** Frames of the hit flash (the `zebes-flash` palette; not with reduce flashing). */
  flash = 0;
  /** Drawn upside down (a Zoomer under a ceiling). */
  protected flipY = false;

  protected tickFlash(): void {
    if (this.flash > 0) this.flash--;
  }

  /** The palette to draw with: pale for a moment after a hit. */
  protected paletteNow(view: View): string | undefined {
    return this.flash > 0 && !view.reduceFlashing ? ZEBES_FLASH : undefined;
  }

  /** The zebes creatures face left: flipped when facing right. */
  override render(r: Renderer, view: View): void {
    if (this.stunned > 0 && !view.reduceFlashing && (view.frame & 3) === 0) return;
    drawZebes(
      r,
      view.assets,
      this.currentFrame,
      this.screenX(view),
      this.screenY(),
      this.facing > 0,
      this.flipY,
      this.paletteNow(view),
    );
  }
}

/* ---------- Zoomer ---------- */

/** Crawl speed: one px every other frame (32 frames a tile). */
export const ZOOMER_STEP_FRAMES = 2;
export const ZOOMER_HP = 2;

type Vec = { x: -1 | 0 | 1; y: -1 | 0 | 1 };

/**
 * A spiky crawler that creeps round whatever it clings to: along floors, up walls, across
 * ceilings and round corners, tile by tile (`dir` the way it goes, `down` the surface it holds).
 * Its body fills the tile it is in. Two beam shots, one missile.
 */
export class Zoomer extends Creature {
  readonly kind = 'zoomer';
  /** The tile it is in, and how far (px) it has crept toward the next one. */
  cell: { x: number; y: number };
  dir: Vec;
  down: Vec;
  private moved = 0;
  private tick = 0;
  /** Lost its hold (the surface went): falls until it lands on a floor. */
  falling = false;

  constructor(tx: number, ty: number, dir: -1 | 1 = -1) {
    super(tileToSub(tx), tileToSub(ty), 16, 16, ZOOMER_HP);
    this.cell = { x: tx, y: ty };
    this.dir = { x: dir, y: 0 };
    this.down = { x: 0, y: 1 };
    this.currentFrame = 'zoomer-0';
  }

  /** Where it clings: 'floor', 'ceiling', 'left' or 'right' wall. */
  get surface(): 'floor' | 'ceiling' | 'left' | 'right' {
    if (this.down.y > 0) return 'floor';
    if (this.down.y < 0) return 'ceiling';
    return this.down.x < 0 ? 'left' : 'right';
  }

  update(world: World): void {
    this.tickFlash();
    const map = world.map;
    const solid = (x: number, y: number) => map.isSolid(x, y);
    if (this.falling) {
      this.fall(world);
      if (this.body.onGround) {
        this.falling = false;
        this.cell = { x: tileAt(this.body.x + px(8)), y: tileAt(this.body.y + px(8)) };
        this.body.x = tileToSub(this.cell.x);
        this.body.y = tileToSub(this.cell.y);
        this.down = { x: 0, y: 1 };
        this.dir = { x: this.dir.x || -1, y: 0 } as Vec;
        this.moved = 0;
      }
      this.anim(world);
      return;
    }
    if (++this.tick % ZOOMER_STEP_FRAMES === 0) {
      if (this.moved === 0) this.choose(solid);
      if (this.falling) return;
      this.moved++;
      this.body.x = tileToSub(this.cell.x) + px(this.dir.x * this.moved);
      this.body.y = tileToSub(this.cell.y) + px(this.dir.y * this.moved);
      if (this.moved === 16) {
        this.cell = { x: this.cell.x + this.dir.x, y: this.cell.y + this.dir.y };
        this.moved = 0;
        if (this.turnAfter) {
          const d = this.dir;
          this.dir = this.down;
          this.down = { x: -d.x, y: -d.y } as Vec;
          this.turnAfter = false;
        }
      }
    }
    this.anim(world);
  }

  /** At a tile: turn up a wall ahead, go round an outside corner, or keep on. */
  private turnAfter = false;
  private choose(solid: (x: number, y: number) => boolean): void {
    const c = this.cell;
    const neighbours = [-1, 0, 1].some((dy) =>
      [-1, 0, 1].some((dx) => (dx || dy) && solid(c.x + dx, c.y + dy)),
    );
    if (!neighbours) {
      this.falling = true;
      this.body.vy = 0;
      return;
    }
    for (let i = 0; i < 4; i++) {
      const d = this.dir;
      const g = this.down;
      if (solid(c.x + d.x, c.y + d.y)) {
        // A wall ahead (inside corner): climb it.
        this.dir = { x: -g.x, y: -g.y } as Vec;
        this.down = d;
        continue;
      }
      // Ground goes on ahead: straight on. Else round the outside corner after this tile.
      this.turnAfter = !solid(c.x + d.x + g.x, c.y + d.y + g.y);
      return;
    }
  }

  private anim(world: World): void {
    this.currentFrame = `zoomer-${(world.frame >> 3) & 1}`;
    this.flipY = this.down.y < 0;
    this.facing = this.dir.x > 0 ? 1 : -1;
  }

  /** On a floor or ceiling the sheet's frame (flipped for a ceiling); on a wall, turned a quarter. */
  override render(r: Renderer, view: View): void {
    const s = this.surface;
    if (s === 'floor' || s === 'ceiling') return super.render(r, view);
    if (this.stunned > 0 && !view.reduceFlashing && (view.frame & 3) === 0) return;
    // The turned frame holds a wall on its left, head up: mirrored for a wall on its right,
    // upside down going down.
    drawZebesWall(
      r,
      view.assets,
      this.currentFrame,
      this.screenX(view),
      this.screenY(),
      s === 'right',
      this.dir.y > 0,
      this.paletteNow(view),
    );
  }
}

/* ---------- Ripper ---------- */

/** Ripper speed (velocity units: 0.75 px a frame). */
export const RIPPER_SPEED = 0x00c00;

/**
 * An armoured flyer going straight back and forth between walls at one height. Beams glance off
 * (an ice beam freezes it); a missile or a bomb blast stops it.
 */
export class Ripper extends Creature {
  readonly kind = 'ripper';
  constructor(x: number, y: number, dir: -1 | 1 = 1) {
    super(x, y, 16, 8, 1);
    this.vulnerability = { ...CREATURE_VULNERABILITY, buster: 'immune', weapon: 'kill', bomb: 'kill' };
    this.body.vx = dir * RIPPER_SPEED;
    this.facing = dir;
    this.currentFrame = 'ripper-0';
  }

  update(world: World): void {
    this.tickFlash();
    const b = this.body;
    moveX(b, world.map, velToSub(b.vx));
    if (b.hitWall !== 0) b.vx = -b.hitWall * RIPPER_SPEED;
    this.facing = b.vx > 0 ? 1 : -1;
    this.currentFrame = `ripper-${(world.frame >> 4) & 1}`;
  }
}

/* ---------- Skree ---------- */

export const SKREE_HP = 1;
/** How near (px, centre to centre) Samus must pass under a Skree for it to let go. */
export const SKREE_REACH = 40;
/** Dive: speed down, the most it veers toward Samus (velocity units). */
export const SKREE_DIVE_VY = 0x03000;
export const SKREE_VEER = 0x00800;
/** Frames a landed Skree spins in the floor before it bursts. */
export const SKREE_DIG = 24;

export type SkreeState = 'hang' | 'dive' | 'dig';

/**
 * Hangs from a ceiling; when Samus passes beneath it, it drops on her, veering toward her, digs
 * into the floor and bursts into four shards. One beam shot.
 */
export class Skree extends Creature {
  readonly kind = 'skree';
  state: SkreeState = 'hang';
  private t = 0;
  constructor(x: number, y: number) {
    super(x, y, 16, 16, SKREE_HP);
    this.currentFrame = 'skree-0';
  }

  update(world: World): void {
    this.tickFlash();
    const b = this.body;
    this.t++;
    if (this.state === 'hang') {
      this.currentFrame = 'skree-0';
      if (!inView(world, this, -8)) return;
      const p = world.nearestPlayer(b.x + (b.w >> 1));
      if (p.dead || p.out) return;
      const dx = Math.abs(p.centerX - (b.x + (b.w >> 1)));
      if (dx <= px(SKREE_REACH) && p.body.y > b.y + b.h && p.body.y - b.y < px(160)) {
        this.state = 'dive';
        this.t = 0;
      }
      return;
    }
    if (this.state === 'dive') {
      this.currentFrame = 'skree-1';
      const p = world.nearestPlayer(b.x + (b.w >> 1));
      const toward = p.centerX < b.x + (b.w >> 1) ? -1 : 1;
      b.vx = toward * SKREE_VEER;
      b.vy = SKREE_DIVE_VY;
      moveX(b, world.map, velToSub(b.vx));
      moveY(b, world.map, velToSub(b.vy));
      if (b.onGround) {
        this.state = 'dig';
        this.t = 0;
      }
      if (this.isBelowLevel()) this.destroy();
      return;
    }
    // Dug in, it shudders (its two frames in turn) until it bursts.
    this.currentFrame = `skree-${(this.t >> 2) & 1}`;
    if (this.t >= SKREE_DIG) this.burst(world);
  }

  /** Four shards fly out (up-left, up-right, left, right) and the Skree is gone. */
  burst(world: World): void {
    const b = this.body;
    const cx = b.x + (b.w >> 1);
    const cy = b.y + (b.h >> 1);
    for (const [vx, vy] of [
      [-0x01000, -0x01800],
      [0x01000, -0x01800],
      [-0x01800, 0],
      [0x01800, 0],
    ] as const)
      world.spawn(new SkreeShard(cx, cy, vx, vy));
    world.audio.sfx('kick');
    this.destroy();
  }
}

/** Frames a Skree's shard flies. */
export const SHARD_LIFE = 30;

/** A Skree's shard: flies straight, hurts Samus as a touch does, gone on a wall or after a while. */
export class SkreeShard extends Entity {
  readonly kind = 'skree-shard';
  private life = SHARD_LIFE;
  constructor(cx: number, cy: number, vx: number, vy: number) {
    super(cx - px(3), cy - px(3), 6, 6);
    this.body.vx = vx;
    this.body.vy = vy;
    this.layer = 'front';
    this.despawnMargin = null;
  }

  update(world: World): void {
    const b = this.body;
    moveX(b, world.map, velToSub(b.vx));
    moveY(b, world.map, velToSub(b.vy));
    if (--this.life <= 0 || b.hitWall !== 0 || b.onGround || b.hitHead) return this.destroy();
    for (const p of world.activePlayers()) {
      if (overlaps(p.body, b)) {
        world.hurtPlayer(p, b.vx >= 0 ? 1 : -1);
        this.destroy();
        return;
      }
    }
  }

  render(r: Renderer, view: View): void {
    // It glints yellow and red; one steady yellow with reduce flashing.
    const glint = !view.reduceFlashing && ((view.frame >> 2) & 1) === 0;
    r.rect(this.screenX(view), this.screenY(), 6, 6, glint ? '#f83800' : '#f8b800');
  }
}

/* ---------- Fixtures ---------- */

/** Frames between an alarm light's turns (on, off). */
export const ALARM_BLINK = 16;

/**
 * Scenery from the zebes sheet: `chozo` (the 32×32 statue facing right, by its top-left tile),
 * `alarm` (a 16×16 wall light: it blinks, or stays lit with reduce flashing), `door` (a 16×48
 * bubble door). Drawn behind Samus and the creatures.
 */
export class ZebesDecor extends Entity {
  readonly kind = 'zebes-decor';
  constructor(
    readonly name: 'chozo' | 'alarm' | 'door',
    x: number,
    y: number,
  ) {
    super(x, y, name === 'chozo' ? 32 : 16, name === 'chozo' ? 32 : name === 'door' ? 48 : 16);
    this.layer = 'back';
    this.despawnMargin = null;
  }

  update(): void {}

  render(r: Renderer, view: View): void {
    const x = this.screenX(view);
    const y = this.screenY();
    if (this.name === 'alarm') {
      const lit = view.reduceFlashing || ((view.frame / ALARM_BLINK) | 0) % 2 === 0;
      drawZebes(r, view.assets, lit ? 'alarm-1' : 'alarm-0', x, y);
      return;
    }
    if (this.name === 'door') {
      drawZebes(r, view.assets, 'bubble-door', x, y);
      return;
    }
    // The orb in its hands glows on and off slowly; steady with reduce flashing.
    const glow = view.reduceFlashing || ((view.frame >> 5) & 1) === 1;
    drawZebes(r, view.assets, glow ? 'chozo-1' : 'chozo-0', x, y);
  }
}

/** Samus's gunship (64×32), waiting on its pad; `liftOff` sends it up and away. */
export class Ship extends Entity {
  readonly kind = 'ship';
  /** Samus is aboard and it is rising. */
  rising = false;
  private t = 0;
  constructor(
    x: number,
    y: number,
    private readonly onBoard: (world: World) => void,
  ) {
    super(x, y, 64, 32);
    this.layer = 'back';
    this.despawnMargin = null;
  }

  /** The boarding box, kept up to date by hatch() (one object, not one a frame). */
  private readonly box = { x: 0, y: 0, w: px(56), h: px(32) };

  /** Where touching it boards it: the hull, all but the wing tips. */
  hatch(): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
    const b = this.body;
    this.box.x = b.x + px(4);
    this.box.y = b.y;
    this.box.h = b.h;
    return this.box;
  }

  update(world: World): void {
    if (this.rising) {
      this.t++;
      // A slow start, then away: 0.25 px/f, faster each frame.
      const speed = Math.min(px(6), px(1) / 4 + ((this.t * this.t) >> 4));
      this.body.y -= speed;
      return;
    }
    for (const p of world.activePlayers()) {
      if (overlaps(p.body, this.hatch())) {
        this.onBoard(world);
        return;
      }
    }
  }

  liftOff(): void {
    this.rising = true;
    this.t = 0;
  }

  render(r: Renderer, view: View): void {
    const x = this.screenX(view);
    const y = this.screenY();
    drawZebes(r, view.assets, 'ship', x, y);
    if (this.rising && (view.reduceFlashing || (view.frame & 2) === 0)) {
      // Engine glow under the hull.
      r.rect(x + 20, y + 26, 24, 4 + ((this.t >> 2) & 3), '#f8d878');
    }
  }
}

/** Screen-space helper for the tests: a body's top-left in px. */
export const bodyPx = (e: Entity) => ({ x: toPx(e.body.x), y: toPx(e.body.y) });
