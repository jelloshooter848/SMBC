import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Koopa } from '@game/entities/enemies/koopa';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World, WorldEvent } from '@game/world/world';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/world7', `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const loops = (events: WorldEvent[]) => events.filter((e) => e.type === 'loop');

/** Put the player at column `col`, feet on top of row `floor`, and bring the camera along. */
function place(w: World, col: number, floor: number): void {
  const b = w.player.body;
  b.x = px(col * 16 + 2);
  b.y = px(floor * 16) - b.h;
  b.vy = 0;
  w.camera.snapTo(b.x);
}

describe('World 7: gliding paratroopas', () => {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(48));
  const flat = (): LevelData =>
    parseTextMap(
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
        'koopa-para-green-h 12 6',
      ].join('\n'),
    );

  it('sway side to side ±42.5 px while drifting half a tile up and down', () => {
    let k: Koopa | undefined;
    let minX = Infinity;
    let maxX = -Infinity;
    const ys = new Set<number>();
    runSim({
      level: flat(),
      character: MARIO,
      script: none,
      maxFrames: 300,
      controller: (w) => {
        k ??= w.entities.find((e): e is Koopa => e instanceof Koopa);
        if (k) {
          minX = Math.min(minX, toPx(k.body.x));
          maxX = Math.max(maxX, toPx(k.body.x));
          ys.add(toPx(k.body.y));
        }
        return [];
      },
    });
    expect(k?.glide).toBe(true);
    expect(k?.currentFrame).toMatch(/^koopa-fly-/);
    // KoopaGreen FT_HORZ: waveRange 85 Flash px end to end at our scale, and the vertical drift
    // between y ± TILE_SIZE/2 (8 px here).
    expect(maxX - minX).toBeGreaterThanOrEqual(84);
    expect(maxX - minX).toBeLessThanOrEqual(86);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(15);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(17);
  });

  it('lose their wings to a stomp and walk off', () => {
    let k: Koopa | undefined;
    const r = runSim({
      level: flat(),
      character: MARIO,
      script: none,
      maxFrames: 30,
      controller: (w) => {
        k ??= w.entities.find((e): e is Koopa => e instanceof Koopa);
        return [];
      },
    });
    const koopa = k as Koopa;
    expect(koopa.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, r.world)).toBe('shell');
    expect(koopa.wings).toBe(false);
    expect(koopa.state).toBe('walk');
    expect(koopa.body.vx).toBeLessThan(0);
  });
});

describe('World 7-4: the castle maze', () => {
  it('low, then middle, then the upper corridor skips the first repeat (79 -> 143)', () => {
    const r = runSim({
      level: level('7-4'),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 42, 13); // lower corridor, before the checkpoint at 43
        if (f === 30) place(w, 59, 10); // middle corridor, before the checkpoint at 60
        if (f === 50) place(w, 78, 6); // upper corridor, before the start at 79
        return ['right'];
      },
      until: (w) => toPx(w.player.body.x) > 130 * 16,
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 79, to: 143 }]);
  });

  it('walking the upper corridor straight through loops back from 143 to 79', () => {
    const r = runSim({
      level: level('7-4'),
      character: MARIO,
      script: none,
      maxFrames: 500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 78, 6); // crossing 79 with no checkpoints does nothing
        if (f === 45) place(w, 106, 6); // then pass the checkpoint at 107
        if (f === 75) place(w, 142, 6); // and reach the start-one column at 143
        return ['right'];
      },
      until: (w, f) => f > 76 && toPx(w.player.body.x) < 100 * 16,
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 143, to: 79 }]);
    expect(toPx(r.world.player.body.x)).toBeLessThan(82 * 16);
  });
});

describe('World 7 areas', () => {
  it('every area loads and runs', () => {
    for (const id of ['7-1', '7-1-bonus', '7-2-intro', '7-2', '7-2-exit', '7-3', '7-4']) {
      const r = runSim({ level: level(id), character: MARIO, script: none, maxFrames: 60 });
      expect(r.frames).toBe(60);
    }
  });
});
