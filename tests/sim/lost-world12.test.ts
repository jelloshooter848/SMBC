import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { autoPlayer, newBot } from '@game/sim/bot';
import { MARIO } from '@game/characters/mario';
import { Piranha } from '@game/entities/enemies/piranha';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { Blooper } from '@game/entities/enemies/blooper';
import { Bowser } from '@game/entities/enemies/bowser';
import { Lakitu } from '@game/entities/enemies/lakitu';
import { Spring } from '@game/entities/objects/spring';
import { PowerUp } from '@game/entities/objects/powerup';
import { Projectile } from '@game/entities/projectiles/projectile';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

// The Lost Levels World C (stored as world 12).
const dir = join(import.meta.dirname, '../../src/content/levels/lost/world12');
const level = (id: string): LevelData => parseTextMap(readFileSync(join(dir, `${id}.map`), 'utf8'), id);
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** Put the player at column `col` (plus `dx` px), feet on top of row `floor`, camera along. */
function place(w: World, col: number, floor: number, dx = 2): void {
  const b = w.player.body;
  b.x = px(col * 16 + dx);
  b.y = px(floor * 16) - b.h;
  b.vx = 0;
  b.vy = 0;
  w.camera.snapTo(b.x);
}

describe('World C areas', () => {
  const ids = readdirSync(dir)
    .filter((f) => f.endsWith('.map'))
    .map((f) => f.slice(0, -4));

  it.each(ids)('%s loads and runs 600 frames standing still', (id) => {
    const r = runSim({ level: level(id), character: MARIO, script: none, maxFrames: 600 });
    expect(r.frames).toBe(600);
    expect(Number.isFinite(r.playerX) && Number.isFinite(r.playerY)).toBe(true);
  });

  it.each(ids)('%s runs 600 frames under the auto player without errors', (id) => {
    const bot = newBot();
    const r = runSim({
      level: level(id),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
      controller: (w) => autoPlayer(w, bot),
    });
    expect(r.frames).toBeGreaterThan(0);
    expect(Number.isFinite(r.playerX)).toBe(true);
  });
});

describe('C-1: the hanging piranhas and the poison block', () => {
  it('the hanging piranha at 33 comes down out of its rim, head first', () => {
    let p: Piranha | undefined;
    let maxH = 0;
    runSim({
      level: level('ll-12-1'),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 26, 13);
        p ??= w.entities.find((e): e is Piranha => e instanceof Piranha && e.hanging);
        if (p) maxH = Math.max(maxH, toPx(p.body.h));
        if (p && toPx(p.body.h) > 0) expect(toPx(p.body.y)).toBe(9 * 16); // the rim's bottom edge
        return [];
      },
    });
    expect(p).toBeDefined();
    expect(Math.floor(toPx((p as Piranha).body.x) / 16)).toBe(33);
    expect(maxH).toBe(24);
  });

  it('bumping the ? block at 39 releases a poison mushroom', () => {
    let poison: PowerUp | undefined;
    const r = runSim({
      level: level('ll-12-1'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 39, 13, 3);
        poison ??= w.entities.find((e): e is PowerUp => e instanceof PowerUp && e.item === 'poison');
        return f < 20 ? ['jump'] : [];
      },
      until: () => poison !== undefined,
    });
    expect(r.outcome).toBe('stopped');
    expect(Math.floor(toPx((poison as PowerUp).body.x) / 16)).toBe(39);
  });
});

describe('C-1: the chasing Hammer Bro', () => {
  it('the Hammer Bro at 170 walks toward the player instead of holding its ground', () => {
    let bro: HammerBro | undefined;
    let start = NaN;
    runSim({
      level: level('ll-12-1'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 162, 13);
        if (!bro) {
          bro = w.entities.find((e): e is HammerBro => e instanceof HammerBro);
          if (bro) start = toPx(bro.body.x);
        }
        return [];
      },
    });
    expect(bro?.chase).toBe(true);
    expect(Math.round(start / 16)).toBe(170);
    expect(start - toPx((bro as HammerBro).body.x)).toBeGreaterThanOrEqual(20);
  });
});

