import type { Renderer } from '@engine/gfx/renderer';
import { px, tileToSub, toPx } from '@engine/math/units';
import { overlaps } from '@engine/math/aabb';
import type { View } from '../entities/entity';
import { Enemy } from '../entities/enemies/enemy';
import { Projectile, type ProjectileSpec } from '../entities/projectiles/projectile';
import { Explosion } from '../entities/effects/effects';
import type { Player } from '../entities/player';
import type { DamageSource, Reaction } from '../rules/damage';
import type { World } from '../world/world';
import { TargetDummy } from './dummy';
import { Entity } from '../entities/entity';
import { Goomba } from '../entities/enemies/goomba';
import { Candle } from '../entities/objects/crypt';

/*
 * The hero stages' targets and what they see (0.4.37). A target is the straw dummy (dummy.ts), put
 * up by the stage's map (`target x y [lesson=id] [shoots=frames] [tough=hits]`): it never moves, never hurts and stands up to any number of hits unless it is tough (it falls after
 * that many); once its lesson is done it pops. A shooter fires slow shots at a hero in front of
 * it. The watch (`stageWatch`) records every hit on a target or an enemy (by what, how), every
 * hit the hero takes (and what it cost), and every shooter shot a shield blocked or a leaf swatted:
 * the lessons read it.
 */

/** A shooter's slow shot: flies straight at the hero; a shield blocks it, a hit costs the usual. */
export const TARGET_SHOT: ProjectileSpec = {
  kind: 'target-shot',
  damage: 'contact',
  amount: 1,
  speed: 0x01400,
  gravity: 0,
  bounceVy: null,
  hitsTiles: false,
  hitsEnemies: false,
  hitsPlayer: true,
  lifetime: 360,
  w: 8,
  h: 8,
  sheet: 'items',
  frames: ['fireball-0', 'fireball-1', 'fireball-2', 'fireball-3'],
  frameRate: 4,
};

/** Frames between a shooter's shots. */
export const SHOOT_FRAMES = 100;
/** A shooter fires only at a hero this close (px, centre to centre) and in front of it. */
const SHOOT_RANGE_PX = 176;

export interface TargetOptions {
  /** The lesson it belongs to: it pops once that lesson is done. */
  lesson?: string;
  /** Frames between shots at the hero (a shooter); absent: it never shoots. */
  shoots?: number;
  /** Hits it takes before it falls; absent: it never falls to hits. */
  tough?: number;
  /** It faces left (shoots left); default: toward the hero. */
  facing?: -1 | 1;
  /** It hangs from the ceiling (no fall), on a short chain. */
  hang?: boolean;
  /**
   * It hovers in the sky on a little cloud, as Lakitu rides one (0.4.46, Mega Man's Saw lesson):
   * no fall, a slow bob.
   */
  hover?: boolean;
  /**
   * A shooter fires only while this holds (a stage: its lesson is being played, its item taken),
   * so it never knocks a power off the hero on the way to the lesson's block (Mega Man's Helmet,
   * whose loss would turn the block into a Helmet).
   */
  live?: () => boolean;
}

/** A stage's straw target (TargetDummy's drawing): a lesson's mark. */
export class TrainingTarget extends TargetDummy {
  readonly opts: TargetOptions;
  private shotT = 0;
  /** Hits taken (a tough one falls at `tough`). */
  taken = 0;

  constructor(x: number, feet: number, opts: TargetOptions = {}) {
    super(x, feet);
    this.opts = opts;
    this.hp = opts.tough ?? Infinity;
    this.shotT = (opts.shoots ?? 0) - 40;
  }

  get lesson(): string | undefined {
    return this.opts.lesson;
  }

  override update(world: World): void {
    if (this.opts.hang || this.opts.hover) {
      if (this.wobble > 0) this.wobble--;
      this.body.vx = 0;
      this.body.vy = 0;
    } else super.update(world);
    const every = this.opts.shoots;
    if (!every || !this.alive || this.stunned > 0) return;
    if (this.opts.live && !this.opts.live()) {
      this.shotT = every - 40;
      return;
    }
    if (++this.shotT < every) return;
    const b = this.body;
    const cx = b.x + (b.w >> 1);
    const p = world.players.find(
      (q) =>
        !q.dead &&
        !q.out &&
        Math.abs(q.centerX - cx) <= px(SHOOT_RANGE_PX) &&
        Math.abs(q.centerX - cx) > px(10),
    );
    if (!p) return;
    const dir: -1 | 1 = this.opts.facing ?? (p.centerX < cx ? -1 : 1);
    if ((p.centerX - cx) * dir < 0) return;
    this.shotT = 0;
    const x = dir < 0 ? b.x - px(TARGET_SHOT.w) : b.x + b.w;
    world.spawn(new Projectile(x, b.y + px(8), dir, TARGET_SHOT, this));
    world.audio.sfx('fireball');
  }

