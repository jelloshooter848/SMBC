import type { Action } from '@engine/input/actions';
import { px, tileAt, tileToSub, toPx } from '@engine/math/units';
import { getLevel as bundled } from '@content/levels';
import { heroVariant } from '@game/level/variants';
import { runSim } from '@game/sim/headless';
import { SOPHIA } from '@game/characters/sophia';
import { sophiaState } from '@game/characters/sophia/state';
import { ParkedTank } from '@game/characters/sophia/jason';
import { groundBelow } from '@game/entities/body';
import { Enemy } from '@game/entities/enemies/enemy';
import { Spring } from '@game/entities/objects/spring';
import type { LevelData } from '@game/level/schema';
import type { World, WorldStart } from '@game/world/world';

/*
 * A completability search for Sophia III (the 0.4.11 review): from a level's start, a
 * breadth-first search over where she can stand, run with the real game (fresh Worlds, enemies
 * removed, invulnerable, endless time). Each step from a standing spot is a short scripted move
 * (drive, jump left / right / up held or tapped, down into a hole or a pipe, EXIT as Jason, and
 * Jason's own moves; with the Flower, climbing; with the Mushroom, hovering), played until she
 * stands still again on solid ground. Pipes and vines into other areas are followed; a flagpole,
 * the castle axe, the level's exit or a warp to another level ends the search. The maze loops'
 * checkpoints travel with each spot. It answers "can she finish it", not "how hard is it".
 * Every level is searched with her campaign variant laid (`[variant sophia]`: level/variants.ts).
 */

type Form = 'tank' | 'jason';

/** A level as campaign play gives it to Sophia III: with her variant's steps (level/variants.ts). */
const getLevel = (id: string): LevelData => heroVariant(bundled(id), [SOPHIA.id], true);

interface Spot {
  area: string;
  form: Form;
  /** Exact body top-left (subpixels). */
  x: number;
  y: number;
  /** Jason's parked tank (subpixels). */
  tx: number;
  ty: number;
  /** The camera's left edge (subpixels): it never scrolls back, so a spot carries it. */
  cam: number;
  /** Loop checkpoints passed (World.loopChecks). */
  checks: string[];
  /** How we got here (for a replay or a report). */
  path: string[];
}

interface Move {
  name: string;
  /** The controller, frame by frame (f from 0 after the setup frames). */
  act: (w: World, f: number) => Action[];
  /** Frames to hold the scripted part before waiting to settle. */
  frames: number;
}

export interface ReachResult {
  done: boolean;
  how: string | null;
  spots: number;
  areas: string[];
  /** The furthest right column reached in the level's main area (a hint when it fails). */
  furthest: number;
  path: string[];
}

const calm = (w: World) => {
  for (const e of w.entities) if (e instanceof Enemy) e.alive = false;
};

/** Riding a springboard (not a lift: the ride moves leave it alone). */
const onSpring = (w: World) => w.entities.some((e) => e instanceof Spring && e.ridBy(w.player));

type Internals = { loopChecks: Set<string>; loopPrevX: number | null };

/** A move that lets go of everything once it has been in the air and landed again. */
function untilLanded(act: Move['act']): Move['act'] {
  let air = false;
  let done = false;
  return (w, f) => {
    const b = w.player.body;
    if (!b.onGround) air = true;
    else if (air && f > 6) done = true;
    return done ? [] : act(w, f);
  };
}

