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
import { heroSound } from './classic/sounds';
import { classicEnemySpawned, classicHit, classicHitSfx, isArmoured } from '../rules/classic-enemies';
import { applyCheatEdits } from '../rules/classic-cheats';
import { classicStrikeBlock } from '../rules/classic-bricks';
import { applyClassicLevelEdits } from '../rules/classic-water';
import { applyWideVariants } from '../rules/classic-level-variants';
import { applyOptionSpawns } from '../rules/classic-options-level';
import { yoshiClearHop, yoshiEggStrike, yoshiWorldLoaded } from './classic/yoshi-mount';
import {
  CLASSIC_EXPANSION_HEROES,
  CLASSIC_HERO_GAMES,
  CLASSIC_SKIN_GAMES,
  CLASSIC_SKIN_LISTS,
  CLASSIC_SLOT_ORDER,
  CLASSIC_VARIANT_DEFS,
} from './classic/skins';

// The Classic rules' doors in Enemy.hit, World.strikeBlock and the World's level load (TG-24,
// TG-25, TG-45; rules/hooks.ts): installed here because this is the one non-classic file allowed
// to import classic modules.
installClassicRules({
  enemyHit: classicHit,
  hitSfx: classicHitSfx,
  deathSfx: (def) => heroSound(def, 'death'),
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
  // Rokko Chan): skins on his slot, each with its own rules.
  ...CLASSIC_VARIANT_DEFS,
  // His variants (Rock, Cut Man, Fire Man, Ice Man, Francesca, Doropie, Rokko Chan) are
  // Classic-only defs too, so the roster lists them for the skin menu and old saves.
  ...(CLASSIC_SKIN_LISTS.megaman ?? []).filter(
    (d) => d.rules === 'classic' && d !== PROTOMAN_CLASSIC && d !== BREAKMAN_CLASSIC,
  ),
  PIT_CLASSIC,
  DARKPIT_CLASSIC,
  VICVIPER_CLASSIC,
  WARRIORS_CLASSIC,
  PEACH_CLASSIC,
  // Sir Arthur (AR-2): after Peach.
  ARTHUR_CLASSIC,
  // 0.5.0's looks (G-050..G-053): skins on Mario's, Link's, Ryu's, Bass's and Luigi's slots.
  ...[
    ...(CLASSIC_SKIN_LISTS.mario ?? []),
    ...(CLASSIC_SKIN_LISTS.link ?? []),
    ...(CLASSIC_SKIN_LISTS.ryu ?? []),
    ...(CLASSIC_SKIN_LISTS.bass ?? []),
  ].filter((d) => d.rules === 'classic' && d.id !== 'bass'),
  ...(CLASSIC_SKIN_LISTS.luigi ?? []).filter((d) => d.rules === 'classic' && d.id !== 'peach'),
  // Yoshi (YO-2): last.
  YOSHI_CLASSIC,
];

/**
 * Classic mode's skins (FU-8): by select-slot hero id, the looks that slot can wear, its own
 * first, in the original's skin order. A skin brings its own rules with it, as the original's do
 * (SkinDescriptions.as), so each is a whole Classic def; the select's skin menu chooses among
 * them, and the choice is remembered per hero (Settings.classicSkins).
 */
export const CLASSIC_SKINS: Readonly<Record<string, readonly CharacterDef[]>> = CLASSIC_SKIN_LISTS;

/** The select's slots, in the original's order (classic/skins.ts), by hero id. */
export const CLASSIC_SLOTS: readonly string[] = CLASSIC_SLOT_ORDER;

/** The heroes Options > Expansion heroes adds, by hero id (the original has none of them). */
export const EXPANSION_HEROES: readonly string[] = CLASSIC_EXPANSION_HEROES;

/** Hero `def` is one of a slot's other looks (never a slot of its own). */
export function isSkin(def: CharacterDef): boolean {
  return skinHost(def) !== def;
}

/** The slot hero `def` is a skin of (itself when it is no other hero's skin). */
export function skinHost(def: CharacterDef): CharacterDef {
  for (const list of Object.values(CLASSIC_SKINS)) if (list.slice(1).includes(def)) return list[0] ?? def;
  return def;
}

/** The game hero `def` (a select slot's hero, or one of its skins) comes from; '' when unknown. */
export function heroGame(def: CharacterDef): string {
  return CLASSIC_HERO_GAMES[skinHost(def).id] ?? '';
}

/** Skin `def`'s source game (its own, else its hero's). */
export function skinGame(def: CharacterDef): string {
  return CLASSIC_SKIN_GAMES[def.id] ?? heroGame(def);
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
