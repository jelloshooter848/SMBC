import type { Entity } from '../entities/entity';
import type { Player } from '../entities/player';

/** Every way something can be hurt in this game. Characters add their own kinds (sword, buster). */
export type DamageKind =
  | 'stomp'
  | 'fireball'
  | 'shell'
  | 'star'
  | 'bump'
  | 'sword'
  | 'buster'
  | 'contact'
  | 'lava'
  | 'axe'
  | 'bomb' // explosions
  | 'boomerang' // stuns rather than kills
  | 'weapon' // special weapons (Mega Man's arsenal)
  | 'ice'; // freezes (stuns) like the boomerang

/** How an enemy reacts to a damage kind. */
export type Reaction =
  | 'kill' // dies (squashed for stomps, flipped off-screen otherwise)
  | 'flip' // knocked upside down and off the screen
  | 'shell' // retreats into a shell (koopas)
  | 'hp' // loses hit points
  | 'immune' // nothing happens
  | 'stun' // frozen in place for a while; any later hit kills
  | 'bounce' // popped up by a block bumped under it, unhurt and unscored (koopa shells, spinies)
  | 'hurtAttacker' // the attacker takes damage instead (spiny stomp, piranha stomp)
  /**
   * Classic rules only (rules/classic-enemies.ts, HP-C14): armour stopped the hit. No damage, no
   * score; callers treat it like 'immune' except that the weapon does its blocked behaviour
   * (ProjectileSpec.onBlocked). Current never returns it.
   */
  | 'blocked';

export type Vulnerability = Partial<Record<DamageKind, Reaction>>;

/**
 * What a hit does under Classic rules beyond its damage (classic-enemy-hp-and-armour HP-C2,
 * HP-C16). Only Classic code sets or reads these; every field is optional and Current ignores them.
 * Frames are at 60 fps.
 */
export interface ClassicHitProps {
  /** Armour-pierce strength (0 when absent): 5 or more gets through armour (HP-C13). */
  pierce?: number;
  /** Hit-stun: the enemy does not move, animate or run its timers for this long (HP-C16). */
  stopFrames?: number;
  /** The enemy flickers for this long (cosmetic; held still under Reduce flashing). */
  flashFrames?: number;
  /** The enemy blinks invisible for this long (Mega Man's hits: 2 f). */
  blinkFrames?: number;
  /** No attack from anyone damages the enemy for this long (Samus's hits: 9 f, HP-C11). */
  invulnFrames?: number;
  /** Ice freeze: no damage, stops it this long, and it stops touching players (HP-C17). */
  freezeFrames?: number;
  /** Kills outright, ignoring HP and armour (Screw Attack, HP-C7). */
  instant?: true;
  /** Sound played when armour blocks this hit (`armour`, `bump`; none when absent; HP-C14). */
  blockedSfx?: string;
  /**
   * Sound the World plays when this hit takes hit points (`hurt-enemy` when absent): the Classic
   * enemy door names the hero's own (G-072, characters/classic/sounds.ts).
   */
  hitSfx?: string;
  /**
   * The player behind the hit when `owner` does not lead to one (the World's default melee
   * source): Classic damage units follow this player's def. Current never reads it.
   */
  by?: Player;
}

export interface DamageSource extends ClassicHitProps {
  kind: DamageKind;
  /**
   * Current: points (1-5). Classic rules: the original's damage units (a Goomba has 250) when the
   * attacker plays a Classic def; a Current def's points count CURRENT_POINT_DAMAGE each there.
   */
  amount: number;
  owner: Entity | Player | null;
  /** Direction the hit came from (+1 = attacker is to the left, hits travel right). */
  dirX: -1 | 1;
  /** Bumps only: the struck block's centre x in subpixels (the original's `g.hMidX`). */
  fromX?: number;
}

/** Default table for a plain walking enemy: anything kills it, stomps squash it. */
export const BASIC_VULNERABILITY: Vulnerability = {
  stomp: 'kill',
  fireball: 'kill',
  shell: 'kill',
  star: 'kill',
  bump: 'kill',
  sword: 'kill',
  buster: 'kill',
  lava: 'kill',
  bomb: 'kill',
  weapon: 'kill',
  boomerang: 'stun',
  ice: 'stun',
};

/** How long a boomerang stun lasts. */
export const STUN_FRAMES = 180;
