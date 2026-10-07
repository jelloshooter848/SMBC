import type { Song } from '@engine/audio/mml';

/**
 * Larry Koopa's airship and the bonus spot behind it: four original loops in the mood of an
 * NES-era sequel (composed for this project, nothing transcribed). Same conventions as songs.ts:
 * pulse1 = melody, pulse2 = harmony, triangle = bass, noise = drums; every channel the same length.
 */

// A heavy march: kick on one and three, a doubled snare pickup, hats between.
const MARCH_BAR = 'v12 k8 v5 h8 v9 s16 s16 v5 h8 v12 k8 v5 h8 v10 s8 v5 h8';
const MARCH_FILL = 'v12 k8 v5 h8 v9 s16 s16 v5 h8 v12 k8 v10 s16 s16 v11 s16 s16 v12 s8';
// The boss: kick and snare on every beat pair with hats crowding the gaps.
const DUEL_BAR = '[v12 k8 v6 h16 h16 v11 s8 v6 h16 h16]2';
const DUEL_FILL = 'v12 k8 v6 h16 h16 v11 s8 v6 h16 h16 v10 s16 s16 v11 s16 s16 v12 s16 s16 s16 s16';
// Light and bouncy for the bonus rooms.
const SKIP_BAR = '[v8 k8 v5 h8 v7 s8 v5 h8]2';
const GAME_BAR = 'v10 k8 v6 h8 v9 s8 v6 h8 v10 k8 k8 v9 s8 v6 h8';

