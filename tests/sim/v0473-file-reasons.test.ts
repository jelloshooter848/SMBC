import { afterEach, describe, expect, it } from 'vitest';
import { originalFileRules, saveClassicFile, type ClassicFileRef } from '@game/original-files';
import { classicResumeKey, type ClassicResume } from '@game/run-resume';
import type { MenuItem } from '@game/scenes/menu';
import {
  ClassicEraseConfirmScene,
  ClassicEraseScene,
  type ClassicFilesScene,
} from '@game/scenes/original-files-menu';
import { draw, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';
import { classic, keepCleared, openFiles } from './cleared-nav';

// v0.4.73 PR 2, owner items 42 and 44: what the file box only said is shown too. 42: "a game is
// waiting" (an old save waiting for a free file) and why a HERO OFF or CANNOT PLAY file cannot
// play, on the line under the box. 44: ERASE FILE's picker shows such files with their state
// (as the file box does), and "ERASE FILE N?" says, and shows, why the file cannot play.

useStorage();
afterEach(() => store.clear());

const F1: ClassicFileRef = { set: 'smb', slot: 1 };
const F2: ClassicFileRef = { set: 'smb', slot: 2 };
const F3: ClassicFileRef = { set: 'smb', slot: 3 };
const run = (over: Partial<ClassicResume> = {}): ClassicResume => ({
  v: 1,
  levelId: '1-2',
  rules: 'classic',
  hero: 'mario',
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
  ...over,
});
const keep = (ref: ClassicFileRef, over: Partial<ClassicResume> = {}) =>
  saveClassicFile({ ...ref, rules: originalFileRules(), continues: 0, run: run(over) });
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const values = (s: unknown) => items(s).map((i) => i.value?.() ?? null);
const screen = (s: unknown) =>
  draw(s as { render(r: never): void })
    .texts.map((x) => x.str)
    .join(' ');
/** Highlight row `label` (without picking it). */
function point(h: ReturnType<typeof classic>, label: string): void {
  const menu = h.top() as unknown as { index: number };
  const row = items(menu).findIndex((i) => i.label === label);
  h.idle(8);
  for (let i = 0; i < 20 && menu.index !== row; i++) h.tap('down');
}
const devGame = (heroesOff: string[] = []) =>
  classic((s) => {
    s.dev = true;
    s.classicDev = { ...s.classicDev, heroesOff };
  });

describe('42: shown on screen, not only said', () => {
  it('an old save waiting for a free file: on the ERASE FILE row', () => {
    for (const ref of [F1, F2, F3]) keep(ref);
    store.set(classicResumeKey('smb'), JSON.stringify({ ...run({ score: 77 }), savedAt: 9 }));
    const h = classic();
    const box = openFiles(h);
    point(h, 'Erase file');
    expect(screen(box)).toMatch(/A GAME IS WAITING FOR A FILE/);
    // Nothing waiting: no such line.
    store.delete(classicResumeKey('smb'));
    const h2 = classic();
    const box2 = openFiles(h2);
    point(h2, 'Erase file');
    expect(screen(box2)).not.toMatch(/WAITING/);
  });

  it('HERO OFF: why, under the box', () => {
    keep(F2, { hero: 'yoshi' });
    const h = devGame(['yoshi']);
    const box = openFiles(h);
    point(h, 'File 2');
    expect(values(box)[1]).toBe('HERO OFF');
    expect(screen(box)).toMatch(/TURN HERO ON IN TOGGLE HEROES/);
  });

  it('CANNOT PLAY, its hero: why, under the box', () => {
    keep(F2, { hero: 'someone-new' });
    const h = classic();
    const box = openFiles(h);
    point(h, 'File 2');
    expect(values(box)[1]).toBe('CANNOT PLAY');
    expect(screen(box)).toMatch(/HERO IS NOT IN THIS VERSION/);
  });

  it('CANNOT PLAY, its level: why, under the box', () => {
    keep(F2, { levelId: 'zz-9-9', world: 9, stage: 9 });
    const h = classic();
    const box = openFiles(h);
    point(h, 'File 2');
    expect(values(box)[1]).toBe('CANNOT PLAY');
    expect(screen(box)).toMatch(/LEVEL IS NOT IN THIS VERSION/);
  });

  it('NOT RELEASED: why, under the box', () => {
    keep(F2, { hero: 'vicviper', devHero: true });
    const h = classic();
    const box = openFiles(h);
    point(h, 'File 2');
    expect(values(box)[1]).toBe('NOT RELEASED');
    expect(screen(box)).toMatch(/HERO IS NOT RELEASED YET/);
  });

  it('every line under the box fits the screen', () => {
    keep(F1, { hero: 'someone-new' });
    keep(F2, { levelId: 'zz-9-9', world: 9, stage: 9 });
    keep(F3, { hero: 'vicviper', devHero: true });
    const h = classic();
    const box = openFiles(h) as ClassicFilesScene;
    for (const label of ['File 1', 'File 2', 'File 3', 'Erase file']) {
      point(h, label);
      const line = (box as unknown as { statusLine(): string }).statusLine();
      expect(line.length).toBeLessThanOrEqual(31);
    }
  });
});

describe('44: ERASE FILE shows a file that cannot play with its state, and says why', () => {
  it('HERO OFF and CANNOT PLAY on the picker rows, and CLEARED', () => {
    keep(F1, { hero: 'yoshi' });
    keep(F2, { hero: 'someone-new' });
    keepCleared(F3);
    const h = devGame(['yoshi']);
    openFiles(h);
    choose(h, 'Erase file');
    expect(h.top()).toBeInstanceOf(ClassicEraseScene);
    expect(values(h.top())).toEqual(['HERO OFF', 'CANNOT PLAY', expect.stringMatching(/CLEARED/), null]);
    // The file in full is still read out, with why it cannot play.
    expect(items(h.top())[0]?.hint).toMatch(/Normal, World 1-2, score 4100, /);
    expect(items(h.top())[0]?.hint).toMatch(/off in Dev > Toggle heroes/);
  });

  it('"ERASE FILE N?" says why it cannot play, and shows it', () => {
    keep(F2, { hero: 'someone-new' });
    const h = classic();
    openFiles(h);
    choose(h, 'Erase file');
    choose(h, 'File 2');
    expect(h.top()).toBeInstanceOf(ClassicEraseConfirmScene);
    expect(h.said.at(-1)).toMatch(/^Erase file 2\? .*It cannot play now: its hero is not in this version/);
    expect(screen(h.top())).toMatch(/HERO IS NOT IN THIS VERSION/);
  });

  it('a HERO OFF file: the question says so too', () => {
    keep(F2, { hero: 'yoshi' });
    const h = devGame(['yoshi']);
    openFiles(h);
    choose(h, 'Erase file');
    choose(h, 'File 2');
    expect(h.said.at(-1)).toMatch(/It cannot play now: its hero, Yoshi, is off in Dev > Toggle heroes/);
    expect(screen(h.top())).toMatch(/TURN HERO ON IN TOGGLE HEROES/);
  });

  it('a file that plays: the question is as before', () => {
    keep(F2);
    const h = classic();
    openFiles(h);
    choose(h, 'Erase file');
    choose(h, 'File 2');
    expect(h.said.at(-1)).toMatch(/^Erase file 2\? Normal, World 1-2, score 4100, /);
    expect(h.said.at(-1)).not.toMatch(/cannot play/);
  });
});
