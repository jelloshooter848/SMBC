import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { getLevel } from '@content/levels';
import { SOPHIA } from '@game/characters/sophia';
import { SOPHIA_CLASSIC } from '@game/characters/sophia/classic';
import { CEIL, FLOOR, LEFT, RIGHT, sophiaState } from '@game/characters/sophia/state';
import { MAX_PLAT_DIST, heldLift } from '@game/characters/sophia/classic-lifts';
import { Lift } from '@game/entities/objects/lift';
import { px } from '@engine/math/units';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';

/*
 * Classic SMBC Sophia III on moving lifts (bug-reports/2026-10-07-sophia-build-classic-character.md
 * SO-38, SO-M12; Sophia.as:1177-1196, 1385-1393, 2803-2870): with Wall Climb she wraps from a lift's
 * top onto its sides and underside, grips its underside from a jump, rides it while attached and
 * lets go beyond MAX_PLAT_DIST. Campaign Sophia (the campaign's) is unchanged.
 */

/** A 40-column room: floor on rows 13-14, the given entity lines. */
const room = (entities: string[], start: string) => {
  const empty = '.'.repeat(40);
  const floor = '#'.repeat(40);
  return parseTextMap(
    [
      'id: test',
      'name: TEST',
      'world: 1',
      'stage: 1',
      'theme: overworld',
      'music: overworld',
      'time: 300',
      `start: ${start}`,
      'startMode: stand',
      '',
      '[tiles]',
      ...Array<string>(13).fill(empty),
      floor,
      floor,
      '',
      '[entities]',
      ...entities,
    ].join('\n'),
    'test',
  );
};

interface Frame {
  f: number;
  surface: number;
  turning: boolean;
  held: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  onGround: boolean;
  liftX: number;
  liftY: number;
  liftW: number;
  liftH: number;
  riding: boolean;
}
type Ctl = (w: World, f: number) => Action[];

function play(
  entities: string[],
  controller: Ctl,
  frames: number,
  opts: { start?: string; power?: string; rules?: 'classic' | 'campaign' } = {},
) {
  const log: Frame[] = [];
  const res = runSim({
    level: room(entities, opts.start ?? '2,12'),
    character: SOPHIA,
    rules: opts.rules ?? 'classic',
    script: { steps: [] },
    maxFrames: frames,
    controller: (w, f) => {
      const p = w.player;
      const st = sophiaState(p);
      const L = liftOf(w);
      if (L)
        log.push({
          f,
          surface: st.surface,
          turning: st.turn !== null,
          held: heldLift(p) === L,
          x: p.body.x,
          y: p.body.y,
          w: p.body.w,
          h: p.body.h,
          onGround: p.body.onGround,
          liftX: L.body.x,
          liftY: L.body.y,
          liftW: L.body.w,
          liftH: L.body.h,
          riding: L.ridden && L.rider === p.body,
        });
      return controller(w, f);
    },
    state: { kit: {}, powerState: opts.power ?? 'fire' },
    assist: { invulnerable: true },
  });
  return { log, world: res.world };
}

const liftOf = (w: World): Lift | undefined =>
  w.entities.find((e): e is Lift => e instanceof Lift && e.alive);

/** Walk under the lift's middle, then a full jump (Down held when `noGrip`). */
function jumpUnder(extra: (f: number, j: number) => Action[] = () => [], noGrip = false): Ctl {
  let j: number | null = null;
  return (w, f) => {
    const p = w.player;
    const L = liftOf(w);
    if (j === null && L) {
      const cx = p.body.x + (p.body.w >> 1);
      const lx = L.body.x + (L.body.w >> 1);
      if (cx < lx - px(4)) return ['right'];
      if (cx > lx + px(4)) return ['left'];
      j = f;
    }
    if (j === null) return [];
    if (f < j + 30) return noGrip ? ['jump', 'down'] : ['jump'];
    return extra(f, j);
  };
}

/** Standing on a sideways lift at the start (its top at the start row's feet). */
const ON_TOP = { start: '7,10' };
const SWING = ['lift-h 6 11 len=6'];

