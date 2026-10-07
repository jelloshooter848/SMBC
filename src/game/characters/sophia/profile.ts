import type { MovementProfile } from '../profile';

/*
 * Sophia III's constants (bug-reports/2026-10-07-sophia-build-classic-character.md, SO-9, SO-18,
 * SO-28 to SO-36; the original's Sophia.as). Velocities and accelerations in 1/4096 px per frame
 * (0x1000 = 1 px/f), distances in px, times in frames at 60 a second. Flash px/s convert as ÷ 120,
 * Flash px/s² as ÷ 7200, and a per-second decay `k^dt` as `k^(1/60)` per frame.
 */

/** Top speed along any surface and in the air (185 Flash px/s). */
export const DRIVE_MAX = 0x018ab;
/** Acceleration, the same everywhere (800 Flash px/s²). */
export const DRIVE_ACCEL = 0x001c7;
/** Friction `vx *= 0.001^dt` per frame. */
export const FRICTION = 0.89125;
/** Below this, speed snaps to 0 (5 Flash px/s). */
export const MIN_SPEED = 0x000ab;
/** Gravity (1050 Flash px/s²). */
export const GRAVITY = 0x00255;
/** Fall speed clamp (500 Flash px/s). */
export const FALL_MAX = 0x042ab;
/** The take-off squat. */
export const SQUAT_FRAMES = 4;
/** The constant jump rise speed (400 Flash px/s). */
export const RISE = 0x03555;
/** Rise height above take-off (82 Flash px): the rise cap and its min line. */
export const RISE_PX = 41;
/** Upward speed damping while coasting with jump held (`0.5^dt`): Sophia's own. */
export const HOLD_DAMPING = 0.98851;
/** Upward speed damping after a release (`1e-11^dt`). */
export const RELEASE_DAMPING = 0.65564;
/** A head bump sends her down at this (100 Flash px/s). */
export const BUMP_VY = 0x00d55;
/** Wall jump push away from a wall (130 Flash px). */
export const WALL_PUSH_PX = 65;
/** Jump away from a ceiling (82 Flash px). */
export const CEILING_PUSH_PX = 41;

/* Water (SO-18). */
/** "Up" or "down" alone thrusts this (900 Flash px/s²). */
export const SWIM_THRUST = 0x00200;
/** Vertical cap under water (190 Flash px/s). */
export const SWIM_VMAX = 0x01955;
/** Neither or both: upward speed damping (`0.01^dt`). */
export const SWIM_UP_DAMP = 0.92612;
/** Neither or both: downward speed damping (`1e-7^dt`). */
export const SWIM_DOWN_DAMP = 0.76441;
/** Neither or both: she sinks this many px a frame (a position shift, not a speed). */
export const SWIM_SINK_SUB = 128; // 0.5 px in subpixels
/** "Down" pressed while still: this downward speed (100 Flash px/s). */
export const SWIM_DOWN_KICK = 0x00d55;
/** Horizontal cap off the floor (130 Flash px/s), and with jump held (200). */
export const SWIM_X_MAX = 0x01155;
export const SWIM_X_FAST = 0x01aab;
/** On the sea floor (`walksSlowUnderWater`, 90 Flash px/s). */
export const SWIM_FLOOR_MAX = 0x00c00;
/** On a wall or ceiling under water (80 Flash px/s). */
export const SWIM_WALL_MAX = 0x00aab;
/** A jump in water rises this far (130 Flash px), or RISE_PX with "down" held. */
export const SWIM_RISE_PX = 65;

/* Hover (SO-35). */
/** Thrust each frame while hovering (40 Flash px/s per update, not scaled by dt). */
export const HOVER_THRUST = 0x00555;
/** The thrust stops adding upward speed past this (100 Flash px/s). */
export const HOVER_VMAX = 0x00d55;
export const HOVER_CELLS = 8;
/** A cell drains every 18 frames of hover (300 ms) and refills every 120 frames off it (2 s). */
export const HOVER_DRAIN = 18;
export const HOVER_FILL = 120;

