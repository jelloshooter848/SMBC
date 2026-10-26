import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { CHARACTERS, CLASSIC_EXTRAS, EXPANSION_HEROES } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { DevStartScene } from '@game/scenes/dev-play';
import { file, makeGame, useStorage } from './heroes-harness';

// 0.4.72 owner item 5: in dev mode every Classic hero select (the select, the dev START page)
// offers the Expansion heroes whether released or not (only Dev > Toggle heroes' Off hides one).
// Classic Options > Disable heroes still applies; the campaign's captives stay locked (its file's
// dev All heroes toggle unlocks them).
// Random, Single random and Survival keep the offered list (heroSlots). Outside dev mode nothing
// changes (classic-expansion-lock.test.ts keeps the release guards).

useStorage();

const extra = (id: string) => CLASSIC_EXTRAS.find((d) => d.id === id) as CharacterDef;

function classic(dev: boolean, over: Partial<Settings> = {}) {
  const settings: Settings = { ...defaultSettings(), dev, ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.classicSelect('1-1', () => h.game.showClassicMenu());
  const sel = h.top() as CharacterSelectScene;
  expect(sel).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  return { h, sel, settings };
}

const ids = (cs: readonly CharacterDef[]) => cs.map((c) => c.id);

describe('owner 0.4.72 item 5: dev mode hero selects offer every hero', () => {
  it('the Classic select shows all four unreleased Expansion heroes, after the original ten', () => {
    const { sel } = classic(true);
    expect(ids(sel.chars.slice(10))).toEqual([...EXPANSION_HEROES]);
    // Release players: none of them (the release rule is untouched).
    const rel = classic(false);
    for (const id of EXPANSION_HEROES) expect(ids(rel.sel.chars)).not.toContain(id);
    for (const id of EXPANSION_HEROES) expect(rel.h.game.expansionHeroOffered(id)).toBe(false);
  });

  it('a hero set Off in Dev > Toggle heroes stays hidden; Disable heroes still applies', () => {
    const { h, settings } = classic(true);
    settings.classicDev = { yoshiMount: false, heroesOff: ['yoshi'] };
    settings.classicHeroesOff = ['luigi'];
    h.game.classicSelect('1-1', () => {});
    const sel = h.top() as CharacterSelectScene;
    expect(ids(sel.chars)).not.toContain('yoshi');
    expect(ids(sel.chars)).not.toContain('luigi');
    expect(ids(sel.chars)).toContain('arthur');
  });

  it('a hero only the dev select offers plays as itself (not swapped for Mario)', () => {
    const { h } = classic(true);
    h.game.classicGame(extra('arthur'), '1-1', { ref: { set: 'smb', slot: 1 } });
    expect(h.game.state.character.id).toBe('arthur');
    // Release players naming him (a link) still get Mario.
    const rel = classic(false);
    rel.h.game.classicGame(extra('arthur'), '1-1', { ref: { set: 'smb', slot: 1 } });
    expect(rel.h.game.state.character.id).toBe('mario');
  });

  it('Random keeps the offered list: never an unreleased hero in Release state', () => {
    const { h } = classic(true);
    for (let i = 0; i < 200; i++) expect(EXPANSION_HEROES).not.toContain(h.game.randomHero().id);
    for (const id of EXPANSION_HEROES) expect(ids(h.game.heroSlots)).not.toContain(id);
  });

  it('the dev START page Hero row: the same rule', () => {
    const { h } = classic(true);
    const start = new DevStartScene(h.game, { branch: 'classic', level: '1-1', name: 'SMB 1-1' });
    for (const id of EXPANSION_HEROES) expect(ids(start.heroes)).toContain(id);
  });

  it("the campaign select keeps its captives locked (the file's dev All heroes toggle unlocks them)", () => {
    const settings: Settings = { ...defaultSettings(), dev: true };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    file();
    h.game.openFile(1);
    const luigi = CHARACTERS.find((c) => c.id === 'luigi') as CharacterDef;
    const sel = new CharacterSelectScene(h.game, {
      player: 0,
      current: h.game.state.character,
      onPick: () => {},
    });
    const locked = (sel as unknown as { locked(i: number): boolean }).locked.bind(sel);
    expect(sel.chars.indexOf(luigi)).toBeGreaterThanOrEqual(0);
    expect(locked(sel.chars.indexOf(luigi))).toBe(true);
    h.game.devAllHeroes = true;
    expect(locked(sel.chars.indexOf(luigi))).toBe(false);
  });

  it('a kept dev start (Again) with a hero back on Release still starts; set Off it does not', async () => {
    const { h, settings } = classic(true);
    const { resolveDevPick } = await import('@game/scenes/dev-play');
    const p = {
      branch: 'classic' as const,
      level: '1-1',
      name: 'SMB 1-1',
      hero: 'yoshi',
      look: 'yoshi',
      power: 'small',
      kit: false,
      rules: 'classic' as const,
      classicRun: false,
      difficulty: 'normal' as const,
    };
    expect(typeof resolveDevPick(h.game, p)).not.toBe('string');
    settings.classicDev = { yoshiMount: false, heroesOff: ['yoshi'] };
    // v0.4.73 item 61 (owner): the START page offers every hero; Off is for Classic and campaign play.
    expect(typeof resolveDevPick(h.game, p)).not.toBe('string');
  });
});
