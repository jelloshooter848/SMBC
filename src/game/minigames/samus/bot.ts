import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { T } from '../../level/tiles';
import type { World } from '../../world/world';
import { BrainTank, Door, Rinka, Zebetite } from './tourian';
import type { EscapeScene } from './scene';

/*
 * A player for Zebes Escape, for tests and difficulty tuning (docs/HEROES.md). It knows the route
 * as a table of the surfaces Samus can stand on and what to do from each: walk on, curl into the
 * ball and bomb the block in a tunnel, shoot a door open and walk through it (missiles for the
 * red one), break a barrier or the brain with missiles, or climb to the next platform (walk to
 * the edge beside it, jump, drift on once the head is above the platform's underside). Falling
 * back down the shaft just lands it on an earlier surface, so it carries on from there. On the
 * way it shoots the Rinkas that come level with it (or straight above it). With
 * `CautiousOptions` it plays like a careful first-timer: it sees the Rinkas `reaction` frames
 * late, misjudges its take-off spot by up to `error` px, now and then stops for a moment, and
 * sometimes lets go of a jump too early.
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
  /** Walk to column `x` (off a ledge). */
  | { kind: 'walk'; x: number }
  /** Shoot the door in column `x` open (missiles for a red one) and walk through it. */
  | { kind: 'door'; x: number; dir: -1 | 1 }
  /** Break the barrier in column `x` with missiles, then walk on. */
  | { kind: 'barrier'; x: number }
  /** Destroy the brain (its tank's left column `x`) with missiles, then walk on. */
  | { kind: 'brain'; x: number };

const S = (row: number, x0: number, x1: number): Surface => ({ row, x0, x1 });

/** A climb up from `at` onto `to` (to the right for dir 1). */
const up = (at: Surface, to: Surface, dir: -1 | 1) => ({
  at,
  plans: [{ plan: { kind: 'climb' as const, to, dir } }],
});

/** The escape shaft's platforms, bottom to top (stage.map), ending on the surface. */
const SHAFT: readonly Surface[] = [
  S(57, 81, 94),
  S(54, 85, 88),
  S(51, 90, 93),
  S(48, 85, 88),
  S(45, 81, 84),
  S(42, 86, 89),
  S(39, 91, 94),
  S(36, 86, 89),
  S(33, 81, 84),
  S(30, 85, 88),
  S(27, 90, 93),
  S(24, 85, 88),
  S(21, 81, 84),
  S(18, 86, 89),
  S(15, 91, 94),
  S(12, 86, 89),
  S(9, 81, 84),
  S(6, 85, 88),
  S(3, 90, 94),
];

/**
 * The route through stage.map: for each surface, the plans by column (the first whose `until`
 * column the centre has not passed, scanning in the direction of travel).
 */
export const ROUTE: { at: Surface; plans: { until?: number; plan: Plan }[] }[] = [
  // The corridor: a step, the morph-ball wall (its bomb block), the door to the hall.
  up(S(57, 1, 8), S(55, 9, 10), 1),
  { at: S(55, 9, 10), plans: [{ plan: { kind: 'walk', x: 12 } }] },
  {
    at: S(57, 11, 30),
    plans: [
      { until: 24, plan: { kind: 'tunnel', start: 19, end: 23, dir: 1, block: { x: 22, y: 56 }, out: 24 } },
      { plan: { kind: 'door', x: 31, dir: 1 } },
    ],
  },
  // The hall and its red door.
  { at: S(57, 33, 46), plans: [{ plan: { kind: 'door', x: 47, dir: 1 } }] },
  // The brain's chamber: three barriers, the brain, the door to the shaft behind it.
  {
    at: S(57, 49, 78),
    plans: [
      { until: 55, plan: { kind: 'barrier', x: 55 } },
      { until: 60, plan: { kind: 'barrier', x: 60 } },
      { until: 65, plan: { kind: 'barrier', x: 65 } },
      { until: 72, plan: { kind: 'brain', x: 72 } },
      { plan: { kind: 'door', x: 79, dir: 1 } },
    ],
  },
  // The escape shaft, platform by platform (the next is beside, never right above).
  ...SHAFT.slice(0, -1).map((at, i) => {
    const to = SHAFT[i + 1] as Surface;
    return up(at, to, to.x0 + to.x1 > at.x0 + at.x1 || at.row === 57 ? 1 : -1);
  }),
];

interface Seen {
  id: number;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
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

/** Frames between the bot's beam shots and its missiles. */
const SHOT_EVERY = 10;
const MISSILE_EVERY = 18;
/** How far (px, centre to the target's near face) it stands to shoot a door, a barrier or the tank. */
const SHOOT_FROM = 40;

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

