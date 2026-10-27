import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_LEVEL_LINK_BYTES, decodeShare, encodeShare } from './share';

/*
 * Pre-0.5.0 item 257 and the level-link cap, tests first: a capped link is fed to the
 * decompressor about 1 KB at a time and the cap is checked between writes, so a small link that
 * inflates hugely stops early instead of being handed over whole.
 */

const RealDS = globalThis.DecompressionStream;
/** Each write the decompressor was given, in bytes. */
let writes: number[] = [];

/** A DecompressionStream that records what is written to it. */
class RecordingDS {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<BufferSource>;
  constructor(format: CompressionFormat) {
    const real = new RealDS(format);
    const tap = new TransformStream<BufferSource, BufferSource>({
      transform(chunk, c) {
        writes.push((chunk as ArrayBufferView).byteLength);
        c.enqueue(chunk);
      },
    });
    void tap.readable.pipeTo(real.writable as WritableStream<BufferSource>).catch(() => {});
    this.readable = real.readable as ReadableStream<Uint8Array>;
    this.writable = tap.writable;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  writes = [];
});

/** A link whose text is `n` zeros: tiny once deflated, huge once inflated. */
const bomb = (n: number): Promise<string> => encodeShare('0'.repeat(n));

describe('257: capped links are inflated a chunk at a time', () => {
  it('a bomb is refused after a few chunks, never written whole', async () => {
    const code = await bomb(30_000_000);
    const compressed = Math.floor(((code.length - 1) * 3) / 4);
    expect(compressed).toBeGreaterThan(8 * 1024);
    vi.stubGlobal('DecompressionStream', RecordingDS);
    await expect(decodeShare(code, 80_000)).rejects.toThrow(/too big/);
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) expect(w).toBeLessThanOrEqual(1024);
    expect(writes.reduce((a, b) => a + b, 0)).toBeLessThan(compressed);
  });

  it('a real text round-trips through the chunks, its size at the cap allowed', async () => {
    let text = '';
    for (let i = 0; text.length < 60_000; i++) text += `${(i * 7919) % 1000} ${i.toString(36)}\n`;
    const code = await encodeShare(text);
    vi.stubGlobal('DecompressionStream', RecordingDS);
    expect(await decodeShare(code, text.length)).toBe(text);
    expect(writes.length).toBeGreaterThan(1);
    for (const w of writes) expect(w).toBeLessThanOrEqual(1024);
    await expect(decodeShare(code, text.length - 1)).rejects.toThrow(/too big/);
  });

  it('an uncompressed (r) link over the cap is refused too', async () => {
    const code = 'r' + btoa('x'.repeat(2000)).replace(/=+$/, '');
    await expect(decodeShare(code, 1999)).rejects.toThrow(/too big/);
    expect(await decodeShare(code, 2000)).toBe('x'.repeat(2000));
  });
});

describe('the level-link cap', () => {
  it('sits well above any real level (the largest, Lost Levels 5-1, is about 19 KB; an editor level 1024 wide about 28 KB)', () => {
    expect(MAX_LEVEL_LINK_BYTES).toBeGreaterThanOrEqual(1_000_000);
    expect(MAX_LEVEL_LINK_BYTES).toBeLessThanOrEqual(4_000_000);
  });
});
