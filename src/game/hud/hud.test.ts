import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { AssetRegistry } from '@engine/assets/registry';
import { parseTextMap } from '../level/textmap';
import { runSim } from '../sim/headless';
import { CHARACTERS } from '../characters/registry';
import type { CharacterDef } from '../characters/character';
import { drawHud } from './hud';

const level = parseTextMap(
  readFileSync(join(import.meta.dirname, '../../content/levels/world1/1-1.map'), 'utf8'),
  '1-1',
);

interface Box {
  what: string;
  x: number;
  y: number;
  w: number;
}

/** Draw the HUD for a run with these heroes and record every text and icon it puts down. */
function hud(c1: CharacterDef, c2: CharacterDef | null, score: number): Box[] {
  const w = runSim({
    level,
    character: c1,
    state: { character2: c2, score, coins: 99 },
    script: { steps: [{ frame: 0, hold: [] }] },
    maxFrames: 1,
  }).world;
  // Fill every optional field: E-tanks, ammo counts, and a full tool belt.
  for (const p of w.players) Object.assign(p.scratch, { etanks: 9, tool: 1 });
  const boxes: Box[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string, x: number, y: number): void {
      boxes.push({ what: str, x, y, w: str.length * 8 });
    },
    sprite(_s: SpriteSheet, frame: string, x: number, y: number): void {
      boxes.push({ what: frame, x, y, w: 8 });
    },
  });
  const assets = { sheet: () => ({}) } as unknown as AssetRegistry;
  drawHud(r, assets, w.state, 400, 0, w.players);
  return boxes;
}

describe('HUD', () => {
  it('shows a 7-digit score, as the original Crossover does', () => {
    const texts = hud(CHARACTERS[0] as CharacterDef, null, 1234).map((b) => b.what);
    expect(texts).toContain('0001234');
  });

  const pairs: [CharacterDef, CharacterDef | null][] = [];
  for (const a of CHARACTERS) {
    pairs.push([a, null]);
    for (const b of CHARACTERS) pairs.push([a, b]);
  }
  it.each(pairs.map(([a, b]) => [a.id, b?.id ?? '-', a, b] as const))(
    '%s + %s: nothing overlaps and everything is on screen',
    (_a, _b, a, b) => {
      const boxes = hud(a, b, 9999999);
      for (const x of boxes) {
        expect(x.x).toBeGreaterThanOrEqual(0);
        expect(x.x + x.w).toBeLessThanOrEqual(256);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const p = boxes[i] as Box;
          const q = boxes[j] as Box;
          // The blinking TIME label is drawn twice on purpose.
          if (p.what === q.what && p.x === q.x && p.y === q.y) continue;
          const overlap = Math.abs(p.y - q.y) < 8 && p.x < q.x + q.w && q.x < p.x + p.w;
          expect(overlap, `${p.what}@${p.x},${p.y} vs ${q.what}@${q.x},${q.y}`).toBe(false);
        }
      }
    },
  );

  it('keeps a gap between the score and the coin counter', () => {
    const boxes = hud(CHARACTERS[0] as CharacterDef, null, 9999999);
    const score = boxes.find((b) => b.what === '9999999') as Box;
    const coins = boxes.find((b) => b.what.startsWith('$')) as Box;
    expect(coins.y).toBe(score.y);
    expect(coins.x - (score.x + score.w)).toBeGreaterThanOrEqual(16);
  });
});
