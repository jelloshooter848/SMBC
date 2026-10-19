import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { parseTextMap } from '@game/level/textmap';
import { RYU, RYU_PROFILE } from '@game/characters/ryu';
import {
  CLASSIC_START_NINPO,
  RYU_CLASSIC,
  RYU_CLASSIC_PROFILE,
  classicMainArt,
  classicNinpoMax,
} from '@game/characters/ryu/classic';
import {
  CLASSIC_DRAGON_BALL,
  CLASSIC_FIRE_WHEEL,
  CLASSIC_SHURIKEN,
  CLASSIC_WINDMILL,
  WindmillShot,
} from '@game/characters/ryu/classic-weapons';
import { heroFor } from '@game/characters/registry';
import { Projectile } from '@game/entities/projectiles/projectile';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Lift } from '@game/entities/objects/lift';
import type { Enemy } from '@game/entities/enemies/enemy';
import { T } from '@game/level/tiles';
import { runSim } from '@game/sim/headless';
import { fontText } from '@game/hud/text';
import { SPRITES } from '@content/sprites';
import { flatLevel, Rig } from './classic-plumber-harness';

// Classic SMBC Ryu (bug-reports/2026-10-07-ryu-classic-smbc-rules.md, RY-C1..RY-C38): the
// report's acceptance checks, measured through the World with rules 'classic'.

const WALK = 0x018ab;
const FLOOR = px(208);

/** A Classic Ryu rig (the World resolves RYU to RYU_CLASSIC). */
function rig(rows: Record<number, string> = {}, power = 'small', width = 200): Rig {
  const r = new Rig(RYU, flatLevel(rows, width), 'classic', power);
  r.settle();
  return r;
}
const col = (c: number, ch: string) => '.'.repeat(c) + ch;
/** A wall from the floor up to row 4 (9 tiles) at column 12. */
const TALL_WALL = Object.fromEntries([4, 5, 6, 7, 8, 9, 10, 11, 12].map((y) => [y, col(12, '#')]));
/** A wall 3 tiles tall (rows 10-12) at column 12. */
const LOW_WALL = { 10: col(12, '#'), 11: col(12, '#'), 12: col(12, '#') };

/** Walks right into the wall, jumps and holds right until he is on it. */
function grab(r: Rig): void {
  r.until(() => r.p.body.hitWall === 1, ['right'], 200);
  const n = r.until(
    () => r.p.wall !== null,
    (i) => (i === 0 ? ['right', 'jump'] : ['right']),
    200,
  );
  expect(n).toBeLessThan(200);
}

function shots(r: Rig, kind?: string): Projectile[] {
  return r.world.entities.filter(
    (e): e is Projectile => e instanceof Projectile && e.alive && (!kind || e.kind === kind),
  );
}
/** Places an enemy with its near (left) edge `ahead` px in front of Ryu's centre, on the floor. */
function enemyAt<E extends Enemy>(r: Rig, e: E, ahead: number): E {
  e.body.x = r.p.centerX + px(ahead);
  e.body.y = FLOOR - e.body.h;
  r.world.spawn(e);
  return e;
}

