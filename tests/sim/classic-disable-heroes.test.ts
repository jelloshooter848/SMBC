import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, SETTINGS_KEY, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { ClassicHeroesScene } from '@game/scenes/disable-heroes';
import type { MenuItem } from '@game/scenes/menu';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// G-032: the original's General > Disable characters (GeneralOptions.as 23, 47-53): disabled
// heroes leave the select, Random and Single random; at least one hero always stays.

useStorage();
afterEach(() => store.clear());

const items = (m: unknown) => (m as { items: MenuItem[] }).items;

function classic(over: Partial<Settings> = {}): H & { settings: Settings } {
  const settings = { ...defaultSettings(), ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

describe('G-032 Disable heroes', () => {
  it('lists every Classic select hero, On by default; Off saves at once', () => {
    const h = classic();
    const m = new ClassicHeroesScene(h.game, () => {});
    const rows = items(m).filter((i) => i.label !== 'Back');
    expect(rows.map((r) => r.label)).toEqual(h.game.slotsFor('classic').map((c) => c.name));
    expect(rows.every((r) => r.value?.() === 'On')).toBe(true);
    const bass = rows.find((r) => r.label === 'Bass');
    bass?.adjust?.(1);
    expect(h.settings.classicHeroesOff).toEqual(['bass']);
    expect(bass?.value?.()).toBe('Off');
    expect(JSON.parse(store.get(SETTINGS_KEY) ?? '{}').classicHeroesOff).toEqual(['bass']);
    expect(loadSettings().classicHeroesOff).toEqual(['bass']);
    bass?.adjust?.(1);
    expect(h.settings.classicHeroesOff).toBeUndefined();
  });

  it('the last hero on cannot be turned off', () => {
    const h = classic();
    const ids = h.game.slotsFor('classic').map((c) => c.id);
    h.settings.classicHeroesOff = ids.filter((id) => id !== 'mario');
    const m = new ClassicHeroesScene(h.game, () => {});
    const mario = items(m).find((r) => r.label === 'Mario');
    mario?.adjust?.(1);
    expect(h.settings.classicHeroesOff).not.toContain('mario');
    expect(h.said.at(-1)).toMatch(/one hero must stay on/i);
  });

  it('an Off hero leaves the select and is never the random pick', () => {
    const h = classic({ classicHeroesOff: ['bass', 'link', 'ryu'] });
    h.game.classicGame(MARIO);
    const slots = h.game.heroSlots.map((c) => c.id);
    expect(slots).not.toContain('bass');
    expect(slots).not.toContain('link');
    expect(slots).toContain('mario');
    for (let i = 0; i < 60; i++) expect(['bass', 'link', 'ryu']).not.toContain(h.game.randomHero().id);
  });

  it('the first select from the CLASSIC menu leaves them out, and its Random slot never picks them', () => {
    const h = classic({ classicHeroesOff: ['bass', 'link', 'ryu'] });
    h.game.showClassicMenu();
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    const sel = h.top() as CharacterSelectScene;
    expect(sel).toBeInstanceOf(CharacterSelectScene);
    const ids = sel.chars.map((c) => c.id);
    expect(ids).not.toContain('bass');
    expect(ids).not.toContain('link');
    expect(ids).toContain('mario');
    for (let i = 0; i < 60; i++) expect(['bass', 'link', 'ryu']).not.toContain(h.game.randomHero().id);
  });

  it('Single random from the CLASSIC menu never draws them', () => {
    const picks = new Set<string>();
    for (let k = 0; k < 12; k++) {
      const off = ['mario', 'luigi', 'link', 'samus', 'simon', 'megaman', 'bill', 'sophia'];
      const h = classic({ classicHeroesOff: off });
      h.settings.classic.gameMode = 'single-random';
      h.game.classicSelect('1-1', () => h.game.showClassicMenu());
      picks.add(h.game.state.character.id);
    }
    for (const id of picks) expect(['bass', 'ryu']).toContain(id);
  });

  it('the campaign and the title never read it', () => {
    const h = classic({ classicHeroesOff: ['luigi'] });
    h.game.showTitle();
    expect(h.game.heroSlots.map((c) => c.id)).toContain('luigi');
  });
});
