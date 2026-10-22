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
  saveClearedFile,
  type ClassicFileRef,
  type SharedClassicRules,
} from '@game/original-files';
import { CLASSIC_RESUME_KEY, classicResumeKey, type ClassicResume } from '@game/run-resume';
import { store, useStorage } from './heroes-harness';

// v0.4.74 item 65 (owner-approved; rule 33a: written before the fix). When removing an old
// per-set key failed once (its copy is in a file, marked fromOld), ERASE FILE of the file that
// holds the migrated game used to drop the only mark, so the old key migrated back in on the
// next read: the erased game came back. Now erasing a file whose fromOld matches a still-present
// old key (same key, same stored text) retires that key: it is deleted, or, when the delete
// fails, renamed to `<key>-erased` (a copy there marks it as erased), so it never migrates again.

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
const ref = (slot: 1 | 2 | 3, set: ClassicFileRef['set'] = 'smb'): ClassicFileRef => ({ set, slot });
const put = (key: string, v: unknown) => store.set(key, JSON.stringify(v));
const ls = () =>
  (globalThis as { localStorage: Record<string, (k: string, v?: string) => unknown> }).localStorage;

/** original-files.ts's fingerprint (FNV-1a, 32 bits, hex). */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** removeItem refuses the keys `refuse` names (while it returns true). */
function refuseRemove(refuse: (k: string) => boolean): void {
  const real = ls().removeItem as (k: string) => unknown;
  ls().removeItem = (k: string) => {
    if (refuse(k)) throw new Error('refused');
    return real(k);
  };
}
/** setItem refuses the keys `refuse` names. */
function refuseSet(refuse: (k: string) => boolean): void {
  const real = ls().setItem as (k: string, v: string) => unknown;
  ls().setItem = (k: string, v?: string) => {
    if (refuse(k)) throw new Error('refused');
    return real(k, v as string);
  };
}

/** An old per-set save whose removal is refused once: its copy lands in FILE 1, the key stays. */
function stuckMigration(oldKey = classicResumeKey('smb'), score = 77) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  put(oldKey, { ...run({ score }), savedAt: 9 });
  let refuse = true;
  refuseRemove((k) => refuse && k === oldKey);
  migrateClassicFiles(shared());
  expect(store.has(oldKey)).toBe(true);
  return {
    oldKey,
    allowRemove: () => {
      refuse = false;
    },
  };
}

describe('65: ERASE FILE retires the old key its game was copied from', () => {
  it('the delete works now: the old key goes with the file, and nothing migrates back', () => {
    const { oldKey, allowRemove } = stuckMigration();
    const into = listClassicFiles('smb').findIndex((f) => f?.run.score === 77);
    expect(into).toBeGreaterThanOrEqual(0);
    allowRemove();
    // (A read in between would retry the removal on its own; ERASE straight away is the case.)
    eraseClassicFile(ref((into + 1) as 1 | 2 | 3));
    expect(store.has(oldKey)).toBe(false);
    migrateClassicFiles(shared());
    expect(listClassicFiles('smb').every((f) => f === null)).toBe(true);
    expect(oldRunsWaiting('smb')).toBe(0);
  });

  it('the delete still fails: the key is renamed to -erased, and it never migrates again', () => {
    const oldKey = classicResumeKey('smb');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    put(oldKey, { ...run({ score: 77 }), savedAt: 9 });
    refuseRemove((k) => k === oldKey);
    migrateClassicFiles(shared());
    expect(loadClassicFile(ref(1))?.run.score).toBe(77);
    eraseClassicFile(ref(1));
    expect(store.has(classicFileKey(ref(1)))).toBe(false);
    expect(store.has(`${oldKey}-erased`)).toBe(true);
    expect(oldRunsWaiting('smb')).toBe(0);
    for (let i = 0; i < 3; i++) migrateClassicFiles(shared());
    expect(listClassicFiles('smb').every((f) => f === null)).toBe(true);
    expect(oldRunsWaiting('smb')).toBe(0);
  });

  it('a renamed key is deleted once storage lets it (and still never migrates)', () => {
    const oldKey = classicResumeKey('smb');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    put(oldKey, { ...run({ score: 77 }), savedAt: 9 });
    let refuse = true;
    refuseRemove((k) => refuse && k === oldKey);
    migrateClassicFiles(shared());
    eraseClassicFile(ref(1));
    refuse = false;
    migrateClassicFiles(shared());
    expect(store.has(oldKey)).toBe(false);
    expect(listClassicFiles('smb').every((f) => f === null)).toBe(true);
  });

  it('the 0.4.67 single slot is retired the same way', () => {
    const { oldKey } = stuckMigration(CLASSIC_RESUME_KEY, 55);
    eraseClassicFile(ref(1));
    migrateClassicFiles(shared());
    expect(listClassicFiles('smb').every((f) => f === null)).toBe(true);
    expect(store.has(oldKey) ? store.has(`${oldKey}-erased`) : true).toBe(true);
  });

  it('a CLEARED file holding the migrated game: ERASE retires the key too', () => {
    const { oldKey } = stuckMigration();
    const f = loadClassicFile(ref(1))!;
    expect(saveClearedFile({ ...ref(1), rules: f.rules, continues: 0, run: f.run })).toBe(true);
    eraseClassicFile(ref(1));
    migrateClassicFiles(shared());
    expect(store.has(classicFileKey(ref(1)))).toBe(false);
    expect(oldRunsWaiting('smb')).toBe(0);
    expect(store.has(oldKey) ? store.has(`${oldKey}-erased`) : true).toBe(true);
  });

  it('a run ending (its file emptied by the game) retires the key as ERASE does', () => {
    stuckMigration();
    // dropResume empties a file through eraseClassicFile, as ERASE FILE does.
    eraseClassicFile(ref(1));
    migrateClassicFiles(shared());
    expect(listClassicFiles('smb').every((f) => f === null)).toBe(true);
  });
});