  /** The Rinkas, as the bot judges them now (`reaction` frames late). */
  private look(world: World): Seen[] {
    const now: Seen[] = [];
    for (const e of world.entities) {
      if (!e.alive || !(e instanceof Rinka)) continue;
      const o = this.offset(e.id);
      now.push({
        id: e.id,
        kind: e.kind,
        x: toPx(e.body.x) + o,
        y: toPx(e.body.y),
        w: toPx(e.body.w),
        h: toPx(e.body.h),
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
        : a === 'left' || a === 'right' || a === 'up' || !this.prevHeld.has(a),
    );
    this.prevHeld = new Set(out);
    return out;
  }

  private decide(scene: EscapeScene): Action[] {
    const world = scene.world;
    const seen = this.look(world);
    const p = scene.player;
    if (p.dead || (scene.phase !== 'tourian' && scene.phase !== 'escape') || scene.transition) {
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
    if (this.jump) return this.flying(me);
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
    // Rinkas first: shoot what comes level (or from straight above).
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
        return this.climb(me, here.at, plan);
      case 'door':
        return this.door(scene, me, plan);
      case 'barrier': {
        const z = world.entities.find((e) => e.alive && e instanceof Zebetite && e.body.x >> 12 === plan.x);
        return z ? this.blast(scene, me, plan.x * 16, 1) : ['right'];
      }
      case 'brain': {
        const brain = world.entities.find((e): e is BrainTank => e instanceof BrainTank);
        return brain && !brain.defeated ? this.blast(scene, me, plan.x * 16, 1) : ['right'];
      }
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
  private flying(me: Me): Action[] {
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

  /** A climb: walk to the take-off spot beside the platform, jump. */
  private climb(me: Me, at: Surface, plan: Plan & { kind: 'climb' }): Action[] {
    const to = plan.to;
    const curL = at.x0 * 16;
    const curR = (at.x1 + 1) * 16;
    const aim =
      plan.dir > 0
        ? Math.min(to.x0 * 16 - 10, curR - 6) + this.miss
        : Math.max((to.x1 + 1) * 16 + 10, curL + 6) - this.miss;
    // However badly judged, a spot it can stand on (a wall may end the surface).
    const takeoff = Math.max(curL + 6, Math.min(curR - 6, aim));
    if (Math.abs(takeoff - me.cx) > 3) return this.walkTo(me, takeoff, 3);
    return this.startJump(plan, plan.dir);
  }

  /**
   * Shoot a Rinka coming level with Samus (turning to it), or one straight above her (aiming up).
   * One that is not yet in line is left alone.
   */
  private fight(scene: EscapeScene, me: Me, seen: Seen[]): Action[] | null {
    const p = scene.player;
    for (const s of seen) {
      const dx = s.x + (s.w >> 1) - me.cx;
      const level = s.y + s.h > me.y + 2 && s.y < me.feet - 4;
      if (level && Math.abs(dx) < 96) {
        const toward: -1 | 1 = dx < 0 ? -1 : 1;
        if (p.facing !== toward) return [toward < 0 ? 'left' : 'right'];
        if (this.frame - this.lastShot >= SHOT_EVERY) {
          this.lastShot = this.frame;
          return ['attack'];
        }
        return [];
      }
      const above = s.y + s.h <= me.y && me.y - s.y < 96 && Math.abs(dx) < 10;
      if (above) {
        if (this.frame - this.lastShot >= SHOT_EVERY) {
          this.lastShot = this.frame;
          return ['up', 'attack'];
        }
        return ['up'];
      }
    }
    return null;
  }

  /**
   * Missiles into a barrier or the tank whose near face is at `face` px (approached going `dir`):
   * stand SHOOT_FROM px off it, face it, fire.
   */
  private blast(scene: EscapeScene, me: Me, face: number, dir: -1 | 1): Action[] {
    const want = face - dir * SHOOT_FROM;
    if (dir > 0 ? me.cx < want - 8 : me.cx > want + 8) return this.walkTo(me, want, 6);
    const p = scene.player;
    if (p.facing !== dir) return [dir > 0 ? 'right' : 'left'];
    if (this.frame - this.lastShot >= MISSILE_EVERY) {
      this.lastShot = this.frame;
      return ['special'];
    }
    return [];
  }

  /** A door: shoot it open (a red one with missiles), then walk through. */
  private door(scene: EscapeScene, me: Me, plan: Plan & { kind: 'door' }): Action[] {
    const dir = plan.dir;
    const key: Action = dir > 0 ? 'right' : 'left';
    const door = scene.world.entities.find((e): e is Door => e instanceof Door && e.tx === plan.x);
    if (!door || door.open) return [key];
    const face = dir > 0 ? plan.x * 16 : (plan.x + 1) * 16;
    if (door.color === 'blue') {
      // A beam reaches it from anywhere: on, shooting.
      const p = scene.player;
      if (p.facing !== dir) return [key];
      if (this.frame - this.lastShot >= SHOT_EVERY) {
        this.lastShot = this.frame;
        return ['attack'];
      }
      return dir > 0 ? (me.cx < face - SHOOT_FROM ? [key] : []) : me.cx > face + SHOOT_FROM ? [key] : [];
    }
    return this.blast(scene, me, face, dir);
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
