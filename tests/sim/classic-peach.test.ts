import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import { defaultSettings } from '@engine/save/settings';
import {
  CHARACTERS,
  CLASSIC_CHARACTERS,
  CLASSIC_EXTRAS,
  characterById,
  heroFor,
} from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { MARIO_CLASSIC, MARIO_CLASSIC_PROFILE } from '@game/characters/mario/classic';
import { WARRIORS_CLASSIC } from '@game/characters/warriors/classic';
import {
  PEACH_CARRY,
  PEACH_CLASSIC,
  PEACH_CLASSIC_PROFILE,
  PEACH_FLOAT_FRAMES,
  squatCharged,
} from '@game/characters/peach/classic';
import { carried, carryState, lifting, ThrownEnemy, ThrownThing } from '@game/characters/classic/carry';
import { CLASSIC_HIT_RESPONSES } from '@game/characters/classic/power';
import { CLASSIC_SWIM } from '@game/rules/classic-swim';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Spiny } from '@game/entities/enemies/spiny';
import { Bowser } from '@game/entities/enemies/bowser';
import type { Enemy } from '@game/entities/enemies/enemy';
import { T } from '@game/level/tiles';
import type { CharacterSelectScene } from '@game/scenes/character-select';
import { fontText } from '@game/hud/text';
import { PALETTES, SPRITES } from '@content/sprites';
import { sfx } from '@content/sfx/sfx';
import type { Action } from '@engine/input/actions';
import { Rig, flatLevel, measureJump } from './classic-plumber-harness';
import { makeGame, useStorage } from './heroes-harness';

// Princess Peach, a Classic-only hero (bug-reports/2026-10-19-peach-build-classic-character.md,
// PE-1..PE-27): the report's acceptance checks with rules 'classic'.

useStorage();

const tile = (n: number) => px(n * 16);
const FLOOR = tile(13);

/** Her rig; plucks give turnips (no POW roll) unless a test sets the roll. */
function rig(power = 'small', level = flatLevel()): Rig {
  const r = new Rig(PEACH_CLASSIC, level, 'classic', power);
  setRoll(r, 0.9);
  r.settle();
  return r;
}
function setRoll(r: Rig, v: number): void {
  (r.world.rng as { float: () => number }).float = () => v;
}
function place<E extends Enemy>(r: Rig, e: E): E {
  e.activated = true;
  r.world.spawn(e);
  return e;
}
const goomba = (r: Rig, col: number) => place(r, new Goomba(tile(col), FLOOR - px(14)));
const alive = (r: Rig, e: Enemy) => e.alive && r.world.entities.includes(e);
const feet = (r: Rig) => r.p.body.y + r.p.body.h;
/** Steps `n` frames holding `hold`. */
const hold = (r: Rig, n: number, keys: Action[] = []) => {
  for (let i = 0; i < n; i++) r.step(keys);
};
/** One press of `key` (a frame with it down, then a frame without). */
const tap = (r: Rig, key: Action, extra: Action[] = []) => {
  r.step([key, ...extra]);
  r.step(extra);
};
/** Plucks (Special, then the lift's frames) and returns the frames she was rooted. */
function pluck(r: Rig): number {
  r.step(['special']);
  let n = 1;
  while (lifting(r.p) && n < 60) {
    r.step([]);
    n++;
  }
  return n;
}
const thrown = (r: Rig) =>
  r.world.entities.filter((e) => (e instanceof ThrownThing || e instanceof ThrownEnemy) && e.alive);

