import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { bassSheet } from './bass';
import { LINK_CLASSIC_TOP, linkClassicDef, linkClassicShieldDef } from './link-classic';

/**
 * Classic mode's 0.5.0 looks (G-050..G-053), each a skin on its hero's select slot with the rules
 * the original gives it (SkinDescriptions.as). Our own art throughout, built from our own heroes'
 * sheets in their palette roles:
 *
 * - Princess Zelda on Link's slot (NES, SNES and Game Boy looks): Link's redrawn Classic poses
 *   (link-classic.ts) with long hair in place of his cap, a jewel in it and a skirt between the
 *   legs, in three palettes of our own.
 * - Quick Man on Bass's slot: Bass's suit (bass.ts) under a helmet of our own with a boomerang
 *   crest, in red and gold.
 * - Haggle Man on Ryu's slot: Ryu's Classic sheet in a palette of our own (a red ninja with gold
 *   wraps and scarf).
 * - Mario's and Luigi's "Super Mario Bros. 3" looks: their own sheet (whose small crouch frame
 *   these looks use, G-053) in palettes of our own.
 */

/* ---------- Princess Zelda (G-050) ---------- */

/**
 * One of Link's frames as Zelda's (link-classic.ts roles: 1 tunic, 2 tunic shade, 4 hair, 6
 * glint): the cap (the head's top rows) and its tail down the back become hair, a glint-coloured
 * jewel sits in it, and the gap between the legs fills in as a skirt.
 */
function zeldaFrame(rows: readonly string[], top: number): string[] {
  const body = rows.length - top;
  return rows.map((r, y) => {
    const k = y - top;
    let out = r;
    if (k >= 0 && k <= 3) out = out.replace(/[12]/g, '4');
    else if (k >= 4 && k <= 6) out = out.replace(/2/g, '4');
    if (k === 1) {
      // The jewel: the middle of the hair row.
      const a = out.indexOf('4');
      const b = out.lastIndexOf('4');
      if (a >= 0) {
        const m = (a + b) >> 1;
        out = `${out.slice(0, m)}6${out.slice(m + 1)}`;
      }
    }
    if (body >= 14 && k >= body - 4 && k <= body - 3) {
      // The skirt: the gap between the legs fills with the dress.
      const a = out.search(/[^.]/);
      const b = out.length - 1 - [...out].reverse().join('').search(/[^.]/);
      if (a >= 0 && b > a) out = out.slice(0, a) + out.slice(a, b + 1).replace(/\./g, '1') + out.slice(b + 1);
    }
    return out;
  });
}

function zeldaSheet(def: SpriteDef): SpriteDef {
  return {
    palette: 'zelda-nes',
    frames: Object.fromEntries(
      Object.entries(def.frames).map(([name, rows]) => [name, zeldaFrame(rows, LINK_CLASSIC_TOP[name] ?? 0)]),
    ),
  };
}

/** A Zelda palette in Link's eleven roles; the sword, hilt and shield keep his colours. */
function zelda(dress: string, shade: string, hair: string, belt: string, skin: string = NES.skin): string[] {
  return [
    NES.black,
    dress,
    shade,
    skin,
    hair,
    belt,
    NES.white,
    NES.lightGray,
    NES.gray,
    NES.yellow,
    NES.blueMid,
  ];
}

/**
 * Each look in its three power states (Link's green, blue and red, LK-C21: `-blue` with the
 * Mushroom, `-red` with the Flower), our own colours.
 */
const zeldaPalettes: Record<string, string[]> = {
  // NES: a pink dress, brown hair.
  'zelda-nes': zelda(NES.pink, NES.magenta, NES.brownLight, NES.brownDark),
  'zelda-nes-blue': zelda(NES.lavender, NES.purple, NES.brownLight, NES.brownDark),
  'zelda-nes-red': zelda(NES.red, NES.redDark, NES.brownLight, NES.brownDark),
  // SNES: a white gown, golden hair.
  'zelda-snes': zelda(NES.white, NES.lavender, NES.yellow, NES.purple),
  'zelda-snes-blue': zelda(NES.skyLight, NES.blueLight, NES.yellow, NES.purple),
  'zelda-snes-red': zelda(NES.tan, NES.orange, NES.yellow, NES.purple),
  // Game Boy: four greens.
  'zelda-gb': zelda(NES.greenLight, NES.green, NES.greenDark, NES.greenDark, NES.yellowLight),
  'zelda-gb-blue': zelda(NES.yellowLight, NES.greenLight, NES.greenDark, NES.greenDark, NES.yellowLight),
  'zelda-gb-red': zelda(NES.green, NES.greenDark, NES.greenDark, NES.black, NES.yellowLight),
};

