import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { T } from '../../level/tiles';
import type { World } from '../../world/world';
import { Ripper, Skree, Zoomer } from './creatures';
import type { EscapeScene } from './scene';

/*
 * A player for Zebes Escape, for tests and difficulty tuning (docs/HEROES.md). It knows the route
 * as a table of the surfaces Samus can stand on and what to do from each: walk on, jump the pit,
 * curl into the ball and bomb the block in a tunnel, or climb to the next platform (walk to the
 * edge beside it, jump, drift on once the head is above the platform's underside). Falling back
 * down a shaft just lands it on an earlier surface, so it carries on from there. On the way it
 * shoots creatures at body height, waits for Rippers to clear the jump, and stays out from under a
 * Zoomer on the next platform. With `CautiousOptions` it plays like a careful first-timer: it sees
 * the creatures `reaction` frames late, misjudges its take-off spot by up to `error` px, now and
 * then stops for a moment, and sometimes lets go of a jump too early.
 */

export interface CautiousOptions {
  /** Frames between something happening and the bot seeing it. */
  reaction: number;
  /** Most px by which it misjudges a take-off spot (and a creature's position). */
  error: number;
  /** Chance a frame on the ground starts a pause (it lets go of everything for 10-40 frames). */
  pause: number;
  /** Chance a jump is let go too early (10-20 frames in). */
  shortJump: number;
  seed: number;
}

/** A sharp player: sees everything at once, judges exactly, never pauses. */
export const SHARP: CautiousOptions = { reaction: 0, error: 0, pause: 0, shortJump: 0, seed: 1 };
/** A careful first-timer (the human sim). */
export const CAUTIOUS: CautiousOptions = { reaction: 15, error: 6, pause: 0.004, shortJump: 0.12, seed: 1 };

/** A surface Samus stands on: its top row (the row her feet rest on) and its columns. */
export interface Surface {
  row: number;
  x0: number;
  x1: number;
}

/** What to do from a surface. */
export type Plan =
  /** Jump up onto `to` (to the right for dir 1). */
  | { kind: 'climb'; to: Surface; dir: -1 | 1 }
  /** Jump the pit to the right, landing past column `land`. */
  | { kind: 'leap'; land: number }
  /**
   * A tunnel from column `start` (its mouth, where Samus curls up) to `end` (its last low column):
   * the block at (bx, by) (if any) to bomb; roll until column `out`, then stand.
   */
  | {
      kind: 'tunnel';
      start: number;
      end: number;
      dir: -1 | 1;
      block: { x: number; y: number } | null;
      out: number;
    }
  /** Walk to column `x` (off a ledge, to the ship). */
  | { kind: 'walk'; x: number };

const S = (row: number, x0: number, x1: number): Surface => ({ row, x0, x1 });

/**
 * The route through stage.map: for each surface, the plans by column (the first whose `upTo`
 * column the centre has not passed, scanning in the direction of travel).
 */
