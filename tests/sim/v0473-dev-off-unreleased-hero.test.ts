import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { CLASSIC_EXTRAS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { originalFileRules, loadClassicFile, type ClassicFileRef } from '@game/original-files';
import type { ClassicGameMode } from '@engine/save/original-options';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { makeGame, store, useStorage } from './heroes-harness';

// v0.4.73 item 66 (dev only; owner-approved; tests first): dev mode turned off in the middle of
// a Classic run whose hero is an unreleased Expansion hero (Arthur), here in Single hero, where
// the select is skipped after the first pick. The current life ends and the hero select opens,
// as for any hero the select does not offer; the unreleased hero is not on it. The file stays
// marked (devHero): never dropped by a later write.

useStorage();
afterEach(() => store.clear());

const F1: ClassicFileRef = { set: 'smb', slot: 1 };
const byId = (id: string) => CLASSIC_EXTRAS.find((d) => d.id === id) as CharacterDef;
const inLevel = (h: ReturnType<typeof makeGame>) => h.top() instanceof LevelScene;

function devRun(hero: CharacterDef, gameMode: ClassicGameMode = 'single') {
  const settings: Settings = { ...defaultSettings(), dev: true };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  const rules = originalFileRules();
  rules.options.gameMode = gameMode;
  h.game.classicGame(hero, '1-1', { ref: F1, rules });
  h.until(() => inLevel(h), 600);
  h.idle(30);
  return { h, settings };
}

describe('66: dev mode off mid-run with an unreleased hero', () => {
  it('Single hero: the life ends and the hero select opens without Arthur; the file stays marked', () => {
    const { h, settings } = devRun(byId('arthur'));
    const lives = h.game.state.lives;
    settings.dev = false;
    h.until(() => h.top() instanceof CharacterSelectScene, 900);
    expect(h.game.state.lives).toBe(lives - 1);
    const sel = h.top() as CharacterSelectScene;
    expect(sel.chars.map((c) => c.id)).not.toContain('arthur');
    expect(loadClassicFile(F1)?.run.devHero).toBe(true);
    // Mario is picked: he plays the level, the file keeps its mark.
    h.idle(20);
    h.tap('jump');
    if (sel.pickerOpen) h.tap('jump');
    h.until(() => inLevel(h), 900);
    expect(h.game.state.character.id).not.toBe('arthur');
    expect(loadClassicFile(F1)?.run.devHero).toBe(true);
    // Its WORLD card wrote the run with the hero now playing, still marked (as 0.4.72's review
    // case: a released hero took over, so the file plays with dev mode off).
    expect(loadClassicFile(F1)?.run.hero).toBe(h.game.state.character.id);
    const off = makeGame({ deps: { settings: { ...defaultSettings() }, applySettings: () => {} } });
    expect(off.game.classicFileProblem(F1)).toBeNull();
  });

  it('All heroes (the default): the same, the select without Arthur', () => {
    const { h, settings } = devRun(byId('arthur'), 'all');
    settings.dev = false;
    h.until(() => h.top() instanceof CharacterSelectScene, 900);
    expect((h.top() as CharacterSelectScene).chars.map((c) => c.id)).not.toContain('arthur');
  });

  it('dev mode left on: Arthur plays on', () => {
    const { h } = devRun(byId('arthur'));
    h.idle(120);
    expect(inLevel(h)).toBe(true);
    expect(h.game.state.character.id).toBe('arthur');
  });

  it('a released hero: dev mode off changes nothing', () => {
    const released = CLASSIC_EXTRAS.find((d) => !h0().devOnlyHero(d) && h0().slotsFor('classic').includes(d));
    expect(released).toBeDefined();
    const { h, settings } = devRun(released as CharacterDef);
    const lives = h.game.state.lives;
    settings.dev = false;
    h.idle(120);
    expect(inLevel(h)).toBe(true);
    expect(h.game.state.lives).toBe(lives);
  });
});

/** A game with dev mode off, for asking who is released. */
function h0() {
  return makeGame({ deps: { settings: { ...defaultSettings() }, applySettings: () => {} } }).game;
}
