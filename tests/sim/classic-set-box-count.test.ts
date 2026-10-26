import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import {
  classicFileKey,
  originalFileRules,
  saveClassicFile,
  type ClassicFileRef,
} from '@game/original-files';
import type { ClassicResume } from '@game/run-resume';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicMenuScene } from '@game/scenes/original-game';
import { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { makeGame, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';

// v0.4.72 38b (and 39c): the set box's "N files used" counts every file in use, not only the
// ones that play now: an UNREADABLE file, a HERO OFF one and a CANNOT PLAY one are in use too
// (a new game never takes them; ERASE FILE empties them). Rule 33a: the edge cases first.

useStorage();
afterEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

const run = (over: Partial<ClassicResume> = {}): ClassicResume => ({
  v: 1,
  levelId: '1-2',
  rules: 'classic',
  hero: 'mario',
  score: 0,
  coins: 0,
  lives: 3,
  world: 1,
  stage: 2,
  powerState: 'small',
  hp: 0,
  kit: {},
  warped: false,
  checkpoint: null,
  ...over,
});
const ref = (slot: 1 | 2 | 3, set: ClassicFileRef['set'] = 'smb'): ClassicFileRef => ({ set, slot });
const keep = (r: ClassicFileRef, over: Partial<ClassicResume> = {}) =>
  saveClassicFile({ ...r, rules: originalFileRules(), continues: 0, run: run(over) });

function game(heroesOff: string[] = []) {
  const settings: Settings = { ...defaultSettings(), dev: true };
  settings.classicDev = { ...settings.classicDev, heroesOff };
  return makeGame({ deps: { settings, applySettings: () => {} } });
}
type G = ReturnType<typeof game>;
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
/** The set box's hint for each map set row. */
function hints(h: G): string[] {
  h.game.showClassicMenu();
  const m = h.top();
  expect(m).toBeInstanceOf(ClassicMenuScene);
  return items(m)
    .slice(0, 3)
    .map((i) => i.hint ?? '');
}
const count = (h: G, row = 0) => /(No files used|\d+ files? used)$/.exec(hints(h)[row] ?? '')?.[1];

describe('38b: the set box counts every file in use', () => {
  it('no files: No files used', () => {
    expect(count(game())).toBe('No files used');
  });

  it('one file that plays: 1 file used', () => {
    keep(ref(1));
    expect(count(game())).toBe('1 file used');
  });

  it('an UNREADABLE file (damaged) is in use', () => {
    store.set(classicFileKey(ref(2)), '{"v":1,"run":null}');
    expect(count(game())).toBe('1 file used');
  });

  it('a file that is not JSON at all is in use', () => {
    store.set(classicFileKey(ref(3)), 'not json{');
    expect(count(game())).toBe('1 file used');
  });

  it("a newer build's file (after a downgrade) is in use", () => {
    store.set(classicFileKey(ref(1)), JSON.stringify({ v: 2, run: run() }));
    expect(count(game())).toBe('1 file used');
  });

  it('a HERO OFF file is in use', () => {
    keep(ref(2), { hero: 'yoshi' });
    const h = game(['yoshi']);
    expect(h.game.classicFileProblem(ref(2))).toBe('hero-off');
    expect(count(h)).toBe('1 file used');
  });

  it('a CANNOT PLAY file (a hero this version does not have) is in use', () => {
    keep(ref(1), { hero: 'someone-new' });
    expect(count(game())).toBe('1 file used');
  });

  it('a CANNOT PLAY file (a level that does not load) is in use', () => {
    keep(ref(3), { levelId: 'zz-9-9', world: 9, stage: 9 });
    expect(count(game())).toBe('1 file used');
  });

  it('a full set of one of each: 3 files used', () => {
    keep(ref(1));
    store.set(classicFileKey(ref(2)), '{"v":1,"run":null}');
    keep(ref(3), { hero: 'yoshi' });
    expect(count(game(['yoshi']))).toBe('3 files used');
  });

  it('each set counts its own files only', () => {
    keep(ref(1, 'lost'), { hero: 'someone-new', levelId: 'll-1-2' });
    store.set(classicFileKey(ref(2, 'special')), 'not json{');
    const h = game();
    const [smb, special, lost] = hints(h).map((x) => /(No files used|\d+ files? used)$/.exec(x)?.[1]);
    expect(smb).toBe('No files used');
    expect(special).toBe('1 file used');
    expect(lost).toBe('1 file used');
  });

  // Item 120 (owner-approved): it says the saves cannot be read, not "No files used".
  it("storage that throws: Saves can't be read, and the box still opens", () => {
    keep(ref(1));
    const h = game();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(hints(h)[0]).toMatch(/Saves can't be read right now$/);
    choose(h, 'Super Mario Bros.');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
  });

  it('back from the file box after ERASE FILE empties an unreadable file: the count follows', () => {
    store.set(classicFileKey(ref(2)), 'not json{');
    keep(ref(1));
    const h = game();
    expect(count(h)).toBe('2 files used');
    choose(h, 'Super Mario Bros.');
    choose(h, 'Erase file');
    choose(h, 'File 2');
    choose(h, 'Yes');
    expect(store.has(classicFileKey(ref(2)))).toBe(false);
    // BACK out of the file box: the set box rebuilt.
    while (!(h.top() instanceof ClassicMenuScene)) choose(h, 'Back');
    expect(/(\d+ files? used)$/.exec(items(h.top())[0]?.hint ?? '')?.[1]).toBe('1 file used');
  });
});
