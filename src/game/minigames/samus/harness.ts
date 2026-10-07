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
import { SAMUS_MINIGAME } from '.';
import { EscapeScene, type EscapeOptions } from './scene';
import { MINI_LIVES } from '../lives';
import { EscapeBot, type CautiousOptions } from './bot';

/*
 * Test support for Zebes Escape (not shipped code paths): a real Game with the round pushed over
 * a stand-in level scene, as the unlock flow does, and the bot runs the tests and the sim share.
 */

export interface HarnessOptions extends EscapeOptions {
  /** Leave the scene on top when it reports (the flow is slow to pop it). */
  keep?: boolean;
  assets?: AssetRegistry;
}

/**
 * A real Game with the escape pushed over a stand-in level scene; `done` records each result and
 * pops the scene (the flow's job) unless `keep` is set.
 */
export function escapeHarness(opts: HarnessOptions = {}) {
  const said: string[] = [];
  const { audio, log } = recordingAudio();
  const tempo: number[] = [];
  audio.setTempoScale = (s: number) => void tempo.push(s);
  const game = new Game({
    ctx: {
      assets: opts.assets ?? new AssetRegistry({ default: {} }),
      audio,
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
  const custom: EscapeOptions = {};
  if (opts.seed !== undefined) custom.seed = opts.seed;
  if (opts.countdown !== undefined) custom.countdown = opts.countdown;
  const scene = Object.keys(custom).length
    ? new EscapeScene(game, done, custom)
    : (SAMUS_MINIGAME.create(game, done) as EscapeScene);
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
  /** Plays `bot` until the round reports (or `max` frames); the frames played. */
  const play = (bot: EscapeBot, max = 12000) => {
    let i = 0;
    for (; i < max && results.length === 0; i++) step(bot.next(scene));
    return i;
  };
  return {
    game,
    scene,
    below,
    results,
    said,
    log,
    tempo,
    step,
    tap,
    play,
    /** The life in play's World (a new one after each lost life). */
    get world() {
      return scene.world;
    },
  };
}

export type EscapeHarness = ReturnType<typeof escapeHarness>;

/** One round played by a bot: how it ended, the time left and what it cost. */
export function botRun(opts: Partial<CautiousOptions> = {}, max = 30000) {
  const h = escapeHarness();
  const bot = new EscapeBot(opts);
  let lost = 0;
  let hp = h.scene.player.hp;
  let frames = 0;
  for (; frames < max && h.results.length === 0; frames++) {
    h.step(bot.next(h.scene));
    const now = h.scene.player.hp;
    if (now < hp) lost += hp - now;
    hp = now;
  }
  const p = h.scene.player;
  return {
    result: h.results[0] ?? 'timeout',
    phase: h.scene.phase,
    frames,
    secondsLeft: h.scene.seconds,
    /** Lives lost on the way (3 on a game over). */
    livesLost: MINI_LIVES - h.scene.lives.lives,
    hp,
    lost,
    x: p.body.x >> 12,
    row: (p.body.y + p.body.h) >> 12,
    visited: bot.visited,
  };
}
