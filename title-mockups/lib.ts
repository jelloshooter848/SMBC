// Scratch only (not in the repo): pixel helpers for the title-screen mockups.
import { Img } from './png';
import { PALETTES, SPRITES } from '@content/sprites';
import { fontDef } from '@content/sprites/font';
import { rasterizeToBuffer, type Rasterized } from '@engine/gfx/pixelart';
import { resolvePalette } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { sophiaDef, sophiaPalettes } from './sophia';

export type RGB = [number, number, number];
export const rgb = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** RGBA layer with hard (0/255) alpha. */
export class Layer {
  d: Uint8Array;
  constructor(
    public w: number,
    public h: number,
    bg?: string,
  ) {
    this.d = new Uint8Array(w * h * 4);
    if (bg) this.rect(0, 0, w, h, bg);
  }
  inb(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  set(x: number, y: number, c: string | RGB) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inb(x, y)) return;
    const v = typeof c === 'string' ? rgb(c) : c;
    const o = (y * this.w + x) * 4;
    this.d[o] = v[0];
    this.d[o + 1] = v[1];
    this.d[o + 2] = v[2];
    this.d[o + 3] = 255;
  }
  get(x: number, y: number): RGB | null {
    if (!this.inb(x, y)) return null;
    const o = (y * this.w + x) * 4;
    if (this.d[o + 3]! === 0) return null;
    return [this.d[o]!, this.d[o + 1]!, this.d[o + 2]!];
  }
  hex(x: number, y: number): string | null {
    const c = this.get(x, y);
    return c ? '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('') : null;
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    const v = rgb(c);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, v);
  }
  /** Paste `src` at (x, y); `shear` lifts each column by col*shear px (a pixel-art tilt). */
  paste(src: Layer, x: number, y: number, shear = 0) {
    for (let i = 0; i < src.w; i++) {
      const dy = -Math.round(i * shear);
      for (let j = 0; j < src.h; j++) {
        const c = src.get(i, j);
        if (c) this.set(x + i, y + j + dy, c);
      }
    }
  }
  /** Copy pixels of `src` (same size) where `inside(x, y)` holds. */
  clipFrom(src: Layer, ox: number, oy: number, inside: (x: number, y: number) => boolean) {
    for (let j = 0; j < src.h; j++)
      for (let i = 0; i < src.w; i++) {
        if (!inside(i, j)) continue;
        const c = src.get(i, j);
        if (c) this.set(ox + i, oy + j, c);
      }
  }
  /** 1px outline around every opaque pixel of the layer (drawn into this layer's empty cells). */
  outline(c: string, diag = false) {
    const pts: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        const n = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          ...(diag
            ? [
                [1, 1],
                [-1, -1],
                [1, -1],
                [-1, 1],
              ]
            : []),
        ].some(([dx, dy]) => this.get(x + dx!, y + dy!));
        if (n) pts.push([x, y]);
      }
    for (const [x, y] of pts) this.set(x, y, c);
  }
  save(path: string, scale = 1) {
    const img = new Img(this.w * scale, this.h * scale, [0, 0, 0]);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y) ?? [0, 0, 0];
        img.fill(x * scale, y * scale, scale, scale, c);
      }
    img.save(path);
  }
}

// ---------------------------------------------------------------- sprites
const EXTRA: Record<string, { def: SpriteDef; pals: Record<string, readonly string[]> }> = {
  sophia: { def: sophiaDef, pals: sophiaPalettes },
};
const cache = new Map<string, Rasterized>();
function raster(sheet: string, pal?: string): Rasterized {
  const key = `${sheet}@${pal ?? ''}`;
  let b = cache.get(key);
  if (!b) {
    const extra = EXTRA[sheet];
    if (extra) {
      let p = [...extra.pals[(pal ?? extra.def.palette).replace('~silhouette', '')]!];
      if (pal?.endsWith('~silhouette')) p = p.map(() => '#000000');
      b = rasterizeToBuffer(extra.def, p);
    } else {
      const def = SPRITES[sheet]!;
      b = rasterizeToBuffer(def, resolvePalette(PALETTES, pal ?? def.palette, 'default'));
    }
    cache.set(key, b);
  }
  return b;
}
export function frameSize(sheet: string, frame: string, pal?: string) {
  const f = raster(sheet, pal).frames.get(frame);
  if (!f) throw new Error(`no frame ${sheet}/${frame}`);
  return { w: f.w, h: f.h };
}
export interface SprOpts {
  pal?: string;
  flip?: boolean;
  /** Recolour each pixel (return null to skip it). */
  map?: (c: RGB) => RGB | string | null;
  /** Only draw rows from this row down / limit rows */
  rows?: [number, number];
}
export function spr(dst: Layer, sheet: string, frame: string, x: number, y: number, o: SprOpts = {}) {
  let pal = o.pal;
  if (EXTRA[sheet] && pal && pal.endsWith('~silhouette')) pal = `${pal}`;
  const b = raster(sheet, pal);
  const f = b.frames.get(frame);
  if (!f) throw new Error(`no frame ${sheet}/${frame}`);
  const [r0, r1] = o.rows ?? [0, f.h];
  for (let j = r0; j < r1; j++)
    for (let i = 0; i < f.w; i++) {
      const sx = f.x + (o.flip ? f.w - 1 - i : i);
      const off = ((f.y + j) * b.width + sx) * 4;
      if (b.data[off + 3]! < 128) continue;
      let c: RGB | string | null = [b.data[off]!, b.data[off + 1]!, b.data[off + 2]!];
      if (o.map) c = o.map(c);
      if (c) dst.set(x + i, y + j, c);
    }
  return { w: f.w, h: f.h };
}

