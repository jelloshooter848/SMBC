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
  {
    // Classic SMBC Samus's death (SA-C32, Samus.as SFX_SAMUS_DIE): the suit bursts and the call
    // falls apart, a quick chromatic spill from a high E down into a long low hum (about 2.4 s,
    // inside her 3 s die timer).
    id: 'samus-classic-death',
    bpm: 150,
    loop: false,
    pulse1: `
      @2 v12 q7 x0
      o6 l32 e d+ d c+ c o5 b a+ a l16 g+ f+ e d l8 c o4 a+ x1 g+2
    `,
    pulse2: `
      @1 v8 q7 x0
      o5 l32 b a+ a g+ g f+ f e l16 d+ c+ o4 b a l8 g f x1 d+2
    `,
    triangle: `
      q8 x0
      o3 e4 r8 o2 b8 a+8 a8 x1 e2
    `,
  },
];
