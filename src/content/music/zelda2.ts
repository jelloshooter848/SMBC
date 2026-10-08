import type { Song } from '@engine/audio/mml';

/**
 * World 2 as Hyrule (0.4.24): three original pieces in the mood of the NES Zelda II, composed for
 * this project (nothing transcribed), for the looks past 2-1's field (looks.ts `zelda2-field`):
 * 2-2's lake, 2-4's palace and 2-1's caves. Each is its theme's music (schema.ts themeMusic) and
 * its level's `campaignMusic`. Same conventions as songs.ts: pulse1 = melody, pulse2 = harmony,
 * triangle = bass, noise = drums; every channel the same length.
 */

// One 3/4 bar of rippling eighths over a chord: root, fifth, octave, tenth, octave, fifth.
const ripple = (a: string, b: string, c: string, d: string): string => `${a}8 ${b}8 ${c}8 ${d}8 ${c}8 ${b}8`;
// One bar of eighths pulsing between two chord tones.
const pulse = (a: string, b: string): string => `[${a}8 ${b}8]4`;
// One bar of a galloping bass on note `n` from octave `o`.
const gallop = (n: string, o: number): string => `[o${o} ${n}8 ${n}16 ${n}16 o${o + 1} ${n}8 o${o} ${n}8]2`;

const PALACE_BAR = 'v10 k8 v5 h16 h16 v9 s8 v5 h8 v10 k8 k8 v9 s8 v5 h8';
const PALACE_FILL = 'v10 k8 v5 h8 v9 s8 v5 h8 v9 s16 s16 v10 s8 v11 s8 s8';

