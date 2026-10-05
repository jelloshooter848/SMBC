import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { autoPlayer, newBot } from '@game/sim/bot';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { PowerUp } from '@game/entities/objects/powerup';
import { BalanceLift } from '@game/entities/objects/balance-lift';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/lost/world1', `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** Put the player at column `col` (plus `dx` px), feet on top of row `floor`, camera along. */
function place(w: World, col: number, floor: number, dx = 2): void {
  const b = w.player.body;
  b.x = px(col * 16 + dx);
  b.y = px(floor * 16) - b.h;
  b.vy = 0;
  w.camera.snapTo(b.x);
}

/** Stand on the pipe whose left column is `col` (top at `top`) and press down. */
function downPipe(id: string, col: number, top: number) {
  const l = level(id);
  l.start = { x: col, y: top - 1 };
  l.startMode = 'stand';
  return runSim({
    level: l,
    character: MARIO,
    script: none,
    maxFrames: 200,
    assist: { invulnerable: true },
    controller: (w, f) => {
      if (f === 0) place(w, col, top, 8);
      return f > 2 ? ['down'] : [];
    },
  });
}

const AREAS = [
  'll-1-1',
  'll-1-1-bonus',
  'll-1-2-intro',
  'll-1-2',
  'll-1-2-warp',
  'll-1-2-exit',
  'll-1-2-under',
  'll-1-2-bonus',
  'll-1-3',
  'll-1-4',
];

describe('Lost Levels World 1 areas', () => {
  it.each(AREAS)('%s loads and runs 600 frames as Mario', (id) => {
    const r = runSim({
      level: level(id),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
    });
    if (id.endsWith('-intro')) {
      // The intro walks Mario into the side pipe by itself.
      expect(r.outcome).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
        target: { level: 'll-1-2', x: 1, y: 3 },
      });
    } else {
      expect(r.frames).toBe(600);
      for (const v of [r.playerX, r.playerY]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('Lost Levels 1-1', () => {
  it('the ? block at 28,9 holds a poison mushroom that kills small Mario', () => {
    const l = level('ll-1-1');
    l.entities = l.entities.filter((e) => e.type.startsWith('decor')); // just the block and Mario
    let poison: PowerUp | undefined;
    const r = runSim({
      level: l,
      character: MARIO,
      script: none,
      maxFrames: 600,
      controller: (w, f) => {
        if (f === 0) place(w, 28, 13, 2);
        poison ??= w.entities.find((e): e is PowerUp => e instanceof PowerUp);
        if (!poison) return f % 40 < 20 ? ['jump'] : [];
        // Walk into it as it slides.
        const dx = poison.body.x - w.player.body.x;
        return dx > 0 ? ['right'] : ['left'];
      },
      until: (w) => w.player.dead,
    });
    expect(poison?.item).toBe('poison');
    expect(toPx((poison as PowerUp).body.x)).toBeGreaterThanOrEqual(28 * 16 - 8);
    expect(r.world.player.dead).toBe(true);
    // Killed by the mushroom on the ground between the block and the pipe at 39, not by a pit.
    expect(poison?.alive).toBe(false);
    expect(toPx(r.world.player.body.x)).toBeLessThan(39 * 16);
  });

  it('the pipe at 128 leads to the bonus room, whose side pipe returns to the pipe at 163', () => {
    const r = downPipe('ll-1-1', 128, 9);
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: 'll-1-1-bonus', x: 1, y: 0 },
    });
    const bot = newBot();
    const back = runSim({
      level: level('ll-1-1-bonus'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      controller: (w) => autoPlayer(w, bot),
    });
    expect(back.outcome).toBe('pipe');
    expect(back.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: 'll-1-1', x: 163, y: 10, exitDir: 'up' },
    });
  });
});

