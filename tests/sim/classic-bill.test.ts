import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import { runSim, ScriptedInput } from '@game/sim/headless';
import { BILL } from '@game/characters/bill';
import { BILL_CLASSIC, attackGun, specialGun } from '@game/characters/bill/classic';
import { BillShot, CLASSIC_GUNS } from '@game/characters/bill/classic-weapons';
import { CHARACTERS, CLASSIC_CHARACTERS, heroFor } from '@game/characters/registry';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import type { Enemy } from '@game/entities/enemies/enemy';
import { Projectile } from '@game/entities/projectiles/projectile';
import { PowerUp } from '@game/entities/objects/powerup';
import type { DamageSource } from '@game/rules/damage';
import type { World } from '@game/world/world';
import { fontText } from '@game/hud/text';
import { testLevel, tile } from './classic-harness';

// Classic SMBC Bill (bug-reports/2026-10-07-bill-classic-smbc-rules.md, BI-C1..BI-C32): the
// report's acceptance checks, run headless with `rules: 'classic'` on a flat test stretch
// (ground top at y = 208 px, Bill starting at column 2).

type Power = 'small' | 'big' | 'fire';

function setup(
  opts: {
    power?: Power;
    kit?: Record<string, number>;
    level?: ReturnType<typeof parseTextMap>;
    rules?: 'classic' | 'campaign';
  } = {},
) {
  const w = runSim({
    level: opts.level ?? testLevel(),
    character: BILL,
    rules: opts.rules ?? 'classic',
    script: { steps: [] },
    maxFrames: 0,
    state: { powerState: opts.power ?? 'small', kit: opts.kit ?? {} },
  }).world;
  const input = new ScriptedInput({ steps: [] });
  const shots: { shot: BillShot; at: number; x: number; y: number; dormant: number }[] = [];
  let n = 0;
  const spawn = w.spawn.bind(w);
  w.spawn = (e) => {
    if (e instanceof BillShot)
      shots.push({
        shot: e,
        at: n,
        x: e.body.x + (e.body.w >> 1),
        y: e.body.y + (e.body.h >> 1),
        dormant: e.dormant,
      });
    spawn(e);
  };
  const frame = (hold: Action[] = []) => {
    input.setHeld(hold);
    input.next();
    w.update([input]);
    n++;
  };
  const run = (k: number, hold: Action[] = []) => {
    for (let i = 0; i < k; i++) frame(hold);
  };
  // Settle on the ground.
  run(4);
  n = 0;
  return { w, p: w.player, frame, run, shots, frameNo: () => n };
}

const live = (w: World) => w.entities.filter((e): e is BillShot => e instanceof BillShot && e.alive);
const place = <E extends Enemy>(w: World, e: E): E => {
  w.spawn(e);
  return e;
};
const feet = (w: World) => w.player.body.y + w.player.body.h;
const centre = (w: World) => w.player.body.x + (w.player.body.w >> 1);

describe('Classic Bill: registry and Campaign (TG-17, TG-38, check 11)', () => {
  it('Classic resolves to BILL_CLASSIC; Campaign stays the Campaign def, unchanged', () => {
    expect(CLASSIC_CHARACTERS.bill).toBe(BILL_CLASSIC);
    expect(heroFor(BILL, 'classic')).toBe(BILL_CLASSIC);
    expect(heroFor(BILL, 'campaign')).toBe(BILL);
    expect(BILL_CLASSIC.rules).toBe('classic');
    expect(BILL_CLASSIC.id).toBe('bill');
    expect(CHARACTERS.find((c) => c.id === 'bill')?.rules).toBeUndefined();
    expect(BILL.crouchNeedsNoDirection).toBeUndefined();
    expect(BILL.deathThrow).toBeUndefined();
  });

  it('under Campaign Bill walks at 1.5 px/f, has 3 hits, and his shots stop on tiles', () => {
    const { w, p, run } = setup({ rules: 'campaign' });
    expect(p.def).toBe(BILL);
    expect(p.hp).toBe(3);
    run(20, ['right']);
    expect(p.body.vx).toBe(0x01800);
    const lvl = testLevel({ 11: '..........B' });
    const c = setup({ rules: 'campaign', level: lvl });
    c.frame(['attack']);
    c.run(60);
    expect(c.w.entities.some((e) => e instanceof Projectile && e.alive)).toBe(false);
    void w;
  });
});

