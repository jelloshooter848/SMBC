import type { CharacterGuide } from '../character';

/** Classic SMBC Simon's "How to play" page (TG-22, SI-C1). Abilities by name, never button letters. */
export const SIMON_CLASSIC_GUIDE: CharacterGuide = {
  tagline: 'Simon: whip, axe, double jump',
  controls: [
    { action: 'left/right', does: 'Walk. Starts and stops at once, and steers in mid-air too.' },
    { action: 'jump', does: 'A fixed jump. Jump again in mid-air for one more, once until you land.' },
    { action: 'down', does: 'Crouch, then whip or throw low.' },
    {
      action: 'attack',
      touch: 'WHIP',
      does: 'Crack the whip. It hits late, roots you on the ground, breaks bricks and freezes what it hits.',
    },
    { action: 'special', touch: 'AXE', does: 'Throw an axe in a high arc through walls. Costs 1 heart.' },
    {
      action: 'select',
      touch: 'CROSS',
      does: 'With fire power: throw a cross that flies out and comes back. Catch it. Costs 2 hearts.',
    },
  ],
  powerups: [
    { item: 'mushroom', does: 'The morning star whip, and two throws at a time. Already up: fire power.' },
    {
      item: 'flower',
      does: 'One step up. Fire power: the long flame whip, three throws and the cross. Again: 5 hearts.',
    },
    { item: 'star', does: 'Invincible for twelve seconds. Throws cost no hearts.' },
    { item: 'drops', does: 'Hearts, small and large: your throwing ammo. Any hit makes you small again.' },
  ],
  tips: [
    'The whip lashes at chest height: crouch to whip short enemies such as Goombas.',
    'Your head only bumps bricks. Whip them, or throw an axe through them.',
    'A hit knocks you into a hop. Mind the pits.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch', 'special'],
};