describe('SO-38: gripping a lift from below', () => {
  it('a rising Crusher jump grips the underside of a lift above and rides it', () => {
    const { log } = play(['lift-h 6 9 len=6'], jumpUnder(), 240);
    const grip = log.findIndex((r) => r.surface === CEIL);
    expect(grip).toBeGreaterThan(0);
    const after = log.slice(grip + 40, grip + 140);
    expect(after.length).toBe(100);
    for (const r of after) {
      expect(r.surface).toBe(CEIL);
      expect(r.held).toBe(true);
      // Her top on the lift's underside, her offset along it fixed (she rides it).
      expect(r.y).toBe(r.liftY + r.liftH);
      expect(r.x - r.liftX).toBe((after[0] as Frame).x - (after[0] as Frame).liftX);
    }
    // The lift really moved meanwhile.
    const xs = after.map((r) => r.liftX);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(px(10));
  });

  it('no grip with Down held, nor without the Crusher, nor for Campaign Sophia', () => {
    for (const run of [
      play(['lift-h 6 9 len=6'], jumpUnder(undefined, true), 200),
      play(['lift-h 6 9 len=6'], jumpUnder(), 200, { power: 'big' }),
      play(['lift-h 6 9 len=6'], jumpUnder(), 200, { rules: 'campaign' }),
    ]) {
      expect(run.log.some((r) => r.surface !== FLOOR || r.held)).toBe(false);
      expect(heldLift(run.world.player)).toBe(null);
    }
  });
});

describe('SO-38: wrapping round a lift', () => {
  it('from the top, forward and Down wrap her onto its side; Up takes her back onto the top', () => {
    let phase = 0;
    const { log } = play(
      SWING,
      (w) => {
        const st = sophiaState(w.player);
        if (phase === 0 && st.surface === LEFT && !st.turn) phase = 1;
        if (phase === 1 && st.surface === FLOOR && !st.turn) phase = 2;
        return phase === 0 ? ['right', 'down'] : phase === 1 ? ['up'] : [];
      },
      300,
      ON_TOP,
    );
    const side = log.findIndex((r) => r.surface === LEFT && !r.turning);
    expect(side).toBeGreaterThan(0);
    // On its right face: her left edge on it, centred on its height, held and following it.
    const r = log[side] as Frame;
    expect(r.held).toBe(true);
    expect(r.x).toBe(r.liftX + r.liftW);
    expect(r.y + (r.h >> 1)).toBe(r.liftY + (r.liftH >> 1));
    const back = log.findIndex((r, i) => i > side && r.surface === FLOOR && !r.turning);
    expect(back).toBeGreaterThan(side);
    // Standing on its top again: an ordinary rider for the rest of the run.
    const later = log.slice(back + 2, back + 40);
    expect(later.every((r) => r.riding && r.onGround && r.y + r.h === r.liftY)).toBe(true);
  });

  it('round the side onto the underside (Down), along it, and up round its other end', () => {
    let phase = 0;
    const { log } = play(
      SWING,
      (w) => {
        const st = sophiaState(w.player);
        if (st.turn) return [];
        if (phase === 0 && st.surface === LEFT) phase = 1;
        if (phase === 1 && st.surface === CEIL) phase = 2;
        if (phase === 2 && st.surface === RIGHT) phase = 3;
        return [['right', 'down'], ['down'], ['left'], []][phase] as Action[];
      },
      400,
      ON_TOP,
    );
    const under = log.findIndex((r) => r.surface === CEIL && !r.turning);
    expect(under).toBeGreaterThan(0);
    expect(log[under]?.y).toBe((log[under]?.liftY ?? 0) + (log[under]?.liftH ?? 0));
    const other = log.findIndex((r, i) => i > under && r.surface === RIGHT && !r.turning);
    expect(other).toBeGreaterThan(under);
    const r = log[other] as Frame;
    // On its left face now.
    expect(r.x + r.w).toBe(r.liftX);
    expect(r.held).toBe(true);
  });

  it('underneath, she stops at an end unless driving on round it', () => {
    let phase = 0;
    let stopped = 0;
    play(
      SWING,
      (w) => {
        const p = w.player;
        const st = sophiaState(p);
        if (st.turn) return [];
        if (phase === 0 && st.surface === LEFT) phase = 1;
        if (phase === 1 && st.surface === CEIL) phase = 2;
        if (phase === 2) {
          // Coast left with nothing held: she ends up at rest on it, short of the end.
          const L = liftOf(w) as Lift;
          if (p.body.vx === 0 && p.body.x + (p.body.w >> 1) - px(4) >= L.body.x) stopped++;
          return [];
        }
        return phase === 0 ? ['right', 'down'] : ['down'];
      },
      400,
      ON_TOP,
    );
    expect(stopped).toBeGreaterThan(30);
  });
});