describe('walk and jump (BI-C6, BI-C7, BI-C10; checks 1, 2)', () => {
  it('vx is 1.25 px/f on the first frame Right is held and 0 on the first ground frame after release', () => {
    const { p, frame } = setup();
    frame(['right']);
    expect(p.body.vx).toBe(0x01400);
    frame([]);
    expect(p.body.vx).toBe(0);
    frame(['left']);
    expect(p.body.vx).toBe(-0x01400); // turning is instant, no skid
  });

  it('in the air with no direction vx keeps its take-off value', () => {
    const { p, frame, run } = setup();
    frame(['right']);
    frame(['right', 'jump']);
    run(10);
    expect(p.body.onGround).toBe(false);
    expect(p.body.vx).toBe(0x01400);
  });

  it('a jump from rest: apex 73 px (±1), landing 66 frames (±1) later, falls never over 5 px/f', () => {
    const { w, p, frame } = setup();
    const start = feet(w);
    frame(['jump']);
    let top = start;
    let frames = 1;
    let maxVy = 0;
    while (!p.body.onGround && frames < 200) {
      frame([]);
      frames++;
      top = Math.min(top, feet(w));
      maxVy = Math.max(maxVy, p.body.vy);
    }
    expect(Math.abs((start - top) / px(1) - 73)).toBeLessThanOrEqual(1);
    expect(Math.abs(frames - 66)).toBeLessThanOrEqual(1);
    expect(maxVy).toBeLessThanOrEqual(0x05000);
  });
});

describe('aim, prone and muzzles (BI-C3, BI-C4, BI-C8, BI-C9, BI-C25; checks 3, 4)', () => {
  it('Down + Right walks at 1.25 px/f, 24 tall, and a rifle shot goes (+1.80, +1.80) from (centre + 15, feet - 13)', () => {
    const { w, p, frame, shots } = setup();
    const x0 = p.body.x;
    frame(['down', 'right']);
    frame(['down', 'right']);
    expect(p.body.x - x0).toBe(2 * px(1.25));
    expect(p.body.h).toBe(px(24));
    expect(p.crouching).toBe(false);
    frame(['down', 'right', 'attack']);
    const s = shots[0];
    expect(s).toBeDefined();
    expect(s?.shot.body.vx).toBe(0x01ccd);
    expect(s?.shot.body.vy).toBe(0x01ccd);
    // The muzzle is computed from the body as it stood when the shot spawned (after this frame's move).
    expect(s?.x).toBe(centre(w) + px(15));
    expect(s?.y).toBe(feet(w) - px(13));
  });

  it('Down alone: prone, 15 px tall, no movement; Up + Down: Up wins', () => {
    const { p, frame } = setup();
    const x0 = p.body.x;
    frame(['down']);
    expect(p.crouching).toBe(true);
    expect(p.body.h).toBe(px(15));
    frame(['down', 'right']);
    expect(p.crouching).toBe(false);
    expect(p.body.x).toBeGreaterThan(x0);
    frame(['down', 'up']);
    expect(p.crouching).toBe(false);
  });

  it('Down alone during a jump shoots straight down', () => {
    const { frame, run, shots } = setup();
    frame(['jump']);
    run(5);
    frame(['down', 'attack']);
    expect(shots[0]?.shot.body.vx).toBe(0);
    expect(shots[0]?.shot.body.vy).toBe(0x02666);
  });

  it('after walking off a ledge, Down alone shoots forward from (12.5, 22.5)', () => {
    const lvl = parseTextMap(
      [
        'id: t',
        'time: 300',
        'start: 2,12',
        '',
        '[tiles]',
        ...Array.from({ length: 13 }, () => '.'.repeat(48)),
        '#'.repeat(5) + '.'.repeat(43),
        '#'.repeat(5) + '.'.repeat(43),
      ].join('\n'),
    );
    const { w, p, frame, shots } = setup({ level: lvl });
    let k = 0;
    while (p.body.onGround && k++ < 100) frame(['right']);
    frame([]);
    frame(['down', 'attack']);
    const s = shots[0];
    expect(s?.shot.body.vx).toBe(0x02666);
    expect(s?.shot.body.vy).toBe(0);
    expect(s?.x).toBe(centre(w) + px(12.5));
    expect(s?.y).toBe(feet(w) - px(22.5));
  });
});

