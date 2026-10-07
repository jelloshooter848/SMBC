import { tileToSub } from '@engine/math/units';
import { parseTextMap } from '../../level/textmap';
import type { EntitySpawn, LevelData } from '../../level/schema';
import type { Entity } from '../../entities/entity';
import { ZebesDecor } from './creatures';
import { BrainTank, Cannon, Door, RinkaSpawner, Zebetite, type TourianHooks } from './tourian';
import source from './stage.map?raw';

let parsed: LevelData | null = null;

/**
 * The escape stage (stage.map), parsed once. Like the station and the Mirror Race's course it
 * lives outside the level library, so the dev level select and the campaign never list it.
 */
export function escapeStage(): LevelData {
  parsed ??= parseTextMap(source, 'zebes-escape');
  return parsed;
}

export type RoomId = 'corridor' | 'hall' | 'brain' | 'shaft';

/** A room of the map (tiles, inclusive): the camera keeps inside the one Samus is in. */
export interface Room {
  id: RoomId;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Tourian's rooms (stage.map), in the order Samus goes through them. */
export const ROOMS: readonly Room[] = [
  { id: 'corridor', x0: 0, y0: 45, x1: 31, y1: 59 },
  { id: 'hall', x0: 32, y0: 45, x1: 47, y1: 59 },
  { id: 'brain', x0: 48, y0: 45, x1: 79, y1: 59 },
  { id: 'shaft', x0: 80, y0: 0, x1: 95, y1: 59 },
];

/** The room tile (tx, ty) is in, or null (the rock between rooms). */
export function roomAt(tx: number, ty: number): Room | null {
  return ROOMS.find((r) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) ?? null;
}

/** A room's bounds in subpixels (right and bottom exclusive), for the camera. */
export function roomBounds(r: Room): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: tileToSub(r.x0), y0: tileToSub(r.y0), x1: tileToSub(r.x1 + 1), y1: tileToSub(r.y1 + 1) };
}

/** The row Samus stands on at the surface: standing on it (or above) ends the round. */
export const SURFACE_ROW = 3;

/**
 * World's `extraEntities` for Tourian: `door color=blue|red` (by its top tile), `zebetite` (by its
 * top tile), `brain` (the tank, by its top-left tile), `cannon` (by its tile under the ceiling),
 * `rinka` (a spawner, by its tile) and `deco kind=alarm` (by its top-left tile). Anything else is
 * World's.
 */
export function escapeEntities(hooks: TourianHooks): (s: EntitySpawn) => Entity | undefined {
  const doors = new Map<string, Door>();
  return (s) => {
    switch (s.type) {
      case 'door':
        return new Door(s.x, s.y, s.props?.color === 'red' ? 'red' : 'blue', hooks, doors);
      case 'zebetite':
        return new Zebetite(s.x, s.y);
      case 'brain':
        return new BrainTank(s.x, s.y, hooks);
      case 'cannon':
        return new Cannon(s.x, s.y, hooks);
      case 'rinka':
        return new RinkaSpawner(s.x, s.y, hooks);
      case 'deco': {
        const kind = String(s.props?.kind ?? 'alarm');
        if (kind !== 'chozo' && kind !== 'alarm' && kind !== 'door') return undefined;
        return new ZebesDecor(kind, tileToSub(s.x), tileToSub(s.y));
      }
      default:
        return undefined;
    }
  };
}
