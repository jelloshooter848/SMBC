import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { parseTextMap } from '@game/level/textmap';
import type { LevelData } from '@game/level/schema';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { MARIO_PROFILE } from '@game/characters/mario/profile';
import { LUIGI_PROFILE } from '@game/characters/luigi/profile';
import { MARIO_CLASSIC, MARIO_CLASSIC_PROFILE } from '@game/characters/mario/classic';
import { LUIGI_CLASSIC, LUIGI_CLASSIC_PROFILE } from '@game/characters/luigi/classic';
import { FIREBALL_CLASSIC } from '@game/characters/mario/classic-weapons';
import { FIREBALL, Projectile } from '@game/entities/projectiles/projectile';
import { heroFor } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { Goomba } from '@game/entities/enemies/goomba';
import { Blooper } from '@game/entities/enemies/blooper';
import { runSim } from '@game/sim/headless';
import { fontText } from '@game/hud/text';
import { flatLevel, measureJump, Rig } from './classic-plumber-harness';

// Classic SMBC Mario and Luigi (bug-reports/2026-10-07-mario-luigi-classic-smbc-rules.md, ML-C1..
// ML-C28): the report's acceptance checks, measured on the real defs through the World.

const PLUMBERS: [string, CharacterDef][] = [
  ['mario', MARIO_CLASSIC],
  ['luigi', LUIGI_CLASSIC],
];
const WALK = 0x01755;
const RUN = 0x02800;
const INF = Infinity;

describe('registry and Current (TG-17, TG-18, TG-38)', () => {
  it('Classic rules play the Classic defs; Current keeps MARIO and LUIGI untouched', () => {
    expect(heroFor(MARIO, 'classic')).toBe(MARIO_CLASSIC);
    expect(heroFor(LUIGI, 'classic')).toBe(LUIGI_CLASSIC);
    expect(heroFor(MARIO, 'current')).toBe(MARIO);
    expect(heroFor(LUIGI, 'current')).toBe(LUIGI);
    for (const [cur, cl] of [
      [MARIO, MARIO_CLASSIC],
      [LUIGI, LUIGI_CLASSIC],
    ] as const) {
      expect(cl.rules).toBe('classic');
      expect([cl.id, cl.name, cl.hudName, cl.portrait]).toEqual([
        cur.id,
        cur.name,
        cur.hudName,
        cur.portrait,
      ]);
      expect(cur.rules).toBeUndefined();
    }
    expect(MARIO.movement).toBe(MARIO_PROFILE);
    expect(LUIGI.movement).toBe(LUIGI_PROFILE);
    for (const p of [MARIO_PROFILE, LUIGI_PROFILE]) {
      for (const k of ['rise', 'softCut', 'inertia', 'turnInAir', 'jumpBuffer', 'stompBounce', 'crouchJump'])
        expect(k in p, k).toBe(false);
    }
    expect(MARIO.behaviour.update).not.toBe(MARIO_CLASSIC.behaviour.update);
    expect(FIREBALL.maxFall).toBeUndefined();
    expect(FIREBALL.burstOnCeiling).toBeUndefined();
  });

  it('Current Mario still peaks at 66 px standing (no Classic jump under Current)', () => {
    expect(Math.floor(measureJump(MARIO, 0, INF, 'current').apex)).toBe(66);
    const r = runSim({ level: flatLevel(), character: MARIO, script: { steps: [] }, maxFrames: 1 });
    expect(r.world.player.def).toBe(MARIO);
  });

  it('a Classic world gives each plumber his Classic def', () => {
    for (const [, def] of PLUMBERS) {
      const base = def.id === 'mario' ? MARIO : LUIGI;
      const r = runSim({
        level: flatLevel(),
        character: base,
        rules: 'classic',
        script: { steps: [] },
        maxFrames: 1,
      });
      expect(r.world.player.def).toBe(def);
      expect(r.world.state.character).toBe(base);
    }
  });
});

