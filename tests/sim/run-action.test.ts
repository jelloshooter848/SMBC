import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Projectile } from '@game/entities/projectiles/projectile';
import type { Action } from '@engine/input/actions';

/** A flat, empty 96-wide field. */
function field() {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(96));
  return parseTextMap(
    ['id: t', 'time: 300', 'start: 2,12', '', '[tiles]', ...rows, '#'.repeat(96), '#'.repeat(96)].join('\n'),
  );
}

/** Hold `held` for 120 frames as Fire Mario; report top speed and how many projectiles appeared. */
function hold(held: Action[]) {
  let top = 0;
  let shots = 0;
  runSim({
    level: field(),
    character: MARIO,
    script: { steps: [] },
    maxFrames: 120,
    state: { powerState: 'fire' },
    controller: (w) => {
      top = Math.max(top, Math.abs(w.player.body.vx));
      shots = Math.max(shots, w.entities.filter((e) => e instanceof Projectile).length);
      return held;
    },
  });
  return { top, shots };
}

describe('the run action (touch pad outer ring)', () => {
  it('Mario holding run reaches run speed without throwing a fireball', () => {
    const r = hold(['right', 'run']);
    expect(r.top).toBe(MARIO.movement.maxRun);
    expect(r.shots).toBe(0);
  });

  it('without run (or attack) he stays at walking speed', () => {
    expect(hold(['right']).top).toBe(MARIO.movement.maxWalk);
  });

  it('attack still runs too, and throws the fireball', () => {
    const r = hold(['right', 'attack']);
    expect(r.top).toBe(MARIO.movement.maxRun);
    expect(r.shots).toBeGreaterThan(0);
  });
});
