import { describe, expect, it } from 'vitest';
import { mapPalettes } from '@content/sprites/map';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { heroSide, hiddenHeroesAt } from '@game/map/captives';
import { localSpot } from '@game/map/world-gate';
import { WORLD_7, SKETCH_7 } from './world7';
import { MAP_ACTOR_TYPES, MAP_WALKABLE, drawMapActor, mapActorBounds, mapSky, pageTileFrame } from './render';

/*
 * World 7's map page as Bill's world (0.4.30, owner notes 5, 18 and 21: each world, its map page
 * and every level in it, is themed after the hero freed there). The page keeps CANNON COAST's
 * nodes, roads, the seal, the start and its local; its land is a Contra-style jungle island:
 * GALUGA ISLAND, a snowfield with pillboxes round 7-1, the enemy base and its defense wall beside
 * it, the jungle round 7-2, cliffs and a waterfall over 7-3 with its river below, the energy zone
 * on the road to 7-4 and Red Falcon's alien lair over 7-4; flying weapon capsules, running
 * soldiers and a helicopter for critters.
 */

const at = (x: number, y: number) => SKETCH_7[y]?.[x];
const node = (id: string) => WORLD_7.nodes.find((n) => n.id === id)!;
const SCENERY = '≡ЖΓΠΔΣΞΦ◤◆◥◣●◢';
const count = (ch: string) => [...SKETCH_7.join('')].filter((c) => c === ch).length;
const registry = () => {
  const a = new AssetRegistry(PALETTES);
  a.defineAll(SPRITES);
  return a;
};

/** Every sprite `actor` draws over `frames` frames, as `sheet frame x y`. */
function drawn(
  actor: (typeof WORLD_7.actors)[number],
  frames: number,
): { f: string; x: number; y: number }[] {
  const a = registry();
  const out: { f: string; x: number; y: number }[] = [];
  const r = Object.assign(new NullRenderer(), {
    sprite(s: SpriteSheet, frame: string, x: number, y: number) {
      out.push({ f: `${s.id} ${frame}`, x, y });
    },
  });
  for (let t = 0; t < frames; t += 3) drawMapActor(r, a, WORLD_7, actor, t);
  return out;
}

/** The top-left of the first `rows` block (rows stacked one under the other) in the sketch. */
function find(...rows: string[]): [number, number] {
  for (let y = 0; y < SKETCH_7.length; y++)
    for (let x = 0; x < 16; x++)
      if (rows.every((r, k) => SKETCH_7[y + k]?.slice(x, x + r.length) === r)) return [x, y];
  return [-1, -1];
}

