import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from './share';

describe('share codec', () => {
  it('round-trips text with compression', async () => {
    const text =
      'id: x\n\n[tiles]\n' + ('.'.repeat(64) + '\n').repeat(13) + ('#'.repeat(64) + '\n').repeat(2);
    const code = await encodeShare(text);
    expect(code.startsWith('z')).toBe(true);
    expect(code.length).toBeLessThan(text.length / 4);
    expect(/^[A-Za-z0-9_-]+$/.test(code)).toBe(true);
    expect(await decodeShare(code)).toBe(text);
  });

  it('rejects unknown codes', async () => {
    await expect(decodeShare('xabc')).rejects.toThrow(/unknown/);
  });
});
