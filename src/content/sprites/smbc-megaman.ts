import type { SpriteDef } from '@engine/gfx/pixelart';
import { flipH } from '@engine/gfx/pixelart';
import { anchored, trimmed, type SmbcCanvas, type SmbcLayer } from './smbc-anchor';

/**
 * Classic SMBC Mega Man at the original 3.1.21 sizes (R1 redraw; `megaman-classic`, his palettes:
 * 0 outline, 1 light armour, 2 dark armour, 3 skin, 4 white, 5 charge glow). New art drawn by hand
 * to the measured per-frame sizes and feet anchors (MegaManMc, NES px):
 *   stand / shoot 21x24 (buster arm 13x6 out at 7.5 px), step 19x24, run 24x22 / 16x24 / 21x22,
 *   jump 26x30 (arms raised; jumpShoot 24x30 with the buster), takeDamage 26x28, climb 16x29,
 *   slide 27x21. Proto Man, Break Man and Bass keep their own sheets.
 */

/** His canvas: wide enough for the buster out in front, origin (feet centre) at column 22. */
export const MEGAMAN_SMBC_CANVAS: SmbcCanvas = { w: 44, h: 34, cx: 22 };

/** Rows with the box (x0..x1, y0..y1) cleared. */
function clear(rows: readonly string[], x0: number, y0: number, x1: number, y1: number): string[] {
  return rows.map((r, y) =>
    y < y0 || y > y1 ? r : [...r].map((c, x) => (x >= x0 && x <= x1 ? '.' : c)).join(''),
  );
}

