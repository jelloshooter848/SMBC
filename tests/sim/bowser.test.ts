import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { Projectile } from '@game/entities/projectiles/projectile';
import { Corpse } from '@game/entities/effects/effects';
import { px, toPx, velToSub } from '@engine/math/units';
import { tileAtTiles, type LevelData } from '@game/level/schema';
import { T } from '@game/level/tiles';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

// Bowser against the original's com/smbc/enemies/Bowser.as, BowserFake.as,
// projectiles/BowserFireBall.as and projectiles/Hammer.as.

const levels = join(import.meta.dirname, '../../src/content/levels');
const load = (path: string, id: string): LevelData =>
  parseTextMap(readFileSync(join(levels, path), 'utf8'), id);
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** Stand the player on the first solid tile under row 4 at `col`. */
function place(w: World, col: number): void {
  const b = w.player.body;
  let row = 4;
  while (row < 15 && !w.map.isSolid(col, row)) row++;
  b.x = px(col * 16 + 2);
  b.y = px(row * 16) - b.h;
  b.vx = 0;
  b.vy = 0;
  w.camera.snapTo(b.x);
}

const bowserOf = (w: World, fake = false): Bowser | undefined =>
  w.entities.find((e): e is Bowser => e instanceof Bowser && e.alive && e.fake === fake);

interface Watch {
  /** Per frame while Bowser is alive: body x/y (sub), vx, onGround, his live own flames and hammers. */
  xs: number[];
  ys: number[];
  grounded: boolean[];
  flames: Map<number, { firstFrame: number; xs: number[]; ys: number[]; vx: number[] }>;
  hammers: Map<number, { firstFrame: number; vx: number; vy: number }>;
  maxFlames: number;
  maxHammers: number;
  frames: number;
}

/** Run a level with the player parked at `col` (invulnerable) and record Bowser's doings. */
function watchBowser(level: LevelData, col: number, frames: number, fake = false): Watch {
  const out: Watch = {
    xs: [],
    ys: [],
    grounded: [],
    flames: new Map(),
    hammers: new Map(),
    maxFlames: 0,
    maxHammers: 0,
    frames: 0,
  };
  runSim({
    level,
    character: MARIO,
    script: none,
    maxFrames: frames,
    assist: { invulnerable: true },
    controller: (w, f) => {
      if (f === 0) place(w, col);
      // Keep the player parked (the camera does not scroll back).
      const pb = w.player.body;
      if (f > 0) {
        pb.vx = 0;
      }
      const bw = bowserOf(w, fake);
      if (!bw) return [];
      out.frames++;
      out.xs.push(bw.body.x);
      out.ys.push(bw.body.y);
      out.grounded.push(bw.body.onGround);
      let nf = 0;
      let nh = 0;
      for (const e of w.entities) {
        if (!(e instanceof Projectile) || e.owner !== bw || !e.alive) continue;
        if (e.kind === 'bowser-flame') {
          nf++;
          let r = out.flames.get(e.id);
          // Only his own breath (not the long-range flames sent in from the screen's edge).
          if (
            !r &&
            (bw.body.x + bw.body.w > w.camera.right || Math.abs(e.body.x + e.body.w - bw.body.x) > px(4))
          )
            continue;
          if (!r) out.flames.set(e.id, (r = { firstFrame: out.frames, xs: [], ys: [], vx: [] }));
          r.xs.push(e.body.x);
          r.ys.push(e.body.y);
          r.vx.push(e.body.vx);
        } else if (e.kind === 'hammer') {
          nh++;
          if (!out.hammers.has(e.id))
            out.hammers.set(e.id, { firstFrame: out.frames, vx: e.body.vx, vy: e.body.vy });
        }
      }
      out.maxFlames = Math.max(out.maxFlames, nf);
      out.maxHammers = Math.max(out.maxHammers, nh);
      return [];
    },
  });
  return out;
}

const level14 = () => load('world1/1-4.map', '1-4');

