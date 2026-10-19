import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { heroVariant } from '@game/level/variants';
import { getLevel } from '@content/levels';
import { SOPHIA } from '@game/characters/sophia';
import { SOPHIA_CLASSIC, selectedMissile } from '@game/characters/sophia/classic';
import { CANNON_CLASSIC, TRIPLE_CLASSIC } from '@game/characters/sophia/classic-weapons';
import { CLASSIC_CHARACTERS, CHARACTERS, heroFor } from '@game/characters/registry';
import { CannonShot, HomingMissile, TripleMissile } from '@game/characters/sophia/weapons';
import { sophiaState, FLOOR, RIGHT, CEIL, LEFT } from '@game/characters/sophia/state';
import { CLASSIC_STAR_FRAMES } from '@game/characters/classic/power';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { BulletBill } from '@game/entities/enemies/bullet-bill';
import type { Enemy } from '@game/entities/enemies/enemy';
import { T } from '@game/level/tiles';
import { px } from '@engine/math/units';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';

/*
 * Sophia III under Classic SMBC rules (bug-reports/2026-10-07-sophia-build-classic-character.md,
 * Acceptance checks; SOPHIA_CLASSIC in characters/sophia/classic.ts). Each run passes the Current
 * def with rules 'classic', so the World resolves heroFor (TG-17) as the game does.
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
function column(x: number, y0: number, y1: number, rows: Record<number, string> = {}) {
  for (let y = y0; y <= y1; y++) {
    const r = rows[y] ?? '.'.repeat(W);
    rows[y] = r.slice(0, x) + 'B' + r.slice(x + 1);
  }
  return rows;
}
type Ctl = (w: World, f: number) => Action[];

function run(
  level: ReturnType<typeof field>,
  controller: Ctl,
  frames: number,
  opts: { power?: string; kit?: Record<string, number>; rules?: 'classic' | 'current' } = {},
) {
  return runSim({
    level,
    character: SOPHIA,
    rules: opts.rules ?? 'classic',
    script: { steps: [] },
    maxFrames: frames,
    controller,
    state: { kit: opts.kit ?? {}, powerState: opts.power ?? 'small' },
  });
}

const shots = (w: World) => w.entities.filter((e): e is CannonShot => e instanceof CannonShot && e.alive);
const hold = (w: World) => {
  for (const e of w.entities) if (e instanceof Goomba || e instanceof Koopa || e instanceof BulletBill) e.body.vx = 0;
};

/** Shots (or volleys) fired every 30 frames from frame 4 that a foe takes to die; -1 if it lives. */
function shotsToKill(make: (x: number, y: number) => Enemy, power: string, special = false): number {
  let foe: Enemy | null = null;
  let fired = 0;
  let killedAfter = -1;
  run(
    field(),
    (w, f) => {
      if (f === 1) {
        const b = w.player.body;
        foe = make(b.x + px(56), b.y + b.h);
        w.spawn(foe);
      }
      hold(w);
      // Missiles: volleys actually fired (a new one waits for the last to leave), by ammo spent.
      const shots = special ? (60 - (w.player.scratch.triple ?? 0)) / 3 : fired;
      if (foe && !foe.alive && killedAfter < 0) killedAfter = shots;
      if (killedAfter < 0 && f >= 4 && (f - 4) % 30 === 0 && fired < 12) {
        fired++;
        return [special ? 'special' : 'attack'];
      }
      return [];
    },
    400,
    { power, kit: { hasTriple: 1, triple: 60 } },
  );
  return killedAfter;
}
const goomba = (x: number, y: number) => new Goomba(x, y - px(16));
const buzzy = (x: number, y: number) => new Koopa(x, y - px(16), 'buzzy');
const bill = (x: number, y: number) => new BulletBill(x, y - px(14), -1);

