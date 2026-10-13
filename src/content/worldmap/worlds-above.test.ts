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
import {
  aboveLook,
  aboveRoadCells,
  drawAboveRoads,
  drawAboveScenery,
  type AboveNodeState,
} from './above-render';
import { WORLD_1_KINGDOM } from './world1-kingdom';
import { WORLD_2 } from './world2';
import { SKETCH_2_HYRULE, WORLD_2_HYRULE } from './world2-hyrule';
import { WORLD_3 } from './world3';
import { WORLD_3_MEGACITY } from './world3-megacity';
import { WORLD_4 } from './world4';
import { WORLD_4_ZEBES } from './world4-zebes';
import { WORLD_5 } from './world5';
import { WORLD_5_TRANSYLVANIA } from './world5-transylvania';
import { WORLD_6 } from './world6';
import { WORLD_6_GALESBURG } from './world6-galesburg';
import { WORLD_7 } from './world7';
import { WORLD_7_GALUGA } from './world7-galuga';

/*
 * Worlds 2 and 3 from above (0.4.50, campaign play): HYRULE and MEGA CITY are looks of the
 * registered World 2 and 3, so saves, save codes, reveals, the bonus spots and the gates read them
 * exactly as WORLD_2 and WORLD_3. Worlds 4 and 5 (0.4.52): PLANET ZEBES and TRANSYLVANIA the same
 * way, World 4's roads in the campaign order (map/campaign-order.ts). Worlds 6 and 7 (0.4.53):
 * GALESBURG and GALUGA ISLAND, both in the campaign order. pages.test.ts runs every page rule on
 * them too; tests/sim/above-maps.test.ts, above-maps-w45.test.ts and above-maps-w67.test.ts play them.
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
  /** The road ids when the campaign plays the world in another order (else the classic page's). */
  roads?: readonly string[];
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
        '3-4': [null, 'smb-4', '3-3', '3-3'],
        'bonus-3': [null, null, null, '3-1'],
      },
    },
  ],
  [
    'World 4, Planet Zebes',
    {
      page: WORLD_4_ZEBES,
      classic: WORLD_4,
      sheet: 'zebes-above',
      captive: ['4-2', -1], // Samus west of internal 4-2 (shown 4-1), at 1,11, over the Chozo
      bridges: [],
      aim: {
        start: [null, null, '4-2', 'smb-3'],
        '4-1': [null, '4-3', '4-2', '4-2'],
        '4-2': ['start', '4-1', 'bonus-4', null],
        '4-3': ['4-4', '4-4', '4-1', '4-1'],
        // The escape leaves Tourian west; RIGHT heads for World 5 too (the exit's far end).
        '4-4': [null, 'smb-5', '4-3', 'smb-5'],
        'bonus-4': ['4-2', null, null, '4-2'],
      },
      // The campaign order: internal 4-2 first (shown 4-1), then 4-1 (shown 4-2), 4-3, 4-4.
      roads: ['start>4-2', '4-2>4-1', '4-1>4-3', '4-3>4-4', '4-2>bonus-4'],
    },
  ],
  [
    'World 5, Transylvania',
    {
      page: WORLD_5_TRANSYLVANIA,
      classic: WORLD_5,
      sheet: 'transylvania-above',
      captive: ['5-1', -1], // Simon west of 5-1 (his crypt's entrance in 5-1), at 1,9
      bridges: ['bridge-v'],
      aim: {
        start: [null, '5-1', '5-1', 'smb-4'],
        '5-1': ['start', '5-2', 'bonus-5', null],
        '5-2': ['5-3', '5-3', null, '5-1'],
        '5-3': [null, '5-4', '5-2', null],
        '5-4': [null, null, 'smb-6', '5-3'],
        'bonus-5': ['5-1', null, null, '5-1'],
      },
    },
  ],
  [
    'World 6, Galesburg',
    {
      page: WORLD_6_GALESBURG,
      classic: WORLD_6,
      sheet: 'galesburg-above',
      captive: ['6-2', 1], // Ryu east of internal 6-2 (shown 6-1), at 5,10, by the dojo
      bridges: [],
      aim: {
        start: [null, '6-2', null, 'smb-5'],
        '6-1': ['6-3', null, '6-2', '6-2'],
        '6-2': ['6-1', '6-1', null, 'start'],
        '6-3': ['bonus-6', '6-4', '6-1', '6-1'],
        '6-4': ['6-3', 'smb-7', null, '6-3'],
        'bonus-6': [null, null, null, '6-3'],
      },
      // The campaign order: internal 6-2 first (shown 6-1), then 6-1 (shown 6-2), 6-3, 6-4.
      roads: ['start>6-2', '6-2>6-1', '6-1>6-3', '6-3>6-4', '6-3>bonus-6'],
    },
  ],
  [
    'World 7, Galuga Island',
    {
      page: WORLD_7_GALUGA,
      classic: WORLD_7,
      sheet: 'galuga-above',
      captive: ['7-3', -1], // Bill west of internal 7-3 (shown 7-1), at 2,9, over his camp
      bridges: ['steel-bridge'],
      aim: {
        start: [null, '7-3', '7-3', 'smb-6'],
        '7-1': [null, '7-2', '7-3', null],
        '7-2': ['7-1', 'bonus-7', '7-4', '7-1'],
        '7-3': ['start', '7-1', null, 'start'],
        '7-4': [null, 'smb-8', null, '7-2'],
        'bonus-7': [null, null, '7-2', '7-2'],
      },
      // The campaign order: internal 7-3 first (shown 7-1), then 7-1, 7-2 (shown 7-2, 7-3), 7-4.
      roads: ['start>7-3', '7-3>7-1', '7-1>7-2', '7-2>7-4', '7-2>bonus-7'],
    },
  ],
];

