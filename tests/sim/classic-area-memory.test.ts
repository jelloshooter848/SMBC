import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { getLevel } from '@content/levels';
import { MARIO } from '@game/characters/mario';
import { Goomba } from '@game/entities/enemies/goomba';
import type { Entity } from '@game/entities/entity';
import { runSim, ScriptedInput } from '@game/sim/headless';
import type { AreaMemory, World, WorldStart } from '@game/world/world';

// Classic SMBC's area memory (StatManager.saveAreaStats / Level.rebuildLevel): an area left
// through a pipe, vine or pit comes back as it was left when the hero returns within the stage;
// a new stage, a death or a warp starts fresh (resetLevelStats). And the flag walk's camera.

function world(id: string, start: WorldStart, rules: 'classic' | 'current' = 'classic'): World {
  const level = getLevel(id);
  if (!level) throw new Error(id);
  return runSim({ level, character: MARIO, script: { steps: [] }, maxFrames: 0, rules, start }).world;
}

function hold(w: World, keys: Action[], n: number): void {
  const input = new ScriptedInput({ steps: [{ frame: 0, hold: keys }] });
  for (let i = 0; i < n; i++) {
    input.next();
    w.update([input]);
  }
}

const parked = (w: World): Entity[] => (w as unknown as { parked: Entity[] }).parked;
const goombas = (w: World): Goomba[] =>
  [...w.entities, ...parked(w)].filter((e): e is Goomba => e instanceof Goomba && e.alive);

/** Puts the hero at tile column `tx` on the ground and lets the camera and spawns catch up. */
function place(w: World, tx: number): void {
  w.player.body.x = px(tx * 16);
  w.player.body.vx = 0;
  // The screen's left edge holds the hero, so a jump back left takes the camera along.
  w.camera.x = Math.max(0, Math.min(w.camera.x, w.player.body.x - px(64)));
  hold(w, [], 3);
}

describe('Classic area memory (1-1 and its bonus room)', () => {
  /** 1-1 played up to the bonus pipe: a Goomba killed, a ? block used, one Goomba left alive. */
  function before() {
    const w = world('1-1', { x: 20, y: 12, mode: 'stand' });
    hold(w, [], 2);
    const killed = goombas(w).find((g) => g.body.x < px(24 * 16));
    expect(killed).toBeDefined();
    killed!.destroy();
    const blank = w.map.get(16, 9);
    w.strikeBlock(16, 9, w.player, false);
    const used = w.map.get(16, 9);
    expect(used).not.toBe(blank);
    place(w, 33);
    const alive = goombas(w).find((g) => g.body.x > px(38 * 16));
    expect(alive).toBeDefined();
    return { w, killed: killed!, alive: alive!, blank, used, aliveX: alive!.body.x };
  }

  it('comes back as it was left after the bonus room, and walking back left shows it', () => {
    const { w, killed, alive, used, aliveX } = before();
    expect(w.areaMemory).not.toBeNull();
    w.rememberArea();
    const mem = w.areaMemory as AreaMemory;
    // Down the pipe into the bonus room, and out by its exit pipe (LevelScene passes the memory).
    const bonus = world('1-1-bonus', { x: 1, y: 0, areaMemory: mem, clearEnemies: 'keep-piranhas' });
    hold(bonus, [], 5);
    bonus.rememberArea();
    const back = world('1-1', {
      x: 163,
      y: 10,
      mode: 'pipe-exit',
      clearEnemies: 'keep-piranhas',
      areaMemory: mem,
    });
    hold(back, [], 2);
    // The ? block stays used; the killed Goomba stays gone; the living one waits where it was.
    expect(back.map.get(16, 9)).toBe(used);
    const all = goombas(back);
    expect(all.includes(killed)).toBe(false);
    expect(all.includes(alive)).toBe(true);
    expect(alive.body.x).toBe(aliveX);
    expect(parked(back).includes(alive)).toBe(true);
    // Walking back left, the camera follows and the Goomba comes back on the stage as it was.
    const cam = back.camera.x;
    hold(back, ['left'], 40);
    expect(back.camera.x).toBeLessThan(cam);
    place(back, 34);
    expect(back.entities.includes(alive)).toBe(true);
    // Nothing spawned twice: the spawn list goes on from where it was.
    expect(goombas(back).filter((g) => g.body.x < px(30 * 16))).toHaveLength(0);
  });

  it('a death (or a new stage) starts fresh: blocks and enemies are back', () => {
    const { w } = before();
    w.rememberArea();
    // A respawn builds the World without the memory (Level.reloadLevel → loadNewLevel).
    const fresh = world('1-1', { mode: 'stand' });
    hold(fresh, [], 2);
    expect(fresh.map.get(16, 9)).toBe(before().blank);
  });

  it('Current keeps no area memory', () => {
    const w = world('1-1', { x: 20, y: 12, mode: 'stand' }, 'current');
    expect(w.areaMemory).toBeNull();
    w.rememberArea();
    expect(w.areaMemory).toBeNull();
  });
});

describe('Classic flag walk camera', () => {
  function flagWalk(rules: 'classic' | 'current'): { atWalk: number; end: number } {
    const w = world('1-1', { x: 190, y: 12, mode: 'stand' }, rules);
    let atWalk = -1;
    for (let i = 0; i < 900 && w.clearPhase !== 'countdown'; i++) {
      hold(w, w.clearPhase ? [] : ['right', 'run', 'jump'], 1);
      if (w.clearPhase === 'walk' && atWalk < 0) atWalk = w.camera.x;
    }
    expect(atWalk).toBeGreaterThanOrEqual(0);
    return { atWalk, end: w.camera.x };
  }

  it('Classic: the screen follows the walk to the castle (rightScrollPosOvRd)', () => {
    const { atWalk, end } = flagWalk('classic');
    expect(end).toBeGreaterThan(atWalk);
  });

  it('Current: the screen holds still through the walk, as before', () => {
    const { atWalk, end } = flagWalk('current');
    expect(end).toBe(atWalk);
  });
});
