import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { EXPANSION_HEROES, RELEASED_EXPANSION_HEROES } from '@game/characters/registry';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicOptionsScene, classicOptionsOn } from '@game/scenes/original-game';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// BUG-08: Options > Expansion heroes is gone. What a release player gets is the released list
// (RELEASED_EXPANSION_HEROES) alone; a saved `classic.expansion` is ignored and never rewritten;
// Dev > Toggle heroes' per-hero overrides still apply in dev mode.

useStorage();
afterEach(() => store.clear());

const labels = (m: unknown) =>
  ((m as { items: MenuItem[] }).items ?? []).map((i) => i.label.replace(/\*$/, ''));

function game(dev: boolean, expansion: 'on' | 'off'): H & { settings: Settings } {
  const settings: Settings = { ...defaultSettings(), dev };
  settings.classic = { ...settings.classic, expansion };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

/** Releases `id` for one test (the list is empty for 0.5.0). */
function release(id: string): () => void {
  const list = RELEASED_EXPANSION_HEROES as string[];
  list.push(id);
  return () => void list.splice(list.indexOf(id), 1);
}

describe('BUG-08 no Expansion heroes row', () => {
  for (const dev of [false, true])
    for (const expansion of ['on', 'off'] as const)
      it(`Classic options has no Expansion heroes row (dev ${dev}, saved ${expansion})`, () => {
        const h = game(dev, expansion);
        const o = new ClassicOptionsScene(h.game, () => {});
        expect(labels(o)).not.toContain('Expansion heroes');
        for (const i of (o as unknown as { items: MenuItem[] }).items)
          expect(i.hint ?? '').not.toMatch(/Expansion heroes/);
        expect(h.settings.classic.expansion).toBe(expansion);
        expect('expansionRowShown' in h.game).toBe(false);
      });

  it('a saved Expansion heroes value changes nothing: no hero, not "changed options", never rewritten', () => {
    for (const dev of [false, true]) {
      const h = game(dev, 'on');
      for (const id of EXPANSION_HEROES) expect(h.game.heroReleased(id), id).toBe(false);
      for (const id of EXPANSION_HEROES) expect(h.game.expansionHeroOffered(id), id).toBe(false);
      expect(classicOptionsOn(h.game)).toBe(false);
      expect(h.settings.classic.expansion).toBe('on');
    }
  });

  it('a released hero is offered from the list alone, whatever was saved', () => {
    const undo = release('yoshi');
    try {
      for (const expansion of ['on', 'off'] as const) {
        const h = game(false, expansion);
        expect(h.game.heroReleased('yoshi')).toBe(true);
        expect(h.game.slotsFor('classic').map((c) => c.id)).toContain('yoshi');
        expect(h.game.heroReleased('arthur')).toBe(false);
        expect(h.game.slotsFor('classic').map((c) => c.id)).not.toContain('arthur');
      }
    } finally {
      undo();
    }
  });

  it('dev mode overrides still apply; outside dev mode they do nothing', () => {
    const undo = release('yoshi');
    try {
      const dev = game(true, 'off');
      dev.settings.classicDev = { yoshiMount: false, heroesOff: ['yoshi'], heroesOn: ['arthur'] };
      expect(dev.game.expansionHeroOffered('yoshi')).toBe(false);
      expect(dev.game.expansionHeroOffered('arthur')).toBe(true);
      const rel = game(false, 'off');
      rel.settings.classicDev = { yoshiMount: false, heroesOff: ['yoshi'], heroesOn: ['arthur'] };
      expect(rel.game.expansionHeroOffered('yoshi')).toBe(true);
      expect(rel.game.expansionHeroOffered('arthur')).toBe(false);
    } finally {
      undo();
    }
  });
});
