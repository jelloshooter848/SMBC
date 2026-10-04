import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { BILL, START_HITS } from '@game/characters/bill';
import { Goomba } from '@game/entities/enemies/goomba';
import { PowerUp } from '@game/entities/objects/powerup';
import { Pickup } from '@game/entities/objects/pickup';
import { Projectile } from '@game/entities/projectiles/projectile';
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
const FULL = { guns: 4, maxHp: 5 };
const TOOL = { rifle: 0, mg: 1, spread: 2, laser: 3, flame: 4 };

function run(
  level: ReturnType<typeof field>,
  controller: Ctl,
  frames: number,
  kit: Record<string, number> = {},
  hp = START_HITS,
) {
  return runSim({
    level,
    character: BILL,
    script: { steps: [] },
    maxFrames: frames,
    controller,
    state: { kit, hp },
  });
}
const freeze = (w: World, f: number) => {
  if (f === 1) for (const e of w.entities) if (e instanceof Goomba) e.stunned = 100000;
};
const shots = (w: World) => w.entities.filter((e) => e instanceof Projectile && e.alive) as Projectile[];
const liveGoombas = (w: World) => w.entities.filter((e) => e instanceof Goomba && e.alive).length;

describe("Bill's kit", () => {
  it('aims straight up at a goomba overhead', () => {
    const r = run(
      field(),
      (w, f) => {
        if (f === 1) {
          const b = w.player.body;
          const g = new Goomba(b.x, b.y - 70 * 256);
          g.stunned = 100000;
          w.spawn(g);
        }
        return f === 3 ? ['up', 'attack'] : ['up'];
      },
      60,
    );
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.player.hp).toBe(START_HITS);
  });

  it('aims diagonally down while jumping and straight along the floor when prone', () => {
    // A frozen goomba two tiles ahead: hit from a jump by firing down-right.
    let shotFired = false;
    const dive = run(
      field({ 12: at(6, 'g') }),
      (w, f) => {
        freeze(w, f);
        if (f === 3) return ['jump'];
        const b = w.player.body;
        if (!b.onGround && b.vy > 0 && !shotFired) {
          shotFired = true;
          return ['right', 'down', 'attack'];
        }
        return [];
      },
      120,
    );
    expect(shotFired).toBe(true);
    expect(dive.score).toBeGreaterThanOrEqual(100);
    // Prone: the shot leaves at knee height and the hitbox is 8 px tall.
    const prone = run(
      field({ 12: at(8, 'g') }),
      (w, f) => {
        freeze(w, f);
        if (f === 2) return ['down'];
        if (f === 6) {
          expect(w.player.body.h).toBe(8 * 256);
          return ['down', 'attack'];
        }
        return ['down'];
      },
      90,
    );
    expect(prone.score).toBeGreaterThanOrEqual(100);
  });

  it('the machine gun keeps firing while held; the rifle needs taps', () => {
    const held = (kit: Record<string, number>) =>
      run(field(), () => ['attack'], 40, kit).world.entities.filter((e) => e instanceof Projectile).length;
    expect(held({})).toBe(1);
    expect(held({ ...FULL, tool: TOOL.mg })).toBeGreaterThanOrEqual(5);
  });

  it('the spread gun fans five shots', () => {
    const r = run(field(), (_w, f) => (f === 3 ? ['attack'] : []), 5, { ...FULL, tool: TOOL.spread });
    const s = shots(r.world);
    expect(s.length).toBe(5);
    expect(new Set(s.map((p) => p.body.vy)).size).toBe(5);
  });

  it('the laser pierces a whole line of goombas', () => {
    const line = field({ 12: at(8, 'g').slice(0, 10) + 'g' + '.'.repeat(1) + 'g' + '.'.repeat(35) });
    const r = run(
      line,
      (w, f) => {
        freeze(w, f);
        return f === 3 ? ['attack'] : [];
      },
      60,
      { ...FULL, tool: TOOL.laser },
    );
    expect(liveGoombas(r.world)).toBe(0);
    expect(r.score).toBeGreaterThanOrEqual(300);
  });

  it('the flame thrower kills and flowers unlock the guns in order', () => {
    const r = run(field({ 12: at(8, 'g') }), (_w, f) => (f === 3 ? ['attack'] : []), 120, {
      ...FULL,
      tool: TOOL.flame,
    });
    expect(r.score).toBeGreaterThanOrEqual(100);
    const u = run(
      field(),
      (w, f) => {
        const b = w.player.body;
        if (f === 1 || f === 40) w.spawn(new PowerUp(b.x >> 12, (b.y >> 12) + 1, 'flower'));
        return [];
      },
      80,
    );
    expect(BILL.tools?.(u.world.player).map((t) => t.id)).toEqual(['rifle', 'mg', 'spread']);
    expect(u.world.player.scratch.tool).toBe(2); // the newest gun is selected
  });

  it('mushrooms add a hit up to five and a capsule drop unlocks the next gun', () => {
    const r = run(
      field(),
      (w, f) => {
        const b = w.player.body;
        if (f === 1 || f === 30 || f === 60) w.spawn(new PowerUp(b.x >> 12, (b.y >> 12) + 1, 'mushroom'));
        if (f === 90) w.spawn(new Pickup(b.x + 30 * 256, b.y + b.h, 'capsule'));
        return f > 90 ? ['right'] : [];
      },
      160,
    );
    const p = r.world.player;
    expect(p.scratch.maxHp).toBe(5);
    expect(p.hp).toBe(5);
    expect(p.scratch.guns).toBe(1);
  });

  it('a hit costs one of three and the third is fatal', () => {
    const r = runSim({
      level: field({ 12: at(10, 'g') }),
      character: BILL,
      script: { steps: [] },
      maxFrames: 400,
      controller: () => ['right'],
      until: (w) => w.player.invuln > 0,
    });
    expect(r.world.player.hp).toBe(START_HITS - 1);
    const dead = run(field({ 12: at(10, 'g') }), () => ['right'], 400, {}, 1);
    expect(dead.outcome).toBe('died');
  });
});
