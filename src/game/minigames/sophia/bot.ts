import type { Action } from '@engine/input/actions';
import { Rng } from '@engine/rng';
import {
  DIRS,
  DIR_VEC,
  ROOM_H,
  ROOM_W,
  boxesOverlap,
  type Box,
  type Dir,
  type Side,
} from '../../topdown/geometry';
import { TdEnemy, type TdEntity } from '../../topdown/entity';
import { Projectile } from '../../topdown/enemies';
import { Capsule, GrenadeBlast, Grenade, SHOT_SPEED, gunLevel, type UnderworldWorld } from './jason';
import { PlutoniumBoss } from './plutonium';

/*
 * A player for the dungeon (tests and tuning): it walks an 8-px grid by breadth-first search,
 * fights by stepping to a spot in line with a mutant (in range, with a clear line of fire, not
 * too close), facing it and tapping SHOOT; it steps out of the way of orbs and of the bouncing
 * core, picks up capsules (P only when hurt), throws a grenade at the cracked wall, and leaves
 * rooms by their doorways. A plan per room says what to do there. It plays through the same
 * inputs a player has, and sees what a player sees.
 */

export type JasonStep =
  | { do: 'fight' }
  | { do: 'collect' }
  | { do: 'goto'; x: number; y: number }
  | { do: 'grenade'; from: { x: number; y: number }; dir: Dir; until: (w: UnderworldWorld) => boolean }
  | { do: 'leave'; side: Side };

export type JasonPlan = readonly JasonStep[] | ((w: UnderworldWorld) => readonly JasonStep[]);

/** The grid the bot walks (px). */
export const NODE = 8;

/** Where to stand to leave by each edge, and the way to walk on from there. */
const INSIDE: Record<Side, { x: number; y: number; dir: Dir }> = {
  n: { x: 120, y: 8, dir: 'up' },
  s: { x: 120, y: ROOM_H - 32, dir: 'down' },
  w: { x: 16, y: 80, dir: 'left' },
  e: { x: ROOM_W - 32, y: 80, dir: 'right' },
};

interface Node {
  x: number;
  y: number;
}

const key = (n: Node) => (n.y / NODE) * 64 + n.x / NODE;

export interface JasonBotOptions {
  /** Frames between SHOOT taps. */
  tapEvery: number;
  /** Pixels kept from mutants (more from big ones). */
  margin: number;
  /** Frames of an orb's flight looked ahead for danger. */
  lookAhead: number;
}

export const BOT_DEFAULTS: JasonBotOptions = { tapEvery: 6, margin: 10, lookAhead: 30 };

export class JasonBot {
  private room = '';
  private step = 0;
  private plan: readonly JasonStep[] = [];
  private held: Action[] = [];
  private lastTap = -100;
  private frame = 0;
  private gridKey = '';
  private grid = new Uint8Array(64 * 32);
  /** Frames stuck on the current step without a way (it moves on after a while). */
  private stuck = 0;
  /** Where it is dodging to, and until when at most. */
  private dodge: { x: number; y: number; until: number } | null = null;
  readonly opts: JasonBotOptions;
  /** What it was doing last (for reports). */
  doing = '';

  constructor(
    private readonly plans: Readonly<Record<string, JasonPlan>>,
    opts: Partial<JasonBotOptions> = {},
  ) {
    this.opts = { ...BOT_DEFAULTS, ...opts };
  }

  next(world: UnderworldWorld): Action[] {
    this.frame++;
    this.held = this.decide(world);
    return this.held;
  }

  private decide(world: UnderworldWorld): Action[] {
    const hero = world.hero;
    if (world.transition || hero.dying || hero.dead) return [];
    if (world.room.id !== this.room) {
      this.room = world.room.id;
      this.step = 0;
      this.stuck = 0;
      const p = this.plans[this.room] ?? [];
      this.plan = typeof p === 'function' ? p(world) : p;
    }
    this.refreshGrid(world);
    // First, out of the way of anything about to hit, to a spot well clear (and all the way
    // there, so it does not step back into the way the next frame).
    if (this.dodge && (this.frame > this.dodge.until || (hero.x === this.dodge.x && hero.y === this.dodge.y)))
      this.dodge = null;
    if (!this.dodge && this.inDanger(world, hero.x, hero.y)) {
      const safe = this.nearest(world, (n) => !this.inDanger(world, n.x, n.y, 5));
      if (safe) this.dodge = { ...safe, until: this.frame + 24 };
    }
    if (this.dodge) {
      const d = this.dodge;
      const out = this.walkTo(world, (n) => n.x === d.x && n.y === d.y, true);
      if (out) {
        this.doing = 'dodge';
        return out;
      }
      this.dodge = null;
    }
    for (let guard = 0; guard < 8; guard++) {
      const s = this.plan[this.step];
      if (!s) return [];
      const out = this.run(world, s);
      if (out !== 'done') return out;
      this.step++;
      this.stuck = 0;
    }
    return [];
  }

