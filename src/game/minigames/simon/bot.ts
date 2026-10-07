import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { Enemy } from '../../entities/enemies/enemy';
import type { World } from '../../world/world';
import { CvShot, MEDUSA_PERIOD, MEDUSA_WAVE, MedusaHead } from './creatures';
import { Beast, BeastHead, CAST_FIRE_AT, Dracula, DraculaHead } from './dracula';
import type { CastleScene } from './scene';

/*
 * A player for Dracula's Castle, for tests and difficulty tuning (docs/HEROES.md): it walks the
 * castle right, takes both flights of stairs, lashes candles, creatures and shots
 * in reach, and in the throne room stands off Dracula's head, jumps and lashes it as it comes
 * down; then it steps in under the beast's head as it lands, jumps and lashes it, backs off when
 * it opens its maw to spit, and gets out from under its leaps (under a high one when cornered). With `CautiousOptions` it plays like a careful first-timer: it sees things `reaction`
 * frames late and up to `error` px off, mistimes its jumping lashes by up to `error / 3` frames,
 * and now and then stops for a moment; each hit Dracula lands, and each jumping lash that misses
 * his head, halves its misjudging (to a quarter).
 */

export interface CautiousOptions {
  /** Frames between something happening and the bot seeing it. */
  reaction: number;
  /** Most px by which it misjudges a position (and frames by a third of it, a lash's timing). */
  error: number;
  /** Chance a frame starts a pause (it lets go of everything for 10-30 frames). */
  pause: number;
  seed: number;
}

/** A sharp player: sees everything at once, judges exactly, never pauses. */
export const SHARP: CautiousOptions = { reaction: 0, error: 0, pause: 0, seed: 1 };
/** A careful first-timer (the human sim). */
export const CAUTIOUS: CautiousOptions = { reaction: 15, error: 6, pause: 0.004, seed: 1 };

/** The route's fixed points (px): the first flight's foot, the second's top, the walk's floor. */
export const ROUTE = { stairs1: 288, stairs2Top: 736, walkFloor: 128 } as const;
/** Frames after take-off at which a jumping lash meets Dracula's head on the way down. */
export const HEAD_LASH_AT = 37;
/** The same for the beast's head (lower: later in the fall). */
export const BEAST_LASH_AT = 41;
/** Centre to head-centre distance (px) it lashes the beast's head from. */
export const BEAST_REACH = 22;

interface Seen {
  id: number;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  state: string;
  /** Frames into that state (Dracula and the beast). */
  t: number;
  live: boolean;
  /** Its motion over the last frame (px). */
  dx: number;
  dy: number;
  /** A Medusa head's wave: its age and centre line (px), to read its path ahead. */
  wave: { age: number; baseY: number } | null;
  /** The beast in a leap: where it will land (its centre, px), as a player reads the arc. */
  goal: number | null;
}

/** Frames from pressing the whip to the lash being live (its wind-up). */
export const WIND_UP = 10;

export class CastleBot {
  private readonly opts: CautiousOptions;
  private readonly rng: Rng;
  private readonly history: Seen[][] = [];
  private readonly offsets = new Map<number, { x: number; y: number }>();
  private pauseLeft = 0;
  /** Lashes at each candle so far (a candle still there after one was a miss). */
  private readonly candleMisses = new Map<number, number>();
  /** How much of `error` it still makes (halved by each hit taken from Dracula, to a quarter). */
  private learn = 1;
  private lastHp = Infinity;
  /** The boss's hit points when the current jump began (a miss teaches). */
  private jumpLife = -1;
  private attackHeld = false;
  private specialHeld = false;
  private jumpT = -1;
  private lashAt = HEAD_LASH_AT;
  private frame = 0;
  /** Phases of the round it reached (tests). */
  readonly reached = new Set<string>();

  constructor(opts: Partial<CautiousOptions> = {}) {
    this.opts = { ...SHARP, ...opts };
    this.rng = new Rng(this.opts.seed * 2654435761 + 11);
  }

