import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { autoPlayer, newBot } from '@game/sim/bot';
import { MARIO } from '@game/characters/mario';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { toPx } from '@engine/math/units';

const level = (id: string) =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/world1', `${id}.map`), 'utf8'),
    id,
  );

const none = { steps: [{ frame: 0, hold: [] }] };

describe('headless sim on World 1', () => {
  it('walking into the first goomba as small Mario is fatal', () => {
    const r = runSim({
      level: level('1-1'),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: ['right'] }] },
      maxFrames: 600,
    });
    expect(r.outcome).toBe('died');
    expect(r.lives).toBe(3); // the scene, not the world, takes the life
  });

  it('entities spawn as the camera approaches and goombas walk left', () => {
    const r = runSim({
      level: level('1-1'),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: ['right'] }] },
      maxFrames: 150,
      until: (w) => w.entities.some((e) => e instanceof Goomba),
    });
    const goombas = r.world.entities.filter((e) => e instanceof Goomba);
    expect(goombas.length).toBeGreaterThanOrEqual(1);
    expect(goombas[0]?.body.vx).toBeLessThan(0);
    expect(r.outcome).toBe('stopped');
  });

  it('the auto-player clears 1-1 with the invulnerability assist', () => {
    const bot = newBot();
    const r = runSim({
      level: level('1-1'),
      character: MARIO,
      script: none,
      maxFrames: 9000,
      assist: { invulnerable: true },
      controller: (w) => autoPlayer(w, bot),
    });
    expect(r.outcome).toBe('cleared');
    expect(r.score).toBeGreaterThan(0);
  });

  it('the auto-player stomps goombas for 100 points without assists', () => {
    const bot = newBot();
    const r = runSim({
      level: level('1-1'),
      character: MARIO,
      script: none,
      maxFrames: 1200,
      controller: (w) => autoPlayer(w, bot),
      until: (w) => w.state.score >= 100,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.score).toBeGreaterThanOrEqual(100);
  });

  it('the timer counts down and kills the player at zero', () => {
    const r = runSim({ level: level('1-1'), character: MARIO, script: none, maxFrames: 400 * 24 + 400 });
    expect(r.outcome).toBe('died');
    expect(r.world.time).toBe(0);
  });

  it('the 1-2 intro auto-walks into the pipe', () => {
    const r = runSim({ level: level('1-2-intro'), character: MARIO, script: none, maxFrames: 600 });
    expect(r.outcome).toBe('pipe');
    expect(r.events[0]).toMatchObject({ type: 'pipe', target: { level: '1-2' } });
  });

  it('the 1-1 bonus room drops you in and its side pipe leads back to the 2-tall pipe at 163', () => {
    const bot = newBot();
    const r = runSim({
      level: level('1-1-bonus'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      controller: (w) => autoPlayer(w, bot),
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events[0]).toMatchObject({
      type: 'pipe',
      target: { level: '1-1', x: 163, y: 10, exitDir: 'up' },
    });
  });

  it('1-2 starts with the drop from the ceiling and lands on the floor', () => {
    const r = runSim({
      level: level('1-2'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      until: (w, f) => f > 10 && w.player.body.onGround,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.world.player.body.onGround).toBe(true);
    expect(toPx(r.world.player.body.y + r.world.player.body.h)).toBe(13 * 16);
  });

  it("1-2's side pipe at 166 leads to the exit area, which rises out of the pipe at 3", () => {
    const l = level('1-2');
    l.start = { x: 160, y: 9 };
    l.startMode = 'stand';
    const r = runSim({
      level: l,
      character: MARIO,
      script: { steps: [{ frame: 0, hold: ['right'] }] },
      maxFrames: 600,
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      type: 'pipe',
      target: { level: '1-2-exit', x: 3, y: 10, exitDir: 'up' },
    });

    const exit = runSim({ level: level('1-2-exit'), character: MARIO, script: none, maxFrames: 90 });
    const b = exit.world.player.body;
    expect(toPx(b.y + b.h)).toBe(11 * 16); // standing on top of the pipe
    expect(b.x).toBeGreaterThanOrEqual(3 * 16 * 256);
    expect(b.x + b.w).toBeLessThanOrEqual(5 * 16 * 256);
  });

  it("1-3's red paratroopas bob ±42.5 px around their spawn height and a stomp clips their wings", () => {
    const l = level('1-3');
    l.start = { x: 71, y: 8 };
    l.startMode = 'stand';
    let para: Koopa | undefined;
    let minY = Infinity;
    let maxY = -Infinity;
    const r = runSim({
      level: l,
      character: MARIO,
      script: none,
      maxFrames: 400,
      until: (w, f) => {
        para ??= w.entities.find((e): e is Koopa => e instanceof Koopa && e.wings);
        if (para) {
          minY = Math.min(minY, toPx(para.body.y));
          maxY = Math.max(maxY, toPx(para.body.y));
        }
        return f >= 300;
      },
    });
    expect(para).toBeDefined();
    const k = para as Koopa;
    expect(k.color).toBe('red');
    // KoopaGreen FT_VERT: waveRange 85 Flash px = ±42.5 px here.
    expect(maxY - minY).toBeGreaterThanOrEqual(84);
    expect(maxY - minY).toBeLessThanOrEqual(86);
    expect(k.currentFrame).toMatch(/^koopa-fly-/);
    expect(k.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, r.world)).toBe('shell');
    expect(k.wings).toBe(false);
    expect(k.state).toBe('walk');
    expect(k.body.vx).toBeLessThan(0);
  });

  it('every World 1 level loads into a world and runs', () => {
    for (const id of ['1-1', '1-1-bonus', '1-2-intro', '1-2', '1-2-bonus', '1-2-exit', '1-3', '1-4']) {
      const r = runSim({
        level: level(id),
        character: MARIO,
        script: { steps: [{ frame: 0, hold: ['right'] }] },
        maxFrames: 120,
      });
      expect(r.frames).toBeGreaterThan(0);
    }
  });
});
