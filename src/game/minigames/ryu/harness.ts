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
import { RYU_MINIGAME } from '.';
import { DuelScene, type DuelOptions } from './scene';
import { DuelBot, type CautiousOptions } from './bot';
import { ArtScroll } from './creatures';
import { Pickup } from '../../entities/objects/pickup';
import { toPx } from '@engine/math/units';

/*
 * Test support for Shadow Duel (not shipped code paths): a real Game with the round pushed over a
 * stand-in level scene, as the unlock flow does, and the bot runs the tests and the sim share.
 */

export interface HarnessOptions extends DuelOptions {
  /** Leave the scene on top when it reports (the flow is slow to pop it). */
  keep?: boolean;
  assets?: AssetRegistry;
  reduceFlashing?: boolean;
  /** The controls in use (Game deps.controlScheme); the keyboard by default. */
  scheme?: ControlScheme;
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
    ...(opts.scheme ? { controlScheme: () => opts.scheme as ControlScheme } : {}),
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
  return {
    game,
    scene,
    below,
    results,
    said,
    log,
    step,
    tap,
    play,
    /** The current life's World (each life builds a new one). */
    get world() {
      return scene.world;
    },
  };
}

export type DuelHarness = ReturnType<typeof duelHarness>;

/** One round played by a bot: how it ended and what it cost. */
export function botRun(opts: Partial<CautiousOptions> = {}, max = 30000) {
  const h = duelHarness({ seed: opts.seed ?? 1, skipCutscene: true });
  const bot = new DuelBot(opts);
  // The lanterns it broke, by tile column (each leaves a drop: a pickup or the art's scroll).
  const broke = new Set<number>();
  const spawn = h.world.spawn.bind(h.world);
  h.world.spawn = (e) => {
    if (e instanceof Pickup || e instanceof ArtScroll) broke.add(toPx(e.body.x + (e.body.w >> 1)) >> 4);
    return spawn(e);
  };
  let lost = 0;
  let bossLost = 0;
  let hp = h.scene.player.hp;
  let frames = 0;
  let deaths = 0;
  for (; frames < max && h.results.length === 0; frames++) {
    const was = h.scene.phase;
    h.step(bot.next(h.scene));
    if (h.scene.phase === 'dead' && was !== 'dead') deaths++;
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
    /** Lives lost (of three). */
    deaths,
    bossHp: h.scene.boss ? h.scene.life.hp : null,
    x: p.body.x >> 12,
    row: (p.body.y + p.body.h) >> 12,
    fell: p.dead && p.body.y >> 8 > 240,
    reached: [...bot.reached],
    /** Arts in hand at the end (2: it took the windmill from the art lantern). */
    arts: p.scratch.arts ?? 1,
    broke: [...broke].sort((a, b) => a - b),
  };
}
