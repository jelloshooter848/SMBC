import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { SIMON, SIMON_PROFILE } from '@game/characters/simon';
import { HAND_AXE, CROSS } from '@game/characters/simon/weapons';
import { SIMON_CLASSIC, SIMON_CLASSIC_PROFILE, START_HEARTS } from '@game/characters/simon/classic';
import {
  AXE_CLASSIC,
  CROSS_CLASSIC,
  DAGGER_CLASSIC,
  HOLY_FLAME_CLASSIC,
  HOLY_WATER_CLASSIC,
} from '@game/characters/simon/classic-weapons';
import { heroFor } from '@game/characters/registry';
import { Projectile } from '@game/entities/projectiles/projectile';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { parseTextMap } from '@game/level/textmap';
import { simonFlameDef } from '@content/sprites/simon-flame';
import { T } from '@game/level/tiles';
import { runSim } from '@game/sim/headless';
import { fontText } from '@game/hud/text';
import { flatLevel, measureJump, Rig } from './classic-plumber-harness';

// Classic SMBC Simon (bug-reports/2026-10-07-simon-classic-smbc-rules.md, SI-C1..SI-C32): the
// report's acceptance checks, measured on the real def through the World.

const INF = Infinity;
const WALK = 0x01400;

function rig(power = 'small', rows: Record<number, string> = {}): Rig {
  const r = new Rig(SIMON, flatLevel(rows, 200), 'classic', power);
  r.settle();
  return r;
}

/** Presses `a` for one frame (a fresh press), then steps `n - 1` more frames holding `hold`. */
function tap(r: Rig, a: Action, n = 1, hold: Action[] = []): void {
  r.step([a, ...hold]);
  for (let i = 1; i < n; i++) r.step(hold);
}

function shots(r: Rig, kind?: string): Projectile[] {
  return r.world.entities.filter(
    (e): e is Projectile => e instanceof Projectile && e.alive && (kind === undefined || e.kind === kind),
  );
}

describe('registry and Campaign (TG-17, TG-18, TG-38, acceptance 11)', () => {
  it('Classic rules play SIMON_CLASSIC; Campaign keeps SIMON untouched', () => {
    expect(heroFor(SIMON, 'classic')).toBe(SIMON_CLASSIC);
    expect(heroFor(SIMON, 'campaign')).toBe(SIMON);
    expect(SIMON_CLASSIC.rules).toBe('classic');
    expect(SIMON.rules).toBeUndefined();
    expect([SIMON_CLASSIC.id, SIMON_CLASSIC.name, SIMON_CLASSIC.hudName, SIMON_CLASSIC.portrait]).toEqual([
      SIMON.id,
      SIMON.name,
      SIMON.hudName,
      SIMON.portrait,
    ]);
    expect(SIMON.movement).toBe(SIMON_PROFILE);
    for (const k of ['airStop', 'turnInAir', 'jumpBuffer', 'rise', 'softCut', 'inertia'])
      expect(k in SIMON_PROFILE, k).toBe(false);
    expect(SIMON.behaviour.rooted).toBeUndefined();
    expect(SIMON.meleeStrikesBlocks).toBeUndefined();
    expect(SIMON.canBreakBricks({} as never)).toBe(true);
    expect(HAND_AXE.maxFall).toBeUndefined();
    expect(CROSS.classicBlocks).toBeUndefined();
  });

  it('Campaign Simon still walks 1.0 px/f and peaks at 67-68 px', () => {
    const j = measureJump(SIMON, 0, INF, 'campaign');
    expect(Math.floor(j.apex)).toBeGreaterThanOrEqual(67);
    expect(Math.floor(j.apex)).toBeLessThanOrEqual(68);
    const r = new Rig(SIMON, flatLevel(), 'campaign');
    r.settle();
    for (let i = 0; i < 20; i++) r.step(['right']);
    expect(r.p.body.vx).toBe(0x01000);
    const sim = runSim({ level: flatLevel(), character: SIMON, script: { steps: [] }, maxFrames: 1 });
    expect(sim.world.player.def).toBe(SIMON);
  });

  it('a Classic world gives Simon his Classic def', () => {
    const sim = runSim({
      level: flatLevel(),
      character: SIMON,
      rules: 'classic',
      script: { steps: [] },
      maxFrames: 2,
    });
    expect(sim.world.player.def).toBe(SIMON_CLASSIC);
    expect(sim.world.state.character).toBe(SIMON);
    expect(sim.world.player.scratch.hearts).toBe(START_HEARTS);
  });
});

