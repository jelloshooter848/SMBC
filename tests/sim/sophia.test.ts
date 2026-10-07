import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { SOPHIA } from '@game/characters/sophia';
import { CannonShot } from '@game/characters/sophia/weapons';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { BulletBill } from '@game/entities/enemies/bullet-bill';
import { T } from '@game/level/tiles';
import { px, toPx } from '@engine/math/units';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';

/*
 * Sophia III (bug-reports/2026-10-07-sophia-build-classic-character.md): her physics numbers
 * from the spec and every ability, on our current systems.
 */

const W = 48;
function field(rows: Record<number, string> = {}, startX = 2, extra: string[] = []) {
  const base = Array.from({ length: 13 }, () => '.'.repeat(W));
  for (const [y, row] of Object.entries(rows)) base[Number(y)] = row;
  return parseTextMap(
    [
      'id: t',
      'time: 300',
      `start: ${startX},12`,
      ...extra,
      '',
      '[tiles]',
      ...base,
      '#'.repeat(W),
      '#'.repeat(W),
    ].join('\n'),
  );
}
const at = (col: number, ch: string) => '.'.repeat(col) + ch + '.'.repeat(W - col - ch.length);
type Ctl = (w: World, f: number) => Action[];

function run(
  level: ReturnType<typeof field>,
  controller: Ctl,
  frames: number,
  opts: { power?: string; kit?: Record<string, number>; until?: (w: World, f: number) => boolean } = {},
) {
  return runSim({
    level,
    character: SOPHIA,
    script: { steps: [] },
    maxFrames: frames,
    controller,
    state: { kit: opts.kit ?? {}, powerState: opts.power ?? 'small' },
    ...(opts.until ? { until: opts.until } : {}),
  });
}

const shots = (w: World) => w.entities.filter((e): e is CannonShot => e instanceof CannonShot && e.alive);
const freeze = (w: World) => {
  for (const e of w.entities) if (e instanceof Goomba || e instanceof Koopa) e.stunned = 100000;
};

describe('Sophia III: the definition', () => {
  it('is a power-up hero (Normal, Hyper, Crusher) with the wide 19 x 15.5 box, no stomp, no crouch', () => {
    expect(SOPHIA.damage).toEqual({ kind: 'powerup', states: ['small', 'big', 'fire'] });
    expect(SOPHIA.stomps).toBe(false);
    expect(SOPHIA.crouches).toBe(false);
    const r = run(field(), () => [], 2);
    const b = r.world.player.body;
    expect(b.w).toBe(px(19));
    expect(b.h).toBe(px(15.5));
    expect(SOPHIA.canBreakBricks(r.world.player)).toBe(false);
  });
});

describe('Sophia III: driving (SO-9, SO-10)', () => {
  it('reaches 1.5417 px/f in 14 frames from rest and never more', () => {
    const speeds: number[] = [];
    run(
      field(),
      (w, f) => {
        if (f >= 2) speeds.push(w.player.body.vx);
        return f >= 1 ? ['right'] : [];
      },
      60,
    );
    expect(speeds[12]).toBeLessThan(0x018ab);
    expect(speeds[13]).toBe(0x018ab);
    expect(Math.max(...speeds)).toBe(0x018ab);
  });

  it('rolls about 13 px and stops within 32 frames after letting go at full speed', () => {
    let x0 = 0;
    let stopF = -1;
    const r = run(
      field(),
      (w, f) => {
        if (f === 40) x0 = w.player.body.x;
        if (f > 40 && stopF < 0 && w.player.body.vx === 0) stopF = f - 40;
        return f < 40 ? ['right'] : [];
      },
      100,
    );
    expect(stopF).toBeGreaterThan(0);
    expect(stopF).toBeLessThanOrEqual(33);
    expect(toPx(r.world.player.body.x - x0)).toBeGreaterThanOrEqual(11);
    expect(toPx(r.world.player.body.x - x0)).toBeLessThanOrEqual(15);
  });

  it('keeps her speed in the air with nothing held', () => {
    let vxAir = 0;
    run(
      field(),
      (w, f) => {
        if (f === 52) vxAir = w.player.body.vx;
        if (f === 40) return ['right', 'jump'];
        // Through the squat she still drives; off the ground, nothing is held.
        if (f <= 44) return ['right'];
        return [];
      },
      53,
    );
    expect(vxAir).toBe(0x018ab);
  });
});

/** Jump from rest (or driving): the take-off frame, the apex height and its frame after take-off. */
function jump(hold: number, drive = false) {
  let press = -1;
  let takeoff = -1;
  let feet0 = 0;
  let apex = 0;
  let apexF = -1;
  run(
    field(),
    (w, f) => {
      const b = w.player.body;
      if (takeoff < 0 && press >= 0 && b.vy < 0) {
        takeoff = f - 1;
        feet0 = b.y + b.h + 0x03555 / 16;
      }
      if (takeoff >= 0) {
        const h = (feet0 - (b.y + b.h)) / 256;
        if (h > apex) {
          apex = h;
          apexF = f - 1 - takeoff;
        }
      }
      const d: Action[] = drive && f >= 1 ? ['right'] : [];
      if (f === 30) press = f;
      if (press >= 0 && f < press + hold) return [...d, 'jump'];
      return d;
    },
    120,
  );
  return { squat: takeoff - press, apex, apexF };
}