describe('Classic Sophia III: the definition (SO-2 to SO-5, TG-17, TG-38)', () => {
  it('is registered under the Current id; heroFor picks it only under Classic', () => {
    expect(CLASSIC_CHARACTERS.sophia).toBe(SOPHIA_CLASSIC);
    expect(heroFor(SOPHIA, 'classic')).toBe(SOPHIA_CLASSIC);
    expect(heroFor(SOPHIA, 'current')).toBe(SOPHIA);
    expect(CHARACTERS).toContain(SOPHIA);
    expect(CHARACTERS).not.toContain(SOPHIA_CLASSIC);
    expect(SOPHIA_CLASSIC.rules).toBe('classic');
    expect(SOPHIA_CLASSIC.id).toBe('sophia');
    expect(SOPHIA_CLASSIC.stomps).toBe(false);
    expect(SOPHIA_CLASSIC.damage).toEqual({ kind: 'powerup', states: ['small', 'big', 'fire'] });
    expect(SOPHIA_CLASSIC.levelFlags).toEqual({ horz: true, vert: true, wide: true, goodSwimmer: true });
    expect(SOPHIA_CLASSIC.tools).toBeUndefined();
  });

  it('under Current the def is unchanged: no rules, its belt, Jason on Select', () => {
    expect(SOPHIA.rules).toBeUndefined();
    expect(SOPHIA.levelFlags).toBeUndefined();
    expect(SOPHIA.tools).toBeDefined();
    const r = run(field(), (_w, f) => (f === 20 ? ['select'] : []), 30, { rules: 'current' });
    expect(r.world.player.def).toBe(SOPHIA);
    expect(sophiaState(r.world.player).jason).not.toBeNull();
  });

  it('a Classic World plays the Classic def; Select brings no Jason out', () => {
    const r = run(field(), (_w, f) => (f === 20 ? ['select'] : []), 30);
    expect(r.world.player.def).toBe(SOPHIA_CLASSIC);
    expect(sophiaState(r.world.player).jason).toBeNull();
  });

  it('the wide box: 19 x 15.5 in every state', () => {
    for (const power of ['small', 'big', 'fire']) {
      const b = run(field(), () => [], 3, { power }).world.player.body;
      expect([b.w, b.h]).toEqual([px(19), px(15.5)]);
    }
  });
});

describe('Classic Sophia III: driving and the jump (SO-9 to SO-14)', () => {
  it('reaches 1.5417 px/f in 14 frames and never more; rolls to a stop within 33 frames', () => {
    const speeds: number[] = [];
    let stop = -1;
    run(
      field(),
      (w, f) => {
        if (f >= 2 && f < 40) speeds.push(w.player.body.vx);
        if (f > 40 && stop < 0 && w.player.body.vx === 0) stop = f - 40;
        return f >= 1 && f < 40 ? ['right'] : [];
      },
      90,
    );
    expect(speeds[12]).toBeLessThan(0x018ab);
    expect(speeds[13]).toBe(0x018ab);
    expect(Math.max(...speeds)).toBe(0x018ab);
    expect(stop).toBeGreaterThan(0);
    expect(stop).toBeLessThanOrEqual(33);
  });

  const jump = (held: number, drive = false) => {
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
        return press >= 0 && f < press + held ? [...d, 'jump'] : d;
      },
      120,
    );
    return { squat: takeoff - press, apex, apexF };
  };

  it('a tap: a 4-frame squat, then 45 px at frame 18; held: 72 px at frame 33; the same driving', () => {
    const tap = jump(1);
    expect(tap.squat).toBe(4);
    expect(Math.abs(tap.apex - 45)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(tap.apexF - 18)).toBeLessThanOrEqual(1);
    const held = jump(80);
    expect(Math.abs(held.apex - 72)).toBeLessThanOrEqual(1);
    expect(Math.abs(held.apexF - 33)).toBeLessThanOrEqual(1);
    expect(Math.round(jump(80, true).apex)).toBe(Math.round(held.apex));
  });

  it('a head bump strikes both bricks over her and breaks neither, even at Hyper (SO-17, SO-42)', () => {
    const bumped = new Set<number>();
    const r = run(
      field({ 9: at(2, '==') }),
      (w, f) => {
        // BR-C4: a head bump leaves a brick at 0 HP.
        for (const x of [2, 3]) if (w.brickHp.get(`${x},9`) === 0) bumped.add(x);
        return f === 5 ? ['jump'] : [];
      },
      40,
      { power: 'big' },
    );
    expect([...bumped].sort()).toEqual([2, 3]);
    expect(r.world.map.get(2, 9)).toBe(T.BRICK);
    expect(r.world.map.get(3, 9)).toBe(T.BRICK);
  });
});

