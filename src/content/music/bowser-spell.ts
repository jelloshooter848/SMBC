import type { Song } from '@engine/audio/mml';

/**
 * Bowser's theme for his spell at the end of 1-0 (story/bowser-spell.ts, 0.4.36, owner note: new,
 * original, foreboding music): a slow loop in C minor, composed for this project in the SMB
 * sound (two pulses, a triangle bass, the noise channel). A low, heavy melody leans on the
 * tritone (F sharp over C) and a dark Neapolitan turn (D flat) before it sinks home; the bass
 * plods in dotted steps and the drum is a slow heartbeat. Same conventions as songs.ts:
 * pulse1 = melody, pulse2 = harmony, triangle = bass, noise = drums; every channel the same
 * length.
 */

/** A bar of the bass: the root, dotted, then three more beats of it. */
const plod = (root: string): string => `${root}4. ${root}8 ${root}4 ${root}4`;
// A slow heartbeat: two soft thumps, then silence.
const HEART = 'v7 k8 v5 k8 r4 r2';

export const bowserSpellSong: Song = {
  id: 'bowser-spell',
  bpm: 66,
  loop: true,
  // C minor, 8 bars: Cm Ab Cm G | Cm Db Fm-G Cm.
  pulse1: `
    @2 v10 q7 x0
    o4 c4. c8 e-4 g4                        ; bar 1  Cm
    o4 a-2 g4 f+4                           ; bar 2  Ab (the tritone)
    o4 g4. f8 e-4 d4                        ; bar 3  Cm
    o4 d2 r4 o3 b4                          ; bar 4  G
    o4 c4. c8 e-4 g4                        ; bar 5  Cm
    o4 a-2 o5 d-4 c4                        ; bar 6  Db
    o4 a-4 f4 g4 o3 b4                      ; bar 7  Fm G
    o4 c1                                   ; bar 8  Cm
  `,
  pulse2: `
    @1 v5 q8 x0
    o3 e-2 g2      o3 e-2 c2      o3 e-2 c2      o3 d2 o2 b2
    o3 e-2 g2      o3 f2 a-2      o3 c2 o2 b2    o3 c1
  `,
  triangle: `
    q6
    ${plod('o2 c')} ${plod('o1 a-')} ${plod('o2 c')} ${plod('o1 g')}
    ${plod('o2 c')} ${plod('o2 d-')} o2 f4 f4 o1 g4 g4 o2 c4. c8 c2
  `,
  noise: `
    [${HEART}]8                             ; bars 1-8
  `,
};
