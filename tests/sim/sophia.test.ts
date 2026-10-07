import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { SOPHIA } from '@game/characters/sophia';
import { CannonShot, HomingMissile, SophiaBoom, TripleMissile } from '@game/characters/sophia/weapons';
import { Corpse } from '@game/entities/effects/effects';
import { sophiaState, CEIL, FLOOR, LEFT, RIGHT } from '@game/characters/sophia/state';
import { Pickup } from '@game/entities/objects/pickup';
import { ParkedTank } from '@game/characters/sophia/jason';
import { getLevel } from '@content/levels';
import { Enemy } from '@game/entities/enemies/enemy';
import type { Player } from '@game/entities/player';
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

describe('Sophia III: the hover (SO-35, SO-55)', () => {
  /** Jump, let go, then press and hold jump again from frame `at`. */
  const hover = (power: string, frames: number, at = 14) => {
    const vys: number[] = [];
    const r = run(
      field(),
      (w, f) => {
        if (f > at + 6) vys.push(w.player.body.vy);
        if (f === 5) return ['jump'];
        if (f > 5 && f < at) return [];
        return f >= at ? ['jump'] : [];
      },
      frames,
      { power },
    );
    return { r, vys };
  };

  it('Hyper: press jump again in the air and she climbs steadily at 0.6875 px/f', () => {
    const { r, vys } = hover('big', 60);
    expect(vys.slice(-20).every((v) => v === -0x00b00)).toBe(true);
    expect(sophiaState(r.world.player).hovering).toBe(true);
  });

  it('Normal has no hover', () => {
    const { r, vys } = hover('small', 60);
    expect(sophiaState(r.world.player).hovering).toBe(false);
    expect(vys.some((v) => v > 0)).toBe(true);
  });

  it('the bar empties after 144 frames of hover; then it refills a cell every 120 frames', () => {
    let empty = -1;
    let firstHover = -1;
    const cells: number[] = [];
    run(
      field(),
      (w, f) => {
        const st = sophiaState(w.player);
        if (st.hovering && firstHover < 0) firstHover = f;
        if (st.cells === 0 && empty < 0) empty = f;
        if (empty >= 0) cells.push(st.cells);
        if (f === 5) return ['jump'];
        if (f > 5 && f < 14) return [];
        return f >= 14 && empty < 0 ? ['jump'] : [];
      },
      600,
      { power: 'big' },
    );
    expect(empty - firstHover).toBeGreaterThanOrEqual(143);
    expect(empty - firstHover).toBeLessThanOrEqual(145);
    const first = cells.indexOf(1);
    expect(first).toBeGreaterThanOrEqual(119);
    expect(first).toBeLessThanOrEqual(121);
    expect(cells.indexOf(2) - first).toBe(120);
  });

  it('the HUD meter shows the bar once she owns the hover; every level starts it full', () => {
    const big = run(field(), () => [], 2, { power: 'big' }).world.player;
    expect(big.def.meter?.(big)).toMatchObject({ value: 8, max: 8, label: 'H' });
    const small = run(field(), () => [], 2).world.player;
    expect(small.def.meter?.(small)).toBeNull();
  });
});

/** A water level: waves on row 2, open water down to the floor. */
function pool(rows: Record<number, string> = {}) {
  return field({ 2: 'w'.repeat(W), ...rows }, 2, ['theme: water']);
}

describe('Sophia III: thrust swimming (SO-18, SO-19)', () => {
  it('with nothing held she sinks half a pixel a frame', () => {
    const ys: number[] = [];
    run(
      pool(),
      (w, f) => {
        if (f === 2) {
          w.player.body.y = px(100);
          w.player.body.vy = 0;
          w.player.body.onGround = false;
        }
        if (f > 3) ys.push(w.player.body.y);
        return [];
      },
      12,
    );
    for (let i = 1; i < ys.length; i++) expect((ys[i] as number) - (ys[i - 1] as number)).toBe(128);
  });

  it('up held thrusts to -1.5833 px/f and no faster; down thrusts down', () => {
    let maxUp = 0;
    run(
      pool(),
      (w, f) => {
        if (f === 2) {
          w.player.body.y = px(150);
          w.player.body.onGround = false;
        }
        if (f > 2) maxUp = Math.min(maxUp, w.player.body.vy);
        return f > 2 ? ['up'] : [];
      },
      40,
    );
    expect(maxUp).toBe(-0x01955);
  });

  it('off the floor her cap is 1.0833 px/f, 1.6667 with jump held; on the sea floor 0.75', () => {
    const cap = (hold: string[], swim: boolean) => {
      let v = 0;
      run(
        pool(),
        (w, f) => {
          if (swim && f % 10 === 0) {
            w.player.body.y = px(120);
            w.player.body.onGround = false;
          }
          v = Math.max(v, w.player.body.vx);
          return ['right', ...hold] as Action[];
        },
        60,
      );
      return v;
    };
    expect(cap([], true)).toBe(0x01155);
    expect(cap(['jump'], true)).toBe(0x01aab);
    expect(cap([], false)).toBe(0x00c00);
  });
});

