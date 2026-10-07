import type { Action } from '@engine/input/actions';
import { Rng } from '@engine/rng';
import { GRAVITY, GUNS, JUMP_V, SPREAD_DEG, type Aim, type Commando } from './commando';
import { Falcon, type Thing } from './foes';
import type { Box, FoeShot, Jungle } from './jungle';
import { LARVA_LEAP, LARVA_LEAP_VX, LARVA_LEAP_VY } from './boss';
import { WALL_X, WATER_Y, type WeaponId } from './stage';
import { LAIR_BACK } from './jungle';
import type { JungleScene } from './scene';

/*
 * A player for Jungle Assault, for tests and difficulty tuning: it runs right along the route
 * (jumping gaps and up onto the next tier, walking off ledges, wading the river and climbing
 * out), shoots whatever it can line up with Contra's aims (standing, up, the diagonals, prone, in
 * the air), stops to take out guns and to shoot capsules and open pillboxes for their falcons,
 * goes back or down (dropping through a ledge) for a falcon, and dodges: it looks ahead at
 * every bullet and foe it knows of and lies flat, jumps, steps back or ducks under the river as
 * a player would. At the wall it shoots the core while dodging shells and the sniper; in the
 * lair it shoots the heart and lies flat to shoot the larvae.
 *
 * With `BotOptions` it plays like a person: it notices things `reaction` frames late (a new
 * bullet is unknown to it until then), misjudges positions by up to `error` px, mistimes its
 * jumps by up to `error / 3` frames, and now and then stops for a moment.
 */

export interface BotOptions {
  /** Frames between something happening and the bot seeing it. */
  reaction: number;
  /** Most px by which it misjudges a position (and frames by a third of it, a jump's timing). */
  error: number;
  /** Chance a frame starts a pause (it lets go of everything for 10-30 frames). */
  pause: number;
  seed: number;
}

/** A sharp player: sees everything at once, judges exactly, never pauses. */
export const SHARP: BotOptions = { reaction: 0, error: 0, pause: 0, seed: 1 };
/** A careful first-timer (the human sim). */
export const CAUTIOUS: BotOptions = { reaction: 15, error: 6, pause: 0.004, seed: 1 };
/** A clumsier first-timer: slower, misjudges more, pauses more. */
export const CLUMSY: BotOptions = { reaction: 21, error: 10, pause: 0.01, seed: 1 };

/** Frames it looks ahead for danger. */
const HORIZON = 30;
/** How far ahead (px) it stops to deal with a gun or a pillbox. */
const ENGAGE = 150;

interface SeenThing {
  ref: Thing;
  kind: string;
  x: number;
  y: number;
  hurt: Box | null;
  harm: Box | null;
  /** Its motion over the last frame (px). */
  dx: number;
  dy: number;
}
interface SeenShot {
  ref: FoeShot;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  r: number;
}
interface Snapshot {
  things: SeenThing[];
  shots: SeenShot[];
}

/** A way of moving for the next frames: the d-pad and whether to press JUMP now. */
interface Move {
  name: string;
  dir: -1 | 0 | 1;
  down: boolean;
  jump: boolean;
}

export class JungleBot {
  private readonly opts: BotOptions;
  private readonly rng: Rng;
  private readonly history: Snapshot[] = [];
  private readonly offsets = new WeakMap<object, { x: number; y: number }>();
  /** Shots fired at a target since it last took a hit (a player re-judges after a few misses). */
  private readonly misses = new WeakMap<object, { n: number; hp: number }>();
  /** Things it stopped for too long without getting them: it walks on past them. */
  private readonly givenUp = new WeakSet<object>();
  private holdT = 0;
  /** Frames spent going after a falcon. */
  private chaseT = 0;
  /** The buttons it held last frame. */
  private lastHeld: Action[] = [];
  private pauseLeft = 0;
  private fireHeld = false;
  private jumpHeld = false;
  /** A planned jump waits this many more frames (a mistimed jump). */
  private jumpWait = -1;
  /** Frames since its furthest x grew (a stuck bot). */
  private still = 0;
  private best = 0;
  /** The bot went this long without progress in the stage (a stuck bot is not difficulty). */
  stuck = false;
  /** What it last dodged or what killed it (tests). */
  lastThreat = '';
  /** Phases of the round it reached (tests). */
  readonly reached = new Set<string>();
  /** It dropped through a ledge (tests). */
  drops = 0;

