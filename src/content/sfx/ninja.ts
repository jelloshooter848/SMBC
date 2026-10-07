import type { Sfx } from '@engine/audio/mml';

/** Sounds of Ryu's hideout and his mini game (see sfx.ts for the MML notes). */
export const ninjaSfx: Sfx[] = [
  // The trick wall turning: a whoosh that swells and falls under a wooden creak, then a clack.
  {
    id: 'panel-spin',
    pulse: '@0 v9 q8 x0 p12 o3 c16 p-12 o4 c16 x1 o2 g16',
    noise: 'v10 x0 l32 n12 n10 n8 n6 n4 n6 n8 n10 x1 l16 n13',
  },
  // A blade cutting the air: a quick bright hiss that rises.
  { id: 'slash', pulse: '@3 v8 q8 x1 p12 o5 c32', noise: 'v12 x1 l64 n3 n1 n0 l32 n0' },
  // A hawk's cry: a high note that bends up, then a long falling screech.
  {
    id: 'hawk',
    pulse: '@2 v10 q8 x0 p3 o6 e32 x1 p-7 o6 g8',
    pulse2: '@1 v5 q8 x1 r64 p-7 o6 b8',
  },
  // Blades meeting: two high, slightly clashing rings that fade, over a sharp click.
  { id: 'clang', pulse: '@1 v13 q8 x1 o7 c+8', pulse2: '@2 v9 q8 x1 o7 g8', noise: 'v12 x1 l64 n0 n1' },
];
