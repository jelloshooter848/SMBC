import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * DESIGN MOCKUP ONLY (bug-reports/2026-10-19-arthur-build-classic-character.md, AR-). Not registered in the
 * game: nothing under src/ imports this file. It feeds the storyboard renderer
 * (tools/mockups/classic/render.mjs) so the owner can approve the look before the hero is built.
 *
 * Original drafts of Sir Arthur in his Ghosts 'n Goblins role, drawn from scratch at SMB scale. One body,
 * 16x32 cells (figure 28 px tall), the same size in armour and in his boxers (no grow or shrink). Facing
 * right. Steel armour (Mushroom), Gold armour (Fire Flower: a palette swap of the steel frames), boxers
 * (small: bare chest, white shorts with red hearts).
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

export const arthurPalettes: Record<string, string[]> = {
  arthur: P(NES.lightGray, NES.gray),
  'arthur-gold': P(NES.yellow, NES.orange, NES.yellowLight),
};

/** Weapons and effects: 0 outline 1 white 2 light grey 3 grey 4 brown 5 yellow 6 orange 7 red 8 sky 9 blue. */
export const arthurFxPalette: string[] = [
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

const armour = (chest: readonly string[], legs: readonly string[], dy = 0): string[] =>
  compose(16, 32, [HELM, 0, dy], [chest, 0, 12 + dy], [legs, 0, 22 + dy]);

const stand = armour(CHEST, LEGS_STAND);
const walk0 = armour(CHEST, LEGS_WALK0);
const walk1 = armour(CHEST, LEGS_WALK1);
const jump = armour(CHEST, LEGS_JUMP);
const throwPose = armour(CHEST_THROW, LEGS_WALK1);
/** Crouch: the body lowered 9 px, knees out (hitbox 12x16, AR-3). */
const crouch = compose(
  16,
  32,
  [HELM, 0, 9],
  [CHEST.slice(0, 7), 0, 21],
  [['...0222002220...', '..08880008880...', '..08880008880...', '..00000000000...'], 0, 28],
);
const crouchThrow = compose(
  16,
  32,
  [HELM, 0, 9],
  [CHEST_THROW.slice(0, 7), 0, 21],
  [['...0222002220...', '..08880008880...', '..08880008880...', '..00000000000...'], 0, 28],
);

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
const LEGS_BARE_WALK = [
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
const boxers = (torso: readonly string[], legs: readonly string[]): string[] =>
  compose(16, 32, [HEAD_BARE, 0, 0], [torso, 0, 12], [legs, 0, 22]);

const bStand = boxers(TORSO_BARE, LEGS_BARE);
const bWalk = boxers(TORSO_BARE, LEGS_BARE_WALK);
const bJump = boxers(TORSO_BARE, LEGS_BARE_JUMP);
const bThrow = boxers(TORSO_BARE_THROW, LEGS_BARE);
/** The armour hit: knocked back, arms up, the armour bursting off (pieces are separate fx sprites). */
const bHurt = compose(16, 32, [HEAD_BARE, 1, 2], [TORSO_BARE_THROW, 0, 14], [LEGS_BARE_JUMP, 0, 24]);

/** Death in boxers: a heap of bones (16x16). */
const bones = [
  '................',
  '................',
  '................',
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
  '................',
];

export const arthurDef: SpriteDef = {
  palette: 'arthur',
  frames: {
    stand,
    'walk-0': walk0,
    'walk-1': walk1,
    jump,
    throw: throwPose,
    crouch,
    'crouch-throw': crouchThrow,
    'boxers-stand': bStand,
    'boxers-walk': bWalk,
    'boxers-jump': bJump,
    'boxers-throw': bThrow,
    'boxers-hurt': bHurt,
    bones,
  },
};

/* ---------- weapons and effects ---------- */

const lance = ['...............0', '0000000000000021', '4444444444444222', '0000000000000021', '...............0'];
const dagger = ['......00..', '0000002210', '4443222221', '0000002210', '......00..'];
const torch0 = ['..0670..', '.067760.', '.067760.', '..0770..', '...44...', '...44...', '...44...', '...00...'];
const torch1 = ['.0760...', '.07760..', '..0776..', '...0770.', '....44..', '....44..', '...44...', '...00...'];
const flame0 = [
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
const flame1 = [
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
const axe0 = [
  '....000.....',
  '...02220....',
  '..0222220...',
  '.022111220..',
  '.0221.04400.',
  '.0221..0440.',
  '..0000..044.',
  '.........04.',
  '..........0.',
];
const axe1 = [
  '.........0..',
  '........040.',
  '...00..0440.',
  '..02200440..',
  '.022210440..',
  '.0221110....',
  '.0222220....',
  '..02220.....',
  '...000......',
];
/** Steel armour pieces flying off on the armour hit (AR-17). */
const piece0 = ['.000.', '01120', '01220', '.000.'];
const piece1 = ['.00..', '0220.', '01120', '.000.'];
/** Gold armour magic (AR-24): one bolt segment, stacked by the storyboard. */
const bolt = [
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
/** A weapon pot dropped by a defeated enemy (AR-21); the icon of the weapon rides on top. */
const pot = [
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

export const arthurFxDef: SpriteDef = {
  palette: 'arthur-fx',
  frames: {
    lance,
    dagger,
    'torch-0': torch0,
    'torch-1': torch1,
    'flame-0': flame0,
    'flame-1': flame1,
    'axe-0': axe0,
    'axe-1': axe1,
    'piece-0': piece0,
    'piece-1': piece1,
    bolt,
    pot,
  },
};