  private offset(id: number): { x: number; y: number } {
    let o = this.offsets.get(id);
    if (!o) {
      const e = this.opts.error * this.learn;
      o = { x: Math.round((this.rng.float() * 2 - 1) * e), y: Math.round((this.rng.float() * 2 - 1) * e) };
      this.offsets.set(id, o);
    }
    return o;
  }

  private look(world: World): Seen[] {
    const now: Seen[] = [];
    const prev = new Map((this.history.at(-1) ?? []).map((s) => [s.id, s]));
    for (const e of world.entities) {
      if (!e.alive) continue;
      const threat = e instanceof Enemy || e instanceof CvShot;
      if (!threat) continue;
      const o = this.offset(e.id);
      let state = '';
      let live = true;
      let t = 0;
      if (e instanceof Dracula) {
        state = e.state;
        live = e.present;
        t = e.t;
      } else if (e instanceof DraculaHead) {
        state = e.owner.state;
        live = e.owner.hurtable;
        t = e.owner.t;
      } else if (e instanceof Beast) {
        state = e.state;
        live = e.hurtable;
        t = e.t;
      } else if (e instanceof BeastHead) {
        state = e.owner.state;
        live = e.owner.hurtable;
        t = e.owner.t;
      }
      const x = e.body.x / 256 + o.x;
      const y = e.body.y / 256 + o.y;
      const before = prev.get(e.id);
      now.push({
        id: e.id,
        kind: e.kind,
        x,
        y,
        wave: e instanceof MedusaHead ? { age: e.age, baseY: toPx(e.baseY) + o.y } : null,
        goal: e instanceof Beast && e.state === 'leap' ? toPx(e.goal) + o.x : null,
        dx: before ? x - before.x : 0,
        dy: before ? y - before.y : 0,
        w: toPx(e.body.w),
        h: toPx(e.body.h),
        vx: e.body.vx,
        vy: e.body.vy,
        state,
        t,
        live,
      });
    }
    this.history.push(now);
    if (this.history.length > this.opts.reaction + 1) this.history.shift();
    return this.history[0] ?? now;
  }

  next(scene: CastleScene): Action[] {
    this.frame++;
    this.reached.add(scene.phase);
    const world = scene.world;
    const p = scene.player;
    // A player learns from a hit in the throne room: it judges what comes next more closely.
    if (scene.phase === 'fight' && p.hp < this.lastHp) this.learnMore();
    this.lastHp = p.hp;
    const seen = this.look(world);
    if (p.dead || (scene.phase !== 'stage' && scene.phase !== 'fight')) {
      this.jumpT = -1;
      this.attackHeld = false;
      return [];
    }
    if (this.jumpT >= 0) this.jumpT++;
    if (p.body.onGround && this.jumpT > 3) {
      // A jumping lash that missed his head: it judges the next one more closely.
      if (scene.dracula && scene.life.hp === this.jumpLife) this.learnMore();
      this.jumpT = -1;
    }
    if (this.pauseLeft > 0) {
      this.pauseLeft--;
      return [];
    }
    if (this.opts.pause > 0 && p.body.onGround && !p.stairs && this.rng.chance(this.opts.pause)) {
      this.pauseLeft = 10 + this.rng.int(21);
      return [];
    }
    const want = scene.phase === 'fight' ? this.fight(scene, seen) : this.stage(scene, seen);
    // A tap: attack must be released between lashes.
    const out: Action[] = [];
    for (const a of want) {
      if (a === 'attack') {
        if (!this.attackHeld && p.attackTimer === 0) out.push('attack');
        continue;
      }
      if (a === 'special') {
        if (!this.specialHeld) out.push('special');
        continue;
      }
      out.push(a);
    }
    this.attackHeld = out.includes('attack');
    this.specialHeld = out.includes('special');
    return out;
  }

  /** Me, in px. */
  private me(scene: CastleScene) {
    const b = scene.player.body;
    return {
      x: toPx(b.x),
      y: toPx(b.y),
      w: toPx(b.w),
      h: toPx(b.h),
      cx: toPx(scene.player.centerX),
      feet: toPx(b.y + b.h),
    };
  }

