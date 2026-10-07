import type { Action } from '@engine/input/actions';
import { tileAt, toPx } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { Enemy } from '../../entities/enemies/enemy';
import type { World } from '../../world/world';
import { Pickup } from '../../entities/objects/pickup';
import { ArtScroll, Hawk, NgShot, SHOT_SLACK } from './creatures';
import { Afterimage, CROUCH_FRAMES, DASH_SPEED, DASH_SPEED_2, MaskedNinja, PHASE_TWO_HP } from './masked';
import type { DuelScene } from './scene';

/*
 * A player for Shadow Duel, for tests and difficulty tuning (docs/HEROES.md): it walks the stage
 * right, climbs every wall by clinging and kicking off it (holding toward the wall), jumps the
 * pits, slashes lanterns, throwers and hawks in reach, crouches under knives, jumps dogs, and in
 * the rooftop arena jumps the Masked Ninja's dashes, keeps moving while he throws stars and dives, and
 * slashes him while he stands or kneels.
 *
 * With `CautiousOptions` it plays like a careful first-timer: it sees things `reaction` frames
 * late and up to `error` px off, mistimes its jumps by up to `error / 3` frames, takes a moment
 * to kick off a wall, and now and then stops for a moment; each hit it takes from the Masked
 * Ninja halves its misjudging (to a quarter).
 */

export interface CautiousOptions {
  /** Frames between something happening and the bot seeing it. */
  reaction: number;
  /** Most px by which it misjudges a position (and frames by a third of it, a jump's timing). */
  error: number;
  /** Chance a frame starts a pause (it lets go of everything for 10-30 frames). */
  pause: number;
  seed: number;
}

/** A sharp player: sees everything at once, judges exactly, never pauses. */
export const SHARP: CautiousOptions = { reaction: 0, error: 0, pause: 0, seed: 1 };
/** A careful first-timer (the human sim). */
export const CAUTIOUS: CautiousOptions = { reaction: 15, error: 6, pause: 0.004, seed: 1 };

interface Seen {
  id: number;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Its motion over the last frame (px). */
  dx: number;
  dy: number;
  state: string;
  t: number;
  /** Afterimage: running. */
  live: boolean;
  /** A hawk's glide line (px): it levels off there once its swoop ends. */
  line: number | null;
}

/** The Masked Ninja's states in which the bot keeps walking. */
const ROAMING: ReadonlySet<string> = new Set(['climb', 'wall', 'aim', 'dive']);

/** How far across the room from his wall it waits while he is on it (px). */
const POST = 120;

/** Frames from pressing SLASH to the blade being out. */
export const WIND_UP = 2;
/** The sword's reach past Ryu's front (px). */
export const REACH = 12;
/** How far past the blade's reach (px) it goes back or on for a lantern. */
const LANTERN_NEAR = 24;
/** Frames it spends on one lantern (or what one left) before it gives up on it. */
const LANTERN_FRAMES = 90;

export class DuelBot {
  private readonly opts: CautiousOptions;
  private readonly rng: Rng;
  private readonly history: Seen[][] = [];
  private readonly offsets = new Map<number, { x: number; y: number }>();
  private pauseLeft = 0;
  private learn = 1;
  private lastHp = Infinity;
  private attackHeld = false;
  private jumpHeld = false;
  /** Frames it waits on a wall before kicking (a first-timer's moment). */
  private kickWait = 0;
  /** A jump timing slip for the next dash (frames, + late / - early). */
  private slip = 0;
  private slipFor = -1;
  private frame = 0;
  /** Phases of the round it reached (tests). */
  readonly reached = new Set<string>();
  /** It clung to a wall (tests). */
  clung = 0;
  /** Frames spent on each lantern or drop (by entity id). */
  private readonly spent = new Map<number, number>();

