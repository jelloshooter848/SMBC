import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { headFaces, megamanSmbcSheet } from './smbc-megaman';

/**
 * Classic mode's Mega Man gameplay variants (docs/classic/FOLLOW_UPS_PROPOSAL.md FU-3; the
 * original's Mega Man skins with rule changes, SkinDescriptions.as): Rock, Francesca (and her
 * Doropie look), Rokko Chan, Cut Man, Ice Man and Fire Man. Our own art, built from Classic Mega
 * Man's redrawn sheet (smbc-megaman.ts: his bodies, buster and poses at the original 3.1.21 sizes)
 * under each one's own head, drawn by hand on his face plan, in his six palette roles:
 *   0 outline   1 light (body, crest)   2 dark (gloves, boots, helmet, hair)   3 skin   4 white
 *   5 the charge glow's role, here also a hat band, flame or hair
 * so every weapon suit, charge and Star palette recolours them as it does Mega Man.
 */

/** Rock, without his helmet: spiky hair over the brow, an ear showing. */
const rockHead = [
  '...0.00.0....',
  '..0202202000.',
  '.02222222220.',
  '0222122222220',
  '0222222233330',
  '0222033440430',
  '0220033440430',
  '0220333333330',
  '.023333330330',
  '..0033333330.',
  '...0000000...',
];

/** Cut Man: his helmet under the great scissor blades, open in a V. */
const cutHead = [
  '.00.......00.',
  '0440.....0440',
  '04440...04440',
  '.04440.04440.',
  '..044404440..',
  '...0020200...',
  '..002222200..',
  '.02222111220.',
  '0222221112220',
  '0222203333330',
  '0212033440430',
  '0212033440430',
  '0222033333330',
  '0222203330330',
  '.00220333330.',
  '..000000000..',
];

/** Ice Man: a parka hood with a fur ring round his face. */
const iceHead = [
  '....00000....',
  '..002222200..',
  '.02222222220.',
  '0222244444420',
  '0222243333340',
  '0222043440430',
  '0222043440430',
  '0222043333340',
  '0222043330330',
  '.02224444440.',
  '..000000000..',
];

/** Fire Man: his helmet with the flame burning on top. */
const fireHead = [
  '......5......',
  '.....515.5...',
  '...5.51155...',
  '..51511115...',
  '...1111111...',
  '....00000....',
  '..002222200..',
  '.02222111220.',
  '0222221112220',
  '0222203333330',
  '0212033440430',
  '0212033440430',
  '0222033333330',
  '0222203330330',
  '.00220333330.',
  '..000000000..',
];

/** Rokko Chan: a round helmet, her hair in bangs over the brow and out the back. */
const rokkoHead = [
  '....00000....',
  '..002222200..',
  '.02222444220.',
  '0552224442220',
  '0555205555530',
  '0552033440430',
  '0552033440430',
  '0552033333330',
  '0552203330330',
  '.05520333330.',
  '..000000000..',
];

/** Francesca (and Doropie): the tall witch's hat with its band, her hair down to her shoulders. */
const witchHead = [
  '........00...',
  '.......020...',
  '......0220...',
  '.....02220...',
  '....022220...',
  '...0222220...',
  '.00555555500.',
  '0222222222220',
  '.05555555550.',
  '0555533333330',
  '0555503333330',
  '0555033440430',
  '0555033440430',
  '0555033333330',
  '0555503330330',
  '.05550333330.',
  '..000000000..',
];

/** Each variant's sheet id and its own head set. */
export const MEGAMAN_VARIANT_SHEETS: Record<string, SpriteDef> = {
  'mm-rock': megamanSmbcSheet('rock', headFaces(rockHead)),
  'mm-cutman': megamanSmbcSheet('cutman', headFaces(cutHead)),
  'mm-iceman': megamanSmbcSheet('iceman', headFaces(iceHead)),
  'mm-fireman': megamanSmbcSheet('fireman', headFaces(fireHead)),
  'mm-rokko': megamanSmbcSheet('rokko', headFaces(rokkoHead, '5')),
  'mm-witch': megamanSmbcSheet('francesca', headFaces(witchHead, '5')),
};

/** A suit and its charge flashes: the glow role cyan, then the body brightening to gold. */
function suit(name: string, colours: string[]): Record<string, string[]> {
  return {
    [name]: colours,
    [`${name}-charge-0`]: colours.map((c, i) => (i === 5 ? NES.cyan : c)),
    [`${name}-charge-1`]: [
      NES.black,
      NES.peach,
      NES.lightGray,
      colours[3] ?? NES.skin,
      NES.white,
      NES.yellow,
    ],
    [`${name}-charge-2`]: [
      NES.black,
      NES.yellowLight,
      NES.yellow,
      colours[3] ?? NES.skin,
      NES.white,
      NES.white,
    ],
  };
}

export const megamanVariantPalettes: Record<string, string[]> = {
  // Rock: a pale blue shirt, brown hair, gloves and boots.
  ...suit('rock', [NES.black, NES.skyLight, NES.brown, NES.skin, NES.white, NES.yellow]),
  // Cut Man: red-orange with deep red, his blades white.
  ...suit('cutman', [NES.black, NES.orange, NES.redDark, NES.skin, NES.white, NES.yellow]),
  // Ice Man: a blue parka, pale blue suit, white fur.
  ...suit('iceman', [NES.black, NES.skyLight, NES.blue, NES.skin, NES.white, NES.yellow]),
  // Fire Man: orange and dark red, a yellow flame.
  ...suit('fireman', [NES.black, NES.orange, NES.redDark, NES.skin, NES.white, NES.yellowLight]),
  // Rokko Chan: pink and red, light brown hair.
  ...suit('rokko', [NES.black, NES.pink, NES.red, NES.skin, NES.white, NES.brownLight]),
  // Francesca: purple and deep blue, golden hair.
  ...suit('francesca', [NES.black, NES.purple, NES.blueDark, NES.skin, NES.white, NES.yellowLight]),
  // Doropie, her other look: pink and red, the same golden hair.
  ...suit('doropie', [NES.black, NES.pink, NES.redDark, NES.skin, NES.white, NES.yellowLight]),
};

/** The suit palettes above, for the Star and Rush fallbacks (sprites/index.ts). */
export const MEGAMAN_VARIANT_SUITS = ['rock', 'cutman', 'iceman', 'fireman', 'rokko', 'francesca', 'doropie'];