describe('constants against the original (ML-C3, ML-C7)', () => {
  it('Mario', () => {
    const p = MARIO_CLASSIC_PROFILE;
    expect([p.maxWalk, p.maxRun, p.maxFall, p.fallReset]).toEqual([0x1755, 0x2800, 0x5000, 0x5000]);
    expect(p.inertia).toEqual({
      accel: 0xc7,
      runAccel: 0xc7,
      release: 62767,
      brake: 62344,
      skid: 61816,
      runToWalk: 61399,
      stopSnap: 0x555,
      skidPose: 0x555,
    });
    expect(p.rise).toEqual({
      tiers: [
        { maxVx: 0x1755, speed: 0x3555, cap: 42 },
        { maxVx: INF, speed: 0x3800, cap: 56 },
      ],
      minLine: 19,
      gravity: 0x355,
      headBump: 0xd55,
    });
    expect(p.softCut).toBe(52057);
    // BUG-07 (owner decision): the campaign's held stomp bounce in place of the original's bouncePwr 300.
    expect([p.turnInAir, p.jumpBuffer, p.stompBounce, p.crouchJump, p.coyoteFrames]).toEqual([
      false,
      false,
      undefined,
      true,
      0,
    ]);
    expect(p.stompHeld).toBe(MARIO_PROFILE);
  });

  it('Luigi', () => {
    const p = LUIGI_CLASSIC_PROFILE;
    expect([p.maxWalk, p.maxRun, p.maxFall]).toEqual([0x1755, 0x2800, 0x4000]);
    expect(p.inertia).toMatchObject({
      accel: 0x72,
      runAccel: 0xa2,
      release: 63801,
      brake: 63496,
      skid: 64336,
    });
    expect(p.rise).toEqual({
      tiers: [
        { maxVx: 0x1755, speed: 0x3155, cap: 64 },
        { maxVx: INF, speed: 0x3955, cap: 68 },
      ],
      minLine: 15,
      gravity: 0x31c,
      headBump: 0xd55,
    });
    expect(p.softCut).toBeUndefined();
  });
});

describe('jump heights (ML-C8..ML-C10, ML-C14)', () => {
  // [label, vx at take-off, frames held counting the take-off, Mario [apex, apex frame, airtime], Luigi …]
  const ROWS: [string, number, number, [number, number?, number?], [number, number?, number?]][] = [
    ['standing, held', 0, INF, [67.0, 29, 54], [87.0, 36, 69]],
    ['standing, tapped', 0, 1, [25.5, 12, 28], [38.0, 20, 41]],
    ['1.4 px/f, held', 0x1666, INF, [67.0, 29, 54], [87.0, 36, 69]],
    ['walk top speed, held', WALK, INF, [83.7, 32, 62], [99.3, 37, 73]],
    ['walk top speed, tapped', WALK, 1, [26.0, 12, 28], [46.3, 23, 45]],
    ['running, held', RUN, INF, [83.7, 32, 62], [99.3, 37, 73]],
    ['running, tapped', RUN, 1, [26.0, 12, 28], [46.3, 23, 45]],
    ['standing, released on the 11th airborne frame', 0, 11, [43.2], [56.9]],
  ];
  for (const [label, vx, hold, mario, luigi] of ROWS)
    for (const [id, def] of PLUMBERS) {
      const [apex, apexFrame, airtime] = id === 'mario' ? mario : luigi;
      it(`${id}: ${label}: ${apex} px`, () => {
        const j = measureJump(def, vx, hold);
        expect(Math.abs(j.apex - apex)).toBeLessThanOrEqual(0.5);
        if (apexFrame !== undefined) expect(Math.abs(j.apexFrame - apexFrame)).toBeLessThanOrEqual(1);
        if (airtime !== undefined) expect(Math.abs(j.airtime - airtime)).toBeLessThanOrEqual(1);
      });
    }

  it('the take-off frame moves by the full rise speed (no gravity)', () => {
    const r = new Rig(MARIO_CLASSIC);
    r.settle();
    const b = r.p.body;
    const feet = b.y + b.h;
    r.step(['jump']);
    expect(b.y + b.h - feet).toBe(-0x3555 >> 4);
    expect(b.vy).toBe(-0x3555);
    expect(r.p.rising).toBe(true);
  });

  it('a ceiling ends the rise and sends him down at 0.8333 px/f (ML-C11)', () => {
    const r = new Rig(MARIO_CLASSIC, flatLevel({ 9: '#'.repeat(40) }));
    r.settle();
    r.step(['jump']);
    const n = r.until(() => r.p.body.hitHead, ['jump'], 30);
    expect(n).toBeLessThan(30);
    expect(r.p.body.vy).toBe(0x0d55);
    expect(r.p.rising).toBe(false);
  });

  it('walking off a ledge starts no rise: gravity and the clamp at once (ML-C12)', () => {
    // A ledge one tile up: the step ends at column 12.
    const r2 = new Rig(MARIO_CLASSIC, flatLevel({ 12: '#'.repeat(12) }, 60));
    r2.p.body.y = px(12 * 16) - r2.p.body.h;
    r2.p.body.x = px(10 * 16);
    r2.settle();
    r2.until(() => !r2.p.body.onGround, ['right'], 120);
    let maxVy = 0;
    for (let i = 0; i < 60 && !r2.p.body.onGround; i++) {
      r2.step();
      expect(r2.p.rising).toBe(false);
      maxVy = Math.max(maxVy, r2.p.body.vy);
    }
    expect(maxVy).toBeLessThanOrEqual(0x5000);
  });
});

