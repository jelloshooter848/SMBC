import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { SIMON, START_HEARTS } from '@game/characters/simon';
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
const FULL = { whip: 2, subs: 5, multi: 3, hearts: 99 };
/** Belt order once everything is unlocked. */
const TOOL = { dagger: 0, axe: 1, water: 2, cross: 3, watch: 4 };

function run(
  level: ReturnType<typeof field>,
  controller: Ctl,
  frames: number,
  kit: Record<string, number> = {},
) {
  return runSim({
    level,
    character: SIMON,
    script: { steps: [] },
    maxFrames: frames,
    controller,
    state: { kit },
  });
}
/** Freeze every goomba in place on frame 1 so distances stay exact. */
const freezeGoombas = (w: World, f: number) => {
  if (f === 1) for (const e of w.entities) if (e instanceof Goomba) e.stunned = 100000;
};
const liveGoombas = (w: World) => w.entities.filter((e) => e instanceof Goomba && e.alive).length;

describe("Simon's kit", () => {
  it('the whip reaches further with each upgrade', () => {
    // A frozen goomba stands 28 px past the hitbox: out of the leather whip's 16 px, within the star's 32.
    const lash = (kit: Record<string, number>) =>
      run(
        field({ 12: at(4, 'g') }),
        (w, f) => {
          freezeGoombas(w, f);
          if (f === 1) {
            const g = w.entities.find((e): e is Goomba => e instanceof Goomba);
            if (g) g.body.x = w.player.body.x + w.player.body.w + 28 * 256;
          }
          return f === 3 ? ['attack'] : [];
        },
        40,
        kit,
      ).score;
    expect(lash({})).toBe(0);
    expect(lash({ whip: 2 })).toBeGreaterThanOrEqual(100);
  });

  it('the jump is committed: holding back in the air does not steer', () => {
    let vxAtApex = 0;
    const r = run(
      field(),
      (w, f) => {
        if (f < 30) return ['right'];
        if (f === 30) return ['right', 'jump'];
        if (!w.player.body.onGround && w.player.body.vy >= 0 && vxAtApex === 0) vxAtApex = w.player.body.vx;
        return ['left'];
      },
      90,
    );
    expect(vxAtApex).toBeGreaterThan(0);
    expect(r.playerX).toBeGreaterThan(2 * 16 + 30);
  });

  it('a dagger kills and costs a heart; no hearts, no throw', () => {
    const r = run(field({ 12: at(12, 'g') }), (_w, f) => (f === 3 ? ['special'] : []), 90, { subs: 1 });
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.player.scratch.hearts).toBe(START_HEARTS - 1);
    const broke = run(field(), (_w, f) => (f === 3 ? ['special'] : []), 10, { subs: 1, hearts: 0 });
    expect(broke.world.entities.some((e) => e instanceof Projectile)).toBe(false);
  });

  it('the axe arcs up onto a goomba standing on a wall', () => {
    const wall = Object.fromEntries([8, 9, 10, 11, 12].map((y) => [y, at(7, '##')]));
    const r = run(
      field({ ...wall, 7: at(8, 'g') }),
      (w, f) => {
        freezeGoombas(w, f);
        return f === 3 ? ['special'] : [];
      },
      150,
      { ...FULL, tool: TOOL.axe },
    );
    expect(r.score).toBeGreaterThanOrEqual(100);
  });

  it('holy water bursts into a flame that burns what stands in it', () => {
    const r = run(
      field({ 12: at(5, 'g') }),
      (w, f) => {
        freezeGoombas(w, f);
        return f === 3 ? ['special'] : [];
      },
      150,
      { ...FULL, tool: TOOL.water },
    );
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(liveGoombas(r.world)).toBe(0);
  });

  it('the cross flies out, kills, and comes back to vanish', () => {
    const r = run(field({ 12: at(8, 'g') }), (_w, f) => (f === 3 ? ['special'] : []), 200, {
      ...FULL,
      tool: TOOL.cross,
    });
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.entities.some((e) => e instanceof Projectile && e.alive)).toBe(false);
  });

  it('the stopwatch freezes every enemy on screen for five hearts', () => {
    const three = field({ 12: at(8, 'g').slice(0, 11) + 'g' + '.'.repeat(2) + 'g' + '.'.repeat(33) });
    const r = run(three, (_w, f) => (f === 5 ? ['special'] : []), 10, {
      ...FULL,
      tool: TOOL.watch,
      hearts: 7,
    });
    const goombas = r.world.entities.filter((e): e is Goomba => e instanceof Goomba);
    expect(goombas.length).toBe(3);
    expect(goombas.every((g) => g.stunned > 0)).toBe(true);
    expect(r.world.player.scratch.hearts).toBe(2);
    const poor = run(three, (_w, f) => (f === 5 ? ['special'] : []), 10, {
      ...FULL,
      tool: TOOL.watch,
      hearts: 4,
    });
    expect(
      poor.world.entities.filter((e): e is Goomba => e instanceof Goomba).every((g) => g.stunned === 0),
    ).toBe(true);
  });

  it('triple shot allows three daggers in flight, single shot only one', () => {
    const daggers = (kit: Record<string, number>) =>
      run(
        field(),
        (_w, f) => (f === 3 || f === 17 || f === 31 ? ['special'] : []),
        34,
        kit,
      ).world.entities.filter((e) => e instanceof Projectile && e.alive).length;
    expect(daggers({ subs: 1, hearts: 9, multi: 1 })).toBe(1);
    expect(daggers({ subs: 1, hearts: 9, multi: 3 })).toBe(3);
  });

  it('hearts drop in two sizes and refill the pouch', () => {
    const r = run(
      field(),
      (w, f) => {
        if (f === 1) {
          const b = w.player.body;
          w.spawn(new Pickup(b.x + 24 * 256, b.y + b.h, 'heart-small'));
          w.spawn(new Pickup(b.x + 44 * 256, b.y + b.h, 'heart-large'));
        }
        return ['right'];
      },
      150,
      { hearts: 0 },
    );
    expect(r.world.player.scratch.hearts).toBe(6);
  });

  it('mushrooms unlock sub-weapons in order and flowers lengthen the whip then add shots', () => {
    const r = run(
      field(),
      (w, f) => {
        const b = w.player.body;
        if (f === 1 || f === 40) w.spawn(new PowerUp(b.x >> 12, (b.y >> 12) + 1, 'mushroom'));
        if (f === 80 || f === 120 || f === 160) w.spawn(new PowerUp(b.x >> 12, (b.y >> 12) + 1, 'flower'));
        return [];
      },
      200,
    );
    const p = r.world.player;
    expect(SIMON.tools?.(p).map((t) => t.id)).toEqual(['dagger', 'hand-axe']);
    expect(p.scratch.whip).toBe(2);
    expect(p.scratch.multi).toBe(2);
  });
});