describe('constants against the original (SI-C3, SI-C5, SI-C9, SI-C21..SI-C24)', () => {
  it('profile', () => {
    const p = SIMON_CLASSIC_PROFILE;
    expect([p.maxWalk, p.maxRun, p.instantAccel, p.canRun]).toEqual([WALK, WALK, true, false]);
    expect(p.jump).toEqual([{ maxVx: INF, initial: 0x04800, holdGravity: 0x00355, fallGravity: 0x00355 }]);
    expect([p.maxFall, p.fallReset, p.variableJump, p.coyoteFrames, p.airJumps]).toEqual([
      0x10aab,
      0x10aab,
      false,
      0,
      1,
    ]);
    expect([p.turnInAir, p.jumpBuffer, p.airStop]).toEqual([false, false, true]);
    expect(p.swim).toMatchObject({
      stroke: 0x049ab,
      gravity: 0x001ab,
      sinkMax: 0x02155,
      floorJumpOnly: true,
    });
  });

  it('weapons', () => {
    expect([
      AXE_CLASSIC.amount,
      AXE_CLASSIC.speed,
      AXE_CLASSIC.vy,
      AXE_CLASSIC.gravity,
      AXE_CLASSIC.maxFall,
    ]).toEqual([350, 0x02155, -0x04aab, 0x00355, 0x07800]);
    expect([CROSS_CLASSIC.amount, CROSS_CLASSIC.speed, CROSS_CLASSIC.gravity]).toEqual([300, 0x01aab, 0]);
    expect([DAGGER_CLASSIC.amount, DAGGER_CLASSIC.speed, DAGGER_CLASSIC.onBlocked]).toEqual([
      300,
      0x042ab,
      'remove',
    ]);
    expect([HOLY_WATER_CLASSIC.amount, HOLY_WATER_CLASSIC.vy, HOLY_WATER_CLASSIC.gravity]).toEqual([
      50, -0x00d55, 0x002ab,
    ]);
    expect(HOLY_WATER_CLASSIC.classicHit?.pierce).toBe(6);
    expect([
      HOLY_FLAME_CLASSIC.amount,
      HOLY_FLAME_CLASSIC.lifetime,
      HOLY_FLAME_CLASSIC.classicHit?.pierce,
    ]).toEqual([200, 70, 6]);
  });
});