describe('Sophia III: missiles (SO-30 to SO-32)', () => {
  const missiles = (w: World) => w.entities.filter((e) => e instanceof TripleMissile && e.alive);

  it('a volley is three missiles for 3 ammo; no second volley while one is out', () => {
    let most = 0;
    const r = run(
      field(),
      (w, f) => {
        most = Math.max(most, missiles(w).length);
        return f % 4 === 1 && f < 30 ? ['special'] : [];
      },
      31,
      { kit: { hasTriple: 1, triple: 9 } },
    );
    expect(most).toBe(3);
    expect(r.world.player.scratch.triple).toBe(6);
  });

  it('they fly through a pipe, break the first brick they meet and kill a Buzzy Beetle', () => {
    const r = run(
      field({ 11: at(6, '[]......='), 12: at(6, '{}......=') }),
      (_w, f) => (f === 3 ? ['special'] : []),
      90,
      { kit: { hasTriple: 1, triple: 9 } },
    );
    expect(r.world.map.get(14, 12)).toBe(T.AIR);
    let buzzy: Koopa | null = null;
    run(
      field(),
      (w, f) => {
        if (f === 1) {
          const b = w.player.body;
          buzzy = new Koopa(b.x + px(60), b.y + b.h - px(24), 'buzzy');
          w.spawn(buzzy);
        }
        if (buzzy) buzzy.body.vx = 0;
        return f === 4 ? ['special'] : [];
      },
      90,
      { kit: { hasTriple: 1, triple: 9 } },
    );
    expect((buzzy as unknown as Koopa).alive).toBe(false);
  });

  it('down + special switches to the Homing Missile, which fires only at a target and homes in', () => {
    let hit = false;
    let fired = 0;
    const r = run(
      field(),
      (w, f) => {
        fired = Math.max(fired, w.entities.filter((e) => e instanceof HomingMissile).length);
        if (f === 10) {
          const b = w.player.body;
          const g = new Goomba(b.x + px(80), b.y - px(40));
          g.body.vx = 0;
          w.spawn(g);
        }
        for (const e of w.entities) if (e instanceof Goomba) e.body.vx = 0;
        if (f > 12 && !w.entities.some((e) => e instanceof Goomba && e.alive)) hit = true;
        if (f === 2) return ['down', 'special'];
        if (f === 5) return ['special']; // no target yet: nothing
        return f === 14 ? ['special'] : [];
      },
      150,
      { kit: { hasTriple: 1, triple: 9, hasHoming: 1, homing: 3 } },
    );
    expect(r.world.player.scratch.tool).toBe(1);
    expect(r.world.player.scratch.homing).toBe(2);
    expect(fired).toBe(1);
    expect(hit).toBe(true);
  });

  it('the Flower at Crusher adds 12 Triple ammo; a kill can drop missile ammo only once she has missiles', () => {
    const p = run(field(), () => [], 2, { power: 'fire', kit: { hasTriple: 1, triple: 9 } }).world.player;
    const world = { addScore() {}, audio: { sfx() {} } } as unknown as World;
    p.def.behaviour.onPowerUp(p, 'flower', world);
    expect(p.scratch.triple).toBe(21);
    const rng = { int: () => 0 } as unknown as World['rng'];
    const bare = run(field(), () => [], 2).world.player;
    expect(bare.def.drop?.(rng, {} as never, bare)).toBeNull();
    expect(p.def.drop?.(rng, {} as never, p)).toBe('triple-ammo');
    expect(p.def.behaviour.onPickup?.(p, 'triple-ammo', world)).toBe(true);
    expect(p.scratch.triple).toBe(27);
    // The drop lies there as her own pickup.
    expect(new Pickup(0, 0, 'triple-ammo').item).toBe('triple-ammo');
  });
});

describe('Sophia III: kills, deaths and the rest (SO-23, SO-34, SO-43)', () => {
  it('a shot kill shows her explosion, not the flipped corpse', () => {
    let boom = false;
    let corpse = false;
    run(
      field(),
      (w, f) => {
        if (f === 1) {
          const b = w.player.body;
          w.spawn(new Goomba(b.x + px(40), b.y + b.h - px(14)));
        }
        for (const e of w.entities) {
          if (e instanceof Goomba) e.body.vx = 0;
          if (e instanceof SophiaBoom) boom = true;
          if (e instanceof Corpse) corpse = true;
        }
        return f === 3 ? ['attack'] : [];
      },
      40,
    );
    expect(boom).toBe(true);
    expect(corpse).toBe(false);
  });

  it('dying, she blows up (die-0..3) and is gone; a Star fills the hover bar', () => {
    const r = run(field(), () => [], 3);
    const p = r.world.player;
    r.world.kill(p);
    const frames = [0, 4, 8, 12, 20].map((t) => p.def.sprite(p, 100 + t, true).frame);
    expect(frames).toEqual(['die-0', 'die-1', 'die-2', 'die-3', 'none']);
    const big = run(field(), () => [], 2, { power: 'big' }).world.player;
    sophiaState(big).cells = 2;
    const world = { addScore() {}, audio: { playMusic() {}, sfx() {} } } as unknown as World;
    big.def.behaviour.onPowerUp(big, 'star', world);
    expect(sophiaState(big).cells).toBe(8);
  });

  it('a red spring throws her up past her own jump; she lands and drives on', () => {
    let top = Infinity;
    const r = run(
      field({ 12: at(6, 'Z') }, 2, ['', '[legend]', 'Z @spring']),
      (w, f) => {
        if (f === 1) {
          w.player.body.x = px(6 * 16 - 1);
          w.player.body.y = px(140);
        }
        if (f > 10) top = Math.min(top, toPx(w.player.body.y));
        return f > 60 ? ['right'] : [];
      },
      200,
    );
    expect(208 - 32 - top).toBeGreaterThan(40);
    expect(r.world.player.dead).toBe(false);
    expect(r.world.player.body.onGround).toBe(true);
    expect(toPx(r.world.player.body.x)).toBeGreaterThan(8 * 16);
  });
});

