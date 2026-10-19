import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import { heroFor } from '@game/characters/registry';
import { SAMUS } from '@game/characters/samus';
import {
  SAMUS_CLASSIC,
  SAMUS_CLASSIC_PROFILE,
  classicSamus,
  crouchPose,
  flipping,
  inBall,
} from '@game/characters/samus/classic';
import { samusClassicGuide } from '@game/characters/samus/classic-guide';
import { ClassicBomb } from '@game/characters/samus/classic-bomb';
import { Projectile } from '@game/entities/projectiles/projectile';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Bowser } from '@game/entities/enemies/bowser';
import type { Enemy } from '@game/entities/enemies/enemy';
import { T } from '@game/level/tiles';
import { fontText } from '@game/hud/text';
import { Rig, flatLevel, measureJump } from './classic-plumber-harness';

// Classic SMBC Samus (2026-10-07-samus-classic-smbc-rules.md): the report's acceptance checks the
// engine can measure, frame by frame, with rules 'classic'.

const shots = (r: Rig) =>
  r.world.entities.filter((e): e is Projectile => e instanceof Projectile && e.alive && e.owner === r.p);
const bombs = (r: Rig) => r.world.entities.filter((e) => e instanceof ClassicBomb && e.alive);

/** A settled Classic Samus at `power`, kit `kit`, on `level`. */
function rig(power = 'small', kit: Record<string, number> = {}, level = flatLevel()): Rig {
  const r = new Rig(SAMUS, level, 'classic', power);
  Object.assign(r.p.scratch, kit);
  r.settle();
  return r;
}

/** An enemy placed with its feet on the floor (y = 208 px) at x px. */
function place<E extends Enemy>(r: Rig, e: E, xPx: number): E {
  e.body.x = px(xPx);
  e.body.y = px(208) - e.body.h;
  e.body.vx = 0;
  e.activated = true;
  r.world.spawn(e);
  return e;
}

/** Freezes an enemy in place for a test (it neither walks nor falls). */
function hold(e: Enemy): void {
  e.update = () => {};
}

describe('Classic Samus: resolution and Current (SA-C34, TG-38)', () => {
  it('Classic rules play SAMUS_CLASSIC; Current keeps SAMUS untouched', () => {
    expect(heroFor(SAMUS, 'classic')).toBe(SAMUS_CLASSIC);
    expect(heroFor(SAMUS, 'current')).toBe(SAMUS);
    expect(SAMUS.rules).toBeUndefined();
    expect(SAMUS_CLASSIC.rules).toBe('classic');
    expect(SAMUS_CLASSIC.id).toBe('samus');
    expect(SAMUS_CLASSIC.powerIcon).toBe(true);
    expect(SAMUS.powerIcon).toBeUndefined();
    expect(SAMUS.damage.kind).toBe('hp');
    expect(SAMUS.behaviour.holdsStill).toBeUndefined();
    expect(SAMUS.movement.airStop).toBeUndefined();
    expect(SAMUS.movement.softCut).toBeUndefined();
  });

  it('a Current world plays Current Samus (EN 30, 2 beams)', () => {
    const r = new Rig(SAMUS, flatLevel(), 'current', 'full');
    r.settle();
    expect(r.p.def).toBe(SAMUS);
    expect(r.p.hp).toBe(30);
    const cur = measureJump(SAMUS, 0, Infinity, 'current', 'full');
    expect(cur.apex).toBeGreaterThanOrEqual(72);
    expect(cur.apex).toBeLessThanOrEqual(75);
  });
});

