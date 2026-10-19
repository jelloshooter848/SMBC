import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * DESIGN MOCKUP ONLY (bug-reports/2026-10-19-peach-build-classic-character.md, PE-). Not registered in the
 * game: nothing under src/ imports this file. It feeds the storyboard renderer
 * (tools/mockups/classic/render.mjs) so the owner can approve the look before the hero is built.
 *
 * Original drafts of Princess Peach in her Super Mario Bros. 2 (USA) role, drawn from scratch at SMB scale:
 * crown, long blonde hair, puffed sleeves, white gloves, a bell skirt and red shoes. Big frames are 16x32
 * (figure 30 px tall), small frames 16x16 (the SMB2 one-heart size). Facing right.
 *
 * Palette index roles (the Flower outfit is a plain palette swap):
 *   0 outline   1 dress   2 dress shade   3 skin   4 hair   5 crown   6 gloves   7 jewel / eyes   8 lips & shoes
 */
const P = (dress: string, shade: string, jewel: string = NES.blueMid): string[] => [
  NES.black,
  dress,
  shade,
  NES.skin,
  NES.yellow,
  NES.orange,
  NES.white,
  jewel,
  NES.redBright,
];

export const peachPalettes: Record<string, string[]> = {
  // Small and Mushroom states.
  peach: P(NES.pink, NES.magenta),
  // Fire Flower state (PE-16): white dress, pink shade, red jewel.
  'peach-flower': P(NES.white, NES.pink, NES.redBright),
  // Star cycle, one row shown.
  'peach-star': P(NES.yellowLight, NES.orange, NES.redBright),
};

/** Items: 0 outline 1 white 2 light grey 3 green 4 dark green 5 red 6 yellow 7 blue 8 sky 9 brown. */
export const peachItemPalette: string[] = [
  NES.black,
  NES.white,
  NES.lightGray,
  NES.greenMid,
  NES.greenDark,
  NES.redBright,
  NES.yellow,
  NES.blueMid,
  NES.skyLight,
  NES.brown,
];

/* ---------- helpers ---------- */

const blank = (w: number, h: number): string[] => Array.from({ length: h }, () => '.'.repeat(w));

/** Paint the non-transparent pixels of `layer` onto a copy of `base` at (dx, dy). */
function paste(base: readonly string[], layer: readonly string[], dx: number, dy: number): string[] {
  const out = base.map((r) => r.split(''));
  layer.forEach((row, y) => {
    const target = out[y + dy];
    if (!target) return;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] as string;
      const tx = x + dx;
      if (ch === '.' || tx < 0 || tx >= target.length) continue;
      target[tx] = ch;
    }
  });
  return out.map((r) => r.join(''));
}

const compose = (w: number, h: number, ...layers: [readonly string[], number, number][]): string[] =>
  layers.reduce<string[]>((acc, [rows, dx, dy]) => paste(acc, rows, dx, dy), blank(w, h));

/** Replace every `from` index with `to` (closed eyes on the hurt frame). */
const recolour = (rows: readonly string[], from: string, to: string): string[] =>
  rows.map((r) => r.split(from).join(to));

/* ---------- big Peach (16x32) ---------- */

/** Head, rows 0-11: crown, hair falling down her back, face to the right. */
const HEAD = [
  '................',
  '.......5.5.5....',
  '.......55755....',
  '.....04444440...',
  '....0444444440..',
  '...044444333340.',
  '...044443373330.',
  '...044443373330.',
  '...044443333330.',
  '...044444333880.',
  '..04444443330...',
  '..04444440000...',
];

/** Bodice and arms down, rows 12-18. */
const BODICE = [
  '..04440111110...',
  '..044011111110..',
  '..040211111120..',
  '...02111711120..',
  '...06111111160..',
  '...06111111160..',
  '....011111110...',
];

/** Bodice with both arms raised to hold something over her head (carry). */
const BODICE_CARRY = [
  '..04440111110...',
  '..044011111110..',
  '..0402111111120.',
  '...02111711120..',
  '....011111110...',
  '....011111110...',
  '....011111110...',
];

