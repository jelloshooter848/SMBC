import { describe, expect, it } from 'vitest';
import { levelIds } from '@content/levels/index';
import type { MapNode, WorldMapPage } from '@game/map/types';
import { MAP_PAL } from '../render';
import { autoShore, sketchProblems } from '../build';
import { mapPage, pagesInGroup } from '../index';
import { HUB_WARP } from './build';
import { LOST_PAGES } from './index';
import { SKETCH_LL_1 } from './world1';
import { SKETCH_LL_2 } from './world2';
import { SKETCH_LL_3 } from './world3';
import { SKETCH_LL_4 } from './world4';
import { SKETCH_LL_5 } from './world5';
import { SKETCH_LL_6 } from './world6';
import { SKETCH_LL_7 } from './world7';
import { SKETCH_LL_8 } from './world8';
import { SKETCH_LL_9 } from './world9';
import { SKETCH_LL_A } from './worldA';
import { SKETCH_LL_B } from './worldB';
import { SKETCH_LL_C } from './worldC';
import { SKETCH_LL_D } from './worldD';

/*
 * The Lost Levels pages' own rules. The checks every registered page shares (tiles, nodes on
 * walkable tiles, reachable nodes, roads that never cross, actors, warp targets) are in
 * ../pages.test.ts; here: sketches, level nodes for exactly the world's four main levels, the
 * roads between worlds (9 behind 'll9', A behind 'llLetters'), World 1's warp back to the hub
 * (where the hub's Lost Levels pad lands) and World A's portal back to World 8's pad.
 */

const SKETCHES = [
  SKETCH_LL_1,
  SKETCH_LL_2,
  SKETCH_LL_3,
  SKETCH_LL_4,
  SKETCH_LL_5,
  SKETCH_LL_6,
  SKETCH_LL_7,
  SKETCH_LL_8,
  SKETCH_LL_9,
  SKETCH_LL_A,
  SKETCH_LL_B,
  SKETCH_LL_C,
  SKETCH_LL_D,
];
const LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D'].map((s) => `LOST ${s}`);