describe('movement (acceptance 1-4; SI-C2, SI-C3, SI-C6, SI-C7)', () => {
  it('1. walk: full speed on the first held frame, 0 on the first released frame, ground and air', () => {
    const r = rig();
    r.step(['right']);
    expect(r.p.body.vx).toBe(WALK);
    r.step([]);
    expect(r.p.body.vx).toBe(0);
    r.step(['left', 'right']);
    expect(r.p.body.vx).toBe(0);
    tap(r, 'jump', 5, ['jump']);
    r.step(['jump', 'left']);
    expect(r.p.body.vx).toBe(-WALK);
    r.step(['jump']);
    expect(r.p.body.vx).toBe(0);
  });

  it('2. standing jump peaks at 50-52 px; an air jump at the apex reaches about 102 px; a third press does nothing', () => {
    const j = measureJump(SIMON_CLASSIC, 0, INF);
    expect(j.apex).toBeGreaterThanOrEqual(50);
    expect(j.apex).toBeLessThanOrEqual(52);
    const r = rig();
    const b = r.p.body;
    const y0 = b.y + b.h;
    tap(r, 'jump');
    r.until(() => b.vy >= 0);
    tap(r, 'jump');
    let min = b.y + b.h;
    let third = false;
    for (let i = 0; i < 120 && !b.onGround; i++) {
      if (!third && b.vy >= 0) {
        // The third press, at the second apex: vy goes on growing.
        const vy = b.vy;
        tap(r, 'jump');
        expect(b.vy).toBe(vy + 0x00355);
        third = true;
      } else r.step();
      min = Math.min(min, b.y + b.h);
    }
    expect(third).toBe(true);
    expect((y0 - min) / 256).toBeGreaterThan(100);
    expect((y0 - min) / 256).toBeLessThan(104);
  });

  it('3. walking off a ledge leaves the air jump ready; in the air at the start it is not', () => {
    const r = new Rig(SIMON, flatLevel({ 12: '########' }, 200), 'classic');
    r.settle();
    const b = r.p.body;
    r.until(() => !b.onGround && b.vy > 0x00800, ['right']);
    tap(r, 'jump');
    // The jump sets -0x4800; gravity follows the move as for every jump.
    expect(b.vy).toBe(-0x04800 + 0x00355);
    // A level start in mid-air: no air jump until he lands.
    const air = new Rig(SIMON, flatLevel({}, 200, []), 'classic');
    air.p.body.y -= px(64);
    air.p.body.onGround = false;
    air.step();
    air.step();
    const vy = air.p.body.vy;
    tap(air, 'jump');
    expect(air.p.body.vy).toBe(vy + 0x00355);
  });

  it('4. from the apex, 10 frames of right move him 12.5 px; on release he stops dead', () => {
    const r = rig();
    const b = r.p.body;
    tap(r, 'jump');
    r.until(() => b.vy >= 0);
    const x0 = b.x;
    for (let i = 0; i < 10; i++) r.step(['right']);
    expect(b.x - x0).toBe(px(12.5));
    const x1 = b.x;
    r.step();
    expect(b.x).toBe(x1);
    // He never turns in the air: holding left moves him back while he faces right.
    r.step(['left']);
    expect(r.p.facing).toBe(1);
    expect(b.vx).toBe(-WALK);
  });
});