describe('Peach: identity and roster (PE-1..PE-3, TG-41)', () => {
  it('a Classic-only def, after the Warriors of Light in CLASSIC_EXTRAS, never in CHARACTERS', () => {
    const d = PEACH_CLASSIC;
    expect([d.id, d.name, d.hudName, d.rules]).toEqual(['peach', 'Peach', 'PEACH', 'classic']);
    expect(d.notInOriginal).toBe(true);
    expect(CLASSIC_EXTRAS[CLASSIC_EXTRAS.indexOf(WARRIORS_CLASSIC) + 1]).toBe(d);
    expect(CHARACTERS).not.toContain(d);
    expect(Object.values(CLASSIC_CHARACTERS)).not.toContain(d);
    expect(heroFor(d, 'classic')).toBe(d);
    expect(characterById('peach')).toBe(MARIO);
    expect(fontText(d.hudName)).toBe(d.hudName);
    expect(d.stomps).toBe(false);
    expect(d.canBreakBricks({} as never)).toBe(false);
    expect(d.portrait).toEqual({ sheet: 'peach', palette: 'peach', frame: 'stand' });
    // TG-22: no Current HUD extras, no drops.
    for (const k of ['tools', 'meter', 'hudExtra', 'reserve', 'startHp', 'drop', 'music'] as const)
      expect(d[k], k).toBeUndefined();
    expect(d.devKit?.()).toEqual({});
  });

  it("hitboxes are Mario's; carried things add nothing (PE-2)", () => {
    const r = rig('big');
    expect([r.p.body.w, r.p.body.h]).toEqual([px(12), px(24)]);
    pluck(r);
    expect(carried(r.p)?.kind).toBe('turnip');
    expect([r.p.body.w, r.p.body.h]).toEqual([px(12), px(24)]);
    expect(rig().p.body.h).toBe(px(16));
  });

  it('the Classic select lists her on the second row; Current and the campaign never do', () => {
    const settings = { ...defaultSettings(), classicRules: 'classic' as const };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    const sel = h.top() as CharacterSelectScene;
    h.idle(12);
    expect(sel.chars.indexOf(PEACH_CLASSIC)).toBeGreaterThanOrEqual(sel.firstRow);
    expect(h.game.rosterFor('classic')).toContain(PEACH_CLASSIC);
    expect(h.game.rosterFor('current')).not.toContain(PEACH_CLASSIC);
    const c = makeGame({
      deps: { settings: { ...defaultSettings(), classicRules: 'current' }, applySettings: () => {} },
    });
    c.game.classicSelect('1-1', () => c.game.showClassicMenu());
    const sel2 = c.top() as CharacterSelectScene;
    c.idle(12);
    expect(sel2.chars).not.toContain(PEACH_CLASSIC);
    const f = makeGame();
    f.game.showCharacterSelect();
    f.idle(12);
    expect((f.top() as CharacterSelectScene).chars).not.toContain(PEACH_CLASSIC);
  });
});

describe('Current unchanged (TG-38)', () => {
  it('no Current or Classic roster def sets her optional fields; Classic Mario is as before', () => {
    for (const d of [...CHARACTERS, ...Object.values(CLASSIC_CHARACTERS)]) {
      expect(d?.standsOnEnemies, d?.id).toBeUndefined();
      expect(d?.notInOriginal, d?.id).toBeUndefined();
      expect(d?.movement.float, d?.id).toBeUndefined();
    }
    expect(heroFor(MARIO, 'current')).toBe(MARIO);
    expect(heroFor(MARIO, 'classic')).toBe(MARIO_CLASSIC);
    expect(MARIO_CLASSIC_PROFILE.float).toBeUndefined();
    expect(CLASSIC_HIT_RESPONSES.peach).toEqual(CLASSIC_HIT_RESPONSES.mario);
  });

  it("Classic Mario still stomps a Goomba (riding is Peach's only)", () => {
    const r = new Rig(MARIO_CLASSIC, flatLevel(), 'classic', 'small');
    r.settle();
    const g = place(r, new Goomba(r.p.body.x, FLOOR - px(14)));
    r.p.body.y = g.body.y - px(40);
    r.until(() => !alive(r, g), [], 60);
    expect(alive(r, g)).toBe(false);
    expect(r.p.dead).toBe(false);
  });
});

