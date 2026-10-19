import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { ScriptedInput } from '@game/sim/headless';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import type { CharacterDef } from '@game/characters/character';
import { T } from '@game/level/tiles';
import { MARIO } from '@game/characters/mario';
import { MARIO_PROFILE } from '@game/characters/mario/profile';
import { MARIO_CLASSIC } from '@game/characters/mario/classic';
import { LUIGI_CLASSIC } from '@game/characters/luigi/classic';
import { LINK } from '@game/characters/link';
import { ATTACK_FRAMES, LINK_CLASSIC, SWORD_DAMAGE } from '@game/characters/link/classic';
import {
  BLAST_DAMAGE,
  LINK_ARROW,
  LINK_BEAM,
  LinkBomb,
  LinkBoomerang,
} from '@game/characters/link/classic-weapons';
import { MEGAMAN } from '@game/characters/megaman';
import { MEGAMAN_CLASSIC } from '@game/characters/megaman/classic';
import { Bowser } from '@game/entities/enemies/bowser';
import { Goomba } from '@game/entities/enemies/goomba';
import { Spring } from '@game/entities/objects/spring';
import type { Enemy } from '@game/entities/enemies/enemy';
import type { DamageSource } from '@game/rules/damage';
import { flatLevel, Rig } from './classic-plumber-harness';

// Requirement checks for hero rules part 1 that the slices' own files left untagged (QA, PR 3):
// ML-C24, ML-C27; LK-C2, C11, C21, C27, C34, C39, C40, C42, C43, C44; MM-C12, C32, C34, C35.

const FLOOR = px(13 * 16);

function rig(def: CharacterDef, power = 'small', rows: Record<number, string> = {}): Rig {
  const r = new Rig(def, flatLevel(rows), 'classic', power);
  r.settle();
  return r;
}

/** The highest the feet get above the floor after dropping onto a spring at column 8. */
function springRise(def: CharacterDef, rules: 'classic' | 'current'): number {
  const r = new Rig(def, flatLevel(), rules, def.damage.kind === 'hp' ? 'full' : 'small');
  r.settle();
  r.world.spawn(new Spring(8, 12));
  r.p.body.x = px(8 * 16 + 2);
  r.p.body.y = px(6 * 16);
  r.p.body.vy = 0;
  let top = FLOOR;
  let rose = false;
  for (let i = 0; i < 160; i++) {
    r.step();
    // The first launch's apex only.
    if (r.p.launched) rose = true;
    else if (rose) break;
    if (rose) top = Math.min(top, r.p.feetY);
  }
  return (FLOOR - top) / 256;
}

/** Hits `e` until it dies (stop and invulnerability cleared between hits); the count. */
function hitsToKill(e: Enemy, world: World, src: () => DamageSource): number {
  let n = 0;
  while (e.alive && n < 40) {
    e.invulnFrames = 0;
    e.stopFrames = 0;
    e.hit(src(), world);
    n++;
  }
  return n;
}

describe('Mario and Luigi (ML-C24, ML-C27)', () => {
  it('ML-C24: a big head breaks a brick, a small head bumps it', () => {
    for (const [power, broken] of [
      ['big', true],
      ['small', false],
    ] as const) {
      const r = rig(MARIO, power, { 9: '......=' });
      r.p.body.x = px(6 * 16 + 2);
      for (let i = 0; i < 40; i++) r.step(['jump']);
      expect(r.world.map.get(6, 9) !== T.BRICK, power).toBe(broken);
    }
  });

  it('ML-C27: gap crossing and the rest stay as in Current', () => {
    for (const d of [MARIO_CLASSIC, LUIGI_CLASSIC]) {
      expect(d.movement.crossGapMinVx).toBe(MARIO_PROFILE.crossGapMinVx);
      expect(d.canBreakBricks).toBeDefined();
    }
  });
});

