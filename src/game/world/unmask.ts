import { px, tileAt, tileToSub, velToSub } from '@engine/math/units';
import type { Bowser } from '../entities/enemies/bowser';
import type { Axe } from '../entities/objects/axe';
import type { Player } from '../entities/player';
import type { World } from './world';

/*
 * The fake Bowsers' unmasking scenes (docs/STORY.md 2.3a, 0.4.23; campaign only, castles 1-4 to
 * 7-4: World.unmaskOnKill / World.unmaskAtAxe decide). Play holds while they run (the world
 * updates nothing else); the axe then drops the bridge as before (World.startBossClear), and the
 * true form falls with it (Bowser.fallDead).
 *
 * - `killed`: beaten with weapons or fire. The disguise has burst (Bowser.burst, dazed) and the
 *   creature drops onto the bridge; the hero runs up, jumps over it and walks on to the axe (up a
 *   step in the way, never through a wall: 0.4.43, 2-4's axe stands a step above the bridge), then
 *   turns to look at it and says the castle's remark, as at the axe.
 * - `axe`: the axe touched with the fake still standing. The disguise bursts anyway; the creature
 *   looks about; the hero turns to look at it and says the castle's remark (World.remarkHook: the
 *   card, the first time per castle per file), or just looks for a moment, turns back, and the
 *   axe goes.
 * - `fell`: the fake fell off the level (World.bowserFell) and the hero reached the axe: he looks
 *   back where it went and says the remark (0.4.43: his line plays however the fake died).
 *
 * In co-op the player nearer the axe acts; the other stands still.
 */

/** Frames the burst settles before the hero moves (`killed`). */
export const UNMASK_SETTLE = 30;
/** The hero's run toward the axe (px a frame) and the jump over the creature. */
const RUN_PX = 2;
const JUMP_FRAMES = 30;
/** `axe`: when the hero turns to look, when the remark comes, how long the look lasts after it. */
export const LOOK_AT = 24;
export const REMARK_AT = 36;
export const LOOK_AFTER = 30;
/** A run that never reaches the axe (a strange castle) ends here: the hero is put at the axe. */
const GIVE_UP = 900;

export type UnmaskKind = 'killed' | 'axe' | 'fell';

/** What the scene asks of the world when it is over: the axe to take, and who takes it. */
export interface UnmaskDone {
  axe: Axe;
  player: Player;
}

export class CastleUnmask {
  t = 0;
  /** `axe`: waiting for the remark card to close. */
  private waiting = false;
  /** `axe`: the frame the remark (or the plain look) ended. */
  private lookEnd = -1;
  /** `killed`: the jump over the creature, while in the air (landing at `y1`). */
  private jump: { t: number; x0: number; x1: number; y0: number; y1: number; h: number } | null = null;
  private jumped = false;
  /** The frame the look at the creature (and the remark) starts: at once but for `killed`. */
  private lookFrom: number;

  constructor(
    readonly kind: UnmaskKind,
    /** The fake (null for `fell`: it is gone). */
    readonly bowser: Bowser | null,
    readonly hero: Player,
    readonly axe: Axe,
    /** The castle's main level id ('1-4'), for the remark. */
    readonly level: string,
  ) {
    this.lookFrom = kind === 'killed' ? -1 : 0;
  }

  /** Freezes every player where it stands (the scene moves the hero itself). */
  start(world: World): void {
    for (const o of world.players) {
      o.frozen = true;
      o.stairs = null;
      o.body.vx = 0;
      o.body.vy = 0;
      // The fight is over: no hit blink, which would freeze on an off frame under the remark card.
      o.invuln = 0;
      if (!o.dead) o.anim = 'idle';
    }
    if (this.kind === 'axe') {
      this.hero.facing = 1;
      this.bowser?.burst(world, false);
    }
  }

  /** One frame. Returns what to do when it is over (the axe), else null. */
  update(world: World): UnmaskDone | null {
    this.t++;
    if (this.bowser?.alive) this.bowser.update(world);
    for (const e of world.entities) if (e.kind === 'wand-poof' && e.alive) e.update(world);
    if (this.lookFrom < 0) return this.updateKilled(world);
    return this.updateLook(world);
  }

  /**
   * The look and the remark (`axe`, `fell`, and `killed` once at the axe): the hero turns to the
   * creature (or where it fell), says the castle's line, turns back, and the axe goes.
   */
  private updateLook(world: World): UnmaskDone | null {
    const p = this.hero;
    const b = this.bowser?.alive ? this.bowser : null;
    const t = this.t - this.lookFrom;
    // The creature looks about, blinking at where the king's suit went.
    if (b && t < REMARK_AT && t % 12 === 6) b.facing = b.facing > 0 ? -1 : 1;
    if (t === LOOK_AT) p.facing = !b || b.body.x + (b.body.w >> 1) < p.body.x ? -1 : 1;
    if (t === REMARK_AT) {
      if (b) b.facing = -1;
      const done = () => {
        this.waiting = false;
        this.lookEnd = this.t;
      };
      this.waiting = world.remarkHook?.(this.level, p.def, done) === true;
      if (!this.waiting) this.lookEnd = this.t;
    }
    if (this.waiting || this.lookEnd < 0) return null;
    // Look a moment longer, turn back to the axe, then pull it.
    if (this.t === this.lookEnd + LOOK_AFTER) p.facing = 1;
    if (this.t >= this.lookEnd + LOOK_AFTER + 10) return { axe: this.axe, player: p };
    return null;
  }

