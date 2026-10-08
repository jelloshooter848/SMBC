import type { Song } from '@engine/audio/mml';

/**
 * World 3 as Mega Man's world (0.4.26): three original pieces in the mood of the NES Mega Man 2,
 * composed for this project (nothing transcribed): 3-2's Wood Man-style forest, 3-3's Air
 * Man-style sky and 3-4's Wily fortress. Each is its theme's music (schema.ts themeMusic) and its
 * level's `campaignMusic`; 3-1's bonus room (the factory) reuses the space station's `mm-station`,
 * and 3-1 and its sky keep `mm-stage-31` (looks.ts). Same conventions as songs.ts: pulse1 =
 * melody, pulse2 = harmony, triangle = bass, noise = drums; every channel the same length.
 */

// One bar of sixteenth arpeggio over a chord (low, middle, high, middle).
const arp = (a: string, b: string, c: string): string => `[${a}16 ${b}16 ${c}16 ${b}16]4`;
// One bar of a rising four-note roll in sixteenths.
const roll = (a: string, b: string, c: string, d: string): string => `[${a}16 ${b}16 ${c}16 ${d}16]4`;
// One bar of eighths bouncing between a root and its octave.
const bounce = (lo: string, hi: string): string => `[${lo}8 ${hi}8]4`;
// One bar of a skipping bass on note `n` from octave `o`.
const skip = (n: string, o: number): string => `[o${o} ${n}8 ${n}16 ${n}16 o${o + 1} ${n}8 o${o} ${n}8]2`;

const WOOD_BAR = 'v11 k8 v6 h8 v10 s8 v6 h8 v11 k8 k8 v10 s8 v6 h8';
const WOOD_FILL = 'v11 k8 v6 h8 v10 s8 v6 h8 v10 s16 s16 s16 s16 v12 s8 s8';
const AIR_BAR = 'v10 k8 v5 h16 h16 v9 s8 v5 h16 h16 v10 k8 v5 h16 h16 v9 s8 v5 h8';
const AIR_FILL = 'v10 k8 v5 h16 h16 v9 s8 v5 h16 h16 v9 s16 s16 v10 s16 s16 v11 s8 s8';
const WILY_BAR = 'v12 k8 v6 h16 h16 v11 s8 v6 h16 h16 v12 k8 k8 v11 s8 v6 h16 h16';
const WILY_FILL = 'v12 k8 v6 h16 h16 v11 s8 v6 h16 h16 v11 s16 s16 s16 s16 v12 s16 s16 s8';

// Chords (low, middle, high) for the arpeggios.
const Dm = ['o4 d', 'f', 'a'] as const;
const Bb = ['o3 b-', 'o4 d', 'f'] as const;
const C = ['o4 c', 'e', 'g'] as const;
const A = ['o3 a', 'o4 c+', 'e'] as const;
const Gm = ['o3 g', 'b-', 'o4 d'] as const;
const G = ['o3 g', 'b', 'o4 d'] as const;
const D = ['o4 d', 'f+', 'a'] as const;
const Em = ['o3 e', 'g', 'b'] as const;