describe('Bowser pacing (Bowser.as WALK_SPEED, getXMaxMin, fbTmrLsr)', () => {
  const w = watchBowser(level14(), 127, 4000);

  it('walks at 30 px/s (0.25 px per frame)', () => {
    let fastest = 0;
    for (let i = 1; i < w.xs.length; i++) fastest = Math.max(fastest, Math.abs(w.xs[i]! - w.xs[i - 1]!));
    expect(fastest).toBeGreaterThan(0);
    expect(fastest).toBeLessThanOrEqual(velToSub(0x00400));
  });

  it('stays between bridgeStart + 3 tiles and bridgeEnd + 1 tile (columns 131-141 in 1-4)', () => {
    const left = Math.min(...w.xs);
    const right = Math.max(...w.xs) + px(28);
    expect(left).toBeGreaterThanOrEqual(px(131 * 16));
    expect(right).toBeLessThanOrEqual(px(141 * 16));
    // ... and uses most of it (he wandered well beyond the old 3.5-tile stretch).
    expect(right - left).toBeGreaterThan(px(7 * 16));
  });

  it('stands still for the 450 ms wind-up before each of his flames', () => {
    expect(w.flames.size).toBeGreaterThan(3);
    // (The first wind-up may start while he is still off screen, walking in.)
    // xs[i] is after the frame that breathed it (when he sets off again), so look before that.
    for (const fl of [...w.flames.values()].slice(1)) {
      const i = fl.firstFrame - 2;
      for (let k = i - 26; k <= i; k++) expect(w.xs[k], `frame ${k}`).toBe(w.xs[i]);
    }
  });
});

describe('Bowser flames (BowserFireBall.as)', () => {
  const w = watchBowser(level14(), 127, 4000);
  const feet = px(10 * 16);

  it('always fly left at 160 px/s, settling at one of three fixed heights', () => {
    const heights = new Set<number>();
    for (const fl of w.flames.values()) {
      for (const vx of fl.vx) expect(vx).toBe(-0x01555);
      const last = fl.ys[fl.ys.length - 1]!;
      if (fl.ys.length > 40) {
        const centre = last + px(4);
        expect([feet - px(8), feet - px(24), feet - px(40)]).toContain(centre);
        heights.add(centre);
      }
    }
    expect(heights.size).toBeGreaterThan(1);
  });

  it('come at most two at a time, 1.5-3.5 s apart', () => {
    expect(w.maxFlames).toBeLessThanOrEqual(2);
    const starts = [...w.flames.values()].map((f) => f.firstFrame).sort((a, b) => a - b);
    for (let i = 1; i < starts.length; i++) expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(90);
  });
});

describe('Bowser jumps (Bowser.as JUMP_TMR_DUR_MIN/MAX, jumpPwr 280)', () => {
  it('jumps every 0.4-3 s of standing time', () => {
    const w = watchBowser(level14(), 127, 3600);
    const takeoffs: number[] = [];
    for (let i = 1; i < w.ys.length; i++) if (w.grounded[i - 1] && w.ys[i]! < w.ys[i - 1]!) takeoffs.push(i);
    expect(takeoffs.length).toBeGreaterThanOrEqual(14);
    for (let i = 1; i < takeoffs.length; i++) expect(takeoffs[i]! - takeoffs[i - 1]!).toBeLessThan(180 + 80);
    // A hop of about 39 px.
    const top = Math.min(...w.ys);
    expect(toPx(Math.max(...w.ys) - top)).toBeGreaterThanOrEqual(35);
    expect(toPx(Math.max(...w.ys) - top)).toBeLessThanOrEqual(42);
  });
});

describe('Bowser chase (Bowser.as updateStats ST_CHASE, RUN_SPEED, pastXMax)', () => {
  it('runs right at a player who got behind him, stops at the bridge end, and attacks no more', () => {
    let flamesAfter = 0;
    let fastest = 0;
    let facing = 0;
    let rightEdge = 0;
    let flamesBefore = 0;
    runSim({
      level: level14(),
      character: MARIO,
      script: none,
      maxFrames: 900,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 127);
        const bw = bowserOf(w);
        if (f === 200) {
          // Behind him, on the bridge's last piece.
          const b = w.player.body;
          b.x = px(140 * 16 + 2);
          b.y = px(10 * 16) - b.h;
          w.camera.x = Math.min(w.camera.maxX, px(140 * 16) - px(160));
        }
        if (!bw) return [];
        const own = w.entities.filter(
          (e) => e instanceof Projectile && e.owner === bw && e.kind === 'bowser-flame' && e.alive,
        );
        if (f < 200) flamesBefore = Math.max(flamesBefore, own.length);
        if (f > 260) {
          for (const e of own) if (e.body.vx > 0) flamesAfter++;
          facing = bw.facing;
          rightEdge = Math.max(rightEdge, bw.body.x + bw.body.w);
          fastest = Math.max(fastest, bw.body.vx);
        }
        return [];
      },
    });
    expect(facing).toBe(1);
    expect(fastest).toBe(0x00844);
    expect(rightEdge).toBe(px(141 * 16));
    expect(flamesAfter).toBe(0);
  });
});

