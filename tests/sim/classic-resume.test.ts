import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import type { ClassicMenuScene } from '@game/scenes/original-game';
import { CLASSIC_RESUME_KEY, loadClassicResume } from '@game/run-resume';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// G-008: the original saves and loads a run (Pause > Load / Save, title > Load Game). Classic
// mode's resume slot stands in: written at each WORLD card of a Classic run, offered as
// CLASSIC > Continue, cleared by a game over and by the credits; never by a developer run.

useStorage();
afterEach(() => store.clear());

const labels = (m: unknown) => ((m as { items: MenuItem[] }).items ?? []).map((i) => i.label);

function classic(over: Partial<Settings> = {}, dev = false): H & { settings: Settings } {
  const settings = { ...defaultSettings(), ...over, ...(dev ? { dev: true } : {}) };
  const h = makeGame({ dev, deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

const inLevel = (h: H) => h.top() instanceof LevelScene;

describe('G-008 the Classic resume slot', () => {
  it('a Classic run writes it at the WORLD card; the CLASSIC menu offers Continue', () => {
    const h = classic();
    h.game.showClassicMenu();
    expect(labels(h.top())).not.toContain('Continue');
    h.game.classicGame(LINK, '1-2');
    const r = loadClassicResume();
    expect(r).toMatchObject({
      levelId: expect.stringMatching(/^1-2/),
      hero: 'link',
      rules: 'classic',
      lives: 3,
    });
    h.game.showClassicMenu();
    const menu = h.top() as ClassicMenuScene;
    expect(labels(menu)[0]).toBe('Continue');
    expect((menu as unknown as { items: MenuItem[] }).items[0]?.hint).toMatch(/World 1-2 with 3 lives/);
  });

  it('Continue goes back to that level with the lives, score, coins and hero kept', () => {
    const h = classic();
    h.game.classicGame(LINK, '1-2');
    h.until(() => inLevel(h), 600);
    h.game.state.score = 12300;
    h.game.state.coins = 42;
    h.game.state.lives = 5;
    // The next WORLD card (here the next level's) writes them.
    h.game.goToLevel('1-3', { mode: 'stand' });
    h.game.showTitle();
    h.game.showClassicMenu();
    expect(h.game.resumeClassic()).toBe(true);
    expect(h.game.classicRun).toBe(true);
    expect(h.game.state).toMatchObject({ score: 12300, coins: 42, lives: 5, world: 1, stage: 3 });
    expect(h.game.state.character.id).toBe('link');
    h.until(() => inLevel(h), 600);
    expect((h.top() as LevelScene).world.level.id).toMatch(/^1-3/);
  });

  it('quitting from the select between levels resumes at the next level (QA nit)', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1');
    h.until(() => inLevel(h), 600);
    h.game.state.score = 777;
    h.game.levelExitTo('1-2');
    expect(h.top()?.constructor.name).toBe('CharacterSelectScene');
    expect(loadClassicResume()).toMatchObject({
      levelId: expect.stringMatching(/^1-2/),
      world: 1,
      stage: 2,
      score: 777,
    });
    h.game.showTitle();
    expect(h.game.resumeClassic()).toBe(true);
    h.until(() => inLevel(h), 600);
    expect((h.top() as LevelScene).world.level.id).toMatch(/^1-2/);
  });

  it('a game over clears it', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    expect(loadClassicResume()).not.toBeNull();
    h.game.gameOver('1-1');
    expect(loadClassicResume()).toBeNull();
  });

  it('a developer Classic run never writes it', () => {
    const h = classic({}, true);
    h.game.devClassicGame(MARIO, '1-1', 'classic');
    expect(store.has(CLASSIC_RESUME_KEY)).toBe(false);
  });

  it('a broken slot is ignored', () => {
    store.set(CLASSIC_RESUME_KEY, '{"v":1,"levelId":"1-1"}');
    expect(loadClassicResume()).toBeNull();
    const h = classic();
    h.game.showClassicMenu();
    expect(labels(h.top())).not.toContain('Continue');
  });
});