describe('the whip (acceptance 5-7; SI-C4, SI-C14..SI-C17, SI-C27)', () => {
  it('5. roots him for 21 frames; the box lives on frames 14-20 only, centre +7.5 to +36 px (Flower +51)', () => {
    for (const [power, reach] of [
      ['small', 36],
      ['fire', 51],
    ] as const) {
      const r = rig(power);
      const p = r.p;
      const x0 = p.body.x;
      const live: number[] = [];
      for (let f = 0; f <= 21; f++) {
        r.step(f === 0 ? ['attack', 'right'] : ['right']);
        if (f < 21) expect(p.body.x, `frame ${f}`).toBe(x0);
        if (p.activeMelee) {
          live.push(f);
          expect(p.activeMelee.x).toBe(p.centerX + px(7.5));
          expect(p.activeMelee.x + p.activeMelee.w).toBe(p.centerX + px(reach));
          expect(p.activeMelee.y).toBe(p.feetY - px(24));
          expect(p.activeMelee.h).toBe(px(11));
        }
      }
      expect(live).toEqual([14, 15, 16, 17, 18, 19, 20]);
      // Frame 21: free again, he walks.
      expect(p.body.x).toBe(x0 + px(1.25));
    }
  });

  it('6. Leather: the first hit leaves a Goomba alive and frozen 24 frames, the second kills; Morning Star kills in one', () => {
    const r = rig();
    const p = r.p;
    const g = new Goomba(p.centerX + px(22), p.feetY - px(14));
    r.world.spawn(g);
    tap(r, 'attack', 15);
    expect(g.alive).toBe(true);
    expect(g.classicHp).toBe(50);
    expect(g.stopFrames).toBe(24);
    const gx = g.body.x;
    let still = 0;
    while (g.body.x === gx && still < 40) {
      r.step();
      still++;
    }
    expect(still).toBe(25); // 24 frames held, it moves on the 25th
    const big = rig('big');
    const g2 = new Goomba(big.p.centerX + px(22), big.p.feetY - px(14));
    big.world.spawn(g2);
    tap(big, 'attack', 15);
    expect(g2.classicHp ?? 0).toBeLessThanOrEqual(0);
    // The second Leather hit kills.
    const r2 = rig();
    const g3 = new Goomba(r2.p.centerX + px(22), r2.p.feetY - px(14));
    r2.world.spawn(g3);
    tap(r2, 'attack', 21);
    tap(r2, 'attack', 15);
    expect(g3.classicHp ?? 0).toBeLessThanOrEqual(0);
  });

  it('a standing whip reaches a Koopa, a Koopa shell and a Buzzy Beetle on the same floor', () => {
    for (const make of [
      (x: number, y: number) => new Koopa(x, y, 'green'),
      (x: number, y: number) => new Koopa(x, y, 'buzzy'),
    ]) {
      const r = rig('fire');
      const k = make(r.p.centerX + px(22), r.p.feetY - px(24));
      r.world.spawn(k);
      k.body.y = r.p.feetY - k.body.h;
      k.stopFrames = 1000;
      tap(r, 'attack', 15);
      // The Koopa takes the hit; the armoured Buzzy is reached but blocks it.
      if (k.color === 'buzzy') expect(k.classicHp ?? 600).toBe(600);
      else expect(k.classicHp).toBeLessThan(600);
      expect(r.p.scratch[`hit${k.id}`]).toBe(1);
    }
  });

  it('the Flame Whip has its own strike art, reaching 51 px', () => {
    const r = rig('fire');
    tap(r, 'attack', 15);
    const s = SIMON_CLASSIC.sprite(r.p, 0, true);
    expect([s.sheet, s.frame]).toEqual(['simon-flame', 'whip-flame']);
    const rows = simonFlameDef.frames['whip-flame'] as string[];
    const tip = Math.max(...rows.map((row) => row.replace(/\.+$/, '').length - 1));
    // Hitbox at column offsetX (2), 12 wide: centre column 8.
    expect(tip - 8).toBe(51);
  });

  it('no rooting on a throw press at the shot cap (nothing is thrown)', () => {
    const r = rig();
    tap(r, 'special', 22); // the throw is over, its Axe still flying
    expect(shots(r).length).toBe(1);
    const x = r.p.body.x;
    r.step(['special', 'right']);
    expect(r.p.body.x).toBe(x + px(1.25));
  });

  it('6. a hit-stunned Goomba still hurts him on contact', () => {
    const r = rig('big');
    const g = new Goomba(r.p.body.x, r.p.feetY - px(14));
    g.stopFrames = 24;
    r.world.spawn(g);
    r.step();
    expect(r.p.powerState).toBe('small');
    expect(r.p.hurtLock).not.toBeNull();
  });

  it('7. a whip from a jump breaks a brick; his head only bumps one', () => {
    // Head: a brick right above him bumps and stays.
    const head = rig('fire', { 9: '......=' });
    tap(head, 'jump');
    head.until(() => head.p.body.onGround, [], 200);
    head.settle();
    expect(head.world.map.get(6, 9)).toBe(T.BRICK);
    // Whip: a brick ahead at head height, struck in mid-air.
    let broke = false;
    for (let d = 0; d < 20 && !broke; d++) {
      const r = rig('small', { 10: '........=' });
      tap(r, 'jump', d + 1);
      tap(r, 'attack', 21);
      broke = r.world.map.get(8, 10) !== T.BRICK;
    }
    expect(broke).toBe(true);
  });

  it('the whip on a ? block from the side bumps it (its coin comes out)', () => {
    const r = rig('small', { 11: '........?' });
    const coins = r.world.state.coins;
    tap(r, 'attack', 21);
    r.step();
    expect(r.world.state.coins).toBe(coins + 1);
  });
});

