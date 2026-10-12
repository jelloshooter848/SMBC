import { describe, expect, it, vi } from 'vitest';
import type { MenuItem } from '@game/scenes/menu';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import { OptionsScene } from '@game/scenes/options';
import { TitleScene } from '@game/scenes/title';
import { WorldMapScene } from '@game/scenes/world-map';
import { defaultSettings, loadSettings, saveSettings, type Settings } from '@engine/save/settings';
import type { InstallVariant } from '@engine/platform';
import {
  ADD_TO_HOME_SCREEN,
  InstallGuideScene,
  PHONE_TIP_LINES,
  STANDALONE_NOTICE_LINES,
  UPDATE_LINES,
  type HomeScreenHooks,
} from '@game/pwa/home-screen';
import { file, makeGame, useStorage, type H } from './heroes-harness';
import { ALL_STORY } from './story-seen';

// iPhone Home Screen support (0.4.44): the one-time phone tip after a first level, the one-time
// note in the Home Screen app about its own saves, the title's UPDATE READY notice, and Options →
// ADD TO HOME SCREEN. The flags live in the settings, not a save file.

useStorage();

function hooks(over: Partial<HomeScreenHooks> = {}): HomeScreenHooks {
  return {
    ios: false,
    phone: false,
    standalone: false,
    variant: () => 'hidden',
    prompt: vi.fn(async () => 'accepted' as const),
    updateReady: () => false,
    applyUpdate: vi.fn(),
    ...over,
  };
}

const IPHONE_SAFARI = { ios: true, phone: true, variant: (): InstallVariant => 'ios-safari' };
const IPHONE_APP = { ios: true, phone: true, standalone: true };

/** A game with live settings (saved like main.ts does) and the given Home Screen hooks. */
function game(h: Partial<HomeScreenHooks>, settings: Settings = loadSettings()) {
  const g = makeGame({
    deps: { settings, applySettings: () => saveSettings(settings), homeScreen: hooks(h) },
  });
  return { ...g, settings };
}

const isCard = (h: H, lines: readonly string[]) =>
  h.top() instanceof CardScene && (h.top() as CardScene).lines.join('|') === lines.join('|');

/** Waits for the card to take input, then presses `key`. */
function answer(h: H, key: 'jump' | 'attack') {
  h.idle(CARD_GUARD_FRAMES + 1);
  h.tap(key);
}

/** File 1 on the map, its story seen (so the map goes straight to idle), with `cleared`. */
function onMap(h: H, cleared: string[] = []) {
  file({ story: [...ALL_STORY], cleared });
  h.game.openFile(1);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
}

describe('the phone tip after a first level', () => {
  it('on a phone in the browser: after the first clear, once, waiting for a press; never again', () => {
    const h = game(IPHONE_SAFARI);
    onMap(h);
    h.idle(120);
    expect(h.top()).toBeInstanceOf(WorldMapScene); // nothing cleared yet
    h.game.levelCleared('1-0');
    h.until(() => isCard(h, PHONE_TIP_LINES), 600);
    expect(h.said.at(-1)).toMatch(/Tip: add to Home Screen for full screen and offline play/i);
    // It waits: no timeout.
    h.idle(1200);
    expect(isCard(h, PHONE_TIP_LINES)).toBe(true);
    answer(h, 'jump');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.settings.homeScreen?.tipDone).toBe(true);
    expect(loadSettings().homeScreen?.tipDone).toBe(true); // saved with the settings
    // The map again (still one level cleared): no tip.
    h.game.showMap();
    h.idle(300);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
  });

  it('BACK dismisses it too', () => {
    const h = game(IPHONE_SAFARI);
    onMap(h);
    h.game.levelCleared('1-0');
    h.until(() => isCard(h, PHONE_TIP_LINES), 600);
    answer(h, 'attack');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.settings.homeScreen?.tipDone).toBe(true);
  });

  it('not on a desktop, not in the Home Screen app, not for a file further on', () => {
    for (const hk of [{}, IPHONE_APP]) {
      const h = game(hk);
      onMap(h);
      h.game.levelCleared('1-0');
      h.idle(600);
      expect(h.top()).toBeInstanceOf(WorldMapScene);
    }
    const h = game(IPHONE_SAFARI);
    onMap(h, ['1-0', '1-1']);
    h.game.levelCleared('1-2');
    h.idle(600);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
  });

  it('settings saved before 0.4.44 load with both notes still to show', () => {
    const old = defaultSettings() as Partial<Settings>;
    delete old.homeScreen;
    saveSettings(old as Settings);
    expect(loadSettings().homeScreen).toEqual({ tipDone: false, noticeDone: false });
  });
});