function moves(form: Form, power: string, water: boolean, spring = false): Move[] {
  const out: Move[] = [];
  const jumpy = (name: string, frames: number, act: Move['act']) =>
    out.push({ name, frames, act: untilLanded(act) });
  const hold = (name: string, a: Action[], frames: number) => out.push({ name, act: () => a, frames });
  for (const d of ['right', 'left'] as const) {
    hold(`walk-${d}`, [d], 14);
    hold(`run-${d}`, [d], 40);
    // Off a ledge with the direction held until she lands (a drop that steers in under a ledge).
    jumpy(`drive-${d}`, 200, () => [d]);
    // Jumps: held all the way, or tapped, the direction held all the way.
    jumpy(`jump-${d}`, 90, (_w, f) => (f < 70 ? [d, 'jump'] : [d]));
    jumpy(`hop-${d}`, 60, (_w, f) => (f < 2 ? [d, 'jump'] : [d]));
    // Straight up, then over once high (onto a ledge above).
    jumpy(`up-${d}`, 90, (_w, f) => (f < 24 ? ['jump'] : f < 70 ? [d, 'jump'] : [d]));
    // A short run-up, then a jump; and a jump that steers only on the way down.
    jumpy(`long-${d}`, 110, (_w, f) => (f < 20 ? [d] : f < 90 ? [d, 'jump'] : [d]));
    jumpy(`late-${d}`, 90, (_w, f) => (f < 30 ? ['jump'] : f < 70 ? [d, 'jump'] : [d]));
    // A long flight (a super spring): the direction and jump held until she lands; by a spring,
    // also braked after a while (she keeps her speed in the air) to come down short of that.
    jumpy(`far-${d}`, 420, () => [d, 'jump']);
    const o: Action = d === 'right' ? 'left' : 'right';
    if (spring)
      for (const k of [60, 120, 180, 240, 300, 360])
        out.push({
          name: `spring${k}-${d}`,
          frames: k + 16,
          // Not let go on landing: the spring's bounce is a landing too.
          act: (_w, f) => (f < k ? [d, 'jump'] : [o, 'jump']),
        });
    // Hop onto a spring and press jump on it (the boosted launch needs a fresh press there), then
    // rise straight up for `k` frames and steer `d` until she lands (`k` 0: steered all the way).
    if (spring)
      for (const k of [0, 20, 40, 60, 90]) {
        let rode = false;
        let up = -1;
        let done = false;
        out.push({
          name: `boost${k}-${d}`,
          frames: 360,
          act: (w, f) => {
            const p = w.player;
            if (done) return [];
            if (onSpring(w)) {
              rode = true;
              return f % 2 === 0 ? ['jump'] : [];
            }
            if (!rode) return f < 3 ? [d, 'jump'] : p.body.onGround && f > 6 ? ((done = true), []) : [d];
            if (up < 0) up = f;
            if (p.body.onGround && f - up > 4) return ((done = true), []);
            return f - up < k ? ['jump'] : [d, 'jump'];
          },
        });
      }
    // Drive to the edge (no floor under her middle), then a held jump; and the same from a
    // run-up (backing off first).
    for (const back of [0, 30]) {
      let jumpAt = -1;
      const o: Action = d === 'right' ? 'left' : 'right';
      jumpy(`edge${back ? '-runup' : ''}-${d}`, back + 200, (w, f) => {
        if (f <= back) return [o];
        if (jumpAt < 0) {
          const b = w.player.body;
          const col = tileAt(b.x + (b.w >> 1));
          const row = tileAt(b.y + b.h);
          const floor = w.map.isSolid(col, row) || w.map.collisionAt(col, row) === 'top';
          if (!floor || f > back + 120) jumpAt = f;
          else return [d];
        }
        return f - jumpAt < 70 ? [d, 'jump'] : [d];
      });
    }
    if (form === 'tank') hold(`down-${d}`, [d, 'down'], 40);
    // Timed for a lift below: wait, then down (nose first down a one-tile shaft onto it).
    if (form === 'tank')
      for (const wait of [40, 90, 140])
        out.push({
          name: `wait${wait}-down-${d}`,
          frames: wait + 40,
          act: (_w, f) => (f < wait ? [] : [d, 'down']),
        });
    if (form === 'tank' && power === 'fire') hold(`climb-${d}`, [d, 'up'], 260);
    if (form === 'tank' && power !== 'small')
      jumpy(`hover-${d}`, 200, (_w, f) => (f < 20 ? [d, 'jump'] : f < 26 ? [d] : [d, 'jump']));
    if (water) {
      hold(`swim-up-${d}`, [d, 'up', 'jump'], 60);
      hold(`swim-down-${d}`, [d, 'down'], 60);
      // A long swim at a held depth (a few tiles up, level, or down), then let go to sink.
      for (const rows of [-3, 0, 3])
        for (const frames of [120, 240]) {
          let y0: number | null = null;
          out.push({
            name: `swim${rows}-${frames}-${d}`,
            frames,
            act: (w, f) => {
              const b = w.player.body;
              y0 ??= b.y + px(rows * 16);
              const a: Action[] = [d];
              if (b.y > y0 + px(2)) a.push('up', ...(f % 2 === 0 ? (['jump'] as Action[]) : []));
              else if (b.y < y0 - px(6)) a.push('down');
              return a;
            },
          });
        }
    }
  }
  // Timed for a moving lift: wait, then a running jump.
  for (const d of ['right', 'left'] as const)
    for (const wait of [30, 70])
      jumpy(`wait${wait}-${d}`, wait + 110, (_w, f) => (f < wait ? [] : f < wait + 70 ? [d, 'jump'] : [d]));
  hold('jump', ['jump'], 80);
  hold('down', ['down'], 30);
  // Into the nearest down pipe a few tiles off: line up over its mouth, then down.
  out.push({
    name: 'pipe',
    frames: 200,
    act: (w, f) => {
      const b = w.player.body;
      const cx = b.x + (b.w >> 1);
      let best: number | null = null;
      for (const z of w.level.zones) {
        if (z.kind !== 'pipe' || z.dir !== 'down' || z.campaign) continue;
        const mid = tileToSub(z.x + 1);
        if (Math.abs(mid - cx) > px(16 * 6) || Math.abs(tileToSub(z.y) - (b.y + b.h)) > px(48)) continue;
        if (best === null || Math.abs(mid - cx) < Math.abs(best - cx)) best = mid;
      }
      if (best === null) return [];
      const d = best - cx;
      const dir: Action = d > 0 ? 'right' : 'left';
      if (Math.abs(d) > px(24)) return [dir];
      if (Math.abs(d) > px(3)) return f % 8 === 0 ? [dir] : [];
      return ['down'];
    },
  });
  if (water) hold('swim-up', ['up'], 60);
  // Up: vines (Jason or the tank), talk, board.
  out.push({
    name: 'climb',
    frames: 600,
    act: (w, f) => (w.player.vine ? ['up'] : f % 10 < 6 ? ['up', 'jump'] : ['up']),
  });
  if (form === 'tank') hold('exit', ['select'], 2);
  return out;
}

