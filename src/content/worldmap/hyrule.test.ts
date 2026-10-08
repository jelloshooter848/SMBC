import { describe, expect, it } from 'vitest';
import { mapPalettes } from '@content/sprites/map';
import { heroSide } from '@game/map/captives';
import { localSpot } from '@game/map/world-gate';
import { WORLD_2, SKETCH_2 } from './world2';
import { mapSky } from './render';

/*
 * World 2's map page as Hyrule (0.4.24, owner notes 5, 18 and 21: each world, its map page and
 * every level in it, is themed after the hero freed there). The page keeps SEA SIDE's nodes, roads,
 * bonus spot, start and the healer's place; its land is a Zelda II overworld.
 */

const at = (x: number, y: number) => SKETCH_2[y]?.[x];
const node = (id: string) => WORLD_2.nodes.find((n) => n.id === id)!;

describe('World 2: HYRULE', () => {
  it('is the hyrule theme, titled HYRULE, in its own palette and periwinkle sky', () => {
    expect(WORLD_2.theme).toBe('hyrule');
    expect(WORLD_2.title).toBe('HYRULE');
    expect(mapPalettes['map-hyrule']).toHaveLength(28);
    expect(mapSky(WORLD_2)).toBe('#6888fc');
  });

  it('keeps every node, road and the exit where SEA SIDE had them', () => {
    expect(WORLD_2.nodes.map((n) => [n.id, n.x, n.y])).toEqual([
      ['start', 0, 10],
      ['2-1', 3, 6],
      ['2-2', 8, 11],
      ['2-3', 12, 8],
      ['2-4', 13, 4],
      ['bonus-2', 8, 4],
    ]);
    expect(node('bonus-2')).toMatchObject({ kind: 'bonus', level: '2-top-secret', unlock: 'bonus-2' });
    expect(WORLD_2.paths.map((p) => `${p.from}>${p.to}:${p.points.length}`)).toEqual([
      'start>2-1:8',
      '2-1>2-2:11',
      '2-2>2-3:8',
      '2-3>2-4:8',
      '2-1>bonus-2:8',
    ]);
    expect(WORLD_2.exits).toEqual([expect.objectContaining({ from: '2-4', to: 'smb-3', gate: 'link' })]);
  });

  it('draws a Zelda II overworld: mountains, forest, a lake, the palace over 2-4, ruins, graves', () => {
    const all = SKETCH_2.join('');
    expect(all.match(/\^/g)?.length).toBeGreaterThanOrEqual(10); // the northern range
    expect(all.match(/5/g)?.length).toBeGreaterThanOrEqual(20); // forests
    expect(all.match(/~/g)?.length).toBeGreaterThanOrEqual(20); // the lake and the sea
    // the palace stands right over the castle node: its roof, then columns and the door
    const c = node('2-4');
    expect([at(c.x - 1, c.y - 2), at(c.x, c.y - 2), at(c.x + 1, c.y - 2)].join('')).toBe('<U>');
    expect([at(c.x - 1, c.y - 1), at(c.x, c.y - 1), at(c.x + 1, c.y - 1)].join('')).toBe('Q@y');
    // stone ruins beside the hidden bonus spot (the Top Secret Area), graves by the start
    const b = node('bonus-2');
    expect([at(b.x + 1, b.y), at(b.x, b.y - 1)]).toEqual(['Z', 'Z']);
    expect(all.match(/J/g)?.length).toBeGreaterThanOrEqual(3);
    // 2-2 lies on the lake's shore, its bridge over the lake's outflow
    expect(at(8, 9)).toBe('~');
    expect(at(6, 11)).toBe('=');
  });

  it("leaves Link's map hint and the healer on plain ground", () => {
    const n = node('2-1');
    const side = heroSide(WORLD_2, n);
    expect(side).toBe(-1);
    expect([at(n.x + side, n.y), at(n.x + side, n.y - 1)]).toEqual(['#', '#']);
    const spot = localSpot(WORLD_2)!;
    expect(at(Math.floor(spot.x / 16), Math.floor((spot.y + 19) / 16))).toBe('#');
  });

  it("its critters are Hyrule's: blobs, a fairy, river creatures, no cheep cheeps", () => {
    const types = WORLD_2.actors.map((a) => a.type);
    for (const t of ['blob', 'fairy', 'zora']) expect(types, t).toContain(t);
    for (const t of ['cheep', 'koopa', 'bubble']) expect(types, t).not.toContain(t);
  });
});
