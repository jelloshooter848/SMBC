import type { CharacterGuide } from '../character';

/** Sophia III's "How to play" pages (SO-56, with Jason's hop-out added). */
export const SOPHIA_GUIDE: CharacterGuide = {
  tagline: 'Tank that climbs walls',
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
      action: 'down+special',
      touch: 'MISSILE',
      does: 'With both missiles: switch between them.',
    },
    {
      action: 'up',
      does: 'With the wall climb, drive into a wall to climb it. On walls the keys follow the wall.',
    },
    {
      action: 'down',
      does: 'Drive over a one-block hole: nose first down it. With the wall climb, drive off a ledge to wrap down its side.',
    },
    { action: 'down+jump', does: 'On a wall or ceiling: let go.' },
    {
      action: 'select',
      touch: 'EXIT',
      does: 'On solid ground: Jason hops out on foot. He jumps three blocks, fits small gaps and climbs ladders, but the screen stays with the tank. Up or EXIT at the tank: back in.',
    },
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
  belt: [
    {
      name: 'Triple missile',
      icon: 'icon-triple',
      sheet: 'sophia',
      cost: '3 ammo',
      does: 'Three missiles that fly through walls and break bricks.',
    },
    {
      name: 'Homing missile',
      icon: 'icon-homing',
      sheet: 'sophia',
      cost: '1 ammo',
      does: 'Seeks the nearest enemy that is not armoured or on fire.',
    },
  ],
  tips: [
    'She cannot stomp. Shoot enemies instead.',
    'Jump into a ceiling to grab it. Hold down to bump blocks instead.',
    'Under water, up and down steer freely. Hold jump to go faster.',
    'Jason is fragile: a fall of more than five blocks hurts him.',
    'No hopping out on a moving lift or an auto-scrolling screen.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack'],
};