describe('SO-38: letting go', () => {
  it(`more than MAX_PLAT_DIST (${MAX_PLAT_DIST} px) from the lift: an elevator wrapping round drops her`, () => {
    expect(MAX_PLAT_DIST).toBe(50);
    const { log } = play(['lift-up 6 11 len=6'], jumpUnder(), 600, { start: '6,12' });
    const grip = log.findIndex((r) => r.held && r.surface === CEIL);
    expect(grip).toBeGreaterThan(0);
    const wrap = log.findIndex((r, i) => i > grip && r.liftY - (log[i - 1] as Frame).liftY > px(100));
    expect(wrap).toBeGreaterThan(grip);
    // Riding up with it until it wraps; then not held, upright.
    expect(log.slice(grip + 1, wrap).every((r) => r.held)).toBe(true);
    const next = log[wrap + 1] as Frame;
    expect(next.held).toBe(false);
    expect(next.surface).toBe(FLOOR);
  });

  it('Down + Jump underneath lets go', () => {
    const { log } = play(
      ['lift-h 6 9 len=6'],
      jumpUnder((f, j) => (f >= j + 80 && f < j + 84 ? ['down', 'jump'] : [])),
      200,
    );
    const grip = log.findIndex((r) => r.surface === CEIL);
    const off = log.findIndex((r, i) => i > grip && r.surface === FLOOR);
    expect(off).toBeGreaterThan(grip);
    expect(log[off]?.held).toBe(false);
  });
});

describe('SO-38: falling and pulley lifts', () => {
  it('a step-fall lift sinks under her as under any hero', () => {
    const { log } = play(['lift-fall 6 11 len=6'], () => [], 20, ON_TOP);
    const first = log[2] as Frame;
    const last = log[log.length - 1] as Frame;
    expect(last.liftY).toBeGreaterThan(first.liftY);
    expect(last.riding).toBe(true);
    expect(last.y + last.h).toBe(last.liftY);
  });
});

describe('SO-38: only Classic Sophia', () => {
  it('Campaign Sophia has no lift hooks; Classic has both', () => {
    expect(SOPHIA.behaviour.afterLifts).toBeUndefined();
    expect(SOPHIA_CLASSIC.behaviour.afterLifts).toBeTypeOf('function');
    expect(SOPHIA_CLASSIC.behaviour.drive).not.toBe(SOPHIA.behaviour.drive);
  });

  it('Campaign Sophia drives straight off a lift where Classic wraps round it', () => {
    const cur = play(SWING, () => ['right', 'down'], 120, { ...ON_TOP, rules: 'campaign' });
    expect(cur.log.every((r) => r.surface === FLOOR && !r.held)).toBe(true);
  });
});

describe('SO-38: a lift that swings her into a wall carries her (checkPlatform)', () => {
  it('3-3: on the right side of the sideways lift at column 102 she is not dropped by the col-107 ledge', () => {
    const LIFT_X = px(102 * 16 - 8);
    let phase = 0;
    let lift: Lift | undefined;
    let minGap = Infinity;
    let dropped = false;
    let overlapped = false;
    runSim({
      level: getLevel('3-3'),
      character: SOPHIA,
      rules: 'classic',
      script: { steps: [] },
      maxFrames: 900,
      state: { kit: {}, powerState: 'fire' },
      assist: { invulnerable: true },
      controller: (w) => {
        const p = w.player;
        const b = p.body;
        const st = sophiaState(p);
        if (phase === 0) {
          // Bring the lift on screen, then stand her on it.
          b.x = px(1560);
          b.y = px(40);
          b.vy = 0;
          w.camera.snapTo(b.x);
          lift = w.entities.find(
            (e): e is Lift =>
              e instanceof Lift && e.kind === 'lift-h' && Math.abs(e.body.x - LIFT_X) < px(40),
          );
          if (lift) {
            b.x = lift.body.x + px(16);
            b.y = lift.body.y - b.h;
            phase = 1;
          }
          return [];
        }
        const L = lift as Lift;
        if (phase === 1) {
          if (st.surface !== LEFT || st.turn) return ['right', 'down'];
          phase = 2;
        }
        // Hanging on its right side while it swings to the ledge and back.
        if (heldLift(p) !== L || st.surface !== LEFT) dropped = true;
        const gap = px(107 * 16) - (L.body.x + L.body.w);
        minGap = Math.min(minGap, gap);
        if (b.x + b.w > px(107 * 16)) overlapped = true;
        return [];
      },
    });
    expect(phase).toBe(2);
    // The lift's end comes closer to the ledge than her 15.5 px side box is wide...
    expect(minGap).toBeLessThan(px(15.5));
    expect(overlapped).toBe(true);
    // ...and she rides it through, still holding on.
    expect(dropped).toBe(false);
  });
});