describe('registry and Current (TG-17, TG-18, TG-38)', () => {
  it('Classic rules play RYU_CLASSIC; Current keeps RYU untouched', () => {
    expect(heroFor(RYU, 'classic')).toBe(RYU_CLASSIC);
    expect(heroFor(RYU, 'current')).toBe(RYU);
    expect(RYU_CLASSIC.rules).toBe('classic');
    expect([RYU_CLASSIC.id, RYU_CLASSIC.name, RYU_CLASSIC.hudName, RYU_CLASSIC.portrait]).toEqual([
      RYU.id,
      RYU.name,
      RYU.hudName,
      RYU.portrait,
    ]);
    expect(RYU.rules).toBeUndefined();
    expect(RYU_CLASSIC.powerIcon).toBe(true);
    expect(RYU.powerIcon).toBeUndefined();
    expect(RYU.movement).toBe(RYU_PROFILE);
    for (const k of ['airStop', 'wallClimb', 'rise', 'softCut', 'jumpBuffer'])
      expect(k in RYU_PROFILE, k).toBe(false);
    expect(RYU.meleeStrikesBlocks).toBeUndefined();
    expect(RYU.headBumps).toBeUndefined();
    expect(RYU.behaviour.meleeDamage).toBeUndefined();
    expect(RYU.canBreakBricks({} as never)).toBe(true);
  });

  it('a Classic world plays RYU_CLASSIC, a Current one RYU', () => {
    const level = flatLevel();
    const cl = runSim({ level, character: RYU, rules: 'classic', script: { steps: [] }, maxFrames: 1 });
    expect(cl.world.player.def).toBe(RYU_CLASSIC);
    expect(cl.world.state.character).toBe(RYU);
    const cur = runSim({ level, character: RYU, script: { steps: [] }, maxFrames: 1 });
    expect(cur.world.player.def).toBe(RYU);
  });

  it('Current still clings and chains wall kicks up a nine-tile wall; Classic does not (RY-C37)', () => {
    const run = (rules: 'classic' | 'current') => {
      const r = new Rig(RYU, flatLevel(TALL_WALL), rules);
      r.settle();
      let minY = Infinity;
      let cling = 0;
      let leap = -1;
      for (let f = 0; f < 600; f++) {
        const p = r.p;
        minY = Math.min(minY, p.body.y);
        cling = p.clinging ? cling + 1 : 0;
        if (leap < 0 && p.body.onGround && p.body.x > px(150)) leap = f;
        let hold: Action[] = ['right'];
        if (leap >= 0 && f - leap < 20 && !p.clinging) hold = ['right', 'jump'];
        else if (cling === 2) hold = ['right', 'jump'];
        r.step(hold);
      }
      return (FLOOR - px(24) - minY) / 256;
    };
    expect(run('current')).toBeGreaterThan(9 * 16);
    expect(run('classic')).toBeLessThan(9 * 16);
  });
});

describe('movement (RY-C4..RY-C7)', () => {
  it('walks at 0x018AB from the first frame and stops dead, on the ground and in the air', () => {
    const r = rig();
    r.step(['right']);
    expect(r.p.body.vx).toBe(WALK);
    r.step(['right']);
    r.step([]);
    expect(r.p.body.vx).toBe(0);
    r.step(['left', 'right']);
    expect(r.p.body.vx).toBe(0);
    r.step(['jump']);
    r.step(['left']);
    expect(r.p.body.vx).toBe(-WALK);
    r.step([]);
    expect(r.p.body.onGround).toBe(false);
    expect(r.p.body.vx).toBe(0);
    r.step(['right']);
    expect(r.p.body.vx).toBe(WALK);
  });

  it('jumps about 55 px whether Jump is tapped or held', () => {
    for (const hold of [1, 999]) {
      const r = rig();
      const y0 = r.p.feetY;
      let top = y0;
      for (let f = 0; f < 120; f++) {
        r.step(f < hold ? ['jump'] : []);
        top = Math.min(top, r.p.feetY);
        if (f > 0 && r.p.body.onGround) break;
      }
      expect(Math.abs((y0 - top) / 256 - 55)).toBeLessThanOrEqual(1);
    }
  });

  it('falls no faster than 0x05D55', () => {
    const r = new Rig(RYU, flatLevel({}, 60), 'classic');
    r.p.body.y = px(-200);
    let max = 0;
    for (let f = 0; f < 120 && !r.p.body.onGround; f++) {
      r.step();
      max = Math.max(max, r.p.body.vy);
    }
    expect(max).toBe(0x05d55);
  });

  it('stops for a ground slash and the crouch (RY-C5, RY-C6)', () => {
    const r = rig();
    r.step(['right']);
    r.step(['right', 'attack']);
    for (let i = 0; i < 13; i++) {
      expect(r.p.body.vx, `slash frame ${i + 1}`).toBe(0);
      r.step(['right']);
    }
    expect(r.p.body.vx).toBe(0);
    r.step(['right']);
    expect(r.p.body.vx).toBe(WALK);
    r.step(['down', 'right']);
    expect(r.p.crouching).toBe(true);
    expect(r.p.body.vx).toBe(0);
    expect(r.p.body.h).toBe(px(16));
  });

  it('keeps air control during an air slash; landing ends it; Jump cancels a ground slash', () => {
    const r = rig();
    r.step(['jump']);
    r.step(['attack']);
    r.step(['right']);
    expect(r.p.attackTimer).toBeGreaterThan(0);
    expect(r.p.body.vx).toBe(WALK);
    r.until(() => r.p.body.onGround, ['right']);
    r.step();
    expect(r.p.attackTimer).toBe(0);
    r.settle();
    r.step(['attack']);
    r.step(['attack', 'jump']);
    expect(r.p.body.onGround).toBe(false);
    expect(r.p.attackTimer).toBe(0);
  });
});

