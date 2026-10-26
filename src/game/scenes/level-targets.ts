import type { Game } from './game';
import type { MapSet } from './original-game';

/*
 * A map set's level as an area id, and a world's name as the original shows it. Used by the dev
 * Level select (dev-play.ts) and a CLEARED file's level replay (original-replay.ts). v0.4.73
 * item 94: these were the Level Select cheat's (level-select-cheat.ts, removed with it).
 */

/** A world's name as the original shows it (LevelID.ToDisplay): 10-13 are A-D. */
export function worldName(world: number): string {
  return world > 9 ? String.fromCharCode(65 + world - 10) : String(world);
}

/** Level `world`-`level` of map set `set` as an area id (its start: intro or first area). */
export function levelSelectTarget(game: Game, set: MapSet, world: number, level: number): string {
  const id = `${set.start.replace(/\d+-\d+$/, '')}${world}-${level}`;
  const intro = `${id}-intro`;
  try {
    game.deps.getLevel(intro);
    return intro;
  } catch {
    return game.firstArea(id);
  }
}