  override hit(src: DamageSource, world: World): Reaction {
    this.taken++;
    const r = super.hit(src, world);
    // A target that never falls stands up to the hit (TargetDummy counted it down).
    if (this.opts.tough === undefined) this.hp = Infinity;
    return r;
  }

  /** Its lesson is done: it pops in a puff. */
  pop(world: World): void {
    if (!this.alive) return;
    const b = this.body;
    world.spawn(new Explosion(b.x + (b.w >> 1), b.y + (b.h >> 1), true));
    world.audio.sfx('stomp');
    this.destroy();
  }

  /** A hovering target's cloud under its feet (`y`), bobbing a pixel: white puffs, a grey rim. */
  private drawCloud(r: Renderer, x: number, y: number, frame: number): void {
    const bob = (frame >> 4) & 1;
    const cy = y - 3 + bob;
    r.rect(x - 6, cy + 2, 24, 5, '#bcbcbc');
    r.rect(x - 5, cy + 1, 22, 5, '#fcfcfc');
    r.rect(x - 2, cy - 2, 7, 4, '#fcfcfc');
    r.rect(x + 6, cy - 3, 8, 5, '#fcfcfc');
    // Two dark eyes, as a cloud rider's cloud has.
    r.rect(x + 2, cy + 2, 1, 2, '#000');
    r.rect(x + 8, cy + 2, 1, 2, '#000');
  }

  override render(r: Renderer, view: View): void {
    super.render(r, view);
    if (this.opts.hover) this.drawCloud(r, toPx(this.body.x) - view.camX, toPx(this.body.y) + 24, view.frame);
    if (this.opts.hang) {
      // Its chain to the ceiling: a few dark links over the head.
      const hx = toPx(this.body.x) - view.camX;
      const hy = toPx(this.body.y);
      for (let i = 0; i < 3; i++) r.rect(hx + 5, hy - 2 - i * 3, 2, 2, '#606060');
    }
    // A shooter's muzzle: a dark ring on the side it fires from.
    if (!this.opts.shoots) return;
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    const dir = this.opts.facing ?? -1;
    const mx = dir < 0 ? x - 3 : x + 11;
    r.rect(mx, y + 8, 4, 4, '#202020');
    r.rect(mx + 1, y + 9, 2, 2, '#d82800');
  }
}

/**
 * A stage map's walker for a lesson (`goomba x y lesson=id`): it stands still until that lesson is
 * being played and its item taken (`live`), as a lesson's shooter holds fire, so a hit never knocks
 * a power off the hero on the way to the lesson's block (Mega Man's Helmet: the block would then
 * give a Helmet).
 */
export class WaitingGoomba extends Goomba {
  constructor(
    x: number,
    y: number,
    private readonly live: () => boolean,
  ) {
    super(x, y);
  }

  override update(world: World): void {
    if (this.live()) {
      super.update(world);
      return;
    }
    // Nothing moves it while it waits (its walking speed is kept for when it goes).
    this.currentFrame = 'goomba-0';
  }
}

/**
 * A stage map's wall candle (`candle x y [lesson=id] [dx=px]`, Simon's): the crypt's candle, `dx`
 * px right of its tile's place, belonging to a lesson (a whip's mark).
 */
export class LessonCandle extends Candle {
  constructor(
    tx: number,
    ty: number,
    readonly lesson: string | undefined,
    dx = 0,
  ) {
    super(tx, ty);
    this.body.x += px(dx);
  }
}

/** Frames between a door's walkers (after the last one is gone). */
export const DOOR_FRAMES = 75;

/**
 * A door that walkers come out of (Link's pen, 0.4.37): while `live` holds, a slow Goomba walks
 * out of it whenever none of its walkers is about, one at a time. Nothing to draw (the map's decor
 * draws the door) and nothing to touch.
 */
export class TrainingDoor extends Entity {
  readonly kind = 'training-door';
  private walker: Enemy | null = null;
  private wait = 30;

  constructor(
    x: number,
    feet: number,
    private readonly live: (world: World) => boolean,
  ) {
    super(x, feet - px(16), 16, 16);
    this.despawnMargin = null;
  }

  update(world: World): void {
    if (!this.live(world)) {
      this.wait = 30;
      return;
    }
    if (this.walker?.alive) return;
    if (--this.wait > 0) return;
    this.wait = DOOR_FRAMES;
    const g = new Goomba(this.body.x + px(2), this.body.y + px(2));
    g.facing = -1;
    world.spawn(g);
    this.walker = g;
  }