describe('sword (RY-C24, RY-C25)', () => {
  it('kills a Goomba 30 px ahead; a Koopa takes 2 slashes; a Buzzy Beetle 10 and lives', () => {
    const r = rig();
    const g = enemyAt(r, new Goomba(0, 0), 30);
    g.body.vx = 0;
    r.step(['attack']);
    r.until(() => !g.alive || r.p.attackTimer === 0);
    expect(g.alive).toBe(false);

    const slash = (n: number) => {
      for (let i = 0; i < n; i++) {
        r.step(['attack']);
        r.until(() => r.p.attackTimer === 0);
      }
    };
    const k = enemyAt(r, new Koopa(0, 0, 'green'), 20);
    slash(1);
    expect(k.alive).toBe(true);
    k.body.x = r.p.centerX + px(20);
    slash(1);
    expect(k.alive && k.state === 'walk').toBe(false);
    const z = enemyAt(r, new Koopa(0, 0, 'buzzy'), 20);
    for (let i = 0; i < 10; i++) {
      z.body.x = r.p.centerX + px(20);
      slash(1);
    }
    expect(z.alive).toBe(true);
    expect(z.classicHp ?? 600).toBe(600);
  });

  it('the Mushroom lengthens the sword (RY-C25)', () => {
    for (const [power, kills] of [
      ['small', false],
      ['big', true],
    ] as const) {
      const r = rig({}, power);
      const g = enemyAt(r, new Goomba(0, 0), 40);
      g.body.vx = 0;
      r.step(['attack']);
      r.until(() => r.p.attackTimer === 0);
      expect(g.alive, power).toBe(!kills);
    }
  });
});

describe('wall climb (RY-C10..RY-C13)', () => {
  it('grabs, holds with no input, climbs 60 px in 60 frames', () => {
    const r = rig(TALL_WALL);
    grab(r);
    const y = r.p.body.y;
    for (let i = 0; i < 120; i++) r.step();
    expect(r.p.wall).not.toBeNull();
    expect(r.p.body.y).toBe(y);
    for (let i = 0; i < 60; i++) r.step(['up']);
    expect((y - r.p.body.y) / 256).toBe(60);
    expect(r.p.wall).not.toBeNull();
  });

  it('Jump alone mid-wall does nothing; Away + Jump hops 15 px; Down + Jump drops', () => {
    const r = rig(TALL_WALL);
    grab(r);
    for (let i = 0; i < 20; i++) r.step(['up']);
    r.step(['jump']);
    r.step();
    expect(r.p.wall).not.toBeNull();
    for (let i = 0; i < 10; i++) r.step();
    const y0 = r.p.feetY;
    let top = y0;
    r.step(['left', 'jump']);
    expect(r.p.wall).toBeNull();
    expect(r.p.body.vx).toBe(-WALK);
    for (let i = 0; i < 40; i++) {
      top = Math.min(top, r.p.feetY);
      r.step(['left']);
    }
    expect(Math.abs((y0 - top) / 256 - 15)).toBeLessThanOrEqual(1);

    const d = rig(TALL_WALL);
    grab(d);
    for (let i = 0; i < 20; i++) d.step(['up']);
    d.step(['down', 'jump']);
    expect(d.p.wall).toBeNull();
    d.step();
    expect(d.p.body.vy).toBeGreaterThan(0);
  });

  it('at the top, Jump alone rises 31 px; toward + Jump lands him on top', () => {
    const r = rig(LOW_WALL);
    grab(r);
    r.until(() => false, ['up'], 80);
    const y0 = r.p.feetY;
    let top = y0;
    r.step(['jump']);
    expect(r.p.wall).toBeNull();
    for (let i = 0; i < 40; i++) {
      top = Math.min(top, r.p.feetY);
      r.step();
    }
    expect(Math.abs((y0 - top) / 256 - 31)).toBeLessThanOrEqual(1);

    const t = rig(Object.fromEntries([10, 11, 12].map((y) => [y, col(12, '####')])));
    grab(t);
    t.until(() => false, ['up'], 80);
    t.step(['right', 'jump']);
    t.until(() => t.p.body.onGround, ['right'], 120);
    expect(t.p.feetY).toBe(px(160));
    expect(t.p.wall).toBeNull();
  });

  it('after the top hop the same edge is not grabbed again for 15 frames (RY-C12)', () => {
    const r = rig(LOW_WALL);
    grab(r);
    r.until(() => false, ['up'], 80);
    r.step(['right', 'jump']);
    for (let i = 0; i < 14; i++) {
      expect(r.p.wall, `frame ${i + 2}`).toBeNull();
      r.step(['right']);
    }
  });

  it('when the bricks he holds break he falls (RY-C16)', () => {
    const r = rig({ 10: col(12, '='), 11: col(12, '='), 12: col(12, '=') });
    grab(r);
    r.step();
    expect(r.p.wall).not.toBeNull();
    for (const y of [10, 11, 12]) r.world.map.set(12, y, T.AIR);
    r.step();
    expect(r.p.wall).toBeNull();
    r.step();
    expect(r.p.body.vy).toBeGreaterThan(0);
  });

  it('climbing down onto the floor stands him there (RY-C13)', () => {
    const r = rig(LOW_WALL);
    grab(r);
    r.until(() => r.p.wall === null, ['down'], 200);
    expect(r.p.body.onGround).toBe(true);
  });

  it('his head does not bump blocks while he clings (RY-C35)', () => {
    const rows = { ...TALL_WALL, 3: col(11, '?') };
    const r = rig(rows);
    grab(r);
    r.until(() => false, ['up'], 120);
    expect(r.world.map.get(11, 3)).toBe(T.Q_COIN);
  });
});

