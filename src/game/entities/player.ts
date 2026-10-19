import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import type { AABB } from '@engine/math/aabb';
import { px, sign, tileAt, tileToSub, velToSub } from '@engine/math/units';
import { JUMP_BUFFER_FRAMES } from '../constants';
import {
  damp,
  pickJumpTier,
  pickRiseTier,
  type JumpTier,
  type MovementProfile,
  type SwimProfile,
} from '../characters/profile';
import type { CharacterDef } from '../characters/character';
import { makeBody, moveX, moveY, type Body } from './body';
import type { TileMap } from '../world/tilemap';
import type { AudioSink } from '@engine/audio/audio-manager';
import { placeOnStairs, STAIR_LOCK, STAIR_SPEED, type StairLine, type StairRide } from './objects/stairs';

/**
 * Swimming for heroes without their own `swim` profile. The original gives them no stroke (they
 * jump off the floor with lighter gravity), so the stroke and gravity are ours; the sink cap is
 * Character.as `vyMaxPsvWater = 250` (2.083 px/f), which applies to every character.
 */
const DEFAULT_SWIM: SwimProfile = { stroke: 0x01800, gravity: 0x00100, sinkMax: 0x02155 };
const CLIMB_SPEED = 0x00100; // 1 px/f in subpixels

/**
 * The part of a player's scratch state that follows them to the next level: not per-swing hit
 * marks (`hit…`), nor a hero's transient flags (`_…`).
 */
export function carriedKit(p: Player): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.scratch)) if (!k.startsWith('hit') && !k.startsWith('_')) out[k] = v;
  return out;
}

export type PlayerAnim =
  'idle' | 'walk' | 'skid' | 'jump' | 'crouch' | 'climb' | 'attack' | 'swim' | 'slide' | 'hurt';
/**
 * A freeze of the whole world around one player: the grow/shrink flicker (48 frames), or, with
 * `len`, a freeze of that many frames (Classic SMBC's 60-frame power-up and hit freezes, PS-C4,
 * PS-C10). 'freeze' changes no size.
 */
export type Transition = { kind: 'grow' | 'shrink' | 'freeze'; t: number; len?: number };

/**
 * A hit's push and input lock (Classic SMBC, PS-C10..PS-C12; set only by
 * characters/classic/power.ts). While set, input is ignored (`stun` holds it), there is no ground
 * or air jump, and the World lets the player neither stomp nor bump blocks. It ends after
 * `frames`, once `distance` px are covered or a wall on the push side `dir` is met, or on landing
 * (`untilLand`; a vine, stairs or a spring end it too), whichever comes first; then the player is
 * invulnerable for `invulnAfter` frames.
 */
export interface HurtLock {
  t: number;
  frames?: number;
  distance?: number;
  untilLand?: boolean;
  startX: number;
  dir: -1 | 1;
  invulnAfter: number;
}

