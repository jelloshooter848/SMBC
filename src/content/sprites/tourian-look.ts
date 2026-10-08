import { NES } from '@engine/gfx/palette';
import { draw, themed, type Rows } from './look-art';

/**
 * Tourian, the machine fortress at the bottom of Zebes (theme `tourian`, Samus's mini game ZEBES
 * ESCAPE): bolted green machine panels and tube blocks in the dark, in the spirit of the NES
 * Metroid's last area. Original art; nothing traced. Every frame keeps its tile's collision shape.
 *
 * - ground: a bolted panel, lit up-left, with a dark channel across it and three amber lights.
 * - hard blocks: a length of ribbed tube (the platforms of the brain's halls and the escape shaft).
 * - breakable bricks: the panel split by black cracks (bombs and missiles open them).
 * - used blocks: the panel gone dark; `castle-brick`: a grille.
 *
 * Tile palette `tiles-tourian` keeps the 12 shared roles: 1-3 greens, 4/7 gold, 5/6 grey and white,
 * 8 white, 9 amber, a red, b lava red.
 */
export const tourianTilePalette: string[] = [
  NES.black,
  NES.greenDark,
  '#00a844',
  '#b8f8b8',
  NES.yellow,
  NES.lightGray,
  NES.white,
  NES.yellowLight,
  NES.white,
  NES.peach,
  NES.redBright,
  NES.lava,
];

/* The panel: a bevel (lit top and left, dark bottom and right), bolts in the corners, a channel. */
const panel = (x: number, y: number): string => {
  if (x === 15 || y === 15) return '0';
  if (x === 0 || y === 0) return '3';
  if (x === 14 || y === 14) return '1';
  const bolt = (x === 2 || x === 12) && (y === 2 || y === 12);
  if (bolt) return '3';
  if ((x === 3 || x === 13) && (y === 3 || y === 13)) return '1';
  if (y === 6) return '1';
  if (y === 9) return '3';
  if (y === 7 || y === 8) return (x === 4 || x === 8 || x === 12) && y === 7 ? '9' : '0';
  return '2';
};
const groundTourian = draw(16, 16, panel);

/* A ribbed tube block: lit along its top, shaded under, a dark ring at each end and one between. */
const hardTourian = draw(16, 16, (x, y) => {
  if (y === 0 || y === 15) return '0';
  if (x === 0 || x === 8) return '0';
  if (x === 1 || x === 9) return y < 13 ? '3' : '1';
  if (x === 7 || x === 15) return '1';
  if (y < 4) return '3';
  if (y < 10) return '2';
  if (y < 14) return '1';
  return '0';
});

/* The panel split into loose plates by black cracks (`x` in the overlay). */
const CRACKS = [
  '.....x..........',
  '.....x..........',
  '......x..x......',
  '......x...xx....',
  '.....x......xx..',
  '.....x........xx',
  '......x.........',
  '.......x........',
  '........x.......',
  '..xxxxx.x.......',
  'xx.......x......',
  '..........x.....',
  '..........x.....',
  '...........x....',
  '...........x....',
  '...........x....',
];
const brickTourian = draw(16, 16, (x, y) => (CRACKS[y]?.[x] === 'x' ? '0' : panel(x, y)));

/* A spent panel: the same bevel, the face dark and the lights out. */
const usedTourian = draw(16, 16, (x, y) => {
  const c = panel(x, y);
  return c === '2' ? '1' : c === '9' ? '0' : c;
});

/* A grille: dark slots in a lit frame. */
const grilleTourian = draw(16, 16, (x, y) => {
  if (x === 15 || y === 15) return '0';
  if (x === 0 || y === 0) return '3';
  if (y % 4 === 2) return '0';
  if (y % 4 === 3) return '1';
  return '2';
});

/** The look's tile frames (registered in tiles.ts as `<tile>@tourian`). */
export function tourianTileFrames(): Record<string, Rows> {
  return themed(
    {
      ground: groundTourian,
      hard: hardTourian,
      brick: brickTourian,
      used: usedTourian,
      'castle-brick': grilleTourian,
    },
    'tourian',
  );
}

/**
 * Tourian's shapes, for 4-4's campaign look as Mother Brain's lair (zebes-world.ts, 0.4.27), which
 * draws them in its own palette (the same slot roles).
 */
export const tourianArt = {
  panel: groundTourian,
  tube: hardTourian,
  cracked: brickTourian,
  spent: usedTourian,
  grille: grilleTourian,
} as const;