describe('ninpo and power states (RY-C18..RY-C23)', () => {
  it('starts at 25; first Flower: max 200, ninpo 25; second: 40; a hit keeps the Scroll; death resets', () => {
    const r = rig({}, 'big');
    expect(r.p.scratch.ninpo).toBe(CLASSIC_START_NINPO);
    expect(classicNinpoMax(r.p)).toBe(99);
    r.world.powerUp(r.p, 'flower');
    r.until(() => r.p.transition === null);
    expect(r.p.powerState).toBe('fire');
    expect(classicNinpoMax(r.p)).toBe(200);
    expect(r.p.scratch.ninpo).toBe(25);
    r.world.powerUp(r.p, 'flower');
    expect(r.p.scratch.ninpo).toBe(40);
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.powerState).toBe('small');
    expect(classicNinpoMax(r.p)).toBe(200);
    expect(r.p.scratch.ninpo).toBe(40);
    // No Select throw without the Flower.
    r.until(() => r.p.body.onGround && r.p.hurtLock === null, [], 120);
    r.step(['select']);
    r.step();
    r.step();
    expect(shots(r)).toHaveLength(0);
    expect(RYU_CLASSIC.touchLabels?.(r.p, r.world).select).toBeNull();
  });

  it('a hit pushes him back until he lands, then 75 invulnerable frames (RY-C22)', () => {
    const r = rig();
    r.world.powerUp(r.p, 'mushroom');
    r.until(() => r.p.transition === null);
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.body.vy).toBe(-0x03039);
    expect(r.p.body.vx).toBe(0x01400);
    r.until(() => r.p.hurtLock === null, ['left'], 120);
    expect(r.p.body.onGround).toBe(true);
    expect(r.p.invuln).toBe(74);
  });

  it('ninpo pickups are taken when full (RY-C21)', () => {
    const r = rig();
    r.p.scratch.ninpo = 99;
    expect(RYU_CLASSIC.behaviour.onPickup?.(r.p, 'ninpo-large', r.world)).toBe(true);
    expect(r.p.scratch.ninpo).toBe(99);
  });

  it('with the Star, five throws spend nothing (RY-C23)', () => {
    const r = rig();
    r.world.powerUp(r.p, 'star');
    for (let i = 0; i < 5; i++) {
      r.step(['special']);
      r.until(() => shots(r).length === 0, [], 120);
    }
    expect(r.p.scratch.ninpo).toBe(CLASSIC_START_NINPO);
  });
});

