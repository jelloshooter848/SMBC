import type { MapNode } from '@game/map/types';
import { hash } from './paint';
import type { Canvas } from './paint';
import { type AboveGround, FrameBook, lazySheet, type LazySheetDef, shadow as kitShadow } from './above-kit';
import {
  type DeckInk,
  deckRoadNames,
  deckRoadSteps,
  type GroundLook,
  noise,
  type Pieces,
  RegionGrounds,
  ringSpace,
  stones,
} from './region-kit';

/*
 * TRANSYLVANIA from above (World 5 in campaign play, 0.4.52; TD54's approved design): Dracula's castle on its
 * crag in World 1's three-quarter view, its parts laid out the way NES Castlevania's route runs
 * through them. The dark forest outside on the left, the courtyard gate and entrance hall, the
 * red-brick great hall behind it, the blue battlements over the aqueduct, the clock tower, the
 * keep at the top under the moon; below the crag the town by the river, and the river running
 * down into the caves (the underground waterway). Original art drawn from shapes; nothing traced.
 *
 * Palette `transylvania-above` (index: role):
 *   0 outline   1 shadow (only shadows)   2-4 forest night green   5-8 grey stone (dark..pale)
 *   9-b magenta brick    c-e blue night stone    f-h water    i-k cave rock (orange)
 *   l-n cobbles (dark, mid, light)    o pale cream (road edge)    p gold (candles, windows)
 *   q moonlight    r-s wood    t-u red (drapes, roofs)    v white    w-x night sky (deep, purple)
 *   y violet (stained glass)    z black
 */
export const TRANSYLVANIA_ABOVE_PALETTE: readonly string[] = [
  '#0a0812', // 0 outline
  '#110b1a', // 1 shadow
  '#12261c', // 2 forest dark
  '#1f402a', // 3 forest
  '#3a6a40', // 4 forest light
  '#34344a', // 5 stone dark
  '#5e5e78', // 6 stone
  '#9a9ab2', // 7 stone light
  '#d8d8e6', // 8 stone pale
  '#4e1028', // 9 brick dark
  '#902448', // a brick
  '#cc5476', // b brick light
  '#161e56', // c blue dark
  '#2a4094', // d blue
  '#6482d6', // e blue light
  '#0a1638', // f water deep
  '#18367e', // g water
  '#5684d4', // h water light
  '#52260e', // i cave dark
  '#a05020', // j cave
  '#e28c46', // k cave light
  '#36281e', // l cobble dark
  '#72563e', // m cobble
  '#b08e66', // n cobble light
  '#f2deb0', // o cream
  '#f8c040', // p gold
  '#fff4c8', // q moonlight
  '#3a2014', // r wood dark
  '#764624', // s wood
  '#781014', // t red dark
  '#c82c2c', // u red
  '#f8f8f8', // v white
  '#1a1430', // w night deep
  '#3c2c64', // x night purple
  '#7a4ab4', // y violet glass
  '#000000', // z black
];

const book = new FrameBook();

/** A soft drop shadow in the sheet's shadow colour ('1'), below and right of a standing thing. */
const shadow = (c: Canvas, cx: number, cy: number, rx: number, ry: number): void =>
  kitShadow(c, cx, cy, rx, ry, '1');

/* ---------------------------------------------------------------------------------------------- */
/* Ground                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

/**
 * The parts of the land (a page's `ground` letters):
 *   f the forest outside    c the courtyard (grey flagstones)    r the great hall (red brick)
 *   b the battlements (blue stone)    k the keep's crag (dark slate)    u the town (cobbles)
 *   g the moor by the river    v the caves (orange rock)    n the night beyond the crag
 */
const ZONE: Readonly<Record<string, { dk: string; md: string; lt: string; rank: number }>> = {
  n: { dk: 'w', md: 'w', lt: 'x', rank: 0 },
  k: { dk: '5', md: '6', lt: '7', rank: 5 },
  b: { dk: 'c', md: 'd', lt: 'e', rank: 4 },
  r: { dk: '9', md: 'a', lt: 'b', rank: 4 },
  c: { dk: '5', md: '6', lt: '7', rank: 3 },
  f: { dk: '2', md: '3', lt: '4', rank: 2 },
  u: { dk: 'l', md: 'm', lt: 'n', rank: 2 },
  g: { dk: '2', md: '3', lt: 'x', rank: 1 },
  v: { dk: 'i', md: 'j', lt: 'k', rank: 1 },
};
const zone = (z: string) => ZONE[z] ?? (ZONE.f as (typeof ZONE)[string]);

