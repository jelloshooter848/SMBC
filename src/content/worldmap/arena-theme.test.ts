import { describe, expect, it } from 'vitest';
import { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { PALETTES, SPRITES } from '@content/sprites/index';
import { ARENA_NIGHT, mapDef, mapPalettes } from '@content/sprites/map';
import { mapIconFrames } from '@content/sprites/map-icons';
import type { MapActor, WorldMapPage } from '@game/map/types';
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
 * The Mini Game Arena's look (0.4.7): the 'arena' map theme, its tiles and actors, and the pad
 * icons. The page itself (src/content/worldmap/arena.ts) has its own tests.
 */

/** A bare page in the arena theme, for drawing. */
const page: WorldMapPage = {
  id: 'arena-art',
  group: 'hub',
  label: 'ARENA',
  title: 'MINI GAME ARENA',
  theme: 'arena',
  music: 'arena',
  tiles: [],
  nodes: [],
  paths: [],
  exits: [],
  actors: [],
};

class CheckingRenderer implements Renderer {
  readonly drawn: { sheet: string; frame: string; x: number; y: number }[] = [];
  clear(): void {}
  rect(): void {}
  text(): void {}
  debugText(): void {}
  line(): void {}
  sprite(sheet: SpriteSheet, frame: string, x: number, y: number): void {
    expect(sheet.frames.has(frame), `${sheet.id} has "${frame}"`).toBe(true);
    this.drawn.push({ sheet: sheet.id, frame, x, y });
  }
}

const registry = (): AssetRegistry => {
  const a = new AssetRegistry(PALETTES);
  a.defineAll(SPRITES);
  return a;
};

const ARENA_TILES = 'FMNEBw';

describe('arena theme', () => {
  it('has its own map palette with the shared roles, registered in every palette mode', () => {
    const pal = mapPalettes['map-arena'] as string[];
    expect(pal).toHaveLength((mapPalettes['map-grass'] as string[]).length);
    expect(PALETTES.default['map-arena']).toBe(pal);
    expect(PALETTES.highContrast?.['map-arena']).toBeDefined();
    // A night match: the sky is the night colour, and the pitch's two greens differ.
    expect(mapSky(page)).toBe(ARENA_NIGHT);
    expect(pal[2]).not.toBe(pal[3]);
  });

  it('gives the hidden-hero shade effect for the theme', () => {
    expect(PALETTES.fx?.['shade-arena']).toBeDefined();
    expect(PALETTES.fx?.['shade-arena-glow']).toBeDefined();
  });

  it('draws every arena tile from the arena palette over a long stretch of frames', () => {
    const assets = registry();
    const r = new CheckingRenderer();
    for (let t = 0; t < 400; t += 3) for (const ch of ARENA_TILES) drawMapTile(r, assets, page, ch, 0, 32, t);
    expect(r.drawn.every((d) => d.sheet === 'map@map-arena')).toBe(true);
    expect(r.drawn.length).toBe(ARENA_TILES.length * Math.ceil(400 / 3));
  });

  it('only the pitch is walkable; stands, banner, barrier and bunting are scenery', () => {
    expect(MAP_WALKABLE.has('F')).toBe(true);
    for (const ch of 'MNEBw') expect(MAP_WALKABLE.has(ch), ch).toBe(false);
    for (const ch of ARENA_TILES) expect(MAP_LEGEND[ch], ch).toBeDefined();
  });

  it('animates the crowd, the banner and the bunting; the two crowds never cheer in step', () => {
    for (const ch of 'MNEw') {
      const seen = new Set(Array.from({ length: 200 }, (_, t) => mapTileFrame(ch, t)));
      expect(seen.size, ch).toBeGreaterThan(1);
    }
    expect(mapTileFrame('F', 99)).toBe('arena-floor');
    expect(mapTileFrame('B', 99)).toBe('arena-wall');
    const inStep = Array.from({ length: 400 }, (_, t) => t).filter(
      (t) => mapTileFrame('M', t).slice(-1) === mapTileFrame('N', t).slice(-1),
    );
    expect(inStep.length).toBeLessThan(400);
  });

  it('the pitch tile is a seamless checkerboard of the ground main and light colours', () => {
    const floor = mapDef.frames['arena-floor'] as readonly string[];
    expect(floor).toHaveLength(16);
    const square = (x: number, y: number) => {
      const n = new Map<string, number>();
      for (let dy = 0; dy < 8; dy++)
        for (let dx = 0; dx < 8; dx++) {
          const c = floor[y + dy]?.[x + dx] as string;
          n.set(c, (n.get(c) ?? 0) + 1);
        }
      return [...n].sort((a, b) => b[1] - a[1])[0]?.[0];
    };
    expect([square(0, 0), square(8, 0), square(0, 8), square(8, 8)]).toEqual(['2', '3', '3', '2']);
  });

  it('crowd and bunting tiles repeat seamlessly side by side', () => {
    for (const name of ['arena-crowd-a-0', 'arena-crowd-b-2', 'arena-bunting-0', 'arena-bunting-1']) {
      const rows = mapDef.frames[name] as readonly string[];
      // The bunting's rope meets itself across the seam; the stands' steps line up.
      for (let y = 0; y < 16; y++) {
        const [l, r] = [rows[y]?.[0], rows[y]?.[15]];
        if (name.startsWith('arena-bunting') && (l === 'c' || r === 'c'))
          expect(l, `${name} row ${y}`).toBe(r);
        if (name.startsWith('arena-crowd') && y % 8 >= 5) expect(l, `${name} row ${y}`).toBe(r);
      }
    }
  });

  it('draws the light tower and the scoreboard, animated and inside their bounds', () => {
    expect(MAP_ACTOR_TYPES).toEqual(expect.arrayContaining(['light-tower', 'scoreboard']));
    const assets = registry();
    const size: Record<string, [number, number]> = { 'light-tower': [16, 48], scoreboard: [48, 32] };
    for (const type of ['light-tower', 'scoreboard']) {
      const a: MapActor = { type, x: 96, y: 64, props: {} };
      const [x0, y0, x1, y1] = mapActorBounds(a);
      const [w, h] = size[type] as [number, number];
      expect([x1 - x0, y1 - y0], type).toEqual([w, h]);
      const r = new CheckingRenderer();
      for (let t = 0; t < 1200; t += 4) drawMapActor(r, assets, page, a, t);
      expect(new Set(r.drawn.map((d) => d.frame)).size, `${type} animates`).toBe(2);
      for (const d of r.drawn) expect([d.x, d.y], type).toEqual([x0, y0]);
      // Slow enough never to read as flashing: each look holds for at least half a second.
      let run = 0;
      let shortest = Infinity;
      let last = '';
      for (let t = 0; t < 1200; t++) {
        const rr = new CheckingRenderer();
        drawMapActor(rr, assets, page, a, t);
        const f = rr.drawn[0]?.frame ?? '';
        if (f !== last && last) {
          shortest = Math.min(shortest, run);
          run = 0;
        }
        last = f;
        run++;
      }
      expect(shortest, type).toBeGreaterThanOrEqual(24);
    }
  });
});

describe('arena pad icons', () => {
  const PADS = ['map-arena-game', 'map-arena-tutorial', 'map-arena-locked'];
  const frame = (id: string) => mapIconFrames[id] as readonly string[];
  const colours = (rows: readonly string[]) => new Set(rows.join('').replace(/\./g, ''));

  it('are 16×16 frames on the items sheet sharing one pad outline', () => {
    for (const id of PADS) {
      const f = frame(id);
      expect(f, id).toHaveLength(16);
      for (const row of f) expect(row, id).toHaveLength(16);
      expect(SPRITES.items?.frames[id], id).toBe(f);
      for (let y = 10; y < 16; y++)
        for (let x = 0; x < 16; x++)
          expect(f[y]?.[x] === '.', `${id} ${x},${y}`).toBe(frame(PADS[0] as string)[y]?.[x] === '.');
    }
  });

  it('the game pad is a gold trophy on red; the tutorial a cream signpost on blue', () => {
    const game = colours(frame('map-arena-game'));
    for (const c of '0258') expect(game.has(c), `game '${c}'`).toBe(true);
    const tutorial = colours(frame('map-arena-tutorial'));
    for (const c of '039e') expect(tutorial.has(c), `tutorial '${c}'`).toBe(true);
  });

  it('the locked pad is dark: only black, grey and its question mark, no bright colours', () => {
    expect([...colours(frame('map-arena-locked'))].sort()).toEqual(['0', 'b']);
  });

  it('the Return pad reuses the hub warp pad', () => {
    expect(mapIconFrames['map-warp']).toBeDefined();
  });
});
