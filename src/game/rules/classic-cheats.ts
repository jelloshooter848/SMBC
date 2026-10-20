import { T } from '../level/tiles';
import type { EntitySpawn } from '../level/schema';
import type { TileMap } from '../world/tilemap';
import type { World } from '../world/world';

/*
 * Classic mode's level-edit cheats (FU-7e; cheats.ts has their names and goals): the World's
 * Classic level-load step (rules/hooks.ts levelEdits) applies them to the area being built, as
 * the original's Level.as does while it reads the level data. Only a Classic World reads them
 * (World.cheats is NO_CHEATS under Current).
 */

/**
 * Tiles All Ground Is Bricks turns into plain bricks: the original's ground, blocks, cloud faces,
 * platforms and boxes (Level.as: itemText "ground", "block", "cloudFace", "platform", "box"),
 * never a pipe, a Bullet Bill blaster or an unbreakable brick.
 */
const GROUND_TO_BRICK: ReadonlySet<number> = new Set([
  T.GROUND,
  T.HARD,
  T.CASTLE_BRICK,
  T.TREE_TOP,
  T.MUSHROOM_TOP,
  T.CLOUD_BLOCK,
]);

/**
 * All Ground Is Bricks (Level.as): every ground tile is a Brick, except from the flagpole's
 * column on (`currentX >= flag.x`) and from a tile before Bowser's axe (`bowserAxe.x -
 * TILE_SIZE`), so the goal still stands. Returns whether a tile changed.
 */
export function groundToBricks(map: TileMap, spawns: readonly EntitySpawn[]): boolean {
  let end = map.width;
  for (let x = 0; x < map.width && end === map.width; x++)
    for (let y = 0; y < map.height; y++) {
      const id = map.get(x, y);
      if (id === T.FLAG_SHAFT || id === T.FLAG_BALL) {
        end = x;
        break;
      }
    }
  const axe = spawns.find((s) => s.type === 'axe');
  if (axe) end = Math.min(end, axe.x - 1);
  let changed = false;
  for (let x = 0; x < end; x++)
    for (let y = 0; y < map.height; y++)
      if (GROUND_TO_BRICK.has(map.get(x, y))) {
        map.set(x, y, T.BRICK);
        changed = true;
      }
  return changed;
}

/**
 * Map enemies All Hammer Bros turns into Hammer Bros (Level.as: every "enemy" item but Bowser).
 * Fire bars and Podoboos are hazards here as there (projectiles in the original), so they stay.
 */
const TO_HAMMER_BRO: ReadonlySet<string> = new Set([
  'goomba',
  'koopa-green',
  'koopa-red',
  'koopa-para-green',
  'koopa-para-red',
  'koopa-para-green-h',
  'buzzy',
  'spiny',
  'spike-top',
  'cheep-red',
  'cheep-grey',
  'blooper',
  'lakitu',
  'bullet-bill',
  'piranha',
  'piranha-down',
]);

/**
 * All Hammer Bros: the area's map enemies (but Bowser) spawn as Hammer Bros where they stood (a
 * Piranha Plant's on its pipe's rim, a hanging one's under it). Returns how many changed.
 */
export function allHammerBros(spawns: EntitySpawn[]): number {
  let n = 0;
  spawns.forEach((s, i) => {
    if (!TO_HAMMER_BRO.has(s.type)) return;
    const y = s.type === 'piranha' ? s.y - 1 : s.type === 'piranha-down' ? s.y + 1 : s.y;
    const dx = s.type.startsWith('piranha') ? 8 : Number(s.props?.dx ?? 0);
    spawns[i] = { type: 'hammer-bro', x: s.x, y, ...(dx ? { props: { dx } } : {}) };
    n++;
  });
  return n;
}

/**
 * Extra Checkpoints (Level.shouldStartAtCheckPoint: `!levData.lockedCheckpoint ||
 * Cheats.extraCheckpoints`): the halfway points (column, row) of the levels whose checkpoint the
 * original locks (LOCKED_CP="True"), by our area id, on normal difficulty, read from
 * levelDataSmb.xml and levelDataLostLevels.xml. Levels with no halfway area (SMB 8-1 to 8-3 and
 * their Lost Levels twins: HW_AREA="") never start at one, cheat or not, so they are not here.
 */
export const LOCKED_CHECKPOINTS: Readonly<Record<string, { x: number; y: number }>> = {
  '1-4': { x: 97, y: 9 },
  '2-4': { x: 100, y: 12 },
  '3-4': { x: 91, y: 9 },
  '4-4': { x: 146, y: 12 },
  '5-4': { x: 76, y: 12 },
  '6-4': { x: 97, y: 9 },
  '7-4': { x: 154, y: 12 },
  '8-4-water': { x: 3, y: 10 },
  'll-1-4': { x: 64, y: 8 },
  'll-2-4': { x: 88, y: 12 },
  'll-4-4': { x: 104, y: 12 },
  'll-5-4': { x: 106, y: 8 },
  'll-6-4': { x: 149, y: 12 },
  'll-7-4': { x: 86, y: 5 },
  'll-8-4-end': { x: 9, y: 6 },
  'll-9-1': { x: 84, y: 12 },
  'll-9-2': { x: 80, y: 12 },
  'll-9-3': { x: 74, y: 12 },
  'll-10-1': { x: 89, y: 12 },
  'll-10-2': { x: 99, y: 12 },
  'll-10-3': { x: 84, y: 12 },
  'll-10-4': { x: 74, y: 5 },
  'll-11-1': { x: 110, y: 12 },
  'll-11-2': { x: 81, y: 12 },
  'll-11-3': { x: 84, y: 12 },
  'll-11-4': { x: 90, y: 12 },
  'll-12-1': { x: 135, y: 12 },
  'll-12-2': { x: 81, y: 12 },
  'll-12-3': { x: 178, y: 12 },
  'll-12-4': { x: 86, y: 5 },
  'll-13-1': { x: 120, y: 12 },
  'll-13-2': { x: 99, y: 12 },
  'll-13-3': { x: 119, y: 12 },
  'll-13-4-end': { x: 7, y: 12 },
};

/**
 * The level-edit cheats for the area `levelId` being built by `world` (Classic rules only):
 * Water Mode (Level.as `waterLevel = Cheats.waterMode`), All Ground Is Bricks, All Hammer Bros
 * and Extra Checkpoints. Returns whether any applied.
 */
export function applyCheatEdits(map: TileMap, levelId: string, spawns: EntitySpawn[], world: World): boolean {
  const c = world.cheats;
  let any = false;
  if (c.waterMode) {
    world.setWaterMode(true);
    any = true;
  }
  if (c.allGroundIsBricks) any = groundToBricks(map, spawns) || any;
  if (c.allHammerBros) any = allHammerBros(spawns) > 0 || any;
  const cp = LOCKED_CHECKPOINTS[levelId];
  if (c.extraCheckpoints && cp) {
    world.cheatCheckpoints.push(cp);
    any = true;
  }
  return any;
}