describe('sub-weapons (acceptance 8-9; SI-C18..SI-C26)', () => {
  it('8. the Axe: 10 → 9 hearts on frame 14, not on the press; its apex is about 50 px above the spawn', () => {
    const r = rig();
    const p = r.p;
    const hearts: number[] = [];
    let axe: Projectile | undefined;
    for (let f = 0; f <= 14; f++) {
      r.step(f === 0 ? ['special'] : []);
      hearts.push(p.scratch.hearts ?? 0);
      axe ??= shots(r, 'hand-axe')[0];
      if (f < 14) expect(axe, `frame ${f}`).toBeUndefined();
    }
    expect(hearts.slice(0, 14).every((h) => h === 10)).toBe(true);
    expect(hearts[14]).toBe(9);
    expect(axe).toBeDefined();
    const a = axe as Projectile;
    // Spawned 11 px ahead of his centre, 25 px above his feet (its first update ran already).
    const spawnY = p.feetY - px(25);
    let top = a.body.y + (a.body.h >> 1);
    while (a.alive && a.body.vy < 0) {
      r.step();
      top = Math.min(top, a.body.y + (a.body.h >> 1));
    }
    expect((spawnY - top) / 256).toBeGreaterThan(48);
    expect((spawnY - top) / 256).toBeLessThan(52);
    // A second Axe waits: the small shot cap is 1.
    tap(r, 'special', 15);
    expect(shots(r, 'hand-axe').length).toBe(1);
  });

  it('8. Flower + Select: a Cross for 2 hearts, turning back after about 124 px, caught by Simon', () => {
    const r = rig('fire');
    const p = r.p;
    tap(r, 'select', 15);
    expect(p.scratch.hearts).toBe(8);
    const c = shots(r, 'cross')[0] as Projectile;
    expect(c).toBeDefined();
    const x0 = c.body.x - CROSS_CLASSIC.speed / 16; // its first frame's move
    let far = c.body.x;
    let frames = 0;
    while (c.alive && frames < 400) {
      r.step();
      far = Math.max(far, c.body.x);
      frames++;
    }
    expect((far - x0) / 256).toBeGreaterThan(118);
    expect((far - x0) / 256).toBeLessThan(130);
    expect(c.alive).toBe(false);
    expect(frames).toBeLessThan(200);
  });

  it('Select does nothing without the Fire Flower', () => {
    const r = rig('big');
    tap(r, 'select', 20);
    expect(shots(r).length).toBe(0);
    expect(r.p.scratch.hearts).toBe(10);
  });

  it('a jump cancels a throw: before frame 14 nothing is thrown or paid', () => {
    const r = rig();
    tap(r, 'special', 5);
    tap(r, 'jump', 20, ['jump']);
    expect(shots(r).length).toBe(0);
    expect(r.p.scratch.hearts).toBe(10);
  });

  it('9. Stopwatch (kit=full, Select to it): 5 hearts with no enemy near; enemies stop 180 frames', () => {
    const r = new Rig(SIMON, flatLevel({}, 200), 'classic', 'fire');
    Object.assign(r.p.scratch, SIMON_CLASSIC.devKit?.());
    r.settle();
    const far = new Goomba(px(600), px(13 * 16 - 14));
    r.world.spawn(far);
    for (let i = 0; i < 4; i++) tap(r, 'select', 2);
    expect(SIMON_CLASSIC.tools?.(r.p)[r.p.scratch.tool ?? 0]?.id).toBe('stopwatch');
    tap(r, 'special');
    expect(r.p.scratch.hearts).toBe(94);
    // The press frame is the first of the 180 (enemies update after the players).
    expect(far.stopFrames).toBe(179);
    const x = far.body.x;
    // Not again while it runs.
    tap(r, 'special', 2);
    expect(r.p.scratch.hearts).toBe(94);
    for (let i = 0; i < 177; i++) r.step();
    expect(far.body.x).toBe(x);
    expect(far.stopFrames).toBe(0);
    // Once it is over, again.
    tap(r, 'special');
    expect(r.p.scratch.hearts).toBe(89);
  });

  it('kit=full cycles all five sub-weapons on Select', () => {
    const r = new Rig(SIMON, flatLevel({}, 200), 'classic', 'fire');
    Object.assign(r.p.scratch, SIMON_CLASSIC.devKit?.());
    r.settle();
    expect(SIMON_CLASSIC.tools?.(r.p).map((t) => t.id)).toEqual([
      'hand-axe',
      'cross',
      'dagger',
      'holy-water',
      'stopwatch',
    ]);
    tap(r, 'select', 2);
    tap(r, 'select', 2);
    tap(r, 'special', 15);
    expect(shots(r, 'dagger').length).toBe(1);
    expect(SIMON_CLASSIC.hudAmmo?.(r.p)).toBeNull();
  });

  it('the Holy Water bottle bursts into a still flame on the floor', () => {
    const r = new Rig(SIMON, flatLevel({}, 200), 'classic', 'fire');
    Object.assign(r.p.scratch, SIMON_CLASSIC.devKit?.(), { tool: 3 });
    r.settle();
    tap(r, 'special', 40);
    const f = shots(r, 'holy-fire');
    expect(f.length).toBe(1);
    expect((f[0] as Projectile).body.vx).toBe(0);
    for (let i = 0; i < 80; i++) r.step();
    expect(shots(r, 'holy-fire').length).toBe(0);
  });
});