describe('Classic Link (LK-C2, C11, C21, C27, C34, C39, C40, C42, C43, C44)', () => {
  it('LK-C2: no hearts, meter, magic, shield block, crouch or belt (outside the dev full kit)', () => {
    expect(LINK_CLASSIC.damage.kind).toBe('powerup');
    expect(LINK_CLASSIC.meter).toBeUndefined();
    expect(LINK_CLASSIC.crouches).toBe(false);
    expect(LINK_CLASSIC.behaviour.blocks).toBeUndefined();
    const r = rig(LINK, 'fire');
    expect(LINK_CLASSIC.tools?.(r.p)).toEqual([]);
    r.step(['down']);
    expect(r.p.crouching).toBe(false);
  });

  it('LK-C11, MM-C12: springs throw the Classic heroes as high as the Current ones', () => {
    for (const base of [LINK, MEGAMAN]) {
      const cur = springRise(base, 'current');
      const cl = springRise(base, 'classic');
      expect(cl, base.id).toBeGreaterThan(40);
      expect(cl, base.id).toBe(cur);
    }
  });

  it('LK-C21: the tunic is green, blue or red by power state', () => {
    for (const [power, palette] of [
      ['small', 'link'],
      ['big', 'link-blue'],
      ['fire', 'link-red'],
    ] as const) {
      const r = rig(LINK, power);
      expect(LINK_CLASSIC.sprite(r.p, 0, true).palette, power).toBe(palette);
    }
  });

  it('LK-C27, MM-C34: no stomp, landing on a Goomba hurts', () => {
    for (const base of [LINK, MEGAMAN]) {
      const r = rig(base, 'big');
      const g = new Goomba(0, 0);
      g.body.x = r.p.body.x;
      g.body.y = FLOOR - g.body.h;
      r.world.spawn(g);
      r.p.body.y = px(9 * 16);
      r.p.body.vy = 0;
      r.until(() => r.p.powerState === 'small' || !g.alive, [], 80);
      expect(r.p.def.stomps, base.id).toBe(false);
      expect(r.p.powerState, base.id).toBe('small');
      expect(g.alive, base.id).toBe(true);
    }
  });

  it('LK-C34: the boomerang stops Bowser never, and touches him once a throw', () => {
    const r = rig(LINK);
    const bw = new Bowser(9, 11, 'fire');
    r.world.spawn(bw);
    bw.body.x = r.p.centerX + px(30);
    r.step(['special']);
    const bm = r.world.entities.find((e): e is LinkBoomerang => e instanceof LinkBoomerang);
    expect(bm).toBeDefined();
    let stopped = 0;
    for (let i = 0; i < 60; i++) {
      bw.body.x = r.p.centerX + px(30);
      r.step();
      stopped = Math.max(stopped, bw.stopFrames, bw.frozen);
    }
    expect(stopped).toBe(0);
    expect(bw.classicHp ?? 2400).toBe(2400);
  });

  it('LK-C39: the shield blocks nothing and there is no block pose', () => {
    const r = rig(LINK);
    expect(LINK_CLASSIC.behaviour.blocks).toBeUndefined();
    expect(LINK_CLASSIC.sprite(r.p, 0, true).frame).toBe('idle');
  });

  it('LK-C40: a Mushroom or Flower freezes 60 frames with the plain pose; a Star does not', () => {
    const r = rig(LINK);
    r.world.powerUp(r.p, 'mushroom');
    expect(r.p.transition?.kind).toBe('freeze');
    expect(r.p.transition?.len).toBe(61);
    expect(LINK_CLASSIC.sprite(r.p, 0, true).frame).toBe('idle');
    r.until(() => r.p.transition === null, [], 100);
    r.world.powerUp(r.p, 'star');
    expect(r.p.transition).toBeNull();
  });

  it('LK-C42: fire Bowser (2400) takes 12 / 9 / 6 stabs, 12 beams, 3 bombs, 7 arrows', () => {
    const r = rig(LINK);
    const bowser = () => {
      const b = new Bowser(20, 11, 'fire');
      r.world.spawn(b);
      return b;
    };
    for (const [power, n] of [
      ['small', 12],
      ['big', 9],
      ['fire', 6],
    ] as const) {
      r.p.powerState = power;
      const src = () => LINK_CLASSIC.behaviour.meleeDamage?.(r.p, bowser()) as DamageSource;
      expect(src().amount).toBe(SWORD_DAMAGE[power]);
      expect(hitsToKill(bowser(), r.world, src), power).toBe(n);
    }
    const shot =
      (amount: number, extra = {}) =>
      () => ({
        kind: 'sword' as const,
        amount,
        owner: r.p,
        dirX: 1 as const,
        ...LINK_BEAM.classicHit,
        ...extra,
      });
    expect(hitsToKill(bowser(), r.world, shot(LINK_BEAM.amount))).toBe(12);
    expect(hitsToKill(bowser(), r.world, shot(BLAST_DAMAGE, { pierce: 10 }))).toBe(3);
    expect(hitsToKill(bowser(), r.world, shot(LINK_ARROW.amount))).toBe(7);
  });

  it('LK-C43: on a vine no stab, boomerang or bomb', () => {
    const r = rig(LINK, 'big');
    const b = r.p.body;
    r.p.vine = { x: b.x + (b.w >> 1), top: 0, bottom: 200 };
    b.y -= px(16);
    for (const a of ['attack', 'special', 'select'] as const) {
      r.step([a]);
      r.step([]);
    }
    expect(r.p.attackTimer).toBe(0);
    expect(r.p.activeMelee).toBeNull();
    expect(r.world.entities.some((e) => e instanceof LinkBoomerang || e instanceof LinkBomb)).toBe(false);
  });
});

