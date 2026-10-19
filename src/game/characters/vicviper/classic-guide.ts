import type { CharacterGuide } from '../character';

/**
 * Vic Viper's "How to play" page (VV section 12, TG-22), with the approved power-ups (VV-M1..VV-M9).
 * Every row names the ability, never a button letter.
 */
export const VIC_GUIDE: CharacterGuide = {
  tagline: 'A starfighter in a walking world',
  controls: [
    { action: 'left/right', does: 'Fly. The screen scrolls by itself and carries you along.' },
    { action: 'up', does: 'Fly up.' },
    { action: 'down', does: 'Fly down. Over a pipe, go in, even in mid-air.' },
    {
      action: 'attack',
      touch: 'SHOOT',
      does: 'Fire a shot to the right. It flies through walls and breaks bricks.',
    },
    { action: 'jump', touch: 'POWER', does: 'Take the power-up lit on the bar.' },
    { action: 'special', touch: 'POWER', does: 'Also takes the lit power-up.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Survive one extra hit. Your trim turns blue.' },
    { item: 'flower', does: 'A power capsule: lights the next slot on the bar.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
    { item: 'drops', does: 'Defeated enemies sometimes leave a power capsule.' },
  ],
  tips: [
    'Bar: SPEED UP, MISSILE, DOUBLE, LASER, OPTION, then the ? shield.',
    'The missile runs along the floor and breaks armour.',
    'Double and laser replace each other.',
    'You cannot stomp. Shoot or steer clear.',
    'Bumping blocks from below does nothing. Shoot them instead.',
    'The screen keeps scrolling: steer around walls ahead.',
  ],
  demo: ['idle', 'walk', 'attack'],
};