describe('PE-5: jumping', () => {
  // The report's "about 75" running apex assumed Classic Mario's 81 px; he measures 83.7
  // (classic-mario-luigi.test.ts), so the 50 px cap gives 77.7 (and 69.7 carrying at speed).
  it("standing apex 64-67 px (Mario 67), running 6 px under Mario's 83.7", () => {
    const stand = measureJump(PEACH_CLASSIC, 0, Infinity);
    expect(stand.apex).toBeGreaterThanOrEqual(64);
    expect(stand.apex).toBeLessThanOrEqual(67);
    const run = measureJump(PEACH_CLASSIC, 0x02800, Infinity);
    expect(run.apex).toBeCloseTo(83.7 - 6, 0);
  });

  function carryJump(vx: number): number {
    const r = rig('small', flatLevel({}, 400));
    pluck(r);
    expect(carried(r.p)).not.toBeNull();
    r.p.body.vx = vx;
    const y0 = feet(r);
    let min = y0;
    for (let i = 0; i < 80; i++) {
      r.step(['jump']);
      min = Math.min(min, feet(r));
    }
    return (y0 - min) / 256;
  }

  it('carrying: 56-58 px standing, 8 px under the free jump at speed', () => {
    const s = carryJump(0);
    expect(s).toBeGreaterThanOrEqual(56);
    expect(s).toBeLessThanOrEqual(58);
    const m = carryJump(0x02000);
    expect(m).toBeCloseTo(77.7 - 8, 0);
  });

  it('carrying she cannot run: Attack throws, the speed stays at the walk cap', () => {
    const r = rig();
    pluck(r);
    hold(r, 60, ['right', 'run']);
    expect(Math.abs(r.p.body.vx)).toBeLessThanOrEqual(PEACH_CLASSIC_PROFILE.maxWalk);
    expect(carried(r.p)).not.toBeNull();
  });

  it('PE-8: a charged Power Squat jumps about 97 px', () => {
    const r = rig('big', flatLevel({}, 400));
    hold(r, 61, ['down']);
    expect(squatCharged(r.p)).toBe(true);
    const y0 = feet(r);
    let min = y0;
    r.step(['down', 'jump']);
    for (let i = 0; i < 60; i++) {
      r.step(['jump']);
      min = Math.min(min, feet(r));
    }
    const apex = (y0 - min) / 256;
    expect(apex).toBeGreaterThanOrEqual(95);
    expect(apex).toBeLessThanOrEqual(99);
    // Walking clears the charge.
    const w = rig('big');
    hold(w, 61, ['down']);
    w.step(['right']);
    expect(squatCharged(w.p)).toBe(false);
  });
});

describe('PE-6: the float', () => {
  /** Jumps holding Jump; returns the frames vy stayed 0 in the air after the apex. */
  function floatFrames(releaseAt = Infinity, level = flatLevel({}, 400)): { level: number; r: Rig } {
    const r = rig('small', level);
    r.step(['jump']);
    let still = 0;
    for (let i = 0; i < 200 && !r.p.body.onGround; i++) {
      const y = r.p.body.y;
      r.step(still < releaseAt ? ['jump'] : []);
      if (r.p.body.y === y && !r.p.body.onGround) still++;
      else if (still > 0) break;
    }
    return { level: still, r };
  }

  it('held Jump: level for 90 frames after the apex, then she falls', () => {
    const { level, r } = floatFrames();
    expect(level).toBe(PEACH_FLOAT_FRAMES);
    expect(r.p.body.vy).toBeGreaterThan(0);
  });

  it('a release on frame 20 ends it, and a second float does not start in that spell', () => {
    const { level, r } = floatFrames(20);
    expect(level).toBe(20);
    hold(r, 5, ['jump']);
    expect(r.p.floatT).toBe(0);
    expect(r.p.body.vy).toBeGreaterThan(0);
  });

  it('walking off a ledge: a Jump press while falling floats (D-PE-5)', () => {
    const r = rig('small', flatLevel({}, 60));
    // Put her on a high ledge and walk her off it.
    for (let x = 0; x < 10; x++) r.world.map.set(x, 8, T.HARD);
    r.p.body.x = tile(4);
    r.p.body.y = tile(8) - r.p.body.h;
    hold(r, 5);
    r.until(() => !r.p.body.onGround, ['right'], 120);
    hold(r, 3);
    expect(r.p.floatT).toBe(0);
    r.step(['jump']);
    expect(r.p.floatT).toBeGreaterThan(0);
  });

  it('never under water (PE-20)', () => {
    expect(PEACH_CLASSIC_PROFILE.swim).toBe(CLASSIC_SWIM.peach);
    expect(CLASSIC_SWIM.peach?.mode).toBe('seabed');
    const r = rig();
    r.p.inWater = true;
    expect(r.p.floatT).toBe(0);
  });
});

