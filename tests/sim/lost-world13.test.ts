import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { autoPlayer, newBot } from '@game/sim/bot';
import { MARIO } from '@game/characters/mario';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { Bowser } from '@game/entities/enemies/bowser';
import { Cheep } from '@game/entities/enemies/cheep';
import { PowerUp } from '@game/entities/objects/powerup';
import { Princess } from '@game/entities/objects/princess';
import { Projectile } from '@game/entities/projectiles/projectile';
import { T } from '@game/level/tiles';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World, WorldEvent } from '@game/world/world';

// The Lost Levels World D (stored as world 13), the last world.
const dir = join(import.meta.dirname, '../../src/content/levels/lost/world13');
const level = (id: string): LevelData => parseTextMap(readFileSync(join(dir, `${id}.map`), 'utf8'), id);
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const pipeEvent = (events: WorldEvent[]) => events.find((e) => e.type === 'pipe');

/** Put the player at column `col` (plus `dx` px), feet on top of row `floor`, camera along. */
function place(w: World, col: number, floor: number, dx = 2): void {
  const b = w.player.body;
  b.x = px(col * 16 + dx);
  b.y = px(floor * 16) - b.h;
  b.vx = 0;
  b.vy = 0;
  w.camera.snapTo(b.x);
}

/**
 * Stand on a pipe top at (col, row) and press down. Runs start standing (`start`), since areas
 * entered by pipe would otherwise begin with the rise-out-of-the-pipe animation.
 */
const enterPipe = (id: string, col: number, row: number) =>
  runSim({
    level: level(id),
    character: MARIO,
    script: none,
    maxFrames: 200,
    assist: { invulnerable: true },
    start: { x: col, y: row - 1, mode: 'stand' },
    controller: (w, f) => {
      if (f === 0) place(w, col, row, 8);
      return ['down'];
    },
  });

/** Walk right into a side pipe from column `col` on the floor row 13. */
const walkIntoSidePipe = (id: string, col: number) =>
  runSim({
    level: level(id),
    character: MARIO,
    script: none,
    maxFrames: 300,
    assist: { invulnerable: true },
    start: { x: col, y: 12, mode: 'stand' },
    controller: () => ['right'],
  });

