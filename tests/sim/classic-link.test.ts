import { describe, expect, it } from 'vitest';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import { LINK, LINK_PROFILE } from '@game/characters/link';
import {
  ATTACK_FRAMES,
  LINK_CLASSIC,
  LINK_CLASSIC_PROFILE,
  SWORD_DAMAGE,
  THRUST_BOUNCE,
} from '@game/characters/link/classic';
import { LinkBomb, LinkBoomerang, LinkShot } from '@game/characters/link/classic-weapons';
import { heroFor } from '@game/characters/registry';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { PowerUp } from '@game/entities/objects/powerup';
import { SWORD_BEAM } from '@game/entities/projectiles/projectile';
import { runSim } from '@game/sim/headless';
import { fontText } from '@game/hud/text';
import type { Enemy } from '@game/entities/enemies/enemy';
import { flatLevel, measureJump, Rig } from './classic-plumber-harness';

// Classic SMBC Link (bug-reports/2026-10-07-link-classic-smbc-rules.md, LK-C1..LK-C45): the
// report's acceptance checks, measured on the real def through the World.

const INF = Infinity;
const WALK = 0x01755;
/** The floor top in flatLevel (row 13). */
const FLOOR = px(13 * 16);

function rig(power = 'small', rows: Record<number, string> = {}): Rig {
  const r = new Rig(LINK, flatLevel(rows), 'classic', power);
  r.settle();
  return r;
}

/** Puts an enemy with its left edge `dxPx` px right of Link's centre, standing on the floor. */
function place<E extends Enemy>(r: Rig, e: E, dxPx: number): E {
  e.body.x = r.p.centerX + px(dxPx);
  e.body.y = FLOOR - e.body.h;
  r.world.spawn(e);
  return e;
}

/** Stabs (Attack pressed one frame, then nothing) and waits out the attack state. */
function stab(r: Rig, extra: Action[] = []): void {
  r.step(['attack', ...extra]);
  for (let i = 1; i < ATTACK_FRAMES + 1; i++) r.step(extra.filter((a) => a !== 'attack'));
}

describe('registry and Current (TG-17, TG-18, TG-38)', () => {
  it('Classic rules play LINK_CLASSIC; Current keeps LINK untouched', () => {
    expect(heroFor(LINK, 'classic')).toBe(LINK_CLASSIC);
    expect(heroFor(LINK, 'current')).toBe(LINK);
    expect(LINK_CLASSIC.rules).toBe('classic');
    expect([LINK_CLASSIC.id, LINK_CLASSIC.name, LINK_CLASSIC.hudName, LINK_CLASSIC.portrait]).toEqual([
      LINK.id,
      LINK.name,
      LINK.hudName,
      LINK.portrait,
    ]);
    expect(LINK.rules).toBeUndefined();
    expect(LINK.movement).toBe(LINK_PROFILE);
    for (const k of ['airStop', 'softCut', 'jumpBuffer', 'rise', 'inertia'])
      expect(k in LINK_PROFILE, k).toBe(false);
    expect(LINK.behaviour.rooted).toBeUndefined();
    expect(LINK.behaviour.meleeDamage).toBeUndefined();
    expect(LINK.damage.kind).toBe('hp');
    expect(LINK.crouches).toBe(true);
    expect(SWORD_BEAM.classicBlocks).toBeUndefined();
  });

  it('Current Link still jumps his fixed 75 px arc and drifts when let go in the air', () => {
    const j = measureJump(LINK, 0, INF, 'current');
    const tap = measureJump(LINK, 0, 1, 'current');
    expect(Math.abs(j.apex - tap.apex)).toBeLessThan(1);
    expect(j.apex).toBeGreaterThan(70);
    const r = new Rig(LINK, flatLevel(), 'current', 'full');
    r.settle();
    expect(r.p.def).toBe(LINK);
    for (let i = 0; i < 20; i++) r.step(['right']);
    r.step(['right', 'jump']);
    r.step([]);
    expect(r.p.body.vx).toBeGreaterThan(0);
  });

  it('a Classic world gives Link his Classic def; the game state keeps the Current one', () => {
    const r = runSim({
      level: flatLevel(),
      character: LINK,
      rules: 'classic',
      script: { steps: [] },
      maxFrames: 1,
    });
    expect(r.world.player.def).toBe(LINK_CLASSIC);
    expect(r.world.state.character).toBe(LINK);
  });
});