/** Stands still on solid ground (not a lift, not a vine). */
function settled(w: World): boolean {
  const p = w.player;
  const st = sophiaState(p);
  return (
    p.body.onGround &&
    p.body.vx === 0 &&
    !p.vine &&
    !st.turn &&
    !st.nose &&
    st.surface === 0 &&
    st.squat === 0 &&
    groundBelow(p.body, w.map)
  );
}

interface Outcome {
  kind: 'stand' | 'done' | 'area' | 'lost' | 'lift';
  spot?: Omit<Spot, 'path'>;
  how?: string;
  target?: { level: string; x: number; y: number; exitDir?: string };
}

/** Plays one move from a spot in a fresh World. */
/**
 * On a lift: wait `wait` frames (driving `dir` along it with `drive`), then jump `dir` until she
 * lands again; up to eight lifts in a row.
 */
interface Ride {
  wait: number;
  dir: 'right' | 'left';
  drive: boolean;
}

/** Lift rides tried: [frames on the lift before the jump, driving meanwhile]. */
const RIDES: [number, boolean][] = [
  [1, false],
  [8, true],
  [16, true],
  [28, true],
  [40, false],
  [90, false],
  [150, false],
];

function play(
  spot: Spot,
  level: LevelData,
  power: string,
  move: Move | null,
  start?: WorldStart,
  ride?: Ride,
): Outcome {
  let result: Outcome = { kind: 'lost' };
  let phase: 'setup' | 'move' | 'settle' = start ? 'settle' : 'setup';
  let t = 0;
  let still = 0;
  let onLift = 0;
  let rides = 0;
  let rideJump = 0;
  let liftSeen = false;
  const r = runSim({
    level,
    character: SOPHIA,
    script: { steps: [] },
    maxFrames: (move?.frames ?? 0) + (ride ? 1500 : 400),
    assist: { invulnerable: true, infiniteTime: true },
    state: { powerState: power },
    start: start ?? { x: tileAt(spot.x + px(8)), y: tileAt(spot.y + px(8)), mode: 'stand' },
    controller: (w, f) => {
      calm(w);
      const p = w.player;
      if (phase === 'setup') {
        const b = p.body;
        const internals = w as unknown as Internals;
        if (f === 0) {
          for (const c of spot.checks) internals.loopChecks.add(c);
          b.x = spot.form === 'jason' ? spot.tx : spot.x;
          b.y = spot.form === 'jason' ? spot.ty : spot.y;
          b.vx = 0;
          b.vy = 0;
          w.camera.x = spot.cam;
          internals.loopPrevX = toPx(p.centerX);
          return spot.form === 'jason' ? [] : [];
        }
        if (spot.form === 'jason') {
          if (f === 2) return ['select'];
          if (f < 30) return [];
          if (!sophiaState(p).jason) return [];
          b.x = spot.x;
          b.y = spot.y;
          b.vx = 0;
          b.vy = 0;
          internals.loopPrevX = toPx(p.centerX);
          if (f < 34) return [];
        }
        phase = 'move';
        t = 0;
      }
      if (phase === 'move' && move) {
        // Landed on a lift mid-move: the ride (if any) takes over at once (a falling lift).
        const lb = p.body;
        if (t > 4 && lb.onGround && !groundBelow(lb, w.map) && !p.vine && !onSpring(w)) {
          liftSeen = true;
          if (ride) phase = 'settle';
        }
      }
      if (phase === 'move' && move) {
        if (t++ < move.frames) return move.act(w, t);
        phase = 'settle';
      }
      phase = 'settle';
      const b = p.body;
      if (rideJump > 0 && ride) {
        rideJump++;
        // One frame let go first (jump may still be held from the move), then a fresh press.
        if (rideJump === 2) return [ride.dir];
        if (rideJump < 10 || (!b.onGround && rideJump < 150)) return [ride.dir, 'jump'];
        rideJump = 0;
      }
      if (b.onGround && !groundBelow(b, w.map) && !p.vine && !onSpring(w)) {
        liftSeen = true;
        onLift++;
        if (ride && rides < 8 && onLift >= ride.wait) {
          rides++;
          onLift = 0;
          rideJump = 1;
          return [ride.dir];
        }
        if (ride?.drive) return [ride.dir];
      } else onLift = 0;
      if (settled(w)) still++;
      else still = 0;
      return [];
    },
    until: (w) => {
      if (w.flagGrabbedBy || w.bossClear) {
        result = { kind: 'done', how: w.flagGrabbedBy ? 'flagpole' : 'axe' };
        return true;
      }
      // Under water she can stop anywhere (she only sinks slowly): a spot mid-water too.
      const p = w.player;
      const floating = !ride && p.inWater && !p.dead && !sophiaState(p).turn && move !== null;
      return phase === 'settle' && (still >= 3 || floating);
    },
  });
  if (result.kind === 'done') return result;
  const w = r.world;
  for (const e of r.events) {
    if (e.type === 'exit') return { kind: 'done', how: 'exit' };
    if (e.type === 'pipe') return { kind: 'area', target: e.target };
    if (e.type === 'crystal-ball') return { kind: 'done', how: 'crystal ball' };
  }
  if (r.outcome !== 'stopped' || w.player.dead) return { kind: liftSeen && !ride ? 'lift' : 'lost' };
  const p = w.player;
  const st = sophiaState(p);
  const tank = w.entities.find((e): e is ParkedTank => e instanceof ParkedTank && e.alive);
  return {
    kind: 'stand',
    spot: {
      area: level.id,
      form: st.jason ? 'jason' : 'tank',
      x: p.body.x,
      y: p.body.y,
      tx: tank?.body.x ?? 0,
      ty: tank?.body.y ?? 0,
      cam: w.camera.x,
      checks: [...(w as unknown as Internals).loopChecks].sort(),
    },
  };
}

