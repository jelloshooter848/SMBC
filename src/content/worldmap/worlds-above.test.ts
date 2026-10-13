import { describe, expect, it } from 'vitest';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { heroSide } from '@game/map/captives';
import { drawnFromAbove, exitId, newMapProgress, nextStep, pathId, type Dir } from '@game/map/rules';
import { localSpot } from '@game/map/world-gate';
import type { MapNode, WorldMapPage } from '@game/map/types';
import { CAMPAIGN_PAGES, mapPage, MAP_PAGES, pageLook } from './index';
import { aboveLook, aboveRoadCells, drawAboveRoads, type AboveNodeState } from './above-render';
import { WORLD_1_KINGDOM } from './world1-kingdom';
import { WORLD_2 } from './world2';
import { SKETCH_2_HYRULE, WORLD_2_HYRULE } from './world2-hyrule';
import { WORLD_3 } from './world3';
import { WORLD_3_MEGACITY } from './world3-megacity';

/*
 * Worlds 2 and 3 from above (0.4.50, campaign play): HYRULE and MEGA CITY are looks of the
 * registered World 2 and 3, so saves, save codes, reveals, the bonus spots and the gates read them
 * exactly as WORLD_2 and WORLD_3. pages.test.ts runs every page rule on them too;
 * tests/sim/above-maps.test.ts plays them.
 */

const assets = new AssetRegistry(PALETTES);
assets.defineAll(SPRITES);
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

const dirs: Dir[] = ['up', 'right', 'down', 'left'];

interface Case {
  page: WorldMapPage;
  classic: WorldMapPage;
  sheet: string;
  /** The node whose captive hero stands beside it, and the side. */
  captive: [string, 1 | -1];
  /** Props a road may cross (it rides over them). */
  bridges: readonly string[];
  /** Every node's UP, RIGHT, DOWN, LEFT with every road open and the bonus spot found. */
  aim: Record<string, (string | null)[]>;
}

const CASES: [string, Case][] = [
  [
    'World 2, Hyrule',
    {
      page: WORLD_2_HYRULE,
      classic: WORLD_2,
      sheet: 'hyrule-above',
      captive: ['2-1', -1], // Link west of 2-1, at 2,9
      bridges: ['bridge'],
      //          up         right      down     left
      aim: {
        start: [null, '2-1', null, 'smb-1'],
        '2-1': ['bonus-2', '2-2', 'start', 'start'],
        '2-2': ['2-3', '2-3', '2-1', '2-1'],
        '2-3': ['2-4', null, '2-2', '2-2'],
        '2-4': [null, 'smb-3', '2-3', null],
        'bonus-2': [null, '2-1', '2-1', null],
      },
    },
  ],
  [
    'World 3, Mega City',
    {
      page: WORLD_3_MEGACITY,
      classic: WORLD_3,
      sheet: 'megacity-above',
      captive: ['3-1', 1], // Mega Man east of 3-1, at 6,5
      bridges: [],
      aim: {
        start: [null, '3-1', null, 'smb-2'],
        '3-1': ['bonus-3', 'bonus-3', '3-2', 'start'],
        '3-2': ['3-1', '3-3', '3-3', null],
        '3-3': ['3-4', '3-4', '3-2', '3-2'],
        '3-4': [null, 'smb-4', '3-3', null],
        'bonus-3': [null, null, null, '3-1'],
      },
    },
  ],
];

describe('campaign looks from above', () => {
  it('are World 1, 2 and 3’s, only in campaign play: the registry keeps the classic pages', () => {
    expect(CAMPAIGN_PAGES).toEqual([WORLD_1_KINGDOM, WORLD_2_HYRULE, WORLD_3_MEGACITY]);
    for (const p of CAMPAIGN_PAGES) {
      expect(MAP_PAGES).not.toContain(p);
      expect(drawnFromAbove(p), p.id).toBe(true);
      const classic = mapPage(p.id) as WorldMapPage;
      expect(drawnFromAbove(classic), p.id).toBe(false);
      expect(pageLook(classic, true)).toBe(p);
      expect(pageLook(classic, false)).toBe(classic);
    }
  });
});

