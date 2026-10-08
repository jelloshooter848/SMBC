import type { MapNode, WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/**
 * World 4, PLANET ZEBES (0.4.27, owner notes 5, 18 and 21: each world is themed after the hero
 * freed there; World 4 is Samus's): a Metroid-style planet map. Samus's gunship stands landed
 * by the start, rock spires and alien plants cover the mauve crags, lava pools and a lava lake
 * steam, a Chozo statue sits beside 4-2 and Tourian's glass dome rises over the castle. Every
 * node and road is where MUSHROOM WOODS had them, the airship's crash site (the bonus spot) on
 * plain ground.
 */
export const SKETCH_4 = [
  '................',
  '................',
  'hhhhhhhhhhhhhhhh',
  '#######Λ#ψ#Λ┌┬┐Λ', // Tourian's glass dome...
  'Λ#«»#ψ##abdf└┴┘#', // ...over its gate, 4-4's castle node below; the gunship by the start
  '###ψ###Λgilm####',
  '####Λ###prtv#ψ##', // the lava lake (no spire under the seal at 15,6)
  'Λ##ψ#####Λ####Λ#', // a Zoomer's spire by the lava lake
  '#ψ###Λ####ψ###Λ#',
  'Λ#####ψ#####Λ##ψ',
  '#ψ###χ##Λ#####Λ#', // the Chozo statue beside 4-2 (plain ground left of 4-2: Samus's map hint)
  'Λ#############ψ#',
  '#####ψ##LL##Λ#ψ#', // a lava pool
  'ψ#####Λ#LL#Λ#ψ#Λ', // and another's by the pool
  '#Λ##ψ#########Λ#',
];

export const WORLD_4: WorldMapPage = {
  id: 'smb-4',
  group: 'smb',
  label: 'WORLD 4',
  title: 'PLANET ZEBES',
  theme: 'zebes',
  music: 'map',
  tiles: autoShore(SKETCH_4),
  // The bonus spot (0.5.0): found with Larry Koopa's crystal ball in 4-2's airship (secret
  // 'larry', a secret exit of 4-2), guarded by a wandering Hammer Bro once used (map/hammer-bro.ts).
  nodes: worldNodes(
    4,
    [0, 6],
    [
      [4, 3],
      [4, 11],
      [10, 11],
      [13, 5],
    ],
    [2, 13],
  ).map((n): MapNode => (n.kind === 'bonus' ? { ...n, unlock: 'larry', guard: 'hammer-bro' } : n)),
  paths: [
    { from: 'start', to: '4-1', points: poly([0, 6], [1, 6], [1, 3], [4, 3]) },
    { from: '4-1', to: '4-2', points: poly([4, 3], [6, 3], [6, 7], [4, 7], [4, 11]) },
    { from: '4-2', to: '4-3', points: poly([4, 11], [7, 11], [7, 9], [10, 9], [10, 11]) },
    { from: '4-3', to: '4-4', points: poly([10, 11], [13, 11], [13, 8], [12, 8], [12, 5], [13, 5]) },
    { from: '4-2', to: 'bonus-4', exit: 'secret:larry', points: poly([4, 11], [4, 13], [2, 13]) },
  ],
  exits: [{ from: '4-4', to: 'smb-5', side: 'right', points: poly([13, 5], [15, 5]), gate: 'samus' }],
  // Zebes's creatures: Zoomers crawling round the spires, Rippers gliding, a Metroid by Tourian.
  actors: [
    actor('cloud', 72, 18, { size: 1, speed: 0.05 }),
    actor('zoomer', 144, 112, { size: 16, speed: 0.25 }),
    actor('zoomer', 176, 208, { size: 16, speed: 0.2, phase: 140 }),
    actor('ripper', 16, 32, { range: 64, speed: 0.3 }),
    actor('ripper', 96, 224, { range: 64, speed: 0.25, phase: 90 }),
    actor('metroid', 150, 38, { phase: 0 }),
  ],
};