/** A floor jumper's movement under water (SwimProfile.floorJumpOnly), one per land profile. */
const floorJumpProfiles = new WeakMap<MovementProfile, MovementProfile>();
function floorJumpProfile(base: MovementProfile, sw: SwimProfile): MovementProfile {
  let p = floorJumpProfiles.get(base);
  if (!p) {
    const tier: JumpTier = {
      maxVx: Infinity,
      initial: sw.stroke,
      holdGravity: sw.gravity,
      fallGravity: sw.gravity,
    };
    p = { ...base, jump: [tier], maxFall: sw.sinkMax, fallReset: sw.sinkMax };
    floorJumpProfiles.set(base, p);
  }
  return p;
}

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
  /**
   * Jumps left in the air (MovementProfile.airJumps: Simon's double jump). Full on the ground, by a
   * stomp's bounce and a spring's launch; none while a hit knocks him back, or when a level begins
   * with him in the air (until he lands).
   */
  airJumpsLeft = 0;
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
  /**
   * Set by the world each frame: a water level with the body above its surface line. Only read
   * for SwimProfile.surface (Classic SMBC's gravity there).
   */
  aboveWater = false;
  /** A Classic SMBC hit's push and input lock (HurtLock); null otherwise. */
  hurtLock: HurtLock | null = null;
  /**
   * Holding a vine: its centre line (subpixels) and the px span that can be climbed. `through`:
   * a climb arrival's vine, climbed through any tiles in the way (a hull under a deck).
   */
  vine: { x: number; top: number; bottom: number; through?: boolean } | null = null;
  /** Frames after letting go of a vine during which it cannot be grabbed again. */
  vineLock = 0;
  /**
   * Character.exitVine: set once left or right is released on the vine (relLftBtn/relRhtBtn),
   * so the next left or right press steps off; cleared on grabbing one (getOnVine).
   */
  vineExit = false;
  /** Centre line of the vine just stepped off, not grabbed again until he lands or leaves its reach. */
  leftVine: number | null = null;
  /**
   * On Castlevania stairs (entities/objects/stairs.ts): the flight and how far up it. The world
   * gets the player on (World.grabStairs); `stairWalk` moves them along it and steps off at the ends.
   */
  stairs: StairRide | null = null;
  /** The end of a flight just stepped off, not got on again for a few frames. */
  stairLock: { line: StairLine; end: 'foot' | 'top'; t: number } | null = null;
  /** Thrown by a spring: floats with hold-gravity to the apex whether or not jump is held. */
  launched = false;
  /** Set by springLaunch: the gravity of the rise to the apex instead of the hold-gravity (0 = none). */
  private launchGravity = 0;
  private runTimer = 0;
  private tier: JumpTier;
  /** `tier` is a floor jumper's water tier (SwimProfile.floorJumpOnly). */
  private waterTier = false;
  private airCap: number;
  private sinceGround = 0;
  /*
   * Classic SMBC jump state (MovementProfile.rise / softCut / inertia; unused otherwise).
   */
  /** Feet height (subpixels) at the last jump's take-off, until landing; null when not in a jump. */
  riseY0: number | null = null;
  /** In a constant rise: gravity off, vy held at the rise speed (RiseJump). */
  rising = false;
  /** The take-off tier's rise cap in px (RiseTier.cap). */
  private riseCap = 0;
  /** Jump was let go since the last take-off (the first release counts; MovementProfile.softCut). */
  jumpReleased = false;
  /** The soft cut is damping upward speed (MovementProfile.softCut). */
  cutting = false;
  /** In a crouch-jump (MovementProfile.crouchJump): crouch pose and hitbox until landing. */
  crouchJump = false;
  /** InertiaProfile: the acceleration set on the last ground frame, and the speed cap now. */
  private inertiaAx = 0;
  private inertiaCap = 0;
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
    this.inertiaCap = this.profile.maxWalk;
    this.inertiaAx = this.profile.inertia?.accel ?? 0;
  }

  /** This frame starts a jump: jump went down (or was buffered, unless `jumpBuffer` is false). */
  private jumpPressed(input: InputFrame): boolean {
    return this.profile.jumpBuffer === false ? input.pressed('jump') : input.bufferedJump(JUMP_BUFFER_FRAMES);
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

  /**
   * Whether his standing body (not crouched, not sliding) fits where he is, feet where they are
   * (0.4.43): a slide or a crouch ends only then.
   */
  roomToStand(map: TileMap): boolean {
    const crouching = this.crouching;
    const sliding = this.sliding;
    this.crouching = false;
    this.sliding = 0;
    const hb = this.def.hitbox(this);
    this.crouching = crouching;
    this.sliding = sliding;
    const b = this.body;
    const top = b.y + b.h - px(hb.h);
    for (let ty = tileAt(top); ty <= tileAt(b.y + b.h - 1); ty++)
      for (let tx = tileAt(b.x); tx <= tileAt(b.x + px(hb.w) - 1); tx++)
        if (map.isSolid(tx, ty)) return false;
    return true;
  }

  startTransition(kind: Transition['kind'], len?: number): void {
    this.transition = len === undefined ? { kind, t: 0 } : { kind, t: 0, len };
    this.refitHitbox();
  }

  /** Advance a grow/shrink flicker. Returns true while it is still running. */
  tickTransition(): boolean {
    if (!this.transition) return false;
    this.transition.t++;
    if (this.transition.t >= (this.transition.len ?? 48)) {
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
    if (this.stairLock && --this.stairLock.t <= 0) this.stairLock = null;
    if (this.frozen || this.dead) return;
    if (this.hurtLock) this.tickHurtLock();
    if (this.vine) return this.climb(input, map, audio);
    if (this.stairs) return this.stairWalk(input);
    if (this.def.behaviour.drive?.(this, input, map, audio, onHeadBump)) return;
    if (this.profile.rise) return this.riseUpdate(input, map, audio, onHeadBump);
    let p = this.profile;
    const b = this.body;
    let dir = input.dirX;
    const wantRun = p.canRun && (input.held('attack') || input.held('run')) && !this.inWater;
    if (wantRun) this.runTimer = p.runTimerFrames;
    else if (this.runTimer > 0) this.runTimer--;
    const running = wantRun || this.runTimer > 0;
    this.skidding = false;

    // Crouching: only when tall enough and on the ground; can't walk while crouched.
    const canCrouch = this.def.crouches && (this.def.hitbox(this).h > 16 || this.crouching);
    const wantCrouch = input.held('down') && canCrouch && b.onGround && this.sliding === 0;
    // Under a low ceiling (a crouch-slide under bricks, prone under a ledge) he stays down, and
    // crawls on until there is room to stand (0.4.43: never standing up inside tiles).
    const cramped = this.crouching && !wantCrouch && !this.roomToStand(map);
    if (wantCrouch !== this.crouching && !cramped) {
      this.crouching = wantCrouch;
      this.refitHitbox();
    }
    if (this.crouching && !cramped) dir = 0;
    // A hero's own reason to stand still (Classic Samus crouched or holding Down; Classic Pit
    // aiming up on the ground): CharacterBehaviour.holdsStill, absent for every Current def.
    if (this.def.behaviour.holdsStill?.(this, input)) dir = 0;

    if (this.stun > 0) {
      this.stun--;
      if (b.onGround) this.sinceGround = 0;
    } else if (this.sliding > 0) {
      this.sliding--;
      b.vx = this.facing * (p.slide?.speed ?? 0);
      if (this.sliding === 0 || b.hitWall !== 0) {
        // Under a low ceiling the slide goes on until there is room to stand, as in his own games
        // (0.4.43); against a wall there it waits, and turns with the d-pad.
        if (this.roomToStand(map)) this.endSlide();
        else {
          this.sliding = 1;
          if (b.hitWall === this.facing) b.vx = 0;
        }
      }
    } else if (b.onGround) {
      this.sinceGround = 0;
      if (p.inertia) this.inertiaStep(input, this.crouching && !cramped);
      else this.groundMove(dir, running);
    } else {
      this.sinceGround++;
      if (p.inertia) this.inertiaStep(input, false);
      else this.airMove(dir);
    }

    const sw = p.swim;
    const floorJumper = this.inWater && sw?.floorJumpOnly === true;
    if (this.inWater && !floorJumper) return this.swim(input, map, audio, dir, onHeadBump);
    if (floorJumper && sw) {
      // Classic SMBC's floor jumpers: the land code below with the water tier and sink cap.
      p = floorJumpProfile(this.profile, sw);
      this.tier = p.jump[0] as JumpTier;
      this.waterTier = true;
    } else if (this.waterTier) {
      // Out of the water mid-jump: the land tier's gravity from here.
      this.tier = pickJumpTier(p, b.vx);
      this.waterTier = false;
    }

    const canJump =
      this.sliding === 0 &&
      !this.hurtLock &&
      (this.def.behaviour.canJump?.(this) ?? true) &&
      (b.onGround || this.clinging || (this.sinceGround <= p.coyoteFrames && !this.jumping && b.vy >= 0));
    // A hit's knock back takes the air jumps until he lands (the original turns his input off).
    if (this.stun > 0 && !b.onGround) this.airJumpsLeft = 0;
    if (b.onGround) this.airJumpsLeft = p.airJumps ?? 0;
    if (canJump && this.jumpPressed(input)) {
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
        this.jumpReleased = false;
        this.cutting = false;
        // A wall kick is a full jump even for characters whose jumps cut short on release.
        this.jumping = !(wallJump && p.variableJump === 'cut');
        // Only a genuine run (faster than the walk cap) keeps the run cap in the air; a jump at
        // exactly walking speed must not suddenly accelerate like a sprint.
        this.airCap = Math.abs(b.vx) > p.maxWalk ? p.maxRun : p.maxWalk;
        audio.sfx(this.def.jumpSfx(this));
      }
    } else if (
      this.airJumpsLeft > 0 &&
      !b.onGround &&
      !this.clinging &&
      this.stun === 0 &&
      !this.hurtLock &&
      this.sliding === 0 &&
      (this.def.behaviour.canJump?.(this) ?? true) &&
      input.pressed('jump')
    ) {
      // An air jump (Simon.pressJmpBtn's double jump): the first jump's strength again; a fixed
      // arc takes the direction held now, or stops.
      input.consumeJumpBuffer();
      this.airJumpsLeft--;
      this.tier = pickJumpTier(p, b.vx);
      b.vy = -this.tier.initial;
      this.jumping = true;
      this.launched = false;
      if (p.airControl === 'none') {
        b.vx = dir * p.maxWalk;
        this.airCap = p.maxWalk;
      }
      audio.sfx(this.def.jumpSfx(this));
    }

    // Like the NES: the jump's full initial speed moves the body on the takeoff frame and gravity
    // is applied after the move. Applying gravity first shaved a frame off every jump (standing
    // apex 62 px instead of the 4 tiles SMB1 clears).
    if (!b.onGround && p.variableJump === 'cut' && this.jumping && b.vy < 0 && !input.held('jump')) b.vy = 0;
    if (p.softCut !== undefined && !b.onGround && !this.launched) this.softCutStep(input, p.softCut);
    if (this.launched && (b.vy >= 0 || b.onGround)) this.launched = false;
    const holding =
      (p.variableJump === true && this.jumping && input.held('jump') && b.vy < 0) || this.launched;
    if (this.clinging) {
      b.vy = 0;
      b.vx = this.facing * 0x00100; // keep leaning into the wall so hitWall stays set
    }

    if (this.stun === 0) {
      if (p.turnInAir === false) {
        if (b.onGround && dir !== 0) this.facing = dir;
      } else if (b.vx !== 0 && this.sliding === 0) this.facing = sign(b.vx) as -1 | 1;
      else if (dir !== 0) this.facing = dir;
    }

    const wasOnGround = b.onGround;
    const gapSpeed = wasOnGround && p.crossGapMinVx !== undefined && Math.abs(b.vx) > p.crossGapMinVx;
    moveX(b, map, velToSub(b.vx));
    this.fallSpeed = b.onGround ? 0 : b.vy;
    const dy = b.onGround ? Math.max(velToSub(b.vy), 1) : velToSub(b.vy);
    moveY(b, map, dy, onHeadBump ? { onHeadBump } : {});
    if (gapSpeed && !b.onGround) this.crossSmallGap(map);
    if (b.onGround) {
      this.tier = pickJumpTier(p, b.vx);
      this.jumping = false;
      this.combo = 0;
      b.vy = 0;
      this.jumpReleased = false;
      this.cutting = false;
    } else if (!this.clinging) {
      const surface = this.aboveWater ? p.swim?.surface : undefined;
      if (surface) {
        // Classic SMBC above a water level's surface line (SW-C10).
        b.vy += surface.gravity;
        if (b.vy > surface.fallMax) b.vy = surface.fallMax;
      } else {
        if (this.launched && this.launchGravity) b.vy += this.launchGravity;
        else b.vy += holding ? this.tier.holdGravity : this.tier.fallGravity;
        if (b.vy > p.maxFall) b.vy = p.fallReset;
      }
    }
    this.updateAnim(dir);
  }

  /**
   * The constant-rise path (MovementProfile.rise; ML-C2, ML-C4, ML-C5, ML-C8..ML-C13, ML-C22):
   * the original's frame order, gravity before the move. See RiseJump and InertiaProfile.
   */
  private riseUpdate(
    rawInput: InputFrame,
    map: TileMap,
    audio: AudioSink,
    onHeadBump?: (tx: number, ty: number) => void,
  ): void {
    const p = this.profile;
    const r = p.rise as NonNullable<MovementProfile['rise']>;
    const b = this.body;
    // A hit's push or knock back takes the controls (none for the plumbers, whose hits freeze).
    const locked = this.stun > 0 || this.hurtLock !== null;
    if (this.stun > 0) this.stun--;
    const input = locked ? NO_INPUT : rawInput;
    const dir = input.dirX;
    this.skidding = false;
    // Anything that stood him up (a power-up, a vine) ends a crouch-jump.
    if (!this.crouching) this.crouchJump = false;

    // Crouching (ML-C6): on the ground only, and only tall enough. Releasing Down skips the
    // horizontal step once (`justCrouched`); under a low ceiling he stays down.
    let skipStep = false;
    if (b.onGround && !this.crouchJump) {
      const canCrouch = this.def.crouches && (this.def.hitbox(this).h > 16 || this.crouching);
      const want = input.held('down') && canCrouch;
      const cramped = this.crouching && !want && !this.roomToStand(map);
      if (want !== this.crouching && !cramped) {
        this.crouching = want;
        this.refitHitbox();
        if (!want) skipStep = true;
      }
    }

    if (this.inWater) {
      // Under water: no rise, a jump press is a stroke (ML-C15); the horizontal step with the
      // walking acceleration and no run cap.
      this.rising = false;
      this.cutting = false;
      this.riseY0 = null;
      this.crouchJump = false;
      if (b.onGround) this.sinceGround = 0;
      if (p.inertia && !skipStep) this.inertiaStep(input, this.crouching);
      else if (!p.inertia) {
        if (b.onGround) this.groundMove(this.crouching ? 0 : dir, false);
        else this.airMove(dir);
      }
      return this.swim(input, map, audio, dir, onHeadBump);
    }

    // Take-off (ML-C8): a press on the ground (no buffer when `jumpBuffer` is false).
    const canJump = b.onGround && !locked && (this.def.behaviour.canJump?.(this) ?? true);
    if (b.onGround) {
      this.sinceGround = 0;
      this.airJumpsLeft = 0;
    } else this.sinceGround++;
    if (canJump && this.jumpPressed(input)) {
      input.consumeJumpBuffer();
      const t = pickRiseTier(r, b.vx);
      b.vy = -t.speed;
      b.onGround = false;
      this.riseY0 = b.y + b.h;
      this.riseCap = t.cap;
      this.rising = true;
      this.jumpReleased = false;
      this.cutting = false;
      this.jumping = true;
      this.launched = false;
      this.crouchJump = p.crouchJump === true && this.crouching;
      if (!this.crouchJump && this.crouching) {
        this.crouching = false;
        this.refitHitbox();
      }
      audio.sfx(this.def.jumpSfx(this));
    }

    if (!b.onGround) {
      const y0 = this.riseY0;
      const h = y0 === null ? 0 : y0 - (b.y + b.h);
      const minLine = px(r.minLine);
      // 1. The first release (ML-C9.1, ML-C10).
      if (y0 !== null && !this.jumpReleased && !input.held('jump')) {
        this.jumpReleased = true;
        if (h >= minLine) {
          this.cutting = true;
          this.rising = false;
        }
      }
      // 2. The rise lines (ML-C9.2): back onto the line just crossed, then coast.
      if (this.rising && y0 !== null) {
        const cap = px(this.riseCap);
        if (h >= cap) {
          b.y = y0 - cap - b.h;
          this.rising = false;
          if (this.jumpReleased) this.cutting = true;
        } else if (this.jumpReleased && h >= minLine) {
          b.y = y0 - minLine - b.h;
          this.rising = false;
          this.cutting = true;
        }
      }
      // 3. The soft cut (ML-C10): Luigi's factor is 1, but the flag still ends at the fall.
      if (this.cutting) {
        if (b.vy < 0) {
          if (p.softCut !== undefined) b.vy = damp(b.vy, p.softCut);
        } else this.cutting = false;
      }
    }

    // 4. The horizontal step (ML-C4, ML-C13).
    if (!skipStep) {
      if (p.inertia) this.inertiaStep(input, this.crouching);
      else if (b.onGround)
        this.groundMove(this.crouching ? 0 : dir, input.held('attack') || input.held('run'));
      else this.airMove(dir);
    }
    // Facing (ML-C5): with turnInAir false, on the ground to the direction held, never in the air.
    if (!locked) {
      if (p.turnInAir === false) {
        if (b.onGround && dir !== 0) this.facing = dir;
      } else if (b.vx !== 0) this.facing = sign(b.vx) as -1 | 1;
      else if (dir !== 0) this.facing = dir;
    }

    // 5, 6. Gravity unless rising, then the fall cap (a clamp). Above a water level's surface the
    // swim profile's own values (SW-C10); a spring's rise its own gravity (ML-C23).
    if (this.launched && (b.vy >= 0 || b.onGround)) this.launched = false;
    if (!b.onGround && !this.rising) {
      const surface = this.aboveWater ? p.swim?.surface : undefined;
      const g = surface
        ? surface.gravity
        : this.launched && this.launchGravity
          ? this.launchGravity
          : r.gravity;
      b.vy += g;
      const cap = surface ? surface.fallMax : p.maxFall;
      if (b.vy > cap) b.vy = cap;
    }

    // 7. The move.
    const wasOnGround = b.onGround;
    const gapSpeed = wasOnGround && p.crossGapMinVx !== undefined && Math.abs(b.vx) > p.crossGapMinVx;
    moveX(b, map, velToSub(b.vx));
    this.fallSpeed = b.onGround ? 0 : b.vy;
    const dy = b.onGround ? Math.max(velToSub(b.vy), 1) : velToSub(b.vy);
    moveY(b, map, dy, onHeadBump ? { onHeadBump } : {});
    if (gapSpeed && !b.onGround) this.crossSmallGap(map);
    if (b.hitHead) {
      // ML-C11: the rise ends, and the hero is sent down.
      this.rising = false;
      if (this.jumpReleased) this.cutting = true;
      b.vy = r.headBump ?? 0;
    }
    if (b.onGround) {
      this.jumping = false;
      this.combo = 0;
      b.vy = 0;
      this.riseY0 = null;
      this.rising = false;
      this.cutting = false;
      this.jumpReleased = false;
      if (this.crouchJump) {
        // ML-C22: crouched if Down is held, else up (once there is room to stand).
        this.crouchJump = false;
        if (!rawInput.held('down') && this.roomToStand(map)) {
          this.crouching = false;
          this.refitHitbox();
        }
      }
    } else if (wasOnGround && this.crouching && !this.crouchJump) {
      // Slid off a ledge crouched: a crouch-jump's pose to the landing, or up (the tier path's rule).
      if (p.crouchJump) this.crouchJump = true;
      else if (this.roomToStand(map)) {
        this.crouching = false;
        this.refitHitbox();
      }
    }
    if (b.onGround && p.inertia) {
      const k = p.inertia;
      this.skidding = dir !== 0 && Math.abs(b.vx) > k.skidPose && sign(b.vx) === -dir && !this.crouching;
    }
    this.updateAnim(dir);
    // The crouch-jump keeps the crouch frame in the air (MarioBase: the air state never replaces it).
    if (this.crouchJump && this.anim === 'jump') this.anim = 'crouch';
  }

  /**
   * The exponential horizontal step (MovementProfile.inertia, ML-C4). `crouched`: in the crouch
   * pose (on the ground or in a crouch-jump), so no walking and no run cap.
   */
  private inertiaStep(input: InputFrame, crouched: boolean): void {
    const p = this.profile;
    const k = p.inertia as NonNullable<MovementProfile['inertia']>;
    const b = this.body;
    const water = this.inWater;
    const run = !water && p.canRun && (input.held('attack') || input.held('run'));
    const both = input.held('left') && input.held('right');
    const dir = input.dirX;
    const ground = b.onGround;
    const pose = crouched || this.crouchJump;
    if (ground) this.inertiaAx = run ? k.runAccel : k.accel;
    const ax = water ? k.accel : this.inertiaAx;
    const snap = () => {
      if (Math.abs(b.vx) < k.stopSnap) b.vx = 0;
    };
    if (dir !== 0 && !(crouched && ground)) {
      b.vx += dir * ax;
      if (ground && sign(b.vx) === -dir) b.vx = damp(b.vx, k.skid);
    } else if ((crouched && ground) || (run && (both || (dir === 0 && ground)))) {
      b.vx = damp(b.vx, k.brake);
      snap();
    } else if (both || (dir === 0 && ground)) {
      b.vx = damp(b.vx, k.release);
      snap();
    }
    if (run && !pose) this.inertiaCap = p.maxRun;
    if (b.vx > this.inertiaCap) b.vx = this.inertiaCap;
    else if (b.vx < -this.inertiaCap) b.vx = -this.inertiaCap;
    if (!run) {
      if (Math.abs(b.vx) > p.maxWalk && dir !== 0) b.vx = damp(b.vx, k.runToWalk);
      if (Math.abs(b.vx) <= p.maxWalk) this.inertiaCap = p.maxWalk;
    }
  }

  /** The tier path's soft cut (MovementProfile.softCut): before gravity and the move. */
  private softCutStep(input: InputFrame, k: number): void {
    const b = this.body;
    if (!this.jumpReleased && !input.held('jump')) {
      this.jumpReleased = true;
      if (b.vy < 0) this.cutting = true;
    }
    if (!this.cutting) return;
    if (b.vy < 0) b.vy = damp(b.vy, k);
    else this.cutting = false;
  }

  /** HurtLock's end conditions, checked before this frame's move (see HurtLock). */
  private tickHurtLock(): void {
    const l = this.hurtLock as HurtLock;
    const b = this.body;
    l.t++;
    const done =
      (l.frames !== undefined && l.t > l.frames) ||
      (l.distance !== undefined && (Math.abs(b.x - l.startX) >= px(l.distance) || b.hitWall === l.dir)) ||
      (l.untilLand === true && (b.onGround || this.launched)) ||
      this.vine !== null ||
      this.stairs !== null;
    if (!done) return;
    this.hurtLock = null;
    this.stun = 0;
    // This frame is the first invulnerable one (its countdown already ran above).
    this.invuln = l.invulnAfter - 1;
    if (b.onGround) b.vx = 0;
  }

  /**
   * The original's Level.checkCrossSmallGap (run on the first frame a player with
   * canCrossSmallGaps has left the ground): when the tiles one column left and one column right
   * of the player's centre column both have ground whose top is exactly at the feet, the player
   * stands on it and runs on at the same height. Only one-tile gaps qualify; lifts never do (they
   * are entities, the original's `Platform`).
   */
  private crossSmallGap(map: TileMap): void {
    const b = this.body;
    const feet = b.prevBottom;
    const row = tileAt(feet);
    if (tileToSub(row) !== feet) return;
    const col = tileAt(b.x + (b.w >> 1));
    if (col - 1 <= 0 || col + 1 >= map.width) return;
    const ground = (tx: number) => {
      const c = map.collisionAt(tx, row);
      return c === 'solid' || c === 'top';
    };
    if (!ground(col - 1) || !ground(col + 1)) return;
    b.y = feet - b.h;
    b.vy = 0;
    b.onGround = true;
  }

  /**
   * Underwater: no running, a tap of jump is a stroke upward, and everything sinks slowly.
   * Walking on the floor still works, so pipes and springs behave. A seabed walker (SwimProfile
   * `mode: 'seabed'`, Mega Man and Samus) has no stroke: only a high, floaty jump off the floor.
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
    const seabed = sw.mode === 'seabed';
    this.airCap = p.maxWalk;
    // Character.as water block: on the floor a slow walker is capped at vxMaxGroundWater.
    const cap = b.onGround && sw.floorWalk !== undefined ? sw.floorWalk : p.maxWalk;
    if (b.vx > cap) b.vx = cap;
    if (b.vx < -cap) b.vx = -cap;
    // A seabed walker jumps off the floor only; over water with no floor below at all (a pit
    // under the sea, or World 9-2's bottomless stretch) they may push off again once sinking, so
    // no water level is left without a way across.
    const seabedJump = seabed && (b.onGround || (b.vy >= 0 && this.overVoid(map)));
    const canJump =
      this.sliding === 0 && (this.def.behaviour.canJump?.(this) ?? true) && (!seabed || seabedJump);
    if (canJump && this.jumpPressed(input)) {
      input.consumeJumpBuffer();
      // A slide starts on the floor only, as on land (not in a push-off over bottomless water).
      if (seabed && p.slide && input.held('down') && b.onGround) this.startSlide();
      else {
        b.vy = -sw.stroke;
        b.onGround = false;
        // A seabed jump keeps the hero's own jump rules (Mega Man's cut on release); a stroke never.
        this.jumping = seabed;
        audio.sfx(seabed ? this.def.jumpSfx(this) : 'swim');
      }
    }
    if (seabed && p.variableJump === 'cut' && this.jumping && b.vy < 0 && !input.held('jump')) b.vy = 0;
    if (this.stun === 0) {
      // turnInAir false: under water the facing turns freely, to the direction held (ML-C5).
      if (p.turnInAir === false) {
        if (dir !== 0) this.facing = dir;
      } else if (b.vx !== 0 && this.sliding === 0) this.facing = sign(b.vx) as -1 | 1;
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
    // A seabed walker keeps their own jump and walk poses; a swimmer strokes in a swim pose.
    if (!b.onGround && !seabed) this.anim = 'swim';
  }

  /** Nothing to stand on anywhere under the body, down to the bottom of the map. */
  private overVoid(map: TileMap): boolean {
    const b = this.body;
    const from = tileAt(b.y + b.h);
    for (const tx of [tileAt(b.x), tileAt(b.x + b.w - 1)])
      for (let ty = from; ty < map.height; ty++) {
        const c = map.collisionAt(tx, ty);
        if (c === 'solid' || c === 'top') return false;
      }
    return true;
  }

  /**
   * On a vine: up/down climb; left or right steps off once a direction has been released on it
   * (Character/MarioBase.movePlayer: with `exitVine` set, getOffVine, else return without moving
   * or turning). Jump does nothing there (pressJmpBtn returns while cState == ST_VINE). The
   * world handles grabbing.
   */
  private climb(input: InputFrame, map: TileMap, _audio: AudioSink): void {
    const v = this.vine as NonNullable<typeof this.vine>;
    const b = this.body;
    b.vx = 0;
    b.x = v.x - (b.w >> 1);
    if (input.bufferedJump(JUMP_BUFFER_FRAMES)) input.consumeJumpBuffer();
    if (input.released('left') || input.released('right')) this.vineExit = true;
    if (input.dirX !== 0 && this.vineExit && this.stepOffVine(input.dirX, map)) return;
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
    if (v.through) {
      b.y += dy;
      b.onGround = false;
      return;
    }
    moveY(b, map, dy);
    if (b.onGround) {
      // Climbed down onto the ground.
      this.letGo();
      return;
    }
    // Hands (near the top of the body) slipping below the vine's base: drop off.
    if (b.y + px(8) > px(v.bottom)) this.letGo();
  }

  /**
   * Character.getOffVine: put the body just outside the vine's hit box on side `dir`
   * (nx = vine.hLft - hWidth*.5 or vine.hRht + hWidth*.5; our vine is 2 px wide) and let go,
   * with gravity back on. Not into a wall (movePlayer checks !wallOnLeft / !wallOnRight).
   */
  private stepOffVine(dir: -1 | 1, map: TileMap): boolean {
    const v = this.vine as NonNullable<typeof this.vine>;
    const b = this.body;
    const x = dir > 0 ? v.x + px(1) : v.x - px(1) - b.w;
    for (let ty = tileAt(b.y); ty <= tileAt(b.y + b.h - 1); ty++)
      for (let tx = tileAt(x); tx <= tileAt(x + b.w - 1); tx++) if (map.isSolid(tx, ty)) return false;
    b.x = x;
    this.letGo();
    this.leftVine = v.x;
    return true;
  }

  /**
   * Walking a flight of stairs: UP (or the way the flight rises) climbs, DOWN (or the other way)
   * descends, nothing stands. Jumps are swallowed; the walk pauses while an attack swings or a
   * hit stuns. Reaching either end steps off onto the floor there.
   */
  private stairWalk(input: InputFrame): void {
    const ride = this.stairs as StairRide;
    const line = ride.line;
    if (input.bufferedJump(JUMP_BUFFER_FRAMES)) input.consumeJumpBuffer();
    this.crouching = false;
    this.fallSpeed = 0;
    this.jumping = false;
    let along = 0;
    if (input.held('up')) along = 1;
    else if (input.held('down')) along = -1;
    else if (input.dirX !== 0) along = input.dirX === line.sx ? 1 : -1;
    const busy = this.attackTimer > 0 || this.stun > 0 || (this.scratch.throwT ?? 0) > 0;
    if (this.stun > 0) this.stun--;
    if (along !== 0 && !busy) {
      this.facing = (along > 0 ? line.sx : -line.sx) as -1 | 1;
      ride.pos += along * STAIR_SPEED;
      if (++this.walkTick >= 8) {
        this.walkTick = 0;
        this.walkFrame = (this.walkFrame + 1) % 3;
      }
      this.anim = 'walk';
    } else {
      this.anim = this.attackTimer > 0 ? 'attack' : 'idle';
    }
    const end = ride.pos <= 0 ? 'foot' : ride.pos >= line.span ? 'top' : null;
    ride.pos = Math.max(0, Math.min(line.span, ride.pos));
    placeOnStairs(this, ride);
    if (end && along !== 0 && !busy) {
      this.stairs = null;
      this.stairLock = { line, end, t: STAIR_LOCK };
      this.anim = 'idle';
    }
  }

  /** Gets on a flight of stairs at `ride` (World.grabStairs). */
  getOnStairs(ride: StairRide): void {
    this.def.behaviour.onGrabStairs?.(this); // a morph ball unrolls before the height is used
    this.stairs = ride;
    this.vine = null;
    this.crouching = false;
    this.sliding = 0;
    this.refitHitbox();
    placeOnStairs(this, ride);
    this.anim = 'idle';
  }

  /** Release the vine (step off, climb down to the floor, or the vine ended). */
  letGo(): void {
    this.vine = null;
    this.vineLock = 20;
    this.vineExit = false;
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
    const control = this.inWater ? (p.swim?.airControl ?? p.airControl) : p.airControl;
    // MovementProfile.airStop (Classic SMBC): full air control stops him when nothing is held.
    if (dir === 0 && p.airStop && control === 'full') b.vx = 0;
    if (control === 'none' || dir === 0) return;
    if (p.instantAccel) {
      b.vx = dir * p.maxWalk;
      return;
    }
    const cap = control === 'smb1' ? this.airCap : p.maxRun;
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
    this.launchGravity = 0;
    // A rise path launch is no jump rise and keeps the last jump's release state (ML-C23).
    this.rising = false;
    this.crouchJump = false;
    // Leaving a spring gives the air jumps back (Simon.checkState: lastOnSpring && !onSpring).
    this.airJumpsLeft = this.profile.airJumps ?? 0;
    this.sliding = 0;
    this.crouching = false;
    this.refitHitbox();
  }

  /**
   * Thrown up by a springboard (SpringRed.springLaunch): `vy` is fixed, whatever the run speed, and
   * the rise to the apex uses `riseGravity` whether or not jump is held (the original starts no
   * jump rise; Character.springLaunch is empty for Mario).
   */
  springLaunch(vy: number, riseGravity: number): void {
    this.launch(1);
    this.body.vy = -vy;
    this.launchGravity = riseGravity;
  }

  /**
   * Bounce after a stomp. Holding jump bounces higher (uses the hold-gravity mechanic), unless the
   * profile sets a fixed `stompBounce`.
   */
  stompBounce(): void {
    const b = this.body;
    const fixed = this.profile.stompBounce;
    if (fixed !== undefined) {
      // A fixed bounce with normal gravity (ML-C21): no rise, no hold boost, and the last jump's
      // release state and lines stay as they were.
      b.vy = -fixed;
      b.onGround = false;
      this.jumping = false;
      this.rising = false;
      this.launched = false;
      this.airJumpsLeft = this.profile.airJumps ?? 0;
      return;
    }
    b.vy = -0x04000;
    this.tier = pickJumpTier(this.profile, b.vx);
    this.jumping = true;
    b.onGround = false;
    // A bounce gives the air jumps back (Simon.bounce).
    this.airJumpsLeft = this.profile.airJumps ?? 0;
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
    return this.invuln === 0 || this.def.noHurtBlink === true || (frame & 2) === 0;
  }
}
