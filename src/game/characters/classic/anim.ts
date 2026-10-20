import type { Player } from '../../entities/player';

/**
 * Classic SMBC animation timing and hurt boxes measured from the original 3.1.21 (F2 fidelity
 * pass: AnimationTimers.as and each hero's .as for the timers, the SWF's per-frame HRect bounds
 * for the boxes). Game frames at 60 fps; px = Flash px / 2.
 */

/**
 * Walk cycles (CharacterDef.walkAnim): poses and game frames per pose. Link 4 x 100 ms (ANIM_SLOW),
 * Simon 4 x 115 ms (ANIM_VERY_SLOW), Mega Man 4 x 100 ms after his step frame, Ryu 5 x 75 ms
 * (ANIM_MODERATE), Bill's legs 4 x 115 ms, Samus 3 x 50 ms (ANIM_MIN_FAST).
 */
export const CLASSIC_WALK = {
  link: { frames: 4, ticks: 6 },
  simon: { frames: 4, ticks: 6.9 },
  megaman: { frames: 4, ticks: 6 },
  ryu: { frames: 5, ticks: 4.5 },
  bill: { frames: 4, ticks: 6.9 },
  samus: { frames: 3, ticks: 3 },
} as const;

/** Our three drawn walk poses (walk-0..2) for a 4-pose cycle: A, B, C, B (Mega Man's order). */
export const WALK_ABCB: readonly number[] = [0, 1, 2, 1];
/** Link's two alternating poses (walkStart / walk-2 / walk-3 / walkEnd: A, B, A, B). */
export const WALK_ABAB: readonly number[] = [0, 2, 0, 2];
/** Ryu's five run frames over our three poses. */
export const WALK_RYU: readonly number[] = [0, 1, 2, 1, 0];

/** The sheet's walk pose for this frame of the cycle (`walk-<n>`). */
export function walkPose(p: Player, poses: readonly number[]): number {
  return poses[p.walkFrame % poses.length] ?? 0;
}

/**
 * Hurt boxes (CharacterDef.hurtbox), px, from the SWF's HRect per frame: width 13.5 for every
 * hero but Mario (13).
 */
export const CLASSIC_HURT = {
  w: 13.5,
  link: 15,
  samus: { stand: 31, air: 25, crouch: 15.5, ball: 13 },
  simon: { stand: 30, jump: 25, crouch: 15.75 },
  megaman: { stand: 24, jump: 27.5, slide: 15 },
  ryu: { stand: 27, air: 25, crouch: 15.75 },
  bill: { stand: 31.5, jump: 16.25, prone: 15 },
  mario: { w: 13, small: 15, big: 28, crouch: 15 },
} as const;

/** Link's somersault: one pose every 140 ms (flipTmr, Link.as), 5 steps a turn. */
export const LINK_FLIP_TICKS = 8.4;
/** Ryu's flip: 5 frames at 33 ms (ANIM_FAST) for FLIP_TMR 400 ms after every jump (Ryu.as). */
export const RYU_FLIP_FRAMES = 24;
export const RYU_FLIP_TICKS = 2;
/** Samus's somersault: 4 frames at 33 ms (ANIM_FAST). */
export const SAMUS_FLIP_TICKS = 2;
