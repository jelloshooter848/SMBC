import type { Song } from '@engine/audio/mml';
import { smb3Songs } from './smb3';

/**
 * Original chiptune score for the game. Everything here is composed for this project; nothing is
 * transcribed from any existing game. Channels: pulse1 = melody, pulse2 = harmony / accompaniment,
 * triangle = bass (volume and duty are ignored on it), noise = drums (k / s / h macros).
 *
 * Every channel of a song has the same length in ticks (PPQ = 48 per quarter), and loop points
 * (`L`) sit at the same tick on every channel, which music.test.ts verifies.
 */

// A swung shuffle bar: triplet subdivision with kick/snare on the beats and a soft hat on the
// third triplet. Two half-bars per bar.
const SWING_BAR = '[v11 k12 r12 v6 h12 v10 s12 r12 v6 h12]2';
const SWING_FILL = 'v11 k12 r12 v6 h12 v10 s12 r12 v6 h12 v11 k12 r12 v6 h12 v10 s12 s12 s12';

// Straight driving rock bar (8ths), plus a fill variant with a snare roll on beat 4.
const DRIVE_BAR = 'v11 k8 v6 h8 v10 s8 v6 h8 v11 k8 k8 v10 s8 v6 h8';
const DRIVE_FILL = 'v11 k8 v6 h8 v10 s8 v6 h8 v11 k8 k8 v10 s16 s16 s16 s16';

// Mega Man's station: a straight rock bar with sixteenth-note hats, and its snare-roll fill.
const ROBOT_BAR = 'v11 k8 v6 h16 h16 v10 s8 v6 h16 h16 v11 k8 v11 k8 v10 s8 v6 h16 h16';
const ROBOT_FILL = 'v11 k8 v6 h16 h16 v10 s8 v6 h16 h16 v11 k8 v10 s16 s16 s16 s16 v12 s8';
// The boss fight: kick and snare on every beat pair, hats crowding the gaps.
const BOSS_BAR = '[v12 k8 v6 h16 h16 v11 s8 v6 h16 h16]2';
const BOSS_FILL = 'v12 k8 v6 h16 h16 v11 s8 v6 h16 h16 v10 s16 s16 s16 s16 v11 s16 s16 v12 s16 s16';