function tex(z: string, x: number, y: number): string {
  switch (z) {
    case 'n': {
      // The night beyond the crag: deep sky, a purple haze low down, stars.
      if (hash(x, y, 501) < 0.012) return hash(x, y, 502) < 0.5 ? 'q' : 'v';
      return noise(x, y, 14, 503) > 0.62 ? 'x' : 'w';
    }
    case 'k':
      // The keep's crag: dark slate in big rough slabs.
      return stones(x, y, {
        sx: 11,
        sy: 8,
        seed: 504,
        gap: '5',
        dk: '5',
        mid: '6',
        lt: '7',
        cheb: true,
        crack: 1.1,
      });
    case 'c': {
      // Courtyard flagstones in courses, worn.
      const row = Math.floor(y / 6);
      const bx = (x + (row % 2 ? 5 : 0) + Math.floor(hash(row, 505) * 4)) % 10;
      const by = y % 6;
      if (by === 5 || bx === 0) return '5';
      if (by === 0 || bx === 1) return '7';
      return hash(Math.floor((x + (row % 2 ? 5 : 0)) / 10), row, 506) < 0.25 ? '5' : '6';
    }
    case 'r': {
      // The great hall's floor: magenta brick in herringbone-ish courses.
      const row = Math.floor(y / 4);
      const bx = (x + (row % 2 ? 4 : 0)) % 8;
      if (y % 4 === 3 || bx === 0) return '9';
      if (y % 4 === 0) return 'b';
      return hash(Math.floor((x + (row % 2 ? 4 : 0)) / 8), row, 507) < 0.2 ? 'b' : 'a';
    }
    case 'b': {
      // The battlements' walks: big blue stone blocks.
      const row = Math.floor(y / 8);
      const bx = (x + (row % 2 ? 6 : 0)) % 12;
      if (y % 8 === 7 || bx === 0) return 'c';
      if (y % 8 === 0 || bx === 1) return 'e';
      return hash(x, y, 508) < 0.08 ? 'c' : 'd';
    }
    case 'u': {
      // The town's cobbles.
      return stones(x, y, { sx: 5, sy: 4, seed: 509, gap: 'l', dk: 'l', mid: 'm', lt: 'n', crack: 1.0 });
    }
    case 'g': {
      // The moor: dark tussocky grass with a purple dusk sheen.
      const n = noise(x, y, 6, 510) + (hash(x, y, 511) - 0.5) * 0.3;
      if (hash(x, y, 512) < 0.04) return '4';
      return n < 0.42 ? '2' : n > 0.8 ? 'x' : '3';
    }
    case 'v':
      // The caves: orange rock.
      return stones(x, y, { sx: 8, sy: 6, seed: 513, gap: 'i', dk: 'i', mid: 'j', lt: 'k', crack: 1.2 });
    default: {
      // The forest floor: dark grass, fallen needles.
      const n = noise(x, y, 5, 514) + (hash(x, y, 515) - 0.5) * 0.35;
      return n < 0.4 ? '2' : n > 0.85 ? '4' : '3';
    }
  }
}

const LOOK: GroundLook = {
  prefix: 'tv5',
  wet: new Set(['~', '=', 'I']),
  cliff: new Set(['C']),
  tex,
  rank: (z) => zone(z).rank,
  seam: (z) => ({ line: '0', lip: zone(z).lt, face: zone(z).dk }),
  liquid(_ch, z, x, y, d, f) {
    if (d < 1.5) return null;
    if (z === 'v') {
      // The waterway in the caves: an orange rock rim.
      if (d < 2.5) return '0';
      if (d < 3.5) return 'i';
    } else {
      if (d < 2.5) return '0';
      if (d < 3.5) return z === 'b' || z === 'k' || z === 'c' ? '5' : '2';
    }
    // Night water: deep blue, moonlit ripples drifting.
    const r = (x + f * 2 + Math.floor(noise(x, y, 7, 521) * 7)) % 11;
    if (r === 0 && hash(x >> 2, y, 522) < 0.55) return 'h';
    if (r === 1 && hash(x >> 2, y, 522) < 0.55) return 'g';
    if (d < 5) return 'f';
    return noise(x, y, 9, 523) > 0.6 ? 'g' : 'f';
  },
  cliffFace(z, x, y, lx, ly, ends) {
    // The crag's face under the castle: rough stone courses, lit tops, a dark foot.
    const c = zone(z);
    const top = 2 + Math.floor(noise(x, y, 6, 531) * 2);
    if (ly < top) return null;
    if (ly === top) return c.lt;
    if (ly === top + 1) return c.md;
    if ((ends.w && lx === 0) || (ends.e && lx === 15)) return '0';
    if (ends.w && lx === 1) return c.lt;
    if (ends.e && lx === 14) return c.dk;
    const foot = 14 + Math.floor(noise(x, y, 4, 532) * 2);
    if (ly >= foot) return ly === 15 ? '0' : '5';
    const st = stones(x, y, { sx: 8, sy: 5, seed: 533, gap: '0', dk: '5', mid: '6', lt: '7', crack: 1.0 });
    if (ly > foot - 4 && st === '6' && hash(x, y, 534) < 0.5) return '5';
    // Moss and ivy here and there.
    if (noise(x, y, 5, 535) > 0.72 && hash(x, y, 536) < 0.6) return hash(x, y, 537) < 0.5 ? '3' : '4';
    return st;
  },
  special(ch, z, x, y, lx, ly) {
    if (ch !== 'G') return null;
    // Stone stairs up the crag: treads lit along their front edge, walls either side.
    if (lx < 2 || lx > 13) return LOOK.cliffFace(z, x, y, lx, ly, { w: false, e: false });
    if (lx === 2 || lx === 13) return '0';
    if (lx === 3 || lx === 12) return '5';
    const t = ly % 4;
    return t === 0 ? '8' : t === 3 ? '5' : '7';
  },
  band(x, y) {
    // Under the header: the night sky.
    if (hash(x, y, 541) < 0.02) return 'q';
    return y > 29 ? 'x' : 'w';
  },
};