/** Solid hard blocks down column `x` from row `y0` to `y1` (into `rows`). */
function column(x: number, y0: number, y1: number, rows: Record<number, string> = {}) {
  for (let y = y0; y <= y1; y++) {
    const r = rows[y] ?? '.'.repeat(W);
    rows[y] = r.slice(0, x) + 'B' + r.slice(x + 1);
  }
  return rows;
}

describe('Sophia III: wall and ceiling climbing (SO-36, SO-37)', () => {
  it('Crusher: right + up into a wall turns up it in 12 frames at full speed; at its top she wraps over in 14', () => {
    const log: { f: number; s: number; turn: boolean; vy: number; y: number }[] = [];
    const r = run(
      field(column(8, 10, 12)),
      (w, f) => {
        const st = sophiaState(w.player);
        log.push({ f, s: st.surface, turn: st.turn !== null, vy: w.player.body.vy, y: w.player.body.y });
        return f > 2 ? ['right', 'up'] : [];
      },
      110,
      { power: 'fire' },
    );
    const start = log.findIndex((l) => l.turn);
    const end = log.findIndex((l, i) => i > start && !l.turn);
    expect(end - start).toBe(12);
    expect(log[end]?.s).toBe(RIGHT);
    expect(log[end + 1]?.vy).toBe(-0x018ab);
    // Over the top: the second turn (an outside corner) takes 14 frames and leaves her upright.
    const s2 = log.findIndex((l, i) => i > end && l.turn);
    const e2 = log.findIndex((l, i) => i > s2 && !l.turn);
    expect(e2 - s2).toBe(14);
    expect(log[e2]?.s).toBe(FLOOR);
    expect(log.some((l) => l.s === FLOOR && !l.turn && l.y < px(10 * 16 - 15))).toBe(true);
    expect(r.world.player.dead).toBe(false);
  });

  it('Hyper and Normal cannot climb: up into a wall just stops her', () => {
    for (const power of ['small', 'big']) {
      const r = run(field(column(8, 10, 12)), (_w, f) => (f > 2 ? ['right', 'up'] : []), 90, { power });
      expect(sophiaState(r.world.player).surface, power).toBe(FLOOR);
      expect(r.world.player.body.onGround).toBe(true);
    }
  });

  it('coasting up to the top of the wall with nothing held, she stops at its edge', () => {
    const r = run(
      field(column(8, 10, 12)),
      (w, f) => {
        if (f < 3) return [];
        const p = w.player;
        if (sophiaState(p).surface === FLOOR) return ['right', 'up'];
        // On the wall: up until just short of the top, then let go and roll into the edge.
        return p.body.y > px(10 * 16 + 8) ? ['up'] : [];
      },
      140,
      { power: 'fire' },
    );
    const st = sophiaState(r.world.player);
    expect(st.surface).toBe(RIGHT);
    expect(r.world.player.body.y).toBe(px(10 * 16));
    expect(r.world.player.body.vy).toBe(0);
  });

  it('a wall jump between two walls 4 tiles apart grips the far wall', () => {
    const r = run(
      field(column(9, 3, 12, column(4, 3, 12)), 6),
      (_w, f) => (f < 40 ? ['right', 'up'] : f === 40 ? ['jump'] : []),
      90,
      { power: 'fire' },
    );
    const st = sophiaState(r.world.player);
    expect(st.surface).toBe(LEFT);
    expect(st.attached).toBe(true);
    expect(r.world.player.body.x).toBe(px(5 * 16));
  });

  it('down + jump lets go of a wall; she lands upright', () => {
    const r = run(
      field(column(8, 6, 12)),
      (_w, f) => (f < 60 ? ['right', 'up'] : f === 70 ? ['right', 'jump'] : []),
      140,
      { power: 'fire' },
    );
    expect(sophiaState(r.world.player).surface).toBe(FLOOR);
    expect(r.world.player.body.onGround).toBe(true);
    expect(toPx(r.world.player.body.w)).toBe(19);
  });

  const ceiling = () => column(20, 8, 12, { 8: 'B'.repeat(21) + '.'.repeat(W - 21) });

  it('a held jump under a ceiling grips it (no bump); she drives along it and turns down a wall', () => {
    const surfaces = new Set<number>();
    const r = run(
      field(ceiling(), 4),
      (w, f) => {
        surfaces.add(sophiaState(w.player).surface);
        if (f >= 5 && f < 30) return ['jump'];
        return f >= 30 ? ['right'] : [];
      },
      240,
      { power: 'fire' },
    );
    expect([...surfaces].sort()).toEqual([FLOOR, RIGHT, CEIL].sort());
    expect(sophiaState(r.world.player).surface).toBe(RIGHT);
  });

  it('with down held the same jump bumps the block over her and falls back', () => {
    let gripped = false;
    const bricks = { 8: '='.repeat(21) + '.'.repeat(W - 21) };
    const r = run(
      field(bricks, 4),
      (w, f) => {
        if (sophiaState(w.player).surface === CEIL) gripped = true;
        return f >= 5 && f < 30 ? ['jump', 'down'] : [];
      },
      80,
      { power: 'fire' },
    );
    expect(gripped).toBe(false);
    expect(r.world.player.body.onGround).toBe(true);
    // A ceiling grip never bumps: the bricks over her were untouched by the gripping jump.
    const g = run(field(bricks, 4), (_w, f) => (f >= 5 && f < 30 ? ['jump'] : []), 40, { power: 'fire' });
    expect(sophiaState(g.world.player).surface).toBe(CEIL);
    expect(g.world.entities.some((e) => e.kind === 'block-bump')).toBe(false);
  });

  it('down + forward off a ledge wraps down its face and back onto the floor below', () => {
    const plat: Record<number, string> = {};
    for (let y = 9; y <= 12; y++) plat[y] = 'B'.repeat(8) + '.'.repeat(W - 8);
    const level = parseTextMap(
      [
        'id: t',
        'time: 300',
        'start: 2,8',
        '',
        '[tiles]',
        ...Array.from({ length: 13 }, (_, y) => plat[y] ?? '.'.repeat(W)),
        '#'.repeat(W),
        '#'.repeat(W),
      ].join('\n'),
    );
    const surfaces: number[] = [];
    const r = run(
      level,
      (w, f) => {
        const s = sophiaState(w.player).surface;
        if (surfaces.at(-1) !== s) surfaces.push(s);
        return f > 2 ? ['right', 'down'] : [];
      },
      150,
      { power: 'fire' },
    );
    expect(surfaces).toEqual([FLOOR, LEFT, FLOOR]);
    expect(toPx(r.world.player.body.y + r.world.player.body.h)).toBe(13 * 16);
    expect(r.world.player.body.vx).toBeGreaterThan(0);
  });

  it('inputs are locked through a turn: no cannon shot fires', () => {
    let fired = false;
    run(
      field(column(8, 10, 12)),
      (w) => {
        const st = sophiaState(w.player);
        if (st.turn && w.entities.some((e) => e instanceof CannonShot)) fired = true;
        return st.turn ? ['right', 'up', 'attack'] : ['right', 'up'];
      },
      90,
      { power: 'fire' },
    );
    expect(fired).toBe(false);
  });

  it('a hit on a wall makes her let go (upright, falling), no push', () => {
    const r = run(
      field(column(8, 6, 12)),
      (w, f) => {
        if (f === 70) w.hurtPlayer(w.player, 1);
        return f < 70 ? ['right', 'up'] : [];
      },
      72,
      { power: 'fire' },
    );
    const p = r.world.player;
    expect(sophiaState(p).surface).toBe(FLOOR);
    expect(p.powerState).toBe('small');
    expect(p.body.vx).toBe(0);
  });

  it('on a wall the sprite is turned a quarter (wheels toward the wall), upside down on a ceiling', () => {
    const r = run(field(column(8, 6, 12)), (_w, f) => (f < 80 ? ['right', 'up'] : []), 80, { power: 'fire' });
    const p = r.world.player;
    const s = p.def.sprite(p, 0, true);
    expect(s.rotate).toBe(270);
    expect(s.flip).toBe(false); // nose up the wall
    const c = run(field(ceiling(), 4), (_w, f) => (f >= 5 && f < 30 ? ['jump'] : []), 40, { power: 'fire' });
    const q = c.world.player;
    expect(q.def.sprite(q, 0, true)).toMatchObject({ flipY: true, rotate: 0 });
  });
});

