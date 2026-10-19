import type { CharacterGuide } from '../character';

/**
 * The Warriors of Light's "How to play" page (WL guide section 12, TG-22), with the owner's
 * answers to WL-M1 (the White Mage's staff and Cure), WL-M2 (one Cure a level, no MP) and WL-M3
 * (the class switch). Abilities are named, never button letters (TG-40).
 */
export const WARRIORS_GUIDE: CharacterGuide = {
  tagline: 'Four heroes, one party',
  controls: [
    { action: 'left/right', does: 'Walk. Starts and stops at once. You stand still while you attack.' },
    { action: 'jump', does: 'A fixed jump. On the ground it also cancels a swing or a spell.' },
    {
      action: 'attack',
      does: 'Fighter and Thief swing a blade. Black Mage casts Fire. White Mage swings a staff.',
    },
    { action: 'up+attack', does: 'Black Mage: Bolt strikes the whole screen height ahead.' },
    {
      action: 'down+attack',
      does: 'Black Mage: Ice bursts ahead. White Mage, when small: Cure brings back the mushroom, once a level.',
    },
    {
      action: 'special',
      touch: 'CLASS',
      does: 'Change class: use it while holding one direction. Up Fighter, right Black Mage, down Thief, left White Mage.',
    },
    { action: 'down', does: 'Crouch.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Survive one extra hit. Your class stays the same.' },
    { item: 'flower', does: 'A new outfit for every class.' },
    { item: 'star', does: 'Invincible for twelve seconds.' },
  ],
  tips: [
    'You cannot stomp, and blocks do nothing when you hit them from below. Strike or blast them.',
    'Spells take a moment to cast and pass through walls.',
    'Your class is kept when you lose a life.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch'],
};
