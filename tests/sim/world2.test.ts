import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { autoPlayer, newBot } from '@game/sim/bot';
import { MARIO } from '@game/characters/mario';
import { Cheep } from '@game/entities/enemies/cheep';
import { Blooper } from '@game/entities/enemies/blooper';
import { Podoboo } from '@game/entities/enemies/podoboo';
import { Vine } from '@game/entities/objects/vine';
import { Spring } from '@game/entities/objects/spring';
import { T } from '@game/level/tiles';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/world2', `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const at = (l: LevelData, x: number, y: number): LevelData => {
  l.start = { x, y };
  l.startMode = 'stand';
  return l;
};

describe('World 2: water', () => {
  it('2-2 starts with a drop into the water and the player sinks slowly to the floor', () => {
    const r = runSim({
      level: level('2-2'),
      character: MARIO,
      script: none,
      maxFrames: 900,
      until: (w, f) => f > 10 && w.player.body.onGround,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.world.player.inWater).toBe(true);
    expect(toPx(r.world.player.body.y + r.world.player.body.h)).toBe(13 * 16);
    // Slower than falling through air: the sink is capped at Character.as vyMaxPsvWater (2.08 px/f).
    expect(r.frames).toBeGreaterThan(80);
  });

  it('tapping jump strokes upward but cannot leave the water', () => {
    const l = level('2-2');
    const r = runSim({
      level: l,
      character: MARIO,
      script: none,
      maxFrames: 600,
      controller: (w, f) => (w.player.body.onGround || f % 12 === 0 ? ['jump'] : []),
      until: (w, f) => f > 400 && w.player.body.onGround,
    });
    const b = r.world.player.body;
    expect(r.outcome).toBe('timeout');
    expect(toPx(b.y)).toBeLessThan(10 * 16); // well above the floor
    expect(toPx(b.y)).toBeGreaterThan(toPx(r.world.waterTop) - 16); // never clear of the surface
    expect(r.world.player.anim).toBe('swim');
  });

  it('cannot run underwater', () => {
    const r = runSim({
      level: level('2-2'),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: ['right', 'attack'] }] },
      maxFrames: 400,
    });
    expect(Math.abs(r.world.player.body.vx)).toBeLessThanOrEqual(MARIO.movement.maxWalk);
  });

  it('cheep cheeps drift left through tiles, bloopers chase, and neither can be stomped', () => {
    const l = at(level('2-2'), 78, 12);
    const r = runSim({
      level: l,
      character: MARIO,
      script: none,
      maxFrames: 200,
      assist: { invulnerable: true },
      until: (_w, f) => f >= 150,
    });
    const cheeps = r.world.entities.filter((e): e is Cheep => e instanceof Cheep);
    const bloopers = r.world.entities.filter((e): e is Blooper => e instanceof Blooper);
    expect(cheeps.length).toBeGreaterThan(0);
    expect(bloopers.length).toBeGreaterThan(0);
    for (const c of cheeps) {
      expect(c.body.vx).toBeLessThan(0);
      expect(c.stompable).toBe(false);
      expect(c.vulnerability.stomp).toBe('hurtAttacker');
    }
    for (const b of bloopers) {
      expect(b.stompable).toBe(false);
      expect(b.body.y).toBeGreaterThanOrEqual(r.world.waterTop);
    }
    const grey = cheeps.find((c) => c.color === 'grey');
    const red = cheeps.find((c) => c.color === 'red');
    if (grey && red) expect(Math.abs(red.body.vx)).toBeGreaterThan(Math.abs(grey.body.vx));
  });

  it('a fireball kills a cheep cheep', () => {
    const l = at(level('2-2'), 73, 12);
    let target: Cheep | undefined;
    const r = runSim({
      level: l,
      character: MARIO,
      state: { powerState: 'fire' },
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
      controller: (w, f) => {
        target ??= w.entities.find((e): e is Cheep => e instanceof Cheep && e.alive);
        if (!target) return [];
        const p = w.player;
        p.facing = target.body.x > p.body.x ? 1 : -1;
        // Swim to the fish's height, then shoot.
        const out: Action[] = [];
        if (p.body.y > target.body.y && f % 6 === 0) out.push('jump');
        if (Math.abs(p.body.y - target.body.y) < px(12) && f % 10 === 0) out.push('attack');
        return out;
      },
      until: () => target !== undefined && !target.alive,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.score).toBeGreaterThanOrEqual(200);
  });

  it("2-2's side pipe leads to the exit area", () => {
    // Swim up the steps in front of the pipe, then walk into its mouth.
    const l = at(level('2-2'), 187, 9);
    const r = runSim({
      level: l,
      character: MARIO,
      script: none,
      maxFrames: 900,
      // Stroke up only until the feet are level with the pipe's floor (row 9).
      controller: (w, f) => (f % 12 === 0 && toPx(w.player.feetY) > 9 * 16 ? ['right', 'jump'] : ['right']),
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: '2-2-exit', x: 3, y: 10, exitDir: 'up' },
    });
  });
});

