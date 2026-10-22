/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Round 2 (throwaway): reference-delta coding against an arbitrary reference object R.
 * Differences from round 1's delta (codec.ts):
 *   - a bool that differs from R costs only the "same" bit (its value is !R);
 *   - a set that differs may be sent as its symmetric difference with R (1 mode bit picks the cheaper);
 *   - a map that differs may be sent as key-level edits against R (kept / removed / changed + added);
 *   - a nullable whose R is null skips its presence bit.
 * Staged records: fields are encoded in stages, each stage against a reference chosen from a
 * list (selector bits counted), and a stage's references may be computed from what earlier
 * stages decoded (derived references) or from earlier records (cross-slot references).
 */
import { BitReader, BitWriter, CodeFormatError, widthFor } from '@game/save/code-bits';
import { dec as dec1, deepEq, enc as enc1, obj, type F, type S } from './codec';
import { pushTraced, R, TR } from './trace';

const full = (w: BitWriter, s: S, v: any) => enc1(w, s, v, undefined, false);
const readFull = (r: BitReader, s: S) => dec1(r, s, undefined, false);

function bitsOf(f: (w: BitWriter) => void): number[] {
  const w = new BitWriter();
  f(w);
  return w.bits;
}
function push(w: BitWriter, bits: number[]): void {
  pushTraced(w, bits);
}

/** v against reference d (d undefined: v in full). */
export function enc2(w: BitWriter, s: S, v: any, d: any): void {
  if (d === undefined) return full(w, s, v);
  const same = deepEq(v, d);
  R('same');
  w.bit(same);
  if (!same) diff2(w, s, v, d);
}
export function dec2(r: BitReader, s: S, d: any): any {
  if (d === undefined) return readFull(r, s);
  R('same');
  if (r.bit()) return structuredClone(d);
  return undiff2(r, s, d);
}

/** v ≠ d. */
function diff2(w: BitWriter, s: S, v: any, d: any): void {
  switch (s.t) {
    case 'bool':
      return;
    case 'null':
      if (d === null) return full(w, s.of, v);
      R('presence');
      w.bit(v !== null);
      if (v !== null) diff2(w, s.of, v, d);
      return;
    case 'set': {
      const known = (x: string[]) => x.every((e) => s.dict.includes(e));
      const a = full === undefined ? [] : bitsOf((x) => full(x, s, v));
      if (known(v) && known(d)) {
        const vs = new Set(v as string[]);
        const ds = new Set(d as string[]);
        const xor = s.dict.filter((e) => vs.has(e) !== ds.has(e));
        const b = bitsOf((x) => full(x, s, xor));
        if (b.length < a.length) {
          R('mode');
          w.bit(1);
          return push(w, b);
        }
      }
      R('mode');
      w.bit(0);
      return push(w, a);
    }
    case 'map': {
      const a = bitsOf((x) => full(x, s, v));
      if (d && typeof d === 'object') {
        const b = bitsOf((x) => {
          for (const k of Object.keys(d)) {
            const same = k in v && deepEq(v[k], d[k]);
            R('same');
            x.bit(same);
            if (same) continue;
            R('presence');
            x.bit(!(k in v)); // removed
            if (k in v) diff2(x, s.val, v[k], d[k]);
          }
          const added = Object.keys(v).filter((k) => !(k in d));
          R('count');
          x.eg(0, added.length);
          for (const k of added) {
            full(x, s.key, k);
            full(x, s.val, v[k]);
          }
        });
        if (b.length < a.length) {
          R('mode');
          w.bit(1);
          return push(w, b);
        }
      }
      R('mode');
      w.bit(0);
      return push(w, a);
    }
    case 'obj': {
      const extra = Object.keys(v).filter((k) => v[k] !== undefined && !s.f.some(([n]) => n === k));
      if (extra.length) throw new Error(`schema has no field(s) ${extra.join(', ')}`);
      for (const [n, fs, opt] of s.f) {
        const dv = d?.[n];
        TR.path.push(n);
        try {
          if (opt) {
            if (dv !== undefined) {
              const same = deepEq(v[n], dv);
              R('same');
              w.bit(same);
              if (same) continue;
              R('presence');
              w.bit(v[n] !== undefined);
              if (v[n] !== undefined) diff2(w, fs, v[n], dv);
            } else {
              R('presence');
              w.bit(v[n] !== undefined);
              if (v[n] !== undefined) full(w, fs, v[n]);
            }
          } else {
            if (v[n] === undefined) throw new Error(`missing field ${n}`);
            enc2(w, fs, v[n], dv);
          }
        } finally {
          TR.path.pop();
        }
      }
      return;
    }
    default:
      return full(w, s, v);
  }
}
function undiff2(r: BitReader, s: S, d: any): any {
  switch (s.t) {
    case 'bool':
      return !d;
    case 'null':
      if (d === null) return readFull(r, s.of);
      R('presence');
      return r.bit() ? undiff2(r, s.of, d) : null;
    case 'set': {
      R('mode');
      if (!r.bit()) return readFull(r, s);
      const xor = new Set(readFull(r, s) as string[]);
      const ds = new Set(d as string[]);
      return s.dict.filter((e) => ds.has(e) !== xor.has(e));
    }
    case 'map': {
      R('mode');
      if (!r.bit()) return readFull(r, s);
      const out: any = {};
      for (const k of Object.keys(d)) {
        R('same');
        if (r.bit()) {
          out[k] = structuredClone(d[k]);
          continue;
        }
        R('presence');
        if (r.bit()) continue;
        out[k] = undiff2(r, s.val, d[k]);
      }
      R('count');
      const n = r.eg(0);
      if (n > 10000) throw new CodeFormatError('map too long');
      for (let i = 0; i < n; i++) {
        const k = readFull(r, s.key);
        out[k] = readFull(r, s.val);
      }
      return out;
    }
    case 'obj': {
      const out: any = {};
      for (const [n, fs, opt] of s.f) {
        const dv = d?.[n];
        TR.path.push(n);
        try {
          if (opt) {
            if (dv !== undefined) {
              R('same');
              if (r.bit()) {
                out[n] = structuredClone(dv);
                continue;
              }
              R('presence');
              if (r.bit()) out[n] = undiff2(r, fs, dv);
            } else {
              R('presence');
              if (r.bit()) out[n] = readFull(r, fs);
            }
          } else out[n] = dec2(r, fs, dv);
        } finally {
          TR.path.pop();
        }
      }
      return out;
    }
    default:
      return readFull(r, s);
  }
}

