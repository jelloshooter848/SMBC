import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { DevLock } from '@game/dev-lock';
import { originalFileRules, saveClassicFile, type ClassicFileRef } from '@game/original-files';
import type { ClassicResume } from '@game/run-resume';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicEraseConfirmScene, PROBLEM_LINE, notReleasedLine } from '@game/scenes/original-files-menu';
import { draw, makeGame, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';
import { openFiles } from './cleared-nav';

// v0.4.73 item 68 (owner-approved): on a release build a NOT RELEASED file (its hero is an
// Expansion hero players do not have yet) says "This hero is not in this version yet. The file
// is kept.", never "turn dev mode on" (players cannot). The line under the box fits its width.
// A dev build (the lock open) keeps the dev hint.

useStorage();
afterEach(() => store.clear());

const F1: ClassicFileRef = { set: 'smb', slot: 1 };
const LOCKED: DevLock = { mode: 'locked', hash: 'a'.repeat(64) };
const CLOSED: DevLock = { mode: 'closed', hash: '' };
const run = (over: Partial<ClassicResume> = {}): ClassicResume => ({
  v: 1,
  levelId: '1-2',
  rules: 'classic',
  hero: 'arthur',
  score: 4100,
  coins: 0,
  lives: 3,
  world: 1,
  stage: 2,
  powerState: 'small',
  hp: 0,
  kit: {},
  warped: false,
  checkpoint: null,
  devHero: true,
  ...over,
});
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const screen = (s: unknown) =>
  draw(s as { render(r: never): void })
    .texts.map((x) => x.str)
    .join(' ');
const game = (lock?: DevLock) => {
  const settings: Settings = { ...defaultSettings(), dev: false };
  return makeGame({ deps: { settings, applySettings: () => {}, ...(lock ? { devLock: lock } : {}) } });
};
const SAID = 'This hero is not in this version yet. The file is kept.';

describe('68: release builds', () => {
  for (const [name, lock] of [
    ['locked', LOCKED],
    ['closed', CLOSED],
  ] as const)
    it(`${name}: the row's hint, its OK and the line under the box say the hero is not in this version`, () => {
      saveClassicFile({ ...F1, rules: originalFileRules(), continues: 0, run: run() });
      const before = store.get('smbc-classic-file-smb-1');
      const h = game(lock);
      const box = openFiles(h);
      const row = items(box)[0]!;
      expect(row.value?.()).toBe('NOT RELEASED');
      expect(row.hint).toContain(SAID.replace(/\.$/, ''));
      expect(row.hint).not.toMatch(/dev mode/i);
      choose(h, 'File 1');
      expect(h.said.at(-1)).toContain('this hero is not in this version yet. The file is kept.');
      expect(h.said.at(-1)).not.toMatch(/dev mode/i);
      const text = screen(box);
      expect(text).toContain(notReleasedLine(lock));
      expect(text).not.toMatch(/DEV MODE|NOT RELEASED YET/);
      expect(notReleasedLine(lock).length).toBeLessThanOrEqual(31);
      // The file is kept, byte for byte.
      expect(store.get('smbc-classic-file-smb-1')).toBe(before);
    });

  it('ERASE FILE N? says it too, never dev mode', () => {
    saveClassicFile({ ...F1, rules: originalFileRules(), continues: 0, run: run() });
    const h = game(LOCKED);
    openFiles(h);
    choose(h, 'Erase file');
    choose(h, 'File 1');
    expect(h.top()).toBeInstanceOf(ClassicEraseConfirmScene);
    const said = h.said.at(-1) ?? '';
    expect(said).toMatch(/not in this version yet/i);
    expect(said).not.toMatch(/dev mode/i);
    expect(screen(h.top())).not.toMatch(/DEV MODE/);
  });
});

describe('68: dev builds keep the dev hint', () => {
  it('the lock open: "Turn dev mode on to play it", and the line as before', () => {
    saveClassicFile({ ...F1, rules: originalFileRules(), continues: 0, run: run() });
    const h = game();
    const box = openFiles(h);
    expect(items(box)[0]?.hint).toMatch(/Turn dev mode on to play it/);
    expect(screen(box)).toContain(PROBLEM_LINE['not-released']);
    expect(notReleasedLine({ mode: 'open', hash: '' })).toBe(PROBLEM_LINE['not-released']);
  });
});