describe('no jump buffer (ML-C2)', () => {
  for (const [id, def] of PLUMBERS)
    it(`${id}: a press just before landing is lost; holding through a landing does not jump again`, () => {
      /** Drops the hero from 40 px up; jump held from frame `from` on. */
      const drop = (from: number) => {
        const r = new Rig(def);
        r.settle();
        r.p.body.y -= px(40);
        r.step();
        const n = r.until(
          () => r.p.body.onGround,
          (i) => (i >= from ? ['jump'] : []),
        );
        return { r, n };
      };
      const land = drop(1000).n;
      // Pressed 2 frames before the landing and held through it.
      const { r } = drop(land - 2);
      for (let i = 0; i < 20; i++) {
        r.step(['jump']);
        expect(r.p.body.onGround).toBe(true);
      }
      r.step([]);
      r.step(['jump']);
      expect(r.p.body.onGround).toBe(false);
    });
});

describe('ground movement (ML-C3, ML-C4)', () => {
  // [label, start vx, held, done, Mario [frames, px], Luigi [frames, px]]
  const ROWS: [string, number, Action[], (v: number) => boolean, [number, number], [number, number]][] = [
    ['rest to walk top speed', 0, ['right'], (v) => v >= WALK, [31, 24.0], [53, 39.7]],
    ['rest to run top speed', 0, ['right', 'attack'], (v) => v >= RUN, [52, 66.8], [64, 82.1]],
    ['stop from walk top speed', WALK, [], (v) => v === 0, [35, 25.3], [55, 40.8]],
    ['stop from run top speed', RUN, [], (v) => v === 0, [47, 48.7], [75, 79.0]],
    ['stop from run, run held', RUN, ['attack'], (v) => v === 0, [41, 42.1], [64, 67.0]],
    ['skid from run, run held', RUN, ['left', 'attack'], (v) => v <= 0, [25, 22.0], [43, 44.5]],
    ['skid from walk', WALK, ['left'], (v) => v <= 0, [18, 9.9], [37, 23.0]],
  ];
  for (const [label, v0, hold, done, mario, luigi] of ROWS)
    for (const [id, def] of PLUMBERS) {
      const [frames, dist] = id === 'mario' ? mario : luigi;
      it(`${id}: ${label}: ${frames} f, ${dist} px`, () => {
        const r = new Rig(def);
        r.settle();
        const b = r.p.body;
        if (v0 > WALK) {
          // Reach run top speed for real, so the run cap is up.
          r.until(() => b.vx >= RUN, ['right', 'attack'], 200);
        } else b.vx = v0;
        const x0 = b.x;
        let f = 0;
        for (; f < 200; f++) {
          r.step(hold);
          if (done(b.vx)) break;
        }
        expect(Math.abs(f + 1 - frames)).toBeLessThanOrEqual(1);
        expect(Math.abs((b.x - x0) / 256 - dist)).toBeLessThanOrEqual(0.5);
      });
    }

  it('the skid pose shows above 0.3333 px/f against the motion; facing turns to the held direction', () => {
    const r = new Rig(MARIO_CLASSIC);
    r.settle();
    r.p.body.vx = WALK;
    r.step(['left']);
    expect(r.p.facing).toBe(-1);
    expect(r.p.body.vx).toBeGreaterThan(0);
    expect(r.p.anim).toBe('skid');
  });

  it('pressing toward a wall while standing turns him to face it (ML-C5)', () => {
    const r = new Rig(MARIO_CLASSIC, flatLevel({ 12: '#####' }));
    r.p.body.x = px(5 * 16);
    r.settle();
    r.step(['left']);
    expect(r.p.facing).toBe(-1);
  });
});

