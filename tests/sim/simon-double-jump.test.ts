import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { SIMON, SIMON_PROFILE } from '@game/characters/simon';
import { heroStart } from '@game/items/heroes';
import type { World } from '@game/world/world';

// Simon's double jump (0.4.46, roadmap #27). The original Crossover's Simon.as has it in his base
// kit, no upgrade (`canDoubleJump`): set on the ground, by a ground jump, a stomp's bounce and
// leaving a spring; spent by the second jump; false when a level starts with him in the air
// (firstCollisionCheck); no jumping at all while a hit knocks him back (input off until he lands).
// The second jump is the first's strength (vy = -jumpPwr), and in the original's classic controls
// (Castlevania's fixed arc, as ours) it takes the direction held then, or stops him with none.
// True to the original, so in both modes.

/** A flat field; a wall (columns 10-11, top row 6) and a ledge (columns 0-5, top row 9) when asked. */
function field(opts: { wall?: boolean; ledge?: boolean } = {}) {
  const rows = Array.from({ length: 13 }, (_, y) =>
    Array.from({ length: 24 }, (_, x) =>
      (opts.wall && (x === 10 || x === 11) && y >= 6) || (opts.ledge && x <= 5 && y >= 9) ? 'B' : '.',
    ).join(''),
  );
  return parseTextMap(
    [
      'id: t',
      'time: 300',
      `start: ${opts.ledge ? '3,8' : '4,12'}`,
      '',
      '[tiles]',
      ...rows,
      '#'.repeat(24),
      '#'.repeat(24),
    ].join('\n'),
  );
}

const campaign = () => {
  const s = heroStart(SIMON);
  return { kit: s.kit, hp: s.hp, powerState: s.powerState };
};

type Frame = { y: number; vy: number; vx: number; ground: boolean };

/**
 * Simon played by `input(world, frame)`; his body at the start of each frame (so what input `f`
 * did shows at `f + 1`).
 */
function play(
  input: (w: World, f: number) => Action[],
  opts: {
    frames?: number;
    wall?: boolean;
    ledge?: boolean;
    classic?: boolean;
    start?: { x: number; y: number; mode: 'fall' };
  } = {},
) {
  const trace: Frame[] = [];
  const r = runSim({
    level: field(opts),
    character: SIMON,
    script: { steps: [] },
    maxFrames: opts.frames ?? 120,
    state: opts.classic ? { kit: {}, hp: 16, powerState: 'full' } : campaign(),
    ...(opts.start ? { start: opts.start } : {}),
    controller: (w, f) => {
      const b = w.player.body;
      trace.push({ y: toPx(b.y), vy: b.vy, vx: b.vx, ground: b.onGround });
      return input(w, f);
    },
  });
  const at = (f: number): Frame => trace[f] as Frame;
  return { r, trace, at, p: r.world.player };
}

const tier = SIMON_PROFILE.jump[0] as { initial: number; fallGravity: number };
/** The speed one frame after a jump (its push, then a frame of gravity). */
const JUMPED = -tier.initial + tier.fallGravity;

describe("Simon's double jump (the original's canDoubleJump)", () => {
  it('a second press in the air jumps again, as hard as the first; a third does nothing', () => {
    const { at } = play((_w, f) => (f === 5 || f === 25 || f === 45 ? ['jump'] : []));
    expect(at(5).ground).toBe(true);
    expect(at(6).vy).toBe(JUMPED);
    expect(at(25).ground).toBe(false);
    expect(at(26).vy).toBe(JUMPED);
    expect(at(45).ground).toBe(false);
    expect(at(46).vy).toBe(at(45).vy + tier.fallGravity);
  });

  it('it gets him onto a wall six blocks up that a single jump falls short of', () => {
    const single = play((_w, f) => ['right', ...(f === 14 ? (['jump'] as const) : [])], {
      wall: true,
      frames: 200,
    });
    expect(toPx(single.p.body.x + single.p.body.w)).toBeLessThanOrEqual(10 * 16);
    const double = play(
      (w, f) => {
        const b = w.player.body;
        if (f === 14) return ['right', 'jump'];
        if (f > 14 && !b.onGround && b.vy >= 0 && f < 70) return ['right', 'jump'];
        return ['right'];
      },
      { wall: true, frames: 200 },
    );
    expect(toPx(double.p.body.x)).toBeGreaterThan(10 * 16);
  });

  it('the second jump takes the direction held then, or stops him; the first arc stays fixed', () => {
    const left = play((_w, f) =>
      f === 5 ? ['right', 'jump'] : f < 30 ? ['right'] : f === 30 ? ['left', 'jump'] : ['left'],
    );
    expect(left.at(25).vx).toBeGreaterThan(0);
    expect(left.at(31).vx).toBe(-SIMON_PROFILE.maxWalk);
    const none = play((_w, f) =>
      f === 5 ? ['right', 'jump'] : f < 30 ? ['right'] : f === 30 ? ['jump'] : [],
    );
    expect(none.at(29).vx).toBeGreaterThan(0);
    expect(none.at(31).vx).toBe(0);
  });

  it('walking off a ledge leaves it to use', () => {
    let pressed = -1;
    const { at } = play(
      (w, f) => {
        const b = w.player.body;
        if (pressed < 0 && !b.onGround && f > 5) {
          pressed = f;
          return ['jump'];
        }
        return pressed < 0 ? ['right'] : [];
      },
      { ledge: true },
    );
    expect(pressed).toBeGreaterThan(0);
    expect(at(pressed + 1).vy).toBe(JUMPED);
  });

  it('a level begun in the air: none until he lands (the original firstCollisionCheck)', () => {
    const { at } = play((_w, f) => (f === 10 ? ['jump'] : []), { start: { x: 4, y: 2, mode: 'fall' } });
    expect(at(10).ground).toBe(false);
    expect(at(11).vy).toBeGreaterThan(0);
  });

  it('none while a hit knocks him back in the air; it comes back once he lands', () => {
    let hurtAt = -1;
    const { at, trace } = play((w, f) => {
      if (f === 5) return ['jump'];
      if (f === 15) {
        w.player.invuln = 0;
        w.hurtPlayer(w.player, 1);
        hurtAt = f;
      }
      // Pressed after the knock back's stun, still in the air.
      return f === 36 ? ['jump'] : [];
    });
    expect(hurtAt).toBe(15);
    expect(at(36).ground).toBe(false);
    expect(at(37).vy).toBeGreaterThan(at(36).vy);
    // Landed, then off the ground again: a press in the air jumps.
    const landed = trace.findIndex((t, i) => i > 36 && t.ground);
    expect(landed).toBeGreaterThan(36);
  });

  it('classic play too: his base kit in the original, no upgrade', () => {
    const { at } = play((_w, f) => (f === 5 || f === 25 ? ['jump'] : []), { classic: true });
    expect(at(26).vy).toBe(JUMPED);
  });
});
