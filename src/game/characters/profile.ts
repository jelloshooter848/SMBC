/**
 * Movement profile: everything about how a character accelerates, jumps and falls.
 * Units: velocity/acceleration in 1/4096 px per frame (see engine/math/units).
 */
export interface JumpTier {
  /** Applies when |vx| at takeoff is below this (exclusive). The last tier should use Infinity. */
  maxVx: number;
  /** Initial upward speed (positive number; applied as -initial). */
  initial: number;
  /** Gravity while the jump button is held and still rising. */
  holdGravity: number;
  /** Gravity otherwise. */
  fallGravity: number;
}

/**
 * Underwater movement (the original's `Character.as` water block plus each hero's `setStats`).
 * Same units as the rest of the profile.
 */
export interface SwimProfile {
  /** Upward speed a stroke (jump tap) sets (positive number; applied as -stroke). */
  stroke: number;
  /** Gravity while under water. */
  gravity: number;
  /** Sinking speed cap. */
  sinkMax: number;
  /** Ground speed cap while standing under water (`walksSlowUnderWater`); absent: `maxWalk`. */
  floorWalk?: number | undefined;
  /**
   * 'stroke' (absent): a tap of jump strokes upward anywhere in the water (Mario, the swimmers).
   * 'seabed': no stroke; the hero walks the floor and jumps off it (or a ledge) only, `stroke`
   * being the take-off speed of a slow, floaty jump that keeps the hero's own jump rules (Mega
   * Man's cut on release); `gravity` and `sinkMax` make it high and the fall slow (Bubble Man's
   * stage, Metroid's liquids).
   */
  mode?: 'stroke' | 'seabed' | undefined;
  /** Horizontal control off the floor under water; absent: the profile's `airControl`. */
  airControl?: MovementProfile['airControl'] | undefined;
  /**
   * Classic SMBC (SW-C2..SW-C4, set only by Classic profiles): no stroke. Under water the hero's
   * own land movement runs (walk, jump release, air control, air jumps, wall cling, slide) with
   * one jump tier whose take-off is `stroke` and whose gravity is `gravity` held or not, falling
   * capped at `sinkMax`; so jump works only from the floor (or a wall, or an air jump). Absent:
   * the stroke (or `mode`) above.
   */
  floorJumpOnly?: boolean | undefined;
  /** Classic SMBC (SW-C7): landing on an enemy under water is plain contact, never a stomp. */
  noStomp?: boolean | undefined;
  /**
   * Classic SMBC (SW-C9): 'top' puts the surface line at the hitbox top, y = 32 px (under water
   * while the top is below it). Absent: the body's centre against the wave row + 8 px.
   */
  surfaceTest?: 'top' | undefined;
  /**
   * Classic SMBC (SW-C10): gravity and fall cap above the surface line in a water level (the
   * player is out of the water there). Absent: the hero's land values.
   */
  surface?: { gravity: number; fallMax: number } | undefined;
}

