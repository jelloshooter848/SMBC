import type { Song } from '@engine/audio/mml';

/**
 * The new file's opening scene (story/opening.ts, 0.4.31; it borrowed the toad house's tune
 * before): an original short loop, composed for this project. Morning at Mario's house (the
 * castle courtyard before 0.4.36), calm at first, then a turn to A minor as Toad comes running
 * with the note. Same conventions as
 * songs.ts: pulse1 = melody, pulse2 = harmony, triangle = bass, noise = drums; every channel the
 * same length.
 */

/** A bar of rolling eighths over a chord (each note with its own octave). */
const roll = (a: string, b: string, c: string): string => `[${a}8 ${b}8 ${c}8 ${b}8]2`;
/** A bar of the bass: the root for a half, its fifth, the root. */
const walk = (root: string, fifth: string): string => `o2 ${root}2 ${fifth}4 o2 ${root}4`;
// A light brush: hats with a soft snare on the backbeat.
const BRUSH = 'v4 h8 h8 v5 s4 v4 h8 h8 v5 s4';

export const openingSong: Song = {
  id: 'opening',
  bpm: 112,
  loop: true,
  // C major turning to A minor, 8 bars.
  pulse1: `
    @2 v9 q7 x0
    o5 e4 g4 o6 c4 o5 g4                    ; bar 1  C
    o5 a4. g8 e2                            ; bar 2  Am
    o5 f4 a4 o6 c4 o5 a8 f8                 ; bar 3  F
    o5 g2. r4                               ; bar 4  G
    o5 e8 f8 g4 o6 c4 e4                    ; bar 5  C
    o6 d4 c8 o5 a8 g4 e4                    ; bar 6  Am
    o5 f8 a8 o6 c8 o5 a8 g8 b8 o6 d8 o5 b8  ; bar 7  F G
    o5 a2 r2                                ; bar 8  Am
  `,
  pulse2: `
    @1 v5 q6 x0
    ${roll('o4 c', 'o4 e', 'o4 g')} ${roll('o3 a', 'o4 c', 'o4 e')} ${roll('o3 f', 'o3 a', 'o4 c')} ${roll('o3 g', 'o3 b', 'o4 d')}
    ${roll('o4 c', 'o4 e', 'o4 g')} ${roll('o3 a', 'o4 c', 'o4 e')} ${roll('o3 f', 'o3 a', 'o4 c')} ${roll('o3 a', 'o4 c', 'o4 e')}
  `,
  triangle: `
    q7
    ${walk('c', 'o2 g')} ${walk('a', 'o3 e')} ${walk('f', 'o3 c')} ${walk('g', 'o3 d')}
    ${walk('c', 'o2 g')} ${walk('a', 'o3 e')} ${walk('f', 'o3 c')} ${walk('a', 'o3 e')}
  `,
  noise: `
    [${BRUSH}]8                             ; bars 1-8
  `,
};
