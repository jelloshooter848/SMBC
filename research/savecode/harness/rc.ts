/*
 * Round 3 (throwaway): a binary range coder (LZMA-style: 32-bit range, 11-bit probabilities,
 * shift-5 adaptation) and a semantic model over traced codec calls (trace.ts). Integer-only and
 * deterministic; every value keeps a nonzero probability (probabilities stay in [31, 2017] / 2048),
 * so there is no escape path to get wrong. The coder drops the LZMA leading zero byte and the
 * trailing zero bytes (the decoder reads zeros past the end), and both are counted as gone.
 */
import { CodeFormatError } from '@game/save/code-bits';
import { TR, type Call, type CallSource } from './trace';

const TOP = 2 ** 24;
const BITS = 11;
const ONE = 1 << BITS;
const MOVE = 5;

export class RcEncoder {
  low = 0;
  range = 0xffffffff;
  cache = 0;
  cacheSize = 1;
  out: number[] = [];
  private shiftLow(): void {
    if (this.low < 0xff000000 || this.low >= 2 ** 32) {
      const carry = this.low >= 2 ** 32 ? 1 : 0;
      let temp = this.cache;
      do {
        this.out.push((temp + carry) & 0xff);
        temp = 0xff;
      } while (--this.cacheSize !== 0);
      this.cache = Math.floor(this.low / TOP) & 0xff;
    }
    this.cacheSize++;
    this.low = (this.low % TOP) * 256;
  }
  /** p: probability of 0, in 1/2048. */
  encode(p: number, bit: number): void {
    const bound = Math.floor(this.range / ONE) * p;
    if (bit === 0) this.range = bound;
    else {
      this.low += bound;
      this.range -= bound;
    }
    while (this.range < TOP) {
      this.range *= 256;
      this.shiftLow();
    }
  }
  finish(): Uint8Array {
    for (let i = 0; i < 5; i++) this.shiftLow();
    const o = this.out.slice(1); // the first byte is always 0
    let n = o.length;
    while (n > 0 && o[n - 1] === 0) n--;
    return Uint8Array.from(o.slice(0, n));
  }
}

export class RcDecoder {
  range = 0xffffffff;
  code = 0;
  pos = 0;
  constructor(readonly buf: Uint8Array) {
    for (let i = 0; i < 4; i++) this.code = this.code * 256 + this.byte();
  }
  private byte(): number {
    const b = this.buf[this.pos++];
    if (this.pos > this.buf.length + 64) throw new CodeFormatError('range stream overrun');
    return b ?? 0;
  }
  decode(p: number): number {
    const bound = Math.floor(this.range / ONE) * p;
    let bit: number;
    if (this.code < bound) {
      this.range = bound;
      bit = 0;
    } else {
      this.code -= bound;
      this.range -= bound;
      bit = 1;
    }
    while (this.range < TOP) {
      this.range *= 256;
      this.code = (this.code * 256 + this.byte()) % 2 ** 32;
    }
    return bit;
  }
}

// ------------------------------------------------------------------ the semantic model

export interface ModelOpts {
  /** Context granularity: 'kind' (one per call kind), 'role', 'path' (role + schema path), 'path+' (path, plus bit history for opaque codec bits). */
  ctx: 'kind' | 'role' | 'path' | 'path+';
  adapt: boolean;
  /** Frozen initial probabilities by context key (a trained table); missing keys start at 1/2. */
  init?: ReadonlyMap<string, number>;
}

/** Record keys and slot numbers out of a path, so slots share contexts. */
export function normPath(g: string): string {
  return g
    .replace(/smbc-classic-resume-\w+/g, 'resume')
    .replace(/smbc-classic-file-\w+-\d/g, 'blfile')
    .replace(/smbc\.save\.\d/g, 'save')
    .replace(/smbc\.settings/g, 'S')
    .replace(/smbc\.progress/g, 'P');
}