describe('air control and facing (ML-C5, ML-C13)', () => {
  it('took off at walking speed, run held from the apex: speeds up to 2.5 px/f before landing', () => {
    const r = new Rig(MARIO_CLASSIC, flatLevel({}, 400));
    r.settle();
    r.p.body.vx = WALK;
    r.step(['jump', 'right']);
    r.until(() => r.p.body.vy >= 0, ['jump', 'right']);
    let top = 0;
    r.until(() => {
      top = Math.max(top, r.p.body.vx);
      return r.p.body.onGround;
    }, ['jump', 'right', 'attack']);
    expect(top).toBe(RUN);
  });

  it('took off right, holding left: facing stays right, vx falls 0.0486 px/f a frame, a fireball goes right', () => {
    const r = new Rig(MARIO_CLASSIC, flatLevel({}, 400), 'classic', 'fire');
    r.settle();
    r.p.body.vx = WALK;
    r.step(['jump', 'right']);
    const v0 = r.p.body.vx;
    for (let i = 1; i <= 10; i++) {
      r.step(['jump', 'left']);
      expect(r.p.facing).toBe(1);
      expect(r.p.body.vx).toBe(v0 - i * 0xc7);
    }
    r.step(['jump', 'left', 'attack']);
    const fb = r.world.entities.find((e): e is Projectile => e instanceof Projectile);
    expect(fb).toBeDefined();
    expect(fb?.body.vx).toBe(FIREBALL_CLASSIC.speed);
  });

  it('no direction in the air keeps vx; run released above walking speed decays to it', () => {
    const r = new Rig(MARIO_CLASSIC, flatLevel({}, 400));
    r.settle();
    r.until(() => r.p.body.vx >= RUN, ['right', 'attack'], 200);
    r.step(['jump', 'attack']);
    const v = r.p.body.vx;
    r.step(['jump', 'attack']);
    expect(r.p.body.vx).toBe(v);
    let n = 0;
    while (r.p.body.vx > WALK && n < 30) {
      r.step(['jump', 'right']);
      n++;
    }
    // ×0.93688 a frame on top of the held direction's acceleration (MarioBase.movePlayer adds ax
    // first): 14 frames from 2.5 px/f (the report's "about 9" leaves the acceleration out).
    expect(n).toBeGreaterThanOrEqual(9);
    expect(n).toBeLessThanOrEqual(15);
  });
});

describe('stomp bounce (ML-C21)', () => {
  /** Drops the hero onto a Goomba from 40 px up; returns the bounce peak above the stomp point. */
  function bounce(def: CharacterDef, hold: boolean): number {
    const r = new Rig(def);
    r.settle();
    const b = r.p.body;
    const g = new Goomba(b.x - px(1), px(13 * 16 - 16));
    g.body.vx = 0;
    r.world.spawn(g);
    b.y -= px(40);
    r.step();
    r.until(() => b.vy < 0, hold ? ['jump'] : [], 120);
    const stompFeet = b.y + b.h;
    let min = stompFeet;
    r.until(
      () => {
        min = Math.min(min, b.y + b.h);
        return b.vy > 0;
      },
      hold ? ['jump'] : [],
      120,
    );
    return (stompFeet - min) / 256;
  }
  // BUG-07 (owner decision, a deliberate departure from the original's fixed bouncePwr 300,
  // 13.8 px for Mario and 14.9 px for Luigi either way): the campaign's own bounce, vy -4 px/f,
  // rising on the tier's hold gravity while jump is held, so a held jump bounces higher.
  for (const [id, def] of PLUMBERS) {
    it(`${id}: the campaign's bounce, higher with jump held`, () => {
      const held = bounce(def, true);
      const free = bounce(def, false);
      // Standing tier: 4 px/f against 0x700 (about 18 px) or 0x200 (about 64 px) a frame.
      expect(free).toBeGreaterThan(14);
      expect(free).toBeLessThan(22);
      expect(held).toBeGreaterThan(free * 2);
    });
  }
});