  constructor(opts: Partial<BotOptions> = {}) {
    this.opts = { ...SHARP, ...opts };
    this.rng = new Rng(this.opts.seed * 2654435761 + 17);
  }

  private offset(ref: object): { x: number; y: number } {
    let o = this.offsets.get(ref);
    if (!o) {
      const e = this.opts.error;
      o = { x: Math.round((this.rng.float() * 2 - 1) * e), y: Math.round((this.rng.float() * 2 - 1) * e) };
      this.offsets.set(ref, o);
    }
    return o;
  }

  private snapshot(j: Jungle): Snapshot {
    const prev = new Map((this.history.at(-1)?.things ?? []).map((s) => [s.ref, s]));
    const things: SeenThing[] = [];
    for (const t of j.things) {
      if (!t.alive || t.kind === 'boom' || t.kind === 'bridge' || t.shield) continue;
      const p = prev.get(t);
      things.push({
        ref: t,
        kind: t.kind,
        x: t.x,
        y: t.y,
        hurt: t.hurtBox(),
        harm: t.harmBox(),
        dx: p ? t.x - p.x : 0,
        dy: p ? t.y - p.y : 0,
      });
    }
    const shots = j.foeShots
      .filter((s) => s.alive)
      .map((s) => ({ ref: s, x: s.x, y: s.y, vx: s.vx, vy: s.vy, g: s.g, r: s.kind === 'shell' ? 3 : 2 }));
    return { things, shots };
  }

  /** What it knows now: things as they were `reaction` frames ago (shots carried on to now). */
  private seen(): Snapshot {
    const d = Math.min(this.opts.reaction, this.history.length - 1);
    const old = this.history[this.history.length - 1 - d] as Snapshot;
    const things = old.things
      .filter((t) => t.ref.alive)
      .map((t) => {
        const o = this.offset(t.ref);
        const mv = (b: Box | null) => (b ? { x: b.x + o.x, y: b.y + o.y / 2, w: b.w, h: b.h } : null);
        return { ...t, x: t.x + o.x, hurt: mv(t.hurt), harm: mv(t.harm) };
      });
    const shots = old.shots
      .filter((s) => s.ref.alive)
      .map((s) => {
        const o = this.offset(s.ref);
        // A bullet seen `d` frames ago is judged to have flown on along its line since.
        const vx = s.vx;
        let { x, y, vy } = s;
        for (let i = 0; i < d; i++) {
          vy += s.g;
          x += vx;
          y += vy;
        }
        return { ...s, x: x + o.x / 3, y: y + o.y / 3, vx, vy };
      });
    return { things, shots };
  }

  next(scene: JungleScene): Action[] {
    if (scene.phase === 'card') return scene.phaseT % 2 === 0 ? ['jump'] : [];
    const j = scene.jungle;
    this.reached.add(j.phase);
    this.history.push(this.snapshot(j));
    if (this.history.length > this.opts.reaction + 2) this.history.shift();
    const b = j.bill;
    this.progress(j);
    if (!b.alive || j.phase === 'won' || j.phase === 'lost' || j.phase === 'breach') {
      this.jumpWait = -1;
      return this.release();
    }
    // A pause: a moment's hesitation, still holding UP or DOWN if it was (lying flat stays flat).
    if (this.pauseLeft > 0) {
      this.pauseLeft--;
      return this.hesitate();
    }
    if (this.opts.pause > 0 && this.rng.chance(this.opts.pause)) {
      this.pauseLeft = 10 + this.rng.int(21);
      return this.hesitate();
    }
    const view = this.seen();
    const nav = this.navigate(j, view);
    const move = this.choose(j, view, nav);
    this.lastHeld = this.act(j, view, move);
    return this.lastHeld;
  }

