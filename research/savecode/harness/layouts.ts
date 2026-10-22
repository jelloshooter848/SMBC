/*
 * Round 3 (throwaway): stream layouts over a traced call list (trace.ts), Experiment A2.
 *   tight     - record-major, tightly packed bits (what R1 / config M already send);
 *   channels  - field-major typed channels, tightly packed bits, one header of channel lengths;
 *   aligned   - typed channels, every value byte-aligned (uint: whole bytes; EG: LEB128 varint),
 *               flag bits packed in their own bit channels.
 * Every layout is one buffer for one final DEFLATE pass, and its header is counted.
 * A channel is a function of the role the codec set before the call, which the decoder sets
 * identically, so the decoder always knows which channel to read next.
 */
import { BitReader, CodeFormatError } from '@game/save/code-bits';
import { TR, type Call, type CallSource } from './trace';

export const CHANNEL_OF: Record<string, string> = {
  presence: 'struct',
  same: 'struct',
  sel: 'struct',
  mode: 'struct',
  setmode: 'struct',
  count: 'struct',
  sym: 'ids',
  enum: 'ids',
  bool: 'ids',
  num: 'num',
  set: 'set',
  esc: 'esc',
  codec: 'codec',
  cframe: 'codec',
};
const CHANNELS = ['struct', 'ids', 'num', 'set', 'esc', 'codec'];
const chan = (role: string): string => {
  const c = CHANNEL_OF[role];
  if (!c) throw new Error(`no channel for role ${role}`);
  return c;
};

// ------------------------------------------------------------------ plain bit helpers (no tracing)

function egBits(out: number[], k: number, v: number): void {
  const x = v + 2 ** k;
  let n = 0;
  for (let y = x; y >= 1; y = Math.floor(y / 2)) n++;
  for (let i = 0; i < n - 1 - k; i++) out.push(0);
  for (let i = n - 1; i >= 0; i--) out.push(Math.floor(x / 2 ** i) % 2);
}
function uintBits(out: number[], n: number, v: number): void {
  for (let i = n - 1; i >= 0; i--) out.push(Math.floor(v / 2 ** i) % 2);
}
export function callToBits(out: number[], c: Call): void {
  if (c.k === 'b') out.push(c.v);
  else if (c.k === 'u') uintBits(out, c.p, c.v);
  else egBits(out, c.p, c.v);
}
export function packBits(bits: readonly number[]): Uint8Array {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) if (bits[i]) out[i >> 3]! |= 0x80 >> (i & 7);
  return out;
}
export function unpackBits(b: Uint8Array): number[] {
  const out: number[] = [];
  for (const x of b) for (let j = 7; j >= 0; j--) out.push((x >> j) & 1);
  return out;
}

// ------------------------------------------------------------------ tight record-major

export function tight(calls: readonly Call[]): Uint8Array {
  const bits: number[] = [];
  for (const c of calls) callToBits(bits, c);
  return packBits(bits);
}

// ------------------------------------------------------------------ typed channels, tight bits

export function channels(calls: readonly Call[]): Uint8Array {
  const ch: Record<string, number[]> = Object.fromEntries(CHANNELS.map((c) => [c, []]));
  for (const c of calls) callToBits(ch[chan(c.r)]!, c);
  const head: number[] = [];
  for (const c of CHANNELS.slice(0, -1)) egBits(head, 0, ch[c]!.length);
  return packBits([...head, ...CHANNELS.flatMap((c) => ch[c]!)]);
}

export class ChannelSource implements CallSource {
  readers: Record<string, BitReader> = {};
  constructor(bytes: Uint8Array) {
    const bits = unpackBits(bytes);
    const r = new BitReader(bits);
    const lens = CHANNELS.slice(0, -1).map(() => r.eg(0));
    let pos = r.pos;
    CHANNELS.forEach((c, i) => {
      const n = i < lens.length ? (lens[i] as number) : bits.length - pos;
      if (n < 0 || pos + n > bits.length) throw new CodeFormatError('channel length');
      this.readers[c] = new BitReader(bits.slice(pos, pos + n));
      pos += n;
    });
  }
  next(k: Call['k'], p: number): number {
    const r = this.readers[chan(TR.role)]!;
    return k === 'b' ? (r.bit() ? 1 : 0) : k === 'u' ? r.uint(p) : r.eg(p);
  }
}

