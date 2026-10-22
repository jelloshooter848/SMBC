import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import {
  CLASSIC_EXTRAS,
  EXPANSION_HEROES,
  RELEASED_EXPANSION_HEROES,
  expansionReleased,
} from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicMenuScene, ClassicOptionsScene } from '@game/scenes/original-game';
import { ClassicHeroesScene } from '@game/scenes/disable-heroes';
import { GuideIndexScene } from '@game/scenes/guide';
import { CLASSIC_RESUME_KEY } from '@game/run-resume';
import { loadClassicFile, type ClassicFileRef } from '@game/original-files';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { pickAtContinue } from './continue-select';

// O-12 (0.5.0 RC audit addendum, blocker): the Expansion heroes are locked on the release build,
// and the Classic rules and Expansion heroes rows are developer mode's only. Outside dev mode the
// getters give Classic rules and no Expansion heroes; a per-hero released list
// (RELEASED_EXPANSION_HEROES, empty for 0.5.0) decides what players get; every way in is closed
// (Options, a saved setting, `?char=`, Continue, Random); the saved values are never rewritten.

useStorage();

/** B-L: SMB's FILE 1 (an old single or per-set slot migrates into it). */
const F1: ClassicFileRef = { set: 'smb', slot: 1 };
const loadClassicResume = () => loadClassicFile(F1)?.run ?? null;
afterEach(() => store.clear());

/** The rows' labels, without a changed row's `*` mark. */
const labels = (m: unknown) =>
  ((m as { items: MenuItem[] }).items ?? []).map((i) => i.label.replace(/\*$/, ''));
const items = (m: unknown) => (m as { items: MenuItem[] }).items;

