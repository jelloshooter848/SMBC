import type { ClassicGoombas, ClassicSettings } from '@engine/save/original-options';
import type { EntitySpawn } from '../level/schema';
import { T } from '../level/tiles';
import type { TileMap } from '../world/tilemap';

/**
 * Classic mode's More Settings rows that edit an area's spawn list as it loads (FU-7a; the
 * original's Level.as spawn loop): Replace Goombas and Piranhas. Called from the Classic level
 * edits (rules/hooks.ts levelEdits) with the World's own copy of the spawns; at the original's
 * values (Off, Some Pipes) nothing changes.
 */

/**
 * The spawn type every Goomba becomes, by Replace Goombas value. Spike Top (a new enemy) adds its
 * row here and its value to CLASSIC_GOOMBAS when it lands.
 */
export const GOOMBA_SPAWNS: Readonly<Record<ClassicGoombas, string | null>> = {
  off: null,
  buzzy: 'buzzy',
  spiny: 'spiny',
};

/** The upright and hanging plant spawn types (World.makeEntity). */
const PIRANHA = 'piranha';
const PIRANHA_DOWN = 'piranha-down';

/**
 * Applies Replace Goombas and Piranhas to `spawns` (in place, re-sorted by x as the World keeps
 * them); true when anything changed.
 *
 * - Replace Goombas: each `goomba` spawn becomes the chosen enemy at the same cell.
 * - Piranhas, All Pipes: a plant on every upright pipe top (its top-left tile) and under every
 *   hanging pipe's rim (its bottom-left tile) that has none (Level.addPiranhaAtLocationIfNotThere).
 * - Piranhas, Green / Red: every plant, the map's and the added ones, takes that colour
 *   (Level.forcePiranhaType); Some Pipes keeps each plant's own.
 */
export function applyOptionSpawns(
  map: TileMap,
  spawns: EntitySpawn[] | undefined,
  opts: Readonly<ClassicSettings> | null | undefined,
): boolean {
  if (!opts || !spawns) return false;
  let changed = false;
  const goomba = GOOMBA_SPAWNS[opts.goombas];
  if (goomba)
    for (let i = 0; i < spawns.length; i++) {
      const s = spawns[i] as EntitySpawn;
      if (s.type !== 'goomba') continue;
      spawns[i] = { ...s, type: goomba };
      changed = true;
    }
  const p = opts.piranhas;
  if (p === 'all' || p === 'green-all' || p === 'red-all') {
    const has = new Set(
      spawns
        .filter((s) => s.type === PIRANHA || s.type === PIRANHA_DOWN)
        .map((s) => `${s.type},${s.x},${s.y}`),
    );
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const id = map.get(x, y);
        const type = id === T.PIPE_TL ? PIRANHA : id === T.PIPE_BOTTOM_L ? PIRANHA_DOWN : null;
        if (!type || has.has(`${type},${x},${y}`)) continue;
        spawns.push({ type, x, y });
        changed = true;
      }
  }
  const red =
    p === 'red-some' || p === 'red-all' ? true : p === 'green-some' || p === 'green-all' ? false : null;
  if (red !== null)
    for (let i = 0; i < spawns.length; i++) {
      const s = spawns[i] as EntitySpawn;
      if (s.type !== PIRANHA && s.type !== PIRANHA_DOWN) continue;
      const { red: _, ...rest } = s.props ?? {};
      spawns[i] = { ...s, props: red ? { ...rest, red: true } : rest };
      changed = true;
    }
  if (changed) spawns.sort((a, b) => a.x - b.x);
  return changed;
}