/** A map from rows of tiles (15 rows), with optional header lines and entities. */
function map(rows: string[], header: string[] = [], entities: string[] = []) {
  return parseTextMap(
    [
      'id: t',
      'time: 300',
      ...header,
      '',
      '[tiles]',
      ...rows,
      ...(entities.length ? ['', '[entities]', ...entities] : []),
    ].join('\n'),
  );
}
const tank = (w: World) => w.entities.find((e): e is ParkedTank => e instanceof ParkedTank && e.alive);

describe('Jason on foot (our design)', () => {
  it('EXIT on the floor: Jason (8 x 16) hops out on top of the parked tank, which stays put', () => {
    let landedOnTank = false;
    const r = run(
      field(),
      (w, f) => {
        const t = tank(w);
        const b = w.player.body;
        if (t && b.onGround && b.y + b.h === t.body.y) landedOnTank = true;
        return f === 5 ? ['select'] : [];
      },
      60,
    );
    const p = r.world.player;
    expect(sophiaState(p).jason).not.toBeNull();
    expect([toPx(p.body.w), toPx(p.body.h)]).toEqual([8, 16]);
    expect(tank(r.world)).toBeDefined();
    expect(landedOnTank).toBe(true);
    expect(p.def.sprite(p, 0, true).frame).toMatch(/^jason-/);
    expect(p.def.meter?.(p) ?? null).toBeNull();
  });

  it('he fits a one-tile hole the tank drives over, and climbs back in with UP', () => {
    // A ledge on row 9 with a one-tile hole at column 8; the floor below on row 13.
    const ledge = '#'.repeat(8) + '.' + '#'.repeat(W - 9);
    const rows = [
      ...Array.from({ length: 9 }, () => '.'.repeat(W)),
      ledge,
      ...Array.from({ length: 3 }, () => '.'.repeat(W)),
      '#'.repeat(W),
      '#'.repeat(W),
    ];
    const level = map(rows, ['start: 4,8']);
    // The tank drives straight over the hole.
    const tankRun = run(level, () => ['right'], 60);
    expect(toPx(tankRun.world.player.body.y + tankRun.world.player.body.h)).toBe(9 * 16);
    // Jason drops through it to the floor below (4 tiles: no harm).
    const r = run(
      level,
      (w, f) => {
        if (f === 3) return ['select'];
        return f > 30 && sophiaState(w.player).jason && w.player.body.y < px(9 * 16) ? ['right'] : [];
      },
      200,
      { power: 'big' },
    );
    const p = r.world.player;
    expect(toPx(p.body.y + p.body.h)).toBe(13 * 16);
    expect(p.powerState).toBe('big');
    // Back in: beside the tank on the floor, UP.
    const back = run(
      field(),
      (_w, f) => {
        // Out, off the tank to its right, then back to it on the floor and UP.
        if (f === 3) return ['select'];
        if (f > 40 && f < 75) return ['right'];
        if (f >= 85 && f < 110) return ['left'];
        return f === 115 ? ['up'] : [];
      },
      120,
    );
    const q = back.world.player;
    expect(sophiaState(q).jason).toBeNull();
    expect(toPx(q.body.w)).toBe(19);
    expect(tank(back.world)).toBeUndefined();
  });

  it('a fall of more than five tiles hurts him; four does not', () => {
    const drop = (row: number) => {
      const rows = Array.from({ length: 15 }, (_, y) =>
        y === row ? '#'.repeat(6) + '.'.repeat(W - 6) : y >= 13 ? '#'.repeat(W) : '.'.repeat(W),
      );
      return run(
        map(rows, [`start: 2,${row - 1}`]),
        (w, f) => (f === 3 ? ['select'] : f > 30 && w.player.body.onGround ? ['right'] : []),
        200,
        { power: 'big' },
      ).world.player;
    };
    expect(drop(9).powerState).toBe('big'); // 4 tiles
    expect(drop(6).powerState).toBe('small'); // 7 tiles
  });

  it('his gun reaches a few tiles: a Goomba close by falls, one far off does not', () => {
    const shoot = (dist: number) => {
      let g: Goomba | null = null;
      run(
        field(),
        (w, f) => {
          // Out, then off the tank's right side onto the floor, facing right.
          if (f === 80) {
            const b = w.player.body;
            g = new Goomba(b.x + px(dist), b.y + b.h - px(14));
            w.spawn(g);
          }
          if (g) g.body.vx = 0;
          if (f === 3) return ['select'];
          if (f > 30 && f < 70) return ['right'];
          return f === 84 ? ['attack'] : [];
        },
        140,
      );
      return (g as unknown as Goomba).alive;
    };
    expect(shoot(40)).toBe(false);
    expect(shoot(150)).toBe(true);
  });

  it('a ladder (a vine in the Underworld) is for Jason: the tank never grabs it', () => {
    const rows = Array.from({ length: 15 }, (_, y) => (y >= 13 ? '#'.repeat(W) : '.'.repeat(W)));
    const level = map(rows, ['start: 4,12', 'theme: underworld'], ['vine 5 12 len=6']);
    const t = run(level, (_w, f) => (f > 2 ? ['up'] : []), 60);
    expect(t.world.player.vine).toBeNull();
    const j = run(level, (_w, f) => (f === 3 ? ['select'] : f > 30 ? ['up'] : []), 60);
    expect(j.world.player.vine).not.toBeNull();
    // Elsewhere the tank climbs vines as in the original (nose up).
    const v = run(map(rows, ['start: 4,12'], ['vine 5 12 len=6']), (_w, f) => (f > 2 ? ['up'] : []), 60);
    expect(v.world.player.vine).not.toBeNull();
  });

  it('a hit on Jason costs the hero power like a hit on the tank; at Normal it is a life', () => {
    const hit = (power: string) =>
      run(
        field(),
        (w, f) => {
          if (f === 40) w.hurtPlayer(w.player, 1);
          return f === 3 ? ['select'] : [];
        },
        50,
        { power },
      ).world.player;
    expect(hit('fire').powerState).toBe('small');
    expect(hit('small').dead).toBe(true);
  });

  it('co-op: one Sophia hops out, the other stays a tank; a respawn puts her back in the tank', () => {
    let seen: { aJason: boolean; aW: number; bJason: boolean; bW: number; tanks: number } | null = null;
    const r = runSim({
      level: field(),
      character: SOPHIA,
      state: { character2: SOPHIA, powerState2: 'small', hp2: 0, lives: 3 },
      script: { steps: [] },
      maxFrames: 400,
      controller: (w, f) => {
        const [a, b] = w.players as [Player, Player];
        if (f === 20)
          seen = {
            aJason: sophiaState(a).jason !== null,
            aW: toPx(a.body.w),
            bJason: sophiaState(b).jason !== null,
            bW: toPx(b.body.w),
            tanks: w.entities.filter((e) => e instanceof ParkedTank && e.alive).length,
          };
        if (f === 30) w.kill(a);
        return f === 3 ? ['select'] : [];
      },
    });
    expect(seen).toEqual({ aJason: true, aW: 8, bJason: false, bW: 19, tanks: 1 });
    const [a, b] = r.world.players as [Player, Player];
    expect(sophiaState(b).jason).toBeNull();
    expect(sophiaState(a).jason).toBeNull(); // respawned in the tank
    expect(toPx(a.body.w)).toBe(19);
    expect(r.world.entities.some((e) => e instanceof ParkedTank && e.alive)).toBe(false);
  });
});