describe('throws (RY-C26..RY-C34)', () => {
  it('a shuriken costs 3 on frame 3, flies at 5 px/f; a second press does nothing while it is out', () => {
    const r = rig();
    r.step(['special']);
    expect(shots(r)).toHaveLength(0);
    r.step();
    expect(shots(r)).toHaveLength(0);
    r.step();
    const s = shots(r, CLASSIC_SHURIKEN.kind);
    expect(s).toHaveLength(1);
    expect(s[0]?.body.vx).toBe(0x05000);
    expect(r.p.scratch.ninpo).toBe(22);
    for (let i = 0; i < 14; i++) r.step();
    r.step(['special']);
    for (let i = 0; i < 4; i++) r.step();
    expect(shots(r)).toHaveLength(1);
    expect(r.p.scratch.ninpo).toBe(22);
  });

  it('with too little ninpo the pose plays but nothing comes out', () => {
    const r = rig();
    r.p.scratch.ninpo = 2;
    r.step(['right']);
    r.step(['special', 'right']);
    for (let i = 0; i < 4; i++) {
      expect(r.p.body.vx).toBe(0);
      r.step(['right']);
    }
    expect(shots(r)).toHaveLength(0);
    expect(r.p.scratch.ninpo).toBe(2);
  });

  it('from a wall: into the wall it flies through; holding Away it goes away (RY-C14)', () => {
    const r = rig(TALL_WALL);
    grab(r);
    const x = r.p.centerX;
    r.step(['special']);
    r.step();
    r.step();
    const into = shots(r)[0] as Projectile;
    expect(into.body.vx).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) r.step();
    expect(into.alive).toBe(true);
    expect(into.body.x).toBeGreaterThan(px(13 * 16));
    for (let i = 0; i < 40; i++) r.step();
    r.step(['attack', 'left']);
    r.step(['left']);
    r.step(['left']);
    const away = shots(r)[0] as Projectile;
    expect(away.body.vx).toBeLessThan(0);
    // Spawned 20 px behind his centre, then one frame of flight.
    expect(away.body.x + (away.body.w >> 1)).toBe(x - px(20) - px(5));
    expect(r.p.wall).not.toBeNull();
  });

  it('the Fire Wheel moves (+37.5, -37.5) px in 10 frames and kills two Goombas in a line', () => {
    const r = rig({}, 'fire');
    r.p.scratch.classicAll = 1;
    r.p.scratch.tool = 2;
    r.p.scratch.ninpo = 50;
    expect(classicMainArt(r.p).id).toBe('fire-wheel');
    // Two Goombas up the diagonal (held in the air, still).
    const g1 = new Goomba(0, 0);
    const g2 = new Goomba(0, 0);
    r.step(['special']);
    r.step();
    r.step();
    const w = shots(r, CLASSIC_FIRE_WHEEL.kind)[0] as Projectile;
    expect(w).toBeDefined();
    const x0 = w.body.x;
    const y0 = w.body.y;
    for (const [g, d] of [
      [g1, 15],
      [g2, 30],
    ] as const) {
      g.body.x = x0 + px(d);
      g.body.y = y0 - px(d);
      g.body.vx = 0;
      g.update = () => {};
      r.world.spawn(g);
    }
    for (let i = 0; i < 10; i++) r.step();
    expect((w.body.x - x0) / 256).toBe(37.5);
    expect((w.body.y - y0) / 256).toBe(-37.5);
    expect(g1.alive).toBe(false);
    expect(g2.alive).toBe(false);
    expect(w.alive).toBe(true);
  });

  it('the Dragon Ball moves (+37.5, +37.5) px in 10 frames and kills a Buzzy Beetle', () => {
    const r = rig({}, 'fire');
    r.p.scratch.classicAll = 1;
    r.p.scratch.tool = 3;
    r.p.scratch.ninpo = 50;
    r.step(['jump']);
    for (let i = 0; i < 16; i++) r.step();
    r.step(['special']);
    r.step();
    r.step();
    const d = shots(r, CLASSIC_DRAGON_BALL.kind)[0] as Projectile;
    const x0 = d.body.x;
    const y0 = d.body.y;
    for (let i = 0; i < 10; i++) r.step();
    expect((d.body.x - x0) / 256).toBe(37.5);
    expect((d.body.y - y0) / 256).toBe(37.5);

    const b = rig({}, 'fire');
    b.p.scratch.classicAll = 1;
    b.p.scratch.tool = 3;
    b.p.scratch.ninpo = 50;
    const z = enemyAt(b, new Koopa(0, 0, 'buzzy'), 20);
    z.body.vx = 0;
    z.update = () => {};
    b.step(['special']);
    for (let i = 0; i < 20; i++) b.step();
    // 600 HP: the 400 hit leaves it a shell (HP-C6) and the next kills; it got through the armour.
    expect(z.classicHp ?? 600).toBeLessThan(600);
  });

  it('the Windmill swings 90-100 px out and is caught within 60 frames; it breaks a brick', () => {
    const r = rig({ 11: col(11, '=') }, 'fire');
    const x0 = r.p.centerX;
    r.step(['select']);
    r.step();
    r.step();
    const w = shots(r, CLASSIC_WINDMILL.kind)[0] as WindmillShot;
    expect(w).toBeInstanceOf(WindmillShot);
    let far = 0;
    let caught = -1;
    for (let i = 0; i < 80; i++) {
      r.step();
      far = Math.max(far, (w.body.x + (w.body.w >> 1) - x0) / 256);
      if (!w.alive) {
        caught = i + 3;
        break;
      }
    }
    expect(far).toBeGreaterThanOrEqual(90);
    expect(far).toBeLessThanOrEqual(100);
    expect(caught).toBeGreaterThan(0);
    expect(caught).toBeLessThanOrEqual(60);
    expect(r.world.map.get(11, 11)).not.toBe(T.BRICK);
    expect(r.p.scratch.ninpo).toBe(20);
  });
});

