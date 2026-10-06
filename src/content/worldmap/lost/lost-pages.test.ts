import { describe, expect, it } from 'vitest';
import { songs } from '@content/music/songs';
import { levelIds } from '@content/levels/index';
import { MAP_ACTOR_TYPES, MAP_LEGEND, MAP_PAL, MAP_WALKABLE, mapActorBounds } from '../render';
import { autoShore, sketchProblems } from '../build';
import { HUB_WARP, type LostMapPage, type LostNode } from './build';
import { LOST_PAGES, lostMapPage } from './index';
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
 * The same validity rules as the SMB pages (../pages.test.ts), for the Lost Levels pages, plus
 * their own: level nodes cover exactly the world's four main levels, and a warp back to the hub.
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

/** Tile rows the engine's header bar covers (24 px): background only. */
const HEADER_ROWS = 2;

type Pt = [number, number];
const key = ([x, y]: Pt) => `${x},${y}`;
const tileAt = (page: LostMapPage, [x, y]: Pt) => page.tiles[y]?.[x];
const nodeAt = (page: LostMapPage, id: string): LostNode => {
  const n = page.nodes.find((m) => m.id === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
};
const dir = (a: Pt, b: Pt) => `${b[0] - a[0]},${b[1] - a[1]}`;

function expectWalk(page: LostMapPage, pts: Pt[], what: string): void {
  pts.forEach((p, i) => {
    expect(
      p[0] >= 0 && p[0] < 16 && p[1] >= HEADER_ROWS && p[1] < 15,
      `${what} point ${key(p)} on page`,
    ).toBe(true);
    expect(
      MAP_WALKABLE.has(tileAt(page, p) ?? ''),
      `${what} point ${key(p)} '${tileAt(page, p)}' walkable`,
    ).toBe(true);
    if (i > 0) {
      const q = pts[i - 1] as Pt;
      expect(Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]), `${what} step ${key(q)}->${key(p)}`).toBe(1);
    }
  });
  expect(new Set(pts.map(key)).size, `${what} never revisits a tile`).toBe(pts.length);
}

/** Nodes every road (path, exit) may end on; all other nodes must be reached by a path. */
const reachable = (page: LostMapPage): Set<string> => {
  const seen = new Set(['start']);
  for (let grew = true; grew;) {
    grew = false;
    for (const p of page.paths)
      for (const [a, b] of [
        [p.from, p.to],
        [p.to, p.from],
      ] as const)
        if (seen.has(a) && !seen.has(b)) {
          seen.add(b);
          grew = true;
        }
  }
  return seen;
};