describe('Classic Samus: jumping (SA-C6, SA-C7)', () => {
  it('a held jump peaks at 87 px on frame 42; the fall never passes 3.75 px/f', () => {
    const j = measureJump(SAMUS_CLASSIC, 0, Infinity);
    expect(Math.abs(j.apex - 87)).toBeLessThanOrEqual(1);
    expect(Math.abs(j.apexFrame - 42)).toBeLessThanOrEqual(1);
    const r = rig();
    r.step(['jump']);
    let max = 0;
    for (let i = 0; i < 200 && !r.p.body.onGround; i++) {
      r.step(['jump']);
      max = Math.max(max, r.p.body.vy);
    }
    expect(max).toBeLessThanOrEqual(SAMUS_CLASSIC_PROFILE.maxFall);
  });

  // "Released on frame N": the damping starts on jump frame N, so jump was held N - 1 frames.
  it.each([
    [5, 31],
    [10, 46],
    [20, 69],
    [30, 82],
  ])('released on frame %i: apex %i px (soft cut)', (frames, apex) => {
    const j = measureJump(SAMUS_CLASSIC, 0, frames - 1);
    expect(Math.abs(j.apex - apex)).toBeLessThanOrEqual(1);
  });

  it('the shortest tap (one frame) peaks near 20 px (the original releasing on frame 2)', () => {
    // A release on frame 1 (17 px) needs a press and release inside one frame, which a frame-
    // stepped input cannot give.
    const j = measureJump(SAMUS_CLASSIC, 0, 1);
    expect(Math.abs(j.apex - 20)).toBeLessThanOrEqual(1);
  });
});

describe('Classic Samus: walking (SA-C3)', () => {
  it('full speed on the first frame, stopped on the next, in the air too', () => {
    const r = rig();
    r.step(['right']);
    expect(r.p.body.vx).toBe(0x01400);
    r.step([]);
    expect(r.p.body.vx).toBe(0);
    r.step(['jump']);
    r.step(['jump', 'left']);
    expect(r.p.body.vx).toBe(-0x01400);
    r.step(['jump']);
    expect(r.p.body.vx).toBe(0);
  });
});

describe('Classic Samus: crouch and morph ball (SA-C4, SA-C5, SA-C25, SA-C26)', () => {
  it('Down crouches (12 x 15), stays crouched, Down again curls into the ball 2.5 px up', () => {
    const r = rig();
    r.step(['right']);
    r.step(['right', 'down']);
    expect(r.p.body.vx).toBe(0);
    expect(crouchPose(r.p)).toBe(true);
    expect(r.p.body.h).toBe(px(15));
    expect(r.p.body.w).toBe(px(12));
    r.step([]);
    r.step(['right']);
    r.step(['right']);
    expect(crouchPose(r.p)).toBe(false);
    r.step(['down']);
    r.step(['down', 'right']);
    r.step(['down', 'right']);
    expect(crouchPose(r.p)).toBe(true);
    expect(r.p.body.vx).toBe(0);
    r.step([]);
    const feet = r.p.feetY;
    r.step(['down']);
    expect(inBall(r.p)).toBe(true);
    expect(r.p.body.h).toBe(px(12));
    expect(feet - r.p.feetY).toBe(px(2.5));
  });

  it('crouched, walking with Down released stands her up; Up stands her aiming up', () => {
    const r = rig();
    r.step(['down']);
    r.step([]);
    r.step(['right']);
    expect(crouchPose(r.p)).toBe(false);
    r.step(['right']);
    expect(r.p.body.vx).toBe(0x01400);
    r.step(['down']);
    r.step([]);
    r.step(['up']);
    expect(crouchPose(r.p)).toBe(false);
    expect(r.p.body.h).toBe(px(24));
    expect(r.p.scratch._aimUp).toBe(1);
  });

  it('Down in mid-air curls into the ball; the ball rolls at 1.25 px/f and cannot jump', () => {
    const r = rig();
    r.step(['jump']);
    for (let i = 0; i < 5; i++) r.step(['jump']);
    r.step(['down']);
    expect(inBall(r.p)).toBe(true);
    r.until(() => r.p.body.onGround);
    r.step(['right']);
    expect(r.p.body.vx).toBe(0x01400);
  });

  it('Jump in the ball under a one-tile ceiling is refused; in the open it stands with no jump speed', () => {
    // Ceiling row 11 (y 176..192): a 16 px gap above the floor at 208.
    const r = rig('small', {}, flatLevel({ 11: '..........##########' }));
    r.step(['down']);
    r.step([]);
    r.step(['down']);
    r.until(() => r.p.body.onGround);
    for (let i = 0; i < 70; i++) r.step(['right']);
    expect(r.p.body.x).toBeGreaterThan(px(170));
    r.step(['jump']);
    expect(inBall(r.p)).toBe(true);
    r.step([]);
    r.step(['up']);
    expect(inBall(r.p)).toBe(true);
    // Out in the open again.
    for (let i = 0; i < 120; i++) r.step(['right']);
    r.step([]);
    r.step(['jump']);
    expect(inBall(r.p)).toBe(false);
    const top = r.p.feetY;
    let min = top;
    for (let i = 0; i < 20; i++) {
      r.step([]);
      min = Math.min(min, r.p.feetY);
    }
    expect(top - min).toBeLessThanOrEqual(px(1));
  });
});