describe('Classic Sophia III: the cannon (SO-28, SO-29, SO-33)', () => {
  it('three shots on screen at most, each at 3.5417 px/f; up held 9 frames fires straight up', () => {
    let most = 0;
    let speed = 0;
    run(
      field(),
      (w, f) => {
        most = Math.max(most, shots(w).length);
        if (shots(w)[0]) speed = shots(w)[0]?.body.vx ?? 0;
        return f % 2 === 0 && f < 20 ? ['attack'] : [];
      },
      22,
    );
    expect(most).toBe(3);
    expect(speed).toBe(0x038ab);
    const dir = (n: number) => {
      let v: [number, number] | null = null;
      run(
        field(),
        (w, f) => {
          const s = shots(w)[0];
          if (s && !v) v = [s.body.vx, s.body.vy];
          if (f >= 5 && f < 5 + n) return ['up'];
          return f === 5 + n ? ['up', 'attack'] : [];
        },
        30,
      );
      return v;
    };
    expect(dir(8)).toEqual([0x038ab, 0]);
    expect(dir(9)).toEqual([0, -0x038ab]);
  });

  it('its damage is 100 / 200 / 300 by state, with a 24-frame flash and no pierce', () => {
    expect(CANNON_CLASSIC.map((s) => s.amount)).toEqual([100, 200, 300]);
    expect(CANNON_CLASSIC[0]?.classicHit).toEqual({ pierce: 0, flashFrames: 24 });
    expect(TRIPLE_CLASSIC.amount).toBe(400);
    expect(TRIPLE_CLASSIC.classicHit?.pierce).toBe(10);
  });

  it('a Goomba takes 3 Normal shots, 2 Hyper, 1 Crusher', () => {
    expect(shotsToKill(goomba, 'small')).toBe(3);
    expect(shotsToKill(goomba, 'big')).toBe(2);
    expect(shotsToKill(goomba, 'fire')).toBe(1);
  });

  it('a Buzzy Beetle and a Bullet Bill ignore the cannon', () => {
    expect(shotsToKill(buzzy, 'fire')).toBe(-1);
    expect(shotsToKill(bill, 'fire')).toBe(-1);
  });

  it('a brick takes two Normal shots, one Hyper shot', () => {
    const wall = field({ 11: at(8, '='), 12: at(8, '=') });
    const one = run(wall, (_w, f) => (f === 3 ? ['attack'] : []), 40);
    expect(one.world.map.get(8, 12)).toBe(T.BRICK);
    const two = run(wall, (_w, f) => (f === 3 || f === 40 ? ['attack'] : []), 80);
    expect(two.world.map.get(8, 12)).toBe(T.AIR);
    const hyper = run(wall, (_w, f) => (f === 3 ? ['attack'] : []), 40, { power: 'big' });
    expect(hyper.world.map.get(8, 12)).toBe(T.AIR);
  });
});

describe('Classic Sophia III: power states and hits (SO-22 to SO-24, SO-41)', () => {
  const feed = (power: string, kind: 'mushroom' | 'flower' | 'star', kit: Record<string, number> = {}) => {
    const r = run(field(), () => [], 2, { power, kit });
    const p = r.world.player;
    p.def.behaviour.onPowerUp(p, kind, r.world);
    return p;
  };

  it('a Mushroom makes her Hyper with the freeze and a full hover bar; a Flower then Crusher with 9 Triple ammo', () => {
    const big = feed('small', 'flower');
    expect(big.powerState).toBe('big');
    expect(big.transition).not.toBeNull();
    expect(sophiaState(big).cells).toBe(8);
    const fire = feed('big', 'mushroom');
    expect(fire.powerState).toBe('fire');
    expect(fire.scratch.hasTriple).toBe(1);
    expect(fire.scratch.triple).toBe(9);
    expect(selectedMissile(fire)).toBe('triple');
  });

  it('a repeat Flower adds 12 Triple ammo (4 Homing when selected), no freeze', () => {
    const p = feed('fire', 'flower', { hasTriple: 1, triple: 9 });
    expect(p.scratch.triple).toBe(21);
    expect(p.transition).toBeNull();
    const h = feed('fire', 'flower', { hasTriple: 1, triple: 9, hasHoming: 1, homing: 3, sub: 1 });
    expect(h.scratch.homing).toBe(7);
    expect(h.scratch.triple).toBe(9);
  });

  it('a Star lasts 720 frames and fills the hover bar', () => {
    const p = feed('big', 'star');
    expect(p.star).toBe(CLASSIC_STAR_FRAMES);
    expect(sophiaState(p).cells).toBe(8);
  });

  it('landing on a Goomba hurts her; Crusher drops to Normal keeping missiles; the next hit kills', () => {
    const touch = (power: string) =>
      run(
        field(),
        (w, f) => {
          if (f === 1) {
            const b = w.player.body;
            w.spawn(new Goomba(b.x + px(4), b.y + b.h - px(14)));
          }
          hold(w);
          return [];
        },
        10,
        { power, kit: { hasTriple: 1, triple: 9 } },
      ).world.player;
    const p = touch('fire');
    expect(p.dead).toBe(false);
    expect(p.powerState).toBe('small');
    expect(p.scratch.triple).toBe(9);
    expect(p.invuln).toBeGreaterThan(60);
    expect(touch('small').dead).toBe(true);
  });

  it('a hit on a wall lets go (upright, falling), no push', () => {
    let hit = false;
    const r = run(
      field(column(8, 4, 12)),
      (w, f) => {
        const st = sophiaState(w.player);
        if (!hit && st.surface === RIGHT && !st.turn && f > 40) {
          hit = true;
          w.hurtPlayer(w.player, -1);
        }
        return hit ? [] : ['right', 'up'];
      },
      120,
      { power: 'fire' },
    );
    expect(hit).toBe(true);
    expect(sophiaState(r.world.player).surface).toBe(FLOOR);
    expect(r.world.player.powerState).toBe('small');
  });
});

