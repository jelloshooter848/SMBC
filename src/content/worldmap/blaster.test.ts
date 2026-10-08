import { describe, expect, it } from 'vitest';
import { mapPalettes } from '@content/sprites/map';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { heroSide, hiddenHeroesAt } from '@game/map/captives';
import { localSpot, welcomeOf } from '@game/map/world-gate';
import { WORLD_8, SKETCH_8 } from './world8';
import { MAP_ACTOR_TYPES, MAP_WALKABLE, drawMapActor, mapActorBounds, mapSky, pageTileFrame } from './render';

/*
 * World 8's map page as Sophia's world (0.4.31, owner notes 5, 18 and 21: each world, its map page
 * and every level in it, is themed after the hero freed there). Blaster Master's Underworld has
 * broken into Bowser's land: BOWSER'S UNDERWORLD. Bowser's castle and the lava sea stay at 8-4 (the
 * real castle, Chapter 1's finale); the rest is the Underworld's surface: the radioactive pit Jason
 * fell through, cavern mouths, the forest and stone ruins of its first area, Sophia's garage and
 * mutant critters. Every node, road, the seal, the start's local, Sophia's silhouette and the rift
 * gate are where BOWSER'S LAND had them.
 */

const at = (x: number, y: number) => SKETCH_8[y]?.[x];
const node = (id: string) => WORLD_8.nodes.find((n) => n.id === id)!;
const SCENERY = '╭╮╰╯∩Ш⌂';
const count = (ch: string) => [...SKETCH_8.join('')].filter((c) => c === ch).length;
const registry = () => {
  const a = new AssetRegistry(PALETTES);
  a.defineAll(SPRITES);
  return a;
};

/** Every sprite `actor` draws over `frames` frames, as `sheet frame x y`. */
function drawn(
  actor: (typeof WORLD_8.actors)[number],
  frames: number,
): { f: string; x: number; y: number }[] {
  const a = registry();
  const out: { f: string; x: number; y: number }[] = [];
  const r = Object.assign(new NullRenderer(), {
    sprite(s: SpriteSheet, frame: string, x: number, y: number) {
      out.push({ f: `${s.id} ${frame}`, x, y });
    },
  });
  for (let t = 0; t < frames; t += 3) drawMapActor(r, a, WORLD_8, actor, t);
  return out;
}

/** The top-left of the first `rows` block (rows stacked one under the other) in the sketch. */
function find(...rows: string[]): [number, number] {
  for (let y = 0; y < SKETCH_8.length; y++)
    for (let x = 0; x < 16; x++)
      if (rows.every((r, k) => SKETCH_8[y + k]?.slice(x, x + r.length) === r)) return [x, y];
  return [-1, -1];
}

