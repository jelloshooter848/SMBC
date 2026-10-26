import { afterEach, describe, expect, it } from 'vitest';
import { PALETTES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { templateReadme } from '@engine/assets/pack-loader';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { ADVANCED_OFF } from '@game/advanced-cheats';
import {
  classicFileKey,
  eraseClassicFile,
  loadClassicFile,
  originalFileRules,
  type ClassicFileRef,
  type ClassicFileRules,
} from '@game/original-files';
import { AdvancedCheatsScene } from '@game/scenes/advanced-cheats-menu';
import { abilityHint } from '@game/scenes/hints';
import { IntroScene } from '@game/scenes/intro';
import type { MenuItem } from '@game/scenes/menu';
import { QuitRunScene, confirmQuitRun } from '@game/scenes/quit-run';
import { REPLAY_HELP_KEY } from '@game/scenes/original-replay';
import { draw, makeGame, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';
import { pickAtContinue } from './continue-select';
import { classic, inLevel, keepCleared, openFiles, type G } from './cleared-nav';

/*
 * v0.4.75 (owner-approved). 151: a Quit box opened before any save was refused checks the file:
 * taken by another window, it shows and says so, never "Your run waits in its file". 153: the
 * template README imports a .zip on any device; the WORLD card with that note waits for OK and
 * shows and says so; a stale Advanced cheats page (the file cleared again in another window)
 * says so on a change and leaves the shown values as they were.
 */

useStorage();
afterEach(() => store.clear());

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const NOTE = /changed in another window/i;
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);
const screen = (h: G) =>
  draw(h.game.scenes as never)
    .texts.map((x) => x.str)
    .join(' ');

function tab1In(): G {
  const t = classic();
  t.game.classicGame(MARIO, '1-1', { ref: A });
  t.until(() => inLevel(t), 900);
  expect(loadClassicFile(A)?.run.hero).toBe('mario');
  return t;
}

function tab2NewGame(): void {
  const t = classic();
  eraseClassicFile(A);
  t.game.classicGame(LINK, '1-1', { ref: A });
  t.until(() => inLevel(t), 900);
  expect(loadClassicFile(A)?.run.hero).toBe('link');
}

describe('151: the Quit box checks the file as it opens', () => {
  it('another window took the file, no save refused yet: the note, never "waits in its file"', () => {
    const t1 = tab1In();
    tab2NewGame();
    const theirs = store.get(classicFileKey(A));
    confirmQuitRun(t1.game, null);
    expect(t1.top()).toBeInstanceOf(QuitRunScene);
    expect(t1.said.at(-1)).toMatch(NOTE);
    expect(t1.said.at(-1)).not.toMatch(/waits in its file/i);
    expect(screen(t1)).not.toMatch(/WAITS IN ITS FILE/);
    expect(screen(t1)).toMatch(/ANOTHER WINDOW/);
    expect(store.get(classicFileKey(A))).toBe(theirs);
  });

  it('its own file: the promise as before, no note', () => {
    const t1 = tab1In();
    confirmQuitRun(t1.game, null);
    expect(t1.said.at(-1)).toMatch(/waits in its file/i);
    expect(t1.said.at(-1)).not.toMatch(NOTE);
  });
});

describe('153: polish', () => {
  it('the template README imports a pack (.zip) on any device', () => {
    const text = templateReadme(new AssetRegistry(PALETTES), [], { songs: [], sfx: [] });
    expect(text).toMatch(/Import pack \(\.zip\) on any device/);
    expect(text).not.toMatch(/on a computer/);
  });

  it('the WORLD card with the note shows and says OK (the bound key), and waits for it', () => {
    const t1 = tab1In();
    tab2NewGame();
    t1.game.respawn('1-1', { mode: 'stand' });
    pickAtContinue(t1);
    t1.until(() => t1.top() instanceof IntroScene, 300);
    const ok = abilityHint(t1.game, 'OK', 'jump');
    expect(t1.said.at(-1)).toMatch(NOTE);
    expect(t1.said.at(-1)).toContain(ok);
    t1.idle(60);
    expect(screen(t1)).toContain(`PRESS ${ok}`);
  });

  it('a stale Advanced cheats page: a change says the file changed and the shown value stays', () => {
    const hard = (): ClassicFileRules => ({ ...originalFileRules(), difficulty: 'hard' });
    store.set(REPLAY_HELP_KEY, 'true');
    keepCleared(A, {}, hard());
    const settings: Settings = { ...defaultSettings() };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    expect(h.game.setAdvancedCheats(A, h.game.advancedCheatsId(A) ?? '', { seen: true })).toBe(true);
    openFiles(h);
    choose(h, 'File 1');
    choose(h, 'Advanced cheats');
    expect(h.top()).toBeInstanceOf(AdvancedCheatsScene);
    // Another window: erase, a new Hard clear.
    eraseClassicFile(A);
    keepCleared(A, { score: 3 }, hard());
    const page = h.top();
    const row = labels(page).indexOf('No damage');
    h.idle(8);
    for (let i = 0; i < 20 && (page as unknown as { index: number }).index !== row; i++) h.tap('down');
    h.tap('right');
    expect(items(page)[row]?.value?.()).toBe('Off');
    expect(h.said.at(-1)).toMatch(NOTE);
    expect(screen(h as G)).toMatch(/ANOTHER WINDOW/);
    expect(h.game.advancedCheatsOf(A)?.assist).toEqual({ ...ADVANCED_OFF });
  });
});