describe('Classic Samus: somersault and Screw Attack (SA-C8, SA-C24)', () => {
  it('a running jump spins once 30 px up; a standing jump never; firing ends it', () => {
    const r = rig('big', { missileUp: 1, missiles: 4 });
    r.step(['right']);
    let spun = false;
    let at = 0;
    r.step(['right', 'jump']);
    const y0 = r.p.feetY + px(4);
    for (let i = 0; i < 30; i++) {
      r.step(['right', 'jump']);
      if (flipping(r.p) && !spun) {
        spun = true;
        at = (y0 - r.p.feetY) / 256;
      }
    }
    expect(spun).toBe(true);
    expect(at).toBeGreaterThan(30);
    expect(at).toBeLessThan(36);
    r.step(['right', 'jump', 'attack']);
    expect(flipping(r.p)).toBe(false);
    const s = rig();
    s.step(['jump']);
    for (let i = 0; i < 60; i++) {
      s.step(['jump']);
      expect(flipping(s.p)).toBe(false);
    }
  });

  it('with the Flower, a running jump into a Goomba at spin height kills it unhurt; Bowser hurts', () => {
    const r = rig('fire');
    // Where her running jump's somersault meets it (about 26 frames in, 70 px up).
    const g = place(r, new Goomba(0, 0), 140);
    hold(g);
    g.body.y = px(115);
    r.step(['right', 'jump']);
    for (let i = 0; i < 60 && g.alive; i++) r.step(['right', 'jump']);
    expect(g.alive).toBe(false);
    expect(r.p.powerState).toBe('fire');

    const r2 = rig('fire');
    const bw = new Bowser(0, 0);
    place(r2, bw, 150);
    hold(bw);
    bw.body.y = px(100);
    r2.step(['right', 'jump']);
    for (let i = 0; i < 60 && r2.p.powerState === 'fire'; i++) r2.step(['right', 'jump']);
    expect(r2.p.powerState).toBe('small');
  });
});

