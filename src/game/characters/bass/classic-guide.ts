import type { CharacterGuide } from '../character';
import { MEGAMAN_CLASSIC_GUIDE } from '../megaman/classic-guide';

/**
 * Classic SMBC's "How to play" page for Bass (bug-reports/2026-10-07-bass-build-classic-character.md
 * BA-36, TG-22, TG-40). The belt is the dev full kit's (BA-25): Mega Man's nine weapons, no Rush.
 */
export const BASS_CLASSIC_GUIDE: CharacterGuide = {
  tagline: 'Rapid fire, dash, double jump',
  controls: [
    {
      action: 'left/right',
      does: 'Walk. Starts and stops at once. While you shoot on the ground, it only turns you.',
    },
    { action: 'jump', does: 'Jump. Press again in the air for one double jump.' },
    {
      action: 'down+jump',
      does: 'Dash along the ground. Jump while dashing for a long, fast dash jump.',
    },
    {
      action: 'attack (hold)',
      touch: 'SHOOT',
      does: 'Rapid fire, 3 shots at a time. On the ground you stand still while firing.',
    },
    { action: 'up', does: 'While shooting: aim up. Add left or right to aim up at an angle.' },
    { action: 'down', does: 'While shooting: aim down at an angle.' },
    {
      action: 'special',
      touch: 'WATER',
      does: 'With the Flower: Water Shield. Press again to send it out.',
    },
    {
      action: 'select',
      touch: 'SWAP',
      does: 'With the Flower: swap the shot and Water Shield buttons.',
    },
  ],
  powerups: [
    { item: 'mushroom', does: 'Survive one hit. Four shots at a time.' },
    { item: 'flower', does: 'The Water Shield and its energy bar.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
    { item: 'drops', does: 'Weapon energy for the Water Shield.' },
  ],
  belt: (MEGAMAN_CLASSIC_GUIDE.belt ?? []).filter((b) => b.icon !== 'icon-rush'),
  tips: ['One hit takes the Mushroom and the Flower together.', 'Bass cannot charge his buster.'],
  demo: ['idle', 'walk', 'jump', 'attack'],
};
