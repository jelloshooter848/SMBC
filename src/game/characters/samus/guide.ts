import type { CharacterGuide } from '../character';

export const SAMUS_GUIDE: CharacterGuide = {
  tagline: 'Beams, missiles and morph ball',
  controls: [
    { action: 'left/right', does: 'Walk. Jumping while moving somersaults.' },
    { action: 'jump', does: 'A floaty jump. Let go early to cut it short.' },
    { action: 'attack', does: 'Fire the arm cannon.' },
    { action: 'up', does: 'Hold to aim straight up.' },
    { action: 'down', does: 'Curl into the morph ball: fits one-tile gaps, cannot jump. Press up to stand.' },
    {
      action: 'attack',
      does: 'In ball form: drop a bomb. It opens blocks and bounces you if you sit in it.',
    },
    { action: 'select', does: 'Switch between beam and missiles.' },
    { action: 'special', does: 'Fire a missile.' },
  ],
  powerups: [
    {
      item: 'mushroom',
      does: 'First: the Varia suit, half damage. Then energy tanks: +30 energy, up to 90.',
    },
    {
      item: 'flower',
      does: 'Beam upgrades in order: Long, Ice (freezes, a second shot shatters), Wave (goes through walls). Then +10 missiles.',
    },
    { item: 'star', does: 'Invincible for a few seconds.' },
    { item: 'drops', does: 'Energy orbs and missile packs.' },
  ],
  belt: [
    { name: 'Beam', icon: 'icon-beam', does: 'Your current beam. Unlimited.' },
    {
      name: 'Missile',
      icon: 'icon-missile',
      cost: 'ammo',
      does: 'Three damage and opens bricks. Up to thirty.',
    },
  ],
  tips: ['EN in the corner is your energy. It starts at 30.'],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch'],
};
