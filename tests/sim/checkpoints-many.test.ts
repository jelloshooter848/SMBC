import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import type { LevelData } from '@game/level/schema';
import { toPx } from '@engine/math/units';

// 0.4.55: BOWSER'S CASTLE has five checkpoints. A map may hold more than one: each checkpoint the
// players pass that lies beyond the last one sent is reported (World.checkZones), so a respawn at
// one checkpoint still reaches the later ones. One map with one checkpoint behaves as before.

/** 1-1's flat opening with no enemies and checkpoints at 5, 10 and 15. */
function threeCheckpoints(): LevelData {
  const base = getLevel('1-1');
  return {
    ...base,
    entities: [],
    zones: [
      { kind: 'checkpoint', x: 5, y: 12 },
      { kind: 'checkpoint', x: 10, y: 12 },
      { kind: 'checkpoint', x: 15, y: 12 },
    ],
  };
}

const walk = (startX: number) =>
  runSim({
    level: threeCheckpoints(),
    character: MARIO,
    script: { steps: [] },
    maxFrames: 600,
    start: { x: startX, y: 12, mode: 'stand' },
    controller: () => ['right'],
    until: (w) => toPx(w.player.body.x) > 18 * 16,
  });

const sent = (r: ReturnType<typeof walk>) => r.events.flatMap((e) => (e.type === 'checkpoint' ? [e.x] : []));

describe('more than one checkpoint in a map', () => {
  it('walking the map sends each checkpoint once, in order', () => {
    expect(sent(walk(2))).toEqual([5, 10, 15]);
  });

  it('a respawn at a checkpoint sends it again, then the later ones', () => {
    expect(sent(walk(10))).toEqual([10, 15]);
  });

  it('a start past every checkpoint sends only the furthest', () => {
    expect(sent(walk(16))).toEqual([15]);
  });
});