// ------------------------------------------------------------------ typed channels, byte-aligned values

const ALIGNED = ['flags', 'codecbits', ...CHANNELS];
function leb(out: number[], v: number): void {
  do {
    let b = v % 128;
    v = Math.floor(v / 128);
    if (v > 0) b |= 128;
    out.push(b);
  } while (v > 0);
}
export function aligned(calls: readonly Call[]): Uint8Array {
  const bitCh: Record<string, number[]> = { flags: [], codecbits: [] };
  const byteCh: Record<string, number[]> = Object.fromEntries(CHANNELS.map((c) => [c, []]));
  for (const c of calls) {
    if (c.k === 'b') bitCh[c.r === 'codec' || c.r === 'cframe' ? 'codecbits' : 'flags']!.push(c.v);
    else if (c.k === 'u') {
      const out = byteCh[chan(c.r)]!;
      for (let i = Math.ceil(c.p / 8) - 1; i >= 0; i--) out.push(Math.floor(c.v / 256 ** i) % 256);
    } else leb(byteCh[chan(c.r)]!, c.v);
  }
  const parts = ALIGNED.map((c) => (c in bitCh ? Array.from(packBits(bitCh[c]!)) : byteCh[c]!));
  const head: number[] = [];
  for (const p of parts.slice(0, -1)) leb(head, p.length);
  return Uint8Array.from([...head, ...parts.flat()]);
}

export class AlignedSource implements CallSource {
  bitR: Record<string, BitReader> = {};
  bytes: Record<string, { b: Uint8Array; pos: number }> = {};
  constructor(buf: Uint8Array) {
    let pos = 0;
    const readLeb = (b: Uint8Array, at: { pos: number }) => {
      let v = 0;
      let mul = 1;
      for (;;) {
        if (at.pos >= b.length) throw new CodeFormatError('varint ended');
        const x = b[at.pos++] as number;
        v += (x & 127) * mul;
        if (!(x & 128)) return v;
        mul *= 128;
        if (mul > 2 ** 42) throw new CodeFormatError('varint too long');
      }
    };
    const at = { pos: 0 };
    const lens = ALIGNED.slice(0, -1).map(() => readLeb(buf, at));
    pos = at.pos;
    ALIGNED.forEach((c, i) => {
      const n = i < lens.length ? (lens[i] as number) : buf.length - pos;
      if (pos + n > buf.length) throw new CodeFormatError('channel length');
      const part = buf.subarray(pos, pos + n);
      pos += n;
      if (c === 'flags' || c === 'codecbits') this.bitR[c] = new BitReader(unpackBits(part));
      else this.bytes[c] = { b: part, pos: 0 };
    });
    this.readLeb = (c: string) => readLeb(this.bytes[c]!.b, this.bytes[c]!);
  }
  readLeb: (c: string) => number;
  next(k: Call['k'], p: number): number {
    if (k === 'b') return this.bitR[TR.role === 'codec' || TR.role === 'cframe' ? 'codecbits' : 'flags']!.bit() ? 1 : 0;
    const c = chan(TR.role);
    if (k === 'e') return this.readLeb(c);
    const ch = this.bytes[c]!;
    let v = 0;
    for (let i = 0; i < Math.ceil(p / 8); i++) {
      if (ch.pos >= ch.b.length) throw new CodeFormatError('channel ended');
      v = v * 256 + (ch.b[ch.pos++] as number);
    }
    if (v >= 2 ** p) throw new CodeFormatError('value too wide');
    return v;
  }
}
