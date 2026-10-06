/**
 * Bullet Bills, Lakitu and Hammer Bros against the original Crossover 3.1.21 source
 * (com/smbc/ground/Canon.as, enemies/BulletBill.as, level/BulletBillSpawner.as, enemies/Lakitu.as,
 * level/LakituSpawner.as, level/EnemySpawner.as, enemies/HammerBro.as, projectiles/Hammer.as).
 * The original's timers are in ms (60 frames a second) and its distances in px on 32-px tiles.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim, ScriptedInput } from '@game/sim/headless';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import type { Player } from '@game/entities/player';
import { MARIO } from '@game/characters/mario';
import { BulletBill, BulletLauncher } from '@game/entities/enemies/bullet-bill';
import { Lakitu, LakituZone } from '@game/entities/enemies/lakitu';
import { Spiny } from '@game/entities/enemies/spiny';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { Projectile } from '@game/entities/projectiles/projectile';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';

const level = (world: string, id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels', world, `${id}.map`), 'utf8'),
    id,
  );
const at = (l: LevelData, x: number, y: number): LevelData => {
  l.start = { x, y };
  l.startMode = 'stand';
  return l;
};
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** A flat test field `width` columns wide: 13 rows of air over two rows of ground. */
function field(opts: {
  width?: number;
  start?: number;
  rows?: Record<number, string>;
  entities?: string[];
  zones?: string[];
  theme?: string;
}): LevelData {
  const width = opts.width ?? 64;
  const rows = Array.from({ length: 13 }, (_, y) => (opts.rows?.[y] ?? '').padEnd(width, '.'));
  return parseTextMap(
    [
      'id: t',
      'time: 400',
      ...(opts.theme ? [`theme: ${opts.theme}`] : []),
      `start: ${opts.start ?? 2},12`,
      '',
      '[tiles]',
      ...rows,
      '#'.repeat(width),
      '#'.repeat(width),
      '',
      '[entities]',
      ...(opts.entities ?? []),
      '',
      '[zones]',
      ...(opts.zones ?? []),
    ].join('\n'),
  );
}
const put = (col: number, ch: string) => '.'.repeat(col) + ch;

/** Every entity of a class that appeared during the run, with the frame it first showed up. */
function tracker<T>(pick: (w: World) => T[]) {
  const seen = new Map<T, number>();
  return {
    seen,
    look(w: World, f: number) {
      for (const e of pick(w)) if (!seen.has(e)) seen.set(e, f);
    },
  };
}
const bills = (w: World) => w.entities.filter((e): e is BulletBill => e instanceof BulletBill && e.alive);

