import type { Song } from '@engine/audio/mml';

/**
 * World 8 as Sophia's world (0.4.31): two original loops in the mood of an NES tank-and-dungeon
 * game (composed for this project, nothing transcribed). The rest of World 8 reuses Sophia's
 * (sophia.ts): 8-1's forest plays the Underworld's area march `bm-area` and the coin rooms the
 * dungeon's `bm-dungeon`. Same conventions as songs.ts: pulse1 = melody, pulse2 = harmony,
 * triangle = bass, noise = drums; every channel the same length.
 */

// The techno castle: a driving machine beat, doubled kick before the snare.
const TECHNO_BAR = 'v11 k8 v6 h16 h16 v10 s8 v6 h8 v11 k8 k8 v10 s8 v6 h8';
const TECHNO_FILL = 'v11 k8 v6 h8 v10 s8 v6 h8 v10 s16 s16 s16 s16 v12 s8 s8';
// The ice: a soft, slow tread.
const ICE_BAR = 'v7 k4 v4 h8 h8 v6 s4 v4 h8 h8';
const ICE_FILL = 'v7 k4 v4 h8 h8 v6 s8 s16 s16 v8 s8 s8';

/** A bar of sixteenth-note figure rocking over three notes (each note with its own octave). */
const osc = (a: string, b: string, c: string): string => `[${a}16 ${b}16 ${c}16 ${b}16]4`;
/** A bar of octave-bouncing bass. */
const octaves = (n: string): string => `[o2 ${n}8 o3 ${n}8]4`;
/** Broken thirds glinting in sixteenths for a bar. */
const glint = (a: string, b: string): string => `[${a}16 ${b}16]8`;
/** A bar of the ice's slow bass: a dotted root, its pick-up, the octave, the root. */
const drift = (n: string): string => `o2 ${n}4. ${n}8 o3 ${n}4 o2 ${n}4`;

export const blasterWorldSongs: Song[] = [
  {
    id: 'bm-techno',
    bpm: 160,
    loop: true,
    // D minor, 8 bars: 8-2's techno castle. A hard-edged line climbing the chord and running back,
    // over rocking sixteenths and a bouncing octave bass, turning on A major's C-sharp.
    pulse1: `
      @2 v10 q7 x0
      o4 d8 f8 a8 o5 d8 c8 o4 a8 f8 a8      ; bar 1  Dm
      o4 a+4 o5 d4 f4 d8 o4 a+8             ; bar 2  Bb
      o5 c8 e8 g8 e8 c8 o4 g8 e8 g8         ; bar 3  C
      o4 a4 o5 c+4 e2                       ; bar 4  A
      o5 d8 d8 f8 d8 a8 g8 f8 e8            ; bar 5  Dm
      o5 d4 o4 a+8 g8 a+4 o5 d4             ; bar 6  Gm
      o5 f8 e8 d8 c8 e8 d8 c8 o4 a+8        ; bar 7  C
      o4 a2 o5 c+4 e4                       ; bar 8  A
    `,
    pulse2: `
      @1 v5 q6 x0
      ${osc('o3 d', 'o3 f', 'o3 a')} ${osc('o3 a+', 'o4 d', 'o4 f')} ${osc('o3 c', 'o3 e', 'o3 g')} ${osc('o3 c+', 'o3 e', 'o3 a')}
      ${osc('o3 d', 'o3 f', 'o3 a')} ${osc('o3 g', 'o3 a+', 'o4 d')} ${osc('o3 c', 'o3 e', 'o3 g')} ${osc('o3 c+', 'o3 e', 'o3 a')}
    `,
    triangle: `
      q6
      ${octaves('d')} ${octaves('a+')} ${octaves('c')} ${octaves('a')}
      ${octaves('d')} ${octaves('g')} ${octaves('c')} ${octaves('a')}
    `,
    noise: `
      [${TECHNO_BAR}]7 ${TECHNO_FILL}       ; bars 1-8
    `,
  },
  {
    id: 'bm-ice',
    bpm: 132,
    loop: true,
    // E minor, 8 bars: 8-3's frozen ruins. A slow, cold call leaping up an octave and settling,
    // over glinting broken thirds and a drifting bass, turning on B major's D-sharp.
    pulse1: `
      @2 v9 q7 x0
      o5 e4 b4 o6 e4 d8 o5 b8              ; bar 1  Em
      o5 c4. e8 g2                          ; bar 2  C
      o5 f+4 a4 o6 d4 c8 o5 a8              ; bar 3  D
      o5 b2. d+4                            ; bar 4  B
      o5 g8 f+8 e8 f+8 g4 b4                ; bar 5  Em
      o5 a4 o6 c4 e4 d8 c8                  ; bar 6  Am
      o5 b8 a8 g8 e8 f+8 g8 a8 f+8          ; bar 7  C D
      o5 b2 r4 d+4                          ; bar 8  B
    `,
    pulse2: `
      @0 v4 q5 x0
      ${glint('o4 g', 'o4 b')} ${glint('o4 g', 'o5 c')} ${glint('o4 f+', 'o4 a')} ${glint('o4 f+', 'o4 b')}
      ${glint('o4 g', 'o4 b')} ${glint('o4 a', 'o5 c')} ${glint('o4 g', 'o4 a')} ${glint('o4 f+', 'o4 b')}
    `,
    triangle: `
      q7
      ${drift('e')} ${drift('c')} ${drift('d')} ${drift('b')}
      ${drift('e')} ${drift('a')} ${drift('c')} ${drift('b')}
    `,
    noise: `
      [${ICE_BAR}]7 ${ICE_FILL}             ; bars 1-8
    `,
  },
];
