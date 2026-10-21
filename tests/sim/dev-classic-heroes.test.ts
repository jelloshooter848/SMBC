import { describe, expect, it, vi } from 'vitest';
import { defaultSettings, loadSettings, SETTINGS_KEY, type Settings } from '@engine/save/settings';
import { EXPANSION_HEROES, RELEASED_EXPANSION_HEROES } from '@game/characters/registry';
import type { DevMenuScene } from '@game/scenes/dev';
import { DevClassicHeroesScene } from '@game/scenes/dev';
import { DEV_LAST_KEY } from '@game/scenes/dev-play';
import type { MenuItem } from '@game/scenes/menu';
import { TitleScene } from '@game/scenes/title';
import { makeGame, store, useStorage } from './heroes-harness';

// O-06 (RC audit addendum): Dev > Classic heroes, Release / On / Off per Expansion hero, an All
// row and the Yoshi mount (Off / On / Ride). One rule (Game.expansionHeroOffered):
// devMode ? (override ?? release) : release. Dev mode only: release players never see any of it.

useStorage();

const items = (s: unknown): MenuItem[] => (s as { items: MenuItem[] }).items;
const row = (s: unknown, label: string): MenuItem => {
  const r = items(s).find((i) => i.label === label);
  expect(r, label).toBeDefined();
  return r as MenuItem;
};
const ids = (h: ReturnType<typeof makeGame>) => h.game.slotsFor('classic').map((c) => c.id);

function devGame(over: Partial<Settings> = {}) {
  const settings: Settings = { ...defaultSettings(), dev: true, ...over };
  const apply = vi.fn();
  const h = makeGame({ deps: { settings, applySettings: apply } });
  return { h, settings, apply, page: new DevClassicHeroesScene(h.game, () => h.game.scenes.pop()) };
}

describe('O-06: Dev > Classic heroes', () => {
  it('the Dev menu opens it; the rows: All, each Expansion hero, Yoshi mount, Back', () => {
    const { h, page } = devGame();
    h.game.showDevMenu();
    // BUG-10: renamed Toggle heroes; this page is its Classic page.
    expect(items(h.game.scenes.top).map((i) => i.label)).toContain('Toggle heroes');
    expect(items(h.game.scenes.top).some((i) => i.label.startsWith('Classic: '))).toBe(false);
    expect(items(page).map((i) => i.label)).toEqual([
      'All',
      'Vic Viper',
      'Warriors',
      'Arthur',
      'Yoshi',
      'Yoshi mount',
      // BUG-10: each hero's Plays as, on its own page.
      'Plays as',
      'Back',
    ]);
    expect(EXPANSION_HEROES).toEqual(['vicviper', 'warriors', 'arthur', 'yoshi']);
    for (const it of items(page).slice(1, 5)) expect(it.value?.()).toBe('Release');
    expect(row(page, 'All').value?.()).toBe('Release');
  });

  it('keys and touch: OK (the touch OK button) and RIGHT step a row, and the new value is read out', () => {
    const { h, page, settings } = devGame();
    h.game.scenes.push(page);
    h.idle(8);
    expect(page.touchLabels().jump).toBe('OK');
    for (let i = 0; i < 4; i++) h.tap('down');
    expect(h.said.at(-1)).toMatch(/^Yoshi: Release/);
    h.tap('jump');
    expect(h.said.at(-1)).toMatch(/^Yoshi: On/);
    h.tap('right');
    expect(h.said.at(-1)).toMatch(/^Yoshi: Off/);
    expect(settings.classicDev.heroesOff).toEqual(['yoshi']);
    h.tap('attack');
    expect(h.game.scenes.top).not.toBe(page);
  });

  it('Release follows what players get; On shows a hero they do not; Off hides one they do', () => {
    const { h, page, settings } = devGame();
    settings.classic.expansion = 'off';
    expect(ids(h)).not.toContain('yoshi');
    row(page, 'Yoshi').adjust?.(1); // On
    expect(row(page, 'Yoshi').value?.()).toBe('On');
    expect(ids(h)).toContain('yoshi');
    expect(ids(h)).not.toContain('arthur');
    row(page, 'Yoshi').adjust?.(1); // Off
    expect(ids(h)).not.toContain('yoshi');
    // The dev Expansion heroes row no longer offers all four: Release is what players get, and
    // with nothing in RELEASED_EXPANSION_HEROES (0.5.0) that is none of them.
    settings.classic.expansion = 'on';
    for (const id of EXPANSION_HEROES)
      expect(h.game.heroReleased(id), id).toBe(RELEASED_EXPANSION_HEROES.includes(id));
    expect(ids(h)).not.toContain('yoshi');
    expect(ids(h)).not.toContain('arthur');
    row(page, 'Yoshi').adjust?.(1); // Release
    expect(ids(h)).not.toContain('yoshi');
    expect(row(page, 'Yoshi').hint).toMatch(/hidden now; not released to players/);
    row(page, 'Yoshi').adjust?.(1); // On
    expect(ids(h)).toContain('yoshi');
  });

  it('All: Release, All on, All off, and Mixed when the heroes differ', () => {
    const { h, page, settings, apply } = devGame();
    settings.classic.expansion = 'off';
    const all = row(page, 'All');
    all.adjust?.(1);
    expect(all.value?.()).toBe('All on');
    for (const id of EXPANSION_HEROES) expect(ids(h)).toContain(id);
    all.adjust?.(1);
    expect(all.value?.()).toBe('All off');
    expect(settings.classicDev.heroesOff.sort()).toEqual([...EXPANSION_HEROES].sort());
    all.adjust?.(1);
    expect(all.value?.()).toBe('Release');
    expect(settings.classicDev.heroesOff).toEqual([]);
    expect(settings.classicDev.heroesOn).toBeUndefined();
    row(page, 'Arthur').adjust?.(-1); // Off
    expect(all.value?.()).toBe('Mixed');
    all.select?.();
    expect(all.value?.()).toBe('Release');
    expect(apply).toHaveBeenCalled();
  });

  it('Yoshi mount: Off, On, Ride (GameContext.classicYoshi in a Classic-rules run)', () => {
    const { h, page, settings } = devGame();
    const mount = row(page, 'Yoshi mount');
    h.game.runRules = 'classic';
    expect(h.game.yoshiMount).toBeUndefined();
    mount.adjust?.(1);
    expect(mount.value?.()).toBe('On');
    expect(h.game.yoshiMount).toBe('on');
    mount.adjust?.(1);
    expect(mount.value?.()).toBe('Ride');
    expect(h.game.yoshiMount).toBe('ride');
    mount.adjust?.(1);
    expect(mount.value?.()).toBe('Off');
    expect(settings.classicDev).toEqual({ yoshiMount: false, heroesOff: [] });
  });

  it('saved: heroesOff (the old toggles) is the Off half, heroesOn and Ride kept by loadSettings', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        v: 2,
        classicDev: {
          yoshiMount: true,
          yoshiRide: true,
          heroesOff: ['yoshi'],
          heroesOn: ['arthur', 'yoshi', 3],
        },
      }),
    );
    expect(loadSettings().classicDev).toEqual({
      yoshiMount: true,
      yoshiRide: true,
      heroesOff: ['yoshi'],
      heroesOn: ['arthur'],
    });
    const s = loadSettings();
    const { page } = devGame({ classicDev: s.classicDev });
    expect(row(page, 'Yoshi').value?.()).toBe('Off');
    expect(row(page, 'Arthur').value?.()).toBe('On');
    expect(row(page, 'Yoshi mount').value?.()).toBe('Ride');
  });

  it('the dev START page offers the same heroes (one rule for every list)', async () => {
    const { h, page, settings } = devGame();
    settings.classic.expansion = 'off';
    row(page, 'Vic Viper').adjust?.(1);
    const { DevStartScene } = await import('@game/scenes/dev-play');
    const start = new DevStartScene(h.game, { branch: 'classic', level: '1-1', name: 'SMB 1-1' });
    expect(start.heroes.map((c) => c.id)).toEqual(ids(h));
    expect(start.heroes.map((c) => c.id)).toContain('vicviper');
  });
});

