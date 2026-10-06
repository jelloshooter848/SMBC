import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { BulletBill, BulletLauncher } from '@game/entities/enemies/bullet-bill';
import { Firebar } from '@game/entities/enemies/firebar';
import { Lift } from '@game/entities/objects/lift';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/world5', `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const at = (l: LevelData, x: number, y: number): LevelData => {
  l.start = { x, y };
  l.startMode = 'stand';
  return l;
};

describe('World 5: Bullet Bill blasters', () => {
  it('a blaster fires at a player a few tiles away, and the bill flies through everything', () => {
    let bill: BulletBill | undefined;
    let startX = 0;
    const r = runSim({
      level: at(level('5-1'), 104, 12),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
      controller: (w) => {
        if (!bill) {
          bill = w.entities.find((e): e is BulletBill => e instanceof BulletBill);
          if (bill) startX = bill.body.x;
        }
        return [];
      },
      until: () => bill !== undefined && bill.body.x < startX - px(40),
    });
    expect(r.outcome).toBe('stopped');
    expect(r.world.entities.some((e) => e instanceof BulletLauncher && e.tx === 111 && e.ty === 11)).toBe(
      true,
    );
    const b = bill as BulletBill;
    expect(b.body.vx).toBeLessThan(0); // toward the player on the left
    expect(toPx(b.body.y)).toBeGreaterThanOrEqual(11 * 16);
    expect(toPx(b.body.y)).toBeLessThan(12 * 16);
  });

  it('holds fire while the player stands right next to the blaster', () => {
    const r = runSim({
      level: at(level('5-1'), 112, 12),
      character: MARIO,
      script: none,
      maxFrames: 500,
      assist: { invulnerable: true },
      until: (w) => w.entities.some((e) => e instanceof BulletBill),
    });
    expect(r.outcome).toBe('timeout');
  });

  it('Bullet Bills shrug off fireballs and fall to a stomp', () => {
    const r = runSim({ level: at(level('5-1'), 104, 12), character: MARIO, script: none, maxFrames: 2 });
    const bill = new BulletBill(px(100 * 16), px(11 * 16), -1);
    r.world.spawn(bill);
    expect(bill.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, r.world)).toBe('immune');
    expect(bill.alive).toBe(true);
    expect(bill.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, r.world)).toBe('kill');
    expect(bill.alive).toBe(false);
  });

  it('5-3 sends Bullet Bills in from the screen edges inside its stretch', () => {
    let bill: BulletBill | undefined;
    const r = runSim({
      level: level('5-3'),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
      controller: (w) => {
        bill ??= w.entities.find((e): e is BulletBill => e instanceof BulletBill);
        return [];
      },
      until: () => bill !== undefined,
    });
    expect(r.outcome).toBe('stopped');
    const b = bill as BulletBill;
    const cam = r.world.camera;
    const edge = Math.min(Math.abs(b.body.x - cam.right), Math.abs(b.body.x + b.body.w - cam.x));
    expect(edge).toBeLessThanOrEqual(px(20));
  });

  it('5-3 sends none past the end of its stretch', () => {
    const r = runSim({
      level: at(level('5-3'), 156, 12),
      character: MARIO,
      script: none,
      maxFrames: 500,
      assist: { invulnerable: true },
      until: (w) => w.entities.some((e) => e instanceof BulletBill),
    });
    expect(r.outcome).toBe('timeout');
  });
});

describe('World 5: the coin-heaven cloud and the long fire bar', () => {
  const cloud = (startX: number, startY: number) => {
    let lift: Lift | undefined;
    let x0 = 0;
    const r = runSim({
      level: at(level('5-2-sky'), startX, startY),
      character: MARIO,
      script: none,
      maxFrames: 150,
      controller: (w) => {
        if (!lift) {
          lift = w.entities.find((e): e is Lift => e instanceof Lift && e.kind === 'lift-right');
          if (lift) x0 = lift.body.x;
        }
        return [];
      },
    });
    return { r, lift: lift as Lift, moved: toPx((lift as Lift).body.x - x0) };
  };

  it('waits until stepped on', () => {
    const { lift, moved } = cloud(2, 12);
    expect(lift).toBeDefined();
    expect(lift.moving).toBe(false);
    expect(moved).toBe(0);
  });

  it('then carries the player to the right', () => {
    const { r, lift, moved } = cloud(18, 9);
    expect(lift.moving).toBe(true);
    expect(moved).toBeGreaterThan(80);
    expect(r.world.player.body.onGround).toBe(true);
    expect(toPx(r.world.player.body.x)).toBeGreaterThan(18 * 16 + 60);
  });

  it('5-4 has a twelve-ball fire bar', () => {
    let bar: Firebar | undefined;
    runSim({
      level: at(level('5-4'), 14, 9),
      character: MARIO,
      script: none,
      maxFrames: 60,
      assist: { invulnerable: true },
      controller: (w) => {
        bar ??= w.entities.find((e): e is Firebar => e instanceof Firebar && e.len === 12);
        return [];
      },
      until: () => bar !== undefined,
    });
    expect(bar).toBeDefined();
    expect((bar as Firebar).dir).toBe(-1);
  });
});

describe('World 5 areas', () => {
  it('every area loads and runs', () => {
    for (const id of ['5-1', '5-1-bonus', '5-2', '5-2-water', '5-2-sky', '5-3', '5-4']) {
      const r = runSim({ level: level(id), character: MARIO, script: none, maxFrames: 60 });
      expect(r.frames).toBe(60);
    }
  });
});