describe('World D areas', () => {
  const ids = readdirSync(dir)
    .filter((f) => f.endsWith('.map'))
    .map((f) => f.slice(0, -4));

  it.each(ids)('%s loads and runs 600 frames standing still', (id) => {
    // Invulnerable: the chasing Hammer Bros come for a player who stands still.
    const r = runSim({
      level: level(id),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
    });
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

describe('D-1 and D-2: bonus rooms', () => {
  it('D-1: the pipe at 73 drops into the bonus room, whose side pipe returns to 115', () => {
    expect(pipeEvent(enterPipe('ll-13-1', 73, 7).events)).toMatchObject({
      target: { level: 'll-13-1-bonus', x: 1, y: 0 },
    });
    expect(pipeEvent(walkIntoSidePipe('ll-13-1-bonus', 10).events)).toEqual({
      type: 'pipe',
      target: { level: 'll-13-1', x: 115, y: 10, exitDir: 'up' },
    });
  });

  it('D-2: the top of the floating pipe at 118 is the way into the bonus room', () => {
    expect(pipeEvent(enterPipe('ll-13-2', 118, 3).events)).toMatchObject({
      target: { level: 'll-13-2-bonus', x: 1, y: 0 },
    });
  });
});

describe('D-3: Hammer Bros in front of the castle walls', () => {
  it('the Hammer Bro standing on the wall tile at 58 is a live chasing Hammer Bro that walks through the wall', () => {
    let bro: HammerBro | undefined;
    let start = NaN;
    const r = runSim({
      level: level('ll-13-3'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 48, 13);
        if (!bro) {
          bro = w.entities.find((e): e is HammerBro => e instanceof HammerBro);
          if (bro) start = toPx(bro.body.x);
        }
        return [];
      },
    });
    expect(r.world.map.get(58, 12)).toBe(T.WALL);
    expect(bro?.chase).toBe(true);
    expect(Math.floor(start / 16)).toBe(58);
    const end = toPx((bro as HammerBro).body.x);
    expect(start - end).toBeGreaterThanOrEqual(20);
    expect(end).toBeGreaterThan(49 * 16); // still inside the wall's span
    expect((bro as HammerBro).alive).toBe(true);
  });
});

describe('D-4: the route through the last castle', () => {
  it('a ledge jump from the pipe at 51 clears the lava onto the pipe at 59', () => {
    let air = false;
    let landed = '';
    runSim({
      level: level('ll-13-4'),
      character: MARIO,
      script: none,
      maxFrames: 200,
      assist: { invulnerable: true },
      controller: (w, f) => {
        const b = w.player.body;
        if (f === 0) place(w, 51, 11, 0);
        const jump = toPx(b.x) >= 842;
        if (jump && !b.onGround) air = true;
        if (air && b.onGround && !landed)
          landed = `${Math.floor(toPx(b.x + b.w / 2) / 16)},${toPx(b.y + b.h) / 16}`;
        return jump ? ['right', 'attack', 'jump'] : ['right', 'attack'];
      },
      until: () => landed !== '',
    });
    expect(landed).toBe('59,7');
  });

  it('leaping Cheep Cheeps come up out of the castle lava between 53 and 59', () => {
    let cheep: Cheep | undefined;
    const r = runSim({
      level: level('ll-13-4'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 58, 7, 12); // on the pipe at 59, still inside the zone
        cheep ??= w.entities.find((e): e is Cheep => e instanceof Cheep && e.flying);
        return [];
      },
      until: () => cheep !== undefined,
    });
    expect(r.outcome).toBe('stopped');
  });

  it('the pipe at 103 leads outdoors, rising out of the pipe at 3', () => {
    expect(pipeEvent(enterPipe('ll-13-4', 103, 9).events)).toEqual({
      type: 'pipe',
      target: { level: 'll-13-4-exit', x: 3, y: 10, exitDir: 'up' },
    });
  });

  it('outdoors: the jump from the top of the stairs reaches the pipe at 85, which leads to the bonus room', () => {
    let air = false;
    let landed = '';
    runSim({
      level: level('ll-13-4-exit'),
      character: MARIO,
      script: none,
      maxFrames: 200,
      assist: { invulnerable: true },
      start: { x: 72, y: 4, mode: 'stand' },
      controller: (w, f) => {
        const b = w.player.body;
        if (f === 0) place(w, 72, 5, 0);
        const jump = toPx(b.x) >= 1200;
        if (jump && !b.onGround) air = true;
        if (air && b.onGround && !landed)
          landed = `${Math.floor(toPx(b.x + b.w / 2) / 16)},${toPx(b.y + b.h) / 16}`;
        return jump ? ['right', 'attack', 'jump'] : ['right', 'attack'];
      },
      until: () => landed !== '',
    });
    expect(landed).toBe('85,6');
    expect(pipeEvent(enterPipe('ll-13-4-exit', 85, 6).events)).toMatchObject({
      target: { level: 'll-13-4-bonus', x: 1, y: 0 },
    });
  });

  it('outdoors: the hidden block at 60 holds a poison mushroom', () => {
    let poison: PowerUp | undefined;
    const r = runSim({
      level: level('ll-13-4-exit'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      start: { x: 60, y: 12, mode: 'stand' },
      controller: (w, f) => {
        poison ??= w.entities.find((e): e is PowerUp => e instanceof PowerUp && e.item === 'poison');
        return f > 2 && f < 20 ? ['jump'] : [];
      },
      until: () => poison !== undefined,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.world.map.get(60, 10)).not.toBe(T.HIDDEN_POISON); // bumped (used)
  });

  it('the bonus room side pipe leads into the last area', () => {
    expect(pipeEvent(walkIntoSidePipe('ll-13-4-bonus', 26).events)).toEqual({
      type: 'pipe',
      target: { level: 'll-13-4-end', x: 3, y: 10, exitDir: 'up' },
    });
  });

  it('in the last area, the wrong pipe at 38 sends the player back to the start of D-4', () => {
    expect(pipeEvent(enterPipe('ll-13-4-end', 38, 11).events)).toEqual({
      type: 'pipe',
      target: { level: 'll-13-4', x: 3, y: 10, exitDir: 'up' },
    });
  });

  it('the fake Bowser at 20 throws hammers', () => {
    let bowser: Bowser | undefined;
    const seen = new Set<number>();
    let hammers = 0;
    runSim({
      level: level('ll-13-4-end'),
      character: MARIO,
      script: none,
      maxFrames: 500,
      assist: { invulnerable: true },
      start: { x: 8, y: 12, mode: 'stand' },
      controller: (w) => {
        bowser ??= w.entities.find((e): e is Bowser => e instanceof Bowser);
        for (const e of w.entities) {
          if (!(e instanceof Projectile) || e.owner !== bowser || seen.has(e.id)) continue;
          seen.add(e.id);
          if (e.spec.kind === 'hammer') hammers++;
        }
        return [];
      },
    });
    expect(Math.floor(toPx((bowser as Bowser).body.x) / 16)).toBeLessThanOrEqual(21);
    expect(bowser?.fake).toBe(true);
    expect(bowser?.attack).toBe('hammer');
    expect(hammers).toBeGreaterThanOrEqual(3);
  });

  it('the axe drops the real Bowser off the bridge and ends the game, with the princess waiting', () => {
    let real: Bowser | undefined;
    let fake: Bowser | undefined;
    let princess: Princess | undefined;
    let lowest = -Infinity;
    let fakeY = NaN;
    let fakeAliveAtAxe = false;
    const r = runSim({
      level: level('ll-13-4-end'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true },
      start: { x: 8, y: 12, mode: 'stand' },
      controller: (w, f) => {
        // Meet the fake Bowser first and keep it in play (no off-screen culling), so both
        // Bowsers are alive when the axe is touched; the fake one comes first in the list.
        fake ??= w.entities.find((e): e is Bowser => e instanceof Bowser && e.fake);
        if (fake) fake.despawnMargin = null;
        if (f === 5) place(w, 109, 9, 0);
        real ??= w.entities.find((e): e is Bowser => e instanceof Bowser && !e.fake);
        if (real) lowest = Math.max(lowest, toPx(real.body.y));
        if (w.bossClear && !fakeAliveAtAxe && fake?.alive && real?.alive) {
          fakeAliveAtAxe = true;
          fakeY = toPx(fake.body.y);
        }
        princess ??= w.entities.find((e): e is Princess => e instanceof Princess);
        return [];
      },
    });
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'end' });
    expect(fake?.fake).toBe(true);
    expect(Math.floor(toPx((fake as Bowser).body.x) / 16)).toBeLessThanOrEqual(21);
    expect(real?.fake).toBe(false);
    expect(real?.attack).toBe('hammer');
    expect(fakeAliveAtAxe).toBe(true);
    expect(lowest).toBeGreaterThan(12 * 16); // the real one fell through where the bridge was
    expect((fake as Bowser).alive).toBe(true); // the fake one is left standing
    expect(toPx((fake as Bowser).body.y)).toBeLessThanOrEqual(fakeY);
    expect(princess).toBeDefined();
  });
});
