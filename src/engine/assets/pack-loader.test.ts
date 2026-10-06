import { describe, expect, it } from 'vitest';
import { AssetRegistry } from './registry';
import { applyPack, type LoadedPack } from './pack-loader';
import { PALETTES, SPRITES } from '@content/sprites';
import type { SpriteSheet } from '../gfx/spritesheet';

function pack(sheets: Record<string, SpriteSheet>): LoadedPack {
  return {
    name: 'test',
    manifest: { schema: 1, name: 'test' },
    sheets: new Map(Object.entries(sheets)),
    audio: new Map(),
    warnings: [],
  };
}

describe('applyPack', () => {
  it('replaces a sheet and its palette variants, but not the ~fx recolours (silhouettes stay hidden)', () => {
    const reg = new AssetRegistry(PALETTES);
    reg.defineAll(SPRITES);
    const builtIn = reg.sheet('mario');
    reg.sheet('mario', 'luigi');
    const shadow = reg.sheet('mario', 'luigi~silhouette');
    reg.sheet('mario', 'luigi~brainwashed');
    const img: SpriteSheet = { id: 'mario@pack:test', image: null, frames: builtIn.frames };
    applyPack(pack({ mario: img }), reg);
    expect(reg.sheet('mario')).toBe(img);
    expect(reg.sheet('mario', 'luigi')).toBe(img);
    expect(reg.sheet('mario', 'luigi~silhouette')).toBe(shadow);
    expect(reg.sheet('mario', 'luigi~brainwashed')).not.toBe(img);
    // Asked for only after the pack: still the built-in art, recoloured.
    expect(reg.sheet('mario', 'mario~silhouette')).not.toBe(img);
    expect(reg.sheet('mario', 'mario~silhouette').id).toBe('mario@mario~silhouette');
  });
});
