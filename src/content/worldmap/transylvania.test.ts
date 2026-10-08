import { describe, expect, it } from 'vitest';
import { mapPalettes } from '@content/sprites/map';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { heroSide } from '@game/map/captives';
import { localSpot } from '@game/map/world-gate';
import { WORLD_5, SKETCH_5 } from './world5';
import { MAP_ACTOR_TYPES, MAP_WALKABLE, drawMapActor, mapActorBounds, mapSky, pageTileFrame } from './render';

/*
 * World 5's map page as Simon's world (0.4.28, owner notes 5, 18 and 21: each world, its map page
 * and every level in it, is themed after the hero freed there). The page keeps SKY TREES' nodes,
 * roads, bridges, the seal, the start and its local; its land is a Castlevania-style night:
 * TRANSYLVANIA, a village by the start, a graveyard, a dead forest, a moonlit lake and river
 * under the bridges, the clock tower by 5-3 and Dracula's castle on its crag at 5-4; bats, Medusa
 * heads drifting in waves and ravens for critters.
 */

const at = (x: number, y: number) => SKETCH_5[y]?.[x];
const node = (id: string) => WORLD_5.nodes.find((n) => n.id === id)!;
const SCENERY = 'ĦΩ║╔╦╗╚╩╝';
const registry = () => {
  const a = new AssetRegistry(PALETTES);
  a.defineAll(SPRITES);
  return a;
};

/** Every sprite `actor` draws over `frames` frames, as `sheet frame x y`. */
function drawn(actor: (typeof WORLD_5.actors)[number], frames: number): { f: string; x: number; y: number }[] {
  const a = registry();
  const out: { f: string; x: number; y: number }[] = [];
  const r = Object.assign(new NullRenderer(), {
    sprite(s: SpriteSheet, frame: string, x: number, y: number) {
      out.push({ f: `${s.id} ${frame}`, x, y });
    },
  });
  for (let t = 0; t < frames; t += 3) drawMapActor(r, a, WORLD_5, actor, t);
  return out;
}