/* ---------- Quick Man (G-051) ---------- */

// His helmet with the boomerang crest on top and its visor; Bass's 16 x 13 head plan, facing right.
const quickHead = [
  '.......00.......',
  '......0550......',
  '.....055550.....',
  '....0550.0550...',
  '...0502222220...',
  '...0222222220...',
  '..022222222220..',
  '..000002111220..',
  '..002202334030..',
  '..002202330030..',
  '..020022333330..',
  '...0222033330...',
  '.....0000330....',
];
const quickBlink = quickHead.map((r, i) => (i === 8 ? '..002202333330..' : i === 9 ? '..002202300030..' : r));

/** His suit (Bass's roles: 1 suit, 2 helmet, gloves and boots, 5 crest and glow), our own colours. */
const QUICK = [NES.black, NES.redBright, NES.redDark, NES.tan, NES.white, NES.yellow];
const quickPalettes: Record<string, string[]> = {
  quickman: QUICK,
  // Bass's Water Shield suit with the Flower (BA-33), in his colours.
  'quickman-water': [NES.black, NES.skyLight, NES.redDark, NES.tan, NES.white, NES.white],
  'quickman-charge-0': QUICK.map((c, i) => (i === 5 ? NES.cyan : c)),
  'quickman-charge-1': [NES.black, NES.peach, NES.yellow, NES.tan, NES.white, NES.white],
  'quickman-charge-2': [NES.black, NES.yellowLight, NES.yellow, NES.tan, NES.white, NES.white],
};

/* ---------- Bass's other looks (owner addition to batch 6) ---------- */

/*
 * The original's other Bass looks (BmdInfo.as Bass003..Bass015): cosmetic, each Bass's suit under
 * a head of our own on Bass's 16 x 13 head plan (roles: 1 suit or coat, 2 hat, helmet or dark
 * trim, 3 skin, 4 white, 5 accent), facing right.
 */
// Dr. Wily: a bald crown with wild white hair at the back and a big moustache.
const wilyHead = [
  '................',
  '.....000000.....',
  '....03333330....',
  '..04033333330...',
  '.0444333333330..',
  '.04440333333330.',
  '..0440334403430.',
  '..04403344033300',
  '...0033333333330',
  '....03334444440.',
  '.....0344444440.',
  '......0333330...',
  '.......00000....',
];
// Mr. X: a dark beret, round dark glasses and a white moustache.
const mrxHead = [
  '................',
  '......00000.....',
  '....002222200...',
  '...02222222220..',
  '..0222222222220.',
  '...00333333330..',
  '...0330000000000',
  '...0330440440300',
  '...033333333330.',
  '....03344444440.',
  '.....034444440..',
  '......0333330...',
  '.......00000....',
];
// Dr. Cossack: a tall fur hat, bushy brows and a full beard.
const cossackHead = [
  '.....000000.....',
  '....02222220....',
  '...0222222220...',
  '...0222222220...',
  '...0000000000...',
  '...0333333330...',
  '..03300330030...',
  '..03304430430...',
  '..03333333330...',
  '..02223333220...',
  '...022222220....',
  '....0222220.....',
  '.....00000......',
];
// Gemini Man: a clear crystal dome over his helmet, a glint on top.
const geminiHead = [
  '......0000......',
  '....00555500....',
  '...0554444550...',
  '..055444444550..',
  '..054222222450..',
  '..052222222250..',
  '..022222222220..',
  '..000002111220..',
  '..002202334030..',
  '..002202330030..',
  '..020022333330..',
  '...0222033330...',
  '.....0000330....',
];
// Skull Man: a white skull for a helmet, dark sockets and teeth.
const skullHead = [
  '.....000000.....',
  '...0044444400...',
  '..044444444440..',
  '..044444444440..',
  '..044000440004..',
  '..044000440004..',
  '..044444004440..',
  '..004404404400..',
  '..002202334030..',
  '..002202330030..',
  '..020022333330..',
  '...0222033330...',
  '.....0000330....',
];

