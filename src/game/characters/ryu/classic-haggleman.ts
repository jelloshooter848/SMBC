import type { CharacterDef } from '../character';
import { HAGGLEMAN_ID, RYU_CLASSIC } from './classic';

/**
 * Haggle Man's look on Ryu's slot (G-052; SkinDescriptions.as RYU_SKIN_HAGGLE_MAN "Attacks hit
 * faster"; Ryu.as 232-242, 333-337): Ryu's Classic rules with the sword live one 45 ms step
 * sooner (ryu/classic.ts slashLive). Our own art: Ryu's Classic sheet in a palette of our own
 * (sprites/hero-looks.ts: a red ninja with a gold scarf).
 */
export const HAGGLEMAN_CLASSIC: CharacterDef = {
  ...RYU_CLASSIC,
  id: HAGGLEMAN_ID,
  name: 'Haggle Man',
  hudName: 'HAGGLE',
  lookOf: 'ryu',
  // BmdInfo Ryu skins 3, 4: namesArr ["Haggle Man", "Haggle Man", "Koume"].
  rescueName: 'Koume',
  portrait: { sheet: 'ryu-classic', palette: 'haggleman', frame: 'portrait' },
  portraitArt: { sheet: 'ryu-classic', palette: 'haggleman', frame: 'portrait' },
  sprite: (p, frame, reduce) => {
    const s = RYU_CLASSIC.sprite(p, frame, reduce);
    if (s.palette === 'ryu') return { ...s, palette: 'haggleman' };
    return s.palette?.startsWith('ryu-star-') ? { ...s, palette: s.palette.replace('ryu', 'haggleman') } : s;
  },
  guide: { ...RYU_CLASSIC.guide, tagline: 'Haggle Man: his sword hits sooner' },
};
