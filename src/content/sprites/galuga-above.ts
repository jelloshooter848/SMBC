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
  space,
  type SpaceInk,
  stairs as kitStairs,
  type Sides,
  sideKey,
  water as kitWater,
  type WaterInk,
} from './above-kit';

/*
 * World 7, GALUGA ISLAND, drawn from above in campaign play (0.4.53, TD58's approved design), in the
 * 3/4 view of World 1's Mushroom Kingdom (sprites/kingdom.ts), laid out like a run-and-gun's first
 * stage: golden rock cliffs topped with jungle canopy, a river falling over them into the jungle
 * and out to a blue sea, a steel girder bridge, a snowfield with pillboxes and a bunker under the
 * far snowy peaks, Bill's camp in the jungle, the enemy base's blue steel wall and, at its foot,
 * the alien lair. Original art drawn from shapes; nothing traced from the owner's reference.
 *
 * Palette `galuga-above` (index: role):
 *   0 outline   1-3 jungle floor (dark, mid, light)   4-6 dirt track (rim, body, light)
 *   7-9 steel (dark, mid, light)   a-c canopy (dark, mid, light)   d trunk
 *   e-g sea (dark, mid, light)   h-j cliff rock (dark, mid, light)   k-m base blue (dark, mid, light)
 *   n-o sand (light, dark)   p-r alien flesh (dark, mid, light)   s gold   t red   u bone
 *   v white   w snow shade   x snow   y frond light   z black
 */
export const GALUGA_ABOVE_PALETTE: readonly string[] = [
  '#100c08', // 0 outline
  '#1a4412', // 1 jungle floor dark
  '#2a6418', // 2 jungle floor
  '#46902a', // 3 jungle floor light
  '#6a4820', // 4 track rim
  '#b48c4c', // 5 track
  '#e6c88c', // 6 track light
  '#4a5260', // 7 steel dark
  '#8a94a6', // 8 steel
  '#d2dae6', // 9 steel light
  '#0c2c0e', // a canopy dark
  '#1c5418', // b canopy
  '#42982c', // c canopy light
  '#4a2c10', // d trunk
  '#0c2a78', // e sea dark
  '#1a52c2', // f sea
  '#72b2f8', // g sea light
  '#5a3a10', // h rock dark
  '#9a6a1e', // i rock
  '#d4a440', // j rock light
  '#141a5a', // k base dark
  '#2a3aa8', // l base
  '#6a7ae0', // m base light
  '#ead290', // n sand
  '#bc9c58', // o sand dark
  '#5a1028', // p flesh dark
  '#a42a4a', // q flesh
  '#e46a7a', // r flesh light
  '#f8d040', // s gold
  '#d82818', // t red
  '#e8dcc0', // u bone
  '#fcfcfc', // v white
  '#9ab0d2', // w snow shade
  '#dce8f8', // x snow
  '#8ad050', // y frond light
  '#080808', // z black
];

const book = new FrameBook();
const F = book.frames;
const frame = book.frame.bind(book);

/* ---------------------------------------------------------------------------------------------- */
/* Ground                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

/** Jungle floor ('#'): mid green, fern sprigs and fallen-leaf specks. */
export function floor(v: number): string {
  return frame(`floor-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, '2');
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(hash(v, i, 1) * 12) + 2;
      const y = Math.floor(hash(v, i, 2) * 12) + 2;
      c.set(x, y, '1');
      c.set(x - 1, y - 1, '1');
      c.set(x + 1, y - 1, '1');
      c.set(x, y - 2, '3');
    }
    for (let i = 0; i < 3; i++) c.set(Math.floor(hash(v, i, 3) * 16), Math.floor(hash(v, i, 4) * 16), '3');
  });
}

/** Beach sand (':', and the shores along the sea): pale sand, shell specks. */
export function sand(v: number): string {
  return frame(`sand-${v}`, 16, 16, (c) => {
    c.each((x, y) => {
      const r = hash(x, y, v, 11);
      return r < 0.07 ? 'o' : r > 0.97 ? 'v' : 'n';
    });
  });
}

/** Snow ('o'): white with blue drifts. */
export function snow(v: number): string {
  return frame(`snow-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 'x');
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(hash(v, i, 21) * 12);
      const y = Math.floor(hash(v, i, 22) * 13) + 1;
      c.rect(x, y, 5, 1, 'v');
      c.rect(x + 1, y + 1, 3, 1, 'w');
    }
  });
}

