import { describe, expect, it, vi } from 'vitest';
import { defaultSettings, loadSettings, SETTINGS_KEY, type Settings } from '@engine/save/settings';
import { CHARACTERS, CLASSIC_EXTRAS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { VICVIPER_CLASSIC } from '@game/characters/vicviper/classic';
import { WARRIORS_CLASSIC } from '@game/characters/warriors/classic';
import { YOSHI_CLASSIC } from '@game/characters/yoshi/classic';
import { DevMenuScene } from '@game/scenes/dev';
import { PauseScene } from '@game/scenes/pause';
import type { MenuItem } from '@game/scenes/menu';
import { urlYoshi } from '@game/dev-url';
import { fontText } from '@game/hud/text';
import { makeGame, useStorage } from './heroes-harness';

// The Dev menu's Classic toggles (owner request 2026-10-19 with the Yoshi build): the Yoshi mount
// (off by default) and each Classic hero not in SMBC 3.1.21 (CharacterDef.notInOriginal; on by
// default). Saved in Settings.classicDev, read only in dev mode.

useStorage();

const items = (s: unknown): MenuItem[] => (s as { items: MenuItem[] }).items;
const row = (s: unknown, label: string): MenuItem => {
  const r = items(s).find((i) => i.label === label);
  expect(r, label).toBeDefined();
  return r as MenuItem;
};

function devGame() {
  const h = makeGame({ dev: true });
  const settings = { ...defaultSettings(), dev: true };
  (h.game.deps as { settings?: Settings }).settings = settings;
  const apply = vi.fn();
  (h.game.deps as { applySettings?: () => void }).applySettings = apply;
  return { h, settings, apply };
}

describe('Settings.classicDev', () => {
  it('defaults: no Yoshi mount, every hero on; old settings files get them', () => {
    expect(defaultSettings().classicDev).toEqual({ yoshiMount: false, heroesOff: [] });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ v: 2, dev: true }));
    expect(loadSettings().classicDev).toEqual({ yoshiMount: false, heroesOff: [] });
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ v: 2, classicDev: { yoshiMount: true, heroesOff: ['yoshi'] } }),
    );
    expect(loadSettings().classicDev).toEqual({ yoshiMount: true, heroesOff: ['yoshi'] });
  });
});

describe('CharacterDef.notInOriginal', () => {
  it('Vic Viper, the Warriors of Light and Yoshi set it; the original heroes and extras never', () => {
    for (const d of [VICVIPER_CLASSIC, WARRIORS_CLASSIC, YOSHI_CLASSIC])
      expect(d.notInOriginal, d.id).toBe(true);
    for (const id of ['bass', 'protoman', 'breakman', 'pit', 'darkpit'])
      expect(CLASSIC_EXTRAS.find((d) => d.id === id)?.notInOriginal, id).toBeUndefined();
    for (const c of CHARACTERS) expect(c.notInOriginal, c.id).toBeUndefined();
  });
});

describe('the Dev menu rows', () => {
  it('Yoshi mount (OFF) and one row per hero not in the original (ON), names the font can draw', () => {
    const { h } = devGame();
    const menu = new DevMenuScene(h.game);
    expect(row(menu, 'Yoshi mount').value?.()).toBe('OFF');
    for (const d of CLASSIC_EXTRAS.filter((x) => x.notInOriginal)) {
      const r = row(menu, d.name);
      expect(r.value?.()).toBe('ON');
      expect(fontText(r.label.toUpperCase()).length).toBe(r.label.length);
      expect(r.hint ?? '').not.toMatch(/\b(button|press)\s+[abc]\b/i);
    }
    for (const label of ['Bass', 'Pit', 'Mario'])
      expect(items(menu).some((i) => i.label === label)).toBe(false);
  });

  it('toggling saves and changes what the game reads', () => {
    const { h, settings, apply } = devGame();
    const menu = new DevMenuScene(h.game);
    row(menu, 'Yoshi mount').adjust?.(1);
    expect(settings.classicDev.yoshiMount).toBe(true);
    expect(apply).toHaveBeenCalled();
    row(menu, 'Yoshi').select?.();
    expect(settings.classicDev.heroesOff).toEqual(['yoshi']);
    expect(row(menu, 'Yoshi').value?.()).toBe('OFF');
    row(menu, 'Yoshi').adjust?.(-1);
    expect(settings.classicDev.heroesOff).toEqual([]);
  });

  it('reachable from a Classic run pause in dev mode', () => {
    const { h } = devGame();
    h.game.devClassicGame(MARIO, '1-1', 'classic');
    const pause = new PauseScene(h.game);
    const dev = items(pause).find((i) => i.label === 'Dev mode');
    expect(dev).toBeDefined();
    dev?.select?.();
    expect(h.game.scenes.top).toBeInstanceOf(DevMenuScene);
    expect(items(h.game.scenes.top).some((i) => i.label === 'Yoshi mount')).toBe(true);
  });
});

describe('a hero toggled off', () => {
  it('leaves the Classic roster (so `?char=` falls back); dev mode off reads the defaults', () => {
    const { h, settings } = devGame();
    expect(h.game.rosterFor('classic')).toContain(YOSHI_CLASSIC);
    settings.classicDev.heroesOff = ['yoshi', 'vicviper'];
    const roster = h.game.rosterFor('classic');
    expect(roster).not.toContain(YOSHI_CLASSIC);
    expect(roster).not.toContain(VICVIPER_CLASSIC);
    expect(roster).toContain(WARRIORS_CLASSIC);
    expect(roster.find((c) => c.id === 'yoshi') ?? roster[0]).toBe(MARIO);
    // An original hero can never be toggled off.
    settings.classicDev.heroesOff = ['bass'];
    expect(h.game.rosterFor('classic').some((c) => c.id === 'bass')).toBe(true);
    // Dev mode off: every hero is back, no mount.
    settings.classicDev = { yoshiMount: true, heroesOff: ['yoshi'] };
    settings.dev = false;
    expect(h.game.rosterFor('classic')).toContain(YOSHI_CLASSIC);
    expect(h.game.yoshiMount).toBeUndefined();
    // The campaign roster never changes.
    expect(h.game.rosterFor('current')).toBe(CHARACTERS);
  });
});

describe('`&yoshi=` (dev only)', () => {
  it('1 or ride with dev mode on; ignored without it', () => {
    expect(urlYoshi(new URLSearchParams('yoshi=1'), true)).toBe('on');
    expect(urlYoshi(new URLSearchParams('yoshi=ride'), true)).toBe('ride');
    expect(urlYoshi(new URLSearchParams('yoshi=1'), false)).toBeNull();
    expect(urlYoshi(new URLSearchParams(''), true)).toBeNull();
  });
});
