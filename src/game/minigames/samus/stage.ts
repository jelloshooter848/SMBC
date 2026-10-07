import { px, tileToSub } from '@engine/math/units';
import { parseTextMap } from '../../level/textmap';
import type { EntitySpawn, LevelData } from '../../level/schema';
import type { Entity } from '../../entities/entity';
import type { World } from '../../world/world';
import { Ripper, Ship, Skree, ZebesDecor, Zoomer } from './creatures';
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

/** The ship's spawn (tiles: its left column and the row its feet stand in). */
export function shipSpot(): { x: number; y: number } {
  const s = escapeStage().entities.find((e) => e.type === 'ship');
  if (!s) throw new Error('zebes-escape: no ship');
  return { x: s.x, y: s.y };
}

/** The scene's side of the stage's entities. */
export interface EscapeHooks {
  /** Samus touched the ship's hatch. */
  onShip(ship: Ship, world: World): void;
}

/**
 * World's `extraEntities` for the cavern: `zoomer [dir=±1]` (in the tile it starts in, on the
 * floor below it), `ripper [dir=±1]` (its 8-px body at the top of that row), `skree` (hanging in
 * the tile under a ceiling), `ship` (its left tile and the row its feet stand in) and
 * `deco kind=chozo|alarm|door` (by its top-left tile). Anything else is World's.
 */
export function escapeEntities(hooks: EscapeHooks): (s: EntitySpawn) => Entity | undefined {
  return (s) => {
    const x = tileToSub(s.x);
    const y = tileToSub(s.y);
    const dir = Number(s.props?.dir ?? -1) < 0 ? -1 : 1;
    switch (s.type) {
      case 'zoomer':
        return new Zoomer(s.x, s.y, dir);
      case 'ripper':
        return new Ripper(x, y, dir);
      case 'skree':
        return new Skree(x, y);
      case 'ship': {
        const ship: Ship = new Ship(x, tileToSub(s.y + 1) - px(32), (w) => hooks.onShip(ship, w));
        return ship;
      }
      case 'deco': {
        const kind = String(s.props?.kind ?? 'alarm');
        if (kind !== 'chozo' && kind !== 'alarm' && kind !== 'door') return undefined;
        return new ZebesDecor(kind, x, y);
      }
      default:
        return undefined;
    }
  };
}