describe('power states (acceptance 10; SI-C10..SI-C13)', () => {
  it('Mushroom, Flower, then a hit: small, leather whip, cap 1, Select inert, Axe and hearts kept; a second hit kills', () => {
    const r = rig();
    const p = r.p;
    p.def.behaviour.onPowerUp(p, 'mushroom', r.world);
    r.until(() => p.transition === null);
    p.def.behaviour.onPowerUp(p, 'flower', r.world);
    r.until(() => p.transition === null);
    expect(p.powerState).toBe('fire');
    p.def.behaviour.onPowerUp(p, 'flower', r.world);
    expect(p.scratch.hearts).toBe(15);
    r.world.hurtPlayer(p, 1);
    expect(p.powerState).toBe('small');
    expect(p.scratch.hearts).toBe(15);
    r.until(() => p.hurtLock === null);
    expect(p.invuln).toBeGreaterThan(70);
    tap(r, 'select', 20);
    expect(shots(r).length).toBe(0);
    tap(r, 'special', 15);
    expect(shots(r, 'hand-axe').length).toBe(1);
    p.invuln = 0;
    r.world.hurtPlayer(p, 1);
    expect(p.dead).toBe(true);
  });

  it('the kit starts again after it is wiped (a death): 10 hearts', () => {
    const r = rig();
    r.p.scratch = {};
    r.step();
    expect(r.p.scratch.hearts).toBe(START_HEARTS);
  });

  it('the knockback hop: 1.25 px/f away, facing the source, about 14 px high', () => {
    const r = rig('big');
    const p = r.p;
    const y0 = p.feetY;
    r.world.hurtPlayer(p, -1); // source on his right
    expect(p.body.vx).toBe(-WALK);
    expect(p.facing).toBe(1);
    let min = p.feetY;
    r.until(() => {
      min = Math.min(min, p.feetY);
      return p.hurtLock === null;
    }, ['right']);
    expect((y0 - min) / 256).toBeGreaterThan(12);
    expect((y0 - min) / 256).toBeLessThan(16);
  });
});

