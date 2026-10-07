import type { Sfx } from '@engine/audio/mml';

/** Sounds of Simon's crypt and his mini game (see sfx.ts for the MML notes). */
export const castlevaniaSfx: Sfx[] = [
  // A cracked wall giving way: a falling stone thud under a rumble that tumbles down to gravel.
  {
    id: 'whip-wall',
    pulse: '@0 v12 q8 x1 p-7 o3 e8',
    triangle: 'q8 x1 p-12 o2 c8',
    noise: 'v13 x1 l32 n4 n7 n9 l16 n11 n13 n15',
  },
  // A candle struck out: a quick falling chirp and a puff of hiss (about 150 ms).
  { id: 'candle', pulse: '@1 v9 q8 x1 p-5 o6 c32', noise: 'v8 x1 l64 n0 n1 n2 n3' },
  // Dracula vanishing or appearing: a shimmering run of falling arpeggios that settles on one note.
  {
    id: 'dracula-teleport',
    pulse: '@2 v10 q8 x0 l64 o6 c o5 g e c o6 d o5 a f d o6 e o5 b g e x1 o5 c8',
    pulse2: '@1 v5 q8 x0 l64 r32 o5 g e c o4 g o5 a f d o4 a o5 b g e x1 o4 b8',
  },
  // The beast's roar: a low growl that slides down and breaks into a rasp.
  {
    id: 'beast-roar',
    pulse: '@0 v14 q8 x0 p-3 o2 g4 x1 p-7 o2 e4',
    triangle: 'q8 x1 p-12 o2 c2',
    noise: 'v14 x0 l16 n12 n14 n13 n15 n14 n15 x1 l8 n15',
  },
];
