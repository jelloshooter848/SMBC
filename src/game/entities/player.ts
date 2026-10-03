import type { InputFrame } from '@engine/input/input-manager';
import type { AABB } from '@engine/math/aabb';
import { px, sign, velToSub } from '@engine/math/units';
import { JUMP_BUFFER_FRAMES } from '../constants';
import { pickJumpTier, type JumpTier, type MovementProfile } from '../characters/profile';
import type { CharacterDef } from '../characters/character';
import { makeBody, moveX, moveY, type Body } from './body';
import type { TileMap } from '../world/tilemap';
import type { AudioSink } from '@engine/audio/audio-manager';

export type PlayerAnim =
  'idle' | 'walk' | 'skid' | 'jump' | 'crouch' | 'climb' | 'attack' | 'swim' | 'slide' | 'hurt';
export type Transition = { kind: 'grow' | 'shrink'; t: number };

export interface PlayerAudio {
  audio: AudioSink;
}

/**
 * The shared player: movement is driven by the character's MovementProfile, everything else
 * (power states, attacks, damage) by its CharacterDef/behaviour. Positions are subpixels.
 */
export class Player {
  readonly body: Body;
  facing: -1 | 1 = 1;
  profile: MovementProfile;
  def: CharacterDef;
  /** 'small' | 'big' | 'fire' for power-up characters; 'full' for hp characters. */
  powerState: string;
  hp: number;
  /** Frames of post-hit invulnerability (blinking). */
  invuln = 0;
  /** Frames of star power. */
  star = 0;
  dead = false;
  /** While set, the game is paused for the grow/shrink flicker. */
  transition: Transition | null = null;
  /** When true, input is ignored and physics skipped (pipes, flagpole, death). */
  frozen = false;
  anim: PlayerAnim = 'idle';
  walkFrame = 0;
  private walkTick = 0;
  attackTimer = 0;
  /** Melee hitbox published for the frames an attack is active. */
  activeMelee: AABB | null = null;
  /** Consecutive stomps without landing. */
  combo = 0;
  crouching = false;
  skidding = false;
  jumping = false;
  /** Sliding (Mega Man). */
  sliding = 0;
  /** Not drawn (walked into the castle). */
  hidden = false;
  /** Player slot (0 = player one). */
  index = 0;
  /** Eliminated for the rest of the level (co-op, no lives left). */
  out = false;
  /** Frames of knockback during which movement input is ignored. */
  stun = 0;
  /** Vertical speed before this frame's move (survives the landing reset; used for stomp checks). */
  fallSpeed = 0;
  private runTimer = 0;
  private tier: JumpTier;
  private airCap: number;
  private sinceGround = 0;
  /** Frames since spawn, for sprite timing. */
  frame = 0;
  /** Extra per-character scratch state (charge timers, etc.). */
  scratch: Record<string, number> = {};

  constructor(x: number, y: number, def: CharacterDef, powerState: string, hp: number) {
    this.def = def;
    this.profile = def.movement;
    this.powerState = powerState;
    this.hp = hp;
    const hb = def.hitbox(this);
    this.body = makeBody(x, y, hb.w, hb.h);
    this.tier = this.profile.jump[0] as JumpTier;
    this.airCap = this.profile.maxWalk;
  }

  /** Re-fit the hitbox to the current state, keeping the feet in place. */
  refitHitbox(): void {
    const hb = this.def.hitbox(this);
    const b = this.body;
    const bottom = b.y + b.h;
    b.w = px(hb.w);
    b.h = px(hb.h);
    b.y = bottom - b.h;
  }

  startTransition(kind: 'grow' | 'shrink'): void {
    this.transition = { kind, t: 0 };
    this.refitHitbox();
  }

  /** Advance a grow/shrink flicker. Returns true while it is still running. */
  tickTransition(): boolean {
    if (!this.transition) return false;
    this.transition.t++;
    if (this.transition.t >= 48) {
      this.transition = null;
      this.refitHitbox();
      return false;
    }
    return true;
  }

