import type { Song } from '@engine/audio/mml';

/**
 * A song for each world map (0.4.48): eight original loops, one per SMB page, each in the mood of
 * its world's game and composed for this project (no melody is transcribed from any game). The
 * page's `music` names it (src/content/worldmap/world1.ts .. world8.ts), so it plays from the
 * start; the warp hub keeps `map`, the Lost Kingdom pages theirs (`map`, `map-bowser`) and
 * Kakariko its own. Same conventions as songs.ts: pulse1 = melody, pulse2 = harmony, triangle =
 * bass, noise = drums; every channel the same length, whole 4/4 bars, the loop from the top.
 * The voices stay at or under the old `map` song's volumes (world-maps.test.ts).
 */

/** The world map songs in world order: WORLD_MAP_SONGS[w - 1] plays on World w's page. */
export const WORLD_MAP_SONGS = [
  'map-mushroom',
  'map-hyrule',
  'map-megaman',
  'map-zebes',
  'map-transylvania',
  'map-ninja',
  'map-contra',
  'map-blaster',
];

// ---- Shared bar builders (each returns exactly one 4/4 bar; notes carry their own octave) ----

/** Two chord tones rocking in eighths. */
const rock = (lo: string, hi: string): string => `[${lo}8 ${hi}8]4`;
/** Eighth-note broken chord, up and back: a b c b, twice. */
const broken = (a: string, b: string, c: string): string => `[${a}8 ${b}8 ${c}8 ${b}8]2`;
/** Sixteenth-note broken chord, up and back: a b c b, four times. */
const ripple = (a: string, b: string, c: string): string => `[${a}16 ${b}16 ${c}16 ${b}16]4`;
/** Root, fifth, the root's octave, fifth in quarters: a walking stroll (`f` carries its octave). */
const stroll = (r: string, f: string): string => `o2 ${r}4 ${f}4 o3 ${r}4 ${f}4`;

// ---- World 1: MUSHROOM KINGDOM ----
// A light skip: kick, a pair of hats, the snare, a doubled kick.
const SKIP_BAR = 'v9 k8 v5 h16 h16 v8 s8 v5 h8 v9 k16 k16 v5 h8 v8 s8 v5 h16 h16';
const SKIP_FILL = 'v9 k8 v5 h16 h16 v8 s8 v5 h8 v9 k8 v7 s16 s16 v8 s16 s16 s8';

// ---- World 2: HYRULE ----
// A marching snare: a kick on the beat, a ruff of sixteenths on the off-beats.
const MARCH_BAR = 'v9 k8 v6 s16 s16 v8 s8 v5 h8 v9 k8 v6 s16 s16 v8 s8 v6 s16 s16';
const MARCH_FILL = 'v9 k8 v6 s16 s16 v8 s8 v5 h8 v7 s16 s16 v8 s16 s16 v9 s8 s8';
/** A galloping bar of bass: long, short, short, the octave, the root (twice). */
const gallop = (n: string): string => `[o2 ${n}8 ${n}16 ${n}16 o3 ${n}8 o2 ${n}8]2`;

// ---- World 3: MEGA CITY ----
const GEAR_BAR = 'v9 k8 v5 h16 h16 v8 s8 v5 h16 h16 v9 k16 k16 v5 h8 v8 s8 v5 h8';
const GEAR_FILL = 'v9 k8 v5 h16 h16 v8 s8 v5 h16 h16 v7 s16 s16 v8 s16 s16 v9 s16 s16 s16 s16';
/** Half a bar of driving eighths: the root, the root, its octave, the root. */
const drive = (n: string): string => `o2 ${n}8 ${n}8 o3 ${n}8 o2 ${n}8`;

// ---- World 4: PLANET ZEBES ----
// Hardly any drums: a soft low thud and a tick, like something far off in the rock.
const DEEP_BAR = 'v7 k4 v4 h8 v3 h8 r4 v4 h4';
/** Three chord tones cycling in eighths against the four beats (a b c a b c a b). */
const sonar = (a: string, b: string, c: string): string => `${a}8 ${b}8 ${c}8 ${a}8 ${b}8 ${c}8 ${a}8 ${b}8`;
/** A bar of the slow pulse: the root, a pick-up, the octave, the root again. */
const throb = (n: string): string => `o2 ${n}4. ${n}8 o3 ${n}4 o2 ${n}4`;

