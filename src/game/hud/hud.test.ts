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
import { Goomba } from '../entities/enemies/goomba';
import { px } from '@engine/math/units';

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

describe('HUD on top of sprites', () => {
  /** Draws the HUD with `covered` and records each text run with the sheet it used. */
  function runs(covered?: (x: number, y: number, w: number, h: number) => boolean) {
    const w = runSim({
      level,
      character: CHARACTERS[0] as CharacterDef,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 1,
    }).world;
    const out: { sheet: string; str: string; x: number; y: number }[] = [];
    const r: Renderer = Object.assign(new NullRenderer(), {
      text(f: SpriteSheet, str: string, x: number, y: number): void {
        out.push({ sheet: f.id, str, x, y });
      },
    });
    const assets = {
      sheet: (id: string, palette?: string) => ({ id: palette ? `${id}@${palette}` : id }),
    } as unknown as AssetRegistry;
    drawHud(r, assets, w.state, 400, 0, w.players, covered ? { covered } : {});
    return { out, world: w };
  }

  it('with nothing under it, each text is drawn once, plain (normal levels look the same)', () => {
    const { out } = runs(() => false);
    expect(out.every((o) => o.sheet === 'font')).toBe(true);
    expect(runs().out).toEqual(out);
  });

  it('a sprite under a text: that text gets a dark 1-px outline drawn first; the rest stay plain', () => {
    // Something under WORLD (144, 8) only.
    const { out } = runs((x, y, w, h) => x < 152 && 144 < x + w && y < 16 && 8 < y + h);
    const dark = out.filter((o) => o.sheet !== 'font');
    expect(dark.map((o) => o.str)).toEqual(['WORLD', 'WORLD', 'WORLD', 'WORLD']);
    expect(dark.every((o) => o.sheet === 'font@font~silhouette')).toBe(true);
    expect(dark.map((o) => [o.x - 144, o.y - 8])).toEqual(
      expect.arrayContaining([
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]),
    );
    const plain = out.findIndex((o) => o.str === 'WORLD' && o.sheet === 'font');
    expect(plain).toBeGreaterThan(out.findIndex((o) => o.str === 'WORLD' && o.sheet !== 'font'));
    expect(out.filter((o) => o.str === 'MARIO ' && o.sheet !== 'font')).toEqual([]);
  });

  it("World.spriteIn finds an entity's sprite in a screen box (the HUD's rows), not elsewhere", () => {
    const { world } = runs();
    // A Goomba right under WORLD on screen.
    world.spawn(new Goomba(px(world.camera.pxX + 146), px(6)));
    expect(world.spriteIn(144, 8, 40, 8)).toBe(true);
    expect(world.spriteIn(24, 8, 48, 8)).toBe(false);
  });
});
