import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim, ScriptedInput } from '@game/sim/headless';
import { LevelScene } from '@game/scenes/level';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Game } from '@game/scenes/game';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { Lakitu } from '@game/entities/enemies/lakitu';
import { Vine } from '@game/entities/objects/vine';
import { PowerUp } from '@game/entities/objects/powerup';
import { Projectile } from '@game/entities/projectiles/projectile';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World, WorldEvent } from '@game/world/world';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/lost/world8', `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const loops = (events: WorldEvent[]) => events.filter((e) => e.type === 'loop');
const pipeTarget = (events: WorldEvent[]) => {
  const e = events.find((x) => x.type === 'pipe');
  return e?.type === 'pipe' ? e.target : undefined;
};

/** Put the player at column `col` (plus `dx` px), feet on top of row `floor`, camera along. */
function place(w: World, col: number, floor: number, dx = 2): void {
  const b = w.player.body;
  b.x = px(col * 16 + dx);
  b.y = px(floor * 16) - b.h;
  b.vx = 0;
  b.vy = 0;
  w.camera.snapTo(b.x);
}

/** Stand on a pipe top (or beside a side pipe) and hold a direction until the pipe takes the player. */
function enterPipe(id: string, col: number, floor: number, hold: Action, dx = 2) {
  return runSim({
    level: level(id),
    character: MARIO,
    script: none,
    maxFrames: 300,
    assist: { invulnerable: true },
    controller: (w, f) => {
      if (f === 0) place(w, col, floor, dx);
      return [hold];
    },
  });
}

/** Bump the vine brick, stand on it once the beanstalk is up and climb to the top. */
function climbVine(id: string, tx: number, ty: number, safe: [number, number]) {
  let vine: Vine | undefined;
  return {
    run: runSim({
      level: level(id),
      character: MARIO,
      script: none,
      maxFrames: 900,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) {
          place(w, safe[0], safe[1]);
          w.strikeBlock(tx, ty, w.player, false);
        }
        vine ??= w.entities.find((e): e is Vine => e instanceof Vine);
        if (f === 60) place(w, tx, ty, 0); // on the used block, beside the stalk
        return f >= 60 ? ['up'] : [];
      },
    }),
    vine: () => vine,
  };
}

const AREAS = [
  'll-8-1',
  'll-8-1-water',
  'll-8-1-exit',
  'll-8-2',
  'll-8-2-warp',
  'll-8-2-bonus',
  'll-8-3',
  'll-8-3-sky',
  'll-8-4',
  'll-8-4-water',
  'll-8-4-end',
  'll-8-4-end2',
  'll-8-4-end3',
];

describe('Lost Levels World 8 areas', () => {
  it.each(AREAS)('%s loads and runs 600 frames as Mario', (id) => {
    const r = runSim({
      level: level(id),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
    });
    expect(r.outcome).toBe('timeout');
    expect(r.frames).toBe(600);
  });

  it.each(AREAS)('%s survives 600 frames of running and jumping', (id) => {
    const r = runSim({
      level: level(id),
      character: MARIO,
      script: none,
      maxFrames: 600,
      controller: (_w, f) => (f % 50 < 20 ? ['right', 'jump'] : ['right']),
    });
    expect(r.frames).toBeGreaterThan(0);
  });
});

describe('Lost Levels 8-1: the water detour ends in a backwards warp', () => {
  it('the pipe at 176 drops into the water area', () => {
    const r = enterPipe('ll-8-1', 176, 9, 'down');
    expect(r.outcome).toBe('pipe');
    expect(pipeTarget(r.events)).toEqual({ level: 'll-8-1-water', x: 2, y: 1, exitDir: 'none' });
  });

  it('the water area side pipe at 77 leads to the small exit area', () => {
    const r = enterPipe('ll-8-1-water', 76, 9, 'right');
    expect(r.outcome).toBe('pipe');
    expect(pipeTarget(r.events)).toEqual({ level: 'll-8-1-exit', x: 3, y: 10, exitDir: 'up' });
  });

  it('whose only way on is the warp pipe back to 5-1', () => {
    const r = enterPipe('ll-8-1-exit', 22, 10, 'down');
    expect(r.outcome).toBe('pipe');
    expect(pipeTarget(r.events)).toEqual({ level: 'll-5-1', x: 2, y: 12 });
  });
});

describe('Lost Levels 8-1: poison', () => {
  it('the ? block at 40 holds a poison mushroom that shrinks big Mario', () => {
    const l = level('ll-8-1');
    l.entities = []; // only the block and the player
    let seen = false;
    const r = runSim({
      level: l,
      character: MARIO,
      state: { powerState: 'big' },
      script: none,
      maxFrames: 600,
      controller: (w, f) => {
        if (f === 0) {
          place(w, 44, 13);
          w.strikeBlock(40, 9, w.player, false);
        }
        if (w.entities.some((e) => e instanceof PowerUp && e.item === 'poison')) seen = true;
        return [];
      },
      until: (w) => seen && w.player.powerState === 'small',
    });
    expect(seen).toBe(true);
    expect(r.outcome).toBe('stopped');
    expect(r.world.player.dead).toBe(false);
  });
});

