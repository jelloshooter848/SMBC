import type { Song } from '@engine/audio/mml';

/**
 * World 7 as Bill's world (0.4.30): two original loops in the mood of an NES jungle run-and-gun
 * (composed for this project, nothing transcribed). The rest of World 7 reuses Bill's (contra.ts):
 * 7-1's bonus room, the base's corridors, plays his stage march `contra-stage`, 7-2's shore his
 * `contra-jungle` and 7-4's alien lair Red Falcon's `contra-lair`. Same conventions as songs.ts:
 * pulse1 = melody, pulse2 = harmony, triangle = bass, noise = drums; every channel the same
 * length.
 */

// The snowfield: a rock beat, kick and snare with eighth hats, doubled kick before the snare.
const SNOW_BAR = 'v11 k8 v6 h8 v10 s8 v6 h8 v11 k8 k8 v10 s8 v6 h8';
const SNOW_FILL = 'v11 k8 v6 h8 v10 s8 v6 h8 v10 s16 s16 s16 s16 v12 s8 s8';
// The river: a light jungle groove, soft kicks and rattling hats.
const RIVER_BAR = 'v8 k8 v5 h16 h16 v7 s8 v5 h8 v8 k8 v5 h8 v7 s8 v5 h16 h16';
const RIVER_FILL = 'v8 k8 v5 h16 h16 v7 s8 v5 h8 v7 s16 s16 s16 s16 v9 s8 s8';

/** A bar of sixteenth-note arpeggio (each note with its own octave). */
const arp16 = (a: string, b: string, c: string): string => `[${a}16 ${b}16 ${c}16 ${b}16]4`;
/** A bar of eighth-note arpeggio, up and back twice (each note with its own octave). */
const arp8 = (a: string, b: string, c: string): string => `[${a}8 ${b}8 ${c}8 ${b}8]2`;
/** A bar of octave-bouncing bass. */
const octaves = (n: string): string => `[o2 ${n}8 o3 ${n}8]4`;
/** A bar of the river's swaying bass: a dotted root, its octave, the root again. */
const sway = (n: string, o = 2): string => `o${o} ${n}4. ${n}8 o${o + 1} ${n}4 o${o} ${n}4`;

export const contraWorldSongs: Song[] = [
  {
    id: 'contra-snow',
    bpm: 152,
    loop: true,
    // F-sharp minor, 8 bars: 7-1's snowfield before the enemy base. A cold, driving call that
    // leaps up the chord and falls back, turning on C-sharp major, over sixteenth-note arpeggios
    // and a bouncing octave bass.
    pulse1: `
      @2 v10 q7 x0
      o4 f+8 a8 o5 c+8 o4 a8 o5 e4 c+4      ; bar 1  F#m
      o5 d8 c+8 o4 b8 a8 f+4 a4             ; bar 2  D
      o4 g+8 b8 o5 e8 o4 b8 o5 g+4 e4       ; bar 3  E
      o5 c+2 o4 g+4 e+4                     ; bar 4  C#
      o5 f+8 e8 c+8 o4 a8 o5 c+8 e8 f+4     ; bar 5  F#m
      o5 d8 c+8 o4 b8 f+8 b4 o5 d4          ; bar 6  Bm
      o5 a8 f+8 d8 o4 a8 o5 b8 g+8 e8 o4 b8 ; bar 7  D E
      o5 c+2 r4 o4 c+4                      ; bar 8  C#
    `,
    pulse2: `
      @1 v5 q6 x0
      ${arp16('o3 f+', 'o3 a', 'o4 c+')} ${arp16('o3 d', 'o3 f+', 'o3 a')} ${arp16('o3 e', 'o3 g+', 'o3 b')} ${arp16('o3 c+', 'o3 e+', 'o3 g+')}
      ${arp16('o3 f+', 'o3 a', 'o4 c+')} ${arp16('o3 b', 'o4 d', 'o4 f+')} ${arp16('o3 d', 'o3 f+', 'o3 a')} ${arp16('o3 c+', 'o3 e+', 'o3 g+')}
    `,
    triangle: `
      q6
      ${octaves('f+')} ${octaves('d')} ${octaves('e')} ${octaves('c+')}
      ${octaves('f+')} ${octaves('b')} ${octaves('d')} ${octaves('c+')}
    `,
    noise: `
      [${SNOW_BAR}]7 ${SNOW_FILL}           ; bars 1-8
    `,
  },
  {
    id: 'contra-river',
    bpm: 120,
    loop: true,
    // D minor, 8 bars: 7-2 as the jungle river. A long, swaying line over rippling eighth-note
    // arpeggios and a rocking bass, a light jungle groove on the drums; it turns on A major.
    pulse1: `
      @2 v9 q8 x1
      o4 d4. a8 g8 f8 e8 d8                 ; bar 1  Dm
      o4 e4. g8 c2                          ; bar 2  C
      o4 f4. b-8 o5 d8 f8 d8 o4 b-8         ; bar 3  Bb
      o4 a2 c+4 e4                          ; bar 4  A
      o4 f8 g8 a8 o5 c8 d4 c4               ; bar 5  Dm
      o4 b-8 a8 g8 f8 g4 d4                 ; bar 6  Gm
      o4 e8 f8 g8 a8 c+4 e4                 ; bar 7  A
      o4 d1                                 ; bar 8  Dm
    `,
    pulse2: `
      @1 v4 q6 x1
      ${arp8('o3 d', 'o3 a', 'o4 d')} ${arp8('o3 c', 'o3 g', 'o4 c')} ${arp8('o3 b-', 'o4 d', 'o4 f')} ${arp8('o3 a', 'o4 c+', 'o4 e')}
      ${arp8('o3 d', 'o3 a', 'o4 d')} ${arp8('o3 g', 'o3 b-', 'o4 d')} ${arp8('o3 a', 'o4 c+', 'o4 e')} ${arp8('o3 d', 'o3 a', 'o4 d')}
    `,
    triangle: `
      q7
      ${sway('d')} ${sway('c')} ${sway('b-', 1)} ${sway('a', 1)}
      ${sway('d')} ${sway('g', 1)} ${sway('a', 1)} ${sway('d')}
    `,
    noise: `
      [${RIVER_BAR}]7 ${RIVER_FILL}         ; bars 1-8
    `,
  },
];
