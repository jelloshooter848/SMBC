import type { Song } from '@engine/audio/mml';

/**
 * Simon's crypt under 5-4 and his mini game: four original loops in the mood of an NES gothic
 * action game (composed for this project, nothing transcribed). Same conventions as songs.ts:
 * pulse1 = melody, pulse2 = harmony, triangle = bass, noise = drums; every channel the same length.
 */

// The castle stage: a driving rock bar with sixteenth hats, and its snare-run fill.
const STAGE_BAR = 'v11 k8 v6 h16 h16 v10 s8 v6 h8 v11 k8 k8 v10 s8 v6 h16 h16';
const STAGE_FILL = 'v11 k8 v6 h16 h16 v10 s8 v6 h8 v11 k8 v10 s16 s16 v11 s16 s16 v12 s16 s16';
// Dracula: kick and snare on every beat pair, hats crowding the gaps.
const LORD_BAR = '[v12 k8 v6 h16 h16 v11 s8 v6 h16 h16]2';
const LORD_FILL = 'v12 k8 v6 h16 h16 v11 s8 v6 h16 h16 v10 s16 s16 s16 s16 v12 s16 s16 s16 s16';
// The beast: doubled kicks stamping under a snare that won't settle.
const BEAST_BAR = 'v12 k16 k16 v6 h16 h16 v11 s8 v6 h8 v12 k16 k16 v6 h16 h16 v11 s8 s16 s16';
const BEAST_FILL = 'v12 k16 k16 v6 h16 h16 v11 s8 v6 h8 v10 s16 s16 s16 s16 v12 s16 s16 s16 s16';

