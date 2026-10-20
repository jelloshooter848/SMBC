import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { CARD_GUARD_FRAMES, MessageScene } from '@game/scenes/message';
import { draw, makeGame, useStorage, type H } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// G-030: Classic mode's TIME UP card. In the original a death by the clock shows a black TIME UP
// screen (EventManager.dieDurTmrLsr -> ScreenManager.showTimeUpScreen, 2.5 s) before the lives
// card. Here it is read out and waits for OK (text never moves on by itself), then the death goes
// on as any other (Classic: character select). The campaign and free play have no such card.

isolateClassicRegistry({ hideExtras: true });
useStorage();

const classic = (): H => makeGame({ deps: { settings: { ...defaultSettings() }, applySettings: () => {} } });

function enterLevel(h: H): LevelScene {
  h.until(() => h.top() instanceof LevelScene, 600);
  return h.top() as LevelScene;
}

/** The clock's last second runs out in the level on top. */
function runOutOfTime(h: H): LevelScene {
  const l = enterLevel(h);
  l.world.time = 1;
  h.until(() => l.world.timedOut, 200);
  return l;
}

describe('G-030: TIME UP', () => {
  it('a Classic run: TIME UP on black, read out, waits for OK, then character select', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1');
    const l = runOutOfTime(h);
    expect(l.world.time).toBe(0);
    h.until(() => h.top() instanceof MessageScene, 600);
    const card = h.top() as MessageScene;
    expect(draw(card).texts.map((t) => t.str)).toContain('TIME UP');
    expect(h.said.at(-1)).toMatch(/^Time up! PRESS OK/);
    expect(h.said.at(-1)).not.toMatch(/\b(press|push)\s+[abc]\b/i);
    // It never moves on by itself.
    h.idle(600);
    expect(h.top()).toBe(card);
    h.tap('jump');
    expect(h.top()).not.toBe(card);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.state.lives).toBe(2);
  });

  it('a death that is not the clock has no TIME UP card', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1');
    const w = enterLevel(h).world;
    w.kill(w.player);
    h.until(() => !(h.top() instanceof LevelScene), 400);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  });

  it('free play (not Classic mode) keeps the plain death', () => {
    const h = classic();
    h.game.newGame(MARIO, '1-1');
    runOutOfTime(h);
    h.until(() => !(h.top() instanceof LevelScene), 600);
    expect(h.top()).not.toBeInstanceOf(MessageScene);
  });

  it('the guard: a press held from the level does not skip it', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1');
    runOutOfTime(h);
    h.until(() => h.top() instanceof MessageScene, 600);
    const card = h.top();
    h.tap('jump');
    expect(h.top()).toBe(card);
    h.idle(CARD_GUARD_FRAMES);
    h.tap('start');
    expect(h.top()).not.toBe(card);
  });
});
