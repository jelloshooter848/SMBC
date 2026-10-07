import type { Song } from '@engine/audio/mml';

/**
 * Sophia's Underworld and her mini game: five original pieces in the mood of an NES
 * tank-and-dungeon game (composed for this project, nothing transcribed). Same conventions as
 * songs.ts: pulse1 = melody, pulse2 = harmony, triangle = bass, noise = drums; every channel the
 * same length.
 */

// The area's march: kick, hats and a snare with a sixteenth pick-up into the next bar.
const MARCH_BAR = 'v11 k8 v6 h8 v10 s8 v6 h8 v11 k8 k8 v10 s8 v8 s16 s16';
const MARCH_FILL = 'v11 k8 v8 s16 s16 v10 s8 v8 s16 s16 v12 s16 s16 s16 s16 v13 s8 s8';
// The dungeon's slow tread: a kick, a snare, ticking hats.
const TREAD_BAR = 'v8 k4 v4 h8 h8 v7 s4 v4 h8 h8';
// The boss's gallop.
const BOSS_BAR = '[v12 k16 k16 v11 s8 v7 h16 h16 v11 s8]2';
const BOSS_FILL = 'v12 k16 k16 v11 s8 v7 h16 h16 v11 s8 v12 s16 s16 s16 s16 v14 s16 s16 s16 s16';

// Off-beat stabs (a bar of eighths: rest, chord tone, rest, chord tone, twice).
const stab = (a: string, b: string): string => `[r8 ${a}8 r8 ${b}8]2`;
// The march bass: root, root, fifth, root in eighths, twice a bar.
const march = (root: string, fifth: string): string => `[o2 ${root}8 ${root}8 ${fifth}8 o2 ${root}8]2`;
// A sixteenth-note figure rocking over three notes for a bar.
const osc = (a: string, b: string, c: string): string => `[${a}16 ${b}16 ${c}16 ${b}16]4`;
// The boss's galloping bass: two sixteenths and an eighth, four times a bar.
const gallop = (n: string): string => `[o2 ${n}16 ${n}16 o3 ${n}8]4`;
// The garage's rolling eighths over a chord, twice a bar.
const roll = (a: string, b: string, c: string): string => `[${a}8 ${b}8 ${c}8 ${b}8]2`;
// Broken octaves shimmering in sixteenths for a bar.
const shimmer = (a: string, b: string): string => `[${a}16 ${b}16]8`;