export const smb3Songs: Song[] = [
  {
    id: 'airship',
    bpm: 128,
    loop: true,
    // D minor, 16 bars: aboard Larry's airship. A low, creeping tune that leans on the flat-two
    // (E-flat) and the raised seventh, over a churning engine figure and a marching bass.
    pulse1: `
      @1 v11 q7 x0
      o4 d4 r8 d8 f4 e8 d8            ; bar 1  Dm
      o4 c+4. d8 a2                   ; bar 2  Dm
      o4 b-4 a8 g8 f4 g8 a8           ; bar 3  Bb
      o4 a2 g+4 e4                    ; bar 4  A
      o5 d4 r8 d8 f4 e8 d8            ; bar 5  Dm
      o5 d8 c8 o4 b-8 a8 g2           ; bar 6  Gm
      o4 g4 b-8 o5 e-8 d4 c8 o4 b-8   ; bar 7  Eb
      o4 a2. r4                       ; bar 8  A
      o5 g4 f8 e-8 d4 c8 o4 b-8       ; bar 9  Gm
      o4 a4 f8 a8 o5 d2               ; bar 10 Dm
      o5 f4 d8 o4 b-8 o5 d4 f8 e8     ; bar 11 Bb
      o5 e4 c+4 o4 a4 g+4             ; bar 12 A
      o5 d8 r8 d8 r8 a4 g8 f8         ; bar 13 Dm
      o5 f4 e8 d8 o4 b-4 o5 c8 d8     ; bar 14 Bb
      o5 e-4. d8 c4 o4 b-4            ; bar 15 Eb
      o4 a4 o5 c+8 e8 g4 c+4          ; bar 16 A7
    `,
    pulse2: `
      @2 v6 q5 x0
      [o3 d8 f8]4                     ; bar 1  the engine: chord tones churning in eighths
      [o3 d8 f8]4                     ; bar 2
      [o3 b-8 o4 d8]4                 ; bar 3
      [o3 a8 o4 c+8]4                 ; bar 4
      [o3 d8 f8]4                     ; bar 5
      [o3 g8 b-8]4                    ; bar 6
      [o3 e-8 b-8]4                   ; bar 7
      [o3 a8 o4 c+8]4                 ; bar 8
      [o3 g8 b-8]4                    ; bar 9
      [o3 d8 f8]4                     ; bar 10
      [o3 b-8 o4 d8]4                 ; bar 11
      [o3 a8 o4 c+8]4                 ; bar 12
      [o3 d8 f8]4                     ; bar 13
      [o3 b-8 o4 d8]4                 ; bar 14
      [o3 e-8 b-8]4                   ; bar 15
      [o3 g8 o4 c+8]4                 ; bar 16
    `,
    triangle: `
      q6
      o2 d4 a4 o3 d4 o2 a4            ; bar 1  root, fifth, octave, fifth
      o2 d4 a4 o3 d4 o2 a4            ; bar 2
      o1 b-4 o2 f4 b-4 f4             ; bar 3
      o1 a4 o2 e4 a4 e4               ; bar 4
      o2 d4 a4 o3 d4 o2 a4            ; bar 5
      o1 g4 o2 d4 g4 d4               ; bar 6
      o1 e-4 b-4 o2 e-4 o1 b-4        ; bar 7
      o1 a4 o2 e4 a4 e4               ; bar 8
      o1 g4 o2 d4 g4 d4               ; bar 9
      o2 d4 a4 o3 d4 o2 a4            ; bar 10
      o1 b-4 o2 f4 b-4 f4             ; bar 11
      o1 a4 o2 e4 a4 e4               ; bar 12
      o2 d4 a4 o3 d4 o2 a4            ; bar 13
      o1 b-4 o2 f4 b-4 f4             ; bar 14
      o1 e-4 b-4 o2 e-4 o1 b-4        ; bar 15
      o1 a4 o2 c+4 e4 g4              ; bar 16
    `,
    noise: `
      [${MARCH_BAR}]7 ${MARCH_FILL}   ; bars 1-8
      [${MARCH_BAR}]7 ${MARCH_FILL}   ; bars 9-16
    `,
  },

  {
    id: 'smb3-boss',
    bpm: 168,
    loop: true,
    // E minor, 8 bars: Larry's duel. A jabbing lead circling the root, a buzzing sixteenth
    // ostinato, pounding octave eighths, and a flat-two (F major) lurch before the B7 turnaround.
    pulse1: `
      @1 v11 q6 x0
      o5 e8 r8 e8 g8 f+8 e8 d+8 e8    ; bar 1  Em
      o5 b4 a8 g8 f+4 d+4             ; bar 2  Em
      o5 e8 r8 e8 g8 o6 c8 c8 o5 b8 g8 ; bar 3  C
      o5 f+4 d+4 o4 b4 o5 d+4         ; bar 4  B
      o6 e8 r8 e8 d8 c8 o5 b8 a8 g8   ; bar 5  Em
      o5 b4. g8 e4 g4                 ; bar 6  Em
      o5 f4 a8 o6 c8 f4 e8 c8         ; bar 7  F
      o5 b8 a8 f+8 d+8 b4 r4          ; bar 8  B7
    `,
    pulse2: `
      @0 v6 q5 x0
      [o4 e16 g16 b16 g16]4           ; bar 1  Em
      [o4 e16 g16 b16 g16]4           ; bar 2  Em
      [o4 e16 g16 o5 c16 o4 g16]4     ; bar 3  C
      [o4 d+16 f+16 b16 f+16]4        ; bar 4  B
      [o4 e16 g16 b16 g16]4           ; bar 5  Em
      [o4 e16 g16 b16 g16]4           ; bar 6  Em
      [o4 f16 a16 o5 c16 o4 a16]4     ; bar 7  F
      [o4 d+16 f+16 a16 f+16]4        ; bar 8  B7
    `,
    triangle: `
      q6
      [o2 e8 o3 e8]4                  ; bar 1
      [o2 e8 o3 e8]4                  ; bar 2
      [o2 c8 o3 c8]4                  ; bar 3
      [o1 b8 o2 b8]4                  ; bar 4
      [o2 e8 o3 e8]4                  ; bar 5
      [o2 e8 o3 e8]4                  ; bar 6
      [o2 f8 o3 f8]4                  ; bar 7
      o1 b8 o2 b8 o1 b8 o2 b8 d+8 f+8 a8 b8 ; bar 8
    `,
    noise: `
      [${DUEL_BAR}]7 ${DUEL_FILL}     ; bars 1-8
    `,
  },

  {
    id: 'toad-house',
    bpm: 144,
    loop: true,
    // F major, 8 bars: Toad's house. A cheerful skipping tune over off-beat chords and an
    // oom-pah bass.
    pulse1: `
      @2 v11 q6 x0
      o5 c8 f8 a8 f8 c4 r8 c8         ; bar 1  F
      o5 d8 f8 b-8 f8 d4 r4           ; bar 2  Bb
      o5 c8 e8 g8 b-8 a8 g8 e8 c8     ; bar 3  C
      o5 f4 a4 f4 r4                  ; bar 4  F
      o5 d8 f8 a8 o6 d8 c8 o5 a8 f8 d8 ; bar 5  Dm
      o5 g8 b-8 o6 d8 o5 b-8 g4 a8 b-8 ; bar 6  Gm
      o6 c4 o5 b-8 a8 g4 e4           ; bar 7  C7
      o5 f4 c4 f4 r4                  ; bar 8  F
    `,
    pulse2: `
      @1 v6 q4 x0
      [r8 o4 a8 r8 o5 c8]2            ; bar 1  F   off-beat chords
      [r8 o4 b-8 r8 o5 d8]2           ; bar 2  Bb
      [r8 o4 g8 r8 o5 c8]2            ; bar 3  C
      [r8 o4 a8 r8 o5 c8]2            ; bar 4  F
      [r8 o4 a8 r8 o5 d8]2            ; bar 5  Dm
      [r8 o4 b-8 r8 o5 d8]2           ; bar 6  Gm
      [r8 o4 b-8 r8 o5 e8]2           ; bar 7  C7
      [r8 o4 a8 r8 o5 c8]2            ; bar 8  F
    `,
    triangle: `
      q5
      o2 f4 o3 c4 o2 f4 o3 c4         ; bar 1
      o2 b-4 f4 b-4 f4                ; bar 2
      o2 c4 g4 c4 g4                  ; bar 3
      o2 f4 o3 c4 o2 f4 o3 c4         ; bar 4
      o2 d4 a4 d4 a4                  ; bar 5
      o2 g4 d4 g4 d4                  ; bar 6
      o2 c4 g4 b-4 g4                 ; bar 7
      o2 f4 o3 c4 o2 f4 c4            ; bar 8
    `,
    noise: `
      [${SKIP_BAR}]8                  ; bars 1-8
    `,
  },

  {
    id: 'bonus-game',
    bpm: 160,
    loop: true,
    // C major, 8 bars: the card match and the slot reels. A bright, bouncing tune over sixteenth
    // arpeggios that keep the clock ticking.
    pulse1: `
      @2 v11 q6 x0
      o5 e8 g8 o6 c8 o5 g8 e8 g8 o6 c8 e8 ; bar 1  C
      o6 d8 c8 o5 a8 e8 c4 e4         ; bar 2  Am
      o5 f8 a8 o6 c8 f8 e8 c8 o5 a8 f8 ; bar 3  F
      o5 g8 b8 o6 d8 g8 f4 d4         ; bar 4  G
      o6 e8 d8 c8 o5 g8 a8 g8 e8 c8   ; bar 5  C
      o5 a4 o6 c4 e4 c4               ; bar 6  Am
      o5 d8 f8 a8 f8 g8 b8 o6 d8 f8   ; bar 7  Dm G
      o6 e4 c4 o5 g4 r4               ; bar 8  C
    `,
    pulse2: `
      @0 v6 q5 x0
      [o4 c16 e16 g16 e16]4           ; bar 1  C
      [o4 a16 o5 c16 e16 c16]4        ; bar 2  Am
      [o4 f16 a16 o5 c16 o4 a16]4     ; bar 3  F
      [o4 g16 b16 o5 d16 o4 b16]4     ; bar 4  G
      [o4 c16 e16 g16 e16]4           ; bar 5  C
      [o4 a16 o5 c16 e16 c16]4        ; bar 6  Am
      [o4 d16 f16 a16 f16]2 [o4 g16 b16 o5 d16 o4 b16]2 ; bar 7  Dm G
      [o4 c16 e16 g16 e16]4           ; bar 8  C
    `,
    triangle: `
      q5
      [o2 c8 o3 c8]4                  ; bar 1
      [o2 a8 o3 a8]4                  ; bar 2
      [o2 f8 o3 f8]4                  ; bar 3
      [o2 g8 o3 g8]4                  ; bar 4
      [o2 c8 o3 c8]4                  ; bar 5
      [o2 a8 o3 a8]4                  ; bar 6
      [o2 d8 o3 d8]2 [o2 g8 o3 g8]2   ; bar 7
      [o2 c8 o3 c8]2 o2 g8 a8 b8 o3 c8 ; bar 8
    `,
    noise: `
      [${GAME_BAR}]8                  ; bars 1-8
    `,
  },
];