/**
 * The jungle canopy ('5'): a mass of round crowns lit from the top left; where it ends, the crowns'
 * rims and their shadow on the ground. Joins its neighbours.
 */
export function canopy(s: Sides, odd: boolean): string {
  return frame(`canopy-${sideKey(s)}-${odd ? 1 : 0}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, s.s ? 'a' : '1');
    // Crowns on a staggered 8 px grid (whole page coordinates repeat every 16 px), each a lumpy
    // disc lit on its upper left with a dark rim, so the mass reads as separate treetops.
    const blobs: [number, number, number][] = [];
    for (let j = -1; j <= 3; j++)
      for (let i = -1; i <= 3; i++) {
        const bx = i * 8 + (j % 2 ? 4 : 0) + (odd ? 2 : 0) + hash(i, j, 33) * 2;
        const by = j * 6 + 1 + hash(i, j, 34) * 2;
        const out = (bx < 1 && !s.w) || (bx > 14 && !s.e) || (by < 1 && !s.n) || (by > 11 && !s.s);
        if (!out) blobs.push([bx, by, 5 + hash(i, j, 35) * 1.5]);
      }
    c.each((x, y) => {
      // The nearest crown in front (lower crowns overlap upper ones, as seen from the south).
      let pick: [number, number, number] | null = null;
      let pd = 9;
      for (const b of blobs) {
        const d = Math.hypot(x + 0.5 - b[0], (y + 0.5 - b[1]) * 1.1) / b[2];
        if (d <= 1 && (!pick || b[1] > pick[1])) {
          pick = b;
          pd = d;
        }
      }
      if (!pick) return null;
      if (pd > 0.86) return 'a';
      const lx = x + 0.5 - pick[0] + (y + 0.5 - pick[1]);
      if (lx < -3.5 && pd < 0.7) return 'y';
      if (lx < -0.5) return 'c';
      if (lx > 3.5) return 'a';
      return hash(x, y, 31) < 0.12 ? 'a' : 'b';
    });
  });
}

const CLIFF_INK = (top: 'snow' | 'jungle'): CliffInk => ({
  top: top === 'snow' ? 'x' : 'b',
  topLight: top === 'snow' ? 'v' : 'c',
  dark: 'h',
  body: 'i',
  light: 'j',
  crack: '0',
  below: '2',
  shade: '1',
  outline: '0',
});
/** The island's golden rock cliffs ('^'), snow or canopy along their lip. */
export const cliff = (s: Sides, top: 'snow' | 'jungle'): string =>
  kitCliff(book, `cliff-${top}`, s, CLIFF_INK(top));

/** Rock steps cut down a cliff ('G'). */
export const stairs = (top: 'snow' | 'jungle'): string =>
  kitStairs(book, `stairs-${top}`, cliff({ n: false, e: true, s: false, w: true }, top), {
    dark: 'h',
    body: 'i',
    light: 'j',
    outline: '0',
  });

/** The waterfall ('≡'): white water pouring down the cliff, foam boiling at its foot (2 frames). */
export function falls(s: Sides, f: number): string {
  return frame(`falls-${sideKey(s)}-${f}`, 16, 16, (c) => {
    c.each((x, y) => {
      const r = hash(x, (y + f * 3) % 16, 41);
      return r < 0.25 ? 'g' : r < 0.55 ? 'v' : 'f';
    });
    for (let y = 0; y < 16; y++) {
      if (!s.w) c.set(0, y, 'h');
      if (!s.e) c.set(15, y, 'h');
    }
    if (!s.n) c.rect(0, 0, 16, 2, 'g');
    for (let x = 0; x < 16; x++) if (hash(x, f, 42) < 0.6) c.set(x, 14 + (x % 2), 'v');
  });
}

/** The band under the header: the far snowy peaks over the island. */
export function band(x: number): string {
  const v = x % 3;
  return frame(`band-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 'k');
    for (const [px, py] of [
      [3 + v * 2, 1],
      [12 - v, 4],
    ] as [number, number][])
      c.each((x, y) => {
        const h = py + Math.abs(x + 0.5 - px) * 1.2;
        if (y < h) return null;
        if (y < h + 4) return x < px ? 'v' : 'x';
        return x < px ? '8' : '7';
      });
    c.rect(0, 13, 16, 3, 'w');
  });
}

