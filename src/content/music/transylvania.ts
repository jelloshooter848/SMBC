import type { Song } from '@engine/audio/mml';

/**
 * World 5 as Simon's world, Transylvania (0.4.28): two original loops in the mood of the NES
 * vampire-hunting games (composed for this project, nothing transcribed). The rest of World 5
 * reuses Simon's: 5-1's gate plays 5-4's `cv-hall`, the catacombs the `crypt`, 5-3's clock tower
 * the castle stage `cv-stage` (castlevania.ts). Same conventions as songs.ts: pulse1 = melody,
 * pulse2 = harmony, triangle = bass, noise = drums; every channel the same length.
 */

// The town: a walking kick-snare bar with eighth hats, and a snare-run fill.
const TOWN_BAR = 'v10 k8 v6 h8 v9 s8 v6 h8 v10 k8 k8 v9 s8 v6 h8';
const TOWN_FILL = 'v10 k8 v6 h8 v9 s8 v6 h8 v9 s16 s16 s16 s16 v11 s8 s8';

export const transylvaniaSongs: Song[] = [
  {
    id: 'cv-town',
    bpm: 138,
    loop: true,
    // G minor, 8 bars: 5-2's town streets at night (and its stormy coin heaven). A wistful walking
    // tune that climbs to the D major turn and falls home, over eighth-note arpeggios and a
    // bouncing octave bass.
    pulse1: `
      @2 v11 q7 x0
      o4 g8 a8 b-8 a8 g4 d4                 ; bar 1  Gm
      o4 e-8 f8 g8 f8 e-4 d4                ; bar 2  Eb
      o4 f8 g8 a8 g8 f4 c4                  ; bar 3  F
      o4 d8 e8 f+8 a8 o5 d4 o4 a4           ; bar 4  D
      o5 d8 c8 o4 b-8 a8 b-4 g4             ; bar 5  Gm
      o5 c8 o4 b-8 a8 g8 a4 e-4             ; bar 6  Cm
      o4 f+8 g8 a8 b-8 a4 f+4               ; bar 7  D
      o4 g2 r4 d4                           ; bar 8  Gm
    `,
    pulse2: `
      @1 v6 q6 x0
      [o3 g8 b-8 o4 d8 o3 b-8]2             ; bar 1  Gm
      [o3 e-8 g8 b-8 g8]2                   ; bar 2  Eb
      [o3 f8 a8 o4 c8 o3 a8]2               ; bar 3  F
      [o3 f+8 a8 o4 d8 o3 a8]2              ; bar 4  D
      [o3 g8 b-8 o4 d8 o3 b-8]2             ; bar 5  Gm
      [o3 c8 e-8 g8 e-8]2                   ; bar 6  Cm
      [o3 f+8 a8 o4 d8 o3 a8]2              ; bar 7  D
      [o3 g8 b-8 o4 d8 o3 b-8]2             ; bar 8  Gm
    `,
    triangle: `
      q6
      [o2 g8 o3 g8]4                        ; bar 1
      [o2 e-8 o3 e-8]4                      ; bar 2
      [o2 f8 o3 f8]4                        ; bar 3
      [o2 d8 o3 d8]4                        ; bar 4
      [o2 g8 o3 g8]4                        ; bar 5
      [o2 c8 o3 c8]4                        ; bar 6
      [o2 d8 o3 d8]4                        ; bar 7
      [o2 g8 o3 g8]4                        ; bar 8
    `,
    noise: `
      [${TOWN_BAR}]7 ${TOWN_FILL}           ; bars 1-8
    `,
  },
  {
    id: 'cv-lake',
    bpm: 96,
    loop: true,
    // A minor, 8 bars: 5-2's underground lake. A slow, uneasy lead over rippling sixteenth-note
    // arpeggios and one held root a bar; the only percussion is water dripping in the dark.
    pulse1: `
      @2 v8 q8 x1
      o4 e2 a4 g4                           ; bar 1  Am
      o4 f2. e4                             ; bar 2  F
      o4 d4 f4 a4 g4                        ; bar 3  Dm
      o4 g+2 b4 e4                          ; bar 4  E
      o5 c2 o4 b4 a4                        ; bar 5  Am
      o4 a4 g4 f4 e4                        ; bar 6  F
      o4 d4 e4 g+4 b4                       ; bar 7  E
      o4 a1                                 ; bar 8  Am
    `,
    pulse2: `
      @1 v4 q6 x1
      [o3 a16 o4 c16 e16 c16]4              ; bar 1  Am
      [o3 f16 a16 o4 c16 o3 a16]4           ; bar 2  F
      [o3 d16 f16 a16 f16]4                 ; bar 3  Dm
      [o3 g+16 b16 o4 e16 o3 b16]4          ; bar 4  E
      [o3 a16 o4 c16 e16 c16]4              ; bar 5  Am
      [o3 f16 a16 o4 c16 o3 a16]4           ; bar 6  F
      [o3 g+16 b16 o4 e16 o3 b16]4          ; bar 7  E
      [o3 a16 o4 c16 e16 c16]4              ; bar 8  Am
    `,
    triangle: `
      q8
      o2 a1 f1 d1 e1 a1 f1 e1 a1            ; bars 1-8: one held root a bar
    `,
    noise: `
      [v3 x1 h8 r8 r4 v2 h16 r16 r8 r4]8    ; bars 1-8: water dripping somewhere
    `,
  },
];
