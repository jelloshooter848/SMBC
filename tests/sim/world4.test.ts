import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Lakitu, LakituZone } from '@game/entities/enemies/lakitu';
import { Spiny } from '@game/entities/enemies/spiny';
import { Koopa } from '@game/entities/enemies/koopa';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { WorldEvent } from '@game/world/world';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/world4', `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const at = (l: LevelData, x: number, y: number): LevelData => {
  l.start = { x, y };
  l.startMode = 'stand';
  return l;
};
const loops = (events: WorldEvent[]) => events.filter((e) => e.type === 'loop');
/** Stop the run right after a maze teleport (the sim moves world events into its result). */
const teleported = () => {
  let prev: number | null = null;
  return (w: { player: { body: { x: number } } }) => {
    const x = toPx(w.player.body.x);
    const jumped = prev !== null && Math.abs(x - prev) > 48;
    prev = x;
    return jumped;
  };
};

describe('World 4: Lakitu and Spinies', () => {
  it('Lakitu flies in, stays on screen over the player and lobs eggs that hatch into Spinies', () => {
    let lakitu: Lakitu | undefined;
    let hatched: Spiny | undefined;
    let offScreen = 0;
    const r = runSim({
      level: level('4-1'),
      character: MARIO,
      script: none,
      maxFrames: 900,
      assist: { invulnerable: true },
      controller: (w, f) => {
        lakitu ??= w.entities.find((e): e is Lakitu => e instanceof Lakitu);
        hatched ??= w.entities.find((e): e is Spiny => e instanceof Spiny && !e.egg);
        if (lakitu && f > 120) {
          const x = lakitu.body.x;
          if (x < w.camera.x || x > w.camera.right) offScreen++;
        }
        return f > 200 && f < 600 ? ['right'] : [];
      },
      until: () => hatched !== undefined && (lakitu?.alive ?? false),
    });
    expect(r.outcome).toBe('stopped');
    expect(lakitu).toBeDefined();
    expect(toPx((lakitu as Lakitu).body.y)).toBeLessThan(48);
    expect(offScreen).toBe(0);
    expect((hatched as Spiny).body.onGround).toBe(true);
    expect((hatched as Spiny).vulnerability.stomp).toBe('hurtAttacker');
  });

  it('a defeated Lakitu is replaced after a while', () => {
    let first: Lakitu | undefined;
    let killAt = -1;
    let zone: LakituZone | undefined;
    runSim({
      level: level('4-1'),
      character: MARIO,
      script: none,
      maxFrames: 900,
      assist: { invulnerable: true },
      controller: (w, f) => {
        zone ??= w.entities.find((e): e is LakituZone => e instanceof LakituZone);
        if (!first) {
          first = w.entities.find((e): e is Lakitu => e instanceof Lakitu);
          if (first) killAt = f + 30;
          return ['right']; // walk until the stretch begins
        }
        if (f === killAt) first.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, w);
        return [];
      },
    });
    expect(first?.alive).toBe(false);
    expect(zone?.current).not.toBe(first);
    expect(zone?.current?.alive).toBe(true);
  });

  it('Lakitu leaves once the player reaches the end of its stretch', () => {
    let lakitu: Lakitu | undefined;
    let left = false;
    runSim({
      level: at(level('4-1'), 200, 12),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: ['right'] }] },
      maxFrames: 600,
      assist: { invulnerable: true },
      controller: (w) => {
        lakitu ??= w.entities.find((e): e is Lakitu => e instanceof Lakitu);
        if (lakitu?.leaving) left = true;
        return ['right'];
      },
      until: () => left && !(lakitu as Lakitu).alive,
    });
    expect(left).toBe(true);
    expect(lakitu?.alive).toBe(false);
  });
});

describe('World 4: Buzzy Beetles', () => {
  it('shrug off fireballs and turn into kickable shells when stomped', () => {
    let buzzy: Koopa | undefined;
    const r = runSim({
      level: at(level('4-2'), 76, 12),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w) => {
        buzzy ??= w.entities.find((e): e is Koopa => e instanceof Koopa && e.color === 'buzzy');
        return [];
      },
      until: () => buzzy !== undefined,
    });
    const b = buzzy as Koopa;
    expect(b.currentFrame).toMatch(/^buzzy-/);
    expect(toPx(b.body.h)).toBe(14);
    expect(b.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, r.world)).toBe('immune');
    expect(b.alive).toBe(true);
    expect(b.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, r.world)).toBe('shell');
    expect(b.state).toBe('shell');
    expect(b.currentFrame).toBe('buzzy-shell');
  });
});

describe('World 4-4: the castle maze', () => {
  it('the upper path at the first fork skips ahead past the repeated section', () => {
    const r = runSim({
      level: at(level('4-4'), 1, 6),
      character: MARIO,
      script: none,
      maxFrames: 700,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) {
          // On the upper corridor just before its checkpoint column.
          w.player.body.x = px(34 * 16 + 6);
          w.player.body.y = px(6 * 16) - w.player.body.h;
          w.camera.snapTo(w.player.body.x);
        }
        return ['right'];
      },
      until: teleported(),
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 63, to: 127 }]);
    expect(toPx(r.world.player.body.x)).toBeGreaterThanOrEqual(127 * 16 - 8);
  });

  it('the lower path at the first fork loops back', () => {
    const r = runSim({
      level: at(level('4-4'), 1, 6),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) {
          // Lower corridor, just before its checkpoint column 99.
          w.player.body.x = px(99 * 16 - 8) - (w.player.body.w >> 1);
          w.player.body.y = px(13 * 16) - w.player.body.h;
          w.camera.snapTo(w.player.body.x);
        }
        if (f === 20) {
          // Past the pillar, still on the lower corridor.
          w.player.body.x = px(122 * 16);
          w.camera.snapTo(w.player.body.x);
        }
        return ['right'];
      },
      until: (w, f) => f > 21 && toPx(w.player.body.x) < 100 * 16,
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 127, to: 63 }]);
    expect(toPx(r.world.player.body.x)).toBeLessThan(66 * 16);
    expect(toPx(r.world.player.body.y + r.world.player.body.h)).toBe(13 * 16);
  });

  it('nothing happens at a loop column without passing its checkpoint first', () => {
    const r = runSim({
      level: at(level('4-4'), 1, 6),
      character: MARIO,
      script: none,
      maxFrames: 200,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) {
          w.player.body.x = px(122 * 16);
          w.player.body.y = px(13 * 16) - w.player.body.h;
          w.camera.snapTo(w.player.body.x);
        }
        return ['right'];
      },
    });
    expect(loops(r.events)).toEqual([]);
    expect(toPx(r.world.player.body.x)).toBeGreaterThan(127 * 16);
  });
});

describe('World 4 areas', () => {
  it('every area loads and runs', () => {
    for (const id of [
      '4-1',
      '4-1-bonus',
      '4-2-intro',
      '4-2',
      '4-2-warp',
      '4-2-bonus',
      '4-2-exit',
      '4-3',
      '4-4',
    ]) {
      const r = runSim({ level: level(id), character: MARIO, script: none, maxFrames: 60 });
      expect(r.frames).toBe(60);
    }
  });
});
