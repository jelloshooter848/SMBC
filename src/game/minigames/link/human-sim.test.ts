import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Action } from '@engine/input/actions';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { CHARACTERS } from '@game/characters/registry';
import { CautiousBot, type CautiousOptions } from '@game/topdown/bot';
import type { MiniGameResult } from '../types';
import { ShadowKeepScene } from './keep';
import { KEEP_PLAN } from './bot-plan';

/** One round of the keep played by the cautious human; where it ended and how. */
export function cautiousRun(seed: number, opts: Partial<CautiousOptions> = {}, max = 20000) {
  const game = new Game({
    ctx: {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    },
    getLevel,
    characters: CHARACTERS,
  });
  game.scenes.push({ update() {}, render() {} });
  const results: MiniGameResult[] = [];
  const scene = new ShadowKeepScene(game, (r) => results.push(r), { seed });
  game.scenes.push(scene);
  const input = new ScriptedInput({ steps: [] });
  const bot = new CautiousBot(KEEP_PLAN, { seed, ...opts });
  let frames = 0;
  for (; frames < max && results.length === 0; frames++) {
    const held: Action[] = bot.next(scene.world);
    input.setHeld(held);
    input.next();
    game.scenes.update([input]);
  }
  return { result: results[0] ?? 'timeout', room: scene.world.room.id, frames, hp: scene.world.hero.hp };
}

/** Pass rate of the cautious human over seeds 1..n. */
export function cautiousPassRate(n: number, opts: Partial<CautiousOptions> = {}) {
  const runs = Array.from({ length: n }, (_, i) => cautiousRun(i + 1, opts));
  const passed = runs.filter((r) => r.result === 'pass').length;
  return { rate: passed / n, runs };
}

describe('Shadow Keep: a cautious human (difficulty)', () => {
  // KEEP_SIM=40 pnpm vitest run human-sim prints a fuller report.
  const n = Number(process.env.KEEP_SIM ?? 0);
  it.runIf(n > 0)(
    'reports the pass rate',
    () => {
      for (const reaction of [12, 15, 18]) {
        const { rate, runs } = cautiousPassRate(n, { reaction });
        const fails: Record<string, number> = {};
        for (const r of runs) {
          const k = `${r.result}@${r.room}`;
          if (r.result !== 'pass') fails[k] = (fails[k] ?? 0) + 1;
        }
        console.log(`reaction ${reaction}: pass ${(rate * 100).toFixed(0)}% of ${n}`, JSON.stringify(fails));
      }
      expect(n).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
