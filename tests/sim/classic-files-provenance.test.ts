import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultClassicSettings } from '@engine/save/original-options';
import {
  classicFileKey,
  eraseClassicFile,
  listClassicFiles,
  loadClassicFile,
  migrateClassicFiles,
  oldRunsWaiting,
  originalFileRules,
  saveClassicFile,
  type ClassicFileRef,
  type SharedClassicRules,
} from '@game/original-files';
import { CLASSIC_RESUME_KEY, classicResumeKey, type ClassicResume } from '@game/run-resume';
import { store, useStorage } from './heroes-harness';

// v0.4.72 (#205 release review of 39a's "no second copy"): whether an old save is already in a
// file is decided by provenance, never by matching run content. A file an old save was copied
// into carries that key and a fingerprint of its stored text (fromOld); only that marks the old
// key as migrated (its removal is then only retried). A run that merely looks the same (other
// rules, or a 0.4.67 slot with no time) is a different save and is never dropped. Rule 33a:
// these were written first.

useStorage();
afterEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

const run = (over: Partial<ClassicResume> = {}): ClassicResume => ({
  v: 1,
  levelId: '1-1',
  rules: 'classic',
  hero: 'mario',
  score: 0,
  coins: 0,
  lives: 3,
  world: 1,
  stage: 1,
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
const ref = (slot: 1 | 2 | 3): ClassicFileRef => ({ set: 'smb', slot });
const put = (key: string, v: unknown) => store.set(key, JSON.stringify(v));
function keepFile(slot: 1 | 2 | 3, over: Partial<ClassicResume> = {}, savedAt?: number) {
  saveClassicFile({
    ...ref(slot),
    rules: originalFileRules(),
    continues: 0,
    run: run(over),
    ...(savedAt ? { savedAt } : {}),
  });
}
/** removeItem refuses `key` only. */
function refuseRemove(key: string): void {
  const ls = (globalThis as { localStorage: Record<string, (k: string) => unknown> }).localStorage;
  const real = ls.removeItem as (k: string) => unknown;
  ls.removeItem = (k: string) => {
    if (k === key) throw new Error('refused');
    return real(k);
  };
}

describe('provenance: a look-alike run is never taken for the old save', () => {
  it('a Hard old run with the same fields as a Normal FILE 1 is kept, and moves into an empty file as Hard', () => {
    keepFile(1);
    put(CLASSIC_RESUME_KEY, { ...run(), difficulty: 'hard', gameMode: 'survival' });
    expect(migrateClassicFiles(shared())).toBe(true);
    const files = listClassicFiles('smb');
    expect(files[0]?.rules.difficulty).toBe('normal');
    expect(files[1]?.rules.difficulty).toBe('hard');
    expect(files[1]?.rules.options.gameMode).toBe('survival');
    expect(store.has(CLASSIC_RESUME_KEY)).toBe(false);
  });

  it('a 0.4.67 slot (no savedAt) identical to a file, same rules too, is still placed (content never decides)', () => {
    keepFile(1);
    put(CLASSIC_RESUME_KEY, run());
    expect(migrateClassicFiles(shared())).toBe(true);
    expect(listClassicFiles('smb').filter(Boolean)).toHaveLength(2);
    expect(store.has(CLASSIC_RESUME_KEY)).toBe(false);
  });

  it('a per-set slot identical to a file (same savedAt) in a full set still waits; it is never deleted', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const s of [1, 2, 3] as const) keepFile(s, { score: s }, 500);
    put(classicResumeKey('smb'), { ...run({ score: 2 }), savedAt: 500 });
    migrateClassicFiles(shared());
    expect(store.has(classicResumeKey('smb'))).toBe(true);
    expect(oldRunsWaiting('smb')).toBe(1);
  });
});