describe('guide and touch (TG-22, TG-40)', () => {
  const ACTIONS = new Set(['left/right', 'jump', 'attack', 'special', 'select', 'down']);
  const LETTER = /\b(BUTTON )?[ABCXYZ]\b/;
  const PROSE =
    /\b(button|press|push|tap|hold)\s+[abcxyz]\b|\([abcxyz]\)|\b[abcxyz]\s*:|\b[bcxyz]\s*\/|\/\s*[abcxyz]\b/i;
  it('a complete Classic guide that names abilities, not buttons', () => {
    const g = SIMON_CLASSIC.guide;
    expect(g).not.toBe(SIMON.guide);
    expect(g.tagline.length).toBeLessThanOrEqual(30);
    for (const c of g.controls) expect(ACTIONS.has(c.action), c.action).toBe(true);
    for (const item of ['mushroom', 'flower', 'star'])
      expect(g.powerups.some((p) => p.item === item)).toBe(true);
    const texts = [
      g.tagline,
      ...g.controls.flatMap((x) => [x.does, x.touchDoes ?? '']),
      ...g.powerups.map((x) => x.does),
      ...(g.tips ?? []),
    ];
    for (const t of texts) {
      expect(fontText(t).length, t).toBe(t.length);
      expect(t.replace(/^\w+: /, '')).not.toMatch(PROSE);
    }
    for (const c of g.controls) if (c.touch) expect(c.touch).not.toMatch(LETTER);
  });

  it('touch labels: WHIP, AXE, and CROSS only with the Fire Flower; hearts in the HUD', () => {
    const r = rig();
    const l = SIMON_CLASSIC.touchLabels?.(r.p, r.world);
    expect(l).toEqual({ attack: 'WHIP', special: 'AXE', select: null });
    expect(SIMON_CLASSIC.hudAmmo?.(r.p)).toEqual({ icon: 'heart-small', count: 10 });
    expect(SIMON_CLASSIC.tools?.(r.p)).toEqual([]);
    const f = rig('fire');
    expect(SIMON_CLASSIC.touchLabels?.(f.p, f.world)?.select).toBe('CROSS');
  });
});