export interface MovementProfile {
  /** Speed snapped to when starting to walk from rest. */
  minWalk: number;
  walkAccel: number;
  runAccel: number;
  /** Deceleration when no direction is held. */
  releaseDecel: number;
  /** Deceleration when holding the opposite direction (skidding). */
  skidDecel: number;
  maxWalk: number;
  maxRun: number;
  /** Below this speed a skid flips the facing/speed immediately. */
  skidTurnaround: number;
  jump: JumpTier[];
  /** Terminal fall speed. When exceeded, vy is reset to `fallReset` (SMB1 quirk) or clamped if equal. */
  maxFall: number;
  fallReset: number;
  /** After releasing run, the run speed cap persists this many frames. */
  runTimerFrames: number;
  /** 'smb1': air accel with cap chosen at takeoff; 'full': ground rules in air; 'none': no air control. */
  airControl: 'smb1' | 'full' | 'none';
  canRun: boolean;
  /** true: SMB1 hold-to-jump-higher; 'cut': releasing jump zeroes upward speed (Mega Man); false: fixed arc. */
  variableJump: boolean | 'cut';
  /** Speed snaps straight to max with no inertia (Mega Man). */
  instantAccel: boolean;
  /** Frames after leaving a ledge during which a jump is still allowed (assist; 0 = SMB1 behaviour). */
  coyoteFrames: number;
  slide?: { speed: number; frames: number; hitboxH: number } | undefined;
  /** Underwater movement; absent: the player's shared default (`DEFAULT_SWIM` in player.ts). */
  swim?: SwimProfile | undefined;
  /**
   * Running on the ground faster than this (|vx|) carries the character over one-tile gaps in a
   * walking surface (the original's Character.canCrossSmallGaps + Level.checkCrossSmallGap).
   * Undefined: never.
   */
  crossGapMinVx?: number | undefined;
  /**
   * Jumps he may take in the air before landing again (0.4.46: Simon's double jump, the original's
   * Simon.canDoubleJump): each as strong as a ground jump; with no air control (a fixed arc) it
   * takes the direction held then, or stops him. Undefined: none.
   */
  airJumps?: number | undefined;
  /*
   * ---- Classic SMBC jump and run model (optional; no Current profile sets any of these) ----
   * Built for Mario and Luigi (2026-10-07-mario-luigi-classic-smbc-rules.md, ML-C) and meant to be
   * shared by the other Classic heroes. Each one is read in Player only when set, so a profile
   * without them runs today's code unchanged (TG-23).
   */
  /**
   * The original's constant-rise jump (Character.as / MarioBase.as `defyGrav`, ML-C7..ML-C12).
   * When set, Player.update runs its rise path (Player.riseUpdate) instead of the tier jump:
   * gravity is added BEFORE the move, as the original does, so take-off speeds are the original's
   * own (no "minus one frame of gravity"). See RiseJump. The rise path does not do slides, wall
   * clings or air jumps; a hero needing those stays on the tier path and may still use
   * `softCut`, `turnInAir`, `jumpBuffer` and `stompBounce`.
   */
  rise?: RiseJump | undefined;
  /**
   * Soft jump cut, a 16.16 factor (`Math.trunc(vy * softCut / 65536)` per frame): the first release
   * of jump in a jump arms it, and from then on upward speed is damped every frame (before
   * gravity and the move) until the hero starts to fall; a later release does nothing. Mario 0.79433
   * (52057), Mega Man 0.7943, Link and Samus 0.8577 (56210). On the rise path the release must
   * also be above `RiseJump.minLine`. Absent: the tier path's `variableJump` rules (and on the
   * rise path, no damping at all: Luigi's factor 1).
   */
  softCut?: number | undefined;
  /**
   * The original's exponential speed model (MarioBase.movePlayer, ML-C3/ML-C4). When set it
   * replaces groundMove/airMove: see InertiaProfile. `maxWalk`/`maxRun` are its caps; `minWalk`,
   * `walkAccel`, `runAccel`, `releaseDecel`, `skidDecel`, `skidTurnaround` and `runTimerFrames`
   * are not read.
   */
  inertia?: InertiaProfile | undefined;
  /**
   * false: the facing never follows vx and never changes in the air; on the ground or under
   * water it turns to the direction held (even while still sliding the other way). So shots
   * keep the take-off direction (ML-C5, SI-C2). Absent: facing follows vx (today).
   */
  turnInAir?: false | undefined;
  /**
   * In the air (with any air control but 'none'), no direction held (or both) sets vx to 0 at
   * once, as a held one sets it straight to `maxWalk` with `instantAccel`: "stops dead" (Classic
   * Simon SI-C6, Samus SA-C3, Ryu RY-C4, Mega Man MM-C4, Link LK-C5). Absent: vx is kept (today).
   */
  airStop?: true | undefined;
  /**
   * false: no jump buffer. A jump (or stroke) starts only on the frame jump goes down while the
   * hero can jump; a press just before landing is lost and holding through a landing does not
   * jump again (ML-C2, LK-C10, SI-C7). Absent: JUMP_BUFFER_FRAMES (today).
   */
  jumpBuffer?: false | undefined;
  /**
   * A stomp's bounce: vy = -stompBounce with normal gravity, never a held-jump boost (ML-C21:
   * Mario and Luigi 0x2800). On the rise path it does not reset the last jump's release state.
   * Absent: today's -4 px/f bounce with the tier's hold gravity.
   */
  stompBounce?: number | undefined;
  /**
   * Down held at take-off keeps the crouch pose and hitbox for the whole jump, with no run cap
   * and no attacks, until landing (ML-C22; rise path only; Player.crouchJump). Absent: crouching
   * ends on leaving the ground.
   */
  crouchJump?: boolean | undefined;
  /**
   * Classic SMBC Ryu's wall climb (RY-C10..RY-C16; Player.wall): he grabs a wall in the air while
   * pressing toward it, stays on with no input, climbs, throws, and leaves by the hop table. The
   * Current cling (`Player.clinging`, the wall kick) is not used. Absent: none.
   */
  wallClimb?: WallClimbProfile | undefined;
}

/**
 * A wall climb (MovementProfile.wallClimb). Probes are px from the hitbox; speeds in 1/4096 px/f.
 * The hop speeds are the original's (gravity added before the move): Player takes one frame of
 * the gravity it falls with (land or water) off them, so the arcs match frame for frame.
 */