export class Model {
  probs = new Map<string, number>();
  /** Counts per context (training). */
  counts = new Map<string, [number, number]>();
  hist = 0;
  /** Ideal code length so far, in bits (−log2 of each decision's probability). */
  cost = 0;
  constructor(readonly o: ModelOpts) {}
  base(role: string, path: string, k: string, p: number): string {
    switch (this.o.ctx) {
      case 'kind':
        return `${k}${p}`;
      case 'role':
        return `${role}|${k}${p}`;
      default: {
        // kit values and rule rows share a context by their leaf; keep the last two path parts
        const parts = normPath(path).split('.');
        return `${role}|${parts.slice(-2).join('.')}|${k}${p}`;
      }
    }
  }
  private prob(key: string): number {
    let p = this.probs.get(key);
    if (p === undefined) {
      p = this.o.init?.get(key) ?? ONE / 2;
      this.probs.set(key, p);
    }
    return p;
  }
  private update(key: string, bit: number): void {
    const c = this.counts.get(key) ?? [0, 0];
    c[bit]++;
    this.counts.set(key, c);
    if (!this.o.adapt) return;
    const p = this.probs.get(key) as number;
    this.probs.set(key, bit === 0 ? p + ((ONE - p) >> MOVE) : p - (p >> MOVE));
  }
  /** One binary decision: encode (bit given) or decode (bit undefined). */
  bin(key: string | null, io: Io, bit?: number): number {
    if (key === null) {
      this.cost += 1;
      return io.code(ONE / 2, bit); // bypass
    }
    const p = this.prob(key);
    const b = io.code(p, bit);
    this.cost -= Math.log2(b === 0 ? p / ONE : 1 - p / ONE);
    this.update(key, b);
    return b;
  }
  /** One traced call's value through the model. */
  call(io: Io, role: string, path: string, k: Call['k'], p: number, v?: number): number {
    const c = this.base(role, path, k, p);
    const codecBits = this.o.ctx === 'path+' && role === 'codec';
    if (k === 'b') {
      const key = codecBits ? `${c}|h${this.hist & 0xff}` : c;
      const b = this.bin(key, io, v);
      if (role === 'codec') this.hist = (this.hist << 1) | b;
      return b;
    }
    if (k === 'u') {
      if (p === 0) return 0;
      let node = 1;
      let x = 0;
      for (let i = p - 1; i >= 0; i--) {
        const want = v === undefined ? undefined : Math.floor(v / 2 ** i) % 2;
        const key = p <= 8 ? `${c}|t${node}` : p - 1 - i < 8 ? `${c}|u${p - 1 - i}` : null;
        const b = this.bin(key, io, want);
        x = x * 2 + b;
        if (p <= 8) node = node * 2 + b;
      }
      return x;
    }
    // Exp-Golomb of order p: m prefix steps (unary), then m + p suffix bits under the leading 1
    let m = 0;
    if (v !== undefined) {
      let x = v + 2 ** p;
      let n = 0;
      while (x >= 1) {
        x = Math.floor(x / 2);
        n++;
      }
      m = n - 1 - p;
      for (let i = 0; i < m; i++) this.bin(`${c}|p${Math.min(i, 24)}`, io, 1);
      this.bin(`${c}|p${Math.min(m, 24)}`, io, 0);
    } else {
      while (this.bin(`${c}|p${Math.min(m, 24)}`, io) === 1) if (++m > 41) throw new CodeFormatError('number too long');
    }
    const width = m + p;
    let x = 1;
    for (let i = width - 1; i >= 0; i--) {
      const want = v === undefined ? undefined : Math.floor((v + 2 ** p) / 2 ** i) % 2;
      const j = width - 1 - i;
      const b = this.bin(j < 6 ? `${c}|s${m}.${j}` : null, io, want);
      x = x * 2 + b;
    }
    return x - 2 ** p;
  }
}

/** Encoder or decoder side of one binary decision. */
export interface Io {
  code(p: number, bit?: number): number;
}
export class EncIo implements Io {
  rc = new RcEncoder();
  code(p: number, bit?: number): number {
    this.rc.encode(p, bit as number);
    return bit as number;
  }
}
export class DecIo implements Io {
  constructor(readonly rc: RcDecoder) {}
  code(p: number): number {
    return this.rc.decode(p);
  }
}

/** A call list → range-coded bytes. */
export function rcEncode(calls: readonly Call[], o: ModelOpts): { bytes: Uint8Array; model: Model } {
  const m = new Model(o);
  const io = new EncIo();
  for (const c of calls) m.call(io, c.r, c.g, c.k, c.p, c.v);
  return { bytes: io.rc.finish(), model: m };
}

/** The decoder side: values for a CallReader, with contexts from the decoder's own TR. */
export class RcSource implements CallSource {
  m: Model;
  io: DecIo;
  constructor(bytes: Uint8Array, o: ModelOpts) {
    this.m = new Model(o);
    this.io = new DecIo(new RcDecoder(bytes));
  }
  next(k: Call['k'], p: number): number {
    return this.m.call(this.io, TR.role, TR.path.join('.'), k, p);
  }
}

/** A frozen table from training counts: each context's probability of 0, (n0 + 1/2) / (n + 1), clamped. */
export function trainTable(counts: ReadonlyMap<string, [number, number]>, minCount = 2): Map<string, number> {
  const t = new Map<string, number>();
  for (const [k, [a, b]] of counts) {
    if (a + b < minCount) continue;
    const p = Math.round((ONE * (a + 0.5)) / (a + b + 1));
    t.set(k, Math.max(31, Math.min(ONE - 31, p)));
  }
  return t;
}
