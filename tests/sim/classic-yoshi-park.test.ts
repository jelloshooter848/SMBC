import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { px, tileToSub } from '@engine/math/units';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { getLevel } from '@content/levels';
import { ScriptedInput } from '@game/sim/headless';
import { World, type WorldEvent } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState, type GameContext } from '@game/context';
import type { LevelData } from '@game/level/schema';
import type { CharacterDef } from '@game/characters/character';
import { MARIO } from '@game/characters/mario';
import { heroFor } from '@game/characters/registry';
import {
  PARK_HOP,
  RIDE_KEY,
  WAITS_SAID,
  YoshiMount,
  benchedLevel,
  ridingOf,
} from '@game/characters/classic/yoshi-mount';
import { Flagpole } from '@game/entities/objects/flagpole';
import type { Player } from '@game/entities/player';
import { flatLevel } from './classic-plumber-harness';
import { useStorage } from './heroes-harness';

/*
 * v0.4.74 item 74: the Classic Yoshi mount, Super Mario World style. Bound for a castle, water or
 * bonus area, the hero hops off and Yoshi waits at the way in (a pipe, or the castle after the
 * flagpole) instead of vanishing; coming back out into an allowed area he rejoins as before.
 */

useStorage();

class MRig {
  readonly world: World;
  readonly events: WorldEvent[] = [];
  private readonly input = new ScriptedInput({ steps: [] });
  constructor(
    def: CharacterDef,
    level: LevelData,
    mount: GameContext['classicYoshi'],
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
    const state = { ...newGameState(def, null, 'classic'), powerState: 'small', kit };
    this.world = new World(level, ctx, state, { seed: 1 });
    this.events.push(...this.world.events.splice(0));
  }
  get p(): Player {
    return this.world.player;
  }
  step(hold: Action[] = []): void {
    this.input.setHeld(hold);
    this.input.next();
    this.world.update([this.input]);
    this.events.push(...this.world.events.splice(0));
  }
  said(text: string): number {
    return this.events.filter((e) => e.type === 'say' && e.text === text).length;
  }
  pipe(): (WorldEvent & { type: 'pipe' }) | undefined {
    return this.events.find((e): e is WorldEvent & { type: 'pipe' } => e.type === 'pipe');
  }
}

const yoshis = (w: World) => w.entities.filter((e): e is YoshiMount => e instanceof YoshiMount && e.alive);

/** The pair standing on the pipe top at (tx, ty), facing right, the screen there. */
function onPipe(r: MRig, tx: number, ty: number): void {
  const b = r.p.body;
  b.x = tileToSub(tx) + px(16) - (b.w >> 1);
  b.y = tileToSub(ty) - b.h;
  b.vx = 0;
  b.vy = 0;
  r.p.facing = 1;
  r.world.camera.x = Math.max(0, b.x - px(100));
  r.step();
  r.step();
  expect(b.onGround).toBe(true);
}

