import type { InputFrame } from '@engine/input/input-manager';
import { px, sign, velToSub } from '@engine/math/units';
import { JUMP_BUFFER_FRAMES } from '../constants';
import { pickJumpTier, type JumpTier, type MovementProfile } from '../characters/profile';
import { makeBody, moveX, moveY, type Body } from './body';
import type { TileMap } from '../world/tilemap';

export interface PlayerHitbox {
  w: number;
  h: number;
}

/**
 * Shared player movement. Character-specific behaviour (attacks, damage) hangs off this in
 * later phases through CharacterBehaviour; the movement itself is data-driven by the profile.
 */
export class Player {
  readonly body: Body;
  facing: -1 | 1 = 1;
  profile: MovementProfile;
  private runTimer = 0;
  private tier: JumpTier;
  /** Air speed cap chosen at takeoff (SMB1 rule). */
  private airCap: number;
  private sinceGround = 0;
  jumping = false;
  skidding = false;
  crouching = false;
  /** Frames since the player became airborne via a jump (used by sprites). */
  frame = 0;
  /** When true the player is frozen (pipes, death, level clear animations). */
  frozen = false;

  constructor(x: number, y: number, hitbox: PlayerHitbox, profile: MovementProfile) {
    this.body = makeBody(x, y, hitbox.w, hitbox.h);
    this.profile = profile;
    this.tier = profile.jump[0] as JumpTier;
    this.airCap = profile.maxWalk;
  }

  setHitbox(hb: PlayerHitbox): void {
    const b = this.body;
    const bottom = b.y + b.h;
    b.w = px(hb.w);
    b.h = px(hb.h);
    b.y = bottom - b.h;
  }

  update(input: InputFrame, map: TileMap, onHeadBump?: (tx: number, ty: number) => void): void {
    this.frame++;
    if (this.frozen) return;
    const p = this.profile;
    const b = this.body;
    const dir = input.dirX;
    const wantRun = p.canRun && input.held('attack');
    if (wantRun) this.runTimer = p.runTimerFrames;
    else if (this.runTimer > 0) this.runTimer--;
    const running = wantRun || this.runTimer > 0;
    this.skidding = false;

    if (b.onGround) {
      this.sinceGround = 0;
      this.groundMove(dir, running);
    } else {
      this.sinceGround++;
      this.airMove(dir);
    }

    // Jump: from the ground, or within the coyote window (assist), using the jump buffer.
    const canJump = b.onGround || (this.sinceGround <= p.coyoteFrames && !this.jumping && b.vy >= 0);
    if (canJump && input.bufferedJump(JUMP_BUFFER_FRAMES)) {
      input.consumeJumpBuffer();
      this.tier = pickJumpTier(p, b.vx);
      b.vy = -this.tier.initial;
      b.onGround = false;
      this.jumping = true;
      this.airCap = Math.abs(b.vx) >= p.maxWalk ? p.maxRun : p.maxWalk;
    }

    // Gravity. Hold-to-rise uses the tier's hold gravity; 'cut' kills upward speed on release.
    if (!b.onGround) {
      if (p.variableJump === 'cut' && this.jumping && b.vy < 0 && !input.held('jump')) b.vy = 0;
      const holding = p.variableJump === true && this.jumping && input.held('jump') && b.vy < 0;
      b.vy += holding ? this.tier.holdGravity : this.tier.fallGravity;
      if (b.vy > p.maxFall) b.vy = p.fallReset;
    } else {
      // Walking off a ledge: pick a tier for the fall gravity from the current speed.
      this.tier = pickJumpTier(p, b.vx);
      this.jumping = false;
      b.vy = 0;
    }

    if (b.vx !== 0) this.facing = sign(b.vx) as -1 | 1;
    else if (dir !== 0) this.facing = dir;

    moveX(b, map, velToSub(b.vx));
    // Probe downward at least one subpixel so standing on ground keeps onGround true.
    const dy = b.onGround ? Math.max(velToSub(b.vy), 1) : velToSub(b.vy);
    const opts = onHeadBump ? { onHeadBump } : {};
    moveY(b, map, dy, opts);
    if (b.onGround) this.jumping = false;
  }

  private groundMove(dir: -1 | 0 | 1, running: boolean): void {
    const p = this.profile;
    const b = this.body;
    const cap = running ? p.maxRun : p.maxWalk;
    if (p.instantAccel) {
      b.vx = dir * p.maxWalk;
      return;
    }
    if (dir === 0) {
      // Release: decelerate to a stop.
      const s = sign(b.vx);
      const a = Math.abs(b.vx) - p.releaseDecel;
      b.vx = a < p.minWalk ? 0 : s * a;
      return;
    }
    if (b.vx === 0) b.vx = dir * p.minWalk;
    else if (sign(b.vx) !== dir) {
      // Skid against the current motion.
      this.skidding = true;
      const s = sign(b.vx);
      const a = Math.abs(b.vx) - p.skidDecel;
      b.vx = a <= p.skidTurnaround ? dir * p.minWalk : s * a;
      return;
    }
    const accel = running ? p.runAccel : p.walkAccel;
    let a = Math.abs(b.vx) + accel;
    if (a > cap) a = Math.max(cap, Math.abs(b.vx) - p.releaseDecel); // ease down to the cap
    b.vx = dir * a;
  }

  private airMove(dir: -1 | 0 | 1): void {
    const p = this.profile;
    const b = this.body;
    if (p.airControl === 'none' || dir === 0) return;
    if (p.instantAccel) {
      b.vx = dir * p.maxWalk;
      return;
    }
    const cap = p.airControl === 'smb1' ? this.airCap : p.maxRun;
    const accel = Math.abs(b.vx) >= p.maxWalk ? p.runAccel : p.walkAccel;
    if (b.vx === 0) b.vx = dir * p.minWalk;
    else if (sign(b.vx) !== dir) {
      // Turning in the air: no skid, just accelerate against the motion.
      b.vx += dir * accel;
    } else {
      const a = Math.min(Math.abs(b.vx) + accel, Math.max(cap, Math.abs(b.vx)));
      b.vx = dir * a;
    }
  }
}