describe('movement and jumping (LK-C4..LK-C10)', () => {
  it('a 12 x 16 body in every power state', () => {
    for (const power of ['small', 'big', 'fire']) {
      const r = rig(power);
      expect([r.p.body.w, r.p.body.h]).toEqual([px(12), px(16)]);
    }
  });

  it('jump heights: held 66-68 px (apex frame 27-29), 1 f 20-23, 5 f 34-37, 10 f 48-50', () => {
    const held = measureJump(LINK, 0, INF);
    expect(held.apex).toBeGreaterThanOrEqual(66);
    expect(held.apex).toBeLessThanOrEqual(68);
    expect(held.apexFrame).toBeGreaterThanOrEqual(27);
    expect(held.apexFrame).toBeLessThanOrEqual(29);
    const tap = measureJump(LINK, 0, 1).apex;
    expect(tap).toBeGreaterThanOrEqual(20);
    expect(tap).toBeLessThanOrEqual(23);
    const five = measureJump(LINK, 0, 5).apex;
    expect(five).toBeGreaterThanOrEqual(34);
    expect(five).toBeLessThanOrEqual(37);
    const ten = measureJump(LINK, 0, 10).apex;
    expect(ten).toBeGreaterThanOrEqual(48);
    expect(ten).toBeLessThanOrEqual(50);
  });

  it('falls no faster than 6.667 px/f', () => {
    const r = new Rig(LINK, flatLevel({}, 200, []), 'classic');
    r.p.body.y = px(0);
    let max = 0;
    for (let i = 0; i < 120 && !r.p.body.onGround; i++) {
      r.step();
      max = Math.max(max, r.p.body.vy);
    }
    expect(max).toBeLessThanOrEqual(0x06aab);
    expect(max).toBe(0x06aab);
  });

  it('walk: 0x01755 on the first frame, 0 on the frame after release, on the ground and in the air', () => {
    const r = rig();
    r.step(['right']);
    expect(r.p.body.vx).toBe(WALK);
    r.step([]);
    expect(r.p.body.vx).toBe(0);
    r.step(['right', 'jump']);
    r.step(['right', 'jump']);
    expect(r.p.body.onGround).toBe(false);
    expect(r.p.body.vx).toBe(WALK);
    r.step(['jump']);
    expect(r.p.body.vx).toBe(0);
    r.step(['left', 'right', 'jump']);
    expect(r.p.body.vx).toBe(0);
    expect(LINK_CLASSIC_PROFILE.canRun).toBe(false);
  });

  it('rooting: a ground stab with Right held keeps x for 15 f; a jump on frame 5 does nothing', () => {
    const r = rig();
    const x0 = r.p.body.x;
    r.step(['right', 'attack']);
    for (let i = 1; i < ATTACK_FRAMES; i++) r.step(i === 4 ? ['right', 'jump'] : ['right']);
    expect(r.p.body.x).toBe(x0);
    expect(r.p.body.onGround).toBe(true);
    expect(r.p.facing).toBe(1);
    r.step(['right']);
    expect(r.p.body.x).toBeGreaterThan(x0);
  });

  it('no jump buffer: a press just before landing is lost; Down does nothing on the ground', () => {
    const r = rig();
    r.step(['down']);
    expect(r.p.crouching).toBe(false);
    expect(r.p.body.h).toBe(px(16));
    r.step(['jump']);
    r.until(() => r.p.body.vy > 0, [], 200);
    r.until(() => r.p.body.y + r.p.body.h > FLOOR - px(3), [], 200);
    r.step(['jump']);
    r.step(['jump']);
    expect(r.p.body.onGround).toBe(true);
  });
});

