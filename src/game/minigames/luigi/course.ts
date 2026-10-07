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

/**
 * How the race's copy of The Lost Levels' 1-1 (ll-1-1.map) differs from it, tile by tile
 * (column, row, the level's glyph, the race's): the race is one life against Luigi, so it is
 * eased where the level asks for a pixel-exact jump or packs enemies where a careful player
 * dies. The spawns in [entities] are thinned to match (race.test.ts checks both lists).
 * - The two bricks at the end of the low brick row over the first stairs (68-69, row 5) are gone:
 *   they made the jump from the bricks beyond the first pit up onto the brick bridge over the wide
 *   pit a 7 px window; without them it is 43 px. The Goomba that walked on them starts on the rest
 *   of the row (69 → 66).
 * - Enemies drawn into the tiles: the Goomba by the third ground pipe (46), the Koopa on the ?
 *   blocks under the bridge (88, row 8), the two Koopas before the second bridge (115, 118), the
 *   Koopa on the pipe after it (143), and the red Koopas under the ? row with the floating pipe
 *   (150) and by the last pipe (161) are gone; the Goomba where the bridge comes down (102) walks
 *   in from a little further on (108).
 */
export const RACE_TILE_CHANGES: readonly (readonly [number, number, string, string])[] = [
  [68, 5, '=', '.'],
  [69, 5, '=', '.'],
  [69, 4, 'g', '.'],
  [66, 4, '.', 'g'],
  [46, 12, 'g', '.'],
  [88, 8, 'k', '.'],
  [115, 12, 'k', '.'],
  [118, 12, 'k', '.'],
  [143, 8, 'k', '.'],
  [150, 12, 'K', '.'],
  [161, 12, 'K', '.'],
  [102, 12, 'g', '.'],
  [108, 12, '.', 'g'],
];

/**
 * ll-1-1's [entities] spawns the race leaves out: the third ground pipe's plant and the Goomba
 * beside it, the Paratroopas at the first stairs and before the second bridge, the Koopa on the ?
 * blocks, a Goomba and a Koopa on the open ground before the second bridge, and the plants in the
 * two pipes at the second bridge's ends.
 */
export const RACE_SPAWNS_LEFT_OUT: readonly string[] = [
  'piranha 45 13',
  'goomba 47 12',
  'koopa-para-green 71 8',
  'koopa-green 89 8',
  'goomba 103 12',
  'koopa-green 116 12',
  'koopa-para-green 123 8',
  'piranha 123 9',
  'piranha 128 9',
];

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
 * stands dazed for a moment at GO and his top running speed is held to 1.75 px a frame (Mario's is
 * 2.56). Like a player he stops short of a pipe while its piranha plant is up, and he hops up a
 * pipe or a step he runs into (rival.ts), so his route only names the jumps that need a run: over
 * the pits, up onto the brick bridges and up the staircase. A sharp run beats him by about six
 * seconds; a careful one with waits at the plants and a stumble or two still wins
 * (human-sim.test.ts). Jump points are px of his body's left edge, found with a search over the
 * course and checked by race.test.ts. // TUNED
 */
export const LUIGI_ROUTE: Route = {
  maxRun: 0x01c00,
  pauses: [{ at: 0, frames: 24 }],
  jumps: [
    { at: 800, hold: 20 }, // over the first pit, onto the bricks past it
    { at: 1112, hold: 20 }, // up onto the brick bridge over the wide pit
    { at: 1170, hold: 20 },
    { at: 1960, hold: 20 }, // off the pipe top, onto the second bridge
    { at: 2285, hold: 20 }, // over the pipe with the floating one above
    { at: 2292, hold: 20 },
  ],
};