describe('World 5: TRANSYLVANIA', () => {
  it('is the transylvania theme, titled TRANSYLVANIA, in its own palette and night sky', () => {
    expect(WORLD_5.theme).toBe('transylvania');
    expect(WORLD_5.title).toBe('TRANSYLVANIA');
    expect(mapPalettes['map-transylvania']).toHaveLength(28);
    expect(mapSky(WORLD_5)).toMatch(/^#[0-9a-f]{6}$/);
    expect(mapSky(WORLD_5)).not.toBe('#5c94fc'); // never SKY TREES' daylight
  });

  it('keeps every node, road, bridge, the exit and the seal where SKY TREES had them', () => {
    expect(WORLD_5.nodes.map((n) => [n.id, n.x, n.y])).toEqual([
      ['start', 0, 5],
      ['5-1', 8, 4],
      ['5-2', 13, 5],
      ['5-3', 12, 9],
      ['5-4', 14, 11],
      ['bonus-5', 7, 10],
    ]);
    expect(WORLD_5.paths.map((p) => `${p.from}>${p.to}:${p.points.length}`)).toEqual([
      'start>5-1:10',
      '5-1>5-2:7',
      '5-2>5-3:8',
      '5-3>5-4:5',
      '5-1>bonus-5:8',
    ]);
    expect(WORLD_5.exits).toEqual([
      expect.objectContaining({ from: '5-4', to: 'smb-6', side: 'right', gate: 'simon' }),
    ]);
    // the bridges over the river and the lake
    for (const [x, y] of [
      [4, 5],
      [5, 5],
      [10, 4],
      [8, 8],
      [8, 9],
      [14, 7],
      [14, 8],
    ] as const)
      expect('=I', `${x},${y}`).toContain(at(x, y));
  });

  it("draws Transylvania: a village, graves, a dead forest, a moonlit lake, the clock tower, Dracula's castle", () => {
    const all = SKETCH_5.join('');
    expect(all.match(/Ħ/g)?.length).toBeGreaterThanOrEqual(3); // the village
    expect(all.match(/J/g)?.length).toBeGreaterThanOrEqual(4); // the graveyard
    expect(all.match(/T/g)?.length).toBeGreaterThanOrEqual(8); // the dead forest
    expect(all.match(/~/g)?.length).toBeGreaterThanOrEqual(30); // the lake and the river
    expect(all).toContain('D'); // the moon
    expect(all).not.toMatch(/[{}|\-*]/); // no treetops, trunks in the sea or flowers left
    // the trees are dead trees here
    expect(pageTileFrame(WORLD_5, 'T', 0)).toBe('dead-tree');
    // the clock tower stands by 5-3: its clock over its base
    const c3 = node('5-3');
    const tower = all.indexOf('Ω');
    const [tx, ty] = [tower % 16, Math.floor(tower / 16)];
    expect(at(tx, ty + 1)).toBe('║');
    expect(Math.max(Math.abs(tx - c3.x), Math.abs(ty - c3.y))).toBeLessThanOrEqual(2);
    // Dracula's castle stands on its crag right at 5-4: its towers, then its walls and gate
    const c = node('5-4');
    const castle = all.indexOf('╔╦╗');
    const [cx, cy] = [castle % 16, Math.floor(castle / 16)];
    expect([at(cx, cy + 1), at(cx + 1, cy + 1), at(cx + 2, cy + 1)].join('')).toBe('╚╩╝');
    expect(Math.abs(cx + 1 - c.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(cy - c.y)).toBe(1);
    // none of the new scenery is walkable, and no road runs over it
    for (const ch of SCENERY) expect(MAP_WALKABLE.has(ch), ch).toBe(false);
  });

  it("leaves Simon's map hint (the crystal ball's silhouette), the local and the seal on plain ground", () => {
    const n = node('5-4');
    const side = heroSide(WORLD_5, n);
    expect([at(n.x + side, n.y), at(n.x + side, n.y - 1)]).toEqual(['#', '#']);
    const spot = localSpot(WORLD_5)!;
    expect(at(Math.floor(spot.x / 16), Math.floor((spot.y + 19) / 16))).toBe('#');
    const seal = WORLD_5.exits[0]!.points.at(-1)!;
    expect(at(seal[0], seal[1])).toBe('#');
  });

  it('its critters are bats, Medusa heads and ravens; no Bullet Bills or Paratroopas', () => {
    const types = WORLD_5.actors.map((a) => a.type);
    for (const t of ['bat', 'medusa', 'raven']) {
      expect(MAP_ACTOR_TYPES as readonly string[], t).toContain(t);
      expect(types, t).toContain(t);
    }
    for (const t of ['bullet', 'paratroopa', 'cloud']) expect(types, t).not.toContain(t);
    for (const a of WORLD_5.actors) {
      const [x0, y0, x1, y1] = mapActorBounds(a);
      expect(x1 > x0 && y1 > y0, a.type).toBe(true);
    }
  });

  it("a bat flaps (Simon's crypt's bat) and stays in its bounds", () => {
    const bat = WORLD_5.actors.find((x) => x.type === 'bat')!;
    const [x0, y0, x1, y1] = mapActorBounds(bat);
    const d = drawn(bat, 600);
    expect(new Set(d.map((s) => s.f))).toEqual(new Set(['crypt@crypt bat-1', 'crypt@crypt bat-2']));
    for (const s of d) expect(s.x >= x0 && s.x + 16 <= x1 && s.y >= y0 && s.y + 16 <= y1, `${s.x},${s.y}`).toBe(true);
  });

  it('Medusa heads drift across the page in waves, wrapping round, never into the header', () => {
    const medusa = WORLD_5.actors.filter((x) => x.type === 'medusa');
    expect(medusa.length).toBeGreaterThanOrEqual(2);
    const d = drawn(medusa[0]!, 2400);
    expect(new Set(d.map((s) => s.f))).toEqual(new Set(['crypt@crypt medusa-0', 'crypt@crypt medusa-1']));
    const ys = d.map((s) => s.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(16); // a wave, not a line
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(24);
    const xs = d.map((s) => s.x);
    expect(Math.min(...xs)).toBeLessThan(0); // it crosses the whole page...
    expect(Math.max(...xs)).toBeGreaterThan(240); // ...and comes round again
  });

  it('a raven flaps its wings (the map sheet\'s raven)', () => {
    const raven = WORLD_5.actors.find((x) => x.type === 'raven')!;
    const d = drawn(raven, 600);
    expect(new Set(d.map((s) => s.f))).toEqual(
      new Set(['map@map-transylvania raven-0', 'map@map-transylvania raven-1']),
    );
  });
});
