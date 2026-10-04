import type { CharacterGuide } from '../character';

export const BILL_GUIDE: CharacterGuide = {
  tagline: 'Rifle with eight-way aim',
  controls: [
    { action: 'left/right', does: 'Run.' },
    { action: 'jump', does: 'A fixed somersault jump.' },
    { action: 'attack', does: 'Fire the rifle. Unlimited bullets.' },
    { action: 'up', does: 'Aim straight up when standing, diagonally up when moving.' },
    { action: 'down', does: 'On the ground: go prone and fire along the floor. In the air: aim down.' },
    { action: 'select', does: 'Switch between the guns you have.' },
    { action: 'special', does: 'Also fires.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'One more hit, up to five.' },
    { item: 'flower', does: 'The next gun in order and it becomes selected.' },
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
  tips: ['You start with three hits. Every touch costs one.'],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch'],
};
