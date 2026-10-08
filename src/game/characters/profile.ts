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
}

export function pickJumpTier(p: MovementProfile, vx: number): JumpTier {
  const a = Math.abs(vx);
  for (const t of p.jump) if (a < t.maxVx) return t;
  return p.jump[p.jump.length - 1] as JumpTier;
}
