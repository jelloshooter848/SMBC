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
import { bossBarBox, BOSS_BAR_Y, drawBowserBar } from './boss-bar';
import { BossBar, BOSS_BAR_LOST } from '../world/boss-bar';

// The Bowser bar on screen (0.4.47, #30): it fits the HUD whatever the heroes show (the bar
// heroes' upright bars, Samus's EN and tanks, Link's hearts, the tool belt, player two's stats),
// and its hit glow blinks only without reduce flashing.

const level = parseTextMap(
  readFileSync(join(import.meta.dirname, '../../content/levels/world1/1-4.map'), 'utf8'),
  '1-4',
);

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  what: string;
}

function record(): { r: Renderer; boxes: Box[] } {
  const boxes: Box[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string, x: number, y: number): void {
      boxes.push({ what: str, x, y, w: str.length * 8, h: 8 });
    },
    sprite(_s: SpriteSheet, frame: string, x: number, y: number): void {
      boxes.push({ what: frame, x, y, w: 8, h: 8 });
    },
    rect(x: number, y: number, w: number, h: number, c: string): void {
      boxes.push({ what: `rect ${c}`, x, y, w, h });
    },
  });
  return { r, boxes };
}

const assets = { sheet: () => ({}) } as unknown as AssetRegistry;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('the Bowser bar on the HUD', () => {
  const pairs: [CharacterDef, CharacterDef | null][] = [];
  for (const a of CHARACTERS) {
    pairs.push([a, null]);
    for (const b of CHARACTERS) pairs.push([a, b]);
  }

  it.each(pairs.map(([a, b]) => [`${a.id}${b ? ` + ${b.id}` : ''}`, a, b] as const))(
    '%s: clear of every HUD text, bar and icon',
    (_n, c1, c2) => {
      const w = runSim({
        level,
        character: c1,
        state: { character2: c2, score: 1234567, coins: 99 },
        script: { steps: [{ frame: 0, hold: [] }] },
        maxFrames: 1,
      }).world;
      for (const p of w.players) Object.assign(p.scratch, { etanks: 9, tool: 1 });
      const { r, boxes } = record();
      drawHud(r, assets, w.state, 400, 0, w.players);
      const bar = { ...bossBarBox(5), what: 'bar' };
      const hits = boxes.filter((b) => overlaps(b, bar)).map((b) => `${b.what} ${b.x},${b.y} ${b.w}x${b.h}`);
      expect(hits).toEqual([]);
      expect(bar.y).toBe(BOSS_BAR_Y);
      expect(bar.x).toBeGreaterThanOrEqual(24);
      expect(bar.x + bar.w).toBeLessThanOrEqual(240);
    },
  );

  function draw(bar: BossBar, frame: number, reduce: boolean): string[] {
    const { r, boxes } = record();
    drawBowserBar(r, assets, bar, frame, reduce);
    return boxes.map((b) => b.what);
  }

  it('hidden: nothing drawn; shown: BOWSER and a notch for each hit point', () => {
    const bar = new BossBar();
    expect(draw(bar, 0, false)).toEqual([]);
    const owner = {};
    bar.start(owner, 5, 5);
    const out = draw(bar, 0, false);
    expect(out).toContain('BOWSER');
    expect(out.filter((w) => w === 'rect #fc9838')).toHaveLength(5);
    bar.hit(owner, 5, 5, 3);
    for (let i = 0; i < BOSS_BAR_LOST; i++) bar.tick();
    const after = draw(bar, 0, false);
    expect(after.filter((w) => w === 'rect #fc9838')).toHaveLength(3);
    expect(after.filter((w) => w === 'rect #202020')).toHaveLength(2);
  });

  it('a hit: the notches it took glow; blinking, or steady with reduce flashing', () => {
    const bar = new BossBar();
    const owner = {};
    bar.start(owner, 5, 5);
    bar.hit(owner, 5, 5, 4);
    const lit = (frame: number, reduce: boolean) =>
      draw(bar, frame, reduce).filter((w) => w === 'rect #f83800').length;
    // Without reduce flashing it blinks: lit on some frames, dark on others.
    const blink = [0, 4, 8, 12].map((f) => lit(f, false));
    expect(blink).toContain(1);
    expect(blink).toContain(0);
    // With it, held steady.
    expect([0, 4, 8, 12].map((f) => lit(f, true))).toEqual([1, 1, 1, 1]);
    for (let i = 0; i < BOSS_BAR_LOST; i++) bar.tick();
    expect(lit(0, true)).toBe(0);
  });
});
