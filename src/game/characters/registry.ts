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
import { BILL_CLASSIC } from './bill/classic';
import { RYU_CLASSIC } from './ryu/classic';
import { LINK_CLASSIC } from './link/classic';
import { MEGAMAN_CLASSIC } from './megaman/classic';
import { BASS_CLASSIC } from './bass/classic';
import { SOPHIA_CLASSIC } from './sophia/classic';
import { installClassicRules } from '../rules/hooks';
import { classicEnemySpawned, classicHit } from '../rules/classic-enemies';
import { classicStrikeBlock } from '../rules/classic-bricks';
import { applyClassicLevelEdits } from '../rules/classic-water';
import { MARIO_CLASSIC } from './mario/classic';
import { LUIGI_CLASSIC } from './luigi/classic';
import { SAMUS_CLASSIC } from './samus/classic';
import { BREAKMAN_CLASSIC, PROTOMAN_CLASSIC } from './protoman/classic';
import { DARKPIT_CLASSIC, PIT_CLASSIC } from './pit/classic';
import { VICVIPER_CLASSIC } from './vicviper/classic';
import { WARRIORS_CLASSIC } from './warriors/classic';
import { SIMON_CLASSIC } from './simon/classic';
import { applyWideVariants } from '../rules/classic-level-variants';

// The Classic rules' doors in Enemy.hit, World.strikeBlock and the World's level load (TG-24,
// TG-25, TG-45; rules/hooks.ts): installed here because this is the one non-classic file allowed
// to import classic modules.
installClassicRules({
  enemyHit: classicHit,
  enemySpawned: classicEnemySpawned,
  strikeBlock: classicStrikeBlock,
  levelEdits: (map, id, defs, spawns) => {
    // Both tables apply.
    const water = applyClassicLevelEdits(map, id, defs);
    return applyWideVariants(map, id, defs, spawns) || water;
  },
});

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
  samus: SAMUS_CLASSIC,
  bill: BILL_CLASSIC,
  simon: SIMON_CLASSIC,
  ryu: RYU_CLASSIC,
  link: LINK_CLASSIC,
  megaman: MEGAMAN_CLASSIC,
  sophia: SOPHIA_CLASSIC,
};

/**
 * Classic-only heroes (TG-41), in select order (Bass, Proto Man, Pit, Vic Viper, Warriors of
 * Light, ...), only the built ones; each has `rules: 'classic'`. Only Game.roster lists them
 * (Classic-rules non-campaign runs): never in CHARACTERS, heroesToFind, captives, the map or
 * the training rooms.
 */
export const CLASSIC_EXTRAS: CharacterDef[] = [
  BASS_CLASSIC,
  PROTOMAN_CLASSIC,
  BREAKMAN_CLASSIC,
  PIT_CLASSIC,
  DARKPIT_CLASSIC,
  VICVIPER_CLASSIC,
  WARRIORS_CLASSIC,
];

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
