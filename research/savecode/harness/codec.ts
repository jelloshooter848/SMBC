/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Throwaway benchmark codec (NOT game code). A schema-driven bit packer built on the game's own
 * BitWriter / BitReader / Crockford Base32 / CRC-16 (src/game/save/code-bits.ts), with two modes:
 *   full  - every field written, no defaults (a "versioned binary schema");
 *   delta - one "same as K's default" bit per node, values only where they differ.
 */
import { BitReader, BitWriter, CodeFormatError, crc16, fromBase32, toBase32, widthFor } from '@game/save/code-bits';

export type S =
  | { t: 'bool' }
  | { t: 'enum'; vals: readonly unknown[] }
  | { t: 'int'; k: number }
  | { t: 'dec'; k: number; scale: number }
  | { t: 'str'; dict?: readonly string[] }
  | { t: 'list'; of: S }
  | { t: 'set'; dict: readonly string[] }
  | { t: 'map'; key: S; val: S }
  | { t: 'obj'; f: readonly F[] }
  | { t: 'null'; of: S }
  | { t: 'keyed'; head: readonly string[]; mk: (head: any) => any; body: S & { t: 'obj' } };
export type F = readonly [name: string, s: S, opt?: boolean];

export const bool: S = { t: 'bool' };
export const en = (vals: readonly unknown[]): S => ({ t: 'enum', vals });
export const int = (k = 0): S => ({ t: 'int', k });
export const decimal = (scale: number, k = 2): S => ({ t: 'dec', k, scale });
export const str = (dict?: readonly string[]): S => ({ t: 'str', dict });
export const list = (of: S): S => ({ t: 'list', of });
export const set = (dict: readonly string[]): S => ({ t: 'set', dict });
export const map = (key: S, val: S): S => ({ t: 'map', key, val });
export const obj = (...f: F[]): S & { t: 'obj' } => ({ t: 'obj', f });
export const nul = (of: S): S => ({ t: 'null', of });

export function deepEq(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEq(x, b[i]));
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => deepEq(a[k], b[k]));
}

// ------------------------------------------------------------------ primitive writers

function f64bits(w: BitWriter, v: number): void {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, v);
  for (let i = 0; i < 8; i++) w.uint(8, dv.getUint8(i));
}
function readF64(r: BitReader): number {
  const dv = new DataView(new ArrayBuffer(8));
  for (let i = 0; i < 8; i++) dv.setUint8(i, r.uint(8));
  return dv.getFloat64(0);
}
const isWhole = (v: number) => Number.isInteger(v) && v >= 0 && v < 2 ** 40 && !Object.is(v, -0);

function wNum(w: BitWriter, v: number, k: number): void {
  if (isWhole(v)) {
    w.bit(0);
    w.eg(k, v);
  } else {
    w.bit(1);
    f64bits(w, v);
  }
}
function rNum(r: BitReader, k: number): number {
  return r.bit() ? readF64(r) : r.eg(k);
}

/** 7-bit ASCII per character (127: a 16-bit UTF-16 unit follows). */
function wStr(w: BitWriter, s: string): void {
  w.eg(2, s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 127) w.uint(7, c);
    else {
      w.uint(7, 127);
      w.uint(16, c);
    }
  }
}
function rStr(r: BitReader): string {
  const n = r.eg(2);
  if (n > 100000) throw new CodeFormatError('string too long');
  let s = '';
  for (let i = 0; i < n; i++) {
    const c = r.uint(7);
    s += String.fromCharCode(c === 127 ? r.uint(16) : c);
  }
  return s;
}

function wSym(w: BitWriter, dict: readonly string[] | undefined, v: string): void {
  if (!dict || !dict.length) return wStr(w, v);
  const i = dict.indexOf(v);
  const width = widthFor(dict.length + 1);
  if (i >= 0) w.uint(width, i);
  else {
    w.uint(width, dict.length);
    wStr(w, v);
  }
}
function rSym(r: BitReader, dict: readonly string[] | undefined): string {
  if (!dict || !dict.length) return rStr(r);
  const i = r.uint(widthFor(dict.length + 1));
  if (i < dict.length) return dict[i] as string;
  if (i === dict.length) return rStr(r);
  throw new CodeFormatError('bad symbol');
}

// ------------------------------------------------------------------ schema walk

