import type { InputFrame } from '@engine/input/input-manager';
import type { AABB } from '@engine/math/aabb';
import { px, sign, velToSub } from '@engine/math/units';
import { JUMP_BUFFER_FRAMES } from '../constants';
import { pickJumpTier, type JumpTier, type MovementProfile, type SwimProfile } from '../characters/profile';
import type { CharacterDef } from '../characters/character';
import { makeBody, moveX, moveY, type Body } from './body';
import type { TileMap } from '../world/tilemap';
import type { AudioSink } from '@engine/audio/audio-manager';

/**
 * Swimming for heroes without their own `swim` profile. The original gives them no stroke (they
 * jump off the floor with lighter gravity), so the stroke and gravity are ours; the sink cap is
 * Character.as `vyMaxPsvWater = 250` (2.083 px/f), which applies to every character.
 */
const DEFAULT_SWIM: SwimProfile = { stroke: 0x01800, gravity: 0x00100, sinkMax: 0x02155 };
const CLIMB_SPEED = 0x00100; // 1 px/f in subpixels

/** The part of a player's scratch state that follows them to the next level (not per-swing hit marks). */
export function carriedKit(p: Player): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.scratch)) if (!k.startsWith('hit')) out[k] = v;
  return out;
}

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
  /** Left/right held on the last update (Lakitu reads it, like `player.lftBtn/rhtBtn` in Lakitu.as). */
  heldDirX: -1 | 0 | 1 = 0;
  anim: PlayerAnim = 'idle';
  walkFrame = 0;
  private walkTick = 0;
  attackTimer = 0;
  /** Melee hitbox published for the frames an attack is active. */
  activeMelee: AABB | null = null;
  /** Consecutive stomps without landing. */
  combo = 0;
  /** World frame of the last stomp that counted towards `combo` (double stomps). */
  stompFrame = -1;
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
  /** Stuck to a wall (ninja): no gravity, and a jump pushes off it. Set by the character each frame. */
  clinging = false;
  /** Frames after a wall jump during which the wall cannot be grabbed again. */
  clingLock = 0;
  /** Vertical speed before this frame's move (survives the landing reset; used for stomp checks). */
  fallSpeed = 0;
  /** Set by the world each frame: the body's centre is under the water line (swim physics). */
  inWater = false;
  /** Holding a vine: its centre line (subpixels) and the px span that can be climbed. */
  vine: { x: number; top: number; bottom: number } | null = null;
  /** Frames after letting go of a vine during which it cannot be grabbed again. */
  vineLock = 0;
  /** Thrown by a spring: floats with hold-gravity to the apex whether or not jump is held. */
  launched = false;
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
    this.heldDirX = input.dirX;
    if (this.invuln > 0) this.invuln--;
    if (this.star > 0) this.star--;
    if (this.attackTimer > 0) this.attackTimer--;
    if (this.clingLock > 0) this.clingLock--;
    if (this.vineLock > 0) this.vineLock--;
    if (this.frozen || this.dead) return;
    if (this.vine) return this.climb(input, map, audio);
    const p = this.profile;
    const b = this.body;
    let dir = input.dirX;
    const wantRun = p.canRun && input.held('attack') && !this.inWater;
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

    if (this.inWater) return this.swim(input, map, audio, dir, onHeadBump);

    const canJump =
      this.sliding === 0 &&
      (this.def.behaviour.canJump?.(this) ?? true) &&
      (b.onGround || this.clinging || (this.sinceGround <= p.coyoteFrames && !this.jumping && b.vy >= 0));
    if (canJump && input.bufferedJump(JUMP_BUFFER_FRAMES)) {
      if (p.slide && input.held('down') && b.onGround) {
        input.consumeJumpBuffer();
        this.startSlide();
      } else {
        input.consumeJumpBuffer();
        const wallJump = this.clinging;
        if (wallJump) {
          // Kick off the wall: away from it at walking speed.
          b.vx = -this.facing * p.maxWalk;
          this.facing = -this.facing as -1 | 1;
          this.clinging = false;
          this.clingLock = 12;
        }
        this.tier = pickJumpTier(p, b.vx);
        b.vy = -this.tier.initial;
        b.onGround = false;
        // A wall kick is a full jump even for characters whose jumps cut short on release.
        this.jumping = !(wallJump && p.variableJump === 'cut');
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
    if (this.launched && (b.vy >= 0 || b.onGround)) this.launched = false;
    const holding =
      (p.variableJump === true && this.jumping && input.held('jump') && b.vy < 0) || this.launched;
    if (this.clinging) {
      b.vy = 0;
      b.vx = this.facing * 0x00100; // keep leaning into the wall so hitWall stays set
    }

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
    } else if (!this.clinging) {
      b.vy += holding ? this.tier.holdGravity : this.tier.fallGravity;
      if (b.vy > p.maxFall) b.vy = p.fallReset;
    }
    this.updateAnim(dir);
  }

  /**
   * Underwater: no running, a tap of jump is a stroke upward, and everything sinks slowly.
   * Walking on the floor still works, so pipes and springs behave.
   */
  private swim(
    input: InputFrame,
    map: TileMap,
    audio: AudioSink,
    dir: -1 | 0 | 1,
    onHeadBump?: (tx: number, ty: number) => void,
  ): void {
    const p = this.profile;
    const b = this.body;
    const sw = p.swim ?? DEFAULT_SWIM;
    this.airCap = p.maxWalk;
    // Character.as water block: on the floor a slow walker is capped at vxMaxGroundWater.
    const cap = b.onGround && sw.floorWalk !== undefined ? sw.floorWalk : p.maxWalk;
    if (b.vx > cap) b.vx = cap;
    if (b.vx < -cap) b.vx = -cap;
    if (
      input.bufferedJump(JUMP_BUFFER_FRAMES) &&
      this.sliding === 0 &&
      (this.def.behaviour.canJump?.(this) ?? true)
    ) {
      input.consumeJumpBuffer();
      b.vy = -sw.stroke;
      b.onGround = false;
      this.jumping = false;
      audio.sfx('swim');
    }
    if (this.stun === 0) {
      if (b.vx !== 0 && this.sliding === 0) this.facing = sign(b.vx) as -1 | 1;
      else if (dir !== 0) this.facing = dir;
    }
    moveX(b, map, velToSub(b.vx));
    this.fallSpeed = b.onGround ? 0 : b.vy;
    moveY(
      b,
      map,
      b.onGround ? Math.max(velToSub(b.vy), 1) : velToSub(b.vy),
      onHeadBump ? { onHeadBump } : {},
    );
    if (b.onGround) {
      this.jumping = false;
      this.combo = 0;
      b.vy = 0;
    } else {
      b.vy += sw.gravity;
      if (b.vy > sw.sinkMax) b.vy = sw.sinkMax;
    }
    this.tier = pickJumpTier(p, b.vx);
    this.updateAnim(dir);
    if (!b.onGround) this.anim = 'swim';
  }

  /** On a vine: up/down climb, left/right turn, jump lets go. The world handles grabbing. */
  private climb(input: InputFrame, map: TileMap, audio: AudioSink): void {
    const v = this.vine as NonNullable<typeof this.vine>;
    const b = this.body;
    b.vx = 0;
    b.x = v.x - (b.w >> 1);
    if (input.dirX !== 0) this.facing = input.dirX;
    if (input.bufferedJump(JUMP_BUFFER_FRAMES)) {
      input.consumeJumpBuffer();
      this.letGo();
      this.tier = pickJumpTier(this.profile, 0);
      b.vy = -this.tier.initial;
      b.onGround = false;
      this.jumping = this.profile.variableJump !== 'cut';
      this.airCap = this.profile.maxWalk;
      // Pushing a direction leaps clear of the vine at walking speed; otherwise a small hop.
      b.vx = this.facing * (input.dirX !== 0 ? this.profile.maxWalk : this.profile.minWalk << 2);
      audio.sfx(this.def.jumpSfx(this));
      return;
    }
    let dy = 0;
    if (input.held('up')) dy = -CLIMB_SPEED;
    else if (input.held('down')) dy = CLIMB_SPEED;
    this.anim = 'climb';
    if (dy !== 0 && ++this.walkTick >= 8) {
      this.walkTick = 0;
      this.walkFrame = (this.walkFrame + 1) & 1;
    }
    // Can't climb above the vine's top (unless it reaches past the screen top: the sky link).
    if (dy < 0 && b.y + dy < px(v.top) && v.top > -16) dy = Math.min(0, px(v.top) - b.y);
    b.vy = 0;
    this.fallSpeed = 0;
    moveY(b, map, dy);
    if (b.onGround) {
      // Climbed down onto the ground.
      this.letGo();
      return;
    }
    // Hands (near the top of the body) slipping below the vine's base: drop off.
    if (b.y + px(8) > px(v.bottom)) this.letGo();
  }

  /** Release the vine (jump off, climb down to the floor, or the vine ended). */
  letGo(): void {
    this.vine = null;
    this.vineLock = 20;
    this.anim = 'idle';
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

  /** Fired upward by a spring: a jump at `boost` times the normal takeoff speed. */
  launch(boost: number): void {
    const b = this.body;
    this.tier = pickJumpTier(this.profile, b.vx);
    b.vy = -Math.round(this.tier.initial * boost);
    b.onGround = false;
    // A spring launch cannot be cut short, and it floats to its apex like a held jump.
    this.jumping = this.profile.variableJump !== 'cut';
    this.launched = true;
    this.sliding = 0;
    this.crouching = false;
    this.refitHitbox();
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
