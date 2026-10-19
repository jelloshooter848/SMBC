import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { SOPHIA } from '@game/characters/sophia';
import { SOPHIA_CLASSIC } from '@game/characters/sophia/classic';
import { SCROLL_DECAY, cameraLag, sophiaCameraX } from '@game/characters/sophia/classic-camera';
import { sophiaState } from '@game/characters/sophia/state';
import { CHARACTERS, CLASSIC_CHARACTERS } from '@game/characters/registry';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';

/*
 * Classic SMBC Sophia III's camera on corner turns (bug-reports/2026-10-07-sophia-build-classic-
 * character.md SO-39; Sophia.as screenScrollPosOffset): the jump in her anchor is paid out over
 * the turn's frames, then the rest decays ×0.926 a frame (SCROLL_FRICTION 0.01 a second). Only her
 * Classic def sets CharacterDef.cameraX; every other camera path still follows body.x.
 */

const W = 40;
/** Floor on rows 13-14; a wall two tiles high at column `col` (rows 11-12), climbable. */
function wallRoom(col: number) {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(W));
  for (const y of [9, 10, 11, 12]) rows[y] = '.'.repeat(col) + 'B' + '.'.repeat(W - col - 1);
  return parseTextMap(
    ['id: t', 'time: 300', 'start: 2,12', '', '[tiles]', ...rows, '#'.repeat(W), '#'.repeat(W)].join('\n'),
  );
}

interface Row {
  x: number;
  cam: number;
  lag: number;
  turning: boolean;
}

function climb(rules: 'classic' | 'current') {
  const log: Row[] = [];
  const res = runSim({
    level: wallRoom(12),
    character: SOPHIA,
    rules,
    script: { steps: [] },
    maxFrames: 160,
    controller: (w) => {
      const p = w.player;
      if (rules === 'classic')
        log.push({
          x: p.body.x,
          cam: p.body.x + cameraLag(p),
          lag: cameraLag(p),
          turning: !!sophiaState(p).turn,
        });
      return ['right', 'up'] as Action[];
    },
    state: { kit: {}, powerState: 'fire' },
  });
  return { log, world: res.world };
}

describe('SO-39: easing the camera through her turns', () => {
  it('holds back the anchor jump of a turn and pays it out', () => {
    const { log } = climb('classic');
    const turn = log.findIndex((r) => r.turning);
    expect(turn).toBeGreaterThan(0);
    const end = log.findIndex((r, i) => i > turn && !r.turning);
    // Something was held back during the turn.
    expect(log.slice(turn, end + 2).some((r) => r.lag !== 0)).toBe(true);
    // The eased anchor never steps further in a frame than the box itself did.
    const step = (k: 'x' | 'cam') =>
      Math.max(...log.slice(turn, end + 2).map((r, i, a) => (i ? Math.abs(r[k] - (a[i - 1] as Row)[k]) : 0)));
    expect(step('cam')).toBeLessThanOrEqual(step('x'));
  });

  it('a jump outside a turn (her box turning upright) decays ×0.926 a frame (0.01 a second) to nothing', () => {
    expect(SCROLL_DECAY).toBeCloseTo(0.92612, 4);
    const { world } = climb('classic');
    const p = world.player;
    const st = sophiaState(p);
    st.turn = null;
    // Settle, then her box turns upright from a wall on her right: 3.5 px to the left, narrower.
    for (let i = 0; i < 200; i++) sophiaCameraX(p);
    expect(cameraLag(p)).toBe(0);
    const x0 = p.body.x;
    p.body.x -= px(3.5);
    p.body.w += px(3.5);
    const lags: number[] = [];
    for (let i = 0; i < 60; i++) {
      const cam = sophiaCameraX(p);
      lags.push(cameraLag(p));
      expect(Math.abs(cam - x0)).toBeLessThanOrEqual(px(3.5));
    }
    expect(lags[0]).toBeCloseTo(px(3.5) * SCROLL_DECAY, 6);
    for (let i = 1; i < lags.length && (lags[i] as number) !== 0; i++)
      expect((lags[i] as number) / (lags[i - 1] as number)).toBeCloseTo(SCROLL_DECAY, 6);
    // Under SCROLL_MIN_DIST (0.25 px here) it snaps to 0: well inside a second.
    expect(lags.indexOf(0)).toBeGreaterThan(20);
    expect(lags[59]).toBe(0);
  });

  it('only Classic Sophia sets cameraX', () => {
    expect(SOPHIA_CLASSIC.cameraX).toBe(sophiaCameraX);
    for (const def of [...Object.values(CHARACTERS), ...Object.values(CLASSIC_CHARACTERS)])
      if (def && def !== SOPHIA_CLASSIC) expect(def.cameraX, def.id).toBeUndefined();
  });

  it('Current Sophia: the camera follows her box as before', () => {
    const { world } = climb('current');
    expect(world.player.def.cameraX).toBeUndefined();
  });
});