describe('C-1: links between the areas', () => {
  it('the pipe at 96 drops into the bonus room', () => {
    const r = runSim({
      level: level('ll-12-1'),
      character: MARIO,
      script: none,
      maxFrames: 200,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 96, 10, 8);
        return ['down'];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: 'll-12-1-bonus', x: 1, y: 0 },
    });
  });

  it('the bonus room side pipe leads back up the pipe at 131', () => {
    const r = runSim({
      level: level('ll-12-1-bonus'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 26, 13);
        return ['right'];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-12-1', x: 131, y: 10, exitDir: 'up' },
    });
  });

  it('running off the end of the coin heaven drops back into C-1 at 130', () => {
    const r = runSim({
      level: level('ll-12-1-sky'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      assist: { invulnerable: true },
      start: { x: 68, y: 12, mode: 'stand' },
      controller: () => ['right'],
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-12-1', x: 130, y: 0, exitDir: 'fall' },
    });
  });
});

describe('C-2: green springboard and Bloopers in the air', () => {
  it('the green springboard at 131 throws Mario off the top of the screen', () => {
    let launched = false;
    let minFeet = Infinity;
    let spring: Spring | undefined;
    runSim({
      level: level('ll-12-2'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 131, 9, 1);
        spring ??= w.entities.find((e): e is Spring => e instanceof Spring);
        if (spring?.busy) launched = true;
        const b = w.player.body;
        if (launched) minFeet = Math.min(minFeet, toPx(b.y + b.h));
        return launched ? ['jump'] : [];
      },
    });
    expect(spring?.green).toBe(true);
    expect(launched).toBe(true);
    expect(minFeet).toBeLessThan(0);
  });

  it('the first Blooper swims in the air above the bridges without dropping to the floor', () => {
    let bl: Blooper | undefined;
    let maxBottom = -Infinity;
    runSim({
      level: level('ll-12-2'),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 14, 13);
        bl ??= w.entities.find((e): e is Blooper => e instanceof Blooper);
        if (bl?.alive) maxBottom = Math.max(maxBottom, toPx(bl.body.y + bl.body.h));
        return [];
      },
    });
    expect(bl).toBeDefined();
    expect(maxBottom).toBeLessThan(13 * 16);
  });
});

describe('C-3: Lakitu over the treetops', () => {
  // The stretch ends at a lakituEndMiddle marker: this Lakitu flies at mid-screen height.
  it('a Lakitu shows up once the player is past column 138, flying mid-screen', () => {
    let lakitu: Lakitu | undefined;
    const r = runSim({
      level: level('ll-12-3'),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 141, 13);
        lakitu ??= w.entities.find((e): e is Lakitu => e instanceof Lakitu);
        return [];
      },
      until: () => lakitu !== undefined,
    });
    expect(r.outcome).toBe('stopped');
    const y = toPx((lakitu as Lakitu).body.y);
    expect(y).toBeGreaterThan(96);
    expect(y).toBeLessThan(160);
  });
});

describe('C-4: Bowser and the axe', () => {
  it('Bowser on the C-4 bridge throws hammers', () => {
    let bowser: Bowser | undefined;
    const seen = new Set<number>();
    let hammers = 0;
    runSim({
      level: level('ll-12-4'),
      character: MARIO,
      script: none,
      maxFrames: 500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 219, 10);
        bowser ??= w.entities.find((e): e is Bowser => e instanceof Bowser);
        for (const e of w.entities) {
          if (!(e instanceof Projectile) || e.owner !== bowser || seen.has(e.id)) continue;
          seen.add(e.id);
          if (e.spec.kind === 'hammer') hammers++;
        }
        return [];
      },
    });
    expect(bowser?.attack).toBe('hammer');
    expect(hammers).toBeGreaterThanOrEqual(3);
  });

  it('the axe drops the bridge and sends the player on to D-1', () => {
    const r = runSim({
      level: level('ll-12-4'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 237, 9, 0);
        return [];
      },
    });
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'll-13-1' });
  });
});
