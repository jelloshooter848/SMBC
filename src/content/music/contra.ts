import type { Song } from '@engine/audio/mml';

/**
 * Bill's jungle under 7-3 and his mini game: five original pieces in the mood of an NES jungle
 * run-and-gun (composed for this project, nothing transcribed). Same conventions as songs.ts:
 * pulse1 = melody, pulse2 = harmony, triangle = bass, noise = drums; every channel the same length.
 */

// Rock beats: kick and snare with hats; the stage's march rolls its snares in sixteenths.
const JUNGLE_BAR = 'v11 k8 v6 h8 v10 s8 v6 h8 v11 k8 k8 v10 s8 v6 h8';
const JUNGLE_FILL = 'v11 k8 v6 h8 v10 s8 v6 h8 v10 s16 s16 s16 s16 v12 s8 s8';
const MARCH_BAR = 'v11 k8 v8 s16 s16 v10 s8 v8 s16 s16 v11 k8 v8 s16 s16 v10 s8 v6 h8';
const MARCH_FILL = 'v11 k8 v8 s16 s16 v10 s8 v8 s16 s16 v11 s16 s16 s16 s16 v13 s8 s8';
const BOSS_BAR = '[v12 k16 k16 v11 s8 v7 h16 h16 v11 s8]2';
const BOSS_FILL = 'v12 k16 k16 v11 s8 v7 h16 h16 v11 s8 v12 s16 s16 s16 s16 v14 s16 s16 s16 s16';

// Off-beat stabs (a bar of eighths: rest, chord tone, rest, chord tone, twice).
const stab = (a: string, b: string): string => `[r8 ${a}8 r8 ${b}8]2`;
// The jungle's driving bass: root, root, octave, root in eighths, twice a bar.
const drive = (n: string): string => `[o2 ${n}8 ${n}8 o3 ${n}8 o2 ${n}8]2`;
// The stage's march bass: root, root, fifth, root (the fifth given with its octave).
const march = (root: string, fifth: string): string => `[o2 ${root}8 ${root}8 ${fifth}8 o2 ${root}8]2`;
// Power-chord eighths: two notes rocking for a bar.
const rock = (a: string, b: string): string => `[${a}8 ${b}8]4`;
// Sixteenth-note arpeggios (the boss's churn).
const arp = (a: string, b: string, c: string): string => `[${a}16 ${b}16 ${c}16 ${b}16]4`;
// The boss's galloping bass: two sixteenths and an eighth, four times a bar.
const gallop = (n: string): string => `[o2 ${n}16 ${n}16 o3 ${n}8]4`;
// The lair's heartbeat: lub-dub twice a bar.
const beat = (n: string): string => `[o2 ${n}16 r16 ${n}8 r4]2`;
// A trembling sixteenth-note tremolo between two notes for a bar.
const tremble = (a: string, b: string): string => `[${a}16 ${b}16]8`;

