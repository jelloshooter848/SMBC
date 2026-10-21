import type { CharacterGuide } from '../character';

/**
 * Classic SMBC's "How to play" page for Mega Man (MM-C27, TG-22): the controls of MM-C1, the
 * power states of MM-C15, and the belt the dev full kit cycles (MM-C21, TG-44).
 */
export const MEGAMAN_CLASSIC_GUIDE: CharacterGuide = {
  tagline: 'Mega Buster, slide and Rush',
  controls: [
    { action: 'left/right', does: 'Walk. Starts and stops at once, after a small first step.' },
    { action: 'jump', does: 'Jump. Let go early and the rise eases off.' },
    {
      action: 'down+jump',
      does: 'Slide: low and fast, under low gaps and over one-tile holes. Let go of down and jump to jump out.',
    },
    {
      action: 'attack',
      touch: 'SHOOT',
      does: 'Fire the buster, three shots at a time. Shots fly through walls and pipes, and break bricks.',
    },
    {
      action: 'attack (hold)',
      touch: 'SHOOT',
      does: 'With the mushroom: charge, then let go. Fully charged, the shot goes on through what it defeats.',
    },
    {
      action: 'special',
      touch: 'BLADE',
      does: 'With the flower: throw a Metal Blade. Hold up, down or a diagonal to aim it.',
    },
    {
      action: 'select',
      touch: 'RUSH',
      does: 'Tap: call Rush. Fall onto him for a high bounce. Hold: swap the shoot and weapon buttons.',
    },
  ],
  powerups: [
    { item: 'mushroom', does: 'The charge shot. Any hit takes it, and the flower, away.' },
    { item: 'flower', does: 'Metal Blade, with its own energy bar. More flowers refill it.' },
    { item: 'star', does: 'Invincible for twelve seconds. Weapons cost no energy.' },
    { item: 'drops', does: 'Weapon energy. The game stops while the bar fills.' },
  ],
  belt: [
    {
      name: 'Metal Blade',
      icon: 'icon-saw',
      cost: '2',
      does: 'Aimed eight ways, on through what it defeats.',
    },
    { name: 'Super Arm', icon: 'icon-super-arm', cost: '8', does: 'Lift a brick you touch, then throw it.' },
    {
      name: 'Hard Knuckle',
      icon: 'icon-knuckle',
      cost: '8',
      does: 'A slow fist that breaks armour. Steer it up or down.',
    },
    {
      name: 'Pharaoh Shot',
      icon: 'icon-pharaoh',
      cost: '4',
      does: 'Tap to shoot. Hold to grow a fireball over your head.',
    },
    {
      name: 'Charge Kick',
      icon: 'icon-kick',
      cost: '4',
      does: 'Turns the slide attack on or off. While on, every slide is an attack.',
    },
    { name: 'Flame Blast', icon: 'icon-flame', cost: '4', does: 'Lands and burns as a pillar of fire.' },
    {
      name: 'Magma Bazooka',
      icon: 'icon-magma',
      cost: '2',
      does: 'Three shots at once. Hold to charge them.',
    },
    {
      name: 'Water Shield',
      icon: 'icon-water-shield',
      cost: '16',
      does: 'Drops circle you. Use again to send them out.',
    },
    { name: 'Screw Crusher', icon: 'icon-screw', cost: '2', does: 'Lobbed up and forward.' },
    { name: 'Rush Coil', icon: 'icon-rush', does: 'Call Rush.' },
  ],
  tips: [
    'There is no health bar: small, one hit ends the run. With power-ups, a hit makes you small again.',
    'Rush is free. Tap again while he waits to send him home.',
    'Thrown weapons stop you on the spot for a moment.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack'],
};
