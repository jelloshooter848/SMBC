import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { BalanceLift } from '@game/entities/objects/balance-lift';
import type { Lift } from '@game/entities/objects/lift';
import { Projectile } from '@game/entities/projectiles/projectile';
import { toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/world3', `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const at = (l: LevelData, x: number, y: number): LevelData => {
  l.start = { x, y };
  l.startMode = 'stand';
  return l;
};

describe('World 3: Hammer Bros', () => {
  it('throw hammers in arcs that hurt the player', () => {
    const l = at(level('3-1'), 108, 12);
    let hammers = 0;
    let highest = Infinity;
    const r = runSim({
      level: l,
      character: MARIO,
      state: { powerState: 'big' },
      script: none,
      maxFrames: 900,
      controller: (w) => {
        for (const e of w.entities) {
          if (e instanceof Projectile && e.spec.kind === 'hammer') {
            hammers++;
            highest = Math.min(highest, toPx(e.body.y));
          }
        }
        return [];
      },
      until: (w) => w.player.powerState === 'small',
    });
    expect(r.outcome).toBe('stopped');
    expect(hammers).toBeGreaterThan(0);
    expect(highest).toBeLessThan(12 * 16 - 32); // hammers fly well above the thrower's head
    expect(r.world.entities.filter((e) => e instanceof HammerBro).length).toBeGreaterThan(0);
  });

  it('die to a stomp for 1000 points', () => {
    const l = at(level('3-1'), 108, 12);
    let bro: HammerBro | undefined;
    const r = runSim({
      level: l,
      character: MARIO,
      script: none,
      maxFrames: 60,
      assist: { invulnerable: true },
      controller: (w) => {
        bro ??= w.entities.find((e): e is HammerBro => e instanceof HammerBro);
        if (bro && bro.alive && w.frame === 30) {
          // Drop the player onto its head.
          w.player.body.x = bro.body.x;
          w.player.body.y = bro.body.y - w.player.body.h - 2 * 256;
          w.player.body.vy = 0x02000;
        }
        return [];
      },
      until: () => bro !== undefined && !bro.alive,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.score).toBeGreaterThanOrEqual(1000);
  });

  it('hop between rows', () => {
    const l = at(level('3-1'), 108, 12);
    let bro: HammerBro | undefined;
    let minY = Infinity;
    let maxY = -Infinity;
    runSim({
      level: l,
      character: MARIO,
      script: none,
      maxFrames: 900,
      assist: { invulnerable: true },
      controller: (w) => {
        bro ??= w.entities.find((e): e is HammerBro => e instanceof HammerBro && toPx(e.body.y) < 11 * 16);
        if (bro?.alive) {
          minY = Math.min(minY, toPx(bro.body.y));
          maxY = Math.max(maxY, toPx(bro.body.y));
        }
        return [];
      },
    });
    expect(bro).toBeDefined();
    expect(maxY - minY).toBeGreaterThanOrEqual(3 * 16); // it changed rows
  });
});

describe('World 3: balance lifts', () => {
  const setup = (frames: number, ride: boolean) => {
    const l = at(level('3-3'), 80, 5);
    let pair: BalanceLift | undefined;
    const r = runSim({
      level: l,
      character: MARIO,
      script: none,
      maxFrames: frames,
      assist: { invulnerable: true },
      controller: (w, f) => {
        pair ??= w.entities.find((e): e is BalanceLift => e instanceof BalanceLift);
        // Stand on the left platform from the start, or step off after 100 frames.
        if (f === 1 && pair?.platforms) {
          const [left] = pair.platforms;
          w.player.body.x = left.body.x + 256 * 8;
          w.player.body.y = left.body.y - w.player.body.h - 256;
          w.player.body.vy = 0x01000;
        }
        if (!ride && f > 100) return ['right'];
        return [];
      },
    });
    const [left, right] = (pair as BalanceLift).platforms as [Lift, Lift];
    return { r, pair: pair as BalanceLift, left, right };
  };

  it('spawn two platforms whose rope is slack only after a drop', () => {
    const { pair, left, right } = setup(5, true);
    expect(pair).toBeDefined();
    expect(toPx(left.body.y)).toBeGreaterThanOrEqual(6 * 16);
    expect(toPx(left.body.y)).toBeLessThanOrEqual(6 * 16 + 4);
    expect(toPx(right.body.y)).toBeLessThanOrEqual(8 * 16);
    expect(left.kind).toBe('lift-balance');
  });

  it('sink under the player while the partner rises by the same amount', () => {
    const { r, left, right } = setup(80, true);
    expect(r.world.player.body.onGround).toBe(true);
    const sunk = toPx(left.body.y) - 6 * 16;
    const risen = 8 * 16 - toPx(right.body.y);
    expect(sunk).toBeGreaterThan(20);
    expect(sunk).toBe(risen);
    expect(left.isFalling).toBe(false);
  });

  it('drop both platforms once the partner reaches its pulley', () => {
    const { left, right, pair } = setup(400, true);
    expect(left.isFalling).toBe(true);
    expect(right.isFalling).toBe(true);
    expect(toPx(left.body.y)).toBeGreaterThan(pair.ropeY + 100);
  });
});

describe('World 3 areas', () => {
  it('every area loads and runs', () => {
    for (const id of ['3-1', '3-1-bonus', '3-1-sky', '3-2', '3-3', '3-4']) {
      const r = runSim({ level: level(id), character: MARIO, script: none, maxFrames: 60 });
      expect(r.frames).toBe(60);
    }
  });
});
