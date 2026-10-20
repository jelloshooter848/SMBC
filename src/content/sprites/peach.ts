import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Original art for Classic SMBC's Princess Peach (bug-reports/2026-10-19-peach-build-classic-character.md,
 * PE-24, PE-25), a Classic-only hero: her Super Mario Bros. 2 (USA) role drawn from scratch at SMB scale
 * (the owner-approved drafts from the design mockups' peach.ts, plus the poses they left out):
 * crown, long blonde hair, puffed sleeves, white gloves, a bell skirt and red shoes. Big frames are
 * 16x32 (figure 30 px tall, offset as Mario's), small frames 16x16 (the SMB2 one-heart size). Facing
 * right.
 *
 * Palette index roles (the Flower outfit and the Star flashes are palette swaps):
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
  // Fire Flower state (PE-15): white dress, pink shade, red jewel.
  'peach-flower': P(NES.white, NES.pink, NES.redBright),
  // The Star's four flashes (frame >> 1 & 3; the first one held with Reduce flashing), and the
  // Power Squat's charged look (PE-8).
  'peach-star-0': P(NES.yellowLight, NES.orange, NES.redBright),
  'peach-star-1': P(NES.greenLight, NES.green, NES.white),
  'peach-star-2': P(NES.skyLight, NES.blueMid, NES.pink),
  'peach-star-3': P(NES.white, NES.red, NES.blueMid),
};

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

/* ---------- the poses the drafts left out (PE-25) ---------- */

const FEET_WALK2 = ['....0880..0880..', '....0000..0000..'];
const FEET_SKID = ['..0880....0880..', '..0000....0000..'];
const walk2 = big(BODICE, SKIRT, FEET_WALK2);
const skid = big(BODICE, SKIRT_SWAY, FEET_SKID);
/** Crouched (12 x 16 box): head lowered over a pooled skirt, in the bottom 22 rows. */
const crouch = compose(16, 32, [HEAD, 0, 10], [BODICE.slice(0, 3), 0, 22], [SKIRT.slice(4), 0, 25]);
const carryWalk1 = big(BODICE_CARRY, SKIRT, FEET_WALK1, [[ARMS_UP, 0, 1]]);
const carryWalk2 = big(BODICE_CARRY, SKIRT_SWAY, FEET_WALK2, [[ARMS_UP, 0, 1]]);
const carryJump = big(BODICE_CARRY, SKIRT_SWAY, FEET_FLOAT1, [[ARMS_UP, 0, 1]]);
/** On a vine: both arms reaching up, the legs stepping. */
const climb0 = big(BODICE_CARRY, SKIRT, FEET_WALK0, [[ARMS_UP, 0, 1]]);
const climb1 = big(BODICE_CARRY, SKIRT_SWAY, FEET_WALK1, [[ARMS_UP, 0, 1]]);

const S_FEET_WALK0 = ['..0880...0880...', '..0000...0000...'];
const S_BODY_JUMP = [
  '...0440111110.6.',
  '...04061711101..',
  '....01111110....',
  '...0112111210...',
  '..011211112110..',
  '..012111111210..',
  '..022222222220..',
];
const S_BODY_THROW = [
  '...0440111110...',
  '...04061711166..',
  '....0111111066..',
  '...0112111210...',
  '..011211112110..',
  '..012111111210..',
  '..022222222220..',
];
const sWalk0 = small(S_BODY, S_FEET_WALK0);
const sJump = small(S_BODY_JUMP, S_FEET_WALK0);
const sThrow = small(S_BODY_THROW, S_FEET_WALK0);
const sHurt = recolour(small(S_BODY_JUMP, S_FEET_WALK), '7', '0');
const sFloat1 = small(S_BODY_FLOAT, ['.....0...0......', '................']);
const sCarryWalk0 = small(S_BODY_CARRY, S_FEET_WALK0);
const sCarryWalk1 = small(S_BODY_CARRY, S_FEET_WALK);
const sCarryJump = small(S_BODY_CARRY, ['..0880....080...', '..0000....000...']);

export const peachDef: SpriteDef = {
  palette: 'peach',
  frames: {
    stand,
    'walk-0': walk0,
    'walk-1': walk1,
    'walk-2': walk2,
    skid,
    jump,
    'float-0': float0,
    'float-1': float1,
    crouch,
    lift,
    carry,
    'carry-walk-0': carryWalk,
    'carry-walk-1': carryWalk1,
    'carry-walk-2': carryWalk2,
    'carry-jump': carryJump,
    throw: throwPose,
    hurt,
    'climb-0': climb0,
    'climb-1': climb1,
    'small-stand': sStand,
    'small-walk-0': sWalk0,
    'small-walk-1': sWalk,
    'small-walk-2': sStand,
    'small-skid': sWalk0,
    'small-jump': sJump,
    'small-float-0': sFloat,
    'small-float-1': sFloat1,
    'small-lift': sLift,
    'small-carry': sCarry,
    'small-carry-walk-0': sCarryWalk0,
    'small-carry-walk-1': sCarryWalk1,
    'small-carry-walk-2': sCarry,
    'small-carry-jump': sCarryJump,
    'small-throw': sThrow,
    'small-hurt': sHurt,
    'small-climb-0': sCarry,
    'small-climb-1': sCarryWalk1,
  },
};
