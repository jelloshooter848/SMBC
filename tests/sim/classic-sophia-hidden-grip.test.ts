import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { SOPHIA } from '@game/characters/sophia';
import { sophiaState, CEIL } from '@game/characters/sophia/state';
import { T } from '@game/level/tiles';
import type { World } from '@game/world/world';

/*
 * v0.4.73 item 59: a Crusher jump whose head strikes a brick and a hidden block in one move must
 * not grip the brick. The hidden block only exists for heads, so it is bumped (revealed) instead,
 * as a jump under a hidden block alone always did.
 */

const W = 32;
function level(row8: string, startX: number) {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(W));
  rows[8] = row8;
  return parseTextMap(
    ['id: t', 'time: 300', `start: ${startX},12`, '', '[tiles]', ...rows, '#'.repeat(W), '#'.repeat(W)].join(
      '\n',
    ),
  );
}
const row = (cells: Record<number, string>) => Array.from({ length: W }, (_, i) => cells[i] ?? '.').join('');

function jump(lv: ReturnType<typeof level>, nudge: number, rules: 'classic' | 'current' = 'classic') {
  let gripped = false;
  const r = runSim({
    level: lv,
    character: SOPHIA,
    rules,
    script: { steps: [] },
    maxFrames: 70,
    controller: (w: World, f) => {
      if (sophiaState(w.player).surface === CEIL) gripped = true;
      if (f < nudge) return ['right'];
      return f >= 12 && f < 40 ? ['jump'] : [];
    },
    state: { kit: {}, powerState: 'fire' },
  });
  return { gripped, world: r.world };
}

describe('Classic Sophia: no grip on a ceiling that includes a hidden block (item 59)', () => {
  it('her head under both a brick and a hidden block: no grip, the hidden block is revealed', () => {
    // A brick at column 6 and a hidden coin block at column 7; she starts under both.
    const lv = level(row({ 6: '=', 7: '2' }), 6);
    const { gripped, world } = jump(lv, 0);
    expect(gripped).toBe(false);
    expect(world.map.get(7, 8)).not.toBe(T.HIDDEN_COIN);
  });

  it('a hidden block on its own (no brick) is bumped as before, never gripped', () => {
    const lv = level(row({ 7: '2' }), 7);
    const { gripped, world } = jump(lv, 0);
    expect(gripped).toBe(false);
    expect(world.map.get(7, 8)).not.toBe(T.HIDDEN_COIN);
  });

  it('Current Sophia (same drive code) refuses the grip there too and reveals the block', () => {
    const { gripped, world } = jump(level(row({ 6: '=', 7: '2' }), 6), 0, 'current');
    expect(gripped).toBe(false);
    expect(world.map.get(7, 8)).not.toBe(T.HIDDEN_COIN);
  });

  it('a brick ceiling with no hidden block is still gripped (SO-37 unchanged)', () => {
    const lv = level(row({ 5: '=', 6: '=', 7: '=', 8: '=' }), 6);
    expect(jump(lv, 0).gripped).toBe(true);
  });
});
