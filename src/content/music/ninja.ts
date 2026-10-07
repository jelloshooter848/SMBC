import type { Song } from '@engine/audio/mml';

/**
 * Ryu's hideout under 6-2 and his mini game: four original loops in the mood of an NES ninja
 * action game (composed for this project, nothing transcribed). Same conventions as songs.ts:
 * pulse1 = melody, pulse2 = harmony, triangle = bass, noise = drums; every channel the same length.
 */

// The stage: kick, snare and running hats with a doubled kick before the second snare.
const STAGE_BAR = 'v11 k8 v6 h16 h16 v10 s8 v6 h16 h16 v11 k8 k16 k16 v10 s8 v6 h16 h16';
const STAGE_FILL = 'v11 k8 v6 h16 h16 v10 s8 v6 h16 h16 v10 s16 s16 s16 s16 v12 s16 s16 s16 s16';
// The Masked Ninja: double kicks on every beat pair.
const BOSS_BAR = '[v12 k16 k16 v7 h16 h16 v11 s8 v7 h16 h16]2';
const BOSS_FILL = 'v12 k16 k16 v7 h16 h16 v11 s8 v7 h16 h16 v11 s16 s16 s16 s16 v13 s16 s16 s16 s16';

// Koto-like plucked arpeggios for the dojo, one chord a bar.
const KOTO_E = '[o3 e8 b8 o4 e8 f8]2';
const KOTO_A = '[o3 a8 o4 e8 a8 b8]2';
const KOTO_F = '[o3 f8 o4 c8 f8 a8]2';

// Sixteenth-note chord arpeggios.
const arp = (root: string, third: string, fifth: string): string =>
  `[${root}16 ${third}16 ${fifth}16 ${third}16]4`;
const AM = arp('o3 a', 'o4 c', 'e');
const EM = arp('o3 e', 'g', 'b');
const EMAJ = arp('o3 e', 'g+', 'b');
const FMAJ = arp('o3 f', 'a', 'o4 c');
const GMAJ = arp('o3 g', 'b', 'o4 d');
const CM = arp('o3 c', 'e-', 'g');
const FM = arp('o3 f', 'a-', 'o4 c');
const AB = arp('o3 a-', 'o4 c', 'e-');
const octaves = (note: string): string => `[o2 ${note}8 o3 ${note}8]4`;