/** Bodice with the front arm thrown forward (throw). */
const BODICE_THROW = [
  '..04440111110...',
  '..0440111111100.',
  '..0402111111166.',
  '...021117110066.',
  '...0611111110...',
  '...0611111110...',
  '....011111110...',
];

/** Raised arms for the carry pose, painted over the head rows (gloves above the crown). */
const ARMS_UP = [
  '..66........66..',
  '..06........60..',
  '..01........10..',
  '..01........10..',
  '..01........10..',
  '..01........10..',
  '..01........10..',
  '..01........10..',
  '..01........10..',
  '..01........10..',
  '..01........10..',
];

/** The skirt, rows 19-29. */
const SKIRT = [
  '....012111210...',
  '...01121112110..',
  '...01121112110..',
  '..0112111121110.',
  '..0112111121110.',
  '..0121111112110.',
  '.011211111121110',
  '.011211111121110',
  '.012111111112110',
  '.022222222222220',
  '...0000000000...',
];

/** The skirt swung back a pixel (walk-1). */
const SKIRT_SWAY = [
  '....012111210...',
  '...01121112110..',
  '...01121112110..',
  '...0112111121110',
  '...0112111121110',
  '...0121111112110',
  '..01121111112110',
  '..01121111112110',
  '..01211111111210',
  '..02222222222220',
  '....00000000000.',
];

/** The skirt belled out wide for the float (rows 19-29), with a ruffled hem. */
const SKIRT_FLOAT = [
  '...0121112110...',
  '..011211121110..',
  '.01112111211110.',
  '.01121111121110.',
  '0111211111211110',
  '0112111111121110',
  '0121111111112110',
  '0222222222222220',
  '0202020202020200',
  '.0.0.0.0.0.0.0..',
  '................',
];

const FEET_STAND = ['....0880.0880...', '....0000.0000...'];
const FEET_WALK0 = ['...0880...0880..', '...0000...0000..'];
const FEET_WALK1 = ['......08880.....', '......00000.....'];
const FEET_FLOAT0 = ['.....080.080....', '.....000.000....'];
const FEET_FLOAT1 = ['....080...080...', '....000...000...'];

const big = (
  bodice: readonly string[],
  skirt: readonly string[],
  feet: readonly string[],
  extra: [readonly string[], number, number][] = [],
): string[] => compose(16, 32, [HEAD, 0, 0], [bodice, 0, 12], [skirt, 0, 19], [feet, 0, 30], ...extra);

const stand = big(BODICE, SKIRT, FEET_STAND);
const walk0 = big(BODICE, SKIRT, FEET_WALK0);
const walk1 = big(BODICE, SKIRT_SWAY, FEET_WALK1);
const jump = big(BODICE_THROW, SKIRT_SWAY, FEET_WALK0);
const float0 = big(BODICE, SKIRT_FLOAT, ['................', '................'], [[FEET_FLOAT0, 0, 28]]);
const float1 = big(BODICE, SKIRT_FLOAT, ['................', '................'], [[FEET_FLOAT1, 0, 28]]);
const carry = big(BODICE_CARRY, SKIRT, FEET_STAND, [[ARMS_UP, 0, 1]]);
const carryWalk = big(BODICE_CARRY, SKIRT_SWAY, FEET_WALK0, [[ARMS_UP, 0, 1]]);
const throwPose = big(BODICE_THROW, SKIRT, FEET_WALK0);
const hurt = recolour(big(BODICE_THROW, SKIRT_SWAY, FEET_FLOAT1), '7', '0');

/** Pluck / lift: bent at the knees, head lowered 6 px, both gloves gripping at her toes. */
const lift = compose(
  16,
  32,
  [HEAD, 1, 6],
  [
    [
      '..04440111110...',
      '..0440111111100.',
      '..0402111111110.',
      '...02111711110..',
      '....01111116660.',
      '...0121112106660',
    ],
    1,
    18,
  ],
  [
    [
      '..01121112110...',
      '.0112111121110..',
      '.0121111112110..',
      '0112111111211100',
      '0222222222222220',
      '..000000000000..',
    ],
    0,
    24,
  ],
  [FEET_STAND, 0, 30],
);