  /* ---------- The grid ---------- */

  /** Which grid spots Jason can stand on (tiles, doors, solid things); rebuilt when the room changes. */
  private refreshGrid(world: UnderworldWorld): void {
    const solids = world.entities.filter((e) => e.solid && !e.dead).length;
    const k = `${world.room.id}|${world.shuttersShut()}|${['n', 's', 'e', 'w'].map((s) => world.doorOpen(s as Side)).join()}|${solids}`;
    if (k === this.gridKey) return;
    this.gridKey = k;
    this.grid.fill(0);
    for (let y = 0; y <= ROOM_H - 16; y += NODE)
      for (let x = 0; x <= ROOM_W - 16; x += NODE)
        if (!world.blocked(world.hero.feet(x, y), 'hero', null)) this.grid[key({ x, y })] = 1;
  }

  private free(n: Node): boolean {
    return n.x >= 0 && n.y >= 0 && n.x <= ROOM_W - 16 && n.y <= ROOM_H - 16 && this.grid[key(n)] === 1;
  }

  /* ---------- Steps ---------- */

  private run(world: UnderworldWorld, s: JasonStep): Action[] | 'done' {
    const hero = world.hero;
    switch (s.do) {
      case 'fight': {
        if (world.enemies().length === 0) return 'done';
        this.doing = 'fight';
        return this.fight(world);
      }
      case 'collect': {
        const c = this.wantedCapsule(world);
        if (!c) return 'done';
        this.doing = 'collect';
        const box = c.hurtbox();
        return this.walkTo(world, (n) => boxesOverlap(heroBox(n), box)) ?? this.giveUp();
      }
      case 'goto':
        if (hero.x === s.x && hero.y === s.y) return 'done';
        return this.walkTo(world, (n) => n.x === s.x && n.y === s.y) ?? this.giveUp();
      case 'grenade': {
        if (s.until(world)) return 'done';
        this.doing = 'grenade';
        const out = world.entities.some(
          (e) => (e instanceof Grenade || e instanceof GrenadeBlast) && !e.dead,
        );
        if (out) return [];
        if (Math.abs(hero.x - s.from.x) > 1 || Math.abs(hero.y - s.from.y) > 1)
          return this.walkTo(world, (n) => n.x === s.from.x && n.y === s.from.y) ?? this.giveUp();
        if (hero.facing !== s.dir) return [s.dir];
        return this.tap('special');
      }
      case 'leave': {
        this.doing = `leave ${s.side}`;
        const at = INSIDE[s.side];
        const lined = s.side === 'n' || s.side === 's' ? hero.x === at.x : Math.abs(hero.y - at.y) <= 2;
        const v = DIR_VEC[at.dir];
        const beyond = v.dx !== 0 ? (hero.x - at.x) * v.dx >= 0 : (hero.y - at.y) * v.dy >= 0;
        if (lined && beyond) return [at.dir];
        return this.walkTo(world, (n) => n.x === at.x && n.y === at.y) ?? [at.dir];
      }
    }
  }

  /** A step that finds no way: wait, and after a long while move on. */
  private giveUp(): Action[] {
    if (++this.stuck > 600) this.step++;
    return [];
  }

  /** The nearest capsule worth taking: a G always, a P when Jason is hurt. */
  private wantedCapsule(world: UnderworldWorld): Capsule | null {
    const hero = world.hero;
    const all = world.entities.filter(
      (e): e is Capsule =>
        e instanceof Capsule && !e.dead && !e.hidden && (e.kind === 'gun' || hero.hp < hero.maxHp),
    );
    all.sort((a, b) => dist(a, hero) - dist(b, hero));
    return all[0] ?? null;
  }