/* ---------------------------------------------------------------------------------------------- */
/* Standing scenery                                                                                */
/* ---------------------------------------------------------------------------------------------- */

/** A dark pine of the forest outside, 16×32. */
function pine(): string {
  return book.frame('pine', 16, 32, (c) => {
    shadow(c, 8, 29, 6, 2.5);
    c.rect(7, 25, 3, 5, 'r');
    const tiers: [number, number, number][] = [
      [8, 25, 7],
      [8, 18, 6],
      [8, 11, 4.5],
    ];
    for (const [cx, by, hw] of tiers)
      for (let y = by - 8; y <= by; y++) {
        const t = (y - (by - 8)) / 8;
        const w = Math.max(1, Math.round(hw * t + 1));
        for (let x = cx - w; x <= cx + w - 1; x++) {
          const edge = x === cx - w || x === cx + w - 1 || y === by;
          c.set(x, y, edge ? '2' : x < cx - 1 ? '4' : hash(x, y, 551) < 0.18 ? '2' : '3');
        }
      }
    c.set(8, 2, '4');
    c.outline('0', (_x, y) => y < 29);
  });
}

/** A dead tree, 16×32: a bare black trunk, crooked branches. */
function deadTree(): string {
  return book.frame('dead-tree', 16, 32, (c) => {
    shadow(c, 8, 29, 5, 2);
    c.rect(7, 12, 3, 18, 's');
    c.rect(7, 12, 1, 18, 'r');
    const limb = (x0: number, y0: number, dx: number, n: number) => {
      for (let i = 0; i < n; i++) c.set(x0 + dx * i, y0 - Math.floor(i * 0.8), 's');
    };
    limb(6, 15, -1, 6);
    limb(10, 13, 1, 6);
    limb(8, 11, 0, 7);
    limb(5, 10, -1, 3);
    limb(12, 8, 1, 3);
    c.set(8, 4, 's');
    c.outline('0', (_x, y) => y < 29);
  });
}

/** A dark forest shrub, 16×16: a clump of needles (for the forest's edge where a pine won't fit). */
function shrub(): string {
  return book.frame('shrub', 16, 16, (c) => {
    shadow(c, 8, 12, 7, 2.5);
    for (const [x, y, r] of [
      [5, 9, 4.5],
      [11, 9, 4.5],
      [8, 6, 5],
    ] as [number, number, number][])
      c.ellipse(x, y, r, r * 0.85, (xx, yy, d) =>
        d > 0.75 ? '2' : xx + yy < x + y - 1 && hash(xx, yy, 552) < 0.6 ? '4' : '3',
      );
    c.outline('0', (_x, y) => y < 13);
  });
}

/** Graves: a rounded headstone and a leaning cross, 16×16. */
function graves(): string {
  return book.frame('graves', 16, 16, (c) => {
    shadow(c, 8, 13, 6, 2);
    c.rect(2, 6, 6, 8, '6');
    c.ellipse(5, 6, 3, 2.5, '6');
    c.rect(2, 6, 1, 8, '7');
    c.rect(4, 8, 2, 1, '5');
    c.rect(11, 4, 2, 10, '7');
    c.rect(9, 7, 6, 2, '7');
    c.rect(12, 5, 1, 9, '5');
    c.outline('0');
  });
}

