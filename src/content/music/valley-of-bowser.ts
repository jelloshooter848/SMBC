import type { Song } from '@engine/audio/mml';

/**
 * Bowser's own music (0.4.54, MB's approved songs): the VALLEY OF BOWSER map loop (`map-valley`,
 * content/worldmap/valley-of-bowser.ts) and the fight song for the real king's bridge in Bowser's
 * Castle (`bowser-king`, campaign only; its castle is wired in 0.4.55). Both are original,
 * composed for this project (no melody is transcribed from any game), and both are built on
 * the motif of his spell theme (bowser-spell.ts) so the king has one leitmotif: a heavy dotted
 * climb up the C minor chord, C C E-flat G, then the flat sixth sinking through the tritone,
 * A-flat G F-sharp (over A-flat it is a German sixth falling onto G); its answer is the
 * Neapolitan turn, A-flat up to D-flat, down to C. Rolling triplet chords on pulse2 are the
 * Bowser sound of both songs; no other map song, nor `castle`, uses triplets in its harmony.
 * Same conventions as songs.ts and world-maps.ts: pulse1 = melody, pulse2 = harmony, triangle =
 * bass, noise = drums; every channel the same length, whole 4/4 bars, the loop from the top;
 * the voices stay at or under the old `map` song's volumes (pulse1 v11, pulse2 v7, noise v9).
 */

// ---- Shared bar builders (each returns exactly the length its comment says) ----

/** One beat of a triplet chord roll: low, middle, high. */
const roll = (a: string, b: string, c: string): string => `${a}12 ${b}12 ${c}12`;
/** A bar of the triplet chord roll. */
const toll = (a: string, b: string, c: string): string => `[${roll(a, b, c)}]4`;
/** Half a bar of the triplet chord roll. */
const tollHalf = (a: string, b: string, c: string): string => `[${roll(a, b, c)}]2`;
/** A bar of the march bass: the root, dotted, its octave, the root again. */
const march = (n: string): string => `o2 ${n}4. ${n}8 o3 ${n}4 o2 ${n}4`;
/** Half a bar of the march bass: the root, dotted. */
const step = (n: string): string => `o2 ${n}4. ${n}8`;
/** A bar of the tramping bass: three beats, then a triplet ruff into the next bar. */
const tramp = (n: string): string => `o2 ${n}4 ${n}4 ${n}4 ${n}12 ${n}12 ${n}12`;
/** Half a bar of pounding eighths: the root, the root, its octave, the root. */
const pound = (n: string): string => `o2 ${n}8 ${n}8 o3 ${n}8 o2 ${n}8`;

// ---- VALLEY OF BOWSER: the drums ----
// A slow procession: a heavy kick, a hat, the snare, a kick pushing into the next bar.
const TOLL_BAR = 'v9 k4 v5 h4 v8 s4 v5 h8 v9 k8';
const TOLL_FILL = 'v9 k4 v5 h4 v7 s12 s12 s12 v8 s12 s12 s12';
// The climb: the kick on the beat, a triplet ruff of snares after it.
const RUFF_BAR = 'v9 k4 v6 s12 s12 s12 v9 k4 v8 s4';
const RUFF_FILL = 'v9 k4 v6 s12 s12 s12 v7 s12 s12 s12 v8 s12 s12 v9 s12';
// The summit: a doubled kick, the snare, a roll of triplet kicks like timpani.
const SUMMIT_BAR = 'v9 k8 k8 v5 h8 h8 v8 s4 v9 k12 k12 k12';

// ---- BOWSER (the king's bridge): the drums ----
const KING_BAR = 'v9 k8 v5 h16 h16 v8 s8 v9 k8 k8 v5 h8 v8 s8 v6 s16 s16';
const KING_FILL = 'v9 k8 v5 h16 h16 v8 s8 v9 k8 v7 s12 s12 s12 v8 s12 s12 s12';