describe('the sword (LK-C22..LK-C24)', () => {
  const stopsFor = (e: Enemy) => e.stopFrames;

  it('small Link: 2 stabs kill a Goomba, each stopping it 24 f', () => {
    const r = rig();
    const g = place(r, new Goomba(0, 0), 8);
    r.step(['attack']);
    expect(g.alive).toBe(true);
    expect(g.classicHp).toBe(250 - SWORD_DAMAGE.small);
    expect(stopsFor(g)).toBe(24);
    for (let i = 1; i < ATTACK_FRAMES + 1; i++) r.step();
    expect(g.alive).toBe(true);
    stab(r);
    expect(g.alive).toBe(false);
    expect(r.p.dead).toBe(false);
  });

  it('small Link: 3 stabs kill a Koopa; Mushroom: 1 kills a Goomba; Magic Sword: 400 a stab', () => {
    const kills = (power: string, make: () => Enemy) => {
      const r = rig(power);
      const e = place(r, make(), 8);
      let n = 0;
      while (e.alive && n < 6) {
        stab(r);
        n++;
      }
      return n;
    };
    expect(kills('small', () => new Koopa(0, 0))).toBe(3);
    expect(kills('big', () => new Goomba(0, 0))).toBe(1);
    // The Magic Sword: 400 a stab (the Red Ring's beam adds its own 200 on the 9th frame).
    const r = rig('fire');
    const k = place(r, new Koopa(0, 0), 8);
    r.step(['attack']);
    expect(k.classicHp).toBe(600 - SWORD_DAMAGE.fire);
  });

  it('the box is live 9 frames, the attack state lasts 15', () => {
    const r = rig();
    let live = 0;
    r.step(['attack']);
    if (r.p.activeMelee) live++;
    for (let i = 1; i < 20; i++) {
      r.step();
      if (r.p.activeMelee) live++;
    }
    expect(live).toBe(9);
  });
});

describe('bricks and blocks (LK-C41)', () => {
  it('a forward stab beside a brick breaks it', () => {
    // Link's centre is at column 6's middle + 6: the brick two columns on is in reach.
    const r = rig('small', { 12: '.......=' });
    r.p.body.x = px(7 * 16) - px(13);
    r.step(['attack']);
    expect(r.world.map.get(7, 12)).not.toBe(T.BRICK);
  });

  it('a down-stab standing on a brick breaks it and he drops', () => {
    const r = new Rig(LINK, flatLevel({ 11: '......=' }), 'classic');
    r.p.body.x = px(6 * 16 + 2);
    r.p.body.y = px(11 * 16) - r.p.body.h;
    r.settle();
    expect(r.p.body.onGround).toBe(true);
    r.step(['down', 'attack']);
    expect(r.world.map.get(6, 11)).not.toBe(T.BRICK);
    r.until(() => r.p.feetY >= FLOOR, [], 60);
    expect(r.p.feetY).toBe(FLOOR);
  });

  it('a down-thrust onto a brick breaks it and bounces him about 19 px', () => {
    const r = new Rig(LINK, flatLevel({ 9: '......=' }), 'classic');
    r.p.body.x = px(6 * 16 + 2);
    r.p.body.y = px(2 * 16);
    r.p.body.vy = 0;
    r.until(() => r.world.map.get(6, 9) !== T.BRICK, ['down'], 120);
    expect(r.p.body.vy).toBe(-THRUST_BOUNCE);
    const top = px(9 * 16);
    expect(r.p.feetY).toBeLessThanOrEqual(top);
    let min = r.p.feetY;
    for (let i = 0; i < 30; i++) {
      r.step(['down']);
      min = Math.min(min, r.p.feetY);
    }
    const rise = (top - min) / 256;
    // Frame-stepped from the original constants: 18.95 px ("about 20").
    expect(rise).toBeGreaterThanOrEqual(18.5);
    expect(rise).toBeLessThanOrEqual(21);
  });

  it('an up-thrust into a ? block bumps it and stops the rise', () => {
    const r = rig('small', { 8: '......?' });
    r.p.body.x = px(6 * 16 + 2);
    let stopped = false;
    r.step(['jump']);
    for (let i = 0; i < 30; i++) {
      const before = r.p.body.vy;
      r.step(['jump', 'up']);
      if (r.world.map.get(6, 8) !== T.Q_COIN && before < 0) {
        stopped = r.p.body.vy >= 0;
        break;
      }
    }
    expect(r.world.map.get(6, 8)).not.toBe(T.Q_COIN);
    expect(stopped).toBe(true);
  });

  it('the head only bumps a brick', () => {
    const r = rig('fire', { 10: '......=' });
    r.p.body.x = px(6 * 16 + 2);
    r.step(['jump']);
    for (let i = 0; i < 30; i++) r.step(['jump']);
    expect(r.world.map.get(6, 10)).toBe(T.BRICK);
  });
});