describe('Bullet Bills (Canon.as, BulletBill.as, BulletBillSpawner.as)', () => {
  it('fly at BulletBill.SPEED = 170 px/s: 1.42 px/frame at our scale', () => {
    const b = new BulletBill(px(100), px(100), -1);
    expect(b.body.vx).toBe(-0x016ab); // 170 / 2 / 60 px/f = 1.4167 px/f
    const r = new BulletBill(px(100), px(100), 1);
    expect(r.body.vx).toBe(0x016ab);
  });

  it('a blaster fires every 1.0-3.5 s (SHOOT_TMR_DUR_MIN/MAX), not every 2.5-4.5 s', () => {
    const shots = tracker(bills);
    runSim({
      level: at(level('world5', '5-1'), 104, 12),
      character: MARIO,
      script: none,
      maxFrames: 2400,
      assist: { invulnerable: true, infiniteTime: true },
      until: (w, f) => (shots.look(w, f), false),
    });
    const frames = [...shots.seen.values()];
    const gaps = frames.slice(1).map((f, i) => f - (frames[i] as number));
    expect(frames.length).toBeGreaterThanOrEqual(12); // ~17 on average in 40 s; ours fired ~11
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(60);
    expect(Math.min(...gaps)).toBeLessThan(150);
    expect(gaps.reduce((a, g) => a + g, 0) / gaps.length).toBeLessThan(180);
  });

  it('at most two blaster Bullet Bills are out in the whole level (MAX_BULLET_BILLS, BILL_DCT)', () => {
    let most = 0;
    let launchers = 0;
    runSim({
      level: field({
        width: 48,
        start: 24,
        rows: { 11: put(21, '^') + put(5, '^') + put(5, '^'), 12: put(21, '|') + put(5, '|') + put(5, '|') },
      }),
      character: MARIO,
      script: none,
      maxFrames: 2400,
      assist: { invulnerable: true, infiniteTime: true },
      until: (w) => {
        launchers = w.entities.filter((e) => e instanceof BulletLauncher).length;
        most = Math.max(most, bills(w).length);
        return false;
      },
    });
    expect(launchers).toBe(3);
    expect(most).toBe(2);
  });

  it("5-3's flying bills come one at a time from the right at the player's height (BulletBillSpawner)", () => {
    const seen = tracker(bills);
    let most = 0;
    let goneAt = -1;
    const waits: number[] = [];
    runSim({
      level: at(level('world5', '5-3'), 2, 12),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true, infiniteTime: true },
      until: (w, f) => {
        const live = bills(w);
        for (const b of live)
          if (!seen.seen.has(b)) {
            seen.seen.set(b, f);
            if (goneAt >= 0) waits.push(f - goneAt);
            expect(b.body.vx).toBeLessThan(0);
            expect(b.body.x).toBeGreaterThanOrEqual(w.camera.right - px(2));
            // Bottom on the grid line nearest the player's feet, give or take two tiles, and no
            // lower than one tile above the bottom of the screen.
            const bottom = toPx(b.body.y) + 14;
            const feet = toPx(w.player.body.y + w.player.body.h);
            expect(bottom % 16).toBe(0);
            expect(Math.abs(bottom - Math.round(feet / 16) * 16)).toBeLessThanOrEqual(32);
            expect(bottom).toBeLessThanOrEqual(240 - 16);
          }
        if (live.length === 0 && most > 0 && goneAt < 0) goneAt = f;
        if (live.length > 0) goneAt = -1;
        most = Math.max(most, live.length);
        return false;
      },
    });
    expect(seen.seen.size).toBeGreaterThanOrEqual(4);
    expect(most).toBe(1);
    for (const wait of waits) {
      // DEL_DEFAULT 250 ms = 15 frames, counted from the frame the spawner sees the bill gone.
      expect(wait).toBeGreaterThanOrEqual(14);
      expect(wait).toBeLessThanOrEqual(16);
    }
  });
});

/** A long flat field with a Lakitu stretch. */
const lakituField = (start: number, end: number, playerAt = 2, width = 320) =>
  field({ width, start: playerAt, entities: [`lakitu ${start} 0 end=${end}`] });
const lakitus = (w: World) => w.entities.filter((e): e is Lakitu => e instanceof Lakitu);

