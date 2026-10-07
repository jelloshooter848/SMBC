import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import type { Action } from '@engine/input/actions';
import type { Scene } from '@engine/scene';
import type { Announcer } from '@engine/a11y/announcer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { CHARACTERS } from '@game/characters/registry';
import type { MiniGameResult } from '../types';
import { MEGAMAN_MINIGAME } from '.';
import { StationScene } from './scene';
import { StationBot, type CautiousOptions } from './bot';
import { WeaponCapsule } from './robots';

/*
 * Test support for Station Escape (not shipped code paths): a real Game with the round pushed over
 * a stand-in level scene, as the unlock flow does, and the bot runs the tests and the sim share.
 */

/** Audio that records what it was asked to play. */
export function recordingAudio() {
  const log = { music: [] as string[], sfx: [] as string[], jingles: [] as string[] };
  const audio: AudioSink = {
    ...NULL_AUDIO,
    playMusic: (id) => void log.music.push(id),
    playJingle: (id, onEnd) => {
      log.jingles.push(id);
      onEnd?.();
    },
    sfx: (id) => void log.sfx.push(id),
  };
  return { audio, log };
}

export interface HarnessOptions {
  /** Leave the scene on top when it reports (the flow is slow to pop it). */
  keep?: boolean;
  seed?: number;
  assets?: AssetRegistry;
}

/**
 * A real Game with the station pushed over a stand-in level scene; `done` records each result and
 * pops the scene (the flow's job) unless `keep` is set.
 */
export function stationHarness(opts: HarnessOptions = {}) {
  const said: string[] = [];
  const { audio, log } = recordingAudio();
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
  const scene =
    opts.seed === undefined
      ? (MEGAMAN_MINIGAME.create(game, done) as StationScene)
      : new StationScene(game, done, { seed: opts.seed });
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
  const play = (bot: StationBot, max = 20000) => {
    let i = 0;
    for (; i < max && results.length === 0; i++) step(bot.next(scene));
    return i;
  };
  return { game, scene, below, results, said, log, step, tap, play, world: scene.world };
}

export type StationHarness = ReturnType<typeof stationHarness>;

/**
 * One round played by a bot; how it ended and what it cost. `noSaw` takes the weapon capsule away
 * before the bot reaches it (the fight with the buster alone).
 */
export function botRun(opts: Partial<CautiousOptions> = {}, noSaw = false, max = 20000) {
  const h = stationHarness();
  const bot = new StationBot(opts);
  let lost = 0;
  let bossLost = 0;
  let hp = h.scene.player.hp;
  let frames = 0;
  for (; frames < max && h.results.length === 0; frames++) {
    if (noSaw) for (const e of h.world.entities) if (e instanceof WeaponCapsule) e.destroy();
    h.step(bot.next(h.scene));
    const now = h.scene.player.hp;
    if (now < hp) {
      lost += hp - now;
      if (h.scene.phase === 'fight' || h.scene.phase === 'dead') bossLost += hp - now;
    }
    hp = now;
  }
  const p = h.scene.player;
  return {
    result: h.results[0] ?? 'timeout',
    phase: h.scene.phase,
    frames,
    hp,
    lost,
    bossLost,
    bossHp: h.scene.boss?.hp ?? null,
    x: Math.round(p.body.x / 256),
    saw: (p.scratch.weapons ?? 0) >= 1,
  };
}