describe('Hammer Bowser (Bowser.as throwHammerTmrHandler, Hammer.as)', () => {
  it('throws single hammers 40-199 ms apart, at most six alive, all at the fixed speed', () => {
    const w = watchBowser(load('world6/6-4.map', '6-4'), 127, 1200);
    const throws = [...w.hammers.values()].sort((a, b) => a.firstFrame - b.firstFrame);
    expect(throws.length).toBeGreaterThan(20);
    expect(w.maxHammers).toBeLessThanOrEqual(6);
    expect(w.maxHammers).toBeGreaterThanOrEqual(4);
    for (const h of throws) {
      expect(h.vx).toBe(-0x01000);
      // jumpPwr 200 px/s, seen after its first frame of gravity (500 px/s²).
      expect(h.vy).toBe(-0x01aab + 0x0011c);
    }
    // One at a time: never two in the same frame.
    const frames = throws.map((h) => h.firstFrame);
    expect(new Set(frames).size).toBe(frames.length);
  });
});

describe('Fake Bowser (BowserFake.as WALK_DISTANCE)', () => {
  it('walks up to 5 tiles either side of where it spawned', () => {
    const w = watchBowser(load('lost/world8/ll-8-4-end3.map', 'll-8-4-end3'), 15, 5000, true);
    expect(w.frames).toBeGreaterThan(0);
    const left = Math.min(...w.xs);
    const right = Math.max(...w.xs) + px(28);
    // Spawned on column 23 (body centre at column 24): 19-29.
    expect(left).toBeGreaterThanOrEqual(px(19 * 16));
    expect(right).toBeLessThanOrEqual(px(29 * 16));
    // Goes right of its spot too.
    expect(right).toBeGreaterThan(px(27 * 16));
  });
});

describe('Bowser death', () => {
  it('fireballs: he falls straight down upside down as the world true form (Bowser.as die, FL_DIE)', () => {
    const corpses: Corpse[] = [];
    runSim({
      level: load('world1/1-4.map', '1-4'),
      character: MARIO,
      script: none,
      maxFrames: 400,
      state: { world: 5 },
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 127);
        const bw = bowserOf(w);
        if (bw && f === 200) {
          for (let i = 0; i < 5; i++) bw.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, w);
        }
        for (const e of w.entities) if (e instanceof Corpse && !corpses.includes(e)) corpses.push(e);
        return [];
      },
    });
    expect(corpses.length).toBe(1);
    const c = corpses[0] as Corpse;
    expect(c.frame).toBe('bowser-die-5');
    expect(c.mirrorY).toBe(true);
    expect(c.body.vx).toBe(0);
  });

  it('the axe drops him for no points (BowserAxe.as gives none)', () => {
    let score = -1;
    let cleared = false;
    runSim({
      level: level14(),
      character: MARIO,
      script: none,
      maxFrames: 900,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 127);
        if (f === 100) {
          const b = w.player.body;
          b.x = px(141 * 16 + 2);
          b.y = px(9 * 16) - b.h;
          w.camera.x = Math.min(w.camera.maxX, px(141 * 16) - px(160));
        }
        if (w.bossClear) {
          cleared = true;
          score = w.state.score;
        }
        return [];
      },
    });
    expect(cleared).toBe(true);
    expect(score).toBe(0);
  });
});

describe('Bowser windows in the shipped castles', () => {
  it('every real Bowser stands on a bridge (his window is getXMaxMin from its pieces)', () => {
    const maps = readdirSync(levels, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith('.map') && /^bowser /m.test(readFileSync(join(levels, f), 'utf8')));
    expect(maps.length).toBeGreaterThan(15);
    for (const m of maps) {
      const l = load(m, m);
      for (const e of l.entities) {
        if (e.type !== 'bowser' || e.props?.fake) continue;
        expect(tileAtTiles(l, e.x + 1, e.y + 1), `${m} bowser ${e.x},${e.y}`).toBe(T.BRIDGE);
      }
    }
  });
});
