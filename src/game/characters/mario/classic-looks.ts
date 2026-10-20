import type { CharacterDef } from '../character';
import type { PlumberPalettes } from './index';
import { MARIO_CLASSIC } from './classic';
import { plumberClassicGuide } from './classic-guide';
import { LUIGI_CLASSIC } from '../luigi/classic';

/**
 * Mario's and Luigi's "Super Mario Bros. 3" looks (G-053): the original's looks with a small
 * crouch frame let small Mario and Luigi duck and crouch-jump (MarioBase.as canCrouch:
 * hasSmallCrouchFrame || Mushroom); the default looks have none, so small never ducks there.
 * Otherwise each plays as its hero (`lookOf`), in a palette of our own (sprites/hero-looks.ts).
 */
function plumberLook(
  host: CharacterDef,
  id: string,
  palettes: PlumberPalettes,
  name: string,
  tagline: string,
): CharacterDef {
  return {
    ...host,
    id,
    name,
    lookOf: host.id,
    smallCrouch: true,
    portrait: { sheet: 'mario', palette: palettes.normal, frame: 'small-idle' },
    sprite: (p, frame, reduce) => {
      const s = host.sprite(p, frame, reduce);
      // The host's own palettes become the look's (the Star's flashes stay the host's).
      const pal =
        s.palette === `${host.id}-fire` ? palettes.fire : s.palette === host.id ? palettes.normal : s.palette;
      return pal === undefined ? s : { ...s, palette: pal };
    },
    guide: { ...plumberClassicGuide(host.name, tagline) },
  };
}

export const MARIO3_CLASSIC: CharacterDef = plumberLook(
  MARIO_CLASSIC,
  'mario3',
  { normal: 'mario3', fire: 'mario3-fire', star: 'mario-star' },
  'SMB3 Mario',
  'a sharp rocket jump; small, he can duck',
);

export const LUIGI3_CLASSIC: CharacterDef = plumberLook(
  LUIGI_CLASSIC,
  'luigi3',
  { normal: 'luigi3', fire: 'luigi3-fire', star: 'mario-star' },
  'SMB3 Luigi',
  'slippery, floats high; small, he can duck',
);