function encBody(w: BitWriter, s: S, v: any, d: any, delta: boolean): void {
  switch (s.t) {
    case 'bool':
      return w.bit(v === true);
    case 'enum': {
      const i = s.vals.findIndex((x) => x === v);
      const width = widthFor(s.vals.length + 1);
      if (i >= 0) return w.uint(width, i);
      w.uint(width, s.vals.length);
      return wStr(w, JSON.stringify(v));
    }
    case 'int':
      return wNum(w, v, s.k);
    case 'dec': {
      const x = Math.round(v * s.scale);
      if (Math.abs(x / s.scale - v) < 1e-12 && isWhole(x)) {
        w.bit(0);
        return w.eg(s.k, x);
      }
      w.bit(1);
      return f64bits(w, v);
    }
    case 'str':
      return wSym(w, s.dict, v);
    case 'list':
      w.eg(0, v.length);
      for (const x of v) enc(w, s.of, x, undefined, false);
      return;
    case 'set': {
      const known = [...new Set(v as string[])].filter((x) => s.dict.includes(x));
      const unknown = [...new Set(v as string[])].filter((x) => !s.dict.includes(x));
      const idx = known.map((x) => s.dict.indexOf(x)).sort((a, b) => a - b);
      const width = widthFor(s.dict.length);
      const listCost = 1 + 2 * Math.floor(Math.log2(idx.length + 1)) + idx.length * width;
      if (listCost < s.dict.length) {
        w.bit(0);
        w.eg(0, idx.length);
        let prev = -1;
        for (const i of idx) {
          w.eg(0, i - prev - 1);
          prev = i;
        }
      } else {
        w.bit(1);
        for (let i = 0; i < s.dict.length; i++) w.bit(idx.includes(i));
      }
      w.eg(0, unknown.length);
      for (const x of unknown) wStr(w, x);
      return;
    }
    case 'map': {
      const e = Object.entries(v);
      w.eg(0, e.length);
      for (const [k, x] of e) {
        enc(w, s.key, k, undefined, false);
        enc(w, s.val, x, undefined, false);
      }
      return;
    }
    case 'null':
      w.bit(v !== null);
      if (v !== null) enc(w, s.of, v, undefined, false);
      return;
    case 'obj': {
      const extra = Object.keys(v).filter((k) => v[k] !== undefined && !s.f.some(([n]) => n === k));
      if (extra.length) throw new Error(`schema has no field(s) ${extra.join(', ')}`);
      for (const [n, fs, opt] of s.f) {
        const dv = d?.[n];
        if (opt) {
          if (delta && d && dv !== undefined) {
            const same = deepEq(v[n], dv);
            w.bit(same);
            if (same) continue;
            w.bit(v[n] !== undefined);
            if (v[n] !== undefined) encBody(w, fs, v[n], dv, delta);
          } else {
            w.bit(v[n] !== undefined);
            if (v[n] !== undefined) enc(w, fs, v[n], undefined, delta);
          }
        } else {
          if (v[n] === undefined) throw new Error(`missing field ${n}`);
          enc(w, fs, v[n], d ? dv : undefined, delta);
        }
      }
      return;
    }
    case 'keyed': {
      const head: any = {};
      for (const n of s.head) {
        const fs = s.body.f.find(([m]) => m === n) as F;
        if (fs[2]) {
          w.bit(v[n] !== undefined);
          if (v[n] !== undefined) enc(w, fs[1], v[n], undefined, false);
        } else enc(w, fs[1], v[n], undefined, false);
        head[n] = v[n];
      }
      const def = delta ? s.mk(head) : undefined;
      const rest: any = { ...v };
      for (const n of s.head) delete rest[n];
      const restDef = def ? { ...def } : undefined;
      if (restDef) for (const n of s.head) delete restDef[n];
      enc(w, restOf(s), rest, restDef, delta);
      return;
    }
  }
}

const restCache = new WeakMap<object, S>();
function restOf(s: S & { t: 'keyed' }): S {
  let r = restCache.get(s);
  if (!r) {
    r = obj(...s.body.f.filter(([n]) => !s.head.includes(n)));
    restCache.set(s, r);
  }
  return r;
}

export function enc(w: BitWriter, s: S, v: any, d: any, delta: boolean): void {
  if (delta && d !== undefined) {
    const same = deepEq(v, d);
    w.bit(same);
    if (same) return;
  }
  encBody(w, s, v, d, delta);
}

