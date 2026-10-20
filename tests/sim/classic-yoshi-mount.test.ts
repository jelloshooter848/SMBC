import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { px } from '@engine/math/units';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Settings } from '@engine/save/settings';
import { getLevel } from '@content/levels';
import { ScriptedInput } from '@game/sim/headless';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState, type GameContext } from '@game/context';
import type { LevelData } from '@game/level/schema';
import type { CharacterDef } from '@game/characters/character';
import { T } from '@game/level/tiles';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { SAMUS } from '@game/characters/samus';
import { SOPHIA } from '@game/characters/sophia';
import { heroFor } from '@game/characters/registry';
import { YOSHI_CLASSIC } from '@game/characters/yoshi/classic';
import { VICVIPER_CLASSIC } from '@game/characters/vicviper/classic';
import {
  FLEE_SPEED,
  HIT_INVULN,
  MountEgg,
  PAIR_H,
  RIDE_KEY,
  YoshiMount,
  eggBlockOf,
  mountArea,
  ridingOf,
} from '@game/characters/classic/yoshi-mount';
import { EGG_HATCH_FRAME, YoshiEgg } from '@game/entities/objects/yoshi-egg';
import { PowerUp } from '@game/entities/objects/powerup';
import { Projectile } from '@game/entities/projectiles/projectile';
import { Goomba } from '@game/entities/enemies/goomba';
import { Spiny } from '@game/entities/enemies/spiny';
import { Koopa } from '@game/entities/enemies/koopa';
import { mouthOf } from '@game/characters/classic/yoshi-tongue';
import type { Player } from '@game/entities/player';
import { flatLevel } from './classic-plumber-harness';
import { makeGame, useStorage } from './heroes-harness';

// The Classic Yoshi mount (bug-reports/2026-10-19-yoshi-build-classic-character.md, Part B,
// YM-1..YM-30): off by default changes nothing; on, the first power-up block of an allowed area
// hatches him, every rider rides by the hero table, a hit throws the rider off, castles, water and
// bonus areas keep him outside.

useStorage();

/** A World stepped by hand, with the mount `mount` (undefined: off). */
class MRig {
  readonly world: World;
  private readonly input = new ScriptedInput({ steps: [] });
  constructor(
    def: CharacterDef,
    level: LevelData,
    mount: GameContext['classicYoshi'],
    power = 'small',
    kit: Record<string, number> = {},
  ) {
    const ctx: GameContext = {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
      rules: 'classic',
      ...(mount ? { classicYoshi: mount } : {}),
    };
    const state = { ...newGameState(def, null, 'classic'), powerState: power, kit };
    this.world = new World(level, ctx, state, { seed: 1 });
  }
  get p(): Player {
    return this.world.player;
  }
  step(hold: Action[] = []): void {
    this.input.setHeld(hold);
    this.input.next();
    this.world.update([this.input]);
  }
  run(n: number, hold: Action[] = []): void {
    for (let i = 0; i < n; i++) this.step(hold);
  }
}

const eggs = (w: World) => w.entities.filter((e) => e instanceof YoshiEgg && e.alive);
const mounts = (w: World) => w.entities.filter((e): e is YoshiMount => e instanceof YoshiMount && e.alive);
const powerUps = (w: World) => w.entities.filter((e) => e instanceof PowerUp && e.alive);

/** A flat level with a power-up block at column 8, row 9 (a head bump from the floor). */
const blockLevel = () => flatLevel({ 9: '........M' });

/** Strikes (tx, ty) as `p`'s head would. */
function strike(r: MRig, tx: number, ty: number): void {
  r.world.strikeBlock(tx, ty, r.p, false);
}

/** Hatches the egg of the block at (8, 9) and puts the hero on Yoshi. */
function hatchAndRide(r: MRig): YoshiMount {
  strike(r, 8, 9);
  r.run(EGG_HATCH_FRAME + 2);
  const y = mounts(r.world)[0] as YoshiMount;
  expect(y).toBeDefined();
  // He steps off his block and drops to the floor, then waits.
  for (let i = 0; i < 200 && y.state !== 'wait'; i++) r.step();
  expect(y.state).toBe('wait');
  expect(y.body.y + y.body.h).toBe(px(208));
  // Drop the hero onto his back.
  r.p.body.x = y.body.x;
  r.p.body.y = y.body.y - px(40);
  r.p.body.onGround = false;
  for (let i = 0; i < 60 && !ridingOf(r.p); i++) r.step();
  expect(ridingOf(r.p)).not.toBeNull();
  r.run(3);
  return y;
}