export const ROUTE: { at: Surface; plans: { until?: number; plan: Plan }[] }[] = [
  // The chamber and the corridor: the pit, then the morph-ball tunnel with its bomb block.
  { at: S(43, 1, 19), plans: [{ plan: { kind: 'leap', land: 23 } }] },
  {
    at: S(43, 23, 46),
    plans: [
      { until: 30, plan: { kind: 'tunnel', start: 25, end: 28, dir: 1, block: { x: 27, y: 42 }, out: 30 } },
      { plan: { kind: 'climb', to: S(40, 37, 41), dir: 1 } },
    ],
  },
  // Shaft 1.
  { at: S(40, 37, 41), plans: [{ plan: { kind: 'climb', to: S(37, 42, 45), dir: 1 } }] },
  { at: S(37, 42, 45), plans: [{ plan: { kind: 'climb', to: S(34, 36, 39), dir: -1 } }] },
  { at: S(34, 36, 39), plans: [{ plan: { kind: 'climb', to: S(31, 33, 35), dir: -1 } }] },
  { at: S(31, 33, 35), plans: [{ plan: { kind: 'climb', to: S(28, 37, 41), dir: 1 } }] },
  { at: S(28, 37, 41), plans: [{ plan: { kind: 'climb', to: S(25, 43, 46), dir: 1 } }] },
  { at: S(25, 43, 46), plans: [{ plan: { kind: 'climb', to: S(22, 37, 40), dir: -1 } }] },
  { at: S(22, 37, 40), plans: [{ plan: { kind: 'climb', to: S(19, 10, 36), dir: -1 } }] },
  // The middle corridor (its bomb wall) and the ledge into shaft 2.
  {
    at: S(19, 10, 36),
    plans: [
      { until: 23, plan: { kind: 'tunnel', start: 26, end: 24, dir: -1, block: { x: 24, y: 18 }, out: 22 } },
      { plan: { kind: 'climb', to: S(16, 5, 8), dir: -1 } },
    ],
  },
  // Shaft 2.
  { at: S(16, 5, 8), plans: [{ plan: { kind: 'climb', to: S(13, 1, 3), dir: -1 } }] },
  { at: S(13, 1, 3), plans: [{ plan: { kind: 'climb', to: S(10, 6, 9), dir: 1 } }] },
  { at: S(10, 6, 9), plans: [{ plan: { kind: 'climb', to: S(7, 11, 13), dir: 1 } }] },
  { at: S(7, 11, 13), plans: [{ plan: { kind: 'climb', to: S(4, 12, 35), dir: 1 } }] },
  // Shaft 2's floor and the way back up to the ledge.
  { at: S(28, 1, 14), plans: [{ plan: { kind: 'climb', to: S(25, 2, 5), dir: -1 } }] },
  { at: S(25, 2, 5), plans: [{ plan: { kind: 'climb', to: S(22, 7, 9), dir: 1 } }] },
  { at: S(22, 7, 9), plans: [{ plan: { kind: 'climb', to: S(19, 10, 36), dir: 1 } }] },
  // The top corridor (its morph-ball tunnel), down into the hangar, to the ship.
  {
    at: S(4, 12, 35),
    plans: [
      { until: 27, plan: { kind: 'tunnel', start: 21, end: 25, dir: 1, block: null, out: 27 } },
      { plan: { kind: 'walk', x: 38 } },
    ],
  },
  { at: S(11, 36, 46), plans: [{ plan: { kind: 'walk', x: 43 } }] },
];

interface Seen {
  id: number;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  state: string;
}

interface Me {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  feet: number;
  onGround: boolean;
  ball: boolean;
  vy: number;
}

export class EscapeBot {
  private readonly opts: CautiousOptions;
  private readonly rng: Rng;
  private readonly history: Seen[][] = [];
  private readonly offsets = new Map<number, number>();
  /** The jump under way: its plan and frames held so far. */
  private jump: { plan: Plan & { kind: 'climb' | 'leap' }; t: number; holdFor: number; dir: -1 | 1 } | null =
    null;
  private pauseLeft = 0;
  /** Just came down from a jump. */
  private landed = false;
  private frame = 0;
  private lastShot = -100;
  private lastBomb = -100;
  private prevHeld = new Set<Action>();
  /** Take-off misjudgement for the current surface (px), drawn once per landing. */
  private miss = 0;
  private lastSurface = '';
  /** Frames spent (stuck) on the current surface. */
  private onSurface = 0;
  /** Which way the route goes from here (for baiting Skrees ahead). */
  private heading: -1 | 0 | 1 = 1;
  /** Surfaces landed on, in order (for the tests). */
  readonly visited: string[] = [];

  constructor(opts: Partial<CautiousOptions> = {}) {
    this.opts = { ...SHARP, ...opts };
    this.rng = new Rng(this.opts.seed * 2654435761 + 11);
  }

  private offset(id: number): number {
    let o = this.offsets.get(id);
    if (o === undefined) {
      o = Math.round((this.rng.float() * 2 - 1) * this.opts.error);
      this.offsets.set(id, o);
    }
    return o;
  }

