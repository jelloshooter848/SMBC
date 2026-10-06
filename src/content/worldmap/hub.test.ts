import { describe, expect, it } from 'vitest';
import { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { PALETTES, SPRITES } from '@content/sprites/index';
import { mapDef, mapPalettes, WARP_SPACE } from '@content/sprites/map';
import { songs } from '@content/music/songs';
import type { MapActor, WorldMapPage } from '@game/map/types';
import { autoShore, sketchProblems } from './build';
import { HUB_PAGE, SKETCH_HUB, type HubNode } from './hub';
import {
  drawMapActor,
  drawMapTile,
  MAP_ACTOR_TYPES,
  MAP_LEGEND,
  MAP_WALKABLE,
  mapActorBounds,
  mapSky,
  mapTileFrame,
} from './render';

/*
 * The Warp Zone hub page: the same validity rules as the eight world pages (pages.test.ts), for a
 * page whose centre node (arrival point and warp home) has a warp pad in each direction and no exits.
 */

/** Tile rows the engine's header bar covers (24 px): background only. */
const HEADER_ROWS = 2;

type Pt = [number, number];
const key = ([x, y]: Pt) => `${x},${y}`;
const dir = (a: Pt, b: Pt) => `${b[0] - a[0]},${b[1] - a[1]}`;
const page = HUB_PAGE;
/** The hub as the renderer sees it (it reads only tiles, theme and actors). */
const drawn = page as unknown as WorldMapPage;
const nodeAt = (id: string): HubNode => {
  const n = page.nodes.find((m) => m.id === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
};

function expectWalk(pts: Pt[], what: string): void {
  pts.forEach((p, i) => {
    expect(p[0] >= 0 && p[0] < 16 && p[1] >= HEADER_ROWS && p[1] < 15, `${what} ${key(p)} on page`).toBe(
      true,
    );
    const ch = page.tiles[p[1]]?.[p[0]] ?? '';
    expect(MAP_WALKABLE.has(ch), `${what} ${key(p)} '${ch}' walkable`).toBe(true);
    if (i > 0) {
      const q = pts[i - 1] as Pt;
      expect(Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]), `${what} step ${key(q)}->${key(p)}`).toBe(1);
    }
  });
  expect(new Set(pts.map(key)).size, `${what} never revisits a tile`).toBe(pts.length);
}

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
  it('is the hub page: id, label, group, title, theme and a song that exists', () => {
    expect(page.id).toBe('hub');
    expect(page.label).toBe('WARP ZONE');
    expect(page.group).toBe('hub');
    expect(page.title).toBe('WARP ZONE');
    expect(page.theme).toBe('warp');
    expect(songs.map((s) => s.id)).toContain(page.music);
    expect(page.exits).toEqual([]);
  });

  it('is 15 rows of 16 legend chars, sketched without hard shores', () => {
    expect(page.tiles).toHaveLength(15);
    for (const row of page.tiles) {
      expect(row).toHaveLength(16);
      for (const ch of row) expect(MAP_LEGEND[ch], `legend has '${ch}'`).toBeDefined();
    }
    expect(sketchProblems(SKETCH_HUB)).toEqual([]);
    expect(page.tiles).toEqual(autoShore(SKETCH_HUB));
  });

  it('keeps rows 0-1, under the header, as plain sky', () => {
    expect(page.tiles[0]).toBe('.'.repeat(16));
    expect(page.tiles[1]).toBe('.'.repeat(16));
  });

  it('arrives on the centre node, the warp home, with four pads around it', () => {
    const ids = page.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    const start = nodeAt('start');
    expect([start.x, start.y], 'arrival in the middle').toEqual([7, 8]);
    expect([start.kind, start.to, start.requires, start.hint]).toEqual([
      'warp',
      'smb-1',
      undefined,
      'RETURN TO WORLD 1',
    ]);
    const pads = page.nodes.filter((n) => n.id !== 'start');
    expect(pads).toHaveLength(4);
    for (const n of pads) expect(n.kind).toBe('warp');
    expect(pads.filter((n) => n.to === 'll-1').map((n) => [n.x, n.y, n.requires, n.hint])).toEqual([
      [13, 8, 'gameCleared', 'LOST LEVELS - BEAT 8-4 TO UNLOCK'],
    ]);
    const mystery = pads.filter((n) => n.requires === 'never');
    expect(mystery.map((n) => [n.x, n.y])).toEqual(
      expect.arrayContaining([
        [7, 3],
        [7, 13],
        [1, 8],
      ]),
    );
    expect(mystery).toHaveLength(3);
    for (const n of mystery) {
      expect(n.to).toBeUndefined();
      expect(n.hint).toMatch(/^\?\?\?/);
    }
    for (const n of page.nodes) expect(n.hint, 'hints name no buttons').toMatch(/^[A-Z0-9?' -]+$/);
    const spots = page.nodes.map((n) => key([n.x, n.y]));
    expect(new Set(spots).size, 'one node per tile').toBe(spots.length);
    for (const n of page.nodes) expectWalk([[n.x, n.y]], `node ${n.id}`);
  });

  it('joins the start to every pad with a contiguous walkable path', () => {
    expect(page.paths).toHaveLength(4);
    for (const n of page.nodes.filter((m) => m.id !== 'start'))
      expect(
        page.paths.filter((p) => p.from === 'start' && p.to === n.id),
        n.id,
      ).toHaveLength(1);
    for (const p of page.paths) {
      const a = nodeAt(p.from);
      const b = nodeAt(p.to);
      expect(p.points[0], `${p.from}->${p.to} starts on its node`).toEqual([a.x, a.y]);
      expect(p.points.at(-1), `${p.from}->${p.to} ends on its node`).toEqual([b.x, b.y]);
      expectWalk(p.points, `${p.from}->${p.to}`);
    }
  });

  it('never lets two roads share a tile or run through another node', () => {
    const owner = new Map<string, string>();
    const nodes = new Map(page.nodes.map((n) => [key([n.x, n.y]), n.id]));
    for (const p of page.paths)
      for (const pt of p.points) {
        const node = nodes.get(key(pt));
        if (node) {
          expect([p.from, p.to], `${p.from}->${p.to} runs through node ${node}`).toContain(node);
          continue;
        }
        expect(owner.get(key(pt)), `${p.from}->${p.to} shares ${key(pt)}`).toBeUndefined();
        owner.set(key(pt), p.to);
      }
  });

  it('offers each direction at most once at every node', () => {
    const steps = new Map<string, string[]>();
    const add = (id: string, d: string) => steps.set(id, [...(steps.get(id) ?? []), d]);
    for (const p of page.paths) {
      add(p.from, dir(p.points[0] as Pt, p.points[1] as Pt));
      add(p.to, dir(p.points.at(-1) as Pt, p.points.at(-2) as Pt));
    }
    for (const [id, ds] of steps) expect(new Set(ds).size, `${id}: ${ds.join(' ')}`).toBe(ds.length);
  });

  it('leaves walkable room beside the north and south pads for more pads later', () => {
    const busy = new Set(page.paths.flatMap((p) => p.points.map(key)));
    for (const n of page.nodes.filter((m) => m.x === 7 && m.y !== 8))
      for (const dx of [-3, 3]) {
        const spot: Pt = [n.x + dx, n.y];
        const lane = Array.from({ length: 4 }, (_, k): Pt => [n.x + Math.sign(dx) * k, n.y]);
        expectWalk(lane, `room beside ${n.id}`);
        expect(busy.has(key(spot)), `${key(spot)} free`).toBe(false);
      }
  });

  it('has 6-15 known actors, a comet among the stars, kept off roads and nodes', () => {
    expect(page.actors.length).toBeGreaterThanOrEqual(6);
    expect(page.actors.length).toBeLessThanOrEqual(15);
    expect(page.actors.some((a) => a.type === 'comet')).toBe(true);
    const busy = new Set<string>();
    for (const n of page.nodes) busy.add(key([n.x, n.y]));
    for (const p of page.paths) for (const pt of p.points) busy.add(key(pt));
    for (const a of page.actors) {
      expect(MAP_ACTOR_TYPES).toContain(a.type);
      expect(a.x >= 0 && a.x <= 240 && a.y >= 0 && a.y <= 224, `${a.type} at ${a.x},${a.y}`).toBe(true);
      const [x0, y0, x1, y1] = mapActorBounds(a);
      for (let ty = Math.floor(y0 / 16); ty <= Math.floor((y1 - 1) / 16); ty++)
        for (let tx = Math.floor(x0 / 16); tx <= Math.floor((x1 - 1) / 16); tx++)
          expect(busy.has(key([tx, ty])), `${a.type} at ${a.x},${a.y} covers road ${tx},${ty}`).toBe(false);
    }
  });

  it('draws every tile and actor with the warp palette, animating and on screen', () => {
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    const r = new CheckingRenderer();
    for (let t = 0; t < 400; t += 7)
      for (const ch of Object.keys(MAP_LEGEND)) drawMapTile(r, assets, drawn, ch, 32, 48, t);
    for (const a of page.actors) {
      const ar = new CheckingRenderer();
      for (let t = 0; t < 1200; t += 5) drawMapActor(ar, assets, drawn, a, t);
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
    expect(mapSky(drawn)).toBe(WARP_SPACE);
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
