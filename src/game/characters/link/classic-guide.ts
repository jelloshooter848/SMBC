import type { CharacterGuide } from '../character';

/** Classic SMBC Link's "How to play" page (TG-22, LK-C3). */
export const LINK_CLASSIC_GUIDE: CharacterGuide = {
  tagline: 'Link: stab, thrust, boomerang',
  controls: [
    {
      action: 'left/right',
      does: 'Walk. Starts and stops at once, in the air too. A stab on the ground roots you.',
    },
    { action: 'jump', does: 'Jump from the ground. Let go early for a short hop.' },
    { action: 'attack', touch: 'SWORD', does: 'Stab. Breaks bricks and opens blocks from any side.' },
    { action: 'up+attack', does: 'On the ground: stab upward.' },
    { action: 'down+attack', does: 'On the ground: stab downward, into the block under you.' },
    { action: 'down', does: 'In the air: down-thrust. Bounces off enemies and blocks it hits.' },
    { action: 'up', does: 'In the air: up-thrust. Hits what is above you.' },
    {
      action: 'special',
      touch: 'BOOMERANG',
      does: 'Boomerang. Aim it with the directions: eight ways. It stops enemies and fetches items.',
    },
    { action: 'select', touch: 'BOMB', does: 'Bomb. It never hurts you. Three at a time.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Blue Ring: a stronger sword, and three bombs the first time.' },
    {
      item: 'flower',
      does: 'Red Ring sword beam, Magic Boomerang, Magic Sword, Bomb Bag and Quiver. Any hit takes the rings and swords.',
    },
    { item: 'star', does: 'Invincible for twelve seconds. Bombs cost nothing.' },
    { item: 'drops', does: 'Bombs, once you own them. Broken bricks drop them too.' },
  ],
  tips: [
    'No stomping: land on enemies with the down-thrust.',
    'In the air with up or down held, the Red Ring fires its beam up or down.',
    'Under water you jump only from the floor.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack', 'special'],
};
