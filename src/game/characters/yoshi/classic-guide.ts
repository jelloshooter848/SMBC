import type { CharacterGuide } from '../character';

/**
 * Classic Yoshi's "How to play" page (bug-reports/2026-10-19-yoshi-build-classic-character.md
 * YO-26, TG-22, TG-40): abilities by name, never a button letter.
 */
export const YOSHI_CLASSIC_GUIDE: CharacterGuide = {
  tagline: 'Flutter, lick and throw eggs.',
  controls: [
    { action: 'left/right', does: 'Walk. No run.' },
    { action: 'jump', does: 'Jump. Hold JUMP while falling to flutter.' },
    {
      action: 'down',
      does: 'Crouch. In the air: ground pound. With a mouthful: swallow and lay an egg.',
    },
    {
      action: 'attack',
      touch: 'TONGUE',
      does: 'Tongue. Catches an enemy. Press again to spit it.',
    },
    { action: 'up+attack', does: 'Tongue up at an angle.' },
    {
      action: 'special',
      touch: 'EGG',
      does: 'Hold to aim an egg, let go to throw it.',
      touchDoes: 'Hold EGG to aim, let go to throw it.',
    },
  ],
  powerups: [
    { item: 'mushroom', does: 'One more hit. Carry 6 eggs.' },
    { item: 'flower', does: 'Red eggs: stronger, and they pierce armour.' },
    { item: 'star', does: 'Invincible for twelve seconds. Touching enemies defeats them.' },
    { item: 'drops', does: 'None. Swallow enemies to lay eggs.' },
  ],
  tips: [
    'The ground pound breaks bricks under you and hits whatever you land on.',
    'Spiny enemies are too prickly to eat.',
    'An egg bounces once off the ground before it breaks.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack', 'special', 'crouch'],
};
