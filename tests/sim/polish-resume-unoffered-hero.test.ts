import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { EXPANSION_HEROES } from '@game/characters/registry';
import { LevelScene } from '@game/scenes/level';
import { resumeOf } from '@game/run-resume';
import { loadClassicFile, originalFileRules, saveClassicFile } from '@game/original-files';
import { makeGame, store, useStorage } from './heroes-harness';

const REF = { set: 'smb', slot: 1 } as const;
const keep = (run: ReturnType<typeof resumeOf>): boolean =>
  saveClassicFile({ ...REF, rules: originalFileRules(), continues: 0, run });

// P1: a saved run whose hero no select offers, and that is no Expansion hero, plays as the first
// slot's hero, Mario, from Mario's default power and kit. 0.4.73 item 40: an unreleased Expansion
// hero's run (Vic Viper, Yoshi), marked devHero or not, is NOT RELEASED with dev mode off instead:
// it never plays as Mario and its file is never rewritten
// (unreleased-hero-unmarked-file.test.ts covers that file in full).

useStorage();
afterEach(() => store.clear());

describe('P1: a saved run for a hero no select offers', () => {
  for (const hero of ['vicviper', 'yoshi']) {
    it(`${hero} is an Expansion hero: his file waits for dev mode, his power and kit kept`, () => {
      expect(EXPANSION_HEROES).toContain(hero);
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
      const saved = JSON.stringify(loadClassicFile(REF));
      g.showTitle();
      expect(g.classicFileProblem(REF)).toBe('not-released');
      expect(g.resumeClassic(REF)).toBe(false);
      h.idle(30);
      expect(JSON.stringify(loadClassicFile(REF))).toBe(saved);
      expect(loadClassicFile(REF)?.run.hero).toBe(hero);
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

  it("P1 still: a hero that is no Expansion hero and no slot offers (left out by the file's own Disable heroes) plays as Mario", () => {
    const settings = defaultSettings();
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    const g = h.game;
    g.classicGame(MARIO);
    h.until(() => h.top() instanceof LevelScene, 600);
    const run = { ...resumeOf('1-2', g.state, 'classic'), hero: 'luigi', powerState: 'fire' };
    saveClassicFile({ ...REF, rules: { ...originalFileRules(), heroesOff: ['luigi'] }, continues: 0, run });
    g.showTitle();
    expect(EXPANSION_HEROES).not.toContain('luigi');
    expect(g.classicFileProblem(REF)).toBeNull();
    expect(g.resumeClassic(REF)).toBe(true);
    expect(g.state.character.id).toBe('mario');
    expect(g.state.powerState).toBe('small');
  });
});
