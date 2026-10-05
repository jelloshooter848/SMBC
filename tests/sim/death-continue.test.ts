import { describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { LevelScene } from '@game/scenes/level';
import { IntroScene } from '@game/scenes/intro';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { GameOverScene, GAME_OVER_CARD_FRAMES } from '@game/scenes/game-over';
import { TitleScene } from '@game/scenes/title';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { toPx } from '@engine/math/units';

// The original's death and game-over flow (Crossover 3.1.21):
// - a death with lives left: EventManager.checkGameOver → Level.reloadLevel →
//   ScreenManager.loadNewLevel (newLev = true) → createLevel → CharacterSelect, then the
//   pre-level card (InformativeBlackScreen SCREEN_TYPE_PRE_LEVEL), then the level at the checkpoint;
// - no lives left: ScreenManager.gameOver → the GAME OVER card, then CONTINUE with YES / NO
//   (InformativeBlackScreen.durTmrLsr / makeSelection). YES → EventManager.continueAfterDying
//   (StatManager.resetAllStats(false) + changeToFirstWorldLevel) → character select again;
//   NO → EventManager.restartGame (title).

function makeGame() {
  const said: string[] = [];
  const game = new Game({
    ctx: {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const step = (a1: Action[] = [], a2: Action[] = []) => {
    p1.setHeld(a1);
    p2.setHeld(a2);
    p1.next();
    p2.next();
    game.scenes.update([p1, p2]);
  };
  /** Press and release (two frames). */
  const tap = (a: Action, player = 0) => {
    step(player === 0 ? [a] : [], player === 1 ? [a] : []);
    step();
  };
  const idle = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  const until = (pred: () => boolean, max = 2000) => {
    for (let i = 0; i < max && !pred(); i++) step();
    expect(pred()).toBe(true);
  };
  return { game, said, step, tap, idle, until };
}

const top = (g: Game) => g.scenes.top;
const inLevel = (g: Game) => top(g) instanceof LevelScene;

/** Start a level through its intro card and kill player `i` (and the others in co-op). */
function playAndDie(h: ReturnType<typeof makeGame>, ids: number[] = [0]) {
  h.until(() => inLevel(h.game));
  const w = (top(h.game) as LevelScene).world;
  for (const i of ids) w.kill(w.players[i] ?? w.player);
  h.until(() => !inLevel(h.game), 400);
}

describe('death with lives left goes through character select', () => {
  it('keeps checkpoint, score, coins and level; preselects the hero; the picked hero starts small', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '1-1');
    const s = h.game.state;
    s.score = 1200;
    s.coins = 7;
    s.powerState = 'fire';
    s.checkpoint = { level: '1-1', x: 80 };
    playAndDie(h);
    expect(top(h.game)).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.state.lives).toBe(2);
    expect(h.said.some((t) => /choose your hero/i.test(t) && t.includes('Mario'))).toBe(true);
    // Mario is preselected: two steps right lands on Link (Mario, Luigi, Link...).
    h.idle(12);
    h.tap('right');
    h.tap('right');
    h.tap('jump');
    expect(top(h.game)).toBeInstanceOf(IntroScene); // the lives card follows the select
    const st = h.game.state;
    expect(st.character).toBe(LINK);
    expect(st.score).toBe(1200);
    expect(st.coins).toBe(7);
    expect(st.lives).toBe(2);
    expect(st.checkpoint).toEqual({ level: '1-1', x: 80 });
    expect(st.world).toBe(1);
    expect(st.stage).toBe(1);
    h.until(() => inLevel(h.game));
    const w = (top(h.game) as LevelScene).world;
    expect(w.player.def).toBe(LINK);
    expect(Math.round(toPx(w.player.body.x) / 16)).toBe(80);
  });

  it('confirming right away keeps the same hero, reset to small', () => {
    const h = makeGame();
    h.game.newGame(LUIGI, '1-1');
    h.game.state.powerState = 'big';
    playAndDie(h);
    h.idle(12);
    h.tap('start');
    expect(h.game.state.character).toBe(LUIGI);
    expect(h.game.state.powerState).toBe('small');
  });

  it('two players: only the player whose death ended the run picks; the other keeps theirs', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '1-1', LUIGI);
    h.until(() => inLevel(h.game));
    const w = (top(h.game) as LevelScene).world;
    // Player 2 falls while player 1 is already out, so player 2's death ends the attempt.
    w.players[0]!.out = true;
    w.players[0]!.hidden = true;
    w.kill(w.players[1]!);
    h.until(() => !inLevel(h.game), 400);
    const sel = top(h.game) as CharacterSelectScene;
    expect(sel).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    // Player 1's presses do nothing here.
    h.tap('right', 0);
    h.tap('jump', 0);
    expect(top(h.game)).toBe(sel);
    // Luigi is preselected for player 2; one step right is Link.
    h.tap('right', 1);
    h.tap('jump', 1);
    expect(top(h.game)).toBeInstanceOf(IntroScene);
    expect(h.game.state.character).toBe(MARIO);
    expect(h.game.state.character2).toBe(LINK);
  });

  it('a dev-mode start keeps the instant respawn', () => {
    const h = makeGame();
    h.game.devStart('1-1', MARIO, 'big');
    playAndDie(h);
    expect(top(h.game)).toBeInstanceOf(IntroScene);
  });

  it('an editor playtest still returns to the editor on death', () => {
    const h = makeGame();
    const done = vi.fn();
    h.game.playtest(getLevel('1-1'), done);
    const w = (top(h.game) as LevelScene).world;
    w.kill(w.player);
    h.until(() => done.mock.calls.length > 0, 400);
    expect(top(h.game)).toBeInstanceOf(LevelScene);
  });
});