// The head, 13x11, facing right: round helmet with a light crest and ear-piece, the face open on
// the right with one big eye.
const head = [
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
const headBlink = head.map((r, i) => (i === 5 ? '0212033333330' : i === 6 ? '0212033000030' : r));
// Eyes screwed shut, mouth open (takeDamage).
const headHurt = head.map((r, i) =>
  i === 5 ? '0212033033030' : i === 6 ? '0212033303330' : i === 8 ? '0222203300030' : r,
);
// The back of the helmet (climbing).
const headBack = [
  '....00000....',
  '..002222200..',
  '.02222122220.',
  '0222221222220',
  '0222221222220',
  '0122221222210',
  '0122221222210',
  '0222221222220',
  '0222222222220',
  '.00222222200.',
  '..000000000..',
];

// The buster arm, 13x6: the light upper arm into the dark cannon, a glint at the muzzle.
const buster = [
  '....00000000.',
  '..00112222220',
  '0011112222240',
  '0011112222200',
  '..00112222220',
  '....00000000.',
];

/* ---------- standing (21x24) ---------- */

const standBody = [
  '.....00111111100.....',
  '...001111111111100...',
  '..01101111111110110..',
  '..01101111111110110..',
  '..02201111111110220..',
  '022220111111111022220',
  '022220022222220022220',
  '.0000.011101110.0000.',
  '......011101110......',
  '.....02220.02220.....',
  '....022220.022220....',
  '...0222220.0222220...',
  '...0000000.0000000...',
];
// The shoot body: the front arm up and out to the buster.
const shootBody = [
  '.....00111111111110..',
  '...00111111111111110.',
  '..011011111111100....',
  '..01101111111110.....',
  '..02201111111110.....',
  '.022201111111110.....',
  '.02220022222220......',
  ...standBody.slice(7),
];

/* ---------- the step and the run ---------- */

// The step frame before the run (walk-0, 19x24): feet closer together.
const stepBody = [
  '....00111111100....',
  '..001111111111100..',
  '.01101111111110110.',
  '.01101111111110110.',
  '.02201111111110220.',
  '0222011111111102220',
  '0222002222222002220',
  '.000.011101110.000.',
  '.....011101110.....',
  '.....0220.02220....',
  '....02220.022220...',
  '...022220.0222220..',
  '...000000.0000000..',
];

// Run A (walk-1, 24x22): the long stride, the back boot kicked up, arms swinging.
const runA = [
  '.......00111111100......',
  '.....0011111111111000...',
  '...00221111111111102220.',
  '..02220111111111102220..',
  '..0220.0111111110.000...',
  '...00..0222222220.......',
  '.......011100111100.....',
  '..000001110..0111110....',
  '.022222220....0222220...',
  '022222220.....02222220..',
  '000000000.....00000000..',
];
// Run B (walk-2 / walk-4, 16x24): passing, legs together, one knee up.
const runB = [
  '...00111111100..',
  '..0011111111100.',
  '.022011111111110',
  '0222011111111110',
  '.000011111111110',
  '....02222222220.',
  '....0111001110..',
  '.....0111.0110..',
  '.....0222.0110..',
  '....02222.02220.',
  '...022222.02220.',
  '...022222.00000.',
  '...000000.......',
];
// Run C (walk-3, 21x22): the short stride.
const runC = [
  '.......00111111100...',
  '.....001111111111100.',
  '....02211111111110...',
  '...022201111111110...',
  '...02200111111110....',
  '....000.0222222220...',
  '........01110011110..',
  '.....0001110..011110.',
  '..022222220...022220.',
  '.0222222220...0222220',
  '.0000000000...0000000',
];

/* ---------- air ---------- */

// Jump (26x30): both arms flung up, the back leg tucked, the front one reaching down.
const jumpBody = [
  '.00....................00.',
  '0220..................0220',
  '02220................02220',
  '02220................02220',
  '.0110................0110.',
  '.0110................0110.',
  '..0110..............0110..',
  '..0110..............0110..',
  '...0110............0110...',
  '...0110............0110...',
  '....0110..........0110....',
  '....0110..........0110....',
  '.....0110........0110.....',
  '.....01100......00110.....',
  '......01111111111110......',
  '.......011111111110.......',
  '.......011111111110.......',
  '.......011111111110.......',
  '.......022222222220.......',
  '.......011100011110.......',
  '......01110...01110.......',
  '.....01110....01110.......',
  '.....0110.....01110.......',
  '....02220.....01110.......',
  '...022220.....02220.......',
  '..0222220.....022220......',
  '..0000000.....0222220.....',
  '..............0222220.....',
  '..............0222220.....',
  '..............0000000.....',
];

/* ---------- hurt, climb, slide ---------- */

// takeDamage (26x28): thrown back, arms and legs splayed.
const hurtBody = [
  ...Array.from({ length: 6 }, () => ''),
  '...00................00...',
  '..0220..............0220..',
  '.02220..............02220.',
  '0222000............0002220',
  '.0111110..........0111110.',
  '...001111100..00111110....',
  '...00111111111111111100...',
  '......01111111111110......',
  '......01111111111110......',
  '.......011111111110.......',
  '.......011111111110.......',
  '.......022222222220.......',
  '......01111000011110......',
  '.....01110......01110.....',
  '.....01110......01110.....',
  '....01110........01110....',
  '...01110..........01110...',
  '...01110..........01110...',
  '..02220............02220..',
  '.022220............022220.',
  '0222220............0222220',
  '0000000............0000000',
];

// Climbing (16x29), from behind: one arm up on the rung, the other low, one knee raised.
const climbBody = [
  '.000............',
  '02220...........',
  '02220...........',
  '.0110...........',
  '.0110...........',
  '.0110...........',
  '.0110...........',
  '.0110...........',
  '.0110...........',
  '.0110...........',
  '.0110...........',
  '.0110...........',
  '.0110...........',
  '.01110.........',
  '..01111111111000',
  '..01111111111010',
  '...0111111111010',
  '...0111111111020',
  '...0111111111020',
  '...0222222222000',
  '...011100011100.',
  '...01110.011100.',
  '...02220.01110..',
  '..022220.01110..',
  '..022220.02220..',
  '..000000.022220.',
  '.........022220.',
  '.........022220.',
  '.........000000.',
];

// The slide (27x21): low and long, the head leading, the back leg stretched out behind.
const slideBody = [
  '.........0011111100........',
  '.......00111111111100......',
  '.....0011111111111110......',
  '...00111111111111110.......',
  '..0111111111111110220......',
  '.0222222222222220.0220.....',
  '.011100000111110...00......',
  '0222220..022220............',
  '0222220..0222220...........',
  '0000000..0000000...........',
];

/* ---------- the sheet ---------- */

const C = MEGAMAN_SMBC_CANVAS;
const at = (...layers: SmbcLayer[]): string[] => anchored(C, ...layers);

/**
 * A head set for his frame (13 px wide; 11 rows, or taller with the extra rows on top, as a crest
 * or a hat): facing right, its blink and hurt faces, and the back of it for climbing.
 */
export interface MegamanHeads {
  head: readonly string[];
  blink: readonly string[];
  hurt: readonly string[];
  back: readonly string[];
}

/** His own heads (the round helmet). */
export const MEGAMAN_HEADS: MegamanHeads = { head, blink: headBlink, hurt: headHurt, back: headBack };

/**
 * A head's blink, hurt and back faces, for a head drawn on his face plan: its face's rows 4-9
 * (from the bottom 11 rows) hold his eye and mouth at columns 6-12, as his own head does. The
 * blink and hurt faces copy his eyes and mouth there; the back paints the face over with `hair`.
 */
export function headFaces(h: readonly string[], hair = '2'): MegamanHeads {
  const top = h.length - 11;
  const face = (rows: Record<number, string>) =>
    h.map((r, y) => {
      const k = y - top;
      const put = rows[k];
      return put ? r.slice(0, 6) + put + r.slice(13) : r;
    });
  const blink = face({ 5: (headBlink[5] as string).slice(6), 6: (headBlink[6] as string).slice(6) });
  const hurt = face({
    5: (headHurt[5] as string).slice(6),
    6: (headHurt[6] as string).slice(6),
    8: (headHurt[8] as string).slice(6),
  });
  const back = h.map((r, y) =>
    y - top >= 3 && y - top <= 9 ? r.slice(0, 5) + r.slice(5, 12).replace(/[0345]/g, hair) + r.slice(12) : r,
  );
  return { head: h, blink, hurt, back };
}

/**
 * His sheet with head set `H` (R1's poses, his bodies and buster): Mega Man's own, and the Classic
 * gameplay variants built on his frame (FU-3, smbc-megaman-variants.ts). A taller head keeps its
 * bottom where his sits. `dash` is the upright dash some variants use in place of the slide.
 */
export function megamanSmbcSheet(palette: string, H: MegamanHeads = MEGAMAN_HEADS): SpriteDef {
  const up = (rows: readonly string[]) => rows.length - 11;
  const hd = (rows: readonly string[], x: number, y: number): SmbcLayer => [rows, x, y - up(rows)];
  const climb0 = at([climbBody, -8, -29], hd(H.back, -6, -24));
  return {
    palette,
    frames: {
      idle: at(...standWith(hd(H.head, -6.5, -24))),
      // The select screen's and the intro card's portrait: the stand, cropped.
      portrait: trimmed(at(...standWith(hd(H.head, -6.5, -24)))),
      'idle-blink': at(...standWith(hd(H.blink, -6.5, -24))),
      // The original's charge is a palette flash only (CHARGE_START 550 ms), not a new pose.
      'charge-0': at(...standWith(hd(H.head, -6.5, -24))),
      shoot: at([shootBody, -10.5, -24 + 11], [buster, 7.5, -16], hd(H.head, -5.5, -24)),
      step: at([stepBody, -10.5, -13], hd(H.head, -6.5, -24)),
      'walk-0': at([runA, -12, -11], hd(H.head, -5, -22)),
      'walk-1': at([runB, -9, -13], hd(H.head, -7, -24)),
      'walk-2': at([runC, -13, -11], hd(H.head, -6, -22)),
      'walk-shoot-0': at([clear(runA, 17, 0, 23, 5), -12, -11], [buster, 4, -15], hd(H.head, -5, -22)),
      'walk-shoot-1': at([runB, -9, -13], [buster, 4, -17], hd(H.head, -7, -24)),
      'walk-shoot-2': at([clear(runC, 15, 0, 20, 5), -13, -11], [buster, 4, -15], hd(H.head, -6, -22)),
      jump: at([jumpBody, -13, -30], hd(H.head, -6.5, -26)),
      'jump-shoot': at([clear(jumpBody, 15, 0, 25, 13), -13, -30], [buster, 3, -23], hd(H.head, -6.5, -26)),
      hurt: at([hurtBody, -13.5, -28], hd(H.hurt, -7, -28)),
      'climb-0': climb0,
      'climb-1': flipH(climb0),
      slide: at([slideBody, -13.5, -10], hd(H.head, -0.5, -21)),
      // The upright dash: the long stride, leaning in (Rokko Chan's dash instead of a slide).
      dash: at([runA, -12, -11], hd(H.head, -4, -22)),
    },
  };
}

/** His standing pose under head layer `h`. */
function standWith(h: SmbcLayer): SmbcLayer[] {
  return [[standBody, -10.5, -13], h];
}

export const megamanSmbcDef: SpriteDef = megamanSmbcSheet('megaman');
