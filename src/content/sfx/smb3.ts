import type { Sfx } from '@engine/audio/mml';

/**
 * Sounds of Larry's airship, the bonus spot behind it and the item inventory (see sfx.ts for the MML
 * notes).
 */
export const smb3Sfx: Sfx[] = [
  // A card turned over: a papery flick and a short upward chirp (about 100 ms).
  { id: 'card-flip', pulse: '@1 v9 q8 x1 p7 o5 e32', noise: 'v7 x1 l64 n1 n3 n2' },
  // A slot reel locking in place: a dull clunk with a click on top.
  { id: 'slot-stop', pulse: '@0 v11 q8 x1 p-5 o3 a16', noise: 'v12 x1 l32 n6 n11' },
  // A matched pair or a lined-up picture: three climbing chord bursts ringing out on the top note.
  {
    id: 'bonus-win',
    pulse: '@2 v11 q7 x0 l32 o5 c e g o6 c r32 o5 e g o6 c e r32 o5 g o6 c e x1 g4',
    pulse2: '@1 v6 q7 x0 l32 r32 o4 g o5 c e r32 o5 c e g r32 o5 e g x1 o6 c4',
  },
  // An inventory item used on the map: a quick sparkling climb that fizzes out.
  {
    id: 'item-use',
    pulse: '@1 v10 q8 x0 l64 o5 g o6 c d g o7 c d x1 g16',
    pulse2: '@3 v5 q8 x1 l64 r32 o6 g o7 c d g',
  },
  // An airship cannon firing: a deep falling thump and a short roar of noise (0.4 s), so a row of
  // cannons can keep booming.
  {
    id: 'cannon',
    pulse: '@0 v13 q8 x1 p-12 o3 c8',
    triangle: 'q8 x1 p-12 o2 g8',
    noise: 'v14 x1 l32 n2 n5 l16 n9 n12 n14',
  },
];