describe('rifle (BI-C17..BI-C20, BI-C26, BI-C27; check 5)', () => {
  it('the 5th press with 4 out fires nothing', () => {
    const { w, frame } = setup();
    for (let i = 0; i < 5; i++) {
      frame(['attack']);
      frame([]);
    }
    expect(live(w)).toHaveLength(4);
  });

  it('a standing shot passes over a Goomba; prone shots kill it on the 3rd hit', () => {
    const { w, frame, run } = setup();
    const g = place(w, new Goomba(tile(8), tile(12) + px(2)));
    g.body.vx = 0;
    frame(['attack']);
    run(60);
    expect(g.alive).toBe(true);
    expect(g.classicHp ?? null).toBeNull();
    let hits = 0;
    for (let i = 0; i < 6 && g.alive; i++) {
      frame(['down', 'attack']);
      run(40, ['down']);
      hits++;
    }
    expect(g.alive).toBe(false);
    expect(hits).toBe(3);
  });

  it('damage counts: a Koopa takes 6 rifle hits; a Buzzy Beetle none, and each bullet explodes on it', () => {
    const { w, p } = setup();
    const shotSrc = (gun: keyof typeof CLASSIC_GUNS): DamageSource => {
      const shot = new BillShot(gun, 0, 0, p, 0, 0);
      const s = CLASSIC_GUNS[gun].spec;
      return { kind: s.damage, amount: s.amount, owner: shot, dirX: 1, ...s.classicHit };
    };
    const kill = (e: Enemy, gun: keyof typeof CLASSIC_GUNS) => {
      let n = 0;
      while (e.alive && n < 60) {
        e.hit(shotSrc(gun), w);
        n++;
      }
      return n;
    };
    expect(kill(place(w, new Goomba(tile(20), tile(12))), 'rifle')).toBe(3);
    expect(kill(place(w, new Goomba(tile(22), tile(12))), 'mg')).toBe(2);
    expect(kill(place(w, new Koopa(tile(24), tile(12), 'green')), 'rifle')).toBe(6);
    expect(kill(place(w, new Koopa(tile(26), tile(12), 'green')), 'spread')).toBe(5);
    const buzzy = place(w, new Koopa(tile(28), tile(12), 'buzzy'));
    expect(buzzy.hit(shotSrc('rifle'), w)).toBe('blocked');
    expect(buzzy.hit(shotSrc('laser'), w)).toBe('blocked');
    expect(kill(buzzy, 'flare')).toBe(3);
  });

  it('a prone bullet explodes on a Buzzy Beetle (3 frames, still counted) and does it no harm', () => {
    const { w, frame, run } = setup();
    const b = place(w, new Koopa(tile(6), tile(12) - px(2), 'buzzy'));
    b.body.vx = 0;
    frame(['down', 'attack']);
    let blast: BillShot | undefined;
    for (let i = 0; i < 60 && !blast; i++) {
      frame(['down']);
      blast = live(w).find((s) => s.blast > 0);
    }
    expect(blast).toBeDefined();
    expect(b.alive).toBe(true);
    expect(b.classicHp ?? 600).toBe(600);
    run(2, ['down']);
    expect(live(w)).toHaveLength(1);
    run(1, ['down']);
    expect(live(w)).toHaveLength(0);
  });

  it('a brick breaks on the 2nd shot; a ? block gives its item to the 1st shot from 5 tiles away', () => {
    const lvl = testLevel({ 11: '........=..M' });
    const { w, frame, run } = setup({ level: lvl });
    frame(['attack']);
    run(50);
    expect(w.map.get(8, 11)).toBe(T.BRICK);
    frame(['attack']);
    run(50);
    expect(w.map.get(8, 11)).not.toBe(T.BRICK);
    frame(['attack']);
    run(80);
    expect(w.map.get(11, 11)).not.toBe(T.Q_POWERUP);
    expect(w.entities.some((e) => e instanceof PowerUp)).toBe(true);
  });

  it('a shot into a pipe or the ground keeps flying', () => {
    const lvl = testLevel({ 11: '......[]', 12: '......{}' });
    const { w, frame, run } = setup({ level: lvl });
    frame(['attack']);
    run(30);
    const s = live(w)[0];
    expect(s).toBeDefined();
    expect(s?.body.x).toBeGreaterThan(tile(8));
    frame(['down', 'right', 'attack']);
    run(20);
    expect(live(w).some((x) => x.body.y > tile(13) + px(8))).toBe(true);
  });
});

