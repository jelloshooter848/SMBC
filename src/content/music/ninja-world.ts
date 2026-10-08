import type { Song } from '@engine/audio/mml';

/**
 * World 6 as Ryu's world (0.4.29): three original loops in the mood of the NES ninja action
 * games (composed for this project, nothing transcribed). The rest of World 6 reuses Ryu's
 * (ninja.ts): 6-1's bamboo field plays his stage tune `ng-stage`, 6-4's demon temple the Masked
 * Ninja's `ng-boss`, 6-2 and its coin heaven keep the city's `ng-city`. Same conventions as
 * songs.ts: pulse1 = melody, pulse2 = harmony, triangle = bass, noise = drums; every channel the
 * same length.
 */

// The sewers: a creeping kick-snare bar with eighth hats.
const SEWER_BAR = 'v10 k8 v5 h8 h8 v9 s8 v10 k8 v5 h8 v9 s8 v5 h8';
const SEWER_FILL = 'v10 k8 v5 h8 h8 v9 s8 v9 s16 s16 s16 s16 v11 s8 s8';
// The pass: kick, snare and running hats, a doubled kick before the second snare.
const PASS_BAR = 'v11 k8 v6 h16 h16 v10 s8 v6 h16 h16 v11 k8 k8 v10 s8 v6 h16 h16';
const PASS_FILL = 'v11 k8 v6 h16 h16 v10 s8 v6 h16 h16 v10 s16 s16 s16 s16 v12 s16 s16 s16 s16';

/** A bar of eighth-note arpeggio, up and back twice. */
const arp8 = (a: string, b: string, c: string): string => `[${a}8 ${b}8 ${c}8 ${b}8]2`;
/** A bar of sixteenth-note arpeggio. */
const arp16 = (a: string, b: string, c: string): string => `[${a}16 ${b}16 ${c}16 ${b}16]4`;
/** A bar of octave-bouncing bass. */
const octaves = (n: string): string => `[o2 ${n}8 o3 ${n}8]4`;
/** A bar of the sewers' prowling bass: root, root, octave, root. */
const prowl = (n: string): string => `[o2 ${n}8 o2 ${n}8 o3 ${n}8 o2 ${n}8]2`;

