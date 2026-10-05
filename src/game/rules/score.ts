import type { DamageKind } from './damage';

/**
 * Point values, from the original's com/smbc/data/ScoreValue.as. Each enemy has one value per way
 * it can die: STOMP (Enemy.stomp, the floor under the stomp sequence), ATTACK (Enemy.takeDamage:
 * fireballs, weapons, bombs), STAR (Enemy.hitCharacter with star power) and BELOW (Enemy.gBounceHit:
 * a block bumped under it).
 */
export interface KillScores {
  stomp: number;
  attack: number;
  star: number;
  below: number;
}

/** ScoreValue.as `<NAME>_STOMP / _ATTACK / _STAR / _BELOW`. */
export const ENEMY_SCORES = {
  /** Enemy.as field defaults (scoreStomp 100, scoreAttack 200, scoreStar 200, scoreBelow 100). */
  DEFAULT: { stomp: 100, attack: 200, star: 200, below: 100 },
  GOOMBA: { stomp: 100, attack: 100, star: 100, below: 100 },
  KOOPA: { stomp: 100, attack: 200, star: 200, below: 100 },
  /** KoopaGreen.overwriteInitialStats: a koopa spawned with wings keeps these for life. */
  KOOPA_FLYING: { stomp: 400, attack: 200, star: 200, below: 100 },
  // No BEETLE_* entry: Beetle.overwriteInitialStats calls KoopaGreen's after setting them, which
  // replaces them with KOOPA_*, so Buzzy Beetles score as Koopas.
  PIRANHA: { stomp: 100, attack: 200, star: 200, below: 100 },
  CHEEP: { stomp: 200, attack: 200, star: 200, below: 100 },
  BLOOPA: { stomp: 1000, attack: 200, star: 200, below: 100 },
  LAKITU: { stomp: 800, attack: 200, star: 200, below: 100 },
  SPINEY: { stomp: 100, attack: 200, star: 200, below: 100 },
  BULLET_BILL: { stomp: 200, attack: 200, star: 200, below: 200 },
  HAMMER_BRO: { stomp: 1000, attack: 1000, star: 1000, below: 1000 },
  BOWSER: { stomp: 5000, attack: 5000, star: 5000, below: 5000 },
} as const satisfies Record<string, KillScores>;

/** Which of an enemy's values a kill by `kind` scores (shell kills use SHELL_KICK_SEQ instead). */
export function killScore(s: KillScores, kind: DamageKind): number {
  switch (kind) {
    case 'stomp':
      return s.stomp;
    case 'star':
      return s.star;
    case 'bump':
      return s.below;
    default:
      return s.attack;
  }
}

/** ScoreValue.STOMP_SEQ_1..10; the 11th stomp on is STOMP_SEQ_MAX, an extra life. */
export const STOMP_SEQ = [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000] as const;
/** ScoreValue.DOUBLE_STOMP: a Goomba or Beetle stomped in the same frame as another enemy. */
export const DOUBLE_STOMP = 400;

/**
 * Enemy.stomp(): `contStomps` is the player's numContStomps once this stomp is counted (1 for the
 * first stomp since landing; Bullet Bills don't count, so theirs can be 0). The sequence value wins
 * when it beats the enemy's own STOMP value, and a double stomp is worth at least DOUBLE_STOMP.
 */
export function stompScore(contStomps: number, enemyStomp: number, doubleStomp = false): number | '1up' {
  if (contStomps > STOMP_SEQ.length) return '1up';
  const seq = contStomps >= 1 ? (STOMP_SEQ[contStomps - 1] as number) : -1;
  const points = Math.max(seq, enemyStomp);
  return doubleStomp ? Math.max(points, DOUBLE_STOMP) : points;
}

/** ScoreValue.SHELL_KICK_SEQ_1..7; the 8th enemy on is SHELL_KICK_SEQ_MAX, an extra life. */
export const SHELL_KICK_SEQ = [500, 800, 1000, 2000, 4000, 5000, 8000] as const;

/** KoopaGreen.hitEnemy: points for the `hits`-th enemy (1-based) a kicked shell knocks out. */
export function shellKickSeqScore(hits: number): number | '1up' {
  if (hits > SHELL_KICK_SEQ.length) return '1up';
  return SHELL_KICK_SEQ[Math.max(hits, 1) - 1] as number;
}

/** ScoreValue.KICK_SHELL_*, chosen in KoopaGreen.kickShell. */
export const KICK_SHELL = {
  NORMAL: 400,
  AFTER_STOMP: 500,
  WHILE_LEGS_ARE_OUT: 500,
  RIGHT_BEFORE_WALK: 1000,
} as const;

/** ScoreValue.FLAG_POLE_HEIGHT_1..5, lowest grab to highest. */
export const FLAG_POLE_HEIGHT = [100, 400, 800, 2000, 5000] as const;
/**
 * FlagPole.as SCORE_LEVEL_2..5_HEIGHT_PERC: share of the pole's height (from the bottom) the
 * player's vertical middle must reach for FLAG_POLE_HEIGHT_2..5. (SCORE_LEVEL_1 at 10% is
 * declared but never tested; anything lower scores FLAG_POLE_HEIGHT_1.)
 */
export const FLAG_POLE_HEIGHT_PERC = [0.2, 0.4, 0.65, 0.9] as const;

/**
 * FlagPole.touchPlayer: points for a grab whose vertical middle is `midY` against a pole whose hit
 * box spans `top`..`bottom` (same units; y grows downward). Same comparison as the original:
 * `hMidY <= hBot - hHeight * perc`.
 */
export function flagPoleScore(midY: number, top: number, bottom: number): number {
  const height = bottom - top;
  let tier = 0;
  for (const [i, perc] of FLAG_POLE_HEIGHT_PERC.entries()) if (midY <= bottom - height * perc) tier = i + 1;
  return FLAG_POLE_HEIGHT[tier] as number;
}
