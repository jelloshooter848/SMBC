import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Action } from '@engine/input/actions';
import type { Scene } from '@engine/scene';
import type { Announcer } from '@engine/a11y/announcer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { CHARACTERS } from '@game/characters/registry';
import { TopDownBot } from '@game/topdown/bot';
import type { MiniGameResult } from '../types';
import { LINK_MINIGAME } from '.';
import { ShadowKeepScene } from './keep';
import { KEEP_PLAN } from './bot-plan';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

function setup(opts: { keep?: boolean; seed?: number } = {}) {
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
  const below: Scene = { update() {}, render() {} };
  game.scenes.push(below);
  const results: MiniGameResult[] = [];
  const done = (r: MiniGameResult) => {
    results.push(r);
    if (!opts.keep) game.scenes.pop();
  };
  const scene =
    opts.seed === undefined
      ? (LINK_MINIGAME.create(game, done) as ShadowKeepScene)
      : new ShadowKeepScene(game, done, { seed: opts.seed });
  game.scenes.push(scene);
  const input = new ScriptedInput({ steps: [] });
  const step = (held: Action[] = []) => {
    input.setHeld(held);
    input.next();
    game.scenes.update([input]);
  };
  return { game, scene, below, results, said, step, world: scene.world };
}

describe('Shadow Keep: a full run', () => {
  it('the bot escapes the keep: pass', () => {
    const h = setup();
    const bot = new TopDownBot(KEEP_PLAN);
    const rooms: string[] = [];
    for (let i = 0; i < 30000 && h.results.length === 0; i++) {
      h.step(bot.next(h.world));
      if (rooms[rooms.length - 1] !== h.world.room.id) rooms.push(h.world.room.id);
    }
    console.log(rooms.join(' '), h.world.hero.hp, h.world.frame);
    expect(h.results).toEqual(['pass']);
  });
});
