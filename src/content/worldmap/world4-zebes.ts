import type { MapProp, WorldMapPage } from '@game/map/types';
import { campaignLabel } from '@game/map/campaign-order';
import { actor, autoShore, poly } from './build';
import { WORLD_4 } from './world4';

/*
 * World 4 in campaign play (0.4.52, TD54's approved design): PLANET ZEBES drawn from above in the
 * 3/4 view of World 1's Mushroom Kingdom (world1-kingdom.ts), its regions where NES Metroid's own
 * map has them (sprites/zebes-above.ts). Classic play keeps WORLD_4 (world4.ts).
 *
 * Everything the save files key on is WORLD_4's own: the page id 'smb-4', its six node ids, kinds
 * and fields in the same order (4-2's secret exit, the bonus spot's 'larry' unlock and Hammer Bro
 * guard), the exit '4-4>smb-5' with Samus's gate, the start on the left edge on row 6 (World 3's
 * exit row) and the exit off the right edge on row 5 (World 5's start row).
 *
 * THE CAMPAIGN ORDER (map/campaign-order.ts): Samus is met in her cavern, internal 4-2, so it is
 * played FIRST and shown as "4-1"; internal 4-1 is second, shown as "4-2". The roads run start,
 * 4-2, 4-1, 4-3, 4-4 (new road ids); the bonus road keeps WORLD_4's '4-2>bonus-4' with its
 * 'secret:larry' exit (Larry's airship comes with internal 4-2's content).
 *
 * The route is Samus's own: from the gunship's landing crater down the ledge's stairs into Kraid's
 * lair (internal 4-2: Samus's cavern, the Chozo statue beside it, the bonus spot by Larry's wreck),
 * up Brinstar's long shaft to its head (internal 4-1), across into Norfair (4-3), up Norfair's
 * elevator to Brinstar's orange plateau and west past Kraid's and Ridley's statues into Tourian
 * (4-4); the exit is the escape: out of Tourian, up and east along Brinstar's top corridor.
 *
 * Tiles (above: 'zebes', drawn from the `zebes-above` sheet):
 *   .  under the header    #  ground (the region's own rock; shore chars too)    C  a cliff
 *   G  an elevator in a cliff (walkable)    L  lava    Λ  a rock pillar    ψ  a plant
 *   R  a boulder    P  a Tourian vent stack
 * ZONES (one letter a tile, the region): t Tourian, b Brinstar blue, o Brinstar orange,
 *   n Norfair, k Kraid's lair, r Ridley's lair, s the surface (the landing crater).
 */
export const SKETCH_4_ZEBES: readonly string[] = [
  '................',
  '................',
  '################', // Brinstar's top corridor: the escape road runs its length
  '##########ψ##ψ##',
  '#########Λ##Λ#Λ#', // Tourian (4-4) at the top left; Brinstar's orange pillars
  'P###############', // the road in from Norfair's elevator, past the statues
  '#######CCCCCCGCC', // the landing crater by the start; the orange plateau's cliff, its elevator
  '#######Λ#LL###LL', // Norfair: bubble stacks, lava pools
  '#########LL###LL', // Brinstar's corridor: internal 4-1 at the shaft's head
  'CCGCC#########LL', // stairs down the ledge into Kraid's lair
  'Λ###########ψ#LL', // internal 4-2 (shown 4-1) in Kraid's lair; Norfair's lava lake falls...
  '########CCCCCCCC', // ...over the cliff down to Ridley's lair
  '#######ψ####LLL#', // the Chozo by internal 4-2
  '############LLL#', // the bonus spot by the airship's wreck; Ridley's lava
  'R#ψ#############',
];

export const ZONES_4_ZEBES: readonly string[] = [
  'bbbbbbbooooooooo',
  'bbbbbbbooooooooo',
  'bbbbbbbooooooooo',
  'tttttbbooooooooo',
  'tttttbbooooooooo',
  'tttttbbooooooooo',
  'sssssbbooooooooo',
  'sssssbbnnnnnnnnn',
  'bbbbbbbnnnnnnnnn',
  'bbbbbbbnnnnnnnnn',
  'kkkkbbbnnnnnnnnn',
  'kkkkbbbbnnnnnnnn',
  'kkkkkkkrrrrrrrrr',
  'kkkkkkkrrrrrrrrr',
  'kkkkkkkrrrrrrrrr',
];