/** A candelabrum on a stand (the castle's candles; Simon whips them), 16×24, its flames still. */
function candles(): string {
  return book.frame('candles', 16, 24, (c) => {
    shadow(c, 8, 21, 5, 2);
    c.rect(7, 8, 2, 13, '6');
    c.rect(4, 20, 8, 2, '5');
    c.rect(3, 9, 10, 2, '7');
    for (const x of [3, 7, 12]) {
      c.rect(x, 5, 1, 4, 'v');
      c.set(x, 3, 'p');
      c.set(x, 4, 'k');
    }
    c.outline('0');
  });
}

function boulder(z: string): string {
  const c = zone(z);
  return book.frame(`boulder-${z}`, 16, 16, (cv) => {
    shadow(cv, 8, 12, 6, 2.5);
    cv.ellipse(8, 9, 6.5, 5, (x, y, d) => (d > 0.75 ? c.dk : x + y < 14 ? c.lt : c.md));
    cv.outline('0');
  });
}

const pieces: Pieces = (ch, x, y, z) => {
  const at = (frame: string, h: number) => [{ frame, x: x * 16, y: y * 16 + 16 - h, feet: y * 16 + 16 }];
  if (ch === 'T') return at(z === 'f' ? pine() : deadTree(), 32);
  if (ch === 'J') return at(graves(), 16);
  if (ch === 'H') return at(shrub(), 16);
  if (ch === 'A') return at(candles(), 24);
  if (ch === 'R') return at(boulder(z), 16);
  return [];
};

/* ---------------------------------------------------------------------------------------------- */
/* Landmarks                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

/** Grey stone wall: courses of blocks, lit on top, the left lit, the right in shade. */
function wall(c: Canvas, x0: number, y0: number, w: number, h: number, shade: number): void {
  c.each((x, y) => {
    if (x < x0 || x >= x0 + w || y < y0 || y >= y0 + h) return null;
    const row = Math.floor((y - y0) / 4);
    const bx = (x - x0 + (row % 2 ? 3 : 0)) % 6;
    if ((y - y0) % 4 === 3 || bx === 0) return '5';
    return x > x0 + w * shade ? '6' : '7';
  });
}

/** Battlements along a wall's top: merlons `w` wide every `step` px. */
function merlons(c: Canvas, x0: number, x1: number, y: number, h = 3, col = '7'): void {
  for (let x = x0; x + 2 <= x1; x += 5) c.rect(x, y - h, 3, h, col);
}

/** A slate cone roof with its tip at (cx, top). */
function spire(c: Canvas, cx: number, top: number, h: number, hw: number): void {
  for (let y = top; y <= top + h; y++) {
    const w = hw * ((y - top) / h);
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w) - 1; x++)
      c.set(x, y, (y - top) % 3 === 2 ? 'c' : x < cx - w * 0.3 ? 'e' : 'd');
  }
}

/** A lit (gold) or dark arched window. */
function window(c: Canvas, x: number, y: number, w: number, h: number, col: string): void {
  c.rect(x, y + 1, w, h - 1, col);
  c.rect(x + 1, y, w - 2, 1, col);
}

/**
 * The courtyard gate and entrance hall, 48×48: two round grey towers with slate caps either side
 * of a high arched gate, its iron portcullis half up, a stone statue in a niche on each tower.
 */
export function gatehouse(): string {
  return book.frame('gatehouse', 48, 48, (c) => {
    shadow(c, 24, 45, 22, 3);
    // The hall behind, its red roof.
    wall(c, 10, 14, 28, 30, 0.6);
    c.each((x, y) =>
      x >= 8 && x <= 39 && y >= 6 && y < 14 + 0 && y >= 6 + Math.abs(x - 23.5) * 0.45
        ? x < 24
          ? 'u'
          : 't'
        : null,
    );
    merlons(c, 11, 37, 14, 3, '7');
    // The gate: a tall arch, the portcullis half raised, darkness beyond.
    c.ellipse(24, 30, 7, 6, '5');
    c.rect(17, 30, 14, 15, '5');
    c.ellipse(24, 30, 5.5, 4.8, 'z');
    c.rect(18.5, 30, 11, 15, 'z');
    for (let x = 19; x <= 29; x += 2) c.rect(x, 26, 1, 10, 's');
    c.rect(19, 30, 11, 1, 's');
    c.rect(19, 35, 11, 1, 's');
    // Towers.
    for (const tx of [7, 40]) {
      c.each((x, y) => {
        const dx = x + 0.5 - tx;
        if (Math.abs(dx) > 7 || y < 12 || y > 45) return null;
        return Math.abs(dx) > 5.5 ? '5' : dx < -1 ? '8' : dx < 3 ? '7' : '6';
      });
      for (let y = 15; y < 45; y += 4) c.rect(tx - 6, y, 13, 1, '5');
      spire(c, tx, 0, 12, 8);
      // A statue in its niche.
      c.rect(tx - 2, 22, 4, 8, '5');
      c.ellipse(tx, 23, 1.6, 1.6, '8');
      c.rect(tx - 1, 25, 2, 5, '7');
      window(c, tx - 1, 35, 2, 4, 'p');
    }
    c.outline('0');
  });
}

