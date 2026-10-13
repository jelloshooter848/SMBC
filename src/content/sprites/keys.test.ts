import { describe, expect, it } from 'vitest';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { keysDef, keysPalettes } from './keys';
import { SPRITES } from './index';

describe('keys sprite sheet (0.4.52)', () => {
  it('validates and renders with its palette', () => {
    expect(() => validateDef('keys', keysDef)).not.toThrow();
    expect(() => rasterizeToBuffer(keysDef, keysPalettes.keys as string[])).not.toThrow();
    expect(SPRITES.keys).toBe(keysDef);
  });

  it('has the approved frames at their sizes, every row as wide as the first', () => {
    const size = (n: string) => {
      const rows = keysDef.frames[n] as readonly string[];
      return [rows[0]?.length, rows.length];
    };
    expect(size('key')).toEqual([16, 16]);
    expect(size('key-icon')).toEqual([8, 8]);
    expect(size('padlock')).toEqual([8, 8]);
    expect(size('portcullis')).toEqual([16, 32]);
    for (const rows of Object.values(keysDef.frames))
      for (const r of rows) expect(r.length).toBe((rows[0] as string).length);
  });

  it('the key and the portcullis reach their bottom rows (they stand on them)', () => {
    expect((keysDef.frames.key as readonly string[]).at(-1)).toMatch(/[^.]/);
    expect((keysDef.frames.portcullis as readonly string[]).at(-1)).toMatch(/[^.]/);
  });
});
