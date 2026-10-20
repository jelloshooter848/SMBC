import type { CharacterDef, SpriteSpec } from '../character';
import type { Player } from '../../entities/player';
import { LUIGI_CLASSIC } from '../luigi/classic';
import { plumberClassicGuide } from '../mario/classic-guide';

/**
 * Princess Peach in Classic mode (owner decision for 0.5.0, #179): the original 3.1.21's Luigi
 * skins 8 and 10 ("Princess Toadstool", BmdInfo.as 758, 766), so exactly Luigi: his moves, jump,
 * fireballs, springs, Bowser's hit points and every other rule, with only her look (sprites,
 * face and name). The original has no rule of its own for those skins (Luigi.as and MarioBase.as
 * switch on skin numbers only for the SMB2/SMB3 walk timing, skins 4 and 5, and the SML2 feather,
 * 2, 12 and 14); her vegetables, float and the rest were never the original's.
 *
 * Her frames are drawn from our own `peach` sheet: each of Luigi's poses mapped to hers, her
 * palettes in place of his (`peach`, `peach-flower` with the Flower, `peach-star-N` for the Star),
 * at Mario's offsets (16 x 32 big frames over the 12 x 24 box).
 */

/** Luigi's pose (`small-` or `big-` prefixed, or a grow step) as Peach's frame. */
function peachFrame(name: string): { frame: string; small: boolean } {
  if (name === 'grow-mid') return { frame: 'stand', small: false };
  const m = /^(small|big)-(.+)$/.exec(name);
  const small = m?.[1] !== 'big';
  const pre = small ? 'small-' : '';
  const rest = m?.[2] ?? 'idle';
  const walk = /^walk-(\d)$/.exec(rest);
  if (walk) return { frame: `${pre}walk-${walk[1]}`, small };
  const climb = /^climb-(\d)$/.exec(rest);
  if (climb) return { frame: `${pre}climb-${climb[1]}`, small };
  switch (rest) {
    case 'skid':
      return { frame: `${pre}skid`, small };
    case 'jump':
    case 'swim-0':
    case 'swim-1':
      return { frame: `${pre}jump`, small };
    case 'crouch':
      return small ? { frame: 'small-stand', small } : { frame: 'crouch', small };
    case 'throw':
      return { frame: `${pre}throw`, small };
    case 'die':
      return { frame: `${pre}hurt`, small };
    default:
      return { frame: `${pre}stand`, small };
  }
}

/** Luigi's palette as hers: his suit, his Flower suit, the Star's steps. */
function peachPalette(pal: string | undefined): string {
  if (pal === 'luigi-fire') return 'peach-flower';
  const star = /-star-(\d)$/.exec(pal ?? '');
  if (star) return `peach-star-${star[1]}`;
  return 'peach';
}

/** Luigi's sprite, drawn as Peach. */
export function peachSprite(p: Player, frame: number, reduce: boolean): SpriteSpec {
  const s = LUIGI_CLASSIC.sprite(p, frame, reduce);
  const { frame: name, small } = peachFrame(s.frame);
  return {
    ...s,
    sheet: 'peach',
    palette: peachPalette(s.palette),
    frame: name,
    offsetX: 2,
    offsetY: small ? 0 : p.crouching ? 16 : 8,
  };
}

export const PEACH_CLASSIC: CharacterDef = {
  ...LUIGI_CLASSIC,
  id: 'peach',
  // A look of Luigi's (Luigi skins 8 and 10): every rule that names Luigi names her.
  lookOf: 'luigi',
  name: 'Peach',
  hudName: 'PEACH',
  // The original's Peach skins name the Subcon as the one in another castle (BmdInfo.as namesArr[2]).
  rescueName: 'the Subcon',
  // ScreenManager.displayThankYouText: the skin's short name, THANK YOU TOADSTOOL! (namesArr[1]);
  // the last castle is the normal princess scene (owner decision, #179).
  thanksName: 'Toadstool',
  portrait: { sheet: 'peach', palette: 'peach', frame: 'stand' },
  sprite: peachSprite,
  guide: plumberClassicGuide('Peach', 'Princess Peach: plays as Luigi, slippery, floats high'),
};
