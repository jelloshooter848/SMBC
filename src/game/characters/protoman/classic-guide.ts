import type { CharacterGuide } from '../character';
import { MEGAMAN_CLASSIC_GUIDE } from '../megaman/classic-guide';

/**
 * Classic SMBC Proto Man's and Break Man's "How to play" page (PM-20, TG-22): Classic Mega Man's,
 * with the rows the four rule changes touch. Neither name appears in it, so both share it.
 */
export const PROTOMAN_CLASSIC_GUIDE: CharacterGuide = {
  ...MEGAMAN_CLASSIC_GUIDE,
  tagline: "Mega Man's rival. Charges from the start.",
  controls: MEGAMAN_CLASSIC_GUIDE.controls.map((c) => {
    if (c.action === 'attack')
      return {
        ...c,
        does: 'Fire the buster. Two shots at a time, three with a mushroom. Shots fly through walls and break bricks.',
      };
    if (c.action === 'attack (hold)')
      return { ...c, does: 'Charge, even without a mushroom. Let go for a bigger shot.' };
    return c;
  }),
  powerups: MEGAMAN_CLASSIC_GUIDE.powerups.map((p) =>
    p.item === 'mushroom' ? { ...p, does: 'One extra hit and a third buster shot.' } : p,
  ),
  tips: [
    'Hits knock you back twice as far as Mega Man. Mind the pits.',
    ...(MEGAMAN_CLASSIC_GUIDE.tips ?? []),
  ],
};