/* ---------- small Peach (16x16) ---------- */

const S_HEAD = [
  '......5.5.5.....',
  '.....0455540....',
  '....0444444440..',
  '....044433730...',
  '....044433330...',
  '....044443380...',
  '...0444400000...',
];
const S_BODY = [
  '...0440111110...',
  '...0406171160...',
  '....01111110....',
  '...0112111210...',
  '..011211112110..',
  '..012111111210..',
  '..022222222220..',
];
const S_BODY_CARRY = [
  '..60440111110.6.',
  '..10406171110.1.',
  '..1.01111110..1.',
  '...0112111210...',
  '..011211112110..',
  '..012111111210..',
  '..022222222220..',
];
const S_BODY_FLOAT = [
  '...0440111110...',
  '...0406171160...',
  '...0111111110...',
  '..011211112110..',
  '.01121111112110.',
  '.02222222222220.',
  '.0.0.0.0.0.0.0..',
];
const S_FEET = ['...0880..0880...', '...0000..0000...'];
const S_FEET_WALK = ['.....08880......', '.....00000......'];
const small = (body: readonly string[], feet: readonly string[]): string[] =>
  compose(16, 16, [S_HEAD, 0, 0], [body, 0, 7], [feet, 0, 14]);

const sStand = small(S_BODY, S_FEET);
const sWalk = small(S_BODY, S_FEET_WALK);
const sCarry = small(S_BODY_CARRY, S_FEET);
const sFloat = small(S_BODY_FLOAT, ['......0.0.......', '................']);
const sLift = compose(16, 16, [S_HEAD, 1, 3], [S_BODY.slice(2), 0, 10], [['..066..........0'], 11, 9]);

export const peachDef: SpriteDef = {
  palette: 'peach',
  frames: {
    stand,
    'walk-0': walk0,
    'walk-1': walk1,
    jump,
    'float-0': float0,
    'float-1': float1,
    lift,
    carry,
    'carry-walk': carryWalk,
    throw: throwPose,
    hurt,
    'small-stand': sStand,
    'small-walk': sWalk,
    'small-carry': sCarry,
    'small-float': sFloat,
    'small-lift': sLift,
  },
};

/* ---------- items (Peach's plucks) ---------- */

const turnip = [
  '....00....00....',
  '...0330..0330...',
  '....03300330....',
  '.....043340.....',
  '......0440......',
  '....00111100....',
  '...0111111110...',
  '..011111111210..',
  '..011111112210..',
  '..011111112210..',
  '...0111112210...',
  '....01112210....',
  '.....011210.....',
  '......0110......',
  '.......00.......',
  '................',
];
/** The leaves left showing in the ground for a moment after a pluck (cosmetic). */
const sprout = ['.0..0...', '0330330.', '.03430..', '..040...'];
/** Rare pluck: the POW block (PE-14). */
const pow = [
  '0000000000000000',
  '0777777777777770',
  '0788888888888870',
  '0781111111111870',
  '0781117171711870',
  '0781717171711870',
  '0781117171711870',
  '0781711717171870',
  '0781711711711870',
  '0781111111111870',
  '0781111111111870',
  '0788888888888870',
  '0777777777777770',
  '0777777777777770',
  '0000000000000000',
  '................',
];
/** Rare pluck: the stopwatch (PE-14), 16x16 so it reads when carried. */
const watch = [
  '......0000......',
  '......0660......',
  '....00000000....',
  '...0222222220...',
  '..022111111220..',
  '..021111011120..',
  '.021111101111120',
  '.021111100011120',
  '.021111111111120',
  '..021111111120..',
  '..022111111220..',
  '...0222222220...',
  '....00000000....',
  '................',
  '................',
  '................',
];
/** A plain brick lifted out of the ground (PE-12, owner decision). Drawn as a carried block. */
const shockLines = ['1.......1', '.1.....1.', '..1...1..'];

export const peachItemsDef: SpriteDef = {
  palette: 'peach-items',
  frames: { turnip, sprout, pow, watch, 'shock-lines': shockLines },
};
