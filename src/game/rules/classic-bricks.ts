import { px } from '@engine/math/units';
import type { Rng } from '@engine/rng';
import { T, tileDef } from '../level/tiles';
import { Pickup, type PickupKind } from '../entities/objects/pickup';
import type { Player } from '../entities/player';
import type { World } from '../world/world';
import type { BlockHit, BlockStrike } from './hooks';

/**
 * Classic SMBC block rules (bug-reports/2026-10-07-classic-bricks-and-shots.md, BR-C1..BR-C19):
 * plain bricks have 125 HP against shots and blasts, melee breaks them in one hit, any weapon
 * bumps an item block from any side, and a head bump only breaks a brick for a def whose
 * `canBreakBricks` says so (Classic defs: big Mario and Luigi only). `World.strikeBlock` hands
 * every strike here while `world.rules === 'classic'` (TG-25, through rules/hooks.ts); the hop,
 * items, coins and breaking itself stay in `World.bumpBlock`, exactly as for a head bump (BR-C12).
 */

/** A plain brick's hit points (HealthValue.as BRICK; BR-C1). */
export const BRICK_HP = 125;

/** Item Drop Rate Normal: 25 % per roll (Character.dropRate; BR-C18). */
export const BLOCK_DROP_BASE = 0.25;
/** A broken plain brick rolls at a quarter of it (6.25 %), each coin a block gives at half (12.5 %). */
export const BLOCK_DROP_FACTOR = { brick: 0.25, coin: 0.5 } as const;

/**
 * The roll a Classic def's `blockDrop` makes (BR-C18): `from` says which block drops the hero gets
 * (Link, Samus: bricks; Simon, Ryu: bricks and coins); on a hit, `pick` chooses the item (null:
 * nothing, e.g. an empty ammo table).
 */
export function blockDropRoll(
  rng: Rng,
  kind: 'brick' | 'coin',
  from: { bricks?: boolean; coins?: boolean },
  pick: (rng: Rng) => PickupKind | null,
): PickupKind | null {
  if (kind === 'brick' ? !from.bricks : !from.coins) return null;
  if (!rng.chance(BLOCK_DROP_BASE * BLOCK_DROP_FACTOR[kind])) return null;
  return pick(rng);
}

/** Simon's pick (Simon.as): a small heart 80 % of the time, a big one 20 %. */
export function heartPick(rng: Rng): PickupKind {
  return rng.chance(0.2) ? 'heart-large' : 'heart-small';
}

function dropAt(world: World, p: Player, kind: 'brick' | 'coin', tx: number, ty: number): void {
  const item = p.def.blockDrop?.(world.rng, kind, p);
  if (!item) return;
  // At the block's centre: a broken brick's drop falls from its cell, a coin block's sits on top.
  const bottom = kind === 'brick' ? (ty + 1) * px(16) : ty * px(16);
  world.spawn(new Pickup(tx * px(16) + px(8), bottom, item));
}

/** The Classic strike (BR-C3..BR-C12, BR-C18). */
export function classicStrikeBlock(
  world: World,
  tx: number,
  ty: number,
  p: Player,
  breakBricks: boolean,
  hit: BlockHit,
): BlockStrike {
  const id = world.map.get(tx, ty);
  const block = tileDef(id).block;
  const key = `${tx},${ty}`;
  if (!block) {
    world.bumpBlock(tx, ty, p, breakBricks);
    return { broken: false, bumped: false, hp: 0 };
  }
  const weapon = hit.source !== 'head';
  if (id === T.CRACKED) {
    // A cracked wall crumbles to any weapon, and to a head that breaks bricks (as today).
    world.bumpBlock(tx, ty, p, weapon || breakBricks);
    return { broken: weapon || breakBricks, bumped: false, hp: 0 };
  }
  if (block.kind === 'brick' && block.content === 'none') {
    let breaks: boolean;
    if (hit.source === 'head') breaks = breakBricks;
    else if (hit.source === 'melee')
      breaks = true; // BR-C6: one hit, whatever its damage
    else {
      // BR-C7: shots and blasts take their damage off the brick's HP; a hit it survives is silent.
      const hp = (world.brickHp.get(key) ?? BRICK_HP) - (hit.damage ?? 0);
      breaks = hp <= 0;
      if (!breaks) {
        world.brickHp.set(key, hp);
        return { broken: false, bumped: false, hp };
      }
    }
    world.bumpBlock(tx, ty, p, breaks);
    if (!breaks) {
      // BR-C4: a head bump leaves it at 0 HP, so any weapon hit breaks it next.
      world.brickHp.set(key, 0);
      return { broken: false, bumped: true, hp: 0 };
    }
    world.brickHp.delete(key);
    dropAt(world, p, 'brick', tx, ty);
    return { broken: true, bumped: false, hp: 0 };
  }
  // BR-C8: any item block bumps, whatever the damage, exactly as to a head bump (its HP is 0).
  const coin = block.content === 'coin' || block.content === 'coins10';
  world.bumpBlock(tx, ty, p, breakBricks);
  if (coin) dropAt(world, p, 'coin', tx, ty);
  return { broken: false, bumped: true, hp: 0 };
}