export const ninjaSongs: Song[] = [
  {
    id: 'dojo',
    bpm: 72,
    loop: true,
    // E in-scale (E F A B C), 8 bars: Ryu's hideout at night. A sparse koto-like tune, plucked
    // and fading, that waits a bar over the arpeggio; a pedal bass; only a wooden tick for a beat.
    pulse1: `
      @1 v9 q5 x1
      r1                              ; bar 1  (the arpeggio alone)
      o4 e4 f8 a8 b4. a8              ; bar 2  E
      o5 c4 o4 b8 a8 f2               ; bar 3  A
      o4 e2. r4                       ; bar 4  E
      o4 a4 b8 o5 c8 e4. c8           ; bar 5  A
      o4 b4 a8 f8 e4 f4               ; bar 6  F
      o4 a4. b8 a8 f8 e4              ; bar 7  E
      o4 e1                           ; bar 8  E
    `,
    pulse2: `
      @2 v5 q3 x1
      ${KOTO_E} ${KOTO_E} ${KOTO_A} ${KOTO_E} ; bars 1-4
      ${KOTO_A} ${KOTO_F} ${KOTO_E} ${KOTO_E} ; bars 5-8
    `,
    triangle: `
      q8
      o2 e1 e1 a1 e1 a1 f1 e1 e1      ; bars 1-8: one held root a bar
    `,
    noise: `
      [v3 x1 h8 r8 r4 r2]8            ; bars 1-8: a wooden tick on the bar
    `,
  },
  {
    id: 'ng-stage',
    bpm: 150,
    loop: true,
    // A minor, 8 bars: Ryu's stage. A restless eighth-note tune that keeps leaping up a fifth,
    // over sixteenth-note arpeggios and an octave-bouncing bass; it turns on E major.
    pulse1: `
      @2 v11 q7 x0
      o4 a8 a8 o5 c8 o4 a8 o5 e8 d8 c8 o4 b8 ; bar 1  Am
      o5 c8 o4 b8 a8 g8 a4 e4               ; bar 2  Em
      o4 a8 a8 o5 c8 o4 a8 o5 g8 f8 e8 d8   ; bar 3  Am
      o5 e4. d8 c4 o4 b4                    ; bar 4  E
      o4 f8 f8 a8 f8 o5 c8 o4 b8 a8 f8      ; bar 5  F
      o4 g8 g8 b8 g8 o5 d8 c8 o4 b8 g8      ; bar 6  G
      o4 a8 o5 c8 e8 a8 g8 e8 c8 e8         ; bar 7  Am
      o5 e8 d8 c8 o4 b8 g+4 e4              ; bar 8  E
    `,
    pulse2: `
      @1 v6 q6 x0
      ${AM} ${EM} ${AM} ${EMAJ}       ; bars 1-4
      ${FMAJ} ${GMAJ} ${AM} ${EMAJ}   ; bars 5-8
    `,
    triangle: `
      q6
      ${octaves('a')} ${octaves('e')} ${octaves('a')} ${octaves('e')}
      ${octaves('f')} ${octaves('g')} ${octaves('a')} ${octaves('e')}
    `,
    noise: `
      [${STAGE_BAR}]7 ${STAGE_FILL}   ; bars 1-8
    `,
  },
  {
    id: 'ng-boss',
    bpm: 172,
    loop: true,
    // C minor, 8 bars: the Masked Ninja. Faster than the stage, a hook that jabs at the tritone
    // (F-sharp against C) over churning arpeggios and stamping double kicks.
    pulse1: `
      @1 v12 q7 x0
      o4 c8 c8 e-8 c8 f+8 g8 e-8 c8         ; bar 1  Cm
      o4 b-8 a-8 g8 f8 g4 o3 b4             ; bar 2  Fm
      o4 c8 c8 e-8 c8 f+8 g8 b-8 a-8        ; bar 3  Cm
      o4 g2 f+4 g4                          ; bar 4  G
      o5 c8 o4 b-8 a-8 g8 a-8 g8 f8 e-8     ; bar 5  Ab
      o4 f8 e-8 d8 c8 d4 o3 b4              ; bar 6  G
      o4 c8 e-8 g8 o5 c8 o4 b8 g8 f+8 d8    ; bar 7  Cm
      o4 c4 o3 g4 o4 c4 r4                  ; bar 8  Cm
    `,
    pulse2: `
      @2 v6 q6 x0
      ${CM} ${FM} ${CM} ${GMAJ}       ; bars 1-4
      ${AB} ${GMAJ} ${CM} ${CM}       ; bars 5-8
    `,
    triangle: `
      q6
      ${octaves('c')} ${octaves('f')} ${octaves('c')} ${octaves('g')}
      ${octaves('a-')} ${octaves('g')} ${octaves('c')} ${octaves('c')}
    `,
    noise: `
      [${BOSS_BAR}]7 ${BOSS_FILL}     ; bars 1-8
    `,
  },
  {
    id: 'ng-cutscene',
    bpm: 88,
    loop: true,
    // D minor, 4 bars: the moonlit duel's cutscene. A slow, rising lead over a trembling
    // harmony and a timpani roll that swells into the loop.
    pulse1: `
      @2 v10 q8 x0
      o4 d2. e8 f8                    ; bar 1  Dm
      o4 g2 f4 e4                     ; bar 2  Bb
      o4 a2. b-4                      ; bar 3  F
      o4 a1                           ; bar 4  A
    `,
    pulse2: `
      @1 v6 q6 x0
      [o3 a32 o4 d32]16               ; bar 1
      [o3 b-32 o4 d32]16              ; bar 2
      [o3 a32 o4 c32]16               ; bar 3
      [o3 a32 o4 c+32]16              ; bar 4
    `,
    triangle: `
      q8
      o2 d1 o1 b-1 o2 f1 a1           ; bars 1-4
    `,
    noise: `
      [v3 x1 l16 n13 n13 n13 n13]12   ; bars 1-3: a low roll
      v5 n13 n13 n13 n13 v7 n13 n13 n13 n13 v9 n13 n13 n13 n13 v12 n13 n13 n13 n13 ; bar 4: swelling
    `,
  },
];
