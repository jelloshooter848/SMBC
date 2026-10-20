import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Sir Arthur, a Classic-only hero (bug-reports/2026-10-19-arthur-build-classic-character.md, AR-29):
 * an original knight in his Ghosts 'n Goblins role, drawn here from scratch at SMB scale (the
 * owner-approved drafts of tools/mockups/classic/arthur.ts, with the climb, crouch, down-throw and
 * magic poses finished). One body, 16 x 32 cells, the same size in armour and in his boxers (no
 * grow or shrink, AR-3). Facing right. Steel armour (Mushroom), Gold armour (Fire Flower: the
 * `arthur-gold` palette on the same frames), boxers (small: bare chest, white shorts with red
 * hearts). Every armour pose has a `boxers-` twin.
 *
 * Palette index roles:
 *   0 outline   1 metal light   2 metal dark   3 skin   4 white   5 red   6 beard / hair   7 shine   8 boot / belt
 */
const P = (light: string, dark: string, shine: string = NES.white): string[] => [
  NES.black,
  light,
  dark,
  NES.skin,
  NES.white,
  NES.redBright,
  NES.brown,
  shine,
  NES.brownDark,
];

const BASE: Record<string, string[]> = {
  arthur: P(NES.lightGray, NES.gray),
  'arthur-gold': P(NES.yellow, NES.orange, NES.yellowLight),
};

/** Star colours (metal light and dark, which also tint the shorts and the hair) for steps 0..3. */
const STAR: readonly [string, string][] = [
  [NES.yellow, NES.redBright],
  [NES.cyan, NES.blueMid],
  [NES.pink, NES.magenta],
  [NES.white, NES.lightGray],
];

/** Weapons and effects: 0 outline 1 white 2 light grey 3 grey 4 brown 5 yellow 6 orange 7 red 8 sky 9 blue. */
const FX: string[] = [
  NES.black,
  NES.white,
  NES.lightGray,
  NES.gray,
  NES.brownLight,
  NES.yellow,
  NES.orange,
  NES.redBright,
  NES.skyLight,
  NES.blueMid,
];

export const arthurPalettes: Record<string, string[]> = {
  ...BASE,
  ...Object.fromEntries(
    STAR.map(([light, dark], i) => [
      `arthur-star-${i}`,
      [NES.black, light, dark, NES.skin, light, dark, dark, NES.white, NES.brownDark],
    ]),
  ),
  'arthur-fx': FX,
  // The Gold armour's weapons (AR-18): the metal drawn in gold.
  'arthur-gold-fx': FX.map((c, k) =>
    k === 1 ? NES.yellowLight : k === 2 ? NES.yellow : k === 3 ? NES.orange : c,
  ),
  // Lightning's second look for its flicker; Reduce flashing keeps 'arthur-fx'.
  'arthur-fx-alt': FX.map((c, k) => (k === 1 ? NES.yellowLight : k === 5 ? NES.white : c)),
};

/* ---------- helpers ---------- */

const blank = (w: number, h: number): string[] => Array.from({ length: h }, () => '.'.repeat(w));

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

/** Mirrored left to right. */
const mirror = (rows: readonly string[]): string[] => rows.map((r) => r.split('').reverse().join(''));
/** Turned half a turn. */
const rot180 = (rows: readonly string[]): string[] => mirror([...rows].reverse());
/** Turned a quarter turn clockwise (a right-pointing shot then points down). */
function rotCw(rows: readonly string[]): string[] {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return Array.from({ length: w }, (_, x) =>
    [...rows]
      .reverse()
      .map((r) => r[x] ?? '.')
      .join(''),
  );
}
/** Palette indices swapped (`map` from -> to). */
const recolor = (rows: readonly string[], map: Record<string, string>): string[] =>
  rows.map((r) =>
    r
      .split('')
      .map((c) => map[c] ?? c)
      .join(''),
  );

/* ---------- armour (16x32) ---------- */

