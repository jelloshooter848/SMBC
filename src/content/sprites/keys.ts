import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Keys and locked doors (0.4.52, owner-approved art; docs/STORY.md "Simon's way in"): original art
 * drawn here as text rows, a round bow with a slot, a short shaft and two teeth in the spirit of a
 * classic key; nothing is traced.
 *
 * - `key` (16x16): the key in a room (entities/objects/keys.ts), resting on its bottom row.
 * - `key-icon` (8x8): the HUD's key while a player carries it (hud/hud.ts).
 * - `padlock` (8x8): hung on a locked door or gate; it drops when the key turns.
 * - `portcullis` (16x32): 5-1's crypt gate, iron bars on its bottom row; raised, it is hidden in
 *   the wall above the doorway (`portcullis-<n>`: its bottom n rows, as it rises or drops).
 *
 * - `hatch-shut` / `hatch-open` (32x16, 0.4.54): 8-1's riveted steel blast hatch with hazard
 *   stripes over Sophia III's hole, flush with the ground (entities/objects/keys.ts LockedHatch).
 *   Shut it is solid ground (the map's own); open, only in her sighting, its plates slide into
 *   the edges over a black shaft.
 *
 * `keys` index roles: 0 outline, 1 gold, 2 dark gold, 3 highlight, 4 iron light, 5 iron dark;
 * (0.4.54, the hatch) 6 light steel, 7 steel, 8 dark steel, 9 hazard yellow.
 */
export const keysPalettes: Record<string, string[]> = {
  keys: [
    '#000000',
    '#f8b800',
    '#c86c00',
    '#fcfce0',
    '#a8a8b8',
    '#58586c',
    '#d8dce4',
    '#8890a0',
    '#4c5464',
    '#f8d000',
  ],
};

const key = [
  '......0000......',
  '.....033110.....',
  '....03311110....',
  '...0331111110...',
  '...0311001110...',
  '...0111001120...',
  '...0111111220...',
  '....01111220....',
  '.....011220.....',
  '.....03220......',
  '.....0322000....',
  '.....02222220...',
  '.....02220020...',
  '.....02222220...',
  '.....0222000....',
  '......000.......',
];

const keyIcon = [
  '.0000...',
  '011110..',
  '010010..',
  '011110..',
  '.0110...',
  '.01110..',
  '.0110...',
  '.01110..',
];

const padlock = [
  '..000...',
  '.0...0..',
  '.0...0..',
  '0000000.',
  '0111110.',
  '0110110.',
  '0112110.',
  '0000000.',
];

/** The drafted gate's iron roles (1 light, 2 dark) moved to this sheet's 4 and 5. */
const iron = (rows: readonly string[]): string[] => rows.map((r) => r.replace(/1/g, '4').replace(/2/g, '5'));

const portcullis = iron([
  '0120012001200120',
  '0120012001200120',
  '0120012001200120',
  '1111111111111111',
  '2222222222222222',
  '0120012001200120',
  '0120012001200120',
  '0120012001200120',
  '0120012001200120',
  '0120012001200120',
  '0120012001200120',
  '1111111111111111',
  '2222222222222222',
  '0120012001200120',
  '0120012001200120',
  '0120012001200120',
  '0120012001200120',
  '0120012001200120',
  '0120012001200120',
  '1111111111111111',
  '2222222222222222',
  '0120012001200120',
  '0120012001200120',
  '0120012001200120',
  '0120012001200120',
  '0120012001200120',
  '1111111111111111',
  '2222222222222222',
  '0120012001200120',
  '0120012001200120',
  '0120012001200120',
  '020.020.020.020.',
]);

/** The portcullis rises and drops in steps of this many px (`portcullis-<rows>`). */
export const PORTCULLIS_STEP = 4;

/**
 * `portcullis-<n>`: the gate raised, only its bottom `n` rows still showing below the doorway's
 * top (the rest is up in the wall), for n = 4, 8, ... 28.
 */
const raised: Record<string, string[]> = {};
for (let n = PORTCULLIS_STEP; n < 32; n += PORTCULLIS_STEP)
  raised[`portcullis-${n}`] = portcullis.slice(32 - n);

/** The drafted hatch's steel roles (1 light, 2 steel, 3 dark, 4 hazard yellow) moved to 6-9. */
const steel = (rows: readonly string[]): string[] =>
  rows.map((r) => r.replace(/[1-4]/g, (c) => String(Number(c) + 5)));

const hatchShut = steel([
  '00000000000000003000000000000000',
  '01111111111111103111111111111110',
  '04422244422244403244422244422240',
  '04422244422244403244422244422240',
  '02222222222222203222222222222220',
  '02222222222222203222222222222220',
  '02212222222212203221222222221220',
  '02232222222232203223222222223220',
  '02222222222222203222222222222220',
  '03333333333333303333333333333330',
  '02222222222222203222222222222220',
  '02222222222222203222222222222220',
  '02212222222212203221222222221220',
  '02232222222232203223222222223220',
  '03333333333333303333333333333330',
  '00000000000000003000000000000000',
]);

const hatchOpen = steel([
  '01100000000000000000000000000110',
  '01100000000000000000000000000110',
  '03300000000000000000000000000330',
  '03300000000000000000000000000330',
  '03300000000000000000000000000330',
  '03300000000000000000000000000330',
  '03300000000000000000000000000330',
  '03300000000000000000000000000330',
  '03300000000000000000000000000330',
  '03300000000000000000000000000330',
  '03300000000000000000000000000330',
  '03300000000000000000000000000330',
  '03300000000000000000000000000330',
  '03300000000000000000000000000330',
  '03300000000000000000000000000330',
  '03300000000000000000000000000330',
]);

export const keysDef: SpriteDef = {
  palette: 'keys',
  frames: {
    key,
    'key-icon': keyIcon,
    padlock,
    portcullis,
    ...raised,
    'hatch-shut': hatchShut,
    'hatch-open': hatchOpen,
  },
};