describe('Classic Samus: shots (SA-C17..SA-C20)', () => {
  it('three shots at most, beams and missiles together; a fourth press spends nothing', () => {
    const r = rig('big', { missileUp: 1, missiles: 4 });
    r.step(['attack']);
    r.step([]);
    r.step(['attack']);
    r.step([]);
    expect(shots(r)).toHaveLength(2);
    r.step(['special']);
    expect(shots(r)).toHaveLength(3);
    expect(r.p.scratch.missiles).toBe(3);
    r.step([]);
    r.step(['special']);
    r.step([]);
    r.step(['attack']);
    expect(shots(r)).toHaveLength(3);
    expect(r.p.scratch.missiles).toBe(3);
  });

  it('no missiles before the first Mushroom; the Mushroom gives 4 (cap 40); the Flower raises the cap to 99', () => {
    const r = rig();
    r.step(['special']);
    expect(shots(r)).toHaveLength(0);
    expect(SAMUS_CLASSIC.hudAmmo?.(r.p)).toBeNull();
    r.world.powerUp(r.p, 'mushroom');
    r.until(() => r.p.transition === null);
    expect(r.p.scratch.missiles).toBe(4);
    expect(SAMUS_CLASSIC.hudAmmo?.(r.p)?.count).toBe(4);
    r.world.powerUp(r.p, 'flower');
    r.until(() => r.p.transition === null);
    expect(r.p.scratch.missileExp).toBe(1);
    r.world.powerUp(r.p, 'flower');
    expect(r.p.scratch.missiles).toBe(8);
  });

  it('the short beam is gone after 50 px; the Long Beam flies on', () => {
    const r = rig();
    r.step(['attack']);
    const pr = shots(r)[0] as Projectile;
    const x0 = pr.body.x;
    let last = x0;
    for (let i = 0; i < 20 && pr.alive; i++) {
      last = pr.body.x;
      r.step([]);
    }
    expect(pr.alive).toBe(false);
    expect(Math.abs((last - x0) / 256 - 50)).toBeLessThanOrEqual(5);
    const l = rig('big');
    l.step(['attack']);
    const lp = shots(l)[0] as Projectile;
    for (let i = 0; i < 20; i++) l.step([]);
    expect(lp.alive).toBe(true);
  });

  it('muzzles: standing 22, crouched 12.5, air 15 px above the feet, 12.5 ahead; up: 36 above', () => {
    const centreY = (pr: Projectile) => pr.body.y + (pr.body.h >> 1);
    const r = rig('big');
    const feet = r.p.feetY;
    r.step(['attack']);
    let pr = shots(r).at(-1) as Projectile;
    expect((feet - centreY(pr)) / 256).toBeCloseTo(22, 0);
    expect((pr.body.x + (pr.body.w >> 1) - r.p.centerX) / 256).toBeGreaterThanOrEqual(12);
    r.step(['down']);
    r.step(['down', 'attack']);
    pr = shots(r).at(-1) as Projectile;
    expect((feet - centreY(pr)) / 256).toBeCloseTo(12.5, 0);
    const u = rig('big');
    u.step(['up']);
    u.step(['up', 'attack']);
    pr = shots(u).at(-1) as Projectile;
    expect(pr.body.vx).toBe(0);
    expect(pr.body.vy).toBeLessThan(0);
    const a = rig('big');
    a.step(['jump']);
    a.step(['jump', 'attack']);
    pr = shots(a).at(-1) as Projectile;
    expect((a.p.feetY - centreY(pr)) / 256).toBeCloseTo(15, 0);
  });

  it('an upward shot is removed above the screen', () => {
    const r = rig('big');
    r.step(['up']);
    r.step(['up', 'attack']);
    const pr = shots(r)[0] as Projectile;
    for (let i = 0; i < 80; i++) r.step(['up']);
    expect(pr.alive).toBe(false);
  });
});

describe('Classic Samus: damage (SA-C21..SA-C23)', () => {
  /** Shots (crouched, so they meet a Goomba) until `e` dies; at most `max`. */
  function shotsToKill(power: string, e: Enemy, button: 'attack' | 'special', kit = {}): number {
    const r = rig(power, kit);
    place(r, e, 150);
    hold(e);
    r.step(['down']);
    let n = 0;
    for (let i = 0; i < 4000 && e.alive; i++) {
      if (i % 14 === 0) {
        r.step(['down', button]);
        n++;
      } else r.step(['down']);
    }
    return e.alive ? Infinity : n;
  }

  it('Goomba: 2 beams; Koopa: 4 beams', () => {
    expect(shotsToKill('big', new Goomba(0, 0), 'attack')).toBe(2);
    expect(shotsToKill('big', new Koopa(0, 0, 'green'), 'attack')).toBe(4);
  });

  it('Buzzy Beetle: beams do nothing, 2 missiles kill it', () => {
    expect(shotsToKill('big', new Koopa(0, 0, 'buzzy'), 'attack')).toBe(Infinity);
    expect(shotsToKill('big', new Koopa(0, 0, 'buzzy'), 'special', { missileUp: 1, missiles: 9 })).toBe(2);
  });

  it('Bowser (fire form, 2400): 16 beams', () => {
    const r = rig('big');
    const b = place(r, new Bowser(0, 0), 150);
    hold(b);
    b.body.y = px(208) - b.body.h;
    let n = 0;
    for (let i = 0; i < 4000 && b.alive; i++) {
      if (i % 14 === 0) {
        r.step(['attack']);
        n++;
      } else r.step([]);
    }
    expect(b.alive).toBe(false);
    expect(n).toBe(16);
  });

  it('Ice (full kit): freezes a Goomba with no damage; she can stand on it; a Wave Beam thaws it and deals 225', () => {
    const r = rig('fire', { ...SAMUS_CLASSIC.devKit?.(), tool: 1 });
    const g = place(r, new Goomba(0, 0), 140);
    hold(g);
    r.step(['down']);
    r.step(['down', 'attack']);
    r.until(() => g.frozen > 0, ['down'], 30);
    expect(g.frozen).toBeGreaterThan(300);
    expect(g.classicHp).toBe(250);
    // Stand on it: drop her onto its block.
    r.step([]);
    r.step(['up']);
    const b = r.p.body;
    b.x = g.body.x + px(2);
    b.y = g.body.y + g.body.h - px(16) - b.h - px(6);
    b.vy = 0;
    b.onGround = false;
    r.step([]);
    r.until(() => r.p.body.onGround, [], 20);
    expect(r.p.feetY).toBe(g.body.y + g.body.h - px(16));
    for (let i = 0; i < 30; i++) r.step([]);
    expect(r.p.feetY).toBe(g.body.y + g.body.h - px(16));
    expect(r.p.powerState).toBe('fire');
    // A Long Beam (Wave selected back) from the side thaws it and deals its damage.
    r.p.scratch.tool = 0;
    b.x = g.body.x - px(40);
    b.y = px(208) - b.h;
    r.step([]);
    r.step(['down']);
    r.step(['down', 'attack']);
    r.until(() => g.frozen === 0, ['down'], 40);
    expect(g.classicHp).toBe(250 - 225);
  });
});