// ---- World 5: TRANSYLVANIA ----
const GALLOP_BAR = 'v9 k8 v5 h8 v8 s8 v9 k8 v5 h8 v9 k8 v8 s8 v5 h8';
const GALLOP_FILL = 'v9 k8 v5 h8 v8 s8 v9 k8 v7 s16 s16 v8 s16 s16 v9 s8 s8';
/** Half a bar of pumping octaves. */
const pump = (n: string): string => `[o2 ${n}8 o3 ${n}8]2`;

// ---- World 6: DRAGON VALLEY ----
const BLADE_BAR = 'v9 k8 v5 h16 h16 v8 s8 v9 k8 v5 h8 v9 k8 v8 s8 v5 h16 h16';
const BLADE_FILL = 'v9 k8 v5 h16 h16 v8 s8 v9 k8 v7 s16 s16 v8 s16 s16 v9 s16 s16 s16 s16';
/** A bar of stabs grouped 3 + 3 + 2: root, fifth, rest; root, fifth, rest; root, fifth. */
const slash = (a: string, b: string): string => `${a}8 ${b}8 r8 ${a}8 ${b}8 r8 ${a}8 ${b}8`;
/** The bass in the same 3 + 3 + 2. */
const lunge = (n: string): string => `o2 ${n}8 ${n}8 o3 ${n}8 o2 ${n}8 ${n}8 o3 ${n}8 o2 ${n}8 o3 ${n}8`;

// ---- World 7: GALUGA ISLAND ----
const TROOP_BAR = 'v9 k8 v5 h8 v8 s8 v5 h8 v9 k8 k16 k16 v8 s8 v5 h16 h16';
const TROOP_FILL = 'v9 k8 v5 h8 v8 s8 v5 h8 v9 k16 k16 v8 s16 s16 v9 s16 s16 s16 s16';
/** Half a bar of rattling fire: root, root, fifth; root, root, fifth. */
const rattle = (a: string, b: string): string => `[${a}16 ${a}16 ${b}8]2`;
/** Half a bar of the bass's da-da-DUM. */
const charge = (n: string): string => `[o2 ${n}16 ${n}16 o3 ${n}8]2`;

// ---- World 8: BOWSER'S UNDERWORLD ----
const ENGINE_BAR = 'v9 k8 v5 h8 v8 s8 v5 h16 h16 v9 k16 k16 v5 h8 v8 s8 v5 h8';
const ENGINE_FILL = 'v9 k8 v5 h8 v8 s8 v5 h16 h16 v7 s16 s16 v8 s16 s16 v9 s8 s8';
/** A bar of the tank's sixteenth-note bass: root, root, octave, root. */
const tread = (n: string): string => `[o2 ${n}16 ${n}16 o3 ${n}16 o2 ${n}16]4`;
/** A bar of four chord tones climbing in eighths and falling back. */
const climb = (a: string, b: string, c: string, d: string): string =>
  `${a}8 ${b}8 ${c}8 ${d}8 ${c}8 ${b}8 ${a}8 ${b}8`;