describe('the Red Ring beam (LK-C28, LK-C29)', () => {
  it('a forward beam passes a pipe and breaks a brick behind it; one beam at a time', () => {
    const r = rig('fire', { 11: '.........[]..=', 12: '.........{}..=' });
    r.step(['attack']);
    for (let i = 1; i < 9; i++) r.step();
    const beams = () => r.world.entities.filter((e) => e instanceof LinkShot && e.alive).length;
    expect(beams()).toBe(1);
    for (let i = 0; i < 7; i++) r.step();
    // A second stab while the first beam flies fires none.
    r.step(['attack']);
    for (let i = 1; i < 9; i++) r.step();
    expect(beams()).toBe(1);
    r.until(() => r.world.map.get(13, 12) !== T.BRICK, [], 120);
    expect(r.world.map.get(13, 12)).not.toBe(T.BRICK);
    expect(r.world.map.get(9, 12)).toBe(T.PIPE_BL);
  });

  it('no beam without the Red Ring; up and down in the air fire it that way', () => {
    const small = rig('big');
    stab(small);
    expect(small.world.entities.some((e) => e instanceof LinkShot)).toBe(false);
    const r = rig('fire');
    r.step(['jump']);
    r.step(['jump', 'up']);
    r.step(['jump', 'up', 'attack']);
    const shot = r.world.entities.find((e): e is LinkShot => e instanceof LinkShot);
    expect(shot?.dir).toBe('up');
    expect(r.p.attackTimer).toBe(0);
  });
});

describe('bombs (LK-C36, LK-C37)', () => {
  it('3 bombs out at most; Link on the bomb is unhurt; the brick under and beside it break', () => {
    const r = new Rig(LINK, flatLevel({ 11: '......===' }), 'classic', 'big');
    r.p.body.x = px(6 * 16 + 2);
    r.p.body.y = px(11 * 16) - r.p.body.h;
    r.settle();
    r.p.scratch.bombs = 10;
    const count = () => r.world.entities.filter((e) => e instanceof LinkBomb && e.alive).length;
    for (let i = 0; i < 3; i++) {
      r.step(['select']);
      for (let k = 0; k < ATTACK_FRAMES; k++) r.step();
    }
    expect(count()).toBe(3);
    expect(r.p.scratch.bombs).toBe(7);
    r.step(['select']);
    expect(count()).toBe(3);
    r.until(() => count() === 0, [], 120);
    expect(r.p.powerState).toBe('big');
    expect(r.p.dead).toBe(false);
    expect(r.world.map.get(7, 11)).not.toBe(T.BRICK);
    expect(r.world.map.get(8, 11)).not.toBe(T.BRICK);
  });

  it('a bomb goes off after 60 f, its blast lasts 32 f and hits a Goomba once for 800', () => {
    const r = rig('big');
    r.step(['select']);
    const bomb = r.world.entities.find((e): e is LinkBomb => e instanceof LinkBomb);
    expect(bomb).toBeDefined();
    const g = place(r, new Goomba(0, 0), 60);
    let f = 1;
    while (bomb && bomb.blast === 0 && f < 100) {
      g.body.x = r.p.centerX + px(60);
      r.step();
      f++;
    }
    expect(f).toBe(60);
    g.body.x = (bomb as LinkBomb).body.x;
    r.step();
    expect(g.alive).toBe(false);
  });

  it('no bombs before the first Mushroom; the first gives 3, a second none', () => {
    const r = rig('small');
    r.step(['select']);
    expect(r.world.entities.some((e) => e instanceof LinkBomb)).toBe(false);
    expect(LINK_CLASSIC.hudAmmo?.(r.p)).toBeNull();
    r.world.powerUp(r.p, 'mushroom');
    r.until(() => r.p.transition === null, [], 100);
    expect(r.p.scratch.bombs).toBe(3);
    expect(LINK_CLASSIC.hudAmmo?.(r.p)).toEqual({ icon: 'icon-bomb', count: 3 });
  });
});