describe('Machine Gun (BI-C21; check 6)', () => {
  it('bullets on frames 0, 7, 14, 20, 27, 33; the tick at 40 is blocked by the cap; release stops it', () => {
    const { frame, shots, frameNo } = setup({ power: 'big' });
    for (let i = 0; i < 46; i++) frame(['attack']);
    expect(shots.map((s) => s.at)).toEqual([0, 7, 14, 20, 27, 33]);
    expect(frameNo()).toBe(46);
    const before = shots.length;
    for (let i = 0; i < 60; i++) frame([]);
    expect(shots.length).toBe(before);
  });

  it('a long hold fires 6 timer shots, skips one tick, then fires again', () => {
    const lvl = testLevel();
    const { frame, shots } = setup({ power: 'big', level: lvl });
    // Kill each shot right away so the cap never stops the timer.
    for (let i = 0; i < 60; i++) {
      frame(['attack']);
      for (const s of shots) s.shot.destroy();
    }
    // Ticks fall on ceil(6.6 n): 7 14 20 27 33 40 | 47 skipped | 53 60...
    expect(shots.map((s) => s.at)).toEqual([0, 7, 14, 20, 27, 33, 40, 53]);
  });
});

describe('Spread, swap and touch (BI-C1, BI-C22, BI-C31; check 7)', () => {
  it('one press makes 5 pellets with vy 0, ±0.5 and ±1.0 px/f; 6 out gives 4, 10 out none', () => {
    const { w, frame, shots } = setup({ power: 'fire' });
    frame(['attack']);
    expect(shots.map((s) => s.shot.body.vy)).toEqual([0, 0x800, -0x800, -0x1000, 0x1000]);
    expect(shots.every((s) => s.shot.body.vx === 0x02c66)).toBe(true);
    frame([]);
    frame(['special']); // the Machine Gun: 6 out
    frame([]);
    expect(live(w)).toHaveLength(6);
    frame(['attack']);
    expect(live(w)).toHaveLength(10);
    frame([]);
    frame(['attack']);
    expect(live(w)).toHaveLength(10);
  });

  it('Special fires the Machine Gun; after Select Attack does, and a new Flower resets the swap', () => {
    const { w, p, frame } = setup({ power: 'fire' });
    expect(attackGun(p)).toBe('spread');
    expect(specialGun(p)).toBe('mg');
    expect(BILL_CLASSIC.touchLabels?.(p, w)).toEqual({ attack: 'SHOOT', special: 'M-GUN', select: 'SWAP' });
    frame(['select']);
    expect(attackGun(p)).toBe('mg');
    expect(specialGun(p)).toBe('spread');
    frame([]);
    w.hurtPlayer(p, 1);
    expect(p.powerState).toBe('small');
    expect(attackGun(p)).toBe('rifle');
    expect(BILL_CLASSIC.touchLabels?.(p, w)).toEqual({ attack: 'SHOOT', special: null, select: null });
    p.transition = null;
    p.invuln = 0;
    w.powerUp(p, 'mushroom');
    p.transition = null;
    expect(attackGun(p)).toBe('mg');
    expect(specialGun(p)).toBeNull();
    w.powerUp(p, 'flower');
    p.transition = null;
    expect(attackGun(p)).toBe('spread');
  });
});

describe('Laser and Flare with the full kit (BI-C2, BI-C23, BI-C24, TG-44; check 8)', () => {
  it('the kit belt lists four guns only with the Flower; Select cycles Attack, Special keeps the Machine Gun', () => {
    const { w, p, frame } = setup({ power: 'fire', kit: { classicAll: 1 } });
    expect(BILL_CLASSIC.tools?.(p).map((t) => t.id)).toEqual(['spread', 'laser', 'flare', 'mg']);
    const seen: string[] = [attackGun(p)];
    for (let i = 0; i < 4; i++) {
      frame(['select']);
      frame([]);
      seen.push(attackGun(p));
      expect(specialGun(p)).toBe('mg');
    }
    expect(seen).toEqual(['spread', 'laser', 'flare', 'mg', 'spread']);
    const small = setup({ power: 'small', kit: { classicAll: 1 } });
    expect(BILL_CLASSIC.tools?.(small.p)).toEqual([]);
    void w;
  });

  it('a laser is 4 segments 13 px apart; the next press removes all of them', () => {
    const { w, frame, run, shots } = setup({ power: 'fire', kit: { classicAll: 1 } });
    frame(['select']);
    frame([]);
    frame(['attack']);
    const first = shots.map((s) => s.shot);
    expect(first).toHaveLength(4);
    const xs = shots.map((s) => s.x);
    for (let i = 1; i < 4; i++) expect((xs[i - 1] as number) - (xs[i] as number)).toBe(px(13));
    // Segments 2-4 switch on after 4, 9 and 13 moves (3 px behind the muzzle).
    expect(shots.map((s) => s.dormant)).toEqual([0, 4, 9, 13]);
    run(5);
    frame(['attack']);
    expect(first.every((s) => !s.alive)).toBe(true);
    expect(live(w)).toHaveLength(4);
  });

  it("the Flare's fireball stays 16 px from its centre, which moves 1.758 px/f; a 4th press with 3 out fires nothing", () => {
    const { w, frame, shots } = setup({ power: 'fire', kit: { classicAll: 1 } });
    frame(['select']);
    frame([]);
    frame(['select']);
    frame([]);
    frame(['attack']);
    const f = shots[0]?.shot as BillShot;
    const c0 = f.flareCentre() as { x: number; y: number };
    for (let i = 0; i < 20; i++) {
      frame([]);
      const c = f.flareCentre() as { x: number; y: number };
      const bx = f.body.x + (f.body.w >> 1);
      const by = f.body.y + (f.body.h >> 1);
      expect(Math.abs(Math.hypot(bx - c.x, by - c.y) / px(1) - 16)).toBeLessThanOrEqual(0.5);
    }
    const c1 = f.flareCentre() as { x: number; y: number };
    expect(Math.abs((c1.x - c0.x) / px(1) - 1.758 * 20)).toBeLessThanOrEqual(1);
    for (let i = 0; i < 4; i++) {
      frame(['attack']);
      frame([]);
    }
    expect(live(w).filter((s) => s.gun === 'flare')).toHaveLength(3);
  });
});

