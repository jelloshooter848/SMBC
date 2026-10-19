import { T, tileDef } from '../level/tiles';
import type { Player } from '../entities/player';
import type { World } from '../world/world';
import type { BlockHit, BlockStrike } from './hooks';
import { CURRENT_POINT_DAMAGE } from './classic-enemies';

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

/** The Classic strike (BR-C3..BR-C12). Drops (BR-C18) come from World.bumpBlock's blockDrop. */
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
      // A Current def's blast or shot (no Classic def yet, TG-20) counts its points as the HP door does.
      const units = p.def.rules === 'classic' ? 1 : CURRENT_POINT_DAMAGE;
      const hp = (world.brickHp.get(key) ?? BRICK_HP) - (hit.damage ?? 0) * units;
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
    return { broken: true, bumped: false, hp: 0 };
  }
  // BR-C8: any item block bumps, whatever the damage, exactly as to a head bump (its HP is 0).
  world.bumpBlock(tx, ty, p, breakBricks);
  return { broken: false, bumped: true, hp: 0 };
}
