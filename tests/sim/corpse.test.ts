import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { CORPSE_VX, CORPSE_VY, Corpse } from '@game/entities/effects/effects';
import { SUB } from '@engine/math/units';
import type { Renderer } from '@engine/gfx/renderer';
import type { View } from '@game/entities/entity';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';

// Knocked-out enemies, com/smbc/enemies/Enemy.as die(): scaleY = -1 (upside down), vy = -DIE_BOOST_Y
// (200 Flash px/s = 1.67 px/f), vx = ±DIE_BOOST_X (100 = 0.83 px/f) or 0 in a water level, then the
// enemy's own gravity (Goomba 1400 Flash px/s² = 0.194 px/f², so it pops about 7 px up).

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

const flat = (theme: string, entity: string): LevelData =>
  parseTextMap(
    [
      'id: t',
      `theme: ${theme}`,
      'time: 300',
      'start: 2,12',
      '',
      '[tiles]',
      ...Array.from({ length: 13 }, () => '.'.repeat(48)),
      '#'.repeat(48),
      '#'.repeat(48),
      '',
      '[entities]',
      entity,
    ].join('\n'),
  );

interface Knockout {
  corpse: Corpse;
  vx: number;
  vy: number;
  /** px above the death spot at the top of the pop. */
  peak: number;
}

/** Hit the first enemy with a fireball from the left and follow its corpse. */
function knockOut(theme: string, entity: string): Knockout {
  let corpse: Corpse | undefined;
  let hit = false;
  let startY = 0;
  let minY = Infinity;
  let vx = NaN;
  let vy = NaN;
  runSim({
    level: flat(theme, entity),
    character: MARIO,
    script: none,
    maxFrames: 120,
    controller: (w, f) => {
      if (!hit && f > 2) {
        const e = w.entities.find((x): x is Goomba | Koopa => x instanceof Goomba || x instanceof Koopa);
        if (e) {
          startY = e.body.y;
          e.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, w);
          hit = true;
          corpse = w.entities.find((x): x is Corpse => x instanceof Corpse);
          vx = corpse?.body.vx ?? NaN;
          vy = corpse?.body.vy ?? NaN;
        }
      }
      if (corpse?.alive) minY = Math.min(minY, corpse.body.y);
      return [];
    },
  });
  expect(corpse).toBeDefined();
  return { corpse: corpse as Corpse, vx, vy, peak: (startY - minY) / SUB };
}

describe('knocked-out enemies (Enemy.die)', () => {
  it('pop up at 1.67 px/f and fly sideways at 0.83 px/f away from the hit', () => {
    const k = knockOut('overworld', 'goomba 12 12');
    expect(k.vy).toBe(-CORPSE_VY);
    expect(k.vx).toBe(CORPSE_VX);
    expect(CORPSE_VY / 4096).toBeCloseTo(200 / 2 / 60, 2);
    expect(CORPSE_VX / 4096).toBeCloseTo(100 / 2 / 60, 2);
  });

  it("fall with the enemy's own gravity: a Goomba or a Koopa pops about 7 px", () => {
    const g = knockOut('overworld', 'goomba 12 12').peak;
    expect(g).toBeGreaterThanOrEqual(6);
    expect(g).toBeLessThanOrEqual(8);
    const k = knockOut('overworld', 'koopa-green 12 12').peak;
    expect(k).toBeGreaterThan(g); // 1300 vs 1400 Flash px/s²
    expect(k).toBeLessThanOrEqual(8.5);
  });

  it('drop straight down in a water level (vx = 0 when level.waterLevel)', () => {
    expect(knockOut('water', 'goomba 12 12').vx).toBe(0);
  });

  it('are drawn upside down', () => {
    const { corpse } = knockOut('overworld', 'goomba 12 12');
    const calls: { flipY: boolean | undefined }[] = [];
    const r = {
      sprite: (_s: unknown, _f: string, _x: number, _y: number, _fx?: boolean, fy?: boolean) =>
        calls.push({ flipY: fy }),
    } as unknown as Renderer;
    const view = {
      camX: 0,
      frame: 0,
      theme: 'overworld',
      reduceFlashing: false,
      assets: { sheet: () => ({ frames: new Map() }) },
    } as unknown as View;
    corpse.render(r, view);
    expect(calls).toEqual([{ flipY: true }]);
  });
});