describe('water, blocks and armour (SI-C9, SI-C23, SI-C27, SI-C28)', () => {
  /** A deep water room: waves on row 2, the floor at row 28. */
  function deepWater() {
    const rows = Array.from({ length: 30 }, (_, y) =>
      y >= 28 ? '#'.repeat(48) : (y === 2 ? 'w'.repeat(48) : '').padEnd(48, '.'),
    );
    return parseTextMap(
      [
        'id: deep',
        'theme: water',
        'swim: true',
        'time: 300',
        'start: 4,27',
        'height: 30',
        'camera: free',
        '',
        '[tiles]',
        ...rows,
      ].join('\n'),
    );
  }

  it('SI-C9: under water a floor jump rises about 104 px, then the air jump again; no stroke', () => {
    const r = new Rig(SIMON, deepWater(), 'classic');
    r.settle();
    const b = r.p.body;
    const y0 = b.y + b.h;
    tap(r, 'jump');
    expect(b.vy).toBe(-0x049ab + 0x001ab);
    let min = y0;
    r.until(() => {
      min = Math.min(min, b.y + b.h);
      return b.vy >= 0;
    });
    expect(Math.abs((y0 - min) / 256 - 104)).toBeLessThanOrEqual(3);
    tap(r, 'jump');
    expect(b.vy).toBe(-0x049ab + 0x001ab);
    r.step();
    const vy = b.vy;
    tap(r, 'jump');
    expect(b.vy).toBe(vy + 0x001ab);
  });

  it('the Axe breaks the bricks it crosses and flies on', () => {
    const r = rig('small', { 10: '..........===' });
    tap(r, 'special', 15);
    const a = shots(r, 'hand-axe')[0] as Projectile;
    let broken = 0;
    r.until(
      () => {
        broken = [10, 11, 12].filter((x) => r.world.map.get(x, 10) !== T.BRICK).length;
        return !a.alive;
      },
      [],
      200,
    );
    expect(broken).toBeGreaterThan(0);
  });

  it('the Dagger passes plain ground but a brick stops it and breaks', () => {
    const r = new Rig(SIMON, flatLevel({ 12: '.........#...=' }, 200), 'classic', 'fire');
    Object.assign(r.p.scratch, SIMON_CLASSIC.devKit?.(), { tool: 2 });
    r.settle();
    r.step(['down']);
    tap(r, 'special', 15, ['down']);
    const d = shots(r, 'dagger')[0] as Projectile;
    expect(d).toBeDefined();
    r.until(() => !d.alive, ['down'], 120);
    expect(r.world.map.get(9, 12)).toBe(T.GROUND);
    expect(r.world.map.get(13, 12)).not.toBe(T.BRICK);
    expect(d.body.x).toBeLessThan(px(14 * 16));
  });

  it('a Buzzy Beetle: the Dagger is removed on it and does no damage', () => {
    const r = new Rig(SIMON, flatLevel({}, 200), 'classic', 'fire');
    Object.assign(r.p.scratch, SIMON_CLASSIC.devKit?.(), { tool: 2 });
    r.settle();
    const k = new Koopa(r.p.centerX + px(40), r.p.feetY - px(16), 'buzzy');
    r.world.spawn(k);
    k.stopFrames = 1000;
    r.step(['down']);
    tap(r, 'special', 15, ['down']);
    const d = shots(r, 'dagger')[0] as Projectile;
    r.until(() => !d.alive, ['down'], 60);
    expect(d.body.x).toBeLessThan(k.body.x + k.body.w);
    expect(k.classicHp ?? 600).toBe(600);
  });

  it('a hit cancels a whip in progress', () => {
    const r = rig('big');
    tap(r, 'attack', 5);
    r.world.hurtPlayer(r.p, 1);
    r.step();
    expect(r.p.scratch._act).toBe(0);
    expect(r.p.activeMelee).toBeNull();
  });
});

describe('vines (SI-C30)', () => {
  /** Puts Simon on a vine through his body, 16 px up. */
  function onVine(r: Rig): void {
    const b = r.p.body;
    r.p.vine = { x: b.x + (b.w >> 1), top: 0, bottom: 200 };
    b.y -= px(16);
  }

  it('SI-C30: on a vine no whip, no throw and no Select', () => {
    const r = rig('fire');
    r.p.scratch.hearts = 20;
    const tool = r.p.scratch.tool;
    onVine(r);
    for (const a of ['attack', 'special', 'select'] as const) {
      r.step([a]);
      r.step([]);
    }
    expect(r.p.attackTimer).toBe(0);
    expect(r.p.activeMelee).toBeNull();
    expect(shots(r)).toHaveLength(0);
    expect(r.p.scratch.tool).toBe(tool);
    expect(r.p.scratch.hearts).toBe(20);
  });

  it('SI-C30: grabbing a vine ends a knockback lock', () => {
    const r = rig('big');
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.hurtLock).not.toBeNull();
    onVine(r);
    r.step([]);
    expect(r.p.hurtLock).toBeNull();
  });

  it('SI-C30: a vine does not give the air jump back', () => {
    const r = rig();
    r.step(['jump']);
    for (let i = 0; i < 6; i++) r.step([]);
    r.step(['jump']);
    expect(r.p.airJumpsLeft).toBe(0);
    onVine(r);
    r.step([]);
    r.p.letGo();
    r.step([]);
    expect(r.p.body.onGround).toBe(false);
    expect(r.p.airJumpsLeft).toBe(0);
  });
});
