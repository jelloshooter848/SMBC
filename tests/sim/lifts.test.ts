import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { BalanceLift } from '@game/entities/objects/balance-lift';
import { Lift, type LiftKind } from '@game/entities/objects/lift';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import { World } from '@game/world/world';
import { ScorePopup } from '@game/entities/effects/effects';
import { ScriptedInput } from '@game/sim/headless';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { View } from '@game/entities/entity';
import { itemsDef } from '@content/sprites/items';

const LEVELS = join(import.meta.dirname, '../../src/content/levels');

/** Load a bundled map by id from any world folder (SMB or Lost Levels). */
const level = (id: string): LevelData => {
  const dirs = [
    ...readdirSync(LEVELS).filter((d) => d.startsWith('world')),
    ...readdirSync(join(LEVELS, 'lost'))
      .filter((d) => d.startsWith('world'))
      .map((d) => join('lost', d)),
  ];
  for (const d of dirs) {
    try {
      return parseTextMap(readFileSync(join(LEVELS, d, `${id}.map`), 'utf8'), id);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
  throw new Error(`no map ${id}`);
};
const at = (l: LevelData, x: number, y: number): LevelData => {
  l.start = { x, y };
  l.startMode = 'stand';
  return l;
};

/** A 40-column test room: floor on rows 13-14, the given entity lines, optional castle stage. */
const room = (entities: string[], stage = 1): LevelData => {
  const empty = '.'.repeat(40);
  const floor = '#'.repeat(40);
  const rows = [...Array<string>(13).fill(empty), floor, floor];
  return parseTextMap(
    [
      'id: test',
      'name: TEST',
      'world: 1',
      `stage: ${stage}`,
      'theme: overworld',
      'music: overworld',
      'time: 300',
      'start: 2,12',
      'startMode: stand',
      '',
      '[tiles]',
      ...rows,
      '',
      '[entities]',
      ...entities,
    ].join('\n'),
    'test',
  );
};

const findLift = (w: World, kind: LiftKind, nearTx: number): Lift | undefined =>
  w.entities
    .filter((e): e is Lift => e instanceof Lift && e.kind === kind)
    .sort((a, b) => Math.abs(a.body.x - px(nearTx * 16)) - Math.abs(b.body.x - px(nearTx * 16)))[0];

/** Record a lift's position (subpixels) every frame from the frame it spawns. */
const trace = (l: LevelData, kind: LiftKind, nearTx: number, frames: number) => {
  let lift: Lift | undefined;
  const xs: number[] = [];
  const ys: number[] = [];
  runSim({
    level: l,
    character: MARIO,
    script: { steps: [{ frame: 0, hold: [] }] },
    maxFrames: frames + 1, // the lift spawns during the first frame
    assist: { invulnerable: true },
    controller: (w) => {
      lift ??= findLift(w, kind, nearTx);
      if (lift) {
        xs.push(lift.body.x);
        ys.push(lift.body.y);
      }
      return [];
    },
  });
  return { xs, ys };
};

const argMax = (a: number[]): number => a.indexOf(Math.max(...a));
const argMin = (a: number[]): number => a.indexOf(Math.min(...a));
const maxStep = (a: number[]): number =>
  Math.max(...a.slice(1).map((v, i) => Math.abs(v - (a[i] as number))));

describe('Sideways lifts (Platform.as PT_WAVE_HORIZONTAL)', () => {
  it('swing ±30 px around their spot on a sine, 251 frames per cycle', () => {
    const { xs } = trace(room(['lift-h 10 8 len=6 range=3']), 'lift-h', 10, 300);
    const rest = px(160);
    expect(xs[0]).toBe(rest);
    // hWaveRange 60 Flash px = 30 px at our 16 px tiles.
    expect(toPx(Math.max(...xs) - rest)).toBe(30);
    expect(toPx(rest - Math.min(...xs))).toBeGreaterThanOrEqual(29);
    expect(toPx(rest - Math.min(...xs))).toBeLessThanOrEqual(30);
    // hWaveSpeed 1.5 rad/s: right end at pi/2 / 0.025 = 63 frames, left end at 188.
    expect(Math.abs(argMax(xs.slice(0, 251)) - 63)).toBeLessThanOrEqual(2);
    expect(Math.abs(argMin(xs.slice(0, 251)) - 188)).toBeLessThanOrEqual(2);
    // Peak speed 60 * 1.5 / 2 / 60 = 0.75 px/frame.
    expect(maxStep(xs)).toBeLessThanOrEqual(px(0.76));
  });
});

describe('Vertical swinging lifts (Platform.as PT_WAVE_VERTICAL)', () => {
  it('swing ±75 px above and below their spot on a sine, 377 frames per cycle', () => {
    const { ys } = trace(room(['lift-v 10 6 len=6 range=6']), 'lift-v', 10, 400);
    const rest = px(96);
    expect(ys[0]).toBe(rest);
    expect(toPx(Math.max(...ys) - rest)).toBe(75);
    expect(toPx(rest - Math.min(...ys))).toBeGreaterThanOrEqual(74);
    // waveSpeed 1 rad/s: lowest at 94 frames, highest at 283.
    expect(Math.abs(argMax(ys.slice(0, 377)) - 94)).toBeLessThanOrEqual(2);
    expect(Math.abs(argMin(ys.slice(0, 377)) - 283)).toBeLessThanOrEqual(2);
    expect(maxStep(ys)).toBeLessThanOrEqual(px(1.26));
  });
});

describe('Elevator lifts (Platform.as ConstantRise / ConstantFall)', () => {
  it('move at ySpeed 110 Flash px/s = 0.917 px/frame', () => {
    const down = trace(room(['lift-down 10 2 len=6']), 'lift-down', 10, 121).ys;
    const up = trace(room(['lift-up 10 12 len=6']), 'lift-up', 10, 121).ys;
    // 120 frames at 55 px/s = 110 px.
    expect(Math.abs(toPx((down[120] as number) - (down[0] as number)) - 110)).toBeLessThanOrEqual(1);
    expect(Math.abs(toPx((up[0] as number) - (up[120] as number)) - 110)).toBeLessThanOrEqual(1);
  });

  it('outside castles wrap at the screen edges', () => {
    const up = trace(room(['lift-up 10 2 len=6']), 'lift-up', 10, 60).ys;
    expect(Math.min(...up.map(toPx))).toBeLessThan(-6);
    const down = trace(room(['lift-down 10 13 len=6']), 'lift-down', 10, 60).ys;
    expect(Math.min(...down.map(toPx))).toBeLessThan(0);
  });

  it('in castles wrap 2 tiles below the top of the screen (GLOB_STG_TOP + TILE_SIZE*2)', () => {
    const up = trace(room(['lift-up 10 4 len=3'], 4), 'lift-up', 10, 120).ys.map(toPx);
    expect(Math.min(...up)).toBeGreaterThanOrEqual(31);
    expect(Math.max(...up)).toBeGreaterThanOrEqual(239); // reset to the bottom
    const down = trace(room(['lift-down 10 13 len=3'], 4), 'lift-down', 10, 120).ys.map(toPx);
    expect(Math.min(...down)).toBeGreaterThanOrEqual(32);
    expect(Math.min(...down)).toBeLessThanOrEqual(34); // reappears at y 32
  });

  it('2-4: the shaft lifts never enter the top two rows', () => {
    let lifts: Lift[] = [];
    let top = Infinity;
    runSim({
      level: at(level('2-4'), 82, 5),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w) => {
        lifts = w.entities.filter(
          (e): e is Lift => e instanceof Lift && (e.kind === 'lift-up' || e.kind === 'lift-down'),
        );
        for (const l of lifts) top = Math.min(top, toPx(l.body.y));
        return [];
      },
    });
    expect(lifts.length).toBe(4);
    expect(top).toBeGreaterThanOrEqual(31);
  });
});

describe('Drop lifts (Platform.as PT_STEP_FALL)', () => {
  it('sink at 1.875 px/frame only while ridden and wait when the rider leaves', () => {
    const ys: number[] = [];
    let alive = true;
    runSim({
      level: room(['lift-fall 10 6 len=6']),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 160,
      start: { x: 12, y: 5 },
      controller: (w, f) => {
        const lift = findLift(w, 'lift-fall', 10);
        alive = !!lift?.alive;
        if (lift) ys.push(lift.body.y);
        return f >= 20 && f < 60 ? ['right'] : [];
      },
    });
    // fallSpeed 225 Flash px/s = 112.5 px/s = 1.875 px/frame while ridden.
    expect(Math.abs(toPx((ys[15] as number) - (ys[5] as number)) - 19)).toBeLessThanOrEqual(1);
    // Mario walks off between frames 20 and 60; the lift stays where he left it.
    expect(alive).toBe(true);
    expect(ys.length).toBeGreaterThan(150);
    expect(ys[ys.length - 1]).toBe(ys[120]);
    expect(toPx(ys[120] as number)).toBeLessThan(190);
  });
});

describe('Balance lifts (Platform.as PT_PULLY)', () => {
  const ride = (frames: number, leaveAt = Infinity) => {
    let pair: BalanceLift | undefined;
    const lefts: number[] = [];
    const scores: number[] = [];
    let popup: { y: number; riderMid: number } | undefined;
    const r = runSim({
      level: at(level('3-3'), 80, 5),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: frames,
      assist: { invulnerable: true },
      controller: (w, f) => {
        pair ??= w.entities.find((e): e is BalanceLift => e instanceof BalanceLift);
        const p = pair?.platforms;
        if (p) {
          if (lefts.length === 0) {
            w.player.body.x = p[0].body.x + px(8);
            w.player.body.y = p[0].body.y - w.player.body.h - px(1);
            w.player.body.vy = 0x01000;
          }
          lefts.push(p[0].body.y);
          scores.push(w.state.score);
          const pop = w.entities.find((e): e is ScorePopup => e instanceof ScorePopup && e.text === '1000');
          const b = w.player.body;
          popup ??= pop && { y: pop.body.y, riderMid: b.y + (b.h >> 1) };
        }
        if (f >= leaveAt && f < leaveAt + 3) {
          // Lift Mario off and park him on the mushroom at 77-79 (row 4).
          w.player.body.x = px(78 * 16);
          w.player.body.y = px(4 * 16) - w.player.body.h;
          w.player.body.vy = 0;
        }
        return [];
      },
    });
    return {
      r,
      pair: pair as BalanceLift,
      lefts: lefts.map((y) => toPx(y - (lefts[0] as number))),
      scores,
      popup,
    };
  };

  it('speed up under a rider (ayPully 200 Flash px/s²) instead of sinking at a constant rate', () => {
    const { lefts } = ride(50);
    // 100 px/s² at our scale: about 1.4 px after 10 frames, 22 px after 40.
    expect(lefts[10]).toBeLessThanOrEqual(3);
    expect(lefts[40]).toBeGreaterThanOrEqual(16);
    expect(lefts[40]).toBeLessThanOrEqual(28);
  });

  it('coast and slow down after the rider leaves (fyPully, vyMinPully)', () => {
    const { lefts } = ride(140, 40);
    const atLeave = lefts[41] as number;
    expect((lefts[70] as number) - atLeave).toBeGreaterThanOrEqual(3);
    expect(lefts.length).toBeGreaterThan(130);
    expect(lefts[lefts.length - 1]).toBe(lefts[110]);
  });

  it('snapping the rope scores 1000 (ScoreValue.PULLY_FALL) and both platforms fall', () => {
    const { pair, scores, popup } = ride(400);
    const [left, right] = pair.platforms as [Lift, Lift];
    // Popped at the rider's centre (level.scorePop at player.hMidX, hMidY), not his head.
    expect(popup).toBeDefined();
    const { y, riderMid } = popup as { y: number; riderMid: number };
    expect(Math.abs(toPx(y - riderMid))).toBeLessThanOrEqual(3);
    expect(left.isFalling).toBe(true);
    expect(right.isFalling).toBe(true);
    const jumps = scores
      .slice(1)
      .map((s, i) => s - (scores[i] as number))
      .filter((d) => d !== 0);
    expect(jumps).toContain(1000);
  });
});

describe('Lifts and walls', () => {
  it('ll-4-1-sky: the brick column at 32 scrapes Mario off the cloud lift (Character.groundOnSide)', () => {
    let inside = false;
    const r = runSim({
      level: at(level('ll-4-1-sky'), 18, 9),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 400,
      controller: (w) => {
        const b = w.player.body;
        if (b.x + b.w > px(32 * 16) && b.x < px(33 * 16) && b.y < px(10 * 16)) inside = true;
        return [];
      },
    });
    expect(inside).toBe(false);
    // He drops to the ground left of the column (feet on row 13).
    expect(r.playerY + 16).toBe(13 * 16);
    expect(r.playerX).toBeLessThan(32 * 16);
  });
});

describe('Lava castles: the sideways lift reaches under the drop shaft', () => {
  /** Drop down the shaft after `wait` frames; true when Mario lands on the lift alive. */
  const drop = (id: string, sx: number, sy: number, wait: number, hold: Action[]) => {
    let landed = false;
    runSim({
      level: at(level(id), sx, sy),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: wait + 120,
      until: (w) => landed || w.player.dead,
      controller: (w, f) => {
        const b = w.player.body;
        const lift = findLift(w, 'lift-h', sx + 3);
        if (lift && b.onGround && b.y + b.h === lift.body.y) landed = true;
        return f >= wait ? hold : [];
      },
    });
    return landed;
  };
  const anyLanding = (id: string, sx: number, sy: number, hold: Action[]) => {
    for (let wait = 0; wait < 260; wait += 6) if (drop(id, sx, sy, wait, hold)) return true;
    return false;
  };

  it('ll-12-4 and ll-7-4: the lift at 31 passes under the shaft at column 29', () => {
    for (const id of ['ll-12-4', 'll-7-4']) {
      const { xs } = trace(at(level(id), 26, 4), 'lift-h', 31, 300);
      expect(toPx(Math.min(...xs))).toBeLessThan(29 * 16 + 4);
      expect(anyLanding(id, 28, 4, ['right'])).toBe(true);
    }
  });

  it('ll-11-4: the lift at 66 passes under the shafts at columns 64 and 68', () => {
    const { xs } = trace(at(level('ll-11-4'), 61, 5), 'lift-h', 66, 300);
    expect(toPx(Math.min(...xs))).toBeLessThan(64 * 16 + 4);
    expect(toPx(Math.max(...xs)) + 32).toBeGreaterThanOrEqual(69 * 16);
    expect(anyLanding('ll-11-4', 63, 5, ['right', 'attack'])).toBe(true);
  });
});

describe('Balance lifts in co-op', () => {
  it('a rider on each platform cancels the pulls: the pair moves once per frame, not twice', () => {
    const level = room(['balance 10 6 x2=16 y2=6 len=6 top=2']);
    const world = new World(
      level,
      {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST, invulnerable: true },
        reduceFlashing: true,
      },
      newGameState(MARIO, MARIO),
    );
    const a = new ScriptedInput({ steps: [] });
    const b = new ScriptedInput({ steps: [] });
    const [p1, p2] = world.players as [(typeof world.players)[0], (typeof world.players)[0]];
    const stand = (p: typeof p1, lift: Lift) => {
      p.body.x = lift.body.x + px(16);
      p.body.y = lift.body.y - p.body.h;
      p.body.vy = 0;
      p.body.onGround = true;
    };
    let pair: BalanceLift | undefined;
    const lefts: number[] = [];
    for (let f = 0; f < 56; f++) {
      pair ??= world.entities.find((e): e is BalanceLift => e instanceof BalanceLift);
      const plats = pair?.platforms;
      if (plats) {
        if (lefts.length === 0) stand(p1, plats[0]);
        if (lefts.length === 40) stand(p2, plats[1]); // player two boards the rising platform
        // Park player two off to the side until then.
        if (lefts.length < 40) {
          p2.body.x = px(2 * 16);
          p2.body.y = px(13 * 16) - p2.body.h;
        }
        lefts.push(plats[0].body.y);
      }
      for (const i of [a, b]) {
        i.setHeld([]);
        i.next();
      }
      world.update([a, b]);
    }
    const step = (i: number) => (lefts[i] as number) - (lefts[i - 1] as number);
    const before = step(40);
    expect(before).toBeGreaterThan(0);
    // Both riders: no net pull, so the pair keeps its speed (one move of v per frame).
    for (let i = 43; i < 54; i++) expect(Math.abs(step(i) - before)).toBeLessThanOrEqual(px(1));
    expect(pair?.platforms?.[0].isFalling).toBe(false);
  });
});

describe('Lift drawing', () => {
  it('covers exactly the solid width, for odd and even lengths', () => {
    const frameW = (f: string) => itemsDef.frames[f]?.[0]?.length ?? 0;
    for (const len of [2, 3, 4, 5, 6]) {
      const lift = new Lift('lift-h', 10, 6, { len });
      const spans: [number, number][] = [];
      const rec: Renderer = Object.assign(new NullRenderer(), {
        sprite(_s: SpriteSheet, f: string, x: number): void {
          spans.push([x, x + frameW(f)]);
        },
      });
      const view = { camX: 0, frame: 0, assets: { sheet: () => ({}) }, theme: 'castle' } as unknown as View;
      lift.render(rec, view);
      const left = Math.min(...spans.map((s) => s[0]));
      const right = Math.max(...spans.map((s) => s[1]));
      expect([left, right]).toEqual([toPx(lift.body.x), toPx(lift.body.x + lift.body.w)]);
    }
  });
});
