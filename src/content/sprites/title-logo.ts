import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { fontDef } from './font';

/**
 * The SMB Crossover REMIX title logo (0.5.0), generated as pixel text from the HUD font's glyphs:
 * each letter is the 8x8 glyph scaled up, given a banded fill, a bevel, a 3D extrude and an
 * outline, so the logo is plain sprite rows like every other piece of art (no image files).
 *
 *   cross-0..8   one frame per CROSSOVER letter (the title drops them in one by one)
 *   smb-tag      "SMB" on a small red tag
 *   remix        the red-on-white REMIX rubber stamp, sheared, with worn ink
 *   remix-2x     the stamp at twice the size (its one-frame slam)
 *   remix-shadow the stamp's drop shadow
 *   smbc-line    the one-line "SMBC REMIX" logo, 8px text (pause screen)
 *   dust-0..2    the dust puff the stamp kicks up
 *
 * `title-rift` is the wand's rift for the title intro: a jagged, eye-shaped tear in RIFT_STAGES
 * sizes (opening from the centre outward), drawn with four palettes that rotate its four band
 * colours (the shimmer is palette cycling, no extra art).
 */

/** Palette roles of `title-logo`. */
const LOGO = {
  black: '0',
  white: '1',
  gold1: '2',
  gold2: '3',
  orange: '4',
  orangeDark: '5',
  redDark: '6',
  red: '7',
  grey: '8',
} as const;

export const titleLogoPalette: readonly string[] = [
  NES.black,
  NES.white,
  '#f8d878',
  '#f8b800',
  '#fca044',
  '#e45c10',
  '#a81000',
  '#f83800',
  NES.lightGray,
];

/** A char grid: '.' is empty, anything else a palette role. */
class Grid {
  readonly c: string[];
  constructor(
    readonly w: number,
    readonly h: number,
    fill = '.',
  ) {
    this.c = new Array<string>(w * h).fill(fill);
  }
  get(x: number, y: number): string {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? (this.c[y * this.w + x] as string) : '.';
  }
  set(x: number, y: number, ch: string): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = ch;
  }
  rect(x: number, y: number, w: number, h: number, ch: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch);
  }
  /** Copy `src` in at (x, y); `shear` lifts each column by col × shear px (a pixel-art tilt). */
  paste(src: Grid, x: number, y: number, shear = 0): void {
    for (let i = 0; i < src.w; i++) {
      const dy = -Math.round(i * shear);
      for (let j = 0; j < src.h; j++) {
        const ch = src.get(i, j);
        if (ch !== '.') this.set(x + i, y + j + dy, ch);
      }
    }
  }
  /** A 1px outline in every empty cell next to a filled one. */
  outline(ch: string): void {
    const pts: number[] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== '.') continue;
        const near =
          this.get(x + 1, y) !== '.' ||
          this.get(x - 1, y) !== '.' ||
          this.get(x, y + 1) !== '.' ||
          this.get(x, y - 1) !== '.';
        if (near) pts.push(x, y);
      }
    for (let k = 0; k < pts.length; k += 2) this.set(pts[k] as number, pts[k + 1] as number, ch);
  }
  rows(): string[] {
    const out: string[] = [];
    for (let y = 0; y < this.h; y++) out.push(this.c.slice(y * this.w, (y + 1) * this.w).join(''));
    return out;
  }
}

