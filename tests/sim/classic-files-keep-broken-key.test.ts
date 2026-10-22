import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultClassicSettings } from '@engine/save/original-options';
import { defaultSettings } from '@engine/save/settings';
import {
  listClassicFiles,
  loadClassicFile,
  migrateClassicFiles,
  type SharedClassicRules,
} from '@game/original-files';
import { CLASSIC_RESUME_KEY, classicResumeKey } from '@game/run-resume';
import { makeGame, store, useStorage } from './heroes-harness';

// 31c (v0.4.71, #199 review): an old save key that does not read as a run (damaged, or a newer
// build's) is never deleted by the migration: it stays as it is, and no file is made from it.

useStorage();
afterEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

const shared = (): SharedClassicRules => ({
  classic: defaultClassicSettings(),
  difficulty: 'normal',
  continuesUsed: 0,
});

describe('31c: a broken old key is kept', () => {
  for (const [name, key] of [
    ['a per-set key', classicResumeKey('lost')],
    ['the 0.4.67 key', CLASSIC_RESUME_KEY],
  ] as const)
    it(`${name}: kept byte for byte, logged once, no file made`, () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const raw = JSON.stringify({ v: 7, broken: name });
      store.set(key, raw);
      for (let i = 0; i < 4; i++) expect(migrateClassicFiles(shared())).toBe(false);
      expect(store.get(key)).toBe(raw);
      for (const set of ['smb', 'special', 'lost'] as const)
        expect(listClassicFiles(set).every((f) => f === null)).toBe(true);
      expect(store.has('smbc-classic-file-lost-1')).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
    });

  it('not JSON at all: kept too', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.set(classicResumeKey('smb'), 'not json {');
    migrateClassicFiles(shared());
    expect(store.get(classicResumeKey('smb'))).toBe('not json {');
  });

  it('it does not stop a readable key beside it from moving', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.set(CLASSIC_RESUME_KEY, '{"v":1,"levelId":3}');
    store.set(
      classicResumeKey('special'),
      JSON.stringify({
        v: 1,
        levelId: 'sp-1-1',
        rules: 'classic',
        hero: 'mario',
        score: 9,
        coins: 0,
        lives: 3,
        world: 1,
        stage: 1,
        powerState: 'small',
        hp: 0,
        kit: {},
        warped: false,
        checkpoint: null,
      }),
    );
    expect(migrateClassicFiles(shared())).toBe(true);
    expect(loadClassicFile({ set: 'special', slot: 1 })?.run.score).toBe(9);
    expect(store.has(classicResumeKey('special'))).toBe(false);
    expect(store.get(CLASSIC_RESUME_KEY)).toBe('{"v":1,"levelId":3}');
  });

  it('the file box reads with a broken old key there, and keeps it', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.set(classicResumeKey('smb'), '{"v":2}');
    const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
    expect(h.game.classicFiles('smb')).toEqual([null, null, null]);
    expect(h.game.classicFileState({ set: 'smb', slot: 1 })).toBe('empty');
    expect(store.get(classicResumeKey('smb'))).toBe('{"v":2}');
  });
});