describe('Classic Samus: the frozen block (HP-C17, SA-C21)', () => {
  it('only while frozen: she stands on it, bumps its side, and drops when it thaws', () => {
    const r = rig('fire', { ...SAMUS_CLASSIC.devKit?.(), tool: 1 });
    const g = place(r, new Goomba(0, 0), 140);
    hold(g);
    g.frozen = 360;
    g.stopFrames = 360;
    const top = g.body.y + g.body.h - px(16);
    // Walking into its side stops her at its left edge, unhurt.
    for (let i = 0; i < 40; i++) r.step(['right']);
    expect(r.p.body.x + r.p.body.w).toBe(g.body.x);
    expect(r.p.powerState).toBe('fire');
    // Dropped on top she stands there.
    const b = r.p.body;
    b.x = g.body.x + px(2);
    b.y = top - b.h - px(4);
    b.onGround = false;
    r.step([]);
    r.until(() => r.p.body.onGround, [], 20);
    expect(r.p.feetY).toBe(top);
    // When the freeze ends the block goes and she falls to the floor (touching it then hurts).
    r.until(() => g.frozen === 0, [], 400);
    r.step([]);
    r.step([]);
    expect(r.p.feetY).toBeGreaterThan(top);
  });

  it('a stunned (not frozen) enemy carries no block', () => {
    const r = rig('fire');
    const g = place(r, new Goomba(0, 0), 140);
    hold(g);
    g.stopFrames = 300;
    const b = r.p.body;
    b.x = g.body.x + px(2);
    b.y = g.body.y - b.h - px(4);
    b.onGround = false;
    // No block to land on: she falls past its top.
    let stood = false;
    for (let i = 0; i < 6; i++) {
      r.step([]);
      if (r.p.body.onGround && r.p.feetY === g.body.y) stood = true;
    }
    expect(stood).toBe(false);
  });
});

describe('Classic Samus: the Wave Beam (SA-C22)', () => {
  it('passes a ground column, breaks a brick and stops, waves ±15 px, alternates its start', () => {
    const r = rig(
      'fire',
      {},
      flatLevel({ 10: '..............#', 11: '..............#', 12: '..............#' }),
    );
    r.step(['attack']);
    const a = shots(r)[0] as Projectile;
    const ys: number[] = [a.body.y];
    for (let i = 0; i < 40; i++) {
      r.step([]);
      if (!a.alive) break;
      ys.push(a.body.y);
    }
    expect(a.alive).toBe(true);
    expect(a.body.x).toBeGreaterThan(px(15 * 16));
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    expect(Math.round((hi - lo) / 512)).toBe(15);
    // The first shot goes down first; one period is about 15 frames.
    const firstDy = [(ys[1] as number) - (ys[0] as number)];
    expect(firstDy[0]).toBeGreaterThan(0);
    const peaks = ys.flatMap((y, i) =>
      i > 0 && i < ys.length - 1 && y >= (ys[i - 1] as number) && y > (ys[i + 1] as number) ? [i] : [],
    );
    expect(Math.abs((peaks[1] as number) - (peaks[0] as number) - 15)).toBeLessThanOrEqual(1);
    for (let i = 0; i < 6; i++) r.step([]);
    r.step(['attack']);
    const b = shots(r).at(-1) as Projectile;
    const by = b.body.y;
    r.step([]);
    r.step([]);
    expect(Math.sign(b.body.y - by)).toBe(-Math.sign(firstDy[0] as number));

    const br = rig('fire', {}, flatLevel({ 12: '..........=' }));
    br.step(['down']);
    br.step(['down', 'attack']);
    for (let i = 0; i < 30; i++) br.step(['down']);
    expect(br.world.map.get(10, 12)).not.toBe(T.BRICK);
  });
});

