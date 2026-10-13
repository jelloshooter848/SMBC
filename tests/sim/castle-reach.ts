/*
 * BOWSER'S CASTLE (internal 8-5, 0.4.55): a completability search for EVERY hero, small and big,
 * ported from LV54's design sims (scratchpad lv54/tools/sim/reach.ts). It is sophia-reach.ts made
 * hero-agnostic: from the level's start (or a checkpoint), a best-first search over where the hero
 * can stand, run with the real game in fresh Worlds (enemies removed, invulnerable, endless time).
 * Each step from a standing spot is a short scripted move (walk, run, jump held or tapped, straight
 * up then over, a run-up jump, a jump from the very edge, timed jumps for lifts); landing on a
 * lift, it rides a while and jumps off either way (up to eight lifts in a row). The maze's loop
 * state travels with each spot. It answers "can this hero get through", not "how hard is it".
 * The castle's sections, checkpoint to checkpoint, are CASTLE_LEGS (bowsers-castle-reach*.test.ts).
 */
import type { Action } from '@engine/input/actions';
import { px, tileAt, toPx } from '@engine/math/units';
import { runSim } from '@game/sim/headless';
import { groundBelow } from '@game/entities/body';
import { Enemy } from '@game/entities/enemies/enemy';
import type { CharacterDef } from '@game/characters/character';
import type { LevelData } from '@game/level/schema';
import type { World, WorldStart } from '@game/world/world';

interface Spot {
  x: number;
  y: number;
  cam: number;
  checks: string[];
  path: string[];
}
interface Move {
  name: string;
  act: (w: World, f: number) => Action[];
  frames: number;
}
export interface ReachResult {
  done: boolean;
  how: string | null;
  spots: number;
  played: number;
  furthest: number;
  path: string[];
}

const calm = (w: World) => {
  for (const e of w.entities) if (e instanceof Enemy) e.alive = false;
};
type Internals = { loopChecks: Set<string>; loopPrevX: number | null };

function untilLanded(act: Move['act']): Move['act'] {
  let air = false;
  let done = false;
  return (w, f) => {
    const b = w.player.body;
    // (f > 4: the first frames after the setup's teleport may read as airborne)
    if (!b.onGround && f > 4) air = true;
    else if (air && b.onGround) done = true;
    return done ? [] : act(w, f);
  };
}

function moves(): Move[] {
  const out: Move[] = [];
  const jumpy = (name: string, frames: number, act: Move['act']) =>
    out.push({ name, frames, act: untilLanded(act) });
  const hold = (name: string, a: Action[], frames: number) => out.push({ name, act: () => a, frames });
  for (const d of ['right', 'left'] as const) {
    const o: Action = d === 'right' ? 'left' : 'right';
    hold(`walk-${d}`, [d], 14);
    hold(`run-${d}`, [d, 'run'], 40);
    jumpy(`drop-${d}`, 200, () => [d]);
    jumpy(`jump-${d}`, 90, (_w, f) => (f < 70 ? [d, 'jump'] : [d]));
    jumpy(`hop-${d}`, 60, (_w, f) => (f < 2 ? [d, 'jump'] : [d]));
    jumpy(`up-${d}`, 90, (_w, f) => (f < 24 ? ['jump'] : f < 70 ? [d, 'jump'] : [d]));
    jumpy(`long-${d}`, 110, (_w, f) => (f < 24 ? [d, 'run'] : f < 90 ? [d, 'run', 'jump'] : [d, 'run']));
    jumpy(`late-${d}`, 90, (_w, f) => (f < 30 ? ['jump'] : f < 70 ? [d, 'jump'] : [d]));
    for (const [back, run] of [
      [0, false],
      [0, true],
      [24, true],
      [48, true],
      [48, false],
    ] as const) {
      let jumpAt = -1;
      const r: Action[] = run ? ['run'] : [];
      jumpy(`edge${back ? `-runup${back}` : ''}${run ? '-run' : ''}-${d}`, back + 220, (w, f) => {
        if (f <= back) return [o];
        if (jumpAt < 0) {
          const b = w.player.body;
          // The body's front edge past the floor's end: jump.
          const front = d === 'right' ? b.x + b.w - px(2) : b.x + px(2);
          const col = tileAt(front);
          const row = tileAt(b.y + b.h);
          const floor = w.map.isSolid(col, row) || w.map.collisionAt(col, row) === 'top';
          if (!floor || f > back + 150) jumpAt = f;
          else return [d, ...r];
        }
        return f - jumpAt < 70 ? [d, ...r, 'jump'] : [d, ...r];
      });
    }
  }
  for (const d of ['right', 'left'] as const)
    for (const wait of [20, 60, 100, 140])
      jumpy(`wait${wait}-${d}`, wait + 110, (_w, f) => (f < wait ? [] : f < wait + 70 ? [d, 'jump'] : [d]));
  hold('jump', ['jump'], 80);
  return out;
}

