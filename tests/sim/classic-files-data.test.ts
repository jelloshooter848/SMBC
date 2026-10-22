import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultClassicSettings } from '@engine/save/original-options';
import { defaultSettings, type Settings } from '@engine/save/settings';
import {
  classicFileKey,
  eraseClassicFile,
  listClassicFiles,
  loadClassicFile,
  migrateClassicFiles,
  originalFileRules,
  parseFileRules,
  saveClassicFile,
  type ClassicFile,
  type SharedClassicRules,
} from '@game/original-files';
import { CLASSIC_RESUME_KEY, classicResumeKey, type ClassicResume } from '@game/run-resume';
import { makeGame, store, useStorage } from './heroes-harness';

// B-L step 1: Classic mode's save files (3 per map set, 9 keys) and the migration of the old
// per-set slots (0.4.68 on) and the single slot (0.4.67), copy then delete, safe to repeat.

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
  score: 12300,
  coins: 7,
  lives: 4,
  world: 4,
  stage: 2,
  powerState: 'big',
  hp: 0,
  kit: {},
  warped: false,
  checkpoint: null,
  ...over,
});

const shared = (over: Partial<SharedClassicRules> = {}): SharedClassicRules => ({
  classic: { ...defaultClassicSettings(), lives: 7, attack: 'strong', gameMode: 'single' },
  heroesOff: ['bass'],
  difficulty: 'easy',
  continuesUsed: 2,
  ...over,
});

const put = (key: string, v: unknown) => store.set(key, JSON.stringify(v));
const raw = (key: string) => JSON.parse(store.get(key) ?? 'null') as Record<string, unknown> | null;

describe('B-L Classic save files', () => {
  it('has nine keys, smbc-classic-file-{smb,special,lost}-{1,2,3}', () => {
    const keys = (['smb', 'special', 'lost'] as const).flatMap((set) =>
      ([1, 2, 3] as const).map((slot) => classicFileKey({ set, slot })),
    );
    expect(keys).toEqual([
      'smbc-classic-file-smb-1',
      'smbc-classic-file-smb-2',
      'smbc-classic-file-smb-3',
      'smbc-classic-file-special-1',
      'smbc-classic-file-special-2',
      'smbc-classic-file-special-3',
      'smbc-classic-file-lost-1',
      'smbc-classic-file-lost-2',
      'smbc-classic-file-lost-3',
    ]);
  });

  it('writes, reads and erases a file with its rules, run and continues', () => {
    const rules = { ...originalFileRules(), difficulty: 'hard' as const, heroesOff: ['link'] };
    rules.options.gameMode = 'survival';
    expect(
      saveClassicFile({ set: 'special', slot: 2, rules, continues: 3, run: run({ levelId: 'sp-2-1' }) }),
    ).toBe(true);
    const f = loadClassicFile({ set: 'special', slot: 2 }) as ClassicFile;
    expect(f).toMatchObject({
      set: 'special',
      slot: 2,
      continues: 3,
      run: { levelId: 'sp-2-1', score: 12300 },
    });
    expect(f.rules).toMatchObject({
      difficulty: 'hard',
      heroesOff: ['link'],
      options: { gameMode: 'survival' },
    });
    expect(listClassicFiles('special').map((x) => x?.slot ?? null)).toEqual([null, 2, null]);
    eraseClassicFile({ set: 'special', slot: 2 });
    expect(loadClassicFile({ set: 'special', slot: 2 })).toBeNull();
  });

  it('reads a broken file as empty and an unknown rule value as the original', () => {
    put('smbc-classic-file-smb-1', { v: 1, run: { nope: true } });
    expect(loadClassicFile({ set: 'smb', slot: 1 })).toBeNull();
    const r = parseFileRules({
      difficulty: 'nightmare',
      options: { lives: 99, musicSet: 'map' },
      heroesOff: [3, 'x'],
    });
    expect(r.difficulty).toBe('normal');
    expect(r.options.lives).toBe(3);
    // The Music set is shared, never a file's.
    expect(r.options.musicSet).toBe('character');
    expect(r.heroesOff).toEqual(['x']);
  });

  it('starts new rules at the original defaults', () => {
    expect(originalFileRules()).toEqual({
      difficulty: 'normal',
      options: defaultClassicSettings(),
      heroesOff: [],
    });
  });
});