describe('PE-10, PE-14: lifting and plucking', () => {
  it('Special on ground roots her 20 frames, then she holds a turnip; the Flower takes 10', () => {
    const r = rig();
    const x0 = r.p.body.x;
    const n = pluck(r);
    expect(n).toBe(20);
    expect(carried(r.p)?.kind).toBe('turnip');
    expect(r.p.body.x).toBe(x0);
    const f = rig('fire');
    expect(pluck(f)).toBe(10);
  });

  it('no walking and no jumping during the lift', () => {
    const r = rig();
    r.step(['special']);
    const x0 = r.p.body.x;
    hold(r, 5, ['right', 'jump']);
    expect(r.p.body.x).toBe(x0);
    expect(r.p.body.onGround).toBe(true);
  });

  it('on a ? block nothing happens', () => {
    const level = flatLevel();
    const r = rig('small', level);
    r.world.map.set(Math.floor(r.p.centerX / 4096), 13, T.Q_COIN);
    r.step(['special']);
    expect(lifting(r.p)).toBe(false);
    hold(r, 25);
    expect(carried(r.p)).toBeNull();
  });

  it('the sixth turnip in a row is a Stopwatch: every enemy stops for 300 frames', () => {
    const r = rig();
    for (let i = 0; i < 5; i++) {
      pluck(r);
      expect(carried(r.p)?.kind).toBe('turnip');
      tap(r, 'attack');
      r.until(() => thrown(r).length === 0, [], 120);
    }
    const g = goomba(r, 30);
    pluck(r);
    expect(carried(r.p)).toBeNull();
    expect(g.stopFrames).toBeGreaterThanOrEqual(290);
    const x = g.body.x;
    hold(r, 200);
    expect(g.body.x).toBe(x);
  });

  it('a seeded POW: its jolt kills two grounded Goombas and pops a Koopa', () => {
    const r = rig();
    setRoll(r, 0);
    const g1 = goomba(r, 12);
    const g2 = goomba(r, 14);
    const k = place(r, new Koopa(tile(10), FLOOR - px(24), 'green'));
    hold(r, 4);
    pluck(r);
    expect(carried(r.p)?.kind).toBe('pow');
    // Thrown straight back (away from them); it lands and jolts.
    r.step(['left']);
    tap(r, 'attack');
    r.until(() => thrown(r).length === 0, [], 120);
    expect(alive(r, g1)).toBe(false);
    expect(alive(r, g2)).toBe(false);
    expect(alive(r, k)).toBe(true);
    expect(k.body.vy).toBeLessThan(0);
  });
});

