import type { CharacterGuide } from '../character';

export const RYU_GUIDE: CharacterGuide = {
  tagline: 'Ninja: wall climbing and ninpo',
  controls: [
    { action: 'left/right', does: 'Run fast.' },
    { action: 'jump', does: 'Jump. Let go early to cut it short.' },
    { action: 'attack', does: 'A quick sword slash.' },
    { action: 'down', does: 'Crouch, and slash low.' },
    {
      action: 'left/right',
      does: 'In the air, hold toward a wall to cling to it. Jump to kick off. Repeat to climb.',
    },
    { action: 'select', does: 'Cycle the ninpo arts.' },
    { action: 'special', does: 'Cast the selected art. It costs ninpo from the blue bar.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Unlocks the next ninpo art. Full heal.' },
    { item: 'flower', does: 'A bigger ninpo meter, refilled.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
    { item: 'drops', does: 'Ninpo flames and health.' },
  ],
  belt: [
    { name: 'Throwing star', icon: 'icon-star', cost: '3', does: 'Straight and fast. Two on screen.' },
    {
      name: 'Windmill',
      icon: 'icon-windmill',
      cost: '5',
      does: 'A big blade that cuts through everything and returns.',
    },
    {
      name: 'Fire wheel',
      icon: 'icon-fire-wheel',
      cost: '5',
      does: 'Three flames circle you and block shots.',
    },
    {
      name: 'Jump and slash',
      icon: 'icon-slash',
      cost: '5',
      does: 'A somersault that cuts anything you touch.',
    },
  ],
  tips: ['Walls stop you only until you learn to climb them.'],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch', 'special'],
};
