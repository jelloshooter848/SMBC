import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { CLASSIC_EXTRAS, EXPANSION_HEROES } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { ClassicHeroesScene } from '@game/scenes/disable-heroes';
import { GuideIndexScene } from '@game/scenes/guide';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { fillAbilities } from '@game/tutorial/original-tutorials';
import { makeGame, useStorage } from './heroes-harness';

// 0.4.72 review fix 3: dev mode's other hero lists follow the dev select (every hero not set Off):
// Disable heroes, How to play during a Classic run, and the tutorial's "Mario, Luigi and Yoshi"
// line. Outside dev mode they keep the release rule.

useStorage();

const labels = (s: unknown) => (s as { items: MenuItem[] }).items.map((i) => i.label);
const name = (id: string) => (CLASSIC_EXTRAS.find((d) => d.id === id) as CharacterDef).name;
const STOMP = 'Note that [[!yoshi|Mario and Luigi]][[yoshi|Mario, Luigi and Yoshi]] are the only';

function game(dev: boolean) {
  const settings: Settings = { ...defaultSettings(), dev };
  return makeGame({ deps: { settings, applySettings: () => {} } });
}

describe('0.4.72 review fix 3: dev lists match the dev select', () => {
  it('Disable heroes lists every hero the dev select shows, so each can be turned off', () => {
    const on = labels(new ClassicHeroesScene(game(true).game, () => {}));
    for (const id of EXPANSION_HEROES) expect(on).toContain(name(id));
    const off = labels(new ClassicHeroesScene(game(false).game, () => {}));
    for (const id of EXPANSION_HEROES) expect(off).not.toContain(name(id));
  });

  it("How to play in a Classic run lists the select's heroes", () => {
    const h = game(true);
    h.game.classicGame(h.game.heroSlots[0]!, '1-1');
    h.until(() => h.top() instanceof LevelScene, 600);
    const g = labels(new GuideIndexScene(h.game, () => {}, true));
    for (const id of EXPANSION_HEROES) expect(g).toContain(name(id));
    const r = game(false);
    r.game.classicGame(r.game.heroSlots[0]!, '1-1');
    r.until(() => r.top() instanceof LevelScene, 600);
    const g0 = labels(new GuideIndexScene(r.game, () => {}, true));
    for (const id of EXPANSION_HEROES) expect(g0).not.toContain(name(id));
  });

  it('the stomp tutorial names Yoshi when the dev select has him', () => {
    const h = game(true);
    h.game.classicGame(h.game.heroSlots[0]!, '1-1');
    expect(fillAbilities(h.game, STOMP)).toMatch(/Mario, Luigi and Yoshi are/);
    h.game.deps.settings!.classicDev = { yoshiMount: false, heroesOff: ['yoshi'] };
    expect(fillAbilities(h.game, STOMP)).toMatch(/Mario and Luigi are/);
    const r = game(false);
    r.game.classicGame(r.game.heroSlots[0]!, '1-1');
    expect(fillAbilities(r.game, STOMP)).toMatch(/Mario and Luigi are/);
  });
});