  /** Presses `a` now unless it was held last frame or tapped too recently. */
  private tap(a: Action, extra: Action[] = []): Action[] {
    if (this.held.includes(a) || this.frame - this.lastTap < this.opts.tapEvery) return extra;
    this.lastTap = this.frame;
    return [...extra, a];
  }

  /* ---------- Fighting ---------- */

  private fight(world: UnderworldWorld): Action[] {
    const hero = world.hero;
    const foes = world.enemies();
    // In line with one already: face it and shoot.
    for (const f of foes) {
      const d = this.lineOfFire(world, hero.x, hero.y, f);
      if (!d) continue;
      if (hero.facing !== d) return [d];
      return this.tap('attack');
    }
    // A capsule close by first (a G is worth a detour).
    const c = this.wantedCapsule(world);
    if (c && dist(c, hero) < 40) {
      const box = c.hurtbox();
      const out = this.walkTo(world, (n) => boxesOverlap(heroBox(n), box), true);
      if (out) return out;
    }
    const goals = this.firingSpots(world, foes);
    const out = this.walkTo(world, (n) => goals.has(key(n)), true);
    if (out) return out;
    // Nowhere to shoot from: keep clear and wait.
    return [];
  }

  /** Spots (grid keys) from which a shot reaches a mutant, nearest mutants first. */
  private firingSpots(world: UnderworldWorld, foes: readonly TdEnemy[]): Set<number> {
    const out = new Set<number>();
    const g = gunLevel(world.jason.gun);
    for (const f of foes) {
      const tb = f.hurtbox();
      // The boss's shell only from below (out of its drift and under its open core).
      const shell = f instanceof PlutoniumBoss && f.phase !== 'core';
      for (const d of DIRS) {
        if (shell && d !== 'up') continue;
        const v = DIR_VEC[d];
        // The grid lines whose shot (from the hero's middle) crosses the mutant across the way.
        const across =
          v.dx !== 0 ? range8(tb.y + 1 - 8, tb.y + tb.h - 1 - 8) : range8(tb.x + 1 - 8, tb.x + tb.w - 1 - 8);
        const sign = v.dx + v.dy;
        // The edge of the mutant facing the shooter.
        const near = v.dx > 0 ? tb.x : v.dx < 0 ? tb.x + tb.w : v.dy > 0 ? tb.y : tb.y + tb.h;
        for (const c of across) {
          // Shots start 6 px ahead of Jason's middle: from a spot at `a` along the line the
          // gap to the mutant is (near - a - 14) going right or down, (a + 2 - near) going left
          // or up. Walk back from the closest spot until out of range or the line is blocked.
          let a = sign > 0 ? Math.floor((near - 14) / NODE) * NODE : Math.ceil((near - 2) / NODE) * NODE;
          let clearTo = 0;
          for (;;) {
            const n = v.dx !== 0 ? { x: a, y: c } : { x: c, y: a };
            if (n.x < 0 || n.y < 0 || n.x > ROOM_W - 16 || n.y > ROOM_H - 16) break;
            const gap = sign > 0 ? near - a - 14 : a + 2 - near;
            if (gap > g.range - 4) break;
            if (!g.through) {
              // (the part of the line nearer the mutant was checked from the spot before)
              if (!this.clearLine(world, n, d, gap, f, gap - clearTo)) break;
              clearTo = gap;
            }
            if (this.free(n) && !this.tooClose(world, n)) out.add(key(n));
            a -= sign * NODE;
          }
        }
      }
    }
    return out;
  }

  /** The way to face to hit `f` from (x, y) right now, or null. */
  private lineOfFire(world: UnderworldWorld, x: number, y: number, f: TdEnemy): Dir | null {
    const g = gunLevel(world.jason.gun);
    const now = f.hurtbox();
    const m = motion(f);
    const cx = x + 8;
    const cy = y + 8;
    for (const d of DIRS) {
      const v = DIR_VEC[d];
      // A moving target is led: where it will be when the shot gets there.
      const far = Math.abs(v.dx !== 0 ? now.x + now.w / 2 - cx : now.y + now.h / 2 - cy);
      const t = far / SHOT_SPEED;
      const tb = { ...now, x: now.x + m.vx * t, y: now.y + m.vy * t };
      if (v.dx !== 0 && (cy < tb.y + 1 || cy > tb.y + tb.h - 1)) continue;
      if (v.dy !== 0 && (cx < tb.x + 1 || cx > tb.x + tb.w - 1)) continue;
      const start = v.dx !== 0 ? cx + v.dx * 6 : cy + v.dy * 6;
      const near = v.dx > 0 ? tb.x : v.dx < 0 ? tb.x + tb.w : v.dy > 0 ? tb.y : tb.y + tb.h;
      const gap = (near - start) * (v.dx + v.dy);
      if (gap < -4 || gap > g.range - 4) continue;
      if (!g.through && !this.clearLine(world, { x, y }, d, Math.max(0, gap), f)) continue;
      return d;
    }
    return null;
  }

