import { px, tileToSub } from '@engine/math/units';
import { parseTextMap } from '../../level/textmap';
import type { EntitySpawn, LevelData } from '../../level/schema';
import type { Entity } from '../../entities/entity';
import type { Player } from '../../entities/player';
import { Bat, Candle, MedusaSpawner, Skeleton, type CandleDrop } from './creatures';
import source from './stage.map?raw';

/** Where the castle's fixed pieces are (tiles). */
export interface CastleLayout {
  /** The stage without its `door` and `dracula` lines (the scene places those). */
  level: LevelData;
  /** The door's top tile (it is two tiles high). */
  door: { x: number; y: number };
  /** The tile Dracula's feet stand in (marks the floor of his room). */
  boss: { x: number; y: number };
  /** The throne room's first column: the camera locks there (16 columns wide). */
  roomX: number;
}

let parsed: CastleLayout | null = null;

/**
 * The castle stage (stage.map), parsed once. Like the other mini games' stages it lives outside
 * the level library, so the dev level select and the campaign never list it.
 */
export function castleStage(): CastleLayout {
  if (parsed) return parsed;
  const raw = parseTextMap(source, 'cv-castle');
  const find = (type: string) => {
    const e = raw.entities.find((s) => s.type === type);
    if (!e) throw new Error(`cv-castle: no ${type}`);
    return { x: e.x, y: e.y };
  };
  const door = find('door');
  parsed = {
    level: { ...raw, entities: raw.entities.filter((e) => e.type !== 'door' && e.type !== 'dracula') },
    door,
    boss: find('dracula'),
    roomX: door.x,
  };
  return parsed;
}

/** The scene's side of the castle's entities. */
export interface CastleHooks {
  /** Simon took the sub-weapon a candle dropped. */
  onSubWeapon(p: Player): void;
}

/**
 * World's `extraEntities` for the castle: `candle x y [drop=heart|big|dagger|meat]` (by its tile),
 * `bat x y` (its roost tile), `skeleton x y` (the tile his feet stand in) and
 * `medusa x y len=N` (Medusa heads enter while Simon is in columns x..x+N-1, their wave centred
 * on row y). Anything else (the `stairs`) is World's.
 */
export function castleEntities(hooks: CastleHooks): (s: EntitySpawn) => Entity | undefined {
  return (s) => {
    const x = tileToSub(s.x);
    const feet = tileToSub(s.y + 1);
    switch (s.type) {
      case 'candle': {
        const d = String(s.props?.drop ?? 'heart');
        const drop: CandleDrop = d === 'big' || d === 'dagger' || d === 'meat' ? d : 'heart';
        return new Candle(s.x, s.y, drop, (p) => hooks.onSubWeapon(p));
      }
      case 'bat':
        return new Bat(x + px(2), tileToSub(s.y) + px(3));
      case 'skeleton':
        return new Skeleton(x + px(1), feet - px(30));
      case 'medusa':
        return new MedusaSpawner(s.x, s.y, Number(s.props?.len ?? 16));
      default:
        return undefined;
    }
  };
}