describe.each(CASES)('%s from above (campaign look)', (_, c) => {
  const { page, classic } = c;
  const look = aboveLook(page);
  if (!look) throw new Error('not drawn from above');
  const sheet = assets.sheet(c.sheet);
  const g = look.ground(page);
  /** Whether frame `frame` of the sheet at (fx, fy) paints the pixel (px, py). */
  const paints = (frame: string, fx: number, fy: number, px: number, py: number): boolean => {
    const ch = SPRITES[c.sheet]?.frames[frame]?.[py - fy]?.[px - fx];
    return ch !== undefined && ch !== '.';
  };
  const roads = [...page.paths, ...page.exits].flatMap((p) => p.points);

  it('keeps the classic page’s id, theme, nodes (every field but the tile), roads and exit', () => {
    expect(page.id).toBe(classic.id);
    expect(look.sheet).toBe(c.sheet);
    for (const k of ['label', 'title', 'music', 'group', 'theme'] as const) expect(page[k]).toBe(classic[k]);
    const strip = (n: MapNode) => ({ ...n, x: 0, y: 0 });
    expect(page.nodes.map(strip)).toEqual(classic.nodes.map(strip));
    expect(page.paths.map(pathId)).toEqual(classic.paths.map(pathId));
    expect(page.paths.map((p) => p.exit)).toEqual(classic.paths.map((p) => p.exit));
    expect(page.exits.map(exitId)).toEqual(classic.exits.map(exitId));
    expect(page.exits.map(({ points: _p, ...e }) => e)).toEqual(
      classic.exits.map(({ points: _p, ...e }) => e),
    );
    // The start and the exit stay on their rows, so the slides to the next and last pages line up.
    const start = (p: WorldMapPage) => p.nodes.find((n) => n.kind === 'start');
    expect([start(page)?.x, start(page)?.y]).toEqual([start(classic)?.x, start(classic)?.y]);
    expect(page.exits[0]?.points.at(-1)).toEqual(classic.exits[0]?.points.at(-1));
  });

  it('has a frame for every ground tile, road join, landmark and node marker', () => {
    for (const f of [...g.frames[0], ...g.frames[1], ...g.scenery.map((s) => s.frame)])
      expect(sheet.frames.has(f), f).toBe(true);
    expect(new Set(look.roads).size).toBe(16);
    for (const f of look.roads) expect(sheet.frames.has(f), f).toBe(true);
    for (const p of page.props ?? []) expect(sheet.frames.has(p.frame), p.frame).toBe(true);
    const kinds: MapNode['kind'][] = ['start', 'level', 'castle', 'bonus'];
    const seen = new Set<string>();
    for (const kind of kinds)
      for (const cleared of [false, true])
        for (const secret of [false, true]) {
          const s: AboveNodeState = { cleared, secret, warpOpen: false };
          const f = look.node(kind, s);
          expect(f && sheet.frames.has(f), `${kind} ${cleared} ${secret}`).toBe(true);
          seen.add(f as string);
        }
    // The bonus spot (open and used) and the castle (open and cleared) each have their own marker.
    expect(look.node('bonus', { cleared: false, secret: false, warpOpen: false })).not.toBe(
      look.node('bonus', { cleared: true, secret: false, warpOpen: false }),
    );
    expect(look.node('castle', { cleared: false, secret: false, warpOpen: false })).not.toBe(
      look.node('castle', { cleared: true, secret: false, warpOpen: false }),
    );
    expect(seen.size).toBeGreaterThanOrEqual(8);
    // The water ripples in two frames; nothing else on the ground moves.
    const moving = g.frames[0].filter((f, i) => f !== g.frames[1][i]);
    expect(moving.length).toBeGreaterThan(0);
    expect(
      moving.every((f) => /^(water|sea|magma)-/.test(f)),
      moving.join(),
    ).toBe(true);
  });

  it('has the colour-blind and high-contrast palettes every sheet gets, each its own', () => {
    const base = PALETTES.default[c.sheet];
    expect(base?.length).toBeGreaterThan(0);
    for (const mode of ['deuteranopia', 'protanopia', 'tritanopia', 'highContrast'] as const) {
      expect(PALETTES[mode]?.[c.sheet], mode).toHaveLength(base?.length ?? -1);
      expect(PALETTES[mode]?.[c.sheet], mode).not.toEqual(base);
    }
  });

  it('keeps its landmarks inside the page and off every node, road, the captive hero and the local', () => {
    const [heroAt, side] = c.captive;
    const hero = page.nodes.find((n) => n.id === heroAt) as MapNode;
    expect(heroSide(page, hero)).toBe(side);
    const local = localSpot(page);
    for (const p of page.props ?? []) {
      const f = sheet.frames.get(p.frame);
      expect(f, p.frame).toBeDefined();
      if (!f) continue;
      expect(p.x >= 0 && p.y >= 24 && p.x + f.w <= 256 && p.y + f.h <= 240, p.frame).toBe(true);
      for (const n of page.nodes)
        for (let dy = 2; dy < 14; dy++)
          for (let dx = 2; dx < 14; dx++)
            expect(paints(p.frame, p.x, p.y, n.x * 16 + dx, n.y * 16 + dy), `${p.frame} over ${n.id}`).toBe(
              false,
            );
      // A road crosses water on a bridge; no other landmark lies on a road.
      if (!c.bridges.includes(p.frame))
        for (const [x, y] of roads)
          expect(paints(p.frame, p.x, p.y, x * 16 + 8, y * 16 + 8), `${p.frame} on road ${key(x, y)}`).toBe(
            false,
          );
      // The captive hero's silhouette and trophy stand beside its node (captives.ts).
      const hx = (hero.x + side) * 16;
      for (let dy = -8; dy < 16; dy++)
        for (let dx = 0; dx < 16; dx++)
          expect(paints(p.frame, p.x, p.y, hx + dx, hero.y * 16 + dy), `${p.frame} over the hero`).toBe(
            false,
          );
      if (local)
        for (let dy = 0; dy < 20; dy++)
          for (let dx = 0; dx < 16; dx++)
            expect(paints(p.frame, p.x, p.y, local.x + dx, local.y + dy), `${p.frame} over the local`).toBe(
              false,
            );
    }
  });

  it('never stands tall scenery (it overhangs the tile above) under a road or a node', () => {
    const busy = new Set([...page.nodes.map((n) => key(n.x, n.y)), ...roads.map(([x, y]) => key(x, y))]);
    for (const s of g.scenery) {
      const tall = (sheet.frames.get(s.frame)?.h ?? 16) > 16;
      const tx = s.x / 16;
      const ty = (s.feet - 16) / 16;
      expect(busy.has(key(tx, ty)), `${s.frame} at ${key(tx, ty)}`).toBe(false);
      if (tall) expect(busy.has(key(tx, ty - 1)), `${s.frame} under ${key(tx, ty - 1)}`).toBe(false);
    }
  });

  it('joins roads only along themselves, never on the water', () => {
    const runs = [...page.paths.map((p) => ({ id: pathId(p), points: p.points }))].map((r) => ({
      ...r,
      dots: 2 * r.points.length,
    }));
    const cells = aboveRoadCells(page, runs);
    const r = new Recorder();
    drawAboveRoads(r, assets, look, cells, 0, null);
    expect(r.drawn.length).toBeGreaterThan(0);
    const mask = (f: string) => look.roads.indexOf(f);
    const at = new Map(r.drawn.map((d) => [key(d.x / 16, d.y / 16), mask(d.frame)]));
    // Each tile joins exactly the road tiles before and after it on each road through it.
    for (const run of runs)
      run.points.forEach(([x, y], i) => {
        const m = at.get(key(x, y));
        if (m === undefined) return; // on water: the bridge carries it
        for (const nb of [run.points[i - 1], run.points[i + 1]]) {
          if (!nb) continue;
          const bit = nb[0] > x ? 2 : nb[0] < x ? 8 : nb[1] > y ? 4 : 1;
          expect(m & bit, `${run.id} at ${key(x, y)}`).toBe(bit);
        }
      });
    for (const d of r.drawn) expect(g.wet[(d.y / 16) * 16 + d.x / 16], key(d.x / 16, d.y / 16)).toBe(false);
  });

  it('draws a road in tile by tile with the dot reveal’s timing', () => {
    const p = page.paths[0];
    if (!p) throw new Error('no road');
    const dots = 2 * (p.points.length - 1) - 1;
    const cells = aboveRoadCells(page, [{ id: pathId(p), points: p.points, dots }]);
    const r = new Recorder();
    const count = (shown: number) => {
      r.drawn = [];
      drawAboveRoads(r, assets, look, cells, 0, new Map([[pathId(p), shown]]));
      return r.drawn.length;
    };
    expect(count(0)).toBe(0);
    const counts = Array.from({ length: dots }, (_, i) => count(i + 1));
    expect(counts.every((n, i) => i === 0 || n >= (counts[i - 1] as number))).toBe(true);
    expect(counts.at(-1)).toBe(cells.length);
  });

  it('walks a road with any key that clearly points to where it leads', () => {
    const p = newMapProgress();
    p.secrets.push(...page.nodes.filter((n) => n.kind === 'bonus').map((n) => n.unlock ?? n.id));
    const to = (from: string, d: Dir) => {
      const s = nextStep(page, p, from, d, MAP_PAGES, true);
      return s ? (s.kind === 'node' ? s.to : s.kind === 'exit' ? s.exit.to : s.page) : null;
    };
    expect(Object.fromEntries(page.nodes.map((n) => [n.id, dirs.map((d) => to(n.id, d))]))).toEqual(c.aim);
    // Every road walks both ways by some key, along its own tiles.
    for (const road of page.paths) {
      const there = dirs.map((d) => nextStep(page, p, road.from, d, MAP_PAGES, true));
      const step = there.find((s) => s?.kind === 'node' && s.to === road.to);
      expect(step?.points, pathId(road)).toEqual(road.points);
      const back = dirs.map((d) => nextStep(page, p, road.to, d, MAP_PAGES, true));
      expect(
        back.some((s) => s?.kind === 'node' && s.to === road.from),
        pathId(road),
      ).toBe(true);
    }
  });
});

