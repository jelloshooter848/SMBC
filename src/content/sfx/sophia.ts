import type { Sfx } from '@engine/audio/mml';

/**
 * Sounds of Sophia, Jason and the Underworld (see sfx.ts for the MML notes). The brief's ids
 * (`sophia-jump`, `sophia-cannon`, `sophia-hover`, `sophia-open`, `jason-shot`, `grenade`,
 * `mutant-die`, `frog`) and the build spec's (SO-54: `sophia-land`, the three cannon levels,
 * `sophia-missile`, `-explode`, `-hit-enemy`, `-kill`, `-hurt`, `-die`, `-select`, `-pickup`).
 */
export const sophiaSfx: Sfx[] = [
  // The squat and the spring up: a low blip, then a rising sweep.
  { id: 'sophia-jump', pulse: '@1 v12 q8 x0 o3 g32 x1 p12 o4 c8' },
  // Wheels back on the ground: a dull thump.
  { id: 'sophia-land', pulse: '@0 v8 q8 x1 p-5 o3 c32', noise: 'v7 x1 l32 n11' },
  // The cannon: a hard high crack falling a fifth (the plain id is the Normal shot).
  { id: 'sophia-cannon', pulse: '@2 v10 q8 x1 p-7 o6 c32', noise: 'v6 x1 l64 n3' },
  { id: 'sophia-shoot-normal', pulse: '@2 v10 q8 x1 p-7 o6 c32', noise: 'v6 x1 l64 n3' },
  // Hyper: lower and longer; Crusher: a heavy boom with grit.
  { id: 'sophia-shoot-hyper', pulse: '@2 v11 q8 x1 p-10 o5 a32.', noise: 'v8 x1 l64 n3 n4' },
  { id: 'sophia-shoot-crusher', pulse: '@1 v12 q8 x1 p-14 o5 f16', noise: 'v10 x1 l32 n5 n8' },
  // A missile volley: a rising whoosh over hiss.
  { id: 'sophia-missile', pulse: '@3 v7 q8 x1 p7 o4 c8', noise: 'v10 x1 l16 n2 n3 n4' },
  // A shot bursting on rock.
  { id: 'sophia-explode', pulse: '@0 v9 q8 x1 p-12 o3 e16', noise: 'v12 x1 l32 n6 n9 l16 n12' },
  // A hit that does not kill: a short tick.
  { id: 'sophia-hit-enemy', pulse: '@0 v10 q8 x1 p-2 o4 c32', noise: 'v8 x1 l64 n4' },
  // A kill: a blast with a falling tone.
  { id: 'sophia-kill', pulse: '@0 v11 q8 x1 p-9 o4 g16', noise: 'v13 x1 l32 n5 n8 l16 n11' },
  // The hover jets: a short rumbling buzz, played again while she hovers.
  { id: 'sophia-hover', pulse: '@3 v7 q8 x0 l64 o3 c c+ c c+', noise: 'v6 x0 l32 n1 n2' },
  // The hatch: a hiss of air, then a clank as the lid stops.
  { id: 'sophia-open', pulse: '@1 v10 q6 x0 l32 r16 o5 c o4 g o5 c16', noise: 'v9 x1 l16 n1 n2' },
  // Hurt: a two-step alarm falling an octave each time.
  { id: 'sophia-hurt', pulse: '@1 v12 q8 x1 p-12 o5 c16 p-12 o4 a16' },
  // Blown up: a falling wail into a long rumbling blast.
  {
    id: 'sophia-die',
    pulse: '@2 v12 q8 x1 l16 o5 e c o4 a f p-24 d4',
    noise: 'v14 x1 l16 n3 n6 l8 n10 l4 n14',
  },
  // Weapon swapped: two quick high notes.
  { id: 'sophia-select', pulse: '@2 v11 q7 x0 l32 o6 c g' },
  // Ammo picked up: a climb to its top note.
  { id: 'sophia-pickup', pulse: '@2 v11 q7 x0 l32 o5 g o6 c e g16' },
  // Jason's blaster: a thin high pip.
  { id: 'jason-shot', pulse: '@3 v8 q8 x1 p-5 o6 e32' },
  // A grenade going off: a thump and a burst.
  { id: 'grenade', pulse: '@0 v9 q8 x1 p-9 o3 c16', noise: 'v12 x1 l32 n8 l16 n12 n14' },
  // A mutant dying: a gurgle down the scale and a wet splat.
  { id: 'mutant-die', pulse: '@3 v11 q8 x1 l32 o4 g e c o3 a p-12 f16', noise: 'v9 x1 l32 n7 n9 n11' },
  // Fred: a two-note croak, twice.
  { id: 'frog', pulse: '@1 v11 q6 x1 l32 o4 b p-5 o5 d o4 b p-5 o5 d16' },
];