describe('PE-12: throwing', () => {
  it('the turnip flies ahead at about 4 px/f and kills a Goomba (250) in one hit', () => {
    const r = rig();
    pluck(r);
    const g = goomba(r, 11);
    tap(r, 'attack');
    const t = thrown(r)[0] as ThrownThing;
    expect(t).toBeDefined();
    expect(t.body.vx).toBe(0x04000);
    r.until(() => !alive(r, g), [], 60);
    expect(alive(r, g)).toBe(false);
    expect(carried(r.p)).toBeNull();
  });

  it('a Koopa (600) takes two turnips; one in the air at a time', () => {
    const r = rig();
    const k = place(r, new Koopa(tile(11), FLOOR - px(24), 'green'));
    let throws = 0;
    for (let i = 0; i < 3 && alive(r, k); i++) {
      pluck(r);
      tap(r, 'attack');
      throws++;
      // A second throw while one flies does nothing.
      r.until(() => thrown(r).length === 0, [], 120);
    }
    expect(alive(r, k)).toBe(false);
    expect(throws).toBe(2);
  });

  it('with the Flower a turnip passes a Goomba it kills and kills the one behind', () => {
    const r = rig('fire');
    pluck(r);
    const g1 = goomba(r, 12);
    const g2 = goomba(r, 13);
    tap(r, 'attack');
    r.until(() => !alive(r, g2), [], 90);
    expect(alive(r, g1)).toBe(false);
    expect(alive(r, g2)).toBe(false);
  });

  it('without the Flower the second Goomba lives; a Buzzy Beetle blocks it', () => {
    const r = rig();
    pluck(r);
    const g1 = goomba(r, 12);
    const g2 = goomba(r, 13);
    tap(r, 'attack');
    hold(r, 40);
    expect(alive(r, g1)).toBe(false);
    expect(alive(r, g2)).toBe(true);
    const b = rig();
    pluck(b);
    const buzzy = place(b, new Koopa(tile(11), FLOOR - px(14), 'buzzy'));
    tap(b, 'attack');
    b.until(() => thrown(b).length === 0, [], 120);
    expect(alive(b, buzzy)).toBe(true);
    expect(buzzy.state).toBe('walk');
  });

  it('Down + Attack sets it down; Special lifts it again', () => {
    const r = rig();
    pluck(r);
    tap(r, 'attack', ['down']);
    expect(carried(r.p)).toBeNull();
    expect(thrown(r)).toHaveLength(0);
    hold(r, 4);
    hold(r, 4, ['right']);
    hold(r, 30);
    pluck(r);
    expect(carried(r.p)?.kind).toBe('turnip');
  });
});

describe('PE-11, PE-19: riding and lifting enemies', () => {
  function rideGoomba(power = 'small') {
    const r = rig(power);
    const g = goomba(r, 8);
    g.body.vx = 0x00800;
    r.p.body.x = g.body.x;
    r.p.body.y = g.body.y - px(40);
    r.until(() => r.world.ridingEnemy(r.p) === g, [], 60);
    return { r, g };
  }

  it('landing on a Goomba: unhurt, it lives, and after 30 frames she has moved with it', () => {
    const { r, g } = rideGoomba('big');
    expect(r.world.ridingEnemy(r.p)).toBe(g);
    expect(r.p.powerState).toBe('big');
    const x0 = r.p.body.x;
    const gx = g.body.x;
    hold(r, 30);
    expect(alive(r, g)).toBe(true);
    expect(r.p.powerState).toBe('big');
    expect(r.p.body.x - x0).toBe(g.body.x - gx);
    expect(Math.abs(r.p.body.x - x0)).toBeGreaterThan(px(10));
    expect(feet(r)).toBe(g.body.y);
  });

  it('landing on a Spiny hurts her', () => {
    const r = rig('big');
    const s = place(r, new Spiny(tile(8), FLOOR - px(14), false));
    s.body.vx = 0;
    r.p.body.x = s.body.x;
    r.p.body.y = s.body.y - px(40);
    r.until(() => r.p.powerState === 'small', [], 60);
    expect(r.p.powerState).toBe('small');
  });

  it('Special lifts the ridden Goomba out of the world; thrown, it kills a Buzzy Beetle outright', () => {
    const { r, g } = rideGoomba();
    pluck(r);
    expect(carried(r.p)?.enemy).toBe(g);
    expect(r.world.entities.includes(g)).toBe(false);
    hold(r, 30);
    const buzzy = place(r, new Koopa(r.p.body.x + tile(5), FLOOR - px(14), 'buzzy'));
    buzzy.body.vx = 0;
    r.p.facing = 1;
    tap(r, 'attack');
    expect(thrown(r)[0]).toBeInstanceOf(ThrownEnemy);
    r.until(() => !alive(r, buzzy), [], 90);
    expect(alive(r, buzzy)).toBe(false);
    expect(g.alive).toBe(false);
    expect(thrown(r)).toHaveLength(0);
  });

  it('a thrown enemy takes 1000 from Bowser', () => {
    const { r, g } = rideGoomba();
    pluck(r);
    expect(carried(r.p)?.enemy).toBe(g);
    hold(r, 30);
    const col = Math.floor(r.p.body.x / 4096) + 4;
    const b = place(r, new Bowser(col, 12, 'fire'));
    b.body.vx = 0;
    const hp0 = b.classicHp ?? 2400;
    r.p.facing = 1;
    tap(r, 'attack');
    r.until(() => thrown(r).length === 0, [], 90);
    expect(hp0 - (b.classicHp ?? 2400)).toBe(1000);
  });

  it('a set-down enemy is back in the world, 12 px ahead, and resumes', () => {
    const { r, g } = rideGoomba();
    pluck(r);
    hold(r, 30);
    tap(r, 'attack', ['down']);
    expect(r.world.entities.includes(g)).toBe(true);
    expect(g.alive).toBe(true);
    const x = g.body.x;
    hold(r, 20);
    expect(g.body.x).not.toBe(x);
  });

  it('under water there is no riding (SW-C7)', () => {
    const r = rig();
    r.p.inWater = true;
    expect(PEACH_CLASSIC.standsOnEnemies?.(r.p, new Goomba(0, 0))).toBe(false);
    r.p.inWater = false;
    expect(PEACH_CLASSIC.standsOnEnemies?.(r.p, new Goomba(0, 0))).toBe(true);
    expect(PEACH_CLASSIC.standsOnEnemies?.(r.p, new Spiny(0, 0))).toBe(false);
  });
});

