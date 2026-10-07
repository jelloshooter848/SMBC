import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { ScriptedInput } from '@game/sim/headless';
import type { Action } from '@engine/input/actions';
import { px, tileAt, toPx } from '@engine/math/units';

function field(
  enemies = '............g...................................',
): ReturnType<typeof parseTextMap> {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(48));
  rows[12] = enemies;
  return parseTextMap(
    ['id: t', 'time: 300', 'start: 2,12', '', '[tiles]', ...rows, '#'.repeat(48), '#'.repeat(48)].join('\n'),
  );
}

function coopWorld(enemies?: string) {
  const state = newGameState(MARIO, LINK);
  const world = new World(
    field(enemies),
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

function run(world: World, frames: number, p1: Action[], p2: Action[]): void {
  const a = new ScriptedInput({ steps: [] });
  const b = new ScriptedInput({ steps: [] });
  for (let f = 0; f < frames; f++) {
    a.setHeld(p1);
    b.setHeld(p2);
    a.next();
    b.next();
    world.update([a, b]);
  }
}

describe('two-player co-op', () => {
  it('spawns two players with their own characters and a shared life pool', () => {
    const { world, state } = coopWorld();
    expect(world.players).toHaveLength(2);
    expect(world.players[0]?.def.id).toBe('mario');
    expect(world.players[1]?.def.id).toBe('link');
    expect(state.lives).toBe(5);
  });

  it('a dead player respawns beside the survivor and costs one shared life', () => {
    const { world, state } = coopWorld();
    // Player one walks into the goomba as small Mario; player two waits.
    run(world, 400, ['right'], []);
    const p1 = world.players[0]!;
    expect(world.events.some((e) => e.type === 'died')).toBe(false);
    expect(state.lives).toBe(4);
    expect(p1.dead).toBe(false);
    expect(p1.out).toBe(false);
    expect(p1.invuln).toBeGreaterThan(0);
  });

  it('the camera follows the right-most player and the other is held at the left edge', () => {
    const { world } = coopWorld('.'.repeat(48));
    run(world, 600, ['right', 'attack'], []);
    const [p1, p2] = world.players as [typeof world.player, typeof world.player];
    expect(p1.body.x).toBeGreaterThan(p2.body.x);
    expect(p2.body.x).toBeGreaterThanOrEqual(world.camera.x);
    expect(world.camera.x).toBeGreaterThan(0);
  });

  it('when the lives run out the last death ends the level', () => {
    const { world, state } = coopWorld();
    state.lives = 0;
    run(world, 400, ['right'], []);
    expect(world.players[0]?.out).toBe(true);
    expect(world.events.some((e) => e.type === 'died')).toBe(false); // player two is still alive
    world.players[1]!.hp = 1;
    run(world, 1200, [], ['left']); // walk into the returning goomba
    expect(world.events.some((e) => e.type === 'died')).toBe(true);
  });
});

/** A block hanging over the floor (columns 10-11, rows 6-9), the two heroes starting under it. */
function hangingWorld() {
  const rows = Array.from({ length: 13 }, (_, y) =>
    y >= 6 && y <= 9 ? '.'.repeat(10) + '##' + '.'.repeat(36) : '.'.repeat(48),
  );
  const level = parseTextMap(
    ['id: t', 'time: 300', 'start: 9,12', '', '[tiles]', ...rows, '#'.repeat(48), '#'.repeat(48)].join('\n'),
  );
  return new World(
    level,
    {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    },
    newGameState(MARIO, LINK),
  );
}

/** Both players hold left and jump against a screen edge held at `edge` (px): overlap and apexes. */
function edgeRun(world: World, edge: number, frames: number, left = true) {
  const a = new ScriptedInput({ steps: [] });
  const b = new ScriptedInput({ steps: [] });
  let inside = 0;
  const top = [Infinity, Infinity];
  for (let f = 0; f < frames; f++) {
    world.camera.x = px(edge);
    const keys: Action[] = [
      ...(left ? (['left'] as Action[]) : []),
      ...(f % 40 < 30 ? (['jump'] as Action[]) : []),
    ];
    a.setHeld(keys);
    b.setHeld(keys);
    a.next();
    b.next();
    world.update([a, b]);
    world.players.forEach((p, i) => {
      const bd = p.body;
      for (let ty = tileAt(bd.y + 64); ty <= tileAt(bd.y + bd.h - 65); ty++)
        for (let tx = tileAt(bd.x + 64); tx <= tileAt(bd.x + bd.w - 65); tx++)
          if (world.map.isSolid(tx, ty)) inside++;
      top[i] = Math.min(top[i] as number, toPx(bd.y));
    });
  }
  return { inside, top };
}

describe('the screen edge pushing players (World.unsqueeze)', () => {
  it.each([0, 1])(
    'player %i (Mario, Link) pressed by the left edge 2 px under a block corner bumps it, never rises inside it',
    (i) => {
      // The edge where the hero overlaps the block by 2 px, inside the corner slip's reach: the
      // slip would take him past the corner and the edge would put him back, under the block.
      const w = hangingWorld();
      const width = toPx(w.players[i]!.body.w);
      const { inside, top } = edgeRun(w, 10 * 16 - width + 2, 300);
      expect(inside).toBe(0);
      // His head stops at the block's bottom (row 9 ends at 160).
      expect(top[i]).toBeGreaterThanOrEqual(160);
    },
  );

  it('with room at the edge their jumps are the same as in the open', () => {
    // Standing jumps 6 px from the edge, clear of the block, and far from anything.
    const wn = hangingWorld();
    for (const p of wn.players) p.body.x = px(126);
    const near = edgeRun(wn, 120, 120, false);
    const w = hangingWorld();
    for (const p of w.players) p.body.x = px(30 * 16);
    const free = edgeRun(w, 0, 120, false);
    expect(near.inside).toBe(0);
    expect(near.top).toEqual(free.top);
  });
});