describe('Lakitu (Lakitu.as, LakituSpawner.as, EnemySpawner.as)', () => {
  it('does not come until the player passes the start column (EnemySpawner.inSpawnZone)', () => {
    let arrivedAt = -1;
    runSim({
      level: at(level('world4', '4-1'), 2, 12),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: ['right'] }] },
      maxFrames: 900,
      assist: { invulnerable: true },
      until: (w) => {
        if (lakitus(w).length > 0) arrivedAt = w.player.centerX;
        return arrivedAt >= 0;
      },
    });
    expect(arrivedAt).toBeGreaterThan(px(19 * 16));
    expect(arrivedAt).toBeLessThan(px(21 * 16));
  });

  it('enters from just past the right edge of the screen', () => {
    let first: Lakitu | undefined;
    let cam = 0;
    runSim({
      level: lakituField(4, 300, 10),
      character: MARIO,
      script: none,
      maxFrames: 30,
      assist: { invulnerable: true },
      until: (w) => {
        first ??= lakitus(w)[0];
        if (first && !cam) cam = w.camera.right;
        return first !== undefined;
      },
    });
    expect(first).toBeDefined();
    const b = (first as Lakitu).body;
    expect(Math.abs(b.x + b.w / 2 - (cam + b.w / 2))).toBeLessThanOrEqual(px(2));
  });

  it('keeps up with and gets ahead of a running player (START_FOLLOW_DEL_TMR, VX_MAX_INCREASE_NUM)', () => {
    let ahead = 0;
    let behindEdge = 0;
    runSim({
      level: lakituField(4, 300, 10),
      character: MARIO,
      script: none,
      maxFrames: 900,
      assist: { invulnerable: true, infiniteTime: true },
      controller: (_w, f) => (f > 240 ? ['right', 'attack'] : []),
      until: (w, f) => {
        const l = lakitus(w)[0];
        if (l && f > 480) {
          const lc = l.body.x + l.body.w / 2;
          if (lc > w.player.centerX + px(8)) ahead++;
          if (lc < w.camera.x + px(24)) behindEdge++;
        }
        return false;
      },
    });
    // Ours trailed the run ~66 px behind, pinned at the left edge of the screen.
    expect(ahead).toBeGreaterThan(60);
    expect(behindEdge).toBeLessThan(60);
  });

  it('swings back and forth over a player who stands still', () => {
    let left = 0;
    let right = 0;
    runSim({
      level: lakituField(4, 300, 10),
      character: MARIO,
      script: none,
      maxFrames: 900,
      assist: { invulnerable: true, infiniteTime: true },
      until: (w, f) => {
        const l = lakitus(w)[0];
        if (l && f > 200) {
          const d = l.body.x + l.body.w / 2 - w.player.centerX;
          if (d < -px(16)) left++;
          if (d > px(16)) right++;
        }
        return false;
      },
    });
    expect(left).toBeGreaterThan(30);
    expect(right).toBeGreaterThan(30);
  });

  it('throws a Spiny every 1.75 s and keeps up to four of its own out (hideTmr, throwTmr, maxSpinyDifficulty)', () => {
    const eggs = tracker((w) => w.entities.filter((e): e is Spiny => e instanceof Spiny));
    let appeared = -1;
    let most = 0;
    runSim({
      // Walls keep the Spinies on screen.
      level: field({
        width: 40,
        start: 12,
        rows: Object.fromEntries(Array.from({ length: 13 }, (_, y) => [y, put(3, 'B') + put(20, 'B')])),
        entities: ['lakitu 4 0 end=38'],
      }),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true, infiniteTime: true },
      until: (w, f) => {
        if (appeared < 0 && lakitus(w).length) appeared = f;
        eggs.look(w, f);
        most = Math.max(most, w.entities.filter((e) => e instanceof Spiny && e.alive).length);
        return false;
      },
    });
    const throws = [...eggs.seen.values()];
    // 1500 ms + 250 ms = 105 frames, counting the frame it appears on.
    expect(throws[0]! - appeared).toBeGreaterThanOrEqual(104);
    expect(throws[0]! - appeared).toBeLessThanOrEqual(105);
    expect(throws[1]! - throws[0]!).toBe(105);
    expect(throws[2]! - throws[1]!).toBe(105);
    expect(most).toBe(4);
  });

  it('a defeated Lakitu is replaced 40 TIME units (15.88 s) later, not 7 s (LakituSpawner.spawnDelTmrDur)', () => {
    let first: Lakitu | undefined;
    let killedAt = -1;
    let nextAt = -1;
    runSim({
      level: lakituField(4, 300, 10),
      character: MARIO,
      script: none,
      maxFrames: 1400,
      assist: { invulnerable: true, infiniteTime: true },
      controller: (w, f) => {
        if (first?.alive && f === 100) {
          first.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, w);
          killedAt = f;
        }
        return [];
      },
      until: (w, f) => {
        first ??= lakitus(w)[0];
        const l = lakitus(w).find((e) => e !== first && e.alive);
        if (l && nextAt < 0) nextAt = f;
        return nextAt >= 0;
      },
    });
    expect(killedAt).toBe(100);
    expect(nextAt - killedAt).toBeGreaterThanOrEqual(950);
    expect(nextAt - killedAt).toBeLessThanOrEqual(960);
  });

  it('drifts off to the left at EXIT_SPEED past the end, and comes back if the player returns', () => {
    let lakitu: Lakitu | undefined;
    const xs: number[] = [];
    let backAt = -1;
    let resumed = false;
    runSim({
      level: lakituField(4, 30, 10, 64),
      character: MARIO,
      script: none,
      maxFrames: 1200,
      assist: { invulnerable: true, infiniteTime: true },
      controller: (w, f) => {
        const p = w.player.centerX;
        if (f < 150) return [];
        if (backAt < 0) {
          if (p < px(31 * 16)) return ['right'];
          backAt = f + 30;
        }
        if (f < backAt) return [];
        return p > px(27 * 16) ? ['left'] : [];
      },
      until: (w, f) => {
        lakitu ??= lakitus(w)[0];
        const l = lakitu as Lakitu;
        if (backAt >= 0 && f < backAt && f > backAt - 25) xs.push(l.body.x);
        if (backAt >= 0 && f > backAt + 60 && !l.leaving) resumed = true;
        return resumed;
      },
    });
    expect(xs.length).toBeGreaterThan(10);
    // Moving left at 100 px/s (0.83 px/frame at our scale) while leaving.
    const v = (xs[xs.length - 1]! - xs[0]!) / (xs.length - 1);
    expect(v).toBeLessThan(-px(0.8));
    expect(v).toBeGreaterThan(-px(0.87));
    expect(lakitu?.alive).toBe(true);
    expect(resumed).toBe(true);
  });

  it('is gone once off screen when the player stays past the end', () => {
    let lakitu: Lakitu | undefined;
    let zone: LakituZone | undefined;
    const r = runSim({
      level: lakituField(4, 30, 10, 64),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true, infiniteTime: true },
      controller: (w, f) => (f > 150 && w.player.centerX < px(36 * 16) ? ['right'] : []),
      until: (w) => {
        lakitu ??= lakitus(w)[0];
        zone ??= w.entities.find((e): e is LakituZone => e instanceof LakituZone);
        return lakitu !== undefined && !lakitu.alive;
      },
    });
    expect(r.outcome).toBe('stopped');
    expect(lakitus(r.world).filter((l) => l.alive)).toHaveLength(0);
    expect(zone?.current?.alive ?? false).toBe(false);
  });

  it('in co-op it follows the lead player even while the other one holds the other way', () => {
    const world = new World(
      lakituField(4, 300, 10),
      {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST, invulnerable: true, infiniteTime: true },
        reduceFlashing: true,
      },
      newGameState(MARIO, MARIO),
    );
    const a = new ScriptedInput({ steps: [] });
    const b = new ScriptedInput({ steps: [] });
    let ahead = 0;
    for (let f = 0; f < 900; f++) {
      // Player one runs right; player two keeps holding left at the back.
      a.setHeld(f > 240 ? ['right', 'attack'] : []);
      b.setHeld(f > 240 ? ['left'] : []);
      a.next();
      b.next();
      world.update([a, b]);
      const l = lakitus(world)[0];
      const lead = world.players[0] as Player;
      if (l && f > 480 && l.body.x + l.body.w / 2 > lead.centerX + px(8)) ahead++;
    }
    expect(ahead).toBeGreaterThan(60);
  });
});

