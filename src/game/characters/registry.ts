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
// Classic SMBC defs, in CHARACTERS order.
import { MARIO_CLASSIC } from './mario/classic';
import { LUIGI_CLASSIC } from './luigi/classic';
import { LINK_CLASSIC } from './link/classic';
import { MEGAMAN_CLASSIC } from './megaman/classic';
import { SAMUS_CLASSIC } from './samus/classic';
import { SIMON_CLASSIC } from './simon/classic';
import { RYU_CLASSIC } from './ryu/classic';
import { BILL_CLASSIC } from './bill/classic';
import { SOPHIA_CLASSIC } from './sophia/classic';
// Classic-only extras, in select order.
import { BASS_CLASSIC } from './bass/classic';
import { BREAKMAN_CLASSIC, PROTOMAN_CLASSIC } from './protoman/classic';
import { DARKPIT_CLASSIC, PIT_CLASSIC } from './pit/classic';
import { VICVIPER_CLASSIC } from './vicviper/classic';
import { WARRIORS_CLASSIC } from './warriors/classic';
import { PEACH_CLASSIC } from './peach/classic';
import { ARTHUR_CLASSIC } from './arthur/classic';
import { YOSHI_CLASSIC } from './yoshi/classic';
// The Classic rules' shared-system hooks.
import { installClassicRules } from '../rules/hooks';
import { classicEnemySpawned, classicHit } from '../rules/classic-enemies';
import { classicStrikeBlock } from '../rules/classic-bricks';
import { applyClassicLevelEdits } from '../rules/classic-water';
import { applyWideVariants } from '../rules/classic-level-variants';
import { applyOptionSpawns } from '../rules/classic-options-level';
import { yoshiClearHop, yoshiEggStrike, yoshiWorldLoaded } from './classic/yoshi-mount';

// The Classic rules' doors in Enemy.hit, World.strikeBlock and the World's level load (TG-24,
// TG-25, TG-45; rules/hooks.ts): installed here because this is the one non-classic file allowed
// to import classic modules.
installClassicRules({
  enemyHit: classicHit,
  enemySpawned: classicEnemySpawned,
  // The Classic Yoshi mount's egg block comes first (nothing with the mount off, YM-2).
  strikeBlock: (world, tx, ty, p, breakBricks, hit) =>
    yoshiEggStrike(world, tx, ty, p) ?? classicStrikeBlock(world, tx, ty, p, breakBricks, hit),
  levelEdits: (map, id, defs, spawns, options) => {
    // Both tables apply, then Classic mode's spawn options (Replace Goombas, Piranhas).
    const water = applyClassicLevelEdits(map, id, defs);
    const wide = applyWideVariants(map, id, defs, spawns);
    return applyOptionSpawns(map, spawns, options) || wide || water;
  },
  worldLoaded: yoshiWorldLoaded,
  clearHop: yoshiClearHop,
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
  link: LINK_CLASSIC,
  megaman: MEGAMAN_CLASSIC,
  samus: SAMUS_CLASSIC,
  simon: SIMON_CLASSIC,
  ryu: RYU_CLASSIC,
  bill: BILL_CLASSIC,
  sophia: SOPHIA_CLASSIC,
};

/**
 * Classic-only heroes (TG-41), in select order (Bass, Proto Man, Pit, Vic Viper, Warriors of
 * Light, Peach, Arthur, ..., Yoshi), only the built ones; each has `rules: 'classic'`. Only Game.roster lists them
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
  PEACH_CLASSIC,
  // Sir Arthur (AR-2): after Peach.
  ARTHUR_CLASSIC,
  // Yoshi (YO-2): last.
  YOSHI_CLASSIC,
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
