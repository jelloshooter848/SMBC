import type { CharacterGuide } from '../character';

export const SAMUS_GUIDE: CharacterGuide = {
  tagline: 'Beams, missiles and morph ball',
  controls: [
    { action: 'left/right', does: 'Walk. Jump while moving to somersault.' },
    { action: 'jump', does: 'A floaty jump. Let go early to cut it short.' },
    { action: 'attack', touch: 'SHOOT', does: 'Fire the beam, or a missile when missiles are picked.' },
    { action: 'up', does: 'Hold to aim straight up.' },
    { action: 'down', does: 'Morph ball: fits one-tile gaps, no jumping. Up stands.' },
    { action: 'attack', touch: 'BOMB', does: 'In the ball: drop a bomb. Opens blocks. Sit on it to bounce.' },
    { action: 'select', touch: 'WEAPON', does: 'Switch between your beams and missiles.' },
    { action: 'special', touch: 'MISSILE', does: 'Fire a missile.' },
  ],
  powerups: [
    {
      item: 'mushroom',
      does: 'Classic play: first the Varia suit, half damage. Then energy tanks: +30 energy, up to 90.',
    },
    {
      item: 'flower',
      does: 'Classic play: Beam upgrades in order: Long, Ice (freezes, a second shot shatters), Wave (goes through walls). Then +10 missiles.',
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
  tips: [
    "In the story, power blocks hold Samus's own items: Energy Tanks (up to six, the boxes above EN), Missiles, the Long, Ice and Wave Beams and the Varia Suit. A death loses what she found; replay levels to find it again.",
    'EN in the corner is your energy. It starts at 30.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch'],
};