export const zelda2Songs: Song[] = [
  {
    id: 'zelda2-water',
    bpm: 132,
    loop: true,
    // D minor waltz (3/4), 16 bars: the lake over the sunken palace (2-2's look). A calm, rising
    // lead over rippling eighth arpeggios and an oom-pah-pah bass; A major turns it home.
    pulse1: `
      @1 v10 q8 x0
      o5 d4 f4 a4                     ; bar 1  Dm
      o6 d2 o5 a4                     ; bar 2
      o5 b-2 a4                       ; bar 3  Bb
      o5 f2.                          ; bar 4
      o5 e4 g4 o6 c4                  ; bar 5  C
      o5 b-2 a4                       ; bar 6
      o5 e4 c+4 e4                    ; bar 7  A
      o5 a2.                          ; bar 8
      o5 f4 a4 o6 d4                  ; bar 9  Dm
      o6 e4 f4 e4                     ; bar 10
      o6 d2 o5 b-4                    ; bar 11 Gm
      o5 g2.                          ; bar 12
      o5 f4 g4 b-4                    ; bar 13 Bb
      o5 a4 g4 e4                     ; bar 14 C
      o5 c+4 e4 a4                    ; bar 15 A
      o5 e2 c+4                       ; bar 16
    `,
    pulse2: `
      @0 v6 q7 x0
      [${ripple('o3 d', 'a', 'o4 d', 'f')}]2       ; bars 1-2   Dm
      [${ripple('o3 b-', 'o4 d', 'f', 'b-')}]2     ; bars 3-4   Bb
      [${ripple('o4 c', 'e', 'g', 'o5 c')}]2       ; bars 5-6   C
      [${ripple('o3 a', 'o4 c+', 'e', 'a')}]2      ; bars 7-8   A
      [${ripple('o3 d', 'a', 'o4 d', 'f')}]2       ; bars 9-10  Dm
      [${ripple('o3 g', 'b-', 'o4 d', 'g')}]2      ; bars 11-12 Gm
      ${ripple('o3 b-', 'o4 d', 'f', 'b-')}        ; bar 13     Bb
      ${ripple('o4 c', 'e', 'g', 'o5 c')}          ; bar 14     C
      [${ripple('o3 a', 'o4 c+', 'e', 'a')}]2      ; bars 15-16 A
    `,
    triangle: `
      q7
      [o2 d4 a4 a4]2                  ; bars 1-2
      [o2 b-4 o3 f4 f4]2              ; bars 3-4
      [o2 c4 g4 g4]2                  ; bars 5-6
      [o2 a4 o3 e4 e4]2               ; bars 7-8
      [o2 d4 a4 a4]2                  ; bars 9-10
      [o2 g4 o3 d4 d4]2               ; bars 11-12
      o2 b-4 o3 f4 f4                 ; bar 13
      o2 c4 g4 g4                     ; bar 14
      [o2 a4 o3 e4 e4]2               ; bars 15-16
    `,
    noise: `
      [v7 k4 v4 h4 h4]16              ; soft waltz brushes
    `,
  },
  {
    id: 'zelda2-palace',
    bpm: 144,
    loop: true,
    // E minor, 16 bars: Link's palace (2-4's look). A stern lead with snapped dotted figures over
    // driving eighths and a galloping bass; it climbs to C and D and turns on B major's D-sharp.
    pulse1: `
      @2 v11 q7 x0
      o4 e8 g8 b8 o5 e8 d8. o4 b16 g8 b8      ; bar 1  Em
      o5 e4 f+8 g8 f+4 e4                     ; bar 2  Em
      o5 e8 c8 o4 g8 o5 c8 e4 g4              ; bar 3  C
      o5 f+4. e8 d4 o4 a4                     ; bar 4  D
      o4 b8 o5 e8 g8 b8 a8. g16 f+8 e8        ; bar 5  Em
      o5 g4 a8 b8 a4 g4                       ; bar 6  Em
      o5 g8 e8 c8 e8 g4 o6 c4                 ; bar 7  C
      o5 b2 d+4 f+4                           ; bar 8  B
      o5 a4. g8 e4 c4                         ; bar 9  Am
      o5 a8 o6 c8 e8 c8 o5 a2                 ; bar 10 Am
      o5 g4. f+8 e4 o4 b4                     ; bar 11 Em
      o5 e8 g8 b8 o6 e8 o5 b2                 ; bar 12 Em
      o5 c8 e8 g8 o6 c8 o5 b4 g4              ; bar 13 C
      o5 a8 f+8 d8 f+8 a4 o6 d4               ; bar 14 D
      o5 d+4 f+4 b4 a4                        ; bar 15 B
      o5 f+2 d+4 o4 b4                        ; bar 16 B
    `,
    pulse2: `
      @1 v5 q5 x0
      ${pulse('o4 e', 'b')} ${pulse('o4 e', 'b')} ${pulse('o4 c', 'g')} ${pulse('o4 d', 'a')}
      ${pulse('o4 e', 'b')} ${pulse('o4 e', 'b')} ${pulse('o4 c', 'g')} ${pulse('o3 b', 'o4 f+')}
      ${pulse('o4 e', 'a')} ${pulse('o4 e', 'a')} ${pulse('o4 e', 'b')} ${pulse('o4 e', 'b')}
      ${pulse('o4 c', 'g')} ${pulse('o4 d', 'a')} ${pulse('o3 b', 'o4 f+')} ${pulse('o3 b', 'o4 f+')}
    `,
    triangle: `
      q6
      ${gallop('e', 2)} ${gallop('e', 2)} ${gallop('c', 2)} ${gallop('d', 2)}
      ${gallop('e', 2)} ${gallop('e', 2)} ${gallop('c', 2)} ${gallop('b', 1)}
      ${gallop('a', 1)} ${gallop('a', 1)} ${gallop('e', 2)} ${gallop('e', 2)}
      ${gallop('c', 2)} ${gallop('d', 2)} ${gallop('b', 1)} ${gallop('b', 1)}
    `,
    noise: `
      [${PALACE_BAR}]7 ${PALACE_FILL}   ; bars 1-8
      [${PALACE_BAR}]7 ${PALACE_FILL}   ; bars 9-16
    `,
  },
  {
    id: 'zelda2-cave',
    bpm: 96,
    loop: true,
    // A minor, 8 bars: a Hyrule cave (2-1's bonus room and the Moblin's cave). A slow, sparse
    // lead over a low throb and long bass notes; water drips in the dark.
    pulse1: `
      @1 v9 q7 x0
      o4 e4 a4 o5 c4 o4 b4            ; bar 1  Am
      o4 a2. r4                       ; bar 2
      o4 f4 a4 o5 c4 o4 b4            ; bar 3  F
      o4 g+2. r4                      ; bar 4  E
      o4 e4 a4 o5 c4 e4               ; bar 5  Am
      o5 d2 c4 o4 b4                  ; bar 6  Dm
      o4 b4 g+4 f4 e4                 ; bar 7  E
      o4 e2. r4                       ; bar 8
    `,
    pulse2: `
      @1 v4 q4 x0
      [o3 a8 r8]4 [o3 a8 r8]4 [o3 f8 r8]4 [o3 e8 r8]4
      [o3 a8 r8]4 [o3 d8 r8]4 [o3 e8 r8]4 [o3 e8 r8]4
    `,
    triangle: `
      q8
      o2 a1 a1 f1 e1 a1 d1 e1 e1
    `,
    noise: `
      [v4 h8 r8 r4 v3 h8 r8 r4]8      ; drips
    `,
  },
];
