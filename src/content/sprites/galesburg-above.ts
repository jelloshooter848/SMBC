import type { MapNode } from '@game/map/types';
import { type Canvas, hash } from './paint';
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
  roof,
  shadow,
  space,
  type SpaceInk,
  speckle,
  stairs as kitStairs,
  type Sides,
  water as kitWater,
  type WaterInk,
} from './above-kit';

/*
 * World 6, GALESBURG, drawn from above in campaign play (0.4.53, TD58's approved design), in the 3/4
 * view of World 1's Mushroom Kingdom (sprites/kingdom.ts): a ninja game's town at night. Brick blocks
 * with barred windows and flat tar roofs, pink-neon shopfronts on the main street, low concrete
 * walls and lamp posts, a bamboo park by the west road, the Hayabusa dojo by 6-2, a stone canal
 * along the south, and behind the town the snowy pass (6-3) climbing to a hermit's hot spring, with
 * the demon temple's pagoda (6-4) at the foot of the mountain. Original art drawn from shapes;
 * nothing traced from the owner's reference.
 *
 * Palette `galesburg-above` (index: role):
 *   0 outline   1-3 paving (dark, mid, light)   4-6 lamp-lit road (rim, body, light)
 *   7-9 stone (dark, mid, light)   a-c lawn (dark, mid, light)   d wood dark
 *   e-g canal water (dark, mid, light)   h-j brick (dark, mid, light)   k-m roof tar (dark, mid, light)
 *   n-o neon pink (hot, pale)   p-r lacquer red (dark, mid, light)   s gold   t lit window
 *   u unlit window   v snow white   w snow shade   x snow mid   y bamboo green   z night
 */
export const GALESBURG_ABOVE_PALETTE: readonly string[] = [
  '#120e18', // 0 outline
  '#262a40', // 1 paving dark
  '#363c5a', // 2 paving
  '#4e5678', // 3 paving light
  '#7a5a30', // 4 road rim
  '#b8945c', // 5 road
  '#ecd49a', // 6 road light
  '#464a5c', // 7 stone dark
  '#767c92', // 8 stone
  '#b2bacc', // 9 stone light
  '#10281a', // a lawn dark
  '#1c4228', // b lawn
  '#2e6436', // c lawn light
  '#3a2414', // d wood dark
  '#0c1640', // e water dark
  '#1a2c68', // f water
  '#4a6cb4', // g water light
  '#561c18', // h brick dark
  '#86321f', // i brick
  '#b45a38', // j brick light
  '#1a1822', // k roof dark
  '#2c2a38', // l roof
  '#484656', // m roof light
  '#ff48a8', // n neon pink
  '#ffb4dc', // o neon pale
  '#661010', // p lacquer dark
  '#ae2218', // q lacquer
  '#e04a30', // r lacquer light
  '#f8c838', // s gold
  '#ffe48c', // t lit window
  '#263054', // u unlit window
  '#f2f6ff', // v snow
  '#8e9ec4', // w snow shade
  '#c8d4ee', // x snow mid
  '#5a9e48', // y bamboo
  '#08060c', // z night
];

const book = new FrameBook();
const F = book.frames;
const frame = book.frame.bind(book);

/* ---------------------------------------------------------------------------------------------- */
/* Ground                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

/** Town paving ('#' and its shores): dark flagstones in offset rows, a few lit chips. */
export const pave = (v: number): string =>
  speckle(book, `pave-${v}`, v, { base: '2', dark: '1', light: '3', dense: 0.05, joint: '1', step: 8 });

/** A paving tile with an iron drain cover in it (now and then among the flagstones). */
export function drain(): string {
  return frame('pave-drain', 16, 16, (c) => {
    c.paste(book.rows(pave(1)));
    c.rect(4, 5, 8, 6, '0');
    c.rect(5, 6, 6, 4, 'l');
    for (let x = 5; x < 11; x += 2) c.rect(x, 6, 1, 4, 'k');
    c.rect(4, 11, 8, 1, '3');
  });
}

/** Park lawn (','): night grass with dark blade pairs. */
export function lawn(v: number): string {
  return frame(`lawn-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 'b');
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(hash(v, i, 1) * 13) + 1;
      const y = Math.floor(hash(v, i, 2) * 13) + 2;
      c.set(x, y, 'a');
      c.set(x + 2, y, 'a');
      c.set(x + 1, y + 1, 'a');
      c.set(x + 1, y - 1, 'c');
    }
  });
}

/** Snow ('o'): white with blue drifts and a few sparkles. */
export function snow(v: number): string {
  return frame(`snow-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 'v');
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(hash(v, i, 11) * 12);
      const y = Math.floor(hash(v, i, 12) * 13) + 1;
      c.rect(x, y, 5, 1, 'x');
      c.rect(x + 1, y + 1, 3, 1, 'w');
    }
  });
}

