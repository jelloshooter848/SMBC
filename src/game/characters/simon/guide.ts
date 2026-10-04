import type { CharacterGuide } from '../character';

export const SIMON_GUIDE: CharacterGuide = {
  tagline: 'Whip and holy sub-weapons',
  controls: [
    { action: 'left/right', does: 'Walk, slowly.' },
    { action: 'jump', does: 'A committed jump: you cannot steer once in the air.' },
    { action: 'attack', does: 'Crack the whip. It winds up first, so swing early.' },
    { action: 'down', does: 'Crouch. Whip low while crouched.' },
    { action: 'select', does: 'Cycle the sub-weapons.' },
    { action: 'special', does: 'Throw the selected sub-weapon. Up + attack also throws.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Unlocks the next sub-weapon. Full heal.' },
    { item: 'flower', does: 'A longer whip: leather, chain, morning star. Then double and triple shot.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
    { item: 'drops', does: 'Hearts, small and large. Hearts are your sub-weapon ammo.' },
  ],
  belt: [
    { name: 'Dagger', icon: 'icon-dagger', cost: '1 heart', does: 'Fast and straight.' },
    {
      name: 'Axe',
      icon: 'icon-axe',
      cost: '1 heart',
      does: 'Lobbed high. Arcs over walls and hits things above.',
    },
    {
      name: 'Holy water',
      icon: 'icon-holy-water',
      cost: '1 heart',
      does: 'Shatters into a flame that burns on the floor.',
    },
    { name: 'Cross', icon: 'icon-cross', cost: '1 heart', does: 'Spins out and comes back.' },
    { name: 'Stopwatch', icon: 'icon-watch', cost: '5 hearts', does: 'Freezes everything on screen.' },
  ],
  tips: ['Getting hit knocks you back hard. Mind the pits.'],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch', 'special'],
};
