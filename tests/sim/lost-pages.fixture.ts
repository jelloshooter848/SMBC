import type { MapNode, MapPath, WorldExit, WorldMapPage } from '@game/map/types';
import { autoShore } from '@content/worldmap/build';

/*
 * Stand-in Lost Levels pages for the campaign sims (lost-campaign.test.ts), following the page
 * contract (docs/WORLD_MAP.md): 'll-1'..'ll-13', group 'll', level node ids equal to the level
 * ids, castle exits to the next page ('ll-8-4' → 'll-9' requiring 'll9'; none from 'll-9' or
 * 'll-13'), and on 'll-8' a warp node to 'll-10' requiring 'llLetters' on a road from the castle.
 */

const TILES = autoShore([
  '................',
  '................',
  '~~~~~~~~~~~~~~~~',
  '################',
  '################',
  '################',
  '################',
  '################',
  '################',
  '################',
  '################',
  '################',
  '################',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~',
]);

const LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D'];

function row(x0: number, x1: number, y: number): [number, number][] {
  const out: [number, number][] = [];
  for (let x = x0; x <= x1; x++) out.push([x, y]);
  return out;
}

function lostPage(w: number): WorldMapPage {
  const lv = (s: number) => `ll-${w}-${s}`;
  const nodes: MapNode[] = [{ id: 'start', kind: 'start', x: 1, y: 8 }];
  const paths: MapPath[] = [];
  let prev = 'start';
  for (let s = 1; s <= 4; s++) {
    const x = 1 + s * 2;
    nodes.push({ id: lv(s), kind: s === 4 ? 'castle' : 'level', level: lv(s), x, y: 8 });
    paths.push({ from: prev, to: lv(s), points: row(x - 2, x, 8) });
    prev = lv(s);
  }
  const exits: WorldExit[] = [];
  const next = w === 8 ? 9 : w === 9 || w === 13 ? 0 : w + 1;
  if (next)
    exits.push({
      from: lv(4),
      to: `ll-${next}`,
      side: 'right',
      points: row(9, 15, 8),
      ...(w === 8 ? { requires: 'll9' as const } : {}),
    });
  if (w === 8) {
    nodes.push({
      id: 'lost-a',
      kind: 'warp',
      x: 9,
      y: 11,
      to: 'll-10',
      requires: 'llLetters',
      label: 'LOST A',
      hint: 'LOST A - BEAT 8 GAMES',
    });
    paths.push({
      from: lv(4),
      to: 'lost-a',
      points: [
        [9, 8],
        [9, 9],
        [9, 10],
        [9, 11],
      ],
    });
  }
  return {
    id: `ll-${w}`,
    group: 'll',
    label: `LOST ${LABELS[w - 1]}`,
    title: 'LOST LEVELS',
    theme: 'grass',
    music: 'map',
    tiles: TILES,
    nodes,
    paths,
    exits,
    actors: [],
  };
}

export const LOST_FIXTURE_PAGES: WorldMapPage[] = Array.from({ length: 13 }, (_, i) => lostPage(i + 1));
