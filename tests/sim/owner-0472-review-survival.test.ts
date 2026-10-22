import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { defaultClassicSettings } from '@engine/save/original-options';
import { EXPANSION_HEROES } from '@game/characters/registry';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { makeGame, useStorage } from './heroes-harness';

// 0.4.72 review fix 1: a dev-mode Survival run's select offers only the heroes Survival tracks
// (Game.heroSlots), so an unreleased Expansion hero in Release state is never shown standing,
// picked without a revive, or drawn by revive mode's Random.

useStorage();

function devSurvival() {
  const settings: Settings = {
    ...defaultSettings(),
    dev: true,
    classic: { ...defaultClassicSettings(), gameMode: 'survival' },
  };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.classicSelect('1-1', () => h.game.showClassicMenu());
  const sel = h.top() as CharacterSelectScene;
  expect(sel).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  return { h, sel };
}

describe('0.4.72 review fix 1: dev Survival offers only the heroes it tracks', () => {
  it("a new dev Survival select: every hero shown is Survival's, none of the Release-state four", () => {
    const { h, sel } = devSurvival();
    expect(h.game.survival).not.toBeNull();
    const ids = sel.chars.map((c) => c.id);
    for (const id of EXPANSION_HEROES) expect(ids).not.toContain(id);
    expect(ids).toEqual(h.game.heroSlots.map((c) => c.id));
    // Each shown hero is one Survival tracks: all fallen at a new game (revive mode).
    sel.chars.forEach((_, i) => expect(sel.fallen(i), sel.chars[i]?.id).toBe(true));
  });

  it("revive mode's Random never draws one of them", () => {
    const { sel } = devSurvival();
    expect(sel.reviving).toBe(true);
    const heroAt = (sel as unknown as { heroAt(i: number): { id: string } | undefined }).heroAt.bind(sel);
    for (let i = 0; i < 200; i++) expect(EXPANSION_HEROES).not.toContain(heroAt(sel.chars.length)?.id);
  });

  it('outside Survival the dev select still shows them', () => {
    const settings: Settings = { ...defaultSettings(), dev: true };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.classicSelect('1-1', () => {});
    const ids = (h.top() as CharacterSelectScene).chars.map((c) => c.id);
    for (const id of EXPANSION_HEROES) expect(ids).toContain(id);
  });
});
