import type { CharacterGuide } from '../character';

export const SIMON_GUIDE: CharacterGuide = {
  tagline: 'Whip and holy sub-weapons',
  controls: [
    { action: 'left/right', does: 'Walk, slowly.' },
    { action: 'jump', does: 'A committed jump: no steering in the air.' },
    { action: 'attack', touch: 'WHIP', does: 'Crack the whip. It winds up, so swing early.' },
    { action: 'down', does: 'Crouch, and whip low.' },
    { action: 'select', touch: 'TOOLS', does: 'Pick the next sub-weapon.' },
    {
      action: 'special',
      touch: 'THROW',
      does: 'Throw the selected sub-weapon. Costs hearts.',
      touchDoes: 'Shows the selected sub-weapon. Tap to throw it. Costs hearts.',
    },
    { action: 'up+attack', touch: 'WHIP', does: 'Also throws the sub-weapon.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Classic play: Unlocks the next sub-weapon. Full heal.' },
    {
      item: 'flower',
      does: 'Classic play: A longer whip: leather, chain, morning star. Then double and triple shot.',
    },
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
  tips: [
    "In the story, power blocks hold Simon's own items: the Pot Roast (his health bar grows from 10 to 16), two whips, five sub-weapons and the Double and Triple Shot. A death loses what he found; replay levels to find it again.",
    'Getting hit knocks you back hard. Mind the pits.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch', 'special'],
};
