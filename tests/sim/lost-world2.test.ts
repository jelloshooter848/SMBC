import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { autoPlayer, newBot } from '@game/sim/bot';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { Cheep } from '@game/entities/enemies/cheep';
import { Spring } from '@game/entities/objects/spring';
import { PowerUp } from '@game/entities/objects/powerup';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/lost/world2', `${id}.map`), 'utf8'),
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

/** The level without its enemies (scenery and springs stay), starting on foot at col,row. */
function bare(id: string, col: number, row: number): LevelData {
  const l = level(id);
  l.entities = l.entities.filter((e) => e.type.startsWith('decor') || e.type.startsWith('spring'));
  l.start = { x: col, y: row };
  l.startMode = 'stand';
  return l;
}

const AREAS = ['ll-2-1', 'll-2-1-bonus', 'll-2-1-sky', 'll-2-2', 'll-2-2-bonus', 'll-2-3', 'll-2-4'];

describe('Lost Levels World 2 areas', () => {
  it.each(AREAS)('%s loads and runs 600 frames as Mario', (id) => {
    const r = runSim({
      level: level(id),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
    });
    expect(r.frames).toBe(600);
    for (const v of [r.playerX, r.playerY]) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('Lost Levels 2-1', () => {
  it('the green springboard at 114 launches Mario off the top of the screen', () => {
    let spring: Spring | undefined;
    let launched = false;
    let minFeet = Infinity;
    const r = runSim({
      level: bare('ll-2-1', 114, 6),
      character: MARIO,
      script: none,
      maxFrames: 800,
      controller: (w) => {
        spring ??= w.entities.find((e): e is Spring => e instanceof Spring && toPx(e.body.x) >> 4 === 114);
        if (spring?.busy) launched = true;
        const b = w.player.body;
        if (launched) minFeet = Math.min(minFeet, toPx(b.y + b.h));
        return launched ? ['jump'] : [];
      },
      until: (w, f) => launched && f > 60 && w.player.body.onGround,
    });
    expect(spring?.green).toBe(true);
    expect(launched).toBe(true);
    expect(minFeet).toBeLessThan(0); // the feet leave the top of the screen
    expect(r.outcome).toBe('stopped'); // and Mario lands again
    expect(r.world.player.dead).toBe(false);
  });

  it('the ? block at 148,9 holds a poison mushroom that kills small Mario', () => {
    let poison: PowerUp | undefined;
    const r = runSim({
      level: bare('ll-2-1', 148, 12),
      character: MARIO,
      script: none,
      maxFrames: 600,
      controller: (w, f) => {
        if (f === 0) place(w, 148, 13, 2);
        poison ??= w.entities.find((e): e is PowerUp => e instanceof PowerUp);
        if (!poison) return f % 40 < 20 ? ['jump'] : [];
        return poison.body.x > w.player.body.x ? ['right'] : ['left'];
      },
      until: (w) => w.player.dead,
    });
    expect(poison?.item).toBe('poison');
    expect(r.world.player.dead).toBe(true);
    expect(poison?.alive).toBe(false);
    expect(toPx(r.world.player.body.x)).toBeLessThan(162 * 16);
  });

  it('the sky ends in a drop back into 2-1 at column 146', () => {
    const r = runSim({
      level: bare('ll-2-1-sky', 90, 5),
      character: MARIO,
      script: none,
      maxFrames: 200,
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-2-1', x: 146, y: 0, exitDir: 'fall' },
    });
  });

  it('the bonus room has a hole in its floor at column 3', () => {
    const r = runSim({
      level: level('ll-2-1-bonus'),
      character: MARIO,
      script: none,
      maxFrames: 200,
      controller: (w, f) => {
        if (f === 0) place(w, 3, 13, 2);
        return [];
      },
      until: (w) => w.player.dead,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.world.player.dead).toBe(true);
    expect(r.frames).toBeLessThan(60);
  });

  it('the bonus room side pipe returns to the pipe at 83', () => {
    const bot = newBot();
    const r = runSim({
      level: level('ll-2-1-bonus'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      controller: (w, f) => {
        if (f === 0) place(w, 5, 13, 2); // past the hole
        return autoPlayer(w, bot);
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: 'll-2-1', x: 83, y: 10, exitDir: 'up' },
    });
  });
});

describe('Lost Levels 2-3', () => {
  it('Cheep Cheeps leap from below on the bridges', () => {
    let leaper: Cheep | undefined;
    runSim({
      level: bare('ll-2-3', 20, 9),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
      controller: (w) => {
        leaper ??= w.entities.find((e): e is Cheep => e instanceof Cheep && e.flying);
        return [];
      },
      until: () => leaper !== undefined,
    });
    expect(leaper).toBeDefined();
    expect(leaper?.color).toBe('red');
  });
});

describe('Lost Levels 2-4', () => {
  it('Bowser breathes fire (no hammers) and the axe leads on to 3-1', () => {
    let bowser: Bowser | undefined;
    const r = runSim({
      level: level('ll-2-4'),
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
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'll-3-1' });
  });
});
