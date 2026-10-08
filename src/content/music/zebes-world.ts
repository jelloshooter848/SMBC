import type { Song } from '@engine/audio/mml';

/**
 * World 4 as Samus's world, Zebes (0.4.27): two original pieces in the mood of the NES Metroid,
 * composed for this project (nothing transcribed): the planet's surface (4-1 and 4-2's overworld
 * areas, `crateria`) and Norfair (4-3). Each is its theme's music (schema.ts themeMusic) and its
 * levels' `campaignMusic`; the bonus rooms reuse Brinstar's tune (`brinstar`, looks.ts) and 4-4's
 * Mother Brain's lair ZEBES ESCAPE's `tourian` (songs.ts). Same conventions as songs.ts: pulse1 =
 * melody, pulse2 = harmony, triangle = bass, noise = drums; every channel the same length.
 */

// One bar of eighth-note arpeggio, a broken chord climbing twice.
const arp = (a: string, b: string, c: string, d: string): string => `[${a}8 ${b}8 ${c}8 ${d}8]2`;
// One bar of a pulsing bass: a root and its octave in quarters.
const pulse = (n: string): string => `[o2 ${n}4 o3 ${n}4]2`;
// One bar of Norfair's driving bass ostinato: the root hammered, two neighbours leaning on it.
const ost = (r: string, up: string, down: string): string =>
  `o2 ${r}8 ${r}8 o3 ${r}8 o2 ${r}8 ${up}8 ${r}8 ${down}8 ${r}8`;
// One bar of a sixteenth tremolo between two notes.
const trem = (a: string, b: string): string => `[${a}16 ${b}16]8`;

const SURFACE_BAR = 'v8 k4 v4 h4 v7 s4 v4 h4';
const SURFACE_FILL = 'v8 k4 v4 h4 v7 s8 s8 v8 s8 s8';
const NORFAIR_BAR = 'v10 k8 v5 h8 v9 s8 v5 h8 v10 k8 k8 v9 s8 v5 h8';
const NORFAIR_FILL = 'v10 k8 v5 h8 v9 s8 v5 h8 v9 s16 s16 s16 s16 v11 s8 s8';

// Chords for the surface's arpeggios (four notes, low to high).
const Em = ['o3 e', 'b', 'o4 e', 'g'] as const;
const C = ['o3 c', 'g', 'o4 c', 'e'] as const;
const B = ['o3 b', 'o4 d+', 'f+', 'b'] as const;
const Am = ['o3 a', 'o4 c', 'e', 'a'] as const;
const G = ['o3 g', 'b', 'o4 d', 'g'] as const;