/** The temple's raked gravel (':'): pale stone, rake lines east-west. */
export function gravel(v: number): string {
  return frame(`gravel-${v}`, 16, 16, (c) => {
    c.each((x, y) => {
      if (y % 4 === 3) return hash(x, y, v, 21) < 0.7 ? '8' : '7';
      return hash(x, y, v, 22) < 0.1 ? '8' : '9';
    });
  });
}

const CLIFF: CliffInk = {
  top: 'x',
  topLight: 'v',
  dark: '7',
  body: '8',
  light: '9',
  crack: '0',
  below: '2',
  shade: '1',
  outline: '0',
};
/** The mountain's cliff ('^'): grey rock, a snow lip along its top. */
export const cliff = (s: Sides): string => kitCliff(book, 'cliff', s, CLIFF);

/** Stone stairs up the cliff ('G'). */
export const stairs = (): string =>
  kitStairs(book, 'stairs', cliff({ n: false, e: true, s: false, w: true }), {
    dark: '7',
    body: '8',
    light: 'x',
    outline: '0',
  });

/** The band under the header: the far town's dark rooftops (x < 5), else snowy peaks. */
export function band(x: number): string {
  if (x < 5) {
    const v = x % 2;
    return frame(`band-roofs-${v}`, 16, 16, (c) => {
      c.rect(0, 0, 16, 16, 'z');
      c.rect(0, 9, 16, 7, 'k');
      c.rect(v ? 2 : 6, 5, 7, 11, 'l');
      c.rect(v ? 11 : 0, 7, 5, 9, 'l');
      for (let i = 0; i < 4; i++) c.set(Math.floor(hash(v, i, 41) * 15), 11 + (i % 3), 't');
      c.rect(0, 15, 16, 1, '0');
    });
  }
  const v = x % 3;
  return frame(`band-peaks-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 'z');
    for (const [px, py] of [
      [3 + v, 2],
      [12 - v, 5],
    ] as [number, number][])
      c.each((x, y) => {
        const h = py + Math.abs(x + 0.5 - px) * 1.3;
        if (y < h) return null;
        if (y < h + 3) return 'v';
        return x < px ? 'x' : 'w';
      });
    c.rect(0, 13, 16, 3, 'x');
  });
}

const CANAL: WaterInk = {
  deep: 'e',
  mid: 'f',
  light: 'g',
  land: '2',
  bankLight: '9',
  bank: '8',
  face: '7',
};
/** The canal ('~'): dark water, lamp glints, a stone quay on every side that meets land. */
export function water(s: Sides, corners: string, f: number): string {
  const name = kitWater(book, 'canal', s, corners, f, CANAL);
  return frame(`${name}-lit`, 16, 16, (c) => {
    c.paste(book.rows(name));
    // A lamp's reflection: a short warm streak now and then.
    const k = Math.floor(hash(s.n ? 1 : 0, s.w ? 1 : 0, corners.length, f) * 10);
    if (k < 4) {
      const x = 4 + k * 2;
      c.rect(x, 9 + f, 1, 2, 't');
      c.set(x, 12 - f, 's');
    }
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Small scenery (one tile wide; tall ones overhang the tile above)                                */
/* ---------------------------------------------------------------------------------------------- */

/** A clump of bamboo, 16×32: green stalks with pale joints, leaf sprays at the top. */
export function bamboo(): string {
  return frame('bamboo', 16, 32, (c) => {
    shadow(c, 8, 29, 6, 2, 'a');
    for (const [x, top] of [
      [3, 6],
      [7, 2],
      [11, 5],
      [9, 9],
    ] as [number, number][]) {
      c.rect(x, top, 2, 30 - top, 'y');
      c.rect(x + 1, top, 1, 30 - top, 'c');
      for (let y = top + 4; y < 30; y += 6) c.rect(x, y, 2, 1, 'b');
    }
    for (const [cx, cy] of [
      [4, 6],
      [8, 3],
      [12, 6],
      [6, 11],
      [11, 12],
    ] as [number, number][])
      c.ellipse(cx, cy, 4, 2.5, (x, y, d) => (d > 0.7 ? 'b' : x + y < cx + cy ? 'y' : 'c'));
    c.outline('0', (_x, y) => y < 29);
  });
}

/** A snowy pine on the pass, 16×32: dark tiers under white snow caps. */
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

/** A stone lantern (tōrō), 16×32: footing, post, a lit fire box, a wide cap. */
export function lantern(): string {
  return frame('lantern', 16, 32, (c) => {
    shadow(c, 8, 29, 5, 2, '1');
    c.rect(4, 26, 8, 3, '8');
    c.rect(4, 26, 8, 1, '9');
    c.rect(6, 18, 4, 8, '8');
    c.rect(6, 18, 1, 8, '9');
    c.rect(4, 12, 8, 6, '7');
    c.rect(5, 13, 6, 4, 't');
    c.rect(7, 13, 2, 4, 's');
    c.ellipse(8, 10.5, 6.5, 2.5, (_x, y) => (y < 10 ? '9' : '8'));
    c.rect(7, 6, 2, 3, '8');
    c.outline('0', (_x, y) => y < 29);
    // Its glow on the ground.
    c.set(3, 30, 's');
    c.set(12, 30, 's');
  });
}

/** A street lamp, 16×32: an iron post, a lit lantern head, a pool of light at its foot. */
export function streetLamp(): string {
  return frame('street-lamp', 16, 32, (c) => {
    c.ellipse(8, 28, 7, 3, (_x, _y, d) => (d > 0.6 ? null : '3'));
    c.rect(7, 8, 2, 21, 'l');
    c.rect(7, 8, 1, 21, 'm');
    c.rect(5, 27, 6, 2, 'k');
    c.rect(4, 2, 8, 6, 'k');
    c.rect(5, 3, 6, 4, 't');
    c.rect(6, 4, 2, 2, 'v');
    c.rect(3, 1, 10, 1, 'l');
    c.outline('0', (_x, y) => y < 27);
  });
}

/** A dark round shrub. */
export function bush(): string {
  return frame('bush', 16, 16, (c) => {
    shadow(c, 8, 12, 7, 3, '1');
    c.ellipse(8, 8.5, 7, 6, (x, y, d) => (d > 0.78 ? 'a' : x + y < 13 && d < 0.4 ? 'c' : 'b'));
    c.outline('0', (_x, y) => y > 4);
  });
}

/** A snowy boulder on the pass. */
export function rock(): string {
  return frame('rock', 16, 16, (c) => {
    shadow(c, 8, 12, 6, 2.5, 'w');
    c.ellipse(8, 9, 6.5, 5, (x, y, d) => (d > 0.75 ? '7' : x + y < 14 ? '9' : '8'));
    c.ellipse(7, 6.5, 5, 2.5, (x) => (x < 8 ? 'v' : 'x'));
    c.outline('0');
  });
}

/** A low concrete wall (east-west, 'C'), joining its neighbours; a pink poster now and then. */
export function lowWall(s: Sides): string {
  return frame(`low-wall-${s.w ? 'w' : '-'}${s.e ? 'e' : '-'}`, 16, 16, (c) => {
    const l = s.w ? 0 : 1;
    const r = s.e ? 15 : 14;
    c.rect(l, 13, r - l + 1, 2, '1');
    c.rect(l, 5, r - l + 1, 3, '9');
    c.rect(l, 8, r - l + 1, 5, '8');
    for (let x = l; x <= r; x++) if (x % 8 === 0) c.rect(x, 8, 1, 5, '7');
    if (!s.w) c.rect(2, 9, 4, 3, 'o');
    c.outline('0', (_x, y) => y > 3);
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Buildings (several tiles; each stands on the bottom edge of its box)                            */
/* ---------------------------------------------------------------------------------------------- */

/** Brick in offset courses, lighter on the left of the face (the moon is up and to the left). */
function brick(x: number, y: number, x0: number, x1: number): string {
  const row = Math.floor(y / 3);
  const bx = (x + (row % 2 ? 3 : 0)) % 6;
  if (y % 3 === 2 || bx === 0) return 'h';
  return x < x0 + (x1 - x0) * 0.25 ? 'j' : 'i';
}

/** A barred window at (x, y), `w`×`h`: lit or dark panes behind iron bars, a stone sill. */
function window(c: Canvas, x: number, y: number, w: number, h: number, lit: boolean): void {
  c.rect(x, y, w, h, lit ? 't' : 'u');
  if (lit) c.rect(x, y + h - 2, w, 2, 's');
  for (let i = x + 1; i < x + w; i += 2) c.rect(i, y, 1, h, 'k');
  c.rect(x - 1, y + h, w + 2, 1, '9');
  c.rect(x - 1, y - 1, w + 2, 1, 'h');
}

/**
 * A flat tar roof over the box (x0..x1, y0..y1): a lit parapet rim, tar with seams, and its fixtures
 * (`gear`: an air-con box, a vent stack, a water tank, a skylight).
 */
function flatRoof(
  c: Canvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  gear: string,
  seed: number,
): void {
  c.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, 'l');
  for (let y = y0 + 2; y < y1; y++)
    for (let x = x0 + 2; x < x1 - 1; x++) if (hash(x, y, seed, 61) < 0.06) c.set(x, y, 'k');
  for (let y = y0 + 6; y < y1 - 1; y += 6) c.rect(x0 + 2, y, x1 - x0 - 3, 1, 'k');
  // Parapet: light along the top and left, dark along the right.
  c.rect(x0, y0, x1 - x0 + 1, 2, 'm');
  c.rect(x0, y0, 2, y1 - y0 + 1, 'm');
  c.rect(x1 - 1, y0, 2, y1 - y0 + 1, 'k');
  c.rect(x0, y1, x1 - x0 + 1, 1, 'k');
  let gx = x0 + 4;
  for (const g of gear) {
    const gy = y0 + 4 + Math.floor(hash(seed, gx, 62) * Math.max(1, y1 - y0 - 12));
    if (g === 'a') {
      // Air-con box with a round fan.
      c.rect(gx, gy, 9, 7, '8');
      c.rect(gx, gy, 9, 1, '9');
      c.rect(gx, gy + 6, 9, 1, '7');
      c.ellipse(gx + 4.5, gy + 3.5, 2.5, 2.2, (x, y) => ((x + y) % 2 ? '7' : 'k'));
      gx += 12;
    } else if (g === 'v') {
      // Vent stack: a pipe with a cap.
      c.rect(gx + 1, gy, 3, 6, '7');
      c.rect(gx, gy, 5, 2, '9');
      gx += 8;
    } else if (g === 't') {
      // Water tank on legs (wooden, banded).
      c.rect(gx + 1, gy + 9, 1, 3, 'd');
      c.rect(gx + 7, gy + 9, 1, 3, 'd');
      c.ellipse(gx + 4.5, gy + 5, 4.5, 5, (x, y) => (y % 3 === 0 ? 'd' : x < gx + 3 ? 'r' : 'q'));
      c.ellipse(gx + 4.5, gy + 1.5, 4, 1.5, 'p');
      gx += 12;
    } else if (g === 's') {
      // Skylight: lit glass panes.
      c.rect(gx, gy, 8, 5, '7');
      c.rect(gx + 1, gy + 1, 3, 3, 't');
      c.rect(gx + 5, gy + 1, 2, 3, 't');
      gx += 11;
    }
  }
}

/**
 * A brick block, `w`×`h`: a flat roof (its depth `deep`) over a brick front of barred windows in
 * rows, a steel door at the street. Lit windows by hash, so blocks differ.
 */
export function brickBlock(
  name: string,
  w: number,
  h: number,
  deep: number,
  gear: string,
  seed: number,
): string {
  return frame(name, w, h, (c) => {
    c.rect(0, h - 2, w, 2, '1');
    flatRoof(c, 0, 0, w - 1, deep - 1, gear, seed);
    c.each((x, y) => (y >= deep && y < h - 2 ? brick(x, y, 0, w) : null));
    // Floors of windows.
    for (let y = deep + 3; y < h - 13; y += 9)
      for (let x = 3; x < w - 6; x += 9) window(c, x, y, 5, 6, hash(x, y, seed, 63) < 0.45);
    // Street floor: a steel door and a lit transom, a wall sign.
    const dx = 4 + Math.floor(hash(seed, 64) * (w - 14));
    c.rect(dx, h - 12, 7, 10, '7');
    c.rect(dx + 1, h - 11, 5, 9, '8');
    c.rect(dx + 3, h - 11, 1, 9, '7');
    c.rect(dx, h - 13, 7, 1, 't');
    const sx = dx > w / 2 ? 3 : w - 9;
    c.rect(sx, h - 12, 6, 5, 'q');
    c.rect(sx + 1, h - 11, 4, 3, 's');
    c.rect(0, h - 3, w, 1, '7');
    c.outline('0');
  });
}

/**
 * A neon shop, `w`×`h`: a short brick upper floor under a flat roof, then the shopfront: pink neon
 * tubes framing lit glass, a striped awning, a glowing sign standing on the roof's edge.
 */
export function neonShop(name: string, w: number, h: number, seed: number): string {
  return frame(name, w, h, (c) => {
    const deep = Math.round(h * 0.36);
    c.rect(0, h - 2, w, 2, '1');
    flatRoof(c, 0, 4, w - 1, deep - 1, seed % 2 ? 'v' : 'a', seed);
    // The sign on the roof's front edge.
    c.rect(4, 0, w - 8, 7, 'k');
    c.rect(5, 1, w - 10, 5, 'z');
    for (let x = 6; x < w - 6; x += 3) c.rect(x, 2, 2, 3, x % 2 ? 'n' : 'o');
    c.rect(4, 7, 1, deep - 7, '7');
    c.rect(w - 5, 7, 1, deep - 7, '7');
    // Upper floor.
    c.each((x, y) => (y >= deep && y < deep + 7 ? brick(x, y, 0, w) : null));
    for (let x = 3; x < w - 6; x += 8) window(c, x, deep + 1, 5, 4, hash(x, seed, 65) < 0.6);
    // Awning, striped pink and white.
    const ay = deep + 7;
    c.each((x, y) => (y >= ay && y < ay + 4 ? (Math.floor(x / 3) % 2 ? 'n' : 'v') : null));
    c.rect(0, ay + 3, w, 1, 'p');
    // Shopfront: neon frame, lit glass, a door.
    const fy = ay + 4;
    c.rect(0, fy, w, h - 2 - fy, 'n');
    c.rect(2, fy + 1, w - 4, h - 4 - fy, 'o');
    c.rect(3, fy + 2, w - 6, h - 6 - fy, 't');
    const door = Math.floor(w / 2) - 3;
    c.rect(door, fy + 2, 6, h - 4 - fy, 'k');
    c.rect(door + 1, fy + 3, 4, h - 6 - fy, 'u');
    for (let x = 4; x < w - 4; x += 5) if (x < door - 1 || x > door + 6) c.set(x, fy + 3, 'v');
    c.outline('0');
  });
}

/** A concrete office tower, 32×64: a tall grey face of lit and dark windows, an aerial. */
export function tower(): string {
  return frame('tower', 32, 64, (c) => {
    c.rect(0, 62, 32, 2, '1');
    flatRoof(c, 1, 6, 30, 21, 'v', 9);
    c.rect(22, 0, 1, 8, '9');
    c.set(22, 0, 'n');
    c.each((x, y) => {
      if (y < 22 || y > 61) return null;
      if (x < 1 || x > 30) return null;
      return x < 6 ? '9' : x > 26 ? '7' : '8';
    });
    for (let y = 25; y < 54; y += 6)
      for (let x = 4; x < 27; x += 6) {
        const lit = hash(x, y, 71) < 0.4;
        c.rect(x, y, 4, 4, lit ? 't' : 'u');
        if (lit) c.rect(x, y + 3, 4, 1, 's');
      }
    c.rect(11, 54, 10, 8, 'k');
    c.rect(12, 55, 8, 7, 't');
    c.rect(15, 55, 2, 7, 'k');
    c.outline('0');
  });
}

/**
 * The Hayabusa dojo, 48×40 (by 6-2, where Ryu is held): a dark tiled hip roof with a gold ridge
 * crest over white plaster and dark timber, lit paper doors, a wooden step.
 */
export function dojo(): string {
  return frame('dojo', 48, 40, (c) => {
    shadow(c, 24, 37, 22, 2.5, '1');
    // Walls: timber frame, plaster panels.
    c.each((x, y) => {
      if (x < 4 || x > 43 || y < 20 || y > 37) return null;
      if (x % 8 === 4 || y === 20 || y === 37) return 'd';
      return x > 38 ? '8' : '9';
    });
    // Paper doors, lit from inside.
    c.rect(16, 25, 16, 12, 'd');
    for (let x = 17; x < 31; x++)
      for (let y = 26; y < 37; y++) c.set(x, y, x % 4 === 0 || y % 4 === 1 ? 's' : 't');
    c.rect(23, 25, 2, 12, 'd');
    c.rect(14, 37, 20, 2, 'd');
    // The roof: wide eaves over the walls.
    roof(c, 0, 2, 47, 22, { dark: 'k', body: 'l', light: 'm', ridge: 's' });
    c.rect(0, 22, 48, 1, 'k');
    // Ridge ends curled up, gold.
    c.rect(14, 8, 2, 2, 's');
    c.rect(32, 8, 2, 2, 's');
    // A plaque under the eaves.
    c.rect(20, 21, 8, 3, 'q');
    c.rect(21, 22, 6, 1, 's');
    c.outline('0');
  });
}

/** The hermit's hot spring on the pass, 32×32: a ring of rocks round steaming water, snow about. */
export function hotSpring(): string {
  return frame('hot-spring', 32, 32, (c) => {
    c.ellipse(16, 18, 15, 11, (x, y, d) => (d > 0.72 ? (x + y < 30 ? '9' : '8') : d > 0.6 ? '7' : 'g'));
    c.ellipse(16, 18, 9, 6, (x, y) => (hash(x, y, 81) < 0.15 ? 'v' : null));
    for (const [x, y] of [
      [4, 12],
      [9, 7],
      [20, 7],
      [26, 11],
      [27, 21],
      [6, 24],
    ] as [number, number][])
      c.ellipse(x, y, 3, 2.2, (_x, yy) => (yy < y ? 'v' : '8'));
    // A wooden bucket and a little sign.
    c.rect(25, 24, 4, 4, 'd');
    c.rect(25, 24, 4, 1, 'q');
    c.outline('0');
  });
}

/** A red torii gate, 32×32, on the temple's walk: two posts, the tie beam, the curved top beam. */
export function torii(): string {
  return frame('torii', 32, 32, (c) => {
    shadow(c, 16, 29, 13, 2, '7');
    for (const x of [6, 23]) {
      c.rect(x, 8, 3, 21, 'q');
      c.rect(x, 8, 1, 21, 'r');
      c.rect(x - 1, 27, 5, 2, 'z');
    }
    c.rect(3, 10, 26, 3, 'q');
    c.rect(3, 10, 26, 1, 'r');
    c.each((x, y) => {
      const lift = Math.round(Math.abs(x + 0.5 - 16) ** 2 / 90);
      return y >= 3 - lift && y <= 5 - lift && x >= 0 && x <= 31 ? 'k' : null;
    });
    c.each((x, y) => {
      const lift = Math.round(Math.abs(x + 0.5 - 16) ** 2 / 90);
      return y >= 6 - lift && y <= 7 - lift && x >= 1 && x <= 30 ? 'q' : null;
    });
    c.rect(15, 8, 2, 4, 'q');
    c.outline('0');
  });
}

/** A moored wooden boat in the canal, 32×16, seen from above: a hull, thwarts, a coiled rope. */
export function boat(): string {
  return frame('boat', 32, 16, (c) => {
    c.ellipse(16, 9, 15, 6, (x, _y, d) => (d > 0.7 ? 'd' : x < 8 ? 'r' : 'q'));
    c.ellipse(16, 8.5, 12, 4, (x) => (x < 10 ? 'j' : 'i'));
    for (const x of [10, 16, 22]) c.rect(x, 5, 2, 7, 'd');
    c.ellipse(26, 8, 2, 1.5, 's');
    c.rect(0, 14, 32, 1, 'e');
    c.outline('0');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Node markers                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

const CAP = (body: string, dark: string, light: string, mark: string): SpaceInk => ({
  shadow: '1',
  dark,
  body,
  light,
  mark,
  outline: '0',
});
const RING = { dark: '7', light: '9' };

/**
 * The pagoda (6-4, the demon temple; the castle node), 32×48 standing on its tile: three tiers of
 * dark curved roofs on red lacquer walls, gold finial; its door glows demon-red while the masked
 * ninja holds it, and once cleared the door is shut and a white lantern hangs lit.
 */
function pagoda(cleared: boolean): string {
  return frame(cleared ? 'pagoda-cleared' : 'pagoda', 32, 48, (c) => {
    shadow(c, 16, 45, 14, 2.5, '7');
    // Stone base.
    c.rect(3, 40, 26, 6, '8');
    c.rect(3, 40, 26, 1, '9');
    c.rect(3, 45, 26, 1, '7');
    const tier = (y0: number, hw: number, wallH: number): void => {
      // Walls.
      c.rect(16 - hw + 3, y0 + 5, (hw - 3) * 2, wallH, 'q');
      c.rect(16 - hw + 3, y0 + 5, 2, wallH, 'r');
      c.rect(16 + hw - 5, y0 + 5, 2, wallH, 'p');
      // Roof: curved eaves turned up at the tips.
      c.each((x, y) => {
        const dx = Math.abs(x + 0.5 - 16);
        if (dx > hw) return null;
        const lift = Math.round((dx / hw) ** 3 * 3);
        if (y < y0 + 1 - lift + Math.round(dx / 4) * 0 || y > y0 + 5 - lift) return null;
        if (y < y0 - lift + Math.round((hw - dx) / 3) * -1) return null;
        return y === y0 + 5 - lift ? 's' : x < 16 ? 'm' : 'l';
      });
    };
    tier(30, 15, 10);
    tier(19, 12, 7);
    tier(9, 9, 6);
    // Top cap and finial.
    c.ellipse(16, 8, 5, 2.5, (x) => (x < 16 ? 'm' : 'l'));
    c.rect(15, 0, 2, 7, 's');
    for (const y of [2, 4]) c.rect(14, y, 4, 1, 's');
    // The door.
    c.rect(12, 35, 8, 6, cleared ? 'd' : 'z');
    if (!cleared) {
      c.rect(13, 37, 6, 4, 'p');
      c.rect(14, 38, 4, 3, 'r');
      c.set(15, 36, 'n');
      c.set(16, 36, 'n');
    } else {
      c.rect(15, 35, 1, 6, 'q');
      c.rect(22, 31, 3, 5, 'v');
      c.rect(23, 32, 1, 3, 't');
    }
    c.outline('0');
  });
}

/** The bonus spot: a manhole into the sewers with a gold shuriken cast in its lid (used: dull). */
function manhole(used: boolean): string {
  return frame(used ? 'bonus-used' : 'bonus', 16, 16, (c) => {
    c.ellipse(8.5, 10, 7.5, 5, '1');
    c.ellipse(8, 9, 7, 5, (_x, y, d) => (d > 0.75 ? (y > 9 ? '7' : '9') : used ? '8' : 'l'));
    const col = used ? '7' : 's';
    // A four-point shuriken: a hub, and a blade swept round from each side.
    for (const [x, y] of [
      [8, 5],
      [9, 6],
      [11, 8],
      [10, 9],
      [8, 12],
      [7, 11],
      [4, 9],
      [5, 8],
      [8, 6],
      [10, 8],
      [8, 11],
      [5, 9],
    ] as [number, number][])
      c.set(x, y, col);
    c.rect(7, 8, 3, 2, col);
    if (!used) c.set(8, 8, 'v');
    c.outline('0');
  });
}

export function nodeFrames(): Record<string, string> {
  return {
    open: space(book, 'node-open', CAP('q', 'p', 'r', 'v'), 'none', RING),
    cleared: space(book, 'node-cleared', CAP('f', 'e', 'g', 'v'), 'star', RING),
    start: space(book, 'node-start', CAP('c', 'a', 'y', 'v'), 'none', RING),
    secret: space(book, 'node-secret', CAP('n', 'p', 'o', 'z'), 'key', RING),
    secretCleared: space(book, 'node-secret-cleared', CAP('o', 'n', 'v', 'z'), 'key', RING),
    bonus: manhole(false),
    bonusUsed: manhole(true),
    castle: pagoda(false),
    castleCleared: pagoda(true),
  };
}

/** The node marker on a GALESBURG page (above-render AboveLook.node). */
export function galesburgNodeFrame(
  kind: MapNode['kind'],
  s: { cleared: boolean; secret: boolean },
): string | null {
  if (kind === 'castle') return s.cleared ? 'pagoda-cleared' : 'pagoda';
  if (kind === 'bonus') return s.cleared ? 'bonus-used' : 'bonus';
  if (kind === 'start') return 'node-start';
  if (kind !== 'level') return null;
  if (s.secret) return s.cleared ? 'node-secret-cleared' : 'node-secret';
  return s.cleared ? 'node-cleared' : 'node-open';
}

/* ---------------------------------------------------------------------------------------------- */
/* A page's ground, worked out once                                                                */
/* ---------------------------------------------------------------------------------------------- */

/** The open roads: lamp-lit pale concrete with a light halo, readable on the night paving. */
const ROAD_INK = { rim: '4', body: '5', light: '6', speck: '4', halo: '3' };

/** The road joins' names, by mask (1 n, 2 e, 4 s, 8 w); painted with the sheet. */
export const GALESBURG_ROAD_FRAMES: readonly string[] = roadNames('road');

const WET = new Set(['~', '=', 'I']);
const grounds = new WeakMap<readonly string[], AboveGround>();

/**
 * The ground of a GALESBURG page (world6-galesburg.ts's legend): paving, lawn, snow, gravel, the
 * cliff and its stairs, the canal with its quays; the scenery chars stand on the ground round them.
 */
export function galesburgGround(tiles: readonly string[]): AboveGround {
  const hit = grounds.get(tiles);
  if (hit) return hit;
  const b = groundBuilder(tiles);
  for (let i = 0; i < b.count; i++) b.tile(i);
  grounds.set(tiles, b.out);
  return b.out;
}

/** galesburgGround's steps: one ground tile each (a lazy sheet's prepaint), then the cache. */
function groundSteps(tiles: readonly string[]): (() => void)[] {
  if (grounds.has(tiles)) return [];
  const b = groundBuilder(tiles);
  return [
    ...Array.from({ length: b.count }, (_, i) => () => b.tile(i)),
    () => void (grounds.has(tiles) || grounds.set(tiles, b.out)),
  ];
}

/** Works out a GALESBURG page's ground a tile at a time, in row order (`tile(i)`, i < count). */
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
  /** The ground under a scenery char: the most common plain ground beside it. */
  const baseAt = (x: number, y: number): string => {
    const n = [ch(x - 1, y), ch(x + 1, y), ch(x, y + 1), ch(x, y - 1)];
    for (const k of ['o', ',', ':']) if (n.filter((c) => c === k).length >= 2) return k;
    return '#';
  };
  const plain = (c: string, v: number): string =>
    c === 'o' ? snow(v) : c === ',' ? lawn(v) : c === ':' ? gravel(v) : pave(v);
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
      f0.push(water(sides, corners, 0));
      f1.push(water(sides, corners, 1));
      return;
    }
    let g: string;
    if (y < 2) g = band(x);
    else if (c === '^' || c === 'G') {
      const cl = (k: string) => k === '^' || k === 'G';
      const s: Sides = { n: cl(ch(x, y - 1)), e: cl(ch(x + 1, y)), s: cl(ch(x, y + 1)), w: cl(ch(x - 1, y)) };
      g = c === 'G' ? stairs() : cliff(s);
    } else if ('o,:'.includes(c)) g = plain(c, v);
    else if ('TYSXHRC'.includes(c)) g = plain(c === 'T' ? ',' : baseAt(x, y), v);
    else g = hash(x, y, 8) < 0.08 ? drain() : pave(v);
    f0.push(g);
    f1.push(g);
    const stand = (fr: string, dy = 0): void =>
      void scenery.push({ frame: fr, x: x * 16, y: y * 16 + dy, feet: y * 16 + 16 });
    if (c === 'T') stand(bamboo(), -16);
    else if (c === 'Y') stand(pine(), -16);
    else if (c === 'S') stand(lantern(), -16);
    else if (c === 'X') stand(streetLamp(), -16);
    else if (c === 'H') stand(bush());
    else if (c === 'R') stand(rock());
    else if (c === 'C')
      stand(lowWall({ n: false, s: false, w: ch(x - 1, y) === 'C', e: ch(x + 1, y) === 'C' }));
  };
  return { count: tiles.length * 16, tile, out: { frames: [f0, f1], wet, scenery } };
}

/**
 * Every frame of the sheet, with the grounds of the pages given, as small painting steps: a frame
 * or a few small ones, a road join, a ground tile (a building is one step: it paints as a whole).
 */
function paintSteps(pages: readonly (readonly string[])[]): (() => void)[] {
  const steps: (() => void)[] = [];
  const add = (f: () => unknown): void => void steps.push(() => void f());
  for (let v = 0; v < 4; v++) {
    add(() => pave(v));
    add(() => lawn(v));
    add(() => snow(v));
    add(() => gravel(v));
  }
  add(drain);
  add(bamboo);
  add(pine);
  add(lantern);
  add(streetLamp);
  add(bush);
  add(rock);
  add(() => brickBlock('brick-block', 48, 48, 22, 'at', 1));
  add(() => brickBlock('brick-block-b', 48, 48, 24, 'sv', 2));
  add(() => brickBlock('brick-narrow', 32, 48, 20, 'v', 3));
  add(() => brickBlock('brick-low', 48, 32, 14, 'a', 4));
  add(() => neonShop('neon-shop', 32, 36, 1));
  add(() => neonShop('neon-shop-wide', 48, 32, 2));
  add(tower);
  add(dojo);
  add(hotSpring);
  add(torii);
  add(boat);
  add(nodeFrames);
  steps.push(...roadSteps(book, 'road', ROAD_INK));
  for (const tiles of pages) steps.push(...groundSteps(tiles));
  return steps;
}

/**
 * The `galesburg-above` sheet: every frame, with the grounds of the pages given (after autoShore),
 * painted the first time the game draws from it, or ahead of that in slices while a map idles
 * (lazySheet), never when the game loads.
 */
export function galesburgAboveSheet(pages: readonly (readonly string[])[]): LazySheetDef {
  return lazySheet(
    'galesburg-above',
    () => paintSteps(pages),
    () => F,
  );
}

/** How many of the sheet's frames are painted so far (0 until World 6 first shows). */
export const galesburgPainted = (): number => book.size;