const SEA: WaterInk = { deep: 'e', mid: 'f', light: 'g', land: 'n', bankLight: 'n', bank: 'o', face: 'o' };
const RIVER: WaterInk = { deep: 'e', mid: 'f', light: 'g', land: '2', bankLight: 'j', bank: 'i', face: 'h' };
/** Water ('~'): the sea, banked with sand, or the river, banked with rock. */
export const water = (s: Sides, corners: string, f: number, sea: boolean): string =>
  kitWater(book, sea ? 'sea' : 'river', s, corners, f, sea ? SEA : RIVER);

/* ---------------------------------------------------------------------------------------------- */
/* Small scenery                                                                                   */
/* ---------------------------------------------------------------------------------------------- */

/** A jungle palm, 16×32: a ringed curving trunk under a star of fronds. */
export function palm(): string {
  return frame('palm', 16, 32, (c) => {
    shadow(c, 8, 29, 6, 2, '1');
    for (let y = 12; y < 30; y++) {
      const x = 7 + Math.round(Math.sin(y / 6) * 1.5);
      c.rect(x, y, 3, 1, y % 3 ? 'i' : 'd');
      c.set(x, y, 'j');
    }
    const fronds: [number, number][] = [
      [-7, 3],
      [7, 3],
      [-5, -4],
      [5, -4],
      [0, -7],
      [-6, 6],
      [6, 7],
    ];
    for (const [dx, dy] of fronds)
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const x = Math.round(8 + dx * t);
        const y = Math.round(10 + dy * t + t * t * 3);
        c.set(x, y, t < 0.5 ? 'c' : 'b');
        c.set(x, y + 1, 'a');
        if (k % 2) c.set(x + (dx > 0 ? 0 : 0), y - 1, 'y');
      }
    c.ellipse(8, 10, 2, 1.5, 'd');
    c.outline('0', (_x, y) => y < 29);
  });
}

/** A snowy pine, 16×32. */
export function pine(): string {
  return frame('pine', 16, 32, (c) => {
    shadow(c, 8, 29, 6, 2, 'w');
    c.rect(7, 25, 3, 5, 'd');
    for (const [by, hw] of [
      [24, 7],
      [17, 6],
      [10, 4.5],
    ] as [number, number][])
      for (let y = by - 8; y <= by; y++) {
        const t = (y - (by - 8)) / 8;
        const w = Math.max(1, Math.round(hw * t + 1));
        for (let x = 8 - w; x <= 8 + w - 1; x++) {
          const capped = y - (by - 8) < 3 + (x % 3 === 0 ? 1 : 0);
          c.set(x, y, capped ? (x < 8 ? 'v' : 'x') : x === 8 - w || y === by ? 'a' : x < 7 ? 'c' : 'b');
        }
      }
    c.outline('0', (_x, y) => y > 1 && y < 29);
  });
}

/** A pillbox sensor dug into the snow: a steel dome, a dark gun slit, a red lens. */
export function pillbox(): string {
  return frame('pillbox', 16, 16, (c) => {
    shadow(c, 8, 12, 7, 2.5, 'w');
    c.ellipse(8, 9, 7, 5.5, (x, y, d) => (d > 0.75 ? '7' : x + y < 13 ? '9' : '8'));
    c.rect(3, 9, 10, 2, 'z');
    c.rect(7, 9, 2, 2, 't');
    c.ellipse(6, 5.5, 4, 1.5, 'v');
    c.outline('0');
  });
}

/** A jungle bush. */
export function bush(): string {
  return frame('bush', 16, 16, (c) => {
    shadow(c, 8, 12, 7, 3, '1');
    c.ellipse(8, 8.5, 7, 6, (x, y, d) => (d > 0.78 ? 'a' : x + y < 13 && d < 0.4 ? 'y' : 'c'));
    for (const [x, y] of [
      [5, 6],
      [10, 9],
    ] as [number, number][])
      c.set(x, y, 't');
    c.outline('0', (_x, y) => y > 4);
  });
}