  private updateKilled(world: World): UnmaskDone | null {
    const p = this.hero;
    const pb = p.body;
    if (this.t < UNMASK_SETTLE) return null;
    world.camera.follow(pb.x);
    if (this.t > GIVE_UP) {
      pb.x = this.axe.body.x - pb.w;
      return this.atAxe();
    }
    const j = this.jump;
    if (j) {
      // Over the creature in an arc, landing beyond it.
      j.t++;
      const k = Math.min(1, j.t / JUMP_FRAMES);
      pb.x = Math.round(j.x0 + (j.x1 - j.x0) * k);
      pb.y = Math.round(j.y0 + (j.y1 - j.y0) * k - j.h * 4 * k * (1 - k));
      p.anim = 'jump';
      pb.onGround = false;
      if (k >= 1) {
        this.jump = null;
        pb.y = j.y1;
        pb.onGround = true;
      }
    } else {
      p.facing = 1;
      p.anim = 'walk';
      if (this.t % 4 === 0) p.walkFrame = (p.walkFrame + 1) % 3;
      const b = (this.bowser as Bowser).body;
      const before = pb.x + pb.w < b.x + (b.w >> 1);
      if (!this.jumped && before && pb.x + pb.w >= b.x - px(10)) {
        // Take off: land a few pixels past the creature's far side (on a step there, if any).
        this.jumped = true;
        const x1 = b.x + b.w + px(4);
        this.jump = {
          t: 0,
          x0: pb.x,
          x1,
          y0: pb.y,
          y1: pb.y - liftOut(world, x1, pb.y, pb.w, pb.h),
          h: px((this.bowser?.standingHeight ?? 24) + 16),
        };
        world.audio.sfx('jump-small');
        return null;
      }
      walkStep(world, p, px(RUN_PX));
    }
    const a = this.axe.body;
    if (pb.x + pb.w >= a.x && pb.x <= a.x + a.w && !this.jump && !this.climbing(world)) return this.atAxe();
    return null;
  }

  /** `killed`: at the axe, standing. The look and the remark come next. */
  private atAxe(): null {
    this.hero.anim = 'idle';
    this.hero.body.onGround = true;
    this.lookFrom = this.t;
    return null;
  }

  /** The hero is mid-climb up a step (a solid tile just ahead of his feet, above the floor). */
  private climbing(world: World): boolean {
    const b = this.hero.body;
    return overlapsSolid(world, b.x + px(1), b.y, b.w, b.h);
  }
}

/** Whether a body at (x, y), w × h (subpixels), overlaps a solid tile. */
export function overlapsSolid(world: World, x: number, y: number, w: number, h: number): boolean {
  for (let ty = tileAt(y); ty <= tileAt(y + h - 1); ty++)
    for (let tx = tileAt(x); tx <= tileAt(x + w - 1); tx++) if (world.map.isSolid(tx, ty)) return true;
  return false;
}

/** How far a body at (x, y) must rise to be clear of solid tiles (0: clear; up to two tiles). */
function liftOut(world: World, x: number, y: number, w: number, h: number): number {
  for (let lift = 0; lift <= px(32); lift += px(1)) if (!overlapsSolid(world, x, y - lift, w, h)) return lift;
  return 0;
}

/**
 * One step of a scripted walk to the right (the run to the axe, the walk to Toad): on along the
 * floor (never into a pit), up onto a step in the way in a quick hop (two tiles at most), and never
 * into a wall (0.4.43: after the 2-4 fake, the walk went through the brick column).
 */
export function walkStep(world: World, p: Player, dx: number): void {
  const b = p.body;
  // Inside the ground (a landing short of a step): out, upward.
  const stuck = liftOut(world, b.x, b.y, b.w, b.h);
  if (stuck > 0) {
    b.y -= Math.min(stuck, px(4));
    b.vy = 0;
    return;
  }
  if (!overlapsSolid(world, b.x + dx, b.y, b.w, b.h)) {
    b.x += dx;
    settle(world, p);
    return;
  }
  // A step: up it, a few pixels a frame, then on. A wall: wait.
  const lift = liftOut(world, b.x + dx, b.y, b.w, b.h);
  if (lift === 0) return;
  b.y -= Math.min(lift, px(4));
  b.vy = 0;
  b.onGround = false;
  p.anim = 'jump';
}

/** Gravity for the run: the hero keeps to the floor, but never drops into a pit. */
export function settle(world: World, p: Player): void {
  const b = p.body;
  const from = tileAt(b.y + b.h);
  const groundAt = (col: number): number => {
    let row = from;
    while (row < world.level.height && !world.map.isSolid(col, row)) row++;
    return row;
  };
  if (groundAt(tileAt(b.x + (b.w >> 1))) >= world.level.height) return;
  // The highest floor under any part of him: off a ledge only once clear of it.
  const ground = Math.min(groundAt(tileAt(b.x)), groundAt(tileAt(b.x + b.w - 1)));
  const top = tileToSub(ground) - b.h;
  b.vy = Math.min(b.vy + 0x00400, 0x04000);
  b.y = Math.min(b.y + velToSub(b.vy), top);
  if (b.y === top) b.vy = 0;
}
