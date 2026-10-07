import type { Sfx } from '@engine/audio/mml';

/** Sounds of Bill's jungle and his mini game (see sfx.ts for the MML notes). */
export const contraSfx: Sfx[] = [
  // A bridge segment blowing up: a sharp crack, a long rumbling burst, a low tone falling away.
  {
    id: 'bridge-boom',
    pulse: '@0 v12 q8 x1 p-24 o3 c4.',
    noise: 'v15 x0 l32 n3 n6 x1 l4 n12 l4. n15',
  },
  // A weapon badge caught: a quick bright run up two octaves.
  {
    id: 'falcon',
    pulse: '@2 v12 q8 x0 l32 o5 c e g o6 c e g o7 c16',
    pulse2: '@1 v6 q8 x0 l32 r32 o5 e g o6 c e g o7 c16',
  },
  // Bill hit: a yelp that tumbles down, then the thud of landing on his back.
  {
    id: 'contra-death',
    pulse: '@2 v12 q8 x1 l16 o5 c o4 g e c p-12 o3 g4',
    noise: 'v10 x1 l16 n4 r16 r8 r8 v14 l8 n14 l4 n15',
  },
  // The spread gun: a short low crack with a hiss, five shots at once.
  { id: 'spread', pulse: '@3 v9 q8 x1 p-5 o4 g32', noise: 'v12 x1 l64 n2 n4 n6 n8' },
  // The laser: a high zap sliding down two octaves.
  { id: 'laser', pulse: '@1 v11 q8 x1 p-24 o7 c8', pulse2: '@3 v6 q8 x1 p-24 o6 g8' },
  // The code entered (30 lives): a fast climbing arpeggio to a held top C over a bass climb.
  {
    id: 'konami',
    pulse: '@2 v12 q7 x0 l16 o5 c e g o6 c e g q8 o7 c4',
    pulse2: '@1 v8 q7 x0 l16 o4 g o5 c e g o6 c e q8 g4',
    triangle: 'q7 l16 o3 c c e e g g q8 o4 c4',
  },
];
