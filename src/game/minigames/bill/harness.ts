import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import type { Action } from '@engine/input/actions';
import type { Scene } from '@engine/scene';
import type { Announcer } from '@engine/a11y/announcer';
import { ScriptedInput } from '@game/sim/headless';
import { Game, type ControlScheme } from '@game/scenes/game';
import { CHARACTERS } from '@game/characters/registry';
import type { MiniGameResult } from '../types';
import { recordingAudio } from '../megaman/harness';
import { BILL_MINIGAME } from '.';
import { JungleScene, type JungleOptions } from './scene';
import { JungleBot, type BotOptions } from './bot';

/*
 * Test support for Jungle Assault (not shipped code paths): a real Game with the round pushed
 * over a stand-in level scene, as the unlock flow does; the bot runs the tests and the sims.
 */

export interface HarnessOptions extends JungleOptions {
  /** Leave the scene on top when it reports (the flow is slow to pop it). */
  keep?: boolean;
  assets?: AssetRegistry;
  reduceFlashing?: boolean;
  /** The controls in use (Game deps.controlScheme); the keyboard by default. */
  scheme?: ControlScheme;
}

export function jungleHarness(opts: HarnessOptions = {}) {
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
    ...(opts.scheme ? { controlScheme: () => opts.scheme as ControlScheme } : {}),
  });
  const below: Scene = { update() {}, render() {} };
  game.scenes.push(below);
  const results: MiniGameResult[] = [];
  const done = (r: MiniGameResult) => {
    results.push(r);
    if (!opts.keep) game.scenes.pop();
  };
  const custom = opts.seed !== undefined || opts.skipCard !== undefined;
  const scene = custom
    ? new JungleScene(game, done, opts)
    : (BILL_MINIGAME.create(game, done) as JungleScene);
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
  const play = (bot: JungleBot, max = 40000) => {
    let i = 0;
    for (; i < max && results.length === 0; i++) step(bot.next(scene));
    return i;
  };
  return { game, scene, below, results, said, log, step, tap, play, jungle: scene.jungle };
}

export type JungleHarness = ReturnType<typeof jungleHarness>;

/** One round played by a bot from the first frame of play: how it ended and what it cost. */
export function botRun(opts: Partial<BotOptions> = {}, max = 40000) {
  const h = jungleHarness({ seed: opts.seed ?? 1, skipCard: true });
  const bot = new JungleBot(opts);
  const j = h.jungle;
  const deaths: { x: number; phase: string; cause: string }[] = [];
  let frames = 0;
  const weapons = new Set<string>();
  for (; frames < max && h.results.length === 0; frames++) {
    const before = j.bill.deaths;
    h.step(bot.next(h.scene));
    if (j.bill.deaths > before)
      deaths.push({ x: Math.round(j.bill.x), phase: j.phase, cause: `${j.lastHit} (${bot.lastThreat})` });
    if (j.bill.gun !== 'default') weapons.add(j.bill.gun);
    if (j.bill.rapid) weapons.add('R');
    if (j.bill.barrier > 0) weapons.add('B');
  }
  return {
    result: h.results[0] ?? 'timeout',
    phase: j.phase,
    frames,
    seconds: Math.round(frames / 60),
    deaths,
    x: Math.round(j.bill.x),
    weapons: [...weapons].sort(),
    coreHp: j.core.hp,
    heartHp: j.heart.hp,
    stuck: bot.stuck,
    drops: bot.drops,
  };
}
