import type { Action } from '@engine/input/actions';
import { Rng } from '@engine/rng';
import { tileAt, toPx } from '@engine/math/units';
import type { World } from '../../world/world';
import { Enemy } from '../../entities/enemies/enemy';
import { Piranha } from '../../entities/enemies/piranha';
import { Koopa } from '../../entities/enemies/koopa';
import { PowerUp } from '../../entities/objects/powerup';

/*
 * A player for the Mirror Race, for tests and difficulty tuning (not a shipped code path): it runs
 * right holding run, jumps walls and pits as it meets them (backing up for a running start at a
 * wide pit), stomps or jumps whatever walks or hops at it, and at a pipe whose piranha plant is up
 * it stops short and waits for the plant to go back down before going on, as a careful player does
 * (one that is down it runs past, and sometimes it comes up as the bot gets there).
 *
 * With `RaceBotOptions` it plays like a person: it sees enemies `reaction` frames late, misjudges
 * where they are by up to `error` px, presses jump up to `error / 3` frames late, and now and then
 * stops for a moment.
 */

export interface RaceBotOptions {
  /** Frames between something happening and the bot seeing it. */
  reaction: number;
  /** Most px by which it misjudges an enemy's position (and frames by a third of it, a jump). */
  error: number;
  /** Chance a frame on the ground starts a pause (it lets go of everything for 10-40 frames). */
  pause: number;
  seed: number;
  /**
   * What a player sees of the course at a glance: places to jump from (px of the body's left edge,
   * standing with the feet in tile row `row`), such as up onto a brick bridge over a pit too wide
   * to jump. Slower than `minVx` (px a frame) there, it backs up for a running start instead (to
   * `back` px when given).
   */
  hints?: readonly { x0: number; x1: number; row: number; minVx?: number; back?: number }[];
}

/** A sharp player: sees everything at once, judges exactly, never pauses. (Every preset knows
 * the race's take-offs, RACE_HINTS.) */
export const SHARP: RaceBotOptions = { reaction: 0, error: 0, pause: 0, seed: 1 };
/** A careful first-timer (the human sim), as Jungle Assault's. */
export const CAUTIOUS: RaceBotOptions = { reaction: 15, error: 6, pause: 0.004, seed: 1 };
/** A clumsier first-timer: slower, misjudges more, pauses more. */
export const CLUMSY: RaceBotOptions = { reaction: 21, error: 10, pause: 0.01, seed: 1 };

interface Seen {
  ref: Enemy | PowerUp;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  plant: boolean;
  /** It can hurt on touch (a still shell, a hidden plant or a good item cannot). */
  harms: boolean;
}

/** How far from a plant's pipe centre (px) the bot stays when it backs up past one. */
const WAIT_AT = 44;
/** A plant seen going down this recently (frames) is safe to back up past. */
const SAFE_FOR = 25;

export class RaceBot {
  private readonly opts: RaceBotOptions;
  private readonly rng: Rng;
  private readonly history: Seen[][] = [];
  private readonly offsets = new WeakMap<object, number>();
  /** Per plant (as seen): the frame it was last seen out of its pipe, and whether it is out. */
  private readonly plants = new WeakMap<object, { out: boolean; downAt: number }>();
  private frame = 0;
  private jumpHold = 0;
  private jumpWait = -1;
  private retreat = 0;
  /** Backing up to here (px) for a run at a hinted take-off, or null. */
  private backTo: number | null = null;
  private pauseLeft = 0;
  private stuckFrames = 0;
  private lastX = -1;
  private best = 0;
  private still = 0;
  /** It went this long without getting further (a stuck bot is not race difficulty). */
  stuck = false;
  /** Frames spent waiting for plants (tests). */
  waited = 0;

  constructor(opts: Partial<RaceBotOptions> = {}) {
    this.opts = { ...SHARP, hints: RACE_HINTS, ...opts };
    this.rng = new Rng(this.opts.seed * 2654435761 + 7);
  }

  private offset(ref: object): number {
    let o = this.offsets.get(ref);
    if (o === undefined) {
      o = this.opts.error ? this.rng.int(this.opts.error * 2 + 1) - this.opts.error : 0;
      this.offsets.set(ref, o);
    }
    return o;
  }

  private look(world: World): void {
    const now: Seen[] = [];
    for (const e of world.entities) {
      const isPoison = e instanceof PowerUp && e.item === 'poison';
      if (!(e instanceof Enemy && e.alive) && !isPoison) continue;
      const b = e.body;
      const still = e instanceof Koopa && e.isStillShell;
      now.push({
        ref: e as Enemy | PowerUp,
        x: toPx(b.x),
        y: toPx(b.y),
        w: toPx(b.w),
        h: toPx(b.h),
        vx: b.vx / 4096,
        plant: e instanceof Piranha,
        harms: isPoison || (e instanceof Enemy && e.contactHurts && !still),
      });
    }
    this.history.push(now);
    if (this.history.length > this.opts.reaction + 1) this.history.shift();
  }

