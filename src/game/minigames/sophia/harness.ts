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
import { SOPHIA_MINIGAME } from '.';
import { UnderworldScene, type UnderworldOptions } from './scene';
import { HumanJason, UNDERWORLD_PLAN, type HumanOptions } from './bot';

/*
 * Test support for Underworld (not shipped code paths): a real Game with the round pushed over a
 * stand-in level scene, as the unlock flow does; the bots run the tests and the sims.
 */

export interface HarnessOptions extends UnderworldOptions {
  /** Leave the scene on top when it reports (the flow is slow to pop it). */
  keep?: boolean;
  assets?: AssetRegistry;
  reduceFlashing?: boolean;
  /** The controls in use (Game deps.controlScheme); the keyboard by default. */
  scheme?: ControlScheme;
}

export function underworldHarness(opts: HarnessOptions = {}) {
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
  const custom =
    opts.seed !== undefined ||
    opts.skipCutscene !== undefined ||
    opts.startInArea !== undefined ||
    opts.startInBoss !== undefined ||
    opts.tankHero !== undefined;
  const scene = custom
    ? new UnderworldScene(game, done, opts)
    : (SOPHIA_MINIGAME.create(game, done) as UnderworldScene);
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
  return { game, scene, below, results, said, log, step, tap, td: scene.td };
}

export type UnderworldHarness = ReturnType<typeof underworldHarness>;

/** One round played by a human-ish bot from the dungeon's first frame: how it ended and what it cost. */
export function botRun(opts: Partial<HumanOptions> = {}, max = 30000) {
  const h = underworldHarness({ seed: opts.seed ?? 1, skipCutscene: true });
  const bot = new HumanJason(UNDERWORLD_PLAN, opts);
  const td = h.td;
  const deaths: { room: string; doing: string }[] = [];
  const rooms = new Set<string>();
  let lost = 0;
  let bossLost = 0;
  let hp = td.hero.hp;
  let topGun = td.jason.gun;
  let gunAtBoss: number | null = null;
  let frames = 0;
  for (; frames < max && h.results.length === 0; frames++) {
    const wasDying = td.hero.dying > 0;
    h.step(bot.next(td));
    rooms.add(td.room.id);
    if (!wasDying && td.hero.dying > 0) deaths.push({ room: td.room.id, doing: bot.doing });
    const now = td.hero.hp;
    if (now < hp) {
      lost += hp - now;
      if (td.room.id === 'guardian') bossLost += hp - now;
    }
    hp = now;
    topGun = Math.max(topGun, td.jason.gun);
    if (gunAtBoss === null && h.scene.guardian?.phase === 'shell') gunAtBoss = td.jason.gun;
  }
  const boss = h.scene.guardian;
  return {
    result: h.results[0] ?? 'timeout',
    phase: h.scene.phase,
    frames,
    seconds: Math.round(frames / 60),
    room: td.room.id,
    rooms: [...rooms],
    deaths,
    lost,
    bossLost,
    topGun,
    gunAtBoss,
    bossPhase: boss?.phase ?? null,
    bossHp: boss?.hp ?? null,
    lives: h.scene.lives,
    doing: bot.doing,
  };
}
