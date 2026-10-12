/*
 * The bit-level pieces of a save code (save-code.ts, docs/SAVE_CODES.md): a bit writer and reader
 * with the variable-length integer codes the layout uses, Crockford Base32 and the CRC-16. Pure,
 * no game imports, so the format's lowest layer never changes by accident.
 */

/** Thrown by BitReader when a code runs out or holds something no layout writes (a typo). */
export class CodeFormatError extends Error {}

/** Bits a value of `x` (≥ 1) needs. */
function bitLength(x: number): number {
  let n = 0;
  while (x >= 1) {
    x = Math.floor(x / 2);
    n++;
  }
  return n;
}

/** Most bits an integer code may span (2^40: far above anything a save holds). */
const MAX_INT_BITS = 41;

export class BitWriter {
  readonly bits: number[] = [];

  get length(): number {
    return this.bits.length;
  }

  bit(b: boolean | number): void {
    this.bits.push(b ? 1 : 0);
  }

  /** `v` (0 ≤ v < 2^n) in `n` bits, most significant first. */
  uint(n: number, v: number): void {
    for (let i = n - 1; i >= 0; i--) this.bits.push(Math.floor(v / 2 ** i) % 2);
  }

  /**
   * Exp-Golomb code of order `k` for a whole number `v` ≥ 0: small numbers are short (order 0:
   * 0 → 1 bit, 1-2 → 3 bits, 3-6 → 5 bits; order 2: 0-3 → 3 bits, 4-11 → 5 bits, 12-27 → 7 bits).
   */
  eg(k: number, v: number): void {
    const x = v + 2 ** k;
    const n = bitLength(x);
    for (let i = 0; i < n - 1 - k; i++) this.bits.push(0);
    this.uint(n, x);
  }

  append(w: BitWriter): void {
    for (const b of w.bits) this.bits.push(b);
  }
}

export class BitReader {
  constructor(
    readonly bits: readonly number[],
    public pos = 0,
  ) {}

  get left(): number {
    return this.bits.length - this.pos;
  }

  bit(): boolean {
    if (this.pos >= this.bits.length) throw new CodeFormatError('code ended early');
    return this.bits[this.pos++] === 1;
  }

  uint(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 2 + (this.bit() ? 1 : 0);
    return v;
  }

  eg(k: number): number {
    let zeros = 0;
    while (!this.bit()) if (++zeros > MAX_INT_BITS) throw new CodeFormatError('number too long');
    const n = zeros + k + 1;
    let x = 1;
    for (let i = 1; i < n; i++) x = x * 2 + (this.bit() ? 1 : 0);
    return x - 2 ** k;
  }
}

/** Bits needed to write any index 0..n-1 in a fixed width (0 for n ≤ 1). */
export function widthFor(n: number): number {
  return n <= 1 ? 0 : bitLength(n - 1);
}

// ---------------------------------------------------------------- Crockford Base32

/** Crockford's Base32 alphabet: digits and capitals without I, L, O and U. */
export const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Letters read as another (Crockford: O is zero, I and L are one); case is ignored. */
const READ_AS: Readonly<Record<string, string>> = { O: '0', I: '1', L: '1' };

/** One typed character as its Base32 digit (lower case, O, I, L accepted), or -1. */
export function base32Digit(ch: string): number {
  const up = ch.toUpperCase();
  return BASE32.indexOf(READ_AS[up] ?? up);
}

/** Bits → Base32 characters, 5 bits each (the last padded with zeros). */
export function toBase32(bits: readonly number[]): string {
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    let v = 0;
    for (let j = 0; j < 5; j++) v = v * 2 + (bits[i + j] ?? 0);
    out += BASE32[v];
  }
  return out;
}

/** Base32 characters (already cleaned, see cleanCode) → bits; null on a character not in it. */
export function fromBase32(text: string): number[] | null {
  const bits: number[] = [];
  for (const ch of text) {
    const v = base32Digit(ch);
    if (v < 0) return null;
    for (let j = 4; j >= 0; j--) bits.push((v >> j) & 1);
  }
  return bits;
}

/** A code in groups of five, joined by dashes ('K7MD4-P2QJ9-…'). */
export function groupCode(text: string, size = 5): string {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out.join('-');
}

/**
 * Typed text → the code's Base32 characters: upper case, with O as zero and I / L as one, and
 * dashes and spaces dropped. Null when anything else is in it.
 */
export function cleanCode(text: string): string | null {
  let out = '';
  for (const ch of text) {
    if (ch === '-' || /\s/.test(ch)) continue;
    const v = base32Digit(ch);
    if (v < 0) return null;
    out += BASE32[v];
  }
  return out;
}

// ---------------------------------------------------------------- CRC-16

/**
 * CRC-16/CCITT (polynomial 0x1021, start 0xFFFF) over a sequence of bits. It catches every
 * change within 16 bits in a row (so any one wrong character, and two neighbours swapped) and
 * every odd number of wrong bits; anything else slips through once in 65,536.
 */
export function crc16(bits: readonly number[]): number {
  let crc = 0xffff;
  for (const b of bits) {
    const top = ((crc >> 15) & 1) ^ b;
    crc = (crc << 1) & 0xffff;
    if (top) crc ^= 0x1021;
  }
  return crc;
}