describe('Classic Samus: bombs (SA-C27, SA-C28)', () => {
  it('a bomb laid in mid-air hangs 57 frames; a balled Samus on it rises 18 px; a standing one too', () => {
    const r = rig();
    r.step(['jump']);
    for (let i = 0; i < 8; i++) r.step(['jump']);
    r.step(['down']);
    r.step(['attack']);
    const bomb = bombs(r)[0] as ClassicBomb;
    const y = bomb.body.y;
    for (let i = 0; i < 50; i++) r.step([]);
    expect(bomb.body.y).toBe(y);

    const g = rig();
    g.step(['down']);
    g.step([]);
    g.step(['down']);
    g.until(() => g.p.body.onGround);
    g.step(['attack']);
    const feet = g.p.feetY;
    let min = feet;
    for (let i = 0; i < 100; i++) {
      g.step([]);
      min = Math.min(min, g.p.feetY);
    }
    expect(Math.abs((feet - min) / 256 - 18)).toBeLessThanOrEqual(1.5);

    // Standing on the floor, a bomb laid by her ball before she stood up still boosts her.
    const s = rig();
    s.step(['down']);
    s.step([]);
    s.step(['down']);
    s.until(() => s.p.body.onGround);
    s.step(['attack']);
    s.step([]);
    s.step(['up']);
    s.until(() => s.p.body.onGround);
    const f2 = s.p.feetY;
    let m2 = f2;
    for (let i = 0; i < 80; i++) {
      s.step([]);
      m2 = Math.min(m2, s.p.feetY);
    }
    expect((f2 - m2) / 256).toBeGreaterThan(12);
  });
});

describe('Classic Samus: power states (SA-C11, SA-C15)', () => {
  it('Flower -> one touch -> small: short beam, no Screw, missiles kept, cap 99; a second touch kills', () => {
    const r = rig('fire', { missileUp: 1, missiles: 50, missileExp: 1 });
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.powerState).toBe('small');
    expect(r.p.scratch.missiles).toBe(50);
    expect(r.p.scratch.missileExp).toBe(1);
    r.until(() => r.p.hurtLock === null && r.p.invuln === 0, [], 200);
    r.step(['attack']);
    const pr = shots(r)[0] as Projectile;
    expect(pr.spec.lifetime).toBe(12);
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.dead).toBe(true);
  });

  it('a hit on the ground hops her up and back; 15 frames locked, then 75 invulnerable', () => {
    const r = rig('big');
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.body.vx).toBe(0x01400);
    expect(r.p.body.vy).toBeLessThan(0);
    const n = r.until(() => r.p.hurtLock === null, [], 100);
    expect(n).toBeGreaterThanOrEqual(15);
    expect(n).toBeLessThanOrEqual(16);
  });
});

describe('Classic Samus: bricks (SA-C29)', () => {
  it('her head bumps a brick and never breaks it (small or powered); an upward beam breaks it', () => {
    for (const power of ['small', 'fire']) {
      const r = rig(power, {}, flatLevel({ 9: '......=' }));
      r.step(['jump']);
      for (let i = 0; i < 60; i++) r.step(['jump']);
      expect(r.world.map.get(6, 9)).toBe(T.BRICK);
    }
    const r = rig('big', {}, flatLevel({ 9: '......=' }));
    r.step(['up']);
    r.step(['up', 'attack']);
    for (let i = 0; i < 20; i++) r.step(['up']);
    expect(r.world.map.get(6, 9)).not.toBe(T.BRICK);
  });
});

