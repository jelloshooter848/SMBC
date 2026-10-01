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
}

export function pickJumpTier(p: MovementProfile, vx: number): JumpTier {
  const a = Math.abs(vx);
  for (const t of p.jump) if (a < t.maxVx) return t;
  return p.jump[p.jump.length - 1] as JumpTier;
}
