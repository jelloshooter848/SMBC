import {
  CLASSIC_ATTACK_MULTS,
  CLASSIC_DROP_OFFSETS,
  defaultClassicSettings,
  type ClassicSettings,
  type ClassicWeapons,
} from '@engine/save/original-options';
import type { Player } from '../../entities/player';

/**
 * Classic mode's options as the Classic defs and rules read them (FU-7a, FU-7c): a player's
 * `classicOptions` (set by its World from GameContext.classic), or the original's values when it
 * has none (the campaign never plays a Classic def; tests and dev Classic Worlds without a
 * Classic mode run get the defaults). So every default plays exactly as before the options.
 */
export const ORIGINAL_OPTIONS: Readonly<ClassicSettings> = Object.freeze(defaultClassicSettings());

/** `p`'s run options, or the original's. */
export function optionsOf(p: Player | null | undefined): Readonly<ClassicSettings> {
  return p?.classicOptions ?? ORIGINAL_OPTIONS;
}

/** The Customize Weapons choice `key` for `p` (the original's weapon when none is set). */
export function weaponOf<K extends keyof ClassicWeapons>(p: Player | null | undefined, key: K): ClassicWeapons[K] {
  return optionsOf(p).weapons[key];
}

/** More Settings > Attack Strength's damage multiplier (DamageValue.dmgMult; 1 at Normal). */
export function attackMult(o: Readonly<ClassicSettings> | null | undefined): number {
  return CLASSIC_ATTACK_MULTS[(o ?? ORIGINAL_OPTIONS).attack];
}

/** More Settings > Item Drop Rate's offset to the 25 % base (RandomDropGenerator; 0 at Normal). */
export function dropOffset(p: Player | null | undefined): number {
  return CLASSIC_DROP_OFFSETS[optionsOf(p).drops];
}
