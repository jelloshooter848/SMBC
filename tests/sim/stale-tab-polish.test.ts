import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { packStore } from '@engine/assets/idb';
import { MARIO } from '@game/characters/mario';
import type { DevLock } from '@game/dev-lock';
import { originalFileRules, saveClassicFile, type ClassicFileRef } from '@game/original-files';
import { IntroScene } from '@game/scenes/intro';
import type { MenuItem } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { ClassicEraseConfirmScene } from '@game/scenes/original-files-menu';
import { REPLAY_HELP_KEY } from '@game/scenes/original-replay';
import { draw, makeGame, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';
import { classic, keepCleared, openFiles, run } from './cleared-nav';
import { pickAtContinue } from './continue-select';

/*
 * Item 143 (owner-approved polish): a NOT RELEASED file's ERASE FILE N? does not say the file is
 * kept; a CLEARED file's replay WORLD card shows and says no lives (they are unlimited); the
 * ASSET PACKS page says its name as it opens.
 */

useStorage();
afterEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

const F1: ClassicFileRef = { set: 'smb', slot: 1 };
const LOCKED: DevLock = { mode: 'locked', hash: 'a'.repeat(64) };
const texts = (s: unknown) =>
  draw(s as { render(r: never): void })
    .texts.map((x) => x.str)
    .join(' ');

describe('143: ERASE FILE N? of a NOT RELEASED file (release build)', () => {
  it('neither shows nor says that the file is kept', () => {
    saveClassicFile({
      ...F1,
      rules: originalFileRules(),
      continues: 0,
      run: run({ hero: 'arthur', devHero: true }),
    });
    const settings: Settings = { ...defaultSettings(), dev: false };
    const h = makeGame({ deps: { settings, applySettings: () => {}, devLock: LOCKED } });
    openFiles(h);
    choose(h, 'Erase file');
    choose(h, 'File 1');
    expect(h.top()).toBeInstanceOf(ClassicEraseConfirmScene);
    expect(texts(h.top())).not.toMatch(/KEPT/);
    expect(texts(h.top())).toMatch(/NOT IN THIS VERSION/);
    expect(h.said.at(-1)).not.toMatch(/is kept/i);
    expect(h.said.at(-1)).toMatch(/not in this version yet/i);
  });
});

describe('143: a replay’s WORLD card', () => {
  it('shows and says no lives', () => {
    store.set(REPLAY_HELP_KEY, 'true');
    keepCleared(F1);
    const h = classic();
    openFiles(h);
    choose(h, 'File 1');
    choose(h, 'World 1');
    choose(h, '1-1');
    pickAtContinue(h);
    h.until(() => h.top() instanceof IntroScene, 120);
    expect(texts(h.top())).not.toMatch(/×\s+\d/);
    expect(h.said.at(-1)).not.toMatch(/\blives?\b/);
  });

  it('a file run’s card still shows and says its lives', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1', { ref: F1 });
    h.until(() => h.top() instanceof IntroScene, 120);
    expect(texts(h.top())).toMatch(/×\s+3/);
    expect(h.said.at(-1)).toMatch(/3 lives/);
  });
});

describe('143: ASSET PACKS', () => {
  it('says its page name as it opens', async () => {
    vi.spyOn(packStore, 'list').mockImplementation(async () => []);
    const h = classic();
    h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop()));
    h.idle(8);
    const rows = (h.top() as unknown as { items: MenuItem[] }).items.map((i) => i.label);
    const at = rows.indexOf('Asset packs');
    for (let i = 0; i < 40 && (h.top() as unknown as { index: number }).index !== at; i++) h.tap('down');
    h.tap('jump');
    await new Promise((r) => setTimeout(r, 0));
    expect(h.said.at(-1)).toMatch(/^Asset packs\b/i);
  });
});
