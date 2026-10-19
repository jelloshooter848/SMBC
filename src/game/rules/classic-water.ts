import { T } from '../level/tiles';
import type { TileMap } from '../world/tilemap';
import type { CharacterDef } from '../characters/character';

/**
 * Classic SMBC level variants (TG-45): cells that exist only under Classic rules, kept here and
 * never in the `.map` files. Today one set: the coral stepping stones the original adds to two SMB
 * water levels when the hero is not a good swimmer (SW-C12; the original's `BadSwimmer=Show`
 * cells, `Level.as:122, 666-674, 780-786`, and `isGoodSwimmer`, true only for Mario and Luigi).
 */
export interface LevelEdits {
  /** Coral blocks (`B`, T.HARD) at these (column, row) cells. */
  blocks: readonly (readonly [number, number])[];
  /** Coins moved from the first cell to the second. */
  coins: readonly (readonly [readonly [number, number], readonly [number, number]])[];
}

/** The three coins at (159-161, 12) go up a row to make room for the stone at (160, 12). */
const COINS_UP: LevelEdits['coins'] = [
  [
    [159, 12],
    [159, 11],
  ],
  [
    [160, 12],
    [160, 11],
  ],
  [
    [161, 12],
    [161, 11],
  ],
];

/** SW-C12's cells for floor jumpers, by level id (the water areas of 2-2 and 7-2). */
export const FLOOR_JUMPER_EDITS: Readonly<Record<string, LevelEdits>> = {
  '2-2': {
    blocks: [
      [134, 13],
      [134, 14],
      [136, 13],
      [136, 14],
      [160, 12],
      [160, 13],
      [160, 14],
    ],
    coins: COINS_UP,
  },
  '7-2': {
    blocks: [
      [68, 13],
      [68, 14],
      [134, 13],
      [134, 14],
      [137, 13],
      [137, 14],
      [160, 12],
      [160, 13],
      [160, 14],
    ],
    coins: COINS_UP,
  },
};

/** A hero who jumps from the floor under water (SwimProfile.floorJumpOnly): not a good swimmer. */
export function isFloorJumper(def: CharacterDef): boolean {
  return def.movement.swim?.floorJumpOnly === true;
}

/** Puts `edits` into `map` (coins move only where a coin still lies). */
export function applyEdits(map: TileMap, edits: LevelEdits): void {
  for (const [[fx, fy], [tx, ty]] of edits.coins) {
    if (map.get(fx, fy) !== T.COIN) continue;
    map.set(fx, fy, T.AIR);
    map.set(tx, ty, T.COIN);
  }
  for (const [x, y] of edits.blocks) map.set(x, y, T.HARD);
}

/**
 * The World's level-load step under Classic rules (TG-45, called only when `world.rules` is
 * 'classic'): level `id`'s stepping stones when any player's hero is a floor jumper (SW-C12; in
 * co-op with Mario they help both, Open question 3). Returns whether the map changed.
 */
export function applyClassicLevelEdits(map: TileMap, id: string, defs: readonly CharacterDef[]): boolean {
  const edits = FLOOR_JUMPER_EDITS[id];
  if (!edits || !defs.some(isFloorJumper)) return false;
  applyEdits(map, edits);
  return true;
}