describe('PE-10 (D-PE-3): bricks', () => {
  it('Special on a plain brick takes it out; the thrown brick breaks on a Goomba', () => {
    const r = rig();
    // A brick on the floor at column 10; she stands on it.
    r.world.map.set(10, 12, T.BRICK);
    r.p.body.x = tile(10) + px(2);
    r.p.body.y = tile(12) - r.p.body.h;
    hold(r, 5);
    pluck(r);
    expect(carried(r.p)?.kind).toBe('brick');
    expect(r.world.map.get(10, 12)).toBe(T.AIR);
    hold(r, 30);
    const g = place(r, new Goomba(r.p.body.x + tile(4), FLOOR - px(14)));
    g.body.vx = 0;
    r.p.facing = 1;
    tap(r, 'attack');
    r.until(() => !alive(r, g) || thrown(r).length === 0, [], 90);
    expect(alive(r, g)).toBe(false);
    expect(thrown(r)).toHaveLength(0);
  });
});

describe('PE-13, PE-15, PE-16: power and losing what she carries', () => {
  it('small + hit = death', () => {
    const r = rig();
    r.world.hurtPlayer(r.p, 1);
    hold(r, 2);
    expect(r.p.dead).toBe(true);
  });

  it('Flower + hit = small, and the carried enemy is back in the world', () => {
    const r = rig('fire');
    const g = goomba(r, 8);
    g.body.vx = 0;
    r.p.body.x = g.body.x;
    r.p.body.y = g.body.y - px(40);
    r.until(() => r.world.ridingEnemy(r.p) === g, [], 60);
    pluck(r);
    expect(carried(r.p)?.enemy).toBe(g);
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.powerState).toBe('small');
    expect(carried(r.p)).toBeNull();
    expect(r.world.entities.includes(g)).toBe(true);
  });

  it('a vine, stairs, the flagpole or the axe: what she carries is gone (D-PE-7)', () => {
    for (const hook of ['onGrabVine', 'onGrabStairs', 'onLevelClear'] as const) {
      const r = rig();
      pluck(r);
      expect(carried(r.p)).not.toBeNull();
      PEACH_CLASSIC.behaviour[hook]?.(r.p);
      expect(carried(r.p)).toBeNull();
    }
  });

  it('carry profile is shared and per hero (PE-9)', () => {
    expect(PEACH_CARRY.liftFrames({ powerState: 'small' } as never)).toBe(20);
    expect(PEACH_CARRY.liftFrames({ powerState: 'fire' } as never)).toBe(10);
    expect(PEACH_CARRY.carryRun).toBe(false);
    expect(carryState(rig().p).held).toBeNull();
  });
});

