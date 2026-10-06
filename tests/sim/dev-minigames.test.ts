import { describe, expect, it } from 'vitest';
import type { Scene } from '@engine/scene';
import { defaultSettings } from '@engine/save/settings';
import { MINIGAMES, type MiniGameDef } from '@game/minigames';
import { RaceMenuScene, MirrorRaceScene } from '@game/minigames/luigi/race';
import { DevMenuScene } from '@game/scenes/dev';
import { DevMiniGameResultScene, DevMiniGamesScene } from '@game/scenes/dev-minigames';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { PauseScene } from '@game/scenes/pause';
import { TitleScene } from '@game/scenes/title';
import { LUIGI } from '@game/characters/luigi';
import { MARIO } from '@game/characters/mario';
import { draw, file, makeGame, store, useStorage, type H } from './heroes-harness';

// Dev mode → Mini games: every hero's freeing mini game, one round straight from the dev menu,
// then PASS / FAIL / QUIT and back to the list. Nothing is saved; the music comes back.

useStorage();

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const pick = (h: H, label: string) => {
  const menu = h.top() as MenuScene;
  const row = items(menu).findIndex((i) => i.label === label);
  expect(row, label).toBeGreaterThanOrEqual(0);
  h.idle(8);
  for (let i = 0; i < row; i++) h.tap('down');
  h.tap('jump');
};

/** Title (dev mode on) → Dev mode → Mini games. */
function fromTitle(): H {
  const h = makeGame();
  h.game.deps.settings = { ...defaultSettings(), dev: true };
  h.game.showTitle();
  h.idle(8);
  expect(h.top()).toBeInstanceOf(TitleScene);
  pick(h, 'Dev mode');
  expect(h.top()).toBeInstanceOf(DevMenuScene);
  pick(h, 'Mini games');
  expect(h.top()).toBeInstanceOf(DevMiniGamesScene);
  return h;
}

/** Give up the Mirror Race from its own menu. */
function giveUp(h: H): void {
  h.idle(10);
  h.tap('start');
  expect(h.top()).toBeInstanceOf(RaceMenuScene);
  pick(h, 'Give up');
}

