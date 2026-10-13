import type { MapNode, MapProp, WorldExit, WorldMapPage } from '@game/map/types';
import { levelIds } from '@content/levels';
import { actor, autoShore, poly } from './build';

/*
 * The VALLEY OF BOWSER (0.4.54, TD58's approved design; owner, Oct 13), the page after World 8, in
 * campaign play only. Campaign World 8's road on (8-4's, east on row 10, Sophia's gate) arrives at
 * its start; its one level is BOWSER'S CASTLE, the real king. Back in the Mushroom Kingdom's world,
 * at its darkest edge: a cavern-toned 3/4 view like World 1's (sprites/valley-above.ts), laid out
 * after Super Mario World's Valley of Bowser (owner's reference, style only): a dark cavern in
 * grey-blue ledges, the pale tan road, green pipes, dark pools, a dim star pad, a lone tower, and at
 * the top the castle over its lava moat with the stair road up to its gate.
 *
 * THE SWITCH (VALLEY_LIVE): the page, its node and World 8's road to it exist only once the castle's
 * level, '8-5' (VALLEY_LEVEL), is in the level index (content/levels). Until then (0.4.54) the page
 * is not registered and campaign World 8's road leads on to Lost World 1 as before
 * (world8-underworld.ts). Adding the level turns it all on; nothing else changes.
 *
 * Page id 'valley-of-bowser' (group 'valley': not an 'smb-N' id, so smbWorld() and the world gates
 * never take it for a ninth world). Its castle node is 'bowsers-castle' (kind 'castle'); its level
 * is '8-5' inside, and the player never sees that: the node is shown by its name, BOWSER'S CASTLE
 * (MapNode.name: the map's header and the announcer). Save codes reserve all three ids (v3).
 *
 * The road on to the Lost Levels leaves from the castle east on row 5 (Lost World 1's start row). It
 * is open once the castle is cleared, OR when the file already has gameCleared (a file that beat
 * the game before this page existed): `opens: 'castle-or-gameCleared'` (rules.isExitOpen).
 *
 * Tiles (above: 'valley', valleyGround):
 *   .  under the header: the cavern's black roof, stalactites
 *   #  cavern floor (its shores take the ground round them)    ,  the upper ledge    :  the low shelf
 *   ^  cliff (the ledge's, or the floor's)    G  the stair road up to the castle    ~  dark pool
 *   Y  stalagmite    R  boulder    X  burning brazier
 */
export const SKETCH_VALLEY: readonly string[] = [
  '................',
  '................',
  ',,,,,,,,,,,,####', // the upper ledge: the castle (a prop) at the top, a pool to its east
  ',,,Y,,,,,,,,#~~#',
  ',,,,,,,,,,,,#~~#',
  ',,,,,,,,,,,,####', // the road on to the Lost Levels, east on row 5
  ',,,,,,,,,,,,,,,,', // the castle's gate (BOWSER'S CASTLE)
  ',,,,^^^^G^^^####', // the ledge's cliff and the stair road; the ledge runs down both sides
  ',,,,###X#X###~~#', // braziers at the stairs' foot; a pool on the east ledge
  '^^^^############',
  '############,,,,', // the arrival from World 8 (start), on the cavern floor
  '##R#######Y#^^^^',
  '^^^^^^^^^^^^::::', // the floor's cliff down to the low shelf
  '::::::::::::::::', // the low shelf, its pipes
  '::::::::::::::::',
];

/** The castle over its moat, the lone tower, the star pad, the pipes. */
export const PROPS_VALLEY: readonly MapProp[] = [
  { frame: 'bowser-castle', x: 80, y: 24 }, // cols 5-11, rows 1.5-5: its gate is the node at 8,6
  { frame: 'tower', x: 160, y: 128 }, // cols 10-11, standing on the floor at row 10
  { frame: 'star-pad', x: 16, y: 56, flat: true }, // cols 1-2 on the ledge
  { frame: 'pipe', x: 0, y: 24 }, // the ledge's pipe, top left
  { frame: 'pipe', x: 32, y: 200 }, // the shelf's pipes
  { frame: 'pipe', x: 192, y: 200 },
];

/** The page's id (save codes reserve it, v3). */
export const VALLEY_PAGE_ID = 'valley-of-bowser';

/** The level of BOWSER'S CASTLE, its node's level: its presence in the level index is the switch. */
export const VALLEY_LEVEL = '8-5';

/** The castle node's name: how the map, the header and the announcer show it (never "8-5"). */
export const BOWSERS_CASTLE = "BOWSER'S CASTLE";

/** Whether the VALLEY OF BOWSER is live: its castle's level is among `ids` (the level index). */
export function valleyLive(ids: readonly string[] = levelIds()): boolean {
  return ids.includes(VALLEY_LEVEL);
}

/**
 * THE SWITCH: the VALLEY OF BOWSER, its castle node and campaign World 8's road to it are live
 * (registered in content/worldmap MAP_PAGES, World 8's road leading here) once level '8-5' exists.
 */
export const VALLEY_LIVE: boolean = valleyLive();

export const VALLEY_NODES: readonly MapNode[] = [
  { id: 'start', kind: 'start', x: 0, y: 10 },
  { id: 'bowsers-castle', kind: 'castle', level: VALLEY_LEVEL, name: BOWSERS_CASTLE, x: 8, y: 6 },
];

/** On to the Lost Levels, east on row 5: open once the castle is cleared, or with gameCleared. */
export const VALLEY_EXIT: WorldExit = {
  from: 'bowsers-castle',
  to: 'll-1',
  side: 'right',
  points: poly([8, 6], [13, 6], [13, 5], [15, 5]),
  opens: 'castle-or-gameCleared',
};

export const VALLEY_OF_BOWSER: WorldMapPage = {
  id: VALLEY_PAGE_ID,
  group: 'valley',
  label: 'VALLEY',
  title: 'VALLEY OF BOWSER',
  // Drawn from above from the `valley-above` sheet; its actors in the Mushroom Kingdom's colours
  // (World 1 from above, theme 'kingdom').
  theme: 'kingdom',
  above: 'valley',
  // Bowser's own map song (content/music/valley-of-bowser.ts).
  music: 'map-valley',
  tiles: autoShore(SKETCH_VALLEY),
  nodes: [...VALLEY_NODES],
  paths: [{ from: 'start', to: 'bowsers-castle', points: poly([0, 10], [5, 10], [5, 9], [8, 9], [8, 6]) }],
  exits: [VALLEY_EXIT],
  // A Hammer Bro on the floor, a Koopa on the ledge, a fireball from the moat, the king's flags,
  // bats over the low shelf.
  actors: [
    actor('hammer-bro', 128, 184, { range: 0 }),
    actor('koopa', 16, 100, { range: 16, speed: 0.2, color: 'red' }),
    actor('podoboo', 176, 80, { height: 24, period: 150 }),
    actor('flag', 110, 24, { phase: 0 }),
    actor('flag', 154, 24, { phase: 12 }),
    actor('bat', 48, 212, { phase: 0 }),
    actor('bat', 176, 210, { phase: 40 }),
  ],
  props: [...PROPS_VALLEY],
};
