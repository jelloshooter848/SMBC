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

/**
 * A slide (Down + Jump on the ground; Mega Man). The first three fields are today's slide: it runs
 * `frames` frames at `speed` with a `hitboxH` tall body. The optional fields are Classic SMBC's
 * (2026-10-07-megaman-classic-smbc-rules.md MM-C5..MM-C9), set only by Classic profiles; absent,
 * today's slide runs unchanged (TG-23).
 */
export interface SlideProfile {
  speed: number;
  frames: number;
  hitboxH: number;
  /**
   * The slide ends once the body has moved this many px from where it started (MM-C5), not after
   * `frames`; it also ends at a wall in front, on leaving the ground (a normal fall from there), and
   * (with `reverseCancel`) when the other direction is pressed (MM-C6). Player.classicSlide.
   */
  distance?: number | undefined;
  /**
   * Under a low ceiling (a solid tile in the band from 15 px above the slide body's top to 5 px above
   * its bottom, MM-C7) the slide never ends: not at `distance`, a wall or the other direction, which
   * turns it round instead and ends it as soon as the ceiling clears. Needs `distance`.
   */
  ceilingHold?: boolean | undefined;
  /** The other direction ends the slide where he is (vx 0; MM-C6). Needs `distance`. */
  reverseCancel?: boolean | undefined;
  /** Jump during a slide, with Down up and no ceiling (`ceilingHold`'s band), jumps out of it (MM-C9). */
  jumpOut?: boolean | undefined;
  /** A slide carries the hero over one-tile gaps (Player.crossSmallGap, MM-C8); walking drops in. */
  crossGaps?: boolean | undefined;
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
  slide?: SlideProfile | undefined;
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
   * ---- Classic SMBC optional fields (no Current profile sets any of these; TG-23) ----
   * `softCut` keeps the name and meaning the Mario/Luigi slice gave it (ML-C), so the two merge.
   */
  /**
   * Soft jump cut, a 16.16 factor (`Math.trunc(vy * softCut / 65536)` per frame): the first release
   * of jump in a jump arms it, and from then on upward speed is damped every frame (before
   * gravity and the move) until the hero starts to fall; a later release does nothing. Never during
   * a spring or Rush launch. Mega Man 0.7943 (52055, MM-C11). Absent: `variableJump`'s rules.
   */
  softCut?: number | undefined;
  /**
   * With `airControl: 'full'`, no direction held in the air sets vx to 0 (Mega Man MM-C4, SI-C6,
   * LK-C5). Absent: vx is kept (today's airMove).
   */
  airStop?: true | undefined;
  /**
   * A step nudge (Mega Man MM-C2): pressing a direction on the ground while not already moving that
   * way moves the body `px` that way at once and holds vx at 0 for `frames` frames (the step pose);
   * then a held direction walks as usual. Absent: none.
   */
  step?: { px: number; frames: number } | undefined;
}

export function pickJumpTier(p: MovementProfile, vx: number): JumpTier {
  const a = Math.abs(vx);
  for (const t of p.jump) if (a < t.maxVx) return t;
  return p.jump[p.jump.length - 1] as JumpTier;
}

/** A 16.16 damping factor applied to a velocity, truncated toward 0 (MovementProfile.softCut). */
export function damp(v: number, k: number): number {
  return Math.trunc((v * k) / 65536);
}
