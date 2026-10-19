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
import { installClassicRules } from '../rules/hooks';
import { classicEnemySpawned, classicHit } from '../rules/classic-enemies';
import { classicStrikeBlock } from '../rules/classic-bricks';
import { applyClassicLevelEdits } from '../rules/classic-water';

// The Classic rules' doors in Enemy.hit, World.strikeBlock and the World's level load (TG-24,
// TG-25, TG-45; rules/hooks.ts): installed here because this is the one non-classic file allowed
// to import classic modules.
installClassicRules({
  enemyHit: classicHit,
  enemySpawned: classicEnemySpawned,
  strikeBlock: classicStrikeBlock,
  levelEdits: applyClassicLevelEdits,
});

/** Playable characters in select-screen order. */
export const CHARACTERS: CharacterDef[] = [MARIO, LUIGI, LINK, MEGAMAN, SAMUS, SIMON, RYU, BILL, SOPHIA];

/**
 * Classic SMBC defs by Current hero id (TG-17): `src/game/characters/<id>/classic.ts` exports
 * `<ID>_CLASSIC` (same id, name, hudName, portrait and music as the Current def, `rules: 'classic'`).
 * This file is the only one outside the classic modules allowed to import them (TG-39). Empty
 * until the hero slices land: a hero with no entry plays Current under Classic rules (TG-20).
 */
export const CLASSIC_CHARACTERS: Partial<Record<string, CharacterDef>> = {};

/**
 * Classic-only heroes (TG-41), in select order (Bass, Proto Man, Pit, Vic Viper, Warriors of
 * Light, ...), only the built ones; each has `rules: 'classic'`. Only Game.roster lists them
 * (Classic-rules non-campaign runs): never in CHARACTERS, heroesToFind, captives, the map or
 * the training rooms.
 */
export const CLASSIC_EXTRAS: CharacterDef[] = [];

/** The def a World plays for roster hero `def` under `rules` (TG-17). */
export function heroFor(def: CharacterDef, rules: Rules): CharacterDef {
  return rules === 'classic' ? (CLASSIC_CHARACTERS[def.id] ?? def) : def;
}

export function characterById(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? MARIO;
}
