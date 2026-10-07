import { describe, expect, it } from 'vitest';
import type { WorldMapPage } from '@game/map/types';
import { isWarpNode } from '@game/map/rules';
import { ARENA_FEET, ARENA_GAMES } from '@game/arena';
import { mapPage } from './index';
import {
  ARENA_PAGE,
  ARENA_SLOTS,
  arenaLayout,
  arenaPadId,
  arenaPage,
  HUB_ARENA_PAD,
  SKETCH_ARENA,
} from './arena';
import { MAP_ACTOR_TYPES, MAP_LEGEND, MAP_WALKABLE, mapActorBounds } from './render';

/*
 * The Mini Game Arena page: laid out from however many games are registered (src/game/arena), so
 * every count from none to every slot must give a sound page (pages.test.ts checks the registered
 * page as content alone loads it; here the page with the real games, and every other count).
 */

type Pt = [number, number];
const key = ([x, y]: Pt) => `${x},${y}`;
const dir = (a: Pt, b: Pt) => `${b[0] - a[0]},${b[1] - a[1]}`;

function problems(page: WorldMapPage): string[] {
  const out: string[] = [];
  const walk = (p: Pt) => MAP_WALKABLE.has(page.tiles[p[1]]?.[p[0]] ?? '');
  const ids = page.nodes.map((n) => n.id);
  if (new Set(ids).size !== ids.length) out.push('duplicate node ids');
  const spots = page.nodes.map((n) => key([n.x, n.y]));
  if (new Set(spots).size !== spots.length) out.push('two nodes on one tile');
  for (const n of page.nodes) {
    if (!walk([n.x, n.y])) out.push(`node ${n.id} off the ground`);
    if (n.y < 2 || n.y > 13) out.push(`node ${n.id} outside rows 2-13`);
  }
  const byId = new Map(page.nodes.map((n) => [n.id, n]));
  const owner = new Map<string, string>();
  const steps = new Map<string, string[]>();
  for (const p of page.paths) {
    const a = byId.get(p.from);
    const b = byId.get(p.to);
    if (!a || !b) {
      out.push(`road ${p.from}->${p.to} names a missing node`);
      continue;
    }
    if (key(p.points[0] as Pt) !== key([a.x, a.y]) || key(p.points.at(-1) as Pt) !== key([b.x, b.y]))
      out.push(`road ${p.from}->${p.to} does not join its nodes`);
    p.points.forEach((pt, i) => {
      if (!walk(pt)) out.push(`road ${p.from}->${p.to} off the ground at ${key(pt)}`);
      const q = p.points[i - 1];
      if (q && Math.abs(pt[0] - q[0]) + Math.abs(pt[1] - q[1]) !== 1)
        out.push(`road ${p.from}->${p.to} jumps`);
      if (spots.includes(key(pt)) && i > 0 && i < p.points.length - 1)
        out.push(`road ${p.from}->${p.to} runs through a node`);
      else if (i > 0 && i < p.points.length - 1) {
        if (owner.has(key(pt)))
          out.push(`roads ${owner.get(key(pt))} and ${p.from}->${p.to} share ${key(pt)}`);
        owner.set(key(pt), `${p.from}->${p.to}`);
      }
    });
    for (const [id, d] of [
      [p.from, dir(p.points[0] as Pt, p.points[1] as Pt)],
      [p.to, dir(p.points.at(-1) as Pt, p.points.at(-2) as Pt)],
    ] as const)
      steps.set(id, [...(steps.get(id) ?? []), d]);
  }
  for (const [id, ds] of steps)
    if (new Set(ds).size !== ds.length) out.push(`${id} offers a direction twice`);
  // Every pad reachable from the Return pad.
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
  for (const id of ids) if (!seen.has(id)) out.push(`${id} unreachable`);
  return out;
}

