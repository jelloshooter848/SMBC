import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim, ScriptedInput } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { T } from '@game/level/tiles';
import type { World } from '@game/world/world';

// The multi-coin brick (the original's ground/Brick.as): COIN_BRICK_MAX_COINS = 15 coins, and a
// coinBrickTmrDur = 6000 ms timer that starts on the first hit; once it has run out, the next hit
// gives one last coin and the brick is used.

const level = parseTextMap(
  readFileSync(join(import.meta.dirname, '../../src/content/levels/world1/1-1.map'), 'utf8'),
  '1-1',
);
const COL = 94; // the coin brick under the high ? block
const ROW = 9;

const still = new ScriptedInput({ steps: [{ frame: 0, hold: [] }] });
function idle(w: World, frames: number): void {
  for (let i = 0; i < frames; i++) {
    still.next();
    w.update([still]);
  }
}

/** Hit the brick every `gap` frames until it is used; returns the coins it gave. */
function bumpUntilUsed(gap: number): { coins: number; frames: number } {
  const w = runSim({
    level,
    character: MARIO,
    script: { steps: [{ frame: 0, hold: [] }] },
    maxFrames: 1,
    assist: { invulnerable: true, infiniteTime: true },
  }).world;
  expect(w.map.get(COL, ROW)).toBe(T.BRICK_COINS10);
  const start = w.state.coins;
  let frames = 0;
  for (let hit = 0; hit < 40; hit++) {
    w.strikeBlock(COL, ROW, w.player, false);
    idle(w, gap);
    frames += gap;
    if (w.map.get(COL, ROW) === T.USED) break;
  }
  return { coins: w.state.coins - start, frames };
}

describe('multi-coin brick', () => {
  it('gives 15 coins when bumped quickly', () => {
    expect(bumpUntilUsed(20).coins).toBe(15);
  });

  it('runs a 6 s timer from the first hit, then gives one last coin', () => {
    // Hits at 0, 60, ... 300 fall inside the 360 frames; the hit at 360 is the last one.
    expect(bumpUntilUsed(60).coins).toBe(7);
  });
});
