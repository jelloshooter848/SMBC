import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Piranha } from '@game/entities/enemies/piranha';
import { Corpse } from '@game/entities/effects/effects';
import { T, isSolid } from '@game/level/tiles';
import { px, toPx } from '@engine/math/units';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { View } from '@game/entities/entity';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** A ceiling with a pipe hanging from it: body `{}` on rows 2-9 at columns 12-13, rim `DG` on row 10. */
const hangingPipe = (): LevelData => {
  const rows = Array.from({ length: 13 }, (_, y) => {
    const row = (y < 2 ? '#' : '.').repeat(48).split('');
    if (y >= 2 && y <= 9) row.splice(12, 2, '{', '}');
    if (y === 10) row.splice(12, 2, 'D', 'G');
    return row.join('');
  });
  return parseTextMap(
    [
      'id: t',
      'time: 300',
      'start: 2,12',
      '',
      '[tiles]',
      ...rows,
      '#'.repeat(48),
      '#'.repeat(48),
      '',
      '[entities]',
      'piranha-down 12 10',
    ].join('\n'),
  );
};
const RIM_BOTTOM = 11 * 16; // px: the pipe's mouth faces down here

/** Where render() puts a sprite (world px), via a renderer that records its calls. */
function drawn(e: Piranha | Corpse, w: World): { x: number; y: number; flipY: boolean } {
  const calls: { x: number; y: number; flipY: boolean }[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    sprite(_s: SpriteSheet, _f: string, x: number, y: number, _fx = false, flipY = false): void {
      calls.push({ x, y, flipY });
    },
  });
  const view = {
    camX: 0,
    frame: w.frame,
    assets: { sheet: () => ({}) },
    theme: 'overworld',
  } as unknown as View;
  e.render(r, view);
  expect(calls).toHaveLength(1);
  return calls[0] as { x: number; y: number; flipY: boolean };
}

const plant = (w: World): Piranha | undefined => w.entities.find((e): e is Piranha => e instanceof Piranha);

/** Stand the player with its centre under the pipe's centre (column 13's left edge). */
function underPipe(w: World): void {
  const b = w.player.body;
  b.x = px(13 * 16) - b.w / 2;
  b.y = px(13 * 16) - b.h;
  b.vx = 0;
  b.vy = 0;
}