export const megamanWorldSongs: Song[] = [
  {
    id: 'mm-wood',
    bpm: 150,
    loop: true,
    // D minor, 16 bars: Wood Man's forest (3-2's look). A bouncing lead of broken chords over
    // sixteenth arpeggios and an octave-bouncing bass, a beat like hollow logs; it lifts to G
    // minor and turns on A major's C-sharp.
    pulse1: `
      @2 v11 q7 x0
      o5 d8 f8 a8 d8 f8 a8 o6 d4              ; bar 1  Dm
      o6 c8 o5 a8 f8 a8 g4 f4                 ; bar 2  Dm
      o5 f8 d8 f8 b-8 a4 g4                   ; bar 3  Bb
      o5 e8 g8 o6 c8 o5 e8 g2                 ; bar 4  C
      o5 d8 f8 a8 d8 f8 a8 o6 d8 e8           ; bar 5  Dm
      o6 f4 e8 d8 c4 o5 a4                    ; bar 6  Dm
      o5 b-8 a8 g8 f8 e4 d4                   ; bar 7  Bb
      o5 c+4 e4 a2                            ; bar 8  A
      o5 g8 b-8 o6 d8 o5 b-8 o6 g4 d4         ; bar 9  Gm
      o6 c8 o5 b-8 a8 g8 a2                   ; bar 10 Gm
      o5 a8 o6 d8 f8 d8 a4 f4                 ; bar 11 Dm
      o6 e8 d8 c8 o5 a8 o6 d2                 ; bar 12 Dm
      o5 b-4 o6 d4 f4 d4                      ; bar 13 Bb
      o6 e4 c4 o5 g4 o6 c4                    ; bar 14 C
      o5 a8 b8 o6 c+8 d8 e4 c+4               ; bar 15 A
      o5 a4 e4 a4 r4                          ; bar 16 A
    `,
    pulse2: `
      @1 v5 q5 x0
      ${arp(...Dm)} ${arp(...Dm)} ${arp(...Bb)} ${arp(...C)}
      ${arp(...Dm)} ${arp(...Dm)} ${arp(...Bb)} ${arp(...A)}
      ${arp(...Gm)} ${arp(...Gm)} ${arp(...Dm)} ${arp(...Dm)}
      ${arp(...Bb)} ${arp(...C)} ${arp(...A)} ${arp(...A)}
    `,
    triangle: `
      q6
      ${bounce('o2 d', 'o3 d')} ${bounce('o2 d', 'o3 d')} ${bounce('o2 b-', 'o3 b-')} ${bounce('o2 c', 'o3 c')}
      ${bounce('o2 d', 'o3 d')} ${bounce('o2 d', 'o3 d')} ${bounce('o2 b-', 'o3 b-')} ${bounce('o2 a', 'o3 a')}
      ${bounce('o2 g', 'o3 g')} ${bounce('o2 g', 'o3 g')} ${bounce('o2 d', 'o3 d')} ${bounce('o2 d', 'o3 d')}
      ${bounce('o2 b-', 'o3 b-')} ${bounce('o2 c', 'o3 c')} ${bounce('o2 a', 'o3 a')} ${bounce('o2 a', 'o3 a')}
    `,
    noise: `
      [${WOOD_BAR}]7 ${WOOD_FILL}     ; bars 1-8
      [${WOOD_BAR}]7 ${WOOD_FILL}     ; bars 9-16
    `,
  },
  {
    id: 'mm-air',
    bpm: 156,
    loop: true,
    // G major, 16 bars: Air Man's sky (3-3's look). A soaring lead that leaps up the chord and
    // glides down over running sixteenth arpeggios, a light bouncing bass and airy hats.
    pulse1: `
      @2 v11 q7 x0
      o5 g8 b8 o6 d8 g8 f+8 d8 o5 b8 o6 d8    ; bar 1  G
      o6 e4. d8 o5 b4 g4                      ; bar 2  G
      o5 e8 g8 o6 c8 e8 d8 c8 o5 b8 a8        ; bar 3  C
      o5 a4 f+4 d2                            ; bar 4  D
      o5 g8 b8 o6 d8 g8 a8 g8 f+8 d8          ; bar 5  G
      o6 e4 g4 e4 o5 b4                       ; bar 6  Em
      o6 c8 o5 b8 a8 g8 e4 g4                 ; bar 7  C
      o5 f+4 a4 o6 d2                         ; bar 8  D
      o5 b4. a8 g4 e4                         ; bar 9  Em
      o5 g4. e8 c4 e4                         ; bar 10 C
      o5 d8 g8 b8 o6 d8 g4 d4                 ; bar 11 G
      o6 c8 o5 b8 a8 b8 o6 d2                 ; bar 12 D
      o6 e8 d8 c8 e8 g4 e4                    ; bar 13 C
      o6 f+8 e8 d8 f+8 a4 f+4                 ; bar 14 D
      o6 g8 f+8 g8 a8 b4 g4                   ; bar 15 G
      o6 d4 o5 b4 g4 r4                       ; bar 16 G
    `,
    pulse2: `
      @0 v5 q5 x0
      ${arp(...G)} ${arp(...G)} ${arp(...C)} ${arp(...D)}
      ${arp(...G)} ${arp(...Em)} ${arp(...C)} ${arp(...D)}
      ${arp(...Em)} ${arp(...C)} ${arp(...G)} ${arp(...D)}
      ${arp(...C)} ${arp(...D)} ${arp(...G)} ${arp(...G)}
    `,
    triangle: `
      q5
      ${bounce('o2 g', 'o3 g')} ${bounce('o2 g', 'o3 g')} ${bounce('o2 c', 'o3 c')} ${bounce('o2 d', 'o3 d')}
      ${bounce('o2 g', 'o3 g')} ${bounce('o2 e', 'o3 e')} ${bounce('o2 c', 'o3 c')} ${bounce('o2 d', 'o3 d')}
      ${bounce('o2 e', 'o3 e')} ${bounce('o2 c', 'o3 c')} ${bounce('o2 g', 'o3 g')} ${bounce('o2 d', 'o3 d')}
      ${bounce('o2 c', 'o3 c')} ${bounce('o2 d', 'o3 d')} ${bounce('o2 g', 'o3 g')} ${bounce('o2 g', 'o3 g')}
    `,
    noise: `
      [${AIR_BAR}]7 ${AIR_FILL}       ; bars 1-8
      [${AIR_BAR}]7 ${AIR_FILL}       ; bars 9-16
    `,
  },
  {
    id: 'mm-wily',
    bpm: 168,
    loop: true,
    // C minor, 16 bars: Wily's fortress (3-4's look). A grim, driving hook with a snapped repeated
    // note, rising rolls under it, a skipping bass and a hard rock beat; it climbs through F minor
    // and turns on G major's B-natural.
    pulse1: `
      @2 v11 q7 x0
      o5 c8 c16 c16 e-8 g8 o6 c8 o5 b-8 g8 e-8 ; bar 1  Cm
      o5 f4 e-8 d8 c4. r8                     ; bar 2  Cm
      o5 a-8 a-16 a-16 o6 c8 o5 a-8 o6 e-8 d8 c8 o5 a-8 ; bar 3  Ab
      o5 b-2 a-8 g8 f8 d8                     ; bar 4  Bb
      o5 c8 c16 c16 e-8 g8 o6 c8 d8 e-8 c8    ; bar 5  Cm
      o6 f4 e-8 d8 e-4 g4                     ; bar 6  Cm
      o6 a-4. g8 f4 e-4                       ; bar 7  Ab
      o5 b4 o6 d4 g2                          ; bar 8  G
      o5 f8 a-8 o6 c8 f8 e-8 c8 o5 a-8 c8     ; bar 9  Fm
      o5 a-4 g8 f8 g4 a-4                     ; bar 10 Fm
      o5 g8 o6 c8 e-8 g8 f8 e-8 d8 c8         ; bar 11 Cm
      o5 b-8 o6 c8 d8 e-8 c2                  ; bar 12 Cm
      o6 c4 e-4 a-4 e-4                       ; bar 13 Ab
      o6 d4 f4 b-4 f4                         ; bar 14 Bb
      o6 g8 f8 e-8 d8 o5 b8 o6 d8 f8 d8       ; bar 15 G
      o5 g4 b4 o6 d4 r4                       ; bar 16 G
    `,
    pulse2: `
      @0 v6 q5 x0
      ${roll('o4 c', 'e-', 'g', 'o5 c')} ${roll('o4 c', 'e-', 'g', 'o5 c')} ${roll('o3 a-', 'o4 c', 'e-', 'a-')} ${roll('o3 b-', 'o4 d', 'f', 'b-')}
      ${roll('o4 c', 'e-', 'g', 'o5 c')} ${roll('o4 c', 'e-', 'g', 'o5 c')} ${roll('o3 a-', 'o4 c', 'e-', 'a-')} ${roll('o3 g', 'b', 'o4 d', 'g')}
      ${roll('o3 f', 'a-', 'o4 c', 'f')} ${roll('o3 f', 'a-', 'o4 c', 'f')} ${roll('o4 c', 'e-', 'g', 'o5 c')} ${roll('o4 c', 'e-', 'g', 'o5 c')}
      ${roll('o3 a-', 'o4 c', 'e-', 'a-')} ${roll('o3 b-', 'o4 d', 'f', 'b-')} ${roll('o3 g', 'b', 'o4 d', 'g')} ${roll('o3 g', 'b', 'o4 d', 'g')}
    `,
    triangle: `
      q6
      ${skip('c', 2)} ${skip('c', 2)} ${skip('a-', 1)} ${skip('b-', 1)}
      ${skip('c', 2)} ${skip('c', 2)} ${skip('a-', 1)} ${skip('g', 1)}
      ${skip('f', 1)} ${skip('f', 1)} ${skip('c', 2)} ${skip('c', 2)}
      ${skip('a-', 1)} ${skip('b-', 1)} ${skip('g', 1)} ${skip('g', 1)}
    `,
    noise: `
      [${WILY_BAR}]7 ${WILY_FILL}     ; bars 1-8
      [${WILY_BAR}]7 ${WILY_FILL}     ; bars 9-16
    `,
  },
];
