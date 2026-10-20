import type { DamageSource, Reaction } from './damage';
import type { Enemy } from '../entities/enemies/enemy';
import type { Player } from '../entities/player';
import type { World } from '../world/world';
import type { TileMap } from '../world/tilemap';
import type { CharacterDef } from '../characters/character';
import type { EntitySpawn } from '../level/schema';
import type { ClassicSettings } from '@engine/save/original-options';

/**
 * The Classic rules' doors into the shared systems (umbrella report TG-24, TG-25, TG-45).
 *
 * `Enemy.hit`, `World.strikeBlock` and the World's level load each branch on `world.rules` once
 * and, under Classic, hand over to the hook installed here. The hooks live in
 * `rules/classic-enemies.ts`, `rules/classic-bricks.ts` and `rules/classic-water.ts`; only `characters/registry.ts` (the one non-classic file allowed to
 * import classic modules, TG-39) installs them, and every World loads the registry (heroFor), so
 * they are always in place before a Classic World plays. It is one module-level singleton: tests
 * get it by importing anything that loads the registry (the World does).
 *
 * How a Classic hero def plugs in (its slice writes `characters/<id>/classic.ts`):
 * - power, hits, drops, Star: the helpers in `characters/classic/power.ts` (see its header);
 *   `behaviour.update` must call `classicBusy(p)` first and return while it is true.
 * - melee: `behaviour.meleeDamage(p, e)` returns the hit in the original's units with
 *   `owner: p` (pierce, stopFrames, blockedSfx, ...). Without it a swing is `sword` 1, which for
 *   a Classic def is 1 unit (a guard test asks every Classic def with melee to define it). Set
 *   `meleeStrikesBlocks` for swings that break bricks and bump blocks (BR-C6).
 * - shots: the weapon spec's `amount` (original units), `classicHit`, `onBlocked`,
 *   `classicBlocks` and `rehitAfter` (ProjectileSpec); blasts: `World.explode`'s `amount` and
 *   `classicHit`.
 * - blocks: `canBreakBricks` for the head, `headBumps` for heads that touch blocks as ground,
 *   and every own `world.strikeBlock` call passes its source (`{ source: 'melee' | 'shot' |
 *   'blast', damage? }`); a call without one is a head bump.
 */

/** What struck a block (classic-bricks-and-shots BR-C1). */
export type BlockSource = 'head' | 'melee' | 'shot' | 'blast';

/** A strike's strength and source; `damage` is in the original's units (a brick has 125). */
export interface BlockHit {
  source: BlockSource;
  damage?: number;
}

/** What a strike did to the block, so a shot can apply its `afterBlock` rule (BR-C9). */
export interface BlockStrike {
  /** A plain brick broke. */
  broken: boolean;
  /** An item block (or a plain brick, by a head that does not break it) was bumped. */
  bumped: boolean;
  /** The block's hit points afterwards (0 or less once broken or bumped). */
  hp: number;
}

export interface ClassicRulesHooks {
  enemyHit(e: Enemy, src: DamageSource, world: World): Reaction;
  /** A map enemy just spawned: its Classic hit points are picked now (HP-C4). */
  enemySpawned(e: Enemy, world: World): void;
  strikeBlock(
    world: World,
    tx: number,
    ty: number,
    p: Player,
    breakBricks: boolean,
    hit: BlockHit,
  ): BlockStrike;
  /**
   * The level-load edits for these heroes (TG-45: rules/classic-water.ts,
   * rules/classic-level-variants.ts); true when any applied. `spawns` is the World's own list of
   * the area's spawns (a copy of the level's), which an edit may change before they spawn.
   * `options` is the World's Classic mode options (World.classic: Replace Goombas, Piranhas).
   */
  levelEdits(
    map: TileMap,
    levelId: string,
    defs: readonly CharacterDef[],
    spawns?: EntitySpawn[],
    options?: Readonly<ClassicSettings> | null,
  ): boolean;
  /**
   * The World of a Classic area is built (players placed, map edited): the Classic Yoshi mount's
   * egg block and carried rider (2026-10-19-yoshi-build-classic-character.md YM-5, YM-7). Optional.
   */
  worldLoaded?(world: World): void;
}

let hooks: ClassicRulesHooks | null = null;

/** Called once by the registry with the Classic modules' hooks. */
export function installClassicRules(h: ClassicRulesHooks): void {
  hooks = h;
}

/** The installed Classic hooks (a Classic World always has them: see above). */
export function classicRules(): ClassicRulesHooks {
  if (!hooks) throw new Error('Classic rules hooks are not installed (import characters/registry first)');
  return hooks;
}
