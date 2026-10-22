import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { classicFileKey, loadClassicFile, originalFileRules, saveClassicFile } from '@game/original-files';
import { classicResumeKey, type ClassicResume } from '@game/run-resume';
import type { MenuItem } from '@game/scenes/menu';
import type { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';
import { choose } from './classic-files-nav';

// v0.4.72 39a: ERASE FILE said "an old save moved in" whenever the file was not empty after the
// erase. When storage refused the erase (removeItem throwing), it said "File 2 erased. A game
// saved by an older version moved into File 2" and showed OLD SAVE MOVED INTO FILE 2, though
// nothing was erased. It says "moved" only when the waiting count went down and the file was
// empty right after the erase; otherwise that the erase failed. Rule 33a: storage throwing first.

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
const F2 = { set: 'smb', slot: 2 } as const;
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const values = (s: unknown) => items(s).map((i) => i.value?.() ?? null);
const shown = (box: ClassicFilesScene) =>
  draw(box)
    .texts.map((x) => x.str)
    .join(' ');

function fullSet(): void {
  for (const slot of [1, 2, 3] as const)
    saveClassicFile({
      set: 'smb',
      slot,
      rules: originalFileRules(),
      continues: 0,
      run: run({ score: slot, levelId: `${slot}-1`, world: slot, stage: 1 }),
      savedAt: slot * 10,
    });
}
const waiting = () =>
  store.set(classicResumeKey('smb'), JSON.stringify({ ...run({ score: 77 }), savedAt: 999 }));

/** The stubbed storage, with some of its calls refusing. */
function refuse(calls: ('getItem' | 'setItem' | 'removeItem')[], only?: (k: string) => boolean): void {
  const ls = (globalThis as { localStorage: Record<string, (...a: string[]) => unknown> }).localStorage;
  for (const c of calls) {
    const real = ls[c] as (...a: string[]) => unknown;
    ls[c] = (...a: string[]) => {
      if (!only || only(a[0] as string)) throw new Error(`${c} refused`);
      return real(...a);
    };
  }
}

/** The SMB file box, then ERASE FILE > File 2 > YES. */
function eraseFile2(): { h: H; box: ClassicFilesScene } {
  const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
  h.game.showClassicMenu();
  choose(h, 'Super Mario Bros.');
  const box = h.top() as ClassicFilesScene;
  choose(h, 'Erase file');
  choose(h, 'File 2');
  choose(h, 'Yes');
  expect(h.top()).toBe(box);
  return { h, box };
}

describe('39a: ERASE FILE when storage refuses it', () => {
  it('removeItem throws, an old save waiting: no "moved", it says the erase failed', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fullSet();
    waiting();
    refuse(['removeItem']);
    const { h, box } = eraseFile2();
    const said = h.said.at(-1) ?? '';
    expect(said).not.toMatch(/moved/);
    expect(said).not.toMatch(/^File 2 erased/);
    expect(said).toMatch(/^File 2 could not be erased\. /);
    expect(shown(box)).not.toMatch(/OLD SAVE MOVED/);
    // Nothing changed: the file, and the old save still waiting.
    expect(loadClassicFile(F2)?.run.score).toBe(2);
    expect(store.has(classicResumeKey('smb'))).toBe(true);
    expect(values(box)[1]).toBe('NORMAL 2-1 X4');
  });

  it('removeItem throws, nothing waiting: it says the erase failed', () => {
    fullSet();
    refuse(['removeItem']);
    const { h } = eraseFile2();
    expect(h.said.at(-1)).toMatch(/^File 2 could not be erased\. File 2: .*World 2-1/);
    expect(loadClassicFile(F2)?.run.score).toBe(2);
  });

  it('removeItem throws on an unreadable file: the erase failed, still UNREADABLE', () => {
    store.set(classicFileKey(F2), 'not json{');
    refuse(['removeItem']);
    const { h, box } = eraseFile2();
    expect(h.said.at(-1)).toMatch(/^File 2 could not be erased\. /);
    expect(values(box)[1]).toBe('UNREADABLE');
  });

  it('removeItem only for that file throws: the old save stays waiting and nothing is said moved', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fullSet();
    waiting();
    refuse(['removeItem'], (k) => k === classicFileKey(F2));
    const { h, box } = eraseFile2();
    expect(h.said.at(-1)).not.toMatch(/moved/);
    expect(shown(box)).not.toMatch(/OLD SAVE MOVED/);
    expect(store.has(classicResumeKey('smb'))).toBe(true);
  });

  it('the erase works but writing the old save in throws: erased, the file empty, nothing moved', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fullSet();
    waiting();
    refuse(['setItem']);
    const { h, box } = eraseFile2();
    expect(h.said.at(-1)).toMatch(/^File 2 erased\. File 2: NEW GAME/);
    expect(shown(box)).not.toMatch(/OLD SAVE MOVED/);
    expect(store.has(classicResumeKey('smb'))).toBe(true);
  });

  it('a removeItem that quietly keeps the file (no throw): the erase failed', () => {
    fullSet();
    const ls = (globalThis as { localStorage: Record<string, unknown> }).localStorage;
    ls.removeItem = () => {};
    const { h } = eraseFile2();
    expect(h.said.at(-1)).toMatch(/^File 2 could not be erased\. /);
  });
});

describe('39a: ERASE FILE as before when storage works', () => {
  it('an old save waiting moves in, and that is said and shown', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fullSet();
    waiting();
    const { h, box } = eraseFile2();
    expect(h.said.at(-1)).toMatch(/^File 2 erased\. A game saved by an older version moved into File 2: /);
    expect(shown(box)).toMatch(/OLD SAVE MOVED INTO FILE 2/);
    expect(loadClassicFile(F2)?.run.score).toBe(77);
  });

  it('nothing waiting: File 2 erased', () => {
    fullSet();
    const { h } = eraseFile2();
    expect(h.said.at(-1)).toMatch(/^File 2 erased\. File 2: NEW GAME/);
  });
});