  /** The creatures, as the bot judges them now (`reaction` frames late). */
  private look(world: World): Seen[] {
    const now: Seen[] = [];
    for (const e of world.entities) {
      if (!e.alive || !(e instanceof Zoomer || e instanceof Ripper || e instanceof Skree)) continue;
      const o = this.offset(e.id);
      now.push({
        id: e.id,
        kind: e.kind,
        x: toPx(e.body.x) + o,
        y: toPx(e.body.y),
        w: toPx(e.body.w),
        h: toPx(e.body.h),
        vx: e.body.vx,
        state: e instanceof Skree ? e.state : e instanceof Zoomer ? e.surface : '',
      });
    }
    this.history.push(now);
    if (this.history.length > this.opts.reaction + 1) this.history.shift();
    return this.history[0] ?? now;
  }

  /** The surface Samus stands on and the plan for her column, or null in the air / off route. */
  static planFor(feetRow: number, cxTile: number): { at: Surface; plan: Plan } | null {
    for (const r of ROUTE) {
      if (r.at.row !== feetRow || cxTile < r.at.x0 - 1 || cxTile > r.at.x1 + 1) continue;
      for (const p of r.plans) {
        if (p.until === undefined) return { at: r.at, plan: p.plan };
        const dir = p.plan.kind === 'tunnel' ? p.plan.dir : 1;
        if (dir > 0 ? cxTile < p.until : cxTile > p.until) return { at: r.at, plan: p.plan };
      }
    }
    return null;
  }

  next(scene: EscapeScene): Action[] {
    this.frame++;
    const held = this.decide(scene);
    // Presses are edges: a button held last frame must be let go before it presses again (a jump
    // in progress holds).
    const out = held.filter((a) =>
      a === 'jump'
        ? this.jump !== null && this.jump.t > 0
          ? true
          : !this.prevHeld.has('jump')
        : a === 'left' || a === 'right' || !this.prevHeld.has(a),
    );
    this.prevHeld = new Set(out);
    return out;
  }

  private decide(scene: EscapeScene): Action[] {
    const world = scene.world;
    const seen = this.look(world);
    const p = scene.player;
    if (p.dead || scene.phase !== 'escape') {
      this.jump = null;
      return [];
    }
    const b = p.body;
    const me: Me = {
      x: toPx(b.x),
      y: toPx(b.y),
      w: toPx(b.w),
      h: toPx(b.h),
      cx: toPx(p.centerX),
      feet: toPx(b.y + b.h),
      onGround: b.onGround,
      ball: (p.scratch.ball ?? 0) > 0,
      vy: b.vy,
    };
    if (this.jump) return this.flying(me, seen);
    if (!me.onGround) return [];
    const feetRow = me.feet >> 4;
    const here = EscapeBot.planFor(feetRow, me.cx >> 4);
    const key = here ? `${here.at.row}:${here.at.x0}` : `?${feetRow}:${me.cx >> 4}`;
    if (key !== this.lastSurface) {
      this.lastSurface = key;
      this.visited.push(key);
      this.onSurface = 0;
      this.miss = Math.round((this.rng.float() * 2 - 1) * this.opts.error);
    } else if (this.landed) {
      // Back where it jumped from: the jump failed, so it judges the spot better next time.
      this.miss = Math.trunc(this.miss / 2);
    }
    this.landed = false;
    this.onSurface++;
    if (this.pauseLeft > 0) {
      this.pauseLeft--;
      return [];
    }
    if (!me.ball && this.opts.pause > 0 && this.rng.chance(this.opts.pause)) {
      this.pauseLeft = 10 + this.rng.int(31);
      return [];
    }
    if (!here) return me.ball ? ['up'] : [];
    // Creatures first: shoot what is in line, wait out what is in the way.
    const plan0 = here.plan;
    this.heading =
      plan0.kind === 'climb' || plan0.kind === 'tunnel'
        ? plan0.dir
        : plan0.kind === 'leap'
          ? 1
          : plan0.x * 16 + 8 > me.cx
            ? 1
            : -1;
    if (!me.ball) {
      const fight = this.fight(scene, me, seen);
      if (fight) return fight;
    }
    const plan = here.plan;
    // Out of a tunnel: stand up before anything else.
    if (me.ball && plan.kind !== 'tunnel') return ['up'];
    switch (plan.kind) {
      case 'walk':
        return this.walkTo(me, plan.x * 16 + 8, 3);
      case 'leap': {
        const takeoff = here.at.x1 * 16 + 16 - 6 + this.miss;
        if (me.cx < takeoff - 2) return this.walkTo(me, takeoff, 2);
        return this.startJump({ kind: 'leap', land: plan.land }, 1);
      }
      case 'tunnel':
        return this.tunnel(world, me, plan);
      case 'climb':
        return this.climb(me, here.at, plan, seen);
    }
  }

