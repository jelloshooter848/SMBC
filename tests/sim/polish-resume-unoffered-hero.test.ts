import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { resumeOf } from '@game/run-resume';
import { loadClassicFile, originalFileRules, saveClassicFile } from '@game/original-files';
import { makeGame, store, useStorage } from './heroes-harness';

const REF = { set: 'smb', slot: 1 } as const;
const keep = (run: ReturnType<typeof resumeOf>): boolean =>
  saveClassicFile({ ...REF, rules: originalFileRules(), continues: 0, run });

// P1: a saved run whose hero no select offers (an unreleased Expansion hero) plays as the first
// slot's hero, Mario, from Mario's default power and kit; the saved hero's are not written back.

useStorage();
afterEach(() => store.clear());

describe('P1: a saved run for a hero no select offers', () => {
  for (const hero of ['vicviper', 'yoshi']) {
    it(`${hero}'s saved power and kit do not carry over to Mario`, () => {
      const settings = defaultSettings();
      const h = makeGame({ deps: { settings, applySettings: () => {} } });
      const g = h.game;
      g.classicGame(MARIO);
      h.until(() => h.top() instanceof LevelScene, 600);
      const r = {
        ...resumeOf('1-2', g.state, 'classic'),
        hero,
        powerState: 'fire',
        kit: { missiles: 2 },
      };
      keep(r);
      g.showTitle();
      expect(g.resumeClassic(REF)).toBe(true);
      expect(g.state.character.id).toBe('mario');
      expect(g.state.powerState).toBe('small');
      expect(g.state.kit).toEqual({});
      // Through the Continue select (Mario focused) into the level, whose WORLD card writes the file.
      h.until(() => h.top() instanceof CharacterSelectScene, 300);
      h.idle(12);
      h.tap('jump');
      if ((h.top() as CharacterSelectScene).pickerOpen) h.tap('jump');
      h.until(() => h.top() instanceof LevelScene && (h.top() as LevelScene).level.id === '1-2', 900);
      expect(g.state.powerState).toBe('small');
      const saved = loadClassicFile(REF)?.run;
      expect(saved?.hero).toBe('mario');
      expect(saved?.powerState).toBe('small');
      expect(saved?.kit).toEqual({});
    });
  }

  it('an offered hero still comes back with his saved power', () => {
    const settings = defaultSettings();
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    const g = h.game;
    g.classicGame(MARIO);
    h.until(() => h.top() instanceof LevelScene, 600);
    keep({ ...resumeOf('1-2', g.state, 'classic'), powerState: 'fire' });
    g.showTitle();
    expect(g.resumeClassic(REF)).toBe(true);
    expect(g.state.powerState).toBe('fire');
  });
});