export const valleyOfBowserSongs: Song[] = [
  {
    id: 'map-valley',
    bpm: 100,
    loop: true,
    // C minor, 16 bars (A 8 + B 8), 38.4 s a pass: the last road, up to Bowser's Castle. The
    // spell's motif an octave higher and at a march's pace instead of a dirge's; organ-like
    // triplet chords rolling under it; a striding root-octave bass; a slow procession on the
    // drums. A (1-8): the motif and its Neapolitan answer, ending on the motif's own dotted
    // stinger. B (9-16): the motif on F minor, its tritone sting moved up to B over D-flat;
    // a horn call climbing A-flat, B-flat (bVI, bVII) to the summit, where pulse2 leaves its
    // triplets to double the motif an octave below and the drums roll; the turn lands on G,
    // so the loop climbs back into C.
    pulse1: `
      @2 v11 q7 x0
      o5 c4. c8 e-4 g4                       ; bar 1  Cm   the motif
      o5 a-2 g4 f+4                          ; bar 2  Ab   (German sixth: the tritone)
      o5 g4. a-8 g4 d4                       ; bar 3  G
      o5 b4. d8 f4 a-4                       ; bar 4  G7b9
      o6 c4. c8 o5 g4 e-4                    ; bar 5  Cm   the motif falling
      o5 a-2 o6 d-4 c4                       ; bar 6  Db   the Neapolitan answer
      o5 a-4 f4 g4 o4 b4                     ; bar 7  Fm G
      o5 c2 o4 g8 g8 o5 c4                   ; bar 8  Cm   the stinger
      o5 f4. f8 a-4 o6 c4                    ; bar 9  Fm   the motif on iv
      o6 d-2 c4 o5 b4                        ; bar 10 Db7  its tritone sting
      o6 c4. o5 a-8 b-8 o6 c8 e-4            ; bar 11 Ab   the horn call
      o6 d4. o5 b-8 f4 d4                    ; bar 12 Bb
      o5 c4. c8 e-4 g4                       ; bar 13 Cm   the summit, doubled
      o5 a-2 g4 f+4                          ; bar 14 Ab
      o5 a-4 o6 d-4 c4 o5 b4                 ; bar 15 Db G
      o5 g2 r8 g8 a-8 b8                     ; bar 16 G
    `,
    pulse2: `
      @1 v5 q5 x0
      ${toll('o3 g', 'o4 c', 'o4 e-')}                                   ; bar 1  Cm
      ${tollHalf('o3 a-', 'o4 c', 'o4 e-')} ${tollHalf('o3 a-', 'o4 c', 'o4 f+')} ; bar 2  Ab Ger6
      ${toll('o3 g', 'o3 b', 'o4 d')}                                    ; bar 3  G
      ${tollHalf('o3 b', 'o4 d', 'o4 f')} ${tollHalf('o3 b', 'o4 d', 'o4 a-')}    ; bar 4  G7 G7b9
      ${toll('o3 g', 'o4 c', 'o4 e-')}                                   ; bar 5  Cm
      ${toll('o3 a-', 'o4 d-', 'o4 f')}                                  ; bar 6  Db
      ${tollHalf('o3 a-', 'o4 c', 'o4 f')} ${tollHalf('o3 g', 'o3 b', 'o4 d')}    ; bar 7  Fm G
      ${toll('o3 g', 'o4 c', 'o4 e-')}                                   ; bar 8  Cm
      ${toll('o3 a-', 'o4 c', 'o4 f')}                                   ; bar 9  Fm
      ${tollHalf('o3 a-', 'o4 d-', 'o4 f')} ${tollHalf('o3 a-', 'o3 b', 'o4 f')}  ; bar 10 Db Db7
      ${toll('o3 a-', 'o4 c', 'o4 e-')}                                  ; bar 11 Ab
      ${toll('o3 b-', 'o4 d', 'o4 f')}                                   ; bar 12 Bb
      @2 v6 q7
      o4 c4. c8 e-4 g4                       ; bar 13 the motif, an octave below the lead
      o4 a-2 g4 f+4                          ; bar 14
      o4 a-4 o5 d-4 c4 o4 b4                 ; bar 15
      @1 v5 q5
      ${tollHalf('o3 g', 'o3 b', 'o4 d')} ${tollHalf('o3 b', 'o4 d', 'o4 f')}     ; bar 16 G G7
    `,
    triangle: `
      q6
      ${march('c')} ${march('a-')} ${march('g')} o2 g4. g8 g4 g4      ; bars 1-4
      ${march('c')} ${march('d-')} ${step('f')} ${step('g')}           ; bars 5-7
      o2 c2 o1 g8 g8 o2 c4                                              ; bar 8  the stinger
      ${tramp('f')} ${tramp('d-')} ${tramp('a-')} ${tramp('b-')}       ; bars 9-12
      ${march('c')} ${march('a-')} ${step('d-')} ${step('g')}          ; bars 13-15
      o2 g4 g4 g4 g12 a-12 b12                                          ; bar 16 into C
    `,
    noise: `
      [${TOLL_BAR}]7 ${TOLL_FILL}            ; bars 1-8
      [${RUFF_BAR}]3 ${RUFF_FILL}            ; bars 9-12
      [${SUMMIT_BAR}]3 ${TOLL_FILL}          ; bars 13-16
    `,
  },

  {
    id: 'bowser-king',
    bpm: 160,
    loop: true,
    // C minor, 8 bars, 12 s a pass: the fight with the real king on his bridge (it replaces
    // `castle` in that one section, campaign only). The leitmotif at double speed: the dotted
    // climb and the tritone sink packed into one bar of eighths, then moved onto A-flat, where
    // the flat sixth becomes E natural over an augmented chord; the Neapolitan answer and the
    // G7 run home. The triplet chord roll of the map song, frantic at this tempo, over
    // pounding eighths and a busier beat. Same volume caps as the map songs.
    pulse1: `
      @1 v11 q6 x0
      o5 c8. c16 e-8 g8 a-8 g8 f+8 g8        ; bar 1  Cm   the motif, in one bar
      o6 c4. o5 b8 a-4 g4                    ; bar 2  Cm
      o5 a-8. a-16 o6 c8 e-8 e8 e-8 d8 e-8   ; bar 3  Ab Ab+   the motif on A-flat
      o6 d4. c8 o5 b4 g4                     ; bar 4  G
      o5 c8. c16 e-8 g8 a-8 g8 f+8 g8        ; bar 5  Cm
      o5 a-4. o6 d-8 c4 o5 b4                ; bar 6  Db G  the Neapolitan answer
      o5 a-8 o6 c8 f8 c8 o5 b8 o6 d8 g8 d8   ; bar 7  Fm G
      o6 c4 o5 g4 o6 c8 o5 b8 a-8 b8         ; bar 8  Cm G
    `,
    pulse2: `
      @2 v7 q5 x0
      ${toll('o4 c', 'o4 e-', 'o4 g')}                                   ; bar 1  Cm
      ${tollHalf('o4 c', 'o4 e-', 'o4 g')} ${tollHalf('o3 a-', 'o4 c', 'o4 f+')}  ; bar 2  Cm Ger6
      ${tollHalf('o3 a-', 'o4 c', 'o4 e-')} ${tollHalf('o3 a-', 'o4 c', 'o4 e')}  ; bar 3  Ab Ab+
      ${tollHalf('o3 g', 'o3 b', 'o4 d')} ${tollHalf('o3 b', 'o4 d', 'o4 f')}     ; bar 4  G G7
      ${toll('o4 c', 'o4 e-', 'o4 g')}                                   ; bar 5  Cm
      ${tollHalf('o3 a-', 'o4 d-', 'o4 f')} ${tollHalf('o3 g', 'o3 b', 'o4 d')}   ; bar 6  Db G
      ${tollHalf('o3 a-', 'o4 c', 'o4 f')} ${tollHalf('o3 g', 'o3 b', 'o4 f')}    ; bar 7  Fm G7
      ${tollHalf('o4 c', 'o4 e-', 'o4 g')} ${tollHalf('o3 g', 'o3 b', 'o4 d')}    ; bar 8  Cm G
    `,
    triangle: `
      q6
      [${pound('c')}]2 [${pound('c')}]2 [${pound('a-')}]2 [${pound('g')}]2      ; bars 1-4
      [${pound('c')}]2 ${pound('d-')} ${pound('g')} ${pound('f')} ${pound('g')} ; bars 5-7
      ${pound('c')} ${pound('g')}                                                 ; bar 8
    `,
    noise: `
      [${KING_BAR}]7 ${KING_FILL}            ; bars 1-8
    `,
  },
];
