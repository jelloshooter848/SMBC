import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { PICK_SHOWS, pickPose, pickShowFrames } from '@game/scenes/pick-show';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// G-055: on Classic mode's select a picked hero acts out its move (CharacterSelect.as 55, 189;
// each hero's chooseCharacter) and the select waits its CHAR_SEL_END_DUR before the game goes on.
// A fresh OK or BACK press skips the wait. The campaign's select is unchanged.

useStorage();
afterEach(() => store.clear());

function classic(over: Partial<Settings> = {}): H {
  const settings = { ...defaultSettings(), ...over };
  return makeGame({ deps: { settings, applySettings: () => {} } });
}

function selectSimon(h: H): CharacterSelectScene {
  h.game.classicSelect('1-1', () => h.game.showClassicMenu());
  const sel = h.top() as CharacterSelectScene;
  h.idle(12);
  for (let i = 0; i < 12 && sel.chars[(sel as unknown as { index: number }).index]?.id !== 'simon'; i++)
    h.tap('right');
  return sel;
}

describe('G-055 pick performances', () => {
  it("every original hero has its move and the original's wait", () => {
    expect(Object.keys(PICK_SHOWS)).toEqual([
      'mario',
      'luigi',
      'link',
      'samus',
      'simon',
      'megaman',
      'bass',
      'bill',
      'ryu',
      'sophia',
    ]);
    expect(pickShowFrames('mario')).toBe(102);
    expect(pickShowFrames('ryu')).toBe(114);
    expect(pickShowFrames('samus')).toBe(120);
  });

  it('the select waits through the performance, then the game goes on', () => {
    const h = classic();
    const sel = selectSimon(h);
    h.tap('jump');
    expect(sel.performing).toBe(true);
    expect(h.top()).toBe(sel);
    h.idle(pickShowFrames('simon') - 10);
    expect(h.top()).toBe(sel);
    h.until(() => h.top() instanceof LevelScene, 600);
    expect(h.game.state.character.id).toBe('simon');
  });

  it('a fresh press skips it', () => {
    const h = classic();
    const sel = selectSimon(h);
    h.tap('jump');
    expect(sel.performing).toBe(true);
    h.idle(12);
    h.tap('jump');
    expect(sel.performing).toBe(false);
  });

  it('Bill flashes, held steady with Reduce flashing; Mega Man beams away', () => {
    const flashes = [0, 4, 8, 12].map((t) => pickPose('flash', t, false).shown);
    expect(flashes).toContain(false);
    expect([0, 4, 8, 12].every((t) => pickPose('flash', t, true).shown)).toBe(true);
    expect(pickPose('teleport', 10, false).dy).toBe(0);
    expect(pickPose('teleport', 50, false).shown).toBe(false);
    expect(pickPose('raise', 10, false).pose).toBe('raise');
  });

  it('the campaign select picks at once', () => {
    const h = makeGame();
    h.game.showCharacterSelect();
    const sel = h.top() as CharacterSelectScene;
    expect(sel.classicLayout).toBe(false);
    expect(sel.performing).toBe(false);
  });
});
