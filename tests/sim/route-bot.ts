import { toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import type { CharacterDef } from '@game/characters/character';
import type { LevelData } from '@game/level/schema';
import { runSim, type SimResult } from '@game/sim/headless';
import type { World } from '@game/world/world';

/*
 * A route bot for the level sims: real inputs only (the held buttons each frame), driven by what
 * the player can see (where the hero stands), from wherever the run starts. A route is a list of
 * moves, each finished before the next begins:
 *
 * - `walk`: walk to x (the body's left edge, px) and stand still there.
 * - `hop`: walk to `from` (when given) and stand, then walk (or run) in `dir` and press jump once
 *   the body's left edge passes `at` (`dir` 0: jump on the spot). In the air the bot keeps
 *   holding `dir` (a committed jump flies its own arc whatever is held), or with `steer` it holds
 *   toward that x once the feet are above `over` (px; a hero with air control rises clear of an
 *   overhang first, then moves over the ledge it aims for). Landed, it lets go and stands.
 *   `boost`: keep pressing jump while on the ground (a springboard's high launch). Done once the
 *   hero has stood still on something for a moment.
 * - `exit`: the run over the pole: once any hidden path is laid, run right; jump (held) from the
 *   ground once the body's right edge reaches `jumpAt`, holding right on into the cave.
 */
export type Move =
  | { do: 'walk'; to: number }
  | {
      do: 'hop';
      dir: -1 | 0 | 1;
      at: number;
      from?: number;
      run?: boolean;
      steer?: number;
      over?: number;
      boost?: boolean;
      /** Frames the jump button is held (default 40). */
      hold?: number;
    }
  | { do: 'exit'; jumpAt: number };

export interface RouteResult {
  sim: SimResult;
  /** Moves finished. */
  done: number;
  /** Where the hero stood after each finished move: [left x, feet y] in px. */
  stands: [number, number][];
  touchedPole: boolean;
}

/** Frames standing still on the ground that end a hop or a walk. */
const SETTLE = 12;

const feet = (w: World) => toPx(w.player.body.y + w.player.body.h);
const left = (w: World) => toPx(w.player.body.x);

export function runRoute(opts: {
  level: LevelData;
  character: CharacterDef;
  power: string;
  start: { x: number; y: number };
  moves: readonly Move[];
  maxFrames?: number;
  /** Called after every frame (a test's own checks), with the move under way. */
  onFrame?: (w: World, frame: number, move: number) => void;
}): RouteResult {
  const moves = opts.moves;
  let i = 0;
  let phase: 'from' | 'approach' | 'air' | 'settle' = 'from';
  let still = 0;
  let jumpT = -1;
  let airborne = false;
  let touchedPole = false;
  const stands: [number, number][] = [];
  const next = (w: World) => {
    stands.push([left(w), feet(w)]);
    i++;
    phase = 'from';
    still = 0;
    jumpT = -1;
    airborne = false;
  };
  const toward = (x: number, to: number): Action[] => (to > x + 1 ? ['right'] : to < x - 1 ? ['left'] : []);
  const sim = runSim({
    level: opts.level,
    character: opts.character,
    assist: { invulnerable: true },
    state: { powerState: opts.power },
    script: { steps: [] },
    start: { ...opts.start, mode: 'stand', time: 400 },
    maxFrames: opts.maxFrames ?? 3000,
    controller: (w) => {
      const m = moves[i];
      if (!m) return [];
      const p = w.player.body;
      const x = left(w);
      const settled = () => {
        still = p.onGround && p.vx === 0 && p.vy === 0 ? still + 1 : 0;
        return still >= SETTLE;
      };
      if (m.do === 'walk') {
        const h = toward(x, m.to);
        if (!h.length && settled()) next(w);
        return h;
      }
      if (m.do === 'exit') {
        if (w.layingPath) return [];
        const hold: Action[] = ['right', 'run'];
        if (jumpT < 0 && p.onGround && x + toPx(p.w) >= m.jumpAt) jumpT = 0;
        if (jumpT >= 0 && jumpT++ < 40) hold.push('jump');
        return hold;
      }
      // hop
      if (phase === 'from') {
        if (m.from === undefined) phase = 'approach';
        else {
          const h = toward(x, m.from);
          if (h.length) return h;
          if (!settled()) return [];
          phase = 'approach';
          still = 0;
        }
      }
      const dirKey: Action[] = m.dir > 0 ? ['right'] : m.dir < 0 ? ['left'] : [];
      if (m.run) dirKey.push('run');
      if (phase === 'approach') {
        const passed = m.dir === 0 || (m.dir > 0 ? x >= m.at : x <= m.at);
        if (!passed) return dirKey;
        phase = 'air';
        jumpT = 0;
      }
      if (phase === 'air') {
        const hold: Action[] = [];
        if (jumpT >= 0 && jumpT++ < (m.hold ?? 40)) hold.push('jump');
        if (!p.onGround) airborne = true;
        if (!p.onGround || !airborne) {
          // Rising off the ground and in the air: toward the ledge once above it, else on as begun.
          if (m.steer !== undefined && feet(w) <= (m.over ?? Infinity)) hold.push(...toward(x, m.steer));
          else hold.push(...dirKey);
        } else if (m.steer !== undefined && feet(w) <= (m.over ?? Infinity)) hold.push(...toward(x, m.steer));
        // On a springboard: press jump as it squashes, for the high launch.
        if (m.boost && p.onGround && w.frame % 2 === 0) hold.push('jump');
        if (airborne && p.onGround) {
          if (settled()) next(w);
        } else still = 0;
        return [...new Set(hold)];
      }
      return [];
    },
    until: (w, f) => {
      opts.onFrame?.(w, f, i);
      touchedPole ||= !!w.flagGrabbedBy;
      return touchedPole;
    },
  });
  return { sim, done: i, stands, touchedPole };
}