  /** Something in the lash's box if Simon faces `dir` (whip reach 24 from his front edge). */
  private inLash(scene: CastleScene, s: Seen, dir: -1 | 1, slack = 0, ahead = 0): boolean {
    const m = this.me(scene);
    // What it sees is `reaction` frames old: it reads the motion on from there.
    if (ahead > 0) ahead += this.opts.reaction;
    const x = s.x + s.dx * ahead;
    const y = s.wave
      ? s.wave.baseY +
        Math.round(Math.sin(((s.wave.age + ahead) * 2 * Math.PI) / MEDUSA_PERIOD) * MEDUSA_WAVE)
      : s.y + s.dy * ahead;
    const x0 = dir > 0 ? m.x + m.w - slack : m.x - 24 - slack;
    const x1 = dir > 0 ? m.x + m.w + 24 + slack : m.x + slack;
    // (a lash is 6 px tall; it judges heights loosely, by its error)
    const y0 = m.y + 4 - this.opts.error;
    const y1 = m.y + 14 + this.opts.error;
    return x < x1 && x + s.w > x0 && y < y1 && y + s.h > y0;
  }

  private stage(scene: CastleScene, seen: Seen[]): Action[] {
    const p = scene.player;
    const m = this.me(scene);
    const held: Action[] = [];
    const facing = p.facing;
    // Lash whatever is in reach ahead (candles too: hearts and the dagger).
    // (Where it will be when the lash comes out, after the wind-up.)
    // A candle it lashed at and missed (it misjudged the reach) needs a step closer: each miss
    // takes 4 px off how far it trusts the whip to reach that candle.
    const ahead = seen.filter((s) =>
      s.kind === 'candle'
        ? this.inLash(scene, s, facing, -4 * (this.candleMisses.get(s.id) ?? 0))
        : this.inLash(scene, s, facing, 2, WIND_UP + 3),
    );
    if (ahead.length) {
      held.push('attack');
      if (p.attackTimer === 0 && !this.attackHeld)
        for (const c of ahead)
          if (c.kind === 'candle') this.candleMisses.set(c.id, (this.candleMisses.get(c.id) ?? 0) + 1);
    }
    // Something hostile in reach behind: turn to it (not on the stairs' climb).
    const behind = seen.find(
      (s) => s.kind !== 'candle' && this.inLash(scene, s, -facing as -1 | 1, 0, WIND_UP + 3),
    );
    if (!ahead.length && behind && !p.stairs && p.body.onGround) {
      held.push(facing > 0 ? 'left' : 'right');
      return held;
    }
    if (p.stairs) {
      // Up the first flight, down the second.
      held.push(p.stairs.line.sx > 0 ? 'up' : 'down');
      if (p.attackTimer > 0) return held.filter((a) => a === 'attack');
      return held;
    }
    if (p.attackTimer > 0) return held;
    // A skeleton close ahead: hold until it is down (lash it when in reach).
    const skel = seen.find((s) => s.kind === 'skeleton' && s.x - (m.x + m.w) < 30 && s.x + s.w > m.x - 4);
    const onWalk = Math.abs(m.feet - ROUTE.walkFloor) <= 2;
    if (!onWalk && m.cx < ROUTE.stairs1 + 40 && m.feet > 150) {
      if (m.cx > ROUTE.stairs1 + 3) held.push('left');
      else if (m.cx >= ROUTE.stairs1 - 3) held.push('up');
      else held.push('right');
      return held;
    }
    // A Medusa head coming: stand and lash it as its wave brings it into reach; one on top of
    // him: walk on the way it flies (he is quicker) until it is in front of him again.
    const medusa = seen.find((s) => {
      if (s.kind !== 'medusa' || Math.abs(s.x + (s.w >> 1) - m.cx) > 72) return false;
      const gone = (s.dx < 0 && s.x + s.w < m.x - 2) || (s.dx > 0 && s.x > m.x + m.w + 2);
      return !gone;
    });
    if (medusa) {
      const from: -1 | 1 = medusa.dx < 0 ? 1 : -1;
      // (where it is now, read on from what it saw)
      const mx = medusa.x + medusa.dx * this.opts.reaction;
      const gap = from > 0 ? mx - (m.x + m.w) : m.x - (mx + medusa.w);
      if (gap < 12) held.push(from > 0 ? 'left' : 'right');
      else if (p.facing !== from) held.push(from > 0 ? 'right' : 'left');
      return held;
    }
    if (onWalk) {
      if (m.cx >= ROUTE.stairs2Top - 6) held.push('down');
      else held.push('right');
      return held;
    }
    if (skel && !this.inLash(scene, skel, 1, 0)) {
      // Step in to reach him (but not into him).
      if (skel.x - (m.x + m.w) > 18) held.push('right');
      return held;
    }
    if (skel) return held;
    held.push('right');
    return held;
  }

