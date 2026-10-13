import { describe, expect, it } from 'vitest';
import { toPx } from '@engine/math/units';
import { getLevel } from '@content/levels';
import { T, tileDef } from '@game/level/tiles';
import { Lift } from '@game/entities/objects/lift';
import { TileMap } from '@game/world/tilemap';
import type { World } from '@game/world/world';

// BOWSER'S CASTLE (8-5) lava lake (INT55): no lift carries its rider into the lava. Every
// swinging and rising lift is run through its whole swing; a rider standing on it (up to 32 px
// tall, a big hero) never touches lava, the plank itself stays a few px clear of the lava
// surface (the rising lifts used to dip 6 px into it at the bottom of their swing), and a rising lift never pushes its rider into the vault's ceiling. The sinking step
// (`lift-fall`) is the one lift that goes down into the lava, on purpose, and only while ridden:
// it leaves its rider well over half a second to step off.

const RIDER_H = 32;
/** The plank's lowest edge stays at least this far (px) above any lava. */
const LAVA_CLEARANCE = 3;

const level = getLevel('8-5');
const map = new TileMap(level);
const world = { level } as unknown as World;
const lifts = level.entities.filter((e) => e.type.startsWith('lift-'));

/** Lava, or any tile that hurts: the lake's lava is drawn, not deadly in itself (falling off the
 *  level is), so a rider standing in it would look wrong even where the game lets him live. */
const hazardAt = (px: number, py: number) => {
  const id = map.get(px >> 4, py >> 4);
  return id === T.LAVA || tileDef(id).hazard === true;
};
/** Whether any tile in the pixel box [x0, x1] x [y0, y1] is lava (or another hazard). */
function hazardIn(x0: number, x1: number, y0: number, y1: number): boolean {
  for (let y = y0 >> 4; y <= y1 >> 4; y++)
    for (let x = x0 >> 4; x <= x1 >> 4; x++) if (hazardAt(x * 16, y * 16)) return true;
  return false;
}
function solidIn(x0: number, x1: number, y0: number, y1: number): boolean {
  for (let y = y0 >> 4; y <= y1 >> 4; y++)
    for (let x = x0 >> 4; x <= x1 >> 4; x++) if (map.isSolid(x, y)) return true;
  return false;
}

describe("BOWSER'S CASTLE's lifts never carry a rider into the lava (INT55)", () => {
  it('has the lava lake’s lifts (swinging, rising, the sinking step)', () => {
    const kinds = new Set(lifts.map((e) => e.type));
    expect([...kinds].sort()).toEqual(['lift-fall', 'lift-h', 'lift-v']);
  });

  for (const e of lifts.filter((l) => l.type === 'lift-h' || l.type === 'lift-v'))
    it(`${e.type} at column ${e.x}: a rider is safe all the way through its swing`, () => {
      const lift = new Lift(e.type as 'lift-h' | 'lift-v', e.x, e.y, e.props ?? {});
      let low = -Infinity;
      // Both swings repeat within 2 pi * 60 frames (the rising lifts' period, the longest).
      for (let f = 0; f < 800; f++) {
        lift.update(world);
        const top = toPx(lift.body.y);
        const x0 = toPx(lift.body.x);
        const x1 = x0 + toPx(lift.body.w) - 1;
        low = Math.max(low, top);
        expect(hazardIn(x0, x1, top - RIDER_H, top - 1), `rider in lava at frame ${f} (top ${top})`).toBe(
          false,
        );
        expect(
          hazardIn(x0, x1, top, top + 7 + LAVA_CLEARANCE),
          `plank in lava at frame ${f} (top ${top})`,
        ).toBe(false);
        if (e.type === 'lift-v')
          expect(
            solidIn(x0, x1, top - RIDER_H, top - 1),
            `rider in the ceiling at frame ${f} (top ${top})`,
          ).toBe(false);
      }
      expect(low).toBeGreaterThan(0);
    });

  it('the sinking step only sinks while ridden, and leaves its rider time to step off', () => {
    for (const e of lifts.filter((l) => l.type === 'lift-fall')) {
      const lift = new Lift('lift-fall', e.x, e.y, e.props ?? {});
      const x0 = toPx(lift.body.x);
      const x1 = x0 + toPx(lift.body.w) - 1;
      const start = toPx(lift.body.y);
      for (let f = 0; f < 120; f++) lift.update(world); // nobody on it: it waits
      expect(toPx(lift.body.y)).toBe(start);
      let frames = 0;
      for (; frames < 600; frames++) {
        (lift as unknown as { ridden: boolean }).ridden = true;
        lift.update(world);
        const top = toPx(lift.body.y);
        if (hazardIn(x0, x1, top - RIDER_H, top - 1)) break;
      }
      expect(frames).toBeGreaterThanOrEqual(45);
    }
  });
});
