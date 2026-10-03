import type { MovementProfile } from '../profile';
import { MARIO_PROFILE } from '../mario/profile';

/**
 * Luigi in the Lost Levels style: the same engine as Mario but he jumps higher, accelerates a
 * little slower and slides further when stopping or turning. Deltas are tuned by feel against
 * the "one block higher" standing jump of SMB2J, not copied from any ROM. // TUNED
 */
export const LUIGI_PROFILE: MovementProfile = {
  ...MARIO_PROFILE,
  walkAccel: 0x00081, // Mario's 0x98 × 0.85
  runAccel: 0x000c2, // Mario's 0xe4 × 0.85
  releaseDecel: 0x00068, // half of Mario's: he keeps sliding
  skidDecel: 0x000d0, // half of Mario's
  jump: MARIO_PROFILE.jump.map((t) => ({ ...t, initial: t.initial + 0x00600 })), // +0.375 px/f
};