/** Helmet with the face opening to the right and a red plume, rows 0-11. */
const HELM = [
  '................',
  '.....55.........',
  '....0555........',
  '....000000......',
  '...01171110.....',
  '..0117111110....',
  '..0171110000....',
  '..0111103330....',
  '..0121103030....',
  '..0121106660....',
  '..0122110000....',
  '...00222220.....',
];
/** Breastplate and arms at the sides, rows 12-21. */
const CHEST = [
  '..002111112200..',
  '.01121711121120.',
  '.01217111111210.',
  '.01211111111210.',
  '.01210111111020.',
  '.02210222222033.',
  '..0330888888033.',
  '..0330111111000.',
  '...00122222100..',
  '....0111111110..',
];
/** Chest with the throwing arm forward (the weapon leaves at the gauntlet). */
const CHEST_THROW = [
  '..002111112200..',
  '.011217111121000',
  '.012171111111233',
  '.012111111110033',
  '.0121011111100..',
  '.0221022222220..',
  '..033088888880..',
  '..0330111111000.',
  '...00122222100..',
  '....0111111110..',
];
/** Chest with the front arm raised (the arm itself is ARM_UP). */
const CHEST_RAISED = [
  '..002111112200..',
  '.0112171111210..',
  '.012171111110...',
  '.012111111110...',
  '.01210111110....',
  '.0221022222220..',
  '..033088888880..',
  '..0330111111000.',
  '...00122222100..',
  '....0111111110..',
];
/** The front arm raised over the head, from the shoulder (row 12) to the gauntlet (row 1). */
const ARM_UP = [
  '.33.',
  '0330',
  '0120',
  '0120',
  '0120',
  '0120',
  '0210',
  '0210',
  '0210',
  '0210',
  '0210',
  '0210',
];
/** The front arm pointing down under the body (the down-throw). */
const ARM_DOWN = ['0120', '0120', '0330', '.33.'];
/** Greaves, rows 22-31. */
const LEGS_STAND = [
  '....01110110....',
  '....01210120....',
  '....01210120....',
  '....01210120....',
  '....01110110....',
  '....02210220....',
  '...022100220....',
  '...0888008880...',
  '...0888008880...',
  '...0000000000...',
];
const LEGS_WALK0 = [
  '....01110110....',
  '...012100120....',
  '...012100120....',
  '..0121000120....',
  '..0111000110....',
  '..0221000220....',
  '.02210..0220....',
  '.08880..08880...',
  '.08880..08880...',
  '.00000..00000...',
];
const LEGS_WALK1 = [
  '....01110110....',
  '....01210120....',
  '.....0120120....',
  '.....0121210....',
  '.....0111110....',
  '.....0222220....',
  '.....0222220....',
  '....08888880....',
  '....08888880....',
  '....00000000....',
];
/** Knees tucked, for the jump (rows 22-31, the bottom rows empty). */
const LEGS_JUMP = [
  '....01110110....',
  '...0121001210...',
  '..01210..01210..',
  '..02220..02220..',
  '..08880..08880..',
  '..00000..00000..',
  '................',
  '................',
  '................',
  '................',
];
/** Crouched legs (rows 28-31). */
const LEGS_CROUCH = ['...0222002220...', '..08880008880...', '..08880008880...', '..00000000000...'];

/* ---------- boxers (16x32) ---------- */