describe('YM-1, YM-2: off by default, nothing changes', () => {
  it('a Classic run has no mount unless dev mode and the Dev menu toggle say so', () => {
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', LINK, 'small', false, 1, { rules: 'classic' });
    expect(h.game.yoshiMount).toBeUndefined();
    expect(h.game.ctx.classicYoshi).toBeUndefined();
    (h.game.deps.settings as Settings).classicDev = { yoshiMount: true, heroesOff: [] };
    expect(h.game.ctx.classicYoshi).toBe('on');
    // Dev mode off: the defaults (no mount), whatever is saved.
    (h.game.deps.settings as Settings).dev = false;
    expect(h.game.ctx.classicYoshi).toBeUndefined();
    // Current rules: never.
    (h.game.deps.settings as Settings).dev = true;
    h.game.devStart('1-1', LINK, 'small', false, 1, { rules: 'current' });
    expect(h.game.ctx.classicYoshi).toBeUndefined();
  });

  it('off: the first power-up block of 1-1 gives its Mushroom, no egg ever, no egg block', () => {
    const r = new MRig(LINK, getLevel('1-1'), undefined);
    expect(eggBlockOf(r.world)).toBeNull();
    const map = r.world.map;
    let at: [number, number] | null = null;
    for (let tx = 0; tx < r.world.level.width && !at; tx++)
      for (let ty = 0; ty < r.world.level.height; ty++)
        if (map.get(tx, ty) === T.Q_POWERUP) {
          at = [tx, ty];
          break;
        }
    expect(at).not.toBeNull();
    strike(r, ...(at as [number, number]));
    r.run(5);
    expect(eggs(r.world)).toHaveLength(0);
    expect(powerUps(r.world).length).toBeGreaterThan(0);
  });

  it('off: a whole Classic 1-1 start is frame-identical with a World that has the mount on but no blocks hit', () => {
    const a = new MRig(MARIO, getLevel('1-1'), undefined);
    const b = new MRig(MARIO, getLevel('1-1'), 'on');
    const script: Action[][] = Array.from({ length: 240 }, (_, i) =>
      i % 40 < 20 ? ['right'] : ['right', 'jump'],
    );
    for (const hold of script) {
      a.step(hold);
      b.step(hold);
    }
    // Same path until the first block (the hero passes under it without a bump here).
    expect(b.p.body.x).toBe(a.p.body.x);
    expect(b.world.state.score).toBe(a.world.state.score);
  });
});

describe('YM-4, YM-5: egg blocks', () => {
  it('on: 1-1 marks its first power-up block; Link bumps it and an egg hatches a waiting Yoshi', () => {
    const r = new MRig(LINK, getLevel('1-1'), 'on');
    const key = eggBlockOf(r.world);
    expect(key).not.toBeNull();
    const [tx, ty] = (key as string).split(',').map(Number) as [number, number];
    expect(getLevel('1-1').tiles[ty * getLevel('1-1').width + tx]).toBe(T.Q_POWERUP);
    strike(r, tx, ty);
    expect(r.world.entities.some((e) => e instanceof MountEgg)).toBe(true);
    expect(r.world.map.get(tx, ty)).not.toBe(T.Q_POWERUP);
    r.run(EGG_HATCH_FRAME + 2);
    expect(mounts(r.world)).toHaveLength(1);
    expect((mounts(r.world)[0] as YoshiMount).state).toBe('walk');
    expect(powerUps(r.world)).toHaveLength(0);
  });

  it('a second Yoshi never hatches while one is in play: the block gives its power-up', () => {
    const r = new MRig(LINK, blockLevel(), 'on');
    strike(r, 8, 9);
    r.run(EGG_HATCH_FRAME + 2);
    r.world.map.set(8, 9, T.Q_POWERUP);
    strike(r, 8, 9);
    r.run(3);
    expect(r.world.entities.filter((e) => e instanceof MountEgg && e.alive)).toHaveLength(0);
    expect(powerUps(r.world).length).toBeGreaterThan(0);
  });

  it('Sophia III, Vic Viper and Yoshi never ride: their egg block gives the power-up (YM-3)', () => {
    for (const def of [SOPHIA, VICVIPER_CLASSIC, YOSHI_CLASSIC]) {
      expect(heroFor(def, 'classic').rides).toBe(false);
      const r = new MRig(def, blockLevel(), 'on');
      strike(r, 8, 9);
      r.run(3);
      expect(eggs(r.world), def.id).toHaveLength(0);
    }
  });

  it('castles, water and bonus rooms are not allowed areas', () => {
    const area = (id: string) => mountArea(new MRig(MARIO, getLevel(id), 'on').world);
    expect(area('1-1')).toBe(true);
    expect(area('1-2')).toBe(true);
    expect(area('1-4')).toBe(false);
    expect(area('2-2')).toBe(false);
    expect(area('1-1-bonus')).toBe(false);
    expect(area('2-1-sky')).toBe(false);
    expect(eggBlockOf(new MRig(MARIO, getLevel('1-4'), 'on').world)).toBeNull();
  });
});