describe('fireball (ML-C19, ML-C20)', () => {
  function fire(level: LevelData = flatLevel({}, 400)) {
    const r = new Rig(MARIO_CLASSIC, level, 'classic', 'fire');
    // At the screen's left edge, so the fireball has the whole screen to bounce across.
    r.p.body.x = px(16);
    r.settle();
    r.step(['attack']);
    const fb = r.world.entities.find((e): e is Projectile => e instanceof Projectile);
    return { r, fb: fb as Projectile };
  }

  it('spawns 5 px ahead of his centre, 21 px above his feet, falling at 2.5 px/f', () => {
    const r = new Rig(MARIO_CLASSIC, flatLevel({}, 400), 'classic', 'fire');
    r.settle();
    const cx = r.p.centerX;
    const feet = r.p.feetY;
    r.step(['attack']);
    const fb = r.world.entities.find((e): e is Projectile => e instanceof Projectile) as Projectile;
    expect(fb.spec).toBe(FIREBALL_CLASSIC);
    expect(fb.body.vy).toBe(0x2800);
    // Its first update ran this frame: one frame of motion from the spawn point.
    expect(fb.body.x + (fb.body.w >> 1) - (0x3f55 >> 4)).toBe(cx + px(5));
    expect(fb.body.y + (fb.body.h >> 1) - (0x2800 >> 4)).toBe(feet - px(21));
    expect(r.p.attackTimer).toBeGreaterThan(0);
  });

  it('bounces 12.4 px high every 23 frames and moves 3.96 px a frame', () => {
    const { r, fb } = fire();
    const b = fb.body;
    const bounces: number[] = [];
    let groundTop = 0;
    let minTop = Infinity;
    let x0 = 0;
    for (let f = 0; f < 80 && fb.alive; f++) {
      const x = b.x;
      r.step();
      if (f === 1) x0 = x;
      if (b.vy === FIREBALL_CLASSIC.bounceVy) {
        bounces.push(f);
        groundTop = b.y;
      }
      if (bounces.length >= 2) minTop = Math.min(minTop, b.y);
      if (f === 60) expect((b.x - x0) / 256 / 60).toBeCloseTo(3.958, 1);
    }
    expect(bounces.length).toBeGreaterThanOrEqual(3);
    // 23 in the original, which lands on touching the ground; our tile test lands one frame later
    // when the arc returns exactly to the ground's top (the moves are whole subpixels here).
    const period = (bounces[2] as number) - (bounces[1] as number);
    expect(Math.abs(period - 23)).toBeLessThanOrEqual(1);
    expect(Math.abs((groundTop - minTop) / 256 - 12.4)).toBeLessThanOrEqual(0.5);
  });

  it('bursts on a ceiling', () => {
    const { r, fb } = fire(flatLevel({ 11: '.'.repeat(9) + '#'.repeat(30) }, 400));
    const open = fire();
    for (let f = 0; f < 50; f++) {
      r.step();
      open.r.step();
    }
    expect(fb.alive).toBe(false);
    expect(open.fb.alive).toBe(true);
  });

  it('two at a time: a third is not thrown', () => {
    const r = new Rig(MARIO_CLASSIC, flatLevel({}, 400), 'classic', 'fire');
    r.settle();
    for (let i = 0; i < 3; i++) {
      r.step(['attack']);
      r.step([]);
    }
    expect(r.world.countProjectiles(r.p, 'fireball')).toBe(2);
  });

  it('carries the original damage (1000)', () => {
    expect(FIREBALL_CLASSIC.amount).toBe(1000);
  });
});

describe('crouch and crouch-jump (ML-C6, ML-C22)', () => {
  it('big Mario holding Down jumps crouched: 16 px tall to the landing, no run cap, no fireball', () => {
    const r = new Rig(MARIO_CLASSIC, flatLevel({}, 400), 'classic', 'fire');
    r.settle();
    r.step(['down']);
    expect(r.p.crouching).toBe(true);
    r.p.body.vx = WALK;
    r.step(['down', 'jump']);
    expect(r.p.crouchJump).toBe(true);
    let air = 0;
    while (!r.p.body.onGround && air < 100) {
      r.step(['jump', 'right', 'attack']);
      air++;
      if (!r.p.body.onGround) {
        expect(r.p.body.h).toBe(px(16));
        expect(r.p.body.vx).toBeLessThanOrEqual(WALK);
        expect(r.p.anim).toBe('crouch');
      }
    }
    expect(r.world.countProjectiles(r.p, 'fireball')).toBe(0);
    // Down released: he stands on landing.
    expect(r.p.crouching).toBe(false);
    expect(r.p.body.h).toBe(px(24));
  });

  it('small heroes cannot crouch; a crouched big hero cannot walk', () => {
    const s = new Rig(MARIO_CLASSIC);
    s.settle();
    s.step(['down']);
    expect(s.p.crouching).toBe(false);
    const big = new Rig(MARIO_CLASSIC, flatLevel(), 'classic', 'big');
    big.settle();
    for (let i = 0; i < 10; i++) big.step(['down', 'right']);
    expect(big.p.body.vx).toBe(0);
  });
});

