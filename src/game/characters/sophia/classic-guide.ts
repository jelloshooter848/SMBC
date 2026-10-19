import type { CharacterGuide } from '../character';

/** Sophia III's Classic SMBC "How to play" page (SO-56, TG-22): no Jason, Select swaps missiles. */
export const SOPHIA_CLASSIC_GUIDE: CharacterGuide = {
  tagline: 'Tank that climbs walls and ceilings',
  controls: [
    { action: 'left/right', does: 'Drive. No run. She keeps her speed in the air.' },
    {
      action: 'jump',
      does: 'A short squat, then a fixed jump. Hold for higher. In the air with the hover: hover.',
    },
    {
      action: 'attack',
      touch: 'SHOOT',
      does: 'Fire the cannon, three shots at a time. Two shots break a brick.',
    },
    { action: 'up+attack', touch: 'SHOOT', does: 'Raise the cannon and fire straight up.' },
    {
      action: 'special',
      touch: 'MISSILE',
      does: 'Fire three missiles. They fly through walls and pierce armour.',
    },
    {
      action: 'up',
      does: 'With the wall climb, drive into a wall to climb it. On walls the keys follow the wall.',
    },
    { action: 'down', does: 'With the wall climb, drive off a ledge to wrap down its side.' },
    { action: 'down+jump', does: 'On a wall or ceiling: let go.' },
    { action: 'select', touch: 'SWAP', does: 'With both missiles: swap between them.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Hyper cannon and the hover. A hit takes everything back.' },
    {
      item: 'flower',
      does: 'Crusher cannon, wall and ceiling climbing, and missiles. Another flower gives more missiles.',
    },
    { item: 'star', does: 'Invincible, free missiles and a full hover bar.' },
    { item: 'drops', does: 'Missile ammo, once you have missiles.' },
  ],
  tips: [
    'She cannot stomp. Shoot enemies instead.',
    'Jump into a ceiling to grab it. Hold down to bump blocks instead.',
    'Under water, up and down steer freely. Hold jump to go faster.',
    'A hit keeps her missiles; losing a life loses them.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack'],
};