const insideSolid = (w: World) => {
  const b = w.player.body;
  for (let ty = Math.floor((b.y + 64) / 4096); ty <= Math.floor((b.y + b.h - 65) / 4096); ty++)
    for (let tx = Math.floor((b.x + 64) / 4096); tx <= Math.floor((b.x + b.w - 65) / 4096); tx++)
      if (w.map.isSolid(tx, ty)) return true;
  return false;
};

describe('Sophia III: the 0.4.11 review', () => {
  const calm = (w: World) => {
    for (const e of w.entities) if (e instanceof Enemy) e.alive = false;
  };

  it('Jason’s held hop clears about three tiles (49 px), a tap about one', () => {
    const peak = (hold: number) => {
      let top = Infinity;
      let y0 = 0;
      run(
        field(),
        (w, f) => {
          const b = w.player.body;
          if (f === 30) y0 = b.y + b.h;
          if (f > 30) top = Math.min(top, b.y + b.h);
          if (f === 3) return ['select'];
          return f > 30 && f <= 30 + hold ? ['jump'] : [];
        },
        120,
      );
      return toPx(y0 - top);
    };
    expect(peak(60)).toBeGreaterThanOrEqual(46);
    expect(peak(60)).toBeLessThan(56);
    expect(peak(1)).toBeLessThan(26);
  });

  it('down over a one-tile hole: the tank goes nose first down it and lands upright below', () => {
    const shelf = '#'.repeat(12) + '.' + '#'.repeat(W - 13);
    const fixed = parseTextMap(
      [
        'id: t',
        'time: 300',
        'start: 4,7',
        '',
        '[tiles]',
        ...Array.from({ length: 13 }, (_, y) => (y === 8 ? shelf : '.'.repeat(W))),
        '#'.repeat(W),
        '#'.repeat(W),
      ].join('\n'),
    );
    let wasNose = false;
    let stuck = 0;
    const r = run(
      fixed,
      (w, f) => {
        if (sophiaState(w.player).nose) wasNose = true;
        if (insideSolid(w)) stuck++;
        return f > 10 && f < 160 ? ['right', 'down'] : [];
      },
      260,
    );
    const b = r.world.player.body;
    expect(wasNose).toBe(true);
    expect(stuck).toBe(0);
    expect(toPx(b.y + b.h)).toBe(208);
    expect(toPx(b.w)).toBe(19);
    // Without down the tank drives straight over the same hole.
    const over = run(fixed, (_w, f) => (f > 10 && f < 160 ? ['right'] : []), 200);
    expect(toPx(over.world.player.body.y + over.world.player.body.h)).toBe(128);
  });

  it('nose first down a shaft that opens to one side: she rights herself in the air and lands', () => {
    const rows = Array.from({ length: 15 }, (_, y) => {
      if (y === 6) return '#'.repeat(12) + '.' + '#'.repeat(W - 13);
      if (y >= 7 && y <= 9) return '.'.repeat(11) + '#' + '.'.repeat(W - 12);
      if (y >= 10) return '.'.repeat(11) + '#.' + '#'.repeat(W - 13);
      return '.'.repeat(W);
    });
    const r = run(map(rows, ['start: 9,5']), (_w, f) => (f > 10 && f < 60 ? ['right', 'down'] : []), 160);
    const b = r.world.player.body;
    expect(r.world.player.dead).toBe(false);
    expect(toPx(b.w)).toBe(19);
    expect(toPx(b.y + b.h)).toBe(160);
  });

  it('nose first down a one-tile shaft onto a lift: she rights herself on the lift', () => {
    const shelf = '#'.repeat(12) + '.' + '#'.repeat(W - 13);
    const rows = Array.from({ length: 15 }, (_, y) => (y === 6 ? shelf : '.'.repeat(W)));
    let upright = 0;
    run(
      map(rows, ['start: 9,5'], ['lift-fall 11 10 len=6']),
      (w, f) => {
        const b = w.player.body;
        if (toPx(b.w) === 19 && b.onGround && toPx(b.y + b.h) > 160) upright++;
        return f > 10 && f < 60 ? ['right', 'down'] : [];
      },
      140,
    );
    expect(upright).toBeGreaterThan(10);
  });

  it.each(['small', 'fire'])('%s: a one-tile step never leaves her inside the floor', (power) => {
    for (const startX of [2, 6, 8]) {
      let stuck = 0;
      const step = '.'.repeat(12) + '#'.repeat(W - 12);
      const r = run(
        field({ 12: step }, startX),
        (w, f) => {
          if (insideSolid(w)) stuck++;
          if (f > 120 && f < 140) return ['left'];
          return f > 5 ? (f % 50 < 30 ? ['right'] : ['right', 'up']) : [];
        },
        240,
        { power },
      );
      expect(stuck).toBe(0);
      const b = r.world.player.body;
      expect(toPx(b.y + b.h) === 192 || toPx(b.y + b.h) === 208).toBe(true);
    }
  });

  it('4-4 at Normal: nose first down the one-tile hole, then through to the axe', () => {
    // The 4-4 maze's one-tile drops (cols 233 and 224) are the only way on; the tank is wider.
    const nose = runSim({
      level: getLevel('4-4'),
      character: SOPHIA,
      script: { steps: [] },
      maxFrames: 200,
      assist: { invulnerable: true, infiniteTime: true },
      start: { x: 229, y: 5, mode: 'stand' },
      controller: (w, f) => {
        calm(w);
        return f > 20 ? ['right', 'down'] : [];
      },
    });
    const b = nose.world.player.body;
    expect(toPx(b.y + b.h)).toBe(160); // down the hole in row 6, on the floor of row 10
    expect(toPx(b.w)).toBe(19); // upright again
    expect(sophiaState(nose.world.player).nose).toBe(false);
    const r = runSim({
      level: getLevel('4-4'),
      character: SOPHIA,
      script: { steps: [] },
      maxFrames: 1500,
      assist: { invulnerable: true, infiniteTime: true },
      start: { x: 224, y: 9, mode: 'stand' },
      until: (w) => w.bossClear !== null,
      controller: (w, f) => {
        calm(w);
        if (f < 20) return [];
        if (f < 60) return ['right', 'down'];
        return f % 40 < 25 ? ['right', 'jump'] : ['right'];
      },
    });
    expect(r.world.player.powerState).toBe('small');
    expect(r.world.bossClear).not.toBeNull();
  });
});