  /**
   * Is the line of fire from a hero at `n` going `d` free of walls for `gap` px (the target
   * aside)? Only its first `first` px are looked at when given (the rest is known clear).
   */
  private clearLine(
    world: UnderworldWorld,
    n: Node,
    d: Dir,
    gap: number,
    target: TdEntity,
    first = gap,
  ): boolean {
    const v = DIR_VEC[d];
    for (let s = 6; s <= Math.min(gap, first + 4) + 6; s += 4) {
      const b = { x: n.x + 6 + v.dx * s, y: n.y + 6 + v.dy * s, w: 4, h: 4 };
      if (world.blocked(b, 'shot', target)) return false;
    }
    return true;
  }

  /** Would a hero at `n` stand too near a mutant (its margin; more for big ones)? */
  private tooClose(world: UnderworldWorld, n: Node): boolean {
    const hb = heroBox(n);
    for (const e of world.enemies()) {
      const m = e.w >= 32 ? this.opts.margin + 14 : e.solid ? 2 : this.opts.margin;
      if (boxesOverlap(hb, grow(e.hurtbox(), m))) return true;
    }
    return false;
  }

  /** Would an orb (or the bouncing core) hit a hero standing at (x, y) soon? */
  private inDanger(world: UnderworldWorld, x: number, y: number, slack = 2): boolean {
    const hb = grow(heroBox({ x, y }), slack);
    for (const e of world.entities) {
      if (e.dead) continue;
      if (e instanceof Projectile && e.hostile) {
        const b = e.hurtbox();
        for (let t = 0; t <= this.opts.lookAhead; t += 3)
          if (boxesOverlap({ x: b.x + e.vx * t, y: b.y + e.vy * t, w: b.w, h: b.h }, hb)) return true;
      } else if (e instanceof PlutoniumBoss && e.phase === 'core') {
        const b = grow(e.hurtbox(), 6);
        for (let t = 0; t <= 24; t += 4)
          if (boxesOverlap({ x: b.x + e.vx * t, y: b.y + e.vy * t, w: b.w, h: b.h }, hb)) return true;
      } else if (e instanceof TdEnemy && boxesOverlap(grow(e.hurtbox(), 3), hb)) return true;
    }
    return false;
  }

  /* ---------- Walking ---------- */

  /** The grid spot Jason is at or nearest (a free one). */
  private nodeOf(world: UnderworldWorld): Node {
    const h = world.hero;
    const lx = Math.floor(h.x / NODE) * NODE;
    const ly = Math.floor(h.y / NODE) * NODE;
    const near: Node[] = [
      { x: lx, y: ly },
      { x: lx + NODE, y: ly },
      { x: lx, y: ly + NODE },
      { x: lx + NODE, y: ly + NODE },
    ];
    near.sort(
      (a, b) => Math.abs(a.x - h.x) + Math.abs(a.y - h.y) - (Math.abs(b.x - h.x) + Math.abs(b.y - h.y)),
    );
    return near.find((n) => this.free(n)) ?? (near[0] as Node);
  }

  /**
   * One frame's walk along the shortest grid path to a spot passing `goal` (keeping clear of
   * mutants when `wary`), toward the next spot on it, diagonally while off the grid. Null when
   * there is no way.
   */
  private walkTo(world: UnderworldWorld, goal: (n: Node) => boolean, wary = false): Action[] | null {
    const hero = world.hero;
    const start = this.nodeOf(world);
    const path = this.search(world, start, goal, wary);
    if (!path) return null;
    const to = path.next ?? start;
    const out: Action[] = [];
    if (to.x < hero.x) out.push('left');
    else if (to.x > hero.x) out.push('right');
    if (to.y < hero.y) out.push('up');
    else if (to.y > hero.y) out.push('down');
    if (out.length === 0) return null; // already there
    this.stuck = 0;
    return out;
  }

