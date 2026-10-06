import { describe, expect, it } from 'vitest';
import { CardScene, MessageScene } from '@game/scenes/message';
import { LevelScene } from '@game/scenes/level';
import { MirrorRaceScene, RaceMenuScene } from '@game/minigames/luigi/race';
import type { MiniGameResult } from '@game/minigames';
import { LUIGI } from '@game/characters/luigi';
import { loadSave } from '@game/save/save-files';
import {
  captives,
  file,
  intoBonus,
  makeGame,
  standByLuigi,
  talkIntoMiniGame,
  useStorage,
} from './heroes-harness';

// The unlock flow with Luigi's real mini game, the Mirror Race (the flow's own sims use a stub
// MiniGameDef: heroes.test.ts).

useStorage();

describe('freeing Luigi with the real Mirror Race', () => {
  it('talking starts the race; a win frees Luigi, saves the file and clears the room', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    standByLuigi(h, l);
    const race = talkIntoMiniGame(h, l);
    expect(race).toBeInstanceOf(MirrorRaceScene);
    h.idle(30);
    // Reported as the race does at its end (a full race is race.test.ts's business).
    (race as unknown as { finish(r: MiniGameResult): void }).finish('pass');
    expect(h.top()).toBeInstanceOf(CardScene);
    expect((h.top() as CardScene).lines).toContain('LUIGI IS FREE!');
    expect(h.game.freed).toContain('luigi');
    expect(loadSave(1)?.freed).toEqual(['mario', 'luigi']);
    h.idle(32);
    h.tap('jump');
    expect(h.top()).toBe(l);
    expect(captives(l)).toHaveLength(0);
    expect(h.game.heroLocked(LUIGI)).toBe(false);
  });

  it("Give up from the race's menu goes back to the level with Luigi still captive", () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    standByLuigi(h, l);
    const race = talkIntoMiniGame(h, l);
    expect(race).toBeInstanceOf(MirrorRaceScene);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(RaceMenuScene);
    h.idle(8);
    h.tap('down'); // Give up
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(LevelScene);
    expect(h.top()).toBe(l);
    expect(h.game.scenes.depth).toBe(1);
    expect(captives(l)).toHaveLength(1);
    expect(h.game.freed).toEqual(['mario']);
    expect(loadSave(1)?.freed).toEqual(['mario']);
    // The level plays on and Luigi can be challenged again.
    h.idle(5);
    h.tap('up');
    expect(h.top()).toBeInstanceOf(CardScene);
    expect(h.top()).not.toBeInstanceOf(MessageScene);
  });
});
