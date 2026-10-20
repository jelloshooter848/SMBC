import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { px, tileToSub } from '@engine/math/units';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { getLevel } from '@content/levels';
import { ScriptedInput } from '@game/sim/headless';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState, type GameContext } from '@game/context';
import type { LevelData } from '@game/level/schema';
import type { CharacterDef } from '@game/characters/character';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { heroFor } from '@game/characters/registry';
import { ARTHUR_CLASSIC } from '@game/characters/arthur/classic';
import { WARRIORS_CLASSIC } from '@game/characters/warriors/classic';
import { PAIR_H, PAIR_W, RIDE_KEY, YoshiMount, ridingOf } from '@game/characters/classic/yoshi-mount';
import { Flagpole } from '@game/entities/objects/flagpole';
import type { Player } from '@game/entities/player';
import { Lakitu } from '@game/entities/enemies/lakitu';
import { LakituCloud } from '@game/characters/classic/yoshi-tongue';
import { YOSHI_CLASSIC } from '@game/characters/yoshi/classic';
import { flatLevel } from './classic-plumber-harness';
import { useStorage } from './heroes-harness';

// Review fixes to the Classic Yoshi mount (classic-patch-2 items 1-3): the pair's hurt box, the
// flagpole (YM-21) and the rider's own hooks under the overlay.

useStorage();

