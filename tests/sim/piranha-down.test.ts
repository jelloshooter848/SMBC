import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Piranha } from '@game/entities/enemies/piranha';
import { T } from '@game/level/tiles';
import { px, toPx } from '@engine/math/units';
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
});