describe('Lost Levels 1-2: the warp zone in three places', () => {
  it('the pipe at the end of 1-2 warps to 2-1', () => {
    const r = downPipe('ll-1-2', 214, 10);
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-2-1', x: 2, y: 12 },
    });
  });

  it('the treetops above the vine warp to 3-1', () => {
    const r = downPipe('ll-1-2-warp', 54, 10);
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-3-1', x: 2, y: 12 },
    });
  });

  it('the underground room warps to 4-1', () => {
    const r = downPipe('ll-1-2-under', 86, 10);
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-4-1', x: 2, y: 12 },
    });
  });

  it('the pipe at 191 drops into the underground room', () => {
    const r = downPipe('ll-1-2', 191, 11);
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: 'll-1-2-under', x: 1, y: 3 },
    });
  });

  it("small Mario can't walk through the brick wall in front of the World 4 pipe", () => {
    const r = runSim({
      level: level('ll-1-2-under'),
      character: MARIO,
      script: none,
      maxFrames: 180,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 58, 13);
        return ['right'];
      },
    });
    expect(r.outcome).toBe('timeout');
    expect(toPx(r.world.player.body.x + r.world.player.body.w)).toBeLessThanOrEqual(63 * 16);
  });

  it('climbing the vine area starts on the vine at the bottom of the screen', () => {
    const r = runSim({ level: level('ll-1-2-warp'), character: MARIO, script: none, maxFrames: 2 });
    expect(r.world.player.vine).not.toBeNull();
  });

  it('the side pipe at 170 leads to the exit area, which ends at the flag and moves on to 1-3', () => {
    const r = runSim({
      level: level('ll-1-2'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 167, 10);
        return ['right'];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: 'll-1-2-exit', x: 3, y: 10, exitDir: 'up' },
    });
    const bot = newBot();
    const exit = runSim({
      level: level('ll-1-2-exit'),
      character: MARIO,
      script: none,
      maxFrames: 3000,
      assist: { invulnerable: true },
      controller: (w) => autoPlayer(w, bot),
    });
    expect(exit.outcome).toBe('cleared');
    expect(exit.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'll-1-3' });
  });

  it('the 32-wide bonus room scrolls as Mario crosses it on foot to its side pipe back to 131', () => {
    let pipeOnScreen = false;
    const r = runSim({
      level: level('ll-1-2-bonus'),
      character: MARIO,
      script: none,
      maxFrames: 1200,
      assist: { invulnerable: true },
      controller: (w) => {
        // The exit pipe's mouth (column 29) comes into view.
        if (w.camera.right >= px(31 * 16)) pipeOnScreen = true;
        const b = w.player.body;
        // Hop the blaster at column 16.
        const near = toPx(b.x) > 12 * 16 && toPx(b.x) < 16 * 16;
        return near && b.onGround ? ['right', 'jump'] : ['right'];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: 'll-1-2', x: 131, y: 10, exitDir: 'up' },
    });
    expect(pipeOnScreen).toBe(true);
  });
});

describe('Lost Levels 1-3', () => {
  it('standing on a balance lift lowers it and raises its partner', () => {
    let lift: BalanceLift | undefined;
    let y0: [number, number] | null = null;
    const r = runSim({
      level: level('ll-1-3'),
      character: MARIO,
      script: none,
      maxFrames: 90,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 20, 6);
        lift ??= w.entities.find((e): e is BalanceLift => e instanceof BalanceLift);
        const p = lift?.platforms;
        if (p && !y0) {
          y0 = [p[0].body.y, p[1].body.y];
          place(w, 27, 6);
        }
        return [];
      },
    });
    const p = (lift as BalanceLift).platforms;
    expect(p).not.toBeNull();
    const [left, right] = p as NonNullable<typeof p>;
    const start = y0 as unknown as [number, number];
    expect(left.body.y).toBeGreaterThan(start[0]);
    expect(right.body.y).toBeLessThan(start[1]);
    expect(r.world.player.dead).toBe(false);
  });
});

describe('Lost Levels 1-4', () => {
  it('Bowser breathes fire (no hammers) and the axe leads on to 2-1', () => {
    let bowser: Bowser | undefined;
    const r = runSim({
      level: level('ll-1-4'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 141, 9, 0);
        bowser ??= w.entities.find((e): e is Bowser => e instanceof Bowser);
        return [];
      },
    });
    expect(bowser?.attack).toBe('fire');
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'll-2-1' });
  });
});
