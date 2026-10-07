import type { Song } from '@engine/audio/mml';

/**
 * Short jingles of the mini game heroes' own starts (original; see songs.ts for the channel
 * notes). Every channel has the same length.
 */
export const heroJingles: Song[] = [
  {
    // ZEBES ESCAPE: Samus materialising before the escape (scene.ts APPEAR_FRAMES, 2.5 s): a cool
    // rising call in E minor that hangs on a high B, over a low pedal and a slow walk up.
    id: 'zebes-start',
    bpm: 144,
    loop: false,
    pulse1: `
      @2 v11 q8 x0
      o4 e8 b8 o5 e8 f+8 g4 f+8 e8 x1 b2
    `,
    pulse2: `
      @1 v7 q8 x0
      o4 b8 o5 e8 g8 a8 b4 a8 g8 x1 f+2
    `,
    triangle: `
      q8 x0
      o2 e2 c4 d4 x1 e2
    `,
  },
];