describe('provenance: the copy that carries it', () => {
  it('a copied old save marks its file (fromOld), and that survives the file being played', () => {
    put(classicResumeKey('smb'), { ...run({ score: 77 }), savedAt: 9 });
    migrateClassicFiles(shared());
    const raw = () => JSON.parse(store.get(classicFileKey(ref(1))) ?? '{}') as { fromOld?: { key: string } };
    expect(raw().fromOld?.key).toBe(classicResumeKey('smb'));
    // Played: the game writes the file as keepResume does (no fromOld passed).
    const f = loadClassicFile(ref(1))!;
    saveClassicFile({
      ...ref(1),
      rules: f.rules,
      continues: f.continues,
      tutorialsSeen: f.tutorialsSeen,
      run: { ...f.run, score: 999 },
    });
    expect(raw().fromOld?.key).toBe(classicResumeKey('smb'));
  });

  it('removeItem refused, the file is played, then another file is freed: no second copy, the key is recognised', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const oldKey = classicResumeKey('smb');
    keepFile(1, { score: 1 });
    keepFile(2, { score: 2 });
    put(oldKey, { ...run({ score: 77 }), savedAt: 9 });
    refuseRemove(oldKey);
    migrateClassicFiles(shared());
    expect(loadClassicFile(ref(3))?.run.score).toBe(77);
    expect(store.has(oldKey)).toBe(true);
    // FILE 3 is played on.
    const f = loadClassicFile(ref(3))!;
    saveClassicFile({
      ...ref(3),
      rules: f.rules,
      continues: f.continues,
      tutorialsSeen: f.tutorialsSeen,
      run: { ...f.run, score: 5000, levelId: '1-2', stage: 2 },
    });
    expect(oldRunsWaiting('smb')).toBe(0);
    // ERASE FILE 1.
    eraseClassicFile(ref(1));
    migrateClassicFiles(shared());
    expect(loadClassicFile(ref(1))).toBeNull();
    expect(listClassicFiles('smb').map((x) => x?.run.score ?? null)).toEqual([null, 2, 5000]);
    expect(store.has(oldKey)).toBe(true);
  });

  it('once the removal works, the key goes (only removeItem is retried; nothing else is touched)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const oldKey = classicResumeKey('smb');
    put(oldKey, { ...run({ score: 77 }), savedAt: 9 });
    const ls = (globalThis as { localStorage: Record<string, (k: string) => unknown> }).localStorage;
    const real = ls.removeItem as (k: string) => unknown;
    let refuse = true;
    ls.removeItem = (k: string) => {
      if (refuse && k === oldKey) throw new Error('refused');
      return real(k);
    };
    migrateClassicFiles(shared());
    const before = store.get(classicFileKey(ref(1)));
    refuse = false;
    expect(migrateClassicFiles(shared())).toBe(false);
    expect(store.has(oldKey)).toBe(false);
    expect(store.get(classicFileKey(ref(1)))).toBe(before);
    expect(listClassicFiles('smb').filter(Boolean)).toHaveLength(1);
  });

  it('a changed old key (other text) is not the copied one: it is a new old save and waits', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const oldKey = classicResumeKey('smb');
    keepFile(1, { score: 1 });
    keepFile(2, { score: 2 });
    put(oldKey, { ...run({ score: 77 }), savedAt: 9 });
    refuseRemove(oldKey);
    migrateClassicFiles(shared());
    put(oldKey, { ...run({ score: 88 }), savedAt: 10 });
    expect(oldRunsWaiting('smb')).toBe(1);
  });

  it('erasing the copied file drops its provenance: the kept old key moves in again', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const oldKey = classicResumeKey('smb');
    put(oldKey, { ...run({ score: 77 }), savedAt: 9 });
    refuseRemove(oldKey);
    migrateClassicFiles(shared());
    expect(loadClassicFile(ref(1))?.run.score).toBe(77);
    eraseClassicFile(ref(1));
    expect(oldRunsWaiting('smb')).toBe(1); // nothing holds it now
    migrateClassicFiles(shared());
    expect(loadClassicFile(ref(1))?.run.score).toBe(77);
  });

  it('a damaged fromOld in a file is ignored', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const s of [1, 2, 3] as const) keepFile(s, { score: s });
    const f = JSON.parse(store.get(classicFileKey(ref(2)))!);
    store.set(classicFileKey(ref(2)), JSON.stringify({ ...f, fromOld: 'junk' }));
    put(classicResumeKey('smb'), { ...run({ score: 77 }), savedAt: 9 });
    expect(oldRunsWaiting('smb')).toBe(1);
    expect(loadClassicFile(ref(2))?.run.score).toBe(2);
  });
});