describe('Fire Wheel stops on what it does not kill; art (RY-C25, RY-C29, RY-C30)', () => {
  it('a Koopa the Wheel only shells stops it; Current pierceDefeat specs are untouched', () => {
    const r = rig({}, 'fire');
    Object.assign(r.p.scratch, { classicAll: 1, tool: 2, ninpo: 50 });
    r.step(['special']);
    r.step();
    r.step();
    const w = shots(r, CLASSIC_FIRE_WHEEL.kind)[0] as Projectile;
    const k = new Koopa(0, 0, 'green');
    k.body.x = w.body.x + px(8);
    k.body.y = w.body.y - px(8);
    k.update = () => {};
    r.world.spawn(k);
    for (let i = 0; i < 6; i++) r.step();
    expect(k.alive).toBe(true);
    expect(k.classicHp).toBe(200);
    expect(w.alive).toBe(false);
    expect(CLASSIC_FIRE_WHEEL.pierceDefeat).toBeUndefined();
    expect(CLASSIC_DRAGON_BALL.pierceKillsOnly).toBe(true);
  });

  it('the Sword Extension shows its wave on the hit frames, held still with Reduce flashing', () => {
    const r = rig({}, 'big');
    r.step(['attack']);
    r.step();
    r.step();
    const a = RYU_CLASSIC.sprite(r.p, 0, true).frame;
    const b = RYU_CLASSIC.sprite(r.p, 2, true).frame;
    expect(a).toBe('slash-wave-0');
    expect(RYU_CLASSIC.sprite(r.p, 0, true).sheet).toBe('ryu-wave');
    expect(b).toBe(a);
    expect(RYU_CLASSIC.sprite(r.p, 2, false).frame).toBe('slash-wave-1');
    expect(SPRITES['ryu-wave']?.frames['slash-wave-0']?.[0]?.length).toBe(56);
    const small = rig();
    small.step(['attack']);
    small.step();
    small.step();
    expect(RYU_CLASSIC.sprite(small.p, 0, false).frame).toBe('slash-1');
    for (const f of CLASSIC_DRAGON_BALL.frames) expect(SPRITES.items?.frames[f], f).toBeDefined();
    expect(CLASSIC_DRAGON_BALL.frames).not.toEqual(CLASSIC_FIRE_WHEEL.frames);
    expect(SPRITES.items?.frames['icon-dragon-ball']).toBeDefined();
  });
});

describe('Jump Slash (RY-C31)', () => {
  const kit = (r: Rig) => {
    r.p.scratch.classicAll = 1;
    r.p.scratch.tool = 4;
    r.p.scratch.ninpo = 50;
  };
  it('does nothing on the ground', () => {
    const r = rig();
    kit(r);
    r.step(['special']);
    expect(r.p.scratch._jslash ?? 0).toBe(0);
    expect(r.p.scratch.ninpo).toBe(50);
  });
  it('in the air it kills a Koopa on contact, Ryu unhurt, and ends on landing', () => {
    const r = rig();
    kit(r);
    r.step(['jump']);
    r.step(['special']);
    expect(r.p.scratch._jslash).toBe(1);
    expect(r.p.scratch.ninpo).toBe(45);
    // A Koopa right on him in mid-air.
    const k = new Koopa(0, 0, 'green');
    k.body.x = r.p.body.x + px(4);
    k.body.y = r.p.body.y;
    k.update = () => {};
    r.world.spawn(k);
    r.until(() => r.p.body.onGround, ['right'], 120);
    r.step();
    expect(k.alive).toBe(false);
    expect(r.p.dead).toBe(false);
    expect(r.p.invuln).toBe(0);
    expect(r.p.scratch._jslash).toBe(0);
  });
});