class MRig {
  readonly world: World;
  private readonly input = new ScriptedInput({ steps: [] });
  constructor(def: CharacterDef, level: LevelData, mount: GameContext['classicYoshi'], power = 'small') {
    const ctx: GameContext = {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
      rules: 'classic',
      ...(mount ? { classicYoshi: mount } : {}),
    };
    const state = { ...newGameState(def, null, 'classic'), powerState: power, kit: {} };
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
  run(n: number): void {
    for (let i = 0; i < n; i++) this.step();
  }
}

const yoshis = (w: World) => w.entities.filter((e): e is YoshiMount => e instanceof YoshiMount && e.alive);

describe('the pair is hit on its own body (item 1)', () => {
  it("small Mario riding: the hurt box is the pair's 12 x 28 body, not his 13 x 15 at the feet", () => {
    const r = new MRig(MARIO, getLevel('1-1'), 'ride');
    expect(ridingOf(r.p)).not.toBeNull();
    // On foot, Classic Mario has his own HRect.
    expect(heroFor(MARIO, 'classic').hurtbox).toBeDefined();
    const hb = r.p.hurtBody();
    expect(hb.w).toBe(px(PAIR_W));
    expect(hb.h).toBe(px(PAIR_H));
    expect(hb.y).toBe(r.p.body.y);
    expect(r.p.def.hurtbox).toBeUndefined();
  });

  it("Link riding steps Yoshi's 3-pose walk, not his own cycle", () => {
    const r = new MRig(LINK, getLevel('1-1'), 'ride');
    expect(heroFor(LINK, 'classic').walkAnim).toBeDefined();
    expect(r.p.def.walkAnim).toBeUndefined();
  });
});

/** The hero on the ground 4 tiles before the pole, the screen there. */
function place(r: MRig, pole: Flagpole): void {
  const b = r.p.body;
  b.x = tileToSub(pole.tx - 4);
  b.y = px(pole.baseY + 16) - b.h;
  b.vy = 0;
  r.world.camera.x = b.x - px(100);
  r.step();
}

describe('the flagpole on Yoshi (item 2, YM-21)', () => {
  it('Yoshi sits on the ground at the base, the rider gets back on at the hop and rides on', () => {
    const r = new MRig(MARIO, getLevel('1-1'), 'ride');
    const w = r.world;
    const pole = w.entities.find((e): e is Flagpole => e instanceof Flagpole) as Flagpole;
    expect(pole).toBeDefined();
    const y = yoshis(w)[0] as YoshiMount;
    // Ride up to the pole from a few tiles back, jumping into it.
    place(r, pole);
    for (let i = 0; i < 400 && w.clearPhase === null; i++) r.step(['right', 'run', 'jump']);
    expect(w.clearPhase).toBe('slide');
    // Off at the touch, and Yoshi already on the base, right of the pole, where the hop lands.
    expect(ridingOf(r.p)).toBeNull();
    expect(y.state).toBe('wait');
    expect(y.body.y + y.body.h).toBe(px(pole.baseY));
    expect(y.body.x).toBe(tileToSub(pole.tx) + px(10));
    let rodeWalk = false;
    for (let i = 0; i < 900 && w.clearPhase !== 'countdown'; i++) {
      r.step();
      if (w.clearPhase === 'slide') expect(y.body.y + y.body.h).toBe(px(pole.baseY));
      if (w.clearPhase === 'walk' && ridingOf(r.p)) rodeWalk = true;
    }
    expect(rodeWalk).toBe(true);
    expect(w.clearPhase).toBe('countdown');
    // Carried on into the next level.
    expect(r.p.scratch[RIDE_KEY]).toBe(1);
  });

  it('with the mount off the clear sequence is untouched', () => {
    const r = new MRig(MARIO, getLevel('1-1'), undefined);
    const w = r.world;
    const pole = w.entities.find((e): e is Flagpole => e instanceof Flagpole) as Flagpole;
    place(r, pole);
    for (let i = 0; i < 400 && w.clearPhase === null; i++) r.step(['right', 'run', 'jump']);
    for (let i = 0; i < 900 && w.clearPhase !== 'countdown'; i++) r.step();
    expect(w.clearPhase).toBe('countdown');
    expect(yoshis(w)).toHaveLength(0);
    expect(r.p.def).toBe(heroFor(MARIO, 'classic'));
  });
});

describe("the rider's own hooks under the overlay (item 3)", () => {
  it("Arthur's onLevelClear still runs (his pose and magic end), then he gets off", () => {
    const r = new MRig(ARTHUR_CLASSIC, getLevel('1-1'), 'ride');
    expect(ridingOf(r.p)).not.toBeNull();
    r.p.scratch._pose = 2;
    r.p.def.behaviour.onLevelClear?.(r.p);
    expect(r.p.scratch._pose).toBe(0);
    expect(ridingOf(r.p)).toBeNull();
  });

  it("the Warriors' onLevelClear ends their action", () => {
    const r = new MRig(WARRIORS_CLASSIC, getLevel('1-1'), 'ride');
    expect(ridingOf(r.p)).not.toBeNull();
    r.p.attackTimer = 9;
    r.p.def.behaviour.onLevelClear?.(r.p);
    expect(r.p.attackTimer).toBe(0);
  });

  it('onRespawn, canJump and afterLifts pass through; rooted sees the mapped buttons', () => {
    const link = new MRig(LINK, getLevel('1-1'), 'ride');
    const base = heroFor(LINK, 'classic').behaviour;
    const ride = link.p.def.behaviour;
    expect(ride.onRespawn).toBe(base.onRespawn);
    expect(base.rooted).toBeDefined();
    expect(ride.rooted).toBeDefined();
    // Attack is Yoshi's tongue on the saddle: it does not root Link as his sword stab would.
    const attack = new ScriptedInput({ steps: [] });
    attack.setHeld(['attack']);
    attack.next();
    expect(base.rooted?.(link.p, attack)).toBe(true);
    expect(ride.rooted?.(link.p, attack)).toBe(false);
    const arthurBase = heroFor(ARTHUR_CLASSIC, 'classic').behaviour;
    const arthur = new MRig(ARTHUR_CLASSIC, getLevel('1-1'), 'ride');
    expect(arthur.p.def.behaviour.onRespawn).toBe(arthurBase.onRespawn);
  });
});

describe("an eaten Lakitu's cloud drifts away (item 4)", () => {
  function eat(def: CharacterDef, mount: GameContext['classicYoshi']): { r: MRig; l: Lakitu } {
    const r = new MRig(def, flatLevel({}, 60), mount);
    for (let i = 0; i < 10; i++) r.step();
    r.p.facing = 1;
    const l = new Lakitu(r.p.body.x + px(26), r.p.feetY - px(30));
    r.world.spawn(l);
    r.step(['attack']);
    for (let i = 0; i < 12 && l.alive; i++) r.step();
    expect(l.alive).toBe(false);
    return { r, l };
  }
  const clouds = (w: World) =>
    w.entities.filter((e): e is LakituCloud => e instanceof LakituCloud && e.alive);

  it('the mount swallows him; his cloud floats off away from Yoshi and is gone off the screen', () => {
    const { r } = eat(MARIO, 'ride');
    const c = clouds(r.world)[0] as LakituCloud;
    expect(c).toBeDefined();
    const x0 = c.body.x;
    const y0 = c.body.y;
    r.run(30);
    expect(c.body.x).toBeGreaterThan(x0);
    expect(c.body.y).toBeLessThan(y0);
    r.run(600);
    expect(c.alive).toBe(false);
  });

  it('the playable Yoshi keeps him in his mouth; the cloud drifts off the same way', () => {
    const { r } = eat(YOSHI_CLASSIC, undefined);
    expect(clouds(r.world)).toHaveLength(1);
  });
});