function settled(w: World): boolean {
  const p = w.player;
  return p.body.onGround && p.body.vx === 0 && !p.vine && groundBelow(p.body, w.map);
}

interface Ride {
  wait: number;
  dir: 'right' | 'left';
  drive: boolean;
  jump: boolean;
}
const RIDES: [number, boolean][] = [
  [1, false],
  [10, true],
  [24, true],
  [40, false],
  [70, false],
  [100, false],
  [130, false],
  [170, false],
  [210, false],
  [260, false],
  [310, false],
];

interface Outcome {
  kind: 'stand' | 'done' | 'lost' | 'lift';
  spot?: Omit<Spot, 'path'>;
  how?: string;
}

function play(
  spot: Spot | null,
  level: LevelData,
  hero: CharacterDef,
  power: string,
  move: Move | null,
  start?: WorldStart,
  ride?: Ride,
): Outcome {
  let result: Outcome = { kind: 'lost' };
  let phase: 'setup' | 'move' | 'settle' = spot ? 'setup' : 'settle';
  let t = 0;
  let still = 0;
  let onLift = 0;
  let rides = 0;
  let rideJump = 0;
  let liftSeen = false;
  const r = runSim({
    level,
    character: hero,
    script: { steps: [] },
    maxFrames: (move?.frames ?? 0) + (ride ? 3000 : 500),
    assist: { invulnerable: true, infiniteTime: true },
    state: { powerState: power },
    start: spot ? { x: tileAt(spot.x + px(6)), y: tileAt(spot.y + px(8)), mode: 'stand' } : (start ?? {}),
    controller: (w, f) => {
      calm(w);
      const p = w.player;
      const b = p.body;
      if (phase === 'setup' && spot) {
        const internals = w as unknown as Internals;
        if (f === 0) {
          for (const c of spot.checks) internals.loopChecks.add(c);
          b.x = spot.x;
          b.y = spot.y;
          b.vx = 0;
          b.vy = 0;
          w.camera.x = spot.cam;
          internals.loopPrevX = toPx(p.centerX);
          return [];
        }
        phase = 'move';
        t = 0;
      }
      if (phase === 'move' && move) {
        if (t > 4 && b.onGround && !groundBelow(b, w.map) && !p.vine) {
          liftSeen = true;
          if (ride) phase = 'settle';
        }
      }
      if (phase === 'move' && move) {
        if (t++ < move.frames) return move.act(w, t);
        phase = 'settle';
      }
      phase = 'settle';
      if (rideJump > 0 && ride) {
        rideJump++;
        if (rideJump === 2) return [ride.dir];
        if (!ride.jump) {
          if (!b.onGround || rideJump < 40) return [ride.dir];
          rideJump = 0;
        } else {
          if (rideJump < 10 || (!b.onGround && rideJump < 150)) return [ride.dir, 'jump'];
          rideJump = 0;
        }
      }
      if (b.onGround && !groundBelow(b, w.map) && !p.vine) {
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
      if (w.bossClear) {
        result = { kind: 'done', how: 'axe' };
        return true;
      }
      return phase === 'settle' && still >= 3;
    },
  });
  if (result.kind === 'done') return result;
  for (const e of r.events) if (e.type === 'exit') return { kind: 'done', how: 'exit' };
  const w = r.world;
  if (r.outcome !== 'stopped' || w.player.dead) return { kind: liftSeen && !ride ? 'lift' : 'lost' };
  const p = w.player;
  return {
    kind: 'stand',
    spot: {
      x: p.body.x,
      y: p.body.y,
      cam: w.camera.x,
      checks: [...(w as unknown as Internals).loopChecks].sort(),
    },
  };
}

const keyOf = (s: Omit<Spot, 'path'>) =>
  [tileAt(s.x + px(4)), tileAt(s.y + px(8)), s.checks.join(',')].join(':');

/**
 * Can `hero` in `power` finish `level` (the axe) from its start, or from column `fromX` (a
 * checkpoint)? `stopAt`: a column that counts as done (a section's end).
 */
export function reach(
  level: LevelData,
  hero: CharacterDef,
  power: string,
  opts: { budget?: number; from?: WorldStart; stopAt?: number } = {},
): ReachResult {
  const budget = opts.budget ?? 8000;
  const seen = new Set<string>();
  const queue: Spot[] = [];
  let furthest = 0;
  let played = 0;
  const handle = (o: Outcome, from: Spot | null, name: string): ReachResult | null => {
    const path = [...(from?.path ?? []), name];
    if (o.kind === 'done')
      return { done: true, how: o.how ?? null, spots: seen.size, played, furthest, path };
    if (o.kind === 'stand' && o.spot) {
      if (opts.stopAt !== undefined && tileAt(o.spot.x) >= opts.stopAt)
        return { done: true, how: `col ${tileAt(o.spot.x)}`, spots: seen.size, played, furthest, path };
      const k = keyOf(o.spot);
      if (seen.has(k)) return null;
      seen.add(k);
      furthest = Math.max(furthest, tileAt(o.spot.x));
      queue.push({ ...o.spot, path });
    }
    return null;
  };
  const first = handle(
    play(null, level, hero, power, null, opts.from ?? { mode: level.startMode }),
    null,
    'start',
  );
  if (first) return first;
  const ms = moves();
  while (queue.length && played < budget) {
    let bi = 0;
    let best = -Infinity;
    queue.forEach((q, i) => {
      const score = tileAt(q.x) - q.path.length * 0.01;
      if (score > best) {
        best = score;
        bi = i;
      }
    });
    const s = queue.splice(bi, 1)[0] as Spot;
    for (const m of ms) {
      const fresh = (): Move => moves().find((x) => x.name === m.name) as Move;
      played++;
      const tag = `@${tileAt(s.x)},${tileAt(s.y + px(8))} ${m.name}`;
      const o = play(s, level, hero, power, fresh());
      const res = handle(o, s, tag);
      if (res) return res;
      if (o.kind === 'lift')
        for (const [wait, drive] of RIDES)
          for (const dir of ['right', 'left'] as const)
            for (const jump of [true, false]) {
              if (!jump && drive) continue;
              played++;
              const rr = handle(
                play(s, level, hero, power, fresh(), undefined, { wait, dir, drive, jump }),
                s,
                `${tag} ride${drive ? '-drive' : ''}${jump ? '' : '-walk'}${wait}-${dir}`,
              );
              if (rr) return rr;
            }
    }
  }
  return { done: false, how: null, spots: seen.size, played, furthest, path: [] };
}

/** BOWSER'S CASTLE's sections: [label, start (null: the level's), the column that ends it (null: the axe)]. */
export const CASTLE_LEGS: readonly [string, { x: number; y: number } | null, number | null][] = [
  ['A entrance hall', null, 76],
  ['B fire-bar gauntlet', { x: 76, y: 9 }, 190],
  ['C lava lake', { x: 190, y: 7 }, 290],
  ['D twin halls', { x: 290, y: 7 }, 408],
  ['E guard room', { x: 408, y: 9 }, 474],
  ["F king's bridge", { x: 474, y: 9 }, null],
];