  render(): void {
    // The map's decor is the door.
  }
}

/** One hit on a target or an enemy: what it was hit by, and how. */
export interface StageHit {
  target: Enemy;
  /** The damage kind ('sword', 'buster', 'weapon', 'bomb', 'ice'...). */
  kind: string;
  /** The projectile that hit, if any, and its kind ('sword-beam', 'saw', 'missile'...). */
  shot: Projectile | null;
  shotKind: string | null;
  /** The shot flew straight up. */
  up: boolean;
  /** The shot flew downward (straight or on a diagonal: Bill's aim down in a jump). */
  down: boolean;
  /** The shot snakes through walls (Samus's wave). */
  wave: boolean;
  /** Link's thrusts, at the moment of the hit. */
  downThrust: boolean;
  upThrust: boolean;
  /** A melee hit made spinning (Ryu's Jump and Slash). */
  spin: boolean;
  /** The hero's front edge to the target's near edge (px). */
  dist: number;
  reaction: Reaction;
  /** It was frozen (Samus's ice) when hit. */
  wasFrozen: boolean;
  frame: number;
}

/** A hit the hero took: what it cost (0: a free one, Link's ring). */
export interface StageHurt {
  cost: number;
  frame: number;
}

/** What a stage world saw (stageWatch): the lessons read it. */
export class StageWatch {
  readonly hits: StageHit[] = [];
  readonly hurts: StageHurt[] = [];
  /** The frames shooter shots were blocked by a hero's shield, and swatted by a leaf (a blocking shot). */
  readonly blockFrames: number[] = [];
  readonly swatFrames: number[] = [];
  private readonly wrapped = new WeakSet<Enemy>();
  private readonly shots = new Set<Projectile>();
  private last: { hp: number; invuln: number } | null = null;

  constructor(private readonly world: World) {
    this.wrapAll();
  }

  /** Every enemy in the world reports its hits (wrapped once). */
  private wrapAll(): void {
    for (const e of this.world.entities) if (e instanceof Enemy && !this.wrapped.has(e)) this.wrap(e);
  }

  private wrap(e: Enemy): void {
    this.wrapped.add(e);
    const hit = e.hit.bind(e);
    e.hit = (src: DamageSource, world: World): Reaction => {
      const frozen = e.stunned > 0;
      const r = hit(src, world);
      if (r !== 'immune') this.record(e, src, r, frozen);
      return r;
    };
  }

  private record(e: Enemy, src: DamageSource, reaction: Reaction, wasFrozen: boolean): void {
    const p = this.world.player;
    const shot = src.owner instanceof Projectile ? src.owner : null;
    const pb = p.body;
    const eb = e.body;
    const gap = pb.x + pb.w < eb.x ? eb.x - (pb.x + pb.w) : pb.x - (eb.x + eb.w);
    this.hits.push({
      target: e,
      kind: src.kind,
      shot,
      shotKind: shot?.kind ?? null,
      up: !!shot && shot.body.vx === 0 && shot.body.vy < 0,
      down: !!shot && shot.body.vy > 0,
      wave: !!shot?.spec.wave,
      downThrust: !shot && !!p.scratch.downThrust,
      upThrust: !shot && !!p.scratch.upThrust,
      spin: !shot && (p.scratch.spin ?? 0) > 0,
      dist: Math.max(0, toPx(gap)),
      reaction,
      wasFrozen,
      frame: this.world.frame,
    });
  }

  /** After each frame of the world: new enemies wrapped, hits taken, shots blocked or swatted. */
  observe(): void {
    const w = this.world;
    this.wrapAll();
    const p = w.player;
    // A hit raises the invulnerability: what it cost is the drop in health (0: a free hit).
    if (this.last && !p.dead && p.invuln > this.last.invuln && p.invuln >= 30)
      this.hurts.push({ cost: Math.max(0, this.last.hp - p.hp), frame: w.frame });
    else if (this.last && p.dead && !this.lastDead) this.hurts.push({ cost: this.last.hp, frame: w.frame });
    this.lastDead = p.dead;
    this.last = { hp: p.hp, invuln: p.invuln };
    for (const e of w.entities)
      if (e instanceof Projectile && e.alive && e.owner instanceof TrainingTarget) this.shots.add(e);
    for (const s of [...this.shots]) {
      if (s.alive) continue;
      this.shots.delete(s);
      this.ended(s, p);
    }
  }
  private lastDead = false;