/** A player whose earlier version saved Current rules and Expansion heroes on. */
function saved(dev = false): H & { settings: Settings } {
  const settings: Settings = { ...defaultSettings(), dev, classicRules: 'current' };
  settings.classic = { ...settings.classic, expansion: 'on' };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

const extra = (id: string) => CLASSIC_EXTRAS.find((d) => d.id === id) as CharacterDef;

describe('O-12 the released list', () => {
  it('is exported, empty for 0.5.0, and names only Expansion heroes', () => {
    expect(RELEASED_EXPANSION_HEROES).toEqual([]);
    expect(EXPANSION_HEROES).toEqual(['vicviper', 'warriors', 'arthur', 'yoshi']);
    for (const id of RELEASED_EXPANSION_HEROES) expect(EXPANSION_HEROES).toContain(id);
    for (const id of EXPANSION_HEROES) expect(expansionReleased(id), id).toBe(false);
  });
});

describe('O-12 outside developer mode', () => {
  it('the getters give Classic rules and no Expansion heroes; the saved values stay as they were', () => {
    const h = saved();
    expect(h.game.classicRules).toBe('classic');
    for (const id of EXPANSION_HEROES) expect(h.game.expansionHeroOffered(id)).toBe(false);
    expect(h.settings.classicRules).toBe('current');
    expect(h.settings.classic.expansion).toBe('on');
  });

  it('Classic options has no Classic rules row and no Expansion heroes row', () => {
    const h = saved();
    const o = new ClassicOptionsScene(h.game, () => {});
    expect(labels(o)).not.toContain('Classic rules');
    expect(labels(o)).not.toContain('Expansion heroes');
    expect(labels(o)[0]).toBe('Music set');
  });

  it('the CLASSIC menu: no "own options" from the old setting (B-L: no Map difficulty or Options row)', () => {
    const h = saved();
    const m = new ClassicMenuScene(h.game);
    expect(items(m).find((i) => /difficulty/i.test(i.label))).toBeUndefined();
    expect(items(m).find((i) => i.label === 'Options')).toBeUndefined();
    for (const i of items(m)) expect(i.hint ?? '').not.toMatch(/own Classic options|Classic rules/);
  });

  it('a Classic run plays Classic rules and offers none of the four, nor does Random, Survival or Disable heroes', () => {
    const h = saved();
    const slots = h.game.slotsFor(h.game.classicRules).map((c) => c.id);
    for (const id of EXPANSION_HEROES) expect(slots).not.toContain(id);
    h.game.classicGame(MARIO, '1-1', { ref: F1 });
    expect(h.game.liveRules).toBe('classic');
    for (const id of EXPANSION_HEROES) expect(h.game.heroSlots.map((c) => c.id)).not.toContain(id);
    for (let i = 0; i < 200; i++) expect(EXPANSION_HEROES).not.toContain(h.game.randomHero().id);
    const dis = new ClassicHeroesScene(h.game, () => {});
    for (const c of EXPANSION_HEROES.map(extra)) expect(labels(dis)).not.toContain(c.name);
    h.game.showTitle();
    const guide = new GuideIndexScene(h.game, () => {}, true);
    for (const c of EXPANSION_HEROES.map(extra)) expect(labels(guide)).not.toContain(c.name);
  });

  it('a link naming one (`?char=vicviper`) plays Mario', () => {
    const h = saved();
    const c1 = h.game.rosterFor(h.game.classicRules).find((c) => c.id === 'vicviper') as CharacterDef;
    expect(c1).toBeDefined();
    h.game.devClassicGame(c1, '1-1', h.game.classicRules, false);
    expect(h.game.liveRules).toBe('classic');
    expect(h.game.state.character.id).toBe('mario');
  });

  it('a Continue slot kept as Yoshi under Campaign rules goes on as Mario, Classic rules, power reset', () => {
    store.set(
      CLASSIC_RESUME_KEY,
      JSON.stringify({
        v: 1,
        levelId: '2-1',
        rules: 'current',
        hero: 'yoshi',
        score: 4200,
        coins: 17,
        lives: 4,
        world: 2,
        stage: 1,
        powerState: 'fire',
        hp: 3,
        kit: { bombs: 5 },
        warped: false,
        checkpoint: null,
      }),
    );
    const h = saved();
    expect(h.game.resumeClassic(F1)).toBe(true);
    expect(h.game.liveRules).toBe('classic');
    expect(h.game.state.character.id).toBe('mario');
    expect(h.game.state).toMatchObject({ score: 4200, coins: 17, lives: 4, world: 2, stage: 1 });
    expect(h.game.state.powerState).not.toBe('fire');
    expect(h.game.state.kit).not.toHaveProperty('bombs');
    // Its next WORLD card (after Continue's select, BUG-03) keeps it as the Classic-rules run it now is.
    pickAtContinue(h);
    h.until(() => loadClassicResume()?.rules === 'classic', 600);
    expect(loadClassicResume()).toMatchObject({ rules: 'classic', hero: 'mario' });
  });
});

describe('O-12 in developer mode', () => {
  it('no Classic rules row (BUG-11) and no Expansion heroes row (BUG-08); the saved values are ignored', () => {
    const h = saved(true);
    const o = new ClassicOptionsScene(h.game, () => {});
    expect(labels(o)).not.toContain('Classic rules');
    expect(labels(o)).not.toContain('Expansion heroes');
    expect(h.game.classicRules).toBe('classic');
    expect(h.settings.classicRules).toBe('current');
    // O-06: in dev mode an unreleased Expansion hero shows only with Dev > Classic heroes' On.
    for (const id of EXPANSION_HEROES) expect(h.game.expansionHeroOffered(id), id).toBe(false);
    h.settings.classicDev = { yoshiMount: false, heroesOff: [], heroesOn: [...EXPANSION_HEROES] };
    const slots = h.game.slotsFor('classic').map((c) => c.id);
    for (const id of EXPANSION_HEROES) expect(slots).toContain(id);
  });

  it('a Continue slot under Campaign rules goes on under them, its power kept', () => {
    store.set(
      CLASSIC_RESUME_KEY,
      JSON.stringify({
        v: 1,
        levelId: '2-1',
        rules: 'current',
        hero: 'mario',
        score: 1,
        coins: 1,
        lives: 4,
        world: 2,
        stage: 1,
        powerState: 'fire',
        hp: 3,
        kit: {},
        warped: false,
        checkpoint: null,
      }),
    );
    const h = saved(true);
    expect(h.game.resumeClassic(F1)).toBe(true);
    expect(h.game.liveRules).toBe('current');
    expect(h.game.state.powerState).toBe('fire');
  });
});
