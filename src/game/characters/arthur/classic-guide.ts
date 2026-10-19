import type { CharacterGuide } from '../character';

/** Sir Arthur's "How to play" page (AR-28, TG-22). Abilities by name, never button letters. */
export const ARTHUR_CLASSIC_GUIDE: CharacterGuide = {
  tagline: 'Armour, lances, no going back',
  controls: [
    { action: 'left/right', does: 'Walk. Your jump keeps the direction you take off in.' },
    { action: 'jump', does: 'Jump. Press again in the air for one more jump, in the direction you hold.' },
    { action: 'attack', touch: 'THROW', does: 'Throw your weapon. You stop for a moment on the ground.' },
    { action: 'down', does: 'Crouch. Throws go low.' },
    { action: 'down+attack', does: 'In the air: throw straight down.' },
    { action: 'special', touch: 'MAGIC', does: 'In gold armour: lightning on both sides.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'Steel armour. One hit knocks it off.' },
    { item: 'flower', does: 'Gold armour: stronger weapons that pierce, and magic.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
    { item: 'drops', does: 'Weapon pots. Touch one to change weapons.' },
  ],
  tips: ['One hit takes all your armour.', 'The torch fire burns through armour.'],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch'],
};