  /** A shooter's shot ended: swatted by a blocking shot by it, blocked by a shield, or neither. */
  private ended(s: Projectile, p: Player): void {
    const sb = s.body;
    const grow = px(6);
    const box = { x: sb.x - grow, y: sb.y - grow, w: sb.w + 2 * grow, h: sb.h + 2 * grow };
    const swat = this.world.entities.some(
      (q) =>
        q instanceof Projectile &&
        q.alive &&
        q.spec.blocks &&
        q.owner === p &&
        q.body.x < box.x + box.w &&
        q.body.x + q.body.w > box.x &&
        q.body.y < box.y + box.h &&
        q.body.y + q.body.h > box.y,
    );
    if (swat) {
      this.swatFrames.push(this.world.frame);
      return;
    }
    const near =
      Math.abs(sb.x + (sb.w >> 1) - p.centerX) <= px(20) &&
      sb.y + sb.h > p.body.y - px(4) &&
      sb.y < p.body.y + p.body.h + px(4);
    const hurt = this.hurts.some((h) => h.frame === this.world.frame);
    if (near && !hurt && p.def.behaviour.blocks) this.blockFrames.push(this.world.frame);
  }

  /** Hits since frame `from` (a lesson's start) that `pred` accepts. */
  since(from: number, pred: (h: StageHit) => boolean): StageHit[] {
    return this.hits.filter((h) => h.frame >= from && pred(h));
  }
}

const watches = new WeakMap<World, StageWatch>();

/** The watch of a hero stage's world (made on first use: its enemies report from then on). */
export function stageWatch(world: World): StageWatch {
  let w = watches.get(world);
  if (!w) watches.set(world, (w = new StageWatch(world)));
  return w;
}

/** The targets of lesson `id` still standing in the world. */
export function lessonTargets(world: World, id: string): TrainingTarget[] {
  return world.entities.filter(
    (e): e is TrainingTarget => e instanceof TrainingTarget && e.alive && e.lesson === id,
  );
}

/**
 * A training stage's thorn bush (0.4.46, WHAT A HIT TAKES, roadmap #21): a low bush of thorns on
 * the ground that hurts whoever walks into it, as any hit does, and never kills (a hero a hit would
 * end, small, is left alone: the lesson makes them big first). It is only there while its lesson
 * is played, and pops once that is done. Drawn with rectangles, so it needs no sprite sheet.
 */
export class TrainingThorns extends Entity {
  readonly kind = 'thorns';
  /** It has hurt a hero (the hit counted: the hero's invulnerability came up). */
  struck = false;

  constructor(
    col: number,
    /** The row the hero stands in: the bush sits on the ground under it. */
    row: number,
    readonly lesson: string,
  ) {
    super(tileToSub(col) + px(1), tileToSub(row + 1) - px(10), 14, 10);
    this.despawnMargin = null;
  }

  update(world: World): void {
    for (const p of world.players) {
      if (p.dead || p.out || p.invulnerable || !overlaps(p.body, this.body)) continue;
      // A hit that would end a power-up hero (small) is no lesson: left alone.
      if (p.def.damage.kind === 'powerup' && p.powerState === 'small') continue;
      world.hurtPlayer(p, p.centerX < this.body.x + (this.body.w >> 1) ? -1 : 1);
      if (p.invulnerable || p.dead) this.struck = true;
    }
  }

  /** Its lesson is done: it pops in a puff. */
  pop(world: World): void {
    if (!this.alive) return;
    const b = this.body;
    world.spawn(new Explosion(b.x + (b.w >> 1), b.y + (b.h >> 1), true));
    this.destroy();
  }

  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    const dark = '#005800';
    const leaf = '#00a800';
    const thorn = '#fcfcfc';
    // A low mound of dark leaves, a lighter top, thorns sticking out of it.
    r.rect(x, y + 4, 14, 6, dark);
    r.rect(x + 2, y + 2, 10, 3, leaf);
    r.rect(x + 1, y + 5, 2, 2, leaf);
    r.rect(x + 9, y + 6, 3, 2, leaf);
    for (const [tx, ty] of [
      [1, 1],
      [6, 0],
      [11, 1],
      [-1, 5],
      [14, 5],
      [4, 3],
      [9, 3],
    ] as const)
      r.rect(x + tx, y + ty, 1, 2, thorn);
  }
}

/** The thorn bushes of lesson `id` in the world. */
export function lessonThorns(world: World, id?: string): TrainingThorns[] {
  return world.entities.filter(
    (e): e is TrainingThorns =>
      e instanceof TrainingThorns && e.alive && (id === undefined || e.lesson === id),
  );
}