/**
 * The great hall, 64×48: a red-brick hall under a steep slate roof, tall stained-glass windows in
 * its front wall glowing violet and gold, a red drape over its door.
 */
export function greatHall(): string {
  return book.frame('great-hall', 64, 48, (c) => {
    shadow(c, 32, 45, 30, 3);
    // Front wall: magenta brick.
    c.each((x, y) => {
      if (x < 3 || x > 60 || y < 20 || y > 45) return null;
      const row = Math.floor(y / 3);
      const bx = (x + (row % 2 ? 2 : 0)) % 5;
      if (y % 3 === 2 || bx === 0) return '9';
      return x > 52 ? '9' : 'a';
    });
    // The roof: steep slate, ridge along the top.
    c.each((x, y) => {
      if (y < 4 || y > 20 || x < 1 || x > 62) return null;
      const inset = (20 - y) * 0.15;
      if (x < 1 + inset || x > 62 - inset) return null;
      if (y === 4) return 'e';
      return (y + Math.floor(x / 4)) % 3 === 0 ? 'c' : x > 48 ? 'c' : 'd';
    });
    c.rect(1, 20, 62, 1, '5');
    // Stained-glass windows.
    for (const wx of [8, 20, 38, 50]) {
      window(c, wx, 25, 6, 14, '5');
      c.each((x, y) =>
        x > wx && x < wx + 5 && y > 26 && y < 38
          ? (x + y) % 3 === 0
            ? 'p'
            : (x * 3 + y) % 5 < 2
              ? 'u'
              : 'y'
          : null,
      );
      c.rect(wx + 2, 26, 1, 12, '5');
    }
    // The door under a red drape.
    c.ellipse(32, 34, 5, 4, 'r');
    c.rect(27, 34, 10, 12, 'r');
    c.rect(28, 35, 8, 11, 's');
    c.rect(25, 24, 14, 6, 'u');
    c.rect(25, 29, 2, 7, 'u');
    c.rect(37, 29, 2, 7, 'u');
    c.rect(25, 24, 14, 1, 'p');
    // A little bell turret on the ridge.
    c.rect(29, 0, 6, 5, '6');
    c.rect(31, 1, 2, 3, 'z');
    c.outline('0');
  });
}

/**
 * The clock tower, 32×80: a tall square tower of grey stone, the great clock face near its top,
 * a pointed slate roof, slit windows, gears showing through a gap.
 */
export function clockTower(): string {
  return book.frame('clock-tower', 32, 80, (c) => {
    shadow(c, 16, 77, 13, 2.5);
    wall(c, 6, 22, 20, 56, 0.55);
    // Buttresses.
    c.rect(4, 60, 3, 18, '6');
    c.rect(25, 60, 3, 18, '5');
    // Roof.
    spire(c, 16, 0, 20, 12);
    c.rect(4, 20, 24, 2, '5');
    // The clock face.
    c.ellipse(16, 30, 7, 7, (_x, _y, d) => (d > 0.8 ? 'p' : d > 0.68 ? 's' : 'o'));
    for (let i = 0; i < 12; i++)
      c.set(
        Math.round(16 + Math.cos((i * Math.PI) / 6) * 5),
        Math.round(30 + Math.sin((i * Math.PI) / 6) * 5),
        '0',
      );
    c.rect(16, 25, 1, 5, '0');
    c.rect(16, 30, 4, 1, '0');
    // Slit windows and a gap with a gear.
    for (const y of [42, 52]) window(c, 15, y, 2, 6, 'z');
    c.ellipse(16, 66, 4, 4, (_x, _y, d) => (d > 0.55 ? 'p' : 's'));
    c.rect(12, 62, 1, 9, '5');
    c.rect(20, 62, 1, 9, '5');
    // Its door at the foot.
    c.ellipse(16, 72, 3.5, 3, 'z');
    c.rect(13, 72, 7, 6, 'z');
    c.outline('0');
  });
}

/** The moon, 24×24: full and pale, its seas faint. */
export function moon(): string {
  return book.frame('moon', 24, 24, (c) => {
    c.ellipse(12, 12, 10, 10, (x, y, d) => (d > 0.85 ? 'p' : noise(x, y, 4, 561) > 0.62 ? 'o' : 'q'));
  });
}