  /**
   * Misses: a player who keeps missing something judges it afresh (exactly, this time); one it
   * keeps missing even so, it gives up waiting for.
   */
  private judge(ref: Thing, fired: boolean): void {
    // (a moving foe it keeps shooting at: misses there are timing, not judgement)
    if (ref.kind === 'soldier' || ref.kind === 'larva' || ref.kind === 'capsule') return;
    const hp = (ref as unknown as { hp?: number }).hp ?? 0;
    const m = this.misses.get(ref) ?? { n: 0, hp };
    if (hp < m.hp) {
      m.n = 0;
      m.hp = hp;
    } else if (fired) m.n++;
    this.misses.set(ref, m);
    if (m.n === 8) this.offsets.set(ref, { x: 0, y: 0 });
    if (m.n >= 24) this.givenUp.add(ref);
  }

  /** A soldier or a larva coming at Bill from behind, on his level (he turns to shoot). */
  private behind(j: Jungle, view: Snapshot): boolean {
    const b = j.bill;
    if (b.state !== 'ground') return false;
    for (const t of view.things) {
      const dx = t.x - b.x;
      if (Math.abs(dx) >= 110 || Math.abs(t.y - b.y) >= 12) continue;
      // a soldier running at him from behind, or a larva crawling on the lair's floor (either
      // side: once he has turned to it, he stays turned until it is shot)
      if (t.kind === 'soldier' && dx * b.facing < 0 && t.dx * dx < 0) return true;
      if (t.kind === 'larva' && Math.abs(t.dy) < 0.01) return true;
    }
    return false;
  }

  private hesitate(): Action[] {
    this.fireHeld = false;
    this.jumpHeld = false;
    return this.lastHeld.filter((a) => a === 'up' || a === 'down');
  }

  private release(): Action[] {
    this.fireHeld = false;
    this.jumpHeld = false;
    return [];
  }

  private progress(j: Jungle): void {
    if (j.phase !== 'stage') {
      this.still = 0;
      return;
    }
    if (j.bill.x > this.best + 1) {
      this.best = j.bill.x;
      this.still = 0;
    } else if (++this.still > 1800) this.stuck = true;
  }

  /* ---------- Where to go ---------- */

  /** The weapons it takes: anything, except that it keeps the spread gun (but takes R and B). */
  private wants(b: Commando, w: WeaponId): boolean {
    if (w === 'R') return !b.rapid;
    if (w === 'B') return true;
    if (b.gun === 'S') return false;
    return b.gun !== w;
  }

  /** The way it wants to go this frame (before dodging). */
  private navigate(j: Jungle, view: Snapshot): Move {
    const b = j.bill;
    const go = (dir: -1 | 0 | 1, name = 'go'): Move => ({ name, dir, down: false, jump: false });
    // Something coming up from behind: stop and turn to shoot it.
    if (this.behind(j, view)) return go(0, 'turn');
    if (j.phase === 'wall') return this.atWall(j, view);
    if (j.phase === 'lair') return this.inLair(j, view);
    // A falcon it wants: go and get it.
    const falcon = this.falconToGet(j, view);
    if (falcon && ++this.chaseT > 360) {
      this.givenUp.add(falcon.ref);
      this.chaseT = 0;
    }
    if (!falcon) this.chaseT = 0;
    if (falcon && this.chaseT > 0) {
      const dx = falcon.x - b.x;
      if (b.state === 'ground' && falcon.y > b.y + 8 && Math.abs(dx) < 6 && this.canDrop(j)) {
        this.drops++;
        return { name: 'drop', dir: 0, down: true, jump: true };
      }
      if (b.state === 'ground' && falcon.y < b.y - 8 && Math.abs(dx) < 20)
        return { name: 'up', dir: Math.sign(dx) as -1 | 0 | 1, down: false, jump: true };
      if (Math.abs(dx) > 3) return this.walk(j, Math.sign(dx) as -1 | 1, 'falcon');
    }
    // A pillbox on the ledge below: drop through to it.
    if (b.state === 'ground' && this.canDrop(j))
      for (const t of view.things) {
        if (t.kind !== 'pillbox' || this.givenUp.has(t.ref)) continue;
        const dx = t.x - b.x;
        if (t.y > b.y + 8 && t.y - b.y <= 40 && dx > 40 && dx < 72) {
          this.drops++;
          return { name: 'drop', dir: 0, down: true, jump: true };
        }
      }
    // On a bridge that is blowing up (or about to): run.
    if (this.onBridge(j)) return this.walk(j, 1, 'bridge');
    // A gun, a pillbox or a capsule worth stopping for (not for ever).
    if (this.holdFor(j, view)) {
      if (++this.holdT > 600) {
        for (const t of view.things) if (Math.abs(t.x - b.x) < ENGAGE + 100) this.givenUp.add(t.ref);
        this.holdT = 0;
      }
      return go(0, 'hold');
    }
    this.holdT = 0;
    if (j.phase === 'walk' || j.phase === 'stage') return this.walk(j, 1, 'route');
    return go(0);
  }