export const sophiaSongs: Song[] = [
  {
    id: 'bm-area',
    bpm: 152,
    loop: true,
    // A minor, 8 bars: the Underworld's stage march, Sophia rolling out. A bright line that
    // leaps up the chord and runs back down, answered a step higher; it turns on E major's G-sharp.
    pulse1: `
      @2 v11 q7 x0
      o4 a8 o5 c8 e8 a8 g8 e8 c8 d8           ; bar 1  Am
      o5 c4. o4 a8 f4 a4                      ; bar 2  F
      o4 g8 b8 o5 d8 g8 f8 d8 o4 b8 o5 c8     ; bar 3  G
      o5 d4 o4 b8 g+8 e2                      ; bar 4  E
      o5 e8. e16 a8 e8 g8 f8 e8 d8            ; bar 5  Am
      o5 f4 d8 f8 a4 g4                       ; bar 6  Dm
      o5 c8 d8 e8 f8 g8 f8 e8 d8              ; bar 7  G
      o5 e4 d8 c8 o4 b4 g+4                   ; bar 8  E
    `,
    pulse2: `
      @1 v6 q4 x0
      ${stab('o4 c', 'o4 e')} ${stab('o4 c', 'o4 f')} ${stab('o4 d', 'o4 g')} ${stab('o4 g+', 'o4 b')}
      ${stab('o4 c', 'o4 e')} ${stab('o4 d', 'o4 f')} ${stab('o4 d', 'o4 g')} ${stab('o4 g+', 'o4 b')}
    `,
    triangle: `
      q6
      ${march('a', 'o3 e')} ${march('f', 'o3 c')} ${march('g', 'o3 d')} ${march('e', 'o2 b')}
      ${march('a', 'o3 e')} ${march('d', 'o2 a')} ${march('g', 'o3 d')} ${march('e', 'o2 b')}
    `,
    noise: `
      [${MARCH_BAR}]7 ${MARCH_FILL}            ; bars 1-8
    `,
  },
  {
    id: 'bm-dungeon',
    bpm: 120,
    loop: true,
    // D minor, 8 bars: Jason on foot in the overhead dungeon. A wary lead that leans on the flat
    // second (E-flat) over a rocking sixteenth figure and a bass that creeps by half steps.
    pulse1: `
      @1 v9 q6 x0
      o4 d4 e-4 d4 r4                         ; bar 1  Dm
      o4 a4 b-4 a2                            ; bar 2
      o4 d4 f4 e4 c+4                         ; bar 3
      o4 d2. r4                               ; bar 4
      o5 d4 e-4 d8 c8 o4 b-8 a8               ; bar 5  Bb
      o4 g4 a4 b-2                            ; bar 6  Gm
      o4 a8 b-8 a8 g8 f4 e4                   ; bar 7  A
      o4 d2 c+2                               ; bar 8  A
    `,
    pulse2: `
      @2 v5 q5 x0
      ${osc('o3 d', 'o3 a', 'o4 d')} ${osc('o3 d', 'o3 a', 'o4 d')}
      ${osc('o3 d', 'o3 a', 'o4 d')} ${osc('o3 d', 'o3 a', 'o4 d')}
      ${osc('o3 b-', 'o4 f', 'o4 b-')} ${osc('o3 g', 'o4 d', 'o4 g')}
      ${osc('o3 a', 'o4 e', 'o4 a')} ${osc('o3 a', 'o4 c+', 'o4 e')}
    `,
    triangle: `
      q7
      o2 d4 r4 d4 e-4                         ; bar 1
      o2 d4 r4 d4 c+4                         ; bar 2
      o2 d4 r4 d4 e-4                         ; bar 3
      o2 d4 c4 o1 b-4 a4                      ; bar 4
      o1 b-4 r4 b-4 o2 c4                     ; bar 5
      o1 g4 r4 g4 a4                          ; bar 6
      o1 a4 r4 a4 b-4                         ; bar 7
      o1 a4 b4 o2 c+4 o1 a4                   ; bar 8
    `,
    noise: `
      [${TREAD_BAR}]8                         ; bars 1-8
    `,
  },
  {
    id: 'bm-boss',
    bpm: 172,
    loop: true,
    // C minor, 8 bars: the Plutonium Boss. Hammered stabs that snap up to the tritone (F-sharp),
    // churning sixteenth arpeggios and a galloping bass.
    pulse1: `
      @2 v12 q6 x0
      o5 c8 c8 r8 c8 e-8 c8 g8 f+8            ; bar 1  Cm
      o5 g4 f+8 e-8 c4 r4                     ; bar 2  Cm
      o4 a-8 a-8 r8 a-8 o5 c8 o4 a-8 o5 e-8 d8 ; bar 3  Ab
      o5 d4 o4 b8 g8 f+4 g4                   ; bar 4  G
      o5 c16 d16 e-8 g8 e-8 c8 e-8 g8 o6 c8   ; bar 5  Cm
      o6 c4 o5 b8 a-8 g4 f+4                  ; bar 6  F#dim
      o5 e-8 d8 c8 o4 b8 o5 c8 d8 e-8 f8      ; bar 7  Ab
      o5 g4 g8 f+8 g2                         ; bar 8  G
    `,
    pulse2: `
      @1 v6 q5 x0
      ${osc('o4 c', 'o4 e-', 'o4 g')} ${osc('o4 c', 'o4 e-', 'o4 g')}
      ${osc('o3 a-', 'o4 c', 'o4 e-')} ${osc('o3 g', 'o3 b', 'o4 d')}
      ${osc('o4 c', 'o4 e-', 'o4 g')} ${osc('o3 f+', 'o3 a', 'o4 c')}
      ${osc('o3 a-', 'o4 c', 'o4 e-')} ${osc('o3 g', 'o3 b', 'o4 d')}
    `,
    triangle: `
      q6
      ${gallop('c')} ${gallop('c')} ${gallop('a-')} ${gallop('g')}
      ${gallop('c')} ${gallop('f+')} ${gallop('a-')} ${gallop('g')}
    `,
    noise: `
      [${BOSS_BAR}]7 ${BOSS_FILL}              ; bars 1-8
    `,
  },
  {
    id: 'bm-garage',
    bpm: 96,
    loop: true,
    // F major, 8 bars: Sophia's garage, calm and warm. A slow singing lead over rolling eighths
    // and a bass in half notes; a soft shaker.
    pulse1: `
      @1 v9 q7 x0
      o5 c4 o4 a8 b-8 o5 c2                   ; bar 1  F
      o5 d4 c8 o4 b-8 a2                      ; bar 2  Bb
      o4 g4 a8 b-8 o5 c4 d4                   ; bar 3  Gm
      o5 c2. r4                               ; bar 4  C
      o5 f4 e8 d8 c4 o4 a4                    ; bar 5  F
      o5 d4 c8 o4 b-8 a4 f4                   ; bar 6  Dm
      o4 g4 a4 b-4 o5 e4                      ; bar 7  C7
      o5 f2. r4                               ; bar 8  F
    `,
    pulse2: `
      @2 v5 q5 x0
      ${roll('o4 f', 'o4 a', 'o5 c')} ${roll('o4 f', 'o4 b-', 'o5 d')}
      ${roll('o4 d', 'o4 g', 'o4 b-')} ${roll('o4 e', 'o4 g', 'o5 c')}
      ${roll('o4 f', 'o4 a', 'o5 c')} ${roll('o4 d', 'o4 f', 'o4 a')}
      ${roll('o4 e', 'o4 g', 'o4 b-')} ${roll('o4 f', 'o4 a', 'o5 c')}
    `,
    triangle: `
      q7
      o2 f2 o3 c2 o2 b-2 f2 o2 g2 d2 o2 c2 o1 g2      ; bars 1-4
      o2 f2 o3 c2 o2 d2 a2 o2 c2 e2 o2 f2 o3 c2      ; bars 5-8
    `,
    noise: `
      [v4 h8 v2 h8]32                         ; bars 1-8
    `,
  },
  {
    id: 'bm-cutscene',
    bpm: 84,
    loop: true,
    // A minor, 8 bars: the opening, Fred and the glowing chest. A slow, wondering lead over
    // shimmering broken octaves, whole-note bass and a low roll that swells into the loop.
    pulse1: `
      @2 v10 q8 x0
      o4 e2 a4 b4                             ; bar 1  Am
      o5 c2. o4 b8 a8                         ; bar 2  F
      o4 f2 a4 o5 d4                          ; bar 3  Dm
      o4 g+1                                  ; bar 4  E
      o4 a2 o5 c4 e4                          ; bar 5  Am
      o5 f2. e8 d8                            ; bar 6  F
      o5 d2 c4 o4 b4                          ; bar 7  Dm
      o4 b1                                   ; bar 8  E
    `,
    pulse2: `
      @1 v5 q6 x0
      ${shimmer('o4 a', 'o5 e')} ${shimmer('o4 a', 'o5 c')} ${shimmer('o4 a', 'o5 d')} ${shimmer('o4 g+', 'o5 e')}
      ${shimmer('o4 a', 'o5 e')} ${shimmer('o4 a', 'o5 c')} ${shimmer('o4 a', 'o5 d')} ${shimmer('o4 g+', 'o5 e')}
    `,
    triangle: `
      q8
      o2 a1 f1 d1 e1 a1 f1 d1 e1              ; bars 1-8
    `,
    noise: `
      [v2 x1 l8 n13 r8 n13 r8 n13 r8 n13 r8]7 ; bars 1-7: a low roll
      v4 l16 n13 n13 n13 n13 v6 n13 n13 n13 n13 v8 n13 n13 n13 n13 v10 n13 n13 n13 n13 ; bar 8: swelling
    `,
  },
];
