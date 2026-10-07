import { overlaps } from '@engine/math/aabb';
import { px } from '@engine/math/units';
import { parseTextMap } from '../../level/textmap';
import type { LevelData } from '../../level/schema';
import type { CharacterDef } from '../../characters/character';
import { CHARACTERS } from '../../characters/registry';
import type { Player } from '../../entities/player';
import { newGameState, type GameContext } from '../../context';
import { World } from '../../world/world';
import { cavernEntities } from './cavern';
import source from './area.map?raw';

/*
 * Section 1, the tank's cavern (area.map): Sophia III in side view on S1's real character def,
 * in a World of its own with a fresh GameState (the campaign is never touched). It ends at the
 * gateway on a ledge only Jason on foot reaches (a ladder up a shaft one tile wide).
 */

/** Where the cavern's fixed pieces are. */
export interface AreaLayout {
  level: LevelData;
  /** The gateway's doorway (px, level space): Jason walking into it goes in. */
  door: { x: number; y: number; w: number; h: number };
  /** The shaft's column, and the column from which the hop-out is taught (the tank arriving). */
  shaftX: number;
  teachX: number;
  /** A new life after this column starts there. */
  checkpointX: number;
}

let parsed: AreaLayout | null = null;

/** The cavern, parsed once (outside the level library: no dev select, no campaign). */
export function areaStage(): AreaLayout {
  if (parsed) return parsed;
  const level = parseTextMap(source, 'bm-underworld');
  const gate = level.decor.find((d) => d.kind === 'gateway');
  const vine = level.entities.find((e) => e.type === 'vine');
  if (!gate || !vine) throw new Error('bm-underworld: no gateway or ladder');
  // The gateway decor is 32×32 with a 12×20 doorway at the middle of its bottom.
  parsed = {
    level,
    door: { x: gate.x * 16 + 10, y: gate.y * 16 + 12, w: 12, h: 20 },
    shaftX: vine.x,
    teachX: vine.x - 6,
    checkpointX: 48,
  };
  return parsed;
}

/** Sophia's CharacterDef once S1's character is registered (the section waits for it). */
export function sophiaDef(characters: readonly CharacterDef[] = CHARACTERS): CharacterDef | null {
  return characters.find((c) => c.id === 'sophia') ?? null;
}

/**
 * Is the player on foot? Every hero but the tank is; Sophia is when Jason has hopped out
 * (S1's on-foot flag).
 */
export function onFoot(p: Player): boolean {
  if (p.def.id !== 'sophia') return true;
  const s = p.scratch as Record<string, number | undefined>;
  return (s.jason ?? 0) > 0;
}

/** Has the player walked into the gateway's doorway (on foot)? */
export function atGateway(p: Player, layout: AreaLayout = areaStage()): boolean {
  if (p.dead || p.out || !onFoot(p)) return false;
  const d = layout.door;
  return overlaps(p.body, { x: px(d.x), y: px(d.y), w: px(d.w), h: px(d.h) });
}

export interface AreaOptions {
  seed?: number;
  /** Start at this column (a checkpoint), on the floor. */
  fromX?: number;
}

/** A World for the cavern, played as `hero` with one life's fresh state. */
export function newArea(ctx: GameContext, hero: CharacterDef, opts: AreaOptions = {}): World {
  const layout = areaStage();
  const state = newGameState(hero);
  state.lives = 1;
  state.world = 8;
  state.stage = 4;
  const world = new World(layout.level, ctx, state, {
    seed: opts.seed ?? 0x5091a,
    scorePopups: false,
    extraEntities: (s) => cavernEntities(s),
    ...(opts.fromX !== undefined ? { x: opts.fromX, y: layout.level.start.y } : {}),
  });
  world.time = null;
  world.spawnInView();
  return world;
}