describe('65: only the very key and text the file was copied from', () => {
  it('the old key changed since (an older build wrote a new run there): it is a new save and still migrates', () => {
    const { oldKey } = stuckMigration();
    put(oldKey, { ...run({ score: 88 }), savedAt: 10 });
    eraseClassicFile(ref(1));
    expect(store.has(oldKey)).toBe(true);
    expect(store.has(`${oldKey}-erased`)).toBe(false);
    expect(oldRunsWaiting('smb')).toBe(1);
  });

  it('a file with no fromOld: erasing it touches no old key', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const s of [1, 2, 3] as const)
      saveClassicFile({ ...ref(s), rules: originalFileRules(), continues: 0, run: run({ score: s }) });
    const oldKey = classicResumeKey('smb');
    put(oldKey, { ...run({ score: 77 }), savedAt: 9 });
    migrateClassicFiles(shared()); // full: it waits
    eraseClassicFile(ref(2));
    expect(store.has(oldKey)).toBe(true);
    expect(store.has(`${oldKey}-erased`)).toBe(false);
    migrateClassicFiles(shared());
    // The waiting old save moves into the freed file, as before (31a).
    expect(loadClassicFile(ref(2))?.run.score).toBe(77);
  });

  it('a damaged or hostile fromOld never deletes anything that is not an old Classic slot', () => {
    put('smbc-settings', { keep: true });
    put('smbc-save-1', { keep: true });
    for (const key of ['smbc-settings', 'smbc-save-1', classicFileKey(ref(2))]) {
      saveClassicFile({ ...ref(1), rules: originalFileRules(), continues: 0, run: run() });
      const f = JSON.parse(store.get(classicFileKey(ref(1)))!);
      // The fingerprint the key's text really has (so only the key's name protects it).
      const fp = fnv(JSON.stringify(JSON.parse(store.get(key) ?? 'null')));
      store.set(classicFileKey(ref(1)), JSON.stringify({ ...f, fromOld: { key, fp } }));
      eraseClassicFile(ref(1));
    }
    expect(store.get('smbc-settings')).toBe(JSON.stringify({ keep: true }));
    expect(store.get('smbc-save-1')).toBe(JSON.stringify({ keep: true }));
    expect(store.has('smbc-settings-erased')).toBe(false);
  });

  it('another set’s old key is left alone (the mark names it, its text is another)', () => {
    const { oldKey } = stuckMigration();
    put(classicResumeKey('lost'), { ...run({ levelId: 'lost-1-1', score: 5 }), savedAt: 3 });
    eraseClassicFile(ref(1));
    expect(store.has(classicResumeKey('lost'))).toBe(true);
    expect(store.has(oldKey) ? store.has(`${oldKey}-erased`) : true).toBe(true);
  });
});

describe('65: storage throwing', () => {
  it('both the delete and the rename refused: the file is still erased (the player asked)', () => {
    const oldKey = classicResumeKey('smb');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    put(oldKey, { ...run({ score: 77 }), savedAt: 9 });
    refuseRemove((k) => k === oldKey);
    migrateClassicFiles(shared());
    refuseSet((k) => k.startsWith(oldKey));
    expect(() => eraseClassicFile(ref(1))).not.toThrow();
    expect(store.has(classicFileKey(ref(1)))).toBe(false);
  });

  it('getItem throwing: erase does not throw, and no key is touched', () => {
    const { oldKey } = stuckMigration();
    const before = store.get(oldKey);
    ls().getItem = () => {
      throw new Error('blocked');
    };
    expect(() => eraseClassicFile(ref(1))).not.toThrow();
    expect(store.get(oldKey)).toBe(before);
  });

  it('a downgrade reads the old key as before (a retired copy under -erased is ignored by it)', () => {
    const oldKey = classicResumeKey('smb');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    put(oldKey, { ...run({ score: 77 }), savedAt: 9 });
    refuseRemove((k) => k === oldKey);
    migrateClassicFiles(shared());
    eraseClassicFile(ref(1));
    // The -erased copy is the same text: an older version that reads the old key sees its run.
    expect(store.get(`${oldKey}-erased`)).toBe(store.get(oldKey));
  });
});
