import {
  DOORS,
  FOLK,
  GATE,
  INDOOR,
  INDOOR_AT,
  INDOOR_IDS,
  INDOOR_MUSIC,
  OUTDOOR,
  OUTDOOR_MUSIC,
  SCREEN_AT,
  SCREEN_NAMES,
  SCREENS,
  type IndoorId,
  type ScreenId,
  type TownDoor,
} from '@content/town/kakariko';
import { buildDungeon, type Dungeon, type LegendEntry, type RoomDef, type TdEntrance } from '../topdown/room';

/*
 * Kakariko Village on the top-down kit: its maps (src/content/town/kakariko.ts) turned into rooms.
 * A map character says what a cell is (a hedge, a roof); here only what it does matters, so each
 * map is written again in the kit's collision characters (floor, wall, water, a door's floor) and
 * the art layer (the art module's `townArt`, given by the caller) says how it looks.
 */

/** Outdoor cells the hero walks on: grass, paths, paving, flowers, steps, doors, the gate. */
const OUT_FLOOR = new Set(['.', ',', ':', '*', '=', 'D', '@']);
/** Indoor ones: boards, the rug, stools, the way out. */
const IN_FLOOR = new Set(['.', ':', 'b', 'D']);

/** Townsfolk in the collision maps: on floor (`&`), or on a solid tile (`%`, a sign or the well). */
export const TOWN_LEGEND: Readonly<Record<string, LegendEntry>> = {
  '&': { tile: 'floor', spawn: 'folk' },
  '%': { tile: 'wall', spawn: 'folk' },
};

/** The art for a room: each cell's pictures, reading order (src/content/sprites/town.ts). */
export type TownArt = (room: string) => readonly (readonly string[] | null)[] | undefined;

/** A room's map in the kit's characters. */
function collisionMap(room: string, map: readonly string[], floor: ReadonlySet<string>): string[] {
  return map.map((line, row) =>
    [...line]
      .map((ch, col) => {
        const folk = FOLK.some((f) => f.room === room && f.col === col && f.row === row);
        const solid = !floor.has(ch);
        if (folk) return solid ? '%' : '&';
        if (ch === '~') return '~';
        if (ch === 'D') return 'D';
        return solid ? '#' : '.';
      })
      .join(''),
  );
}

function entrancesOf(room: string, doors: readonly TownDoor[]): TdEntrance[] {
  return doors
    .filter((d) => d.room === room)
    .map((d) => ({
      id: d.id,
      col: d.col,
      row: d.row,
      enter: d.enter,
      to: d.to,
      ...(d.shut ? { shut: true } : {}),
      ...(d.needs ? { needs: d.needs } : {}),
    }));
}

/** The village's rooms: the six screens (open edges), then the rooms indoors (walled). */
export function villageRooms(art: TownArt = () => undefined, doors: readonly TownDoor[] = DOORS): RoomDef[] {
  const outdoor = SCREENS.map((id): RoomDef => {
    const map = collisionMap(id, OUTDOOR[id], OUT_FLOOR);
    if (id === GATE.room) {
      const row = map[GATE.row] as string;
      map[GATE.row] = row.slice(0, GATE.col) + '@' + row.slice(GATE.col + 1);
    }
    const a = art(id);
    return {
      id,
      at: SCREEN_AT[id],
      wall: 0,
      map,
      music: OUTDOOR_MUSIC,
      hint: SCREEN_NAMES[id],
      entrances: entrancesOf(id, doors),
      ...(a ? { art: a } : {}),
    };
  });
  const indoor = INDOOR_IDS.map((id): RoomDef => {
    const a = art(id);
    return {
      id,
      at: INDOOR_AT[id],
      map: collisionMap(id, INDOOR[id], IN_FLOOR),
      music: INDOOR_MUSIC,
      hint: indoorName(id),
      entrances: entrancesOf(id, doors),
      ...(id === 'back-room' ? { dark: true } : {}),
      ...(a ? { art: a } : {}),
    };
  });
  return [...outdoor, ...indoor];
}

/** What a room indoors is called (its front door's name). */
export function indoorName(id: IndoorId): string {
  return DOORS.find((d) => d.to === `${id}-out`)?.name ?? id.toUpperCase();
}

/** The village as a dungeon of the kit (`doors`: the village's own; a test may lock one). */
export function villageDungeon(art?: TownArt, doors: readonly TownDoor[] = DOORS): Dungeon {
  return buildDungeon(villageRooms(art, doors), TOWN_LEGEND);
}

/** Is `room` one of the outdoor screens? */
export function isOutdoor(room: string): room is ScreenId {
  return (SCREENS as readonly string[]).includes(room);
}