describe('item 74: Yoshi waits at the pipe into a bonus room', () => {
  it("1-1's coin room pipe: the hero hops off, Yoshi sits beside the pipe, the hero goes in on foot", () => {
    const r = new MRig(MARIO, getLevel('1-1'), 'ride');
    expect(ridingOf(r.p)).not.toBeNull();
    onPipe(r, 57, 9);
    const y = yoshis(r.world)[0] as YoshiMount;
    const top = tileToSub(9);
    r.step(['down']);
    // Off at once: the hero's own def, benched for the room, the line said once.
    expect(ridingOf(r.p)).toBeNull();
    expect(r.p.def).toBe(heroFor(MARIO, 'classic'));
    expect(r.p.scratch[RIDE_KEY]).toBe(2);
    expect(r.said(WAITS_SAID)).toBe(1);
    // Yoshi sits on the floor left of the pipe (behind the hero), facing it.
    expect(y.alive).toBe(true);
    expect(y.state).toBe('wait');
    expect(y.parked).toBe(true);
    expect(y.body.x + y.body.w).toBeLessThanOrEqual(tileToSub(57));
    expect(y.body.y + y.body.h).toBe(px(13 * 16));
    expect(y.facing).toBe(1);
    // The hop: up off the pipe top and back, then down into the pipe.
    let highest = r.p.body.y + r.p.body.h;
    for (let i = 0; i < PARK_HOP; i++) {
      r.step();
      highest = Math.min(highest, r.p.body.y + r.p.body.h);
    }
    expect(highest).toBeLessThan(top - px(8));
    // Back on the pipe top and starting down.
    expect(r.p.body.y + r.p.body.h).toBeGreaterThanOrEqual(top);
    expect(r.p.body.y + r.p.body.h).toBeLessThan(top + px(4));
    for (let i = 0; i < 200 && !r.pipe(); i++) r.step();
    expect(r.pipe()?.target.level).toBe('1-1-bonus');
    // He waited there the whole way in, and nobody got back on.
    expect(y.alive && y.state === 'wait' && y.body.y + y.body.h === px(13 * 16)).toBe(true);
    expect(ridingOf(r.p)).toBeNull();
    expect(r.said(WAITS_SAID)).toBe(1);
  });

  it('the coin room itself keeps him outside without a second line, and back out he rejoins', () => {
    const room = new MRig(MARIO, getLevel('1-1-bonus'), 'on', { [RIDE_KEY]: 2 });
    expect(yoshis(room.world)).toHaveLength(0);
    expect(room.said(WAITS_SAID)).toBe(0);
    const back = new MRig(MARIO, getLevel('1-1'), 'on', { [RIDE_KEY]: 2 });
    expect(ridingOf(back.p)).not.toBeNull();
    expect(back.p.scratch[RIDE_KEY]).toBe(1);
  });

  it('a pipe into an allowed area: he rides straight in, as before', () => {
    const lv = flatLevel({ 11: '..........##', 12: '..........##' }, 60, []);
    lv.zones.push({ kind: 'pipe', x: 10, y: 11, dir: 'down', target: { level: '1-2', x: 2, y: 2 } });
    const r = new MRig(MARIO, lv, 'ride');
    onPipe(r, 10, 11);
    const y0 = r.p.body.y;
    r.step(['down']);
    r.step(['down']);
    expect(ridingOf(r.p)).not.toBeNull();
    expect(r.p.body.y).toBeGreaterThan(y0);
    expect(r.said(WAITS_SAID)).toBe(0);
  });

  it('a wall beside the pipe: he sits on the pipe top at its edge', () => {
    const lv = flatLevel({ 10: '.........#', 11: '.........###', 12: '.........###' }, 60, []);
    lv.zones.push({ kind: 'pipe', x: 10, y: 11, dir: 'down', target: { level: '1-1-bonus', x: 1, y: 0 } });
    const r = new MRig(MARIO, lv, 'ride');
    onPipe(r, 10, 11);
    const y = yoshis(r.world)[0] as YoshiMount;
    r.step(['down']);
    expect(y.parked).toBe(true);
    expect(y.body.x).toBe(tileToSub(10));
    expect(y.body.y + y.body.h).toBe(tileToSub(11));
  });

  it('with the mount off a pipe is untouched (no hop)', () => {
    const r = new MRig(MARIO, getLevel('1-1'), undefined);
    onPipe(r, 57, 9);
    const y0 = r.p.body.y;
    r.step(['down']);
    r.step();
    expect(r.p.body.y).toBeGreaterThan(y0);
    expect(yoshis(r.world)).toHaveLength(0);
  });
});

describe('item 74: Yoshi waits outside the castle', () => {
  it('a flagpole before a castle: he stays sitting at the pole, the hero walks into the castle alone', () => {
    // 1-1's pole and castle, its exit led to 1-4 as 1-3's is (a level before a castle).
    const base = getLevel('1-1');
    const lv: LevelData = {
      ...base,
      zones: base.zones.map((z) => (z.kind === 'exit' ? { ...z, next: '1-4' } : z)),
    };
    expect(getLevel('1-3').zones.some((z) => z.kind === 'exit' && z.next === '1-4')).toBe(true);
    const r = new MRig(MARIO, lv, 'ride');
    const w = r.world;
    expect(benchedLevel(w, w.clearNext())).toBe(true);
    const pole = w.entities.find((e): e is Flagpole => e instanceof Flagpole) as Flagpole;
    const b = r.p.body;
    b.x = tileToSub(pole.tx - 4);
    b.y = px(pole.baseY + 16) - b.h;
    b.vy = 0;
    w.camera.x = b.x - px(100);
    r.step();
    const y = yoshis(w)[0] as YoshiMount;
    for (let i = 0; i < 400 && w.clearPhase === null; i++) r.step(['right', 'run', 'jump']);
    expect(w.clearPhase).toBe('slide');
    const seat = { x: y.body.x, feet: y.body.y + y.body.h };
    let rode = false;
    for (let i = 0; i < 900 && w.clearPhase !== 'countdown'; i++) {
      r.step();
      if (ridingOf(r.p)) rode = true;
    }
    expect(w.clearPhase).toBe('countdown');
    expect(rode).toBe(false);
    expect(y.alive && y.state === 'wait' && y.parked).toBe(true);
    expect(y.body.x).toBe(seat.x);
    expect(y.body.y + y.body.h).toBe(seat.feet);
    expect(r.p.body.x).toBeGreaterThan(y.body.x + px(32));
    expect(r.p.scratch[RIDE_KEY]).toBe(2);
    expect(r.said(WAITS_SAID)).toBe(1);
    // 1-4 itself: benched, no second line.
    const castle = new MRig(MARIO, getLevel('1-4'), 'on', { [RIDE_KEY]: 2 });
    expect(castle.said(WAITS_SAID)).toBe(0);
    expect(castle.p.scratch[RIDE_KEY]).toBe(2);
  });

  it('1-1 to 1-2: an allowed level, so he still rides on to the castle (YM-21 unchanged)', () => {
    const w = new MRig(MARIO, getLevel('1-1'), 'ride').world;
    expect(benchedLevel(w, w.clearNext())).toBe(false);
  });
});