describe('power-ups (ML-C16, ML-C17)', () => {
  it('a Mushroom while big gives fire, with a 60-frame freeze', () => {
    const r = new Rig(MARIO_CLASSIC, flatLevel(), 'classic', 'big');
    r.settle();
    r.p.def.behaviour.onPowerUp(r.p, 'mushroom', r.world);
    expect(r.p.powerState).toBe('fire');
    const g = new Goomba(px(150), px(13 * 16 - 16));
    r.world.spawn(g);
    const gx = g.body.x;
    for (let i = 0; i < 60; i++) r.step();
    // The world stood still for 60 frames.
    expect(g.body.x).toBe(gx);
    expect(r.p.transition).not.toBeNull();
    r.step();
    expect(r.p.transition).toBeNull();
  });

  it('a Fire Flower while small gives big only; a hit takes him to small (Lose Everything)', () => {
    const r = new Rig(LUIGI_CLASSIC);
    r.settle();
    r.p.def.behaviour.onPowerUp(r.p, 'flower', r.world);
    expect(r.p.powerState).toBe('big');
    r.until(() => r.p.transition === null);
    r.p.def.behaviour.onPowerUp(r.p, 'flower', r.world);
    r.until(() => r.p.transition === null);
    expect(r.p.powerState).toBe('fire');
    r.world.hurtPlayer(r.p);
    expect(r.p.powerState).toBe('small');
    expect(r.p.transition?.len).toBe(61);
  });
});

describe('death (ML-C18)', () => {
  it('freezes 15 frames, hops at 4.1667 px/f, ends 195 frames after the hit', () => {
    const r = new Rig(MARIO_CLASSIC);
    r.settle();
    r.world.kill(r.p);
    const at = r.frame;
    const y = r.p.body.y;
    for (let i = 0; i < 15; i++) r.step();
    expect(r.p.body.y).toBe(y);
    r.step();
    expect(r.p.body.vy).toBe(-0x42ab + 0x2ab);
    r.until(() => r.events.some((e) => e.e.type === 'died'), [], 300);
    const died = r.events.find((e) => e.e.type === 'died');
    expect((died?.frame as number) - at).toBe(195);
  });

  it('a pit death has no hop and ends 180 frames after the fall', () => {
    const r = new Rig(LUIGI_CLASSIC);
    r.settle();
    r.p.body.y = px(260);
    r.world.kill(r.p);
    const at = r.frame;
    const y = r.p.body.y;
    r.until(() => r.events.some((e) => e.e.type === 'died'), [], 300);
    expect(r.p.body.y).toBe(y);
    expect((r.events.find((e) => e.e.type === 'died')?.frame as number) - at).toBe(180);
  });
});

