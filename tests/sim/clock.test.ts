import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { PowerUp } from '@game/entities/objects/powerup';
import { T, tileDef } from '@game/level/tiles';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import type { LevelData } from '@game/level/schema';

// Lost Levels 9-1 (levelDataLostLevels.xml, LEVEL 9-1 area b, cell 24,9 on normal difficulty)
// holds two `?` blocks: `itemBlock&&ContainedItem=Clock` and a plain coin `itemBlock`. Level.as
// builds one ItemBlock per token and a bump hits one of them (lines 2047-2051); the Clock
// (pickups/Clock.as) rises out and stays, and collecting it gives Clock.SCORE_VALUE = 1000 and
// Clock.TIME_TO_ADD = 100 (Character.as, PickupInfo.CLOCK).

/** A flat 48-wide field with a `Q` block at column 8, three tiles up. */
function flat(): LevelData {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(48));
  rows[9] = '.'.repeat(8) + 'Q' + '.'.repeat(39);
  return parseTextMap(
    ['id: t', 'time: 300', 'start: 2,12', '', '[tiles]', ...rows, '#'.repeat(48), '#'.repeat(48)].join('\n'),
  );
}

const clocks = (w: World): PowerUp[] =>
  w.entities.filter((e): e is PowerUp => e instanceof PowerUp && e.item === 'clock');

/** Walk under the block (column 8) and hop into it. */
function hop(w: World, frame: number): Action[] {
  const b = w.player.body;
  const dx = 8 * 16 + 8 - (b.x + b.w / 2) / 256;
  if (!b.onGround) return ['jump'];
  if (dx > 2) return ['right'];
  if (dx < -2) return ['left'];
  if (b.vx !== 0) return [];
  return frame % 2 === 0 ? ['jump'] : [];
}

describe('the Clock block', () => {
  it('ll-9-1: the ? block at 24,9 holds the Clock (its neighbours are coin blocks)', () => {
    const l = getLevel('ll-9-1');
    const at = (x: number) => l.tiles[9 * l.width + x];
    expect(at(24)).toBe(T.Q_CLOCK);
    for (const x of [23, 25, 26, 27, 28]) expect(at(x)).toBe(T.Q_COIN);
    expect(tileDef(T.Q_CLOCK).block).toEqual({ kind: 'question', content: 'clock' });
  });

  it('the first bump releases a Clock that stays put; touching it adds 100 time and 1000 points', () => {
    let clock: PowerUp | undefined;
    let outAt = 0;
    let restX = 0;
    const r = runSim({
      level: flat(),
      character: MARIO,
      script: { steps: [] },
      maxFrames: 900,
      assist: { infiniteTime: true },
      controller: (w, f) => {
        if (!clock) {
          clock = clocks(w)[0];
          outAt = f;
        }
        if (!clock) return hop(w, f);
        // Two seconds after it came out (it must not have slid), drop Mario onto it.
        if (f === outAt + 120) {
          restX = clock.body.x;
          w.player.body.x = clock.body.x;
          w.player.body.y = clock.body.y - 48 * 256;
          w.player.body.vy = 0;
        }
        return [];
      },
      until: () => !!clock && !clock.alive,
    });
    expect(clock).toBeDefined();
    expect(r.outcome).toBe('stopped');
    expect(restX).toBe(8 * 16 * 256 + 2 * 256); // still on top of its block
    expect(r.world.time).toBe(400);
    expect(r.score).toBe(1000);
    // The coin block under it is next.
    expect(r.world.map.get(8, 9)).toBe(T.Q_COIN);
  });

  it('the second bump gives the coin, then the block is used', () => {
    let bumps = 0;
    let wasBumping = false;
    const r = runSim({
      level: flat(),
      character: MARIO,
      script: { steps: [] },
      maxFrames: 1200,
      controller: (w, f) => {
        // Keep hopping into the block (the Clock stays on top of it): count the bumps.
        const bumping = w.map.get(8, 9) === T.BUMPING;
        if (bumping && !wasBumping) bumps++;
        wasBumping = bumping;
        return hop(w, f);
      },
      until: (w) => bumps >= 2 && w.map.get(8, 9) === T.USED,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.coins).toBe(1);
  });
});
