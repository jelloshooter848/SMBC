import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { swapColors } from '@engine/gfx/pixelart';

/*
 * The heroes' own pickup items (docs/POWERUPS.md 11): one 16 × 16 frame per item, named by its id
 * (src/game/items/catalog.ts), drawn rising from the block, lying on it, in the inventory panel and
 * on chests. All original pixel art, each set in its hero's own game's look, NES colours, and still
 * frames only (nothing flashes).
 *
 * Palette roles:
 *   0 outline   1 white      2 red         3 dark red     4 orange      5 gold
 *   6 pale gold 7 green      8 lime        9 dark green   a sky blue    b blue
 *   c deep blue d light grey e grey        f dark grey    g brown       h dark brown
 *   i parchment j pink       k violet      l magenta      m cyan        n crimson
 *   o tan       p peach
 */
export const heroItemPalettes: Record<string, string[]> = {
  'hero-items': [
    NES.black,
    NES.white,
    NES.redBright,
    NES.redDark,
    NES.orange,
    NES.yellow,
    NES.yellowLight,
    NES.green,
    NES.greenLight,
    NES.greenDark,
    NES.blueLight,
    NES.blueMid,
    NES.blueDark,
    NES.lightGray,
    NES.gray,
    NES.darkGray,
    NES.brown,
    NES.brownDark,
    NES.tan,
    NES.pink,
    NES.purple,
    NES.magenta,
    NES.cyan,
    NES.red,
    NES.tanDark,
    NES.peach,
  ],
};

const SIZE = 16;

/** `rows` padded to equal width and centred in a 16 × 16 frame (bottom-heavy art sits a row low). */
function frame(rows: readonly string[]): string[] {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (w > SIZE || rows.length > SIZE) throw new Error(`hero item art over ${SIZE} × ${SIZE}`);
  const left = (SIZE - w) >> 1;
  const top = (SIZE - rows.length + 1) >> 1;
  const blank = '.'.repeat(SIZE);
  const out: string[] = [];
  for (let y = 0; y < SIZE; y++) {
    const r = rows[y - top];
    out.push(r === undefined ? blank : ('.'.repeat(left) + r.padEnd(w, '.')).padEnd(SIZE, '.'));
  }
  return out;
}

/** `glyph` drawn over `base` with its top-left at (x, y); `.` in the glyph leaves the base. */
function overlay(base: readonly string[], glyph: readonly string[], x: number, y: number): string[] {
  return base.map((row, ry) => {
    const g = glyph[ry - y];
    if (g === undefined) return row;
    return [...row]
      .map((c, rx) => (rx >= x && rx - x < g.length && g[rx - x] !== '.' ? g[rx - x] : c))
      .join('');
  });
}

/* ---------- Link (Zelda II): heart, bag, ring, sword, spell scrolls ---------- */

const heartContainer = frame([
  '..000...000..',
  '.02220.02220.',
  '0211220222220',
  '0212222222220',
  '0222222222220',
  '0222222222230',
  '.02222222230',
  '..022222230',
  '...0222230',
  '....02230',
  '.....030',
  '......0',
]);

const bombBag = frame([
  '....0000',
  '...0bbbb0',
  '...0b1bb0',
  '..00000000',
  '.0hgggggh0',
  '..0hhhhh0',
  '.0ggggggg0',
  '0gggigggggg0',
  '0ggiiggggggg0',
  '0gggggggggggg0',
  '0ggggggggggggh0',
  '.0gggggggggh0',
  '..0hhhhhhhhh0',
  '...000000000',
]);

const blueRing = frame([
  '....0000',
  '...0a11a0',
  '..00abba00',
  '.0bb0000bb0',
  '0b0......0b0',
  '0b0......0b0',
  '0b0......0b0',
  '0c0......0c0',
  '.0cc0000cc0',
  '..00cccc00',
  '....0000',
]);

const magicalSword = frame([
  '...00',
  '..0110',
  '..01a0',
  '..01a0',
  '..01a0',
  '..01a0',
  '..01a0',
  '..01a0',
  '00000000',
  '05555550',
  '00000000',
  '..0hh0',
  '..0hh0',
  '..0550',
  '...00',
]);