describe('YM-9..YM-16: riding', () => {
  it('landing on his back mounts: the overlay def, a 12 x 28 box, Yoshi drawn with the rider on his back', () => {
    const r = new MRig(LINK, blockLevel(), 'on');
    hatchAndRide(r);
    expect(r.p.body.h).toBe(px(PAIR_H));
    expect(r.p.def).not.toBe(heroFor(LINK, 'classic'));
    expect(r.p.scratch[RIDE_KEY]).toBe(1);
    const s = r.p.def.sprite(r.p, 0, true);
    expect(s.sheet).toBe('yoshi');
    expect(s.rider?.sheet).toBe(heroFor(LINK, 'classic').sprite(r.p, 0, true).sheet);
  });

  it('Link: Attack licks (no sword) and swallows a Goomba; Special throws the boomerang', () => {
    const r = new MRig(LINK, blockLevel(), 'on');
    hatchAndRide(r);
    r.p.facing = 1;
    const g = new Goomba(r.p.body.x + px(30), r.p.feetY - px(14));
    g.body.vx = 0;
    g.activated = true;
    r.world.spawn(g);
    r.step(['attack']);
    expect(r.p.activeMelee).toBeNull();
    for (let i = 0; i < 12 && g.alive; i++) r.step();
    expect(g.alive).toBe(false);
    r.run(20);
    r.step(['special']);
    r.run(2);
    expect(r.world.entities.some((e) => e instanceof Projectile && e.alive && e.owner === r.p)).toBe(true);
  });

  it('a Koopa is held as a shell: a green one is spat as a kicked shell, a red one as three fireballs', () => {
    for (const color of ['green', 'red'] as const) {
      const r = new MRig(MARIO, blockLevel(), 'on');
      hatchAndRide(r);
      r.p.facing = 1;
      const k = new Koopa(r.p.body.x + px(30), r.p.feetY - px(16), color);
      k.body.vx = 0;
      k.activated = true;
      r.world.spawn(k);
      r.step(['attack']);
      for (let i = 0; i < 30; i++) r.step();
      expect(k.alive).toBe(false);
      expect(mouthOf(r.p)?.shell).toBe(color);
      r.step(['attack']);
      if (color === 'green')
        expect(r.world.entities.some((e) => e instanceof Koopa && e.alive && e.isMovingShell)).toBe(true);
      else
        expect(
          r.world.entities.filter((e) => e instanceof Projectile && e.alive && e.kind === 'yoshi-fire'),
        ).toHaveLength(3);
      expect(mouthOf(r.p)).toBeNull();
    }
  });

  it('small Samus fires her beam on Special; small Mario has nothing there', () => {
    const s = new MRig(SAMUS, blockLevel(), 'on');
    hatchAndRide(s);
    s.step(['special']);
    s.run(2);
    expect(s.world.entities.some((e) => e instanceof Projectile && e.alive && e.owner === s.p)).toBe(true);
    const m = new MRig(MARIO, blockLevel(), 'on');
    hatchAndRide(m);
    m.step(['special']);
    m.run(2);
    expect(m.world.entities.some((e) => e instanceof Projectile && e.alive && e.owner === m.p)).toBe(false);
  });

  it('the pair stomps a Spiny (YM-11)', () => {
    const r = new MRig(MARIO, blockLevel(), 'on');
    hatchAndRide(r);
    const sp = new Spiny(r.p.body.x, r.p.feetY - px(14), false);
    sp.body.vx = 0;
    sp.activated = true;
    r.world.spawn(sp);
    r.p.body.y -= px(40);
    r.p.body.onGround = false;
    for (let i = 0; i < 40 && sp.alive; i++) r.step();
    expect(sp.alive).toBe(false);
    expect(ridingOf(r.p)).not.toBeNull();
  });
});

