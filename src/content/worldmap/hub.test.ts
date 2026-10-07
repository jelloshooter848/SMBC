import { describe, expect, it } from 'vitest';
import { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { PALETTES, SPRITES } from '@content/sprites/index';
import { mapDef, mapPalettes, WARP_SPACE } from '@content/sprites/map';
import type { MapActor, MapNode } from '@game/map/types';
import { isWarpNode } from '@game/map/rules';
import { autoShore, sketchProblems } from './build';
import { HUB_PAGE, SKETCH_HUB } from './hub';
import {
  drawMapActor,
  drawMapTile,
  MAP_LEGEND,
  MAP_WALKABLE,
  mapActorBounds,
  mapSky,
  mapTileFrame,
} from './render';

/*
 * The Warp Zone hub page's own rules: its centre node (arrival point and warp home) with a warp
 * pad in each direction, room for more pads, and the 'warp' theme. The checks every registered
 * page shares (tiles, walkable nodes and roads, roads that never cross, actors, warp targets)
 * are in pages.test.ts.
 */

type Pt = [number, number];
const key = ([x, y]: Pt) => `${x},${y}`;
const page = HUB_PAGE;
const nodeAt = (id: string): MapNode => {
  const n = page.nodes.find((m) => m.id === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
};

class CheckingRenderer implements Renderer {
  readonly drawn: { frame: string; x: number; y: number }[] = [];
  clear(): void {}
  rect(): void {}
  text(): void {}
  debugText(): void {}
  line(): void {}
  sprite(sheet: SpriteSheet, frame: string, x: number, y: number): void {
    expect(sheet.frames.has(frame), `${sheet.id} has "${frame}"`).toBe(true);
    this.drawn.push({ frame, x, y });
  }
}

describe('Warp Zone hub page', () => {
  it('is the hub page: id, label, group, theme, no exits, sketched without hard shores', () => {
    expect(page.id).toBe('hub');
    expect(page.label).toBe('WARP ZONE');
    expect(page.group).toBe('hub');
    expect(page.theme).toBe('warp');
    expect(page.exits).toEqual([]);
    expect(sketchProblems(SKETCH_HUB)).toEqual([]);
    expect(page.tiles).toEqual(autoShore(SKETCH_HUB));
  });

  it('arrives on the centre node, the warp home, with four pads around it (the Arena first)', () => {
    const start = nodeAt('start');
    expect([start.x, start.y], 'arrival in the middle').toEqual([7, 8]);
    expect([start.kind, start.to, start.toNode, start.requires, start.label]).toEqual([
      'start',
      'smb-1',
      'bonus-1',
      undefined,
      'RETURN TO WORLD 1',
    ]);
    expect(isWarpNode(start)).toBe(true);
    const pads = page.nodes.filter((n) => n.id !== 'start');
    expect(pads).toHaveLength(4);
    for (const n of pads) expect(n.kind).toBe('warp');
    // The first pad (east, once the Lost Levels') is the Mini Game Arena's, open from the start.
    expect(
      pads
        .filter((n) => n.to === 'arena')
        .map((n) => [n.id, n.x, n.y, n.toNode, n.requires, n.label, n.hint]),
    ).toEqual([['warp-arena', 13, 8, undefined, undefined, 'MINI GAME ARENA', undefined]]);
    expect(
      pads.some((n) => n.to?.startsWith('ll-')),
      'no Lost Levels pad',
    ).toBe(false);
    const mystery = pads.filter((n) => n.requires === 'never');
    expect(mystery.map((n) => [n.x, n.y])).toEqual(
      expect.arrayContaining([
        [7, 3],
        [7, 13],
        [1, 8],
      ]),
    );
    expect(mystery).toHaveLength(3);
    for (const n of mystery) expect(n.hint).toMatch(/^\?\?\?/);
    for (const n of page.nodes)
      for (const t of [n.hint, n.label]) if (t) expect(t, 'hints name no buttons').toMatch(/^[A-Z0-9?' -]+$/);
    // One straight road from the centre to each pad.
    expect(page.paths).toHaveLength(4);
    for (const n of pads)
      expect(
        page.paths.filter((p) => p.from === 'start' && p.to === n.id),
        n.id,
      ).toHaveLength(1);
  });

  it('leaves walkable room beside the north and south pads for more pads later', () => {
    const busy = new Set(page.paths.flatMap((p) => p.points.map(key)));
    for (const n of page.nodes.filter((m) => m.x === 7 && m.y !== 8))
      for (const dx of [-3, 3]) {
        const spot: Pt = [n.x + dx, n.y];
        for (let k = 0; k < 4; k++) {
          const ch = page.tiles[n.y]?.[n.x + Math.sign(dx) * k] ?? '';
          expect(MAP_WALKABLE.has(ch), `room beside ${n.id}: '${ch}'`).toBe(true);
        }
        expect(busy.has(key(spot)), `${key(spot)} free`).toBe(false);
      }
  });

  it('has a comet among the stars', () => {
    expect(page.actors.some((a) => a.type === 'comet')).toBe(true);
  });

  it('draws every tile and actor with the warp palette, animating and on screen', () => {
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    const r = new CheckingRenderer();
    for (let t = 0; t < 400; t += 7)
      for (const ch of Object.keys(MAP_LEGEND)) drawMapTile(r, assets, page, ch, 32, 48, t);
    for (const a of page.actors) {
      const ar = new CheckingRenderer();
      for (let t = 0; t < 1200; t += 5) drawMapActor(ar, assets, page, a, t);
      const spots = new Set(ar.drawn.map((d) => `${d.frame}@${Math.round(d.x)},${Math.round(d.y)}`));
      expect(spots.size, `${a.type} animates`).toBeGreaterThan(1);
      expect(
        ar.drawn.some((d) => d.x > -16 && d.x < 256),
        `${a.type} visible`,
      ).toBe(true);
    }
  });
});

describe('warp theme', () => {
  it('has its own map palette, sky and starry void', () => {
    const pal = mapPalettes['map-warp'] as string[];
    expect(pal).toBeDefined();
    expect(mapSky(page)).toBe(WARP_SPACE);
    // The void ("water" main, role 7) is the sky colour, so sky and void are one starfield.
    expect(pal[7]).toBe(WARP_SPACE);
    expect(PALETTES.default['map-warp']).toBe(pal);
  });

  it('has crystal scenery and a comet', () => {
    expect(mapTileFrame('A', 0)).toBe('crystal');
    expect(MAP_WALKABLE.has('A')).toBe(false);
    expect(mapDef.frames['comet-0']).toBeDefined();
    const comet: MapActor = { type: 'comet', x: 60, y: 34, props: { speed: -0.3 } };
    expect(mapActorBounds(comet)).toEqual([0, 32, 256, 44]);
  });
});
