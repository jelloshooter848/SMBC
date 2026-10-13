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
 * PLANET ZEBES from above (World 4 in campaign play, 0.4.52; TD54's approved design): Zebes's crust in World
 * 1's three-quarter view, its regions where NES Metroid's map has them. Tourian's grey tech floor
 * at the top left, Brinstar's blue bubble rock in a corridor along the top and down its long shaft,
 * Brinstar's orange rock plateau to the right, Norfair's red bubble rock with lava pools below it
 * in the middle, Kraid's mossy green lair at the bottom left and Ridley's magenta lair at the
 * bottom right, each region a step lower than the one above it. Samus's gunship stands in the
 * landing crater by the start. Original art drawn from shapes; nothing traced.
 *
 * Palette `zebes-above` (index: role):
 *   0 outline   1 shadow (only shadows)
 *   2-4 Brinstar blue (dark, mid, light)    5-7 Brinstar orange    8-a Norfair red/pink
 *   b-c purple (dark, mid)    d-f Kraid green    g-i Ridley magenta    j-l metal (Tourian; roads)
 *   m white    n-p lava (dark, mid, light)    q-s the surface's dusty rock    t-u glass (dark, light)
 *   v gold    w pale yellow    x Metroid green    y acid (deep)    z black
 */
export const ZEBES_ABOVE_PALETTE: readonly string[] = [
  '#0a0614', // 0 outline
  '#150b24', // 1 shadow
  '#1a3a8a', // 2 Brinstar dark
  '#3468cc', // 3 Brinstar
  '#7cb0f6', // 4 Brinstar light
  '#7a3410', // 5 orange dark
  '#c86a24', // 6 orange
  '#f4ac5c', // 7 orange light
  '#64102a', // 8 Norfair dark
  '#b83048', // 9 Norfair
  '#ee7498', // a Norfair light
  '#34164e', // b purple dark
  '#6c3494', // c purple
  '#1a4422', // d Kraid dark
  '#368236', // e Kraid
  '#86cc58', // f Kraid light
  '#520a40', // g Ridley dark
  '#9a2280', // h Ridley
  '#e264bc', // i Ridley light
  '#343a48', // j metal dark
  '#747c8e', // k metal
  '#bcc4d2', // l metal light
  '#f8f8f8', // m white
  '#8c1406', // n lava dark
  '#ec5414', // o lava
  '#f8c440', // p lava light
  '#3e3054', // q surface dark
  '#6c5c84', // r surface
  '#a898bc', // s surface light
  '#20808e', // t glass dark
  '#84e4ee', // u glass light
  '#c89a14', // v gold
  '#f0e48c', // w pale yellow
  '#40d868', // x Metroid green
  '#123e3a', // y acid deep
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
 * The regions (a page's `ground` letters):
 *   t Tourian    b Brinstar (blue)    o Brinstar (orange)    n Norfair    k Kraid's lair
 *   r Ridley's lair    s the surface (the landing crater)
 */
const ZONE: Readonly<Record<string, { dk: string; md: string; lt: string; rank: number; line: string }>> = {
  t: { dk: 'j', md: 'k', lt: 'l', rank: 5, line: '0' },
  o: { dk: '5', md: '6', lt: '7', rank: 4, line: '0' },
  b: { dk: '2', md: '3', lt: '4', rank: 3, line: '0' },
  s: { dk: 'q', md: 'r', lt: 's', rank: 3, line: '0' },
  n: { dk: '8', md: '9', lt: 'a', rank: 2, line: '0' },
  k: { dk: 'd', md: 'e', lt: 'f', rank: 1, line: '0' },
  r: { dk: 'g', md: 'h', lt: 'i', rank: 1, line: '0' },
};
const zone = (z: string) => ZONE[z] ?? (ZONE.b as (typeof ZONE)[string]);

function tex(z: string, x: number, y: number): string {
  switch (z) {
    case 't': {
      // Tourian's deck: 16 px plates in a 2×2 of 8 px panels, bevelled, riveted; every few plates a
      // cyan light strip or a grate.
      const px = x & 15;
      const py = y & 15;
      const kind = Math.floor(hash(x >> 4, y >> 4, 401) * 6);
      if (px === 0 || py === 0) return 'j';
      if (px === 15 || py === 15) return '0';
      if (kind === 0 && py >= 6 && py <= 9)
        return py === 6 || py === 9 ? 'j' : px > 2 && px < 13 ? (py === 7 ? 'u' : 't') : 'k';
      if (kind === 1 && px > 2 && px < 13 && py > 2 && py < 13) return py % 2 ? '0' : 'j';
      const qx = px & 7;
      const qy = py & 7;
      if (qx === 0 || qy === 0) return 'j';
      if (qx === 1 || qy === 1) return 'l';
      if ((qx === 2 && qy === 2) || (qx === 6 && qy === 6)) return 'l';
      return 'k';
    }
    case 'o':
      // Brinstar's orange: rough rock in tall chunks (its shafts), a little green moss.
      if (noise(x, y, 6, 402) > 0.78 && hash(x, y, 403) < 0.5) return hash(x, y, 404) < 0.5 ? 'e' : 'f';
      return stones(x, y, { sx: 6, sy: 11, seed: 405, gap: '5', dk: '5', mid: '6', lt: '7', crack: 1.2 });
    case 'b':
      // Brinstar's blue bubble rock.
      return stones(x, y, { sx: 8, sy: 7, seed: 406, gap: '2', dk: '2', mid: '3', lt: '4', crack: 1.3 });
    case 's': {
      // The surface: dusty mauve rock, small craters.
      const c = Math.hypot((x % 23) - 11.5, (y % 19) - 9.5);
      if (hash(Math.floor(x / 23), Math.floor(y / 19), 407) < 0.35 && c < 5)
        return c > 4 ? 's' : c > 3 ? 'q' : 'r';
      const n = noise(x, y, 5, 408) + (hash(x, y, 409) - 0.5) * 0.25;
      return n < 0.38 ? 'q' : n > 0.72 ? 's' : 'r';
    }
    case 'n':
      // Norfair's bubbles: round red stones, pink-lit, purple in the cracks.
      return stones(x, y, { sx: 9, sy: 8, seed: 410, gap: 'b', dk: '8', mid: '9', lt: 'a', crack: 1.2 });
    case 'k': {
      // Kraid's lair: mossy green stones, some old blue stones among them.
      const blue = hash(Math.floor(x / 7), Math.floor(y / 6), 411) < 0.18;
      return stones(
        x,
        y,
        blue
          ? { sx: 7, sy: 6, seed: 412, gap: 'd', dk: '2', mid: '3', lt: '4' }
          : { sx: 7, sy: 6, seed: 412, gap: 'd', dk: 'd', mid: 'e', lt: 'f' },
      );
    }
    case 'r':
      // Ridley's lair: angular magenta slabs, purple grit.
      if (hash(x, y, 413) < 0.05) return 'c';
      return stones(x, y, {
        sx: 9,
        sy: 7,
        seed: 414,
        gap: 'g',
        dk: 'g',
        mid: 'h',
        lt: 'i',
        cheb: true,
        crack: 1.1,
      });
    default:
      return 'b';
  }
}

const LOOK: GroundLook = {
  prefix: 'z4',
  wet: new Set(['L', '~']),
  cliff: new Set(['C']),
  tex,
  rank: (z) => zone(z).rank,
  seam: (z) => ({ line: '0', lip: zone(z).lt, face: zone(z).dk }),
  liquid(ch, _z, x, y, d, f) {
    if (d < 1.5) return null;
    if (ch === 'L') {
      // Lava: a black crust rim, a glowing edge, then rolling molten rock.
      if (d < 2.5) return '0';
      if (d < 3.5) return 'b';
      if (d < 4.8) return 'n';
      const v = noise(x + f * 3, y + f, 7, 431) + noise(x, y, 3, 432) * 0.3;
      if (hash(x >> 2, y >> 2, 433 + f) < 0.03) return 'w';
      return v < 0.55 ? 'n' : v < 0.95 ? 'o' : 'p';
    }
    // Kraid's acid pools: dark rim, deep teal, slow light ripples.
    if (d < 2.5) return '0';
    if (d < 3.5) return 'd';
    if (d < 4.5) return 't';
    const r = (x + f * 2 + Math.floor(noise(x, y, 6, 434) * 6)) % 9;
    if (r === 0 && hash(x >> 3, y, 435) < 0.6) return 'u';
    if (r === 1 && hash(x >> 3, y, 435) < 0.6) return 't';
    return 'y';
  },
  cliffFace(z, x, y, lx, ly, ends) {
    const c = zone(z);
    const top = 2 + Math.floor(noise(x, y, 6, 441) * 2);
    if (ly < top) return null; // the plateau's own ground up to its edge
    if (ly === top) return c.lt; // the lit lip
    if (ly === top + 1) return c.md;
    if ((ends.w && lx === 0) || (ends.e && lx === 15)) return '0';
    if (ends.w && lx === 1) return c.lt;
    if (ends.e && lx === 14) return c.dk;
    // The face: a jumble of rock, lit along each stone's top, darker toward its foot.
    const foot = 14 + Math.floor(noise(x, y, 4, 444) * 2);
    if (ly >= foot) return ly === 15 ? '0' : c.dk;
    const st = stones(x, y, { sx: 7, sy: 5, seed: 445, gap: '0', dk: c.dk, mid: c.md, lt: c.lt, crack: 1.0 });
    if (ly > foot - 4 && st === c.md && hash(x, y, 447) < 0.5) return c.dk;
    return st;
  },
  special(ch, z, x, y, lx, ly) {
    if (ch !== 'G') return null;
    // An elevator in the cliff: a steel shaft wider than the road, its car's deck, blue lamps.
    if (lx < 1 || lx > 14) return LOOK.cliffFace(z, x, y, lx, ly, { w: false, e: false });
    if (lx === 1 || lx === 14) return '0';
    if (lx === 2 || lx === 13) return ly % 4 === 1 ? 'u' : 'l';
    if (lx === 3 || lx === 12) return 'j';
    if (ly < 2) return 'j';
    if (ly === 2 || ly === 13) return 'l';
    if (ly > 13) return ly === 15 ? '0' : 'k';
    return (lx + ly) % 4 === 0 ? 'j' : 'k';
  },
  band(x, y) {
    // Under the header: the cavern roof, dark purple rock (only its last 8 px show).
    const v = noise(x, y, 6, 451);
    if (y === 31) return '0';
    return v < 0.5 ? 'b' : v < 0.8 ? '0' : 'c';
  },
};

/* ---------------------------------------------------------------------------------------------- */
/* Standing scenery (one tile wide; tall pieces overhang the tile above)                           */
/* ---------------------------------------------------------------------------------------------- */

/** A rock pillar in a region's own rock, 16×32 (Brinstar's orange shafts, Norfair's bubble stacks...). */
function pillar(z: string): string {
  const c = zone(z);
  return book.frame(`pillar-${z}`, 16, 32, (cv) => {
    shadow(cv, 8, 29, 6, 2.5);
    if (z === 'n') {
      // A stack of bubbles.
      const blobs: [number, number, number][] = [
        [8, 25, 6],
        [7, 17, 5],
        [9, 10, 4.5],
        [8, 4, 3.5],
      ];
      for (const [bx, by, r] of blobs)
        cv.ellipse(bx, by, r, r * 0.9, (x, y, d) =>
          d > 0.72 ? c.dk : x + y < bx + by - 1 && d < 0.45 ? c.lt : c.md,
        );
      cv.set(6, 22, 'm');
      cv.set(6, 15, 'm');
    } else if (z === 'k') {
      // A mossy column with thorns.
      cv.each((x, y) => {
        if (y < 6 || y > 28) return null;
        const w = 4 + Math.round(Math.sin(y / 3) * 0.8);
        if (Math.abs(x + 0.5 - 8) > w) return null;
        return x < 6 ? c.lt : x > 10 ? c.dk : hash(x, y, 461) < 0.2 ? 'd' : c.md;
      });
      for (const [x, y, dir] of [
        [3, 10, -1],
        [12, 14, 1],
        [3, 19, -1],
        [12, 23, 1],
      ] as [number, number, number][]) {
        cv.set(x, y, 'f');
        cv.set(x + dir, y - 1, 'f');
      }
      cv.ellipse(8, 6, 4, 3, (x) => (x < 7 ? 'f' : 'e'));
    } else if (z === 'r') {
      // A fang of magenta rock.
      cv.each((x, y) => {
        if (y < 8 || y > 28) return null;
        const hw = ((y - 8) / 20) * 6 + 0.5;
        if (Math.abs(x + 0.5 - 8) > hw) return null;
        return x + 0.5 < 8 - hw * 0.3 ? c.lt : x + 0.5 > 8 + hw * 0.4 ? c.dk : c.md;
      });
      cv.set(8, 7, 'i');
    } else {
      // A rough rock spire (Brinstar's orange shafts seen from above, its blue rock, the surface's
      // crags): it narrows as it rises, lit on its left, cracked across, a little moss.
      const cols = z === 's' ? { dk: 'q', md: 'r', lt: 's' } : c;
      cv.each((x, y) => {
        if (y < 3 || y > 28) return null;
        const t = (28 - y) / 25;
        const hw = 6.5 - t * 3.5 + (noise(0, y, 4, 463) - 0.5) * 2.2;
        const cx = 8 + (noise(1, y, 7, 464) - 0.5) * 2;
        const dx = x + 0.5 - cx;
        if (Math.abs(dx) > hw) return null;
        if (y === 3 || (y < 6 && Math.abs(dx) > hw - 1)) return cols.lt;
        if (y % 9 === 4 && Math.abs(dx) < hw - 2 && dx > -1) return cols.dk;
        if (dx < -hw * 0.35) return cols.lt;
        if (dx > hw * 0.4) return cols.dk;
        return hash(x, y, 466) < 0.12 ? cols.dk : cols.md;
      });
      if (z === 'o' || z === 'b') {
        cv.set(5, 12, 'f');
        cv.set(6, 12, 'e');
        cv.set(10, 20, 'e');
        cv.set(4, 23, 'f');
      }
    }
    cv.outline('0', (_x, y) => y < 29);
  });
}

/** A plant in a region's own kind: Brinstar's bulb bush, Norfair's fire flower, Kraid's fern, Ridley's thorns. */
function plant(z: string): string {
  return book.frame(`plant-${z}`, 16, 16, (c) => {
    shadow(c, 8, 13, 5, 2);
    if (z === 'n') {
      c.rect(7, 8, 2, 6, 'e');
      for (const [x, y] of [
        [8, 5],
        [4, 7],
        [12, 7],
      ] as [number, number][])
        c.ellipse(x, y, 2.6, 2.2, (_x, yy) => (yy < y ? 'p' : 'o'));
      c.set(8, 5, 'w');
    } else if (z === 'r') {
      for (const [x, h] of [
        [4, 7],
        [8, 10],
        [12, 6],
      ] as [number, number][]) {
        c.rect(x, 14 - h, 1, h, 'h');
        c.set(x - 1, 14 - h + 2, 'i');
        c.set(x + 1, 14 - h + 4, 'c');
      }
    } else if (z === 'k') {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.55;
        for (let r = 1; r < 7; r++)
          c.set(Math.round(8 + Math.cos(a) * r * 1.1), Math.round(13 + Math.sin(a) * r), r > 4 ? 'f' : 'e');
      }
    } else {
      // Brinstar's bush: round green bulbs with a pale bud.
      for (const [x, y, r] of [
        [5, 10, 3.5],
        [11, 10, 3.5],
        [8, 7, 4],
      ] as [number, number, number][])
        c.ellipse(x, y, r, r * 0.85, (xx, yy, d) => (d > 0.7 ? 'd' : xx + yy < x + y - 1 ? 'f' : 'e'));
      c.set(8, 5, 'w');
      c.set(4, 9, 'x');
    }
    c.outline('0', (_x, y) => y < 13);
  });
}

/** A boulder in a region's rock. */
function boulder(z: string): string {
  const c = zone(z);
  return book.frame(`boulder-${z}`, 16, 16, (cv) => {
    shadow(cv, 8, 12, 6, 2.5);
    cv.ellipse(8, 9, 6.5, 5, (x, y, d) => (d > 0.75 ? c.dk : x + y < 14 ? c.lt : c.md));
    cv.set(9, 9, c.dk);
    cv.set(10, 10, c.dk);
    cv.outline('0');
  });
}

/** Tourian's vent stack: a grey column, a cyan glow behind its grille, 16×24. */
function vent(): string {
  return book.frame('vent', 16, 24, (c) => {
    shadow(c, 8, 21, 6, 2);
    c.rect(3, 4, 10, 18, 'k');
    c.rect(3, 4, 2, 18, 'l');
    c.rect(11, 4, 2, 18, 'j');
    c.ellipse(8, 4, 5, 2, (_x, y) => (y < 4 ? 'l' : 'j'));
    for (let y = 8; y < 18; y += 3) c.rect(5, y, 6, 1, 't');
    c.rect(5, 12, 6, 1, 'u');
    c.outline('0');
  });
}

const pieces: Pieces = (ch, x, y, z) => {
  const at = (frame: string, h: number) => [{ frame, x: x * 16, y: y * 16 + 16 - h, feet: y * 16 + 16 }];
  if (ch === 'Λ') return at(pillar(z), 32);
  if (ch === 'ψ') return at(plant(z), 16);
  if (ch === 'R') return at(boulder(z), 16);
  if (ch === 'P') return at(vent(), 24);
  return [];
};

/* ---------------------------------------------------------------------------------------------- */
/* Landmarks                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

/**
 * Samus's gunship, 48×32, landed facing the page: an orange hull with gold trim and a green
 * canopy, its wings out to either side on landing struts, thrusters glowing faintly behind.
 */
export function gunship(): string {
  return book.frame('gunship', 48, 32, (c) => {
    shadow(c, 24, 28, 22, 3);
    // Landing struts.
    for (const x of [9, 38]) {
      c.rect(x, 20, 2, 8, 'j');
      c.rect(x - 1, 27, 4, 1, 'k');
    }
    // Wings: flat swept plates, lit on top.
    c.each((x, y) => {
      const dx = Math.abs(x + 0.5 - 24);
      if (y < 13 || y > 22 || dx > 23) return null;
      const top = 13 + Math.max(0, (dx - 10) * 0.35);
      if (y < top) return null;
      if (y < top + 1.5) return '7';
      return y > 20 ? '5' : dx > 18 ? 'v' : '6';
    });
    // The hull: a fat oval, lit from the upper left.
    c.ellipse(24, 14, 14, 9, (x, y, d) => {
      if (d > 0.82) return '5';
      if (x + y * 1.3 < 32 && d < 0.6) return '7';
      return '6';
    });
    // The gold band round the hull and the nose.
    c.each((x, y, now) => (now !== '.' && y === 17 && Math.abs(x - 24) < 13 ? 'v' : null));
    c.ellipse(24, 23, 6, 3, (_x, y) => (y > 23 ? '5' : 'v'));
    // Canopy: green glass with a glint.
    c.ellipse(24, 10, 7, 4, (x, y, d) => (d > 0.7 ? 'd' : x < 22 && y < 10 ? 'f' : 'x'));
    c.rect(20, 9, 2, 1, 'm');
    // Thrusters on the wing tips.
    for (const x of [3, 44]) {
      c.rect(x - 1, 18, 3, 3, 'j');
      c.set(x, 19, 'u');
    }
    c.outline('0');
  });
}

/**
 * One of the two statues guarding the way into Tourian (Metroid's own), 24×32: a beast on a
 * pedestal, Kraid's horned bulk or Ridley's winged neck, in old grey-blue stone; its eyes glow
 * until its boss is beaten (here, always: the page keeps one look).
 */
export function statue(who: 'kraid' | 'ridley'): string {
  return book.frame(`statue-${who}`, 24, 32, (c) => {
    shadow(c, 12, 29, 10, 2.5);
    // Pedestal.
    c.rect(3, 22, 18, 7, 'k');
    c.rect(3, 22, 18, 1, 'l');
    c.rect(3, 28, 18, 1, 'j');
    c.rect(17, 23, 4, 5, 'j');
    const st = (x: number, _y: number, d: number) => (d > 0.75 ? '2' : x < 11 ? '4' : '3');
    if (who === 'kraid') {
      // Kraid: a squat reptile, a pot belly with claw-spikes on it, a snouted head, three horns.
      c.ellipse(12, 16, 8, 6.5, st);
      c.ellipse(12, 18, 4.5, 3.5, (x) => (x < 12 ? '4' : '3'));
      for (const [x, y] of [
        [10, 15],
        [14, 17],
        [10, 19],
      ] as [number, number][]) {
        c.set(x, y, 'm');
        c.set(x + 1, y, 'l');
      }
      c.ellipse(12, 8, 4.5, 3.5, st);
      c.rect(9, 10, 6, 2, '3');
      c.set(10, 8, 'p');
      c.set(14, 8, 'p');
      for (const [x, y] of [
        [12, 3],
        [8, 5],
        [16, 5],
      ] as [number, number][]) {
        c.set(x, y, 'l');
        c.set(x, y + 1, '4');
      }
      // Arms and claws.
      c.rect(3, 13, 3, 2, '3');
      c.rect(18, 13, 3, 2, '2');
      c.set(3, 12, 'm');
      c.set(20, 12, 'm');
    } else {
      // Ridley: wings spread, a long neck, a crested head looking left.
      c.each((x, y) => {
        const dx = Math.abs(x + 0.5 - 12);
        if (y < 9 || y > 21) return null;
        const wing = y < 16 && dx < 11 - (y - 9) * 0.6 && dx > 3 && (dx + y) % 4 !== 0;
        const body = dx < 4 && y > 12;
        return wing || body ? (x < 11 ? '4' : '3') : null;
      });
      c.ellipse(12, 18, 5, 4, (x, _y, d) => (d > 0.75 ? '2' : x < 11 ? '4' : '3'));
      for (let i = 0; i < 6; i++) c.ellipse(12 - i * 0.5, 12 - i * 1.4, 1.8, 1.4, i % 2 ? '3' : '4');
      c.ellipse(9, 3, 4, 2.2, (x) => (x < 8 ? '4' : '3'));
      c.rect(4, 3, 3, 1, '3');
      c.set(13, 1, '4');
      c.set(14, 0, '4');
      c.set(9, 3, 'p');
    }
    c.outline('0');
  });
}

/** A Chozo statue, 32×32: the old bird-folk sitting on a plinth, an item sphere in its open hands. */
export function chozo(): string {
  return book.frame('chozo', 32, 32, (c) => {
    shadow(c, 16, 29, 13, 2.5);
    // Plinth.
    c.rect(5, 23, 22, 6, 'r');
    c.rect(5, 23, 22, 1, 's');
    c.rect(23, 24, 4, 5, 'q');
    // Folded legs and the knees forward, the body hunched over them.
    c.ellipse(12, 21, 7, 3.5, (x) => (x < 10 ? '7' : '6'));
    c.ellipse(13, 14, 7, 8, (x, y, d) => (d > 0.82 ? '5' : x < 10 && y < 15 ? '7' : '6'));
    // Wing folded on its back.
    c.ellipse(9, 14, 3, 6, (x) => (x < 8 ? '6' : '5'));
    // The head: round, a long hooked beak to the right, a dark eye.
    c.ellipse(15, 5, 4.5, 4, (x, _y, d) => (d > 0.75 ? '5' : x < 14 ? '7' : '6'));
    c.rect(19, 5, 5, 2, '6');
    c.set(24, 6, '5');
    c.set(23, 7, '5');
    c.set(16, 4, 'z');
    // Arms out, the item sphere in its open hands.
    c.rect(18, 14, 5, 2, '6');
    c.ellipse(24, 17, 3.8, 3.8, (x, y, d) => (d > 0.7 ? 'b' : x + y < 39 ? 'i' : 'c'));
    c.set(23, 15, 'm');
    c.rect(20, 19, 6, 2, '5');
    c.outline('0');
  });
}

/**
 * The wreck of Larry Koopa's airship (the bonus spot is in its shadow), 48×24: a broken wooden
 * hull nose-down in the moss, its propeller bent, a Koopa banner torn.
 */
export function wreck(): string {
  return book.frame('wreck', 48, 24, (c) => {
    shadow(c, 24, 21, 21, 2.5);
    // The hull, nose down to the left, tilted: planks, an iron band, round portholes.
    c.each((x, y) => {
      const mid = 13 - (x - 24) * 0.12;
      const half = 7 * Math.sqrt(Math.max(0, 1 - ((x - 25) / 21) ** 2));
      const dy = y - mid;
      if (Math.abs(dy) > half || x > 44) return null;
      if (dy < -half + 1.5) return '7';
      if (Math.abs(x - 30) < 1) return 'k';
      if (Math.floor(dy + 20) % 3 === 0) return '5';
      return dy > half - 2 ? '5' : '6';
    });
    for (const x of [14, 22, 38])
      c.ellipse(x, 13 - (x - 24) * 0.12, 1.6, 1.6, (_x, _y, d) => (d > 0.5 ? 'j' : 'u'));
    // Broken stern: splintered planks.
    for (const [x, y] of [
      [44, 9],
      [45, 12],
      [44, 15],
    ] as [number, number][])
      c.rect(x, y, 3, 1, '6');
    // The bent mast and its torn banner, a propeller in the moss.
    c.rect(26, 0, 2, 7, 'j');
    c.rect(28, 1, 7, 4, 'e');
    c.set(34, 4, '.');
    c.set(30, 2, 'f');
    c.rect(4, 17, 7, 2, 'k');
    c.rect(6, 15, 2, 6, 'l');
    c.outline('0');
  });
}

/**
 * Ridley's nest, 48×32: the bleached skull of some great horned beast half sunk in the magenta
 * rock, its jaw open, ribs curving up beside it, an egg-shaped glow of lava in its eye.
 */
export function ridleyNest(): string {
  return book.frame('ridley-nest', 48, 32, (c) => {
    shadow(c, 24, 28, 22, 3);
    // Ribs on the right, curving up.
    for (const [x, h] of [
      [33, 14],
      [38, 17],
      [43, 13],
    ] as [number, number][])
      for (let i = 0; i < h; i++) {
        const xx = Math.round(x + Math.sin(i / 5) * 2);
        c.set(xx, 28 - i, 'l');
        c.set(xx + 1, 28 - i, i > h - 3 ? 'l' : 'k');
      }
    // The skull: a broad dome, two eye sockets, a long snout to the left, the jaw open.
    c.ellipse(20, 15, 12, 9, (x, y, d) => (d > 0.82 ? 'k' : x + y < 26 ? 'm' : 'l'));
    c.each((x, y) => (x >= 2 && x <= 14 && y >= 16 && y <= 21 ? (y === 16 ? 'm' : x < 4 ? 'k' : 'l') : null));
    c.each((x, y) => (x >= 4 && x <= 16 && y >= 24 && y <= 27 ? (y === 27 ? 'k' : 'l') : null));
    for (let x = 4; x <= 14; x += 3) {
      c.set(x, 22, 'm');
      c.set(x + 1, 23, 'm');
    }
    c.ellipse(16, 13, 3, 2.6, 'z');
    c.ellipse(25, 13, 3, 2.6, 'z');
    c.set(16, 13, 'o');
    c.set(25, 13, 'p');
    // Horns sweeping back.
    for (let i = 0; i < 9; i++) {
      c.set(26 + i, 7 - Math.round(i * 0.6), 'm');
      c.set(26 + i, 8 - Math.round(i * 0.6), 'l');
    }
    c.outline('0');
  });
}

/** A Zebetite, 16×32: one of Tourian's red barrier columns, pulsing inside its glass. */
export function zebetite(): string {
  return book.frame('zebetite', 16, 32, (c) => {
    shadow(c, 8, 29, 6, 2);
    c.rect(3, 27, 10, 3, 'j');
    c.rect(3, 2, 10, 3, 'j');
    c.rect(4, 5, 8, 22, 't');
    c.each((x, y) =>
      x >= 5 && x <= 10 && y >= 6 && y <= 25 ? (Math.sin(y / 2 + x) > 0.3 ? 'o' : '9') : null,
    );
    c.rect(5, 6, 1, 20, 'u');
    c.rect(3, 2, 10, 1, 'l');
    c.outline('0');
  });
}

/** Rinka spawner / Tourian cannon ring (flat): a round ring set in the floor, 16×16. */
export function cannonRing(): string {
  return book.frame('cannon-ring', 16, 16, (c) => {
    c.ellipse(8, 8, 6.5, 5, (_x, y, d) => (d > 0.7 ? (y < 8 ? 'l' : 'j') : d > 0.35 ? 'k' : 'o'));
    c.set(8, 8, 'p');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Node markers                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

const RING = { ring: 'l', sink: '0', out: '0' } as const;

/**
 * Tourian (the 4-4 castle node), 32×32 standing on its tile: Mother Brain in her glass tank on a
 * steel base, a Zebetite's red glow at each side. Cleared, the glass is broken and the tank dark.
 */
function tourian(cleared: boolean): string {
  return book.frame(cleared ? 'castle-cleared' : 'castle', 32, 32, (c) => {
    shadow(c, 16, 29, 12, 2.5);
    // The steel base, no wider than its tile at the foot, so the roads beside it stay clear.
    c.rect(8, 22, 16, 8, 'k');
    c.rect(8, 22, 16, 1, 'l');
    c.rect(20, 23, 4, 7, 'j');
    c.rect(8, 29, 16, 1, 'j');
    c.rect(12, 25, 8, 5, 'z');
    c.rect(13, 26, 6, 1, cleared ? 'j' : 'o');
    // The glass dome.
    c.ellipse(16, 13, 8.2, 10, (x, y, d) => {
      if (y > 22) return null;
      if (d > 0.86) return cleared ? 'j' : 't';
      if (cleared) return d > 0.6 ? 'j' : 'z';
      return x + y < 22 && d > 0.55 ? 'u' : 't';
    });
    if (!cleared) {
      // Mother Brain: a pink brain, folds, an eye.
      c.ellipse(16, 15, 6, 5, (x, y, d) => (d > 0.75 ? '8' : (x + y * 2) % 5 === 0 ? '9' : 'a'));
      c.ellipse(16, 17, 1.5, 1.2, 'p');
      c.set(16, 17, 'z');
      c.rect(10, 6, 3, 1, 'm');
      c.set(9, 7, 'm');
    } else {
      // Shards of the dome on the base.
      for (const [x, y] of [
        [8, 21],
        [12, 19],
        [21, 20],
        [24, 22],
      ] as [number, number][])
        c.set(x, y, 'u');
      c.rect(10, 9, 2, 6, 't');
      c.rect(20, 7, 2, 5, 't');
    }
    c.outline('0');
  });
}

/** The bonus spot: a Chozo item sphere on a little pedestal (spent: a dim, empty cradle). */
function itemSphere(used: boolean): string {
  return book.frame(used ? 'bonus-used' : 'bonus', 16, 16, (c) => {
    c.ellipse(8, 11, 7, 4, '0');
    c.ellipse(8, 10.5, 6.5, 3.5, (_x, y, d) => (d > 0.7 ? (y > 10 ? 'j' : 'l') : 'k'));
    if (used) c.ellipse(8, 9, 3, 2, 'j');
    else {
      c.ellipse(8, 6.5, 4, 4, (x, y, d) => (d > 0.72 ? 'b' : x + y < 13 ? 'i' : 'c'));
      c.set(6, 4, 'm');
      c.set(7, 5, 'a');
    }
    c.outline('0');
  });
}

export function nodeFrames(): Record<string, string> {
  return {
    open: ringSpace(book, 'node-open', {
      ...RING,
      lip: 'p',
      dk: 'n',
      md: 'o',
      lt: 'w',
      mark: 'none' as const,
      markCol: 'm',
    }),
    cleared: ringSpace(book, 'node-cleared', {
      ...RING,
      lip: '4',
      dk: '2',
      md: '3',
      lt: 'm',
      mark: 'star' as const,
      markCol: 'm',
    }),
    start: ringSpace(book, 'node-start', {
      ...RING,
      lip: 'f',
      dk: 'd',
      md: 'e',
      lt: 'm',
      mark: 'dot' as const,
      markCol: 'f',
    }),
    secret: ringSpace(book, 'node-secret', {
      ...RING,
      lip: 'i',
      dk: 'g',
      md: 'h',
      lt: 'm',
      mark: 'key' as const,
      markCol: 'z',
    }),
    secretCleared: ringSpace(book, 'node-secret-cleared', {
      ...RING,
      lip: 'm',
      dk: 'h',
      md: 'i',
      lt: 'm',
      mark: 'key' as const,
      markCol: 'g',
    }),
    bonus: itemSphere(false),
    bonusUsed: itemSphere(true),
    castle: tourian(false),
    castleCleared: tourian(true),
  };
}

/* ---------------------------------------------------------------------------------------------- */
/* The sheet                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

/** The node marker for a node on Planet Zebes (above-render AboveLook.node). */
export function zebesNodeFrame(
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

/** Roads: a pale metal walkway, a white edge so it reads on every region's rock. */
const DECK: DeckInk = { edge: 'm', kerb: 'j', dk: 'k', mid: 'l', lt: 'm', kind: 'plate' };

/** The road joins' names by mask (painted with the sheet). */
export const ZEBES_ROAD_FRAMES: readonly string[] = deckRoadNames('deck');

const grounds = new RegionGrounds(book, LOOK, pieces);

/** The ground of a Zebes page from its tiles and regions (`zones`), painted once per page. */
export const zebesGround = (tiles: readonly string[], zones: readonly string[]): AboveGround =>
  grounds.ground(tiles, zones);

/** Every frame of the sheet, with the grounds of the pages given ([tiles, zones]), as small steps. */
function paintSteps(pages: readonly (readonly [readonly string[], readonly string[]])[]): (() => void)[] {
  const steps: (() => void)[] = [];
  const add = (f: () => unknown): void => void steps.push(() => void f());
  for (const z of Object.keys(ZONE)) {
    add(() => pillar(z));
    add(() => plant(z));
    add(() => boulder(z));
  }
  add(vent);
  add(gunship);
  add(() => statue('kraid'));
  add(() => statue('ridley'));
  add(chozo);
  add(wreck);
  add(zebetite);
  add(ridleyNest);
  add(cannonRing);
  add(nodeFrames);
  steps.push(...deckRoadSteps(book, 'deck', DECK));
  for (const [tiles, zones] of pages) steps.push(...grounds.steps(tiles, zones));
  return steps;
}

/**
 * The `zebes-above` sheet: every frame, with the grounds of the pages given ([tiles, zones]),
 * painted the first time the game draws from it, or ahead of that in slices while a map idles
 * (above-kit lazySheet), never when the game loads.
 */
export function zebesAboveSheet(
  pages: readonly (readonly [readonly string[], readonly string[]])[],
): LazySheetDef {
  return lazySheet(
    'zebes-above',
    () => paintSteps(pages),
    () => book.frames,
  );
}

/** How many of the sheet's frames are painted so far (0 until World 4 first shows). */
export const zebesPainted = (): number => book.size;
