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
import { classicEnemySpawned, classicHit, isArmoured } from '../rules/classic-enemies';
import { applyCheatEdits } from '../rules/classic-cheats';
import { classicStrikeBlock } from '../rules/classic-bricks';
import { applyClassicLevelEdits } from '../rules/classic-water';
import { applyWideVariants } from '../rules/classic-level-variants';
import { applyOptionSpawns } from '../rules/classic-options-level';
import { yoshiClearHop, yoshiEggStrike, yoshiWorldLoaded } from './classic/yoshi-mount';
import { CLASSIC_SKIN_LISTS, CLASSIC_VARIANT_DEFS } from './classic/skins';

// The Classic rules' doors in Enemy.hit, World.strikeBlock and the World's level load (TG-24,
// TG-25, TG-45; rules/hooks.ts): installed here because this is the one non-classic file allowed
// to import classic modules.
installClassicRules({
  enemyHit: classicHit,
  enemySpawned: classicEnemySpawned,
  // The Classic Yoshi mount's egg block comes first (nothing with the mount off, YM-2).
  strikeBlock: (world, tx, ty, p, breakBricks, hit) =>
    yoshiEggStrike(world, tx, ty, p) ?? classicStrikeBlock(world, tx, ty, p, breakBricks, hit),
  levelEdits: (map, id, defs, spawns, options, world) => {
    // Both tables apply, then Classic mode's spawn options (Replace Goombas, Piranhas) and its
    // level-edit cheats (rules/classic-cheats.ts).
    const water = applyClassicLevelEdits(map, id, defs);
    const wide = applyWideVariants(map, id, defs, spawns);
    const opts = applyOptionSpawns(map, spawns, options);
    const cheats = world && spawns ? applyCheatEdits(map, id, spawns, world) : false;
    return opts || wide || water || cheats;
  },
  armoured: isArmoured,
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
  // Mega Man's gameplay variants (FU-3: Rock, Cut Man, Fire Man, Ice Man, Francesca and Doropie,
  // Rokko Chan), after his rival: each its own slot, Doropie a skin on Francesca's.
  ...CLASSIC_VARIANT_DEFS,
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
 * Classic mode's skins (FU-8): by select-slot hero id, the looks that slot can wear, its own
 * first. A skin plays exactly as its slot's hero (a hero that plays differently has its own slot:
 * CLASSIC_EXTRAS' variants); the select's skin picker
 chooses among them, and the choice is remembered
 * per hero (Settings.classicSkins).
 */
export const CLASSIC_SKINS: Readonly<Record<string, readonly CharacterDef[]>> = CLASSIC_SKIN_LISTS;

/** The slot hero `def` is a skin of (itself when it is no other hero's skin). */
export function skinHost(def: CharacterDef): CharacterDef {
  for (const list of Object.values(CLASSIC_SKINS)) if (list.slice(1).includes(def)) return list[0] ?? def;
  return def;
}

/** The skins hero `def`'s slot offers, its own look first (just `def` when it has none). */
export function skinsOf(def: CharacterDef): readonly CharacterDef[] {
  const host = skinHost(def);
  return CLASSIC_SKINS[host.id]?.[0] === host ? (CLASSIC_SKINS[host.id] ?? [host]) : [host];
}

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
