import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { SOPHIA } from '@game/characters/sophia';
import { sophiaState } from '@game/characters/sophia/state';
import { tileAt } from '@engine/math/units';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';

/*
 * Random play (the 0.4.11 review's fuzz): Sophia III, with the Flower or the Mushroom, mashing
 * held inputs for a while in every bundled level. She must never end up inside solid tiles (a
 * quarter-pixel of slack each side) for 20 frames running. FUZZ_SEEDS=9 FUZZ_FRAMES=2000 widens it.
 */

const ACTS: Action[][] = [
  ['right'],
  ['left'],
  ['right', 'up'],
  ['left', 'up'],
  ['right', 'down'],
  ['left', 'down'],
  ['jump'],
  ['jump', 'right'],
  ['jump', 'left'],
  ['up'],
  ['down'],
  ['down', 'jump'],
  ['up', 'jump', 'right'],
  ['up', 'jump', 'left'],
  [],
  ['select'],
  ['attack'],
];

function stuckIn(w: World): boolean {
  const b = w.player.body;
  for (let ty = tileAt(b.y + 64); ty <= tileAt(b.y + b.h - 65); ty++)
    for (let tx = tileAt(b.x + 64); tx <= tileAt(b.x + b.w - 65); tx++)
      if (w.map.isSolid(tx, ty)) return true;
  return false;
}

/** One random run: the first moment she has been inside a solid tile for 20 frames, if ever. */
export function fuzz(id: string, seed: number, frames: number, power: string): string | null {
  let s = seed * 7919 + id.length * 31;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let cur: Action[] = [];
  let left = 0;
  let inside = 0;
  let worst: string | null = null;
  runSim({
    level: getLevel(id),
    character: SOPHIA,
    script: { steps: [] },
    maxFrames: frames,
    seed,
    assist: { invulnerable: true },
    state: { powerState: power },
    until: () => worst !== null,
    controller: (w, f) => {
      if (left-- <= 0) {
        cur = ACTS[Math.floor(rnd() * ACTS.length)] as Action[];
        left = 5 + Math.floor(rnd() * 60);
        if (cur.includes('select') && rnd() < 0.7) cur = ['right'];
      }
      const p = w.player;
      const st = sophiaState(p);
      const busy = w.inPipe || p.dead || p.frozen || p.hidden || st.turn !== null;
      if (!busy && stuckIn(w)) {
        if (++inside === 20) {
          const b = p.body;
          worst = `${id}/s${seed} f${f} x=${(b.x / 4096).toFixed(2)} y=${(b.y / 4096).toFixed(2)} w=${b.w / 256} surf=${st.surface}${st.jason ? ' jason' : ''}${st.nose ? ' nose' : ''}`;
        }
      } else inside = 0;
      return f % 3 === 0 && cur.includes('jump') ? cur.filter((a) => a !== 'jump') : cur;
    },
  });
  return worst;
}

describe('Sophia III never ends up inside solid tiles (random play, every level)', () => {
  it('Crusher and Hyper, every bundled level', () => {
    const seeds = Number(process.env.FUZZ_SEEDS ?? 1);
    const frames = Number(process.env.FUZZ_FRAMES ?? 1200);
    const bad: string[] = [];
    for (const id of levelIds())
      for (let seed = 1; seed <= seeds; seed++) {
        const res = fuzz(id, seed, frames, seed % 3 === 0 ? 'big' : 'fire');
        if (res) bad.push(res);
      }
    expect(bad).toEqual([]);
  }, 1_000_000);
});
