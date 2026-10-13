import type { MapNode } from '@game/map/types';
import { hash } from './paint';
import {
  type AboveGround,
  type AbovePiece,
  cliff as kitCliff,
  type CliffInk,
  FrameBook,
  lazySheet,
  type LazySheetDef,
  roadNames,
  roadSteps,
  shadow,
  sideKey,
  type Sides,
  space,
  type SpaceInk,
  speckle,
  stairs as kitStairs,
  water as kitWater,
  type WaterInk,
} from './above-kit';

/*
 * World 8, THE UNDERWORLD (0.4.54, TD58's approved design; owner, Oct 13: purely the tank game's
 * Underworld), drawn from above in campaign play, in the 3/4 view of World 1's Mushroom Kingdom
 * (sprites/kingdom.ts). Its land is layered like the tank game's areas: the first area's forest and
 * red-rock caverns with an underground lake by the start (and the hole Jason drops into, by 8-1),
 * the frozen ruins along the north ledge, the techno castle's teal decks down the cliff, and,
 * deepest and darkest, the plutonium fortress (8-4). Bowser's Castle is not here: it is its own
 * page (valley-above.ts). Original art drawn from shapes; nothing traced from the owner's
 * references.
 *
 * Palette `underworld-above` (index: role):
 *   0 outline   1-3 cave dirt (dark, mid, light)   4-6 the open road (rim, body, light)
 *   7-9 red rock (dark, mid, light)   a-c moss (dark, mid, light)   d gnarled wood
 *   e-g the lake and the night sky (dark, mid, light)   h-j teal machine steel (dark, mid, light)
 *   k-m ice (dark, mid, light)   n-p plutonium (dark, mid, light)   q-r grey stone (dark, light)
 *   s gold   t-u red (dark, mid)   v white   w glow   x steel   y radioactive green   z black
 */
export const UNDERWORLD_ABOVE_PALETTE: readonly string[] = [
  '#0a0608', // 0 outline
  '#2e160c', // 1 dirt dark
  '#4a2614', // 2 dirt
  '#74401e', // 3 dirt light
  '#3c3630', // 4 road rim
  '#a8987a', // 5 road
  '#e8dcb6', // 6 road light
  '#561a0e', // 7 rock dark
  '#923a1c', // 8 rock
  '#cc6a38', // 9 rock light
  '#263410', // a moss dark
  '#44621a', // b moss
  '#86a032', // c moss light
  '#3a2618', // d wood
  '#081232', // e lake dark / night
  '#142a74', // f lake
  '#3a5ab8', // g lake light
  '#0c3434', // h teal dark
  '#1c6464', // i teal
  '#48a49c', // j teal light
  '#23446e', // k ice dark
  '#5a8cc4', // l ice
  '#b4e2f8', // m ice light
  '#3a0830', // n plutonium dark
  '#7a1660', // o plutonium
  '#c84898', // p plutonium light
  '#2a2a32', // q stone dark
  '#5c5c68', // r stone
  '#f8c030', // s gold
  '#a01c00', // t red dark
  '#f05a10', // u red
  '#f8f8f8', // v white
  '#ffd040', // w glow
  '#8a8a98', // x steel
  '#6af04a', // y radioactive green
  '#060406', // z black
];

const book = new FrameBook();
const F = book.frames;
const frame = book.frame.bind(book);

/* ---------------------------------------------------------------------------------------------- */
/* Ground                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

/** Cave dirt ('#'): dark earth, pebbles. */
export const dirt = (v: number): string =>
  speckle(book, `dirt-${v}`, v, { base: '2', dark: '1', light: '3', dense: 0.1 });