describe('game over offers CONTINUE? YES / NO', () => {
  function toGameOver(level = '1-1') {
    const h = makeGame();
    h.game.newGame(MARIO, level);
    h.game.state.lives = 1;
    h.game.state.score = 5000;
    h.game.state.coins = 42;
    h.game.state.checkpoint = { level, x: 80 };
    playAndDie(h);
    expect(top(h.game)).toBeInstanceOf(GameOverScene);
    return h;
  }

  it('shows GAME OVER, then the prompt with YES selected; NO goes to the title', () => {
    const h = toGameOver();
    const go = top(h.game) as GameOverScene;
    expect(go.prompting).toBe(false);
    h.idle(GAME_OVER_CARD_FRAMES);
    expect(go.prompting).toBe(true);
    expect(go.yes).toBe(true);
    expect(h.said.some((t) => /continue\?/i.test(t))).toBe(true);
    h.tap('down');
    expect(go.yes).toBe(false);
    expect(h.said.at(-1)).toMatch(/^no/i);
    h.tap('up');
    expect(go.yes).toBe(true);
    h.tap('down');
    h.tap('jump');
    expect(top(h.game)).toBeInstanceOf(TitleScene);
  });

  it('START also confirms, and the card can be skipped to the prompt', () => {
    const h = toGameOver();
    const go = top(h.game) as GameOverScene;
    h.idle(61);
    h.tap('start');
    expect(go.prompting).toBe(true);
    h.idle(2);
    h.tap('start');
    expect(top(h.game)).toBeInstanceOf(CharacterSelectScene);
  });

  it('YES: character select, then the level from its start with 3 lives and no score or coins', () => {
    const h = toGameOver();
    h.idle(GAME_OVER_CARD_FRAMES);
    h.tap('jump');
    expect(top(h.game)).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('jump');
    expect(top(h.game)).toBeInstanceOf(IntroScene);
    const s = h.game.state;
    expect(s.character).toBe(MARIO);
    expect(s.lives).toBe(3);
    expect(s.score).toBe(0);
    expect(s.coins).toBe(0);
    expect(s.checkpoint).toBeNull();
    expect(s.powerState).toBe('small');
    h.until(() => inLevel(h.game));
    const scene = top(h.game) as LevelScene;
    expect(scene.level.id).toBe('1-1');
    expect(toPx(scene.world.player.body.x)).toBeLessThan(80);
  });

  it("YES later in a world goes back to the world's first level (StatManager.changeToFirstWorldLevel)", () => {
    const h = toGameOver('1-3');
    h.idle(GAME_OVER_CARD_FRAMES);
    h.tap('jump');
    h.idle(12);
    h.tap('jump');
    h.until(() => inLevel(h.game));
    expect((top(h.game) as LevelScene).level.id).toBe('1-1');
  });
});
