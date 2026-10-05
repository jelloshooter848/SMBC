import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { Projectile } from '@game/entities/projectiles/projectile';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

const level = (world: number, id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, `../../src/content/levels/world${world}`, `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const at = (l: LevelData, x: number, y: number): LevelData => {
  l.start = { x, y };
  l.startMode = 'stand';
  return l;
};

/** Watch Bowser's projectiles from a safe spot on the bridge approach. */
function bowserShots(l: LevelData): { bowser: Bowser | undefined; hammers: number; flames: number } {
  let bowser: Bowser | undefined;
  const seen = new Set<number>();
  let hammers = 0;
  let flames = 0;
  runSim({
    level: at(l, 126, 8),
    character: MARIO,
    script: none,
    maxFrames: 500,
    assist: { invulnerable: true },
    controller: (w: World) => {
      bowser ??= w.entities.find((e): e is Bowser => e instanceof Bowser);
      for (const e of w.entities) {
        if (!(e instanceof Projectile) || e.owner !== bowser || seen.has(e.id)) continue;
        seen.add(e.id);
        if (e.spec.kind === 'hammer') hammers++;
        if (e.spec.kind === 'bowser-flame') flames++;
      }
      return [];
    },
  });
  return { bowser, hammers, flames };
}

describe('World 6: Bowser attack types', () => {
  it('the 6-4 Bowser throws volleys of hammers and no fire', () => {
    const { bowser, hammers, flames } = bowserShots(level(6, '6-4'));
    expect(bowser?.attack).toBe('hammer');
    expect(hammers).toBeGreaterThanOrEqual(5);
    expect(flames).toBe(0);
  });

  it('earlier Bowsers still breathe fire and throw no hammers', () => {
    const { bowser, hammers, flames } = bowserShots(level(1, '1-4'));
    expect(bowser?.attack).toBe('fire');
    expect(flames).toBeGreaterThan(0);
    expect(hammers).toBe(0);
  });
});

describe('World 6 areas', () => {
  it('every area loads and runs', () => {
    for (const id of ['6-1', '6-2', '6-2-bonus', '6-2-water', '6-2-sky', '6-2-bonus2', '6-3', '6-4']) {
      const r = runSim({ level: level(6, id), character: MARIO, script: none, maxFrames: 60 });
      expect(r.frames).toBe(60);
    }
  });
});
