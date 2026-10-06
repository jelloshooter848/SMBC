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
  let lost = 0;
  let bossLost = 0;
  let hp = scene.world.hero.hp;
  for (; frames < max && results.length === 0; frames++) {
    const held: Action[] = bot.next(scene.world);
    input.setHeld(held);
    input.next();
    game.scenes.update([input]);
    const now = scene.world.hero.hp;
    if (now < hp) {
      lost += hp - now;
      if (scene.world.room.id === 'keeper') bossLost += hp - now;
    }
    hp = now;
  }
  return { result: results[0] ?? 'timeout', room: scene.world.room.id, frames, hp, lost, bossLost };
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
  it('a cautious first-timer (late reactions, misjudged distances, pauses) usually escapes, and not unscathed', () => {
    const { rate, runs } = cautiousPassRate(6);
    expect(rate).toBeGreaterThanOrEqual(4 / 6);
    // Some effort: the keeper still costs hearts.
    expect(runs.reduce((a, r) => a + r.bossLost, 0)).toBeGreaterThan(6);
  }, 120_000);

  it.runIf(n > 0)(
    'reports the pass rate',
    () => {
      for (const reaction of [12, 15, 18, 21]) {
        const { rate, runs } = cautiousPassRate(n, { reaction });
        const fails: Record<string, number[]> = {};
        for (const [i, r] of runs.entries()) {
          const k = `${r.result}@${r.room}`;
          if (r.result !== 'pass') (fails[k] ??= []).push(i + 1);
        }
        const low = runs.filter((r) => r.result === 'pass' && r.hp <= 2).length;
        const avg = (k: 'lost' | 'bossLost') => (runs.reduce((a, r) => a + r[k], 0) / n / 2).toFixed(1);
        console.log(
          `reaction ${reaction}: pass ${(rate * 100).toFixed(0)}% of ${n}`,
          `(passes on a heart or less: ${low}; hearts lost: ${avg('lost')}, to the keeper: ${avg('bossLost')})`,
          JSON.stringify(fails),
        );
      }
      expect(n).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