  private fight(scene: CastleScene, seen: Seen[]): Action[] {
    const p = scene.player;
    const m = this.me(scene);
    const held: Action[] = [];
    const roomL = scene.layout.roomX * 16 + 16;
    const roomR = scene.layout.roomX * 16 + 15 * 16;
    // Shots: lash the ones coming into reach; jump a low one the lash can't meet.
    for (const s of seen) {
      if (s.kind !== 'fireball' && s.kind !== 'beast-fire') continue;
      const toward = (s.vx > 0 && s.x < m.cx) || (s.vx < 0 && s.x > m.cx);
      if (!toward) continue;
      const dir: -1 | 1 = s.x < m.cx ? -1 : 1;
      if (this.inLash(scene, s, dir, 2, WIND_UP + 3)) {
        if (p.facing === dir) held.push('attack');
        else held.push(dir > 0 ? 'right' : 'left');
        return held;
      }
    }
    const head = seen.find((s) => s.kind === 'dracula-head');
    const beast = seen.find((s) => s.kind === 'beast');
    const beastHead = seen.find((s) => s.kind === 'beast-head');
    if (head) return this.fightCount(scene, head, held, roomL, roomR, seen);
    if (beast && beastHead) return this.fightBeast(scene, beast, beastHead, held, roomL, roomR);
    return held;
  }

  /**
   * Phase 1: out of the spread's way while he appears and casts (lashing the level fireball as it
   * comes), then in under his head at lash's length while he lingers, a jump, and the lash on
   * the way down.
   */
  private fightCount(
    scene: CastleScene,
    head: Seen,
    held: Action[],
    roomL: number,
    roomR: number,
    seen: Seen[],
  ): Action[] {
    const p = scene.player;
    const m = this.me(scene);
    const hx = head.x + 8;
    if (this.jumpT >= 0) {
      if (this.jumpT === this.lashAt) held.push('attack');
      return held;
    }
    const faceDir: -1 | 1 = hx > m.cx ? 1 : -1;
    const dist = Math.abs(hx - m.cx);
    const move = (dir: -1 | 1) => held.push(dir > 0 ? 'right' : 'left');
    if (head.state === 'gone' || head.state === 'vanish') {
      const mid = (roomL + roomR) >> 1;
      if (Math.abs(m.cx - mid) > 40) move(m.cx < mid ? 1 : -1);
      return held;
    }
    // A fireball still on its way to him (where it is now, read on from what it saw); the high
    // one, rising, flies over his head.
    const coming = seen.some((s) => {
      if (s.kind !== 'fireball' || s.dy < -0.1) return false;
      // (one already at the lash has been knocked away, or soon will be)
      const x = s.x + s.dx * this.opts.reaction;
      return (s.dx < 0 ? x > m.x + m.w + 12 : x + s.w < m.x - 12) && Math.abs(x - m.cx) < 90;
    });
    const casting =
      head.state === 'appear' || (head.state === 'cast' && head.t <= CAST_FIRE_AT + 1) || coming;
    if (casting) {
      // Keep well off: the low fireball lands short, the high one flies over, and the level one
      // takes long enough to arrive for a slower player to see it and lash it.
      const near = 50 + Math.max(0, this.opts.reaction - 12);
      const back: -1 | 1 = -faceDir as -1 | 1;
      const wall = back < 0 ? m.x < roomL + 2 : m.x + m.w > roomR - 2;
      if (dist < near && !wall) move(back);
      else if (dist > near + 12) move(faceDir);
      else if (p.facing !== faceDir) move(faceDir);
      return held;
    }
    // Under his head, 24 px off on the near side, facing him.
    const side = m.cx < hx ? -1 : 1;
    let goal = hx + side * 24;
    if (goal < roomL + 8 || goal > roomR - 8) goal = hx - side * 24;
    const d = goal - m.cx;
    if (Math.abs(d) > 3) {
      move(d > 0 ? 1 : -1);
      return held;
    }
    if (p.facing !== faceDir) {
      move(faceDir);
      return held;
    }
    if (head.live && p.body.onGround && p.attackTimer === 0 && p.body.vx === 0) {
      held.push('jump');
      this.startJump(scene);
    }
    return held;
  }

