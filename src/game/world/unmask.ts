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
 * - `killed`: beaten with weapons. The disguise has burst (Bowser.burst, dazed) and the creature
 *   drops onto the bridge; the hero runs up, jumps over it and lands at the axe. No text.
 * - `axe`: the axe touched with the fake still standing. The disguise bursts anyway; the creature
 *   looks about; the hero turns to look at it and says the castle's remark (World.remarkHook: the
 *   card, the first time per castle per file), or just looks for a moment, turns back, and the
 *   axe goes.
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

export type UnmaskKind = 'killed' | 'axe';

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
  /** `killed`: the jump over the creature, while in the air. */
  private jump: { t: number; x0: number; x1: number; y0: number; h: number } | null = null;
  private jumped = false;

  constructor(
    readonly kind: UnmaskKind,
    readonly bowser: Bowser,
    readonly hero: Player,
    readonly axe: Axe,
    /** The castle's main level id ('1-4'), for the remark. */
    readonly level: string,
  ) {}

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
      this.bowser.burst(world, false);
    }
  }

  /** One frame. Returns what to do when it is over (the axe), else null. */
  update(world: World): UnmaskDone | null {
    this.t++;
    this.bowser.update(world);
    for (const e of world.entities) if (e.kind === 'wand-poof' && e.alive) e.update(world);
    return this.kind === 'killed' ? this.updateKilled(world) : this.updateAxe(world);
  }

  private updateAxe(world: World): UnmaskDone | null {
    const p = this.hero;
    const b = this.bowser;
    // The creature looks about, blinking at where the king's suit went.
    if (this.t < REMARK_AT && this.t % 12 === 6) b.facing = b.facing > 0 ? -1 : 1;
    if (this.t === LOOK_AT) p.facing = b.body.x + (b.body.w >> 1) < p.body.x ? -1 : 1;
    if (this.t === REMARK_AT) {
      b.facing = -1;
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
      return { axe: this.axe, player: p };
    }
    const j = this.jump;
    if (j) {
      // Over the creature in an arc, landing beyond it.
      j.t++;
      const k = Math.min(1, j.t / JUMP_FRAMES);
      pb.x = Math.round(j.x0 + (j.x1 - j.x0) * k);
      pb.y = Math.round(j.y0 - j.h * 4 * k * (1 - k));
      p.anim = 'jump';
      pb.onGround = false;
      if (k >= 1) {
        this.jump = null;
        pb.y = j.y0;
        pb.onGround = true;
      }
    } else {
      p.facing = 1;
      p.anim = 'walk';
      if (this.t % 4 === 0) p.walkFrame = (p.walkFrame + 1) % 3;
      const b = this.bowser.body;
      const before = pb.x + pb.w < b.x + (b.w >> 1);
      if (!this.jumped && before && pb.x + pb.w >= b.x - px(10)) {
        // Take off: land a few pixels past the creature's far side.
        this.jumped = true;
        this.jump = {
          t: 0,
          x0: pb.x,
          x1: b.x + b.w + px(4),
          y0: pb.y,
          h: px(this.bowser.standingHeight + 16),
        };
        world.audio.sfx('jump-small');
        return null;
      }
      pb.x += px(RUN_PX);
      settle(world, p);
    }
    const a = this.axe.body;
    if (pb.x + pb.w >= a.x && pb.x <= a.x + a.w && !this.jump) {
      p.anim = 'idle';
      return { axe: this.axe, player: p };
    }
    return null;
  }
}

/** Gravity for the run: the hero keeps to the floor, but never drops into a pit. */
function settle(world: World, p: Player): void {
  const b = p.body;
  const col = tileAt(b.x + (b.w >> 1));
  let ground = tileAt(b.y + b.h);
  while (ground < world.level.height && !world.map.isSolid(col, ground)) ground++;
  if (ground >= world.level.height) return;
  const top = tileToSub(ground) - b.h;
  b.vy = Math.min(b.vy + 0x00400, 0x04000);
  b.y = Math.min(b.y + velToSub(b.vy), top);
  if (b.y === top) b.vy = 0;
}