describe('Mini Game Arena page', () => {
  it('is its own group, a sketch of known tiles with plain sky under the header', () => {
    const page = mapPage('arena') as WorldMapPage;
    expect(page).toBe(ARENA_PAGE);
    expect([page.group, page.label, page.title]).toEqual(['arena', 'ARENA', 'MINI GAME ARENA']);
    expect([page.theme, page.music]).toEqual(['arena', 'arena']);
    expect(page.tiles).toEqual(SKETCH_ARENA);
    for (const row of page.tiles) {
      expect(row).toHaveLength(16);
      for (const ch of row) expect(MAP_LEGEND[ch], ch).toBeDefined();
    }
    expect(page.tiles.slice(0, 2)).toEqual(['.'.repeat(16), '.'.repeat(16)]);
  });

  it('arrives on the Return pad in the middle, which warps back to the hub pad that leads here', () => {
    const start = ARENA_PAGE.nodes.find((n) => n.kind === 'start');
    expect(start).toMatchObject({ id: 'start', x: 7, y: 9, to: 'hub', toNode: HUB_ARENA_PAD });
    expect(start?.label).toBe('RETURN TO WARP ZONE');
    expect(isWarpNode(start!)).toBe(true);
    const pad = mapPage('hub')?.nodes.find((n) => n.id === HUB_ARENA_PAD);
    expect(pad).toMatchObject({ kind: 'warp', to: 'arena' });
    expect(pad?.requires).toBeUndefined();
  });

  it('has one pad per registered game, in registry order, laid out soundly', () => {
    const pads = ARENA_PAGE.nodes.filter((n) => n.kind === 'game');
    expect(pads.map((n) => n.game)).toEqual(ARENA_GAMES.map((g) => g.id));
    expect(pads.map((n) => n.id)).toEqual(ARENA_GAMES.map((g) => arenaPadId(g.id)));
    expect(ARENA_GAMES.length, 'room for every game').toBeLessThanOrEqual(ARENA_SLOTS.length);
    expect(problems(ARENA_PAGE)).toEqual([]);
  });

  it('grows soundly for any number of games, up to every slot (the ring closes when full)', () => {
    expect(ARENA_SLOTS.length).toBeGreaterThanOrEqual(22);
    for (let n = 0; n <= ARENA_SLOTS.length + 2; n++) {
      const games = Array.from({ length: n }, (_, i) => `g${i}`);
      const page = arenaPage(games);
      expect(problems(page), `${n} games`).toEqual([]);
      expect(page.nodes.length).toBe(1 + Math.min(n, ARENA_SLOTS.length));
    }
    const full = arenaLayout(ARENA_SLOTS.map((_, i) => `g${i}`));
    expect(full.paths.some((p) => p.from === 'pad-g6' && p.to === `pad-g${ARENA_SLOTS.length - 1}`)).toBe(
      true,
    );
  });

  it('a hero up to 32 px tall standing on any pad covers no other pad and no road, at every count', () => {
    for (let n = 1; n <= ARENA_SLOTS.length; n++) {
      const page = arenaPage(Array.from({ length: n }, (_, i) => `g${i}`));
      const pads = page.nodes.filter((p) => p.kind === 'game');
      for (const a of pads) {
        // The hero: 16 px wide over the pad, feet on its plate (drawArenaPad), 32 px tall.
        const x0 = a.x * 16;
        const y1 = a.y * 16 + ARENA_FEET;
        const y0 = y1 - 32;
        const hits = (x: number, y: number, w: number, h: number) =>
          x < x0 + 16 && x0 < x + w && y < y1 && y0 < y + h;
        // Other pads (the plate, rows 10-15 of the tile) and their heroes.
        for (const b of pads) {
          if (b === a) continue;
          expect(hits(b.x * 16, b.y * 16 + 10, 16, 6), `${n}: ${a.id} over ${b.id}`).toBe(false);
          expect(
            hits(b.x * 16, b.y * 16 + ARENA_FEET - 32, 16, 32),
            `${n}: ${a.id} over ${b.id}'s hero`,
          ).toBe(false);
        }
        // Road tiles that are not this pad's (its roads leave the tile at its edges).
        for (const p of page.paths)
          for (const [x, y] of p.points)
            if (x !== a.x || y !== a.y)
              expect(
                hits(x * 16 + 4, y * 16 + 4, 8, 8),
                `${n}: ${a.id} over road ${p.from}->${p.to} at ${x},${y}`,
              ).toBe(false);
      }
    }
  });

  it('keeps its actors off every road and pad, whatever the layout', () => {
    const page = arenaPage(Array.from({ length: ARENA_SLOTS.length }, (_, i) => `g${i}`));
    expect(page.actors.length).toBeGreaterThanOrEqual(6);
    const busy = new Set<string>();
    for (const n of page.nodes) busy.add(key([n.x, n.y]));
    for (const p of page.paths) for (const pt of p.points) busy.add(key(pt));
    for (const a of page.actors) {
      expect(MAP_ACTOR_TYPES).toContain(a.type);
      const [x0, y0, x1, y1] = mapActorBounds(a);
      for (let ty = Math.floor(y0 / 16); ty <= Math.floor((y1 - 1) / 16); ty++)
        for (let tx = Math.floor(x0 / 16); tx <= Math.floor((x1 - 1) / 16); tx++)
          expect(busy.has(key([tx, ty])), `${a.type} at ${a.x},${a.y}`).toBe(false);
    }
  });
});
