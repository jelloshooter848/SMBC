import type { Sfx } from '@engine/audio/mml';

/*
 * Kakariko Village's sounds (0.4.41), all original: the chime of a hero switch (the puff of smoke
 * on SELECT) and the hen's flustered cluck when walked into; since 0.4.42 the shop's purchase
 * jingle and the little fanfare of Hobb's Wallet.
 */
export const townSfx: Sfx[] = [
  // A soft two-step chime up a fourth, with a breath of noise for the puff (about 300 ms).
  { id: 'hero-switch', pulse: '@2 v9 q8 x0 l32 o6 c f a x1 o7 c8', noise: 'v4 x1 l16 n2' },
  // Two quick clucks and a squawk.
  { id: 'hen', pulse: '@0 v8 q6 x1 l64 o5 a o5 f r64 o5 a o5 f r32 p5 o6 c32' },
  // The purchase: a bright till-bell ding-ding and a falling coin's ring (about 400 ms).
  { id: 'shop-buy', pulse: '@1 v10 q7 x0 l32 o6 e g o7 c r32 o6 g o7 c e8', noise: 'v3 x1 l32 r8 n1' },
  // The Wallet: a short rising fanfare, up a major triad and a held top note (about 700 ms).
  { id: 'wallet', pulse: '@2 v10 q8 x0 l16 o5 g o6 c e g16. e32 g4' },
];
