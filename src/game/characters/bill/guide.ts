import type { CharacterGuide } from '../character';

export const BILL_GUIDE: CharacterGuide = {
  tagline: 'Rifle with eight-way aim',
  controls: [
    { action: 'left/right', does: 'Run.' },
    { action: 'jump', does: 'A fixed somersault jump.' },
    { action: 'attack', touch: 'SHOOT', does: 'Fire. Unlimited bullets. Hold with the machine gun.' },
    { action: 'up', does: 'Aim up, diagonally while moving.' },
    { action: 'down', does: 'Go prone on the ground. In the air: aim down.' },
    { action: 'select', touch: 'WEAPON', does: 'Switch guns.' },
    {
      action: 'special',
      touch: 'GUN',
      does: 'Also fires.',
      touchDoes: 'Shows the gun in hand. Also fires.',
    },
  ],
  powerups: [
    { item: 'mushroom', does: 'Classic play: One more hit, up to five.' },
    { item: 'flower', does: 'Classic play: The next gun in order and it becomes selected.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
    { item: 'drops', does: 'Health and weapon capsules.' },
  ],
  belt: [
    { name: 'Rifle', icon: 'icon-rifle', does: 'Tap to fire. Four shots on screen.' },
    { name: 'Machine gun', icon: 'icon-mg', does: 'Hold to keep firing.' },
    { name: 'Spread', icon: 'icon-spread', does: 'Five shots in a fan.' },
    { name: 'Laser', icon: 'icon-laser', does: 'One beam that pierces everything in a line.' },
    { name: 'Flame thrower', icon: 'icon-flame-gun', does: 'A slow heavy fireball.' },
  ],
  tips: [
    "In the story, power blocks hold Bill's own items: Medals and the falcon guns M, L, F and S. A death loses what he found; replay levels to find it again.",
    'You start with three hits. Every touch costs one.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch'],
};
