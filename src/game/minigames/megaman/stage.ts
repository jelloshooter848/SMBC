import { px, tileToSub } from '@engine/math/units';
import { parseTextMap } from '../../level/textmap';
import type { EntitySpawn, LevelData } from '../../level/schema';
import type { Entity } from '../../entities/entity';
import type { Player } from '../../entities/player';
import { Drone, Hopper, Met, StationDecor, Turret, WeaponCapsule } from './robots';
import source from './stage.map?raw';

/**
 * One of the camera's sections (tiles): 15 rows from row `y`, `w` columns from column `x`. The
 * camera scrolls sideways inside one and flips a screen up or down between them (Mega Man 2).
 */
export interface StationScreen {
  x: number;
  y: number;
  w: number;
}

/** Rows in a screen. */
export const SCREEN_ROWS = 15;

/** Where the station's fixed pieces are (tiles). */
export interface StationLayout {
  /** The stage without its `screen`, `shutter` and `dark-megaman` lines (the scene uses those). */
  level: LevelData;
  /** The camera's sections, in the map's order (the route's). */
  screens: readonly StationScreen[];
  /**
   * The two boss shutters' top tiles (each two tiles high), left to right, as in Mega Man 2: the
   * first into a short corridor, the second into the boss room.
   */
  shutters: readonly { x: number; y: number }[];
  /** The tile Dark Mega Man's feet stand in. */
  boss: { x: number; y: number };
  /** The corridor's first column (the first shutter's): the camera locks there (16 columns). */
  corridorX: number;
  /** The boss room's first column (the second shutter's): the camera locks there (16 columns). */
  roomX: number;
}

let parsed: StationLayout | null = null;

/** The section holding tile (tx, ty), if any (the first that does). */
export function screenAt(screens: readonly StationScreen[], tx: number, ty: number): number {
  return screens.findIndex((s) => tx >= s.x && tx < s.x + s.w && ty >= s.y && ty < s.y + SCREEN_ROWS);
}

/** Is a spawn one of the robots (spawned per section by the scene, not by World)? */
export function isRobotSpawn(s: EntitySpawn): boolean {
  return s.type === 'hopper' || s.type === 'met' || s.type === 'turret' || s.type === 'drone';
}

/**
 * The station stage (stage.map), parsed once. Like the Mirror Race's course it lives outside the
 * level library, so the dev level select and the campaign never list it.
 */
export function stationStage(): StationLayout {
  if (parsed) return parsed;
  const raw = parseTextMap(source, 'mm-station');
  const find = (type: string) => {
    const e = raw.entities.find((s) => s.type === type);
    if (!e) throw new Error(`mm-station: no ${type}`);
    return { x: e.x, y: e.y };
  };
  const shutters = raw.entities
    .filter((e) => e.type === 'shutter')
    .map((e) => ({ x: e.x, y: e.y }))
    .sort((a, b) => a.x - b.x);
  if (shutters.length !== 2) throw new Error('mm-station: two shutters expected');
  const [first, second] = shutters as [{ x: number; y: number }, { x: number; y: number }];
  const screens = raw.entities
    .filter((e) => e.type === 'screen')
    .map((e) => ({ x: e.x, y: e.y, w: Number(e.props?.w ?? 16) }));
  if (screens.length === 0) throw new Error('mm-station: no screens');
  const placed = new Set(['screen', 'shutter', 'dark-megaman']);
  parsed = {
    level: { ...raw, entities: raw.entities.filter((e) => !placed.has(e.type)) },
    screens,
    shutters,
    boss: find('dark-megaman'),
    corridorX: first.x,
    roomX: second.x,
  };
  return parsed;
}

/** The scene's side of the station's entities. */
export interface StationHooks {
  /** Mega Man touched the weapon capsule. */
  onCapsule(p: Player): void;
}

/**
 * World's `extraEntities` for the station: `hopper`, `met`, `turret` (`mount=ceiling` hangs it upside
 * down under a ceiling), `drone` and `capsule`, each at the tile its feet stand in (a drone's and a
 * ceiling turret's own tile), and `deco kind=window|console|girder`
 * (station decor, by its top-left tile). Anything else is World's.
 */
export function stationEntities(hooks: StationHooks): (s: EntitySpawn) => Entity | undefined {
  return (s) => {
    const x = tileToSub(s.x);
    const feet = tileToSub(s.y + 1);
    switch (s.type) {
      case 'hopper':
        return new Hopper(x + px(1), feet - px(14));
      case 'met':
        return new Met(x + px(1), feet - px(14));
      case 'turret': {
        const ceiling = s.props?.mount === 'ceiling';
        return new Turret(x, ceiling ? tileToSub(s.y) : feet - px(16), ceiling ? 'ceiling' : 'floor', -1);
      }
      case 'drone':
        return new Drone(x + px(1), tileToSub(s.y));
      case 'deco':
        return new StationDecor(String(s.props?.kind ?? 'girder'), x, tileToSub(s.y));
      case 'capsule':
        return new WeaponCapsule(x, feet - px(16), (p) => hooks.onCapsule(p));
      default:
        return undefined;
    }
  };
}