export const worldMapSongs: Song[] = [
  {
    id: 'map-mushroom',
    bpm: 144,
    loop: true,
    // D major, 16 bars (A 8 + B 8): a cheerful stroll across the Mushroom Kingdom. A hopping,
    // syncopated lead on the thin 25% pulse; a bubbly broken chord under the A section, held
    // thirds under the B section's long notes; a walking root-fifth bass; light skipping drums.
    pulse1: `
      @1 v11 q6 x0
      o5 d8 r8 f+8 a8 r8 f+8 a4              ; bar 1  D
      o5 b8 a8 g8 b8 o6 d4 o5 b4             ; bar 2  G
      o5 a8 f+8 d8 f+8 a8 o6 d8 c+8 o5 b8    ; bar 3  D
      o5 a4 e8 c+8 e2                        ; bar 4  A
      o5 d8 r8 f+8 a8 r8 f+8 a4              ; bar 5  D
      o5 b8 o6 d8 e8 d8 o5 b8 a8 g4          ; bar 6  G
      o5 g8 f+8 e8 g8 f+8 e8 c+8 e8          ; bar 7  Em A
      o5 d4 a8 f+8 d4 r4                     ; bar 8  D
      o5 b4. a8 g4 b4                        ; bar 9  G
      o5 a4. f+8 c+4 a4                      ; bar 10 F#m
      o5 g4. f+8 e4 g4                       ; bar 11 Em
      o5 e8 f+8 g8 a8 b8 a8 g8 e8            ; bar 12 A7
      o5 f+8 a8 o6 d8 o5 a8 f+8 a8 o6 d8 f+8 ; bar 13 D
      o6 d+4 o5 b8 f+8 a4 b4                 ; bar 14 B7
      o5 g8 b8 o6 e8 o5 b8 a8 o6 c+8 e8 g8   ; bar 15 Em A7
      o6 f+8 e8 d4 r4 o5 a8 r8               ; bar 16 D
    `,
    pulse2: `
      @0 v6 q4 x0
      ${broken('o4 d', 'o4 f+', 'o4 a')} ${broken('o4 d', 'o4 g', 'o4 b')}
      ${broken('o4 d', 'o4 f+', 'o4 a')} ${broken('o4 c+', 'o4 e', 'o4 a')}
      ${broken('o4 d', 'o4 f+', 'o4 a')} ${broken('o4 d', 'o4 g', 'o4 b')}
      o4 e8 g8 b8 g8 c+8 e8 a8 e8 ${broken('o4 d', 'o4 f+', 'o4 a')}
      q7 v5
      o4 g2 d2   o4 f+2 c+2   o4 e2 g2   o4 c+2 e2
      o4 f+2 a2  o4 d+2 f+2   o4 e2 c+2  o4 d2 r2
    `,
    triangle: `
      q6
      ${stroll('d', 'o2 a')} ${stroll('g', 'o3 d')} ${stroll('d', 'o2 a')} ${stroll('a', 'o3 e')}
      ${stroll('d', 'o2 a')} ${stroll('g', 'o3 d')} o2 e4 b4 a4 o3 e4 ${stroll('d', 'o2 a')}
      ${stroll('g', 'o3 d')} ${stroll('f+', 'o3 c+')} ${stroll('e', 'o2 b')} ${stroll('a', 'o3 e')}
      ${stroll('d', 'o2 a')} ${stroll('b', 'o3 f+')} o2 e4 b4 a4 o3 e4 o2 d4 a4 f+4 a4
    `,
    noise: `
      [${SKIP_BAR}]7 ${SKIP_FILL}            ; bars 1-8
      [${SKIP_BAR}]7 ${SKIP_FILL}            ; bars 9-16
    `,
  },

  {
    id: 'map-hyrule',
    bpm: 150,
    loop: true,
    // A dorian, 16 bars: the road across Hyrule. A bold, striding lead over a galloping bass and
    // rocking chord tones, the dorian's bright D major against A minor, a marching snare; the
    // phrase lands on E major and its flat sixth before turning home.
    pulse1: `
      @2 v10 q7 x0
      o5 a4. e8 a8 b8 o6 c8 d8               ; bar 1  Am
      o6 d4 o5 b4 g4 b8 o6 d8                ; bar 2  G
      o5 a4. f+8 a8 o6 d8 e8 f+8             ; bar 3  D
      o6 e2 r8 o5 a8 b8 o6 c8                ; bar 4  Am
      o6 e4. d8 c8 o5 b8 a8 b8               ; bar 5  Am
      o6 d4. c8 o5 b8 a8 g8 b8               ; bar 6  G
      o5 a4 o6 c4 f4 e8 d8                   ; bar 7  F
      o5 g+2 b4 o6 e4                        ; bar 8  E
      o6 c4. o5 g8 o6 c8 e8 g4               ; bar 9  C
      o6 d4. o5 b8 o6 d8 g8 f+8 d8           ; bar 10 G
      o6 a4 f+4 d4 f+8 a8                    ; bar 11 D
      o6 e2. r4                              ; bar 12 Am
      o6 c8 d8 c8 o5 a8 f8 a8 o6 c8 f8       ; bar 13 F
      o6 d8 e8 d8 o5 b8 g8 b8 o6 d8 g8       ; bar 14 G
      o6 e4 d4 c4 o5 b4                      ; bar 15 E
      o5 b4 g+4 e8 f+8 g+8 b8                ; bar 16 E
    `,
    pulse2: `
      @1 v6 q5 x0
      ${rock('o4 c', 'o4 e')} ${rock('o3 b', 'o4 d')} ${rock('o4 d', 'o4 f+')} ${rock('o4 c', 'o4 e')}
      ${rock('o4 c', 'o4 e')} ${rock('o3 b', 'o4 d')} ${rock('o4 c', 'o4 f')} ${rock('o3 b', 'o4 e')}
      ${rock('o4 e', 'o4 g')} ${rock('o3 b', 'o4 d')} ${rock('o4 d', 'o4 f+')} ${rock('o4 c', 'o4 e')}
      ${rock('o4 c', 'o4 f')} ${rock('o3 b', 'o4 d')} ${rock('o3 b', 'o4 g+')} ${rock('o3 b', 'o4 e')}
    `,
    triangle: `
      q6
      ${gallop('a')} ${gallop('g')} ${gallop('d')} ${gallop('a')}
      ${gallop('a')} ${gallop('g')} ${gallop('f')} ${gallop('e')}
      ${gallop('c')} ${gallop('g')} ${gallop('d')} ${gallop('a')}
      ${gallop('f')} ${gallop('g')} ${gallop('e')} ${gallop('e')}
    `,
    noise: `
      [${MARCH_BAR}]7 ${MARCH_FILL}          ; bars 1-8
      [${MARCH_BAR}]7 ${MARCH_FILL}          ; bars 9-16
    `,
  },

  {
    id: 'map-megaman',
    bpm: 160,
    loop: true,
    // E minor, 16 bars: Mega City. A bright, pushing robot-rock lead on the 50% pulse over a
    // rippling sixteenth-note broken chord and a driving eighth bass (i, flat VI, flat VII),
    // turning on B major's D-sharp; a snappy beat with sixteenth hats.
    pulse1: `
      @2 v10 q7 x0
      o5 e8 g8 b8 o6 e4 d8 o5 b8 a8          ; bar 1  Em
      o5 b4. g8 a8 b8 g8 e8                  ; bar 2  Em
      o5 g8 e8 g8 o6 c4 o5 b8 o6 c8 d8       ; bar 3  C
      o6 e4 d4 o5 a4 f+8 a8                  ; bar 4  D
      o5 e8 g8 b8 o6 e4 f+8 g8 a8            ; bar 5  Em
      o6 b4. a8 g8 f+8 e8 d8                 ; bar 6  Em
      o6 e4. d8 c8 o5 b8 a8 g8               ; bar 7  C
      o5 a4 f+4 d+4 f+8 b8                   ; bar 8  D B
      o6 c8 o5 b8 a8 e8 a8 b8 o6 c8 e8       ; bar 9  Am
      o6 d8 c8 o5 a8 f+8 a8 b8 o6 c8 d8      ; bar 10 D
      o6 b4 g4 d4 g8 a8                      ; bar 11 G
      o6 g4. e8 c4 e8 g8                     ; bar 12 C
      o6 a4. g8 e8 c8 e8 g8                  ; bar 13 Am
      o6 f+4. d+8 o5 b4 o6 d+4               ; bar 14 B
      o6 e8 d8 c8 e8 d8 c8 o5 a8 o6 d8       ; bar 15 C D
      o5 b2 r8 b8 o6 d+8 f+8                 ; bar 16 B
    `,
    pulse2: `
      @1 v5 q5 x0
      ${ripple('o4 e', 'o4 g', 'o4 b')} ${ripple('o4 e', 'o4 g', 'o4 b')}
      ${ripple('o4 c', 'o4 e', 'o4 g')} ${ripple('o4 d', 'o4 f+', 'o4 a')}
      ${ripple('o4 e', 'o4 g', 'o4 b')} ${ripple('o4 e', 'o4 g', 'o4 b')}
      ${ripple('o4 c', 'o4 e', 'o4 g')} [o4 d16 f+16 a16 f+16]2 [o4 d+16 f+16 b16 f+16]2
      ${ripple('o4 c', 'o4 e', 'o4 a')} ${ripple('o4 d', 'o4 f+', 'o4 a')}
      ${ripple('o4 d', 'o4 g', 'o4 b')} ${ripple('o4 c', 'o4 e', 'o4 g')}
      ${ripple('o4 c', 'o4 e', 'o4 a')} ${ripple('o4 d+', 'o4 f+', 'o4 b')}
      [o4 c16 e16 g16 e16]2 [o4 d16 f+16 a16 f+16]2 ${ripple('o4 d+', 'o4 f+', 'o4 b')}
    `,
    triangle: `
      q6
      ${drive('e')} ${drive('e')} ${drive('e')} ${drive('e')} ${drive('c')} ${drive('c')} ${drive('d')} ${drive('d')}
      ${drive('e')} ${drive('e')} ${drive('e')} ${drive('e')} ${drive('c')} ${drive('c')} ${drive('d')} ${drive('b')}
      ${drive('a')} ${drive('a')} ${drive('d')} ${drive('d')} ${drive('g')} ${drive('g')} ${drive('c')} ${drive('c')}
      ${drive('a')} ${drive('a')} ${drive('b')} ${drive('b')} ${drive('c')} ${drive('d')} ${drive('b')} ${drive('b')}
    `,
    noise: `
      [${GEAR_BAR}]7 ${GEAR_FILL}            ; bars 1-8
      [${GEAR_BAR}]7 ${GEAR_FILL}            ; bars 9-16
    `,
  },

  {
    id: 'map-zebes',
    bpm: 90,
    loop: true,
    // D phrygian, 12 bars: Planet Zebes, alone and far from home. A slow, legato lead that
    // leans on the flat second (E-flat) and sighs back down; a three-note sonar figure cycling
    // against the four beats with a decaying ping; a throbbing low pulse and almost no drums.
    // The last bar turns on A major's C-sharp to pull the loop back to D.
    pulse1: `
      @2 v10 q8 x0
      r2 o5 d4 f4                            ; bar 1  Dm
      o5 e-4 d2.                             ; bar 2  Dm
      o5 g2 f4 e-4                           ; bar 3  Eb
      o5 d1                                  ; bar 4  Dm
      r4 o5 f4 b-4 o6 d4                     ; bar 5  Bb
      o5 g2. d4                              ; bar 6  Gm
      o5 e-4 f4 g4 b-4                       ; bar 7  Eb
      o5 a2 o6 c+4 e4                        ; bar 8  A
      o6 d2. c4                              ; bar 9  Dm
      o5 b-2 g4 e-4                          ; bar 10 Eb
      o5 d2 e-4 f4                           ; bar 11 Gm
      o5 e2 c+2                              ; bar 12 A
    `,
    pulse2: `
      @1 v5 q6 x1
      ${sonar('o5 d', 'o5 f', 'o5 a')} ${sonar('o5 f', 'o5 a', 'o6 d')}
      ${sonar('o5 e-', 'o5 g', 'o5 b-')} ${sonar('o5 d', 'o5 f', 'o5 a')}
      ${sonar('o5 d', 'o5 f', 'o5 b-')} ${sonar('o5 d', 'o5 g', 'o5 b-')}
      ${sonar('o5 e-', 'o5 g', 'o5 b-')} ${sonar('o5 c+', 'o5 e', 'o5 a')}
      ${sonar('o5 d', 'o5 f', 'o5 a')} ${sonar('o5 e-', 'o5 g', 'o5 b-')}
      ${sonar('o5 d', 'o5 g', 'o5 b-')} ${sonar('o5 c+', 'o5 e', 'o5 a')}
    `,
    triangle: `
      q7
      ${throb('d')} ${throb('d')} ${throb('e-')} ${throb('d')}
      ${throb('b-')} ${throb('g')} ${throb('e-')} ${throb('a')}
      ${throb('d')} ${throb('e-')} ${throb('g')} ${throb('a')}
    `,
    noise: `
      [${DEEP_BAR}]12                        ; bars 1-12
    `,
  },

  {
    id: 'map-transylvania',
    bpm: 150,
    loop: true,
    // G minor (harmonic: F-sharp), 16 bars: the road to Dracula's castle. A proud, baroque-
    // flavoured lead on the 50% pulse with the raised seventh and the flat sixth over D; rocking
    // chord tones; a bass pumping octaves; a galloping beat.
    pulse1: `
      @2 v10 q7 x0
      o5 g4 d8 g8 a8 b-8 a8 g8               ; bar 1  Gm
      o5 f+4 g4 d2                           ; bar 2  Gm
      o5 e-8 f8 g8 e-8 b-4 a8 g8             ; bar 3  Eb
      o5 f+4 a4 d4 c4                        ; bar 4  D7
      o5 b-4. a8 g8 a8 b-8 o6 c8             ; bar 5  Gm
      o6 e-4. d8 c8 o5 b-8 a8 g8             ; bar 6  Cm
      o5 f+8 g8 a8 f+8 d4 a4                 ; bar 7  D
      o5 g2 r4 d4                            ; bar 8  Gm
      o5 f8 b-8 o6 d8 f8 e-8 d8 c8 o5 b-8    ; bar 9  Bb
      o6 c4 o5 a4 f4 a4                      ; bar 10 F
      o5 b-8 o6 d8 g8 d8 o5 b-8 o6 d8 g8 a8  ; bar 11 Gm
      o6 f+4. e8 d4 c4                       ; bar 12 D7
      o6 e-8 d8 c8 o5 b-8 o6 c8 o5 b-8 a8 g8 ; bar 13 Eb
      o5 g4 e-4 c4 e-4                       ; bar 14 Cm
      o5 f+8 a8 o6 d8 c8 o5 b-8 a8 g8 f+8    ; bar 15 D
      o5 a2 r4 d4                            ; bar 16 D7
    `,
    pulse2: `
      @0 v6 q6 x0
      ${rock('o4 d', 'o4 g')} ${rock('o4 d', 'o4 b-')} ${rock('o4 e-', 'o4 g')} ${rock('o4 c', 'o4 f+')}
      ${rock('o4 d', 'o4 g')} ${rock('o4 c', 'o4 e-')} ${rock('o4 d', 'o4 f+')} ${rock('o4 d', 'o4 g')}
      ${rock('o4 d', 'o4 f')} ${rock('o4 c', 'o4 f')} ${rock('o4 d', 'o4 g')} ${rock('o4 c', 'o4 f+')}
      ${rock('o4 e-', 'o4 g')} ${rock('o4 c', 'o4 e-')} ${rock('o4 d', 'o4 f+')} ${rock('o4 c', 'o4 f+')}
    `,
    triangle: `
      q5
      ${pump('g')} ${pump('g')} ${pump('g')} ${pump('g')} ${pump('e-')} ${pump('e-')} ${pump('d')} ${pump('d')}
      ${pump('g')} ${pump('g')} ${pump('c')} ${pump('c')} ${pump('d')} ${pump('d')} ${pump('g')} ${pump('d')}
      ${pump('b-')} ${pump('b-')} ${pump('f')} ${pump('f')} ${pump('g')} ${pump('g')} ${pump('d')} ${pump('d')}
      ${pump('e-')} ${pump('e-')} ${pump('c')} ${pump('c')} ${pump('d')} ${pump('d')} ${pump('d')} ${pump('a')}
    `,
    noise: `
      [${GALLOP_BAR}]7 ${GALLOP_FILL}        ; bars 1-8
      [${GALLOP_BAR}]7 ${GALLOP_FILL}        ; bars 9-16
    `,
  },

  {
    id: 'map-ninja',
    bpm: 160,
    loop: true,
    // D minor, 16 bars: Dragon Valley at a run. A tense, flicking lead on the 25% pulse full of
    // sixteenth-note pickups, over stabs and a bass both grouped 3 + 3 + 2; the B section climbs
    // and ends on A with the flat ninth (B-flat) and a sixteenth-note dash back home.
    pulse1: `
      @1 v11 q7 x0
      o5 d16 e16 f8 a8 d16 e16 f8 a8 o6 d8 c8          ; bar 1  Dm
      o5 a4 r8 a8 g8 f8 e8 f8                          ; bar 2  Dm
      o5 d16 f16 b-8 o6 d8 o5 d16 f16 b-8 o6 d8 f8 d8  ; bar 3  Bb
      o6 e4. d8 c8 o5 a8 g8 e8                         ; bar 4  C
      o5 d16 e16 f8 a8 d16 e16 f8 a8 o6 d8 c8          ; bar 5  Dm
      o6 f4 r8 e8 d8 c+8 d8 e8                         ; bar 6  Dm
      o6 f8 d8 o5 b-8 o6 d8 f8 g8 f8 d8                ; bar 7  Bb
      o6 e4 c+4 o5 a4 r4                               ; bar 8  A
      o5 g8. b-16 o6 d8 g8 f8 e8 d8 o5 b-8             ; bar 9  Gm
      o5 a8. o6 c+16 e8 a8 g8 f8 e8 c+8                ; bar 10 A
      o5 d16 e16 f16 g16 a8 d8 f16 g16 a16 b-16 o6 c8 d8 ; bar 11 Dm
      o6 c4 o5 a8 f8 a8 o6 c8 f8 e8                    ; bar 12 F
      o6 d4 o5 b-8 g8 b-8 o6 d8 g8 f8                  ; bar 13 Gm
      o6 f4 d8 o5 b-8 o6 d8 f8 b-8 a8                  ; bar 14 Bb
      o6 e4 d8 c+8 o5 b-8 a8 g8 f8                     ; bar 15 A
      o5 e16 f16 g16 a16 b-16 o6 c+16 d16 e16 f4 e4    ; bar 16 A
    `,
    pulse2: `
      @2 v6 q5 x0
      ${slash('o4 d', 'o4 a')} ${slash('o4 d', 'o4 a')} ${slash('o3 b-', 'o4 f')} ${slash('o4 c', 'o4 g')}
      ${slash('o4 d', 'o4 a')} ${slash('o4 d', 'o4 a')} ${slash('o3 b-', 'o4 f')} ${slash('o4 c+', 'o4 e')}
      ${slash('o4 d', 'o4 g')} ${slash('o4 c+', 'o4 e')} ${slash('o4 d', 'o4 a')} ${slash('o4 c', 'o4 f')}
      ${slash('o4 d', 'o4 g')} ${slash('o3 b-', 'o4 f')} ${slash('o4 c+', 'o4 e')} ${slash('o4 c+', 'o4 e')}
    `,
    triangle: `
      q6
      ${lunge('d')} ${lunge('d')} ${lunge('b-')} ${lunge('c')} ${lunge('d')} ${lunge('d')} ${lunge('b-')} ${lunge('a')}
      ${lunge('g')} ${lunge('a')} ${lunge('d')} ${lunge('f')} ${lunge('g')} ${lunge('b-')} ${lunge('a')} ${lunge('a')}
    `,
    noise: `
      [${BLADE_BAR}]7 ${BLADE_FILL}          ; bars 1-8
      [${BLADE_BAR}]7 ${BLADE_FILL}          ; bars 9-16
    `,
  },

  {
    id: 'map-contra',
    bpm: 150,
    loop: true,
    // C minor, 16 bars: the island assault. A clipped, heroic lead with sixteenth-note kicks,
    // rattling root-fifth sixteenths on pulse2 and a da-da-DUM bass (i, flat VI, flat VII,
    // then G major), a tight troop beat.
    pulse1: `
      @2 v11 q6 x0
      o5 c8 r16 c16 e-8 g8 r8 o6 c8 o5 b-8 g8   ; bar 1  Cm
      o5 g4 f8 e-8 f4 g4                        ; bar 2  Cm
      o5 a-8 r16 a-16 o6 c8 e-8 r8 c8 o5 a-8 f8 ; bar 3  Ab
      o5 b-4 o6 d4 f4 d8 o5 b-8                 ; bar 4  Bb
      o5 c8 r16 c16 e-8 g8 r8 o6 c8 o5 b-8 g8   ; bar 5  Cm
      o6 e-4. d8 c8 o5 b-8 g8 b-8               ; bar 6  Cm
      o6 c4 o5 a-4 b-4 o6 d4                    ; bar 7  Ab Bb
      o5 b2 o6 d4 o5 g4                         ; bar 8  G
      o6 c8 o5 a-8 f8 a-8 o6 c8 f8 e-8 c8       ; bar 9  Fm
      o5 b8 g8 d8 g8 b8 o6 d8 f8 d8             ; bar 10 G7
      o6 e-4 c8 o5 g8 o6 c4 e-8 g8              ; bar 11 Cm
      o6 g4. f8 e-8 d8 e-8 f8                   ; bar 12 Eb
      o6 e-4 c4 o5 a-4 o6 c4                    ; bar 13 Ab
      o6 d4 o5 b-4 f4 b-4                       ; bar 14 Bb
      o6 c8 o5 a-8 f8 a-8 b8 g8 b8 o6 d8        ; bar 15 Fm G
      o6 d4 o5 b4 g4 r8 g8                      ; bar 16 G
    `,
    pulse2: `
      @1 v6 q4 x0
      [${rattle('o4 c', 'o4 g')}]2 [${rattle('o4 c', 'o4 g')}]2 [${rattle('o3 a-', 'o4 e-')}]2 [${rattle('o3 b-', 'o4 f')}]2
      [${rattle('o4 c', 'o4 g')}]2 [${rattle('o4 c', 'o4 g')}]2 ${rattle('o3 a-', 'o4 e-')} ${rattle('o3 b-', 'o4 f')} [${rattle('o3 g', 'o4 d')}]2
      [${rattle('o4 c', 'o4 f')}]2 [${rattle('o3 g', 'o4 d')}]2 [${rattle('o4 c', 'o4 g')}]2 [${rattle('o4 e-', 'o4 b-')}]2
      [${rattle('o3 a-', 'o4 e-')}]2 [${rattle('o3 b-', 'o4 f')}]2 ${rattle('o4 c', 'o4 f')} ${rattle('o3 g', 'o4 d')} [${rattle('o3 g', 'o4 d')}]2
    `,
    triangle: `
      q6
      [${charge('c')}]2 [${charge('c')}]2 [${charge('a-')}]2 [${charge('b-')}]2
      [${charge('c')}]2 [${charge('c')}]2 ${charge('a-')} ${charge('b-')} [${charge('g')}]2
      [${charge('f')}]2 [${charge('g')}]2 [${charge('c')}]2 [${charge('e-')}]2
      [${charge('a-')}]2 [${charge('b-')}]2 ${charge('f')} ${charge('g')} [${charge('g')}]2
    `,
    noise: `
      [${TROOP_BAR}]7 ${TROOP_FILL}          ; bars 1-8
      [${TROOP_BAR}]7 ${TROOP_FILL}          ; bars 9-16
    `,
  },

  {
    id: 'map-blaster',
    bpm: 132,
    loop: true,
    // A minor with the flat second (B-flat), 16 bars: down in Bowser's Underworld. A dark lead
    // on the 75% pulse, slow and wide with octave drops, the lydian B over F; a broken chord
    // climbing and falling in eighths; the tank's sixteenth-note bass churning underneath.
    pulse1: `
      @3 v10 q7 x0
      o4 a4 o5 e4 a4 g8 e8                   ; bar 1  Am
      o5 c4. o4 b8 a2                        ; bar 2  Am
      o5 d4 f4 b-4 g8 f8                     ; bar 3  Bb
      o5 e2. r4                              ; bar 4  Am
      o5 f4 a4 o6 c4 o5 b8 a8                ; bar 5  F
      o5 b4. a8 g4 d4                        ; bar 6  G
      o5 e4 g+4 b4 o6 d4                     ; bar 7  E7
      o6 c4 o5 b4 g+4 e4                     ; bar 8  E
      o5 f4. e8 d4 a4                        ; bar 9  Dm
      o5 c4 e4 a2                            ; bar 10 Am
      o5 b-4. a8 f4 d4                       ; bar 11 Bb
      o5 e2 a4 o6 c4                         ; bar 12 Am
      o6 c4. o5 b8 a4 f4                     ; bar 13 F
      o5 a4. g8 f4 d4                        ; bar 14 Dm
      o5 e4 b4 g+4 b4                        ; bar 15 E
      o5 e2 r4 o4 b4                         ; bar 16 E
    `,
    pulse2: `
      @1 v5 q5 x1
      ${climb('o4 a', 'o5 c', 'o5 e', 'o5 a')} ${climb('o4 a', 'o5 c', 'o5 e', 'o5 a')}
      ${climb('o4 b-', 'o5 d', 'o5 f', 'o5 b-')} ${climb('o4 a', 'o5 c', 'o5 e', 'o5 a')}
      ${climb('o4 f', 'o4 a', 'o5 c', 'o5 f')} ${climb('o4 g', 'o4 b', 'o5 d', 'o5 g')}
      ${climb('o4 e', 'o4 g+', 'o4 b', 'o5 d')} ${climb('o4 e', 'o4 g+', 'o4 b', 'o5 e')}
      ${climb('o4 d', 'o4 f', 'o4 a', 'o5 d')} ${climb('o4 a', 'o5 c', 'o5 e', 'o5 a')}
      ${climb('o4 b-', 'o5 d', 'o5 f', 'o5 b-')} ${climb('o4 a', 'o5 c', 'o5 e', 'o5 a')}
      ${climb('o4 f', 'o4 a', 'o5 c', 'o5 f')} ${climb('o4 d', 'o4 f', 'o4 a', 'o5 d')}
      ${climb('o4 e', 'o4 g+', 'o4 b', 'o5 e')} ${climb('o4 e', 'o4 g+', 'o4 b', 'o5 d')}
    `,
    triangle: `
      q5
      ${tread('a')} ${tread('a')} ${tread('b-')} ${tread('a')} ${tread('f')} ${tread('g')} ${tread('e')} ${tread('e')}
      ${tread('d')} ${tread('a')} ${tread('b-')} ${tread('a')} ${tread('f')} ${tread('d')} ${tread('e')} ${tread('e')}
    `,
    noise: `
      [${ENGINE_BAR}]7 ${ENGINE_FILL}        ; bars 1-8
      [${ENGINE_BAR}]7 ${ENGINE_FILL}        ; bars 9-16
    `,
  },
];