const bros = (w: World) => w.entities.filter((e): e is HammerBro => e instanceof HammerBro && e.alive);
const hammers = (w: World) =>
  w.entities.filter((e): e is Projectile => e instanceof Projectile && e.kind === 'hammer');

describe('Hammer Bros (HammerBro.as, Hammer.as)', () => {
  it('throws single hammers 0.55-1.45 s apart (HAMMER_TMR 300-1200 ms + HAMMER_DEL_TMR 250 ms)', () => {
    const seen = tracker(hammers);
    runSim({
      level: field({ width: 48, start: 4, entities: ['hammer-bro 12 12'] }),
      character: MARIO,
      script: none,
      maxFrames: 1200,
      assist: { invulnerable: true, infiniteTime: true },
      until: (w, f) => (seen.look(w, f), false),
    });
    const frames = [...seen.seen.values()];
    expect(frames.length).toBeGreaterThanOrEqual(12);
    const gaps = frames.slice(1).map((f, i) => f - (frames[i] as number));
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(33);
      expect(g).toBeLessThanOrEqual(88);
    }
  });

  it('throws in a low arc: 1.0 px/frame across, 1.67 px/frame up, rising about 20 px (Hammer.as)', () => {
    const start = new Map<Projectile, number>();
    let rise = 0;
    runSim({
      level: field({ width: 48, start: 4, entities: ['hammer-bro 12 12'] }),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true, infiniteTime: true },
      until: (w) => {
        for (const h of hammers(w)) {
          if (!start.has(h)) {
            start.set(h, h.body.y);
            expect(h.body.vx).toBe(-0x01000);
          }
          rise = Math.max(rise, (start.get(h) as number) - h.body.y);
        }
        return false;
      },
    });
    expect(start.size).toBeGreaterThan(2);
    expect(toPx(rise)).toBeGreaterThanOrEqual(16); // first sighting is after one frame of flight
    expect(toPx(rise)).toBeLessThanOrEqual(22);
  });

  it('jumps every 0.6-2 s whenever it is on the ground (JUMP_TMR_DUR_MIN/MAX)', () => {
    let jumps = 0;
    let wasGround = true;
    runSim({
      level: at(level('world3', '3-1'), 104, 12),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true, infiniteTime: true },
      until: (w) => {
        const b = bros(w)[0];
        if (b) {
          if (wasGround && !b.body.onGround && b.body.vy < 0) jumps++;
          wasGround = b.body.onGround;
        }
        return false;
      },
    });
    expect(jumps).toBeGreaterThanOrEqual(4); // ours jumped every 3-5 s
  });

  it('jumps high from the floor and only in place where it cannot pass through (castles)', () => {
    let minY = Infinity;
    runSim({
      level: field({
        width: 48,
        start: 4,
        theme: 'castle',
        rows: { 8: put(10, '=====') },
        entities: ['hammer-bro 12 12'],
      }),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true, infiniteTime: true },
      until: (w) => {
        const b = bros(w)[0];
        if (b) minY = Math.min(minY, toPx(b.body.y + b.body.h));
        return false;
      },
    });
    // Feet never got above the brick row's underside (row 9 top = 144 px): it bumps its head.
    expect(minY).toBeGreaterThanOrEqual(144);
  });

  it('paces half a tile either side of its spot and does not follow a player who passes it', () => {
    let lo = Infinity;
    let hi = -Infinity;
    let home = 0;
    runSim({
      level: field({ width: 64, start: 26, entities: ['hammer-bro 20 12'] }),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true, infiniteTime: true },
      until: (w) => {
        const b = bros(w)[0];
        if (b) {
          home ||= b.body.x;
          lo = Math.min(lo, b.body.x);
          hi = Math.max(hi, b.body.x);
        }
        return false;
      },
    });
    expect(home - lo).toBeLessThanOrEqual(px(9));
    expect(hi - home).toBeLessThanOrEqual(px(9));
    expect(hi - lo).toBeGreaterThanOrEqual(px(14));
  });

  it('walks at the player only after its 27 s chase timer, and only to the left (CHASE_TMR_DUR)', () => {
    let at1500 = 0;
    let at1700 = 0;
    let home = 0;
    runSim({
      level: field({ width: 64, start: 2, entities: ['hammer-bro 13 12'] }),
      character: MARIO,
      script: none,
      maxFrames: 1800,
      assist: { invulnerable: true, infiniteTime: true },
      until: (w, f) => {
        const b = bros(w)[0];
        if (b) {
          home ||= b.body.x;
          if (f === 1500) at1500 = b.body.x;
          if (f === 1780) at1700 = b.body.x;
        }
        return false;
      },
    });
    expect(Math.abs(at1500 - home)).toBeLessThanOrEqual(px(9));
    expect(home - at1700).toBeGreaterThan(px(40)); // 65 px/s → 0.54 px/frame once chasing
  });
});