/** Landmarks: the gunship, the two statues before Tourian, a Zebetite, the Chozo, the wreck, Ridley's nest. */
export const PROPS_4_ZEBES: readonly MapProp[] = [
  { frame: 'gunship', x: 34, y: 94 }, // cols 2-5, rows 6-7: landed in the crater by the start
  { frame: 'statue-kraid', x: 76, y: 48 }, // the two statues guarding the way into Tourian
  { frame: 'statue-ridley', x: 108, y: 48 },
  { frame: 'zebetite', x: 0, y: 34 }, // Tourian's barrier columns, behind Mother Brain
  { frame: 'chozo', x: 0, y: 192 }, // by internal 4-2, below Samus's mark (her hint)
  // Larry's airship, down in Kraid's lair by the bonus spot: only once it has crashed there (the
  // bonus spot is built from it, map/airship-crash.ts), so not before Larry is beaten.
  { frame: 'wreck', x: 80, y: 206, node: 'bonus-4' },
  { frame: 'ridley-nest', x: 136, y: 204 }, // Ridley's lair, by its lava
  { frame: 'cannon-ring', x: 24, y: 64, flat: true },
];

const AT: Readonly<Record<string, [number, number]>> = {
  start: [0, 6], // the landing crater (World 4's local stands beside it, at 1,6-7)
  '4-2': [2, 11], // shown 4-1: Kraid's lair, Samus's cavern (its secret exit: Larry's airship);
  // Samus hides here: her silhouette or trophy stands on 1,11, kept clear (no road west of it)
  '4-1': [6, 8], // shown 4-2: Brinstar's corridor, at the head of its shaft
  '4-3': [11, 9], // Norfair, between the lava pools
  '4-4': [3, 4], // Tourian: Mother Brain's chamber
  'bonus-4': [4, 13], // Kraid's lair, by the airship's wreck
};

/** The roads in campaign order: start, internal 4-2, internal 4-1, 4-3, 4-4; the bonus off 4-2. */
const ROADS: readonly { from: string; to: string; points: [number, number][] }[] = [
  { from: 'start', to: '4-2', points: poly([0, 6], [0, 8], [2, 8], [2, 11]) }, // down the ledge's stairs
  { from: '4-2', to: '4-1', points: poly([2, 11], [5, 11], [5, 8], [6, 8]) }, // up Brinstar's shaft
  { from: '4-1', to: '4-3', points: poly([6, 8], [7, 8], [7, 10], [11, 10], [11, 9]) },
  { from: '4-3', to: '4-4', points: poly([11, 9], [13, 9], [13, 5], [3, 5], [3, 4]) },
  { from: '4-2', to: 'bonus-4', points: poly([2, 11], [2, 13], [4, 13]) },
];

const at = (id: string): [number, number] => {
  const p = AT[id];
  if (!p) throw new Error(`world4-zebes: no tile for node ${id}`);
  return p;
};

export const WORLD_4_ZEBES: WorldMapPage = {
  ...WORLD_4,
  // Drawn from above from the `zebes-above` sheet; the theme stays 'zebes'.
  above: 'zebes',
  tiles: autoShore(SKETCH_4_ZEBES),
  // Each tile's region, read by zebesGround.
  zones: ZONES_4_ZEBES,
  // WORLD_4's nodes in their order, each level with its campaign label (MapNode.shown).
  nodes: WORLD_4.nodes.map((n) => {
    const [x, y] = at(n.id);
    const shown = n.level ? campaignLabel(n.level) : undefined;
    return { ...n, x, y, ...(shown && shown !== n.level ? { shown } : {}) };
  }),
  // The bonus road keeps WORLD_4's fields (its 'secret:larry' exit); the others are new road ids.
  paths: ROADS.map((r) => {
    const main = WORLD_4.paths.find((p) => p.from === r.from && p.to === r.to);
    return { ...(main ?? { from: r.from, to: r.to }), points: r.points };
  }),
  // The escape: west out of Mother Brain's chamber, up, along the top corridor, down the far side
  // to row 5 (World 5's start row).
  exits: WORLD_4.exits.map((e) => ({ ...e, points: poly(at(e.from), [1, 4], [1, 2], [15, 2], [15, 5]) })),
  // Zebes's creatures, clear of every road: a Metroid and a Ripper over the orange plateau, a
  // Zoomer on Norfair's stacks, lava leaping in Norfair and Ridley's lair, a Ripper over the lair.
  actors: [
    actor('metroid', 170, 54, { phase: 0 }),
    actor('ripper', 160, 52, { range: 32, speed: 0.25 }),
    actor('zoomer', 144, 112, { size: 16, speed: 0.25 }),
    actor('podoboo', 148, 120, { height: 14, period: 150 }),
    actor('podoboo', 200, 196, { height: 16, period: 190, phase: 70 }),
    actor('ripper', 180, 222, { range: 40, speed: 0.3, phase: 60 }),
  ],
  props: [...PROPS_4_ZEBES],
};
