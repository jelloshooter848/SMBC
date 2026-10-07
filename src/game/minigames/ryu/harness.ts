import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import type { Action } from '@engine/input/actions';
import type { Scene } from '@engine/scene';
import type { Announcer } from '@engine/a11y/announcer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { CHARACTERS } from '@game/characters/registry';
import type { MiniGameResult } from '../types';
import { recordingAudio } from '../megaman/harness';
import { RYU_MINIGAME } from '.';
import { DuelScene, type DuelOptions } from './scene';
import { DuelBot, type CautiousOptions } from './bot';

/*
 * Test support for Shadow Duel (not shipped code paths): a real Game with the round pushed over a
 * stand-in level scene, as the unlock flow does, and the bot runs the tests and the sim share.
 */

export interface HarnessOptions extends DuelOptions {
  /** Leave the scene on top when it reports (the flow is slow to pop it). */
  keep?: boolean;
  assets?: AssetRegistry;
  reduceFlashing?: boolean;
}

export function duelHarness(opts: HarnessOptions = {}) {
  const said: string[] = [];
  const { audio, log } = recordingAudio();
  const game = new Game({
    ctx: {
      assets: opts.assets ?? new AssetRegistry({ default: {} }),
      audio,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: opts.reduceFlashing ?? true,
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
  const custom = opts.seed !== undefined || opts.skipCutscene !== undefined;
  const scene = custom ? new DuelScene(game, done, opts) : (RYU_MINIGAME.create(game, done) as DuelScene);
  game.scenes.push(scene);
  const input = new ScriptedInput({ steps: [] });
  const step = (held: Action[] = [], n = 1) => {
    for (let i = 0; i < n; i++) {
      input.setHeld(held);
      input.next();
      game.scenes.update([input]);
    }
  };
  const tap = (a: Action) => {
    step([a]);
    step();
  };
  const play = (bot: DuelBot, max = 30000) => {
    let i = 0;
    for (; i < max && results.length === 0; i++) step(bot.next(scene));
    return i;
  };
  return { game, scene, below, results, said, log, step, tap, play, world: scene.world };
}

export type DuelHarness = ReturnType<typeof duelHarness>;

/** One round played by a bot: how it ended and what it cost. */
export function botRun(opts: Partial<CautiousOptions> = {}, max = 30000) {
  const h = duelHarness({ seed: opts.seed ?? 1, skipCutscene: true });
  const bot = new DuelBot(opts);
  let lost = 0;
  let bossLost = 0;
  let hp = h.scene.player.hp;
  let frames = 0;
  for (; frames < max && h.results.length === 0; frames++) {
    h.step(bot.next(h.scene));
    const now = h.scene.player.hp;
    if (now < hp) {
      lost += hp - now;
      if (h.scene.boss) bossLost += hp - now;
    }
    hp = now;
  }
  const p = h.scene.player;
  return {
    result: h.results[0] ?? 'timeout',
    phase: h.scene.phase,
    frames,
    secondsLeft: h.scene.seconds,
    hp,
    lost,
    bossLost,
    bossHp: h.scene.boss ? h.scene.life.hp : null,
    x: p.body.x >> 12,
    row: (p.body.y + p.body.h) >> 12,
    fell: p.dead && p.body.y >> 8 > 240,
    reached: [...bot.reached],
  };
}