describe('Lost Levels map pages', () => {
  it('has the thirteen worlds in order, ll-1..ll-13 labelled LOST 1-9 and A-D', () => {
    expect(LOST_PAGES.map((p) => p.id)).toEqual(LOST_PAGES.map((_, i) => `ll-${i + 1}`));
    expect(LOST_PAGES.map((p) => p.label)).toEqual(LABELS);
    for (const p of LOST_PAGES) {
      expect(p.group).toBe('ll');
      expect(lostMapPage(p.id)).toBe(p);
      expect(MAP_PAL[p.theme], `${p.id} theme`).toBeDefined();
    }
    expect(lostMapPage('ll-14')).toBeUndefined();
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
    expect(warps).toEqual(['ll-8>ll-10?llLetters']);
    const letters = nodeAt(lostMapPage('ll-8') as LostMapPage, 'warp-ll-10');
    expect(letters.level).toBeUndefined();
  });

  describe.each(LOST_PAGES.map((p, i) => [p.id, p, i + 1] as const))('%s', (_id, page, w) => {
    const sketch = SKETCHES[w - 1] as string[];
    const levels = [1, 2, 3, 4].map((s) => `ll-${w}-${s}`);

    it('is 15 rows of 16 legend chars, sketched without hard shores', () => {
      expect(page.tiles).toHaveLength(15);
      for (const row of page.tiles) {
        expect(row).toHaveLength(16);
        for (const ch of row) expect(MAP_LEGEND[ch], `legend has '${ch}'`).toBeDefined();
      }
      expect(sketchProblems(sketch)).toEqual([]);
      expect(page.tiles).toEqual(autoShore(sketch));
    });

    it('keeps rows 0-1, under the header, as plain sky', () => {
      expect(page.tiles[0]).toBe('.'.repeat(16));
      expect(page.tiles[1]).toBe('.'.repeat(16));
    });

    it('has a title and a song that exists', () => {
      expect(page.title).toMatch(/^[A-Z' ]+$/);
      expect(songs.map((s) => s.id)).toContain(page.music);
    });

    it("has level nodes for exactly its world's four main levels, all in the level index", () => {
      const ids = page.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
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
      const spots = page.nodes.map((n) => key([n.x, n.y]));
      expect(new Set(spots).size, 'one node per tile').toBe(spots.length);
      for (const n of page.nodes) expectWalk(page, [[n.x, n.y]], `node ${n.id}`);
    });

    it('has a warp node back to the hub, reached by a path', () => {
      const hub = nodeAt(page, HUB_WARP);
      expect(hub.kind).toBe('warp');
      expect(hub.to).toBe('hub');
      expect(hub.requires).toBeUndefined();
      expect(hub.level).toBeUndefined();
      expect(page.paths.some((p) => p.to === HUB_WARP || p.from === HUB_WARP)).toBe(true);
    });

    it('joins the start, the four levels and every warp with contiguous walkable paths', () => {
      const chain = ['start', ...levels];
      for (let i = 0; i < 4; i++)
        expect(
          page.paths.some((p) => p.from === chain[i] && p.to === chain[i + 1]),
          `${chain[i]} -> ${chain[i + 1]}`,
        ).toBe(true);
      expect([...reachable(page)].sort()).toEqual(page.nodes.map((n) => n.id).sort());
      for (const p of page.paths) {
        const a = nodeAt(page, p.from);
        const b = nodeAt(page, p.to);
        expect(p.points[0], `${p.from}->${p.to} starts on its node`).toEqual([a.x, a.y]);
        expect(p.points.at(-1), `${p.from}->${p.to} ends on its node`).toEqual([b.x, b.y]);
        expect(p.points.length).toBeGreaterThan(2);
        expectWalk(page, p.points, `${p.from}->${p.to}`);
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
        expect(e.toWorld, 'numeric placeholder').toBe(w + 1);
        const c = nodeAt(page, e.from);
        expect(e.points[0]).toEqual([c.x, c.y]);
        expectWalk(page, e.points, 'exit');
        expect(e.side).toBe('right');
        expect(e.points.at(-1)?.[0]).toBe(15);
      }
      expect(page.exits.length).toBe([9, 13].includes(w) ? 0 : 1);
    });

    it('never lets two roads share or cross a tile, or run through another node', () => {
      const owner = new Map<string, string>();
      const nodes = new Map(page.nodes.map((n) => [key([n.x, n.y]), n.id]));
      const roads = [
        ...page.paths.map((p) => ({ name: `${p.from}->${p.to}`, ends: [p.from, p.to], pts: p.points })),
        ...page.exits.map((e) => ({ name: `exit ${e.to}`, ends: [e.from], pts: e.points })),
      ];
      for (const r of roads)
        for (const pt of r.pts) {
          const k = key(pt);
          const node = nodes.get(k);
          if (node) {
            expect(r.ends, `${r.name} runs through node ${node}`).toContain(node);
            continue;
          }
          expect(owner.get(k), `${r.name} shares ${k}`).toBeUndefined();
          owner.set(k, r.name);
        }
    });

    it('offers each direction at most once at every node', () => {
      const steps = new Map<string, string[]>();
      const add = (id: string, d: string) => steps.set(id, [...(steps.get(id) ?? []), d]);
      for (const p of page.paths) {
        add(p.from, dir(p.points[0] as Pt, p.points[1] as Pt));
        add(p.to, dir(p.points.at(-1) as Pt, p.points.at(-2) as Pt));
      }
      for (const e of page.exits) add(e.from, dir(e.points[0] as Pt, e.points[1] as Pt));
      for (const [id, ds] of steps) expect(new Set(ds).size, `${id}: ${ds.join(' ')}`).toBe(ds.length);
    });

    it('has 6-15 known actors inside the page, off roads, exits and nodes', () => {
      expect(page.actors.length).toBeGreaterThanOrEqual(6);
      expect(page.actors.length).toBeLessThanOrEqual(15);
      const busy = new Set<string>();
      for (const n of page.nodes) busy.add(key([n.x, n.y]));
      for (const p of [...page.paths, ...page.exits]) for (const pt of p.points) busy.add(key(pt));
      for (const a of page.actors) {
        expect(MAP_ACTOR_TYPES).toContain(a.type);
        expect(a.x >= 0 && a.x <= 240 && a.y >= 0 && a.y <= 224, `${a.type} at ${a.x},${a.y}`).toBe(true);
        expect(a.props, 'actors carry a props object').toBeDefined();
        const [x0, y0, x1, y1] = mapActorBounds(a);
        for (let ty = Math.floor(y0 / 16); ty <= Math.floor((y1 - 1) / 16); ty++)
          for (let tx = Math.floor(x0 / 16); tx <= Math.floor((x1 - 1) / 16); tx++)
            expect(busy.has(key([tx, ty])), `${a.type} at ${a.x},${a.y} covers road tile ${tx},${ty}`).toBe(
              false,
            );
      }
    });

    it('drifts clouds only in the sky band or over open water', () => {
      const open = new Set(['.', '~', 'L', '|', '{', '-', '}', 's', 'x', 'D', 'k']);
      for (const a of page.actors.filter((b) => b.type === 'cloud')) {
        if (a.y + 24 <= 48) continue;
        for (let ty = Math.floor(a.y / 16); ty <= Math.floor((a.y + 23) / 16); ty++)
          for (const ch of page.tiles[ty] ?? '')
            expect(open.has(ch), `cloud at y ${a.y} over '${ch}'`).toBe(true);
      }
    });
  });
});