  /** Walking `dir`, with the jumps the ground ahead calls for. */
  private walk(j: Jungle, dir: -1 | 1, name: string): Move {
    const b = j.bill;
    const m: Move = { name, dir, down: false, jump: false };
    if (b.state !== 'ground') return m;
    const err = this.opts.error;
    if (j.floorKindAt(b.x + dir * 6, b.y) !== null) {
      this.jumpWait = -1;
      return m;
    }
    // The floor ends: a gap to jump, a tier above to jump onto, or a drop (walk on off it).
    let jump = false;
    for (let d = 10; d <= 36; d += 2) if (j.floorKindAt(b.x + dir * d, b.y) !== null) jump = true;
    const end = this.floorEnd(j, b.x, b.y, dir);
    for (let x = b.x - 8; x !== b.x + dir * 40 && !jump; x += dir * 2) {
      if (j.floorKindAt(x, b.y - 32) === null) continue;
      if (dir > 0 ? this.floorEnd(j, x, b.y - 32, 1) > end + 8 : true) jump = true;
    }
    if (!jump) return m;
    // A mistimed jump: it walks on a moment before jumping (or off the edge).
    if (this.jumpWait < 0) this.jumpWait = err > 0 ? this.rng.int(Math.max(1, Math.round(err / 3)) + 1) : 0;
    if (this.jumpWait > 0) {
      this.jumpWait--;
      return m;
    }
    this.jumpWait = -1;
    return { ...m, jump: true };
  }

  /** The x (px) where the floor at height y under x ends going `dir`. */
  private floorEnd(j: Jungle, x: number, y: number, dir: -1 | 1): number {
    let e = x;
    while (j.floorKindAt(e + dir * 2, y) !== null && Math.abs(e - x) < 600) e += dir * 2;
    return e;
  }

  private canDrop(j: Jungle): boolean {
    const b = j.bill;
    const k = j.floorKindAt(b.x, b.y);
    return (k === 1 || k === 6) && j.floorBelow(b.x, b.y) !== null;
  }

  private onBridge(j: Jungle): boolean {
    const b = j.bill;
    for (const t of j.things)
      if (t.kind === 'bridge') {
        const x0 = t.x;
        const x1 = t.x + (t as unknown as { len: number }).len * 16;
        if (b.x > x0 - 24 && b.x < x1 + 4 && Math.abs(b.y - t.y + 16) < 40) return true;
      }
    return false;
  }

  private falconToGet(j: Jungle, view: Snapshot): SeenThing | null {
    const b = j.bill;
    let best: SeenThing | null = null;
    for (const t of view.things) {
      if (t.kind !== 'falcon' || !(t.ref instanceof Falcon)) continue;
      if (!this.wants(b, t.ref.weapon)) continue;
      if (t.x < j.camX + 8 || t.x > j.camX + 248) continue;
      // Only one it can reach: on its tier, one below (a drop) or one above (a jump).
      if (this.givenUp.has(t.ref)) continue;
      // (one jump up at most: 32 px; or down any way)
      if (t.y < b.y - 36 || t.y - b.y > 72) continue;
      if (b.state === 'water' && t.y < WATER_Y - 2) continue;
      if (!best || Math.abs(t.x - b.x) < Math.abs(best.x - b.x)) best = t;
    }
    return best;
  }