  /** Halves what is left of its misjudging (to a quarter); what it sees from now on is judged anew. */
  private learnMore(): void {
    this.learn = Math.max(0.25, this.learn * 0.5);
    this.offsets.clear();
  }

  private startJump(scene?: CastleScene, at = HEAD_LASH_AT): void {
    this.jumpT = 0;
    this.jumpLife = scene?.life.hp ?? -1;
    const e = Math.round((this.opts.error * this.learn) / 3);
    this.lashAt = at + (e ? this.rng.int(2 * e + 1) - e : 0);
  }

  /**
   * Form 2: out from under its leaps (away from where it will land; under a high one when the
   * wall is at its back), well off while its maw is open, and in under its head as it lands: a
   * jump, and the lash on the way down.
   */
  private fightBeast(
    scene: CastleScene,
    beast: Seen,
    head: Seen,
    held: Action[],
    roomL: number,
    roomR: number,
  ): Action[] {
    const p = scene.player;
    const m = this.me(scene);
    if (this.jumpT >= 0) {
      if (this.jumpT === this.lashAt) held.push('attack');
      return held;
    }
    if (!p.body.onGround || p.attackTimer > 0) return held;
    const move = (d: -1 | 1) => held.push(d > 0 ? 'right' : 'left');
    const bcx = beast.x + (beast.w >> 1);
    const clear = 18 + 6 + 8;
    if (beast.state === 'leap' || beast.state === 'drop') {
      // Where it comes down: to lashing range of its head there, on this side of it (the other
      // side, under it, when the wall is too close), out from under it.
      const land = beast.goal ?? bcx;
      let side: -1 | 1 = m.cx < land ? -1 : 1;
      let want = land + side * (BEAST_REACH + 10);
      if (want < roomL + 8 || want > roomR - 8) {
        side = -side as -1 | 1;
        want = land + side * (BEAST_REACH + 10);
      }
      if (Math.abs(want - m.cx) > 3) move(want > m.cx ? 1 : -1);
      return held;
    }
    if (beast.state === 'crouch') {
      // About to leap: not right against it.
      if (Math.abs(bcx - m.cx) < clear) move(m.cx < bcx ? -1 : 1);
      return held;
    }
    const dir: -1 | 1 = bcx > m.cx ? 1 : -1;
    const hx = head.x + (head.w >> 1);
    const gap = Math.abs(hx - m.cx);
    // Its maw open (or soon to fire): stand well off and lash the fire as it comes.
    if (beast.state === 'spit-wind' || beast.state === 'spit') {
      const far = 64 + Math.max(0, this.opts.reaction - 12);
      const back: -1 | 1 = -dir as -1 | 1;
      const wall = back < 0 ? m.x < roomL + 2 : m.x + m.w > roomR - 2;
      if (gap < far && !wall) move(back);
      else if (p.facing !== dir) move(dir);
      return held;
    }
    // In under its head, facing it.
    const goal = hx - dir * BEAST_REACH;
    const d = goal - m.cx;
    if (Math.abs(d) > 3) {
      move(d > 0 ? 1 : -1);
      return held;
    }
    if (p.facing !== dir) {
      move(dir);
      return held;
    }
    // Jump while it stays put long enough for the lash to come down on its head (what it sees is
    // `reaction` frames old: it allows for that).
    const early = beast.state === 'land' || (beast.state === 'stand' && beast.t + this.opts.reaction <= 20);
    if (head.live && early && p.body.vx === 0) {
      held.push('jump');
      this.startJump(scene, BEAST_LASH_AT);
    }
    return held;
  }
}
