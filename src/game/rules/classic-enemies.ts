import type { DamageSource, Reaction } from './damage';
import type { CharacterDef } from '../characters/character';
import type { Enemy } from '../entities/enemies/enemy';
import { Koopa } from '../entities/enemies/koopa';
import { Goomba } from '../entities/enemies/goomba';
import { Spiny } from '../entities/enemies/spiny';
import { HammerBro } from '../entities/enemies/hammer-bro';
import { Bowser } from '../entities/enemies/bowser';
import { Cheep } from '../entities/enemies/cheep';
import type { World } from '../world/world';
import { attackMult } from '../characters/classic/options';

/**
 * Classic SMBC enemy rules (bug-reports/2026-10-07-classic-enemy-hp-and-armour.md, HP-C1..HP-C24):
 * hit points in the original's units, numeric damage, armour, hit-stun and freeze, Bowser's forms.
 * `Enemy.hit` hands every hit here while `world.rules === 'classic'` (TG-24, through
 * rules/hooks.ts). The Classic HP counter is `Enemy.classicHp`; Current's `Enemy.hp` is never read.
 */

/** Attack Strength (HP-C10): Normal, ×1. The follow-up can expose ×0.66 / ×0.75 / ×1.75 / ×3. */
export const CLASSIC_ATTACK_MULT = 1;

/**
 * A Current def's weapon under Classic rules (a hero without a Classic def yet, TG-20) sends
 * Current points (1-5); each counts this much, so Mario's fireball (1) is the original's 1000.
 */
export const CURRENT_POINT_DAMAGE = 1000;

/** Armour strength (LevObj.PIERCE_STR_ARMORED) and the pierce that gets through it (HP-C12/13). */
export const ARMOUR_STRENGTH = 5;

/** Classic HP by enemy kind (HealthValue.as; HP-C3). Kinds not listed keep their Current rules. */
export const CLASSIC_HP = {
  goomba: 250,
  koopa: 600,
  /** A Koopa spawned with wings (KoopaGreen in the fly state; it keeps this after losing them). */
  'koopa-para': 900,
  buzzy: 600,
  spiny: 350,
  'bullet-bill': 400,
  lakitu: 800,
  'hammer-bro': 800,
  piranha: 275,
  cheep: 300,
  /** A leaping Cheep Cheep (CheepFlying). */
  'cheep-flying': 200,
  blooper: 600,
  'bowser-fire': 2400,
  'bowser-hammer': 3600,
  'bowser-both': 4400,
  /** Any form while player 1 is Mario or Luigi (5 × the fireball's 1000). */
  'bowser-mario': 5000,
} as const;

/** Armoured enemies (HP-C12): Buzzy Beetle and Bullet Bill (Spiny is not). */
export function isArmoured(e: Enemy): boolean {
  return e.kind === 'bullet-bill' || (e instanceof Koopa && e.color === 'buzzy');
}

/** Resists hit-stun, boomerang stun and Ice freeze (HP-C15): Lakitu, Bowser (and fakes). */
export function resistsStop(e: Enemy): boolean {
  return e.kind === 'lakitu' || e.kind === 'bowser';
}

/** The enemy's full Classic HP (HP-C3, HP-C4), or null for one Classic leaves to Current. */
export function classicMaxHp(e: Enemy, world: World): number | null {
  if (e instanceof Bowser) {
    const lead = world.players[0]?.def.id;
    if (lead === 'mario' || lead === 'luigi') return CLASSIC_HP['bowser-mario'];
    return CLASSIC_HP[`bowser-${e.attack}`];
  }
  if (e instanceof Koopa) {
    if (e.color === 'buzzy') return CLASSIC_HP.buzzy;
    return e.spawnedWithWings ? CLASSIC_HP['koopa-para'] : CLASSIC_HP.koopa;
  }
  if (e instanceof Cheep) return e.flying ? CLASSIC_HP['cheep-flying'] : CLASSIC_HP.cheep;
  return (CLASSIC_HP as Record<string, number>)[e.kind] ?? null;
}

/**
 * A map enemy spawned under Classic rules: its full HP is set now (HP-C4: Bowser's form and
 * player 1's hero at the moment he spawns). An enemy made some other way (a Lakitu's Spiny, a
 * test's) gets it on its first hit instead; its HP depends on nothing that changes.
 */
export function classicEnemySpawned(e: Enemy, world: World): void {
  e.classicHp ??= classicMaxHp(e, world);
  if (world.classic?.enemySpeed === 'fast') speedUp(e);
}

/** ENEMY_WALK_SPEED_FAST / ENEMY_WALK_SPEED_NORMAL: More Settings > Enemy Speed: Fast (90 / 65). */
export const FAST_ENEMY_MULT = 90 / 65;

/**
 * Enemy Speed: Fast (Enemy.overwriteInitialStats: defaultWalkSpeed 90 instead of 65): the
 * enemies that walk at the default speed (Goomba and its kin Spiny, Koopas and Buzzy Beetles,
 * flying ones too, and the Hammer Bro's chase) walk ×90/65; a walk already under way keeps its
 * direction at the new speed.
 */