function decBody(r: BitReader, s: S, d: any, delta: boolean): any {
  switch (s.t) {
    case 'bool':
      return r.bit();
    case 'enum': {
      const i = r.uint(widthFor(s.vals.length + 1));
      if (i < s.vals.length) return s.vals[i];
      if (i === s.vals.length) return JSON.parse(rStr(r));
      throw new CodeFormatError('bad enum');
    }
    case 'int':
      return rNum(r, s.k);
    case 'dec':
      return r.bit() ? readF64(r) : r.eg(s.k) / s.scale;
    case 'str':
      return rSym(r, s.dict);
    case 'list': {
      const n = r.eg(0);
      if (n > 10000) throw new CodeFormatError('list too long');
      const out = [];
      for (let i = 0; i < n; i++) out.push(dec(r, s.of, undefined, false));
      return out;
    }
    case 'set': {
      const out: string[] = [];
      if (!r.bit()) {
        const n = r.eg(0);
        let prev = -1;
        for (let i = 0; i < n; i++) {
          prev += r.eg(0) + 1;
          if (prev >= s.dict.length) throw new CodeFormatError('set index');
          out.push(s.dict[prev] as string);
        }
      } else for (let i = 0; i < s.dict.length; i++) if (r.bit()) out.push(s.dict[i] as string);
      const u = r.eg(0);
      if (u > 10000) throw new CodeFormatError('set too long');
      for (let i = 0; i < u; i++) out.push(rStr(r));
      return out;
    }
    case 'map': {
      const n = r.eg(0);
      if (n > 10000) throw new CodeFormatError('map too long');
      const out: any = {};
      for (let i = 0; i < n; i++) {
        const k = dec(r, s.key, undefined, false);
        out[k] = dec(r, s.val, undefined, false);
      }
      return out;
    }
    case 'null':
      return r.bit() ? dec(r, s.of, undefined, false) : null;
    case 'obj': {
      const out: any = {};
      for (const [n, fs, opt] of s.f) {
        const dv = d?.[n];
        if (opt) {
          if (delta && d && dv !== undefined) {
            if (r.bit()) {
              out[n] = structuredClone(dv);
              continue;
            }
            if (r.bit()) out[n] = decBody(r, fs, dv, delta);
          } else if (r.bit()) out[n] = dec(r, fs, undefined, delta);
        } else out[n] = dec(r, fs, d ? dv : undefined, delta);
      }
      return out;
    }
    case 'keyed': {
      const head: any = {};
      for (const n of s.head) {
        const fs = s.body.f.find(([m]) => m === n) as F;
        if (fs[2]) {
          if (r.bit()) head[n] = dec(r, fs[1], undefined, false);
        } else head[n] = dec(r, fs[1], undefined, false);
      }
      const def = delta ? s.mk(head) : undefined;
      const restDef = def ? { ...def } : undefined;
      if (restDef) for (const n of s.head) delete restDef[n];
      const rest = dec(r, restOf(s), restDef, delta);
      const out: any = {};
      // field order as the body declares it
      for (const [n] of s.body.f) {
        const x = n in head ? head[n] : rest[n];
        if (x !== undefined) out[n] = x;
      }
      return out;
    }
  }
}

export function dec(r: BitReader, s: S, d: any, delta: boolean): any {
  if (delta && d !== undefined && r.bit()) return structuredClone(d);
  return decBody(r, s, d, delta);
}

/** The value with every `set` field sorted by its dictionary (sets keep no order). */
export function canon(s: S, v: any): any {
  if (v === undefined || v === null) return v;
  switch (s.t) {
    case 'set': {
      const known = s.dict.filter((x) => v.includes(x));
      const unknown = [...new Set(v as string[])].filter((x) => !s.dict.includes(x));
      return [...known, ...unknown];
    }
    case 'list':
      return v.map((x: any) => canon(s.of, x));
    case 'map':
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, canon(s.val, x)]));
    case 'null':
      return canon(s.of, v);
    case 'obj': {
      const out: any = {};
      for (const [n, fs] of s.f) if (v[n] !== undefined) out[n] = canon(fs, v[n]);
      return out;
    }
    case 'keyed':
      return canon(s.body, v);
    default:
      return v;
  }
}

// ------------------------------------------------------------------ bytes, Base64url, CRC-32

export function bitsToBytes(bits: readonly number[]): Uint8Array {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) if (bits[i]) out[i >> 3] |= 0x80 >> (i & 7);
  return out;
}
export function bytesToBits(b: Uint8Array): number[] {
  const out: number[] = [];
  for (const x of b) for (let j = 7; j >= 0; j--) out.push((x >> j) & 1);
  return out;
}
export const b64u = (b: Uint8Array) => Buffer.from(b).toString('base64url');
export const unb64u = (s: string) => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new CodeFormatError('bad base64url');
  return new Uint8Array(Buffer.from(s, 'base64url'));
};

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of b) c = (CRC_TABLE[(c ^ x) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export { BitReader, BitWriter, CodeFormatError, crc16, fromBase32, toBase32 };