export const ninjaWorldSongs: Song[] = [
  {
    id: 'ng-sewer',
    bpm: 132,
    loop: true,
    // E minor, 8 bars: 6-2's coin rooms as the city's sewers. A clipped, sneaking figure that
    // answers itself a third higher and turns on B major's D-sharp, over a prowling bass.
    pulse1: `
      @2 v10 q5 x0
      o4 e8 r8 e8 g8 f+8 e8 d8 e8           ; bar 1  Em
      o4 c8 r8 c8 e8 d8 c8 o3 b8 o4 c8      ; bar 2  C
      o4 a8 r8 a8 o5 c8 o4 b8 a8 g8 a8      ; bar 3  Am
      o4 b4 a+8 b8 f+4 d+4                  ; bar 4  B
      o5 e8 d8 o4 b8 g8 e8 g8 b8 o5 d8      ; bar 5  Em
      o5 c8 o4 b8 g8 e8 c8 e8 g8 b8         ; bar 6  C
      o4 a8 o5 c8 e8 c8 o4 b8 a8 g8 f+8     ; bar 7  Am
      o4 b2 r4 o3 b4                        ; bar 8  B
    `,
    pulse2: `
      @1 v5 q5 x0
      ${arp8('o3 e', 'g', 'b')} ${arp8('o3 c', 'e', 'g')} ${arp8('o3 a', 'o4 c', 'e')} ${arp8('o3 b', 'o4 d+', 'f+')}
      ${arp8('o3 e', 'g', 'b')} ${arp8('o3 c', 'e', 'g')} ${arp8('o3 a', 'o4 c', 'e')} ${arp8('o3 b', 'o4 d+', 'f+')}
    `,
    triangle: `
      q5
      ${prowl('e')} ${prowl('c')} ${prowl('a')} ${prowl('b')}
      ${prowl('e')} ${prowl('c')} ${prowl('a')} ${prowl('b')}
    `,
    noise: `
      [${SEWER_BAR}]7 ${SEWER_FILL}         ; bars 1-8
    `,
  },
  {
    id: 'ng-harbor',
    bpm: 100,
    loop: true,
    // D minor, 8 bars: 6-2's water area as the night harbour. A swaying, dotted lead over
    // rippling eighth-note arpeggios and one held root a bar; the waves wash against the piers.
    pulse1: `
      @2 v9 q8 x1
      o4 d4. f8 a4 g8 f8                    ; bar 1  Dm
      o4 f4. d8 o3 b-2                      ; bar 2  Bb
      o4 c4. e8 g4 f8 e8                    ; bar 3  C
      o4 e2 c+4 o3 a4                       ; bar 4  A
      o4 a4. g8 f4 a8 o5 d8                 ; bar 5  Dm
      o5 c4. o4 b-8 g2                      ; bar 6  Gm
      o4 a8 g8 f8 e8 c+4 e4                 ; bar 7  A
      o4 d1                                 ; bar 8  Dm
    `,
    pulse2: `
      @1 v4 q6 x1
      ${arp8('o3 d', 'a', 'o4 d')} ${arp8('o3 b-', 'o4 d', 'f')} ${arp8('o3 c', 'g', 'o4 c')} ${arp8('o3 a', 'o4 c+', 'e')}
      ${arp8('o3 d', 'a', 'o4 d')} ${arp8('o3 g', 'b-', 'o4 d')} ${arp8('o3 a', 'o4 c+', 'e')} ${arp8('o3 d', 'a', 'o4 d')}
    `,
    triangle: `
      q8
      o2 d1 o1 b-1 o2 c1 o1 a1 o2 d1 o1 g1 a1 o2 d1 ; bars 1-8: one held root a bar
    `,
    noise: `
      [v4 x1 k4 v2 h4 v3 h4 v2 h4]8         ; bars 1-8: the waves against the piers
    `,
  },
  {
    id: 'ng-pass',
    bpm: 160,
    loop: true,
    // A minor, 8 bars: 6-3's snowy mountain pass. A driving climb that leaps a fourth at every
    // bar's start and turns on E major, over sixteenth-note arpeggios and an octave bass.
    pulse1: `
      @2 v11 q7 x0
      o4 e8 a8 b8 o5 c8 o4 b8 a8 e8 a8      ; bar 1  Am
      o4 d8 g8 a8 b8 a8 g8 d8 g8            ; bar 2  G
      o4 c8 f8 g8 a8 o5 c4 o4 a4            ; bar 3  F
      o4 g+8 b8 o5 e4 d8 c8 o4 b4           ; bar 4  E
      o5 e8 e8 d8 c8 d8 e8 a4               ; bar 5  Am
      o5 g8 f8 e8 d8 e4 o4 b4               ; bar 6  G
      o5 c8 d8 e8 f8 e8 d8 c8 o4 b8         ; bar 7  F
      o4 b2 g+4 e4                          ; bar 8  E
    `,
    pulse2: `
      @1 v6 q6 x0
      ${arp16('o3 a', 'o4 c', 'e')} ${arp16('o3 g', 'b', 'o4 d')} ${arp16('o3 f', 'a', 'o4 c')} ${arp16('o3 e', 'g+', 'b')}
      ${arp16('o3 a', 'o4 c', 'e')} ${arp16('o3 g', 'b', 'o4 d')} ${arp16('o3 f', 'a', 'o4 c')} ${arp16('o3 e', 'g+', 'b')}
    `,
    triangle: `
      q6
      ${octaves('a')} ${octaves('g')} ${octaves('f')} ${octaves('e')}
      ${octaves('a')} ${octaves('g')} ${octaves('f')} ${octaves('e')}
    `,
    noise: `
      [${PASS_BAR}]7 ${PASS_FILL}           ; bars 1-8
    `,
  },
];