describe('Classic Sophia III: hover and water (SO-18, SO-35)', () => {
  it('Hyper: a second jump press in the air climbs at 0.6875 px/f; the bar lasts 144 frames', () => {
    const vys: number[] = [];
    let first = -1;
    let empty = -1;
    run(
      field(),
      (w, f) => {
        const st = sophiaState(w.player);
        if (st.hovering && first < 0) first = f;
        if (st.cells === 0 && empty < 0) empty = f;
        if (f > 20 && f < 50) vys.push(w.player.body.vy);
        if (f === 5) return ['jump'];
        if (f > 5 && f < 14) return [];
        return f >= 14 && empty < 0 ? ['jump'] : [];
      },
      300,
      { power: 'big' },
    );
    expect(vys.slice(-10).every((v) => v === -0x00b00)).toBe(true);
    expect(Math.abs(empty - first - 144)).toBeLessThanOrEqual(1);
  });

  it('under water: neutral sinks 0.5 px a frame; up reaches -1.5833 px/f and no faster', () => {
    const pool = field({ 2: 'w'.repeat(W) }, 2, ['theme: water']);
    const ys: number[] = [];
    run(
      pool,
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
    let maxUp = 0;
    run(
      pool,
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
});

describe('Classic Sophia III: wall and ceiling climbing (SO-36, SO-37)', () => {
  it('Crusher: right + up turns up a wall in 12 frames at full speed; Hyper cannot climb', () => {
    const log: { s: number; turn: boolean; vy: number }[] = [];
    run(
      field(column(8, 10, 12)),
      (w, f) => {
        const st = sophiaState(w.player);
        log.push({ s: st.surface, turn: st.turn !== null, vy: w.player.body.vy });
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
    const hyper = run(field(column(8, 10, 12)), (_w, f) => (f > 2 ? ['right', 'up'] : []), 60, { power: 'big' });
    expect(sophiaState(hyper.world.player).surface).toBe(FLOOR);
  });

  it('a wall jump between two walls 4 tiles apart grips the far wall', () => {
    const r = run(
      field(column(9, 3, 12, column(4, 3, 12)), 6),
      (_w, f) => (f < 40 ? ['right', 'up'] : f === 40 ? ['jump'] : []),
      90,
      { power: 'fire' },
    );
    expect(sophiaState(r.world.player).surface).toBe(LEFT);
  });

  it('a jump under a ceiling grips it without a bump; with down held it bumps the block', () => {
    const bricks = { 8: '='.repeat(21) + '.'.repeat(W - 21) };
    let gripped = false;
    let bumps = 0;
    run(
      field(bricks, 4),
      (w, f) => {
        if (sophiaState(w.player).surface === CEIL) gripped = true;
        bumps += w.entities.filter((e) => e.kind === 'block-bump').length;
        return f >= 5 && f < 30 ? ['jump'] : [];
      },
      60,
      { power: 'fire' },
    );
    expect(gripped).toBe(true);
    expect(bumps).toBe(0);
    gripped = false;
    run(
      field(bricks, 4),
      (w, f) => {
        if (sophiaState(w.player).surface === CEIL) gripped = true;
        bumps += w.entities.filter((e) => e.kind === 'block-bump').length;
        return f >= 5 && f < 30 ? ['jump', 'down'] : [];
      },
      60,
      { power: 'fire' },
    );
    expect(gripped).toBe(false);
    expect(bumps).toBeGreaterThan(0);
  });
});

describe('Classic Sophia III: missiles (SO-30 to SO-32)', () => {
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

  it('one missile kills a Bullet Bill, two a Buzzy Beetle (one volley each up close: its middle missile)', () => {
    expect(shotsToKill(bill, 'small', true)).toBe(1);
    expect(shotsToKill(buzzy, 'small', true)).toBe(2);
  });

  it('they pass a pipe and break the first brick they meet', () => {
    const r = run(
      field({ 11: at(6, '[]......='), 12: at(6, '{}......=') }),
      (_w, f) => (f === 3 ? ['special'] : []),
      90,
      { kit: { hasTriple: 1, triple: 9 } },
    );
    expect(r.world.map.get(14, 12)).toBe(T.AIR);
  });

  it('Select swaps to the Homing Missile (with both), which fires only at a target', () => {
    let fired = 0;
    let killed = false;
    const r = run(
      field(),
      (w, f) => {
        fired = Math.max(fired, w.entities.filter((e) => e instanceof HomingMissile).length);
        if (f === 10) {
          const b = w.player.body;
          w.spawn(new Goomba(b.x + px(80), b.y - px(40)));
        }
        hold(w);
        if (f > 12 && !w.entities.some((e) => e instanceof Goomba && e.alive)) killed = true;
        if (f === 2) return ['select'];
        if (f === 5) return ['special']; // no target yet: nothing, no ammo spent
        return f === 14 ? ['special'] : [];
      },
      150,
      { kit: { hasTriple: 1, triple: 9, hasHoming: 1, homing: 3 } },
    );
    const p = r.world.player;
    expect(selectedMissile(p)).toBe('homing');
    expect(p.scratch.homing).toBe(2);
    expect(fired).toBe(1);
    expect(killed).toBe(true);
    expect(p.def.touchLabels?.(p, r.world)).toEqual({ attack: 'SHOOT', special: 'HOMING', select: 'SWAP' });
    expect(p.def.hudAmmo?.(p)).toMatchObject({ icon: 'icon-homing', count: 2 });
  });

  it('drops: none without a missile; with one, ammo for it; pickups always taken', () => {
    const yes = { chance: () => true } as unknown as World['rng'];
    const bare = run(field(), () => [], 2).world.player;
    expect(bare.def.drop?.(yes, {} as never, bare)).toBeNull();
    expect(bare.def.blockDrop?.(yes, bare, 'brick')).toBeNull();
    expect(bare.def.touchLabels?.(bare, {} as World)).toEqual({ attack: 'SHOOT', special: null, select: null });
    expect(bare.def.hudAmmo?.(bare)).toBeNull();
    const r = run(field(), () => [], 2, { kit: { hasTriple: 1, triple: 58 } });
    const p = r.world.player;
    expect(p.def.drop?.(yes, {} as never, p)).toBe('triple-ammo');
    expect(p.def.blockDrop?.(yes, p, 'coin')).toBe('triple-ammo');
    expect(p.def.behaviour.onPickup?.(p, 'triple-ammo', r.world)).toBe(true);
    expect(p.scratch.triple).toBe(60);
  });

  it('&kit=full: both missiles, full, the Triple selected first', () => {
    expect(SOPHIA_CLASSIC.devKit?.()).toEqual({ hasTriple: 1, triple: 60, hasHoming: 1, homing: 20 });
  });
});

describe('Classic Sophia III: level data (SO-45 to SO-48)', () => {
  it('4-4 for Sophia outside the campaign: (161, 10) is open; for Mario it is solid', () => {
    const lv = getLevel('4-4');
    const solid = (l: typeof lv) => l.tiles[10 * l.width + 161] !== T.AIR;
    expect(solid(lv)).toBe(true);
    expect(solid(heroVariant(lv, ['mario'], false))).toBe(true);
    expect(solid(heroVariant(lv, ['sophia'], false))).toBe(false);
    const one = heroVariant(getLevel('1-1'), ['sophia'], false);
    expect(one.entities.some((e) => e.type === 'lift-fall' && e.x === 193 && e.y === 4)).toBe(true);
  });
});

describe('Classic Sophia III: guide (TG-22, TG-40)', () => {
  it('names abilities, never button letters', () => {
    const g = SOPHIA_CLASSIC.guide;
    const text = [g.tagline, ...g.controls.map((c) => c.does), ...g.powerups.map((p) => p.does), ...(g.tips ?? [])];
    for (const t of text) expect(t).not.toMatch(/\b(press|hold) [ABXYZC]\b|\b[ABC] button\b/i);
    expect(g.controls.find((c) => c.action === 'select')?.touch).toBe('SWAP');
    expect(g.controls.some((c) => c.does.includes('Jason'))).toBe(false);
  });
});