const SCROLL = frame([
  '.00..........00.',
  '0hh0000000000hh0',
  '0hhiiiiiiiiiihh0',
  '0ghiiiiiiiiiihg0',
  '0ghiiiiiiiiiihg0',
  '0ghiiiiiiiiiihg0',
  '0ghiiiiiiiiiihg0',
  '0ghiiiiiiiiiihg0',
  '0ghiiiiiiiiiihg0',
  '0hhiiiiiiiiiihh0',
  '0hh0000000000hh0',
  '.00..........00.',
]);
/** A spell: Zelda II's scroll with the spell's sign on it. */
const spell = (glyph: readonly string[]): string[] => overlay(SCROLL, glyph, 4, 5);

const shieldSpell = spell(['..bbbb..', '.baaaab.', '.ba11ab.', '.baaaab.', '..baab..', '...bb...']);
const jumpSpell = spell(['...77...', '..7777..', '.777777.', '...77...', '...77...', '...77...']);
const fireSpell = spell(['...4....', '..424...', '..4254..', '.425524.', '.455554.', '..4444..']);

/* ---------- Mega Man: the helmet and weapon capsules ---------- */

const helmet = frame([
  '.....0000',
  '...00aaaa00',
  '..0a11aaaaa0',
  '.0a1aaaaaaaa0',
  '.0aaaaaaaaaa0',
  '0bb00000000bb0',
  '0bb0ffffff0bb0',
  '0bbb0ffff0bbb0',
  '0bbb0ffff0bbb0',
  '.0bb0ffff0bb0',
  '..00.0000.00',
]);

const CAPSULE = frame([
  '..00000000',
  '.0AAAAAAAA0',
  '0A11AAAAAAB0',
  '0A1AAAAAAAB0',
  '0AAAAAAAAAB0',
  '000000000000',
  '0CCCCCCCCCC0',
  '0C11CCCCCCD0',
  '0CCCCCCCCCD0',
  '0CCCCCCCCCD0',
  '.0DDDDDDDD0',
  '..00000000',
]);
/** A weapon capsule in the weapon's colours (top `a`/`b`, bottom `c`/`d`), its sign in the middle. */
const capsule = (a: string, b: string, c: string, d: string, sign: readonly string[]): string[] =>
  overlay(swapColors(CAPSULE, { A: a, B: b, C: c, D: d }), sign, 6, 4);

const sawDisc = capsule('d', 'e', 'e', 'f', ['.00.', '0110', '0110', '.00.']);
const leafGuard = capsule('8', '7', '7', '9', ['..0.', '.080', '0870', '.0..']);
const rushCoil = capsule('2', '3', 'd', 'e', ['0000', '0110', '0000', '0110']);
const flameWave = capsule('5', '4', '4', '3', ['.0..', '050.', '0550', '0440']);
const homingKnuckle = capsule('j', 'k', 'k', 'l', ['0000', '0jj0', '0jj0', '.00.']);
const bolt = capsule('6', '5', '5', 'g', ['..00', '.050', '050.', '00..']);

/* ---------- Samus (Metroid): the energy tank and item spheres ---------- */

const energyTank = frame([
  '000000000000',
  '0kkkkkkkkkk0',
  '0k11kkkkkkl0',
  '0k1kkkkkkkl0',
  '0kkk0000kkl0',
  '0kkk0jj0kkl0',
  '0kkk0jj0kkl0',
  '0kkk0000kkl0',
  '0kkkkkkkkkl0',
  '0llllllllll0',
  '000000000000',
]);

const SPHERE = frame([
  '....000000',
  '..00pppppp00',
  '.0pp000000pp0',
  '.0p00000000p0',
  '0p0000000000p0',
  '0p0000000000p0',
  '0p0000000000p0',
  '0p0000000000p0',
  '.0p00000000p0',
  '.0pp000000pp0',
  '..00pppppp00',
  '....000000',
]);
/** Metroid's item sphere with the item's sign inside. */
const sphere = (sign: readonly string[]): string[] => overlay(SPHERE, sign, 4, 4);

const missiles = sphere(['...11...', '..1221..', '..1dd1..', '..1dd1..', '.1d22d1.', '.22..22.']);
const longBeam = sphere(['......', '....6.', '666666', '555555', '....5.', '......'].map((r) => `.${r}.`));
const iceBeam = sphere(['...a...', '.a.a.a.', '..a1a..', 'aa111aa', '..a1a..', '.a.a.a.', '...a...']);
const variaSuit = sphere(['5......5', '55....55', '.55..55.', '..5555..', '...55...']);
const waveBeam = sphere(['.ll...ll', 'l..l.l..', '....l...', '........', '.jj...jj', 'j..j.j..', '....j...']);

