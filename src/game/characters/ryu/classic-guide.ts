import type { CharacterGuide } from '../character';

/** Classic SMBC's "How to play" page for Ryu (RY-C3, TG-22). */
export const RYU_CLASSIC_GUIDE: CharacterGuide = {
  tagline: 'Ryu: climbs walls, ninpo arts',
  controls: [
    { action: 'left/right', does: 'Walk at one steady speed, on the ground and in the air.' },
    { action: 'jump', does: 'Jump, always the same height.' },
    {
      action: 'attack',
      touch: 'SLASH',
      does: 'Sword slash. You stop to slash on the ground. Breaks bricks.',
    },
    { action: 'down', does: 'Crouch, and slash or throw low.' },
    {
      action: 'special',
      touch: 'SHURIKEN',
      does: 'Throw your ninpo art: a shuriken for 3 ninpo. One on screen at a time.',
    },
    {
      action: 'select',
      touch: 'WINDMILL',
      does: 'With the flower: throw a windmill shuriken for 5 ninpo. It swings back to you.',
    },
    {
      action: 'left/right',
      does: 'In the air, push into a wall to grab it. You stay on without holding.',
    },
    { action: 'up', does: 'On a wall: climb up. Down climbs down.' },
    {
      action: 'jump',
      does: 'On a wall: jump away while pushing away, or hop up at the top. Down and jump let go.',
    },
  ],
  powerups: [
    { item: 'mushroom', does: 'A longer sword. Ryu does not grow.' },
    {
      item: 'flower',
      does: 'The scroll: up to 200 ninpo, and the windmill shuriken. Again: 15 ninpo.',
    },
    { item: 'star', does: 'Invincible for twelve seconds. Ninpo costs nothing.' },
    { item: 'drops', does: 'Ninpo flames, taken even when the meter is full.' },
  ],
  tips: [
    'Thrown arts fly through walls and floors, and break the bricks they hit.',
    'Your head only bumps bricks. Slash them to break them.',
    'A hit takes the sword and the flower, but you keep the scroll and your ninpo.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch', 'special'],
};