describe('O-05 / O-06: nothing reaches release players', () => {
  it('dev mode off: the overrides and the mount are ignored, the release rule stands', () => {
    const { h, settings } = devGame();
    settings.classic.expansion = 'off';
    settings.classicDev = {
      yoshiMount: true,
      yoshiRide: true,
      heroesOff: [],
      heroesOn: [...EXPANSION_HEROES],
    };
    expect(ids(h)).toContain('yoshi');
    settings.dev = false;
    for (const id of EXPANSION_HEROES) expect(ids(h)).not.toContain(id);
    // A saved Expansion heroes 'on' gives players only the released heroes (O-12's list: none yet).
    settings.classic.expansion = 'on';
    for (const id of EXPANSION_HEROES)
      expect(ids(h).includes(id), id).toBe(RELEASED_EXPANSION_HEROES.includes(id));
    h.game.runRules = 'classic';
    expect(h.game.yoshiMount).toBeUndefined();
    // The stored overrides are kept as they were.
    expect(settings.classicDev.heroesOn).toEqual([...EXPANSION_HEROES]);
  });

  it('dev mode off: no Dev mode row on the title, no scratch file, no Again start', () => {
    const { h, settings } = devGame();
    settings.dev = false;
    store.set(DEV_LAST_KEY, JSON.stringify({ branch: 'classic', level: '1-1' }));
    h.game.showTitle();
    const title = h.game.scenes.top as TitleScene;
    expect(title).toBeInstanceOf(TitleScene);
    expect(items(title).some((i) => i.label === 'Dev mode')).toBe(false);
    h.game.openScratchFile();
    expect(h.game.campaign).toBeNull();
    expect(h.game.scenes.top).toBe(title);
  });

  it('the Dev menu itself is the only way into the pages', () => {
    const { h } = devGame();
    h.game.showDevMenu();
    const dev = h.game.scenes.top as DevMenuScene;
    expect(items(dev).map((i) => i.label)).toEqual(
      // BUG-09: Classic and Campaign are under the one Level select.
      expect.arrayContaining(['Level select', 'Toggle heroes', 'Dev mode off']),
    );
  });
});