describe('Lost Levels 8-2 and 8-3: vines', () => {
  it('8-2: the vine brick at 127 grows a beanstalk to the area with the flagpole', () => {
    const { run, vine } = climbVine('ll-8-2', 127, 5, [125, 10]);
    expect(vine()?.fromBlock).toEqual({ tx: 127, ty: 5 });
    expect(run.outcome).toBe('pipe');
    expect(pipeTarget(run.events)).toEqual({ level: 'll-8-2-warp', x: 4, y: 14, exitDir: 'climb' });
  });

  it('8-2: the flagpole beyond the vine ends the stage and leads to 8-3', () => {
    const r = runSim({
      level: level('ll-8-2-warp'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) {
          w.player.vine = null;
          place(w, 26, 6, 8); // in the air just left of the pole
        }
        return ['right'];
      },
    });
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'll-8-3' });
  });

  it('8-3: the vine brick at 98 leads to the coin heaven', () => {
    const { run, vine } = climbVine('ll-8-3', 98, 8, [96, 13]);
    expect(vine()?.fromBlock).toEqual({ tx: 98, ty: 8 });
    expect(run.outcome).toBe('pipe');
    expect(pipeTarget(run.events)).toEqual({ level: 'll-8-3-sky', x: 4, y: 14, exitDir: 'climb' });
  });

  it('8-3: walking off the end of the coin heaven drops back into 8-3 at 114', () => {
    const r = runSim({
      level: level('ll-8-3-sky'),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) {
          w.player.vine = null;
          place(w, 92, 13);
        }
        return ['right'];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(pipeTarget(r.events)).toEqual({ level: 'll-8-3', x: 114, y: 0, exitDir: 'fall' });
  });
});

describe('Lost Levels 8-3: Lakitu', () => {
  it('flies at mid height over the start and leaves at column 55', () => {
    let lakitu: Lakitu | undefined;
    let left = false;
    const ys = new Set<number>();
    runSim({
      level: level('ll-8-3'),
      character: MARIO,
      script: none,
      maxFrames: 900,
      assist: { invulnerable: true },
      controller: (w, f) => {
        lakitu ??= w.entities.find((e): e is Lakitu => e instanceof Lakitu);
        if (lakitu?.leaving) left = true;
        if (lakitu && !left) ys.add(toPx(lakitu.body.y));
        if (f === 0) place(w, 25, 13); // just past the start column: Lakitu comes once the player is in
        if (f === 200 && lakitu) place(w, 60, 13); // past the end column
        return [];
      },
      until: () => left && !(lakitu as Lakitu).alive,
    });
    expect(lakitu).toBeDefined();
    expect([...ys]).toEqual([112]);
    expect(left).toBe(true);
  });
});