describe('Jump Slash against armour (RY-C24, RY-C31)', () => {
  it('a Buzzy Beetle takes nothing, and touching it does not hurt him', () => {
    const r = rig({}, 'big');
    Object.assign(r.p.scratch, { classicAll: 1, tool: 4, ninpo: 50 });
    r.step(['jump']);
    r.step(['special']);
    const z = new Koopa(0, 0, 'buzzy');
    z.body.x = r.p.body.x + px(4);
    z.body.y = r.p.body.y;
    z.update = () => {};
    r.world.spawn(z);
    for (let i = 0; i < 5; i++) r.step();
    expect(z.alive).toBe(true);
    expect(z.classicHp ?? 600).toBe(600);
    expect(r.p.powerState).toBe('big');
  });
});

describe('bricks (RY-C35, RY-C36)', () => {
  it('his head only bumps a brick; the sword breaks it; a shuriken through a pipe breaks one', () => {
    const r = rig({ 9: col(6, '=') });
    r.step(['jump']);
    r.until(() => r.p.body.onGround, [], 120);
    expect(r.world.map.get(6, 9)).toBe(T.BRICK);

    const s = rig({ 11: col(8, '=') });
    s.step(['attack']);
    s.until(() => s.p.attackTimer === 0);
    expect(s.world.map.get(8, 11)).not.toBe(T.BRICK);

    const t = rig({ 10: col(9, '[]'), 11: col(9, '{}') + '.=', 12: col(9, '{}') });
    t.step(['special']);
    for (let i = 0; i < 30; i++) t.step();
    expect(t.world.map.get(12, 11)).not.toBe(T.BRICK);
  });
});

describe('dev full kit (RY-C38, TG-44)', () => {
  it('gives the Scroll, 200 ninpo and five arts; Select cycles the main art', () => {
    const kit = RYU_CLASSIC.devKit?.() ?? {};
    expect(kit).toEqual({ classicAll: 1, scroll: 1, ninpo: 200 });
    const r = new Rig(RYU, flatLevel(), 'classic', 'fire');
    Object.assign(r.p.scratch, kit);
    r.settle();
    expect(RYU_CLASSIC.tools?.(r.p)).toHaveLength(5);
    expect(RYU_CLASSIC.hudAmmo?.(r.p)).toBeNull();
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      seen.push(classicMainArt(r.p).id);
      r.step(['select']);
      r.step();
    }
    expect(seen).toEqual(['shuriken', 'windmill', 'fire-wheel', 'dragon-ball', 'jump-slash']);
    expect(shots(r)).toHaveLength(0);
  });
  it('without it: no belt, the ninpo counter in the HUD', () => {
    const r = rig();
    expect(RYU_CLASSIC.tools?.(r.p)).toEqual([]);
    expect(RYU_CLASSIC.hudAmmo?.(r.p)).toEqual({ icon: 'ninpo-small', count: 25 });
  });
});

describe('water (RY-C17)', () => {
  function deep(extra: Record<number, string> = {}) {
    const floor = 28;
    const rows = Array.from({ length: 30 }, (_, y) =>
      y >= floor ? '#'.repeat(48) : (y === 2 ? 'w'.repeat(48) : (extra[y] ?? '')).padEnd(48, '.'),
    );
    return parseTextMap(
      [
        'id: deep',
        'theme: water',
        'swim: true',
        'time: 300',
        `start: 4,${floor - 1}`,
        'height: 30',
        'camera: free',
        '',
        '[tiles]',
        ...rows,
      ].join('\n'),
    );
  }
  it('a floor jump rises about 78 px; no stroke in mid-water', () => {
    const r = new Rig(RYU, deep(), 'classic');
    r.settle();
    const y0 = r.p.feetY;
    let top = y0;
    for (let i = 0; i < 200; i++) {
      r.step(i === 0 || i % 7 === 3 ? ['jump'] : []);
      top = Math.min(top, r.p.feetY);
      if (i > 0 && r.p.body.onGround) break;
    }
    expect(Math.abs((y0 - top) / 256 - 78)).toBeLessThanOrEqual(1);
  });
});

