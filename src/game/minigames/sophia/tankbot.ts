import type { Action } from '@engine/input/actions';
import { Rng } from '@engine/rng';
import { toPx } from '@engine/math/units';
import type { World } from '../../world/world';
import { sophiaState } from '../../characters/sophia/state';
import { areaStage, BOSS_FLOOR } from './area';
import { LOB_GRAVITY, PlutoShot, type PlutoniumBoss } from './plutonium';
import { Crawler, Hopper } from './cavern';

/*
 * A player for the tank's side-view sections (tests and tuning), through the same inputs a
 * player has:
 *   - the cavern: drives right firing the cannon, jumps when something stops her, hops Jason out
 *     at the shaft, climbs the ladder and walks into the gateway;
 *   - the Plutonium Boss: keeps to the left of the chamber facing the mass and fires while it is
 *     open, jumps the rolling ball, drives clear of where a glob or a drop will land; under the
 *     core it raises the cannon (holds UP), fires, and sends homing missiles.
 * `TankHuman` sees the boss's shots late (`reaction` frames), misjudges where they land by a few
 * pixels, taps at a thumb's pace and pauses now and then.
 */

export interface TankOptions {
  seed: number;
  /** Frames late it sees the boss's shots (0: at once). */
  reaction: number;
  /** px it misjudges a landing spot by, at most (a fresh guess per shot). */
  misjudge: number;
  /** Frames between cannon taps. */
  tapEvery: number;
  /** Chance per frame of a short pause. */
  hesitate: number;
  /** px of margin it wants from a landing spot. */
  margin: number;
}

/** How far ahead (px) a mutant on her level makes her stop and shoot. */
export const AHEAD = 56;

/** How near (px) the rolling ball gets before it jumps. */
export const BALL_LEAD = 22;

export const TANK_SHARP: TankOptions = {
  seed: 1,
  reaction: 0,
  misjudge: 0,
  tapEvery: 6,
  hesitate: 0,
  margin: 14,
};
export const TANK_DEFAULTS: Omit<TankOptions, 'seed'> = {
  reaction: 15,
  misjudge: 6,
  tapEvery: 9,
  hesitate: 0.01,
  margin: 10,
};

interface Seen {
  x: number;
  y: number;
  vx: number;
  vy: number;
  shot: PlutoShot['shot'];
  w: number;
  ref: PlutoShot;
}

/** Where a shot reaches the floor (px x of its middle), and in how many frames. */
export function landing(s: { x: number; y: number; vx: number; vy: number; shot: string; w: number }): {
  x: number;
  t: number;
} {
  if (s.shot === 'ball') return { x: s.x + s.w / 2, t: 0 };
  let { x, y, vy } = s;
  const g = s.shot === 'glob' ? LOB_GRAVITY : 0;
  for (let t = 0; t < 240; t++) {
    vy += g;
    x += s.vx;
    y += vy;
    if (y + s.w >= BOSS_FLOOR) return { x: x + s.w / 2, t };
  }
  return { x: x + s.w / 2, t: 240 };
}

export class TankBot {
  readonly opts: TankOptions;
  private readonly rng: Rng;
  private frame = 0;
  private lastTap = -100;
  private lastMissile = -100;
  private jumpHeld = false;
  private still = 0;
  private lastX = 0;
  private pause = 0;
  private readonly history: Seen[][] = [];
  private readonly guess = new Map<PlutoShot, number>();
  /** What it was doing last (for reports). */
  doing = '';

  constructor(opts: Partial<TankOptions> = {}) {
    this.opts = { seed: 1, ...TANK_DEFAULTS, ...opts };
    this.rng = new Rng(Math.imul(this.opts.seed ^ 0x7a3c, 0x9e3779b1) >>> 0 || 1);
  }

  next(world: World, boss: PlutoniumBoss | null): Action[] {
    this.frame++;
    this.remember(world);
    const p = world.player;
    if (p.dead) return [];
    if (this.pause > 0) {
      this.pause--;
      return [];
    }
    if (this.rng.chance(this.opts.hesitate)) {
      this.pause = 4 + this.rng.int(12);
      return [];
    }
    const x = toPx(p.body.x);
    this.still = x === this.lastX ? this.still + 1 : 0;
    this.lastX = x;
    return boss ? this.fight(world, boss) : this.cavern(world);
  }

  private tap(): Action[] {
    if (this.frame - this.lastTap < this.opts.tapEvery) return [];
    this.lastTap = this.frame;
    return ['attack'];
  }

  /* ---------- The cavern ---------- */