  /** Something ahead worth stopping for: a gun or shooter in range, a pillbox or capsule with a falcon it wants. */
  private holdFor(j: Jungle, view: Snapshot): boolean {
    const b = j.bill;
    if (b.state === 'air') return false;
    for (const t of view.things) {
      const dx = t.x - b.x;
      if (dx < -16 || dx > ENGAGE || t.x > j.camX + 240 || this.givenUp.has(t.ref)) continue;
      switch (t.kind) {
        case 'wall-gun':
        case 'cannon':
          if (t.hurt && this.aimAt(j, t.hurt, this.standAims(b), view)) return true;
          break;
        case 'pillbox': {
          // (only from where it can shoot it once it opens)
          const open = { x: t.x - 14, y: t.y - 30, w: 28, h: 28 };
          if (dx > 40 && this.aimAt(j, open, this.standAims(b), view)) return true;
          break;
        }
      }
    }
    // A capsule anywhere on screen (they fly in from behind): wait and shoot it down. Like a
    // player, it cannot tell what a capsule or a pillbox holds until the falcon is out.
    for (const t of view.things)
      if (t.kind === 'capsule' && t.x >= j.camX + 8 && t.x <= j.camX + 248 && !this.givenUp.has(t.ref))
        return true;
    return false;
  }

  /** The defense wall: hold at a distance from the core, shooting it. */
  private atWall(j: Jungle, _view: Snapshot): Move {
    const b = j.bill;
    const spot = WALL_X - 72;
    if (b.x < spot - 6) return this.walk(j, 1, 'wall');
    if (b.x > spot + 6) return this.walk(j, -1, 'wall');
    return { name: 'wall', dir: 0, down: false, jump: false };
  }

  /** The lair: hold between the mouths, shooting the heart. */
  private inLair(j: Jungle, _view: Snapshot): Move {
    const b = j.bill;
    const spot = LAIR_BACK - 6;
    if (b.x < spot - 6) return this.walk(j, 1, 'lair');
    if (b.x > spot + 6) return this.walk(j, -1, 'lair');
    return { name: 'lair', dir: 0, down: false, jump: false };
  }

  /* ---------- Dodging ---------- */

  /** Bill's hit box `k` frames on under `m` (null: nothing can touch him then). */
  private futureBox(j: Jungle, m: Move, k: number): Box | null {
    const b = j.bill;
    if (b.state === 'water') {
      if (m.down) return null;
      const x = b.x + m.dir * k;
      return { x: x - 5, y: WATER_Y - 9, w: 10, h: 9 };
    }
    if (b.state === 'air') {
      let y = b.y;
      let vy = b.vy;
      for (let i = 0; i < k; i++) {
        vy = Math.min(4, vy + GRAVITY);
        y += vy;
      }
      y = Math.min(y, this.landing(j, b.x, b.y));
      const x = b.x + m.dir * k;
      return b.spin ? { x: x - 6, y: y - 18, w: 12, h: 14 } : { x: x - 5, y: y - 24, w: 10, h: 24 };
    }
    if (m.jump && !m.down) {
      const t = Math.min(k, 40);
      const y = Math.min(b.y, b.y - JUMP_V * t + GRAVITY * 0.5 * t * (t + 1));
      const x = b.x + m.dir * k;
      return { x: x - 6, y: y - 18, w: 12, h: 14 };
    }
    if (m.down && m.dir === 0) return { x: b.x - 11, y: b.y - 8, w: 22, h: 8 };
    const x = b.x + m.dir * k;
    return { x: x - 5, y: b.y - 24, w: 10, h: 24 };
  }

  private landing(j: Jungle, x: number, y: number): number {
    return j.floorBetween(x, y, 400, null) ?? WATER_Y + 14;
  }

  /** The first frame (1..HORIZON) something it knows of would touch Bill under `m`, or Infinity. */
  private firstHit(j: Jungle, view: Snapshot, m: Move): { k: number; what: string } {
    const slack = 1 + Math.round(this.opts.error / 4);
    for (let k = 1; k <= HORIZON; k++) {
      const box = this.futureBox(j, m, k);
      if (!box) continue;
      const me = { x: box.x - slack, y: box.y - slack, w: box.w + 2 * slack, h: box.h + 2 * slack };
      for (const s of view.shots) {
        let x = s.x;
        let y = s.y;
        let vy = s.vy;
        for (let i = 0; i < k; i++) {
          vy += s.g;
          x += s.vx;
          y += vy;
        }
        if (s.g > 0 && y > 190) continue;
        if (overlap(me, { x: x - s.r, y: y - s.r, w: 2 * s.r, h: 2 * s.r })) return { k, what: 'bullet' };
      }
      for (const t of view.things) {
        if (!t.harm) continue;
        const h = t.harm;
        let at = h;
        if (t.kind === 'soldier') at = { x: h.x + t.dx * k, y: h.y + t.dy * k, w: h.w, h: h.h };
        else if (t.kind === 'larva') at = this.larvaAt(j, t, h, k);
        if (overlap(me, at)) return { k, what: t.kind };
      }
    }
    return { k: Infinity, what: '' };
  }

