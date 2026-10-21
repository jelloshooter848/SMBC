import type { Sfx } from '@engine/audio/mml';

/**
 * Classic mode's heroes' own sounds (0.5.0, GAP_LIST_0.5.0 G-065, G-070 to G-074): each hero's
 * landing, hurt, hit, kill, pickup and weapon sounds in the mood of the hero's NES game, where the
 * original has one of its own (data/SoundNames.as). Our own; see sfx.ts for the MML notes (l64 is
 * 25 ms at the default 150 bpm; `p<n>` slides the next note; `x1` fades it out).
 */
export const heroSfx: Sfx[] = [
  /* ---------- Link ---------- */
  // His death (G-065): a sad three-note fall that rings out, over a soft low hum (about 1.2 s).
  {
    id: 'link-death',
    pulse: '@2 v11 q8 x0 l16 o5 a e c o4 a x1 o4 e4',
    triangle: 'q8 x1 o2 a2',
  },
  // Taking a hit (G-071): a harsh, quick falling buzz.
  { id: 'link-hurt', pulse: '@3 v12 q8 x1 p-12 o5 c16', noise: 'v8 x1 l64 n3 n6' },
  // The sword striking (G-072): a short, hard tick and a thud.
  { id: 'link-hit', pulse: '@0 v11 q8 x1 p-7 o5 e32', noise: 'v10 x1 l64 n2 n9' },
  // A foe defeated (G-072): a fizzing pop that drops away.
  { id: 'link-kill', pulse: '@1 v10 q8 x1 p-24 o6 c16', noise: 'v11 x1 l64 n4 n7 n10 n13' },
  // A heart (G-073): two quick bright pings.
  { id: 'link-heart', pulse: '@2 v11 q8 x0 l64 o6 e r64 x1 o6 e32' },
  // An item (G-073): a quick climbing flourish.
  { id: 'link-item', pulse: '@2 v11 q8 x0 l64 o5 a o6 c+ e a x1 o7 c+16' },
  // An arrow loosed (G-074): an airy hiss with a twang.
  { id: 'link-arrow', pulse: '@1 v9 q8 x1 p7 o5 g32', noise: 'v8 x1 l32 n1 n0' },
  // A bomb set down (G-074): a low wooden knock.
  { id: 'link-bomb-set', pulse: '@0 v11 q8 x1 p-5 o3 g32 r64 o3 d32', noise: 'v7 x1 l64 n11' },

  /* ---------- Mega Man (and Bass and Proto Man) ---------- */
  // Landing (G-070): a tiny low click.
  { id: 'mm-land', pulse: '@1 v8 q8 x1 p-5 o3 g64', noise: 'v6 x1 l64 n12' },
  // Teleporting in (G-070): a bright upward warble that ends in a ping.
  { id: 'mm-teleport', pulse: '@2 v11 q8 x0 l64 [o5 c g o6 c g]2 x1 o7 c16' },
  // Taking a hit (G-071): a sharp, shrill shriek that sinks.
  { id: 'mm-hurt', pulse: '@0 v12 q8 x0 l64 o6 g d g d x1 p-12 o6 c16' },
  // A shot landing (G-072): a short buzzy tock.
  { id: 'mm-hit', pulse: '@0 v11 q8 x1 p-5 o4 c32', noise: 'v8 x1 l64 n6' },
  // A foe defeated (G-072): a quick double pop.
  { id: 'mm-kill', noise: 'v12 x1 l64 n6 n9 r64 n7 n11 n14' },
  // Weapon energy (G-073): a rising chirp.
  { id: 'mm-energy', pulse: '@1 v10 q8 x0 l64 o5 c g o6 c x1 o6 g32' },
  // An extra life (G-073; SFX_MEGA_MAN_GET_NEW_LIFE, his default pickup sound): a bright
  // stepping chime, up and up again.
  { id: 'mm-1up', pulse: '@2 v11 q8 x0 l32 o6 c e g o7 c x1 o6 g16 o7 c8' },
  // A Metal Blade (G-074): a spinning whine.
  { id: 'mm-blade', pulse: '@2 v9 q8 x0 l64 [o6 e c]2 x1 o6 e32' },

  /* ---------- Samus ---------- */
  // Landing (G-070): a soft metallic thump.
  { id: 'samus-land', pulse: '@1 v8 q8 x1 p-3 o3 c64', noise: 'v7 x1 l64 n10' },
  // A footstep (G-070; Samus.as 1090, every 150 ms while she walks): a very short low tap.
  { id: 'samus-step', noise: 'v6 x1 l64 n11' },
  // Energy (G-073; SFX_SAMUS_GET_ENERGY, her default pickup sound): a quick rising sparkle.
  { id: 'samus-energy', pulse: '@1 v10 q8 x0 l64 o5 b o6 e g+ x1 o6 b32' },
  // Curling into the Morph Ball (G-070): a quick descending whirr.
  { id: 'morph-ball', pulse: '@2 v10 q8 x0 l64 o6 c o5 g e c x1 o4 g32' },
  // The Screw Attack (G-070): a crackling spin that rises (one turn).
  {
    id: 'screw-attack',
    pulse: '@3 v9 q8 x0 l64 o4 c g o5 c g o6 c x1 o6 g32',
    noise: 'v7 x0 l64 n2 n1 n2 n1 n2 x1 n0',
  },
  // Taking a hit (G-071): a stuttering electric zap.
  { id: 'samus-hurt', pulse: '@3 v12 q8 x0 l64 o4 g o5 g o4 g o5 g x1 o4 c32' },
  // A beam landing (G-072): a dull buzz.
  { id: 'samus-hit', pulse: '@0 v10 q8 x1 p-3 o3 a32', noise: 'v7 x1 l64 n5' },
  // Missiles (G-073): a firm two-tone blip.
  { id: 'samus-missile-get', pulse: '@1 v11 q8 x0 l64 o5 e o6 e x1 o6 b32' },
  // The beams (G-074): short, long, Ice and Wave.
  { id: 'samus-beam', pulse: '@2 v9 q8 x1 p-12 o6 c32' },
  { id: 'samus-long-beam', pulse: '@2 v9 q8 x1 p-12 o6 g16' },
  { id: 'samus-ice-beam', pulse: '@2 v9 q8 x0 l64 o7 c o6 g x1 p-7 o7 e32' },
  { id: 'samus-wave-beam', pulse: '@1 v9 q8 x0 l64 o6 c e c e x1 p-12 o6 c32' },
  // A bomb set (G-074): a quick ticking blip.
  { id: 'samus-bomb-set', pulse: '@1 v9 q8 x1 l64 o6 c r64 o6 c' },

  /* ---------- Simon ---------- */
  // Taking a hit (G-071): a low grunt.
  { id: 'cv-hurt', pulse: '@1 v12 q8 x1 p-7 o4 d16', noise: 'v9 x1 l64 n8 n12' },
  // The whip striking (G-072): a crisp crack.
  { id: 'cv-hit', noise: 'v13 x1 l64 n1 n4 n8' },
  // A foe burning away (G-072): a hiss that falls.
  { id: 'cv-kill', pulse: '@0 v9 q8 x1 p-12 o4 e16', noise: 'v10 x1 l64 n3 n5 n7 n9 n11' },
  // A heart (G-073): a light double tick.
  { id: 'cv-heart', pulse: '@2 v10 q8 x1 l64 o6 a r64 o7 c+' },
  // A sub-weapon (G-073): a rising three-note ring.
  { id: 'cv-weapon', pulse: '@2 v11 q8 x0 l64 o5 d a o6 d x1 o6 a32' },
  // The sub-weapons (G-074): the dagger's swish, the axe's and the cross's whirl, the holy
  // water's flask breaking into flame.
  { id: 'cv-dagger', pulse: '@1 v9 q8 x1 p-12 o6 e32', noise: 'v6 x1 l64 n0' },
  { id: 'cv-axe', pulse: '@0 v10 q8 x0 l64 o4 a e a e x1 o4 a32' },
  { id: 'cv-cross', pulse: '@2 v9 q8 x0 l64 o5 e a e a x1 o5 e32' },
  { id: 'cv-holy-water', pulse: '@1 v9 q8 x1 p-5 o5 c32', noise: 'v12 x1 l64 n2 n4 n6 n8 n10' },

  /* ---------- Ryu ---------- */
  // Taking a hit (G-071): a short rasp.
  { id: 'ng-hurt', pulse: '@3 v11 q8 x1 p-5 o4 g32', noise: 'v10 x1 l64 n6 n10' },
  // The sword landing (G-072): a bright slice.
  { id: 'ng-hit', pulse: '@2 v10 q8 x1 p5 o6 c64', noise: 'v11 x1 l64 n1 n5' },
  // A foe cut down (G-072): a burst that drops.
  { id: 'ng-kill', pulse: '@0 v9 q8 x1 p-12 o4 a16', noise: 'v12 x1 l64 n5 n8 n11 n14' },
  // A pickup (G-073): a quick high pair.
  { id: 'ng-pickup', pulse: '@2 v11 q8 x0 l64 o6 e a x1 o7 e32' },
  // The arts (G-074): a throwing star, the Windmill star, the Fire Wheel and the Dragon Ball.
  { id: 'ng-star', pulse: '@2 v9 q8 x1 p12 o6 c64', noise: 'v6 x1 l64 n0' },
  { id: 'ng-windmill', pulse: '@1 v9 q8 x0 l64 [o6 c o5 g]2 x1 o6 c32' },
  { id: 'ng-fire', pulse: '@0 v10 q8 x1 p-7 o4 c16', noise: 'v11 x1 l64 n4 n6 n8' },

  /* ---------- Bill ---------- */
  // Landing (G-070): a heavy boot thud.
  { id: 'bill-land', pulse: '@0 v8 q8 x1 p-5 o3 c64', noise: 'v8 x1 l64 n13' },
  // His rifle and machine gun (G-074): a hard little pop.
  { id: 'bill-shot', pulse: '@0 v9 q8 x1 p-12 o5 c64', noise: 'v9 x1 l64 n3' },
  // The flame gun (G-074): a whooshing roar.
  { id: 'bill-flame', pulse: '@0 v8 q8 x1 p-5 o4 e32', noise: 'v10 x1 l64 n4 n6 n8' },
  // An item (G-073; SFX_BILL_GET_ITEM, his default pickup sound): a rising fanfare blip.
  { id: 'bill-item', pulse: '@2 v11 q8 x0 l64 o5 e b o6 e x1 o6 b32' },
  // Taking a hit (G-070, G-071; Bill.as 899): an electric shock, a buzzing crackle.
  {
    id: 'bill-shock',
    pulse: '@3 v11 q8 x0 l64 [o5 c o4 g]3 x1 o4 c32',
    noise: 'v9 x0 l64 n1 n3 n1 n3 n1 x1 n3',
  },
];
