import { px, tileToSub } from '@engine/math/units';
import { parseTextMap } from '../../level/textmap';
import { tileDef } from '../../level/tiles';
import type { EntitySpawn, LevelData } from '../../level/schema';
import type { Entity } from '../../entities/entity';
import type { Player } from '../../entities/player';
import { Dog, Hawk, KnifeThrower, Lantern, type LanternDrop } from './creatures';
import source from './stage.map?raw';

/** Where the stage's fixed pieces are (tiles). */
export interface DuelLayout {
  /** The stage without its `masked` line (the scene places the boss). */
  level: LevelData;
  /** The rooftop arena's first column (its left tower): the camera locks there (16 columns wide). */
  roomX: number;
  /** The doorway in the arena's left tower: rows `doorY`..`doorY + doorH - 1`, open until Ryu is in. */
  doorY: number;
  doorH: number;
  /** The tile the Masked Ninja's feet stand in (marks the arena's floor). */
  boss: { x: number; y: number };
  /** Columns of the floor row with no ground under them (the pits). */
  pits: readonly number[];
}

let parsed: DuelLayout | null = null;

/**
 * The stage (stage.map), parsed once. Like the other mini games' stages it lives outside the
 * level library, so the dev level select and the campaign never list it.
 */
export function duelStage(): DuelLayout {
  if (parsed) return parsed;
  const raw = parseTextMap(source, 'ng-shadow-duel');
  const boss = raw.entities.find((s) => s.type === 'masked');
  if (!boss) throw new Error('ng-shadow-duel: no masked');
  // The arena: the last 16 columns. Its left tower's doorway is the run of air on that column.
  const roomX = raw.width - 16;
  const solid = (x: number, y: number) => tileDef(raw.tiles[y * raw.width + x] ?? 0).collision === 'solid';
  let doorY = -1;
  let doorH = 0;
  for (let y = 2; y < raw.height; y++) {
    if (solid(roomX, y)) continue;
    if (doorY < 0) doorY = y;
    doorH++;
  }
  const floor = raw.height - 2;
  const pits: number[] = [];
  for (let x = 0; x < raw.width; x++) if (!solid(x, floor)) pits.push(x);
  parsed = {
    level: { ...raw, entities: raw.entities.filter((e) => e.type !== 'masked') },
    roomX,
    doorY,
    doorH,
    boss: { x: boss.x, y: boss.y },
    pits,
  };
  return parsed;
}

/** The scene's side of the stage's entities. */
export interface DuelHooks {
  /** Ryu took the ninpo art a lantern dropped. */
  onArt(p: Player): void;
}

/**
 * World's `extraEntities` for the stage: `lantern x y [drop=ninpo|big|life|heal|art]` (by its tile),
 * `thrower x y` and `dog x y` (the tile their feet stand in), `hawk x y` (where it circles).
 * The pits (columns) let a hawk hold off near one.
 */
export function duelEntities(
  hooks: DuelHooks,
  pits: readonly number[],
): (s: EntitySpawn) => Entity | undefined {
  return (s) => {
    const x = tileToSub(s.x);
    const feet = tileToSub(s.y + 1);
    switch (s.type) {
      case 'lantern': {
        const d = String(s.props?.drop ?? 'ninpo');
        const drop: LanternDrop = d === 'big' || d === 'life' || d === 'heal' || d === 'art' ? d : 'ninpo';
        return new Lantern(s.x, s.y, drop, (p) => hooks.onArt(p));
      }
      case 'thrower':
        return new KnifeThrower(x + px(1), feet - px(28));
      case 'dog':
        return new Dog(x + px(1), feet - px(10));
      case 'hawk':
        return new Hawk(x + px(2), tileToSub(s.y) + px(3), pits);
      default:
        return undefined;
    }
  };
}