/**
 * The maze loops: a check an `all` loop needs is progress (that loop is a way on); one an `any`
 * loop counts is a wrong turn (that loop sends her back).
 */
function loopScore(level: LevelData, checks: string[]): number {
  let n = 0;
  for (const c of checks) {
    const z = level.zones[Number(c.split(':')[0])];
    if (z?.kind === 'loop') n += z.need === 'any' ? -40 : 40;
  }
  return n;
}

const keyOf = (s: Omit<Spot, 'path'>) =>
  [
    s.area,
    s.form,
    tileAt(s.x + px(4)),
    tileAt(s.y + px(8)),
    s.form === 'jason' ? tileAt(s.tx) : '',
    s.checks.join(','),
  ].join(':');

/**
 * Can Sophia III (in `power`, with Jason) finish level `id` from its start? `budget` caps the
 * number of moves played.
 */
export function reach(
  id: string,
  power = 'small',
  budget = 20000,
  /** Stop at the first spot this accepts (how: 'goal') instead of the level's end. */
  goal?: (s: Omit<Spot, 'path'>) => boolean,
  /** Search from here instead of the level's start (past a stretch a scripted sim got through). */
  from?: WorldStart,
): ReachResult {
  const main = getLevel(id);
  const seen = new Set<string>();
  const queue: Spot[] = [];
  const areas = new Set<string>();
  let furthest = 0;
  const enter = (level: LevelData, start: WorldStart, path: string[]): ReachResult | null => {
    if (areas.has(`${level.id}@${start.x},${start.y}`)) return null;
    areas.add(`${level.id}@${start.x},${start.y}`);
    const blank: Spot = { area: level.id, form: 'tank', x: 0, y: 0, tx: 0, ty: 0, cam: 0, checks: [], path };
    const o = play(blank, level, power, null, start);
    return handle(o, blank, `enter ${level.id}`);
  };
  const handle = (o: Outcome, from: Spot, name: string): ReachResult | null => {
    const path = [...from.path, name];
    if (o.kind === 'done')
      return { done: true, how: o.how ?? null, spots: seen.size, areas: [...areas], furthest, path };
    if (o.kind === 'area' && o.target) {
      let level: LevelData;
      try {
        level = getLevel(o.target.level);
      } catch {
        return null;
      }
      // A warp on to a later stage counts as getting through (the Lost Levels' warps back
      // to an earlier world do not).
      if (level.world > main.world || (level.world === main.world && level.stage > main.stage))
        return {
          done: true,
          how: `warp to ${level.id}`,
          spots: seen.size,
          areas: [...areas],
          furthest,
          path,
        };
      const dir = o.target.exitDir ?? 'none';
      const mode =
        dir === 'up'
          ? 'pipe-exit'
          : dir === 'climb' || dir === 'fall' || dir === 'spin'
            ? dir
            : level.startMode;
      return enter(level, { x: o.target.x, y: o.target.y, mode }, path);
    }
    if (o.kind === 'stand' && o.spot) {
      if (goal?.(o.spot))
        return { done: true, how: 'goal', spots: seen.size, areas: [...areas], furthest, path };
      const k = keyOf(o.spot);
      if (seen.has(k)) return null;
      seen.add(k);
      if (o.spot.area === main.id) furthest = Math.max(furthest, tileAt(o.spot.x));
      queue.push({ ...o.spot, path });
    }
    return null;
  };
  const first = enter(main, from ?? { mode: main.startMode }, []);
  if (first) return first;
  let played = 0;
  while (queue.length && played < budget) {
    // Best first: the spot furthest right, after the most pipes (each area she went into leads
    // on, back into the main one included), Jason's last.
    let bi = 0;
    let best = -Infinity;
    queue.forEach((q, i) => {
      const score =
        tileAt(q.x) +
        q.path.filter((x) => x.startsWith('enter ')).length * 1000 -
        (q.form === 'jason' ? 24 : 0) -
        q.path.length * 0.01 +
        loopScore(main, q.checks);
      if (score > best) {
        best = score;
        bi = i;
      }
    });
    const s = queue.splice(bi, 1)[0] as Spot;
    const level = getLevel(s.area);
    const water = /water/.test(level.theme);
    const spring = level.entities.some(
      (e) => e.type.startsWith('spring') && Math.abs(e.x - tileAt(s.x)) <= 8,
    );
    for (const m of moves(s.form, power, water, spring)) {
      // A fresh move (its closures) for each play.
      const fresh = (): Move => moves(s.form, power, water, spring).find((x) => x.name === m.name) as Move;
      played++;
      const tag = `${s.form}@${tileAt(s.x)},${tileAt(s.y)} ${m.name}`;
      const o = play(s, level, power, fresh());
      const res = handle(o, s, tag);
      if (res) return res;
      if (o.kind === 'lift')
        // Landed on a lift: ride it a while, then jump off either way.
        for (const [wait, drive] of RIDES)
          for (const dir of ['right', 'left'] as const) {
            played++;
            const rr = handle(
              play(s, level, power, fresh(), undefined, { wait, dir, drive }),
              s,
              `${tag} ride${drive ? '-drive' : ''}${wait}-${dir}`,
            );
            if (rr) return rr;
          }
    }
  }
  return { done: false, how: null, spots: seen.size, areas: [...areas], furthest, path: [] };
}