/* ---------- Simon (Castlevania): roast, whips, sub-weapons, shot charms ---------- */

const potRoast = frame([
  '....0000',
  '..00gggg00',
  '.0googggggg0',
  '0goggggggggh0',
  '0gggggggggh0',
  '01hhhhhhhhhh10',
  '0111111111111110',
  '.01111111111110',
  '..000000000000',
]);

const chainWhip = frame([
  '...000000',
  '.00dedede00',
  '0ed000000de0',
  'd0........0d',
  'e0........0e',
  'd0........0d',
  '0ed0....0de0',
  '.00de00ed00',
  '...0hh0',
  '...0hh0',
  '...0hh0',
  '....00',
]);

const morningStar = overlay(chainWhip, ['.0d0.', '0ddd0', 'd010d', '0ddd0', '.0d0.'], 9, 0);

const dagger = frame(['..........00', '0000000000110', '0hh05dddddd1110', '0hh05eeeeeeee0', '0000000000000']);

const holyWater = frame([
  '...00',
  '...0h0',
  '..0dd0',
  '..0aa0',
  '.0aaaa0',
  '0aa11aa0',
  '0a1aaab0',
  '0aaaaab0',
  '.0bbbb0',
  '..0000',
]);

const axe = frame([
  '.....0000',
  '...00dddd0',
  '..0d11ddde0',
  '..0d1dddee0',
  '...0dddee0',
  '....00ee0h0',
  '......00hh0',
  '.......0hh0',
  '......0hh0',
  '.....0hh0',
  '....0hh0',
  '...0hh0',
  '...000',
]);

const cross = frame([
  '....000',
  '....0b0',
  '....0b0',
  '0000010000',
  '0bbbb1bbbb0',
  '0000010000',
  '....0b0',
  '....0b0',
  '....0c0',
  '....000',
]);

const stopwatch = frame([
  '....00',
  '...0550',
  '..000000',
  '.05555550',
  '0511111150',
  '0511011150',
  '0511011150',
  '0511000150',
  '0511111150',
  '.05111150',
  '..055550',
  '...0000',
]);

/** Castlevania's double / triple charm: a red tile with the roman numeral. */
const CHARM = frame([
  '000000000000',
  '022222222223',
  '021222222223',
  '022222222223',
  '022222222223',
  '022222222223',
  '022222222223',
  '022222222223',
  '022222222223',
  '033333333333',
  '000000000000',
]);
const doubleShot = overlay(CHARM, ['1.1', '1.1', '1.1', '1.1', '1.1', '1.1'], 6, 5);
const tripleShot = overlay(CHARM, ['1.1.1', '1.1.1', '1.1.1', '1.1.1', '1.1.1', '1.1.1'], 5, 5);

/* ---------- Ryu (Ninja Gaiden): medicine, stars, scroll, arts ---------- */

const medicine = frame([
  '...0000',
  '...0hh0',
  '..000000',
  '.0iiiiii0',
  '0iiiiiiii0',
  '0ii2222ii0',
  '0ii2112ii0',
  '0ii2222ii0',
  '0iiiiiiio0',
  '.0ooooo00',
  '..000000',
]);

const throwingStar = frame([
  '.....00',
  '....0d0',
  '....0d0',
  '...0de0',
  '0000d1d0000',
  '0dd11011dd0',
  '0000d1d0000',
  '...0ed0',
  '....0d0',
  '....0d0',
  '.....00',
]);

const ninpoScroll = frame([
  '00........00',
  '0n00000000n0',
  '0nooooooooon0',
  '0no2o2o2oon0',
  '0nooooooooon0',
  '0no2o2o2oon0',
  '0nooooooooon0',
  '0n00000000n0',
  '00........00',
]);

const windmill = frame([
  '000.....',
  '0dd0....',
  '.0dd0..000',
  '..0de00dd0',
  '...0e1edd0',
  '...0e1e0',
  '0dd0e1e0',
  '0ddedd0..',
  '.000..0dd0',
  '.......0dd0',
  '........000',
]);

const fireWheel = frame([
  '....0440',
  '..04555440',
  '.0450..0540',
  '0450....0540',
  '040......040',
  '040......040',
  '0450....0540',
  '.0450..0540',
  '..04555440',
  '....0440',
]);