  constructor(opts: Partial<CautiousOptions> = {}) {
    this.opts = { ...SHARP, ...opts };
    this.rng = new Rng(this.opts.seed * 2654435761 + 7);
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
      const thing = e instanceof Enemy || e instanceof NgShot || e instanceof Afterimage;
      if (!thing && !(e instanceof ArtScroll || e instanceof Pickup)) continue;
      const o = this.offset(e.id);
      const x = e.body.x / 256 + o.x;
      const y = e.body.y / 256 + o.y;
      const before = prev.get(e.id);
      let state = '';
      let t = 0;
      let live = true;
      let line: number | null = null;
      if (e instanceof Hawk && e.attacking) line = toPx(e.lineY) + o.y;
      if (e instanceof MaskedNinja) {
        state = e.state;
        t = e.t;
      } else if (e instanceof Afterimage) live = e.active;
      else if ('state' in e && typeof e.state === 'string') state = e.state;
      now.push({
        id: e.id,
        kind: e.kind,
        x,
        y,
        w: toPx(e.body.w),
        h: toPx(e.body.h),
        dx: before ? x - before.x : 0,
        dy: before ? y - before.y : 0,
        state,
        t,
        live,
        line,
      });
    }
    this.history.push(now);
    if (this.history.length > this.opts.reaction + 1) this.history.shift();
    return this.history[0] ?? now;
  }

  next(scene: DuelScene): Action[] {
    this.frame++;
    this.reached.add(scene.phase);
    const world = scene.world;
    const p = scene.player;
    if (scene.boss && p.hp < this.lastHp) this.learnMore();
    this.lastHp = p.hp;
    const seen = this.look(world);
    if (p.clinging) this.clung++;
    if (p.dead || (scene.phase !== 'stage' && scene.phase !== 'fight')) {
      this.attackHeld = false;
      this.jumpHeld = false;
      return [];
    }
    if (this.pauseLeft > 0) {
      this.pauseLeft--;
      return this.out([], p);
    }
    if (this.opts.pause > 0 && p.body.onGround && this.rng.chance(this.opts.pause)) {
      this.pauseLeft = 10 + this.rng.int(21);
      return this.out([], p);
    }
    const want = scene.phase === 'fight' ? this.fight(scene, seen) : this.stage(scene, seen);
    return this.out(want, p);
  }

  /**
   * SLASH is a tap (let go between presses). JUMP is held through the rise (Ryu's jump is cut
   * short when it is let go) and let go for a frame before the next press (a kick off a wall).
   */
  private out(want: Action[], p: DuelScene['player']): Action[] {
    const res: Action[] = [];
    let attack = false;
    let jump = false;
    for (const a of want) {
      if (a === 'attack') attack = true;
      else if (a === 'jump') jump = true;
      else res.push(a);
    }
    if (attack && !this.attackHeld) res.push('attack');
    this.attackHeld = attack && !this.attackHeld;
    const rising = !p.body.onGround && p.body.vy < 0 && !p.clinging;
    if ((this.jumpHeld && rising) || (jump && !this.jumpHeld)) res.push('jump');
    this.jumpHeld = res.includes('jump');
    return res;
  }

  /** Still worth going for (it has not had LANTERN_FRAMES of the bot's time yet). */
  private worth(s: Seen): boolean {
    return (this.spent.get(s.id) ?? 0) < LANTERN_FRAMES;
  }

  private spend(s: Seen): void {
    this.spent.set(s.id, (this.spent.get(s.id) ?? 0) + 1);
  }

  /** Me, in px. */
  private me(scene: DuelScene) {
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

  /** Something in the slash's box if Ryu faces `dir`, `ahead` frames on (read from its motion). */
  private inSlash(scene: DuelScene, s: Seen, dir: -1 | 1, slack = 0, ahead = 0, crouch = false): boolean {
    const m = this.me(scene);
    const x0 = dir > 0 ? m.x + m.w - slack : m.x - REACH - slack;
    const x1 = dir > 0 ? m.x + m.w + REACH + slack : m.x + slack;
    const top = crouch ? m.feet - 16 : m.y;
    const y0 = top + 4 - (this.opts.error >> 1);
    const y1 = top + 12 + (this.opts.error >> 1);
    // Something moving: anywhere along its way while the blade is out (it reads its motion on
    // from what it saw, `reaction` frames old).
    const from = ahead > 0 ? ahead + this.opts.reaction : 0;
    const to = ahead > 0 ? from + 6 : 0;
    for (let k = from; k <= to; k += 2) {
      const x = s.x + s.dx * k;
      // (a swooping hawk levels off on its line)
      const y = s.line !== null ? Math.min(s.line, s.y + s.dy * k) : s.y + s.dy * k;
      if (x < x1 && x + s.w > x0 && y < y1 && y + s.h > y0) return true;
    }
    return false;
  }

  /** Is the tile column at px x solid at the row of px y? */
  private solidAt(world: World, x: number, y: number): boolean {
    return world.map.isSolid(tileAt(x * 256), tileAt(y * 256));
  }

  private stage(scene: DuelScene, seen: Seen[]): Action[] {
    const p = scene.player;
    const world = scene.world;
    const m = this.me(scene);
    const held: Action[] = [];
    const ground = p.body.onGround;
    // Climbing: on a wall, hold toward it and kick off it (after a moment).
    if (p.clinging) {
      held.push(p.facing > 0 ? 'right' : 'left');
      if (this.kickWait > 0) this.kickWait--;
      else {
        held.push('jump');
        this.kickWait = this.opts.error > 0 ? this.rng.int(this.opts.error + 2) : 0;
      }
      return held;
    }
    // Shots: crouch under a knife on its way (or slash one already at the blade).
    const knife = seen.find((s) => {
      if (s.kind !== 'knife') return false;
      // (where it is now, read on from what it saw)
      const x = s.x + s.dx * this.opts.reaction;
      const coming = s.dx < 0 ? x + s.w > m.x - 3 : x < m.x + m.w + 3;
      return coming && Math.abs(x + 4 - m.cx) < 56 && s.y < m.feet;
    });
    if (knife && ground) {
      held.push('down');
      return held;
    }
    // A lantern, a thrower or a hawk in the blade's reach ahead: slash.
    const facing = p.facing;
    const ahead = seen.some(
      (s) =>
        (s.kind === 'lantern' || s.kind === 'thrower' || s.kind === 'hawk') &&
        this.inSlash(scene, s, facing, s.kind === 'lantern' ? -2 : 1, s.kind === 'hawk' ? WIND_UP + 2 : 0),
    );
    if (ahead && p.attackTimer === 0) {
      held.push('attack');
      return held;
    }
    // A lantern close by at the blade's height, ahead or just passed (the art lantern on the last
    // wall's top, the health lantern at its foot): turn to it, step in and slash it. Then what it
    // left close by on his level (the art's scroll, spirit points, health): walk over it. A while
    // on each at most (a misjudged one may be out of reach).
    const lantern = ground
      ? seen.find(
          (s) =>
            s.kind === 'lantern' &&
            this.worth(s) &&
            (this.inSlash(scene, s, 1, LANTERN_NEAR) || this.inSlash(scene, s, -1, LANTERN_NEAR)),
        )
      : undefined;
    if (lantern) {
      this.spend(lantern);
      const dir: -1 | 1 = lantern.x + lantern.w / 2 < m.cx ? -1 : 1;
      if (facing === dir && this.inSlash(scene, lantern, dir, -2)) {
        if (p.attackTimer === 0) held.push('attack');
      } else held.push(dir > 0 ? 'right' : 'left');
      return held;
    }
    const drop = ground
      ? seen.find(
          (s) =>
            (s.kind === 'art-scroll' || s.kind === 'pickup') &&
            this.worth(s) &&
            // (on his level, or still popping up out of the lantern above him)
            s.y + s.h <= m.feet + 8 &&
            s.y + s.h >= m.feet - 48 &&
            s.x + s.w > m.x - LANTERN_NEAR &&
            s.x < m.x + m.w + LANTERN_NEAR,
        )
      : undefined;
    if (drop) {
      this.spend(drop);
      const dx = drop.x + drop.w / 2 - m.cx;
      if (Math.abs(dx) > 2) held.push(dx < 0 ? 'left' : 'right');
      return held;
    }
    // Dropping off a ledge with a lantern just ahead below (no pit there): brake, to land short of
    // it and slash it.
    const below = seen.some(
      (s) => s.kind === 'lantern' && s.y > m.feet && s.x + s.w > m.x && s.x - (m.x + m.w) < LANTERN_NEAR,
    );
    const pitNear = scene.layout.pits.some((c) => c * 16 + 16 > m.x - 16 && c * 16 < m.x + m.w + 48);
    if (!ground && !p.clinging && p.body.vy >= 0 && below && !pitNear) {
      if (p.body.vx > 0) held.push('left');
      return held;
    }
    // A hawk diving in from behind: turn to it.
    const hawkBehind = seen.find(
      (s) =>
        s.kind === 'hawk' &&
        (s.state === 'swoop' || s.state === 'glide') &&
        this.inSlash(scene, s, -facing as -1 | 1, 4, 8),
    );
    if (hawkBehind && ground) {
      held.push(facing > 0 ? 'left' : 'right');
      return held;
    }
    // A hawk crying or diving close: stand and wait for it to come into the blade.
    const hawk = seen.find(
      (s) => s.kind === 'hawk' && s.state !== 'circle' && s.state !== 'rise' && Math.abs(s.x + 6 - m.cx) < 72,
    );
    if (hawk && ground) {
      const dir: -1 | 1 = hawk.x + 6 < m.cx ? -1 : 1;
      if (dir !== facing) held.push(dir > 0 ? 'right' : 'left');
      return held;
    }
    // A dog running at him: jump it when it is close.
    const dog = seen.find((s) => s.kind === 'dog' && s.state !== 'wait' && s.x + s.w > m.x - 8);
    if (dog && ground) {
      const gap = dog.x - (m.x + m.w) + dog.dx * this.opts.reaction;
      if (dog.state === 'bark' || gap > 40) return held;
      held.push('jump', 'right');
      return held;
    }
    // A thrower close ahead: stop short of him (the blade reaches), or step back off him.
    const thrower = seen.find(
      (s) => s.kind === 'thrower' && s.x - (m.x + m.w) < 9 + (this.opts.error >> 1) && s.x + s.w > m.x,
    );
    if (thrower) {
      if (thrower.x - (m.x + m.w) < 2 + (this.opts.error >> 1)) held.push('left');
      else if (facing < 0) held.push('right');
      return held;
    }
    // A lantern above the way: stop under it to slash it (it holds ninpo or health).
    held.push('right');
    if (!ground) return held;
    // A wall ahead: jump at it (the cling and the kicks do the rest).
    if (this.solidAt(world, m.x + m.w + 2, m.feet - 8)) {
      held.push('jump');
      return held;
    }
    // A pit ahead: jump it.
    const pitAhead = scene.layout.pits.some((c) => {
      const left = c * 16;
      return left - (m.x + m.w) <= 6 + (this.opts.error >> 1) && left + 16 > m.x;
    });
    if (pitAhead) held.push('jump');
    return held;
  }

  /* ---------- The Masked Ninja ---------- */

  private fight(scene: DuelScene, seen: Seen[]): Action[] {
    const p = scene.player;
    const m = this.me(scene);
    const held: Action[] = [];
    const boss = seen.find((s) => s.kind === 'masked-ninja');
    if (!boss) return held;
    const roomL = (scene.layout.roomX + 1) * 16;
    const roomR = (scene.layout.roomX + 15) * 16;
    const move = (d: -1 | 1) => held.push(d > 0 ? 'right' : 'left');
    const bcx = boss.x + boss.w / 2;
    const toBoss: -1 | 1 = bcx < m.cx ? -1 : 1;
    const gap = toBoss > 0 ? boss.x - (m.x + m.w) : m.x - (boss.x + boss.w);
    const two = scene.life.hp <= PHASE_TWO_HP;
    if (!p.body.onGround) {
      // Mid-jump over a dash: straight up, then (once he is past) drift away from him.
      const past =
        boss.state !== 'crouch' &&
        (boss.state !== 'dash' || (boss.dx > 0 ? boss.x > m.cx : boss.x + boss.w < m.cx));
      const away: -1 | 1 = bcx < m.cx ? 1 : -1;
      // (never into a wall: holding toward one in the air would cling to it)
      const wall = away < 0 ? m.x < roomL + 10 : m.x + m.w > roomR - 10;
      if (past && !wall && Math.abs(bcx - m.cx) < 56) move(away);
      return held;
    }
    // The dash: jump it, timed so he (and his afterimage) pass under.
    if (boss.state === 'crouch' || boss.state === 'dash') {
      const speed = (two ? DASH_SPEED_2 : DASH_SPEED) / 4096;
      // (frames of crouch left, from what it saw; below zero the dash is already on its way)
      const left = boss.state === 'crouch' ? CROUCH_FRAMES - boss.t - this.opts.reaction : 0;
      const coming = boss.state === 'crouch' || (boss.dx > 0 ? boss.x < m.cx : boss.x > m.cx);
      if (coming) {
        if (this.slipFor !== boss.id * 1000 + scene.life.hp) {
          this.slipFor = boss.id * 1000 + scene.life.hp;
          const e = Math.round((this.opts.error * this.learn) / 3);
          this.slip = e ? this.rng.int(2 * e + 1) - e : 0;
        }
        const arrive = left + Math.max(0, gap) / speed - (boss.state === 'dash' ? this.opts.reaction : 0);
        const target = (two ? 15 : 14) + this.slip;
        if (arrive <= target) held.push('jump');
        else if (boss.state === 'crouch' && gap < 20) move(-toBoss as -1 | 1);
        return held;
      }
    }
    // Stars in the blade's reach: slash them away.
    for (const s of seen) {
      if (s.kind !== 'ninja-star') continue;
      const dir: -1 | 1 = s.x + 4 < m.cx ? -1 : 1;
      if (this.inSlash(scene, s, dir, SHOT_SLACK, WIND_UP)) {
        if (p.facing === dir && p.attackTimer === 0) held.push('attack');
        else move(dir);
        return held;
      }
    }
    // He runs up his wall and throws stars: out to a post well across the room, facing him (to
    // slash the stars). His mask glints (the dive is coming): walk on away from his wall (the
    // dive comes down where Ryu stood).
    if (ROAMING.has(boss.state)) {
      const away: -1 | 1 = bcx < (roomL + roomR) / 2 ? 1 : -1;
      if (boss.state === 'aim' || boss.state === 'dive') {
        const end = away > 0 ? m.x + m.w >= roomR - 2 : m.x <= roomL + 2;
        if (!end) move(away);
        return held;
      }
      const post = away > 0 ? roomL + POST : roomR - POST;
      if (Math.abs(m.cx - post) > 6) move(m.cx < post ? 1 : -1);
      else if (p.facing === away) move(-away as -1 | 1);
      return held;
    }
    // The afterimage still running: keep clear of it.
    const ghost = seen.find((s) => s.kind === 'afterimage' && s.live);
    if (ghost && Math.abs(ghost.x + 7 - m.cx) < 40) {
      move(ghost.x + 7 < m.cx ? 1 : -1);
      return held;
    }
    // He stands, kneels or turns: in to blade's reach and slash.
    if (gap > REACH - 3) {
      move(toBoss);
      return held;
    }
    if (gap < 2 + (this.opts.error >> 1)) {
      // Too close: step back, or (cornered) jump over him.
      const back: -1 | 1 = -toBoss as -1 | 1;
      const cornered = back < 0 ? m.x < roomL + 4 : m.x + m.w > roomR - 4;
      if (cornered) held.push('jump');
      move(cornered ? toBoss : back);
      return held;
    }
    if (p.facing !== toBoss) {
      move(toBoss);
      return held;
    }
    if (p.attackTimer === 0) held.push('attack');
    return held;
  }

  /** Halves what is left of its misjudging (to a quarter); what it sees from now on is judged anew. */
  private learnMore(): void {
    this.learn = Math.max(0.25, this.learn * 0.5);
    this.offsets.clear();
  }
}