describe('YM-17..YM-19: losing him, getting off', () => {
  it('a hit as Fire Mario: power kept, thrown off, 120 frames invulnerable, Yoshi runs at 2 px/f', () => {
    const r = new MRig(MARIO, blockLevel(), 'on', 'fire');
    const y = hatchAndRide(r);
    r.world.hurtPlayer(r.p, 1);
    expect(ridingOf(r.p)).toBeNull();
    expect(r.p.powerState).toBe('fire');
    expect(r.p.invuln).toBe(HIT_INVULN);
    expect(r.p.body.vy).toBeLessThan(0);
    expect(r.p.scratch[RIDE_KEY]).toBeUndefined();
    const x0 = y.body.x;
    r.run(10);
    expect(y.state).toBe('flee');
    expect(Math.abs(y.body.x - x0)).toBeGreaterThanOrEqual(px(9 * (FLEE_SPEED / 4096)) - px(1));
    // He runs off the screen and is lost.
    r.run(300);
    expect(y.alive).toBe(false);
  });

  it('Down + Jump on the ground gets off: Yoshi sits and waits', () => {
    const r = new MRig(LINK, blockLevel(), 'on');
    const y = hatchAndRide(r);
    r.step(['down', 'jump']);
    expect(ridingOf(r.p)).toBeNull();
    expect(y.state).toBe('wait');
    expect(r.p.body.h).toBe(px(heroFor(LINK, 'classic').hitbox(r.p).h));
    // Straight up and back down onto his spot: he still waits, 120 frames on.
    r.run(120);
    expect(ridingOf(r.p)).toBeNull();
    expect(y.state).toBe('wait');
    // A real hop onto his back later gets back on.
    r.p.body.y = y.body.y - px(40);
    r.p.body.onGround = false;
    for (let i = 0; i < 60 && !ridingOf(r.p); i++) r.step();
    expect(ridingOf(r.p)).not.toBeNull();
  });
});

describe('YM-7: carry-over and benching', () => {
  it('a carried rider starts the next allowed area on Yoshi; a castle benches him; dying resets', () => {
    const on = new MRig(LINK, getLevel('1-2'), 'on', 'small', { [RIDE_KEY]: 1 });
    expect(ridingOf(on.p)).not.toBeNull();
    const castle = new MRig(LINK, getLevel('1-4'), 'on', 'small', { [RIDE_KEY]: 1 });
    expect(ridingOf(castle.p)).toBeNull();
    expect(castle.p.scratch[RIDE_KEY]).toBe(2);
    const water = new MRig(LINK, getLevel('2-2'), 'on', 'small', { [RIDE_KEY]: 1 });
    expect(water.p.scratch[RIDE_KEY]).toBe(2);
    const back = new MRig(LINK, getLevel('2-1'), 'on', 'small', { [RIDE_KEY]: 2 });
    expect(ridingOf(back.p)).not.toBeNull();
    expect(back.p.scratch[RIDE_KEY]).toBe(1);
    // A fresh life (no carried kit) starts on foot.
    expect(ridingOf(new MRig(LINK, getLevel('1-2'), 'on').p)).toBeNull();
  });

  it("'ride' starts every life mounted (a dev aid)", () => {
    expect(ridingOf(new MRig(MARIO, getLevel('1-1'), 'ride').p)).not.toBeNull();
    expect(ridingOf(new MRig(SOPHIA, getLevel('1-1'), 'ride').p)).toBeNull();
  });
});