describe('two Classic Links (LK-C44)', () => {
  function coop(): { world: World; step: (a: Action[], b: Action[]) => void } {
    const state = { ...newGameState(LINK, LINK, 'classic'), powerState: 'big', powerState2: 'big' };
    const world = new World(
      flatLevel(),
      {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST },
        reduceFlashing: true,
        rules: 'classic',
      },
      state,
      { seed: 1 },
    );
    const i1 = new ScriptedInput({ steps: [] });
    const i2 = new ScriptedInput({ steps: [] });
    const step = (a: Action[], b: Action[]) => {
      i1.setHeld(a);
      i2.setHeld(b);
      i1.next();
      i2.next();
      world.update([i1, i2]);
    };
    for (let i = 0; i < 10; i++) step([], []);
    return { world, step };
  }

  it('each player has his own boomerang and bombs; a bomb never hurts the partner', () => {
    const { world, step } = coop();
    const [p1, p2] = world.players;
    expect(p1?.def).toBe(LINK_CLASSIC);
    expect(p2?.def).toBe(LINK_CLASSIC);
    if (!p1 || !p2) return;
    // One boomerang each.
    step(['special'], ['special']);
    const owners = world.entities
      .filter((e): e is LinkBoomerang => e instanceof LinkBoomerang)
      .map((e) => e.owner);
    expect(owners).toContain(p1);
    expect(owners).toContain(p2);
    for (let i = 0; i < 200; i++) step([], []);
    // Three bombs each, the partner standing in every blast.
    p1.scratch.bombs = 5;
    p2.scratch.bombs = 5;
    for (let n = 0; n < 4; n++) {
      step(['select'], n < 3 ? [] : ['select']);
      for (let k = 0; k < ATTACK_FRAMES; k++) step([], []);
    }
    const bombs = world.entities.filter((e): e is LinkBomb => e instanceof LinkBomb && e.alive);
    expect(bombs.filter((b) => b.owner === p1)).toHaveLength(3);
    expect(bombs.filter((b) => b.owner === p2)).toHaveLength(1);
    expect(p1.scratch.bombs).toBe(2);
    expect(p2.scratch.bombs).toBe(4);
    for (let i = 0; i < 120; i++) {
      p2.body.x = p1.body.x;
      step([], []);
    }
    expect(p2.powerState).toBe('big');
    expect(p1.powerState).toBe('big');
    expect(p2.dead || p1.dead).toBe(false);
  });
});

describe('Classic Mega Man (MM-C32, MM-C35)', () => {
  it('MM-C32: no Energy Balancer, no reserve, no belt without the dev kit', () => {
    expect(MEGAMAN_CLASSIC.reserve).toBeUndefined();
    const r = rig(MEGAMAN, 'fire');
    expect(MEGAMAN_CLASSIC.tools?.(r.p) ?? []).toEqual([]);
  });

  it('the weapon energy bar has a dark backing (it sits on castle ceilings); Current meters none', () => {
    const r = rig(MEGAMAN, 'fire');
    expect(MEGAMAN_CLASSIC.meter?.(r.p)?.backing).toBe(true);
    const cur = new Rig(LINK, flatLevel(), 'current', 'full');
    expect(LINK.meter?.(cur.p)?.backing).toBeUndefined();
  });

  it('MM-C35: gaining the Flower clears nothing from the screen', () => {
    const r = rig(MEGAMAN);
    const g = new Goomba(0, 0);
    g.body.x = r.p.centerX + px(80);
    g.body.y = FLOOR - g.body.h;
    r.world.spawn(g);
    r.world.powerUp(r.p, 'mushroom');
    r.until(() => r.p.transition === null, [], 100);
    r.world.powerUp(r.p, 'flower');
    r.until(() => r.p.transition === null, [], 100);
    expect(r.p.powerState).toBe('fire');
    expect(g.alive).toBe(true);
  });
});