describe('B-L migration', () => {
  it('moves each v0.4.68+ per-set slot into FILE 1 of its set, then deletes it', () => {
    put(classicResumeKey('smb'), { ...run(), difficulty: 'hard', gameMode: 'survival', savedAt: 5 });
    put(classicResumeKey('lost'), { ...run({ levelId: 'll-3-1', world: 3, stage: 1 }), savedAt: 6 });
    expect(migrateClassicFiles(shared())).toBe(true);
    expect(store.has(classicResumeKey('smb'))).toBe(false);
    expect(store.has(classicResumeKey('lost'))).toBe(false);
    const smb = loadClassicFile({ set: 'smb', slot: 1 }) as ClassicFile;
    // Its own difficulty and mode; the other rules are the current Classic options.
    expect(smb.rules.difficulty).toBe('hard');
    expect(smb.rules.options).toMatchObject({ gameMode: 'survival', lives: 7, attack: 'strong' });
    expect(smb.rules.heroesOff).toEqual(['bass']);
    // Its continues: the shared count.
    expect(smb.continues).toBe(2);
    expect(smb.savedAt).toBe(5);
    const lost = loadClassicFile({ set: 'lost', slot: 1 }) as ClassicFile;
    // A slot from before RC-002 kept none: the current options' difficulty and mode.
    expect(lost.rules.difficulty).toBe('easy');
    expect(lost.rules.options.gameMode).toBe('single');
    expect(lost.run.levelId).toBe('ll-3-1');
  });

  it('moves the 0.4.67 single slot via its set', () => {
    put(CLASSIC_RESUME_KEY, run({ levelId: 'sp-5-2', world: 5, stage: 2 }));
    migrateClassicFiles(shared());
    expect(store.has(CLASSIC_RESUME_KEY)).toBe(false);
    expect(loadClassicFile({ set: 'special', slot: 1 })?.run.levelId).toBe('sp-5-2');
    expect(loadClassicFile({ set: 'smb', slot: 1 })).toBeNull();
  });

  it('is safe to repeat: a second pass changes nothing', () => {
    put(classicResumeKey('smb'), run());
    migrateClassicFiles(shared());
    const once = new Map(store);
    expect(migrateClassicFiles(shared({ continuesUsed: 9, difficulty: 'hard' }))).toBe(false);
    expect(new Map(store)).toEqual(once);
  });

  it('uses the next empty file when FILE 1 is used', () => {
    saveClassicFile({
      set: 'smb',
      slot: 1,
      rules: originalFileRules(),
      continues: 0,
      run: run({ score: 1 }),
    });
    put(classicResumeKey('smb'), run({ score: 2 }));
    migrateClassicFiles(shared());
    expect(listClassicFiles('smb').map((f) => f?.run.score ?? null)).toEqual([1, 2, null]);
  });

  it('an unreadable file is never taken for an empty one', () => {
    store.set('smbc-classic-file-smb-1', '{"v":1,"run":null}');
    put(classicResumeKey('smb'), run({ score: 5 }));
    migrateClassicFiles(shared());
    expect(store.get('smbc-classic-file-smb-1')).toBe('{"v":1,"run":null}');
    expect(loadClassicFile({ set: 'smb', slot: 2 })?.run.score).toBe(5);
  });

  it('a full set overwrites no file and keeps the old key, logged once (31a)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const slot of [1, 2, 3] as const)
      saveClassicFile({
        set: 'smb',
        slot,
        rules: originalFileRules(),
        continues: 0,
        run: run({ score: slot }),
        savedAt: slot * 10,
      });
    // Older than every file: kept, not dropped.
    put(classicResumeKey('smb'), { ...run({ score: 99 }), savedAt: 5 });
    migrateClassicFiles(shared());
    expect(listClassicFiles('smb').map((f) => f?.run.score)).toEqual([1, 2, 3]);
    expect(store.has(classicResumeKey('smb'))).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    // Newer than the oldest: still no file is overwritten; it waits for a free file.
    put(classicResumeKey('smb'), { ...run({ score: 77 }), savedAt: 25 });
    migrateClassicFiles(shared());
    expect(listClassicFiles('smb').map((f) => f?.run.score)).toEqual([1, 2, 3]);
    expect(store.has(classicResumeKey('smb'))).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
    // Erase FILE 1: it moves in there.
    eraseClassicFile({ set: 'smb', slot: 1 });
    migrateClassicFiles(shared());
    expect(listClassicFiles('smb').map((f) => f?.run.score)).toEqual([77, 2, 3]);
    expect(store.has(classicResumeKey('smb'))).toBe(false);
  });

  it("a slot's own #196 count wins over the shared one; a broken slot is kept (31c)", () => {
    put(classicResumeKey('special'), run({ levelId: 'sp-1-1', continues: 4 }));
    put(classicResumeKey('lost'), { v: 1, broken: true });
    migrateClassicFiles(shared());
    expect(loadClassicFile({ set: 'special', slot: 1 })?.continues).toBe(4);
    expect(raw(classicResumeKey('lost'))).toEqual({ v: 1, broken: true });
    expect(listClassicFiles('lost').every((f) => f === null)).toBe(true);
  });

  it('an old slot stays when its file cannot be written (storage refused)', () => {
    put(classicResumeKey('smb'), run());
    const ls = globalThis.localStorage as unknown as { setItem: (k: string, v: string) => void };
    const set = ls.setItem;
    ls.setItem = () => {
      throw new Error('full');
    };
    migrateClassicFiles(shared());
    ls.setItem = set;
    expect(store.has(classicResumeKey('smb'))).toBe(true);
    expect(loadClassicFile({ set: 'smb', slot: 1 })).toBeNull();
  });

  it('the Game migrates from its settings, and leaves the retired shared count untouched', () => {
    const settings: Settings = { ...defaultSettings(), classicMapDifficulty: 'hard' };
    settings.classicCheats.continuesUsed = 3;
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    put(classicResumeKey('smb'), run());
    const files = h.game.classicFiles('smb');
    expect(files[0]?.rules.difficulty).toBe('hard');
    expect(files[0]?.continues).toBe(3);
    expect(settings.classicCheats.continuesUsed).toBe(3);
    expect(raw(classicFileKey({ set: 'smb', slot: 1 }))?.run).not.toHaveProperty('continues');
  });
});
