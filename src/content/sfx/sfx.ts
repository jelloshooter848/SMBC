import type { Sfx } from '@engine/audio/mml';

/**
 * Original sound effects. At the default 150 bpm one tick is ~8.3 ms, so l64 = 25 ms,
 * l32 = 50 ms, l16 = 100 ms. `p<n>` slides the next note by n semitones over its gate and `x1`
 * fades it to silence. Noise periods (n0 = hiss ... n15 = rumble) take the current default
 * length, set with l<n>, because `n<period><length>` would read as one number.
 */
export const sfx: Sfx[] = [
  // Quick rising pulse sweep (about 150 ms).
  { id: 'jump-small', pulse: '@1 v12 q8 x1 p14 o5 c16.' },
  // Lower and longer sweep (200 ms).
  { id: 'jump-big', pulse: '@1 v12 q8 x1 p16 o4 g8' },
  // Two-note high ding: b7 then a long decaying e8.
  { id: 'coin', pulse: '@2 v12 q8 x0 o7 b32 x1 o8 e8' },
  // Short noise burst plus a low pulse thud.
  { id: 'stomp', pulse: '@0 v10 q8 x1 p-7 o3 g32.', noise: 'v11 x1 l32 n9 n6' },
  // Shell kick: two falling clicks.
  { id: 'kick', pulse: '@1 v11 q8 x1 p-5 o4 a32 r64 p-5 o4 e32', noise: 'v8 x1 l32 n5' },
  // Head bump on a block: dull and short.
  { id: 'bump', pulse: '@0 v10 q8 x1 p-3 o3 e16', noise: 'v9 x1 l32 n10' },
  // Brick break: noise burst with a crunch and a low pulse drop.
  { id: 'break', pulse: '@0 v8 q8 x1 p-12 o3 c16', noise: 'v13 x1 l32 n4 n8 n12 l16 n14' },
  // Rising arpeggio (250 ms).
  { id: 'powerup-appear', pulse: '@2 v11 q8 x0 l64 o5 c e g o6 c e g o7 c e g x1 o7 g32' },
  // Longer rising sparkle through three chord positions (about 1.1 s).
  {
    id: 'powerup',
    pulse: '@2 v11 q8 x0 l32 o5 c e g o6 c e g o5 e g b o6 e g b o5 g b o6 d g b o7 d x1 o7 g8',
    pulse2: '@0 v7 q8 x0 l32 r32 o5 c e g o6 c e g o5 e g b o6 e g b o5 g b o6 d g b o7 d x1 o7 e8',
  },
  // Descending pulse in two octave slides; also the shrink sound when hurt.
  { id: 'pipe', pulse: '@1 v11 q8 x1 p-12 o5 e8 p-12 o4 e8' },
  // Five quick happy notes.
  { id: '1up', pulse: '@2 v12 q7 x0 l32 o6 e g o7 c e x1 g16' },
  // Short blip sliding down.
  { id: 'fireball', pulse: '@0 v10 q8 x1 p-9 o5 g32.' },
  // Descending scale run (about 0.9 s).
  { id: 'flagpole', pulse: '@2 v12 q7 x1 l32 o6 c o5 b a g f e d c o4 b a g f e d c o3 b g16' },
  // Big crash and a long low slide into the lava.
  {
    id: 'bowser-fall',
    pulse: '@0 v11 q8 x1 p-24 o3 c4',
    noise: 'v13 x1 l16 n3 n6 l8 n9 l4 n13',
    triangle: 'q8 x0 p-24 o2 g4',
  },
  // Noise whoosh.
  { id: 'bowser-flame', noise: 'v11 x1 l16 n1 n2 n3 l8 n5' },
  // Firework pop.
  { id: 'firework', pulse: '@0 v8 q8 x1 p-5 o5 c32', noise: 'v12 x1 l16 n6 l8 n10' },
  // Two-note ping.
  { id: 'pause', pulse: '@2 v11 q8 x1 o6 e32 r32 o7 e16' },
  // Metallic swish: hiss plus a quick up-down pulse slide.
  { id: 'sword', pulse: '@1 v9 q8 x1 p12 o5 c32 p-12 o6 c32', noise: 'v10 x1 l32 n1 n2 n4' },
  // Short pew.
  { id: 'buster', pulse: '@0 v10 q8 x1 p-12 o6 c32.' },
  // Player hurt: harsh low buzz on the narrowest duty plus grit.
  { id: 'hit', pulse: '@3 v12 q8 x1 p-6 o2 e16 p-6 o2 c16', noise: 'v9 x1 l16 n12 n13' },
  // Small thud.
  { id: 'hurt-enemy', pulse: '@0 v9 q8 x1 p-7 o3 c32', noise: 'v9 x1 l32 n8' },
  // Chromatic climb that feels like it keeps rising (0.5 s).
  { id: 'charge', pulse: '@1 v9 q8 x0 l64 o4 c c+ d d+ e f f+ g g+ a a+ b o5 c c+ d d+ e f f+ g' },
  // Menu blip.
  { id: 'select', pulse: '@2 v10 q8 x1 o6 c32 g32' },
  // Tiny tick.
  { id: 'timer-tick', pulse: '@2 v8 q8 x1 o7 c64' },
  // Short stepped rising sweep.
  { id: 'vine', pulse: '@1 v10 q8 x1 l64 o4 g a b o5 c d e f+ g' },
];
