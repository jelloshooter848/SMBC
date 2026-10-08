import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { px } from '@engine/math/units';
import { LevelScene } from '@game/scenes/level';
import { WorldMapScene } from '@game/scenes/world-map';
import { CardScene } from '@game/scenes/message';
import { loadSave } from '@game/save/save-files';
import { miniGameFor } from '@game/minigames';
import { SAMUS_MINIGAME } from '@game/minigames/samus';
import { EscapeScene } from '@game/minigames/samus/scene';
import { EscapeBot } from '@game/minigames/samus/bot';
import {
  captives,
  file,
  makeGame,
  skipFreedTalk,
  talkIntoMiniGame,
  useStorage,
  type H,
} from './heroes-harness';

// Freeing Samus from the cavern below 4-2 (campaign play): talk to her on the dais, the dialogue
// and the rules card, then Zebes Escape itself, played to the ship by the escape's bot.

useStorage();

function intoCavern(h: H): LevelScene {
  h.game.openFile(1);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
  h.game.startLevel(getLevel('4-2-cavern'), { mode: 'fall', x: 2, y: 0, time: 300 });
  h.step();
  expect(h.top()).toBeInstanceOf(LevelScene);
  return h.top() as LevelScene;
}

/** Walks player 1 onto the dais beside Samus, until TALK shows. */
function bySamus(h: H, l: LevelScene): void {
  const p = l.world.player;
  h.until(() => p.body.onGround, 300);
  for (const x of [8, 16, 24, 32, 38]) {
    p.body.x = px(x * 16);
    p.body.y = px((x >= 36 ? 12 : 13) * 16) - p.body.h;
    h.idle(20);
  }
  const c = captives(l)[0];
  for (let i = 0; i < 120 && c && !c.prompt; i++) h.step(['right']);
  expect(c?.prompt).toBe(true);
}

describe('freeing Samus: the cavern → Zebes Escape', () => {
  it('Samus has her mini game', () => {
    expect(miniGameFor('samus')).toBe(SAMUS_MINIGAME);
  });

  it('talk → dialogue → rules → Zebes Escape → pass: Samus is free, saved and gone from the cavern', () => {
    const h = makeGame();
    file();
    const l = intoCavern(h);
    bySamus(h, l);
    const round = talkIntoMiniGame(h, l);
    expect(round).toBeInstanceOf(EscapeScene);
    const scene = round as EscapeScene;
    // The campaign's lives and score are the run's, not the escape's.
    const before = { lives: h.game.state.lives, score: h.game.state.score, hero: h.game.state.character.id };
    const bot = new EscapeBot();
    for (let i = 0; i < 9000 && h.top() === scene; i++) h.step(bot.next(scene));
    expect(h.top()).toBeInstanceOf(CardScene);
    skipFreedTalk(h); // the freed talk (0.4.23)
    expect((h.top() as CardScene).lines).toContain('SAMUS IS FREE!');
    expect(h.game.freed).toContain('samus');
    expect(loadSave(1)?.freed).toContain('samus');
    h.idle(32);
    h.tap('jump');
    expect(h.top()).toBe(l);
    h.idle(60);
    expect(captives(l)).toHaveLength(0);
    expect({ lives: h.game.state.lives, score: h.game.state.score, hero: h.game.state.character.id }).toEqual(
      before,
    );
  }, 120_000);

  it('giving up from the escape goes back to the cavern with Samus still there', () => {
    const h = makeGame();
    file();
    const l = intoCavern(h);
    bySamus(h, l);
    const round = talkIntoMiniGame(h, l);
    expect(round).toBeInstanceOf(EscapeScene);
    h.idle(10);
    h.tap('start');
    h.idle(8);
    h.tap('down');
    h.tap('jump'); // Give up
    for (let i = 0; i < 200 && h.top() !== l; i++) h.step();
    expect(h.top()).toBe(l);
    expect(h.game.freed).not.toContain('samus');
    expect(captives(l)).toHaveLength(1);
  });
});
