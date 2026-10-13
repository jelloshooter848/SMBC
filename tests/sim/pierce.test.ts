import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { T } from '@game/level/tiles';
import { MEGAMAN } from '@game/characters/megaman';
import { SIMON } from '@game/characters/simon';
import { Projectile } from '@game/entities/projectiles/projectile';
import { heroStart } from '@game/items/heroes';
import { hasKey } from '@game/items/flags';
import type { World } from '@game/world/world';

// Piercing shots (0.4.46, roadmap #23; owner, Oct 10): in the campaign Mega Man's full charge shot
// passes through solid tiles (blocks, pipes, the ground's walls) and bumps every ? block and brick
// it crosses, once each, bricks by the normal rules (his Helmet breaks them). Simon's axe already
// flies through terrain; in the campaign it bumps the ? blocks it crosses, once each. Classic play
// keeps both as they were.

/** A flat stretch with `rows` laid over it (row index → text from column 0). */
function level(rows: Record<number, string>) {
  const lines = Array.from({ length: 13 }, (_, y) => (rows[y] ?? '').padEnd(32, '.'));
  return parseTextMap(
    ['id: t', 'time: 300', 'start: 2,12', '', '[tiles]', ...lines, '#'.repeat(32), '#'.repeat(32)].join('\n'),
  );
}

/** The tiles of row `y` from column `from`, as the map's characters would read. */
const row = (w: World, y: number, from: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) => w.map.get(from + i, y));

/** Mega Man with the Helmet holds SHOOT for a full charge, lets go, then waits. */
function chargeShot(found: boolean, rows: Record<number, string>, frames = 160) {
  const kit = found ? { ...heroStart(MEGAMAN).kit, helmet: 1 } : { helmet: 1 };
  let shots = 0;
  const r = runSim({
    level: level(rows),
    character: MEGAMAN,
    script: { steps: [] },
    maxFrames: frames,
    state: { kit, hp: 28, powerState: 'full', coins: 0 },
    controller: (w, f) => {
      if (w.entities.some((e) => e instanceof Projectile && e.alive && e.kind === 'buster-charged'))
        shots = 1;
      return f < 50 ? ['attack'] : [];
    },
  });
  return { ...r, shots };
}

describe("Mega Man's full charge shot pierces (campaign)", () => {
  // Standing at column 2 he shoots along row 12: a pipe (columns 5-6), then ? = C ? (9-12).
  const rows = { 11: '.....[]', 12: '.....{}..?=C?' };

  it('passes the pipe and bumps each block it crosses once: coins, a broken brick, used ? blocks', () => {
    const r = chargeShot(true, rows);
    expect(r.shots).toBe(1);
    const w = r.world;
    // The pipe stands; the ? blocks are used; the brick broke (his Helmet); the coin brick gave one coin.
    expect(row(w, 12, 5, 2)).toEqual([T.PIPE_BL, T.PIPE_BR]);
    expect(w.map.get(9, 12)).toBe(T.USED);
    expect(w.map.get(10, 12)).toBe(T.AIR);
    expect(w.map.get(11, 12)).toBe(T.BRICK_COINS10);
    expect(w.map.get(12, 12)).toBe(T.USED);
    expect(r.coins).toBe(3);
    expect(w.feats.bricks).toBe(1);
  });

  it('classic play: the shot stops at the pipe, and nothing behind it is bumped', () => {
    const r = chargeShot(false, rows);
    expect(r.shots).toBe(1);
    const w = r.world;
    expect(w.map.get(9, 12)).toBe(T.Q_COIN);
    expect(w.map.get(10, 12)).toBe(T.BRICK);
    expect(w.map.get(12, 12)).toBe(T.Q_COIN);
    expect(r.coins).toBe(0);
  });

  it('a plain shot still stops at a wall in the campaign', () => {
    const r = runSim({
      level: level(rows),
      character: MEGAMAN,
      script: { steps: [] },
      maxFrames: 120,
      state: { kit: { ...heroStart(MEGAMAN).kit, helmet: 1 }, hp: 28, powerState: 'full' },
      controller: (_w, f) => (f === 2 ? ['attack'] : []),
    });
    expect(r.world.map.get(9, 12)).toBe(T.Q_COIN);
    expect(r.coins).toBe(0);
  });
});

describe("Simon's axe bumps the ? blocks it crosses (campaign)", () => {
  // Simon at column 2 throws to the right: the axe climbs through columns 5-7 around rows 6-8.
  const rows = { 5: '.....???', 6: '.....???', 7: '.....=??', 8: '.....???' };
  const kit = (found: boolean) =>
    found
      ? { ...heroStart(SIMON).kit, [hasKey('axe')]: 1, hearts: 10, tool: 0 }
      : { subs: 2, tool: 1, hearts: 10 };

  function throwAxe(found: boolean) {
    let axes = 0;
    const r = runSim({
      level: level(rows),
      character: SIMON,
      script: { steps: [] },
      maxFrames: 160,
      state: { kit: kit(found), hp: 16, powerState: 'full', coins: 0 },
      controller: (w, f) => {
        if (w.entities.some((e) => e instanceof Projectile && e.alive && e.kind === 'hand-axe')) axes = 1;
        return f === 4 ? ['special'] : [];
      },
    });
    const used: string[] = [];
    for (let y = 5; y <= 8; y++)
      for (let x = 5; x <= 7; x++) if (r.world.map.get(x, y) === T.USED) used.push(`${x},${y}`);
    return { r, axes, used };
  }

  it('flies through them and bumps each it crosses once (a coin each); a brick is left alone', () => {
    const { r, axes, used } = throwAxe(true);
    expect(axes).toBe(1);
    expect(used.length).toBeGreaterThanOrEqual(2);
    expect(r.coins).toBe(used.length);
    expect(r.world.map.get(5, 7)).toBe(T.BRICK);
  });

  it('classic play: it flies through, bumping nothing', () => {
    const { r, axes, used } = throwAxe(false);
    expect(axes).toBe(1);
    expect(used).toEqual([]);
    expect(r.coins).toBe(0);
  });
});