/** A moss ledge (','): olive grass in tufts over the dirt. */
export function moss(v: number): string {
  return frame(`moss-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 'b');
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(hash(v, i, 1) * 14) + 1;
      const y = Math.floor(hash(v, i, 2) * 13) + 2;
      c.set(x, y, 'a');
      c.set(x + 1, y, 'a');
      c.set(x, y - 1, 'c');
    }
  });
}

/** The frozen ruins' ice ('o'): pale blue slabs, cracks. */
export const ice = (v: number): string =>
  speckle(book, `ice-${v}`, v, { base: 'l', dark: 'k', light: 'm', dense: 0.06, joint: 'k', step: 8 });

/** The techno castle's deck (':'): teal steel plates, rivets at their corners. */
export function deck(v: number): string {
  return frame(`deck-${v}`, 16, 16, (c) => {
    c.each((x, y) => {
      if (x % 8 === 7 || y % 8 === 7) return 'h';
      if (x % 8 === 0 || y % 8 === 0) return 'j';
      return 'i';
    });
    for (const [x, y] of [
      [1, 1],
      [9, 9],
    ] as [number, number][])
      c.set(x + 1, y + 1, 'x');
    if (v === 1) c.rect(10, 2, 3, 3, 'y');
    if (v === 3) c.rect(2, 10, 4, 1, 'h');
  });
}

/** The plutonium fortress's floor ('*'): dark magenta, ribbed, a few glowing veins. */
export function flesh(v: number): string {
  return frame(`flesh-${v}`, 16, 16, (c) => {
    c.each((x, y) => {
      const rib = (y + Math.round(Math.sin((x + v * 3) / 3) * 1.5)) % 6;
      if (rib === 0) return 'n';
      return hash(x, y, v, 51) < 0.06 ? 'p' : 'o';
    });
    if (v % 2) c.rect(3 + v, 7, 4, 1, 'p');
  });
}

const CLIFF: CliffInk = {
  top: 'b',
  topLight: 'c',
  dark: '7',
  body: '8',
  light: '9',
  crack: '0',
  below: '1',
  shade: 'z',
  outline: '0',
};
/** Red-rock cliffs ('^'), moss along the lip: the drop from one layer of the Underworld to the next. */
export const cliff = (s: Sides): string => kitCliff(book, 'cliff', s, CLIFF);

/** Steps cut down the red rock ('G'). */
export const stairs = (): string =>
  kitStairs(book, 'stairs', cliff({ n: false, e: true, s: false, w: true }), {
    dark: '7',
    body: '8',
    light: '6',
    outline: '0',
  });

/** The band under the header: the Underworld's night sky over its first area's ridge (the tank
 * game's surface). */
export function band(x: number): string {
  const v = x % 3;
  return frame(`band-night-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 'e');
    for (let i = 0; i < 3; i++) c.rect(Math.floor(hash(v, i, 72) * 12), 2 + i * 3, 3, 1, 'f');
    c.each((xx, y) => {
      const h = 10 + Math.round(Math.abs(Math.sin((xx + v * 16) / 4)) * -3);
      return y > h ? (y > 13 ? 'b' : 'a') : null;
    });
    c.rect(0, 15, 16, 1, 'z');
  });
}

const LAKE: WaterInk = { deep: 'e', mid: 'f', light: 'g', land: '2', bankLight: '9', bank: '8', face: '7' };
/** The underground lake ('~'): dark blue, banked with red rock. */
export const lake = (s: Sides, corners: string, f: number): string =>
  kitWater(book, 'lake', s, corners, f, LAKE);

/**
 * A ground tile `g` with the drop down to it from a higher layer on its `hi` sides: on the north a
 * short red-rock face with a moss lip, on the west or east a shadow and a crumbling rock rim.
 */
