import type { MapNode, MapPath, WorldMapPage } from '@game/map/types';

/*
 * PLACEHOLDER pages (a straight road per world), replaced by the real themed pages. Every page
 * has: a 'start' node, nodes for levels W-1..W-3 (kind 'level') and W-4 (kind 'castle'), paths
 * between consecutive nodes, an exit from the castle to the next world (World 8: none), and one
 * hidden bonus node with an unlock key.
 */
const THEMES = ['grass', 'sea', 'night', 'mushroom', 'sky', 'snow', 'coast', 'bowser'] as const;

function placeholder(world: number): WorldMapPage {
  const y = 7;
  const xs = [1, 4, 7, 10, 13];
  const nodes: MapNode[] = [
    { id: 'start', kind: 'start', x: xs[0] as number, y },
    ...[1, 2, 3, 4].map((s): MapNode => ({
      id: `${world}-${s}`,
      kind: s === 4 ? 'castle' : 'level',
      level: `${world}-${s}`,
      x: xs[s] as number,
      y,
    })),
    { id: `bonus-${world}`, kind: 'bonus', x: 7, y: 11, unlock: `bonus-${world}` },
  ];
  const line = (a: number, b: number): [number, number][] =>
    Array.from({ length: b - a + 1 }, (_, i): [number, number] => [a + i, y]);
  const paths: MapPath[] = [];
  for (let s = 0; s < 4; s++) {
    const from = s === 0 ? 'start' : `${world}-${s}`;
    paths.push({ from, to: `${world}-${s + 1}`, points: line(xs[s] as number, xs[s + 1] as number) });
  }
  paths.push({
    from: `${world}-2`,
    to: `bonus-${world}`,
    points: [7, 8, 9, 10, 11].map((yy): [number, number] => [7, yy]),
  });
  return {
    world,
    title: `WORLD ${world}`,
    theme: THEMES[world - 1] ?? 'grass',
    music: 'title',
    tiles: Array.from({ length: 15 }, (_, row) => (row >= 12 ? '#'.repeat(16) : '.'.repeat(16))),
    nodes,
    paths,
    exits:
      world < 8
        ? [
            {
              from: `${world}-4`,
              toWorld: world + 1,
              side: 'right',
              points: [
                [13, y],
                [14, y],
                [15, y],
              ],
            },
          ]
        : [],
    actors: [],
  };
}

export const MAP_PAGES: WorldMapPage[] = [1, 2, 3, 4, 5, 6, 7, 8].map(placeholder);

export function mapPage(world: number): WorldMapPage | undefined {
  return MAP_PAGES.find((p) => p.world === world);
}
