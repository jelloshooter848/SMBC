import type { CharacterGuide } from '../character';

export const LINK_GUIDE: CharacterGuide = {
  tagline: 'Sword, shield and a tool belt',
  controls: [
    { action: 'left/right', does: 'Walk. No running.' },
    { action: 'jump', does: 'A fixed-height jump, steerable in the air.' },
    { action: 'attack', does: 'Sword slash. At full hearts with the red tunic it fires a beam.' },
    {
      action: 'down',
      does: 'On the ground: crouch. In the air: hold for a down-thrust that bounces off enemies.',
    },
    { action: 'up+attack', does: 'In the air: up-thrust at things overhead.' },
    { action: 'select', does: 'Cycle the tool belt.' },
    { action: 'special', does: 'Use the selected tool.' },
  ],
  powerups: [
    {
      item: 'mushroom',
      does: 'A heart container, full heal, and the white tunic: every other hit glances off.',
    },
    { item: 'flower', does: 'The red tunic: the sword fires a beam while your hearts are full.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
    { item: 'drops', does: 'Enemies drop bombs, magic jars and half hearts.' },
  ],
  belt: [
    {
      name: 'Boomerang',
      icon: 'icon-boomerang',
      does: 'Flies out and back. Stuns what it hits. A stunned enemy is harmless: finish it with the sword.',
    },
    {
      name: 'Bomb',
      icon: 'icon-bomb',
      cost: 'ammo',
      does: 'Set it down and step back. Kills enemies, breaks bricks, and hurts you too.',
    },
    { name: 'Jump spell', icon: 'icon-jump', cost: '8 magic', does: 'Higher jumps for ten seconds.' },
    { name: 'Shield spell', icon: 'icon-shield', cost: '8 magic', does: 'Half damage for ten seconds.' },
    {
      name: 'Fire spell',
      icon: 'icon-fire',
      cost: '4 magic',
      does: 'Your next swing fires a beam, whatever your hearts.',
    },
  ],
  tips: [
    'Stand still facing a shot and the shield blocks it.',
    'Magic jars refill the blue meter under your hearts.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch', 'special'],
};