/** A head's blink: its eye rows' pupils ('0' after a '4') closed to skin. */
const blinkOf = (head: readonly string[]): string[] => head.map((r) => r.replace(/40/g, '43'));

/** A Bass look's suit, its Water Shield suit (BA-33) and charge flashes, our own colours. */
function bassLook(name: string, suit: readonly string[]): Record<string, string[]> {
  const c = [...suit];
  return {
    [name]: c,
    [`${name}-water`]: [NES.black, NES.skyLight, c[2] ?? NES.blueMid, c[3] ?? NES.tan, NES.white, NES.white],
    [`${name}-charge-0`]: c.map((x, i) => (i === 5 ? NES.cyan : x)),
    [`${name}-charge-1`]: [NES.black, NES.peach, NES.yellow, c[3] ?? NES.tan, NES.white, NES.white],
    [`${name}-charge-2`]: [NES.black, NES.yellowLight, NES.yellow, c[3] ?? NES.tan, NES.white, NES.white],
  };
}

/** The Bass looks by id: their heads and suits. */
export const BASS_LOOKS: Readonly<Record<string, { head: readonly string[]; suit: readonly string[] }>> = {
  // A white lab coat, grey trim.
  wily: { head: wilyHead, suit: [NES.black, NES.lightGray, NES.gray, NES.tan, NES.white, NES.yellow] },
  // A purple coat, a dark beret.
  mrx: { head: mrxHead, suit: [NES.black, NES.purple, NES.darkGray, NES.tan, NES.white, NES.red] },
  // A brown coat and fur hat.
  cossack: {
    head: cossackHead,
    suit: [NES.black, NES.brownLight, NES.brownDark, NES.tan, NES.white, NES.yellow],
  },
  // White and blue, a cyan crystal.
  gemini: { head: geminiHead, suit: [NES.black, NES.white, NES.blueMid, NES.tan, NES.skyLight, NES.cyan] },
  // Grey and black, red eyes' glow.
  skullman: { head: skullHead, suit: [NES.black, NES.lightGray, NES.darkGray, NES.tan, NES.white, NES.red] },
};

const bassLookPalettes: Record<string, string[]> = Object.assign(
  {},
  ...Object.entries(BASS_LOOKS).map(([id, l]) => bassLook(id, l.suit)),
);

/* ---------- Haggle Man (G-052) ---------- */

/** Ryu's roles (ryu.ts: 1 suit, 2 suit shade and mask, 3 skin, 4 wraps and scarf, 5 blade), a red ninja. */
const hagglePalettes: Record<string, string[]> = {
  haggleman: [NES.black, NES.redBright, NES.redDark, NES.skin, NES.yellow, NES.lightGray],
};

/* ---------- Mario's and Luigi's SMB3 looks (G-053) ---------- */

/** The plumbers' roles (mario.ts: 1 hair and boots, 2 skin, 3 cap and shirt, 4 overalls, 5 buttons). */
const plumber3Palettes: Record<string, string[]> = {
  mario3: [NES.black, NES.black, NES.tan, NES.redBright, NES.blueMid, NES.yellow],
  'mario3-fire': [NES.black, NES.black, NES.tan, NES.white, NES.redBright, NES.yellow],
  luigi3: [NES.black, NES.black, NES.tan, NES.green, NES.blueDark, NES.yellow],
  'luigi3-fire': [NES.black, NES.black, NES.tan, NES.white, NES.green, NES.yellow],
};

export const heroLookPalettes: Record<string, string[]> = {
  ...zeldaPalettes,
  ...quickPalettes,
  ...hagglePalettes,
  ...plumber3Palettes,
  ...bassLookPalettes,
};

export const heroLookSheets: Record<string, SpriteDef> = {
  'zelda-classic': zeldaSheet(linkClassicDef),
  'zelda-classic-shield': zeldaSheet(linkClassicShieldDef),
  quickman: bassSheet('quickman', quickHead, quickBlink),
  ...Object.fromEntries(
    Object.entries(BASS_LOOKS).map(([id, l]) => [id, bassSheet(id, l.head, blinkOf(l.head))]),
  ),
};