/** Bare head: brown hair and beard, rows 0-11. */
const HEAD_BARE = [
  '................',
  '................',
  '................',
  '....000000......',
  '...06666660.....',
  '..0666666660....',
  '..0666333330....',
  '..0663330330....',
  '..0663333330....',
  '..0666666660....',
  '...066666600....',
  '....0333330.....',
];
const TORSO_BARE = [
  '...003333300....',
  '..03333333330...',
  '.03333333333330.',
  '.0330333330330..',
  '.0330333330330..',
  '.033033333033.0.',
  '..00444444400...',
  '...0454545450...',
  '...0445454540...',
  '...0444444440...',
];
const TORSO_BARE_THROW = [
  '...003333300....',
  '..033333333300..',
  '.03333333333333.',
  '.03303333300333.',
  '.0330333330.....',
  '..0003333330....',
  '..00444444400...',
  '...0454545450...',
  '...0445454540...',
  '...0444444440...',
];
const TORSO_BARE_RAISED = [
  '...003333300....',
  '..0333333330....',
  '.033333333330...',
  '.03303333330....',
  '.0330333330.....',
  '..0003333330....',
  '..00444444400...',
  '...0454545450...',
  '...0445454540...',
  '...0444444440...',
];
const ARM_UP_BARE = recolor(ARM_UP, { '1': '3', '2': '3' });
const ARM_DOWN_BARE = recolor(ARM_DOWN, { '1': '3', '2': '3' });
const LEGS_BARE = [
  '....03330330....',
  '....03330330....',
  '....03330330....',
  '....03330330....',
  '....03330330....',
  '....03330330....',
  '....03330330....',
  '...0888008880...',
  '...0888008880...',
  '...0000000000...',
];
const LEGS_BARE_WALK0 = [
  '....03330330....',
  '...033300330....',
  '...033300330....',
  '..0333000330....',
  '..0333000330....',
  '..0333000330....',
  '.03330..0330....',
  '.08880..08880...',
  '.08880..08880...',
  '.00000..00000...',
];
const LEGS_BARE_WALK1 = [
  '....03330330....',
  '....03330330....',
  '.....0330330....',
  '.....0333330....',
  '.....0333330....',
  '.....0333330....',
  '.....0333330....',
  '....08888880....',
  '....08888880....',
  '....00000000....',
];
const LEGS_BARE_JUMP = [
  '....03330330....',
  '...0333003330...',
  '..03330..03330..',
  '..03330..03330..',
  '..08880..08880..',
  '..00000..00000..',
  '................',
  '................',
  '................',
  '................',
];
const LEGS_BARE_CROUCH = ['...0333003330...', '..08880008880...', '..08880008880...', '..00000000000...'];

/* ---------- poses ---------- */

/** One look's parts: the armour's, or the boxers'. */
interface Parts {
  head: readonly string[];
  chest: readonly string[];
  chestThrow: readonly string[];
  chestRaised: readonly string[];
  armUp: readonly string[];
  armDown: readonly string[];
  stand: readonly string[];
  walk0: readonly string[];
  walk1: readonly string[];
  jump: readonly string[];
  crouch: readonly string[];
}

const ARMOUR: Parts = {
  head: HELM,
  chest: CHEST,
  chestThrow: CHEST_THROW,
  chestRaised: CHEST_RAISED,
  armUp: ARM_UP,
  armDown: ARM_DOWN,
  stand: LEGS_STAND,
  walk0: LEGS_WALK0,
  walk1: LEGS_WALK1,
  jump: LEGS_JUMP,
  crouch: LEGS_CROUCH,
};
const BOXERS: Parts = {
  head: HEAD_BARE,
  chest: TORSO_BARE,
  chestThrow: TORSO_BARE_THROW,
  chestRaised: TORSO_BARE_RAISED,
  armUp: ARM_UP_BARE,
  armDown: ARM_DOWN_BARE,
  stand: LEGS_BARE,
  walk0: LEGS_BARE_WALK0,
  walk1: LEGS_BARE_WALK1,
  jump: LEGS_BARE_JUMP,
  crouch: LEGS_BARE_CROUCH,
};