describe('Jason: the parked tank keeps the camera (0.4.11 review)', () => {
  const calm = (w: World) => {
    for (const e of w.entities) if (e instanceof Enemy) e.alive = false;
  };

  it('1-1: walking away, Jason is held at the right edge and the tank never leaves the screen', () => {
    let worst = -Infinity;
    let outAt = -1;
    const r = runSim({
      level: getLevel('1-1'),
      character: SOPHIA,
      script: { steps: [] },
      maxFrames: 900,
      assist: { invulnerable: true, infiniteTime: true },
      controller: (w, f) => {
        calm(w);
        const t = tank(w);
        if (t) worst = Math.max(worst, w.camera.x - t.body.x);
        else if (outAt < 0 && w.player.body.onGround && toPx(w.camera.x) > 120) {
          outAt = f;
          return ['select'];
        }
        if (outAt < 0) return f % 40 < 25 ? ['right', 'jump'] : ['right'];
        return f > outAt + 30 ? (f % 40 < 25 ? ['right', 'jump'] : ['right']) : [];
      },
    });
    const w = r.world;
    const t = tank(w) as ParkedTank;
    expect(sophiaState(w.player).jason).not.toBeNull();
    expect(outAt).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(-px(32));
    expect(w.camera.x).toBeLessThanOrEqual(t.body.x - px(32));
    expect(w.player.body.x + w.player.body.w).toBeLessThanOrEqual(w.camera.right);
    expect(toPx(w.player.body.x + w.player.body.w - w.camera.right)).toBeGreaterThan(-4); // pressed to it
  });

  it('co-op: both players are held on the parked tank’s screen', () => {
    const r = runSim({
      level: getLevel('1-1'),
      character: SOPHIA,
      state: { character2: SOPHIA, powerState2: 'small', hp2: 0, lives: 3 },
      script: { steps: [] },
      maxFrames: 700,
      assist: { invulnerable: true, infiniteTime: true },
      controller: (w, f) => {
        calm(w);
        if (f === 5) return ['select'];
        return f > 40 ? (f % 30 < 20 ? ['right', 'jump'] : ['right']) : [];
      },
    });
    const w = r.world;
    const t = tank(w) as ParkedTank;
    expect(t).toBeDefined();
    expect(w.camera.x).toBeLessThanOrEqual(t.body.x);
    for (const p of w.players) expect(p.body.x + p.body.w).toBeLessThanOrEqual(w.camera.right);
  });

  it('the screen edge never squeezes Jason up into a hanging pipe (8-4)', () => {
    let onPipe = 0;
    let inside = 0;
    runSim({
      level: getLevel('8-4'),
      character: SOPHIA,
      script: { steps: [] },
      maxFrames: 400,
      assist: { invulnerable: true, infiniteTime: true },
      start: { x: 166, y: 12, mode: 'stand' },
      controller: (w, f) => {
        calm(w);
        // The screen's left edge 5 px short of the pipe hanging over the floor (rows 6-9).
        if (f === 1) w.camera.x = px(163 * 16 - 5);
        const b = w.player.body;
        if (b.onGround && toPx(b.y + b.h) <= 160 && toPx(b.x + b.w) <= 165 * 16) onPipe++;
        if (insideSolid(w)) inside++;
        if (f === 10) return ['select'];
        if (f < 40) return [];
        return f % 40 < 30 ? ['left', 'jump'] : ['left'];
      },
    });
    expect(inside).toBe(0);
    expect(onPipe).toBe(0); // never standing in or on the pipe
  });

  it('EXIT is refused on an auto-scrolling airship', () => {
    const r = runSim({
      level: getLevel('4-2-airship'),
      character: SOPHIA,
      script: { steps: [] },
      maxFrames: 200,
      assist: { invulnerable: true, infiniteTime: true },
      controller: (w, f) => {
        calm(w);
        return f % 20 === 10 && w.player.body.onGround ? ['select'] : [];
      },
    });
    expect(r.world.camera.auto).toBe(true);
    expect(sophiaState(r.world.player).jason).toBeNull();
    expect(tank(r.world)).toBeUndefined();
  });

  it('EXIT is refused while riding a lift', () => {
    const pit = '#'.repeat(8) + '.'.repeat(24) + '#'.repeat(W - 32);
    const rows = Array.from({ length: 15 }, (_, y) => (y >= 13 ? pit : '.'.repeat(W)));
    let rode = 0;
    const r = run(
      map(rows, ['start: 20,11'], ['lift-h 19 12 len=4']),
      (w, f) => {
        const b = w.player.body;
        if (b.onGround && toPx(b.y + b.h) < 13 * 16 && !w.player.dead) rode++;
        return rode > 5 && f % 6 === 0 ? ['select'] : [];
      },
      200,
    );
    expect(rode).toBeGreaterThan(100);
    expect(sophiaState(r.world.player).jason).toBeNull();
    expect(tank(r.world)).toBeUndefined();
  });

  it('flagpole: Jason on foot can touch the pole and the level clears', () => {
    let out = false;
    const r = runSim({
      level: getLevel('1-1'),
      character: SOPHIA,
      script: { steps: [] },
      maxFrames: 1000,
      assist: { invulnerable: true },
      start: { x: 190, y: 12, mode: 'stand' },
      controller: (w, f) => {
        calm(w);
        if (f === 5) return ['select'];
        if (f > 6 && f < 30 && sophiaState(w.player).jason) out = true;
        return f > 30 && !w.flagGrabbedBy ? (f % 30 < 15 ? ['right', 'jump'] : ['right']) : [];
      },
    });
    expect(out).toBe(true);
    expect(r.outcome).toBe('cleared');
  });

  it('axe: Jason on foot can reach the axe and Bowser’s bridge falls', () => {
    let out = false;
    const r = runSim({
      level: getLevel('1-4'),
      character: SOPHIA,
      script: { steps: [] },
      maxFrames: 400,
      assist: { invulnerable: true, infiniteTime: true },
      start: { x: 138, y: 8, mode: 'stand' },
      until: (w) => w.bossClear !== null,
      controller: (w, f) => {
        calm(w);
        if (f === 20) return ['select'];
        if (f > 6 && sophiaState(w.player).jason) out = true;
        return f > 30 ? (f % 30 < 15 ? ['right', 'jump'] : ['right']) : [];
      },
    });
    expect(out).toBe(true);
    expect(r.world.bossClear).not.toBeNull();
  });
});

