import { beforeEach, describe, expect, it } from 'vitest';
import { customLevelId, getCustomLevel, loadLibrary, saveLibrary } from './library';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const tiny = [
  'id: t',
  '',
  '[tiles]',
  ...Array.from({ length: 13 }, () => '.'.repeat(16)),
  '#'.repeat(16),
  '#'.repeat(16),
].join('\n');

describe('level library', () => {
  it('derives safe ids from names', () => {
    expect(customLevelId('My Level!')).toBe('custom-my-level');
  });
  it('saves and loads custom levels by id', () => {
    const lib = loadLibrary();
    lib.levels['My Level'] = tiny;
    expect(saveLibrary(lib)).toBe(true);
    const again = loadLibrary();
    const lvl = getCustomLevel(again, 'custom-my-level');
    expect(lvl?.width).toBe(16);
    expect(lvl?.id).toBe('custom-my-level');
    expect(getCustomLevel(again, 'custom-nope')).toBeNull();
  });
});