/* Weapons (SO-28 to SO-32). */
/** Every Sophia projectile is clamped to this (425 Flash px/s). */
export const SHOT_SPEED = 0x038ab;
export const MAX_CANNON_SHOTS = 3;
/** Frames "up" must be held before the cannon points away from the surface (3 × 50 ms). */
export const CANNON_RAISE_FRAMES = 9;
/** The missile's acceleration along its axis (700 Flash px/s²). */
export const MISSILE_ACCEL = 0x0018e;
/** The outer missiles' sideways start speed (120 Flash px/s) and its decay (`0.6^dt`). */
export const MISSILE_SIDE = 0x01000;
export const MISSILE_SIDE_DECAY = 0.99152;
export const TRIPLE_COST = 3;
export const TRIPLE_START = 9;
export const TRIPLE_MAX = 60;
/** A repeat Flower adds this much Triple ammo (or HOMING_REPEAT Homing). */
export const TRIPLE_REPEAT = 12;
export const HOMING_START = 3;
export const HOMING_MAX = 20;
export const HOMING_REPEAT = 4;
/** Ammo a drop gives: Triple +6 (two volleys), Homing +2. */
export const TRIPLE_DROP = 6;
export const HOMING_DROP = 2;
export const MAX_HOMING_OUT = 4;
/** Homing: thrust grows by this each frame (3000 Flash px/s² per second). */
export const HOMING_THRUST_STEP = 0.0069444;
export const HOMING_DAMP = 0.96235;
/** Homing with no target explodes after this. */
export const HOMING_IDLE = 120;

/* Wall and ceiling climbing (SO-36). */
/** An inside corner (a wall ahead) and an outside corner (driving round an edge). */
export const TURN_INSIDE = 12;
export const TURN_OUTSIDE = 14;
/** How far ahead (px) a wall, ceiling or floor starts an inside turn. */
export const TURN_REACH = 12;
/** Inside turn end: her centre this far from the corner along the new surface (CLIMB_OFS 24). */
export const INSIDE_END_PX = 12;
/** Outside turn end: her centre this far past the edge (CLIMB_INVERTED_OFS 8). */
export const OUTSIDE_END_PX = 4;
/** On the floor, a ledge wraps down when her centre is within this of the edge tile's centre. */
export const WRAP_REACH = 15;

/** Hurt: invulnerable 75 frames (1250 ms); pushed at full speed from rest, else 50 Flash px/s. */
export const HURT_INVULN = 75;
export const HURT_PUSH_SLOW = 0x006ab;

/** The hitbox: 19 × 15.5 upright, 15.5 × 19 on a wall (SO-3). */
export const TANK_W = 19;
export const TANK_H = 15.5;

/**
 * A full MovementProfile so shared code that reads one (the training tracker, the select screen)
 * keeps working; her own driving code (drive.ts) uses the constants above instead.
 */
export const SOPHIA_PROFILE: MovementProfile = {
  minWalk: MIN_SPEED,
  walkAccel: DRIVE_ACCEL,
  runAccel: DRIVE_ACCEL,
  releaseDecel: 0x00400,
  skidDecel: DRIVE_ACCEL,
  maxWalk: DRIVE_MAX,
  maxRun: DRIVE_MAX,
  skidTurnaround: 0,
  jump: [{ maxVx: Infinity, initial: RISE, holdGravity: GRAVITY, fallGravity: GRAVITY }],
  maxFall: FALL_MAX,
  fallReset: FALL_MAX,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: false,
  instantAccel: false,
  coyoteFrames: 0,
};

/*
 * Jason on foot (our own design, not in the original Crossover): Blaster Master's pilot, small
 * and slow, with a low jump. TUNED by feel against Blaster Master's side view (a slow walk, a
 * hop about two tiles high).
 */
export const JASON_W = 8;
export const JASON_H = 16;
/** A fall of more than this many px hurts him (about 5 tiles), as in Blaster Master. */
export const JASON_SAFE_FALL = 5 * 16;
/** Hopping out: up at 150 Flash px/s (SO-62's select-screen hop). */
export const JASON_HOP = 0x01400;

export const JASON_PROFILE: MovementProfile = {
  minWalk: 0x00200,
  walkAccel: 0x00100,
  runAccel: 0x00100,
  releaseDecel: 0x00200,
  skidDecel: 0x00300,
  maxWalk: 0x00e00, // 0.875 px/f
  maxRun: 0x00e00,
  skidTurnaround: 0x00400,
  // A hop of about three tiles with jump held (Blaster Master's Jason clears about that: up a
  // castle's three-block steps), a tile tapped.
  jump: [{ maxVx: Infinity, initial: 0x03800, holdGravity: 0x00200, fallGravity: 0x00500 }],
  maxFall: 0x04000,
  fallReset: 0x04000,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: true,
  instantAccel: false,
  coyoteFrames: 0,
};
