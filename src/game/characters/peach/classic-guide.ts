import type { CharacterGuide } from '../character';

/**
 * Classic Peach's "How to play" page (PE-23, TG-40): abilities named, never button letters.
 */
export const PEACH_CLASSIC_GUIDE: CharacterGuide = {
  tagline: 'Pluck, carry, throw and float',
  controls: [
    { action: 'left/right', does: 'Walk. Hold RUN to run, when your hands are free.' },
    { action: 'jump', does: 'Jump. Keep holding it as you fall to float for a moment.' },
    {
      action: 'special',
      touch: 'LIFT',
      does: 'Pull a vegetable from the ground, or lift the enemy you stand on.',
    },
    { action: 'attack', touch: 'THROW', does: 'Throw what you carry.' },
    { action: 'down+attack', does: 'Set down what you carry.' },
    { action: 'down', does: 'Crouch. Stay crouched to charge a super jump.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Grow and survive one hit.' },
    { item: 'flower', does: 'Pluck faster. Vegetables fly through what they defeat.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
  ],
  tips: ['Land on most enemies to ride them.', 'Spiny enemies hurt to stand on.'],
  demo: ['idle', 'walk', 'jump', 'special', 'attack'],
};
