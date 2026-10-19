import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { CLASSIC_CHARACTERS, heroFor } from '@game/characters/registry';
import { CHARACTERS } from '@game/characters/registry';
import { SAMUS } from '@game/characters/samus';
import { SAMUS_CLASSIC } from '@game/characters/samus/classic';
import { SIMON } from '@game/characters/simon';
import { RYU } from '@game/characters/ryu';
import { RYU_CLASSIC } from '@game/characters/ryu/classic';
import { CLASSIC_SHURIKEN, CLASSIC_WINDMILL } from '@game/characters/ryu/classic-weapons';
import { SOPHIA } from '@game/characters/sophia';
import { SOPHIA_CLASSIC } from '@game/characters/sophia/classic';
import { frozenLook, type Enemy } from '@game/entities/enemies/enemy';
import { Goomba } from '@game/entities/enemies/goomba';
import { Bowser } from '@game/entities/enemies/bowser';
import { Projectile } from '@game/entities/projectiles/projectile';
import { classicMaxHp, CLASSIC_HP } from '@game/rules/classic-enemies';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { T } from '@game/level/tiles';
import { SPRITES } from '@content/sprites';
import { Rig, flatLevel } from './classic-plumber-harness';

// Requirement IDs of PR 4 (Samus SA-C, Simon SI-C, Ryu RY-C, Sophia III SO-) that were built in
// the hero slices without a test naming them; each case cites its ID. The hero files hold the rest.
// Sophia III IDs met by tests in classic-sophia.test.ts: SO-15 (ceiling: "a jump under a ceiling
// grips it without a bump; with down held it bumps the block"), SO-46 and SO-47 (the level-data and
// wide-variant cases, SO-45..SO-48), SO-57..SO-61 (the build phases: that whole file). Not built:
// SO-38 (wrapping onto a moving lift's sides and underside) and SO-39 (the camera's turn easing).

const settled = (def: typeof SAMUS, power = 'small', rows: Record<number, string> = {}): Rig => {
  const r = new Rig(def, flatLevel(rows), 'classic', power);
  r.settle();
  return r;
};
const place = <E extends Enemy>(r: Rig, e: E, xPx: number): E => {
  e.body.x = px(xPx);
  e.body.y = px(208) - e.body.h;
  e.activated = true;
  r.world.spawn(e);
  return e;
};

describe('Classic Samus IDs', () => {
  it('SA-C2: no tool belt without the dev kit; Attack shoots and Special fires missiles', () => {
    const r = settled(SAMUS, 'big');
    expect(SAMUS_CLASSIC.tools?.(r.p)).toEqual([]);
    expect(SAMUS_CLASSIC.touchLabels?.(r.p, r.world)).toMatchObject({ attack: 'SHOOT', select: null });
  });

  it('SA-C11 / TG-44: with the dev kit the beam icon carries the missile count', () => {
    const r = settled(SAMUS, 'fire');
    Object.assign(r.p.scratch, SAMUS_CLASSIC.devKit?.());
    r.p.scratch.missiles = 42;
    expect(SAMUS_CLASSIC.tools?.(r.p).map((t) => t.count)).toEqual([42, 42]);
  });

  it('SA-C9: springs keep her own green boost and rise gravity (keyed by her id)', () => {
    expect(SAMUS_CLASSIC.id).toBe(SAMUS.id);
  });

  it('SA-C16: the Flower only recolours her (Varia); fire bars still hurt; Star missiles are free', () => {
    const r = settled(SAMUS, 'fire', {});
    r.p.scratch.missileUp = 1;
    r.p.scratch.missiles = 3;
    expect(SAMUS_CLASSIC.sprite(r.p, 0, true).palette).toBe('samus-varia');
    r.p.star = 300;
    r.step(['special']);
    expect(r.p.scratch.missiles).toBe(3);
    r.p.star = 0;
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.powerState).toBe('small');
  });

  it('SA-C21: a frozen enemy shows the frozen colour, flashing from frame 285, steady with Reduce flashing', () => {
    expect(frozenLook(0, false)).toBe(false);
    expect(frozenLook(360, false)).toBe(true);
    expect(frozenLook(76, false)).toBe(true);
    const flash = Array.from({ length: 75 }, (_, i) => frozenLook(75 - i, false));
    expect(flash.some((x) => !x)).toBe(true);
    expect(flash.slice(0, 2)).toEqual([true, true]);
    for (let f = 1; f <= 75; f++) expect(frozenLook(f, true)).toBe(true);
    const r = settled(SAMUS, 'fire');
    const g = place(r, new Goomba(0, 0), 140);
    const view = { reduceFlashing: true, frame: 0, theme: r.world.level.theme } as never;
    const own = g.drawPalette(view);
    g.frozen = 200;
    expect(g.drawPalette(view)).toBe(`${own}~frozen`);
  });

  it('SA-C30: she cannot stomp: landing on a Goomba hurts her', () => {
    const r = settled(SAMUS, 'big');
    const g = place(r, new Goomba(0, 0), 96);
    g.update = () => {};
    r.p.body.y = g.body.y - r.p.body.h - px(4);
    r.p.body.onGround = false;
    for (let i = 0; i < 40 && r.p.powerState === 'big'; i++) r.step([]);
    expect(SAMUS_CLASSIC.stomps).toBe(false);
    expect(r.p.powerState).toBe('small');
    expect(g.alive).toBe(true);
  });

  it('SA-C33: two Classic Samuses, each with her own shot cap', () => {
    const state = { ...newGameState(SAMUS, SAMUS, 'classic'), powerState: 'big', powerState2: 'big' };
    const w = new World(
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
    const [a, b] = w.players;
    expect(a?.def).toBe(SAMUS_CLASSIC);
    expect(b?.def).toBe(SAMUS_CLASSIC);
    const press = (p: number) => {
      const inputs = [0, 1].map((i) => ({
        held: () => false,
        pressed: (x: string) => i === p && x === 'attack',
        released: () => false,
        dirX: 0,
        bufferedJump: () => false,
        consumeJumpBuffer: () => {},
      }));
      w.update(inputs as never);
      w.update([0, 1].map(() => ({ ...inputs[0], pressed: () => false })) as never);
    };
    for (let i = 0; i < 3; i++) press(0);
    press(1);
    const own = (p: unknown) =>
      w.entities.filter((e) => e instanceof Projectile && e.alive && e.owner === p).length;
    expect(own(a)).toBe(3);
    expect(own(b)).toBe(1);
  });
});

