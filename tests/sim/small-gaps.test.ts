import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import type { Action } from '@engine/input/actions';

// A running Mario crosses one-tile gaps at ground level (the original's Level.checkCrossSmallGap,
// gated by MarioBase's canCrossSmallGaps: vx > RUN_TMR_2_MIN_VX); a walking one drops in.

const ll71 = parseTextMap(
  readFileSync(join(import.meta.dirname, '../../src/content/levels/lost/world7/ll-7-1.map'), 'utf8'),
  'll-7-1',
);

const run = (hold: Action[]) =>
  runSim({
    level: ll71,
    character: MARIO,
    assist: { invulnerable: true },
    script: { steps: [{ frame: 0, hold }] },
    maxFrames: 600,
    start: { x: 59, y: 12, mode: 'stand' },
    until: (w) => w.player.body.x > 70 * 16 * 256,
  });

describe('ll-7-1 one-tile gaps at columns 58 and 67', () => {
  it('a full-speed run from column 59 crosses the gap at 67 without a jump', () => {
    const r = run(['right', 'attack']);
    expect(r.outcome).toBe('stopped');
    expect(r.playerY + 16).toBe(13 * 16);
  });

  it('a walk drops into it', () => {
    const r = run(['right']);
    expect(r.outcome).toBe('died');
  });
});