export const zebesWorldSongs: Song[] = [
  {
    id: 'crateria',
    bpm: 96,
    loop: true,
    // E minor, 16 bars: Zebes's surface (4-1 and 4-2's overworld areas). A lonely, wide lead over
    // a slow climbing arpeggio and a pulsing bass, rain-soft drums; the second half rises an
    // octave and turns on B major's D-sharp before settling home.
    pulse1: `
      @2 v10 q7 x0
      o4 e2 g4 f+4                            ; bar 1  Em
      o4 e4 b2 a4                             ; bar 2  Em
      o4 g4 f+8 e8 d4 e4                      ; bar 3  C
      o4 e1                                   ; bar 4  B
      o5 c2 o4 b4 a4                          ; bar 5  Am
      o4 g4 a4 b2                             ; bar 6  G
      o4 a4 g8 f+8 d+2                        ; bar 7  B
      o4 e2 r2                                ; bar 8  Em
      o5 e2 g4 f+4                            ; bar 9  Em
      o5 e4 b2 a4                             ; bar 10 Em
      o5 g4 a8 g8 e4 c4                       ; bar 11 C
      o4 b2 o5 d+2                            ; bar 12 B
      o5 c4 e4 a4 g4                          ; bar 13 Am
      o5 g4 f+8 e8 d4 b4                      ; bar 14 G
      o5 a4 f+4 d+4 o4 b4                     ; bar 15 B
      o4 e2 r2                                ; bar 16 Em
    `,
    pulse2: `
      @1 v4 q5 x0
      ${arp(...Em)} ${arp(...Em)} ${arp(...C)} ${arp(...B)}
      ${arp(...Am)} ${arp(...G)} ${arp(...B)} ${arp(...Em)}
      ${arp(...Em)} ${arp(...Em)} ${arp(...C)} ${arp(...B)}
      ${arp(...Am)} ${arp(...G)} ${arp(...B)} ${arp(...Em)}
    `,
    triangle: `
      q6
      ${pulse('e')} ${pulse('e')} ${pulse('c')} ${pulse('b')}
      ${pulse('a')} ${pulse('g')} ${pulse('b')} ${pulse('e')}
      ${pulse('e')} ${pulse('e')} ${pulse('c')} ${pulse('b')}
      ${pulse('a')} ${pulse('g')} ${pulse('b')} ${pulse('e')}
    `,
    noise: `
      [${SURFACE_BAR}]7 ${SURFACE_FILL}     ; bars 1-8
      [${SURFACE_BAR}]7 ${SURFACE_FILL}     ; bars 9-16
    `,
  },
  {
    id: 'norfair',
    bpm: 140,
    loop: true,
    // A Phrygian, 16 bars: Norfair (4-3). A hammering bass ostinato leaning on its flat second, a
    // restless lead, the harmony a shimmering tremolo like heat over the lava; it sinks to F and
    // turns on E major's G-sharp.
    pulse1: `
      @1 v10 q6 x0
      o5 a4 g8 a8 b-4 a4                      ; bar 1  A
      o5 e4 f8 e8 d4 e4                       ; bar 2  A
      o5 a4 o6 c8 o5 b-8 a4 g4                ; bar 3  A
      o5 a2 r4 e4                             ; bar 4  A
      o5 f4 g8 f8 e4 c4                       ; bar 5  F
      o5 d4 e8 f8 g4 f4                       ; bar 6  F
      o5 e4 f8 e8 d4 o4 g+4                   ; bar 7  E
      o4 a2 b-4 g+4                           ; bar 8  E
      o6 c4 o5 b-8 a8 b-4 o6 d4               ; bar 9  A
      o6 c4 o5 b-8 a8 g4 e4                   ; bar 10 A
      o5 a8 b-8 o6 c8 d8 e4 d4                ; bar 11 A
      o6 c2 o5 a4 r4                          ; bar 12 A
      o5 a4 g8 f8 g4 a4                       ; bar 13 F
      o5 c4 d8 e8 f4 a4                       ; bar 14 F
      o5 g+4 f8 e8 f4 d4                      ; bar 15 E
      o5 e2 o4 b4 g+4                         ; bar 16 E
    `,
    pulse2: `
      @2 v4 q7 x0
      ${trem('o4 e', 'a')} ${trem('o4 e', 'a')} ${trem('o4 e', 'b-')} ${trem('o4 e', 'a')}
      ${trem('o4 c', 'f')} ${trem('o4 c', 'f')} ${trem('o3 b', 'o4 e')} ${trem('o3 b', 'o4 e')}
      ${trem('o4 e', 'a')} ${trem('o4 e', 'a')} ${trem('o4 e', 'b-')} ${trem('o4 e', 'a')}
      ${trem('o4 c', 'f')} ${trem('o4 c', 'f')} ${trem('o3 b', 'o4 e')} ${trem('o3 b', 'o4 e')}
    `,
    triangle: `
      q5
      ${ost('a', 'b-', 'g')} ${ost('a', 'b-', 'g')} ${ost('a', 'b-', 'g')} ${ost('a', 'b-', 'g')}
      ${ost('f', 'g', 'e')} ${ost('f', 'g', 'e')} ${ost('e', 'f', 'd')} ${ost('e', 'f', 'd')}
      ${ost('a', 'b-', 'g')} ${ost('a', 'b-', 'g')} ${ost('a', 'b-', 'g')} ${ost('a', 'b-', 'g')}
      ${ost('f', 'g', 'e')} ${ost('f', 'g', 'e')} ${ost('e', 'f', 'd')} ${ost('e', 'f', 'd')}
    `,
    noise: `
      [${NORFAIR_BAR}]7 ${NORFAIR_FILL}     ; bars 1-8
      [${NORFAIR_BAR}]7 ${NORFAIR_FILL}     ; bars 9-16
    `,
  },
];