export const castlevaniaSongs: Song[] = [
  {
    id: 'crypt',
    bpm: 80,
    loop: true,
    // A minor with a Phrygian flat-two (B-flat), 8 bars: the dungeon and Simon's crypt. A slow,
    // lonely lead that waits a bar to start, over an organ-like arpeggio and a pedal bass; the
    // only percussion is a drip.
    pulse1: `
      @2 v8 q8 x1
      r1                              ; bar 1  (silence: the arpeggio alone)
      o4 e2 f4 e4                     ; bar 2  F
      o4 d2. c4                       ; bar 3  Gm
      o3 b2 o4 c4 o3 b4               ; bar 4  E
      o4 a2 g+4 a4                    ; bar 5  Am
      o5 c2 o4 b-4 a4                 ; bar 6  Bb
      o4 g+2. e4                      ; bar 7  E
      o4 a1                           ; bar 8  Am
    `,
    pulse2: `
      @1 v5 q6 x1
      [o3 a8 o4 c8 e8 c8]2            ; bar 1  Am
      [o3 a8 o4 c8 f8 c8]2            ; bar 2  F
      [o3 g8 b-8 o4 d8 o3 b-8]2       ; bar 3  Gm
      [o3 g+8 b8 o4 e8 o3 b8]2        ; bar 4  E
      [o3 a8 o4 c8 e8 c8]2            ; bar 5  Am
      [o3 b-8 o4 d8 f8 d8]2           ; bar 6  Bb
      [o3 g+8 b8 o4 e8 o3 b8]2        ; bar 7  E
      [o3 a8 o4 c8 e8 c8]2            ; bar 8  Am
    `,
    triangle: `
      q8
      o2 a1 f1 g1 e1 a1 o1 b-1 o2 e1 a1 ; bars 1-8: one held root a bar
    `,
    noise: `
      [v3 x1 h8 r8 r4 v2 h8 r8 r4]8   ; bars 1-8: water dripping somewhere
    `,
  },
  {
    id: 'cv-stage',
    bpm: 150,
    loop: true,
    // D minor, 8 bars: the castle stage. A driving eighth-note tune with a leap to the octave,
    // over sixteenth-note chord arpeggios and an octave-bouncing bass.
    pulse1: `
      @2 v11 q7 x0
      o4 d8 d8 a8 d8 o5 c8 o4 d8 b-8 a8     ; bar 1  Dm
      o4 g8 a8 b-8 a8 g8 f8 e8 c+8          ; bar 2  Gm A
      o4 d8 d8 a8 d8 o5 d8 c8 o4 b-8 a8     ; bar 3  Dm
      o4 b-8. a16 g8 f8 e4 a4               ; bar 4  Bb A
      o5 d8 o4 a8 o5 d8 e8 f8 e8 d8 c8      ; bar 5  Dm
      o4 b-8 o5 c8 d8 o4 b-8 g4 a8 b-8      ; bar 6  Gm
      o5 c8 d8 e8 c8 o4 a4 o5 c+8 e8        ; bar 7  A
      o5 d4 o4 a8 f8 d4 r4                  ; bar 8  Dm
    `,
    pulse2: `
      @1 v6 q6 x0
      [o3 d16 a16 o4 d16 o3 a16]4                          ; bar 1
      [o3 g16 b-16 o4 d16 o3 b-16]2 [o3 a16 o4 c+16 e16 c+16]2 ; bar 2
      [o3 d16 a16 o4 d16 o3 a16]4                          ; bar 3
      [o3 b-16 o4 d16 f16 d16]2 [o3 a16 o4 c+16 e16 c+16]2 ; bar 4
      [o3 d16 a16 o4 d16 o3 a16]4                          ; bar 5
      [o3 g16 b-16 o4 d16 o3 b-16]4                        ; bar 6
      [o3 a16 o4 c+16 e16 c+16]4                           ; bar 7
      [o3 d16 a16 o4 d16 o3 a16]4                          ; bar 8
    `,
    triangle: `
      q6
      [o2 d8 o3 d8]4                  ; bar 1
      [o2 g8 o3 g8]2 [o2 a8 o3 a8]2   ; bar 2
      [o2 d8 o3 d8]4                  ; bar 3
      [o1 b-8 o2 b-8]2 [o2 a8 o3 a8]2 ; bar 4
      [o2 d8 o3 d8]4                  ; bar 5
      [o2 g8 o3 g8]4                  ; bar 6
      [o2 a8 o3 a8]4                  ; bar 7
      [o2 d8 o3 d8]4                  ; bar 8
    `,
    noise: `
      [${STAGE_BAR}]7 ${STAGE_FILL}   ; bars 1-8
    `,
  },
  {
    id: 'cv-boss',
    bpm: 160,
    loop: true,
    // E Phrygian, 8 bars: Dracula in his throne room. A grave, dotted tune leaning on the flat
    // two (F) over a churning sixteenth-note ostinato.
    pulse1: `
      @2 v11 q7 x0
      o4 e4. f8 e4 b4                 ; bar 1  Em
      o5 c4. o4 b8 a4 g4              ; bar 2  C
      o4 f4. g8 a4 b4                 ; bar 3  F
      o4 e2. r4                       ; bar 4  Em
      o5 e4. d8 c4 o4 b4              ; bar 5  Em
      o5 c4 d4 e4 f4                  ; bar 6  C
      o5 g4. f8 e4 d4                 ; bar 7  Dm
      o5 e8 o4 b8 g8 f8 e2            ; bar 8  Em
    `,
    pulse2: `
      @1 v6 q6 x0
      [o3 e16 o4 e16 o3 e16 b16]4     ; bar 1
      [o3 c16 o4 c16 o3 c16 g16]4     ; bar 2
      [o3 f16 o4 f16 o3 f16 o4 c16]4  ; bar 3
      [o3 e16 o4 e16 o3 e16 b16]4     ; bar 4
      [o3 e16 o4 e16 o3 e16 b16]4     ; bar 5
      [o3 c16 o4 c16 o3 c16 g16]4     ; bar 6
      [o3 d16 o4 d16 o3 d16 a16]4     ; bar 7
      [o3 e16 o4 e16 o3 e16 b16]4     ; bar 8
    `,
    triangle: `
      q6
      [o2 e8 e8 o3 e8 o2 e8]2         ; bar 1
      [o2 c8 c8 o3 c8 o2 c8]2         ; bar 2
      [o2 f8 f8 o3 f8 o2 f8]2         ; bar 3
      [o2 e8 e8 o3 e8 o2 e8]2         ; bar 4
      [o2 e8 e8 o3 e8 o2 e8]2         ; bar 5
      [o2 c8 c8 o3 c8 o2 c8]2         ; bar 6
      [o2 d8 d8 o3 d8 o2 d8]2         ; bar 7
      [o2 e8 e8 o3 e8 o2 e8]2         ; bar 8
    `,
    noise: `
      [${LORD_BAR}]7 ${LORD_FILL}     ; bars 1-8
    `,
  },
  {
    id: 'cv-beast',
    bpm: 180,
    loop: true,
    // G minor with a flattened fifth, 8 bars: the beast Dracula becomes. Faster and lower than
    // his own theme, a tritone in the hook and stamping double kicks.
    pulse1: `
      @1 v12 q7 x0
      o4 g8 g8 b-8 g8 o5 d-8 c8 o4 b-8 a8   ; bar 1  Gm
      o4 g8 f+8 g8 a8 b-4 a4                ; bar 2  Gm D
      o4 g8 g8 b-8 g8 o5 e-8 d8 c8 o4 b-8   ; bar 3  Gm
      o4 a4 f+4 d4 f+4                      ; bar 4  D
      o4 g8 g8 f8 e-8 d8 d-8 c8 o3 b-8      ; bar 5  Gm
      o4 c4 e-4 g4 f+4                      ; bar 6  Eb D
      o4 g8 f+8 e-8 d8 c8 o3 b-8 a8 f+8     ; bar 7  Cm D
      o3 g2 r4 o4 d-4                       ; bar 8  Gm
    `,
    pulse2: `
      @2 v6 q6 x0
      [o3 g16 b-16 o4 d16 o3 b-16]4                          ; bar 1
      [o3 g16 b-16 o4 d16 o3 b-16]2 [o3 f+16 a16 o4 d16 o3 a16]2 ; bar 2
      [o3 g16 b-16 o4 d16 o3 b-16]4                          ; bar 3
      [o3 f+16 a16 o4 d16 o3 a16]4                           ; bar 4
      [o3 g16 b-16 o4 d16 o3 b-16]4                          ; bar 5
      [o3 e-16 g16 b-16 g16]2 [o3 d16 f+16 a16 f+16]2        ; bar 6
      [o3 c16 e-16 g16 e-16]2 [o3 d16 f+16 a16 f+16]2        ; bar 7
      [o3 g16 b-16 o4 d16 o3 b-16]4                          ; bar 8
    `,
    triangle: `
      q6
      [o2 g8 o3 g8]4                  ; bar 1
      [o2 g8 o3 g8]2 [o2 d8 o3 d8]2   ; bar 2
      [o2 g8 o3 g8]4                  ; bar 3
      [o2 d8 o3 d8]4                  ; bar 4
      [o2 g8 o3 g8]4                  ; bar 5
      [o2 e-8 o3 e-8]2 [o2 d8 o3 d8]2 ; bar 6
      [o2 c8 o3 c8]2 [o2 d8 o3 d8]2   ; bar 7
      [o2 g8 o3 g8]4                  ; bar 8
    `,
    noise: `
      [${BEAST_BAR}]7 ${BEAST_FILL}   ; bars 1-8
    `,
  },
];
