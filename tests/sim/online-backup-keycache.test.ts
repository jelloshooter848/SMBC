import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as Scrypt from '@noble/hashes/scrypt.js';

/*
 * v0.4.76 review nit: the derived keys are cached per code, but a failed derivation (scrypt
 * refused: out of memory on a phone) must not stay cached: the next try derives again.
 */

let fail = 0;
vi.mock('@noble/hashes/scrypt.js', async (orig) => {
  const real = await orig<typeof Scrypt>();
  return {
    ...real,
    scryptAsync: (...a: Parameters<typeof real.scryptAsync>) =>
      fail-- > 0 ? Promise.reject(new Error('out of memory')) : real.scryptAsync(...a),
  };
});

afterEach(() => {
  fail = 0;
});

describe('keysFromCode', () => {
  it('a rejected derivation is not kept: the next call derives again', async () => {
    const { keysFromCode } = await import('@engine/online/nostr-backup');
    fail = 1;
    await expect(keysFromCode('ABCDEF123456')).rejects.toThrow('out of memory');
    const k = await keysFromCode('ABCDEF123456');
    expect(k.pk).toMatch(/^[0-9a-f]{64}$/);
    // A good one is kept (the same promise's result).
    expect(await keysFromCode('abcd-ef12-3456')).toBe(k);
  });
});
