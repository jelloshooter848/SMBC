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
 * Brainwashed Luigi's way to the flag, starting a tile behind Mario. He is not quite himself: he
 * stands dazed for a moment at GO and his top running speed is held to 2 px a frame (Mario's is
 * 2.56), so he reaches the pole about 11.8 s after GO. A fast run by Mario (about 8.9 s) or a
 * good one with a stumble wins by one to three seconds; a walk (about 14.7 s) loses. Jump points
 * are px of his body's left edge, found with a search over the course and checked by
 * race.test.ts. // TUNED
 */
export const LUIGI_ROUTE: Route = {
  maxRun: 0x02000,
  pauses: [{ at: 0, frames: 24 }],
  jumps: [
    { at: 224, hold: 20 }, // onto the low pipe
    { at: 322, hold: 20 }, // off it, over the first pit
    { at: 520, hold: 20 }, // a hop onto the pyramid
    { at: 528, hold: 20 }, // over the pit between its halves
    { at: 766, hold: 20 }, // onto the tall pipe
    { at: 914, hold: 20 }, // over the wide pit
    { at: 1138, hold: 20 }, // up the end stairs
    { at: 1210, hold: 20 }, // over the last pit to the pole
  ],
};