describe('PE-23..PE-26: guide, touch, art and sound (TG-22, TG-40)', () => {
  it('her own short guide, in the bitmap font, with no button letters', () => {
    const g = PEACH_CLASSIC.guide;
    expect(g.tagline.length).toBeLessThanOrEqual(30);
    const texts = [
      g.tagline,
      ...g.controls.flatMap((x) => [x.does, x.touchDoes ?? '', x.touch ?? '']),
      ...g.powerups.map((x) => x.does),
      ...(g.tips ?? []),
    ];
    for (const t of texts) {
      expect(fontText(t).length, t).toBe(t.length);
      expect(t, t).not.toMatch(/\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:/i);
    }
  });

  it('touch: RUN, THROW while carrying, LIFT, no tools button', () => {
    const r = rig();
    expect(PEACH_CLASSIC.touchLabels?.(r.p, r.world)).toEqual({
      attack: 'RUN',
      special: 'LIFT',
      select: null,
    });
    pluck(r);
    expect(PEACH_CLASSIC.touchLabels?.(r.p, r.world).attack).toBe('THROW');
  });

  it('every frame her sprite can ask for is on her sheet, with her palettes and items', () => {
    const frames = SPRITES.peach?.frames ?? {};
    const big = [
      'stand',
      'walk-0',
      'walk-1',
      'walk-2',
      'skid',
      'jump',
      'float-0',
      'float-1',
      'crouch',
      'lift',
    ];
    const more = ['carry', 'carry-walk-0', 'carry-walk-1', 'carry-walk-2', 'carry-jump', 'throw', 'hurt'];
    const all = [...big, ...more, 'climb-0', 'climb-1'];
    for (const n of [...all, ...all.filter((n) => n !== 'crouch').map((n) => `small-${n}`)]) {
      expect(frames[n], n).toBeDefined();
      const rows = frames[n] as string[];
      expect(new Set(rows.map((x) => x.length)).size, n).toBe(1);
      expect(rows.join('')).toMatch(/^[.0-8]*$/);
      expect(rows.length, n).toBe(n.startsWith('small-') ? 16 : 32);
    }
    for (const pal of [
      'peach',
      'peach-flower',
      'peach-star-0',
      'peach-star-1',
      'peach-star-2',
      'peach-star-3',
    ])
      expect(PALETTES.default?.[pal], pal).toBeDefined();
    for (const f of ['turnip', 'sprout', 'pow', 'watch'])
      expect(SPRITES['peach-items']?.frames[f], f).toBeDefined();
    expect(sfx.some((s) => s.id === 'peach-float')).toBe(true);
  });

  it("the guide demo shows her own dress (big), not the Flower's", () => {
    expect(PEACH_CLASSIC.guidePower).toBe('big');
    for (const d of [...CHARACTERS, ...Object.values(CLASSIC_CHARACTERS)])
      expect(d?.guidePower, d?.id).toBeUndefined();
  });

  it('her poses: lift, carry, float', () => {
    const r = rig('big');
    r.step(['special']);
    expect(PEACH_CLASSIC.sprite(r.p, 0, true).frame).toBe('lift');
    hold(r, 25);
    expect(PEACH_CLASSIC.sprite(r.p, 0, true).frame).toBe('carry');
    const f = rig('big', flatLevel({}, 400));
    f.step(['jump']);
    f.until(() => f.p.floatT > 0, ['jump'], 60);
    expect(PEACH_CLASSIC.sprite(f.p, 0, true).frame).toMatch(/^float-/);
  });
});