describe('Lost Levels 8-4: the last castle', () => {
  it('the first hall loops from 88 back to 24 on the floor', () => {
    const r = runSim({
      level: level('ll-8-4'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 86, 13);
        return ['right'];
      },
      until: (w, f) => f > 1 && toPx(w.player.body.x) < 60 * 16,
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 88, to: 24 }]);
  });

  it('the pipe at 47 is the way on: water, then a small room, then the maze', () => {
    expect(pipeTarget(enterPipe('ll-8-4', 47, 11, 'down').events)).toEqual({
      level: 'll-8-4-water',
      x: 3,
      y: 10,
      exitDir: 'up',
    });
    expect(pipeTarget(enterPipe('ll-8-4-water', 44, 10, 'right').events)).toEqual({
      level: 'll-8-4-end',
      x: 3,
      y: 10,
      exitDir: 'up',
    });
    expect(pipeTarget(enterPipe('ll-8-4-end', 10, 11, 'down').events)).toEqual({
      level: 'll-8-4-end2',
      x: 3,
      y: 10,
      exitDir: 'up',
    });
  });

  it('maze: the lower path at 48 skips ahead to 112', () => {
    const r = runSim({
      level: level('ll-8-4-end2'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) {
          place(w, 48, 13, 0);
          w.player.body.x = px(48 * 16 - 2) - (w.player.body.w >> 1);
        }
        return ['right'];
      },
      until: (w, f) => f > 1 && toPx(w.player.body.x) > 100 * 16,
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 48, to: 112 }]);
  });

  it('maze: the upper path at 112 loops back to 48', () => {
    const r = runSim({
      level: level('ll-8-4-end2'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) {
          place(w, 112, 9, 0);
          w.player.body.x = px(112 * 16 - 2) - (w.player.body.w >> 1);
        }
        return ['right'];
      },
      until: (w, f) => f > 1 && toPx(w.player.body.x) < 60 * 16,
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 112, to: 48 }]);
  });

  it('maze: the wrong pipes lead back to the start of the castle', () => {
    for (const x of [35, 99]) {
      expect(pipeTarget(enterPipe('ll-8-4-end2', x, 11, 'down').events)).toEqual({
        level: 'll-8-4',
        x: 47,
        y: 10,
        exitDir: 'up',
      });
    }
    expect(pipeTarget(enterPipe('ll-8-4-end3', 14, 13, 'down').events)).toEqual({
      level: 'll-8-4',
      x: 47,
      y: 10,
      exitDir: 'up',
    });
  });

  it('maze: the side pipe at the far end leads to the Bowser hall', () => {
    const r = enterPipe('ll-8-4-end2', 201, 10, 'right');
    expect(pipeTarget(r.events)).toEqual({ level: 'll-8-4-end3', x: 3, y: 10, exitDir: 'up' });
  });

  /** Count the hammers and flames a Bowser throws while the player stands at `col`. */
  const attacks = (col: number, floor: number, pick: (b: Bowser) => boolean) => {
    let bowser: Bowser | undefined;
    const seen = new Set<number>();
    let hammers = 0;
    let flames = 0;
    runSim({
      level: level('ll-8-4-end3'),
      character: MARIO,
      script: none,
      maxFrames: 700,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, col, floor);
        bowser ??= w.entities.find((e): e is Bowser => e instanceof Bowser && pick(e));
        for (const e of w.entities) {
          if (!(e instanceof Projectile) || e.owner !== bowser || seen.has(e.id)) continue;
          seen.add(e.id);
          if (e.spec.kind === 'hammer') hammers++;
          if (e.spec.kind === 'bowser-flame') flames++;
        }
        return [];
      },
    });
    return { bowser, hammers, flames };
  };

  it('the false Bowser at 23 throws only hammers', () => {
    const { bowser, hammers, flames } = attacks(12, 10, (b) => b.body.x < px(40 * 16));
    expect(bowser?.attack).toBe('hammer');
    expect(hammers).toBeGreaterThanOrEqual(5);
    expect(flames).toBe(0);
  });

  it('the real Bowser on the bridge throws hammers and breathes fire', () => {
    const { bowser, hammers, flames } = attacks(111, 10, (b) => b.body.x > px(100 * 16));
    expect(bowser?.attack).toBe('both');
    expect(hammers).toBeGreaterThanOrEqual(5);
    expect(flames).toBeGreaterThan(0);
  });

  it('the first Bowser is marked fake, the bridge one is not', () => {
    const bowsers: Bowser[] = [];
    const cols: [number, boolean][] = []; // spawn column and fake flag, in order of appearance
    runSim({
      level: level('ll-8-4-end3'),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 12, 10);
        if (f === 200) place(w, 111, 10);
        for (const e of w.entities) {
          if (!(e instanceof Bowser) || bowsers.includes(e)) continue;
          bowsers.push(e);
          cols.push([Math.floor(toPx(e.body.x) / 16), e.fake]);
        }
        return [];
      },
    });
    expect(cols).toEqual([
      [23, true],
      [119, false],
    ]);
  });

  it('the axe drops the real Bowser and leaves the fake one alone, even while it is still around', () => {
    let fake: Bowser | undefined;
    let real: Bowser | undefined;
    let fakeY = 0;
    let onAxe = false;
    const r = runSim({
      level: level('ll-8-4-end3'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 12, 10);
        for (const e of w.entities) {
          if (!(e instanceof Bowser)) continue;
          if (e.fake && !fake) {
            fake = e;
            e.despawnMargin = null; // keep it in the world (normally it is culled off screen)
          }
          if (!e.fake) real ??= e;
        }
        if (fake && !real && f % 60 === 0) place(w, 111, 10); // bring the bridge into view
        if (real && !onAxe) {
          onAxe = true;
          fakeY = toPx((fake as Bowser).body.y);
          place(w, 125, 9, 0);
        }
        return [];
      },
    });
    expect(fake?.alive).toBe(true);
    expect(r.world.entities.includes(fake as Bowser)).toBe(true);
    expect(toPx((fake as Bowser).body.y)).toBeLessThanOrEqual(fakeY + 1);
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'end' });
    // The real one fell through the cut bridge.
    expect(toPx((real as Bowser).body.y)).toBeGreaterThan(15 * 16 - 64);
  });
});

describe('Lost Levels 8-4: the ending', () => {
  it('taking the axe in the last area hands 8-4 (its parent) to the ending scene', () => {
    const showEnding = vi.fn();
    const goToLevel = vi.fn();
    const game = {
      ctx: {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST, invulnerable: true },
        reduceFlashing: true,
      },
      state: newGameState(MARIO),
      playtestDone: null,
      deps: { getLevel: level },
      scenes: { push: vi.fn() },
      showEnding,
      goToLevel,
    } as unknown as Game;
    const scene = new LevelScene(game, level('ll-8-4-end3'), { x: 111, y: 9, mode: 'stand' });
    const input = new ScriptedInput(none);
    let onAxe = false;
    for (let f = 0; f < 1500 && showEnding.mock.calls.length === 0; f++) {
      if (!onAxe && scene.world.entities.some((e) => e instanceof Bowser)) {
        onAxe = true;
        place(scene.world, 125, 9, 0);
      }
      input.next();
      scene.update(input);
    }
    expect(onAxe).toBe(true);
    expect(showEnding).toHaveBeenCalledWith('ll-8-4');
    expect(goToLevel).not.toHaveBeenCalled();
  });
});