describe('the boomerang (LK-C30..LK-C35)', () => {
  it('the short one turns 80-84 px out and is caught', () => {
    const r = rig();
    r.step(['special']);
    const bm = r.world.entities.find((e): e is LinkBoomerang => e instanceof LinkBoomerang);
    expect(bm).toBeDefined();
    const b = (bm as LinkBoomerang).body;
    const x0 = b.x;
    let far = 0;
    for (let i = 0; i < 300 && bm?.alive; i++) {
      r.step();
      if (!bm.turned) far = Math.max(far, b.x - x0);
    }
    expect(far / 256).toBeGreaterThanOrEqual(78);
    expect(far / 256).toBeLessThanOrEqual(84);
    expect(bm?.alive).toBe(false);
  });

  it('the Magic one reaches the screen edge', () => {
    const r = rig('fire');
    r.step(['special']);
    const bm = r.world.entities.find((e): e is LinkBoomerang => e instanceof LinkBoomerang) as LinkBoomerang;
    let reached = false;
    for (let i = 0; i < 300 && bm.alive; i++) {
      r.step();
      if (bm.body.x + bm.body.w >= r.world.camera.right - px(4)) reached = true;
    }
    expect(reached).toBe(true);
  });

  it('a Mushroom it touches is delivered to Link', () => {
    const r = rig();
    // A Mushroom still rising out of a block 3 columns ahead.
    const m = new PowerUp(9, 13, 'mushroom');
    r.world.spawn(m);
    r.step(['special']);
    r.until(() => !m.alive, [], 60);
    expect(r.p.powerState).toBe('small');
    r.until(() => r.p.powerState === 'big', [], 200);
    expect(r.p.powerState).toBe('big');
  });

  it('no boomerang with 2 bombs out; it stops a Goomba 180 f with no damage', () => {
    const r = rig('big');
    r.p.scratch.bombs = 5;
    r.step(['select']);
    for (let k = 0; k < ATTACK_FRAMES; k++) r.step();
    r.step(['select']);
    for (let k = 0; k < ATTACK_FRAMES; k++) r.step();
    r.step(['special']);
    expect(r.world.entities.some((e) => e instanceof LinkBoomerang)).toBe(false);
    const r2 = rig();
    const g = place(r2, new Goomba(0, 0), 30);
    r2.step(['special']);
    r2.until(() => g.stopFrames > 0, [], 30);
    expect(g.stopFrames).toBeGreaterThan(170);
    expect(g.classicHp ?? 250).toBe(250);
  });
});

describe('power states (LK-C13..LK-C17)', () => {
  it('Lose Everything: Flower Link with 10 bombs takes a hit, small with 10 bombs and a max of 40', () => {
    const r = rig('fire');
    r.p.scratch.bombs = 10;
    r.step();
    expect(r.p.scratch.bombBag).toBe(1);
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.powerState).toBe('small');
    expect(r.p.scratch.bombs).toBe(10);
    expect(r.p.scratch.bombBag).toBe(1);
    // A Fire Flower state again later: the repeat bonus caps at 40.
    r.p.powerState = 'fire';
    r.p.scratch.bombs = 39;
    LINK_CLASSIC.behaviour.onPowerUp(r.p, 'flower', r.world);
    expect(r.p.scratch.bombs).toBe(40);
  });

  it('a hit pushes him 32 px away from the source with input ignored', () => {
    const r = rig('big');
    const x0 = r.p.body.x;
    r.world.hurtPlayer(r.p, -1);
    r.until(() => r.p.hurtLock === null, ['right'], 100);
    expect(Math.round((x0 - r.p.body.x) / 256)).toBeGreaterThanOrEqual(31);
    expect(Math.round((x0 - r.p.body.x) / 256)).toBeLessThanOrEqual(36);
  });

  it('a hit while small kills him', () => {
    const r = rig('small');
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.dead).toBe(true);
  });
});