/** Every pose of one look (frame names without the `boxers-` prefix). */
function poses(k: Parts): Record<string, string[]> {
  const body = (chest: readonly string[], legs: readonly string[]): string[] =>
    compose(16, 32, [k.head, 0, 0], [chest, 0, 12], [legs, 0, 22]);
  // Crouched: the body lowered 9 px, knees out (hitbox 12 x 16, AR-3).
  const low = (chest: readonly string[]): string[] =>
    compose(16, 32, [k.head, 0, 9], [chest.slice(0, 7), 0, 21], [k.crouch, 0, 28]);
  const raised = (legs: readonly string[]): string[] =>
    compose(16, 32, [k.head, 0, 0], [k.chestRaised, 0, 12], [legs, 0, 22], [k.armUp, 11, 1]);
  const climb0 = raised(k.walk1);
  return {
    stand: body(k.chest, k.stand),
    'walk-0': body(k.chest, k.walk0),
    'walk-1': body(k.chest, k.walk1),
    // The other leg forward.
    'walk-2': body(k.chest, mirror(k.walk0)),
    jump: body(k.chest, k.jump),
    throw: body(k.chestThrow, k.walk1),
    crouch: low(k.chest),
    'crouch-throw': low(k.chestThrow),
    // Down + Attack in the air (AR-14): knees tucked, the arm thrown down.
    'throw-down': compose(16, 32, [k.head, 0, 0], [k.chest, 0, 12], [k.jump, 0, 22], [k.armDown, 11, 19]),
    // Lightning's wind-up (AR-19): the weapon raised over the head.
    magic: raised(k.stand),
    // On a vine or the flagpole: one arm up, then the other.
    'climb-0': climb0,
    'climb-1': mirror(climb0),
  };
}

/** The armour hit: knocked back, arms up, the armour bursting off (pieces are fx sprites). */
const hurt = compose(16, 32, [HEAD_BARE, 1, 2], [TORSO_BARE_THROW, 0, 14], [LEGS_BARE_JUMP, 0, 24]);

/** Death in boxers: a heap of bones, at the feet of a 16 x 32 cell. */
const bones = compose(16, 32, [
  [
    '......0000......',
    '.....044440.....',
    '.....040040.....',
    '.....044440.....',
    '......0440......',
    '..00...00...00..',
    '.0440000000.0440',
    '.044444444444440',
    '..00.044440..00.',
    '...0444004440...',
    '..044400004440..',
    '..0000000000000.',
  ],
  0,
  19,
]);