  update(
    input: InputFrame,
    map: TileMap,
    audio: AudioSink,
    onHeadBump?: (tx: number, ty: number) => void,
  ): void {
    this.frame++;
    if (this.invuln > 0) this.invuln--;
    if (this.star > 0) this.star--;
    if (this.attackTimer > 0) this.attackTimer--;
    if (this.frozen || this.dead) return;
    const p = this.profile;
    const b = this.body;
    let dir = input.dirX;
    const wantRun = p.canRun && input.held('attack');
    if (wantRun) this.runTimer = p.runTimerFrames;
    else if (this.runTimer > 0) this.runTimer--;
    const running = wantRun || this.runTimer > 0;
    this.skidding = false;

    // Crouching: only when tall enough and on the ground; can't walk while crouched.
    const canCrouch = this.def.crouches && (this.def.hitbox(this).h > 16 || this.crouching);
    const wantCrouch = input.held('down') && canCrouch && b.onGround && this.sliding === 0;
    if (wantCrouch !== this.crouching) {
      this.crouching = wantCrouch;
      this.refitHitbox();
    }
    if (this.crouching) dir = 0;

    if (this.stun > 0) {
      this.stun--;
      if (b.onGround) this.sinceGround = 0;
    } else if (this.sliding > 0) {
      this.sliding--;
      b.vx = this.facing * (p.slide?.speed ?? 0);
      if (this.sliding === 0 || b.hitWall !== 0) this.endSlide();
    } else if (b.onGround) {
      this.sinceGround = 0;
      this.groundMove(dir, running);
    } else {
      this.sinceGround++;
      this.airMove(dir);
    }

    const canJump =
      this.sliding === 0 &&
      (b.onGround || (this.sinceGround <= p.coyoteFrames && !this.jumping && b.vy >= 0));
    if (canJump && input.bufferedJump(JUMP_BUFFER_FRAMES)) {
      if (p.slide && input.held('down') && b.onGround) {
        input.consumeJumpBuffer();
        this.startSlide();
      } else {
        input.consumeJumpBuffer();
        this.tier = pickJumpTier(p, b.vx);
        b.vy = -this.tier.initial;
        b.onGround = false;
        this.jumping = true;
        // Only a genuine run (faster than the walk cap) keeps the run cap in the air; a jump at
        // exactly walking speed must not suddenly accelerate like a sprint.
        this.airCap = Math.abs(b.vx) > p.maxWalk ? p.maxRun : p.maxWalk;
        audio.sfx(this.def.jumpSfx(this));
      }
    }

    // Like the NES: the jump's full initial speed moves the body on the takeoff frame and gravity
    // is applied after the move. Applying gravity first shaved a frame off every jump (standing
    // apex 62 px instead of the 4 tiles SMB1 clears).
    if (!b.onGround && p.variableJump === 'cut' && this.jumping && b.vy < 0 && !input.held('jump')) b.vy = 0;
    const holding = p.variableJump === true && this.jumping && input.held('jump') && b.vy < 0;

    if (this.stun === 0) {
      if (b.vx !== 0 && this.sliding === 0) this.facing = sign(b.vx) as -1 | 1;
      else if (dir !== 0) this.facing = dir;
    }

    moveX(b, map, velToSub(b.vx));
    this.fallSpeed = b.onGround ? 0 : b.vy;
    const dy = b.onGround ? Math.max(velToSub(b.vy), 1) : velToSub(b.vy);
    moveY(b, map, dy, onHeadBump ? { onHeadBump } : {});
    if (b.onGround) {
      this.tier = pickJumpTier(p, b.vx);
      this.jumping = false;
      this.combo = 0;
      b.vy = 0;
    } else {
      b.vy += holding ? this.tier.holdGravity : this.tier.fallGravity;
      if (b.vy > p.maxFall) b.vy = p.fallReset;
    }
    this.updateAnim(dir);
  }

  private startSlide(): void {
    const s = this.profile.slide;
    if (!s) return;
    this.sliding = s.frames;
    this.crouching = false;
    this.refitHitbox();
    const b = this.body;
    const bottom = b.y + b.h;
    b.h = px(s.hitboxH);
    b.y = bottom - b.h;
  }

  private endSlide(): void {
    this.sliding = 0;
    this.refitHitbox();
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
      const s = sign(b.vx);
      const a = Math.abs(b.vx) - p.releaseDecel;
      b.vx = a < p.minWalk ? 0 : s * a;
      return;
    }
    if (b.vx === 0) b.vx = dir * p.minWalk;
    else if (sign(b.vx) !== dir) {
      this.skidding = true;
      const s = sign(b.vx);
      const a = Math.abs(b.vx) - p.skidDecel;
      b.vx = a <= p.skidTurnaround ? dir * p.minWalk : s * a;
      return;
    }
    const accel = running ? p.runAccel : p.walkAccel;
    let a = Math.abs(b.vx) + accel;
    if (a > cap) a = Math.max(cap, Math.abs(b.vx) - p.releaseDecel);
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
    const accel = Math.abs(b.vx) > p.maxWalk ? p.runAccel : p.walkAccel;
    if (b.vx === 0) b.vx = dir * p.minWalk;
    else if (sign(b.vx) !== dir) b.vx += dir * accel;
    else b.vx = dir * Math.min(Math.abs(b.vx) + accel, Math.max(cap, Math.abs(b.vx)));
  }

  private updateAnim(dir: number): void {
    const b = this.body;
    if (this.stun > 0) this.anim = 'hurt';
    else if (this.sliding > 0) this.anim = 'slide';
    else if (this.attackTimer > 0) this.anim = 'attack';
    else if (!b.onGround) this.anim = 'jump';
    else if (this.crouching) this.anim = 'crouch';
    else if (this.skidding) this.anim = 'skid';
    else if (b.vx !== 0 || dir !== 0) {
      this.anim = 'walk';
      // Walk cycle speed scales with velocity like SMB1 (faster at run speed).
      const speed = Math.abs(b.vx);
      const rate = speed >= this.profile.maxRun - 0x100 ? 2 : speed >= this.profile.maxWalk ? 3 : 5;
      if (++this.walkTick >= rate) {
        this.walkTick = 0;
        this.walkFrame = (this.walkFrame + 1) % 3;
      }
    } else {
      this.anim = 'idle';
      this.walkFrame = 0;
    }
  }

  /** Bounce after a stomp. Holding jump bounces higher (uses the hold-gravity mechanic). */
  stompBounce(): void {
    const b = this.body;
    b.vy = -0x04000;
    this.tier = pickJumpTier(this.profile, b.vx);
    this.jumping = true;
    b.onGround = false;
  }

  get feetY(): number {
    return this.body.y + this.body.h;
  }
  get centerX(): number {
    return this.body.x + (this.body.w >> 1);
  }
  get invulnerable(): boolean {
    return this.invuln > 0 || this.star > 0 || this.transition !== null || this.dead;
  }
  /** Blink while invulnerable after a hit. */
  visible(frame: number): boolean {
    return this.invuln === 0 || (frame & 2) === 0;
  }
}