describe("World 8: BOWSER'S UNDERWORLD", () => {
  it("is the blaster theme, titled BOWSER'S UNDERWORLD, in its own palette and dim sky", () => {
    expect(WORLD_8.theme).toBe('blaster');
    expect(WORLD_8.title).toBe("BOWSER'S UNDERWORLD");
    expect(mapPalettes['map-blaster']).toHaveLength(28);
    // Bowser's lava sea keeps the lava's colours
    expect(mapPalettes['map-blaster']!.slice(6, 10)).toEqual(mapPalettes['map-bowser']!.slice(6, 10));
    expect(mapSky(WORLD_8)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("keeps every node, road, the rift gate and the seal where BOWSER'S LAND had them", () => {
    expect(WORLD_8.nodes.map((n) => [n.id, n.x, n.y])).toEqual([
      ['start', 0, 10],
      ['8-1', 3, 6],
      ['8-2', 7, 11],
      ['8-3', 9, 6],
      ['8-4', 14, 5],
      ['bonus-8', 4, 13],
    ]);
    expect(WORLD_8.paths.map((p) => `${p.from}>${p.to}:${p.points.length}`)).toEqual([
      'start>8-1:8',
      '8-1>8-2:10',
      '8-2>8-3:8',
      '8-3>8-4:7',
      '8-2>bonus-8:6',
    ]);
    expect(WORLD_8.exits).toEqual([
      expect.objectContaining({ from: '8-4', to: 'll-1', side: 'right', gate: 'sophia' }),
    ]);
    for (const p of [...WORLD_8.paths, ...WORLD_8.exits])
      for (const [x, y] of p.points) expect(MAP_WALKABLE.has(WORLD_8.tiles[y]![x]!), `${x},${y}`).toBe(true);
  });

  it("Bowser's castle and the lava stay at 8-4", () => {
    const c4 = node('8-4');
    expect(at(c4.x, c4.y)).toBe('G');
    expect(SKETCH_8.slice(2, 6).map((r) => r.slice(10, 15))).toEqual(['.V.V.', 'VWVWV', 'WWWWW', 'WWWWG']);
    for (let y = 9; y < SKETCH_8.length; y++) expect(SKETCH_8[y]!.slice(10), `row ${y}`).toBe('~~~~~~');
  });

  it("draws the Underworld's surface: the pit, cavern mouths, ruins, the forest, Sophia's garage", () => {
    // the radioactive pit Jason fell through, a 2x2 hole, off the roads
    const [px, py] = find('╭╮', '╰╯');
    expect(px).toBeGreaterThanOrEqual(0);
    expect(count('╭')).toBe(1);
    expect(pageTileFrame(WORLD_8, '╭', 0)).toBe('pit-0');
    expect(pageTileFrame(WORLD_8, '╯', 0)).toBe('pit-3');
    expect(Math.abs(px - node('8-1').x) + Math.abs(py - node('8-1').y)).toBeLessThanOrEqual(5);
    // cavern mouths and stone ruins scattered about
    expect(count('∩')).toBeGreaterThanOrEqual(3);
    expect(count('Ш')).toBeGreaterThanOrEqual(3);
    // the forest: the theme's own gnarled trees
    expect(count('T')).toBeGreaterThanOrEqual(10);
    expect(pageTileFrame(WORLD_8, 'T', 0)).toBe('bm-tree');
    // Sophia's garage, near 8-4 (she waits under the castle)
    const all = SKETCH_8.join('');
    const g = all.indexOf('⌂');
    expect(g).toBeGreaterThanOrEqual(0);
    expect(Math.abs((g % 16) - node('8-4').x) + Math.abs(Math.floor(g / 16) - node('8-4').y)).toBeLessThanOrEqual(5);
    // nothing new is walkable, and nothing on the page animates (no flashing)
    for (const ch of SCENERY) {
      expect(MAP_WALKABLE.has(ch), ch).toBe(false);
      expect(pageTileFrame(WORLD_8, ch, 0), ch).toBe(pageTileFrame(WORLD_8, ch, 37));
    }
  });

  it("leaves Sophia's silhouette, the local (the turnip clue) and the seal where they were", () => {
    const n = WORLD_8.nodes.find((x) => hiddenHeroesAt('smb-8', x.id).some((h) => h.hero === 'sophia'))!;
    expect(n.id).toBe('8-4');
    const side = heroSide(WORLD_8, n);
    expect([at(n.x + side, n.y), at(n.x + side, n.y - 1)]).toEqual(['W', 'W']);
    const spot = localSpot(WORLD_8)!;
    expect(at(Math.floor(spot.x / 16), Math.floor((spot.y + 19) / 16))).toBe('#');
    expect(welcomeOf('smb-8')?.local).toBe('MINER');
    const seal = WORLD_8.exits[0]!.points.at(-1)!;
    expect(at(seal[0], seal[1])).toBe('#');
  });

  it("its critters are the Underworld's mutants; Bowser's podoboos and flags stay at his castle", () => {
    const types = WORLD_8.actors.map((a) => a.type);
    for (const t of ['mutant-hopper', 'mutant-flyer']) {
      expect(MAP_ACTOR_TYPES as readonly string[], t).toContain(t);
      expect(types, t).toContain(t);
    }
    for (const t of ['podoboo', 'flag']) expect(types, t).toContain(t);
    for (const t of ['smoke', 'bullet']) expect(types, t).not.toContain(t);
    for (const a of WORLD_8.actors) {
      const [x0, y0, x1, y1] = mapActorBounds(a);
      expect(x1 > x0 && y1 > y0, a.type).toBe(true);
      expect(y0, `${a.type} under the header`).toBeGreaterThanOrEqual(24);
    }
  });

  it('a mutant hopper hops back and forth on the ground, in its bounds', () => {
    const hop = WORLD_8.actors.find((x) => x.type === 'mutant-hopper')!;
    const [x0, y0, x1, y1] = mapActorBounds(hop);
    const d = drawn(hop, 1200);
    expect(new Set(d.map((s) => s.f))).toEqual(new Set(['sophia hopper-0', 'sophia hopper-1']));
    const xs = d.map((s) => s.x);
    const ys = d.map((s) => s.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(12);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(4);
    for (const s of d)
      expect(s.x >= x0 && s.x + 16 <= x1 && s.y >= y0 && s.y + 16 <= y1, `${s.x},${s.y}`).toBe(true);
  });

  it('a mutant flyer crosses the page in a wave and comes round again', () => {
    const fly = WORLD_8.actors.find((x) => x.type === 'mutant-flyer')!;
    const [x0, y0, x1, y1] = mapActorBounds(fly);
    const d = drawn(fly, 1200);
    expect(new Set(d.map((s) => s.f))).toEqual(new Set(['sophia flyer-0', 'sophia flyer-1']));
    expect(new Set(d.map((s) => s.x)).size).toBeGreaterThan(50);
    for (const s of d)
      expect(s.x >= x0 - 16 && s.x <= x1 && s.y >= y0 && s.y + 16 <= y1, `${s.x},${s.y}`).toBe(true);
  });
});