describe('hits, death and the head (BI-C12..BI-C15, BI-C28; checks 9, 10)', () => {
  it('a hit with the Flower: small with the rifle, the world still for 60 frames, then 120 invulnerable, no knockback', () => {
    const { w, p, frame } = setup({ power: 'fire' });
    const g = place(w, new Goomba(tile(20), tile(12) + px(2)));
    frame([]);
    const vx = p.body.vx;
    w.hurtPlayer(p, 1);
    expect(p.powerState).toBe('small');
    expect(attackGun(p)).toBe('rifle');
    const gx = g.body.x;
    for (let i = 0; i < 60; i++) {
      frame(['right']);
      expect(g.body.x).toBe(gx);
    }
    frame([]);
    expect(g.body.x).not.toBe(gx);
    expect(p.invuln).toBe(119);
    expect(p.body.vx).toBe(vx);
    expect(p.stun).toBe(0);
  });

  it('a hit while small throws him away from it (1.25, -2.5 px/f); he lands and the death ends 90 frames later', () => {
    const { w, p, frame } = setup();
    w.hurtPlayer(p, 1);
    expect(p.dead).toBe(true);
    expect(p.body.vx).toBe(0x01400);
    expect(p.body.vy).toBe(-0x02800);
    let t = 0;
    let landed = -1;
    const died = () => w.events.some((e) => e.type === 'died');
    while (!died() && t < 400) {
      w.events.length = 0;
      frame([]);
      t++;
      if (landed < 0 && p.body.onGround) landed = t;
      if (died()) break;
    }
    expect(landed).toBeGreaterThan(20);
    expect(t).toBe(landed + 90);
    expect(feet(w)).toBe(tile(13));
  });

  it('his head bumps a brick and never breaks it, small or with the Flower', () => {
    for (const power of ['small', 'fire'] as const) {
      const lvl = testLevel({ 9: '..==' });
      const { w, frame, run } = setup({ power, level: lvl });
      frame(['jump']);
      run(70);
      expect(w.map.get(2, 9) === T.BRICK || w.map.get(3, 9) === T.BRICK).toBe(true);
      expect([w.map.get(2, 9), w.map.get(3, 9)].filter((id) => id === T.BRICK).length).toBe(2);
    }
  });
});

describe('guide and touch (TG-22, TG-40, BI-C31)', () => {
  it('a Classic guide the font can draw, no button letters, and no drops or belt', () => {
    const g = BILL_CLASSIC.guide;
    const LETTER = /\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:/i;
    const texts = [
      g.tagline,
      ...g.controls.flatMap((c) => [c.does, c.touch ?? '', c.touchDoes ?? '']),
      ...g.powerups.map((x) => x.does),
      ...(g.tips ?? []),
    ];
    for (const t of texts) {
      expect(fontText(t).length, t).toBe(t.length);
      expect(t).not.toMatch(LETTER);
    }
    expect(g.tagline.length).toBeLessThanOrEqual(30);
    expect(g.belt).toBeUndefined();
    expect(BILL_CLASSIC.drop?.(null as never, null as never)).toBeNull();
    expect(BILL_CLASSIC.meter).toBeUndefined();
    expect(BILL_CLASSIC.startHp).toBeUndefined();
  });
});