// ------------------------------------------------------------------ staged records

/** A stage: some fields of the record, coded against one of `refs` (computed from what is decoded so far and the context). */
export interface Stage {
  name: string;
  fields: readonly string[];
  /** Candidate references; undefined entries mean "in full". */
  refs: (soFar: any, ctx: any) => readonly (any | undefined)[];
}

export function pickFields(o: any, fields: readonly string[]): any {
  if (o === undefined) return undefined;
  const out: any = {};
  for (const f of fields) if (o[f] !== undefined) out[f] = o[f];
  return out;
}
const subCache = new Map<string, S>();
function sub(body: S & { t: 'obj' }, fields: readonly string[], key: string): S {
  let s = subCache.get(key);
  if (!s) {
    s = obj(...(fields.map((n) => body.f.find(([m]) => m === n)).filter(Boolean) as F[]));
    subCache.set(key, s);
  }
  return s;
}

export interface StageStats {
  [stage: string]: number[]; // chosen ref index per encode
}

/** Encodes v in stages, each with its best reference; returns the chosen indices. */
export function encStaged(w: BitWriter, body: S & { t: 'obj' }, stages: readonly Stage[], v: any, ctx: any, id: string): number[] {
  const soFar: any = {};
  const chosen: number[] = [];
  for (const st of stages) {
    const s = sub(body, st.fields, `${id}:${st.name}`);
    const val = pickFields(v, st.fields);
    const refs = st.refs(soFar, ctx);
    let best: number[] | null = null;
    let bi = 0;
    refs.forEach((ref, i) => {
      const b = bitsOf((x) => enc2(x, s, val, ref === undefined ? undefined : pickFields(ref, st.fields)));
      if (!best || b.length < best.length) {
        best = b;
        bi = i;
      }
    });
    R('sel');
    w.uint(widthFor(refs.length), bi);
    push(w, best as unknown as number[]);
    chosen.push(bi);
    // what the decoder will have
    const ref = refs[bi];
    const r = new BitReader(best as unknown as number[]);
    Object.assign(soFar, dec2(r, s, ref === undefined ? undefined : pickFields(ref, st.fields)));
  }
  return chosen;
}
export function decStaged(r: BitReader, body: S & { t: 'obj' }, stages: readonly Stage[], ctx: any, id: string): any {
  const soFar: any = {};
  for (const st of stages) {
    const s = sub(body, st.fields, `${id}:${st.name}`);
    const refs = st.refs(soFar, ctx);
    R('sel');
    const i = r.uint(widthFor(refs.length));
    if (i >= refs.length) throw new CodeFormatError('bad reference selector');
    const ref = refs[i];
    Object.assign(soFar, dec2(r, s, ref === undefined ? undefined : pickFields(ref, st.fields)));
  }
  const out: any = {};
  for (const [n] of body.f) if (soFar[n] !== undefined) out[n] = soFar[n];
  return out;
}

export { bitsOf, push };