  /** Where a larva's box will be in `k` frames: crawling, or leaping once it is near Bill. */
  private larvaAt(j: Jungle, t: SeenThing, h: Box, k: number): Box {
    const b = j.bill;
    const toward = b.x < t.x ? -1 : 1;
    const onFloor = Math.abs(t.dy) < 0.01;
    if (onFloor && Math.abs(b.x - t.x) < LARVA_LEAP + 8) {
      const y = -LARVA_LEAP_VY * k + 0.075 * k * (k + 1);
      return { x: h.x + toward * LARVA_LEAP_VX * k, y: h.y + Math.min(0, y), w: h.w, h: h.h };
    }
    if (onFloor) return { x: h.x + toward * 0.5 * k, y: h.y, w: h.w, h: h.h };
    return { x: h.x + t.dx * k, y: Math.min(h.y + t.dy * k + 0.075 * k * k, 198), w: h.w, h: h.h };
  }

  /** The way to move: the plan if it is safe, else the safest way out. */
  private choose(j: Jungle, view: Snapshot, nav: Move): Move {
    const b = j.bill;
    if (nav.name === 'drop') return nav;
    if (b.untouchable && b.state !== 'water') return nav;
    const plan = this.firstHit(j, view, nav);
    if (plan.k > HORIZON) return nav;
    // Turning to shoot what is coming up behind: stand and fight while there is time.
    if (nav.name === 'turn' && (plan.what === 'larva' || plan.what === 'soldier') && plan.k > 12) return nav;
    const opts: Move[] = [];
    const fwd = (nav.dir || 1) as -1 | 1;
    if (b.state === 'water') opts.push({ name: 'dive', dir: 0, down: true, jump: false });
    else if (b.state === 'ground') {
      opts.push({ name: 'prone', dir: 0, down: true, jump: false });
      opts.push({ name: 'stand', dir: 0, down: false, jump: false });
      opts.push({ name: 'jump', dir: fwd, down: false, jump: true });
      opts.push({ name: 'jump-up', dir: 0, down: false, jump: true });
      opts.push({ name: 'back', dir: -fwd as -1 | 1, down: false, jump: false });
      opts.push({ name: 'jump-back', dir: -fwd as -1 | 1, down: false, jump: true });
      opts.push({ name: 'on', dir: fwd, down: false, jump: false });
    } else {
      opts.push({ name: 'steer-back', dir: -fwd as -1 | 1, down: false, jump: false });
      opts.push({ name: 'steer-still', dir: 0, down: false, jump: false });
      opts.push({ name: 'steer-on', dir: fwd, down: false, jump: false });
    }
    let best = nav;
    let bestK = plan.k;
    for (const o of opts) {
      // Jumping needs the button let go first (and never off a bridge it can't trust).
      if (o.jump && this.jumpHeld) continue;
      if (o.name === 'back' && b.x < j.camX + 20) continue;
      const k = this.firstHit(j, view, o).k;
      if (k > bestK) {
        best = o;
        bestK = k;
      }
      if (k > HORIZON) break;
    }
    if (best !== nav) this.lastThreat = `${plan.what}: ${best.name}`;
    else this.lastThreat = plan.what;
    return best;
  }

  /* ---------- Shooting ---------- */

  /** The aims it can use while standing still on the ground: ahead, behind, straight up. */
  private standAims(b: Commando): Aim[] {
    return [
      { x: b.facing, y: 0 },
      { x: -b.facing as -1 | 1, y: 0 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: -1 },
    ];
  }