  /** What the bot sees now: the world `reaction` frames ago, carried forward at the speeds it saw. */
  private seen(): Seen[] {
    const old = this.history[0] ?? [];
    const lag = this.history.length - 1;
    return old.map((s) => ({ ...s, x: s.x + (s.plant ? 0 : s.vx * lag) + this.offset(s.ref) }));
  }

  step(world: World): Action[] {
    this.frame++;
    this.look(world);
    const p = world.player;
    const b = p.body;
    const x = toPx(b.x);
    if (x > this.best + 1) {
      this.best = x;
      this.still = 0;
    } else if (++this.still > 900) this.stuck = true;

    if (this.pauseLeft > 0) {
      this.pauseLeft--;
      return [];
    }
    // A moment's pause (a person looking around), never with something coming at it nor with an
    // edge just ahead to slide off.
    const ledge = (() => {
      const feetRow = tileAt(b.y + b.h - 1);
      const col = tileAt(b.x + b.w);
      for (let c = col; c <= col + 3; c++) {
        const k = world.map.collisionAt(c, feetRow + 1);
        if (k !== 'solid' && k !== 'top') return true;
      }
      return false;
    })();
    const calm =
      !ledge && (this.history[0]?.every((e) => e.plant || !e.harms || Math.abs(e.x - x) > 120) ?? true);
    if (b.onGround && calm && this.opts.pause && this.rng.chance(this.opts.pause)) {
      this.pauseLeft = 10 + this.rng.int(31);
      return [];
    }
    const out: Action[] = ['run'];
    const seen = this.seen();
    const mx = x;
    const mw = toPx(b.w);
    const my = toPx(b.y);
    const mh = toPx(b.h);
    const front = mx + mw;
    const centre = mx + mw / 2;

    // Plants: remember when each was last seen out of its pipe.
    for (const s of seen) {
      if (!s.plant) continue;
      const st = this.plants.get(s.ref) ?? { out: true, downAt: -1000 };
      const out_ = s.h > 0;
      if (st.out && !out_) st.downAt = this.frame;
      st.out = out_;
      this.plants.set(s.ref, st);
    }
    // Plants within reach: never walk (or back up) into one that is out, nor jump at its pipe.
    const feet = my + mh;
    let limit = Infinity;
    let back = -Infinity;
    let noJump = false;
    for (const s of seen) {
      if (!s.plant) continue;
      const c = s.x + s.w / 2;
      const dist = c - centre;
      const mouth = s.y + s.h;
      if (dist < -140 || dist > 140 || mouth < feet - 72) continue;
      const st = this.plants.get(s.ref);
      if (dist < -24) {
        // Behind: never back up into it.
        if (st?.out) back = Math.max(back, c + 6 + 14);
        else if (!(st && this.frame - st.downAt < SAFE_FOR)) back = Math.max(back, c + WAIT_AT - mw / 2);
        continue;
      }
      const elevated = mouth < feet - 8;
      if (st?.out) {
        // No jump that could come down on it (one onto its pipe, or over and into it); short of a
        // tall pipe it waits a run-up back, so the jump up clears the pipe once the plant is down.
        if (dist < 112) noJump = true;
        limit = Math.min(limit, elevated ? c - 16 - 24 : c - 6 - 14);
        continue;
      }
    }
    // Waiting for a plant: on a ledge, wait at its edge rather than drop off toward the plant.
    if (limit < Infinity && b.onGround) {
      const feetRow = tileAt(b.y + b.h - 1);
      for (let c = tileAt(b.x + b.w) + 1; c * 16 < limit; c++) {
        const k = world.map.collisionAt(c, feetRow + 1);
        if (k !== 'solid' && k !== 'top') {
          limit = Math.min(limit, c * 16 - 1);
          break;
        }
      }
    }
    // Braking (holding back, a skid) takes about v² / 0.2 px.
    const v = b.vx / 4096;
    const stopping = v > 0 ? (v * v) / 0.2 : 0;
    let dir: -1 | 0 | 1 = 1;
    let wantJump = false;
    if (front + stopping > limit - 2 && b.onGround) {
      this.waited++;
      dir = v > 0.3 || front > limit + 2 ? -1 : 0;
      this.stuckFrames = 0;
    } else if (
      (this.retreat > 0 || (this.backTo !== null && x > this.backTo)) &&
      mx + Math.min(0, v * Math.abs(v)) / 0.2 > back + 2
    ) {
      this.retreat = Math.max(0, this.retreat - 1);
      dir = -1;
    } else {
      this.retreat = 0;
      this.backTo = null;
      if (b.x === this.lastX && !noJump) this.stuckFrames++;
      else this.stuckFrames = 0;
      this.lastX = b.x;
      if (this.stuckFrames > 30) {
        this.retreat = 40;
        this.stuckFrames = 0;
      }
      const map = world.map;
      const col = tileAt(b.x + b.w);
      const feetRow = tileAt(b.y + b.h - 1);
      const fast = Math.abs(b.vx) >= p.profile.maxWalk;
      const hints = this.opts.hints?.filter((h) => h.row === feetRow) ?? [];
      // A hinted take-off just ahead: hold on for it rather than jump early.
      const soon = hints.some((h) => x < h.x0 && h.x0 - x < 48);
      for (let d = 1; d <= (fast ? 2 : 1); d++)
        if (!soon && (map.isSolid(col + d, feetRow) || map.isSolid(col + d, feetRow - 1))) wantJump = true;
      const groundAt = (c: number): boolean => {
        for (let r = feetRow + 1; r <= feetRow + 3; r++) {
          const k = map.collisionAt(c, r);
          if (k === 'solid' || k === 'top') return true;
        }
        return false;
      };
      const hinted = hints.some((h) => x >= h.x0 && x <= h.x1);
      const slow = hints.find((h) => x >= h.x0 && x <= h.x1 && h.minVx !== undefined && v < h.minVx);
      if (slow && b.onGround) {
        this.retreat = 60;
        this.backTo = slow.back ?? null;
        dir = -1;
      } else if (hinted && b.onGround) wantJump = true;
      else if (b.onGround && !soon && !(groundAt(col + 1) && (!fast || groundAt(col + 2)))) {
        // A pit with no floor: it needs speed, so back up for a running start if slow.
        // (A pit just past a short drop counts: it is jumped from the edge above.)
        const floorless = (c: number) => {
          for (let r = feetRow + 1; r < map.height; r++) {
            const k = map.collisionAt(c, r);
            if (k === 'solid' || k === 'top') return false;
          }
          return true;
        };
        const pit = [1, 2, 3, 4].some((d) => floorless(col + d));
        // A drop to a floor below is walked off; a pit is jumped.
        if (pit && Math.abs(b.vx) < p.profile.maxRun * 0.75) {
          this.retreat = 48;
          dir = -1;
          wantJump = false;
        } else if (pit) {
          // Under a low ceiling (a row of blocks), wait for the edge itself, or the jump bonks.
          let edge = col + 1;
          while (edge < col + 4 && groundAt(edge)) edge++;
          const low = [col, col + 1].some((c) => [2, 3, 4].some((d) => map.isSolid(c, feetRow - d)));
          wantJump = !low || edge * 16 - front <= 8;
        }
      }
    }
    // At a ledge's edge with something that hurts walking about below where it would land: wait.
    if (dir === 1 && b.onGround && !wantJump) {
      const map = world.map;
      const feetRow = tileAt(b.y + b.h - 1);
      const next = tileAt(b.x + b.w) + 1;
      const k = map.collisionAt(next, feetRow + 1);
      if (k !== 'solid' && k !== 'top' && next * 16 - front < 10) {
        for (const s of seen)
          if (s.harms && !s.plant && s.y > feet && s.x + s.w > next * 16 - 8 && s.x < next * 16 + 48) {
            dir = 0;
            this.stuckFrames = 0;
          }
      }
    }
    let urgent = false;
    // Something that hurts coming at it at about its height: jump (onto it, or over it).
    for (const s of seen) {
      if (!s.harms || s.plant) continue;
      const dx = s.x - front;
      const closing = Math.max(0.5, v - s.vx);
      const overlapY = s.y < my + mh + 4 && s.y + s.h > my - 40;
      if (overlapY && dx > -10 && dx / closing < 16) {
        wantJump = true;
        if (dx / closing < 10) urgent = true;
      }
    }
    if (noJump && !urgent) wantJump = false;
    // In the air, coming down beside (not onto) something that hurts: hold back to land short.
    if (!b.onGround && b.vy > 0 && dir === 1) {
      for (const s of seen) {
        if (!s.harms || s.plant) continue;
        const dx = s.x - front;
        // Where it comes down: about as far on as it falls to the thing's top, at this speed.
        const fall = Math.max(0, s.y - (my + mh));
        const t = fall > 0 ? Math.sqrt((2 * fall) / 0.4) : 0;
        if (dx > -6 && dx < 20 + Math.max(0, v - s.vx) * t && my < s.y + s.h) dir = -1;
      }
    }
    if (dir === 1) out.push('right');
    else if (dir === -1) out.push('left');

    if (b.onGround && this.jumpHold > 0) this.jumpHold = 0;
    else if (wantJump && b.onGround && this.jumpHold === 0) {
      if (this.jumpWait < 0)
        this.jumpWait = this.opts.error ? this.rng.int(Math.floor(this.opts.error / 3) + 1) : 0;
      if (this.jumpWait-- <= 0) {
        this.jumpWait = -1;
        this.jumpHold = 32;
      }
    }
    if (this.jumpHold > 0) {
      this.jumpHold--;
      out.push('jump');
    }
    return out;
  }
}

/**
 * The Mirror Race's take-offs a player picks out at a glance: the run-jump at the edge of the
 * first pit that lands on the bricks beyond it, the jump from their far end up onto the brick
 * bridge over the wide pit (the only way across it), and the hop from the right edge of the pipe
 * top before the second bridge (onto the bridge, or across to the island pipe under it).
 */
export const RACE_HINTS: NonNullable<RaceBotOptions['hints']> = [
  { x0: 822, x1: 838, row: 12, minVx: 2.2 },
  { x0: 1070, x1: 1092, row: 8, minVx: 2.2 },
  { x0: 1983, x1: 1995, row: 8 },
];
