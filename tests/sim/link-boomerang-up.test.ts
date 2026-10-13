import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { T } from '@game/level/tiles';
import { LINK } from '@game/characters/link';
import { Projectile } from '@game/entities/projectiles/projectile';
import { heroStart } from '@game/items/heroes';
import type { World } from '@game/world/world';

// Link's boomerang goes up (0.4.46, roadmap #26). The original Crossover's LinkBoomerang.setDir reads
// UP alone (straight up, from over his head), UP+RIGHT and UP+LEFT (diagonally up, at 0.75 of its
// speed on each axis); with neither, it flies the way he faces. True to the original, so in both
// modes. It still fetches what it touches (0.4.43): a coin up high comes back to him.

/** A flat field with a coin at (`cx`, `cy`) when given. */
function field(coin?: { x: number; y: number }) {
  const rows = Array.from({ length: 13 }, (_, y) =>
    Array.from({ length: 24 }, (_, x) => (coin && coin.x === x && coin.y === y ? '$' : '.')).join(''),
  );
  return parseTextMap(
    ['id: t', 'time: 300', 'start: 6,12', '', '[tiles]', ...rows, '#'.repeat(24), '#'.repeat(24)].join('\n'),
  );
}

/** Link throws with `dirs` held (classic: no found kit); the boomerang's path frame by frame. */
function throwWith(dirs: Action[], opts: { found?: boolean; coin?: { x: number; y: number } } = {}) {
  const path: { x: number; y: number; vx: number; vy: number }[] = [];
  const start = heroStart(LINK);
  const r = runSim({
    level: field(opts.coin),
    character: LINK,
    script: { steps: [] },
    maxFrames: 160,
    state:
      opts.found === false
        ? { kit: {}, hp: 6, powerState: 'full' }
        : { kit: start.kit, hp: start.hp, powerState: 'full' },
    controller: (w: World, f) => {
      const b = w.entities.find(
        (e): e is Projectile => e instanceof Projectile && e.alive && e.kind === 'boomerang',
      );
      if (b) path.push({ x: toPx(b.body.x), y: toPx(b.body.y), vx: b.body.vx, vy: b.body.vy });
      if (f >= 10 && f < 14) return [...dirs, ...(f === 12 ? (['special'] as const) : [])];
      return [];
    },
  });
  return { r, path, link: r.world.player };
}

describe("Link's boomerang up and diagonally up", () => {
  it('UP alone: straight up from over his head, then back', () => {
    const { path, link } = throwWith(['up']);
    expect(path.length).toBeGreaterThan(20);
    const first = path[0] as (typeof path)[number];
    expect(first.vx).toBe(0);
    expect(first.vy).toBeLessThan(0);
    // From over his head, at his middle.
    expect(first.y).toBeLessThan(toPx(link.body.y));
    expect(Math.abs(first.x + 4 - toPx(link.centerX))).toBeLessThanOrEqual(2);
    // Up well over six tiles' worth of his jump, then back down to him.
    const top = Math.min(...path.map((p) => p.y));
    expect(toPx(link.body.y) - top).toBeGreaterThanOrEqual(96);
    expect(path.every((p) => Math.abs(p.x - (first.x as number)) <= 2)).toBe(true);
  });

  for (const [side, sign] of [
    ['right', 1],
    ['left', -1],
  ] as const)
    it(`UP + ${side.toUpperCase()}: diagonally up that way, 0.75 of its speed each way`, () => {
      const { path } = throwWith(['up', side]);
      const first = path[0] as (typeof path)[number];
      expect(Math.sign(first.vx)).toBe(sign);
      expect(first.vy).toBeLessThan(0);
      expect(Math.abs(first.vx)).toBe(Math.abs(first.vy));
      expect(Math.abs(first.vx)).toBe(Math.round(0x03000 * 0.75));
    });

  it('neither: the way he faces, level, as before', () => {
    const { path } = throwWith([]);
    const first = path[0] as (typeof path)[number];
    expect(first.vy).toBe(0);
    expect(first.vx).toBeGreaterThan(0);
  });

  it('classic play too (true to the original)', () => {
    const { path } = throwWith(['up'], { found: false });
    const first = path[0] as (typeof path)[number];
    expect(first.vx).toBe(0);
    expect(first.vy).toBeLessThan(0);
  });

  it('it fetches a coin up high that no jump reaches, and brings it back', () => {
    // Six rows over his head (he stands in row 12): out of a jump's reach, in the boomerang's.
    const { r } = throwWith(['up'], { coin: { x: 6, y: 6 } });
    expect(r.world.map.get(6, 6)).toBe(T.AIR);
    expect(r.coins).toBe(1);
    // Diagonally: a coin up and ahead.
    const diag = throwWith(['up', 'right'], { coin: { x: 9, y: 8 } });
    expect(diag.r.world.map.get(9, 8)).toBe(T.AIR);
    expect(diag.r.coins).toBe(1);
  });
});
