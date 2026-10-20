import type { CharacterDef } from '../character';
import type { DamageSource } from '../../rules/damage';
import { LINK_CLASSIC } from './classic';
import { LINK_CLASSIC_GUIDE } from './classic-guide';

/**
 * Princess Zelda's looks on Link's slot (G-050; SkinDescriptions.as LINK_SKIN_ZELDA "Arrows deal
 * more damage, sword attacks deal less damage"): Link's Classic rules with her sword at 150,
 * 225 and 350 (Link.setSwordType) and her arrows at 400, through what they defeat
 * (classic-weapons.ts ZELDA_ARROW). Three looks, as the original's NES, SNES and Game Boy ones;
 * our own art (sprites/hero-looks.ts: Link's poses with her hair and skirt, in our palettes).
 */
export const ZELDA_SWORD = { small: 150, big: 225, fire: 350 } as const;

/** Link's tunic palettes and the look's (power states: green, `-blue`, `-red`, LK-C21). */
const TUNICS: Readonly<Record<string, string>> = { link: '', 'link-blue': '-blue', 'link-red': '-red' };

function zeldaLook(id: string, palette: string, game: string): CharacterDef {
  const meleeDamage = LINK_CLASSIC.behaviour.meleeDamage;
  return {
    ...LINK_CLASSIC,
    id,
    name: 'Zelda',
    hudName: 'ZELDA',
    lookOf: 'link',
    rescueName: 'Link',
    portrait: { sheet: 'zelda-classic', palette, frame: 'idle' },
    portraitArt: { sheet: 'zelda-classic', palette, frame: 'idle' },
    sprite: (p, frame, reduce) => {
      const s = LINK_CLASSIC.sprite(p, frame, reduce);
      const sheet =
        s.sheet === 'link-classic'
          ? 'zelda-classic'
          : s.sheet === 'link-classic-shield'
            ? 'zelda-classic-shield'
            : s.sheet;
      // The Star, hurt and death palettes are Link's (the same roles); his tunics are her dresses.
      const tunic = s.palette !== undefined ? TUNICS[s.palette] : undefined;
      return { ...s, sheet, ...(tunic !== undefined ? { palette: `${palette}${tunic}` } : {}) };
    },
    guide: {
      ...LINK_CLASSIC_GUIDE,
      tagline: `Princess Zelda (${game}): a weaker sword, stronger arrows`,
    },
    behaviour: {
      ...LINK_CLASSIC.behaviour,
      ...(meleeDamage
        ? {
            meleeDamage: (p, enemy): DamageSource => ({
              ...meleeDamage(p, enemy),
              amount: ZELDA_SWORD[p.powerState as keyof typeof ZELDA_SWORD] ?? ZELDA_SWORD.small,
            }),
          }
        : {}),
    },
  };
}

export const ZELDA_NES_CLASSIC = zeldaLook('zelda-nes', 'zelda-nes', 'NES');
export const ZELDA_SNES_CLASSIC = zeldaLook('zelda-snes', 'zelda-snes', 'SNES');
export const ZELDA_GB_CLASSIC = zeldaLook('zelda-gb', 'zelda-gb', 'Game Boy');