describe('under water (ML-C15) and the sea floor (ML-C25)', () => {
  const water = (rows: Record<number, string> = {}) =>
    parseTextMap(
      [
        'id: w',
        'theme: water',
        'swim: true',
        'time: 300',
        'start: 6,12',
        '',
        '[tiles]',
        ...Array.from({ length: 13 }, (_, y) => (y === 2 ? 'w'.repeat(48) : (rows[y] ?? '')).padEnd(48, '.')),
        '#'.repeat(48),
        '#'.repeat(48),
      ].join('\n'),
    );

  it('a jump press is a stroke, facing turns freely, and run raises no cap', () => {
    const r = new Rig(MARIO_CLASSIC, water());
    r.settle();
    r.step(['jump']);
    expect(r.p.body.vy).toBeGreaterThan(-0x1aab);
    expect(r.p.body.vy).toBeLessThan(0);
    expect(r.p.rising).toBe(false);
    r.p.body.vx = 0x1000;
    r.step(['left']);
    expect(r.p.facing).toBe(-1);
    for (let i = 0; i < 80; i++) r.step(['right', 'attack']);
    expect(r.p.body.vx).toBeLessThanOrEqual(WALK);
  });

  it('landing on a Goomba under water hurts (no stomp)', () => {
    const r = new Rig(MARIO_CLASSIC, water(), 'classic', 'big');
    r.settle();
    const b = r.p.body;
    const g = new Goomba(b.x, px(13 * 16 - 16));
    g.body.vx = 0;
    r.world.spawn(g);
    b.y -= px(30);
    r.until(() => r.p.powerState === 'small', [], 120);
    expect(r.p.powerState).toBe('small');
    expect(g.alive).toBe(true);
  });

  it('a Blooper cannot hurt him on the sea floor, but can a tile higher', () => {
    const floor = new Rig(MARIO_CLASSIC, water(), 'classic', 'big');
    floor.settle();
    floor.world.spawn(new Blooper(floor.p.body.x, floor.p.body.y));
    for (let i = 0; i < 5; i++) floor.step();
    expect(floor.p.powerState).toBe('big');
    const ledge = new Rig(MARIO_CLASSIC, water({ 12: '#'.repeat(48) }), 'classic', 'big');
    ledge.p.body.y = px(12 * 16) - ledge.p.body.h;
    ledge.settle();
    ledge.world.spawn(new Blooper(ledge.p.body.x, ledge.p.body.y));
    for (let i = 0; i < 5; i++) ledge.step();
    expect(ledge.p.powerState).toBe('small');
  });
});

describe('the walk after the axe (ML-C26)', () => {
  const W = 48;
  const castle = parseTextMap(
    [
      'id: t',
      'theme: castle',
      'time: 300',
      'start: 25,11',
      '',
      '[tiles]',
      ...Array.from({ length: 11 }, () => '.'.repeat(W)),
      '.'.repeat(28) + '###' + '.'.repeat(W - 31),
      '.'.repeat(16) + '-'.repeat(12) + '###' + '.'.repeat(W - 31),
      '#'.repeat(16) + '~'.repeat(12) + '#'.repeat(W - 28),
      '#'.repeat(16) + '.'.repeat(12) + '#'.repeat(W - 28),
      '',
      '[entities]',
      'bowser 20 11',
      'axe 28 10',
      'toad 40 12',
      '',
      '[zones]',
      'exit 39 next=2-1',
    ].join('\n'),
  );
  it('walks at 1.4583 px/f, then slides 10 frames (about 6.6 px) past the marker', () => {
    const r = runSim({
      level: castle,
      character: MARIO,
      rules: 'classic',
      script: { steps: [] },
      maxFrames: 1500,
      assist: { invulnerable: true },
      castleOk: false,
      controller: (w, f) => {
        if (f === 0) {
          const b = w.player.body;
          b.x = px(28 * 16 + 2);
          b.y = px(11 * 16) - b.h;
          w.camera.snapTo(b.x);
        }
        return [];
      },
      until: (w) => (w.bossClear?.stop ?? 0) > 0 && (w.bossClear?.t ?? 0) > (w.bossClear?.stop ?? 0) + 20,
    });
    const p = r.world.player;
    expect(p.def).toBe(MARIO_CLASSIC);
    const edge = (p.body.x + p.body.w) / 256;
    expect(Math.abs(edge - 39 * 16 - 6.6)).toBeLessThanOrEqual(1.5);
  });
});

describe('guides and touch (TG-22, TG-40)', () => {
  const ACTIONS = new Set(['left/right', 'jump', 'attack', 'down', 'attack (hold)']);
  const LETTER = /\b(BUTTON )?[ABC]\b/;
  const PROSE = /\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:|\b[abc]\s*\/|\/\s*[abc]\b/i;
  for (const [id, def] of PLUMBERS)
    it(`${id}: a complete Classic guide that names abilities, not buttons`, () => {
      const g = def.guide;
      expect(g).not.toBe(heroFor(def.id === 'mario' ? MARIO : LUIGI, 'current').guide);
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
      expect(def.touchLabels).toBeDefined();
      expect(def.tools).toBeUndefined();
      expect(def.meter).toBeUndefined();
      expect(def.devKit?.()).toEqual({});
    });
});
