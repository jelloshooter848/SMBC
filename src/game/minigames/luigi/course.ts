import { parseTextMap } from '../../level/textmap';
import type { LevelData } from '../../level/schema';
import { T } from '../../level/tiles';
import type { Route } from './rival';
import source from './luigi-race.map?raw';

let parsed: LevelData | null = null;

/**
 * The Mirror Race course (luigi-race.map), parsed once. It lives here rather than with the
 * campaign's levels, so the level library, the dev level select and the campaign never list it.
 */
export function raceCourse(): LevelData {
  parsed ??= parseTextMap(source, 'luigi-race');
  return parsed;
}

/** The flagpole's shaft (its left edge, px) and the top of its base block (px). */
export function poleOf(level: LevelData): { x: number; baseY: number } {
  const at = (x: number, y: number) => level.tiles[y * level.width + x];
  for (let x = 0; x < level.width; x++) {
    let ball = 0;
    while (ball < level.height && at(x, ball) !== T.FLAG_BALL) ball++;
    if (ball >= level.height) continue;
    let base = ball + 1;
    while (at(x, base) === T.FLAG_SHAFT) base++;
    // The Flagpole entity's shaft: 2 px wide, 7 px into the column (objects/flagpole.ts).
    return { x: x * 16 + 7, baseY: base * 16 };
  }
  throw new Error(`${level.id}: no flagpole`);
}

/**
 * Brainwashed Luigi's way to the flag, starting a tile behind Mario. He is not quite himself: his
 * top running speed is held to 1.5 px a frame (Mario's is 2.56), and he stands dazed a moment at
 * GO and twice more along the way (on the open ground before the second tall pipe, and before the
 * last pipe), staring back at Mario. Like a player he stops short of a pipe while its piranha plant
 * is up (rival.ts). A sharp run beats him by about four seconds; a careful one with waits at the
 * plants and a stumble or two still wins (human-sim.test.ts). Jump points are px of his body's left
 * edge, found with a search over the course and checked by race.test.ts. // TUNED
 */
export const LUIGI_ROUTE: Route = {
  maxRun: 0x01800,
  pauses: [
    { at: 0, frames: 24 },
    { at: 700, frames: 90 },
    { at: 1290, frames: 90 },
  ],
  jumps: [
    { at: 560, hold: 20 }, // onto the tall pipe
    { at: 944, hold: 20 }, // onto the second tall pipe
    { at: 1118, hold: 20 }, // over the pit past the ? blocks
    { at: 1268, hold: 20 }, // onto the low pipe
    { at: 1436, hold: 20 }, // up the staircase
    { at: 1438, hold: 20 },
    { at: 1440, hold: 20 },
    { at: 1616, hold: 20 }, // off its top to the pole
  ],
};
