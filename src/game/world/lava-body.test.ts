import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { tilesDef } from '@content/sprites/tiles';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { campaignLevel } from '@game/level/campaign';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import type { LevelData } from '@game/level/schema';
import type { View } from '@game/entities/entity';
import { renderTiles } from './tile-render';
import { TileMap } from './tilemap';

/*
 * v0.4.74 item 56: the castle lava's body. The original lays its back-layer colorRed under each
 * wavesLava down to the bottom row (levelDataSmb.xml 1-4: wavesLava on rows 12-13, colorRed on
 * 13-14 of 15). renderTiles draws `lava-body` in every open cell under a lava tile, to the map's
 * bottom row; the cells stay air (nothing about play changes).
 */

const assets = (() => {
  const a = new AssetRegistry(PALETTES);
  a.defineAll(SPRITES);
  return a;
})();

/** Every cell renderTiles draws the lava's body in, over the whole level, as "x,y". */
function bodyCells(level: LevelData, camY?: number): string[] {
  const map = new TileMap(level);
  const cells = new Set<string>();
  let camX = 0;
  const r = Object.assign(new NullRenderer(), {
    sprite(_s: SpriteSheet, f: string, x: number, y: number): void {
      if (f.startsWith('lava-body')) cells.add(`${(x + camX) >> 4},${y >> 4}`);
    },
  });
  for (camX = 0; camX < level.width * 16; camX += 256) {
    const view: View = { camX, frame: 0, assets, theme: level.theme, reduceFlashing: false };
    if (camY !== undefined) view.camY = camY;
    renderTiles(r, view, map);
  }
  return [...cells].sort();
}

/** The cells the rule fills, worked out from the level's tiles directly. */
function expected(level: LevelData): string[] {
  const out: string[] = [];
  const at = (x: number, y: number) => level.tiles[y * level.width + x];
  for (let x = 0; x < level.width; x++)
    for (let y = 0; y < level.height; y++) {
      if (at(x, y) !== T.LAVA) continue;
      for (let yy = y + 1; yy < level.height && at(x, yy) === T.AIR; yy++) out.push(`${x},${yy}`);
    }
  return out.sort();
}

const W = 20;
function field(rows: Record<number, string>, extra: string[] = []) {
  const base = Array.from({ length: 15 }, (_, y) => rows[y] ?? '.'.repeat(W));
  return parseTextMap(
    ['id: t', 'theme: castle', 'time: 300', 'start: 1,10', ...extra, '', '[tiles]', ...base].join('\n'),
  );
}

describe('the lava body (item 56)', () => {
  it('is a frame of its own in the tiles sheet, every cell the lava red (slot b)', () => {
    const rows = tilesDef.frames['lava-body'];
    expect(rows).toHaveLength(16);
    expect(rows?.every((row) => row === 'b'.repeat(16))).toBe(true);
  });

  it('fills the open cells under a lava tile to the bottom row, and only those', () => {
    const lv = field({ 12: '#####~~~~###########', 13: '#####.....##########', 14: '#####.....##########' });
    // column 9 has no lava above it: its open cells stay open.
    expect(bodyCells(lv)).toEqual(['5,13', '5,14', '6,13', '6,14', '7,13', '7,14', '8,13', '8,14']);
  });

  it('stops at the first tile that is not air, and lava under lava stays lava', () => {
    const lv = field({ 10: '..~~~...............', 11: '..~.=...............', 12: '..~.................' });
    // col 2: lava, lava, lava (no body between); col 3: body down to the bottom; col 4: stopped by the brick.
    expect(bodyCells(lv)).toEqual(['2,13', '2,14', '3,11', '3,12', '3,13', '3,14']);
  });

  it('a view scrolled down still knows the lava above the screen', () => {
    const rows: Record<number, string> = { 2: '~'.repeat(W) };
    const lv = field(rows, ['camera: free']);
    expect(bodyCells(lv, 16 * 6)).toEqual(expected(lv).filter((c) => Number(c.split(',')[1]) >= 6));
  });

  it('never changes the map: the body cells stay air', () => {
    const lv = getLevel('1-4');
    const map = new TileMap(lv);
    for (const c of bodyCells(lv)) {
      const [x, y] = c.split(',').map(Number) as [number, number];
      expect(map.get(x, y)).toBe(T.AIR);
      expect(map.collisionAt(x, y)).toBe('none');
    }
  });
});

const ROOTS = ['../../content/levels', '../../content/special-levels'];
function lavaMaps(): string[] {
  const ids: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name));
      else if (e.name.endsWith('.map') && dir.includes('world')) {
        const id = e.name.slice(0, -4);
        const lv = getLevel(id);
        if (lv.tiles.includes(T.LAVA)) ids.push(id);
      }
    }
  };
  for (const r of ROOTS) walk(join(import.meta.dirname, r));
  return ids.sort();
}

describe('every castle and lava map (item 56)', () => {
  const ids = lavaMaps();

  it('finds the 41 maps with lava: SMB 1-4 to 8-5, the Lost Levels and Special', () => {
    expect(ids).toHaveLength(41);
  });

  it.each(ids)('%s: the body fills under every lava tile to the bottom row', (id) => {
    const lv = getLevel(id);
    const got = bodyCells(lv);
    expect(got).toEqual(expected(lv));
    expect(got.length).toBeGreaterThan(0);
    // Every lava tile with open cells under it reaches the bottom row.
    for (const c of got) expect(Number(c.split(',')[1])).toBeLessThan(lv.height);
    expect(got.some((c) => Number(c.split(',')[1]) === lv.height - 1)).toBe(true);
  });

  it('8-5 keeps its lake one row lower than its pits: the lake is lava, only the pits get a body', () => {
    const lv = getLevel('8-5');
    const at = (x: number, y: number) => lv.tiles[y * lv.width + x];
    const got = bodyCells(lv);
    expect(got).toHaveLength(30);
    // The lava lake (columns 196-303) is lava on the bottom row itself: no body there.
    expect(
      got.filter((c) => {
        const x = Number(c.split(',')[0]);
        return x >= 196 && x <= 303;
      }),
    ).toEqual([]);
    for (let x = 208; x <= 292; x++) if (at(x, 14) === T.LAVA) expect(at(x, 13)).not.toBe(T.LAVA);
  });

  it.each(['1-4', '2-4', '3-4', '4-4', '5-4', '6-4', '7-4', '8-4', '8-5'])(
    'campaign %s: its look draws the same body (lava and body share the look palette slot)',
    (id) => {
      const camp = campaignLevel(getLevel(id));
      expect(bodyCells(camp)).toEqual(expected(camp));
    },
  );
});