  /** The nearest grid spot passing `pred` (keeping clear of mutants), or null. */
  private nearest(world: UnderworldWorld, pred: (n: Node) => boolean): Node | null {
    return this.search(world, this.nodeOf(world), pred, true)?.goal ?? null;
  }

  /** Breadth-first search on the grid: the first spot to head for (null: at the goal), and the goal. */
  private search(
    world: UnderworldWorld,
    start: Node,
    goal: (n: Node) => boolean,
    wary: boolean,
  ): { next: Node | null; goal: Node } | null {
    if (goal(start)) return { next: null, goal: start };
    const prev = new Map<number, number>([[key(start), -1]]);
    const queue: Node[] = [start];
    const depth = new Map<number, number>([[key(start), 0]]);
    const startDanger = this.inDanger(world, start.x, start.y);
    while (queue.length) {
      const n = queue.shift() as Node;
      const nd = depth.get(key(n)) ?? 0;
      for (const d of DIRS) {
        const v = DIR_VEC[d];
        const m = { x: n.x + v.dx * NODE, y: n.y + v.dy * NODE };
        const k = key(m);
        if (prev.has(k) || !this.free(m)) continue;
        if (wary && this.tooClose(world, m)) continue;
        // Near steps must not walk into an orb's way.
        if (nd < 6 && !startDanger && this.inDanger(world, m.x, m.y)) continue;
        prev.set(k, key(n));
        depth.set(k, nd + 1);
        if (goal(m)) {
          let cur = k;
          let first = k;
          while (cur !== key(start)) {
            first = cur;
            cur = prev.get(cur) as number;
          }
          return { next: { x: (first % 64) * NODE, y: Math.floor(first / 64) * NODE }, goal: m };
        }
        queue.push(m);
      }
    }
    return null;
  }
}

/** How a mutant is moving (px a frame), as a player reads it: only the bouncing core is quick. */
function motion(f: TdEnemy): { vx: number; vy: number } {
  if (!(f instanceof PlutoniumBoss) || f.phase !== 'core' || f.burstT > 0) return { vx: 0, vy: 0 };
  const s = f.speed;
  return { vx: f.vx * s, vy: f.vy * s };
}

function heroBox(n: Node): Box {
  return { x: n.x + 3, y: n.y + 2, w: 10, h: 13 };
}

