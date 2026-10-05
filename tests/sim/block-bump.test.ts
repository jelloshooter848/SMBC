import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { MARIO } from '@game/characters/mario';
import { ScriptedInput } from '@game/sim/headless';
import type { Enemy } from '@game/entities/enemies/enemy';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Spiny } from '@game/entities/enemies/spiny';

// A block bumped under an enemy, as the original Crossover's gBounceHit overrides do it:
// KoopaGreen (and KoopaRed / Beetle, which extend it) pops into its shell and hops away from the
// block, Spiney only bounces, everything else dies for its BELOW score (Enemy.gBounceHit).

const BLOCK_COL = 10;
const BLOCK_ROW = 9;
const BLOCK_TOP = BLOCK_ROW * 16; // px
const BLOCK_MID = BLOCK_COL * 16 + 8; // px

/** A flat 48-column field with a brick at (10, 9); Mario starts at column 2. */
function setup() {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(48));
  rows[BLOCK_ROW] = '.'.repeat(BLOCK_COL) + '=' + '.'.repeat(48 - BLOCK_COL - 1);
  const level = parseTextMap(
    ['id: t', 'time: 300', 'start: 2,12', '', '[tiles]', ...rows, '#'.repeat(48), '#'.repeat(48)].join('\n'),
  );
  const state = newGameState(MARIO);
  const world = new World(
    level,
    {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    },
    state,
  );
  return { world, state };
}

function runUntil(world: World, until: () => boolean, max: number, held: Action[] = []): number {
  const input = new ScriptedInput({ steps: [] });
  for (let f = 0; f < max; f++) {
    if (until()) return f;
    input.setHeld(held);
    input.next();
    world.update([input]);
  }
  return max;
}

const run = (world: World, frames: number) => runUntil(world, () => false, frames);

/** Stand `e` on the brick with its centre `dx` px from the brick's middle, then bump the brick. */
function bumpUnder<E extends Enemy>(e: E, dx: number) {
  const { world, state } = setup();
  e.body.x = px(BLOCK_MID + dx) - e.body.w / 2;
  e.body.y = px(BLOCK_TOP) - e.body.h;
  e.body.onGround = true;
  e.activated = true;
  world.spawn(e);
  world.strikeBlock(BLOCK_COL, BLOCK_ROW, world.player, false);
  return { world, state };
}

describe('a block bumped under a Koopa or Buzzy Beetle (KoopaGreen.gBounceHit)', () => {
  for (const color of ['green', 'red', 'buzzy'] as const) {
    for (const [side, dx, dir] of [
      ['left of', -6, -1],
      ['right of', 6, 1],
    ] as const) {
      it(`${color}: ${side} the middle, it pops into its shell, hops away, stops on landing, no score`, () => {
        const k = new Koopa(0, 0, color);
        const { world, state } = bumpUnder(k, dx);
        expect(k.alive).toBe(true);
        expect(k.state).toBe('shell');
        expect(state.score).toBe(0);
        expect(Math.sign(k.body.vx)).toBe(dir);
        expect(k.body.vx * dir).toBe(k.walkSpeed);
        expect(k.body.vy).toBeLessThan(0);

        const x0 = k.body.x;
        const frames = runUntil(world, () => k.body.onGround && k.body.y > px(BLOCK_TOP), 120);
        expect(frames).toBeLessThan(120);
        expect(Math.sign(k.body.x - x0)).toBe(dir);
        // The landed shell lies still (KoopaGreen.updateStats: ST_SHELL on the ground has vx 0).
        run(world, 2);
        const x1 = k.body.x;
        expect(k.body.vx).toBe(0);
        run(world, 60);
        expect(k.body.x).toBe(x1);
        expect(k.isStillShell).toBe(true);
        expect(state.score).toBe(0);

        // The shell timers started, so it walks out again later.
        runUntil(world, () => k.state === 'walk', 400);
        expect(k.state).toBe('walk');
        expect(k.alive).toBe(true);
      });
    }

    it(`${color}: walking into the bumped shell kicks it for 400 (KICK_SHELL_NORMAL)`, () => {
      const k = new Koopa(0, 0, color);
      const { world, state } = bumpUnder(k, -6);
      runUntil(world, () => k.isMovingShell, 240, ['right']);
      expect(k.isMovingShell).toBe(true);
      expect(k.body.vx).toBeGreaterThan(0);
      expect(state.score).toBe(400);
      expect(world.player.dead).toBe(false);
    });
  }

  it('a hopping green Paratroopa standing on the block loses its wings into the shell', () => {
    const k = new Koopa(0, 0, 'green', true);
    const { state } = bumpUnder(k, 6);
    expect(k.alive).toBe(true);
    expect(k.wings).toBe(false);
    expect(k.state).toBe('shell');
    expect(k.body.vx).toBeGreaterThan(0);
    expect(state.score).toBe(0);
  });

  it('a flying red Paratroopa is not reached by the bump (it never stands on the block)', () => {
    const k = new Koopa(0, 0, 'red', true);
    const { state } = bumpUnder(k, 0);
    expect(k.alive).toBe(true);
    expect(k.wings).toBe(true);
    expect(k.state).toBe('walk');
    expect(state.score).toBe(0);
  });
});

describe('a block bumped under a Spiny only bounces it (Spiney.gBounceHit)', () => {
  for (const [side, dx, vx] of [
    // `if (nx < g.hMidX) vx = -vx`: walking left, left of the middle it turns right.
    ['left of', -6, 1],
    ['right of', 6, -1],
  ] as const) {
    it(`${side} the middle: survives unscored, pops up, walks ${vx > 0 ? 'right' : 'left'}`, () => {
      const s = new Spiny(0, 0, false);
      expect(s.body.vx).toBeLessThan(0);
      const { world, state } = bumpUnder(s, dx);
      expect(s.alive).toBe(true);
      expect(state.score).toBe(0);
      expect(s.body.vy).toBeLessThan(0);
      expect(Math.sign(s.body.vx)).toBe(vx);
      run(world, 120); // lands back on the brick, walks off it to the floor
      expect(s.alive).toBe(true);
      expect(s.body.onGround).toBe(true);
      expect(state.score).toBe(0);
    });
  }
});

describe('a block bumped under a Goomba still knocks it out (Enemy.gBounceHit)', () => {
  it('dies and scores GOOMBA_BELOW (100)', () => {
    const g = new Goomba(0, 0);
    const { state } = bumpUnder(g, 0);
    expect(g.alive).toBe(false);
    expect(state.score).toBe(100);
  });
});
