import type { Sfx } from '@engine/audio/mml';

/**
 * The mini game heroes' own death sounds (WorldStart.deathStyle, game/world/death-style.ts), each
 * in place of Mario's `death` jingle. Original sounds (see sfx.ts for the MML notes).
 */
export const deathSfx: Sfx[] = [
  // Mega Man's burst: a bright falling warble that tumbles down three times and fades (about 1 s).
  {
    id: 'mm-death',
    pulse: '@2 v12 q8 x0 l64 [o6 g e c o5 g e c]3 x1 o5 c8',
    pulse2: '@1 v6 q8 x0 l64 r32 [o5 g e c o4 g e c]3 x1 o4 c8',
  },
  // Samus breaking apart: a crackle of noise over a long sliding drop.
  {
    id: 'samus-death',
    pulse: '@0 v12 q8 x1 p-24 o4 c4',
    pulse2: '@3 v8 q8 x0 l32 o6 c o5 g o6 c o5 g x1 p-12 o5 c8',
    noise: 'v14 x0 l32 n2 n5 n3 n6 n4 n8 l16 n9 n11 x1 l8 n13 n15',
  },
  // Simon falling: a short, sad descending call that settles low (about 1.3 s).
  {
    id: 'cv-death',
    pulse: '@2 v11 q7 x0 l16 o5 e d+ e c o4 a b g+ a x1 o4 e4',
    pulse2: '@1 v7 q7 x0 l16 o4 a a a e e e e e x1 o3 a4',
    triangle: 'q8 x0 l8 o2 a e f e x1 o2 a4',
  },
  // Ryu struck down: a sharp slash of hiss, then a low falling thud.
  {
    id: 'ng-death',
    pulse: '@1 v12 q8 x1 p-12 o5 a16 r32 p-12 o4 e8',
    triangle: 'q8 x1 p-12 o2 e8',
    noise: 'v12 x1 l64 n0 n1 n2 l32 n5 l16 n10 n13',
  },
];