function speedUp(e: Enemy): void {
  if (e instanceof HammerBro) {
    e.chaseSpeed = Math.round(e.chaseSpeed * FAST_ENEMY_MULT);
    return;
  }
  if (!(e instanceof Goomba || e instanceof Koopa || e instanceof Spiny)) return;
  const old = e.walkSpeed;
  e.walkSpeed = Math.round(old * FAST_ENEMY_MULT);
  if (Math.abs(e.body.vx) === old) e.body.vx = Math.sign(e.body.vx) * e.walkSpeed;
}

/**
 * The def of the player behind a hit: `src.by`, else the owner chain followed to its end (a
 * player, their projectile, a projectile that projectile spawned, ...), if any.
 */
export function attackerDef(src: DamageSource): CharacterDef | null {
  if (src.by) return src.by.def;
  let o: unknown = src.owner;
  for (let depth = 0; depth < 16 && o && typeof o === 'object'; depth++) {
    if ('def' in o) return (o as { def: CharacterDef }).def;
    if (!('owner' in o)) break;
    o = (o as { owner: unknown }).owner;
  }
  return null;
}

/**
 * A hit's damage in the original's units (HP-C5): `amount` from a Classic def's weapon, Current
 * points × CURRENT_POINT_DAMAGE from anything else, then × CLASSIC_ATTACK_MULT and `mult` (More
 * Settings > Attack Strength, DamageValue.dmgMult: 1 at Normal), floored.
 */
export function classicDamage(src: DamageSource, mult = 1): number {
  const units = attackerDef(src)?.rules === 'classic' ? src.amount : src.amount * CURRENT_POINT_DAMAGE;
  return Math.floor(units * CLASSIC_ATTACK_MULT * mult);
}

/**
 * Kinds that keep their Current reaction (HP-C7): stomps (Mario and Luigi only), block bumps,
 * the axe and lava. The Star and a kicked shell also go this way, except that under Classic they
 * kill Bowser too.
 */
const INSTANT = new Set<DamageSource['kind']>(['stomp', 'bump', 'axe', 'lava', 'star', 'shell']);

/**
 * The Classic door (HP-C1). Returns the existing reactions so the world's scoring works: 'kill' on
 * death, 'hp' on a hit that lands, 'shell' when HP-C6 shells it, 'stun' for a freeze, 'immune'
 * while invulnerable, and 'blocked' when armour stops it (HP-C14).
 */
export function classicHit(e: Enemy, src: DamageSource, world: World): Reaction {
  if (INSTANT.has(src.kind)) {
    if (e instanceof Bowser && (src.kind === 'star' || src.kind === 'shell')) {
      e.classicKill(src, world);
      return 'kill';
    }
    return e.currentHit(src, world);
  }
  const max = classicMaxHp(e, world);
  // Not in the table: hazards (Podoboo, fire bars: immune, as today) and other games' enemies.
  if (max === null) return e.currentHit(src, world);
  if (src.instant) {
    e.classicKill(src, world);
    return 'kill';
  }
  e.classicHp ??= max;
  // HP-C11: nothing damages it during a Samus hit's invulnerability. The original still confirms
  // the hit (Enemy.confirmedHitProj -> Projectile.confirmedHit, damaged false), so a shot ends as
  // against armour (its onBlocked), with no armour sound.
  if (e.invulnFrames > 0) return 'blocked';
  // HP-C17: a frozen enemy thaws on the next hit, which then deals its damage as usual.
  const wasFrozen = e.frozen > 0;
  if (wasFrozen) {
    e.frozen = 0;
    e.stopFrames = 0;
  }
  // The freeze comes before the armour test and does no damage; Lakitu and Bowser take the hit.
  if (src.freezeFrames && !wasFrozen && !resistsStop(e)) {
    e.frozen = src.freezeFrames;
    e.stopFrames = src.freezeFrames;
    return 'stun';
  }
  if (isArmoured(e) && (src.pierce ?? 0) < ARMOUR_STRENGTH) {
    if (src.blockedSfx) world.audio.sfx(src.blockedSfx);
    return 'blocked';
  }
  const dmg = classicDamage(src, attackMult(world.classic));
  e.classicHp -= dmg;
  // Hit effects (HP-C16): a new stop replaces a running one only if it leaves more time.
  const stops = !!src.stopFrames && !resistsStop(e);
  if (stops) e.stopFrames = Math.max(e.stopFrames, src.stopFrames ?? 0);
  if (src.flashFrames) e.flashFrames = Math.max(e.flashFrames, src.flashFrames);
  if (src.blinkFrames) e.blinkFrames = Math.max(e.blinkFrames, src.blinkFrames);
  if (src.invulnFrames) e.invulnFrames = src.invulnFrames;
  if (e.classicHp <= 0) {
    e.stopFrames = 0;
    e.classicKill(src, world);
    return 'kill';
  }
  // A hit with no damage (Link's boomerang) only stops what it can stop.
  if (dmg <= 0) return stops ? 'stun' : 'immune';
  // HP-C6: Koopas and Buzzy Beetles change state with HP (no points either way).
  if (e instanceof Koopa && e.classicDamaged(e.classicHp) === 'shell') return 'shell';
  e.classicHpHit(src, world);
  return 'hp';
}