describe('upside-down piranha plant (The Lost Levels)', () => {
  it('parses the hanging pipe rim tiles', () => {
    const l = hangingPipe();
    expect(l.tiles[10 * l.width + 12]).toBe(T.PIPE_BOTTOM_L);
    expect(l.tiles[10 * l.width + 13]).toBe(T.PIPE_BOTTOM_R);
    expect(l.entities).toContainEqual({ type: 'piranha-down', x: 12, y: 10 });
  });

  it('comes down out of the rim while the player is far away, then goes back in', () => {
    let p: Piranha | undefined;
    let maxH = 0;
    let wasOut = false;
    let backIn = false;
    runSim({
      level: hangingPipe(),
      character: MARIO,
      script: none,
      maxFrames: 400,
      controller: (w) => {
        p ??= plant(w);
        if (p) {
          const h = toPx(p.body.h);
          if (h > 0) expect(toPx(p.body.y)).toBe(RIM_BOTTOM); // it hangs from the rim's bottom edge
          if (h >= 24) wasOut = true;
          if (wasOut && h === 0) backIn = true;
          maxH = Math.max(maxH, h);
        }
        return [];
      },
    });
    expect(p?.hanging).toBe(true);
    expect(p?.stompable).toBe(false);
    expect(maxH).toBe(24);
    expect(backIn).toBe(true);
    // Centred on the 32px pipe.
    expect(toPx((p as Piranha).body.x) + 6).toBe(12 * 16 + 16);
  });

  it('stays inside while the player stands right under it', () => {
    let maxH = 0;
    const r = runSim({
      level: hangingPipe(),
      character: MARIO,
      script: none,
      maxFrames: 400,
      controller: (w) => {
        underPipe(w);
        const p = plant(w);
        if (p) maxH = Math.max(maxH, toPx(p.body.h));
        return [];
      },
    });
    expect(plant(r.world)).toBeDefined();
    expect(maxH).toBe(0);
  });

  it('hurts on contact: big Mario walking into it shrinks', () => {
    let hitAt = -1;
    const r = runSim({
      level: hangingPipe(),
      character: MARIO,
      state: { powerState: 'big' },
      script: none,
      maxFrames: 400,
      until: (w) => w.player.powerState !== 'big',
      controller: (w, f) => {
        const p = plant(w);
        // Once it is all the way out, put big Mario under it: his head (24 px up) reaches into it.
        if (hitAt < 0 && p && toPx(p.body.h) >= 24) {
          hitAt = f;
          underPipe(w);
        }
        return [];
      },
    });
    expect(hitAt).toBeGreaterThan(0);
    expect(r.world.player.powerState).toBe('small');
    expect(r.outcome).toBe('stopped');
  });

  it('is killed by a fireball like the upright one', () => {
    let p: Piranha | undefined;
    runSim({
      level: hangingPipe(),
      character: MARIO,
      script: none,
      maxFrames: 200,
      controller: (w) => {
        p ??= plant(w);
        if (p && p.alive && toPx(p.body.h) >= 24) {
          expect(p.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, w)).toBe('kill');
        }
        return [];
      },
    });
    expect(p?.alive).toBe(false);
  });

  it('is knocked out head-down, as it hung', () => {
    let corpse: Corpse | undefined;
    runSim({
      level: hangingPipe(),
      character: MARIO,
      script: none,
      maxFrames: 200,
      controller: (w) => {
        const p = plant(w);
        if (p && toPx(p.body.h) >= 24) {
          expect(drawn(p, w)).toEqual({ x: 12 * 16 + 8, y: RIM_BOTTOM, flipY: true });
          p.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, w);
        }
        corpse ??= w.entities.find((e): e is Corpse => e instanceof Corpse);
        return [];
      },
    });
    expect(corpse?.mirrorY).toBe(true);
  });
});

describe('upright piranha plants sit centred on their pipes (SMB1)', () => {
  const level = (world: number, id: string): LevelData =>
    parseTextMap(
      readFileSync(join(import.meta.dirname, `../../src/content/levels/world${world}`, `${id}.map`), 'utf8'),
      id,
    );

  it.each([
    ['1-2', 103],
    ['1-2', 109],
    ['4-1', 21],
    ['4-1', 116],
  ])('%s: the plant in the pipe at column %i', (id, tx) => {
    const l = level(Number(id[0]), id);
    const spawn = l.entities.find((e) => e.type === 'piranha' && e.x === tx);
    expect(spawn).toBeDefined();
    const ty = (spawn as { y: number }).y;
    expect(l.tiles[ty * l.width + tx]).toBe(T.PIPE_TL);
    // Start on the ground six columns left of the pipe (far enough that the plant comes out).
    const sx = tx - 6;
    let sy = 1;
    while (sy < 14 && !isSolid(l.tiles[(sy + 1) * l.width + sx] as number)) sy++;
    let seen: { x: number; y: number; flipY: boolean } | undefined;
    let hitbox = -1;
    runSim({
      level: l,
      character: MARIO,
      script: none,
      start: { x: sx, y: sy, mode: 'stand' },
      maxFrames: 300,
      until: () => seen !== undefined,
      controller: (w) => {
        const p = w.entities.find(
          (e): e is Piranha =>
            e instanceof Piranha && toPx(e.body.x) < tx * 16 + 32 && toPx(e.body.x) >= tx * 16,
        );
        if (p && toPx(p.body.h) >= 24) {
          seen = drawn(p, w);
          hitbox = toPx(p.body.x) + toPx(p.body.w) / 2;
        }
        return [];
      },
    });
    expect(seen).toEqual({ x: tx * 16 + 8, y: ty * 16 - 24, flipY: false });
    expect(hitbox).toBe(tx * 16 + 16);
  });
});
