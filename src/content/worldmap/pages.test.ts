import { describe, expect, it } from 'vitest';
import type { MapNode, WorldMapPage } from '@game/map/types';
import { songs } from '@content/music/songs';
import { isPageId, levelPage, MAP_PAGES, mapPage, pagesInGroup, SMB_PAGES } from './index';
import { MAP_ACTOR_TYPES, MAP_LEGEND, MAP_WALKABLE, mapActorBounds } from './render';
import { autoShore, poly, sketchProblems } from './build';
import { isWarpNode } from '@game/map/rules';
import { SKETCH_1 } from './world1';
import { SKETCH_2 } from './world2';
import { SKETCH_3 } from './world3';
import { SKETCH_4 } from './world4';
import { SKETCH_5 } from './world5';
import { SKETCH_6 } from './world6';
import { SKETCH_7 } from './world7';
import { SKETCH_8 } from './world8';

const SKETCHES = [SKETCH_1, SKETCH_2, SKETCH_3, SKETCH_4, SKETCH_5, SKETCH_6, SKETCH_7, SKETCH_8];
const THEMES = ['grass', 'sea', 'night', 'mushroom', 'sky', 'snow', 'coast', 'bowser'];

/** Tile rows the engine's header bar covers (24 px): background only. */
const HEADER_ROWS = 2;

