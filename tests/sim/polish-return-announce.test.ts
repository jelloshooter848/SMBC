import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, loadSettings, saveSettings, type Settings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import { DevMenuScene } from '@game/scenes/dev';
import { LevelScene } from '@game/scenes/level';
import { OptionsScene } from '@game/scenes/options';
import { PauseScene } from '@game/scenes/pause';
import { QuitRunScene } from '@game/scenes/quit-run';
import { TitleScene, TITLE_NAME } from '@game/scenes/title';
import {
  OFFLINE_NOTICE_CLOSED_LINES,
  OFFLINE_NOTICE_LINES,
  UPDATE_LINES,
  type HomeScreenHooks,
} from '@game/pwa/home-screen';
import { ClassicOptionsScene } from '@game/scenes/original-game';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// v0.4.72 38f: pages and boxes say their title and focused row on entry, and the focused row
// again on the way back (P5's entryTitle and backToMenu). These were left out: the title's
// Options hub said only "Video"; back on the title (from Options, or Dev menu > Back) said
// nothing; closing the downloaded copy's note said nothing; the Classic pause opened with only
// "Continue"; and NO on its quit confirm said only "Paused."

useStorage();
afterEach(() => store.clear());

const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label);
const cursor = (m: unknown) => (m as { index: number }).index;
function pick(h: H, label: string): void {
  h.idle(8);
  const row = labels(h.top()).indexOf(label);
  expect(row, `${label} in ${labels(h.top()).join(', ')}`).toBeGreaterThanOrEqual(0);
  for (let n = 0; cursor(h.top()) !== row && n < 40; n++) h.tap('down');
  h.tap('jump');
}
function game(over: Partial<Settings> = {}, homeScreen?: Partial<HomeScreenHooks>) {
  const settings: Settings = { ...loadSettings(), ...over };
  return makeGame({
    dev: settings.dev,
    deps: {
      settings,
      applySettings: () => saveSettings(settings),
      ...(homeScreen
        ? {
            homeScreen: {
              ios: false,
              phone: false,
              standalone: false,
              variant: () => 'hidden' as const,
              prompt: vi.fn(async () => 'accepted' as const),
              updateReady: () => false,
              applyUpdate: vi.fn(),
              ...homeScreen,
            },
          }
        : {}),
    },
  });
}
function title(h: H): TitleScene {
  h.game.showTitle();
  h.until(() => (h.top() as TitleScene).phase === 'ready' || !(h.top() instanceof TitleScene), 900);
  expect(h.top()).toBeInstanceOf(TitleScene);
  return h.top() as TitleScene;
}

describe('38f: the title and its Options', () => {
  it('Options opens saying its name, then Video', () => {
    const h = game();
    title(h);
    pick(h, 'Options');
    expect(h.top()).toBeInstanceOf(OptionsScene);
    expect(h.said.at(-1)).toMatch(/^Options\. Video/);
  });

  it('BACK from Options (BACK, or its Back row): the title says its focused row', () => {
    for (const how of ['attack', 'row'] as const) {
      const h = game();
      title(h);
      pick(h, 'Options');
      const n = h.said.length;
      if (how === 'attack') {
        h.idle(8);
        h.tap('attack');
      } else pick(h, 'Back');
      expect(h.top()).toBeInstanceOf(TitleScene);
      expect(h.said.length).toBeGreaterThan(n);
      expect(h.said.at(-1)).toBe('Options. Settings, custom levels and the level editor');
    }
  });

  it('Dev menu > Back (its row): the title says its focused row', () => {
    const h = game({ ...defaultSettings(), dev: true });
    title(h);
    pick(h, 'Dev mode');
    expect(h.top()).toBeInstanceOf(DevMenuScene);
    pick(h, 'Back');
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(h.said.at(-1)).toMatch(/^Dev mode/);
  });
});

describe("38f: closing the downloaded copy's note", () => {
  for (const [name, over, lines] of [
    ['campaign closed', {}, OFFLINE_NOTICE_CLOSED_LINES],
    ['campaign open', { dev: true }, OFFLINE_NOTICE_LINES],
  ] as const)
    it(`${name}: the title says its name and focused row`, () => {
      const h = game(over, { fileCopy: true });
      h.game.showTitle();
      h.until(
        () => h.top() instanceof CardScene && (h.top() as CardScene).lines.join('|') === lines.join('|'),
        900,
      );
      h.idle(CARD_GUARD_FRAMES + 1);
      h.tap('jump');
      expect(h.top()).toBeInstanceOf(TitleScene);
      expect(h.said.at(-1)).toBe(`${TITLE_NAME}. Classic. The original game, as it was`);
    });
});

describe('38f: the Classic pause', () => {
  function paused(): H {
    const h = game();
    h.game.classicGame(h.game.heroSlots[0]!, '1-1', { ref: { set: 'smb', slot: 1 } });
    h.until(() => h.top() instanceof LevelScene, 900);
    h.idle(4);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(PauseScene);
    return h;
  }

  it('opens saying "Paused." then the focused row', () => {
    const h = paused();
    expect(h.said.at(-1)).toBe('Paused. Continue');
  });

  it('NO on the quit confirm: "Paused." and the focused row (Quit)', () => {
    const h = paused();
    pick(h, 'Quit');
    expect(h.top()).toBeInstanceOf(QuitRunScene);
    pick(h, 'No');
    expect(h.top()).toBeInstanceOf(PauseScene);
    expect(h.said.at(-1)).toBe(
      'Paused. Quit. Back to the Classic menu; your file picks the run up from this level',
    );
  });

  it('BACK on the quit confirm says the same', () => {
    const h = paused();
    pick(h, 'Quit');
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(PauseScene);
    expect(h.said.at(-1)).toMatch(/^Paused\. Quit\. /);
  });

  it('the campaign pause is as it was (no title)', () => {
    const h = game({ ...defaultSettings(), dev: true });
    h.game.scenes.push(new PauseScene(h.game));
    expect(h.said.at(-1)).toBe('Continue');
  });
});

// The break-it review of 38f: the same, in three more places.
describe('38f review: more ways back', () => {
  it('Classic pause > Options > BACK: the pause says its focused row (Options)', () => {
    const h = game();
    h.game.classicGame(h.game.heroSlots[0]!, '1-1', { ref: { set: 'smb', slot: 1 } });
    h.until(() => h.top() instanceof LevelScene, 900);
    h.idle(4);
    h.tap('start');
    pick(h, 'Options');
    expect(h.top()).toBeInstanceOf(OptionsScene);
    const n = h.said.length;
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(PauseScene);
    expect(h.said.length).toBeGreaterThan(n);
    expect(h.said.at(-1)).toMatch(/^Options/);
  });

  it('BACK on the update card: the title says its name and focused row', () => {
    const h = game({}, { updateReady: () => true });
    h.game.showTitle();
    h.until(
      () => h.top() instanceof CardScene && (h.top() as CardScene).lines.join('|') === UPDATE_LINES.join('|'),
      900,
    );
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(h.said.at(-1)).toBe(`${TITLE_NAME}. Classic. The original game, as it was`);
  });

  it("Classic options > Video, audio, controls: the page says that row's name", () => {
    const h = game();
    h.game.scenes.push(new ClassicOptionsScene(h.game, () => h.game.scenes.pop()));
    pick(h, 'Video, audio, controls');
    expect(h.top()).toBeInstanceOf(OptionsScene);
    expect(h.said.at(-1)).toMatch(/^Video, audio, controls\. Video/);
  });
});