/** The title, ready (the quick drop played out). */
function title(h: H) {
  h.game.showTitle();
  h.until(() => (h.top() as TitleScene).phase === 'ready' || !(h.top() instanceof TitleScene), 900);
}

describe('the Home Screen app note on its own saves', () => {
  it('first launch from the Home Screen: over the title, read out, naming Options → Save files → PASTE CODE', () => {
    const h = game(IPHONE_APP);
    title(h);
    h.until(() => isCard(h, STANDALONE_NOTICE_LINES), 60);
    expect(STANDALONE_NOTICE_LINES.join(' ')).toMatch(/OPTIONS > SAVE FILES > PASTE CODE/);
    expect(h.said.at(-1)).toMatch(/own saves/i);
    expect(h.said.at(-1)).toMatch(/Options, Save files, Paste code/i);
    h.idle(1200);
    expect(isCard(h, STANDALONE_NOTICE_LINES)).toBe(true);
    answer(h, 'jump');
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(loadSettings().homeScreen?.noticeDone).toBe(true);
    title(h);
    h.idle(60);
    expect(h.top()).toBeInstanceOf(TitleScene);
  });

  it('not in the browser, and not on Android (its installed app shares the browser’s saves)', () => {
    for (const hk of [IPHONE_SAFARI, { phone: true, standalone: true }]) {
      const h = game(hk);
      title(h);
      h.idle(60);
      expect(h.top()).toBeInstanceOf(TitleScene);
    }
  });
});

describe('UPDATE READY on the title', () => {
  it('waits for a press: OK reloads into the new release', () => {
    const h = game({ updateReady: () => true });
    title(h);
    h.until(() => isCard(h, UPDATE_LINES), 60);
    expect(h.said.at(-1)).toMatch(/Update ready/i);
    h.idle(1200);
    expect(isCard(h, UPDATE_LINES)).toBe(true);
    answer(h, 'jump');
    expect(h.game.deps.homeScreen?.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('BACK ignores it: the title is back, and it is not asked again this session', () => {
    const h = game({ updateReady: () => true });
    title(h);
    h.until(() => isCard(h, UPDATE_LINES), 60);
    answer(h, 'attack');
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(h.game.deps.homeScreen?.applyUpdate).not.toHaveBeenCalled();
    title(h);
    h.idle(60);
    expect(h.top()).toBeInstanceOf(TitleScene);
  });

  it('the Home Screen note comes first, then the update', () => {
    const h = game({ ...IPHONE_APP, updateReady: () => true });
    title(h);
    h.until(() => isCard(h, STANDALONE_NOTICE_LINES), 60);
    answer(h, 'jump');
    h.until(() => isCard(h, UPDATE_LINES), 60);
  });
});

const items = (h: H) => (h.top() as unknown as { items: MenuItem[] }).items;

/** Options from the title, and its ADD TO HOME SCREEN row (undefined when hidden). */
function optionsRow(h: H) {
  h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop()));
  return items(h).find((i) => i.label === ADD_TO_HOME_SCREEN);
}

describe('Options → ADD TO HOME SCREEN', () => {
  it('hidden in the Home Screen app and on a desktop with no install API', () => {
    expect(optionsRow(game({ variant: () => 'hidden' }))).toBeUndefined();
  });

  it('Android / Chrome / Edge: the browser’s own install prompt', async () => {
    const h = game({ variant: () => 'prompt' });
    const row = optionsRow(h);
    row?.select?.();
    expect(h.game.deps.homeScreen?.prompt).toHaveBeenCalledTimes(1);
    expect(h.top()).toBeInstanceOf(OptionsScene);
    await Promise.resolve();
    await Promise.resolve();
    expect(h.said.at(-1)).toMatch(/added/i);
  });

  it.each([
    ['ios-safari', /tap Share.*Add to Home Screen.*Add/i],
    ['ios-other', /Open this page in Safari first/i],
    ['browser-menu', /browser's menu/i],
  ] as const)('%s: a guide, read out, that waits for a press', (variant, said) => {
    const h = game({ ios: variant !== 'browser-menu', phone: true, variant: () => variant });
    const row = optionsRow(h);
    expect(row).toBeDefined();
    h.idle(8);
    row?.select?.();
    expect(h.top()).toBeInstanceOf(InstallGuideScene);
    expect((h.top() as InstallGuideScene).variant).toBe(variant);
    expect(h.said.at(-1)).toMatch(said);
    h.idle(1200);
    expect(h.top()).toBeInstanceOf(InstallGuideScene);
    answer(h, 'jump');
    expect(h.top()).toBeInstanceOf(OptionsScene);
  });

  it('BACK closes the guide too', () => {
    const h = game({ ...IPHONE_SAFARI });
    optionsRow(h)?.select?.();
    answer(h, 'attack');
    expect(h.top()).toBeInstanceOf(OptionsScene);
  });
});
