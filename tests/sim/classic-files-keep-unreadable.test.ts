import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultClassicSettings } from '@engine/save/original-options';
import {
  eraseClassicFile,
  loadClassicFile,
  migrateClassicFiles,
  originalFileRules,
  saveClassicFile,
  type SharedClassicRules,
} from '@game/original-files';
import { classicResumeKey, type ClassicResume } from '@game/run-resume';
import { store, useStorage } from './heroes-harness';

// 31b (v0.4.71, #199 review): an old save that meets a full set never overwrites a file that
// cannot be read (a damaged one, or a newer build's after a downgrade, v !== 1): that file may
// still be readable again by the build that wrote it. The old key stays until a file is free.

useStorage();
afterEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

const run = (over: Partial<ClassicResume> = {}): ClassicResume => ({
  v: 1,
  levelId: '4-2',
  rules: 'classic',
  hero: 'mario',
  score: 500,
  coins: 0,
  lives: 3,
  world: 4,
  stage: 2,
  powerState: 'small',
  hp: 0,
  kit: {},
  warped: false,
  checkpoint: null,
  ...over,
});
const shared = (): SharedClassicRules => ({
  classic: defaultClassicSettings(),
  difficulty: 'normal',
  continuesUsed: 0,
});

const newer = JSON.stringify({ v: 2, run: { level: '9-9' }, future: true });
const damaged = '{"v":1,"run":null}';

for (const [what, rawFile] of [
  ['a newer-format file (v: 2, after a downgrade)', newer],
  ['a damaged file', damaged],
] as const)
  describe(`31b: a full set with ${what}`, () => {
    it('keeps that file byte for byte, and keeps the old key', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      saveClassicFile({
        set: 'smb',
        slot: 1,
        rules: originalFileRules(),
        continues: 0,
        run: run({ score: 1 }),
      });
      store.set('smbc-classic-file-smb-2', rawFile);
      saveClassicFile({
        set: 'smb',
        slot: 3,
        rules: originalFileRules(),
        continues: 0,
        run: run({ score: 3 }),
      });
      const key = classicResumeKey('smb');
      store.set(key, JSON.stringify({ ...run({ score: 88 }), savedAt: Date.now() }));
      expect(migrateClassicFiles(shared())).toBe(false);
      expect(store.get('smbc-classic-file-smb-2')).toBe(rawFile);
      expect(store.has(key)).toBe(true);
      expect(loadClassicFile({ set: 'smb', slot: 1 })?.run.score).toBe(1);
      expect(loadClassicFile({ set: 'smb', slot: 3 })?.run.score).toBe(3);
      // ERASE FILE on the unreadable file frees it: the old save moves in then.
      eraseClassicFile({ set: 'smb', slot: 2 });
      expect(migrateClassicFiles(shared())).toBe(true);
      expect(loadClassicFile({ set: 'smb', slot: 2 })?.run.score).toBe(88);
      expect(store.has(key)).toBe(false);
    });
  });
