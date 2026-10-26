import { T } from '../level/tiles';
import type { EntitySpawn } from '../level/schema';
import type { TileMap } from '../world/tilemap';
import type { CharacterDef } from '../characters/character';

/*
 * Classic SMBC level variants for wide heroes (TG-45; Sophia III's SO-45 to SO-48): the original
 * builds each level per hero (Level.as:779-791) and shows its `WideCharacter=Show` tokens, and
 * hides its `WideCharacter=Hide` ones, only for a wide hero (Sophia.as:381, isWideCharacter):
 * one-tile shafts and drops made two tiles wide, a pillar swapped for lava. Read from the
 * original's levelDataLostLevels.xml (normal layer).
 *
 * Most of the original's pieces for her are already in the maps' `[variant sophia classic]`
 * sections (level/variants.ts: SMB's 4-4 and every Lost Levels area but these). This table holds
 * the areas those sections leave out (the Lost Levels castles our Campaign tank gets through
 * nose first). It is applied only by the World's Classic level-load step, for a player whose
 * def has `levelFlags.wide`, so under Campaign the maps are their own.
 */

/** One area's edits: tiles set (x, y, tile id), and spawns moved (type at `from` → `to`). */
export interface AreaVariant {
  tiles: readonly (readonly [number, number, number])[];
  moves?: readonly { type: string; from: readonly [number, number]; to: readonly [number, number] }[];
}

const column = (x: number, y0: number, y1: number, tile: number): [number, number, number][] =>
  Array.from({ length: y1 - y0 + 1 }, (_, i) => [x, y0 + i, tile]);

export const WIDE_VARIANTS: Readonly<Record<string, AreaVariant>> = {
  // The water's one-tile gap in the coral at 170 is two tiles wide.
  'll-3-2': { tiles: [[171, 9, T.AIR]] },
  // The firebar's block at 81 moves right a tile (a two-tile shaft at 80-81); the drop at 140 is
  // two tiles wide.
  'll-4-4': {
    tiles: [
      [81, 9, T.AIR],
      [82, 9, T.HARD],
      [141, 9, T.AIR],
    ],
    moves: [{ type: 'firebar', from: [81, 9], to: [82, 9] }],
  },
  // The drops at 112 and 186 are two tiles wide (the one at 186 moves right a tile).
  'll-5-4': {
    tiles: [
      [113, 9, T.AIR],
      [187, 9, T.AIR],
      [186, 10, T.CASTLE_BRICK],
      [187, 10, T.AIR],
      [186, 11, T.CASTLE_BRICK],
      [187, 11, T.AIR],
    ],
  },
  // The coral by the gap at 130 is gone.
  'll-6-2': { tiles: [[131, 10, T.AIR]] },
  // The one-tile shaft at 29 is two tiles wide.
  'll-7-4': { tiles: column(30, 3, 10, T.AIR) },
  // The one-tile shaft at 29 is two tiles wide ("a 2-tile shaft",
  // 2026-10-05-ll-12-4-lava-lift-never-reaches-drop-shaft.md).
  'll-12-4': { tiles: column(30, 3, 10, T.AIR) },
  // The pillar at 87 is open, over lava; its Podoboo jumps there.
  'll-13-4-end': {
    tiles: [...column(87, 6, 12, T.AIR), [87, 13, T.LAVA], [87, 14, T.AIR]],
    moves: [{ type: 'podoboo', from: [88, 12], to: [87, 12] }],
  },
};

/** A wide hero is playing (SO-5's `levelFlags.wide`; SO-M11: either player in co-op). */
export const playsWide = (defs: readonly CharacterDef[]): boolean => defs.some((d) => d.levelFlags?.wide);

/**
 * Lays area `id`'s wide-hero variant into `map` (and moves its spawns) when a wide hero plays.
 * Returns whether anything changed. Called only under Classic rules (TG-45).
 */
export function applyWideVariants(
  map: TileMap,
  id: string,
  defs: readonly CharacterDef[],
  spawns?: EntitySpawn[],
): boolean {
  const v = WIDE_VARIANTS[id];
  if (!v || !playsWide(defs)) return false;
  for (const [x, y, t] of v.tiles) map.set(x, y, t);
  if (spawns)
    for (const m of v.moves ?? []) {
      const i = spawns.findIndex((e) => e.type === m.type && e.x === m.from[0] && e.y === m.from[1]);
      // A copy: the level's own spawn stays as it is for the next load.
      if (i >= 0) spawns[i] = { ...(spawns[i] as EntitySpawn), x: m.to[0], y: m.to[1] };
    }
  spawns?.sort((a, b) => a.x - b.x);
  return true;
}
