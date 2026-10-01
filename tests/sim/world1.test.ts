import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { autoPlayer, newBot } from '@game/sim/bot';
import { MARIO } from '@game/characters/mario';
import { Goomba } from '@game/entities/enemies/goomba';

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
