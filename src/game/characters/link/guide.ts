import type { CharacterGuide } from '../character';

export const LINK_GUIDE: CharacterGuide = {
  tagline: 'Sword, shield and a tool belt',
  controls: [
    { action: 'left/right', does: 'Walk. No running.' },
    { action: 'jump', does: 'A fixed-height jump. Steer in the air.' },
    { action: 'attack', touch: 'SWORD', does: 'Slash. Full hearts and the red tunic fire a beam.' },
    { action: 'down', does: 'Crouch. In the air: down-thrust, bouncing off enemies.' },
    { action: 'up', does: 'In the air: up-thrust. Hits enemies above and opens blocks.' },
    { action: 'select', touch: 'TOOLS', does: 'Pick the next tool.' },
    {
      action: 'special',
      touch: 'TOOL BUTTON',
      does: 'Use the selected tool.',
      touchDoes: 'Shows the selected tool. Tap to use it.',
    },
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
