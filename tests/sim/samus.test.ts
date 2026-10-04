import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { SAMUS, START_ENERGY } from '@game/characters/samus';
import { Goomba } from '@game/entities/enemies/goomba';
import { PowerUp } from '@game/entities/objects/powerup';
import { Pickup } from '@game/entities/objects/pickup';
import { Projectile } from '@game/entities/projectiles/projectile';
import { T } from '@game/level/tiles';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';

function field(rows: Record<number, string> = {}, startX = 2) {
  const base = Array.from({ length: 13 }, () => '.'.repeat(48));
  for (const [y, row] of Object.entries(rows)) base[Number(y)] = row;
  return parseTextMap(
    [
      'id: t',
      'time: 300',
      `start: ${startX},12`,
      '',
      '[tiles]',
      ...base,
      '#'.repeat(48),
      '#'.repeat(48),
    ].join('\n'),
  );
}
const at = (col: number, ch: string, width = 48) =>
  '.'.repeat(col) + ch + '.'.repeat(width - col - ch.length);
type Ctl = (w: World, f: number) => Action[];
const FULL = { varia: 1, tanks: 2, maxHp: 90, beam: 3, missiles: 30 };

function run(
  level: ReturnType<typeof field>,
  controller: Ctl,
  frames: number,
  kit: Record<string, number> = {},
  hp = START_ENERGY,
) {
  return runSim({
    level,
    character: SAMUS,
    script: { steps: [] },
    maxFrames: frames,
    controller,
    state: { kit, hp },
  });
}
/** Curl into the ball on frame 2, then follow `then`. */
const ball =
  (then: Ctl): Ctl =>
  (w, f) =>
    f === 2 ? ['down'] : f < 2 ? [] : then(w, f);
const shootAt =
  (frame: number, held: Action[] = []): Ctl =>
  (_w, f) =>
    f === frame ? [...held, 'attack'] : held;
const liveGoombas = (w: World) => w.entities.filter((e) => e instanceof Goomba && e.alive).length;

describe("Samus's kit", () => {
  it('only the morph ball fits through a one-tile tunnel', () => {
    // A slab at row 11 over columns 10-15 leaves a one-tile gap above the floor.
    const tunnel = field({ 11: at(10, '######'), 10: at(10, '######') }, 6);
    const standing = run(tunnel, () => ['right'], 300);
    expect(standing.playerX).toBeLessThan(10 * 16);
    const rolling = run(
      tunnel,
      ball(() => ['right']),
      400,
    );
    expect(rolling.world.player.scratch.ball).toBe(1);
    expect(rolling.playerX).toBeGreaterThan(16 * 16);
  });

  it('cannot jump while curled up', () => {
    const r = run(
      field(),
      ball(() => ['jump']),
      60,
    );
    expect(r.world.player.body.onGround).toBe(true);
    expect(r.playerY).toBe(13 * 16 - 12);
  });

  it('a morph bomb opens a brick and bomb-jumps the ball', () => {
    let minY = Infinity;
    const r = run(
      field({ 12: at(10, '=') }, 9),
      ball((w, f) => {
        if (f > 10) minY = Math.min(minY, w.player.body.y);
        return f === 5 ? ['attack'] : [];
      }),
      120,
    );
    expect(r.world.map.get(10, 12)).toBe(T.AIR);
    expect(r.world.player.hp).toBe(START_ENERGY); // her own bombs never hurt her
    expect((13 * 16 - 12) * 256 - minY).toBeGreaterThan(8 * 256);
  });

  it('the Power Beam fizzles short of a far goomba that the Long Beam reaches', () => {
    const far = field({ 12: at(16, 'g') });
    expect(run(far, shootAt(3), 80).score).toBe(0);
    expect(run(far, shootAt(3), 80, { beam: 1 }).score).toBeGreaterThanOrEqual(100);
  });

  it('the Ice Beam freezes a goomba and a second shot shatters it', () => {
    const r = run(
      field({ 12: at(10, 'g') }),
      (w, f) => {
        const g = w.entities.find((e): e is Goomba => e instanceof Goomba);
        if (f === 3) return ['attack'];
        if (g && g.stunned > 0 && f === 40) return ['attack'];
        return [];
      },
      120,
      { beam: 2 },
    );
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(liveGoombas(r.world)).toBe(0);
    expect(r.world.player.hp).toBe(START_ENERGY);
  });

  it('the Wave Beam passes through a wall the Long Beam cannot', () => {
    const walled = field({
      9: at(8, '#'),
      10: at(8, '#'),
      11: at(8, '#'),
      12: at(8, '#').slice(0, 12) + 'g' + '.'.repeat(35),
    });
    expect(run(walled, shootAt(3), 120, { beam: 1 }).score).toBe(0);
    expect(run(walled, shootAt(3), 120, { beam: 3 }).score).toBeGreaterThanOrEqual(100);
  });

  it('missiles hit hard, spend ammo and refuse when empty', () => {
    const r = run(field({ 12: at(12, 'g') }), (_w, f) => (f === 3 ? ['special'] : []), 90, { missiles: 2 });
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.player.scratch.missiles).toBe(1);
    const empty = run(field(), (_w, f) => (f === 3 ? ['special'] : []), 10, { missiles: 0 });
    expect(empty.world.entities.some((e) => e instanceof Projectile)).toBe(false);
  });

  it('aiming up shoots a goomba falling from above', () => {
    const r = run(
      field(),
      (w, f) => {
        const b = w.player.body;
        if (f === 1) w.spawn(new Goomba(b.x, b.y - 60 * 256));
        return f === 3 ? ['up', 'attack'] : ['up'];
      },
      60,
    );
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.player.hp).toBe(START_ENERGY);
  });

  it('the Varia suit halves contact damage', () => {
    const firstHit = (kit: Record<string, number>) =>
      runSim({
        level: field({ 12: at(12, 'g') }),
        character: SAMUS,
        script: { steps: [] },
        maxFrames: 400,
        controller: () => ['right'],
        state: { kit, hp: START_ENERGY },
        until: (w) => w.player.invuln > 0,
      }).world.player.hp;
    expect(firstHit({})).toBe(START_ENERGY - 8);
    expect(firstHit({ varia: 1 })).toBe(START_ENERGY - 4);
  });

  it('mushrooms give the Varia suit, then energy tanks', () => {
    const r = run(
      field(),
      (w, f) => {
        const b = w.player.body;
        if (f === 1 || f === 40 || f === 80) w.spawn(new PowerUp(b.x >> 12, (b.y >> 12) + 1, 'mushroom'));
        return [];
      },
      140,
    );
    const p = r.world.player;
    expect(p.scratch.varia).toBe(1);
    expect(p.scratch.tanks).toBe(2);
    expect(p.hp).toBe(90);
  });

  it('drops refill energy and missiles', () => {
    const r = run(
      field(),
      (w, f) => {
        if (f === 1) {
          const b = w.player.body;
          w.spawn(new Pickup(b.x + 24 * 256, b.y + b.h, 'energy-small'));
          w.spawn(new Pickup(b.x + 44 * 256, b.y + b.h, 'missile-pack'));
        }
        return ['right'];
      },
      120,
      {},
      10,
    );
    expect(r.world.player.hp).toBe(15);
    expect(r.world.player.scratch.missiles).toBe(2);
  });

  it('the full kit from the dev menu fits the belt', () => {
    const r = run(field(), () => [], 2, FULL, 90);
    expect(SAMUS.tools?.(r.world.player).map((t) => t.count)).toEqual([null, 30]);
  });
});