describe('Classic Simon IDs', () => {
  it('SI-C8: a ceiling ends the rise at once and a brick only bumps', () => {
    const r = settled(SIMON, 'big', { 9: '......=' });
    r.step(['jump']);
    let bumped = false;
    for (let i = 0; i < 40; i++) {
      r.step(['jump']);
      if (r.p.body.hitHead) {
        bumped = true;
        expect(r.p.body.vy).toBeGreaterThanOrEqual(0);
      }
    }
    expect(bumped).toBe(true);
    expect(r.world.map.get(6, 9)).toBe(T.BRICK);
  });
});

describe('Classic Ryu IDs', () => {
  it('RY-C8: springs keep his values (keyed by his id); RY-C9: he cannot stomp', () => {
    expect(RYU_CLASSIC.id).toBe(RYU.id);
    expect(RYU_CLASSIC.stomps).toBe(false);
  });

  it('RY-C20: a hit when powered takes the Flower and Mushroom, keeps ninpo and the Scroll; small dies', () => {
    const r = settled(RYU, 'fire');
    r.p.scratch.ninpo = 40;
    r.p.scratch.scroll = 1;
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.powerState).toBe('small');
    expect(r.p.scratch.ninpo).toBe(40);
    expect(r.p.scratch.scroll).toBe(1);
    r.until(() => r.p.hurtLock === null && r.p.invuln === 0, [], 300);
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.dead).toBe(true);
  });

  it('RY-C33: his shots have no gravity and pass solid ground', () => {
    for (const s of [CLASSIC_SHURIKEN, CLASSIC_WINDMILL]) {
      expect(s.gravity).toBe(0);
      expect(s.classicBlocks?.ground).not.toBe('collide');
    }
  });
});

describe('Classic Sophia III IDs', () => {
  it('SO-4: her name, slot and portrait are the Current hero’s', () => {
    expect(heroFor(SOPHIA, 'classic')).toBe(SOPHIA_CLASSIC);
    expect(CHARACTERS.indexOf(SOPHIA)).toBe(8);
    expect([SOPHIA_CLASSIC.name, SOPHIA_CLASSIC.hudName, SOPHIA_CLASSIC.portrait]).toEqual([
      SOPHIA.name,
      SOPHIA.hudName,
      SOPHIA.portrait,
    ]);
  });

  it('SO-7: each control has a guide row and the touch buttons name abilities', () => {
    const g = SOPHIA_CLASSIC.guide;
    for (const a of ['left/right', 'jump', 'attack'])
      expect(g.controls.some((c) => c.action === a)).toBe(true);
    expect(SOPHIA_CLASSIC.touchLabels).toBeDefined();
  });

  it('SO-16: springs keep her green boost and rise gravity (keyed by her id)', () => {
    expect(SOPHIA_CLASSIC.id).toBe('sophia');
  });

  it('SO-40: no other abilities: no Jason, no reserve item', () => {
    expect(SOPHIA_CLASSIC.reserve).toBeUndefined();
    expect(SOPHIA_CLASSIC.hudExtra).toBeUndefined();
  });

  it('SO-44: Bowser has his non-Mario HP against her', () => {
    const r = settled(SOPHIA);
    const b = new Bowser(20, 11);
    expect(classicMaxHp(b, r.world)).toBe(CLASSIC_HP['bowser-fire']);
  });

  it('SO-49: no other hero gets level flags', () => {
    for (const d of Object.values(CLASSIC_CHARACTERS))
      if (d && d.id !== 'sophia') expect(d.levelFlags, d.id).toBeUndefined();
    for (const d of CHARACTERS) expect(d.levelFlags, d.id).toBeUndefined();
  });

  it('SO-52, SO-53: her Classic art and palettes are built in (sheets drawn from text)', () => {
    expect(SPRITES[SOPHIA_CLASSIC.portrait.sheet]).toBeDefined();
  });
});
