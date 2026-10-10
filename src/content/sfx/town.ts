import type { Sfx } from '@engine/audio/mml';

/*
 * Kakariko Village's sounds (0.4.41), all original: the chime of a hero switch (the puff of smoke
 * on SELECT) and the hen's flustered cluck when walked into.
 */
export const townSfx: Sfx[] = [
  // A soft two-step chime up a fourth, with a breath of noise for the puff (about 300 ms).
  { id: 'hero-switch', pulse: '@2 v9 q8 x0 l32 o6 c f a x1 o7 c8', noise: 'v4 x1 l16 n2' },
  // Two quick clucks and a squawk.
  { id: 'hen', pulse: '@0 v8 q6 x1 l64 o5 a o5 f r64 o5 a o5 f r32 p5 o6 c32' },
];