const prefixed = (prefix: string, frames: Record<string, string[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(frames).map(([k, v]) => [`${prefix}${k}`, v]));

export const arthurDef: SpriteDef = {
  palette: 'arthur',
  frames: {
    ...poses(ARMOUR),
    ...prefixed('boxers-', poses(BOXERS)),
    'boxers-hurt': hurt,
    bones,
  },
};

/* ---------- weapons and effects ---------- */

// Drawn pointing right here; the sheet stores the shots pointing left (as the items sheet's
// shots: a Projectile is flipped when it flies right).
const LANCE = [
  '...............0',
  '0000000000000021',
  '4444444444444222',
  '0000000000000021',
  '...............0',
];
const DAGGER = ['......00..', '0000002210', '4443222221', '0000002210', '......00..'];
const TORCH_0 = [
  '..0670..',
  '.067760.',
  '.067760.',
  '..0770..',
  '...44...',
  '...44...',
  '...44...',
  '...00...',
];
const TORCH_1 = [
  '.0760...',
  '.07760..',
  '..0776..',
  '...0770.',
  '....44..',
  '....44..',
  '...44...',
  '...00...',
];
const FLAME_0 = [
  '.......0........',
  '......070.......',
  '.....07670......',
  '....0765670.0...',
  '...076555670700.',
  '..0765515567670.',
  '..0765111556670.',
  '.07655111556670.',
  '.07655111155670.',
  '0000000000000000',
];
const FLAME_1 = [
  '........0.......',
  '..0....070......',
  '.070..07670.....',
  '.06700765670....',
  '.0767765556700..',
  '.07655551556670.',
  '0765551115556670',
  '0765511111556670',
  '0765511111556670',
  '0000000000000000',
];
const AXE_0 = [
  '....000.....',
  '...02220....',
  '..0222220...',
  '.022111220..',
  '.0221.04400.',
  '.0221..0440.',
  '..0000..044.',
  '.........04.',
  '..........0.',
  '............',
  '............',
  '............',
];
const AXE_1 = [
  '.........0..',
  '........040.',
  '...00..0440.',
  '..02200440..',
  '.022210440..',
  '.0221110....',
  '.0222220....',
  '..02220.....',
  '...000......',
  '............',
  '............',
  '............',
];
/** Armour pieces flying off on the armour hit (AR-17), steel and gold. */
const PIECE_0 = ['.000.', '01120', '01220', '.000.'];
const PIECE_1 = ['.00..', '0220.', '01120', '.000.'];
const GOLD = { '1': '5', '2': '6' };
/** Lightning (AR-19): one bolt segment, tiled down its column. */
const BOLT = [
  '.....0110.......',
  '....01510.......',
  '...01550........',
  '...0155000......',
  '..015555510.....',
  '..0000155510....',
  '......01550.....',
  '.....01510......',
  '....01510.......',
  '...01550000.....',
  '..0155555510....',
  '..00001555100...',
  '.....0155510....',
  '....015510......',
  '...01510........',
  '...0110.........',
];
/** The wind-up's spark over the raised weapon. */
const SPARK = ['...0...', '..050..', '.05150.', '0511150', '.05150.', '..050..', '...0...'];
/** A weapon pot (AR-21), rows 5-15 of its 16 x 16 frame; the weapon's icon rides on top. */
const POT = [
  '...00000000.....',
  '..0666666660....',
  '...00000000.....',
  '...04444440.....',
  '..0444444440....',
  '.044466644440...',
  '.044666664440...',
  '.044466644440...',
  '.044444444440...',
  '..0444444440....',
  '...00000000.....',
];
const ICONS: Record<string, readonly string[]> = {
  lance: ['.........0', '0000000021', '4444444222', '0000000021', '.........0'],
  dagger: ['......00..', '0000002210', '4443222221', '0000002210', '......00..'],
  torch: ['..067..', '.07760.', '..077..', '...44..', '...44..'],
  axe: ['.0220...', '022210..', '02210440', '.000.044', '......04'],
};
const pot = (icon: readonly string[]): string[] =>
  compose(16, 16, [POT, 0, 5], [icon, Math.max(0, (12 - (icon[0]?.length ?? 0)) >> 1), 0]);

const left = mirror;
const WEAPONS: Record<string, string[]> = {
  lance: left(LANCE),
  dagger: left(DAGGER),
  'lance-down': rotCw(LANCE),
  'dagger-down': rotCw(DAGGER),
  'torch-0': left(TORCH_0),
  'torch-1': left(TORCH_1),
  'axe-0': left(AXE_0),
  'axe-1': left(AXE_1),
  'axe-2': left(rot180(AXE_0)),
  'axe-3': left(rot180(AXE_1)),
};

export const arthurFxDef: SpriteDef = {
  palette: 'arthur-fx',
  frames: {
    ...WEAPONS,
    'flame-0': FLAME_0,
    'flame-1': FLAME_1,
    'piece-0': PIECE_0,
    'piece-1': PIECE_1,
    'gold-piece-0': recolor(PIECE_0, GOLD),
    'gold-piece-1': recolor(PIECE_1, GOLD),
    bolt: BOLT,
    spark: SPARK,
    'pot-lance': pot(ICONS.lance ?? []),
    'pot-dagger': pot(ICONS.dagger ?? []),
    'pot-torch': pot(ICONS.torch ?? []),
    'pot-axe': pot(ICONS.axe ?? []),
  },
};

/** The Gold armour's weapons: the same frames, in gold (AR-18). */
export const arthurGoldFxDef: SpriteDef = {
  palette: 'arthur-gold-fx',
  frames: { ...WEAPONS, 'flame-0': FLAME_0, 'flame-1': FLAME_1 },
};