/** Hero portrait list (character-select order) plus Sophia from her WIP branch. */
export const HEROES = [
  { id: 'mario', sheet: 'mario', pal: 'mario', frame: 'big-idle' },
  { id: 'luigi', sheet: 'mario', pal: 'luigi', frame: 'big-idle' },
  { id: 'link', sheet: 'link', pal: 'link', frame: 'idle' },
  { id: 'megaman', sheet: 'megaman', pal: 'megaman', frame: 'idle' },
  { id: 'samus', sheet: 'samus', pal: 'samus', frame: 'idle' },
  { id: 'simon', sheet: 'simon', pal: 'simon', frame: 'idle' },
  { id: 'ryu', sheet: 'ryu', pal: 'ryu', frame: 'idle' },
  { id: 'bill', sheet: 'bill', pal: 'bill', frame: 'idle' },
] as const;

// ---------------------------------------------------------------- font
const GLYPHS = fontDef.frames;
export function text(dst: Layer, s: string, x: number, y: number, color = '#fcfcfc', shadow?: string) {
  if (shadow) text(dst, s, x + 1, y + 1, shadow);
  let cx = x;
  for (const ch of s) {
    const g = GLYPHS[ch];
    if (ch !== ' ' && !g) throw new Error(`font has no glyph '${ch}' (in "${s}")`);
    if (g)
      g.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] !== '.') dst.set(cx + i, y + j, color);
      });
    cx += 8;
  }
}
export const textW = (s: string) => s.length * 8 - 1;
export const ctext = (dst: Layer, s: string, y: number, color?: string, shadow?: string, cx = 128) =>
  text(dst, s, Math.round(cx - textW(s) / 2), y, color, shadow);

/** Glyph mask of `s` scaled by (sx, sy); `adv` is the per-letter advance in source px. */
export function mask(s: string, sx: number, sy: number, adv = 8) {
  const w = (s.length - 1) * adv * sx + 7 * sx;
  const h = 7 * sy;
  const m = new Uint8Array(w * h);
  [...s].forEach((ch, k) => {
    const g = GLYPHS[ch];
    if (!g) return;
    for (let j = 0; j < 7; j++)
      for (let i = 0; i < 7; i++)
        if (g[j]![i] === '1')
          for (let b = 0; b < sy; b++)
            for (let a = 0; a < sx; a++) m[(j * sy + b) * w + k * adv * sx + i * sx + a] = 1;
  });
  return { w, h, m };
}

export interface LogoOpts {
  sx: number;
  sy: number;
  adv?: number;
  /** fill colours, top band to bottom band */
  grad: string[];
  /** 1px highlight on each stroke's top edge */
  hi?: string;
  /** 1px shade on each stroke's bottom edge */
  lo?: string;
  extrude?: string;
  depth?: number;
  /** extrude direction */
  dir?: [number, number];
  outline?: string;
  outline2?: string;
}
/** A big bevelled block word: outline, 3D extrude, banded fill, highlight. Returns its layer. */
export function logoWord(s: string, o: LogoOpts): Layer {
  const { w, h, m } = mask(s, o.sx, o.sy, o.adv);
  const depth = o.depth ?? 0;
  const [ddx, ddy] = o.dir ?? [1, 1];
  const pad = 2 + depth;
  const L = new Layer(w + pad * 2, h + pad * 2);
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1;
  if (o.extrude)
    for (let d = depth; d >= 1; d--)
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) if (at(x, y)) L.set(pad + x + d * ddx, pad + y + d * ddy, o.extrude);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      const band = Math.min(o.grad.length - 1, Math.floor((y / h) * o.grad.length));
      let c = o.grad[band]!;
      if (o.hi && !at(x, y - 1)) c = o.hi;
      else if (o.lo && !at(x, y + 1)) c = o.lo;
      L.set(pad + x, pad + y, c);
    }
  if (o.outline) L.outline(o.outline, false);
  if (o.outline2) L.outline(o.outline2, false);
  return L;
}

/** Deterministic hash noise 0..1 */
export const hash = (x: number, y: number, s = 0) => {
  let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
};
/** 4x4 Bayer threshold 0..1 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;

/** A tilted rubber-stamp "REMIX" (or any word) layer. */
export function stamp(word: string, ink: string, paper: string | null, scale = 2, border = true) {
  const tw = word.length * 8 * scale - scale;
  const th = 7 * scale;
  const W = tw + 12;
  const H = th + 10;
  const L = new Layer(W, H);
  if (paper) L.rect(0, 0, W, H, paper);
  if (border) {
    L.rect(0, 0, W, 2, ink);
    L.rect(0, H - 2, W, 2, ink);
    L.rect(0, 0, 2, H, ink);
    L.rect(W - 2, 0, 2, H, ink);
    L.rect(3, 3, W - 6, 1, ink);
    L.rect(3, H - 4, W - 6, 1, ink);
    L.rect(3, 3, 1, H - 6, ink);
    L.rect(W - 4, 3, 1, H - 6, ink);
  }
  const { w, h, m } = mask(word, scale, scale);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) L.set(6 + x, 5 + y, ink);
  // worn ink: knock a few pixels out of the paper side
  if (paper)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) if (L.hex(x, y) === ink && hash(x, y, 7) < 0.035) L.set(x, y, paper);
  return L;
}