describe('World 7: GALUGA ISLAND', () => {
  it('is the contra theme, titled GALUGA ISLAND, in its own palette and night sky', () => {
    expect(WORLD_7.theme).toBe('contra');
    expect(WORLD_7.title).toBe('GALUGA ISLAND');
    expect(mapPalettes['map-contra']).toHaveLength(28);
    expect(mapSky(WORLD_7)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps every node, road, the exit and the seal where CANNON COAST had them', () => {
    expect(WORLD_7.nodes.map((n) => [n.id, n.x, n.y])).toEqual([
      ['start', 0, 6],
      ['7-1', 4, 3],
      ['7-2', 7, 7],
      ['7-3', 11, 4],
      ['7-4', 12, 10],
      ['bonus-7', 5, 11],
    ]);
    expect(WORLD_7.paths.map((p) => `${p.from}>${p.to}:${p.points.length}`)).toEqual([
      'start>7-1:8',
      '7-1>7-2:8',
      '7-2>7-3:8',
      '7-3>7-4:12',
      '7-2>bonus-7:7',
    ]);
    expect(WORLD_7.exits).toEqual([
      expect.objectContaining({ from: '7-4', to: 'smb-8', side: 'right', gate: 'bill' }),
    ]);
    for (const p of [...WORLD_7.paths, ...WORLD_7.exits])
      for (const [x, y] of p.points) expect(MAP_WALKABLE.has(WORLD_7.tiles[y]![x]!), `${x},${y}`).toBe(true);
  });

  it("draws Bill's island: the snowfield, the base, the jungle, the falls and river, the energy zone, the lair", () => {
    const all = SKETCH_7.join('');
    // the snowfield round 7-1, its pillboxes among the drifts
    expect(count('o') + count('S') + count('j')).toBeGreaterThanOrEqual(8);
    expect(count('X')).toBeGreaterThanOrEqual(4);
    expect(pageTileFrame(WORLD_7, 'X', 0)).toBe('pillbox');
    // the jungle: palms and the theme's own jungle trees
    expect(count('Y') + count('T')).toBeGreaterThanOrEqual(10);
    expect(pageTileFrame(WORLD_7, 'T', 0)).toBe('jungle');
    // the enemy base and its defense wall beside 7-1: the wall's top over its gate
    const c1 = node('7-1');
    const [bx, by] = find('ΓΠΔ', 'ΣΞΦ');
    expect(bx).toBeGreaterThanOrEqual(0);
    expect(Math.abs(bx + 1 - c1.x) + Math.abs(by + 1 - c1.y)).toBeLessThanOrEqual(4);
    // the waterfall over 7-3, falling into the river
    const c3 = node('7-3');
    const falls = all.indexOf('≡');
    expect(falls).toBeGreaterThanOrEqual(0);
    const [fx, fy] = [falls % 16, Math.floor(falls / 16)];
    expect(Math.abs(fx - c3.x)).toBeLessThanOrEqual(4);
    expect(at(fx, fy + 1)).toBe('~');
    expect(pageTileFrame(WORLD_7, '≡', 0)).not.toBe(pageTileFrame(WORLD_7, '≡', 12));
    // the energy zone's pylons by the road from 7-3 to 7-4
    expect(count('Ж')).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < all.length; i++)
      if (all[i] === 'Ж') expect(Math.abs((i % 16) - 12), `pylon ${i}`).toBeLessThanOrEqual(3);
    // Red Falcon's lair over 7-4: its crown over its maw
    const c4 = node('7-4');
    const [lx, ly] = find('◤◆◥', '◣●◢');
    expect(lx).toBeGreaterThanOrEqual(0);
    expect(Math.abs(lx + 1 - c4.x)).toBeLessThanOrEqual(1);
    expect(c4.y - (ly + 1)).toBeGreaterThanOrEqual(1);
    expect(c4.y - (ly + 1)).toBeLessThanOrEqual(2);
    // none of the new scenery is walkable
    for (const ch of SCENERY) expect(MAP_WALKABLE.has(ch), ch).toBe(false);
  });

  it("leaves Bill's map hint (the crystal ball's silhouette), the local and the seal on plain ground", () => {
    const n = WORLD_7.nodes.find((x) => hiddenHeroesAt('smb-7', x.id).some((h) => h.hero === 'bill'))!;
    expect(n).toBeDefined();
    const side = heroSide(WORLD_7, n);
    expect([at(n.x + side, n.y), at(n.x + side, n.y - 1)]).toEqual(['#', '#']);
    expect(at(n.x, n.y - 1), 'the silhouette peeks out from behind the node').toBe('#');
    const spot = localSpot(WORLD_7)!;
    expect(at(Math.floor(spot.x / 16), Math.floor((spot.y + 19) / 16))).toBe('#');
    const seal = WORLD_7.exits[0]!.points.at(-1)!;
    expect(at(seal[0], seal[1])).toBe('#');
  });

  it('its critters are weapon capsules, running soldiers and a helicopter; no Cheeps, clouds or Hammer Bros', () => {
    const types = WORLD_7.actors.map((a) => a.type);
    for (const t of ['capsule', 'soldier', 'chopper']) {
      expect(MAP_ACTOR_TYPES as readonly string[], t).toContain(t);
      expect(types, t).toContain(t);
    }
    for (const t of ['cheep', 'cloud', 'hammer-bro']) expect(types, t).not.toContain(t);
    for (const a of WORLD_7.actors) {
      const [x0, y0, x1, y1] = mapActorBounds(a);
      expect(x1 > x0 && y1 > y0, a.type).toBe(true);
      expect(y0, `${a.type} under the header`).toBeGreaterThanOrEqual(24);
    }
  });

  it('a weapon capsule flies across in a wave, its wings beating, in its bounds', () => {
    const cap = WORLD_7.actors.find((x) => x.type === 'capsule')!;
    const [x0, y0, x1, y1] = mapActorBounds(cap);
    const d = drawn(cap, 1200);
    expect(new Set(d.map((s) => s.f))).toEqual(new Set(['map@map-contra capsule-0', 'map@map-contra capsule-1']));
    const ys = d.map((s) => s.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(6);
    for (const s of d)
      expect(s.x >= x0 && s.x + 16 <= x1 + 16 && s.y >= y0 && s.y + 16 <= y1, `${s.x},${s.y}`).toBe(true);
  });

  it('a soldier runs back and forth, in its bounds', () => {
    const sol = WORLD_7.actors.find((x) => x.type === 'soldier')!;
    const [x0, y0, x1, y1] = mapActorBounds(sol);
    const d = drawn(sol, 1200);
    expect(new Set(d.map((s) => s.f))).toEqual(new Set(['map@map-contra soldier-0', 'map@map-contra soldier-1']));
    const xs = d.map((s) => s.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(16);
    for (const s of d)
      expect(s.x >= x0 && s.x + 16 <= x1 && s.y >= y0 && s.y + 16 <= y1, `${s.x},${s.y}`).toBe(true);
  });

  it('a helicopter crosses the sky and comes round again, its rotor turning', () => {
    const heli = WORLD_7.actors.find((x) => x.type === 'chopper')!;
    const d = drawn(heli, 1200);
    expect(new Set(d.map((s) => s.f))).toEqual(new Set(['map@map-contra chopper-0', 'map@map-contra chopper-1']));
    expect(new Set(d.map((s) => s.y)).size).toBe(1);
    expect(new Set(d.map((s) => s.x)).size).toBeGreaterThan(50);
  });
});