/** The catacombs' crypt, 32×32: a low red-brick vault half sunk in the earth, its iron door. */
export function crypt(): string {
  return book.frame('crypt', 32, 32, (c) => {
    shadow(c, 16, 29, 14, 2.5);
    c.each((x, y) => {
      const dx = (x + 0.5 - 16) / 14;
      const top = 8 + Math.round(dx * dx * 10);
      if (x < 2 || x > 29 || y < top || y > 29) return null;
      if (y === top) return 'b';
      const row = Math.floor(y / 3);
      return y % 3 === 2 || (x + (row % 2 ? 2 : 0)) % 5 === 0 ? '9' : x > 23 ? '9' : 'a';
    });
    c.ellipse(16, 20, 5, 4, '5');
    c.rect(11, 20, 10, 10, '5');
    c.ellipse(16, 20, 4, 3, 'z');
    c.rect(12, 20, 8, 10, 'z');
    for (const x of [13, 16, 19]) c.rect(x, 18, 1, 12, '6');
    c.rect(14, 4, 4, 5, '7');
    c.rect(15, 2, 2, 8, '7');
    c.rect(13, 4, 6, 2, '7');
    c.outline('0');
  });
}

/** A town house (Simon's Quest's town), 32×32: half-timbered plaster, a red tile roof, a lit window. */
export function house(v: number): string {
  return book.frame(`house-${v}`, 32, 32, (c) => {
    shadow(c, 16, 29, 14, 2.5);
    c.rect(4, 15, 24, 14, 'n');
    c.rect(22, 15, 6, 14, 'm');
    for (const x of [4, 13, 22, 27]) c.rect(x, 15, 1, 14, 'r');
    c.rect(4, 21, 24, 1, 'r');
    c.each((x, y) => {
      const roofTop = 3 + (v ? 2 : 0);
      if (y < roofTop || y > 15) return null;
      const inset = (15 - y) * 0.9;
      if (x < 1 + (v ? inset * 0.2 : 0) || x > 30) return null;
      return (y + (Math.floor(x / 3) % 2)) % 3 === 0 ? 't' : x > 22 ? 't' : 'u';
    });
    c.rect(1, 15, 30, 1, 't');
    c.rect(7, 23, 5, 6, 's');
    c.set(10, 26, 'p');
    c.rect(16, 18, 4, 3, v ? 'p' : 'z');
    c.rect(24, 1, 3, 6, '5');
    c.outline('0');
  });
}

/** The aqueduct's arches over the channel (the battlements' bridges), 48×32. */
export function arches(): string {
  return book.frame('arches', 48, 32, (c) => {
    c.each((x, y) => {
      if (y < 8 || y > 27) return null;
      for (const ax of [8, 24, 40]) {
        const dx = (x + 0.5 - ax) / 6;
        const dy = (y + 0.5 - 27) / 12;
        if (dx * dx + dy * dy < 1) return null;
      }
      const row = Math.floor(y / 4);
      const bx = (x + (row % 2 ? 3 : 0)) % 6;
      if (y % 4 === 3 || bx === 0) return 'c';
      return y < 12 ? 'e' : 'd';
    });
    merlons(c, 1, 47, 8, 3, 'e');
    c.rect(0, 8, 48, 1, 'e');
    c.outline('0');
  });
}

/** The fountain (the collage's), 32×32: a stone basin, a statue on its column, the water still. */
export function fountain(): string {
  return book.frame('fountain', 32, 32, (c) => {
    shadow(c, 16, 26, 14, 3);
    c.ellipse(16, 22, 14, 7, (_x, y, d) => (d > 0.82 ? '5' : d > 0.66 ? (y < 22 ? '8' : '7') : 'g'));
    c.ellipse(13, 21, 3, 1, 'h');
    c.rect(14, 8, 4, 14, '7');
    c.rect(17, 8, 1, 14, '6');
    c.ellipse(16, 6, 2.5, 3, '8');
    c.rect(14, 9, 4, 2, '8');
    c.outline('0', (_x, y) => y < 25);
  });
}

/** The cave mouth where the river runs under the rock (the underground waterway), 40×24. */
export function caveMouth(): string {
  return book.frame('cave-mouth', 40, 24, (c) => {
    c.each((x, y) => {
      const dx = (x + 0.5 - 20) / 20;
      const top = 2 + Math.round(dx * dx * 12);
      if (y < top) return null;
      const ix = (x + 0.5 - 20) / 12;
      const iy = (y + 0.5 - 24) / 16;
      if (ix * ix + iy * iy < 1) return iy * iy * 0.6 + ix * ix > 0.75 ? 'i' : 'z';
      return stones(x, y, { sx: 6, sy: 5, seed: 571, gap: 'i', dk: 'i', mid: 'j', lt: 'k' });
    });
    c.outline('0', (_x, y) => y < 22);
  });
}

/**
 * The plank bridge over the river (north-south), 24×36, FLAT: it lies under the road, which a map
 * never draws on water, so the planks are what shows of the road there.
 */
