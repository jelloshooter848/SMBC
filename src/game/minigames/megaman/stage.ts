import { px, tileToSub } from '@engine/math/units';
import { parseTextMap } from '../../level/textmap';
import type { EntitySpawn, LevelData } from '../../level/schema';
import type { Entity } from '../../entities/entity';
import type { Player } from '../../entities/player';
import { Drone, Hopper, Turret, WeaponCapsule } from './robots';
import source from './stage.map?raw';

/** Where the station's fixed pieces are (tiles). */
export interface StationLayout {
  /** The stage without its `shutter` and `dark-megaman` lines (the scene places those). */
  level: LevelData;
  /** The shutter's top tile (it is two tiles high). */
  shutter: { x: number; y: number };
  /** The tile Dark Mega Man's feet stand in. */
  boss: { x: number; y: number };
  /** The boss room's first column: the camera locks there (16 columns wide). */
  roomX: number;
}

let parsed: StationLayout | null = null;

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
  const shutter = find('shutter');
  parsed = {
    level: {
      ...raw,
      entities: raw.entities.filter((e) => e.type !== 'shutter' && e.type !== 'dark-megaman'),
    },
    shutter,
    boss: find('dark-megaman'),
    roomX: shutter.x,
  };
  return parsed;
}

/** The scene's side of the station's entities. */
export interface StationHooks {
  /** Mega Man touched the weapon capsule. */
  onCapsule(p: Player): void;
}

/**
 * World's `extraEntities` for the station: `hopper`, `turret` (`mount=wall` hangs it on a wall,
 * `dir=1` faces it right; a wall turret faces left by default), `drone` and `capsule`, each at the
 * tile its feet stand in (a drone's and a wall turret's top tile). Anything else is World's.
 */
export function stationEntities(hooks: StationHooks): (s: EntitySpawn) => Entity | undefined {
  return (s) => {
    const x = tileToSub(s.x);
    const feet = tileToSub(s.y + 1);
    switch (s.type) {
      case 'hopper':
        return new Hopper(x + px(1), feet - px(14));
      case 'turret': {
        const wall = s.props?.mount === 'wall';
        const dir = Number(s.props?.dir ?? -1) < 0 ? -1 : 1;
        return new Turret(x, wall ? tileToSub(s.y) : feet - px(16), wall ? 'wall' : 'floor', dir);
      }
      case 'drone':
        return new Drone(x + px(1), tileToSub(s.y));
      case 'capsule':
        return new WeaponCapsule(x, feet - px(16), (p) => hooks.onCapsule(p));
      default:
        return undefined;
    }
  };
}
