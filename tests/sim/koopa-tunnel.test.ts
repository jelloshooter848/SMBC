import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { toPx } from '@engine/math/units';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Koopa } from '@game/entities/enemies/koopa';
import type { World } from '@game/world/world';

// Owner note 12 (0.4.22): a walking Koopa's collision box fits a one-tile (16 px) gap, as SMB's
// Koopas walk under one-tile gaps; the sprite stays as drawn (16x24, feet on the floor).

/** The 1-2 Koopas within `cols` of the tunnel, with their spawn column. */
function koopasNear(w: World, lo: number, hi: number): Koopa[] {
  return w.entities.filter(
    (e): e is Koopa => e instanceof Koopa && toPx(e.body.x) >> 4 >= lo && toPx(e.body.x) >> 4 <= hi,
  );
}

describe('Koopa height (1-2 tunnel)', () => {
  it('the tunnel at cols 54-55 is one tile high (row 12 open, rows 11 and 13 solid)', () => {
    const r = runSim({ level: getLevel('1-2'), character: MARIO, script: { steps: [] }, maxFrames: 1 });
    const map = r.world.map;
    for (const c of [54, 55]) {
      expect(map.isSolid(c, 11)).toBe(true);
      expect(map.isSolid(c, 12)).toBe(false);
      expect(map.isSolid(c, 13)).toBe(true);
    }
  });

  it('a walking Koopa is 16 px tall with its 24 px sprite drawn from 8 px above its box', () => {
    const k = new Koopa(0, 0, 'green');
    expect(toPx(k.body.h)).toBe(16);
    expect(k.spriteOffsetY).toBe(8);
    const red = new Koopa(0, 0, 'red', true);
    expect(toPx(red.body.h)).toBe(16);
  });

  it('the Koopa at col 59 walks left through the tunnel at cols 54-55', () => {
    const level = getLevel('1-2');
    let seen: Koopa | undefined;
    let through = false;
    runSim({
      level,
      character: MARIO,
      script: { steps: [] },
      maxFrames: 900,
      assist: { invulnerable: true },
      // Mario stands right of it, so the camera shows the tunnel and the Koopa walks away from him.
      start: { x: 61, y: 12, mode: 'stand' },
      until: (w) => {
        seen ??= koopasNear(w, 57, 61)[0];
        if (seen && seen.alive && toPx(seen.body.x + seen.body.w) < 54 * 16) through = true;
        return through;
      },
    });
    expect(seen).toBeDefined();
    expect(through).toBe(true);
  });
});