describe('Jason: continuity', () => {
  it('touch: SHOOT and EXIT on foot, no missiles', () => {
    const r = run(field(), (_w, f) => (f === 3 ? ['select'] : []), 20, { kit: { hasTriple: 1, triple: 9 } });
    const p = r.world.player;
    expect(p.def.touchLabels?.(p, r.world)).toEqual({ attack: 'SHOOT', special: null, select: 'EXIT' });
  });

  it('he goes down a pipe as any hero does (the next area starts with him back in the tank)', () => {
    const rows = Array.from({ length: 15 }, (_, y) =>
      y === 11 ? at(10, '[]') : y === 12 ? at(10, '{}') : y >= 13 ? '#'.repeat(W) : '.'.repeat(W),
    );
    const level = map(rows, ['start: 7,12'], []);
    const withPipe = parseTextMap(
      [
        'id: t',
        'time: 300',
        'start: 7,12',
        '',
        '[tiles]',
        ...rows,
        '',
        '[zones]',
        'pipe 10 11 down -> t 2 12',
      ].join('\n'),
    );
    expect(level.zones.length).toBe(0);
    const r = run(
      withPipe,
      (w, f) => {
        if (f === 3) return ['select'];
        const b = w.player.body;
        if (f < 30) return [];
        // Onto the pipe (its middle at 176 px), then down.
        if (b.y + b.h > px(11 * 16)) return f % 20 < 10 ? ['right', 'jump'] : ['right'];
        const cx = toPx(b.x + (b.w >> 1));
        return cx < 174 ? ['right'] : cx > 178 ? ['left'] : ['down'];
      },
      400,
    );
    expect(r.outcome).toBe('pipe');
  });
});
