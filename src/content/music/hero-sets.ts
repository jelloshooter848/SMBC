import type { Song } from '@engine/audio/mml';

/**
 * Classic mode's music sets (0.5.0, G-060 to G-065; game/scenes/original-music.ts maps each music
 * type to one of these or to a campaign hero tune): the SMB set's select-screen tune and its
 * transition tune (the x-2 walk-in and the choose jingle), and each hero's own choose, win and
 * death pieces in the mood of the hero's NES game. All composed for this project; nothing is
 * transcribed. Same conventions as songs.ts: pulse1 = melody, pulse2 = harmony, triangle = bass,
 * noise = drums; every channel the same length.
 */

// Eighths pulsing between two chord tones for a bar.
const pulse = (a: string, b: string): string => `[${a}8 ${b}8]4`;
// One bar of eighths bouncing between a root and its octave.
const bounce = (lo: string, hi: string): string => `[${lo}8 ${hi}8]4`;

const STROLL_BAR = 'v8 k8 v4 h8 v7 s8 v4 h8 v8 k8 v4 h8 v7 s8 v4 h8';
const STROLL_FILL = 'v8 k8 v4 h8 v7 s8 v4 h8 v8 k8 v7 s16 s16 v8 s8 v4 h8';

export const heroSetSongs: Song[] = [
  {
    // The SMB set's select screen (G-061): F major, 8 bars. A calm, sing-song stroll that steps
    // round the chord and leans on B-flat, for taking your time over a hero.
    id: 'smb-select',
    bpm: 128,
    loop: true,
    pulse1: `
      @2 v10 q6 x0
      o5 c8 f8 a8 f8 g4 e4                    ; bar 1  F
      o5 f8 e8 d8 c8 d2                       ; bar 2  Bb
      o5 c8 f8 a8 o6 c8 o5 b-4 a4             ; bar 3  F
      o5 g8 a8 g8 f8 e2                       ; bar 4  C
      o5 a8 o6 c8 d8 c8 o5 a4 f4              ; bar 5  F
      o5 b-8 a8 g8 f8 d4 f4                   ; bar 6  Bb
      o5 g8 f8 e8 d8 c4 e4                    ; bar 7  C
      o5 f2 r2                                ; bar 8  F
    `,
    pulse2: `
      @1 v5 q5 x0
      ${pulse('o4 a', 'o5 c')} ${pulse('o4 b-', 'o5 d')} ${pulse('o4 a', 'o5 c')} ${pulse('o4 g', 'b-')}
      ${pulse('o4 a', 'o5 c')} ${pulse('o4 b-', 'o5 d')} ${pulse('o4 g', 'b-')} o4 a4 c4 f2
    `,
    triangle: `
      q6
      ${bounce('o2 f', 'o3 f')} ${bounce('o2 b-', 'o3 b-')} ${bounce('o2 f', 'o3 f')} ${bounce('o2 c', 'o3 c')}
      ${bounce('o2 f', 'o3 f')} ${bounce('o2 b-', 'o3 b-')} ${bounce('o2 c', 'o3 c')} o2 f4 c4 f2
    `,
    noise: `
      [${STROLL_BAR}]3 ${STROLL_FILL} [${STROLL_BAR}]3 v8 k4 r4 r2
    `,
  },
  {
    // The SMB set's transition (G-062, G-063): the x-2 walk-in and the choose jingle. Two bars in
    // C: a quick climb up the chord, a turn, and a landing on a held C (about 1.6 s).
    id: 'smb-transition',
    bpm: 150,
    loop: false,
    pulse1: `
      @2 v11 q7 x0
      o5 c8 e8 g8 o6 c8 o5 b8 g8 a8 b8
      o6 c4 o5 g4 x1 o6 c2
    `,
    pulse2: `
      @1 v7 q7 x0
      o4 g8 o5 c8 e8 g8 g8 e8 f8 g8
      o5 e4 d4 x1 e2
    `,
    triangle: `
      q7 x0
      o2 c4 e4 g4 g4
      o2 c4 g4 x1 o3 c2
    `,
  },

  /* ---------- Link (in the mood of the NES Zelda games) ---------- */
  {
    // Link chosen (G-062): a bright, plucky D major flourish that rings out (about 1.4 s).
    id: 'link-choose',
    bpm: 140,
    loop: false,
    pulse1: `
      @2 v11 q7 x0
      o5 d16 f+16 a16 o6 d16 c+8 o5 a8 x1 o6 d2
    `,
    pulse2: `
      @1 v7 q7 x0
      o4 a16 o5 d16 f+16 a16 a8 e8 x1 f+2
    `,
    triangle: `
      q7 x0
      o2 d4 a4 x1 o3 d2
    `,
  },
  {
    // Link's level clear (G-060 win): a little march up through G to a ringing D (about 2.6 s).
    id: 'link-win',
    bpm: 150,
    loop: false,
    pulse1: `
      @2 v11 q7 x0
      o5 d8. d16 g8 a8 b8 a8 b8 o6 d8
      o6 e4 d4 x1 o6 d2
    `,
    pulse2: `
      @1 v7 q7 x0
      o4 b8. b16 o5 d8 f+8 g8 f+8 g8 b8
      o5 c4 b4 x1 a2
    `,
    triangle: `
      q7 x0
      o2 g4 d4 g4 b4
      o2 c4 g4 x1 o2 d2
    `,
  },

  /* ---------- Mega Man (in the mood of the NES Mega Man games) ---------- */
  {
    // Mega Man chosen (G-062): a snapped rising call over a racing roll that lands on the fifth
    // (about 1.6 s), like a robot master picked.
    id: 'mm-choose',
    bpm: 160,
    loop: false,
    pulse1: `
      @2 v11 q7 x0
      o5 e8 e16 e16 g8 b8 o6 d8 c+8 o5 b8 a8
      o5 b4 f+4 x1 b2
    `,
    pulse2: `
      @0 v6 q5 x0
      [o4 e16 g16 b16 o5 e16]2 [o4 d16 f+16 a16 o5 d16]2
      [o4 d+16 f+16 b16 o5 d+16]2 x1 o4 b2
    `,
    triangle: `
      q6 x0
      o2 e8 e16 e16 o3 e8 o2 e8 d8 d16 d16 o3 d8 o2 d8
      o2 b8 b16 b16 o3 b8 o2 b8 x1 e2
    `,
  },
  {
    // Mega Man's level clear (G-060 win): a bright G major climb and a held chord (about 2.3 s).
    id: 'mm-win',
    bpm: 168,
    loop: false,
    pulse1: `
      @2 v11 q7 x0
      o5 g8 b8 o6 d8 g8 f+8 d8 e8 f+8
      o6 g4 d4 x1 g2
    `,
    pulse2: `
      @0 v6 q6 x0
      o5 d8 g8 b8 o6 d8 c8 o5 a8 b8 o6 c8
      o5 b4 a4 x1 b2
    `,
    triangle: `
      q6 x0
      o2 g8 o3 g8 o2 g8 o3 g8 o2 d8 o3 d8 o2 d8 o3 d8
      o2 g4 d4 x1 o2 g2
    `,
  },

  /* ---------- Samus (in the mood of the NES Metroid) ---------- */
  {
    // Samus's level clear (G-060 win): a cool, wide call that hangs on the ninth (about 2.6 s).
    id: 'samus-win',
    bpm: 132,
    loop: false,
    pulse1: `
      @2 v11 q8 x0
      o4 e8 b8 o5 e8 g8 f+4 e8 b8
      x1 o5 f+2. r4
    `,
    pulse2: `
      @1 v6 q8 x0
      o4 b8 o5 e8 g8 b8 a4 g8 f+8
      x1 o5 d+2. r4
    `,
    triangle: `
      q8 x0
      o2 e2 c4 d4
      x1 o2 b2. r4
    `,
  },

  /* ---------- Simon (in the mood of the NES Castlevania) ---------- */
  {
    // Simon chosen (G-062): a grave D minor call, a run up the scale and a struck low D (1.6 s).
    id: 'cv-choose',
    bpm: 150,
    loop: false,
    pulse1: `
      @2 v11 q7 x0
      o5 d8. a16 f8 d8 c+16 d16 e16 f16 g8 a8
      o5 d4 a4 x1 o6 d2
    `,
    pulse2: `
      @1 v7 q7 x0
      o4 a8. o5 f16 d8 o4 a8 a16 b-16 o5 c+16 d16 e8 f8
      o4 a4 o5 f4 x1 a2
    `,
    triangle: `
      q7 x0
      o2 d4 d4 a4 a4
      o2 d4 a4 x1 o2 d2
    `,
  },
  {
    // Simon's level clear (G-060 win): a proud dotted climb in D minor ending on a major chord.
    id: 'cv-win',
    bpm: 140,
    loop: false,
    pulse1: `
      @2 v11 q7 x0
      o5 d8. f16 a8. o6 d16 c8 o5 b-8 a8 g8
      o5 a4 f+4 x1 a2
    `,
    pulse2: `
      @1 v7 q7 x0
      o4 a8. o5 d16 f8. a16 g8 f8 e8 d8
      o5 c+4 d4 x1 f+2
    `,
    triangle: `
      q7 x0
      o2 d4 f4 g4 a4
      o2 a4 d4 x1 o2 d2
    `,
  },
  {
    // Simon's death music (G-065, Simon.as DIE): a slow, sad fall in D minor onto a long low
    // hum (about 3 s).
    id: 'cv-die',
    bpm: 120,
    loop: false,
    pulse1: `
      @2 v11 q7 x0
      o5 a8 g8 f8 e8 d4 c+4
      x1 o5 d2 r2
    `,
    pulse2: `
      @1 v7 q7 x0
      o5 f8 e8 d8 c8 o4 b-4 a4
      x1 o4 a2 r2
    `,
    triangle: `
      q8 x0
      o2 d4 b-4 g4 a4
      x1 o2 d2 r2
    `,
  },

  /* ---------- Ryu (in the mood of the NES Ninja Gaiden) ---------- */
  {
    // Ryu chosen (G-062): a sharp A minor slash up a fifth and a held, tense high E (1.4 s).
    id: 'ng-choose',
    bpm: 170,
    loop: false,
    pulse1: `
      @2 v11 q7 x0
      o5 a16 a16 e8 a8 o6 c8 o5 b8 a8 e8 g8
      x1 o5 e2 r2
    `,
    pulse2: `
      @1 v7 q6 x0
      o5 e16 e16 c8 e8 a8 g8 e8 c8 d8
      x1 o4 b2 r2
    `,
    triangle: `
      q6 x0
      o2 a8 a8 o3 a8 o2 a8 g8 g8 o3 g8 o2 g8
      x1 o2 e2 r2
    `,
    noise: `
      v10 k8 v6 h8 v9 s8 v6 h8 v10 k8 v9 s16 s16 v10 s8 s8
      v11 s2 r2
    `,
  },
  {
    // Ryu's level clear (G-060 win): a quick run up A minor that resolves to a bright A major.
    id: 'ng-win',
    bpm: 160,
    loop: false,
    pulse1: `
      @2 v11 q7 x0
      o5 a8 b8 o6 c8 d8 e8 d8 c8 o5 b8
      o6 c+4 e4 x1 a2
    `,
    pulse2: `
      @1 v7 q7 x0
      o5 e8 g8 a8 b8 o6 c8 o5 b8 a8 g+8
      o5 a4 o6 c+4 x1 e2
    `,
    triangle: `
      q7 x0
      o2 a4 f4 e4 e4
      o2 a4 e4 x1 o2 a2
    `,
  },
  {
    // Ryu's death music (G-065, Ryu.as DIE): a falling A minor line, a jab and a long low note.
    id: 'ng-die',
    bpm: 132,
    loop: false,
    pulse1: `
      @2 v11 q7 x0
      o6 e8 c8 o5 a8 f8 e8 d+8 e4
      x1 o4 a2 r2
    `,
    pulse2: `
      @1 v7 q7 x0
      o5 c8 o4 a8 f8 d8 c8 b8 b4
      x1 o4 e2 r2
    `,
    triangle: `
      q8 x0
      o2 a4 f4 e4 e4
      x1 o2 a2 r2
    `,
  },

  /* ---------- Bill (in the mood of the NES Contra) ---------- */
  {
    // Bill's level clear (G-060 win): a stabbed, heroic E minor call that ends on the major
    // chord (about 2.3 s).
    id: 'contra-win',
    bpm: 168,
    loop: false,
    pulse1: `
      @2 v11 q6 x0
      o5 e8 e8 r8 e16 f+16 g8 a8 b8 o6 d8
      o6 e4 o5 b4 x1 o6 e2
    `,
    pulse2: `
      @1 v7 q6 x0
      o4 b8 b8 r8 b16 o5 d16 e8 f+8 g8 b8
      o5 b4 g+4 x1 b2
    `,
    triangle: `
      q6 x0
      o2 e8 e8 r8 e8 o3 e8 o2 e8 g8 b8
      o2 e4 b4 x1 o2 e2
    `,
    noise: `
      v11 k8 k8 r8 v10 s16 s16 v11 k8 v10 s8 v11 k8 v10 s8
      v12 s4 s4 r2
    `,
  },

  /* ---------- Sophia (in the mood of the NES Blaster Master) ---------- */
  {
    // Sophia III chosen (G-062): an engine-rev arpeggio climbing A minor into a held high A.
    id: 'bm-choose',
    bpm: 150,
    loop: false,
    pulse1: `
      @1 v11 q7 x0
      o4 a16 o5 c16 e16 a16 o4 b16 o5 d16 g16 b16 o5 c16 e16 a16 o6 c16 d8 e8
      x1 o6 a2 r2
    `,
    pulse2: `
      @2 v6 q6 x0
      o4 e8 a8 g8 b8 a8 o5 c8 b8 o6 c8
      x1 o5 e2 r2
    `,
    triangle: `
      q6 x0
      o2 a4 g4 f4 g4
      x1 o2 a2 r2
    `,
  },
  {
    // Sophia III's level clear (G-060 win): a bright A minor march turning to C major.
    id: 'bm-win',
    bpm: 156,
    loop: false,
    pulse1: `
      @2 v11 q7 x0
      o5 a8 o6 c8 e8 a8 g8 e8 f8 g8
      o6 e4 d4 x1 c2
    `,
    pulse2: `
      @1 v7 q7 x0
      o5 e8 a8 o6 c8 e8 d8 c8 o5 a8 b8
      o5 g4 f4 x1 e2
    `,
    triangle: `
      q7 x0
      o2 a4 a4 f4 g4
      o2 g4 g4 x1 o2 c2
    `,
  },
];