/** A golden boulder (on snow, capped with snow). */
export function rock(snowy: boolean): string {
  return frame(snowy ? 'rock-snow' : 'rock', 16, 16, (c) => {
    shadow(c, 8, 12, 6, 2.5, snowy ? 'w' : '1');
    c.ellipse(8, 9, 6.5, 5, (x, y, d) => (d > 0.75 ? 'h' : x + y < 14 ? 'j' : 'i'));
    if (snowy) c.ellipse(7, 6.5, 5, 2.5, (x) => (x < 8 ? 'v' : 'x'));
    c.outline('0');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Landmarks                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

/** A snowy mountain, 32×32 (the snowfield's north edge): grey rock under a white cap. */
export function mountain(): string {
  return frame('mountain', 32, 32, (c) => {
    shadow(c, 16, 28, 14, 3, 'w');
    c.each((x, y) => {
      const h = 2 + Math.abs(x + 0.5 - 15) * 1.6;
      if (y < h || y > 29) return null;
      if (y < h + 7 - (x % 3)) return x < 15 ? 'v' : 'x';
      return x < 15 ? '8' : '7';
    });
    c.outline('0', (_x, y) => y < 29);
  });
}

/** The enemy bunker by 7-1, 32×32: a concrete box half sunk in the snow, a gun slit, a red light. */
export function bunker(): string {
  return frame('bunker', 32, 32, (c) => {
    shadow(c, 16, 28, 14, 3, 'w');
    // Roof slab, snow on it.
    c.rect(2, 6, 28, 12, '8');
    c.rect(2, 6, 28, 2, '9');
    c.ellipse(12, 9, 9, 3, (x) => (x < 12 ? 'v' : 'x'));
    c.rect(26, 6, 4, 12, '7');
    // Front wall with the slit and a steel door.
    c.rect(2, 18, 28, 11, '7');
    c.rect(4, 20, 14, 3, 'z');
    c.rect(9, 20, 2, 3, 't');
    c.rect(21, 19, 7, 10, 'l');
    c.rect(22, 20, 5, 9, 'k');
    c.rect(24, 23, 1, 2, 's');
    // Antenna.
    c.rect(6, 0, 1, 7, '9');
    c.set(6, 0, 't');
    c.outline('0');
  });
}

/**
 * The steel girder bridge, 48×32, east-west over the two-tile river: a plated deck between truss
 * rails, riveted posts, the girders' dark underside over the water on its south face.
 */
export function steelBridge(): string {
  return frame('steel-bridge', 48, 32, (c) => {
    c.each((x, y) => {
      if (y < 20 || y > 25 || x < 4 || x > 43) return null;
      return y === 25 ? '7' : (x + y) % 6 < 2 ? '7' : '8';
    });
    c.each((x, y) => {
      if (y < 9 || y > 19 || x < 2 || x > 45) return null;
      if (y === 9) return '9';
      return x % 4 === 0 ? '7' : '8';
    });
    for (const py of [5, 17]) {
      c.rect(2, py, 44, 3, '7');
      c.rect(2, py, 44, 1, '9');
      for (let x = 3; x < 46; x += 5) {
        c.set(x, py + 1, '9');
        c.set(x + 2, py + 2, 't');
      }
    }
    for (const [px, py] of [
      [1, 2],
      [41, 2],
      [1, 14],
      [41, 14],
    ] as [number, number][]) {
      c.rect(px, py + 2, 6, 7, '8');
      c.rect(px + 5, py + 2, 1, 7, '7');
      c.rect(px, py + 2, 6, 1, '9');
    }
    c.outline('0');
  });
}

/**
 * The enemy base's wall, 48×48: blue steel plates in tiers, a red sensor core and gun ports, its
 * flat top lit along the edge (the run-and-gun's first stage ends at one).
 */
export function baseWall(): string {
  return frame('base-wall', 48, 48, (c) => {
    shadow(c, 24, 45, 22, 2.5, '1');
    // Top (seen from above): a walkway with a railing.
    c.rect(2, 2, 44, 12, 'l');
    c.rect(2, 2, 44, 2, 'm');
    for (let x = 4; x < 46; x += 4) c.rect(x, 5, 1, 8, 'k');
    // Towers at each end, rising higher.
    for (const tx of [0, 36]) {
      c.rect(tx, 0, 12, 46, 'l');
      c.rect(tx, 0, 12, 2, 'm');
      c.rect(tx, 0, 2, 46, 'm');
      c.rect(tx + 10, 0, 2, 46, 'k');
      for (let y = 18; y < 42; y += 8) {
        c.rect(tx + 3, y, 6, 3, 'z');
        c.set(tx + 5, y + 1, 't');
      }
    }
    // The face: plates in rows.
    c.each((x, y) => {
      if (x < 12 || x > 35 || y < 14 || y > 45) return null;
      if (y % 8 === 6 || x % 12 === 0) return 'k';
      return y % 8 < 2 ? 'm' : 'l';
    });
    // The red sensor core.
    c.ellipse(24, 30, 6, 6, (x, y, d) => (d > 0.7 ? '7' : d > 0.35 ? 't' : x + y < 54 ? 'v' : 's'));
    c.outline('0');
  });
}

/** Bill's camp by 7-3, 32×24: an olive tent with its flap open, a crate and a camp fire. */
export function camp(): string {
  return frame('camp', 32, 24, (c) => {
    shadow(c, 16, 21, 14, 2, '1');
    c.each((x, y) => {
      const h = 2 + Math.abs(x + 0.5 - 12) * 1.1;
      if (x > 23 || y < h || y > 20) return null;
      return x < 12 ? '3' : 'b';
    });
    c.rect(9, 12, 6, 9, 'z');
    c.rect(12, 2, 1, 19, 'a');
    // Crate and fire.
    c.rect(25, 13, 6, 6, 'd');
    c.rect(25, 13, 6, 1, 'i');
    c.rect(27, 15, 2, 2, 's');
    c.outline('0');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Node markers                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

const INK = (body: string, dark: string, light: string, mark: string): SpaceInk => ({
  shadow: '1',
  dark,
  body,
  light,
  mark,
  outline: '0',
});
const RING = { dark: '7', light: '9' };

/**
 * The alien lair (7-4, the castle node), 32×40 standing on its tile: a mound of ribbed flesh with
 * bone horns, an egg clutch, its fanged maw open and glowing; cleared, grey and shut.
 */
function lair(cleared: boolean): string {
  return frame(cleared ? 'lair-cleared' : 'lair', 32, 40, (c) => {
    shadow(c, 16, 37, 14, 2.5, '1');
    const [dk, md, lt] = cleared ? ['7', '8', '9'] : ['p', 'q', 'r'];
    c.ellipse(16, 26, 14, 12, (x, y, d) => {
      if (y > 37) return null;
      if (d > 0.82) return dk;
      if ((y + Math.round(Math.sin(x / 2) * 1.5)) % 5 === 0) return dk;
      return x + y < 34 ? lt : md;
    });
    // Horns.
    for (const s of [-1, 1]) {
      for (let k = 0; k < 12; k++) {
        const x = 16 + s * (6 + k * 0.7);
        const y = 16 - k * 1.2 + (k * k) / 14;
        c.rect(Math.round(x) - 1, Math.round(y), k < 8 ? 3 : 2, 2, 'u');
      }
    }
    // Eggs.
    for (const [x, y] of [
      [5, 30],
      [8, 33],
      [26, 31],
    ] as [number, number][])
      c.ellipse(x, y, 2.5, 2, (xx) => (xx < x ? 'u' : cleared ? '8' : 'r'));
    // The maw.
    c.ellipse(16, 28, 7, 6, cleared ? dk : 'z');
    if (!cleared) {
      c.ellipse(16, 30, 4, 3, (_x, _y, d) => (d < 0.4 ? 's' : 't'));
      for (const x of [11, 14, 17, 20]) {
        c.rect(x, 23, 1, 3, 'u');
        c.rect(x + 1, 32, 1, 2, 'u');
      }
    }
    c.outline('0');
  });
}

/** The bonus spot: a weapon-capsule pad, a winged gold emblem on red (used: grey). */
function capsulePad(used: boolean): string {
  return frame(used ? 'bonus-used' : 'bonus', 16, 16, (c) => {
    c.ellipse(8.5, 10, 7.5, 5, '1');
    c.ellipse(8, 9, 7, 5, (_x, y, d) => (d > 0.75 ? (y > 9 ? '7' : '9') : used ? '8' : 't'));
    const col = used ? '7' : 's';
    // Wings.
    for (let k = 0; k < 4; k++) {
      c.set(7 - k, 8 - (k >> 1), col);
      c.set(9 + k, 8 - (k >> 1), col);
      c.set(7 - k, 9 - (k >> 1), col);
      c.set(9 + k, 9 - (k >> 1), col);
    }
    c.rect(7, 7, 3, 5, col);
    if (!used) c.set(8, 8, 'v');
    c.outline('0');
  });
}

export function nodeFrames(): Record<string, string> {
  return {
    open: space(book, 'node-open', INK('t', 'p', 'r', 'v'), 'none', RING),
    cleared: space(book, 'node-cleared', INK('f', 'e', 'g', 'v'), 'star', RING),
    start: space(book, 'node-start', INK('c', 'a', 'y', 'v'), 'none', RING),
    secret: space(book, 'node-secret', INK('r', 'q', 'v', 'z'), 'key', RING),
    secretCleared: space(book, 'node-secret-cleared', INK('v', 'r', 'v', 'z'), 'key', RING),
    bonus: capsulePad(false),
    bonusUsed: capsulePad(true),
    castle: lair(false),
    castleCleared: lair(true),
  };
}

/** The node marker on a GALUGA ISLAND page (above-render AboveLook.node). */
export function galugaNodeFrame(
  kind: MapNode['kind'],
  s: { cleared: boolean; secret: boolean },
): string | null {
  if (kind === 'castle') return s.cleared ? 'lair-cleared' : 'lair';
  if (kind === 'bonus') return s.cleared ? 'bonus-used' : 'bonus';
  if (kind === 'start') return 'node-start';
  if (kind !== 'level') return null;
  if (s.secret) return s.cleared ? 'node-secret-cleared' : 'node-secret';
  return s.cleared ? 'node-cleared' : 'node-open';
}

/* ---------------------------------------------------------------------------------------------- */
/* A page's ground                                                                                 */
/* ---------------------------------------------------------------------------------------------- */

/** The open roads: a pale dirt track with a light halo. */
const ROAD_INK = { rim: '4', body: '5', light: '6', speck: '4', halo: '6' };

/** The road joins' names, by mask (1 n, 2 e, 4 s, 8 w); painted with the sheet. */
export const GALUGA_ROAD_FRAMES: readonly string[] = roadNames('road');

const WET = new Set(['~', '=', 'I', '≡']);
const SHORE = '82461397qezc[]nu';
const grounds = new WeakMap<readonly string[], AboveGround>();

/**
 * The ground of a GALUGA ISLAND page (world7-galuga.ts's legend). Water at row 12 or below is the
 * sea (sandy banks); above it, the river (rock banks). A shore tile is sand by the sea, snow in the
 * snowfield, jungle floor elsewhere.
 */
export function galugaGround(tiles: readonly string[]): AboveGround {
  const hit = grounds.get(tiles);
  if (hit) return hit;
  const b = groundBuilder(tiles);
  for (let i = 0; i < b.count; i++) b.tile(i);
  grounds.set(tiles, b.out);
  return b.out;
}

/** galugaGround's steps: one ground tile each (a lazy sheet's prepaint), then the cache. */
function groundSteps(tiles: readonly string[]): (() => void)[] {
  if (grounds.has(tiles)) return [];
  const b = groundBuilder(tiles);
  return [
    ...Array.from({ length: b.count }, (_, i) => () => b.tile(i)),
    () => void (grounds.has(tiles) || grounds.set(tiles, b.out)),
  ];
}

/** Works out a GALUGA ISLAND page's ground a tile at a time, in row order (`tile(i)`, i < count). */
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
  const sea = (y: number) => y >= 12;
  const baseAt = (x: number, y: number): string => {
    const n = [ch(x - 1, y), ch(x + 1, y), ch(x, y + 1), ch(x, y - 1)];
    if (
      SHORE.includes(ch(x, y)) &&
      [
        [0, 1],
        [1, 0],
        [-1, 0],
        [1, 1],
        [-1, 1],
      ].some(([dx, dy]) => wetAt(x + (dx as number), y + (dy as number)) && sea(y + (dy as number)))
    )
      return ':';
    for (const k of ['o', ':'])
      if (
        n.filter((c) => c === k).length >= 1 &&
        n.filter((c) => c === k).length >= n.filter((c) => c === '#' || c === '5').length
      )
        return k;
    return '#';
  };
  const plain = (c: string, v: number): string => (c === 'o' ? snow(v) : c === ':' ? sand(v) : floor(v));
  /** A cliff tile, or a shore tile between cliff pieces (the cliff runs on beside the falls). */
  const cliffy = (x: number, y: number): boolean => {
    const c = ch(x, y);
    if (c === '^' || c === 'G') return true;
    const l = ch(x - 1, y);
    const r = ch(x + 1, y);
    return SHORE.includes(c) && '^G≡'.includes(l) && '^G≡'.includes(r) && l + r !== '≡≡';
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
      if (c === '≡') {
        f0.push(falls(sides, 0));
        f1.push(falls(sides, 1));
        return;
      }
      let corners = '';
      if (sides.n && sides.w && !wetAt(x - 1, y - 1)) corners += 'a';
      if (sides.n && sides.e && !wetAt(x + 1, y - 1)) corners += 'b';
      if (sides.s && sides.e && !wetAt(x + 1, y + 1)) corners += 'c';
      if (sides.s && sides.w && !wetAt(x - 1, y + 1)) corners += 'd';
      f0.push(water(sides, corners, 0, sea(y)));
      f1.push(water(sides, corners, 1, sea(y)));
      return;
    }
    let g: string;
    if (y < 2) g = band(x);
    else if (c === '^' || c === 'G') {
      const cl = (k: string) => k === '^' || k === 'G';
      const top = ch(x, y - 1) === 'o' || ch(x - 1, y - 1) === 'o' || x < 7 ? 'snow' : 'jungle';
      const s: Sides = {
        n: cl(ch(x, y - 1)),
        e: cl(ch(x + 1, y)) || ch(x + 1, y) === '≡',
        s: cl(ch(x, y + 1)),
        w: cl(ch(x - 1, y)) || ch(x - 1, y) === '≡',
      };
      g = c === 'G' ? stairs(top) : cliff(s, top);
    } else if (c === '5')
      g = canopy(
        {
          n: ch(x, y - 1) === '5' || y === 2,
          e: ch(x + 1, y) === '5' || x === 15,
          s: ch(x, y + 1) === '5',
          w: ch(x - 1, y) === '5',
        },
        (x + y) % 2 === 1,
      );
    else if (c === 'o' || c === ':') g = plain(c, v);
    else if (cliffy(x, y))
      g = cliff({ n: cliffy(x, y - 1), e: true, s: cliffy(x, y + 1), w: true }, x < 7 ? 'snow' : 'jungle');
    else g = plain(baseAt(x, y), v);
    f0.push(g);
    f1.push(g);
    const stand = (fr: string, dy = 0): void =>
      void scenery.push({ frame: fr, x: x * 16, y: y * 16 + dy, feet: y * 16 + 16 });
    if (c === 'T') stand(palm(), -16);
    else if (c === 'Y') stand(pine(), -16);
    else if (c === 'X') stand(pillbox());
    else if (c === 'H') stand(bush());
    else if (c === 'R') stand(rock(baseAt(x, y) === 'o'));
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
    add(() => floor(v));
    add(() => sand(v));
    add(() => snow(v));
  }
  add(palm);
  add(pine);
  add(pillbox);
  add(bush);
  add(() => rock(false));
  add(() => rock(true));
  add(mountain);
  add(bunker);
  add(steelBridge);
  add(baseWall);
  add(camp);
  add(nodeFrames);
  steps.push(...roadSteps(book, 'road', ROAD_INK));
  for (const tiles of pages) steps.push(...groundSteps(tiles));
  return steps;
}

/**
 * The `galuga-above` sheet: every frame, with the grounds of the pages given (after autoShore),
 * painted the first time the game draws from it, or ahead of that in slices while a map idles
 * (lazySheet), never when the game loads.
 */
export function galugaAboveSheet(pages: readonly (readonly string[])[]): LazySheetDef {
  return lazySheet(
    'galuga-above',
    () => paintSteps(pages),
    () => F,
  );
}

/** How many of the sheet's frames are painted so far (0 until World 7 first shows). */
export const galugaPainted = (): number => book.size;