/** The start of an area she goes into through a pipe, a vine or a warp (as reach() does). */
function areaStart(level: LevelData, target: NonNullable<Outcome['target']>): WorldStart {
  const dir = target.exitDir ?? 'none';
  const mode =
    dir === 'up' ? 'pipe-exit' : dir === 'climb' || dir === 'fall' || dir === 'spin' ? dir : level.startMode;
  return { x: target.x, y: target.y, mode };
}

/**
 * Plays a route reach() found (its `path`) again, step by step from each spot the last step
 * left her on: whether it still finishes the level, and the step where it went wrong if not.
 */
export function replay(
  id: string,
  power: string,
  path: string[],
  log?: (step: string, o: Outcome) => void,
): { done: boolean; how: string | null; at: string } {
  const main = getLevel(id);
  const blank = (area: string): Spot => ({
    area,
    form: 'tank',
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    cam: 0,
    checks: [],
    path: [],
  });
  let o = play(blank(main.id), main, power, null, { mode: main.startMode });
  for (const step of path) {
    if (step.startsWith('enter ')) continue;
    // Through pipes into the next area first.
    while (o.kind === 'area' && o.target) {
      const level = getLevel(o.target.level);
      if (level.world > main.world || (level.world === main.world && level.stage > main.stage))
        return { done: true, how: `warp to ${level.id}`, at: step };
      o = play(blank(level.id), level, power, null, areaStart(level, o.target));
    }
    if (o.kind === 'done') return { done: true, how: o.how ?? null, at: step };
    if (o.kind !== 'stand' || !o.spot) return { done: false, how: null, at: step };
    const spot: Spot = { ...o.spot, path: [] };
    const m = /^(tank|jason)@-?\d+,-?\d+ (\S+)(?: ride(-drive)?(\d+)-(right|left))?$/.exec(step);
    if (!m) return { done: false, how: null, at: `unreadable: ${step}` };
    const level = getLevel(spot.area);
    const move = moves(spot.form, power, /water/.test(level.theme), true).find((x) => x.name === m[2]);
    if (!move) return { done: false, how: null, at: `no move: ${step}` };
    const ride: Ride | undefined = m[4]
      ? { wait: Number(m[4]), drive: m[3] !== undefined, dir: m[5] as 'right' | 'left' }
      : undefined;
    o = play(spot, level, power, move, undefined, ride);
    log?.(step, o);
  }
  while (o.kind === 'area' && o.target) {
    const level = getLevel(o.target.level);
    if (level.world > main.world || (level.world === main.world && level.stage > main.stage))
      return { done: true, how: `warp to ${level.id}`, at: 'end' };
    o = play(blank(level.id), level, power, null, areaStart(level, o.target));
  }
  return { done: o.kind === 'done', how: o.how ?? null, at: 'end' };
}

/**
 * A found route played as one continuous run (one World, as a player would): each step's move,
 * then nothing held until she stands still again. Steps riding lifts are not supported. Use its
 * `controller` in runSim; `done` is true once the last step has settled.
 */
export function continuous(power: string, path: string[]) {
  const steps = path.filter((s) => !s.startsWith('enter '));
  let i = 0;
  let move: Move | null = null;
  let t = 0;
  let still = 0;
  return {
    done: () => i >= steps.length,
    controller(w: World): Action[] {
      calm(w);
      const step = steps[i];
      if (step === undefined) return [];
      if (!move) {
        const m = /^(tank|jason)@-?\d+,-?\d+ (\S+)$/.exec(step);
        if (!m) throw new Error(`not a continuous step: ${step}`);
        const form: Form = sophiaState(w.player).jason ? 'jason' : 'tank';
        move = moves(form, power, /water/.test(w.level.theme), true).find((x) => x.name === m[2]) ?? null;
        if (!move) throw new Error(`no move: ${step}`);
        t = 0;
        still = 0;
      }
      if (t++ < move.frames) return move.act(w, t);
      still = settled(w) ? still + 1 : 0;
      if (still >= 3) {
        i++;
        move = null;
      }
      return [];
    },
  };
}