function grow(b: Box, n: number): Box {
  return { x: b.x - n, y: b.y - n, w: b.w + 2 * n, h: b.h + 2 * n };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Grid lines (multiples of NODE) from a to b inclusive. */
function range8(a: number, b: number): number[] {
  const out: number[] = [];
  for (let c = Math.ceil(a / NODE) * NODE; c <= b; c += NODE) out.push(c);
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* The plan                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/**
 * A full run of the dungeon: the gateway room, the hall, the turrets, the crossing (a grenade at
 * its cracked wall; the cache's capsules), the antechamber, the boss.
 */
export const UNDERWORLD_PLAN: Readonly<Record<string, JasonPlan>> = {
  gate: [{ do: 'collect' }, { do: 'fight' }, { do: 'collect' }, { do: 'leave', side: 'e' }],
  hall: [{ do: 'fight' }, { do: 'collect' }, { do: 'leave', side: 'n' }],
  turrets: [{ do: 'fight' }, { do: 'collect' }, { do: 'leave', side: 'w' }],
  crossing: (w) =>
    w.state('cache').visited
      ? [{ do: 'fight' }, { do: 'leave', side: 'n' }]
      : [
          { do: 'fight' },
          { do: 'collect' },
          { do: 'grenade', from: { x: 16, y: 80 }, dir: 'left', until: (x) => x.doorOpen('w') },
          { do: 'leave', side: 'w' },
        ],
  cache: [{ do: 'collect' }, { do: 'leave', side: 'e' }],
  ante: [{ do: 'collect' }, { do: 'leave', side: 'e' }],
  boss: [{ do: 'goto', x: 32, y: 80 }, { do: 'fight' }],
};

/* ------------------------------------------------------------------------------------------ */
/* A cautious human                                                                             */
/* ------------------------------------------------------------------------------------------ */

/** How a first-time player differs from the bot. */
export interface HumanOptions {
  /** Seeds the player's own slips (not the world's dice). */
  seed: number;
  /** Frames between something happening and the player reacting to it. */
  reaction: number;
  /** Misjudged mutant positions: up to this many px off on each axis, changing now and then. */
  aim: number;
  /** Chance per frame of a short pause. */
  hesitate: number;
  /** Frames between SHOOT taps (a thumb, not a turbo button). */
  tapEvery: number;
  /** Pixels kept from mutants. */
  margin: number;
  /** Frames of an orb's flight it looks ahead. */
  lookAhead: number;
}

export const SHARP: Partial<HumanOptions> = { reaction: 0, aim: 0, hesitate: 0, tapEvery: 6, margin: 10 };
export const CAUTIOUS: Partial<HumanOptions> = {};
export const CLUMSY: Partial<HumanOptions> = {
  reaction: 21,
  aim: 10,
  hesitate: 0.02,
  tapEvery: 12,
  margin: 6,
  lookAhead: 18,
};

export const HUMAN_DEFAULTS: Omit<HumanOptions, 'seed'> = {
  reaction: 15,
  aim: 4,
  hesitate: 0.01,
  tapEvery: 9,
  margin: 8,
  lookAhead: 24,
};

/**
 * A player for difficulty tuning: the bot's plan, but it sees mutants and orbs where they were
 * `reaction` frames ago (an orb fired more recently isn't seen yet), misjudges where mutants are
 * by a few pixels, taps SHOOT at a thumb's pace and pauses now and then. It knows where Jason is.
 */
export class HumanJason {
  private readonly bot: JasonBot;
  private readonly rng: Rng;
  readonly opts: HumanOptions;
  private readonly seen = new Map<TdEntity, { x: number; y: number }[]>();
  private readonly misjudged = new Map<TdEntity, { dx: number; dy: number }>();
  private pause = 0;
  private room = '';
  private t = 0;

  constructor(
    plans: Readonly<Record<string, JasonPlan>> = UNDERWORLD_PLAN,
    opts: Partial<HumanOptions> = {},
  ) {
    this.opts = { seed: 1, ...HUMAN_DEFAULTS, ...opts };
    this.bot = new JasonBot(plans, {
      tapEvery: this.opts.tapEvery,
      margin: this.opts.margin,
      // It sees each orb late, but sees which way it is going: it judges its path from there.
      lookAhead: this.opts.lookAhead + this.opts.reaction,
    });
    this.rng = new Rng(Math.imul(this.opts.seed, 0x9e3779b1) >>> 0 || 1);
  }

  get doing(): string {
    return this.bot.doing;
  }

  next(world: UnderworldWorld): Action[] {
    if (world.room.id !== this.room) {
      this.room = world.room.id;
      this.seen.clear();
      this.misjudged.clear();
    }
    if (++this.t % 24 === 0) this.misjudged.clear();
    const watched = world.entities.filter((e) => !e.dead && (e.enemy || e instanceof Projectile));
    for (const k of [...this.seen.keys()]) if (!watched.includes(k)) this.seen.delete(k);
    for (const e of watched) {
      const h = this.seen.get(e) ?? [];
      h.push({ x: e.x, y: e.y });
      if (h.length > this.opts.reaction + 1) h.shift();
      this.seen.set(e, h);
    }
    if (this.pause > 0) {
      this.pause--;
      return [];
    }
    if (!world.transition && this.rng.chance(this.opts.hesitate)) {
      this.pause = 4 + this.rng.int(12);
      return [];
    }
    // Decide on the old picture: mutants where they were, orbs not seen yet left out.
    const real = new Map<TdEntity, { x: number; y: number; dead: boolean }>();
    for (const e of watched) {
      const h = this.seen.get(e) ?? [];
      real.set(e, { x: e.x, y: e.y, dead: e.dead });
      const old = h.length > this.opts.reaction ? h[0] : null;
      if (old) {
        e.x = old.x;
        e.y = old.y;
      } else if (!e.enemy) e.dead = true;
      if (e.enemy && !e.solid) {
        const a = this.opts.aim;
        let off = this.misjudged.get(e);
        if (!off) {
          off = { dx: this.rng.int(2 * a + 1) - a, dy: this.rng.int(2 * a + 1) - a };
          this.misjudged.set(e, off);
        }
        e.x += off.dx;
        e.y += off.dy;
      }
    }
    try {
      return this.bot.next(world);
    } finally {
      for (const [e, s] of real) {
        e.x = s.x;
        e.y = s.y;
        e.dead = s.dead;
      }
    }
  }
}