export interface WallClimbProfile {
  /** Climbing speed up and down (CLIMB_SPEED). */
  speed: number;
  /** The upper probe: px below the top of the hitbox (CLIMB_TOP_OFS). */
  topProbe: number;
  /** The lower probe: px above the feet (CLIMB_BOT_OFS). */
  bottomProbe: number;
  /** The lower probe may hang this many px below the bottom of the wall (raised onto it on the grab). */
  bottomSlack: number;
  /** No wall at this many px above the hitbox top: he is at the top of the wall (CLIMB_TOP_JUMP_OFS). */
  topJump: number;
  /** Away + Jump: the low hop's take-off speed. */
  hopLow: number;
  /** Jump at the top of the wall (or on a lift): the high hop's take-off speed. */
  hopHigh: number;
  /** After a high hop, frames during which the same wall edge (or any lift) cannot be grabbed. */
  regrab: number;
}

/**
 * One take-off of a constant-rise jump (RiseJump.tiers), chosen like JumpTier by |vx| at take-off.
 */
export interface RiseTier {
  /** Applies when |vx| at take-off is below this (exclusive). The last tier should use Infinity. */
  maxVx: number;
  /** Rise speed: vy = -speed on take-off, held with gravity off while rising. */
  speed: number;
  /** px above the take-off feet height where the rise ends (0: no rise, a plain gravity arc). */
  cap: number;
}

/**
 * The original's jump (ML-C8, ML-C9). On take-off vy = -tier.speed and gravity is off ("rising").
 * Every airborne frame, in this order: (1) the first release of jump sets `released`, and above
 * `minLine` stops the rise and starts the soft cut (`MovementProfile.softCut`); (2) while rising,
 * at `cap` px above take-off (or at `minLine` once released) the body snaps back to that line and
 * the rise ends; (3) the soft cut damps upward speed; (4) the horizontal step; (5) gravity, if not
 * rising; (6) the fall cap (`MovementProfile.maxFall`, a clamp); (7) the move. A ceiling ends the
 * rise and sets vy = `headBump`. Heights are measured at the feet, so a crouch-jump keeps its lines.
 *
 * Other heroes: a plain gravity-first arc is `tiers: [{ maxVx: Infinity, speed, cap: 0 }]`,
 * `minLine: 0`, with the original take-off speed (not less one frame of gravity) and an optional
 * `softCut`; their first frame then rises `speed - gravity`, as in the original.
 */
export interface RiseJump {
  tiers: RiseTier[];
  /** The minimum rise in px: a release before this line rises on to it (ML-C10). */
  minLine: number;
  /** Gravity, rising (once the rise ends) and falling alike. */
  gravity: number;
  /** vy (downward, positive) after a ceiling stops a rise or upward move. Absent: 0. */
  headBump?: number | undefined;
}

/**
 * The original's exponential horizontal model (ML-C4), velocities in 1/4096 px/f and factors in
 * 16.16 (`v = Math.trunc(v * K / 65536)`). Each frame, after the jump checks:
 * 1. one direction held, not crouching: vx += ax toward it (ax = `runAccel` if run was held on the
 *    ground, else `accel`; kept from the last ground frame in the air); on the ground against the
 *    motion also vx *= `skid`;
 * 2. else crouching, or run held with both directions (or none on the ground): vx *= `brake`, snap;
 * 3. else both directions, or none on the ground: vx *= `release`, snap ("snap": |vx| < `stopSnap`
 *    becomes 0);
 * 4. (nothing held in the air keeps vx);
 * 5. the cap is `maxRun` while run is held (not under water, not crouched), and clamps vx;
 * 6. run not held: above `maxWalk` with a direction held, vx *= `runToWalk`; at or below it, the cap
 *    drops back to `maxWalk`.
 * The frame Down is released after a crouch skips the step once.
 */
export interface InertiaProfile {
  /** Acceleration with run not held (and always under water). */
  accel: number;
  /** Acceleration with run held. */
  runAccel: number;
  /** No direction on the ground, or both directions anywhere. */
  release: number;
  /** Crouching, or run held with no direction on the ground (or both directions). */
  brake: number;
  /** On the ground, a direction held against the motion. */
  skid: number;
  /** Run released above `maxWalk` with a direction held. */
  runToWalk: number;
  /** After a friction step, |vx| below this becomes 0. */
  stopSnap: number;
  /** The skid pose shows on the ground while |vx| is above this and the other way is held. */
  skidPose: number;
}

export function pickRiseTier(r: RiseJump, vx: number): RiseTier {
  const a = Math.abs(vx);
  for (const t of r.tiers) if (a < t.maxVx) return t;
  return r.tiers[r.tiers.length - 1] as RiseTier;
}

/** A 16.16 friction or damping factor applied to a velocity, truncated toward 0. */
export function damp(v: number, k: number): number {
  return Math.trunc((v * k) / 65536);
}

export function pickJumpTier(p: MovementProfile, vx: number): JumpTier {
  const a = Math.abs(vx);
  for (const t of p.jump) if (a < t.maxVx) return t;
  return p.jump[p.jump.length - 1] as JumpTier;
}
