import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * The Warriors of Light, a Classic-only hero (bug-reports/2026-10-07-warriors-of-light-build-classic-character.md
 * WL-26, docs/classic/WARRIORS_OF_LIGHT.md M11): an original "four-job party" drawn here from
 * scratch, not copies of any other game's sprites. One shared body (16 x 32 cells, the figure 28 px
 * tall) with a head and an outfit per job:
 *   Fighter     plumed open helmet, tunic, sword       Thief       hood and tied bandana, face mask, dagger
 *   Black Mage  tall wide-brim hat, face in shadow      White Mage  pointed hood, zigzag trim, staff
 *               with two glowing eyes, long robe
 * Swing and cast frames are 32 px wide (the weapon reaches past the cell, as Link's and Ryu's do).
 * Frames per job (`<job>-<pose>`): stand, walk-0..3, jump, fall, crouch, swing-0..2, windup-0..1,
 * cast, hurt, die.
 *
 * Palette index roles (identical across every job so the Fire Flower outfits are plain palette swaps):
 *   0 outline   1 cloth   2 cloth shade   3 skin   4 hat / hood band   5 boots & belt
 *   6 metal light   7 metal dark   8 trim / plume   9 eye glow   a staff wood
 */
const P = (
  cloth: string,
  shade: string,
  hat: string,
  trim: string,
  skin: string = NES.skin,
  boots: string = NES.brownDark,
): string[] => [
  NES.black,
  cloth,
  shade,
  skin,
  hat,
  boots,
  NES.white,
  NES.lightGray,
  trim,
  NES.yellow,
  NES.brownLight,
];

/** The four jobs in `p.scratch.job` order, with their base and Fire Flower palettes. */
export const WARRIOR_JOB_LOOKS = [
  { job: 'fighter', palette: 'war-fighter', flower: 'war-knight' },
  { job: 'thief', palette: 'war-thief', flower: 'war-ninja' },
  { job: 'bmage', palette: 'war-bmage', flower: 'war-bwizard' },
  { job: 'wmage', palette: 'war-wmage', flower: 'war-wwizard' },
] as const;

const BASE: Record<string, string[]> = {
  // Base jobs (small and Mushroom states).
  'war-fighter': P(NES.redBright, NES.redDark, NES.brown, NES.yellow),
  'war-thief': P(NES.green, NES.greenDark, NES.tanDark, NES.orange),
  'war-bmage': P(NES.blueMid, NES.blueDark, NES.tanDark, NES.blueDark),
  'war-wmage': P(NES.white, NES.lightGray, NES.white, NES.redBright),
  // Fire Flower outfits (WL-9: Knight, Ninja, Black Wizard, White Wizard).
  'war-knight': P(NES.lightGray, NES.blueMid, NES.blueMid, NES.skyLight),
  'war-ninja': P(NES.darkGray, NES.black, NES.darkGray, NES.redBright),
  'war-bwizard': P(NES.redDark, NES.black, NES.magenta, NES.yellow),
  'war-wwizard': P(NES.white, NES.lavender, NES.lavender, NES.blueMid),
};

/** Star (and job-switch flash) colours: cloth and shade for steps 0..3. */
const STAR: readonly [string, string][] = [
  [NES.yellow, NES.redBright],
  [NES.cyan, NES.blueMid],
  [NES.pink, NES.magenta],
  [NES.white, NES.lightGray],
];

/** Spell effects: 0 outline 1 white 2 yellow 3 orange 4 red 5 ice light 6 ice 7 ice deep 8 green light 9 green. */
const FX: string[] = [
  NES.black,
  NES.white,
  NES.yellowLight,
  NES.peach,
  NES.redBright,
  NES.skyLight,
  NES.blueLight,
  NES.blueMid,
  NES.greenLight,
  NES.greenMid,
];