export function bridgeV(): string {
  return book.frame('bridge-v', 24, 36, (c) => {
    c.each((x, y) => {
      if (x < 3 || x > 20 || y < 2 || y > 33) return null;
      if (x === 3 || x === 20) return '0';
      if (x === 4 || x === 19) return 'r';
      return y % 4 === 3 ? 'r' : y % 4 === 0 ? 'n' : 'm';
    });
    for (const [x, y] of [
      [1, 2],
      [20, 2],
      [1, 30],
      [20, 30],
    ] as [number, number][]) {
      c.rect(x, y, 3, 4, 's');
      c.rect(x, y, 3, 1, 'n');
    }
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Node markers                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

const RING = { ring: '8', sink: '0', out: '0' } as const;

/**
 * Dracula's keep, painted whole (64×80): a dark keep of three towers with slate spires and lit
 * windows, a red banner, its gatehouse (no wider than a tile) reaching down to 5-4's node. It is
 * cut in two: the keep itself (the top 64 rows) is a landmark that always stands on the crag (as
 * Peach's Castle does in World 1), and the gatehouse (16×32) is the 5-4 castle node's marker,
 * which shows once the node is reached; cleared, its portcullis is up.
 */
function keep(cleared: boolean): string {
  return book.frame(cleared ? 'keep-full-cleared' : 'keep-full', 64, 80, (c) => {
    shadow(c, 32, 77, 8, 2);
    // Back wall and the tall middle tower.
    wall(c, 6, 30, 52, 34, 0.6);
    merlons(c, 7, 57, 30, 3, '7');
    wall(c, 24, 12, 16, 50, 0.55);
    spire(c, 32, 0, 13, 9);
    // Side towers.
    for (const tx of [10, 54]) {
      c.each((x, y) => {
        const dx = x + 0.5 - tx;
        if (Math.abs(dx) > 7 || y < 20 || y > 63) return null;
        return Math.abs(dx) > 5.5 ? '5' : dx < -1 ? '7' : '6';
      });
      for (let y = 24; y < 64; y += 5) c.rect(tx - 6, y, 13, 1, '5');
      spire(c, tx, 8, 12, 8);
      window(c, tx - 1, 34, 3, 6, 'p');
      window(c, tx - 1, 48, 3, 6, 'u');
    }
    // Middle tower windows, a great rose window.
    c.ellipse(32, 24, 4, 4, (_x, _y, d) => (d > 0.5 ? 'u' : 'p'));
    for (const wx of [18, 43]) window(c, wx, 40, 3, 8, 'p');
    // The crag face under it (rows 64-79), and the gatehouse down to the node, 16 px wide.
    wall(c, 24, 58, 16, 22, 0.5);
    c.ellipse(32, 70, 4.5, 4, 'z');
    c.rect(27.5, 70, 9, 10, 'z');
    for (let x = 28; x <= 36; x += 2) c.rect(x, 66, 1, cleared ? 2 : 8, '6');
    merlons(c, 24, 40, 58, 3, '7');
    // Dracula's banner.
    c.rect(32, 1, 1, 6, '6');
    c.rect(33, 1, 6, 4, 'u');
    c.rect(33, 4, 6, 1, 't');
    c.outline('0', (x, y) => y < 63 || (x >= 24 && x < 40 && y < 78));
  });
}

/** The keep (a landmark, 64×64): the top of the whole painting. */
export function keepProp(): string {
  if (book.has('keep')) return 'keep';
  const full = book.frames[keep(false)] as string[];
  return book.put('keep', full.slice(0, 64));
}

/** The 5-4 castle node's marker (16×32): the keep's gatehouse, its portcullis up once cleared. */
function keepGate(cleared: boolean): string {
  const name = cleared ? 'castle-cleared' : 'castle';
  if (book.has(name)) return name;
  const full = book.frames[keep(cleared)] as string[];
  book.put(
    name,
    full.slice(48).map((r) => r.slice(24, 40)),
  );
  delete book.frames[cleared ? 'keep-full-cleared' : 'keep-full'];
  return name;
}

/** The bonus spot: a small treasure chest on a stone slab (spent: open and empty). */
function chest(used: boolean): string {
  return book.frame(used ? 'bonus-used' : 'bonus', 16, 16, (c) => {
    c.ellipse(8, 11, 7.5, 4.5, '0');
    c.ellipse(8, 10.5, 7, 4, (_x, y, d) => (d > 0.7 ? (y > 10 ? '5' : '8') : '6'));
    c.rect(3, 6, 10, 6, 's');
    c.rect(3, 8, 10, 1, 'p');
    if (used) {
      // Open and empty: the lid thrown back, the inside dark.
      c.rect(3, 1, 10, 4, 'r');
      c.rect(3, 1, 10, 1, 's');
      c.rect(4, 5, 8, 2, 'z');
    } else {
      c.ellipse(8, 5, 5.5, 2.5, (_x, y) => (y < 4 ? 'n' : 's'));
      c.rect(7, 7, 2, 3, 'p');
      c.set(5, 4, 'o');
    }
    c.outline('0');
  });
}

export function nodeFrames(): Record<string, string> {
  return {
    open: ringSpace(book, 'node-open', {
      ...RING,
      lip: 'b',
      dk: 't',
      md: 'u',
      lt: 'o',
      mark: 'none' as const,
      markCol: 'v',
    }),
    cleared: ringSpace(book, 'node-cleared', {
      ...RING,
      lip: 'e',
      dk: 'c',
      md: 'd',
      lt: 'v',
      mark: 'star' as const,
      markCol: 'v',
    }),
    start: ringSpace(book, 'node-start', {
      ...RING,
      lip: '4',
      dk: '2',
      md: '3',
      lt: 'v',
      mark: 'dot' as const,
      markCol: '4',
    }),
    secret: ringSpace(book, 'node-secret', {
      ...RING,
      lip: 'y',
      dk: 'x',
      md: 'y',
      lt: 'v',
      mark: 'key' as const,
      markCol: 'z',
    }),
    secretCleared: ringSpace(book, 'node-secret-cleared', {
      ...RING,
      lip: 'v',
      dk: 'y',
      md: 'v',
      lt: 'v',
      mark: 'key' as const,
      markCol: 'x',
    }),
    bonus: chest(false),
    bonusUsed: chest(true),
    castle: (keepProp(), keepGate(false)),
    castleCleared: keepGate(true),
  };
}

/* ---------------------------------------------------------------------------------------------- */
/* The sheet                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

/** The node marker for a node in Transylvania (above-render AboveLook.node). */
export function transylvaniaNodeFrame(
  kind: MapNode['kind'],
  s: { cleared: boolean; secret: boolean },
): string | null {
  if (kind === 'castle') return s.cleared ? 'castle-cleared' : 'castle';
  if (kind === 'bonus') return s.cleared ? 'bonus-used' : 'bonus';
  if (kind === 'start') return 'node-start';
  if (kind !== 'level') return null;
  if (s.secret) return s.cleared ? 'node-secret-cleared' : 'node-secret';
  return s.cleared ? 'node-cleared' : 'node-open';
}

/** Roads: a cobbled path, pale-edged so it reads on the night ground. */
const COBBLES: DeckInk = { edge: 'o', kerb: 'l', dk: 'm', mid: 'n', lt: 'o', kind: 'slabs' };

/** The road joins' names by mask (painted with the sheet). */
export const TRANSYLVANIA_ROAD_FRAMES: readonly string[] = deckRoadNames('cobbles');

const grounds = new RegionGrounds(book, LOOK, pieces);

/** The ground of a Transylvania page from its tiles and parts (`zones`), painted once per page. */
export const transylvaniaGround = (tiles: readonly string[], zones: readonly string[]): AboveGround =>
  grounds.ground(tiles, zones);

/** Every frame of the sheet, with the grounds of the pages given ([tiles, zones]), as small steps. */
function paintSteps(pages: readonly (readonly [readonly string[], readonly string[]])[]): (() => void)[] {
  const steps: (() => void)[] = [];
  const add = (f: () => unknown): void => void steps.push(() => void f());
  add(pine);
  add(shrub);
  add(deadTree);
  add(graves);
  add(candles);
  for (const z of Object.keys(ZONE)) add(() => boulder(z));
  add(gatehouse);
  add(greatHall);
  add(clockTower);
  add(moon);
  add(crypt);
  add(() => house(0));
  add(() => house(1));
  add(arches);
  add(fountain);
  add(caveMouth);
  add(bridgeV);
  add(nodeFrames);
  steps.push(...deckRoadSteps(book, 'cobbles', COBBLES));
  for (const [tiles, zones] of pages) steps.push(...grounds.steps(tiles, zones));
  return steps;
}

/**
 * The `transylvania-above` sheet: every frame, with the grounds of the pages given ([tiles,
 * zones]), painted the first time the game draws from it, or ahead of that in slices while a map
 * idles (above-kit lazySheet), never when the game loads.
 */
export function transylvaniaAboveSheet(
  pages: readonly (readonly [readonly string[], readonly string[]])[],
): LazySheetDef {
  return lazySheet(
    'transylvania-above',
    () => paintSteps(pages),
    () => book.frames,
  );
}

/** How many of the sheet's frames are painted so far (0 until World 5 first shows). */
export const transylvaniaPainted = (): number => book.size;