  private cavern(world: World): Action[] {
    const p = world.player;
    const st = sophiaState(p);
    const layout = areaStage();
    const cx = toPx(p.centerX);
    const shaftX = layout.shaftX * 16 + 8;
    if (st.jason) {
      this.doing = 'jason';
      if (p.vine) return toPx(p.body.y) >> 4 > 5 ? ['up'] : ['right'];
      if (Math.abs(cx - shaftX) < 4 && toPx(p.body.y) >> 4 > 6) return ['up'];
      return ['right'];
    }
    if (cx > shaftX - 64) {
      // At the shaft: Jason hops out (the tank can't go further).
      this.doing = 'exit';
      return this.frame % 4 === 0 ? ['select'] : [];
    }
    this.doing = 'drive';
    // A mutant just ahead on her level: stop and shoot it first.
    const top = toPx(p.body.y);
    const bottom = top + toPx(p.body.h);
    const ahead = world.entities.some((e) => {
      if (!e.alive || !(e instanceof Crawler || e instanceof Hopper)) return false;
      const ex = toPx(e.body.x);
      const ey = toPx(e.body.y);
      return ex - cx > 0 && ex - cx < AHEAD && ey < bottom && ey + toPx(e.body.h) > top;
    });
    if (ahead && p.body.onGround) {
      this.doing = 'shoot';
      return p.facing < 0 ? ['right'] : this.tap();
    }
    const out: Action[] = ['right', ...this.tap()];
    if (this.still > 6 && this.frame % 24 < 12) out.push('jump');
    return out;
  }

  /* ---------- The Plutonium Boss ---------- */

  /** Keeps the boss's shots as seen each frame, to decide on the picture `reaction` frames old. */
  private remember(world: World): void {
    const now: Seen[] = [];
    for (const e of world.entities)
      if (e instanceof PlutoShot && e.alive)
        now.push({
          x: toPx(e.body.x),
          y: toPx(e.body.y),
          vx: e.vx,
          vy: e.vy,
          shot: e.shot,
          w: toPx(e.body.w),
          ref: e,
        });
    this.history.push(now);
    if (this.history.length > this.opts.reaction + 1) this.history.shift();
  }

  private seen(): Seen[] {
    return this.history[0] ?? [];
  }

  private fight(world: World, boss: PlutoniumBoss): Action[] {
    const p = world.player;
    const left = toPx(p.body.x);
    const right = left + toPx(p.body.w);
    const mid = (left + right) / 2;
    const m = this.opts.margin;
    // Shots seen (late), and where they will come down.
    const danger: { lo: number; hi: number }[] = [];
    let ballNear = false;
    for (const s of this.seen()) {
      if (!s.ref.alive) continue;
      if (s.shot === 'ball') {
        const gap = s.x - right;
        // (seen late: it is that much nearer now)
        const near = gap + s.vx * this.opts.reaction;
        if (near < BALL_LEAD && near > -s.w) ballNear = true;
        continue;
      }
      let off = this.guess.get(s.ref);
      if (off === undefined) {
        off = this.rng.int(2 * this.opts.misjudge + 1) - this.opts.misjudge;
        this.guess.set(s.ref, off);
      }
      const land = landing(s);
      const lx = land.x + off;
      if (land.t - this.opts.reaction > 70) continue;
      danger.push({ lo: lx - s.w / 2 - m, hi: lx + s.w / 2 + m });
    }
    // Before the rain, not under the core.
    if (boss.phase === 'core' && boss.glowing) {
      const bx = toPx(boss.body.x) + 16;
      danger.push({ lo: bx - 40, hi: bx + 40 });
    }
    const w = right - left;
    const hit = (l: number) => danger.some((d) => l < d.hi && l + w > d.lo);
    if (ballNear && p.body.onGround) {
      this.doing = 'jump';
      // A fresh press (let go the frame before).
      // (it comes faster than she can hang over it: jump INTO it, driving toward it)
      this.jumpHeld = !this.jumpHeld;
      return this.jumpHeld ? ['jump', 'right'] : ['right'];
    }
    if (!p.body.onGround && this.jumpHeld) return ['jump', 'right'];
    this.jumpHeld = false;
    if (hit(left)) {
      // The nearest spot clear of everything coming down (the mass's side is the right).
      const far = boss.phase === 'core' ? 220 : 150;
      let to: number | null = null;
      for (let d = 4; d < 220 && to === null; d += 4)
        for (const sgn of [-1, 1]) {
          const l = left + sgn * d;
          if (l < 18 || l + w > far) continue;
          if (!hit(l)) {
            to = l;
            break;
          }
        }
      if (to !== null) {
        this.doing = 'dodge';
        return [to < left ? 'left' : 'right'];
      }
    }
    if (boss.phase === 'core') {
      this.doing = 'core';
      const bx = toPx(boss.body.x) + 16;
      const out: Action[] = ['up'];
      const goto = (x: number) => !hit(x - w / 2);
      if (bx < mid - 6 && goto(mid - 4)) out.push('left');
      else if (bx > mid + 6 && goto(mid + 4)) out.push('right');
      out.push(...this.tap());
      if (this.frame - this.lastMissile > 40 && (p.scratch.homing ?? 0) > 0) {
        this.lastMissile = this.frame;
        out.push('special');
      }
      return out;
    }
    this.doing = 'mass';
    // Face the mass from the left of the chamber.
    if (left > 64) return ['left'];
    if (p.facing < 0 || left < 32) return ['right'];
    return this.tap();
  }
}