type Pt = [number, number];
const key = ([x, y]: Pt) => `${x},${y}`;
const tileAt = (page: WorldMapPage, [x, y]: Pt) => page.tiles[y]?.[x];
const nodeAt = (page: WorldMapPage, id: string): MapNode => {
  const n = page.nodes.find((m) => m.id === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
};
const dir = (a: Pt, b: Pt) => `${b[0] - a[0]},${b[1] - a[1]}`;

function expectWalk(page: WorldMapPage, pts: Pt[], what: string): void {
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

describe('world map pages', () => {
  it('has the eight SMB1 worlds in order, each with its own theme', () => {
    expect(SMB_PAGES.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`));
    expect(SMB_PAGES.map((p) => p.label)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((w) => `WORLD ${w}`));
    expect(SMB_PAGES.every((p) => p.group === 'smb')).toBe(true);
    expect(SMB_PAGES.map((p) => p.theme)).toEqual(THEMES);
    expect(pagesInGroup('smb')).toEqual(SMB_PAGES);
    // Node counts: start, 3 levels, the castle and the bonus slot on each.
    expect(SMB_PAGES.map((p) => p.nodes.length)).toEqual([6, 6, 6, 6, 6, 6, 6, 6]);
    expect(SMB_PAGES.map((p) => p.paths.length)).toEqual([5, 5, 5, 5, 5, 5, 5, 5]);
    expect(SMB_PAGES.map((p) => p.exits.length)).toEqual([1, 1, 1, 1, 1, 1, 1, 0]);
  });

  describe.each(SMB_PAGES.map((p, i) => [i + 1, p] as const))('world %i', (w, page) => {
    it('is 15 rows of 16 legend chars, sketched without hard shores', () => {
      expect(page.tiles).toHaveLength(15);
      for (const row of page.tiles) {
        expect(row).toHaveLength(16);
        for (const ch of row) expect(MAP_LEGEND[ch], `legend has '${ch}'`).toBeDefined();
      }
      expect(sketchProblems(SKETCHES[w - 1] as string[])).toEqual([]);
      expect(page.tiles).toEqual(autoShore(SKETCHES[w - 1] as string[]));
    });

    it('has a title, a theme and a song that exists', () => {
      expect(page.title).toMatch(/^[A-Z' ]+$/);
      expect(songs.map((s) => s.id)).toContain(page.music);
      expect(page.music).toBe(w === 8 ? 'map-bowser' : 'map');
    });

    it('has start, W-1..W-3, the W-4 castle and a hidden bonus slot', () => {
      const ids = page.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.sort()).toEqual(['start', `${w}-1`, `${w}-2`, `${w}-3`, `${w}-4`, `bonus-${w}`].sort());
      expect(nodeAt(page, 'start').kind).toBe('start');
      expect(nodeAt(page, 'start').level).toBeUndefined();
      for (let s = 1; s <= 4; s++) {
        const n = nodeAt(page, `${w}-${s}`);
        expect(n.kind).toBe(s === 4 ? 'castle' : 'level');
        expect(n.level).toBe(`${w}-${s}`);
      }
      const bonus = nodeAt(page, `bonus-${w}`);
      // World 1's slot is the warp spot to the hub (0.4.0); the others are still bonus slots.
      expect(bonus.kind).toBe(w === 1 ? 'warp' : 'bonus');
      if (w === 1) expect(bonus.to).toBe('hub');
      expect(bonus.unlock).toBe(`bonus-${w}`);
      expect(bonus.level).toBeUndefined();
      const spots = page.nodes.map((n) => key([n.x, n.y]));
      expect(new Set(spots).size, 'one node per tile').toBe(spots.length);
      for (const n of page.nodes) expectWalk(page, [[n.x, n.y]], `node ${n.id}`);
    });

    it('starts on the left edge where the previous world’s road arrives', () => {
      const start = nodeAt(page, 'start');
      expect(start.x).toBe(0);
      // Walking left off the start goes back to the previous page, so no road may leave that way.
      for (const p of page.paths.filter((q) => q.from === 'start'))
        expect(dir(p.points[0] as Pt, p.points[1] as Pt)).not.toBe('-1,0');
      const prev = mapPage(`smb-${w - 1}`);
      if (prev) {
        const exit = prev.exits.find((e) => e.to === page.id);
        expect(exit?.side).toBe('right');
        expect(exit?.points.at(-1)?.[1], 'same row as the previous exit').toBe(start.y);
      }
    });

    it('joins consecutive nodes and the bonus slot with contiguous walkable paths', () => {
      const chain = ['start', `${w}-1`, `${w}-2`, `${w}-3`, `${w}-4`];
      for (let i = 0; i < 4; i++)
        expect(
          page.paths.some((p) => p.from === chain[i] && p.to === chain[i + 1]),
          `${chain[i]} -> ${chain[i + 1]}`,
        ).toBe(true);
      const toBonus = page.paths.filter((p) => p.to === `bonus-${w}`);
      expect(toBonus).toHaveLength(1);
      expect(nodeAt(page, toBonus[0]?.from as string).kind).toBe('level');
      expect(page.paths).toHaveLength(5);
      for (const p of page.paths) {
        const a = nodeAt(page, p.from);
        const b = nodeAt(page, p.to);
        expect(p.points[0], `${p.from}->${p.to} starts on its node`).toEqual([a.x, a.y]);
        expect(p.points.at(-1), `${p.from}->${p.to} ends on its node`).toEqual([b.x, b.y]);
        expect(p.points.length).toBeGreaterThan(2);
        expectWalk(page, p.points, `${p.from}->${p.to}`);
        // Winding: every path turns at least once.
        const turns = p.points.slice(2).filter((pt, i) => {
          const [p0, p1] = [p.points[i] as Pt, p.points[i + 1] as Pt];
          return dir(p0, p1) !== dir(p1, pt);
        });
        expect(turns.length, `${p.from}->${p.to} winds`).toBeGreaterThan(0);
      }
    });

    it(w < 8 ? 'leaves from the castle off the right edge to the next world' : 'ends at the castle', () => {
      if (w === 8) {
        expect(page.exits).toEqual([]);
        return;
      }
      expect(page.exits).toHaveLength(1);
      const e = page.exits[0];
      if (!e) return;
      expect(e.from).toBe(`${w}-4`);
      expect(e.to).toBe(`smb-${w + 1}`);
      const c = nodeAt(page, e.from);
      expect(e.points[0]).toEqual([c.x, c.y]);
      expectWalk(page, e.points, 'exit');
      const last = e.points.at(-1) as Pt;
      if (e.side === 'right') expect(last[0]).toBe(15);
      if (e.side === 'left') expect(last[0]).toBe(0);
      if (e.side === 'top') expect(last[1]).toBe(HEADER_ROWS);
    });
  });
});

describe('page registry', () => {
  it('lists SMB worlds, the hub, then the Lost Levels, each id once', () => {
    const ids = MAP_PAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 9)).toEqual([...SMB_PAGES.map((p) => p.id), 'hub']);
    for (const id of ids.slice(9)) expect(id).toMatch(/^ll-(\d|1[0-3])$/);
    expect(ids).toContain('ll-1');
    expect(MAP_PAGES.map((p) => p.group)).toEqual([
      ...SMB_PAGES.map(() => 'smb'),
      'hub',
      ...ids.slice(9).map(() => 'll'),
    ]);
  });

  it('looks pages up by id and levels up by node', () => {
    for (const p of MAP_PAGES) expect(mapPage(p.id)).toBe(p);
    for (const p of MAP_PAGES) expect(isPageId(p.id)).toBe(true);
    for (const bad of ['smb-9', 'world-1', '1', 1, null, '']) expect(isPageId(bad)).toBe(false);
    expect(mapPage('smb-9')).toBeUndefined();
    expect(mapPage('hub')?.label).toBe('WARP ZONE');
    expect(pagesInGroup('hub').map((p) => p.id)).toEqual(['hub']);
    expect(levelPage('1-2')?.id).toBe('smb-1');
    expect(levelPage('8-4')?.id).toBe('smb-8');
    expect(levelPage('1-2-exit')).toBeUndefined(); // main levels only
  });

  it('labels fit the header (10 chars) and titles fit it too (20)', () => {
    for (const p of MAP_PAGES) {
      expect(p.label.length, p.id).toBeLessThanOrEqual(10);
      expect(p.label).toMatch(/^[A-Z0-9 ]+$/);
      expect(p.title.length, p.id).toBeLessThanOrEqual(20);
    }
  });

  it('pairs every portal 1:1: its arrival node is a warp straight back to it', () => {
    // A warp X on page P to page Q lands on Q's toNode (or Q's start), which must warp back to P
    // with toNode X. One-way portals opt out with `oneWay`; pads that never work go nowhere.
    let pairs = 0;
    for (const p of MAP_PAGES)
      for (const x of p.nodes.filter((n) => isWarpNode(n) && !n.oneWay && n.requires !== 'never')) {
        const q = mapPage(x.to as string) as WorldMapPage;
        const there = x.toNode ? nodeAt(q, x.toNode) : q.nodes.find((n) => n.kind === 'start');
        const what = `${p.id}:${x.id} -> ${q.id}:${there?.id}`;
        expect(there && isWarpNode(there), `${what} is a warp`).toBe(true);
        expect(there?.to, `${what} leads back to ${p.id}`).toBe(p.id);
        const back = there?.toNode ? nodeAt(p, there.toNode) : p.nodes.find((n) => n.kind === 'start');
        expect(back?.id, `${what} lands back on ${x.id}`).toBe(x.id);
        pairs++;
      }
    expect(pairs).toBeGreaterThanOrEqual(6); // smb-1 spot / hub centre, hub pad / ll-1, ll-8 pad / ll-10
  });

  describe.each(MAP_PAGES.map((p) => [p.id, p] as const))('%s', (_, page) => {
    it('is 15 rows of 16 legend chars with plain sky under the header', () => {
      expect(page.tiles).toHaveLength(15);
      for (const row of page.tiles) {
        expect(row).toHaveLength(16);
        for (const ch of row) expect(MAP_LEGEND[ch], `legend has '${ch}'`).toBeDefined();
      }
      expect(page.tiles[0]).toBe('.'.repeat(16));
      expect(page.tiles[1]).toBe('.'.repeat(16));
      expect(songs.map((s) => s.id)).toContain(page.music);
      expect(page.title).toMatch(/^[A-Z' ]+$/);
    });

    it('has one start and its nodes on walkable tiles, above the hint line (row 13 at most)', () => {
      expect(page.nodes.filter((n) => n.kind === 'start')).toHaveLength(1);
      const ids = page.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
      const spots = page.nodes.map((n) => key([n.x, n.y]));
      expect(new Set(spots).size, 'one node per tile').toBe(spots.length);
      for (const n of page.nodes) {
        expectWalk(page, [[n.x, n.y]], `node ${n.id}`);
        expect(n.y, `node ${n.id}`).toBeLessThanOrEqual(13);
      }
    });

    it('reaches every node from the start along contiguous walkable paths', () => {
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
      expect([...seen].sort()).toEqual(page.nodes.map((n) => n.id).sort());
      for (const p of page.paths) {
        const a = nodeAt(page, p.from);
        const b = nodeAt(page, p.to);
        expect(p.points[0]).toEqual([a.x, a.y]);
        expect(p.points.at(-1)).toEqual([b.x, b.y]);
        expectWalk(page, p.points, `${p.from}->${p.to}`);
      }
    });

    it('warps to registered pages and nodes; exits stay within the group', () => {
      for (const n of page.nodes.filter(isWarpNode)) {
        const to = mapPage(n.to ?? '');
        expect(to, `${n.id} → ${n.to}`).toBeDefined();
        if (n.toNode)
          expect(
            to?.nodes.some((m) => m.id === n.toNode),
            `${n.id} toNode`,
          ).toBe(true);
        if (n.requires) expect(n.hint, `${n.id} has a hint while locked`).toBeTruthy();
        for (const t of [n.hint, n.label]) if (t) expect(t.length).toBeLessThanOrEqual(32);
        expect(n.level).toBeUndefined();
      }
      for (const e of page.exits) {
        expect(mapPage(e.to)?.group).toBe(page.group);
        const c = nodeAt(page, e.from);
        expect(e.points[0], `exit ${e.to} leaves from its node`).toEqual([c.x, c.y]);
        expectWalk(page, e.points, `exit ${e.to}`);
      }
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

    it('has 6-15 known actors inside the page', () => {
      expect(page.actors.length).toBeGreaterThanOrEqual(6);
      expect(page.actors.length).toBeLessThanOrEqual(15);
      for (const a of page.actors) {
        expect(MAP_ACTOR_TYPES).toContain(a.type);
        expect(a.x >= 0 && a.x <= 240 && a.y >= 0 && a.y <= 224, `${a.type} at ${a.x},${a.y}`).toBe(true);
        expect(a.props, 'actors carry a props object').toBeDefined();
      }
    });

    it('keeps every actor, wherever it moves, off roads, exits and nodes', () => {
      const busy = new Set<string>();
      for (const n of page.nodes) busy.add(key([n.x, n.y]));
      for (const p of [...page.paths, ...page.exits]) for (const pt of p.points) busy.add(key(pt));
      for (const a of page.actors) {
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
        if (a.y + 24 <= 48) continue; // the sky band just under the header
        for (let ty = Math.floor(a.y / 16); ty <= Math.floor((a.y + 23) / 16); ty++)
          for (const ch of page.tiles[ty] ?? '')
            expect(open.has(ch), `cloud at y ${a.y} over '${ch}'`).toBe(true);
      }
    });
  });
});

describe('page building helpers', () => {
  it('poly expands corners into single steps', () => {
    expect(poly([0, 0], [2, 0], [2, 2])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ]);
    expect(() => poly([0, 0], [1, 1])).toThrow();
  });

  it('autoShore picks edges, corners, inner corners and bridge landings', () => {
    const rows = autoShore(['~~~~', '~##~', '~##=', '~~~~']);
    expect(rows).toEqual(['~~~~', '~79~', '~13=', '~~~~']);
    expect(autoShore(['####', '####', '##~~', '##~~'])).toEqual(['####', '#c22', '#6~~', '#6~~']);
    expect(autoShore(['#=##', '####'])[0]).toBe(']=[#');
    expect(autoShore(['##', '##', 'I#', '##'])).toEqual(['##', 'uz', 'I4', 'nq']);
  });

  it('sketchProblems flags thin land and decor on the waterline', () => {
    expect(sketchProblems(['~#~', '~#~'])).toContain('land at 1,0 is one tile thin');
    expect(sketchProblems(['T~', '##'])).toContain("'T' at 0,0 touches water");
    expect(sketchProblems(['##', '##'])).toEqual([]);
    expect(sketchProblems(['abdf', 'gilm', 'prtv'])).toEqual([]);
    expect(sketchProblems(['abdf', 'gilm', 'prt#'])).toContain('pond at 0,2 is not a whole block');
  });
});
