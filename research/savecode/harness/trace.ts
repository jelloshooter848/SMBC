/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Round 3 (throwaway): call-level tracing of the bit codecs. Every BitWriter call (bit / uint /
 * eg) is logged with the semantic role the codec set just before it (TR.role) and the schema path
 * (TR.path), so one encoded profile becomes a list of semantic decisions:
 *   { r: role, f: path leaf, g: path, k: 'b' | 'u' | 'e', p: width or EG order, v: value, a?: alphabet }.
 * The decoders set the same roles at the same points, so a decoder can pull each value from any
 * transform of that list (typed channels, byte alignment, a range coder) through CallReader.
 * The game's BitWriter is patched at runtime only, inside the benchmark process.
 */
import { BitReader, BitWriter, CodeFormatError } from '@game/save/code-bits';

export const TR = { role: 'other', path: [] as string[], alpha: 0 };
export const R = (role: string, alpha = 0): void => {
  TR.role = role;
  TR.alpha = alpha;
};

export interface Call {
  r: string;
  g: string;
  k: 'b' | 'u' | 'e';
  p: number;
  v: number;
  a: number;
}

let depth = 0;
const logOf = (w: BitWriter): Call[] => ((w.bits as any).calls ??= []);
function log(w: BitWriter, k: Call['k'], p: number, v: number): void {
  if (depth) return;
  logOf(w).push({ r: TR.role, g: TR.path.join('.'), k, p, v, a: TR.alpha });
}

let installed = false;
export function installTrace(): void {
  if (installed) return;
  installed = true;
  const P = BitWriter.prototype as any;
  const bit0 = P.bit;
  const uint0 = P.uint;
  const eg0 = P.eg;
  P.bit = function (b: boolean | number) {
    log(this, 'b', 0, b ? 1 : 0);
    depth++;
    try {
      bit0.call(this, b);
    } finally {
      depth--;
    }
  };
  P.uint = function (n: number, v: number) {
    log(this, 'u', n, v);
    depth++;
    try {
      uint0.call(this, n, v);
    } finally {
      depth--;
    }
  };
  P.eg = function (k: number, v: number) {
    log(this, 'e', k, v);
    depth++;
    try {
      eg0.call(this, k, v);
    } finally {
      depth--;
    }
  };
}

/** The calls behind a bit array written by a traced BitWriter (or pushed with pushTraced). */
export function callsOf(bits: readonly number[]): Call[] {
  const c = (bits as any).calls as Call[] | undefined;
  if (!c) throw new Error('untraced bits');
  return c;
}

/** Appends bits and, when they carry calls, the calls too (no re-logging under the current role). */
export function pushTraced(w: BitWriter, bits: readonly number[]): void {
  const c = (bits as any).calls as Call[] | undefined;
  if (!c) {
    for (const b of bits) w.bit(b);
    return;
  }
  for (const b of bits) w.bits.push(b);
  const dst = logOf(w);
  for (const x of c) dst.push(x);
}

/** Runs f with `name` on the path (encoder and decoder push the same names). */
export function inPath<T>(name: string, f: () => T): T {
  TR.path.push(name);
  try {
    return f();
  } finally {
    TR.path.pop();
  }
}

/** Bits a call takes in the tight bit packing. */
export function callBits(c: Call): number {
  if (c.k === 'b') return 1;
  if (c.k === 'u') return c.p;
  let x = c.v + 2 ** c.p;
  let n = 0;
  while (x >= 1) {
    x = Math.floor(x / 2);
    n++;
  }
  return 2 * n - 1 - c.p;
}

export interface CallSource {
  next(k: Call['k'], p: number): number;
}

/** A BitReader whose reads come from a CallSource (which sees TR.role / TR.path at each read). */
export class CallReader extends BitReader {
  calls = 0;
  constructor(
    readonly src: CallSource,
    readonly budget = 200_000,
  ) {
    super([]);
  }
  private tick(): void {
    if (++this.calls > this.budget) throw new CodeFormatError('call budget');
  }
  override bit(): boolean {
    this.tick();
    return this.src.next('b', 0) === 1;
  }
  override uint(n: number): number {
    this.tick();
    return this.src.next('u', n);
  }
  override eg(k: number): number {
    this.tick();
    return this.src.next('e', k);
  }
}

/** Replays a call list in order, checking the decoder asks for the same kind and width (the strict test of decodability). */
export class ReplaySource implements CallSource {
  i = 0;
  constructor(readonly calls: readonly Call[]) {}
  next(k: Call['k'], p: number): number {
    const c = this.calls[this.i++];
    if (!c) throw new CodeFormatError('replay ended');
    if (c.k !== k || c.p !== p || c.r !== TR.role || c.g !== TR.path.join('.')) throw new CodeFormatError(`replay mismatch at ${this.i - 1}: ${c.k}${c.p}/${c.r}/${c.g} vs ${k}${p}/${TR.role}/${TR.path.join('.')}`);
    return c.v;
  }
}