const jumpSlash = frame([
  '......00000',
  '....00111110',
  '...011000000',
  '..010',
  '.010...0',
  '.010..0d0',
  '010..0d0',
  '010.0d0',
  '.00hd0',
  '..0h0',
  '.0h0',
  '..0',
]);

/* ---------- Bill (Contra): the medal and the falcon capsules ---------- */

const medal = frame([
  '.0000.0000',
  '.0220.0bb0',
  '..0220bb0',
  '...02bb0',
  '...00000',
  '..0555550',
  '.055665550',
  '.056555550',
  '.055555550',
  '.055555540',
  '..0555440',
  '...00000',
]);

const FALCON = frame([
  '00............00',
  '0200........0020',
  '02200......00220',
  '0222000000002220',
  '.02221111112220.',
  '..022111111220..',
  '...0111111110...',
  '...0111111110...',
  '...0111111110...',
  '...0111111110...',
  '...0111111110...',
  '....01111110....',
  '.....0n00n0.....',
  '......0..0......',
]);
/** Contra's falcon with its letter. */
const falcon = (letter: readonly string[]): string[] => overlay(FALCON, letter, 5, 7);

const machineGun = falcon(['2...2', '22.22', '2.2.2', '2...2', '2...2']);
const laser = falcon(['2....', '2....', '2....', '2....', '22222']);
const flameGun = falcon(['22222', '2....', '2222.', '2....', '2....']);
const spreadGun = falcon(['.2222', '2....', '.222.', '....2', '2222.']);

/* ---------- Sophia III (Blaster Master): capsules ---------- */

const POD = frame([
  '...000000',
  '.00kkkkkk00',
  '0kk11kkkkkkl0',
  '0k1kkkkkkkkl0',
  '0kkkkkkkkkkl0',
  '0kkkkkkkkkkl0',
  '0kkkkkkkkkkl0',
  '0kkkkkkkkkkl0',
  '0kkkkkkkkkkl0',
  '.0llkkkkkll0',
  '..00llllll00',
  '....000000',
]);
/** Blaster Master's power-up pod with its sign. */
const pod = (sign: readonly string[]): string[] => overlay(POD, sign, 5, 4);

const powerCapsule = pod(['1111.', '1...1', '1111.', '1....', '1....']);
const crusher = pod(['.1111', '1....', '1....', '1....', '.1111']);
const wallClimb = pod(['1...1', '1...1', '1.1.1', '1.1.1', '.1.1.']);
const ceilingClimb = pod(['11111', '..1..', '.111.', '1.1.1', '..1..']);
const tripleMissile = pod(['1111.', '....1', '.111.', '....1', '1111.']);
const homingMissile = pod(['.111.', '1...1', '1.1.1', '1...1', '.111.']);

export const heroItemsDef: SpriteDef = {
  palette: 'hero-items',
  frames: {
    'heart-container': heartContainer,
    'bomb-bag': bombBag,
    'shield-spell': shieldSpell,
    'jump-spell': jumpSpell,
    'blue-ring': blueRing,
    'fire-spell': fireSpell,
    'magical-sword': magicalSword,
    helmet,
    'saw-disc': sawDisc,
    'leaf-guard': leafGuard,
    'rush-coil': rushCoil,
    'flame-wave': flameWave,
    'homing-knuckle': homingKnuckle,
    bolt,
    'energy-tank': energyTank,
    missiles,
    'long-beam': longBeam,
    'ice-beam': iceBeam,
    'varia-suit': variaSuit,
    'wave-beam': waveBeam,
    'pot-roast': potRoast,
    'chain-whip': chainWhip,
    dagger,
    'holy-water': holyWater,
    axe,
    'morning-star': morningStar,
    cross,
    'double-shot': doubleShot,
    stopwatch,
    'triple-shot': tripleShot,
    medicine,
    'throwing-star': throwingStar,
    'ninpo-scroll': ninpoScroll,
    windmill,
    'fire-wheel': fireWheel,
    'jump-slash': jumpSlash,
    medal,
    'machine-gun': machineGun,
    laser,
    'flame-gun': flameGun,
    'spread-gun': spreadGun,
    'power-capsule': powerCapsule,
    crusher,
    'wall-climb': wallClimb,
    'ceiling-climb': ceilingClimb,
    'triple-missile': tripleMissile,
    'homing-missile': homingMissile,
  },
};
