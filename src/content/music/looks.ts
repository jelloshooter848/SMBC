import type { Song } from '@engine/audio/mml';

/**
 * The campaign looks of 2-1, 3-1 and 4-2 (0.4.12): three original pieces in the mood of the
 * heroes' NES games (composed for this project, nothing transcribed). Each is its look's theme
 * music (schema.ts themeMusic) and its `campaignMusic`. Same conventions as songs.ts: pulse1 =
 * melody, pulse2 = harmony, triangle = bass, noise = drums; every channel the same length.
 */

// One bar of sixteenth arpeggio over a chord (low, middle, high, middle).
const arp = (a: string, b: string, c: string): string => `[${a}16 ${b}16 ${c}16 ${b}16]4`;
// One bar of eighths bouncing between a root and its octave.
const bounce = (lo: string, hi: string): string => `[${lo}8 ${hi}8]4`;
// One bar of a rising four-note roll in sixteenths.
const roll = (a: string, b: string, c: string, d: string): string => `[${a}16 ${b}16 ${c}16 ${d}16]4`;
// A bar (two halves) of a skipping bass on note `n` from octave `o`: eighth, two sixteenths, the
// octave, eighth.
const skip = (n: string, o: number, halves = 2): string =>
  `[o${o} ${n}8 ${n}16 ${n}16 o${o + 1} ${n}8 o${o} ${n}8]${halves}`;
// One bar of Brinstar's syncopated bass: a dotted pick-up, a held off-beat, the octave.
const sync = (n: string): string => `o2 ${n}8. ${n}16 r8 ${n}8 o3 ${n}8 o2 ${n}8 r8 ${n}8`;
// Eighths pulsing between two chord tones (count bars of it).
const pulse = (a: string, b: string, count = 4): string => `[${a}8 ${b}8]${count}`;

const FIELD_BAR = 'v10 k8 v5 h8 v6 h8 v5 h8 v9 s8 v5 h8 v6 h8 v5 h8';
const FIELD_FILL = 'v10 k8 v5 h8 v9 s8 v5 h8 v9 s16 s16 v10 s8 v11 s8 s8';
const MM_BAR = 'v11 k8 v6 h16 h16 v10 s8 v6 h16 h16 v11 k8 k8 v10 s8 v6 h16 h16';
const MM_FILL = 'v11 k8 v6 h16 h16 v10 s8 v6 h16 h16 v10 s16 s16 s16 s16 v12 s16 s16 s8';
const CAVE_BAR = 'v8 k8 v4 h8 v6 s8 v4 h8 v8 k8 v4 h8 v6 s8 v4 h16 h16';

