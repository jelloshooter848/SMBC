import type { WorldMapPage } from '@game/map/types';
import { autoShore } from '../build';

/** PLACEHOLDER Lost Levels World 1: a single start node (the Lost Levels pages pass replaces it). */
export const LOST_1: WorldMapPage = {
  id: 'll-1',
  group: 'll',
  label: 'LOST 1',
  title: 'LOST LEVELS',
  theme: 'grass',
  music: 'map',
  tiles: autoShore([
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
  ]),
  nodes: [{ id: 'start', kind: 'start', x: 2, y: 8 }],
  paths: [],
  exits: [],
  actors: [],
};
