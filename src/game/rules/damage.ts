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
  | 'hurtAttacker'; // the attacker takes damage instead (spiny stomp, piranha stomp)

export type Vulnerability = Partial<Record<DamageKind, Reaction>>;

export interface DamageSource {
  kind: DamageKind;
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