  /** Walk toward `x` (px, centre); stops within `tol` px, letting go early so as not to slide past. */
  private walkTo(me: Me, x: number, tol: number): Action[] {
    const dx = x - me.cx;
    if (Math.abs(dx) <= tol) return [];
    const dir = dx > 0 ? 'right' : 'left';
    // Close: taps, so the slide stays short.
    if (Math.abs(dx) < 12 && this.frame % 3 !== 0) return [];
    return [dir];
  }

  private startJump(plan: Plan & { kind: 'climb' | 'leap' }, dir: -1 | 1): Action[] {
    // A pit gets a held jump more often than a ledge does (a third of the short jumps).
    const p = plan.kind === 'leap' ? this.opts.shortJump / 3 : this.opts.shortJump;
    const short = p > 0 && this.rng.chance(p);
    this.jump = { plan, t: 0, holdFor: short ? 10 + this.rng.int(11) : 40, dir };
    return ['jump'];
  }

  /** In the air on a jump: hold it, drift toward the landing once the head clears its underside. */
  private flying(me: Me, _seen: Seen[]): Action[] {
    const j = this.jump as NonNullable<typeof this.jump>;
    j.t++;
    if (j.t > 2 && me.onGround) {
      this.jump = null;
      this.landed = true;
      return [];
    }
    const held: Action[] = [];
    if (j.t < j.holdFor && me.vy < 0) held.push('jump');
    let goal: number;
    let go = true;
    if (j.plan.kind === 'leap') goal = j.plan.land * 16 + 8;
    else {
      const to = j.plan.to;
      // Land a little inside the platform: its near end plus a body.
      goal = j.dir > 0 ? to.x0 * 16 + 10 : (to.x1 + 1) * 16 - 10;
      // Into the column under the platform only once the head is above its underside.
      const under = (to.row + 1) * 16;
      if (me.y >= under) go = false;
    }
    if (go) {
      const dx = goal - me.cx;
      if (Math.abs(dx) > 3) held.push(dx > 0 ? 'right' : 'left');
    }
    return held;
  }

  /** A climb: walk to the take-off spot beside the platform, wait for the way to clear, jump. */
  private climb(me: Me, at: Surface, plan: Plan & { kind: 'climb' }, seen: Seen[]): Action[] {
    const to = plan.to;
    const curL = at.x0 * 16;
    const curR = (at.x1 + 1) * 16;
    const takeoff =
      plan.dir > 0
        ? Math.min(to.x0 * 16 - 10, curR - 6) + this.miss
        : Math.max((to.x1 + 1) * 16 + 10, curL + 6) - this.miss;
    if (Math.abs(takeoff - me.cx) > 3) return this.walkTo(me, takeoff, 3);
    if (this.blocked(me, to, takeoff, seen)) {
      // Waiting: if this drags on (the bot was misled), go anyway.
      if (this.onSurface < 600) return [];
    }
    return this.startJump(plan, plan.dir);
  }

