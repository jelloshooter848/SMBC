import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { defaultPower } from '@game/context';
import { CHARACTERS, CLASSIC_CHARACTERS } from '@game/characters/registry';
import { startHp, type CharacterDef } from '@game/characters/character';
import { LINK } from '@game/characters/link';
import { MARIO } from '@game/characters/mario';
import { reconcileRules } from '@game/rules/reconcile';
import { LevelScene } from '@game/scenes/level';
import { eraseClassicFile, loadClassicFile, type ClassicFileRef } from '@game/original-files';
import { loadSave, newSave, saveFromState, stateFromSave, writeSave } from '@game/save/save-files';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { pickAtContinue } from './continue-select';

// Item 25 (owner): when dev mode is turned off, nothing Toggle heroes' Plays as left behind
// stays. A Classic save file or a campaign file whose hero's power and kit were earned in a
// swapped design gets that hero's kit AND power back to his real design's start the next time it
// loads outside dev mode (before, only a power that did not fit was reset; the kit stayed).

useStorage();
afterEach(() => store.clear());

type G = H & { settings: Settings };
function game(dev: boolean, swap: Partial<Settings['classicDev']> = {}): G {
  const settings: Settings = { ...defaultSettings(), dev };
  settings.classicDev = { yoshiMount: false, heroesOff: [], ...swap };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}
const level = (h: H) => {
  h.until(() => h.top() instanceof LevelScene, 900);
  return h.top() as LevelScene;
};
const F1: ClassicFileRef = { set: 'smb', slot: 1 };
const CLASSIC_LINK = CLASSIC_CHARACTERS.link as CharacterDef;

describe('item 25: a Plays as kit is reset once dev mode is off', () => {
  it('Classic file: dev on, Link plays as Campaign, gains a kit, saves; dev off, load: kit and power reset', () => {
    const dev = game(true, { playsCampaign: ['link'] });
    dev.game.classicGame(LINK, '1-1', { ref: F1 });
    expect(level(dev).world.players[0]?.def).toBe(LINK);
    expect(dev.game.state.swapped).toBe(true);
    dev.game.state.kit = { bombs: 6, arrows: 9 };
    dev.game.state.hp = 2;
    dev.game.goToLevel('1-2', { mode: 'stand' });
    expect(loadClassicFile(F1)?.run).toMatchObject({ swapped: true, kit: { bombs: 6, arrows: 9 } });
    // Dev mode off: the same file, loaded again.
    const off = game(false);
    expect(off.game.resumeClassic(F1)).toBe(true);
    pickAtContinue(off);
    expect(level(off).world.players[0]?.def).toBe(CLASSIC_LINK);
    expect(off.game.state.kit).toEqual({});
    expect(off.game.state.powerState).toBe(defaultPower(CLASSIC_LINK));
    expect(off.game.state.hp).toBe(startHp(CLASSIC_LINK));
    expect(off.game.state.swapped).toBeUndefined();
    expect(off.said.some((s) => s.includes('Hero design changed. Power reset.'))).toBe(true);
    // Its next WORLD card writes the file without the mark.
    off.game.goToLevel('1-3', { mode: 'stand' });
    expect(loadClassicFile(F1)?.run.swapped).toBeUndefined();
  });

  it("Classic file: a put-away hero's swapped kit is dropped too when he is picked again", () => {
    const dev = game(true, { playsCampaign: ['link'] });
    dev.game.classicGame(LINK, '1-1', { ref: F1 });
    level(dev);
    dev.game.state.kit = { bombs: 6 };
    dev.game.setHero(0, CHARACTERS.find((c) => c.id === 'mario') as CharacterDef);
    expect(dev.game.classicKits.link).toMatchObject({ swapped: true, kit: { bombs: 6 } });
    dev.game.goToLevel('1-2', { mode: 'stand' });
    expect(loadClassicFile(F1)?.run.heroKits?.link?.swapped).toBe(true);
    const off = game(false);
    expect(off.game.resumeClassic(F1)).toBe(true);
    pickAtContinue(off);
    level(off);
    off.game.setHero(0, LINK);
    expect(off.game.state.kit).toEqual({});
    expect(off.game.state.powerState).toBe(defaultPower(CLASSIC_LINK));
  });

  it('while dev mode stays on with the swap, the kit is kept', () => {
    const dev = game(true, { playsCampaign: ['link'] });
    dev.game.classicGame(LINK, '1-1', { ref: F1 });
    level(dev);
    dev.game.state.kit = { bombs: 6 };
    dev.game.goToLevel('1-2', { mode: 'stand' });
    const again = game(true, { playsCampaign: ['link'] });
    expect(again.game.resumeClassic(F1)).toBe(true);
    pickAtContinue(again);
    level(again);
    expect(again.game.state.kit).toEqual({ bombs: 6 });
    expect(again.game.state.swapped).toBe(true);
  });

  it('campaign file: a Classic kit (Plays as Classic) saved with its mark is reset on load outside dev mode', () => {
    // Mario: a power both his designs have (fire), so the file's power loads and only the mark
    // tells the kit apart. (A hero whose designs share no power, as Link's, starts afresh anyway.)
    const dev = game(true, { playsClassic: ['mario'] });
    dev.game.devStart('1-1', MARIO, 'fire', false, 1);
    expect(level(dev).world.players[0]?.def).toBe(CLASSIC_CHARACTERS.mario);
    expect(dev.game.state.swapped).toBe(true);
    dev.game.state.kit = { stars: 2 };
    const saved = saveFromState(newSave(1, MARIO.id), dev.game.state);
    expect(saved.swapped).toBe(true);
    writeSave(saved);
    const back = loadSave(1);
    expect(back?.swapped).toBe(true);
    const off = game(false);
    off.game.state = stateFromSave(back!, off.game.deps.characters);
    expect(off.game.state).toMatchObject({ powerState: 'fire', kit: { stars: 2 }, swapped: true });
    reconcileRules(off.game, 'campaign');
    expect(off.game.state.kit).toEqual({});
    expect(off.game.state.powerState).toBe(defaultPower(MARIO));
    expect(off.game.state.swapped).toBeUndefined();
    // Saved again, the mark is gone.
    expect(saveFromState(back!, off.game.state)).not.toHaveProperty('swapped');
  });

  it('no swap: nothing is marked and nothing is reset (dev on or off)', () => {
    for (const dev of [true, false]) {
      const h = game(dev);
      // 31e: a new game starts only in an empty file (ERASE FILE first, as a player does).
      eraseClassicFile(F1);
      h.game.classicGame(MARIO, '1-1', { ref: F1 });
      level(h);
      h.game.state.kit = { x: 1 };
      reconcileRules(h.game, 'classic');
      expect(h.game.state.swapped).toBeUndefined();
      expect(h.game.state.kit).toEqual({ x: 1 });
      expect(saveFromState(newSave(1, MARIO.id), h.game.state)).not.toHaveProperty('swapped');
    }
  });
});