describe('Sophia III: the squat and the constant-rise jump (SO-12 to SO-14)', () => {
  it('a tap: 4 frames of squat, then about 45 px at frame 18', () => {
    const j = jump(1);
    expect(j.squat).toBe(4);
    expect(j.apex).toBeGreaterThanOrEqual(44);
    expect(j.apex).toBeLessThanOrEqual(46.5);
    expect(Math.abs(j.apexF - 18)).toBeLessThanOrEqual(1);
  });

  it('held: about 72 px at frame 33', () => {
    const j = jump(80);
    expect(j.apex).toBeGreaterThanOrEqual(71);
    expect(j.apex).toBeLessThanOrEqual(73);
    expect(Math.abs(j.apexF - 33)).toBeLessThanOrEqual(1);
  });

  it('is as high driving as standing', () => {
    expect(Math.round(jump(80, true).apex)).toBe(Math.round(jump(80).apex));
    expect(Math.round(jump(1, true).apex)).toBe(Math.round(jump(1).apex));
  });

  it('a head bump strikes every block over her (two bricks side by side)', () => {
    // Bricks at columns 2 and 3 over her (her 19 px box spans both).
    const bumped = new Set<number>();
    run(
      field({ 9: at(2, '==') }),
      (w, f) => {
        for (const x of [2, 3]) if (w.map.get(x, 9) !== T.BRICK) bumped.add(x);
        return f === 5 ? ['jump'] : [];
      },
      40,
    );
    expect([...bumped].sort()).toEqual([2, 3]);
  });
});

describe('Sophia III: the cannon (SO-28, SO-29)', () => {
  it('three shots at most on screen; a shot flies at 3.5417 px/f', () => {
    let maxOut = 0;
    let speed = 0;
    run(
      field(),
      (w, f) => {
        maxOut = Math.max(maxOut, shots(w).length);
        const s = shots(w)[0];
        if (s) speed = s.body.vx;
        return f % 2 === 0 && f < 20 ? ['attack'] : [];
      },
      22,
    );
    expect(maxOut).toBe(3);
    expect(speed).toBe(0x038ab);
  });

  it('up held 9 frames fires straight up; 8 frames still fires ahead', () => {
    const dir = (held: number) => {
      let v: [number, number] | null = null;
      run(
        field(),
        (w, f) => {
          const s = shots(w)[0];
          if (s && !v) v = [s.body.vx, s.body.vy];
          if (f >= 5 && f < 5 + held) return ['up'];
          if (f === 5 + held) return ['up', 'attack'];
          return [];
        },
        30,
      );
      return v;
    };
    expect(dir(8)).toEqual([0x038ab, 0]);
    expect(dir(9)).toEqual([0, -0x038ab]);
  });

  it('a shot kills a Goomba; a Buzzy Beetle and a Bullet Bill shrug it off', () => {
    const r = run(
      field(),
      (w, f) => {
        if (f === 1) {
          const b = w.player.body;
          w.spawn(new Goomba(b.x + px(48), b.y + b.h - px(14)));
          freeze(w);
        }
        return f === 4 ? ['attack'] : [];
      },
      40,
    );
    expect(r.world.entities.some((e) => e instanceof Goomba && e.alive)).toBe(false);
    for (const make of [
      (x: number, y: number) => new Koopa(x, y - px(8), 'buzzy'),
      (x: number, y: number) => new BulletBill(x, y - px(8), -1),
    ]) {
      let foe: ReturnType<typeof make> | null = null;
      run(
        field(),
        (w, f) => {
          if (f === 1) {
            const b = w.player.body;
            foe = make(b.x + px(48), b.y + b.h - px(8));
            foe.body.vx = 0;
            w.spawn(foe);
            freeze(w);
          }
          if (foe) foe.body.vx = 0;
          return f === 4 ? ['attack'] : [];
        },
        40,
      );
      expect((foe as unknown as { alive: boolean }).alive).toBe(true);
    }
  });

  it('a brick takes two Normal shots, one Hyper shot', () => {
    const wall = field({ 11: at(8, '='), 12: at(8, '=') });
    const normal = run(wall, (_w, f) => (f === 3 || f === 30 ? ['attack'] : []), 26);
    expect(normal.world.map.get(8, 12)).not.toBe(T.AIR);
    const normal2 = run(wall, (_w, f) => (f === 3 || f === 30 ? ['attack'] : []), 60);
    expect(normal2.world.map.get(8, 12)).toBe(T.AIR);
    const hyper = run(wall, (_w, f) => (f === 3 ? ['attack'] : []), 26, { power: 'big' });
    expect(hyper.world.map.get(8, 12)).toBe(T.AIR);
  });
});

describe('Sophia III: hits (SO-23, SO-41)', () => {
  it('landing on a Goomba hurts her; a hit at Crusher leaves her Normal, keeping missiles; the next kills', () => {
    const r = run(
      field(),
      (w, f) => {
        if (f === 1) {
          const b = w.player.body;
          w.spawn(new Goomba(b.x + px(4), b.y + b.h - px(14)));
        }
        for (const e of w.entities) if (e instanceof Goomba) e.body.vx = 0;
        return [];
      },
      10,
      { power: 'fire', kit: { hasTriple: 1, triple: 9 } },
    );
    const p = r.world.player;
    expect(p.powerState).toBe('small');
    expect(p.scratch.triple).toBe(9);
    expect(p.invuln).toBeGreaterThan(0);
    const dead = run(
      field(),
      (w, f) => {
        if (f === 1) {
          const b = w.player.body;
          w.spawn(new Goomba(b.x + px(4), b.y + b.h - px(14)));
        }
        for (const e of w.entities) if (e instanceof Goomba) e.body.vx = 0;
        return [];
      },
      10,
    );
    expect(dead.world.player.dead).toBe(true);
  });
});
