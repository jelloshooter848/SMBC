import type { CharacterGuide } from '../character';

/** Classic SMBC Samus's "How to play" page (TG-22, SA-C1); `name` for a variant built on her. */
export function samusClassicGuide(name = 'Samus'): CharacterGuide {
  return {
    tagline: `${name}: beams, missiles, bombs`,
    controls: [
      {
        action: 'left/right',
        does: 'Walk at one steady speed, in the air too. You stop the moment you let go.',
      },
      {
        action: 'jump',
        does: 'Jump high. Let go early for a lower jump. A running jump turns into a somersault.',
      },
      { action: 'up', does: 'Aim straight up. You can walk while aiming. In the ball, stand up.' },
      {
        action: 'down',
        does: 'Crouch: you stay down until you aim up, jump or walk. Press it again, or in the air, to curl into the ball.',
      },
      {
        action: 'attack',
        touch: 'SHOOT',
        does: 'Fire the beam, three shots at a time. In the ball, lay a bomb.',
      },
      {
        action: 'special',
        touch: 'MISSILE',
        does: 'Fire a missile once you have them. Missiles break armour.',
      },
    ],
    powerups: [
      { item: 'mushroom', does: 'Long Beam, and four missiles the first time.' },
      {
        item: 'flower',
        does: 'Wave Beam through walls, more missile room and the Screw Attack. Any hit makes you small again.',
      },
      { item: 'star', does: 'Invincible for twelve seconds, and missiles cost nothing.' },
      { item: 'drops', does: 'Missile packs, once you have missiles.' },
    ],
    tips: [
      'Standing shots fly over small enemies: crouch to hit them.',
      'With the flower, a somersault defeats what it touches. Shooting ends it.',
      'A bomb lifts you up when its blast catches you.',
    ],
    demo: ['idle', 'walk', 'jump', 'attack', 'crouch'],
  };
}