/** Deterministic hash noise 0..1. */
function hash(x: number, y: number, s = 0): number {
  let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/** 4x4 Bayer threshold 0..1. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number): number => ((BAYER[(y & 3) * 4 + (x & 3)] as number) + 0.5) / 16;

/** The font's glyph mask for `s`, each pixel scaled to sx × sy, letters `adv` source px apart. */
function mask(s: string, sx: number, sy: number, adv = 8): { w: number; h: number; m: Uint8Array } {
  const w = (s.length - 1) * adv * sx + 7 * sx;
  const h = 7 * sy;
  const m = new Uint8Array(w * h);
  [...s].forEach((ch, k) => {
    const g = fontDef.frames[ch];
    if (!g) throw new Error(`title logo: the font has no glyph "${ch}"`);
    for (let j = 0; j < 7; j++)
      for (let i = 0; i < 7; i++)
        if ((g[j] as string)[i] === '1')
          for (let b = 0; b < sy; b++)
            for (let a = 0; a < sx; a++) m[(j * sy + b) * w + k * adv * sx + i * sx + a] = 1;
  });
  return { w, h, m };
}

interface WordStyle {
  sx: number;
  sy: number;
  /** Fill roles, top band to bottom band. */
  bands: string[];
  /** 1px highlight on each stroke's top edge. */
  hi?: string;
  /** 1px shade on each stroke's bottom edge. */
  lo?: string;
  extrude?: string;
  depth?: number;
  outline?: string;
}

/** A bevelled block word: banded fill, highlight and shade, a down-right extrude, an outline. */
function blockWord(s: string, o: WordStyle): Grid {
  const { w, h, m } = mask(s, o.sx, o.sy);
  const depth = o.extrude ? (o.depth ?? 0) : 0;
  const pad = 2 + depth;
  const g = new Grid(w + pad * 2, h + pad * 2);
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1;
  if (o.extrude)
    for (let d = depth; d >= 1; d--)
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) if (at(x, y)) g.set(pad + x + d, pad + y + d, o.extrude);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      let ch = o.bands[Math.min(o.bands.length - 1, Math.floor((y / h) * o.bands.length))] as string;
      if (o.hi && !at(x, y - 1)) ch = o.hi;
      else if (o.lo && !at(x, y + 1)) ch = o.lo;
      g.set(pad + x, pad + y, ch);
    }
  if (o.outline) g.outline(o.outline);
  return g;
}

/** Plain 8x8 font text into a grid. */
function text(g: Grid, s: string, x: number, y: number, ch: string): void {
  [...s].forEach((c, k) => {
    const rows = fontDef.frames[c];
    if (!rows) return;
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] !== '.') g.set(x + k * 8 + i, y + j, ch);
    });
  });
}

function scale2(rows: readonly string[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const wide = [...r].map((c) => c + c).join('');
    out.push(wide, wide);
  }
  return out;
}

export const CROSSOVER_LETTERS = 'CROSSOVER';
/** Letter advance of the big CROSSOVER (the font's 8px cell at 3x). */
export const CROSSOVER_ADVANCE = 24;
const CROSS_STYLE: WordStyle = {
  sx: 3,
  sy: 4,
  bands: [LOGO.gold1, LOGO.gold2, LOGO.orange, LOGO.orangeDark],
  hi: LOGO.white,
  lo: LOGO.redDark,
  extrude: LOGO.redDark,
  depth: 3,
  outline: LOGO.black,
};

function smbTag(): Grid {
  const tag = new Grid(58, 22, LOGO.black);
  tag.rect(1, 1, 56, 20, LOGO.red);
  tag.rect(2, 2, 54, 1, LOGO.orange);
  tag.rect(2, 19, 54, 1, LOGO.redDark);
  const smb = blockWord('SMB', { sx: 2, sy: 2, bands: [LOGO.white], outline: LOGO.black });
  tag.paste(smb, 29 - Math.floor(smb.w / 2), 11 - Math.floor(smb.h / 2));
  return tag;
}

/** The stamp's tilt: each column one fifth of a pixel higher than the one before (about 11°). */
const STAMP_SHEAR = 0.2;