describe('water walls (RY-C17, SW-C4)', () => {
  it('wall hops keep their speeds with water gravity: about 44 px away from the wall', () => {
    const floor = 28;
    const rows = Array.from({ length: 30 }, (_, y) =>
      y >= floor ? '#'.repeat(48) : (y === 2 ? 'w'.repeat(48) : y >= 10 ? col(8, '#') : '').padEnd(48, '.'),
    );
    const level = parseTextMap(
      [
        'id: deep',
        'theme: water',
        'swim: true',
        'time: 300',
        `start: 4,${floor - 1}`,
        'height: 30',
        'camera: free',
        '',
        '[tiles]',
        ...rows,
      ].join('\n'),
    );
    const r = new Rig(RYU, level, 'classic');
    r.settle();
    grab(r);
    for (let i = 0; i < 5; i++) r.step();
    const y0 = r.p.feetY;
    let top = y0;
    r.step(['left', 'jump']);
    expect(r.p.body.vy).toBe(-(0x02800 - 0x0011c) + 0x0011c);
    for (let i = 0; i < 80; i++) {
      top = Math.min(top, r.p.feetY);
      r.step();
    }
    expect(Math.abs((y0 - top) / 256 - 44)).toBeLessThanOrEqual(1.5);
  });
});

describe('lifts (RY-C15)', () => {
  it('grabs a lift side, rides it, cannot climb, and any Jump is the high hop', () => {
    const r = rig();
    // A still lift (a cloud waiting for a rider) at the height of his jump.
    const lift = new Lift('lift-right', 9, 9, {});
    r.world.spawn(lift);
    const n = r.until(
      () => r.p.wall !== null,
      (i) => (i < 3 ? ['right', 'jump'] : ['right']),
      200,
    );
    expect(n).toBeLessThan(200);
    expect(r.p.wall?.lift).toBe(true);
    const lb = lift.body;
    const y0 = r.p.body.y;
    for (let i = 0; i < 10; i++) {
      r.step(['up']);
      lift.shift(px(1));
    }
    r.step();
    expect(r.p.body.x + r.p.body.w).toBe(lb.x);
    expect(r.p.body.y + (r.p.body.h >> 1)).toBe(lb.y + (lb.h >> 1));
    expect(r.p.body.y - y0).toBe(px(10));
    r.step(['left', 'jump']);
    expect(r.p.wall).toBeNull();
    expect(r.p.body.vy).toBe(-(0x03955 - 0x0031c) + 0x0031c);
    // No lift is grabbed for 15 frames after that hop.
    r.until(() => r.p.wall !== null, ['right'], 10);
    expect(r.p.wall).toBeNull();
  });
});

describe('guide and touch (RY-C3, TG-22, TG-40)', () => {
  const ACTIONS = new Set(['left/right', 'jump', 'attack', 'special', 'select', 'up', 'down', 'down+jump']);
  const LETTER = /\b(BUTTON )?[ABCXZ]\b/;
  const PROSE = /\b(button|press|push|tap|hold)\s+[abcxz]\b|\([abcxz]\)|\b[abcxz]\s*:|\b[abcxz]\s*\//i;
  it('a complete Classic guide that names abilities, not buttons', () => {
    const g = RYU_CLASSIC.guide;
    expect(g).not.toBe(RYU.guide);
    expect(g.tagline.length).toBeLessThanOrEqual(30);
    for (const c of g.controls) expect(ACTIONS.has(c.action), c.action).toBe(true);
    for (const item of ['mushroom', 'flower', 'star'])
      expect(g.powerups.some((p) => p.item === item)).toBe(true);
    const texts = [
      g.tagline,
      ...g.controls.flatMap((x) => [x.does, x.touchDoes ?? '', x.touch ?? '']),
      ...g.powerups.map((x) => x.does),
      ...(g.tips ?? []),
    ];
    for (const t of texts) {
      expect(fontText(t).length, t).toBe(t.length);
      expect(t.replace(/^\w+: /, '')).not.toMatch(PROSE);
    }
    for (const c of g.controls) if (c.touch) expect(c.touch).not.toMatch(LETTER);
    expect(RYU_CLASSIC.meter).toBeUndefined();
    expect(RYU_CLASSIC.startHp).toBeUndefined();
  });
  it('touch labels: SLASH, the main art, the extra art only with the Flower', () => {
    const r = rig({}, 'fire');
    expect(RYU_CLASSIC.touchLabels?.(r.p, r.world)).toEqual({
      attack: 'SLASH',
      special: 'SHURIKEN',
      select: 'WINDMILL',
    });
  });
  it('the Classic profile is the report table', () => {
    expect(RYU_CLASSIC_PROFILE.jump).toEqual([
      { maxVx: Infinity, initial: 0x04839, holdGravity: 0x0031c, fallGravity: 0x0031c },
    ]);
    expect(RYU_CLASSIC_PROFILE.maxFall).toBe(0x05d55);
    expect(RYU_CLASSIC_PROFILE.instantAccel).toBe(true);
    expect(RYU_CLASSIC_PROFILE.variableJump).toBe(false);
  });
});
