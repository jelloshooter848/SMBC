import type { Song } from '@engine/audio/mml';

/**
 * Kakariko Village (0.4.41): two original pieces composed for this project (nothing transcribed),
 * in the gentle, lilting manner of A Link to the Past's towns: `village`, a 16-bar waltz in F
 * major for the streets, and `village-indoors`, the same tune quieter and slower, without drums,
 * for the rooms inside. Same conventions as songs.ts: pulse1 = melody, pulse2 = harmony,
 * triangle = bass, noise = drums; every channel the same length.
 */

/** Each chord's four tones, low to high, every note with its own octave. */
const CHORDS: Readonly<Record<string, readonly string[]>> = {
  F: ['o4 f', 'o4 a', 'o5 c', 'o5 f'],
  Bb: ['o4 f', 'o4 b-', 'o5 d', 'o5 f'],
  C: ['o4 e', 'o4 g', 'o5 c', 'o5 e'],
  C7: ['o4 e', 'o4 g', 'o4 b-', 'o5 c'],
  Dm: ['o4 d', 'o4 f', 'o4 a', 'o5 d'],
  Am: ['o4 e', 'o4 a', 'o5 c', 'o5 e'],
  Gm: ['o4 d', 'o4 g', 'o4 b-', 'o5 d'],
};
/** The bass root and fifth of each chord. */
const BASS: Readonly<Record<string, readonly [string, string]>> = {
  F: ['o2 f', 'o3 c'],
  Bb: ['o2 b-', 'o3 f'],
  C: ['o3 c', 'o3 g'],
  C7: ['o3 c', 'o3 g'],
  Dm: ['o2 d', 'o2 a'],
  Am: ['o2 a', 'o3 e'],
  Gm: ['o2 g', 'o3 d'],
};

/** The 16 bars' chords. */
const BARS = [
  'F',
  'F',
  'Bb',
  'C',
  'Dm',
  'Bb',
  'C',
  'F',
  'Am',
  'Dm',
  'Gm',
  'C7',
  'F',
  'Bb',
  'C',
  'F',
] as const;

/** The tune, one 3/4 bar a line. */
const MELODY = [
  'o5 c4 f4 a4',
  'o5 g4. f8 e4',
  'o5 f4 d4 o4 b-4',
  'o5 c2.',
  'o5 d4 f4 a4',
  'o5 b-4. a8 g4',
  'o5 a4 g4 e4',
  'o5 f2.',
  'o5 e4 a4 o6 c4',
  'o5 a4. g8 f4',
  'o5 g4 b-4 o6 d4',
  'o6 c2 o5 b-4',
  'o5 a4 o6 c4 f4',
  'o6 d4. c8 o5 b-4',
  'o5 g4 e4 c4',
  'o5 f2.',
];

/** A bar of rippling eighths up and down the chord. */
const ripple = (chord: string): string => {
  const [a, b, c, d] = CHORDS[chord] as [string, string, string, string];
  return `${a}8 ${b}8 ${c}8 ${d}8 ${c}8 ${b}8`;
};

/** A bar of the waltz's oom-pah-pah. */
const oomPah = (chord: string): string => {
  const [root, fifth] = BASS[chord] as [string, string];
  return `${root}4 ${fifth}4 ${fifth}4`;
};

/** A bar of held thirds (the quiet arrangement's harmony). */
const held = (chord: string): string => {
  const [, b] = CHORDS[chord] as [string, string, string, string];
  return `${b}2.`;
};

export const kakarikoSongs: Song[] = [
  {
    id: 'village',
    bpm: 126,
    loop: true,
    pulse1: `@2 v10 q7 x0 ${MELODY.join(' ')}`,
    pulse2: `@1 v5 q5 x0 ${BARS.map(ripple).join(' ')}`,
    triangle: `q6 ${BARS.map(oomPah).join(' ')}`,
    // A soft step on the beat, a whisper on the off-beats.
    noise: `[v7 k8 r8 v4 h8 r8 v4 h8 r8]16`,
  },
  {
    id: 'village-indoors',
    bpm: 104,
    loop: true,
    pulse1: `@1 v8 q8 x0 ${MELODY.join(' ')}`,
    pulse2: `@0 v4 q8 x1 ${BARS.map(held).join(' ')}`,
    triangle: `q5 ${BARS.map(oomPah).join(' ')}`,
  },
];