type Pt = [number, number];
const nodeAt = (page: WorldMapPage, id: string): MapNode => {
  const n = page.nodes.find((m) => m.id === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
};
const dir = (a: Pt, b: Pt) => `${b[0] - a[0]},${b[1] - a[1]}`;

describe('Lost Levels map pages', () => {
  it('has the thirteen worlds in order, ll-1..ll-13 labelled LOST 1-9 and A-D', () => {
    expect(LOST_PAGES.map((p) => p.id)).toEqual(LOST_PAGES.map((_, i) => `ll-${i + 1}`));
    expect(LOST_PAGES.map((p) => p.label)).toEqual(LABELS);
    expect(pagesInGroup('ll')).toEqual(LOST_PAGES);
    for (const p of LOST_PAGES) {
      expect(p.group).toBe('ll');
      expect(mapPage(p.id)).toBe(p);
      expect(MAP_PAL[p.theme], `${p.id} theme`).toBeDefined();
    }
    expect(mapPage('ll-14')).toBeUndefined();
    expect(new Set(LOST_PAGES.map((p) => p.title)).size, 'titles are unique').toBe(13);
  });

  it('chains 1-8 and A-D by castle exits, 8 -> 9 behind ll9 and 8 -> A by a letters warp', () => {
    const exits = LOST_PAGES.flatMap((p) =>
      p.exits.map((e) => `${p.id}>${e.to}${e.requires ? `?${e.requires}` : ''}`),
    );
    expect(exits).toEqual([
      'll-1>ll-2',
      'll-2>ll-3',
      'll-3>ll-4',
      'll-4>ll-5',
      'll-5>ll-6',
      'll-6>ll-7',
      'll-7>ll-8',
      'll-8>ll-9?ll9',
      'll-10>ll-11',
      'll-11>ll-12',
      'll-12>ll-13',
    ]);
    const warps = LOST_PAGES.flatMap((p) =>
      p.nodes.filter((n) => n.kind === 'warp' && n.to !== 'hub').map((n) => `${p.id}>${n.to}?${n.requires}`),
    );
    expect(warps).toEqual(['ll-8>ll-10?llLetters', 'll-10>ll-8?undefined']);
    const letters = nodeAt(mapPage('ll-8') as WorldMapPage, 'warp-ll-10');
    expect(letters.level).toBeUndefined();
    expect(letters.hint).toBe('LOST A - BEAT LOST 8-4');
    // World 9's exit says how far the file is while it is locked, within the hint line.
    const nine = mapPage('ll-8')?.exits.find((e) => e.to === 'll-9');
    expect(nine?.hint?.includes('{n}')).toBe(true);
    expect(nine?.hint?.replace('{n}', '32/32').length).toBeLessThanOrEqual(32);
    // It opens from the World 8 castle.
    expect(mapPage('ll-8')?.paths.some((p) => p.from === 'll-8-4' && p.to === 'warp-ll-10')).toBe(true);
  });

  it('links to the hub only from World 1, where the hub pad lands', () => {
    const toHub = LOST_PAGES.flatMap((p) =>
      p.nodes.filter((n) => n.to === 'hub').map((n) => `${p.id}:${n.id}`),
    );
    expect(toHub).toEqual([`ll-1:${HUB_WARP}`]);
    const one = mapPage('ll-1') as WorldMapPage;
    const hub = nodeAt(one, HUB_WARP);
    expect(hub.kind).toBe('warp');
    expect(hub.requires).toBeUndefined();
    expect(hub.level).toBeUndefined();
    expect(one.paths.some((p) => p.to === HUB_WARP || p.from === HUB_WARP)).toBe(true);
    // The hub's old Lost Levels pad is the Mini Game Arena's (0.5.0): nothing on the hub leads here.
    expect(mapPage('hub')?.nodes.filter((n) => n.to?.startsWith('ll-'))).toEqual([]);
    expect(hub.oneWay).toBe(true);
  });

  it("World A's portal goes back to World 8's pad that leads to A, always open", () => {
    const a = mapPage('ll-10') as WorldMapPage;
    const portals = a.nodes.filter((n) => n.kind === 'warp');
    expect(portals.length).toBe(1);
    const portal = portals[0] as MapNode;
    expect(portal).toMatchObject({ to: 'll-8', toNode: 'warp-ll-10', label: 'LOST WORLD 8' });
    expect(portal.requires).toBeUndefined();
    expect(portal.hint).toBeUndefined();
    expect(portal.label?.length).toBeLessThanOrEqual(32);
    expect(a.paths.some((p) => p.to === portal.id || p.from === portal.id)).toBe(true);
    // The pad it lands on is World 8's warp to A, which lands back on it (1:1).
    expect(nodeAt(mapPage('ll-8') as WorldMapPage, 'warp-ll-10')).toMatchObject({
      to: 'll-10',
      toNode: portal.id,
    });
  });

  it('has no other portals: 2-9 and B-D have no warp nodes but World 8’s pad to A', () => {
    for (const p of LOST_PAGES.filter((q) => !['ll-1', 'll-10'].includes(q.id))) {
      const warps = p.nodes.filter((n) => n.kind === 'warp' || n.to !== undefined).map((n) => n.id);
      expect(warps, p.id).toEqual(p.id === 'll-8' ? ['warp-ll-10'] : []);
    }
    // B, C and D chain on by castle exits alone.
    for (const id of ['ll-11', 'll-12', 'll-13'])
      expect(
        (mapPage(id) as WorldMapPage).nodes.every((n) => n.kind !== 'warp'),
        id,
      ).toBe(true);
  });

  describe.each(LOST_PAGES.map((p, i) => [p.id, p, i + 1] as const))('%s', (_id, page, w) => {
    const sketch = SKETCHES[w - 1] as string[];
    const levels = [1, 2, 3, 4].map((s) => `ll-${w}-${s}`);

    it('is sketched without hard shores', () => {
      expect(sketchProblems(sketch)).toEqual([]);
      expect(page.tiles).toEqual(autoShore(sketch));
    });

    it("has level nodes for exactly its world's four main levels, all in the level index", () => {
      const withLevel = page.nodes.filter((n) => n.level !== undefined);
      expect(withLevel.map((n) => n.level).sort()).toEqual(levels);
      const all = new Set(levelIds());
      for (const id of levels) expect(all.has(id), `level ${id} exists`).toBe(true);
      for (let s = 1; s <= 4; s++) {
        const n = nodeAt(page, `ll-${w}-${s}`);
        expect(n.kind).toBe(s === 4 ? 'castle' : 'level');
        expect(n.level).toBe(`ll-${w}-${s}`);
      }
      expect(nodeAt(page, 'start').kind).toBe('start');
      expect(nodeAt(page, 'start').x).toBe(0);
    });

    it('joins the start and the four levels in order with winding paths', () => {
      const chain = ['start', ...levels];
      for (let i = 0; i < 4; i++)
        expect(
          page.paths.some((p) => p.from === chain[i] && p.to === chain[i + 1]),
          `${chain[i]} -> ${chain[i + 1]}`,
        ).toBe(true);
      for (const p of page.paths) {
        expect(p.points.length).toBeGreaterThan(2);
        const turns = p.points.slice(2).filter((pt, i) => {
          const [p0, p1] = [p.points[i] as Pt, p.points[i + 1] as Pt];
          return dir(p0, p1) !== dir(p1, pt);
        });
        expect(turns.length, `${p.from}->${p.to} winds`).toBeGreaterThan(0);
      }
      // Walking left off the start goes back to the previous page, so no road may leave that way.
      for (const p of page.paths.filter((q) => q.from === 'start'))
        expect(dir(p.points[0] as Pt, p.points[1] as Pt)).not.toBe('-1,0');
    });

    it('starts on the row where the previous world’s road arrives', () => {
      const prev = LOST_PAGES.find((p) => p.exits.some((e) => e.to === page.id));
      if (!prev) return;
      const exit = prev.exits.find((e) => e.to === page.id);
      expect(exit?.side).toBe('right');
      expect(exit?.points.at(-1)?.[1]).toBe(nodeAt(page, 'start').y);
    });

    it('leaves from the castle off the right edge, if it has a road on', () => {
      for (const e of page.exits) {
        expect(e.from).toBe(`ll-${w}-4`);
        expect(e.to).toBe(`ll-${w + 1}`);
        expect(e.side).toBe('right');
        expect(e.points.at(-1)?.[0]).toBe(15);
      }
      expect(page.exits.length).toBe([9, 13].includes(w) ? 0 : 1);
    });
  });
});