  /** Whether a shot along `aim` from Bill (as he is now) would meet `box`. */
  private lineHits(j: Jungle, aim: Aim, box: Box, prone: boolean): boolean {
    const b = j.bill;
    const m = b.muzzle(aim, prone);
    const gun = GUNS[b.gun];
    const angles = b.gun === 'S' ? SPREAD_DEG.map((d) => (d * Math.PI) / 180) : [0];
    const base = Math.atan2(aim.y, aim.x);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    // (the shot's own half-size, less a pixel: only lines that really meet)
    const tol = b.gun === 'F' ? 6 : b.gun === 'S' ? 2 : b.gun === 'L' ? 3 : 1;
    for (const off of angles) {
      const a = base + off;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const t = (cx - m.x) * ux + (cy - m.y) * uy;
      if (t < 0 || t > 300 / (gun.speed / 3)) continue;
      const px = m.x + ux * t;
      const py = m.y + uy * t;
      if (px >= box.x - tol && px <= box.x + box.w + tol && py >= box.y - tol && py <= box.y + box.h + tol)
        if (!this.blocked(j, m.x, m.y, px, py)) return true;
    }
    return false;
  }

  /** Armour (the defense wall's face) between the muzzle and a point. */
  private blocked(j: Jungle, x0: number, y0: number, x1: number, y1: number): boolean {
    for (const t of j.things) {
      const a = t.alive && t.shield ? t.hurtBox() : null;
      if (!a) continue;
      for (let k = 0; k <= 16; k++) {
        const x = x0 + ((x1 - x0) * k) / 16;
        const y = y0 + ((y1 - y0) * k) / 16;
        if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return true;
      }
    }
    return false;
  }

  /** An aim among `aims` that meets `box`, or null. */
  private aimAt(j: Jungle, box: Box, aims: Aim[], _view: Snapshot, prone = false): Aim | null {
    for (const a of aims) if (this.lineHits(j, a, box, prone)) return a;
    return null;
  }

  /** The things to shoot, most urgent first. */
  private targets(j: Jungle, view: Snapshot): SeenThing[] {
    const b = j.bill;
    const rank = (t: SeenThing): number => {
      switch (t.kind) {
        case 'soldier':
        case 'larva':
          return 0;
        case 'rifleman':
        case 'sniper':
        case 'wall-gun':
        case 'cannon':
        case 'wall-cannon':
          return 1;
        case 'capsule':
        case 'pillbox':
          return 2;
        case 'core':
        case 'heart':
        case 'pod':
          return 3;
        default:
          return 9;
      }
    };
    return view.things
      .filter(
        (t) => t.hurt && rank(t) < 9 && t.x > j.camX - 8 && t.x < j.camX + 264 && !this.givenUp.has(t.ref),
      )
      .sort((a, c) => rank(a) - rank(c) || Math.abs(a.x - b.x) - Math.abs(c.x - b.x));
  }

