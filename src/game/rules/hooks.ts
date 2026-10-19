import type { DamageSource, Reaction } from './damage';
import type { Enemy } from '../entities/enemies/enemy';
import type { Player } from '../entities/player';
import type { World } from '../world/world';

/**
 * The Classic rules' doors into the shared systems (umbrella report TG-24, TG-25).
 *
 * `Enemy.hit` and `World.strikeBlock` each branch on `world.rules` once and, under Classic, hand
 * the hit to the hook installed here. The hooks live in `rules/classic-enemies.ts` and
 * `rules/classic-bricks.ts`; only `characters/registry.ts` (the one non-classic file allowed to
 * import classic modules, TG-39) installs them, and every World loads the registry (heroFor), so
 * they are always in place before a Classic World plays.
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
  strikeBlock(
    world: World,
    tx: number,
    ty: number,
    p: Player,
    breakBricks: boolean,
    hit: BlockHit,
  ): BlockStrike;
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