describe('World 2: bridges, springs, vines and lava', () => {
  it('flying cheep cheeps leap from below on the 2-3 bridges and can be stomped', () => {
    const l = at(level('2-3'), 20, 9); // on the bridge deck (row 10)
    const r = runSim({
      level: l,
      character: MARIO,
      script: { steps: [{ frame: 0, hold: ['right'] }] },
      maxFrames: 400,
      assist: { invulnerable: true },
      until: (w) => w.entities.some((e) => e instanceof Cheep && e.flying),
    });
    expect(r.outcome).toBe('stopped');
    const c = r.world.entities.find((e): e is Cheep => e instanceof Cheep && e.flying) as Cheep;
    expect(c.body.vy).toBeLessThan(0);
    expect(c.stompable).toBe(true);
    expect(toPx(c.body.y)).toBeGreaterThan(200);
  });

  it('no flying cheep cheeps outside the zone', () => {
    const l = at(level('2-3'), 2, 12);
    const r = runSim({ level: l, character: MARIO, script: none, maxFrames: 300 });
    expect(r.world.entities.some((e) => e instanceof Cheep)).toBe(false);
  });

  it('the 2-1 springboard throws the player higher than a jump, higher still with jump held', () => {
    const l = level('2-1');
    expect(l.entities).toContainEqual({ type: 'spring', x: 188, y: 12 });
    const bounce = (hold: boolean): number => {
      // Drop onto the plate from two tiles up.
      const lv = at(level('2-1'), 188, 9);
      let launched = false;
      let minY = Infinity;
      const r = runSim({
        level: lv,
        character: MARIO,
        script: none,
        maxFrames: 400,
        controller: (w) => {
          const spring = w.entities.find((e): e is Spring => e instanceof Spring);
          if (spring?.busy) launched = true;
          if (launched) minY = Math.min(minY, toPx(w.player.body.y));
          const out: Action[] = [];
          if (hold && launched) out.push('jump');
          return out;
        },
        until: (w, f) => launched && f > 60 && w.player.body.onGround,
      });
      expect(launched).toBe(true);
      expect(r.outcome).toBe('stopped');
      return 13 * 16 - 16 - minY; // px above the ground-standing height
    };
    const plain = bounce(false);
    const held = bounce(true);
    expect(plain).toBeGreaterThanOrEqual(80);
    expect(held).toBeGreaterThan(plain + 48);
  });

  it('hitting the vine brick grows a beanstalk; climbing off the top leads to the sky', () => {
    // Stand on the ? block at 82 with the head under the vine brick at 83 (no goombas underfoot).
    const l = at(level('2-1'), 82, 8);
    l.entities = l.entities.filter((e) => e.type !== 'goomba');
    expect(l.tiles[5 * l.width + 83]).toBe(T.BRICK_VINE);
    let vine: Vine | undefined;
    const r = runSim({
      level: l,
      character: MARIO,
      state: { powerState: 'big' },
      script: none,
      maxFrames: 900,
      controller: (w, f) => {
        if (f === 0) w.player.body.x = px(82 * 16 + 10);
        if (!vine) {
          vine = w.entities.find((e): e is Vine => e instanceof Vine);
          // Step beside the block so the next jump touches the beanstalk instead of the block.
          if (vine) w.player.body.x = px(82 * 16 + 4);
        }
        if (!vine) return f % 40 < 20 ? ['jump'] : [];
        return w.player.vine ? ['up'] : f % 40 < 20 ? ['jump'] : [];
      },
    });
    expect(vine).toBeDefined();
    expect((vine as Vine).fromBlock).toEqual({ tx: 83, ty: 5 });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: '2-1-sky', x: 4, y: 14, exitDir: 'climb' },
    });
  });

  it('the sky area starts on the vine, climbs up onto the clouds, and ends by dropping back into 2-1', () => {
    // The arrival plays itself (the original's vineStart): the vine grows, Mario climbs it and
    // steps off to the right with no input.
    const climb = runSim({
      level: level('2-1-sky'),
      character: MARIO,
      script: none,
      maxFrames: 200,
    });
    const p = climb.world.player;
    expect(p.vine).not.toBeNull();
    expect(p.anim).toBe('climb');
    expect(toPx(p.body.y)).toBeLessThan(240);

    const bot = newBot();
    const r = runSim({
      level: level('2-1-sky'),
      character: MARIO,
      script: none,
      maxFrames: 3000,
      controller: (w) => (w.player.vine || w.player.frozen ? [] : autoPlayer(w, bot)),
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: '2-1', x: 162, y: 0, exitDir: 'fall' },
    });
  });

  it('podoboos in 2-4 leap out of the lava, fall back, and shrug off fireballs', () => {
    const l = at(level('2-4'), 8, 6);
    let pod: Podoboo | undefined;
    let maxRise = 0;
    const r = runSim({
      level: l,
      character: MARIO,
      state: { powerState: 'fire' },
      script: none,
      maxFrames: 600,
      controller: (w, f) => {
        pod ??= w.entities.find((e): e is Podoboo => e instanceof Podoboo);
        if (pod?.airborne) maxRise = Math.max(maxRise, 12 * 16 + 20 - toPx(pod.body.y));
        return f % 15 === 0 ? ['attack'] : [];
      },
      until: () => maxRise > 0 && !(pod as Podoboo).airborne,
    });
    expect(pod).toBeDefined();
    expect(r.outcome).toBe('stopped');
    expect((pod as Podoboo).alive).toBe(true);
    expect(maxRise).toBeGreaterThan(5 * 16);
    expect(maxRise).toBeLessThanOrEqual(10 * 16);
  });

  it('every World 2 area loads and runs', () => {
    for (const id of ['2-1', '2-1-sky', '2-1-bonus', '2-2-intro', '2-2', '2-2-exit', '2-3', '2-4']) {
      const r = runSim({ level: level(id), character: MARIO, script: none, maxFrames: 60 });
      expect(r.frames).toBe(60);
    }
  });
});