  /** The buttons for `m`, with the aim and FIRE for the best target in line. */
  private act(j: Jungle, view: Snapshot, m: Move): Action[] {
    const b = j.bill;
    let up = false;
    let down = m.down;
    let dir = m.dir;
    let fire = false;
    const proneNow = b.state === 'ground' && down && dir === 0;
    // The aims this way of moving allows (Contra's rules), and the d-pad for each.
    // (`turn`: a step round this frame, to lie flat facing the other way the next)
    const choices: { aim: Aim; up: boolean; down: boolean; dir: -1 | 0 | 1; turn?: boolean }[] = [];
    const back = -b.facing as -1 | 1;
    if (b.state === 'water') {
      if (!m.down) {
        choices.push({ aim: { x: dir || b.facing, y: 0 }, up: false, down: false, dir });
        choices.push({ aim: { x: dir || b.facing, y: -1 }, up: true, down: false, dir: dir || b.facing });
        choices.push({ aim: { x: 0, y: -1 }, up: true, down: false, dir: 0 });
      }
    } else if (b.state === 'air' || m.jump) {
      const d = dir;
      const f = (d || b.facing) as -1 | 1;
      choices.push({ aim: { x: f, y: 0 }, up: false, down: false, dir: d });
      choices.push({ aim: { x: d, y: -1 }, up: true, down: false, dir: d });
      if (!m.jump) choices.push({ aim: { x: d, y: 1 }, up: false, down: true, dir: d });
    } else if (proneNow) {
      choices.push({ aim: { x: b.facing, y: 0 }, up: false, down: true, dir: 0 });
      choices.push({ aim: { x: back, y: 0 }, up: false, down: true, dir: back, turn: true });
    } else if (dir === 0) {
      choices.push({ aim: { x: b.facing, y: 0 }, up: false, down: false, dir: 0 });
      choices.push({ aim: { x: 0, y: -1 }, up: true, down: false, dir: 0 });
      // Lying flat for something low ahead (larvae).
      choices.push({ aim: { x: b.facing, y: 0 }, up: false, down: true, dir: 0 });
      // Turning (a step) for something behind, or a step to aim diagonally.
      choices.push({
        aim: { x: -b.facing as -1 | 1, y: 0 },
        up: false,
        down: false,
        dir: -b.facing as -1 | 1,
      });
      choices.push({ aim: { x: b.facing, y: -1 }, up: true, down: false, dir: b.facing });
      choices.push({
        aim: { x: -b.facing as -1 | 1, y: -1 },
        up: true,
        down: false,
        dir: -b.facing as -1 | 1,
      });
      choices.push({ aim: { x: back, y: 0 }, up: false, down: true, dir: back, turn: true });
      choices.push({ aim: { x: b.facing, y: 1 }, up: false, down: true, dir: b.facing });
      choices.push({ aim: { x: back, y: 1 }, up: false, down: true, dir: back });
    } else {
      choices.push({ aim: { x: dir, y: 0 }, up: false, down: false, dir });
      choices.push({ aim: { x: dir, y: -1 }, up: true, down: false, dir });
      choices.push({ aim: { x: dir, y: 1 }, up: false, down: true, dir });
    }
    let chosen: (typeof choices)[number] | null = null;
    let target: SeenThing | null = null;
    const safeK = this.firstHit(j, view, m).k;
    for (const t of this.targets(j, view)) {
      target = t;
      for (const c of choices) {
        const prone = b.state === 'ground' && c.down && (c.dir === 0 || !!c.turn);
        if (t.hurt && this.lineHits(j, c.aim, t.hurt, prone)) {
          // A change of stance to aim is fine only when it is no less safe.
          // (shooting the very thing coming at him is his way out: no veto there)
          const threat = t.kind === 'soldier' || t.kind === 'larva';
          if (!threat && (c.dir !== m.dir || c.down !== m.down || c.turn)) {
            const alt: Move = c.turn ? { ...m, dir: 0, down: true } : { ...m, dir: c.dir, down: c.down };
            if (this.firstHit(j, view, alt).k < Math.min(safeK, HORIZON + 1)) continue;
          }
          chosen = c;
          break;
        }
      }
      if (chosen) break;
    }
    if (!chosen) target = null;
    if (chosen) {
      up = chosen.up;
      down = chosen.down;
      dir = chosen.dir;
      fire = true;
      if (chosen.turn) {
        down = false;
        fire = false;
      }
    }
    // Never hold DOWN on a jump press it means as a jump (that would drop through the ledge).
    if (m.jump && m.name !== 'drop') down = false;
    const out: Action[] = [];
    if (dir < 0) out.push('left');
    if (dir > 0) out.push('right');
    if (up) out.push('up');
    if (down) out.push('down');
    const auto = GUNS[b.gun].auto > 0;
    // A new laser beam cancels the one still out: wait for it.
    if (b.gun === 'L' && j.shots.some((s) => s.alive)) fire = false;
    if (fire && target) this.judge(target.ref, b.sinceShot === 0);
    if (fire) {
      if (auto) {
        out.push('attack');
        this.fireHeld = true;
      } else {
        // Mashing FIRE: a press every other frame (the gun's own gap paces it).
        if (!this.fireHeld) out.push('attack');
        this.fireHeld = !this.fireHeld;
      }
    } else this.fireHeld = false;
    if (m.jump && !this.jumpHeld) {
      out.push('jump');
      this.jumpHeld = true;
    } else this.jumpHeld = false;
    return out;
  }
}

function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