describe('World 2, Hyrule: Hyrule Castle stays scenery with its gate kept clear', () => {
  it('has the bridge over the south moat and plain ground below it, off every road and node', () => {
    const page = WORLD_2_HYRULE;
    expect(page.props?.some((p) => p.frame === 'castle-bridge' && p.x === 128 && p.y === 160)).toBe(true);
    expect(page.props?.some((p) => p.frame === 'hyrule-castle')).toBe(true);
    const busy = new Set([
      ...page.nodes.map((n) => key(n.x, n.y)),
      ...[...page.paths, ...page.exits].flatMap((p) => p.points.map(([x, y]) => key(x, y))),
    ]);
    expect(busy.has(key(8, 10))).toBe(false);
    expect(busy.has(key(8, 11))).toBe(false);
    expect(SKETCH_2_HYRULE[11]?.[8]).toBe('#');
    // No node on the castle's island (cols 6-9, rows 6-9): the castle is a landmark only.
    expect(page.nodes.some((n) => n.x >= 6 && n.x <= 9 && n.y >= 6 && n.y <= 9)).toBe(false);
  });
});

describe('World 3, Mega City: the bonus spot is the hatch', () => {
  it('shows bonus-3 as the hatch, shut once used', () => {
    const look = aboveLook(WORLD_3_MEGACITY);
    expect(look?.node('bonus', { cleared: false, secret: false, warpOpen: false })).toBe('bonus');
    expect(look?.node('bonus', { cleared: true, secret: false, warpOpen: false })).toBe('bonus-cleared');
    expect(WORLD_3_MEGACITY.nodes.find((n) => n.kind === 'bonus')?.id).toBe('bonus-3');
  });
});