describe('Classic Samus: full kit, guide and touch (TG-22, TG-40, TG-44)', () => {
  it('kit=full gives Wave and Ice on Select; without it no belt', () => {
    const r = rig('fire', SAMUS_CLASSIC.devKit?.() ?? {});
    expect(SAMUS_CLASSIC.tools?.(r.p).map((t) => t.id)).toEqual(['wave', 'ice']);
    r.step(['select']);
    expect(r.p.scratch.tool).toBe(1);
    const plain = rig('fire');
    expect(SAMUS_CLASSIC.tools?.(plain.p)).toEqual([]);
  });

  it('touch labels: SHOOT and MISSILE, BOMB in the ball, Select hidden', () => {
    const r = rig('big', { missileUp: 1, missiles: 4 });
    expect(SAMUS_CLASSIC.touchLabels?.(r.p, r.world)).toEqual({
      attack: 'SHOOT',
      special: 'MISSILE',
      select: null,
    });
    r.step(['down']);
    r.step([]);
    r.step(['down']);
    expect(SAMUS_CLASSIC.touchLabels?.(r.p, r.world)).toEqual({
      attack: 'BOMB',
      special: null,
      select: null,
    });
  });

  it('a Classic guide that names abilities, never buttons, in the font', () => {
    const g = SAMUS_CLASSIC.guide;
    expect(g).not.toBe(SAMUS.guide);
    expect(g.tagline.length).toBeLessThanOrEqual(30);
    const PROSE = /\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:|\b[abc]\s*\/|\/\s*[abc]\b/i;
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
    for (const c of g.controls) if (c.touch) expect(c.touch).not.toMatch(/\b(BUTTON )?[ABC]\b/);
    for (const item of ['mushroom', 'flower', 'star'])
      expect(g.powerups.some((p) => p.item === item)).toBe(true);
    expect(samusClassicGuide('Pit').tagline.startsWith('Pit')).toBe(true);
  });
});

describe('Classic Samus variants (Pit, PI-1 flags)', () => {
  const PIT = classicSamus({
    variant: {
      crouchWalk: true,
      airCrouchPose: true,
      noBeamInCrouch: true,
      noWalkWhileAimUp: true,
      morphBall: false,
      standShotHeight: 11,
    },
  });
  function pit(power = 'small', kit = {}): Rig {
    const r = new Rig(PIT, flatLevel(), 'classic', power);
    Object.assign(r.p.scratch, kit);
    r.settle();
    return r;
  }

  it('crouch-walks 75 px in 60 frames; Classic Samus does not move', () => {
    const r = pit();
    const x0 = r.p.body.x;
    for (let i = 0; i < 60; i++) {
      r.step(['down', 'right']);
      expect(crouchPose(r.p)).toBe(true);
    }
    expect(Math.abs((r.p.body.x - x0) / 256 - 75)).toBeLessThanOrEqual(1);
    const s = rig();
    const sx = s.p.body.x;
    for (let i = 0; i < 60; i++) s.step(['down', 'right']);
    expect(s.p.body.x).toBe(sx);
  });

  it('no walking while aiming up on the ground; no beam from the crouch; no ball', () => {
    const r = pit('big', { missileUp: 1, missiles: 4 });
    const x0 = r.p.body.x;
    for (let i = 0; i < 30; i++) r.step(['up', 'right']);
    expect(r.p.body.x).toBe(x0);
    r.step(['down', 'attack']);
    expect(shots(r)).toHaveLength(0);
    r.step(['down', 'special']);
    expect(shots(r)).toHaveLength(1);
    r.step([]);
    r.step(['down']);
    r.step([]);
    r.step(['down']);
    expect(inBall(r.p)).toBe(false);
    expect(bombs(r)).toHaveLength(0);
  });

  it('a standing shot leaves 11 px above the feet', () => {
    const r = pit('big');
    const feet = r.p.feetY;
    r.step(['attack']);
    const pr = shots(r)[0] as Projectile;
    expect((feet - (pr.body.y + (pr.body.h >> 1))) / 256).toBeCloseTo(11, 0);
  });
});
