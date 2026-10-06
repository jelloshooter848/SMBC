import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer } from '@engine/gfx/renderer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { CreditsScene, CREDITS, CREDITS_HOLD_FRAMES, CREDITS_TAIL } from '@game/scenes/credits';
import { IntroScene } from '@game/scenes/intro';
import { LevelScene } from '@game/scenes/level';
import { MessageScene } from '@game/scenes/message';
import { TitleScene } from '@game/scenes/title';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { loadProgress, LOST_LETTERS_GAMES, PROGRESS_KEY } from '@engine/save/progress';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';

// The game's endings. SMB 8-4: "Your quest is over." in the castle, then the credits
// (ScreenManager.startMoveCreditsTmrHandler / moveCreditsLoopTmrHandler / restartGameTmrHandler),
// then the title. The Lost Levels follow the NES rules (owner decision 2026-10-05): every 8-4
// clear counts a game beaten, worlds A-D open after 8, a warpless 8-4 goes on to World 9.

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

function makeGame() {
  const said: string[] = [];
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const audio = { ...NULL_AUDIO, stopMusic: vi.fn(), playMusic: vi.fn() };
  const game = new Game({
    ctx: { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const r = new NullRenderer();
  const step = (a: Action[] = []) => {
    p1.setHeld(a);
    p1.next();
    game.scenes.update([p1]);
    game.scenes.render(r);
  };
  return { game, said, audio, step, top: () => game.scenes.top };
}

describe('the credits roll', () => {
  const LINE = 12;
  // The closing lines start right below the credits, which start at the bottom of the screen,
  // and stop once their middle reaches the middle of the screen.
  const rise = 240 + CREDITS.length * LINE - (240 - CREDITS_TAIL.length * LINE) / 2;

  it('scrolls at 20 px/s (CREDITS_SPEED 40 Flash px/s) and ends 6.5 s after the closing lines stop', () => {
    const h = makeGame();
    const done = vi.fn();
    const credits = new CreditsScene(h.game, ['THANK YOU MARIO!', '', 'YOUR QUEST IS OVER.'], done);
    h.game.scenes.push(credits);
    expect(h.audio.playMusic).toHaveBeenCalledWith('credits');
    let frames = 0;
    while (!done.mock.calls.length && frames < 5000) {
      h.step();
      frames++;
    }
    expect(Math.abs(frames - (rise * 3 + CREDITS_HOLD_FRAMES))).toBeLessThanOrEqual(2);
  });

  it('Start fast-forwards ten times, and cuts the wait to a quarter', () => {
    const h = makeGame();
    const done = vi.fn();
    h.game.scenes.push(new CreditsScene(h.game, [], done));
    h.step(['start']);
    let frames = 1;
    while (!done.mock.calls.length && frames < 5000) {
      h.step();
      frames++;
    }
    expect(Math.abs(frames - (rise * 0.3 + CREDITS_HOLD_FRAMES / 4))).toBeLessThanOrEqual(2);
  });

  it('every line fits the screen', () => {
    for (const l of [...CREDITS, ...CREDITS_TAIL]) expect(l.length).toBeLessThanOrEqual(32);
  });

  it("after 8-4 the castle's lines scroll away with the credits, over the level", () => {
    const h = makeGame();
    h.game.newGame(MARIO, '8-4-end');
    for (let i = 0; i < 400 && !(h.top() instanceof LevelScene); i++) h.step();
    const level = h.top() as LevelScene;
    level.world.castleText = ['THANK YOU MARIO!', '', 'YOUR QUEST IS OVER.'];
    level.world.events.push({ type: 'exit', next: 'end' });
    h.step();
    const credits = h.top();
    expect(credits).toBeInstanceOf(CreditsScene);
    expect((credits as CreditsScene).translucent).toBe(true);
    expect(level.world.castleText).toEqual([]); // handed to the credits
    expect(h.said.at(-1)).toContain('YOUR QUEST IS OVER.');
    for (let i = 0; i < 5000 && !(h.top() instanceof TitleScene); i++) h.step();
    expect(h.top()).toBeInstanceOf(TitleScene);
  });
});

describe('Lost Levels endings (NES rules)', () => {
  it('a warpless 8-4 counts one game beaten, opens World 9 and goes on to 9-1', () => {
    const h = makeGame();
    h.game.newGame(MARIO, 'll-8-4');
    h.game.showEnding('ll-8-4');
    expect(h.top()).toBeInstanceOf(MessageScene);
    const p = loadProgress();
    expect(p.lost).toEqual({ world9: true, letters: false, beaten: 1 });
    expect(h.said.at(-1)).toContain('WORLD 9');
    expect(h.said.at(-1)).not.toContain('PRINCESS IS SAFE');
    for (let i = 0; i < 40; i++) h.step();
    h.step(['start']);
    expect(h.top()).toBeInstanceOf(IntroScene);
    expect(h.game.state.world).toBe(9);
  });

  it('a warped 8-4 counts too, ends the game and says why World 9 stays shut', () => {
    const h = makeGame();
    h.game.newGame(MARIO, 'll-8-4');
    h.game.state.warped = true;
    h.game.showEnding('ll-8-4');
    expect(loadProgress().lost).toEqual({ world9: false, letters: false, beaten: 1 });
    expect(h.said.at(-1)).toContain('WITHOUT WARP ZONES');
    for (let i = 0; i < 40; i++) h.step();
    h.step(['start']);
    expect(h.top()).toBeInstanceOf(TitleScene);
  });

  it(`worlds A-D open only after ${LOST_LETTERS_GAMES} games beaten`, () => {
    const h = makeGame();
    for (let n = 1; n <= LOST_LETTERS_GAMES; n++) {
      h.game.newGame(MARIO, 'll-8-4');
      h.game.state.warped = true;
      h.game.showEnding('ll-8-4');
      expect(loadProgress().lost.letters).toBe(n >= LOST_LETTERS_GAMES);
      expect(loadProgress().lost.beaten).toBe(n);
    }
    expect(h.said.at(-1)).toContain('WORLDS A-D ARE OPEN!');
  });

  it('a 0.2.1 file that had worlds A-D keeps them (beaten starts at 8), and the next save keeps it', () => {
    store.set(PROGRESS_KEY, JSON.stringify({ v: 1, lost: { world9: true, letters: true } }));
    expect(loadProgress().lost).toEqual({ world9: true, letters: true, beaten: LOST_LETTERS_GAMES });
    const h = makeGame();
    h.game.newGame(MARIO, 'll-8-4');
    h.game.state.warped = true;
    h.game.showEnding('ll-8-4');
    expect(loadProgress().lost).toEqual({ world9: true, letters: true, beaten: LOST_LETTERS_GAMES + 1 });
  });

  it('a 0.2.1 file without the unlock starts at 0, and a stored count is trusted', () => {
    store.set(PROGRESS_KEY, JSON.stringify({ v: 1, lost: { world9: true, letters: false } }));
    expect(loadProgress().lost).toEqual({ world9: true, letters: false, beaten: 0 });
    store.set(PROGRESS_KEY, JSON.stringify({ v: 1, lost: { world9: false, letters: true, beaten: 3 } }));
    expect(loadProgress().lost).toEqual({ world9: false, letters: false, beaten: 3 });
  });

  it.each([
    ['ll-9-4', 'WORLD 9 CLEARED!'],
    ['ll-13-4', 'WORLDS A-D CLEARED!'],
  ])('%s ends the game with its own card, then the title', (from, text) => {
    const h = makeGame();
    h.game.newGame(MARIO, from);
    h.game.showEnding(from);
    expect(h.said.at(-1)).toContain(text);
    expect(h.said.at(-1)).not.toContain('PRINCESS IS SAFE');
    expect(loadProgress().lost.beaten).toBe(0);
    for (let i = 0; i < 40; i++) h.step();
    h.step(['start']);
    expect(h.top()).toBeInstanceOf(TitleScene);
  });
});