export const lookSongs: Song[] = [
  {
    id: 'zelda2-field',
    bpm: 152,
    loop: true,
    // A minor, 16 bars: Link's field (2-1's look). A bold, leaping lead with a snapped dotted
    // figure over running sixteenth arpeggios and an octave-bouncing bass; the D major in bar 7
    // gives it a Dorian lift, and it turns on E major's G-sharp back to the top.
    pulse1: `
      @2 v11 q7 x0
      o4 a8 o5 c8 e8 a8 g8. e16 c8 e8         ; bar 1  Am
      o5 f4 e8 d8 c4 o4 a4                    ; bar 2  F
      o4 b8 o5 d8 g8 b8 a8. g16 f8 d8         ; bar 3  G
      o4 g+4 b4 o5 e2                         ; bar 4  E
      o4 a8 o5 c8 e8 a8 o6 c8. o5 b16 a8 e8   ; bar 5  Am
      o5 f8 a8 o6 c8 o5 a8 g4 f4              ; bar 6  F
      o5 f+8 a8 o6 d8 o5 a8 f+4 d4            ; bar 7  D
      o5 e2 r8 o4 b8 o5 d8 e8                 ; bar 8  E
      o5 c4. o4 a8 o5 c8 f8 a8 f8             ; bar 9  F
      o5 d4. o4 b8 o5 d8 g8 b8 g8             ; bar 10 G
      o5 e8 a8 e8 c8 o4 a8 o5 c8 e8 a8        ; bar 11 Am
      o5 g8 f8 e8 d8 e2                       ; bar 12 Am
      o5 a4 g8 f8 e4 f4                       ; bar 13 F
      o5 g4 f8 e8 d4 o4 b4                    ; bar 14 G
      o4 b8 o5 c8 d8 e8 f8 e8 d8 c8           ; bar 15 E
      o4 b4 g+4 e4 r4                         ; bar 16 E
    `,
    pulse2: `
      @1 v5 q5 x0
      ${arp('o3 a', 'o4 c', 'e')} ${arp('o3 a', 'o4 c', 'f')} ${arp('o3 b', 'o4 d', 'g')} ${arp('o3 g+', 'o3 b', 'o4 e')}
      ${arp('o3 a', 'o4 c', 'e')} ${arp('o3 a', 'o4 c', 'f')} ${arp('o3 a', 'o4 d', 'f+')} ${arp('o3 g+', 'o3 b', 'o4 e')}
      ${arp('o3 a', 'o4 c', 'f')} ${arp('o3 b', 'o4 d', 'g')} ${arp('o3 a', 'o4 c', 'e')} ${arp('o3 a', 'o4 c', 'e')}
      ${arp('o3 a', 'o4 c', 'f')} ${arp('o3 b', 'o4 d', 'g')} ${arp('o3 g+', 'o3 b', 'o4 e')} ${arp('o3 g+', 'o3 b', 'o4 e')}
    `,
    triangle: `
      q6
      ${bounce('o2 a', 'o3 a')} ${bounce('o2 f', 'o3 f')} ${bounce('o2 g', 'o3 g')} ${bounce('o2 e', 'o3 e')}
      ${bounce('o2 a', 'o3 a')} ${bounce('o2 f', 'o3 f')} ${bounce('o2 d', 'o3 d')} ${bounce('o2 e', 'o3 e')}
      ${bounce('o2 f', 'o3 f')} ${bounce('o2 g', 'o3 g')} ${bounce('o2 a', 'o3 a')} ${bounce('o2 a', 'o3 a')}
      ${bounce('o2 f', 'o3 f')} ${bounce('o2 g', 'o3 g')} ${bounce('o2 e', 'o3 e')} ${bounce('o2 e', 'o3 e')}
    `,
    noise: `
      [${FIELD_BAR}]7 ${FIELD_FILL}   ; bars 1-8
      [${FIELD_BAR}]7 ${FIELD_FILL}   ; bars 9-16
    `,
  },
  {
    id: 'mm-stage-31',
    bpm: 160,
    loop: true,
    // E minor, 16 bars: Mega Man's night stage (3-1's look). A snapped, syncopated hook that
    // climbs to the octave over rising sixteenth rolls, a skipping bass and a rock beat with
    // sixteenth hats; it lifts to G and D in the second half and turns on B major's D-sharp.
    pulse1: `
      @2 v11 q7 x0
      o5 e8 e16 e16 g8 e8 b8 a8 g8 f+8        ; bar 1  Em
      o5 g4 e8 c8 e4. r8                      ; bar 2  C
      o5 f+8 f+16 f+16 a8 f+8 o6 d8 c+8 o5 a8 f+8 ; bar 3  D
      o5 b2 a8 f+8 d+8 f+8                    ; bar 4  B
      o5 e8 e16 e16 g8 e8 b8 a8 g8 b8         ; bar 5  Em
      o6 c4 o5 b8 g8 e4 g4                    ; bar 6  C
      o5 a4. f+8 d4 f+8 a8                    ; bar 7  D
      o5 a2 r8 a16 b16 o6 c+8 d8              ; bar 8  D
      o6 d4 o5 b8 g8 o6 d8 e8 d8 o5 b8        ; bar 9  G
      o5 a4 f+8 d8 a8 b8 a8 f+8               ; bar 10 D
      o5 g4 e8 c8 g8 a8 g8 e8                 ; bar 11 C
      o5 f+4 d+8 o4 b8 o5 f+4 a4              ; bar 12 B
      o5 b8 b16 b16 o6 d8 o5 b8 o6 g8 f+8 e8 d8 ; bar 13 G
      o6 f+4 e8 d8 a4 f+4                     ; bar 14 D
      o6 e8 d8 c8 o5 b8 a8 b8 o6 c8 d8        ; bar 15 C D
      o5 d+4 f+4 b4 r4                        ; bar 16 B
    `,
    pulse2: `
      @0 v6 q5 x0
      ${roll('o4 e', 'g', 'b', 'o5 e')} ${roll('o4 c', 'e', 'g', 'o5 c')} ${roll('o4 d', 'f+', 'a', 'o5 d')} ${roll('o3 b', 'o4 d+', 'f+', 'b')}
      ${roll('o4 e', 'g', 'b', 'o5 e')} ${roll('o4 c', 'e', 'g', 'o5 c')} ${roll('o4 d', 'f+', 'a', 'o5 d')} ${roll('o4 d', 'f+', 'a', 'o5 d')}
      ${roll('o3 g', 'b', 'o4 d', 'g')} ${roll('o4 d', 'f+', 'a', 'o5 d')} ${roll('o4 c', 'e', 'g', 'o5 c')} ${roll('o3 b', 'o4 d+', 'f+', 'b')}
      ${roll('o3 g', 'b', 'o4 d', 'g')} ${roll('o4 d', 'f+', 'a', 'o5 d')}
      [o4 c16 e16 g16 o5 c16]2 [o4 d16 f+16 a16 o5 d16]2 ${roll('o3 b', 'o4 d+', 'f+', 'b')}
    `,
    triangle: `
      q6
      ${skip('e', 2)} ${skip('c', 2)} ${skip('d', 2)} ${skip('b', 1)}
      ${skip('e', 2)} ${skip('c', 2)} ${skip('d', 2)} ${skip('d', 2)}
      ${skip('g', 1)} ${skip('d', 2)} ${skip('c', 2)} ${skip('b', 1)}
      ${skip('g', 1)} ${skip('d', 2)} ${skip('c', 2, 1)} ${skip('d', 2, 1)} ${skip('b', 1)}
    `,
    noise: `
      [${MM_BAR}]7 ${MM_FILL}         ; bars 1-8
      [${MM_BAR}]7 ${MM_FILL}         ; bars 9-16
    `,
  },
  {
    id: 'brinstar',
    bpm: 126,
    loop: true,
    // D minor, 16 bars: Samus in Brinstar (4-2's look). A broad, heroic lead of long notes and
    // leaps over a syncopated bass ostinato and a pulsing two-note counter line; a quiet beat. It
    // turns on A major's C-sharp in bars 8 and 16.
    pulse1: `
      @2 v10 q7 x0
      o4 d4 a4 o5 d4. c8                      ; bar 1  Dm
      o5 c4 o4 g4 e4. g8                      ; bar 2  C
      o4 f4 b-4 o5 d4. c8                     ; bar 3  Bb
      o4 g2. r4                               ; bar 4  C
      o5 d4 a4 f4. e8                         ; bar 5  Dm
      o5 e4 g4 c4. e8                         ; bar 6  C
      o5 d4 f4 b-4 a8 g8                      ; bar 7  Bb
      o5 a2 c+4 e4                            ; bar 8  A
      o5 b-4. a8 g4 d4                        ; bar 9  Gm
      o5 a4. g8 f4 d4                         ; bar 10 Dm
      o5 f4 g8 a8 b-4 o6 d4                   ; bar 11 Bb
      o6 c2 o5 g2                             ; bar 12 C
      o5 d8 f8 a8 o6 d8 c8 o5 a8 f8 a8        ; bar 13 Dm
      o5 g8 e8 c8 e8 g8 o6 c8 o5 g8 e8        ; bar 14 C
      o5 f4 d4 e4 g4                          ; bar 15 Bb C
      o5 d2 c+4 e4                            ; bar 16 Dm A
    `,
    pulse2: `
      @1 v5 q4 x0
      ${pulse('o4 f', 'a')} ${pulse('o4 e', 'g')} ${pulse('o4 d', 'f')} ${pulse('o4 e', 'g')}
      ${pulse('o4 f', 'a')} ${pulse('o4 e', 'g')} ${pulse('o4 d', 'f')} ${pulse('o4 c+', 'e')}
      ${pulse('o4 d', 'g')} ${pulse('o4 f', 'a')} ${pulse('o4 d', 'f')} ${pulse('o4 e', 'g')}
      ${pulse('o4 f', 'a')} ${pulse('o4 e', 'g')} ${pulse('o4 d', 'f', 2)} ${pulse('o4 e', 'g', 2)}
      ${pulse('o4 f', 'a', 2)} ${pulse('o4 c+', 'e', 2)}
    `,
    triangle: `
      q5
      ${sync('d')} ${sync('c')} ${sync('b-')} ${sync('c')}
      ${sync('d')} ${sync('c')} ${sync('b-')} ${sync('a')}
      ${sync('g')} ${sync('d')} ${sync('b-')} ${sync('c')}
      ${sync('d')} ${sync('c')} o2 b-8. b-16 r8 b-8 c8. c16 r8 c8 o2 d8. d16 r8 d8 a8. a16 r8 a8
    `,
    noise: `
      [${CAVE_BAR}]16                 ; bars 1-16
    `,
  },
];
