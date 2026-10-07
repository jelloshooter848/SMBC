import { describe, expect, it } from 'vitest';
import { levelIds } from '@content/levels/index';
import type { MapNode, WorldMapPage } from '@game/map/types';
import { isWarpNode } from '@game/map/rules';
import { MAP_PAL } from '../render';
import { autoShore, sketchProblems } from '../build';
import { mapPage, pagesInGroup } from '../index';
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
 * ../pages.test.ts; here: sketches, level nodes for exactly the world's four main levels and
 * the roads between worlds: the story's extension (0.4.7), SMB World 8's road on to World 1, then
 * every castle opening the next world in play order (1-8, 9, A-D), no warp nodes at all.
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

  it('chains every world in play order by castle exits, 1-8, 9 and A-D, with no conditions', () => {
    const exits = LOST_PAGES.flatMap((p) =>
      p.exits.map((e) => `${p.id}>${e.to}${e.requires ? `?${e.requires}` : ''}`),
    );
    expect(exits).toEqual(LOST_PAGES.slice(0, -1).map((p, i) => `${p.id}>ll-${i + 2}`));
    for (const p of LOST_PAGES) for (const e of p.exits) expect(e.hint, `${p.id} exit hint`).toBeUndefined();
    // World D ends at its castle: the final ending.
    expect(mapPage('ll-13')?.exits).toEqual([]);
  });

  it("SMB World 8's castle road arrives at World 1's start, on its row", () => {
    const eight = mapPage('smb-8') as WorldMapPage;
    const road = eight.exits.find((e) => e.to === 'll-1');
    expect(road).toMatchObject({ from: '8-4', side: 'right' });
    expect(road?.requires).toBeUndefined();
    expect(road?.points.at(-1)?.[1]).toBe(nodeAt(mapPage('ll-1') as WorldMapPage, 'start').y);
    // The only road into the Lost Levels from another group.
    const into = [...pagesInGroup('smb'), ...pagesInGroup('hub')].flatMap((p) =>
      p.exits.filter((e) => e.to.startsWith('ll-')).map((e) => `${p.id}>${e.to}`),
    );
    expect(into).toEqual(['smb-8>ll-1']);
  });

  it('has no warp nodes: World 1 has no hub link, World 8 no pad to A, A no pipe back', () => {
    for (const p of LOST_PAGES) {
      const warps = p.nodes.filter((n) => isWarpNode(n) || n.to !== undefined).map((n) => n.id);
      expect(warps, p.id).toEqual([]);
      expect(p.nodes.map((n) => n.id).sort(), p.id).toEqual(
        ['start', ...[1, 2, 3, 4].map((s) => `${p.id}-${s}`)].sort(),
      );
    }
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
      // World 1: SMB World 8's castle road.
      const prev = (w === 1 ? [mapPage('smb-8') as WorldMapPage] : LOST_PAGES).find((p) =>
        p.exits.some((e) => e.to === page.id),
      );
      expect(prev, 'a road arrives').toBeDefined();
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
      expect(page.exits.length).toBe(w === 13 ? 0 : 1);
    });
  });
});