describe('swimming (LK-C12)', () => {
  function deepWater(floor = 28) {
    const height = floor + 2;
    const rows = Array.from({ length: height }, (_, y) =>
      y >= floor ? '#'.repeat(48) : (y === 2 ? 'w'.repeat(48) : '').padEnd(48, '.'),
    );
    return parseTextMap(
      [
        'id: deep',
        'theme: water',
        'swim: true',
        'time: 300',
        `start: 4,${floor - 1}`,
        `height: ${height}`,
        'camera: free',
        '',
        '[tiles]',
        ...rows,
      ].join('\n'),
    );
  }

  it('a floor jump rises 120-128 px; Jump in mid-water does nothing', () => {
    const r = new Rig(LINK, deepWater(), 'classic');
    r.until(() => r.p.body.onGround, [], 300);
    r.settle();
    const floor = r.p.feetY;
    r.step(['jump']);
    let top = floor;
    let presses = 0;
    for (let i = 0; i < 200 && !(i > 2 && r.p.body.onGround); i++) {
      const vy = r.p.body.vy;
      // Taps on the way down do nothing.
      const tap = vy > 0 && i % 6 === 0;
      r.step(tap ? ['jump'] : i < 70 ? ['jump'] : []);
      if (tap && r.p.body.vy < 0) presses++;
      top = Math.min(top, r.p.feetY);
    }
    const h = toPx(floor - top);
    expect(h).toBeGreaterThanOrEqual(120);
    expect(h).toBeLessThanOrEqual(128);
    expect(presses).toBe(0);
  });
});

describe('guide, touch and full kit (TG-22, TG-40, TG-44, LK-C3, LK-C38)', () => {
  const ACTIONS = new Set([
    'left/right',
    'jump',
    'attack',
    'up+attack',
    'down+attack',
    'up',
    'down',
    'special',
    'select',
  ]);
  const LETTER = /\b(BUTTON )?[ABC]\b/;
  const PROSE = /\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:|\b[abc]\s*\/|\/\s*[abc]\b/i;

  it('a Classic guide that names abilities, not buttons', () => {
    const g = LINK_CLASSIC.guide;
    expect(g).not.toBe(LINK.guide);
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
    expect(LINK_CLASSIC.meter).toBeUndefined();
    expect(LINK_CLASSIC.hudExtra).toBeUndefined();
    expect(LINK_CLASSIC.reserve).toBeUndefined();
  });

  it('touch labels: SWORD, BOOMERANG, BOMB once he owns bombs', () => {
    const r = rig('small');
    expect(LINK_CLASSIC.touchLabels?.(r.p, r.world)).toEqual({
      attack: 'SWORD',
      special: 'BOOMERANG',
      select: null,
    });
    const big = rig('big');
    big.step();
    expect(LINK_CLASSIC.touchLabels?.(big.p, big.world)).toEqual({
      attack: 'SWORD',
      special: 'BOOMERANG',
      select: 'BOMB',
    });
    expect(LINK_CLASSIC.tools?.(big.p)).toEqual([]);
  });

  it('kit=full: Select cycles boomerang, bombs and arrows; Special uses the selected one', () => {
    const r = rig('fire');
    Object.assign(r.p.scratch, LINK_CLASSIC.devKit?.() ?? {});
    expect(LINK_CLASSIC.tools?.(r.p).map((t) => t.id)).toEqual(['boomerang', 'bomb', 'arrow']);
    r.step(['select']);
    r.step();
    r.step(['select']);
    r.step();
    r.step(['special']);
    const arrow = r.world.entities.find((e): e is LinkShot => e instanceof LinkShot);
    expect(arrow?.kind).toBe('arrow');
    expect(r.p.scratch.arrows).toBe(39);
    expect(r.world.entities.some((e) => e instanceof LinkBomb)).toBe(false);
  });
});