export const songs: Song[] = [
  {
    id: 'overworld',
    bpm: 168,
    loop: true,
    // C major, 16 bars, A A' B A A' C. Bright and bouncy.
    pulse1: `
      @2 v12 q6 x0
      o5 g8 g8 r8 e8 g8 r8 a8 b8      ; bar 1  (C)
      o6 c8 o5 b8 a8 g8 e4 r4         ; bar 2  (C)
      o5 a8 a8 r8 f8 a8 r8 b8 o6 c8   ; bar 3  (F)
      o6 d8 c8 o5 b8 g8 a4 r4         ; bar 4  (G)
      o5 e4 g8 a8 o6 c4 o5 a8 g8      ; bar 5  (C)
      o5 e8 g8 a8 o6 c8 d4 c8 o5 a8   ; bar 6  (Am)
      o5 g8 a8 g8 e8 d4 e8 d8         ; bar 7  (G)
      o5 c4 r8 c8 d8 e8 g8 a8         ; bar 8  (C -> G)
      o5 g8 g8 r8 e8 g8 r8 a8 b8      ; bar 9  (C)
      o6 c8 o5 b8 a8 g8 e4 r4         ; bar 10 (C)
      o5 a8 a8 r8 f8 a8 r8 b8 o6 c8   ; bar 11 (F)
      o6 d8 c8 o5 b8 g8 a4 r4         ; bar 12 (G)
      o6 c4 o5 a8 g8 a4 g8 e8         ; bar 13 (F)
      o5 d8 e8 d8 c8 o4 b4 o5 c8 d8   ; bar 14 (G)
      o5 e8 g8 a8 g8 e8 d8 c8 d8      ; bar 15 (C G)
      o5 c4 r8 o4 g8 o5 c8 r8 r4      ; bar 16 (C)
    `,
    pulse2: `
      @0 v9 q6 x0
      o5 e8 e8 r8 c8 e8 r8 f8 g8      ; bar 1  thirds under the tune
      o5 a8 g8 f8 e8 c4 r4            ; bar 2
      o5 f8 f8 r8 d8 f8 r8 g8 a8      ; bar 3
      o5 b8 a8 g8 e8 f4 r4            ; bar 4
      o4 c8 e8 g8 e8 c8 e8 g8 e8      ; bar 5  arpeggios under the B section
      o4 a8 o5 c8 e8 c8 o4 a8 o5 c8 e8 c8 ; bar 6
      o4 g8 b8 o5 d8 o4 b8 g8 b8 o5 d8 o4 b8 ; bar 7
      o4 c8 e8 g8 e8 d8 g8 b8 g8      ; bar 8
      o5 e8 e8 r8 c8 e8 r8 f8 g8      ; bar 9
      o5 a8 g8 f8 e8 c4 r4            ; bar 10
      o5 f8 f8 r8 d8 f8 r8 g8 a8      ; bar 11
      o5 b8 a8 g8 e8 f4 r4            ; bar 12
      o5 a4 f8 e8 f4 e8 c8            ; bar 13
      o4 b8 o5 c8 o4 b8 a8 g4 a8 b8   ; bar 14
      o5 c8 e8 f8 e8 c8 o4 b8 a8 b8   ; bar 15
      o4 g4 r8 e8 g8 r8 r4            ; bar 16
    `,
    triangle: `
      q7
      o2 c8 o3 c8 o2 e8 o3 e8 o2 g8 o3 g8 o2 a8 o3 a8   ; bar 1  walking C
      o2 c8 o3 c8 o2 g8 o3 g8 o2 c8 o3 c8 o2 e8 f8      ; bar 2  walk up to F
      o2 f8 o3 f8 o2 a8 o3 a8 o3 c8 c8 o2 a8 f+8        ; bar 3  F, f# leads to G
      o2 g8 o3 g8 o2 d8 o3 d8 o2 g8 r8 o2 a8 b8         ; bar 4  G, walk to C
      o2 c8 o3 c8 o2 e8 o3 e8 o2 g8 o3 g8 o2 g8 g+8     ; bar 5  C, g# leads to Am
      o2 a8 o3 a8 o2 e8 o3 e8 o2 a8 o3 a8 o2 b8 a8      ; bar 6  Am
      o2 g8 o3 g8 o2 d8 o3 d8 o2 g8 o3 g8 o2 a8 b8      ; bar 7  G
      o2 c8 o3 c8 o2 e8 o3 e8 o2 g8 o3 g8 o2 g8 r8      ; bar 8  C / G
      o2 c8 o3 c8 o2 e8 o3 e8 o2 g8 o3 g8 o2 a8 o3 a8   ; bar 9
      o2 c8 o3 c8 o2 g8 o3 g8 o2 c8 o3 c8 o2 e8 f8      ; bar 10
      o2 f8 o3 f8 o2 a8 o3 a8 o3 c8 c8 o2 a8 f+8        ; bar 11
      o2 g8 o3 g8 o2 d8 o3 d8 o2 g8 r8 o2 a8 b8         ; bar 12
      o2 f8 o3 f8 o2 a8 o3 a8 o3 c8 c8 o2 a8 f+8        ; bar 13 F
      o2 g8 o3 g8 o2 d8 o3 d8 o2 g8 o3 g8 o2 a8 b8      ; bar 14 G
      o2 c8 o3 c8 o2 e8 o3 e8 o2 g8 r8 o2 g8 r8         ; bar 15 C G
      o2 c8 r8 o2 g8 r8 o2 c8 r8 o2 a8 b8               ; bar 16 C, walk back up
    `,
    noise: `
      [${SWING_BAR}]3 ${SWING_FILL}   ; bars 1-4
      [${SWING_BAR}]3 ${SWING_FILL}   ; bars 5-8
      [${SWING_BAR}]3 ${SWING_FILL}   ; bars 9-12
      [${SWING_BAR}]3 ${SWING_FILL}   ; bars 13-16
    `,
  },

  {
    id: 'underground',
    bpm: 112,
    loop: true,
    // A minor, 8 bars. pulse1 calls in bars 1-2 / 5-6, pulse2 answers an octave down and quieter
    // in bars 3-4 / 7-8, like an echo off cave walls.
    pulse1: `
      @1 v11 q7 x0
      o4 a8 r8 o5 c8 r8 e8 r8 d8 c8   ; bar 1  call
      o4 b4 r4 r2                     ; bar 2
      r1                              ; bar 3  (echo answers)
      r1                              ; bar 4
      o4 a8 r8 o5 c8 r8 f8 r8 e8 d8   ; bar 5  second call
      o5 c4 r4 o4 b8 r8 g+8 r8        ; bar 6
      r1                              ; bar 7
      r1                              ; bar 8
    `,
    pulse2: `
      @0 v7 q7 x1
      r1                              ; bar 1
      r1                              ; bar 2
      o3 a8 r8 o4 c8 r8 e8 r8 d8 c8   ; bar 3  echo of the call
      o3 b4 r4 r2                     ; bar 4
      r1                              ; bar 5
      r1                              ; bar 6
      o3 a8 r8 o4 c8 r8 f8 r8 e8 d8   ; bar 7  echo of the second call
      o4 c4 r4 o3 b8 r8 g+8 r8        ; bar 8
    `,
    triangle: `
      q8
      o2 a2 r2                        ; bar 1
      r1                              ; bar 2
      o2 a2 r2                        ; bar 3
      r1                              ; bar 4
      o2 a2 r2                        ; bar 5
      o2 f2 e2                        ; bar 6
      o2 a2 r2                        ; bar 7
      o2 e2 r2                        ; bar 8
    `,
    noise: `
      [v10 k4 r2 r8 v6 h8 r1]4        ; a lone kick every other bar
    `,
  },

  {
    id: 'castle',
    bpm: 150,
    loop: true,
    // E minor, 8 bars. A sixteenth-note root/fifth ostinato on pulse2 under long chromatic
    // melody tones; the bass pumps octaves.
    pulse1: `
      @2 v12 q8 x0
      o5 e2. d+4                      ; bar 1
      o5 e4 g4 f+4 f4                 ; bar 2
      o5 e2 c4 o4 b4                  ; bar 3
      o4 a+2 b2                       ; bar 4
      o5 e4 r8 e8 e4 f4               ; bar 5
      o5 g4 f+8 f8 e4 d+4             ; bar 6
      o5 c4 o4 b4 o5 c4 d4            ; bar 7
      o4 b2 r8 b8 r8 b8               ; bar 8
    `,
    pulse2: `
      @0 v9 q7 x0
      [o4 e16 b16 o5 e16 o4 b16]4     ; bar 1  E
      [o4 e16 b16 o5 e16 o4 b16]4     ; bar 2  E
      [o4 c16 g16 o5 c16 o4 g16]2 [o4 b16 f+16 o5 b16 o4 f+16]2   ; bar 3  C B
      [o4 a+16 f16 o5 a+16 o4 f16]2 [o4 b16 f+16 o5 b16 o4 f+16]2 ; bar 4  A#(tritone) B
      [o4 e16 b16 o5 e16 o4 b16]4     ; bar 5  E
      [o4 e16 b16 o5 e16 o4 b16]4     ; bar 6  E
      [o4 c16 g16 o5 c16 o4 g16]2 [o4 d16 a16 o5 d16 o4 a16]2     ; bar 7  C D
      [o4 b16 f+16 o5 b16 o4 f+16]4   ; bar 8  B
    `,
    triangle: `
      q7
      [o2 e8 o3 e8]4                  ; bar 1
      [o2 e8 o3 e8]4                  ; bar 2
      [o2 c8 o3 c8]2 [o2 b8 o3 b8]2   ; bar 3
      [o2 a+8 o3 a+8]2 [o2 b8 o3 b8]2 ; bar 4
      [o2 e8 o3 e8]4                  ; bar 5
      [o2 e8 o3 e8]4                  ; bar 6
      [o2 c8 o3 c8]2 [o2 d8 o3 d8]2   ; bar 7
      [o2 b8 o3 b8]4                  ; bar 8
    `,
    noise: `
      [${DRIVE_BAR}]7 ${DRIVE_FILL}   ; bars 1-8
    `,
  },

  {
    id: 'water',
    bpm: 150,
    loop: true,
    // D major waltz (3/4), 16 bars. Long lilting melody over flowing eighth-note arpeggios.
    pulse1: `
      @2 v11 q8 x0
      o5 f+2 g4                       ; bar 1  D
      o5 a2.                          ; bar 2
      o5 b2 a4                        ; bar 3  Bm
      o5 f+2.                         ; bar 4
      o5 g2 a4                        ; bar 5  G
      o5 b2 g4                        ; bar 6
      o5 a2 g4                        ; bar 7  A
      o5 e2.                          ; bar 8
      o5 f+2 g4                       ; bar 9  D
      o5 a2 o6 d4                     ; bar 10
      o5 b2 o6 d4                     ; bar 11 Bm
      o6 c+2 o5 b4                    ; bar 12
      o5 g2 f+4                       ; bar 13 Em
      o5 e2.                          ; bar 14
      o5 e2 f+4                       ; bar 15 A
      o5 e2 c+4                       ; bar 16
    `,
    pulse2: `
      @0 v8 q8 x0
      [o4 d8 f+8 a8 o5 d8 o4 a8 f+8]2 ; bars 1-2   D
      [o3 b8 o4 d8 f+8 b8 f+8 d8]2    ; bars 3-4   Bm
      [o3 g8 b8 o4 d8 g8 d8 o3 b8]2   ; bars 5-6   G
      [o3 a8 o4 c+8 e8 a8 e8 c+8]2    ; bars 7-8   A
      [o4 d8 f+8 a8 o5 d8 o4 a8 f+8]2 ; bars 9-10  D
      [o3 b8 o4 d8 f+8 b8 f+8 d8]2    ; bars 11-12 Bm
      [o4 e8 g8 b8 o5 e8 o4 b8 g8]2   ; bars 13-14 Em
      [o3 a8 o4 c+8 e8 a8 e8 c+8]2    ; bars 15-16 A
    `,
    triangle: `
      q7
      [o2 d4 a4 a4]2                  ; bars 1-2   oom-pah-pah
      [o2 b4 f+4 f+4]2                ; bars 3-4
      [o2 g4 o3 d4 d4]2               ; bars 5-6
      [o2 a4 o3 e4 e4]2               ; bars 7-8
      [o2 d4 a4 a4]2                  ; bars 9-10
      [o2 b4 f+4 f+4]2                ; bars 11-12
      [o2 e4 b4 b4]2                  ; bars 13-14
      [o2 a4 o3 e4 e4]2               ; bars 15-16
    `,
    noise: `
      [v9 k4 v5 h4 h4]16              ; light waltz brushes
    `,
  },

  {
    id: 'star',
    bpm: 200,
    loop: true,
    // C major, 4 bars, as fast and giddy as it gets.
    pulse1: `
      @2 v12 q6 x0
      o5 c8 e8 g8 e8 a8 g8 e8 c8      ; bar 1  C
      o5 d8 f8 a8 f8 g8 f8 d8 o4 b8   ; bar 2  Dm
      o5 c8 e8 g8 e8 a8 g8 e8 c8      ; bar 3  C
      o5 d8 e8 f8 g8 a8 b8 o6 c8 o5 b8 ; bar 4  G run
    `,
    pulse2: `
      @0 v8 q7 x0
      [o4 c16 e16 g16 e16]4           ; bar 1
      [o4 d16 f16 a16 f16]4           ; bar 2
      [o4 c16 e16 g16 e16]4           ; bar 3
      [o4 g16 b16 o5 d16 o4 b16]4     ; bar 4
    `,
    triangle: `
      q7
      [o2 c8 o3 c8]4                  ; bar 1
      [o2 d8 o3 d8]4                  ; bar 2
      [o2 c8 o3 c8]4                  ; bar 3
      [o2 g8 o3 g8]4                  ; bar 4
    `,
    noise: `
      [v11 k8 v6 h8 v10 s8 v6 h8]7 v11 k8 v6 h8 v10 s16 s16 s16 s16
    `,
  },

  {
    id: 'title',
    bpm: 140,
    loop: true,
    // Two-bar fanfare on the overworld motif, then loops a gentler statement of the A phrase.
    // The loop point (L) is at the start of bar 3 on every channel.
    pulse1: `
      @2 v12 q7 x0
      o5 g16 g16 g8 e8 g8 a8 b8 o6 c4      ; bar 1  fanfare
      o6 c4. o5 g8 o6 c2                   ; bar 2
      L
      o5 g8 g8 r8 e8 g8 r8 a8 b8           ; bar 3
      o6 c8 o5 b8 a8 g8 e4 r4              ; bar 4
      o5 a8 a8 r8 f8 a8 r8 b8 o6 c8        ; bar 5
      o6 d8 c8 o5 b8 g8 a4 r4              ; bar 6
      o5 e4 g8 a8 o6 c4 o5 a8 g8           ; bar 7
      o5 e8 d8 c4 r2                       ; bar 8
    `,
    pulse2: `
      @0 v9 q7 x0
      o5 e16 e16 e8 c8 e8 f8 g8 a4         ; bar 1
      o5 e4. e8 e2                         ; bar 2
      L
      o5 e8 e8 r8 c8 e8 r8 f8 g8           ; bar 3
      o5 a8 g8 f8 e8 c4 r4                 ; bar 4
      o5 f8 f8 r8 d8 f8 r8 g8 a8           ; bar 5
      o5 b8 a8 g8 e8 f4 r4                 ; bar 6
      o5 c4 e8 f8 a4 f8 e8                 ; bar 7
      o5 c8 o4 b8 g4 r2                    ; bar 8
    `,
    triangle: `
      q7
      o2 c16 c16 c8 c8 c8 c8 c4 r8         ; bar 1
      o2 c4. g8 c2                         ; bar 2
      L
      o2 c8 o3 c8 o2 e8 o3 e8 o2 g8 o3 g8 o2 a8 o3 a8   ; bar 3
      o2 c8 o3 c8 o2 g8 o3 g8 o2 c8 o3 c8 o2 e8 f8      ; bar 4
      o2 f8 o3 f8 o2 a8 o3 a8 o3 c8 c8 o2 a8 f+8        ; bar 5
      o2 g8 o3 g8 o2 d8 o3 d8 o2 g8 r8 o2 a8 b8         ; bar 6
      o2 c8 o3 c8 o2 e8 o3 e8 o2 f8 o3 f8 o2 a8 o3 a8   ; bar 7
      o2 c8 o3 c8 o2 c4 r2                              ; bar 8
    `,
    noise: `
      v11 k16 k16 k8 v10 s8 v6 h8 v10 s8 v11 k4 r8      ; bar 1
      v10 s4. v6 h8 v11 k2                              ; bar 2
      L
      [${SWING_BAR}]5 ${SWING_FILL}                     ; bars 3-8
    `,
  },

  {
    id: 'hurry',
    bpm: 150,
    loop: false,
    // One bar: an insistent repeated high note, then a quick upward nudge.
    pulse1: `
      @2 v12 q7 x0
      [o6 c16 c16 r16 c16 r8]2 e8 g8
    `,
    pulse2: `
      @0 v9 q7 x0
      [o5 a16 a16 r16 a16 r8]2 o6 c8 e8
    `,
    triangle: `
      q7
      [o2 a16 a16 r16 a16 r8]2 a8 a8
    `,
    noise: `
      [v10 s16 s16 r16 s16 r8]2 v11 k8 v10 s8
    `,
  },

  {
    id: 'death',
    bpm: 150,
    loop: false,
    // A little wobble, then a tumbling descent that slides off the bottom.
    pulse1: `
      @2 v12 q8 x0
      o5 l16 e f e f r8
      l8 q6 x1 g e c o4 a f d
      q8 x0 p-12 o4 c4.
    `,
    pulse2: `
      @0 v9 q8 x0
      o5 l16 c d c d r8
      l8 q6 x1 e c o4 a f d o3 b
      q8 x0 p-12 o3 g4.
    `,
    triangle: `
      q8
      r4.
      l8 o3 c o2 a f d c o1 b
      o2 c4.
    `,
    noise: `
      r4. r2 v10 s16 s16 s16 s16 v12 k4.
    `,
  },

  {
    id: 'level-clear',
    bpm: 160,
    loop: false,
    // Rising C major arpeggio into a held chord.
    pulse1: `
      @2 v12 q7 x0
      o5 c8 e8 g8 o6 c8 o5 e8 g8 o6 c8 e8   ; bar 1
      q8 o6 g1                              ; bar 2  held
    `,
    pulse2: `
      @0 v9 q7 x0
      o4 g8 o5 c8 e8 g8 c8 e8 g8 o6 c8      ; bar 1
      q8 o6 e1                              ; bar 2
    `,
    triangle: `
      q7
      o2 c8 r8 g8 r8 c8 r8 g8 r8            ; bar 1
      q8 o2 c1                              ; bar 2
    `,
    noise: `
      v11 k8 v6 h8 v10 s8 v6 h8 v11 k8 v6 h8 v10 s16 s16 s16 s16   ; bar 1
      v10 s4 r2.                                                   ; bar 2
    `,
  },

  {
    id: 'castle-clear',
    bpm: 160,
    loop: false,
    // Three bars: brassy call, answer through F, then the title cadence.
    pulse1: `
      @2 v12 q7 x0
      o5 c16 c16 c8 e8 g8 o6 c4 o5 g8 e8    ; bar 1
      o5 f8 a8 o6 c8 f8 e8 d8 c8 o5 b8      ; bar 2
      q8 o6 c4. o5 g8 o6 c2                 ; bar 3
    `,
    pulse2: `
      @0 v9 q7 x0
      o4 g16 g16 g8 o5 c8 e8 g4 e8 c8       ; bar 1
      o5 c8 f8 a8 o6 c8 o5 g8 f8 e8 d8      ; bar 2
      q8 o5 e4. e8 e2                       ; bar 3
    `,
    triangle: `
      q7
      o2 c16 c16 c8 c8 c8 c4 c8 c8          ; bar 1
      o2 f8 f8 f8 f8 g8 g8 g8 g8            ; bar 2
      q8 o2 c4. g8 c2                       ; bar 3
    `,
    noise: `
      v11 k16 k16 k8 v10 s8 v6 h8 v10 s4 v11 k8 v10 s8               ; bar 1
      v11 k8 v6 h8 v10 s8 v6 h8 v11 k8 v6 h8 v10 s16 s16 s16 s16     ; bar 2
      v10 s4. v6 h8 v11 k2                                           ; bar 3
    `,
  },

  {
    id: 'game-over',
    bpm: 120,
    loop: false,
    // A minor: a slow fall onto the dominant, then a quiet minor resolution.
    pulse1: `
      @2 v11 q8 x0
      o5 e4 c4 o4 a4 b8 g+8 a2
    `,
    pulse2: `
      @0 v8 q8 x0
      o5 c4 o4 a4 f4 g+8 e8 o5 c2
    `,
    triangle: `
      q8
      o2 a4 a4 f4 e8 e8 a2
    `,
    noise: `
      v8 x1 l4 n12 r4 r4 r4 l2 n12
    `,
  },

  {
    id: 'world-clear',
    bpm: 150,
    loop: false,
    // Three bars of victory: snappy repeated-note call, climbing answer, big cadence.
    pulse1: `
      @2 v12 q7 x0
      o5 c8 r16 c16 c8 r16 c16 c8 e8 g8 o6 c8   ; bar 1
      o6 d8 c8 o5 b8 o6 c8 d4 e4                ; bar 2
      q8 o6 e4. d8 c2                           ; bar 3
    `,
    pulse2: `
      @0 v9 q7 x0
      o4 g8 r16 g16 g8 r16 g16 g8 o5 c8 e8 g8   ; bar 1
      o5 b8 a8 g8 a8 b4 o6 c4                   ; bar 2
      q8 o5 g4. g8 e2                           ; bar 3
    `,
    triangle: `
      q7
      o2 c8 r16 c16 c8 r16 c16 c8 e8 g8 o3 c8   ; bar 1
      o2 g8 g8 g8 g8 g4 g4                      ; bar 2
      q8 o2 c4. c8 c2                           ; bar 3
    `,
    noise: `
      v11 k8 r16 v6 h16 v11 k8 r16 v6 h16 v11 k8 v10 s8 v11 k8 v10 s8   ; bar 1
      v11 k8 v6 h8 v10 s8 v6 h8 v10 s16 s16 s16 s16 v11 k4              ; bar 2
      v10 s4. v6 h8 v11 k2                                              ; bar 3
    `,
  },

  {
    id: 'credits',
    bpm: 108,
    loop: true,
    // The ending's credits roll (the original changes to its credits music there). C major,
    // 8 bars: an unhurried, singing farewell over a rocking root-fifth bass and soft brushes.
    pulse1: `
      @2 v11 q7 x0
      o5 e4 d8 c8 d4 o4 g4                 ; bar 1  (C)
      o5 c4. d8 e2                         ; bar 2  (C)
      o5 f4 e8 d8 e4 a4                    ; bar 3  (F)
      o5 g2. r4                            ; bar 4  (G)
      o5 a4 g8 f8 e4 c4                    ; bar 5  (Am)
      o5 f4. e8 d2                         ; bar 6  (F)
      o5 e4 d8 c8 d4 o4 b4                 ; bar 7  (G)
      o5 c2. r4                            ; bar 8  (C)
    `,
    pulse2: `
      @0 v7 q8 x0
      o4 e2 g2                             ; bar 1
      o4 e2 g2                             ; bar 2
      o4 a2 o5 c2                          ; bar 3
      o4 b2 g2                             ; bar 4
      o5 c2 o4 a2                          ; bar 5
      o4 a2 f2                             ; bar 6
      o4 g2 f2                             ; bar 7
      o4 e2. r4                            ; bar 8
    `,
    triangle: `
      q7
      o2 c4 g4 o3 c4 o2 g4                 ; bar 1
      o2 c4 g4 o3 c4 o2 g4                 ; bar 2
      o2 f4 o3 c4 f4 c4                    ; bar 3
      o2 g4 o3 d4 g4 d4                    ; bar 4
      o2 a4 o3 e4 a4 e4                    ; bar 5
      o2 f4 o3 c4 f4 c4                    ; bar 6
      o2 g4 o3 d4 o2 g4 b4                 ; bar 7
      o3 c2. r4                            ; bar 8
    `,
    noise: `
      [v8 k4 v5 h8 h8 v7 s4 v5 h8 h8]7     ; bars 1-7
      v8 k4 v5 h8 h8 v7 s4 s8 s8           ; bar 8
    `,
  },

  {
    id: 'map',
    bpm: 132,
    loop: true,
    // F major, 16 bars (A 8 + B 8). A skipping, dotted strut for strolling the world map:
    // off-beat chord stabs on pulse2, a walking root-fifth bass and light brushes.
    pulse1: `
      @2 v11 q6 x0
      o5 c8. f16 f8 a8 o6 c4 o5 a8 f8    ; bar 1  F
      o5 d8. f16 a8 f8 d4 r8 c8          ; bar 2  Dm
      o5 d8. f16 b-8 o6 d8 c4 o5 b-8 a8  ; bar 3  Bb
      o5 g8 a8 b-8 a8 g4 r4              ; bar 4  C
      o5 c8. f16 f8 a8 o6 c4 o5 a8 o6 c8 ; bar 5  F
      o6 e8. d16 c8 o5 a8 e4 r8 e8       ; bar 6  Am
      o5 f8 g8 a8 b-8 o6 c8 d8 e8 g8     ; bar 7  Bb C
      o6 f4 c8 o5 a8 f4 r4               ; bar 8  F
      o5 f4 b-8 o6 c8 d4 c8 o5 b-8       ; bar 9  Bb
      o5 a4 f8 a8 o6 c4 r4               ; bar 10 F
      o5 g8 a8 b-8 o6 d8 c8 o5 b-8 a8 g8 ; bar 11 Gm
      o5 e4 g8 o6 c8 o5 b-4 r4           ; bar 12 C7
      o5 f4 b-8 o6 c8 d4 f8 d8           ; bar 13 Bb
      o6 c4 o5 a8 f8 a4 r8 o6 c8         ; bar 14 F
      o5 b-8 a8 g8 b-8 o6 c8 o5 b-8 a8 g8 ; bar 15 Gm C
      o5 f4 r8 c8 f4 r4                  ; bar 16 F
    `,
    pulse2: `
      @1 v7 q4 x0
      r8 o4 a8 r8 o5 c8 r8 o4 a8 r8 o5 c8 ; bar 1  F
      r8 o4 f8 r8 a8 r8 f8 r8 a8          ; bar 2  Dm
      r8 o4 f8 r8 b-8 r8 f8 r8 b-8        ; bar 3  Bb
      r8 o4 e8 r8 g8 r8 e8 r8 g8          ; bar 4  C
      r8 o4 a8 r8 o5 c8 r8 o4 a8 r8 o5 c8 ; bar 5  F
      r8 o4 e8 r8 a8 r8 e8 r8 a8          ; bar 6  Am
      r8 o4 f8 r8 b-8 r8 g8 r8 o5 c8      ; bar 7  Bb C
      r8 o4 a8 r8 o5 c8 r8 o4 a8 r4       ; bar 8  F
      r8 o4 f8 r8 b-8 r8 f8 r8 b-8        ; bar 9  Bb
      r8 o4 a8 r8 o5 c8 r8 o4 a8 r8 o5 c8 ; bar 10 F
      r8 o4 g8 r8 b-8 r8 g8 r8 b-8        ; bar 11 Gm
      r8 o4 g8 r8 b-8 r8 e8 r8 g8         ; bar 12 C7
      r8 o4 f8 r8 b-8 r8 f8 r8 b-8        ; bar 13 Bb
      r8 o4 a8 r8 o5 c8 r8 o4 a8 r8 o5 c8 ; bar 14 F
      r8 o4 g8 r8 b-8 r8 e8 r8 g8         ; bar 15 Gm C
      r8 o4 a8 r8 o5 c8 r8 o4 a8 r4       ; bar 16 F
    `,
    triangle: `
      q6
      o2 f4 o3 c4 o2 a4 o3 c4            ; bar 1
      o2 d4 a4 f4 a4                     ; bar 2
      o2 b-4 o3 f4 o2 b-4 o3 d4          ; bar 3
      o2 c4 g4 e4 g4                     ; bar 4
      o2 f4 o3 c4 o2 a4 o3 c4            ; bar 5
      o2 a4 o3 e4 o2 a4 g4               ; bar 6
      o2 b-4 o3 d4 o2 c4 e4              ; bar 7
      o2 f4 o3 c4 o2 f4 r4               ; bar 8
      o2 b-4 o3 f4 d4 f4                 ; bar 9
      o2 a4 o3 c4 o2 f4 o3 c4            ; bar 10
      o2 g4 o3 d4 o2 b-4 o3 d4           ; bar 11
      o2 c4 g4 b-4 g4                    ; bar 12
      o2 b-4 o3 f4 d4 f4                 ; bar 13
      o2 a4 o3 c4 o2 f4 a4               ; bar 14
      o2 g4 b-4 c4 e4                    ; bar 15
      o2 f4 o3 c4 o2 f4 r4               ; bar 16
    `,
    noise: `
      [[v9 k8 v5 h8 v8 s8 v5 h8]2]7 v9 k8 v5 h8 v8 s8 v5 h8 v9 k8 v5 h8 v8 s16 s16 v5 h8   ; bars 1-8
      [[v9 k8 v5 h8 v8 s8 v5 h8]2]7 v9 k8 v5 h8 v8 s8 v5 h8 v9 k8 v8 s16 s16 s16 s16 r8   ; bars 9-16
    `,
  },

  {
    id: 'map-bowser',
    bpm: 112,
    loop: true,
    // D minor, 8 bars. The World 8 map: a low, pacing eighth-note ostinato, a brooding melody
    // with a raised-fourth sting, and a heartbeat on the drums.
    pulse1: `
      @1 v10 q7 x0
      o5 d4. e8 f4 e4                    ; bar 1  Dm
      o5 d4 a4 g+4 a4                    ; bar 2  Dm
      o5 b-4. a8 g4 f4                   ; bar 3  Bb
      o5 e2 c+4 r4                       ; bar 4  A
      o5 d4. e8 f4 g4                    ; bar 5  Dm
      o5 a4 b-4 a4 g4                    ; bar 6  Gm
      o5 f4 d4 e4 c+4                    ; bar 7  Bb A
      o5 d2 r2                           ; bar 8  Dm
    `,
    pulse2: `
      @0 v7 q5 x0
      [o3 d8 a8 o4 d8 o3 a8]2            ; bar 1
      [o3 d8 a8 o4 d8 o3 a8]2            ; bar 2
      [o3 b-8 o4 f8 b-8 f8]2             ; bar 3
      [o3 a8 o4 e8 a8 e8]2               ; bar 4
      [o3 d8 a8 o4 d8 o3 a8]2            ; bar 5
      [o3 g8 o4 d8 g8 d8]2               ; bar 6
      [o3 b-8 o4 f8]2 [o3 a8 o4 e8]2     ; bar 7
      [o3 d8 a8 o4 d8 o3 a8]2            ; bar 8
    `,
    triangle: `
      q8
      o2 d2 d2                           ; bar 1
      o2 d2 c+2                          ; bar 2
      o2 b-2 b-2                         ; bar 3
      o2 a2 a2                           ; bar 4
      o2 d2 d2                           ; bar 5
      o2 g2 g2                           ; bar 6
      o2 b-2 a2                          ; bar 7
      o2 d2 a2                           ; bar 8
    `,
    noise: `
      [v10 k4 r4 v8 k8 k8 v5 h4]8        ; heartbeat
    `,
  },

  {
    id: 'dungeon',
    bpm: 120,
    loop: true,
    // A minor, 16 bars: Link's top-down dungeon. A rolling sixteenth-note arpeggio in the cellar,
    // a slow, wary melody with a flat-six sigh (bar 7) and a raised seventh that keeps pulling it
    // back to the start, a heavy quarter-note bass and only a faint tick of percussion.
    pulse1: `
      @1 v10 q7 x0
      o4 a2 o5 c4 o4 b4               ; bar 1  Am
      o4 a4. e8 e2                    ; bar 2  Am
      o4 f4 a4 o5 c4 d4               ; bar 3  F
      o5 e2 o4 b4 g+4                 ; bar 4  E
      o4 a4 o5 c4 e4 d8 c8            ; bar 5  Am
      o5 d2 f4 e8 d8                  ; bar 6  Dm
      o5 d4 c4 o4 b-4 a4              ; bar 7  Bb
      o4 g+2 e4 r4                    ; bar 8  E
      o5 f2 e4 d4                     ; bar 9  Dm
      o5 c2 o4 a4 b4                  ; bar 10 Am
      o5 d4. f8 a4 g4                 ; bar 11 Dm
      o5 g+2 e2                       ; bar 12 E
      o5 f4 e4 d4 c4                  ; bar 13 F
      o4 a4 b-4 o5 c4 d4              ; bar 14 Dm
      o5 e2 d4 c4                     ; bar 15 E
      o4 b2 g+4 e4                    ; bar 16 E
    `,
    pulse2: `
      @0 v7 q6 x0
      [o3 a16 o4 c16 e16 c16]4        ; bar 1  Am
      [o3 a16 o4 c16 e16 c16]4        ; bar 2  Am
      [o3 f16 a16 o4 c16 o3 a16]4     ; bar 3  F
      [o3 e16 g+16 b16 g+16]4         ; bar 4  E
      [o3 a16 o4 c16 e16 c16]4        ; bar 5  Am
      [o3 d16 f16 a16 f16]4           ; bar 6  Dm
      [o3 b-16 o4 d16 f16 d16]4       ; bar 7  Bb
      [o3 e16 g+16 b16 g+16]4         ; bar 8  E
      [o3 d16 a16 o4 d16 o3 a16]4     ; bar 9  Dm  (root-fifth-octave in the second half)
      [o3 a16 o4 e16 a16 e16]4        ; bar 10 Am
      [o3 d16 a16 o4 d16 o3 a16]4     ; bar 11 Dm
      [o3 e16 b16 o4 e16 o3 b16]4     ; bar 12 E
      [o3 f16 o4 c16 f16 c16]4        ; bar 13 F
      [o3 d16 a16 o4 d16 o3 a16]4     ; bar 14 Dm
      [o3 e16 b16 o4 e16 o3 b16]4     ; bar 15 E
      [o3 e16 g+16 b16 g+16]4         ; bar 16 E
    `,
    triangle: `
      q6
      o2 a4. a8 a4 e4                 ; bar 1
      o2 a4. a8 a4 g+4                ; bar 2
      o2 f4. f8 f4 c4                 ; bar 3
      o2 e4. e8 e4 g+4                ; bar 4
      o2 a4. a8 a4 e4                 ; bar 5
      o2 d4. d8 d4 a4                 ; bar 6
      o2 b-4. b-8 b-4 f4              ; bar 7
      o2 e4. e8 e4 g+4                ; bar 8
      o2 d4. d8 d4 a4                 ; bar 9
      o2 a4. a8 a4 e4                 ; bar 10
      o2 d4. d8 d4 f4                 ; bar 11
      o2 e4. e8 e4 b4                 ; bar 12
      o2 f4. f8 f4 c4                 ; bar 13
      o2 d4. d8 d4 a4                 ; bar 14
      o2 e4. e8 e4 b4                 ; bar 15
      o2 e4 g+4 b4 e4                 ; bar 16
    `,
    noise: `
      [v8 k4 v4 h8 h8 v5 h4 v4 h8 h8]16 ; a slow footstep and dripping ticks
    `,
  },

  {
    id: 'keeper',
    bpm: 160,
    loop: true,
    // E minor, 8 bars: the keeper's lair. A jabbing half-step motif (e-f) over pounding octave
    // eighths, a tritone lurch to B-flat in bar 6 and a leading-tone pull back to the top.
    pulse1: `
      @0 v11 q6 x0
      o5 e8 r8 e8 f8 e4 r8 o4 b8      ; bar 1  Em
      o5 c8 o4 b8 a+8 b8 o5 e4 r4     ; bar 2  Em
      o5 e8 r8 e8 f8 g4 f8 e8         ; bar 3  C
      o5 d+4 f+4 b4 a+4               ; bar 4  B
      o6 e8 r8 d+8 e8 f8 e8 d8 c8     ; bar 5  Em
      o5 b-8 a8 b-8 o6 c8 d4 c4       ; bar 6  Bb
      o5 g8 f+8 g8 a8 b4 o6 c4        ; bar 7  C
      o5 b4 a+4 b8 r8 b8 r8           ; bar 8  B
    `,
    pulse2: `
      @1 v7 q5 x0
      [o3 b8 o4 e8 g8 e8]2            ; bar 1  Em
      [o3 b8 o4 e8 g8 e8]2            ; bar 2  Em
      [o3 g8 o4 c8 e8 c8]2            ; bar 3  C
      [o3 f+8 b8 o4 d+8 o3 b8]2       ; bar 4  B
      [o3 b8 o4 e8 g8 e8]2            ; bar 5  Em
      [o3 f8 b-8 o4 d8 o3 b-8]2       ; bar 6  Bb
      [o3 g8 o4 c8 e8 c8]2            ; bar 7  C
      [o3 f+8 b8 o4 d+8 o3 b8]2       ; bar 8  B
    `,
    triangle: `
      q6
      [o2 e8 o3 e8]4                  ; bar 1
      [o2 e8 o3 e8]4                  ; bar 2
      [o2 c8 o3 c8]4                  ; bar 3
      [o2 b8 o3 b8]4                  ; bar 4
      [o2 e8 o3 e8]4                  ; bar 5
      [o2 b-8 o3 b-8]4                ; bar 6
      [o2 c8 o3 c8]4                  ; bar 7
      [o2 b8 o3 b8]2 o2 b8 a+8 b8 o3 d+8 ; bar 8
    `,
    noise: `
      [${DRIVE_BAR}]7 ${DRIVE_FILL}   ; bars 1-8
    `,
  },

  {
    id: 'mm-station',
    bpm: 156,
    loop: true,
    // D minor, 16 bars: Mega Man's space station. A racing sixteenth-note arpeggio riff up and
    // down each chord (bars 1-4), a soaring melody over a rolling arpeggio underneath (bars 5-12),
    // and the riff again climbing an octave into the turnaround (bars 13-16). Octave-jumping
    // eighth-note bass and a straight rock beat with sixteenth hats drive it all the way.
    pulse1: `
      @1 v11 q7 x0
      o5 d16 a16 o6 d16 o5 a16 f16 a16 o6 d16 f16 e16 d16 o5 a16 f16 d16 f16 a16 o6 d16 ; bar 1  Dm
      o5 d16 f16 b-16 f16 d16 f16 b-16 o6 d16 c16 o5 b-16 f16 d16 o4 b-16 o5 d16 f16 b-16 ; bar 2  Bb
      o5 e16 g16 o6 c16 o5 g16 e16 g16 o6 c16 e16 d16 c16 o5 g16 e16 c16 e16 g16 o6 c16 ; bar 3  C
      o5 c+16 e16 a16 e16 c+16 e16 a16 o6 c+16 e16 c+16 o5 a16 e16 a8 o6 c+8 ; bar 4  A
      @2 v12 q7
      o5 a4 o6 d8 e8 f4 e8 d8         ; bar 5  Dm
      o6 d8 c8 d4 o5 b-4 f4           ; bar 6  Bb
      o5 g8 a8 b-8 o6 c8 d4 e8 c8     ; bar 7  C
      o6 c+4 o5 a4 a8 b8 o6 c+8 e8    ; bar 8  A
      o6 g4. f8 e8 d8 e8 f8           ; bar 9  Gm
      o6 a4 f4 d4 f8 a8               ; bar 10 Dm
      o6 b-4. a16 g16 f8 g8 a8 f8     ; bar 11 Bb
      o6 g8 e8 c8 e8 g4 a4            ; bar 12 C A
      @1 v11 q7
      o5 g16 b-16 o6 d16 g16 d16 o5 b-16 g16 b-16 o6 d16 g16 b-16 g16 d16 o5 b-16 o6 d16 g16 ; bar 13 Gm
      o5 a16 o6 c+16 e16 a16 e16 c+16 o5 a16 o6 c+16 e16 a16 o7 c+16 o6 a16 e16 c+16 e16 a16 ; bar 14 A
      o6 d16 f16 b-16 f16 d16 f16 b-16 f16 e16 g16 o7 c16 o6 g16 e16 g16 o7 c16 o6 g16 ; bar 15 Bb C
      o6 a16 e16 c+16 o5 a16 o6 c+16 e16 a16 o7 c+16 e8 r8 o6 a8 r8 ; bar 16 A
    `,
    pulse2: `
      @2 v7 q7 x0
      o4 f2 a2                        ; bar 1  long chord tones under the riff
      o4 f2 d2                        ; bar 2
      o4 e2 g2                        ; bar 3
      o4 e2 c+2                       ; bar 4
      @0 v6 q5
      [o4 d16 f16 a16 f16]4           ; bar 5  Dm  rolling arpeggio under the melody
      [o3 b-16 o4 d16 f16 d16]4       ; bar 6  Bb
      [o4 c16 e16 g16 e16]4           ; bar 7  C
      [o4 c+16 e16 a16 e16]4          ; bar 8  A
      [o4 d16 g16 b-16 g16]4          ; bar 9  Gm
      [o4 d16 f16 a16 f16]4           ; bar 10 Dm
      [o4 d16 f16 b-16 f16]4          ; bar 11 Bb
      [o4 c16 e16 g16 e16]2 [o4 c+16 e16 a16 e16]2 ; bar 12 C A
      @2 v7 q7
      o4 b-2 o5 d2                    ; bar 13 Gm
      o4 a2 o5 c+2                    ; bar 14 A
      o5 d4 f4 e4 g4                  ; bar 15 Bb C
      o5 c+2 e4 r4                    ; bar 16 A
    `,
    triangle: `
      q6
      [o2 d8 o3 d8]4                  ; bar 1  Dm
      [o1 b-8 o2 b-8]4                ; bar 2  Bb
      [o2 c8 o3 c8]4                  ; bar 3  C
      [o1 a8 o2 a8]4                  ; bar 4  A
      [o2 d8 o3 d8]4                  ; bar 5
      [o1 b-8 o2 b-8]4                ; bar 6
      [o2 c8 o3 c8]4                  ; bar 7
      [o1 a8 o2 a8]4                  ; bar 8
      [o1 g8 o2 g8]4                  ; bar 9  Gm
      [o2 d8 o3 d8]4                  ; bar 10 Dm
      [o1 b-8 o2 b-8]4                ; bar 11 Bb
      [o2 c8 o3 c8]2 [o1 a8 o2 a8]2   ; bar 12 C A
      [o1 g8 o2 g8]4                  ; bar 13 Gm
      [o1 a8 o2 a8]4                  ; bar 14 A
      [o1 b-8 o2 b-8]2 [o2 c8 o3 c8]2 ; bar 15 Bb C
      o1 a8 a8 o2 a8 o1 a8 o2 c+8 e8 g8 a8 ; bar 16 A
    `,
    noise: `
      [${ROBOT_BAR}]7 ${ROBOT_FILL}   ; bars 1-8
      [${ROBOT_BAR}]7 ${ROBOT_FILL}   ; bars 9-16
    `,
  },

  {
    id: 'mm-boss',
    bpm: 176,
    loop: true,
    // C minor, 8 bars: the duel with Dark Mega Man. A stabbing lead that keeps leaning on the
    // half steps around G, a flat-two lurch to D-flat in bar 7, a buzzing sixteenth ostinato and
    // a pounding bass, then a G7 that throws it straight back to the top.
    pulse1: `
      @1 v11 q6 x0
      o5 c8 r16 c16 d+8 c8 g8 f+8 g4  ; bar 1  Cm
      o5 c8 r16 c16 d+8 f8 g8 a-8 g4  ; bar 2  Cm
      o5 a-4 g8 f8 d+4 c8 d8          ; bar 3  Ab
      o5 d4 o4 b4 o5 d4 g4            ; bar 4  G
      o6 c8 r16 c16 o5 b8 o6 c8 d+8 d8 c8 o5 b8 ; bar 5  Cm
      o6 c8 o5 g8 d+8 g8 o6 c4 d+4    ; bar 6  Cm
      o6 d-4 c8 o5 b-8 a-4 f8 a-8     ; bar 7  Db
      o5 g4 b4 o6 d8 f8 d8 o5 b8      ; bar 8  G7
    `,
    pulse2: `
      @0 v6 q5 x0
      [o4 c16 g16 o5 c16 o4 g16]4     ; bar 1  Cm
      [o4 c16 g16 o5 c16 o4 g16]4     ; bar 2  Cm
      [o4 c16 e-16 a-16 e-16]4        ; bar 3  Ab
      [o3 b16 o4 d16 g16 d16]4        ; bar 4  G
      [o4 c16 g16 o5 c16 o4 g16]4     ; bar 5  Cm
      [o4 e-16 g16 o5 c16 o4 g16]4    ; bar 6  Cm
      [o4 d-16 f16 a-16 f16]4         ; bar 7  Db
      [o3 b16 o4 d16 f16 d16]4        ; bar 8  G7
    `,
    triangle: `
      q6
      [o2 c8 c8 o3 c8 o2 c8]2         ; bar 1
      [o2 c8 c8 o3 c8 o2 c8]2         ; bar 2
      [o1 a-8 a-8 o2 a-8 o1 a-8]2     ; bar 3
      [o1 g8 g8 o2 g8 o1 g8]2         ; bar 4
      [o2 c8 c8 o3 c8 o2 c8]2         ; bar 5
      [o2 c8 c8 o3 c8 o2 c8]2         ; bar 6
      [o2 d-8 d-8 o3 d-8 o2 d-8]2     ; bar 7
      o1 g8 g8 o2 g8 o1 g8 b8 o2 d8 f8 g8 ; bar 8
    `,
    noise: `
      [${BOSS_BAR}]7 ${BOSS_FILL}     ; bars 1-8
    `,
  },
  // Larry Koopa's airship, his duel and the bonus spot behind it.
  ...smb3Songs,
];
