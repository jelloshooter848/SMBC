import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { RYU, MAX_HP, START_NINPO } from '@game/characters/ryu';
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
const FULL = { arts: 4, ninpoMax: 99, ninpo: 99 };
const TOOL = { star: 0, windmill: 1, wheel: 2, slash: 3 };
/** A wall from the floor up to row 4 (9 tiles tall) at column 8. */
const tallWall = () =>
  field(Object.fromEntries([4, 5, 6, 7, 8, 9, 10, 11, 12].map((y) => [y, at(8, '#')])), 4);

function run(
  level: ReturnType<typeof field>,
  controller: Ctl,
  frames: number,
  kit: Record<string, number> = {},
) {
  return runSim({
    level,
    character: RYU,
    script: { steps: [] },
    maxFrames: frames,
    controller,
    state: { kit },
  });
}
const enemyAhead = (w: World) => {
  let best = Infinity;
  for (const e of w.entities) {
    if (!(e instanceof Goomba) || !e.alive) continue;
    const dx = (e.body.x - (w.player.body.x + w.player.body.w)) / 256;
    if (dx > -8 && dx < best) best = dx;
  }
  return best;
};

describe("Ryu's kit", () => {
  it('clings to a wall while holding toward it', () => {
    let clingFrames = 0;
    const yWhileClinging = new Set<number>();
    run(
      tallWall(),
      (w, f) => {
        if (w.player.clinging) {
          clingFrames++;
          yWhileClinging.add(w.player.body.y);
        }
        return f >= 20 && f < 24 ? ['right', 'jump'] : ['right'];
      },
      150,
    );
    expect(clingFrames).toBeGreaterThan(60);
    expect(yWhileClinging.size).toBe(1); // no sliding
  });

  it('chains wall jumps to climb a nine-tile wall', () => {
    let minY = Infinity;
    let clingFrames = 0;
    let leap = -1;
    const r = run(
      tallWall(),
      (w, f) => {
        const p = w.player;
        minY = Math.min(minY, p.body.y);
        clingFrames = p.clinging ? clingFrames + 1 : 0;
        if (leap < 0 && p.body.onGround && p.body.x > 96 * 256) leap = f; // leap at the wall...
        if (leap >= 0 && f - leap < 20 && !p.clinging) return ['right', 'jump']; // ...holding the jump
        // Each time he grabs the wall: let go of the button for a frame, then press it to kick off.
        return clingFrames === 2 ? ['right', 'jump'] : ['right'];
      },
      600,
    );
    expect((13 * 16 - 24) * 256 - minY).toBeGreaterThan(9 * 16 * 256);
    expect(r.playerX).toBeGreaterThan(8 * 16); // ended up past the wall
  });

  it('the sword kills a goomba', () => {
    const r = run(
      field({ 12: at(12, 'g') }),
      (w) => (enemyAhead(w) < 12 ? (w.player.attackTimer === 0 ? ['attack'] : []) : ['right']),
      300,
    );
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.player.hp).toBe(MAX_HP);
  });

  it('a throwing star costs 3 ninpo and refuses when too low', () => {
    const r = run(field({ 12: at(12, 'g') }), (_w, f) => (f === 3 ? ['special'] : []), 90, { arts: 1 });
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.player.scratch.ninpo).toBe(START_NINPO - 3);
    const dry = run(field(), (_w, f) => (f === 3 ? ['special'] : []), 10, { arts: 1, ninpo: 2 });
    expect(dry.world.entities.some((e) => e instanceof Projectile)).toBe(false);
  });

  it('the windmill shuriken kills and comes back', () => {
    const r = run(field({ 12: at(10, 'g') }), (_w, f) => (f === 3 ? ['special'] : []), 200, {
      ...FULL,
      tool: TOOL.windmill,
    });
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.entities.some((e) => e instanceof Projectile && e.alive)).toBe(false);
  });

  it('the fire wheel puts three flames around him that burn a goomba walking in', () => {
    const r = run(
      field({ 12: at(9, 'g') }),
      (w, f) => {
        if (f === 3) return ['special'];
        if (f === 6) expect(w.entities.filter((e) => e instanceof Projectile && e.alive).length).toBe(3);
        return [];
      },
      300,
      { ...FULL, tool: TOOL.wheel },
    );
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.player.hp).toBe(MAX_HP);
  });

  it('the jump-and-slash somersault cuts through a goomba on contact', () => {
    let cast = false;
    const r = run(
      field({ 12: at(10, 'g') }),
      (w) => {
        if (!cast && enemyAhead(w) < 12) {
          cast = true;
          return ['right', 'special'];
        }
        return ['right'];
      },
      200,
      { ...FULL, tool: TOOL.slash },
    );
    expect(cast).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.player.hp).toBe(MAX_HP);
  });

  it('mushrooms unlock arts in order and flowers grow the ninpo meter', () => {
    const r = run(
      field(),
      (w, f) => {
        const b = w.player.body;
        if (f === 1 || f === 40) w.spawn(new PowerUp(b.x >> 12, (b.y >> 12) + 1, 'mushroom'));
        if (f === 80) w.spawn(new PowerUp(b.x >> 12, (b.y >> 12) + 1, 'flower'));
        return [];
      },
      120,
      { ninpo: 5 },
    );
    const p = r.world.player;
    expect(RYU.tools?.(p).map((t) => t.id)).toEqual(['throwing-star', 'windmill']);
    expect(p.scratch.ninpoMax).toBe(START_NINPO + 20);
    expect(p.scratch.ninpo).toBe(START_NINPO + 20);
  });

  it('drops refill ninpo and health', () => {
    const r = runSim({
      level: field(),
      character: RYU,
      script: { steps: [] },
      maxFrames: 150,
      controller: (w, f) => {
        if (f === 1) {
          const b = w.player.body;
          w.spawn(new Pickup(b.x + 24 * 256, b.y + b.h, 'ninpo-small'));
          w.spawn(new Pickup(b.x + 44 * 256, b.y + b.h, 'ninpo-large'));
          w.spawn(new Pickup(b.x + 64 * 256, b.y + b.h, 'health-small'));
        }
        return ['right'];
      },
      state: { kit: { ninpo: 10 }, hp: 8 },
    });
    expect(r.world.player.scratch.ninpo).toBe(25);
    expect(r.world.player.hp).toBe(12);
  });
});
