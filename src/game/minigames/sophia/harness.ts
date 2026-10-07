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
import { TankBot, type TankOptions } from './tankbot';

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

/** Which part of the round a run reached or ended in. */
export type RoundPart = 'cavern' | 'dungeon' | 'boss' | 'end';

/** The tank player that goes with a Jason profile: the same reactions, misjudging and pace. */
export function tankFor(opts: Partial<HumanOptions>): Partial<TankOptions> {
  const out: Partial<TankOptions> = { seed: opts.seed ?? 1 };
  if (opts.reaction !== undefined) out.reaction = opts.reaction;
  if (opts.aim !== undefined) out.misjudge = opts.aim + (opts.aim > 0 ? 2 : 0);
  if (opts.tapEvery !== undefined) out.tapEvery = opts.tapEvery;
  if (opts.hesitate !== undefined) out.hesitate = opts.hesitate;
  if (opts.reaction === 0) out.margin = 14;
  return out;
}

/**
 * One round played by a human-ish player: the tank's cavern (TankBot), Jason's dungeon
 * (HumanJason), the Plutonium Boss (TankBot), from the cavern's first frame (`full`) or the
 * dungeon's (the round without its tank sections). How it ended and what it cost.
 */
export function botRun(opts: Partial<HumanOptions> = {}, max = 40000, full = true) {
  const h = underworldHarness(
    full
      ? { seed: opts.seed ?? 1, startInArea: true }
      : { seed: opts.seed ?? 1, skipCutscene: true, tankHero: null },
  );
  const bot = new HumanJason(UNDERWORLD_PLAN, opts);
  const tank = new TankBot(tankFor(opts));
  const td = h.td;
  const deaths: { room: string; doing: string }[] = [];
  const rooms = new Set<string>();
  let lost = 0;
  let bossLost = 0;
  let hp = td.hero.hp;
  let topGun = td.jason.gun;
  let gunAtBoss: number | null = null;
  let frames = 0;
  let tankHits = 0;
  let tankState = '';
  const parts: Record<RoundPart, number> = { cavern: 0, dungeon: 0, boss: 0, end: 0 };
  for (; frames < max && h.results.length === 0; frames++) {
    const s = h.scene;
    const ph = s.phase;
    if (ph === 'area' || ph === 'boss') {
      const w = s.area;
      if (!w) {
        h.step();
        continue;
      }
      const p = w.player;
      const was = p.dead ? 'dead' : p.powerState;
      h.step(tank.next(w, ph === 'boss' ? s.plutonium : null));
      parts[ph === 'area' ? 'cavern' : 'boss']++;
      const now = p.dead ? 'dead' : p.powerState;
      if (now !== was && (now === 'dead' || (was === 'big' && now === 'small'))) {
        tankHits++;
        if (now === 'dead') deaths.push({ room: ph === 'area' ? 'cavern' : 'plutonium', doing: tank.doing });
      }
      tankState = now;
      continue;
    }
    if (ph !== 'dungeon') {
      h.step();
      if (ph === 'won') parts.end++;
      continue;
    }
    parts.dungeon++;
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
  const guardian = h.scene.guardian;
  const pluto = h.scene.plutonium;
  const s = h.scene;
  const where: RoundPart =
    s.phase === 'won' || s.phase === 'over'
      ? h.results[0] === 'pass'
        ? 'end'
        : s.plutonium
          ? 'boss'
          : s.area
            ? 'cavern'
            : 'dungeon'
      : s.phase === 'area'
        ? 'cavern'
        : s.phase === 'boss'
          ? 'boss'
          : 'dungeon';
  return {
    result: h.results[0] ?? 'timeout',
    phase: s.phase,
    where,
    frames,
    seconds: Math.round(frames / 60),
    parts,
    room: td.room.id,
    rooms: [...rooms],
    deaths,
    lost,
    bossLost,
    tankHits,
    tankState,
    topGun,
    gunAtBoss,
    bossPhase: guardian?.phase ?? null,
    bossHp: guardian?.hp ?? null,
    plutoPhase: pluto?.phase ?? null,
    plutoHp: pluto?.hp ?? null,
    lives: s.lives,
    doing: bot.doing,
  };
}