export const contraSongs: Song[] = [
  {
    id: 'contra-jungle',
    bpm: 144,
    loop: true,
    // D minor, 8 bars: 7-3 in the jungle and Bill's camp. A heroic, dotted call that climbs a
    // fifth and answers itself, over off-beat stabs and a driving octave bass; it turns on A.
    pulse1: `
      @2 v11 q7 x0
      o4 d8. d16 a8 d8 o5 c8 o4 a8 g8 f8      ; bar 1  Dm
      o4 f4 g8 a8 b-4 a4                      ; bar 2  Bb
      o4 g8. g16 o5 c8 o4 g8 o5 e8 d8 c8 o4 b-8 ; bar 3  C
      o4 a2 r8 a16 b-16 o5 c8 d8              ; bar 4  Dm
      o5 c8. c16 f8 c8 a8 g8 f8 e8            ; bar 5  F
      o5 d4 e8 f8 e4 c4                       ; bar 6  C
      o5 d8. d16 g8 d8 b-8 a8 g8 f8           ; bar 7  Gm
      o5 e4 c+8 e8 a4 r4                      ; bar 8  A
    `,
    pulse2: `
      @1 v6 q4 x0
      ${stab('o4 f', 'o4 a')} ${stab('o4 f', 'o4 b-')} ${stab('o4 e', 'o4 g')} ${stab('o4 f', 'o4 a')}
      ${stab('o4 a', 'o5 c')} ${stab('o4 g', 'o5 c')} ${stab('o4 g', 'o4 b-')} ${stab('o4 a', 'o5 c+')}
    `,
    triangle: `
      q6
      ${drive('d')} ${drive('b-')} ${drive('c')} ${drive('d')}
      ${drive('f')} ${drive('c')} ${drive('g')} ${drive('a')}
    `,
    noise: `
      [${JUNGLE_BAR}]7 ${JUNGLE_FILL}   ; bars 1-8
    `,
  },
  {
    id: 'contra-stage',
    bpm: 160,
    loop: true,
    // E minor, 8 bars: Bill's mini game, a driving jungle march. Snapped pick-up sixteenths into
    // a rising line, power-chord eighths under it, a marching root-fifth bass and rolling snares;
    // it turns on B major's D-sharp.
    pulse1: `
      @2 v12 q7 x0
      o4 e16 e16 r8 e8 g8 b8 a8 g8 b8         ; bar 1  Em
      o5 c4 o4 b8 a8 g4 e4                    ; bar 2  C
      o4 f+16 f+16 r8 f+8 a8 o5 d8 c8 o4 b8 a8 ; bar 3  D
      o4 b2 a8 g8 f+8 d+8                     ; bar 4  B
      o5 e8. e16 d8 e8 g8 f+8 e8 d8           ; bar 5  Em
      o5 d4 o4 b8 g8 o5 d4 g4                 ; bar 6  G
      o5 c8. c16 e8 c8 a8 g8 f+8 e8           ; bar 7  Am
      o5 d+4 f+8 d+8 o4 b4 r4                 ; bar 8  B
    `,
    pulse2: `
      @1 v6 q5 x0
      ${rock('o3 b', 'o4 e')} ${rock('o4 c', 'g')} ${rock('o3 a', 'o4 d')} ${rock('o3 b', 'o4 d+')}
      ${rock('o3 b', 'o4 e')} ${rock('o4 d', 'g')} ${rock('o4 c', 'e')} ${rock('o3 b', 'o4 f+')}
    `,
    triangle: `
      q6
      ${march('e', 'b')} ${march('c', 'g')} ${march('d', 'a')} ${march('b', 'o3 f+')}
      ${march('e', 'b')} ${march('g', 'o3 d')} ${march('a', 'o3 e')} ${march('b', 'o3 f+')}
    `,
    noise: `
      [${MARCH_BAR}]7 ${MARCH_FILL}     ; bars 1-8
    `,
  },
  {
    id: 'contra-boss',
    bpm: 176,
    loop: true,
    // B minor, 8 bars: the defense wall. Faster than the stage: a jabbing hook over churning
    // arpeggios, a galloping bass and stamping double kicks; it leans on F-sharp major's A-sharp.
    pulse1: `
      @1 v12 q7 x0
      o4 b8 b8 o5 d8 o4 b8 o5 f+8 e8 d8 c+8   ; bar 1  Bm
      o5 d8 d8 g8 d8 f+4 e4                   ; bar 2  G
      o4 b8 b8 o5 d8 o4 b8 o5 a8 g8 f+8 e8    ; bar 3  Bm
      o5 f+2 e+4 c+4                          ; bar 4  F#
      o5 g8 f+8 e8 d8 e8 d8 c+8 o4 b8         ; bar 5  G
      o4 a8 b8 o5 c+8 e8 a4 g4                ; bar 6  A
      o5 b8 a8 f+8 d8 b8 a8 f+8 d8            ; bar 7  Bm
      o5 c+4 o4 a+4 f+4 r4                    ; bar 8  F#
    `,
    pulse2: `
      @2 v6 q6 x0
      ${arp('o3 b', 'o4 d', 'f+')} ${arp('o3 b', 'o4 d', 'g')} ${arp('o3 b', 'o4 d', 'f+')} ${arp('o3 a+', 'o4 c+', 'f+')}
      ${arp('o3 b', 'o4 d', 'g')} ${arp('o3 a', 'o4 c+', 'e')} ${arp('o3 b', 'o4 d', 'f+')} ${arp('o3 a+', 'o4 c+', 'f+')}
    `,
    triangle: `
      q6
      ${gallop('b')} ${gallop('g')} ${gallop('b')} ${gallop('f+')}
      ${gallop('g')} ${gallop('a')} ${gallop('b')} ${gallop('f+')}
    `,
    noise: `
      [${BOSS_BAR}]7 ${BOSS_FILL}       ; bars 1-8
    `,
  },
  {
    id: 'contra-lair',
    bpm: 112,
    loop: true,
    // E minor with a flat second (F), 8 bars: Red Falcon's lair. A slow lead that slides a
    // half step and back over a trembling harmony and a heartbeat in the bass; a wet throb on
    // the noise.
    pulse1: `
      @2 v10 q8 x0
      o4 e2. f4                               ; bar 1
      o4 e2 r4 d+4                            ; bar 2
      o4 g2. a-4                              ; bar 3
      o4 g1                                   ; bar 4
      o4 b2. o5 c4                            ; bar 5
      o4 b2 a+4 a4                            ; bar 6
      o4 g4 f4 e4 d+4                         ; bar 7
      o4 e1                                   ; bar 8
    `,
    pulse2: `
      @1 v5 q6 x0
      ${tremble('o3 b', 'o4 c')} ${tremble('o3 b', 'o4 c')} ${tremble('o4 d', 'e-')} ${tremble('o4 d', 'e-')}
      ${tremble('o4 e', 'f')} ${tremble('o4 e', 'f')} ${tremble('o4 d', 'e-')} ${tremble('o3 b', 'o4 c')}
    `,
    triangle: `
      q4
      ${beat('e')} ${beat('e')} ${beat('g')} ${beat('g')}
      ${beat('c')} ${beat('c')} ${beat('b')} ${beat('e')}
    `,
    noise: `
      [v6 x1 l16 n14 r16 n14 r16 r4 r2]8      ; bars 1-8: a wet throb on the beat
    `,
  },
  {
    id: 'contra-card',
    bpm: 140,
    loop: false,
    // Two bars: the stage card. Two stabbed hits on A, a quick climb, then a held high A over
    // a cymbal wash.
    pulse1: `
      @2 v12 q7 x0
      o4 a16 a16 r8 a16 a16 r8 o5 c8 d8 e8 g8 ; bar 1
      q8 o5 a2. r4                            ; bar 2
    `,
    pulse2: `
      @1 v8 q7 x0
      o4 e16 e16 r8 e16 e16 r8 a8 b8 o5 c8 e8 ; bar 1
      q8 o5 e2. r4                            ; bar 2
    `,
    triangle: `
      q7
      o2 a16 a16 r8 a16 a16 r8 a8 a8 a8 a8    ; bar 1
      q8 o2 a2. r4                            ; bar 2
    `,
    noise: `
      v12 s16 s16 r8 s16 s16 r8 v10 k8 s8 k8 s8 ; bar 1
      v12 x1 l2. n2 r4                        ; bar 2: a cymbal wash
    `,
  },
];
