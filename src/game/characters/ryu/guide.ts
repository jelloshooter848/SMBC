import type { CharacterGuide } from '../character';

export const RYU_GUIDE: CharacterGuide = {
  tagline: 'Ninja: wall climbing and ninpo',
  controls: [
    { action: 'left/right', does: 'Run fast.' },
    { action: 'jump', does: 'Jump. Let go early to cut it short.' },
    { action: 'attack', touch: 'SLASH', does: 'A quick sword slash.' },
    { action: 'down', does: 'Crouch, and slash low.' },
    { action: 'left/right', does: 'In the air, hold toward a wall to cling. Jump kicks off.' },
    { action: 'select', touch: 'NINPO', does: 'Pick the next ninpo art.' },
    {
      action: 'special',
      touch: 'CAST',
      does: 'Cast the selected art. Costs ninpo (blue bar).',
      touchDoes: 'Shows the selected art. Tap to cast it. Costs ninpo (blue bar).',
    },
  ],
  powerups: [
    { item: 'mushroom', does: 'Classic play: Unlocks the next ninpo art. Full heal.' },
    { item: 'flower', does: 'Classic play: A bigger ninpo meter, refilled.' },
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
  tips: [
    "In the story, power blocks hold Ryu's own items: Medicine (his health bar grows from 10 to 16), Ninpo Scrolls and four ninpo arts. A death loses what he found; replay levels to find it again.",
    'Walls stop you only until you learn to climb them.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch', 'special'],
};
