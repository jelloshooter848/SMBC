import type { CharacterDef } from './character';
import type { Rules } from '../context';
import { MARIO } from './mario';
import { LUIGI } from './luigi';
import { LINK } from './link';
import { MEGAMAN } from './megaman';
import { SAMUS } from './samus';
import { SIMON } from './simon';
import { RYU } from './ryu';
import { BILL } from './bill';
import { SOPHIA } from './sophia';
import { MARIO_CLASSIC } from './mario/classic';
import { LUIGI_CLASSIC } from './luigi/classic';

/** Playable characters in select-screen order. */
export const CHARACTERS: CharacterDef[] = [MARIO, LUIGI, LINK, MEGAMAN, SAMUS, SIMON, RYU, BILL, SOPHIA];

/**
 * Classic SMBC defs by Current hero id (TG-17): `src/game/characters/<id>/classic.ts` exports
 * `<ID>_CLASSIC` (same id, name, hudName, portrait and music as the Current def, `rules: 'classic'`).
 * This file is the only one outside the classic modules allowed to import them (TG-39). Empty
 * until the hero slices land: a hero with no entry plays Current under Classic rules (TG-20).
 */
export const CLASSIC_CHARACTERS: Partial<Record<string, CharacterDef>> = {
  mario: MARIO_CLASSIC,
  luigi: LUIGI_CLASSIC,
};

/**
 * Classic-only heroes (TG-41), in select order (Bass, Proto Man, Pit, Vic Viper, Warriors of
 * Light, ...), only the built ones; each has `rules: 'classic'`. Only Game.roster lists them
 * (Classic-rules non-campaign runs): never in CHARACTERS, heroesToFind, captives, the map or
 * the training rooms.
 */
export const CLASSIC_EXTRAS: CharacterDef[] = [];

/**
 * Classic SMBC's level-load step (TG-45, rules/classic-water.ts), re-exported here because only
 * this file may import a classic module: the World calls it when its rules are 'classic'.
 */
export { applyClassicLevelEdits } from '../rules/classic-water';

/**
 * The def a World plays for roster hero `def` under `rules` (TG-17). A def that is already a
 * Classic one (an extra, or a test's stand-in) plays as itself.
 */
export function heroFor(def: CharacterDef, rules: Rules): CharacterDef {
  if (rules !== 'classic' || def.rules === 'classic') return def;
  return CLASSIC_CHARACTERS[def.id] ?? def;
}

export function characterById(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? MARIO;
}