  /** A Ripper about to cross the jump, or a Zoomer on the landing: wait. */
  private blocked(me: Me, to: Surface, takeoff: number, seen: Seen[]): boolean {
    const top = to.row * 16 - 24 - 10;
    const bottom = me.feet;
    const land = (to.x0 * 16 + to.x1 * 16 + 16) >> 1;
    const lo = Math.min(takeoff, land) - 24;
    const hi = Math.max(takeoff, land) + 24;
    for (const s of seen) {
      if (s.kind === 'ripper') {
        if (s.y + s.h < top || s.y > bottom) continue;
        // Where it will be over the next 50 frames (it flies straight).
        const v = (s.vx / 4096) * 50;
        const a = Math.min(s.x, s.x + v);
        const z = Math.max(s.x + s.w, s.x + s.w + v);
        if (z > lo && a < hi) return true;
      }
      if (s.kind === 'zoomer') {
        const zx = s.x + 8;
        const onTop = s.y + s.h <= to.row * 16 + 2 && s.y + s.h >= to.row * 16 - 18;
        if (onTop && zx > to.x0 * 16 - 24 && zx < (to.x1 + 1) * 16 + 24) return true;
      }
    }
    return false;
  }

  /**
   * Shoot creatures at body height close ahead (a Zoomer coming, a Skree landed). A Skree hanging
   * just ahead is baited: edge in until it lets go, then back off and shoot it once it is down.
   */
  private fight(scene: EscapeScene, me: Me, seen: Seen[]): Action[] | null {
    const p = scene.player;
    for (const s of seen) {
      if (s.kind !== 'skree' || s.state === 'hang' || s.y + s.h > me.y - 8) continue;
      // Diving at us from above: get out from under it.
      const dx = s.x + (s.w >> 1) - me.cx;
      if (Math.abs(dx) < 28) return [dx < 0 ? 'right' : 'left'];
    }
    for (const s of seen) {
      if (s.kind !== 'skree' || s.state !== 'hang') continue;
      const dx = s.x + (s.w >> 1) - me.cx;
      const above = s.y < me.y && me.y - s.y < 150;
      if (!above || Math.abs(dx) > 52 || Math.sign(dx) !== this.heading) continue;
      // Edge in to bait it (it drops at 40 px).
      return this.frame % 2 === 0 ? [dx > 0 ? 'right' : 'left'] : [];
    }
    for (const s of seen) {
      const level = s.y + s.h > me.y + 4 && s.y < me.feet - 2;
      if (!level) continue;
      const dx = s.x + (s.w >> 1) - me.cx;
      if (Math.abs(dx) > 72) continue;
      if (s.kind === 'ripper') continue; // beams glance off
      if (s.kind === 'skree' && s.state === 'hang') continue;
      const toward: -1 | 1 = dx < 0 ? -1 : 1;
      if (p.facing !== toward) return [toward < 0 ? 'left' : 'right'];
      if (this.frame - this.lastShot >= 8) {
        this.lastShot = this.frame;
        return ['attack'];
      }
      return [];
    }
    return null;
  }

  /** Through a tunnel: curl up at its mouth, roll in, bomb the block, roll out and stand. */
  private tunnel(world: World, me: Me, plan: Plan & { kind: 'tunnel' }): Action[] {
    const dir = plan.dir;
    const block = plan.block && world.map.get(plan.block.x, plan.block.y) !== T.AIR ? plan.block : null;
    const past = dir > 0 ? me.cx >= plan.out * 16 + 8 : me.cx <= plan.out * 16 + 8;
    if (!me.ball) {
      // Out the far side already (knocked back out of it, say): on.
      const beyond = dir > 0 ? me.cx >> 4 > plan.end : me.cx >> 4 < plan.end;
      if (past || beyond) return [dir > 0 ? 'right' : 'left'];
      const mouth = plan.start * 16 + 8;
      if (Math.abs(me.cx - mouth) > 4) return this.walkTo(me, mouth, 4);
      return ['down'];
    }
    if (past) return ['up'];
    if (block) {
      const edge = dir > 0 ? block.x * 16 - (me.x + me.w) : me.x - (block.x * 16 + 16);
      if (edge > 1) return [dir > 0 ? 'right' : 'left'];
      if (this.frame - this.lastBomb > 50) {
        this.lastBomb = this.frame;
        return ['attack'];
      }
      return [];
    }
    return [dir > 0 ? 'right' : 'left'];
  }
}