/** The REMIX stamp, outlined and sheared; `ink` replaces every coloured pixel (the shadow). */
function remixStamp(ink?: string): Grid {
  const scale = 2;
  const word = 'REMIX';
  const W = word.length * 8 * scale - scale + 12;
  const H = 7 * scale + 10;
  const s = new Grid(W, H, LOGO.white);
  const red = LOGO.red;
  s.rect(0, 0, W, 2, red);
  s.rect(0, H - 2, W, 2, red);
  s.rect(0, 0, 2, H, red);
  s.rect(W - 2, 0, 2, H, red);
  s.rect(3, 3, W - 6, 1, red);
  s.rect(3, H - 4, W - 6, 1, red);
  s.rect(3, 3, 1, H - 6, red);
  s.rect(W - 4, 3, 1, H - 6, red);
  const { w, h, m } = mask(word, scale, scale);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) s.set(6 + x, 5 + y, red);
  // Worn ink: a few pixels of the red knocked back to paper.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (s.get(x, y) === red && hash(x, y, 7) < 0.035) s.set(x, y, LOGO.white);
  const o = new Grid(W + 2, H + 2);
  o.paste(s, 1, 1);
  o.outline(LOGO.black);
  const lift = Math.round((o.w - 1) * STAMP_SHEAR);
  const out = new Grid(o.w, o.h + lift);
  out.paste(o, 0, lift, STAMP_SHEAR);
  if (ink) for (let k = 0; k < out.c.length; k++) if (out.c[k] !== '.') out.c[k] = ink;
  return out;
}

/** "SMBC" in white beside a red REMIX box, outlined: 8px text for bars and the pause screen. */
function smbcLine(): Grid {
  const g = new Grid(86, 13);
  text(g, 'SMBC', 2, 3, LOGO.white);
  g.rect(37, 1, 47, 11, LOGO.red);
  text(g, 'REMIX', 41, 3, LOGO.white);
  g.outline(LOGO.black);
  return g;
}

/** A dust puff `k` (0..2) frames into its life: a ring of little clouds spreading out. */
function dust(k: number): Grid {
  const g = new Grid(32, 12);
  const r = 2 + k;
  for (const [cx, cy] of [
    [6 - k * 2, 8],
    [16, 6 - k],
    [26 + k * 2, 8],
  ] as const)
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        const d = x * x + y * y;
        if (d > r * r) continue;
        if (k === 2 && bayer(cx + x, cy + y) < 0.5) continue;
        g.set(cx + x, cy + y, d > (r - 1) * (r - 1) ? LOGO.grey : LOGO.white);
      }
  return g;
}

function logoFrames(): Record<string, string[]> {
  const f: Record<string, string[]> = {};
  [...CROSSOVER_LETTERS].forEach((ch, i) => (f[`cross-${i}`] = blockWord(ch, CROSS_STYLE).rows()));
  f['smb-tag'] = smbTag().rows();
  const remix = remixStamp().rows();
  f.remix = remix;
  f['remix-2x'] = scale2(remix);
  f['remix-shadow'] = remixStamp(LOGO.black).rows();
  f['smbc-line'] = smbcLine().rows();
  for (let k = 0; k < 3; k++) f[`dust-${k}`] = dust(k).rows();
  return f;
}

/** Frames built on first use (the rift's are big), then kept. */
function lazyFrames(
  names: readonly string[],
  build: () => Record<string, string[]>,
): Record<string, string[]> {
  let built: Record<string, string[]> | null = null;
  const frames: Record<string, string[]> = {};
  for (const n of names)
    Object.defineProperty(frames, n, {
      enumerable: true,
      get: () => (built ??= build())[n],
    });
  return frames;
}

const LOGO_NAMES = [
  ...[...CROSSOVER_LETTERS].map((_, i) => `cross-${i}`),
  'smb-tag',
  'remix',
  'remix-2x',
  'remix-shadow',
  'smbc-line',
  'dust-0',
  'dust-1',
  'dust-2',
];

export const titleLogoDef: SpriteDef = { palette: 'title-logo', frames: lazyFrames(LOGO_NAMES, logoFrames) };

// ---------------------------------------------------------------- the rift

