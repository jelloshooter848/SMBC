import { describe, expect, it } from 'vitest';
import { PALETTES, SPRITES } from '@content/sprites';
import { kingdomGround, ROAD_FRAMES } from '@content/sprites/kingdom';
import { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { heroSide } from '@game/map/captives';
import { exitId, newMapProgress, nextStep, pathId, type Dir } from '@game/map/rules';
import type { MapNode } from '@game/map/types';
import { CAMPAIGN_PAGES, mapPage, MAP_PAGES, pageLook } from './index';
import { drawKingdomRoads, kingdomNodeFrame, kingdomRoadCells, tileShown } from './kingdom-render';
import { WORLD_1 } from './world1';
import { WORLD_1_KINGDOM } from './world1-kingdom';

/*
 * World 1 from above (0.4.48, campaign play): a look of the registered World 1, so saves, save
 * codes, reveals, the warp spot and Luigi's gate read it exactly as WORLD_1. pages.test.ts runs
 * every page rule on it too.
 */

const assets = new AssetRegistry(PALETTES);
assets.defineAll(SPRITES);
const sheet = assets.sheet('kingdom');
const page = WORLD_1_KINGDOM;
const key = (x: number, y: number) => `${x},${y}`;

/** Records the frames drawn and where. */
class Recorder implements Renderer {
  drawn: { frame: string; x: number; y: number }[] = [];
  clear(): void {}
  rect(): void {}
  text(): void {}
  debugText(): void {}
  line(): void {}
  sprite(_s: SpriteSheet, frame: string, x: number, y: number): void {
    this.drawn.push({ frame, x, y });
  }
}

/** Whether the frame of prop/scenery `frame` at (fx, fy) paints the pixel (px, py). */
function paints(frame: string, fx: number, fy: number, px: number, py: number): boolean {
  const rows = SPRITES['kingdom']?.frames[frame];
  const c = rows?.[py - fy]?.[px - fx];
  return c !== undefined && c !== '.';
}

describe('World 1 from above (campaign look)', () => {
  it('keeps World 1’s id, nodes (ids, kinds, order, every field but the tile), roads and exit', () => {
    expect(page.id).toBe('smb-1');
    expect(page.theme).toBe('kingdom');
    for (const k of ['label', 'title', 'music', 'group'] as const) expect(page[k]).toBe(WORLD_1[k]);
    const strip = (n: MapNode) => ({ ...n, x: 0, y: 0 });
    expect(page.nodes.map(strip)).toEqual(WORLD_1.nodes.map(strip));
    expect(page.paths.map(pathId)).toEqual(WORLD_1.paths.map(pathId));
    expect(page.paths.map((p) => p.exit)).toEqual(WORLD_1.paths.map((p) => p.exit));
    expect(page.exits.map(exitId)).toEqual(WORLD_1.exits.map(exitId));
    expect(page.exits.map(({ points: _p, ...e }) => e)).toEqual(
      WORLD_1.exits.map(({ points: _p, ...e }) => e),
    );
    // The exit leaves on the row World 2's start sits on, as World 1's always did.
    expect(page.exits[0]?.points.at(-1)).toEqual(WORLD_1.exits[0]?.points.at(-1));
  });

  it('shows only in campaign play: the registry keeps the classic page', () => {
    expect(mapPage('smb-1')).toBe(WORLD_1);
    expect(MAP_PAGES).not.toContain(page);
    // 0.4.50: Worlds 2 and 3 have campaign looks too (world2-hyrule.test.ts); the rest have none.
    expect(CAMPAIGN_PAGES[0]).toBe(page);
    expect(pageLook(WORLD_1, true)).toBe(page);
    expect(pageLook(WORLD_1, false)).toBe(WORLD_1);
    for (const p of MAP_PAGES.filter((q) => !CAMPAIGN_PAGES.some((c) => c.id === q.id)))
      expect(pageLook(p, true)).toBe(p);
    expect(pageLook(undefined, true)).toBeUndefined();
  });

  it('has a kingdom frame for every ground tile, road join and node marker', () => {
    const g = kingdomGround(page.tiles);
    for (const f of [...g.frames[0], ...g.frames[1], ...g.scenery.map((s) => s.frame)])
      expect(sheet.frames.has(f), f).toBe(true);
    expect(new Set(ROAD_FRAMES).size).toBe(16);
    for (const f of ROAD_FRAMES) expect(sheet.frames.has(f), f).toBe(true);
    for (const p of page.props ?? []) expect(sheet.frames.has(p.frame), p.frame).toBe(true);
    const kinds: MapNode['kind'][] = ['start', 'level', 'castle', 'warp'];
    for (const kind of kinds)
      for (const cleared of [false, true])
        for (const secret of [false, true])
          for (const warpOpen of [false, true]) {
            const f = kingdomNodeFrame(kind, { cleared, secret, warpOpen });
            expect(f && sheet.frames.has(f), `${kind} ${cleared} ${secret} ${warpOpen}`).toBe(true);
          }
    // The river ripples in two frames; nothing else on the ground moves.
    const moving = g.frames[0].filter((f, i) => f !== g.frames[1][i]);
    expect(moving.length).toBeGreaterThan(0);
    expect(moving.every((f) => f.startsWith('water-'))).toBe(true);
    // Its palette has the colour-blind and high-contrast variants every sheet gets.
    for (const mode of ['deuteranopia', 'protanopia', 'tritanopia', 'highContrast'] as const)
      expect(PALETTES[mode]?.['kingdom'], mode).toHaveLength(PALETTES.default['kingdom']?.length ?? -1);
  });

  it('keeps its landmarks inside the page and off every node, road and Luigi’s spot', () => {
    const roads = [...page.paths, ...page.exits].flatMap((p) => p.points);
    const wet = kingdomGround(page.tiles).wet;
    const luigi = page.nodes.find((n) => n.id === '1-1') as MapNode;
    const side = heroSide(page, luigi);
    expect(side).toBe(1); // east of 1-1, at 2,9
    for (const p of page.props ?? []) {
      const f = sheet.frames.get(p.frame);
      expect(f, p.frame).toBeDefined();
      if (!f) continue;
      expect(p.x >= 0 && p.y >= 24 && p.x + f.w <= 256 && p.y + f.h <= 240, p.frame).toBe(true);
      for (const n of page.nodes.filter((m) => !(p.frame === 'bridge' && m.id === '1-3')))
        for (let dy = 2; dy < 14; dy++)
          for (let dx = 2; dx < 14; dx++)
            expect(paints(p.frame, p.x, p.y, n.x * 16 + dx, n.y * 16 + dy), `${p.frame} over ${n.id}`).toBe(
              false,
            );
      // The road crosses the river on the bridge; everywhere else no landmark lies on a road.
      // (The bridge's west post stands on 1-3's tile: the node is its bridgehead, its pad over it.)
      for (const [x, y] of roads)
        if (!wet[y * 16 + x] && p.frame !== 'bridge')
          expect(paints(p.frame, p.x, p.y, x * 16 + 8, y * 16 + 8), `${p.frame} on road ${key(x, y)}`).toBe(
            false,
          );
      // Luigi's silhouette and trophy stand beside 1-1 (captives.ts): the tile there stays clear.
      const lx = (luigi.x + side) * 16;
      for (let dy = -8; dy < 16; dy++)
        for (let dx = 0; dx < 16; dx++)
          expect(paints(p.frame, p.x, p.y, lx + dx, luigi.y * 16 + dy), `${p.frame} over Luigi`).toBe(false);
    }
  });

  it('never stands a pine (it overhangs the tile above) under a road or a node', () => {
    const busy = new Set([
      ...page.nodes.map((n) => key(n.x, n.y)),
      ...[...page.paths, ...page.exits].flatMap((p) => p.points.map(([x, y]) => key(x, y))),
    ]);
    for (const s of kingdomGround(page.tiles).scenery) {
      const tall = (sheet.frames.get(s.frame)?.h ?? 16) > 16;
      const tx = s.x / 16;
      const ty = (s.feet - 16) / 16;
      expect(busy.has(key(tx, ty)), `${s.frame} at ${key(tx, ty)}`).toBe(false);
      if (tall) expect(busy.has(key(tx, ty - 1)), `${s.frame} under ${key(tx, ty - 1)}`).toBe(false);
    }
  });

  it('draws a road in tile by tile with the dot reveal’s timing', () => {
    const p = page.paths.find((q) => pathId(q) === '1-1>1-2');
    if (!p) throw new Error('no road');
    // pathDots(points, skipFirst, skipLast): two dots a tile, less the end tiles' centres.
    const dots = 2 * (p.points.length - 1) - 1;
    const cells = kingdomRoadCells(page, [{ id: '1-1>1-2', points: p.points, dots }]);
    expect(cells).toHaveLength(p.points.length);
    const r = new Recorder();
    const shownTiles = (shown: number) => {
      r.drawn = [];
      drawKingdomRoads(r, assets, cells, 0, new Map([['1-1>1-2', shown]]));
      return r.drawn;
    };
    expect(shownTiles(0)).toEqual([]);
    // One dot: the road leaves 1-1 (under its marker), no tile of it yet.
    expect(shownTiles(1).map((d) => d.frame)).toEqual(['road---s-']);
    // Four dots: 1-1, then two tiles south, the last one's far end rounded off; with the fifth it
    // reaches on toward the next.
    expect(shownTiles(4).map((d) => d.frame)).toEqual(['road---s-', 'road-n-s-', 'road-n---']);
    expect(shownTiles(5).map((d) => d.frame)).toEqual(['road---s-', 'road-n-s-', 'road-n-s-']);
    for (let s = 1; s <= dots; s++)
      expect(shownTiles(s)).toHaveLength(s >= dots ? p.points.length : 1 + (s >> 1));
    // Done: every tile joined to the ones before and after it.
    const done = shownTiles(dots);
    expect(done).toHaveLength(p.points.length);
    expect(done.at(-1)?.frame).toBe('road----w');
    expect(tileShown(0, dots, 1)).toBe(true);
    expect(tileShown(p.points.length - 1, dots, dots - 1)).toBe(false);
  });

  it('joins roads only along themselves: two roads side by side never merge', () => {
    const runs = page.paths.map((p) => ({ id: pathId(p), points: p.points, dots: 2 * p.points.length }));
    const cells = kingdomRoadCells(page, runs);
    const r = new Recorder();
    drawKingdomRoads(r, assets, cells, 0, null);
    const at = new Map(r.drawn.map((d) => [key(d.x / 16, d.y / 16), d.frame]));
    // 1-2's roads leave it north (to 1-3) and south (to the warp spot) and arrive from the west.
    const n12 = page.nodes.find((n) => n.id === '1-2') as MapNode;
    expect(at.get(key(n12.x, n12.y))).toBe('road-n-sw');
    // The road to 1-3 runs along row 11 right above the warp spot's road on row 13: no joins across.
    for (let x = 5; x < 9; x++) expect(at.get(key(x, 11)), key(x, 11)).toBe('road--e-w');
    // The bridge carries the road over the river: no road is drawn on the water.
    const wet = kingdomGround(page.tiles).wet;
    for (const d of r.drawn) expect(wet[(d.y / 16) * 16 + d.x / 16], key(d.x / 16, d.y / 16)).toBe(false);
  });

  it('walks a road with any key that clearly points to where it leads, not only its first step', () => {
    // From above, the eye goes to the next node, not the road's first tile: 1-3's road to the fort
    // leaves north onto the bridge, but the fort is east, so RIGHT goes too (UP still does). A key
    // takes a road this way only when no road leaves the node that way, and only toward a node
    // within 60 degrees of it, the nearest in angle (by the page, open or not, so a key never
    // changes meaning as roads open: 1-2's RIGHT is the warp spot's even before it is found).
    const p = newMapProgress();
    const to = (from: string, d: Dir, all = true) => {
      const s = nextStep(page, p, from, d, MAP_PAGES, all);
      return s ? (s.kind === 'node' ? s.to : s.kind === 'exit' ? s.exit.to : s.page) : null;
    };
    const dirs: Dir[] = ['up', 'right', 'down', 'left'];
    const table = Object.fromEntries(page.nodes.map((n) => [n.id, dirs.map((d) => to(n.id, d))]));
    //                 up        right      down       left
    expect(table).toEqual({
      start: [null, '1-1', '1-1', null],
      '1-1': ['start', '1-2', '1-2', null],
      '1-2': ['1-3', 'bonus-1', 'bonus-1', '1-1'],
      '1-3': ['1-4', '1-4', '1-2', '1-2'],
      '1-4': ['1-3', 'smb-2', null, '1-3'],
      'bonus-1': [null, null, null, '1-2'],
    });
    // The roads walked are the roads: the points run along the road from here to there.
    const s = nextStep(page, p, '1-3', 'right', MAP_PAGES, true);
    const road = page.paths.find((q) => pathId(q) === '1-3>1-4');
    expect(s?.points).toEqual(road?.points);
    // Closed roads stay closed: with 1-0 to 1-2 cleared, the start's DOWN goes to 1-1 and 1-3's
    // RIGHT bumps (its road waits for 1-3), and with the warp spot unfound 1-2's RIGHT bumps too (it
    // never sends the hero up to 1-3 instead).
    p.cleared.push('1-0', '1-1', '1-2');
    expect(to('start', 'down', false)).toBe('1-1');
    expect(to('1-2', 'up', false)).toBe('1-3');
    expect(to('1-3', 'right', false)).toBeNull();
    expect(to('1-2', 'right', false)).toBeNull();
    p.cleared.push('1-3');
    expect(to('1-3', 'right', false)).toBe('1-4');
    // Classic World 1 (side-on) is as it was: only a road's first step takes it.
    for (const n of WORLD_1.nodes)
      for (const d of dirs) {
        const c = nextStep(WORLD_1, p, n.id, d, MAP_PAGES, true);
        if (!c || c.kind === 'back') continue;
        const [a, b] = c.points as [[number, number], [number, number]];
        const step: Dir = b[0] > a[0] ? 'right' : b[0] < a[0] ? 'left' : b[1] > a[1] ? 'down' : 'up';
        expect(step, `${n.id} ${d}`).toBe(d);
      }
  });
});
