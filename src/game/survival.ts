import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Player } from './entities/player';
import type { PickupKind } from './entities/objects/pickup';
import type { World } from './world/world';

/**
 * Classic mode's Survival (Options > Game mode; the original SMBC 3.1.21's CampaignModes.SURVIVAL).
 * Every hero has one life. The rules, as the original has them:
 *
 * - A new game (and every continue) starts with every hero fallen (StatManager.as 250, 287-288:
 *   DEF_P_ST_ARR_SURVIVAL is all PS_FALLEN) and revival allowed (startNewGameHandler,
 *   continueAfterDyingHandler: _allowCharacterRevival = true).
 * - Revival is allowed again after a castle (beatLevelHandler: stage 4, or world 8's stage 3) and
 *   after a warp pipe to another level (warpPipeHandler, called by EventManager.levelTransfer).
 *   Every character select uses it up (characterSelectStartHandler: false).
 * - A select with revival allowed and at least one life (CharacterSelectBox.as 133:
 *   MIN_LIVES_FOR_ALLOW_REVIVAL = 1) opens in revive mode (`reviveMode`).
 * - A death makes that hero fall and costs no life (StatManager.as 1560-1577 playerDie), unless
 *   lives are infinite, when it plays as any other mode. The run is over when every hero has
 *   fallen (EventManager.checkGameOver: checkPStateVecForAllZeroes).
 * - The pre-level card shows 1 life (InformativeBlackScreen: numLives = 1 in Survival).
 *
 * Two players: the original has no rule for them, and Classic mode has no co-op, so none is
 * needed (one player always picks).
 */
export class Survival {
  /** The fallen heroes (StatManager.pStateVec's PS_FALLEN), by hero id. */
  private readonly fallenIds = new Set<string>();
  /**
   * Heroes strengthened in revive mode and not yet played: their two power-ups (two
   * Character.hitRandomUpgrade) and revivalBoost ammo are given when they next start a level.
   * Known limit (owner-approved): Classic mode keeps no power for a hero set aside (Game.setHero
   * gives a newly picked hero its default), so a strengthened hero that is not the one playing
   * gets its two steps from small (small → Fire). The original keeps each hero's upgrades, so a
   * Big hero set aside would go Fire plus the repeat Fire Flower bonus.
   */
  private readonly boosts = new Set<string>();
  /** StatManager._allowCharacterRevival. */
  reviveAllowed = true;

  constructor(private readonly heroes: () => readonly string[]) {
    this.reset();
  }

  /** A new game or a continue (resetAllStats in Survival): every hero fallen, revival allowed. */
  reset(): void {
    this.fallenIds.clear();
    for (const id of this.heroes()) this.fallenIds.add(id);
    this.boosts.clear();
    this.reviveAllowed = true;
  }

  isFallen(id: string): boolean {
    return this.fallenIds.has(id);
  }

  /** The heroes still standing among the run's. */
  standing(): string[] {
    return this.heroes().filter((id) => !this.fallenIds.has(id));
  }

  /** checkPStateVecForAllZeroes: every hero of the run has fallen. */
  get allFallen(): boolean {
    return this.standing().length === 0;
  }

  /** playerDie in Survival: the hero falls (and loses any strengthening still waiting). */
  fall(id: string): void {
    this.fallenIds.add(id);
    this.boosts.delete(id);
  }

  /**
   * CharacterSelectBox.reviveCharacter for hero `id` (its life is paid by the caller): a fallen
   * hero stands again with nothing; a standing one is strengthened instead.
   */
  revive(id: string): 'revived' | 'strengthened' {
    if (this.fallenIds.delete(id)) return 'revived';
    this.boosts.add(id);
    return 'strengthened';
  }

  /** A strengthening waits for hero `id`. */
  boosted(id: string): boolean {
    return this.boosts.has(id);
  }

  /** Hands out hero `id`'s waiting strengthening (true once). */
  takeBoost(id: string): boolean {
    return this.boosts.delete(id);
  }

  /** beatLevelHandler: a cleared level of `world`-`stage` allows revival again at its castles. */
  levelCleared(world: number, stage: number): void {
    if (revivalAfter(world, stage)) this.reviveAllowed = true;
  }
}

/** StatManager LEV_NUM_MAX and LAST_WORLD. */
const LAST_STAGE = 4;
const LAST_WORLD = 8;

/**
 * beatLevelHandler (StatManager): clearing a world's last stage (its castle), or world 8's stage 3
 * (before Bowser's castle), allows revival at the next select.
 */
export function revivalAfter(world: number, stage: number): boolean {
  return stage === LAST_STAGE || (world === LAST_WORLD && stage === LAST_STAGE - 1);
}

/** CharacterSelectBox MIN_LIVES_FOR_ALLOW_REVIVAL: reviving needs a life to pay with. */
export const MIN_LIVES_FOR_REVIVAL = 1;

/** Steps of power a strengthening gives: Character.hitRandomUpgrade twice (CharacterSelectBox.as 424-425). */
export const STRENGTHEN_STEPS = 2;

/**
 * The heroes' revivalBoost ammo (Samus.as, Simon.as, Ryu.as, Link.as, Sophia.as: two of each
 * pickup, given without the animation), by roster hero id. Other heroes get none (Character's is
 * empty).
 */
export const REVIVAL_PICKUPS: Readonly<Record<string, readonly PickupKind[]>> = {
  samus: ['missile-pack', 'missile-pack'],
  simon: ['heart-large', 'heart-large'],
  ryu: ['ninpo-large', 'ninpo-large'],
  link: ['bomb', 'bomb', 'arrow-pack', 'arrow-pack'],
  sophia: ['homing-ammo', 'homing-ammo', 'triple-ammo', 'triple-ammo'],
};

/**
 * Gives a strengthened hero its strengthening as it starts a level: two Fire Flowers (in Classic
 * power-ups the random upgrade is the Mushroom, then the Fire Flower: StatManager.getRandomUpgrade)
 * and its revivalBoost pickups, through the hero's own power-up and pickup code, quietly and with
 * no animation (hitPickup(pickup, false)), and no points (StatManager.addPoints scores nothing at
 * character select).
 */
export function applyRevivalBoost(p: Player, world: World, heroId: string): void {
  const quiet = Object.create(world, {
    audio: { value: NULL_AUDIO },
    addScore: { value: () => {} },
  }) as World;
  for (let i = 0; i < STRENGTHEN_STEPS; i++) p.def.behaviour.onPowerUp(p, 'flower', quiet);
  for (const kind of REVIVAL_PICKUPS[heroId] ?? []) p.def.behaviour.onPickup?.(p, kind, quiet);
  if (p.transition) {
    p.transition = null;
    p.refitHitbox();
  }
}