/** Sizes the rift tears open through (rift-1 a sliver at the centre .. rift-N fully open). */
export const RIFT_STAGES = 8;
export const RIFT_WIDTH = 256;
export const RIFT_HEIGHT = 104;
/** Centre and half-size of the fully open rift, in its frame. */
const RX = 128;
const RY = 50;
const RAX = 126;
const RAY = 44;

/** Rift roles: inside (2), then the four cycling bands, rim last. */
const RIFT = { deep: '0', swirl: '1', violet: '2', magenta: '3', cyan: '4', pale: '5', rim: '6' } as const;
/** The four colours that rotate through the band roles (violet, magenta, cyan, white-hot rim). */
const RIFT_CYCLE = ['#9878f8', '#d800cc', '#3cbcfc', NES.white];
export const RIFT_PALETTES = [0, 1, 2, 3].map((k) => `title-rift-${k}`);
export const titleRiftPalettes: Record<string, readonly string[]> = Object.fromEntries(
  RIFT_PALETTES.map((name, k) => {
    const c = (i: number) => RIFT_CYCLE[(i + k) % 4] as string;
    return [name, ['#0000bc', '#2038ec', c(0), c(1), c(2), NES.skyLight, c(3)]];
  }),
);

/** The tear's jagged edge: a radius factor around 1 by angle. */
function riftEdge(th: number): number {
  const n = 34;
  const t = ((th + Math.PI) / (2 * Math.PI)) * n;
  const k = Math.floor(t);
  const f = t - k;
  const amp = (j: number) => {
    const jj = ((j % n) + n) % n;
    return (jj % 2 ? 0.1 : -0.06) + 0.08 * hash(jj, 3, 11);
  };
  return 1 + amp(k) * (1 - f) + amp(k + 1) * f;
}

function riftFrame(stage: number): string[] {
  const e = stage / RIFT_STAGES;
  const ax = RAX * e;
  const ay = RAY * Math.pow(e, 0.6);
  const g = new Grid(RIFT_WIDTH, RIFT_HEIGHT);
  for (let y = 0; y < RIFT_HEIGHT; y++)
    for (let x = 0; x < RIFT_WIDTH; x++) {
      const u = (x - RX) / ax;
      if (Math.abs(u) >= 1) continue;
      const hh = (1 - u * u) ** 0.7 * riftEdge(u * 3);
      const w = (y - RY) / ay / hh;
      const v = Math.abs(w);
      if (v > 1.12) continue;
      if (v > 1) {
        if (bayer(x, y) < (1.12 - v) * 4) g.set(x, y, RIFT.magenta);
        continue;
      }
      const sw = Math.sin(u * 14 + w * 3 - v * 6);
      const p = v + 0.06 * sw;
      const d = bayer(x, y);
      let ch: string;
      if (p < 0.55) ch = sw > 0.6 && d < 0.5 ? RIFT.swirl : RIFT.deep;
      else if (p < 0.72) ch = d < (p - 0.55) * 6 ? RIFT.violet : RIFT.swirl;
      else if (p < 0.84) ch = sw > 0 ? RIFT.magenta : RIFT.violet;
      else if (p < 0.93) ch = d < 0.6 ? RIFT.cyan : RIFT.pale;
      else ch = RIFT.rim;
      g.set(x, y, ch);
    }
  return g.rows();
}

const RIFT_NAMES = Array.from({ length: RIFT_STAGES }, (_, i) => `rift-${i + 1}`);
export const titleRiftDef: SpriteDef = {
  palette: 'title-rift-0',
  frames: lazyFrames(RIFT_NAMES, () => Object.fromEntries(RIFT_NAMES.map((n, i) => [n, riftFrame(i + 1)]))),
};

export const titleLogoPalettes: Record<string, readonly string[]> = {
  'title-logo': titleLogoPalette,
  ...titleRiftPalettes,
};