describe('campaign looks from above', () => {
  it('are Worlds 1 to 7’s, only in campaign play: the registry keeps the classic pages', () => {
    expect(CAMPAIGN_PAGES).toEqual([
      WORLD_1_KINGDOM,
      WORLD_2_HYRULE,
      WORLD_3_MEGACITY,
      WORLD_4_ZEBES,
      WORLD_5_TRANSYLVANIA,
      WORLD_6_GALESBURG,
      WORLD_7_GALUGA,
    ]);
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
    const strip = ({ shown: _s, ...n }: MapNode) => ({ ...n, x: 0, y: 0 });
    expect(page.nodes.map(strip)).toEqual(classic.nodes.map(strip));
    expect(page.paths.map(pathId)).toEqual(c.roads ?? classic.paths.map(pathId));
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
      moving.every((f) => /^(water|sea|magma|z4-w|tv5-w|canal|river|falls)/.test(f)),
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

describe('World 4, Planet Zebes: the campaign order and its landmarks', () => {
  const look = aboveLook(WORLD_4_ZEBES);
  if (!look) throw new Error('not drawn from above');
  const node = (id: string) => WORLD_4_ZEBES.nodes.find((n) => n.id === id) as MapNode;
  const s = (cleared: boolean): AboveNodeState => ({ cleared, secret: false, warpOpen: false });

  it('plays internal 4-2 (Samus’s cavern, Larry’s airship) first, shown 4-1; ids, order and the bonus road kept', () => {
    expect(WORLD_4_ZEBES.nodes.map((n) => n.id)).toEqual(WORLD_4.nodes.map((n) => n.id));
    expect(node('4-2').shown).toBe('4-1');
    expect(node('4-1').shown).toBe('4-2');
    expect(node('4-3').shown).toBeUndefined();
    expect(node('4-4').shown).toBeUndefined();
    expect(WORLD_4_ZEBES.paths[0]).toMatchObject({ from: 'start', to: '4-2' });
    const bonus = (p: WorldMapPage) => p.paths.find((q) => q.to === 'bonus-4');
    expect({ ...bonus(WORLD_4_ZEBES), points: [] }).toEqual({ ...bonus(WORLD_4), points: [] });
    expect(bonus(WORLD_4_ZEBES)?.exit).toBe('secret:larry');
    // Samus's mark stands west of her cavern, the Chozo statue below it.
    expect(heroSide(WORLD_4_ZEBES, node('4-2'))).toBe(-1);
  });

  it('shows Mother Brain’s tank as the castle (shattered once cleared), a Chozo item sphere as the bonus spot', () => {
    expect(look.node('castle', s(false))).toBe('castle');
    expect(look.node('castle', s(true))).toBe('castle-cleared');
    expect(look.node('bonus', s(false))).toBe('bonus');
    expect(look.node('bonus', s(true))).toBe('bonus-used');
    expect(look.node('start', s(false))).toBe('node-start');
    const frames = SPRITES['zebes-above']?.frames ?? {};
    expect(frames.castle).not.toEqual(frames['castle-cleared']);
    expect(frames.bonus).not.toEqual(frames['bonus-used']);
  });

  it('lays Larry’s wreck by the bonus spot only while the spot shows (after the airship crashes there)', () => {
    const r = new Recorder();
    drawAboveScenery(r, assets, look, WORLD_4_ZEBES, 0, () => false);
    expect(r.drawn.some((d) => d.frame === 'wreck')).toBe(false);
    expect(r.drawn.some((d) => d.frame === 'gunship')).toBe(true);
    r.drawn = [];
    drawAboveScenery(r, assets, look, WORLD_4_ZEBES, 0, (id) => id === 'bonus-4');
    expect(r.drawn.some((d) => d.frame === 'wreck')).toBe(true);
    expect(WORLD_4_ZEBES.props?.find((p) => p.frame === 'wreck')?.node).toBe('bonus-4');
  });

  it('paints its regions whole: seams off the tile grid, so nearly every ground tile is its own', () => {
    const g = look.ground(WORLD_4_ZEBES);
    expect(new Set(g.frames[0]).size).toBeGreaterThan(200);
    // No road runs over lava.
    for (const [x, y] of [...WORLD_4_ZEBES.paths, ...WORLD_4_ZEBES.exits].flatMap((p) => p.points))
      expect(g.wet[y * 16 + x], key(x, y)).toBe(false);
  });
});

describe('World 5, Transylvania: its landmarks', () => {
  const look = aboveLook(WORLD_5_TRANSYLVANIA);
  if (!look) throw new Error('not drawn from above');
  const s = (cleared: boolean): AboveNodeState => ({ cleared, secret: false, warpOpen: false });

  it('keeps the keep standing always; 5-4’s marker is its gatehouse, the portcullis up once cleared', () => {
    expect(WORLD_5_TRANSYLVANIA.props?.some((p) => p.frame === 'keep' && !p.node)).toBe(true);
    expect(look.node('castle', s(false))).toBe('castle');
    expect(look.node('castle', s(true))).toBe('castle-cleared');
    const frames = SPRITES['transylvania-above']?.frames ?? {};
    expect(frames.castle).not.toEqual(frames['castle-cleared']);
    // The gatehouse marker is no wider than its tile, so the roads beside it stay clear.
    expect(frames.castle?.[0]?.length).toBe(16);
  });

  it('shows the bonus spot as a treasure chest, open once used; World 5 keeps its order (no shown labels)', () => {
    expect(look.node('bonus', s(false))).toBe('bonus');
    expect(look.node('bonus', s(true))).toBe('bonus-used');
    expect(WORLD_5_TRANSYLVANIA.nodes.every((n) => n.shown === undefined)).toBe(true);
    // 5-1 has three roads (north, east, south) so its west side is free for Simon's mark.
    const n = WORLD_5_TRANSYLVANIA.nodes.find((x) => x.id === '5-1') as MapNode;
    expect(heroSide(WORLD_5_TRANSYLVANIA, n)).toBe(-1);
  });
});

describe.each([
  [
    'World 6, Galesburg',
    WORLD_6_GALESBURG,
    WORLD_6,
    { '6-2': '6-1', '6-1': '6-2', '6-3': undefined, '6-4': undefined },
    ['6-2', 1],
    { castle: ['pagoda', 'pagoda-cleared'], bonus: ['bonus', 'bonus-used'] },
    'galesburg-above',
  ],
  [
    'World 7, Galuga Island',
    WORLD_7_GALUGA,
    WORLD_7,
    { '7-3': '7-1', '7-1': '7-2', '7-2': '7-3', '7-4': undefined },
    ['7-3', -1],
    { castle: ['lair', 'lair-cleared'], bonus: ['bonus', 'bonus-used'] },
    'galuga-above',
  ],
] as const)('%s: the campaign order and its markers', (_, page, classic, shown, hint, markers, sheet) => {
  const look = aboveLook(page);
  if (!look) throw new Error('not drawn from above');
  const node = (id: string) => page.nodes.find((n) => n.id === id) as MapNode;
  const s = (cleared: boolean): AboveNodeState => ({ cleared, secret: false, warpOpen: false });

  it('plays the hero’s level first: ids, kinds and order kept, each level shown by the table', () => {
    expect(page.nodes.map((n) => n.id)).toEqual(classic.nodes.map((n) => n.id));
    for (const [id, label] of Object.entries(shown)) expect(node(id).shown, id).toBe(label);
    expect(page.paths[0]).toMatchObject({ from: 'start', to: hint[0] });
    // The hero's mark stands beside the first level, on no road.
    const [id, side] = hint;
    expect(heroSide(page, node(id))).toBe(side);
    const spot = key(node(id).x + side, node(id).y);
    expect([...page.paths, ...page.exits].some((p) => p.points.some(([x, y]) => key(x, y) === spot))).toBe(
      false,
    );
    // The bonus road keeps its id and its ends.
    const bonus = (p: WorldMapPage) => p.paths.find((q) => q.to.startsWith('bonus-'));
    expect({ ...bonus(page), points: [] }).toEqual({ ...bonus(classic), points: [] });
  });

  it('shows the castle and the bonus spot with their own markers, changed once cleared or used', () => {
    expect([look.node('castle', s(false)), look.node('castle', s(true))]).toEqual(markers.castle);
    expect([look.node('bonus', s(false)), look.node('bonus', s(true))]).toEqual(markers.bonus);
    expect(look.node('start', s(false))).toBe('node-start');
    const frames = SPRITES[sheet]?.frames ?? {};
    expect(frames[markers.castle[0]]).not.toEqual(frames[markers.castle[1]]);
    expect(frames.bonus).not.toEqual(frames['bonus-used']);
  });
});

describe('Galesburg and Galuga Island in the colour-blind modes', () => {
  const ROLES = '0123456789abcdefghijklmnopqrstuvwxyz';
  const roles = (sheet: string, mode: 'default' | 'deuteranopia' | 'protanopia', rs: string) =>
    [...rs].map((r) => PALETTES[mode]?.[sheet]?.[ROLES.indexOf(r)]);

  it('keeps their earth tones (brick, wood, roads’ rims, golden rock, trunks) put: no red shift turns them pink', () => {
    for (const mode of ['deuteranopia', 'protanopia'] as const) {
      expect(roles('galesburg-above', mode, '4dhij'), mode).toEqual(
        roles('galesburg-above', 'default', '4dhij'),
      );
      expect(roles('galuga-above', mode, '04dhi'), mode).toEqual(roles('galuga-above', 'default', '04dhi'));
    }
  });

  it('still shifts their true reds (an open level’s space, the lacquer, the lair, the warning lights)', () => {
    for (const mode of ['deuteranopia', 'protanopia'] as const)
      for (const [sheet, rs] of [
        ['galesburg-above', 'pqrn'],
        ['galuga-above', 'pqrt'],
      ] as const) {
        const shifted = roles(sheet, mode, rs);
        roles(sheet, 'default', rs).forEach((c, i) =>
          expect(shifted[i], `${mode} ${sheet} ${rs[i]}`).not.toBe(c),
        );
      }
  });
});