export const warriorsPalettes: Record<string, string[]> = {
  ...BASE,
  ...Object.fromEntries(
    Object.entries(BASE).flatMap(([name, pal]) =>
      STAR.map(([cloth, shade], i) => [
        `${name}-star-${i}`,
        pal.map((c, k) => (k === 1 ? cloth : k === 2 ? shade : k === 8 ? NES.white : c)),
      ]),
    ),
  ),
  'war-fx': FX,
  // Bolt's second look (white core, yellow rim) for its flicker; Reduce flashing keeps 'war-fx'.
  'war-fx-alt': FX.map((c, k) => (k === 1 ? NES.yellowLight : k === 2 ? NES.white : c)),
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

type Layer = [readonly string[], number, number];
const compose = (w: number, h: number, ...layers: Layer[]): string[] =>
  layers.reduce<string[]>((acc, [rows, dx, dy]) => paste(acc, rows, dx, dy), blank(w, h));

/** Rotate a block a quarter turn anticlockwise (for the raised weapon). */
const rotateCCW = (rows: readonly string[]): string[] => {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return Array.from({ length: w }, (_, y) =>
    Array.from({ length: h }, (_, x) => (rows[x] as string)[w - 1 - y] ?? '.').join(''),
  );
};

/** Turn a block upside down (the sword pointing down in the follow-through). */
const flipV = (rows: readonly string[]): string[] => [...rows].reverse();

/* ---------- heads (facing right, bottom row lands on row 13) ---------- */

const headFighter = [
  '......0000......',
  '.....088880.....',
  '....00088000....',
  '...066666660....',
  '..06666666660...',
  '..07777777770...',
  '..07333330330...',
  '...0333333330...',
  '....03333330....',
  '.....000000.....',
];
const headThief = [
  '................',
  '.....000000.....',
  '....01111110....',
  '...0111111110...',
  '.0.0111111110...',
  '0804444444440...',
  '.0.0333303330...',
  '...0333333330...',
  '....02222220....',
  '.....000000.....',
];
const headBlackMage = [
  '.....00.........',
  '....0440........',
  '....04440.......',
  '...0444440......',
  '...04444440.....',
  '..0444444440....',
  '.04444444444440.',
  '..000000000000..',
  '...0000990990...',
  '...0000000000...',
  '....00000000....',
];
const headWhiteMage = [
  '.......00.......',
  '......0110......',
  '.....011110.....',
  '....01111110....',
  '...0111111110...',
  '..01111188880...',
  '..01111033030...',
  '..01111033330...',
  '..0111110330....',
  '...000000000....',
];

/** The same heads with the eyes squeezed shut (hurt and die): the Black Mage's glow dims. */
const shut = (head: readonly string[]): string[] =>
  head.map((r) => r.replace(/(?<=3)0(?=3)/g, '2').replace(/9/g, '8'));

/* ---------- bodies ---------- */

// Torso with both arms at the sides, 8 rows (rows 14..21).
const torsoArms = [
  '....00000000....',
  '...0111111110...',
  '..011111111110..',
  '..011111111110..',
  '..011011110110..',
  '..012011110210..',
  '..033055550330..',
  '...0022222200...',
];
// Torso with the arms left off, for poses that paste their own arms.
const torsoBare = [
  '....00000000....',
  '....01111110....',
  '....01111110....',
  '....01111110....',
  '....01111110....',
  '....01111110....',
  '....05555550....',
  '...0022222200...',
];
// One leg with its boot, 9 rows (rows 23..31); the boot points forward (right).
const leg = ['0220.', '0220.', '0220.', '0220.', '0220.', '05500', '05550', '05550', '00000'];
const legBent = ['0220.', '02200', '.0220', '.0220', '05550', '05550', '00000'];
// The rear leg lifting off: knee bent back, toe down.
const legLift = ['0220.', '0220.', '00220', '.0550', '.0550', '.000.'];
// A mage's robe skirt, 10 rows (rows 22..31), hem in the trim colour.
const skirt = (feet: string): string[] => [
  '...0111111110...',
  '..011111111110..',
  '..011111111110..',
  '..011111111110..',
  '.01111111111110.',
  '.01111111111110.',
  '.01111111111110.',
  '.08888888888880.',
  feet,
  '..000000000000..'.replace(/0/g, (m, i: number) => (feet[i] === '.' ? '.' : m)),
];
const SKIRT_STAND = skirt('..0550000550....');
const SKIRT_WALK = [
  skirt('.0550.....05500.'),
  skirt('....05505500....'),
  skirt('..0550...0550...'),
  skirt('.....0550550....'),
];
const SKIRT_JUMP = skirt('................');

/* ---------- arms and weapons ---------- */

const armForward = ['00000..', '011100.', '0111330', '000000.'];
const armUp = ['.00.', '0330', '0110', '0110', '0110', '0110', '.00.'];
// An arm thrown back (hurt): elbow out behind the body.
const armBack = ['.000.', '01110', '01110', '0330.', '.00..'];
const fighterBlade = [
  '.00.............',
  '0880000000000...',
  '0886666666666000',
  '0887777777777770',
  '.00000000000000.',
];
const thiefDagger = ['.00......', '08800000.', '088666660', '088777700', '.000000..'];
const staff = [
  '...........000.',
  '..........01110',
  '0000000000011110',
  '0aaaaaaaaaa1110',
  '00000000000000.',
].map((r) => r.padEnd(16, '.'));
const sparkle = ['..2..', '.222.', '22122', '.222.', '..2..'].map((r) =>
  r.replace(/2/g, '8').replace(/1/g, '6'),
);
const sparkleSmall = ['.8.', '868', '.8.'];

/* ---------- frames ---------- */

type Job = 'fighter' | 'thief' | 'bmage' | 'wmage';
const HEADS: Record<Job, string[]> = {
  fighter: headFighter,
  thief: headThief,
  bmage: headBlackMage,
  wmage: headWhiteMage,
};
const robed = (job: Job): boolean => job === 'bmage' || job === 'wmage';
const weaponOf = (job: Job): string[] | null =>
  job === 'fighter' ? fighterBlade : job === 'thief' ? thiefDagger : job === 'wmage' ? staff : null;

const W = 16;
const WW = 32;
const H = 32;
const headAt = (job: Job, bottom: number, dx = 0, eyes = false): Layer => {
  const h = eyes ? shut(HEADS[job]) : HEADS[job];
  return [h, dx, bottom - h.length + 1];
};

type LowerPose = 'stand' | 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'jump' | 'apart';
function lower(job: Job, pose: LowerPose): Layer[] {
  if (robed(job)) {
    const s =
      pose === 'stand'
        ? SKIRT_STAND
        : pose === 'jump'
          ? SKIRT_JUMP
          : pose === 'apart'
            ? (SKIRT_WALK[0] as string[])
            : (SKIRT_WALK[Number(pose.slice(4))] as string[]);
    return [[s, 0, 22]];
  }
  switch (pose) {
    case 'stand':
      return [
        [leg, 4, 23],
        [leg, 8, 23],
      ];
    case 'walk0':
    case 'apart':
      return [
        [leg, 2, 23],
        [leg, 10, 23],
      ];
    case 'walk1':
      return [
        [legBent, 4, 25],
        [leg, 7, 23],
      ];
    case 'walk2':
      return [
        [legLift, 3, 23],
        [leg, 8, 23],
      ];
    case 'walk3':
      return [
        [leg, 5, 23],
        [legBent, 8, 25],
      ];
    case 'jump':
      return [
        [legBent, 3, 22],
        [legBent, 9, 21],
      ];
  }
}

function jobFrames(job: Job): Record<string, string[]> {
  // Robes have no belt (the White Mage's) or a dark sash (the Black Mage's).
  const belt = (r: string, i: number) => (i === 6 ? r.replace(/5/g, job === 'bmage' ? '5' : '1') : r);
  const torso = robed(job) ? torsoArms.map(belt) : torsoArms;
  const bare = robed(job) ? torsoBare.map(belt) : torsoBare;
  const stand = compose(W, H, ...lower(job, 'stand'), [torso, 0, 14], headAt(job, 13));
  // Walk: four steps, the body one pixel lower on the passing steps (1 and 3).
  const walk = (['walk0', 'walk1', 'walk2', 'walk3'] as const).map((pose, i) =>
    compose(W, H, ...lower(job, pose), [torso, 0, 14 + (i & 1)], headAt(job, 13 + (i & 1))),
  );
  const jump = compose(
    W,
    H,
    ...lower(job, 'jump'),
    [bare, 0, 13],
    headAt(job, 12),
    [armUp, 11, 8],
    [armUp, 1, 10],
  );
  // Falling: arms out to the sides, legs hanging.
  const fall = compose(
    W,
    H,
    ...lower(job, 'apart'),
    [bare, 0, 14],
    headAt(job, 13),
    [armForward, 10, 14],
    [armBack, 0, 14],
  );
  const crouch = compose(
    W,
    H,
    [robed(job) ? SKIRT_STAND.slice(4) : ['...0022222200...', ...legBent], 0, 32 - (robed(job) ? 6 : 8)],
    [torso.slice(0, 6), 0, 20],
    headAt(job, 19),
  );
  const weapon = weaponOf(job);
  const weaponLayers = (rows: string[], dx: number, dy: number): Layer[] => (weapon ? [[rows, dx, dy]] : []);
  // Swing: 0 = weapon raised behind the head, 1 = the slash level with the shoulders,
  // 2 = the follow-through, pointing down and ahead.
  const swing0 = compose(
    WW,
    H,
    ...lower(job, 'stand'),
    [bare, 0, 14],
    headAt(job, 13),
    [armUp, 11, 8],
    ...(weapon ? weaponLayers(rotateCCW(weapon), 10, 8 - weapon[0]!.length + 4) : []),
  );
  const swing1 = compose(
    WW,
    H,
    ...lower(job, 'walk0'),
    [bare, 0, 14],
    headAt(job, 13),
    [armForward, 10, 15],
    ...(weapon ? weaponLayers(weapon, 15, 14) : []),
  );
  const swing2 = compose(
    WW,
    H,
    ...lower(job, 'walk0'),
    [bare, 0, 15],
    headAt(job, 14),
    [armForward, 10, 18],
    ...(weapon ? weaponLayers(flipV(weapon), 15, 18) : []),
  );
  const windup = (flip: boolean) =>
    compose(
      W,
      H,
      ...lower(job, 'stand'),
      [bare, 0, 14],
      headAt(job, 13),
      [armUp, 11, 8],
      [armUp, 1, 8],
      [flip ? sparkleSmall : sparkle, flip ? 12 : 11, flip ? 5 : 4],
      [flip ? sparkle : sparkleSmall, flip ? 0 : 1, flip ? 4 : 5],
    );
  const cast = compose(WW, H, ...lower(job, 'walk0'), [bare, 0, 14], headAt(job, 13), [armForward, 10, 16]);
  // Hurt: thrown back, eyes shut, arms flung out.
  const hurt = compose(
    W,
    H,
    ...lower(job, 'apart'),
    [bare, -1, 15],
    headAt(job, 14, -1, true),
    [armBack, 10, 12],
    [armBack, -1, 15],
  );
  // Die: facing the screen, both arms thrown up, eyes shut (the death hop's pose).
  const die = compose(
    W,
    H,
    ...lower(job, 'stand'),
    [bare, 0, 14],
    headAt(job, 13, 0, true),
    [armUp, 12, 7],
    [armUp, 0, 7],
  );
  const f: Record<string, string[]> = {
    [`${job}-stand`]: stand,
    [`${job}-jump`]: jump,
    [`${job}-fall`]: fall,
    [`${job}-crouch`]: crouch,
    [`${job}-swing-0`]: swing0,
    [`${job}-swing-1`]: swing1,
    [`${job}-swing-2`]: swing2,
    [`${job}-windup-0`]: windup(false),
    [`${job}-windup-1`]: windup(true),
    [`${job}-cast`]: cast,
    [`${job}-hurt`]: hurt,
    [`${job}-die`]: die,
  };
  walk.forEach((rows, i) => (f[`${job}-walk-${i}`] = rows));
  return f;
}

export const warriorsDef: SpriteDef = {
  palette: 'war-fighter',
  frames: {
    ...jobFrames('fighter'),
    ...jobFrames('thief'),
    ...jobFrames('bmage'),
    ...jobFrames('wmage'),
  },
};

/* ---------- spells (palette war-fx) ---------- */

const fire0 = [
  '................',
  '.........0000...',
  '......0004433 0.',
  '...00344333320..',
  '.0034433322221 0',
  '0344333222211110',
  '.0034433322221 0',
  '...00344333320..',
  '......0004433 0.',
  '.........0000...',
  '................',
  '................',
].map((r) => r.replace(/ /g, '0').padEnd(16, '.').slice(0, 16));
const fire1 = fire0.map((r) => r.replace(/4/g, '#').replace(/3/g, '4').replace(/#/g, '3'));
// The third flame: the tail flicks down a row.
const fire2 = [fire0[11] as string, ...fire0.slice(0, 11)];

/** Ice burst, 48x48: a ring of shards around a pale core, grown over its frames (WL-14: one 48x48 burst). */
const iceBurst = (scale: number): string[] =>
  Array.from({ length: 48 }, (_, y) =>
    Array.from({ length: 48 }, (_, x) => {
      const dx = x - 23.5;
      const dy = y - 23.5;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const spike = Math.abs(Math.cos(a * 4)) ** 6 * 10 + Math.abs(Math.cos(a * 4 + Math.PI / 4)) ** 8 * 5;
      const r = (12 + spike) * scale;
      if (d > r) return '.';
      if (d > r - 1.2) return '0';
      if (d < r * 0.3) return '1';
      if (d < r * 0.55) return '5';
      return (Math.floor(x / 3) + Math.floor(y / 3)) % 3 === 0 ? '7' : '6';
    }).join(''),
  );

// Bolt column segment, 24x16, tiled down the whole screen height (WL-14: 27 px wide column).
const bolt = [
  '.........0000...........',
  '........022220..........',
  '.......0221220..........',
  '......022112 0..........',
  '.....0221122220.........',
  '....02211111220.........',
  '.....0222211220.........',
  '......0002112 0.........',
  '.........021120.........',
  '........0221220.........',
  '.......02211220.........',
  '......0221122220........',
  '.....022111111220.......',
  '......02222111220.......',
  '.......000022220........',
  '..........0000..........',
].map((r) => r.replace(/ /g, '0'));

const cure0 = [
  '................',
  '...8............',
  '..898.......8...',
  '...8.......898..',
  '............8...',
  '......8.........',
  '.....898........',
  '....89198.......',
  '.....898....8...',
  '......8....898..',
  '............8...',
  '..8.............',
  '.898.....8......',
  '..8.....898.....',
  '.........8......',
  '................',
];
const cure1 = cure0.map((r) => r.split('').reverse().join(''));

export const warriorsFxDef: SpriteDef = {
  palette: 'war-fx',
  frames: {
    'fire-0': fire0,
    'fire-1': fire1,
    'fire-2': fire2,
    'ice-0': iceBurst(0.45),
    'ice-1': iceBurst(0.7),
    'ice-2': iceBurst(0.9),
    'ice-3': iceBurst(1),
    'ice-4': iceBurst(0.85),
    bolt,
    'cure-0': cure0,
    'cure-1': cure1,
  },
};
