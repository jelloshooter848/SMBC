import type { CharacterGuide } from '../character';

export const MEGAMAN_GUIDE: CharacterGuide = {
  tagline: 'Arm cannon and a full arsenal',
  controls: [
    { action: 'left/right', does: 'Run. Starts and stops at once.' },
    { action: 'jump', does: 'A tall jump. Let go early to cut it short.' },
    { action: 'down+jump', does: 'Slide: low and fast, under one-tile gaps.' },
    { action: 'attack', touch: 'SHOOT', does: 'Fire the buster, three shots at a time.' },
    { action: 'attack (hold)', touch: 'SHOOT', does: 'With the helmet: charge, let go for a piercing shot.' },
    { action: 'select', touch: 'WEAPON', does: 'Pick the next weapon.' },
    {
      action: 'special',
      touch: 'USE WEAPON',
      does: 'Fire the selected weapon.',
      touchDoes: 'Shows the selected weapon. Tap to fire it.',
    },
  ],
  powerups: [
    {
      item: 'mushroom',
      does: 'Classic play: The helmet: charge shot, brick breaking and the Rush Coil. Full heal.',
    },
    {
      item: 'flower',
      does: 'Classic play: Unlocks the next special weapon. With all five, refills them.',
    },
    { item: 'star', does: 'Invincible for a few seconds.' },
    {
      item: 'drops',
      does: 'Health and weapon pellets, and the rare E-tank: use it from the pause menu for a full heal.',
    },
  ],
  belt: [
    {
      name: 'Saw Disc',
      icon: 'icon-saw',
      cost: '2',
      does: 'Aim with the d-pad in eight directions. Cuts through bricks.',
    },
    {
      name: 'Leaf Guard',
      icon: 'icon-leaf',
      cost: '4',
      does: 'Circles you and swats enemy shots. Press again to throw it.',
    },
    { name: 'Flame Wave', icon: 'icon-flame', cost: '3', does: 'Runs along the floor. Burns shells.' },
    {
      name: 'Homing Knuckle',
      icon: 'icon-knuckle',
      cost: '4',
      does: 'Slow fist that turns toward the nearest enemy. Three damage.',
    },
    { name: 'Bolt', icon: 'icon-bolt', cost: '5', does: 'A beam across the whole screen.' },
    {
      name: 'Rush Coil',
      icon: 'icon-rush',
      cost: '3',
      does: 'Drops a spring ahead of you. Land on it for a huge jump.',
    },
  ],
  tips: [
    "In the story, power blocks hold Mega Man's own items: the Helmet, Rush Coil and five weapons. A death loses what he found; replay levels to find it again.",
    'The second bar beside your health is the selected weapon’s energy.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack'],
};