export function dropEdge(g: string, hi: Sides): string {
  if (!hi.n && !hi.e && !hi.w) return g;
  return frame(`${g}-drop-${sideKey(hi)}`, 16, 16, (c) => {
    c.paste(book.rows(g));
    if (hi.w)
      for (let y = 0; y < 16; y++) {
        const j = hash(y, 81) < 0.4 ? 1 : 0;
        c.set(0, y, '7');
        c.set(1, y, j ? '8' : 'z');
        c.set(2, y, 'z');
        if (j) c.set(3, y, 'z');
      }
    if (hi.e)
      for (let y = 0; y < 16; y++) {
        c.set(15, y, '8');
        c.set(14, y, hash(y, 82) < 0.4 ? '7' : 'z');
      }
    if (hi.n)
      for (let x = 0; x < 16; x++) {
        const j = hash(x, 83) < 0.5 ? 1 : 0;
        c.set(x, 0, 'c');
        c.set(x, 1, x % 5 === 0 ? '7' : '9');
        c.set(x, 2, '8');
        c.set(x, 3, x % 3 === 0 ? '7' : '8');
        c.set(x, 4, '7');
        c.set(x, 5 + j, 'z');
        if (j) c.set(x, 5, '7');
      }
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Small scenery                                                                                   */
/* ---------------------------------------------------------------------------------------------- */

/** A gnarled tree of the first area, 16×32: a twisted dark trunk, a lumpy moss-green crown. */
export function gnarled(): string {
  return frame('gnarled', 16, 32, (c) => {
    shadow(c, 8, 29, 6, 2, 'z');
    for (let y = 14; y < 30; y++) {
      const x = 7 + Math.round(Math.sin(y / 3) * 1.2);
      c.rect(x, y, 3, 1, 'd');
      c.set(x, y, '3');
    }
    c.rect(4, 28, 9, 2, 'd');
    c.rect(3, 16, 4, 1, 'd');
    c.rect(10, 18, 3, 1, 'd');
    for (const [cx, cy, r] of [
      [8, 9, 6],
      [4, 12, 3.5],
      [12, 12, 3.5],
      [8, 4, 4],
    ] as [number, number, number][])
      c.ellipse(cx, cy, r, r * 0.85, (x, y, d) => (d > 0.75 ? 'a' : x + y < cx + cy - 1 ? 'c' : 'b'));
    c.outline('0', (_x, y) => y < 29);
  });
}

/** A moss shrub. */
export function shrub(): string {
  return frame('shrub', 16, 16, (c) => {
    shadow(c, 8, 12, 7, 3, 'z');
    c.ellipse(8, 8.5, 7, 6, (x, y, d) => (d > 0.78 ? 'a' : x + y < 13 && d < 0.4 ? 'c' : 'b'));
    c.outline('0', (_x, y) => y > 4);
  });
}

/** A red-rock boulder. */
export function boulder(): string {
  return frame('boulder', 16, 16, (c) => {
    shadow(c, 8, 12, 6, 2.5, 'z');
    c.ellipse(8, 9, 6.5, 5, (x, y, d) => (d > 0.75 ? '7' : x + y < 14 ? '9' : '8'));
    c.set(9, 9, '7');
    c.outline('0');
  });
}

/** An ice spire of the frozen ruins, 16×32: a cluster of pale shards. */
export function iceSpire(): string {
  return frame('ice-spire', 16, 32, (c) => {
    shadow(c, 8, 29, 6, 2, 'k');
    for (const [cx, top, hw] of [
      [8, 2, 3.5],
      [4, 12, 2.5],
      [12, 9, 2.5],
    ] as [number, number, number][])
      for (let y = top; y < 30; y++) {
        const w = Math.min(hw, ((y - top) / 6) * hw);
        for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w) - 1; x++)
          c.set(x, y, x < cx - 0.5 ? 'm' : x < cx + 1 ? 'l' : 'k');
      }
    c.outline('0', (_x, y) => y < 29);
  });
}

/** A frozen block in the ruins ('S'): a cube of ice, lit on its top. */
export function iceBlock(): string {
  return frame('ice-block', 16, 16, (c) => {
    shadow(c, 8, 13, 6, 2, 'k');
    c.rect(2, 2, 12, 6, 'm');
    c.rect(2, 8, 12, 6, 'l');
    c.rect(11, 2, 3, 12, 'k');
    c.set(4, 4, 'v');
    c.rect(5, 10, 3, 1, 'm');
    c.outline('0');
  });
}

/** A deck vent ('P'): a round grille in the teal plates, green light below it. */
export function vent(): string {
  return frame('vent', 16, 16, (c) => {
    c.ellipse(8, 9, 6.5, 5, (x, y, d) => (d > 0.7 ? (y < 9 ? 'j' : 'h') : (x + y) % 2 ? 'z' : 'y'));
    c.outline('0');
  });
}

/** A clutch of plutonium eggs ('J'): glossy pods with glowing cores. */
export function eggs(): string {
  return frame('eggs', 16, 16, (c) => {
    shadow(c, 8, 13, 7, 2, 'n');
    for (const [x, y] of [
      [5, 9],
      [11, 10],
      [8, 6],
    ] as [number, number][])
      c.ellipse(x, y, 3, 3.5, (xx, yy, d) =>
        d > 0.75 ? 'n' : xx + yy < x + y - 1 ? 'p' : d < 0.25 ? 'y' : 'o',
      );
    c.outline('0');
  });
}

/** Stone ruins ('Z'): a broken column on a mossy plinth, 16×32. */
export function ruin(): string {
  return frame('ruin', 16, 32, (c) => {
    shadow(c, 8, 29, 6, 2, 'z');
    c.rect(3, 25, 10, 4, 'r');
    c.rect(3, 25, 10, 1, 'x');
    c.rect(5, 10, 6, 15, 'x');
    c.rect(5, 10, 2, 15, 'v');
    c.rect(9, 10, 2, 15, 'r');
    for (let x = 5; x < 11; x++) c.set(x, 9 - (x % 3), 'x');
    c.rect(4, 22, 3, 3, 'b');
    c.set(10, 14, 'b');
    c.outline('0', (_x, y) => y < 29);
  });
}

/** A techno pylon ('X'): a teal machine post with a lit lamp and cable. */
export function pylon(): string {
  return frame('pylon', 16, 32, (c) => {
    shadow(c, 8, 29, 5, 2, 'h');
    c.rect(5, 6, 6, 23, 'i');
    c.rect(5, 6, 2, 23, 'j');
    c.rect(9, 6, 2, 23, 'h');
    for (let y = 10; y < 28; y += 6) c.rect(5, y, 6, 1, 'h');
    c.rect(4, 2, 8, 5, 'h');
    c.rect(6, 3, 4, 3, 'y');
    c.outline('0', (_x, y) => y < 29);
  });
}

/** A plutonium growth ('Y'): an organic magenta spire with glowing pores, 16×32. */
export function growth(): string {
  return frame('growth', 16, 32, (c) => {
    shadow(c, 8, 29, 6, 2, 'n');
    c.each((x, y) => {
      if (y < 4 || y > 29) return null;
      const w = 2 + ((y - 4) / 25) * 4.5 + Math.sin(y / 2) * 0.8;
      if (Math.abs(x + 0.5 - 8) > w) return null;
      return x < 7 ? 'p' : 'o';
    });
    for (const [x, y] of [
      [7, 10],
      [9, 16],
      [6, 21],
      [10, 24],
    ] as [number, number][])
      c.set(x, y, 'y');
    c.outline('0', (_x, y) => y < 29);
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Landmarks                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

/**
 * The tree-lined pipe tunnel of the first area, 48×32: a great iron pipe running into the rock,
 * its dark mouth facing south, gnarled trees growing over its back.
 */
export function pipeTunnel(): string {
  return frame('pipe-tunnel', 48, 32, (c) => {
    shadow(c, 24, 29, 22, 2.5, 'z');
    c.each((x, y) => {
      if (x < 2 || x > 45 || y < 8 || y > 28) return null;
      if (x % 12 === 2) return 'r';
      return y < 12 ? 'x' : y > 24 ? 'q' : 'r';
    });
    c.ellipse(14, 20, 9, 8, (_x, _y, d) => (d > 0.75 ? 'x' : d > 0.6 ? 'q' : 'z'));
    c.ellipse(14, 22, 5, 3, (_x, _y, d) => (d < 0.5 ? 'e' : null));
    for (const [cx, cy] of [
      [30, 6],
      [40, 7],
    ] as [number, number][])
      c.ellipse(cx, cy, 6, 5, (x, y, d) => (d > 0.75 ? 'a' : x + y < cx + cy ? 'c' : 'b'));
    c.outline('0');
  });
}

/** A moss shaft, 32×32: a square well dropping into the dark, its walls green with moss, a ladder. */
export function mossShaft(): string {
  return frame('moss-shaft', 32, 32, (c) => {
    c.rect(2, 4, 28, 26, '7');
    c.rect(2, 4, 28, 2, '9');
    c.rect(5, 7, 22, 21, 'a');
    c.rect(7, 12, 18, 16, 'z');
    c.rect(7, 9, 18, 3, 'b');
    for (let x = 7; x < 25; x += 3) c.set(x, 12 + (x % 2), 'c');
    c.rect(14, 9, 1, 19, 'd');
    c.rect(18, 9, 1, 19, 'd');
    for (let y = 11; y < 28; y += 3) c.rect(14, y, 5, 1, 'd');
    c.outline('0');
  });
}

/** The radioactive pit Jason fell through, 32×32: a ragged hole glowing green, rocks round it. */
export function radPit(): string {
  return frame('rad-pit', 32, 32, (c) => {
    c.ellipse(16, 17, 15, 12, (x, y, d) => (d > 0.78 ? (x + y < 30 ? '9' : '8') : d > 0.62 ? '7' : null));
    c.ellipse(16, 18, 10, 7.5, (x, y, d) =>
      d > 0.7 ? 'z' : d > 0.35 ? 'b' : hash(x, y, 81) < 0.3 ? 'c' : 'y',
    );
    c.outline('0');
  });
}

/** A dungeon hatch, 16×16 (the overhead entrances Jason walks into): a framed door in the ground. */
export function hatch(): string {
  return frame('hatch', 16, 16, (c) => {
    c.rect(1, 3, 14, 12, 'x');
    c.rect(1, 3, 14, 1, 'v');
    c.rect(3, 5, 10, 8, 'q');
    c.rect(4, 6, 8, 6, 'z');
    c.rect(4, 8, 8, 1, 'y');
    c.rect(1, 14, 14, 1, 'q');
    c.outline('0');
  });
}

/** A techno tower of the second area's castle, 32×48: teal machine panels, lit ports, a mast. */
export function technoTower(): string {
  return frame('techno-tower', 32, 48, (c) => {
    shadow(c, 16, 45, 14, 2.5, 'h');
    c.rect(4, 4, 24, 12, 'j');
    c.rect(4, 4, 24, 2, 'm');
    c.rect(8, 7, 16, 6, 'i');
    c.rect(14, 0, 2, 7, 'x');
    c.set(14, 0, 'y');
    c.each((x, y) => {
      if (x < 4 || x > 27 || y < 16 || y > 45) return null;
      if (y % 8 === 0 || x % 8 === 4) return 'h';
      return x < 9 ? 'j' : x > 22 ? 'h' : 'i';
    });
    for (let y = 19; y < 40; y += 8)
      for (const x of [9, 17]) {
        c.rect(x, y, 5, 3, 'z');
        c.set(x + 2, y + 1, 'y');
      }
    c.rect(12, 38, 8, 8, 'z');
    c.outline('0');
  });
}

/** A frozen ruin's arch, 32×32: two iced stone posts and their lintel, icicles hanging. */
export function iceArch(): string {
  return frame('ice-arch', 32, 32, (c) => {
    shadow(c, 16, 29, 14, 2, 'k');
    for (const x of [3, 23]) {
      c.rect(x, 8, 6, 21, 'r');
      c.rect(x, 8, 2, 21, 'x');
      c.rect(x, 8, 6, 2, 'm');
    }
    c.rect(1, 3, 30, 6, 'r');
    c.rect(1, 3, 30, 2, 'm');
    for (let x = 3; x < 30; x += 3) c.rect(x, 9, 1, 2 + (x % 2) * 2, 'm');
    c.outline('0');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Node markers                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

const INK = (body: string, dark: string, light: string, mark: string): SpaceInk => ({
  shadow: 'z',
  dark,
  body,
  light,
  mark,
  outline: '0',
});
const RING = { dark: 'q', light: 'x' };

/**
 * The plutonium fortress (8-4, the Underworld's castle node), 32×40 standing on its tile: a
 * magenta organic keep in steel bands, twin spires with glowing cores, a round boss gate; cleared,
 * the cores are dark and the gate stands open on a cold steel floor.
 */
function fortress(cleared: boolean): string {
  return frame(cleared ? 'fortress-cleared' : 'fortress', 32, 40, (c) => {
    shadow(c, 16, 37, 14, 2.5, 'z');
    c.each((x, y) => {
      if (x < 4 || x > 27 || y < 14 || y > 37) return null;
      if (y % 6 === 2) return 'x';
      return x < 9 ? 'p' : x > 23 ? 'n' : 'o';
    });
    // Spires.
    for (const sx of [4, 22]) {
      c.each((x, y) => {
        const w = 1 + (y / 16) * 2.5;
        return y >= 0 && y < 16 && Math.abs(x + 0.5 - (sx + 3)) <= w ? (x < sx + 3 ? 'p' : 'o') : null;
      });
      c.rect(sx + 2, 8, 2, 3, cleared ? 'n' : 'y');
    }
    // Battlement.
    for (let x = 4; x < 28; x += 4) c.rect(x, 12, 2, 2, 'x');
    // The gate.
    c.ellipse(16, 30, 6, 6, (_x, _y, d) => (d > 0.7 ? 'x' : cleared ? 'q' : 'z'));
    c.rect(10, 30, 12, 8, cleared ? 'q' : 'z');
    if (!cleared) {
      c.ellipse(16, 31, 3, 3, 'y');
      c.set(16, 31, 'v');
    }
    c.rect(10, 30, 1, 8, 'x');
    c.rect(21, 30, 1, 8, 'x');
    c.outline('0');
  });
}

/** The bonus spot: a dungeon hatch, its door lit green while open, shut and grey once used. */
function bonusHatch(used: boolean): string {
  return frame(used ? 'bonus-used' : 'bonus', 16, 16, (c) => {
    c.ellipse(8.5, 10, 7.5, 5, 'z');
    c.rect(1, 4, 14, 11, 'x');
    c.rect(1, 4, 14, 1, 'v');
    c.rect(3, 6, 10, 7, used ? 'r' : 'z');
    if (!used) {
      c.rect(4, 8, 8, 3, 'y');
      c.rect(6, 9, 4, 1, 'v');
    } else for (let x = 4; x < 12; x += 2) c.rect(x, 7, 1, 5, 'q');
    c.outline('0');
  });
}

export function nodeFrames(): Record<string, string> {
  return {
    open: space(book, 'node-open', INK('8', '7', '9', 'v'), 'none', RING),
    cleared: space(book, 'node-cleared', INK('f', 'e', 'g', 'v'), 'star', RING),
    start: space(book, 'node-start', INK('b', 'a', 'c', 'v'), 'none', RING),
    secret: space(book, 'node-secret', INK('p', 'o', 'v', 'z'), 'key', RING),
    secretCleared: space(book, 'node-secret-cleared', INK('v', 'p', 'v', 'z'), 'key', RING),
    bonus: bonusHatch(false),
    bonusUsed: bonusHatch(true),
    fortress: fortress(false),
    fortressCleared: fortress(true),
  };
}

/** The node marker on an UNDERWORLD page (above-render AboveLook.node). */
export function underworldNodeFrame(
  kind: MapNode['kind'],
  s: { cleared: boolean; secret: boolean },
): string | null {
  if (kind === 'castle') return s.cleared ? 'fortress-cleared' : 'fortress';
  if (kind === 'bonus') return s.cleared ? 'bonus-used' : 'bonus';
  if (kind === 'start') return 'node-start';
  if (kind !== 'level') return null;
  if (s.secret) return s.cleared ? 'node-secret-cleared' : 'node-secret';
  return s.cleared ? 'node-cleared' : 'node-open';
}

/* ---------------------------------------------------------------------------------------------- */
/* A page's ground                                                                                 */
/* ---------------------------------------------------------------------------------------------- */

/** The open roads: pale worn stone with a light halo, readable on the dark cave floors. */
const ROAD_INK = { rim: '4', body: '5', light: '6', speck: '4', halo: '6' };

/** The road joins' names, by mask (1 n, 2 e, 4 s, 8 w); painted with the sheet. */
export const UNDERWORLD_ROAD_FRAMES: readonly string[] = roadNames('road');

const WET = new Set(['~', '=']);
const SHORE = '82461397qezc[]nu';
const grounds = new WeakMap<readonly string[], AboveGround>();

/**
 * The ground of an UNDERWORLD page (world8-underworld.ts's legend). A shore tile takes the ground
 * most of its land neighbours have (dirt, ice, deck, plutonium); a tile below a neighbour's layer
 * shows the drop.
 */
export function underworldGround(tiles: readonly string[]): AboveGround {
  const hit = grounds.get(tiles);
  if (hit) return hit;
  const b = groundBuilder(tiles);
  for (let i = 0; i < b.count; i++) b.tile(i);
  grounds.set(tiles, b.out);
  return b.out;
}

/** underworldGround's steps: one ground tile each (a lazy sheet's prepaint), then the cache. */
function groundSteps(tiles: readonly string[]): (() => void)[] {
  if (grounds.has(tiles)) return [];
  const b = groundBuilder(tiles);
  return [
    ...Array.from({ length: b.count }, (_, i) => () => b.tile(i)),
    () => void (grounds.has(tiles) || grounds.set(tiles, b.out)),
  ];
}

/** Works out an UNDERWORLD page's ground a tile at a time, in row order (`tile(i)`, i < count). */
function groundBuilder(tiles: readonly string[]): {
  count: number;
  tile: (i: number) => void;
  out: AboveGround;
} {
  const ch = (x: number, y: number): string => {
    const yy = Math.max(2, Math.min(tiles.length - 1, y));
    const xx = Math.max(0, Math.min(15, x));
    return tiles[yy]?.[xx] ?? '#';
  };
  const wetAt = (x: number, y: number): boolean => WET.has(ch(x, y));
  const PLAIN = ['#', ',', 'o', ':', '*'];
  const baseAt = (x: number, y: number): string => {
    const n = [ch(x - 1, y), ch(x + 1, y), ch(x, y + 1), ch(x, y - 1)].filter((c) => PLAIN.includes(c));
    let best = '#';
    let most = 0;
    for (const k of PLAIN) {
      const m = n.filter((c) => c === k).length;
      if (m > most) {
        most = m;
        best = k;
      }
    }
    return best;
  };
  const plain = (c: string, v: number): string => {
    if (c === ',') return moss(v);
    if (c === 'o') return ice(v);
    if (c === ':') return deck(v);
    if (c === '*') return flesh(v);
    return dirt(v);
  };
  /** Each plain ground's layer: the surface's moss and ice high, the decks and dirt below, the
   * plutonium floor lowest; a tile below its neighbour shows the drop (dropEdge). */
  const LAYER: Record<string, number> = { ',': 3, o: 3, ':': 2, '#': 2, '*': 1 };
  const layerAt = (x: number, y: number): number => {
    const c = ch(x, y);
    if (y < 2 || x < 0 || x > 15) return -1;
    if (PLAIN.includes(c)) return LAYER[c] as number;
    if (SHORE.includes(c) || 'THRAZXYSPJ'.includes(c)) return LAYER[baseAt(x, y)] ?? -1;
    return -1;
  };
  const withDrop = (g: string, x: number, y: number): string => {
    const me = layerAt(x, y);
    if (me < 0) return g;
    const hi = (dx: number, dy: number) => layerAt(x + dx, y + dy) > me;
    return dropEdge(g, { n: hi(0, -1), e: hi(1, 0), s: false, w: hi(-1, 0) });
  };
  const f0: string[] = [];
  const f1: string[] = [];
  const wet: boolean[] = [];
  const scenery: AbovePiece[] = [];
  const tile = (i: number): void => {
    const x = i & 15;
    const y = i >> 4;
    const c = tiles[y]?.[x] ?? '#';
    const v = Math.floor(hash(x, y, 7) * 4);
    const w = y >= 2 && WET.has(c);
    wet.push(w);
    if (w) {
      const sides: Sides = { n: wetAt(x, y - 1), e: wetAt(x + 1, y), s: wetAt(x, y + 1), w: wetAt(x - 1, y) };
      let corners = '';
      if (sides.n && sides.w && !wetAt(x - 1, y - 1)) corners += 'a';
      if (sides.n && sides.e && !wetAt(x + 1, y - 1)) corners += 'b';
      if (sides.s && sides.e && !wetAt(x + 1, y + 1)) corners += 'c';
      if (sides.s && sides.w && !wetAt(x - 1, y + 1)) corners += 'd';
      f0.push(lake(sides, corners, 0));
      f1.push(lake(sides, corners, 1));
      return;
    }
    let g: string;
    if (y < 2) g = band(x);
    else if (c === '^' || c === 'G') {
      const cl = (k: string) => k === '^' || k === 'G';
      const s: Sides = { n: cl(ch(x, y - 1)), e: cl(ch(x + 1, y)), s: cl(ch(x, y + 1)), w: cl(ch(x - 1, y)) };
      g = c === 'G' ? stairs() : cliff(s);
    } else if (PLAIN.includes(c)) g = withDrop(plain(c, v), x, y);
    else g = withDrop(plain(baseAt(x, y), v), x, y);
    f0.push(g);
    f1.push(g);
    const stand = (fr: string, dy = 0): void =>
      void scenery.push({ frame: fr, x: x * 16, y: y * 16 + dy, feet: y * 16 + 16 });
    if (c === 'T') stand(gnarled(), -16);
    else if (c === 'H') stand(shrub());
    else if (c === 'R') stand(boulder());
    else if (c === 'A') stand(iceSpire(), -16);
    else if (c === 'Z') stand(ruin(), -16);
    else if (c === 'X') stand(pylon(), -16);
    else if (c === 'Y') stand(growth(), -16);
    else if (c === 'S') stand(iceBlock());
    else if (c === 'P') stand(vent());
    else if (c === 'J') stand(eggs());
  };
  return { count: tiles.length * 16, tile, out: { frames: [f0, f1], wet, scenery } };
}

/**
 * Every frame of the sheet, with the grounds of the pages given, as small painting steps: a frame
 * or a few small ones, a road join, a ground tile (a landmark is one step: it paints as a whole).
 */
function paintSteps(pages: readonly (readonly string[])[]): (() => void)[] {
  const steps: (() => void)[] = [];
  const add = (f: () => unknown): void => void steps.push(() => void f());
  for (let v = 0; v < 4; v++) {
    add(() => dirt(v));
    add(() => moss(v));
    add(() => ice(v));
    add(() => deck(v));
    add(() => flesh(v));
  }
  add(gnarled);
  add(shrub);
  add(boulder);
  add(iceSpire);
  add(ruin);
  add(pylon);
  add(growth);
  add(iceBlock);
  add(vent);
  add(eggs);
  add(pipeTunnel);
  add(mossShaft);
  add(radPit);
  add(hatch);
  add(technoTower);
  add(iceArch);
  add(nodeFrames);
  steps.push(...roadSteps(book, 'road', ROAD_INK));
  for (const tiles of pages) steps.push(...groundSteps(tiles));
  return steps;
}

/**
 * The `underworld-above` sheet: every frame, with the grounds of the pages given (after autoShore),
 * painted the first time the game draws from it, or ahead of that in slices while a map idles
 * (lazySheet), never when the game loads.
 */
export function underworldAboveSheet(pages: readonly (readonly string[])[]): LazySheetDef {
  return lazySheet(
    'underworld-above',
    () => paintSteps(pages),
    () => F,
  );
}

/** How many of the sheet's frames are painted so far (0 until World 8 first shows). */
export const underworldPainted = (): number => book.size;
