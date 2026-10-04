import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MEGAMAN, MAX_HP } from '@game/characters/megaman';
import { WEAPONS, WEAPON_ENERGY } from '@game/characters/megaman/weapons';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { PowerUp } from '@game/entities/objects/powerup';
import { Pickup } from '@game/entities/objects/pickup';
import { RushCoil } from '@game/entities/objects/rush-coil';
import { Projectile } from '@game/entities/projectiles/projectile';
import { T } from '@game/level/tiles';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';

function field(rows: Record<number, string> = {}, startX = 8) {
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
const FULL = { helmet: 1, weapons: WEAPONS.length };
/** Belt order: buster, then the five weapons, then Rush. */
const TOOL = { buster: 0, saw: 1, leaf: 2, flame: 3, knuckle: 4, bolt: 5, rush: 6 };

function run(
  level: ReturnType<typeof field>,
  controller: Ctl,
  frames: number,
  kit: Record<string, number> = {},
  hp = MAX_HP,
) {
  return runSim({
    level,
    character: MEGAMAN,
    script: { steps: [] },
    maxFrames: frames,
    controller,
    state: { kit, hp },
  });
}
const fireAt =
  (frame: number): Ctl =>
  (_w, f) =>
    f === frame ? ['special'] : [];

describe("Mega Man's arsenal", () => {
  it('flowers unlock the weapons in order and the helmet adds Rush', () => {
    const r = run(
      field(),
      (w, f) => {
        const b = w.player.body;
        if (f === 1 || f === 40) w.spawn(new PowerUp(b.x >> 12, (b.y >> 12) + 1, 'flower'));
        if (f === 80) w.spawn(new PowerUp(b.x >> 12, (b.y >> 12) + 1, 'mushroom'));
        return [];
      },
      150,
    );
    const p = r.world.player;
    expect(p.scratch.weapons).toBe(2);
    expect(p.scratch.helmet).toBe(1);
    const ids = MEGAMAN.tools?.(p).map((t) => t.id);
    expect(ids).toEqual(['buster', 'saw', 'leaf', 'rush']);
  });

  it('a shot costs energy and an empty weapon refuses to fire', () => {
    const shot = run(field(), fireAt(3), 10, { ...FULL, tool: TOOL.saw });
    expect(shot.world.player.scratch.wsaw).toBe(WEAPON_ENERGY - 2);
    expect(shot.world.entities.some((e) => e instanceof Projectile && e.kind === 'saw')).toBe(true);
    const empty = run(field(), fireAt(3), 10, { ...FULL, tool: TOOL.saw, wsaw: 1 });
    expect(empty.world.player.scratch.wsaw).toBe(1);
    expect(empty.world.entities.some((e) => e instanceof Projectile)).toBe(false);
  });

  it('the saw disc cuts through a brick in its path', () => {
    const r = run(field({ 12: at(12, '=') }), fireAt(3), 60, { ...FULL, tool: TOOL.saw });
    expect(r.world.map.get(12, 12)).toBe(T.AIR);
  });

  it('the flame wave burns a resting shell', () => {
    const r = run(
      field({ 12: at(14, 'k') }),
      (w, f) => {
        const k = w.entities.find((e): e is Koopa => e instanceof Koopa);
        if (f === 1 && k) k.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, w);
        return f === 5 ? ['special'] : [];
      },
      120,
      { ...FULL, tool: TOOL.flame },
    );
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.entities.some((e) => e instanceof Koopa && e.alive)).toBe(false);
  });

  it('the homing knuckle turns around to hit a goomba behind and above', () => {
    const r = run(field({ 8: at(4, 'g'), 9: at(2, '#####') }), fireAt(3), 200, {
      ...FULL,
      tool: TOOL.knuckle,
    });
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.entities.some((e) => e instanceof Goomba && e.alive)).toBe(false);
  });

  it('the bolt reaches a goomba at the far side of the screen almost at once', () => {
    const r = runSim({
      level: field({ 12: at(15, 'g') }, 2),
      character: MEGAMAN,
      script: { steps: [] },
      maxFrames: 40,
      controller: fireAt(3),
      state: { kit: { ...FULL, tool: TOOL.bolt } },
      until: (w) => w.state.score >= 100,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.frames).toBeLessThan(30);
  });

  it('landing on the Rush Coil launches far higher than a jump', () => {
    const apex = (kit: Record<string, number>, rush: boolean) => {
      let minY = Infinity;
      run(
        field(),
        (w, f) => {
          minY = Math.min(minY, w.player.body.y);
          if (rush && f === 2) return ['special']; // coil lands a tile ahead
          if (f >= 4 && f < 40) return f >= 8 && f < 12 ? ['right', 'jump'] : ['right']; // short hop onto it
          return [];
        },
        120,
        kit,
      );
      return (13 * 16 - 22) * 256 - minY;
    };
    const plain = apex({}, false);
    const launched = apex({ ...FULL, tool: TOOL.rush }, true);
    expect(launched).toBeGreaterThan(plain * 1.4);
  });

  it('pickups heal, refill the selected weapon and store an E-tank used from reserve', () => {
    const r = run(
      field(),
      (w, f) => {
        if (f === 1) {
          const b = w.player.body;
          w.spawn(new Pickup(b.x + 24 * 256, b.y + b.h, 'health-small'));
          w.spawn(new Pickup(b.x + 44 * 256, b.y + b.h, 'weapon-small'));
          w.spawn(new Pickup(b.x + 64 * 256, b.y + b.h, 'e-tank'));
        }
        return ['right'];
      },
      120,
      { ...FULL, tool: TOOL.saw, wsaw: 10 },
      10,
    );
    const p = r.world.player;
    expect(p.hp).toBe(14);
    expect(p.scratch.wsaw).toBe(14);
    expect(p.scratch.etanks).toBe(1);
    expect(MEGAMAN.reserve?.label(p)).toBe('Use E-tank (1)');
    expect(MEGAMAN.reserve?.use(p, r.world)).toBe(true);
    expect(p.hp).toBe(MAX_HP);
    expect(p.scratch.etanks).toBe(0);
    expect(r.world.entities.some((e) => e instanceof RushCoil)).toBe(false);
  });

  it('bricks only break once the helmet is on', () => {
    const bump = (kit: Record<string, number>) =>
      run(field({ 9: at(8, '=') }), (_w, f) => (f >= 2 && f < 20 ? ['jump'] : []), 60, kit).world.map.get(
        8,
        9,
      );
    expect(bump({})).not.toBe(T.AIR);
    expect(bump({ helmet: 1 })).toBe(T.AIR);
  });
});
