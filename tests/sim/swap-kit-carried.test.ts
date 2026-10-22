import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { LINK } from '@game/characters/link';
import { LevelScene } from '@game/scenes/level';
import type { ClassicFileRef } from '@game/original-files';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// 36b (v0.4.71, dev only): turning a Toggle heroes "Plays as" swap on mid-run and then off again
// gives the hero back the real design's kit he carried into the swap; only what was gained while
// swapped goes (before, the whole kit was reset).

useStorage();
afterEach(() => store.clear());

const F1: ClassicFileRef = { set: 'smb', slot: 1 };
function game(): H & { settings: Settings } {
  const settings: Settings = { ...defaultSettings(), dev: true };
  settings.classicDev = { yoshiMount: false, heroesOff: [] };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}
const play = (h: H, id: string) => {
  h.game.goToLevel(id, { mode: 'stand' });
  h.until(() => h.top() instanceof LevelScene, 900);
};

describe('36b: a swap on and off mid-run keeps the kit carried into it', () => {
  it('Link carries bombs into the swap, gains arrows in it; off again: his bombs, no arrows', () => {
    const h = game();
    h.game.classicGame(LINK, '1-1', { ref: F1 });
    h.until(() => h.top() instanceof LevelScene, 900);
    expect(h.game.state.swapped).toBeUndefined();
    h.game.state.kit = { bombs: 3 };
    // Plays as Campaign turned on: the next level start marks the swap.
    h.settings.classicDev = { ...h.settings.classicDev, playsCampaign: ['link'] };
    play(h, '1-2');
    expect(h.game.state.swapped).toBe(true);
    expect(h.game.state.kit).toEqual({ bombs: 3 });
    h.game.state.kit = { bombs: 1, arrows: 5 };
    // Off again: the kit he carried in comes back; what the swap gained goes.
    h.settings.classicDev = { ...h.settings.classicDev, playsCampaign: [] };
    h.said.length = 0;
    play(h, '1-3');
    expect(h.game.state.swapped).toBeUndefined();
    expect(h.game.state.kit).toEqual({ bombs: 3 });
    expect(h.said.some((s) => s.includes('Hero design changed.'))).toBe(true);
    // Nothing of the swap is left in the state.
    expect(h.game.state).not.toHaveProperty('swapKit');
  });

  it('a swap from the very start carried nothing in: off again, the kit is empty (as before)', () => {
    const h = game();
    h.settings.classicDev = { ...h.settings.classicDev, playsCampaign: ['link'] };
    h.game.classicGame(LINK, '1-1', { ref: F1 });
    h.until(() => h.top() instanceof LevelScene, 900);
    expect(h.game.state.swapped).toBe(true);
    h.game.state.kit = { arrows: 5 };
    h.settings.classicDev = { ...h.settings.classicDev, playsCampaign: [] };
    play(h, '1-2');
    expect(h.game.state.kit).toEqual({});
  });

  it('staying swapped across levels keeps the first carried kit, not a later one', () => {
    const h = game();
    h.game.classicGame(LINK, '1-1', { ref: F1 });
    h.until(() => h.top() instanceof LevelScene, 900);
    h.game.state.kit = { bombs: 2 };
    h.settings.classicDev = { ...h.settings.classicDev, playsCampaign: ['link'] };
    play(h, '1-2');
    h.game.state.kit = { bombs: 9, arrows: 9 };
    play(h, '1-3');
    expect(h.game.state.kit).toEqual({ bombs: 9, arrows: 9 });
    h.settings.classicDev = { ...h.settings.classicDev, playsCampaign: [] };
    play(h, '1-4');
    expect(h.game.state.kit).toEqual({ bombs: 2 });
  });
});