describe('Dev → Mini games', () => {
  it('lists every mini game by title and hero', () => {
    const h = fromTitle();
    const rows = items(h.top());
    const defs = Object.values(MINIGAMES);
    expect(rows.length).toBe(defs.length + 1);
    defs.forEach((d, i) => {
      expect(rows[i]?.label.toUpperCase()).toBe(d.title);
      expect(rows[i]?.value?.()).toBe(h.game.deps.characters.find((c) => c.id === d.hero)?.name);
    });
    expect(rows.at(-1)?.label).toBe('Back');
    const texts = draw(h.top() as Scene).texts.map((t) => t.str);
    expect(texts).toContain('MINI GAMES');
    expect(texts).toContain('MIRROR RACE');
  });

  it('plays a round; quitting shows QUIT, OK goes back to the list and the title music', () => {
    const h = fromTitle();
    const list = h.top() as DevMiniGamesScene;
    pick(h, 'Mirror race');
    expect(h.top()).toBeInstanceOf(MirrorRaceScene);
    giveUp(h);
    const card = h.top() as DevMiniGameResultScene;
    expect(card).toBeInstanceOf(DevMiniGameResultScene);
    expect(card.result).toBe('quit');
    h.idle(40);
    const texts = draw(card).texts.map((t) => t.str);
    expect(texts).toEqual(expect.arrayContaining(['MIRROR RACE', 'LUIGI', 'QUIT', 'PRESS OK (Z)']));
    expect(h.said.some((s) => s.startsWith('MIRROR RACE LUIGI QUIT'))).toBe(true);
    h.audio.playMusic.mockClear();
    h.tap('jump');
    expect(h.top()).toBe(list);
    expect(h.audio.playMusic).toHaveBeenLastCalledWith('title');
    // Back, and back again to the title.
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(DevMenuScene);
  });

  it('a lost race shows FAIL', () => {
    const h = fromTitle();
    pick(h, 'Mirror race');
    // Standing still, Luigi wins.
    h.until(() => h.top() instanceof DevMiniGameResultScene, 3000);
    expect((h.top() as DevMiniGameResultScene).result).toBe('fail');
  });

  it('never touches the save files or the game state, even when the round changes them', () => {
    const h = makeGame();
    h.game.deps.settings = { ...defaultSettings(), dev: true };
    // Even with a file open (the list is not offered there, but nothing may leak if it were).
    file({ freed: ['mario'] });
    h.game.openFile(1);
    h.idle(8);
    const campaign = h.game.campaign;
    expect(campaign).not.toBeNull();
    const saves = new Map(store);
    const state = h.game.state;
    const before = { ...state, kit: { ...state.kit } };
    const freed = h.game.freed.slice();
    const list = new DevMiniGamesScene(h.game);
    h.game.scenes.push(list);
    // A round that meddles: changes the run, frees its hero, and passes.
    const meddler: MiniGameDef = {
      hero: 'luigi',
      title: 'MEDDLER',
      rules: [],
      create(game, done) {
        let t = 0;
        return {
          update() {
            if (++t === 5) {
              game.state.score = 999;
              game.state.lives = 1;
              game.state.character = LUIGI;
              game.state.kit.x = 1;
              game.freeHero('luigi');
              game.autosave();
              done('pass');
            }
          },
          render() {},
        };
      },
    };
    list.play(meddler);
    h.until(() => h.top() instanceof DevMiniGameResultScene, 60);
    expect((h.top() as DevMiniGameResultScene).result).toBe('pass');
    expect(h.game.state).toBe(state);
    expect({ ...state, kit: { ...state.kit } }).toEqual(before);
    expect(state.character).toBe(MARIO);
    expect(h.game.freed).toEqual(freed);
    expect(h.game.celebrate.size).toBe(0);
    expect(new Map(store)).toEqual(saves);
    expect(h.game.campaign).toBe(campaign);
    h.idle(40);
    expect(draw(h.top() as Scene).texts.map((t) => t.str)).toContain('PASS');
  });

  it('a round that throws while being built leaves everything as it was, then rethrows', () => {
    const h = fromTitle();
    const list = h.top() as DevMiniGamesScene;
    const state = h.game.state;
    const before = { ...state, kit: { ...state.kit } };
    h.game.celebrate.add('link');
    const freed = h.game.freed.slice();
    const campaign = h.game.campaign;
    const broken: MiniGameDef = {
      hero: 'luigi',
      title: 'BROKEN',
      rules: [],
      create(game) {
        game.state.score = 5;
        game.state = { ...game.state, lives: 0 };
        game.freed.push('luigi');
        game.celebrate.clear();
        game.campaign = { slot: 2 };
        throw new Error('no course');
      },
    };
    h.audio.playMusic.mockClear();
    expect(() => list.play(broken)).toThrow('no course');
    expect(h.game.state).toBe(state);
    expect({ ...state, kit: { ...state.kit } }).toEqual(before);
    expect(h.game.freed).toEqual(freed);
    expect([...h.game.celebrate]).toEqual(['link']);
    expect(h.game.campaign).toBe(campaign);
    expect(h.top()).toBe(list);
    expect(h.audio.playMusic).toHaveBeenLastCalledWith('title');
    // The list still works.
    h.idle(4);
    expect(h.top()).toBe(list);
  });

  it('from pause → Dev mode in a level: the level music comes back, still paused', () => {
    const h = makeGame();
    h.game.deps.settings = { ...defaultSettings(), dev: true };
    h.game.devStart('1-1', MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene, 300);
    h.idle(10);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(PauseScene);
    pick(h, 'Dev mode');
    pick(h, 'Mini games');
    const list = h.top() as DevMiniGamesScene;
    expect(list.translucent).toBe(true);
    const resume = (h.game.ctx.audio.resume = vitestFn());
    const pause = (h.game.ctx.audio.pause = vitestFn());
    pick(h, 'Mirror race');
    // The pause menu had suspended the audio: the round plays with sound.
    expect(resume.calls).toBeGreaterThan(0);
    giveUp(h);
    h.idle(40);
    h.audio.playMusic.mockClear();
    pause.calls = 0;
    h.tap('jump');
    expect(h.top()).toBe(list);
    expect(h.audio.playMusic).toHaveBeenLastCalledWith('overworld');
    expect(pause.calls).toBeGreaterThan(0);
  });
});

/** A tiny call counter (the audio sink's methods are plain functions). */
function vitestFn(): (() => void) & { calls: number } {
  const f = (() => {
    f.calls++;
  }) as (() => void) & { calls: number };
  f.calls = 0;
  return f;
}
