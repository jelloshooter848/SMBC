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
import { parseTextMap } from '@game/level/textmap';
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
import type { Player } from '@game/entities/player';
import { flatLevel } from './classic-plumber-harness';
import { useStorage } from './heroes-harness';

/*
 * Item 103: as at a pipe and the flagpole (0.4.73 item 74), a Classic Yoshi mount rider bound for
 * a castle, water or bonus area by a vine, a pit or a teleport pad parts with Yoshi where it can be
 * seen: he hops off, Yoshi waits there, and he rejoins in the next allowed area as after a pipe.
 */

useStorage();

class MRig {
  readonly world: World;
  readonly events: WorldEvent[] = [];
  private readonly input = new ScriptedInput({ steps: [] });
  constructor(level: LevelData, mount: GameContext['classicYoshi'], kit: Record<string, number> = {}) {
    const ctx: GameContext = {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
      rules: 'classic',
      ...(mount ? { classicYoshi: mount } : {}),
    };
    const state = { ...newGameState(MARIO, null, 'classic'), powerState: 'small', kit };
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
  /** Steps holding `hold` until `cond`, at most `max` frames; the frames stepped. */
  until(cond: () => boolean, hold: Action[], max = 300): number {
    for (let i = 0; i < max; i++) {
      if (cond()) return i;
      this.step(hold);
    }
    return max;
  }
}

const yoshis = (w: World) => w.entities.filter((e): e is YoshiMount => e instanceof YoshiMount && e.alive);
/** On screen: any part of his body inside the camera's view. */
const seen = (w: World, y: YoshiMount) => y.body.x + y.body.w > w.camera.x && y.body.x < w.camera.right;

// A benched area (a vine's cloud area) and an allowed one, as real levels.
const SKY = '2-1-sky';
const ALLOWED = '1-2';

/** A flat level with a placed vine at column 10 (foot on row 12, its top above the screen). */
function vineLevel(target: string): LevelData {
  const lv = flatLevel({}, 60);
  lv.entities.push({ type: 'vine', x: 10, y: 12, props: { len: 14 } });
  lv.zones.push({ kind: 'vine', x: 10, y: 12, target: { level: target, x: 2, y: 12 } });
  return lv;
}

/** 60 columns of floor (rows 13-14) with a 4-wide pit at columns 20-23 falling into `target`. */
function pitLevel(target: string): LevelData {
  const ground = '#'.repeat(20) + '....' + '#'.repeat(36);
  const lines = [...Array.from({ length: 13 }, () => '.'.repeat(60)), ground, ground];
  const lv = parseTextMap(['id: t', 'time: 300', 'start: 6,12', '', '[tiles]', ...lines].join('\n'));
  lv.zones.push({ kind: 'pit', x: 20, w: 4, target: { level: target, x: 2, y: 0 } });
  return lv;
}

/** A flat level with a teleport pad lying in column 12 of row 12 (on the floor). */
function padLevel(target: string): LevelData {
  const lv = flatLevel({}, 60);
  lv.zones.push({ kind: 'teleport', x: 12, y: 12, target: { level: target, x: 2, y: 2, exitDir: 'beam' } });
  return lv;
}

describe('item 103 levels', () => {
  it('the test areas are benched and allowed as meant', () => {
    const w = new MRig(flatLevel(), 'ride').world;
    expect(benchedLevel(w, SKY)).toBe(true);
    expect(benchedLevel(w, ALLOWED)).toBe(false);
  });
});

describe('item 103: a vine into a benched area', () => {
  it('Up at the vine: the hero hops off onto it, Yoshi hops down and waits in sight, one line', () => {
    const r = new MRig(vineLevel(SKY), 'ride');
    expect(ridingOf(r.p)).not.toBeNull();
    const y = yoshis(r.world)[0] as YoshiMount;
    r.until(() => r.p.centerX >= tileToSub(10) - px(4), ['right'], 200);
    r.step(['up']);
    // Off and on the vine, benched for the cloud area, the line said once.
    expect(ridingOf(r.p)).toBeNull();
    expect(r.p.def).toBe(heroFor(MARIO, 'classic'));
    expect(r.p.vine).not.toBeNull();
    expect(r.p.scratch[RIDE_KEY]).toBe(2);
    expect(r.said(WAITS_SAID)).toBe(1);
    // Seen hopping, then sitting on the floor behind the hero, facing him.
    expect(y.hopping).toBe(true);
    let n = 0;
    while (y.hopping && n++ < 60) r.step(['up']);
    expect(y.alive).toBe(true);
    expect(y.state).toBe('wait');
    expect(y.body.y + y.body.h).toBe(px(13 * 16));
    expect(y.body.x + y.body.w).toBeLessThanOrEqual(r.p.body.x);
    expect(y.facing).toBe(1);
    // He stays in sight while the hero climbs away to the top and on into the cloud area.
    let frames = 0;
    while (!r.pipe() && frames++ < 600) {
      r.step(['up']);
      expect(y.alive).toBe(true);
      expect(seen(r.world, y)).toBe(true);
    }
    expect(r.pipe()?.target.level).toBe(SKY);
    expect(r.said(WAITS_SAID)).toBe(1);
  });

  it('the cloud area keeps him outside with no second line, and back he rejoins as after a pipe', () => {
    const sky = new MRig(getLevel(SKY), 'on', { [RIDE_KEY]: 2 });
    expect(yoshis(sky.world)).toHaveLength(0);
    expect(sky.said(WAITS_SAID)).toBe(0);
    const back = new MRig(getLevel('2-1'), 'on', { [RIDE_KEY]: 2 });
    expect(ridingOf(back.p)).not.toBeNull();
    expect(back.p.scratch[RIDE_KEY]).toBe(1);
  });

  it('climbing back down instead: he still waits, and landing on his back takes the hero again', () => {
    const r = new MRig(vineLevel(SKY), 'ride');
    r.until(() => r.p.centerX >= tileToSub(10) - px(4), ['right'], 200);
    r.step(['up']);
    const y = yoshis(r.world)[0] as YoshiMount;
    r.until(() => !y.hopping, ['up'], 60);
    for (let i = 0; i < 20; i++) r.step(['up']);
    // Down the vine to the floor, and off it.
    r.until(() => r.p.vine === null && r.p.body.onGround, ['down'], 300);
    for (let i = 0; i < 40; i++) r.step();
    expect(y.alive).toBe(true);
    expect(ridingOf(r.p)).toBeNull();
    // A drop onto his back: on again, no longer benched.
    const b = r.p.body;
    b.x = y.body.x;
    b.y = y.body.y - b.h - px(16);
    b.onGround = false;
    r.until(() => ridingOf(r.p) !== null, [], 60);
    expect(ridingOf(r.p)).not.toBeNull();
    expect(r.p.scratch[RIDE_KEY]).toBe(1);
  });

  it('a vine into an allowed area: no change (a rider does not climb vines)', () => {
    const r = new MRig(vineLevel(ALLOWED), 'ride');
    r.until(() => r.p.centerX >= tileToSub(10) - px(4), ['right'], 200);
    for (let i = 0; i < 5; i++) r.step(['up']);
    expect(ridingOf(r.p)).not.toBeNull();
    expect(r.p.vine).toBeNull();
    expect(r.said(WAITS_SAID)).toBe(0);
  });

  it('with the mount off the vine is untouched', () => {
    const r = new MRig(vineLevel(SKY), undefined);
    r.until(() => r.p.centerX >= tileToSub(10) - px(4), ['right'], 200);
    r.step(['up']);
    expect(r.p.vine).not.toBeNull();
    expect(yoshis(r.world)).toHaveLength(0);
    expect(r.said(WAITS_SAID)).toBe(0);
  });
});

describe('item 103: a pit into a benched area', () => {
  it('falling in: Yoshi hops back out to the edge and waits in sight; the hero falls on alone', () => {
    const r = new MRig(pitLevel(SKY), 'ride');
    const y = yoshis(r.world)[0] as YoshiMount;
    let hopped = false;
    let frames = 0;
    while (!r.pipe() && frames++ < 400) {
      r.step(r.p.body.x < tileToSub(19) ? ['right'] : []);
      hopped ||= y.hopping;
    }
    const pipe = r.pipe();
    expect(pipe?.target.level).toBe(SKY);
    expect(pipe?.target.exitDir).toBe('fall');
    expect(hopped).toBe(true);
    expect(ridingOf(r.p)).toBeNull();
    expect(r.p.scratch[RIDE_KEY]).toBe(2);
    expect(r.said(WAITS_SAID)).toBe(1);
    // Waiting on the floor at the pit's edge, in sight, as the hero leaves.
    expect(y.alive).toBe(true);
    expect(y.parked).toBe(true);
    expect(y.hopping).toBe(false);
    expect(y.body.y + y.body.h).toBe(px(13 * 16));
    // Wholly on the floor left of the pit, facing it.
    expect(y.body.x + y.body.w).toBeLessThanOrEqual(tileToSub(20));
    expect(y.body.x + y.body.w).toBeGreaterThan(tileToSub(18));
    expect(y.facing).toBe(1);
    expect(seen(r.world, y)).toBe(true);
  });

  it('a pit into an allowed area: he falls on in with the hero, as before', () => {
    const r = new MRig(pitLevel(ALLOWED), 'ride');
    let frames = 0;
    while (!r.pipe() && frames++ < 400) r.step(r.p.body.x < tileToSub(19) ? ['right'] : []);
    expect(r.pipe()?.target.level).toBe(ALLOWED);
    expect(ridingOf(r.p)).not.toBeNull();
    expect(r.p.scratch[RIDE_KEY]).toBe(1);
    expect(r.said(WAITS_SAID)).toBe(0);
  });
});

describe('item 103: a teleport pad into a benched area', () => {
  it('on the pad: the hero hops off, Yoshi waits beside it, then the beam; one line', () => {
    const r = new MRig(padLevel(SKY), 'ride');
    const y = yoshis(r.world)[0] as YoshiMount;
    r.until(() => ridingOf(r.p) === null || r.world.beaming, ['right'], 200);
    r.step();
    expect(r.world.beaming).toBe(true);
    expect(ridingOf(r.p)).toBeNull();
    expect(r.p.scratch[RIDE_KEY]).toBe(2);
    expect(r.said(WAITS_SAID)).toBe(1);
    // Yoshi sits behind the hero (left of the pad), facing it.
    expect(y.alive).toBe(true);
    expect(y.parked).toBe(true);
    expect(y.body.y + y.body.h).toBe(px(13 * 16));
    expect(y.body.x + y.body.w).toBeLessThanOrEqual(r.p.body.x);
    expect(y.facing).toBe(1);
    // The hero is seen hopping off before the beam takes him.
    const floor = px(13 * 16);
    let highest = r.p.body.y + r.p.body.h;
    let shownHop = 0;
    for (let i = 0; i < PARK_HOP; i++) {
      if (!r.p.hidden) shownHop++;
      r.step();
      highest = Math.min(highest, r.p.body.y + r.p.body.h);
    }
    expect(shownHop).toBeGreaterThan(PARK_HOP - 3);
    expect(highest).toBeLessThan(floor - px(8));
    expect(r.p.hidden).toBe(true);
    let frames = 0;
    while (!r.pipe() && frames++ < 200) {
      r.step();
      expect(seen(r.world, y)).toBe(true);
    }
    expect(r.pipe()?.target.level).toBe(SKY);
  });

  it('a pad into an allowed area: beamed straight up riding, as before', () => {
    const r = new MRig(padLevel(ALLOWED), 'ride');
    r.until(() => r.world.beaming, ['right'], 200);
    expect(ridingOf(r.p)).not.toBeNull();
    expect(r.p.hidden).toBe(true);
    expect(r.said(WAITS_SAID)).toBe(0);
  });

  it('with the mount off the pad is untouched (no hop)', () => {
    const r = new MRig(padLevel(SKY), undefined);
    r.until(() => r.world.beaming, ['right'], 200);
    expect(r.p.hidden).toBe(true);
  });
});
