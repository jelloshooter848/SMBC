/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * K for the benchmark: schemas, dictionaries and defaults, built from the game's real registries
 * and default constructors (defaultSettings, newSave, loadProgress's empty shape, CODE_DICTS).
 */
import { defaultSettings, CLASSIC_CHEAT_IDS, CLASSIC_CHEAT_STATS } from '@engine/save/settings';
import {
  CLASSIC_ROW_VALUES,
  CLASSIC_WEAPON_VALUES,
  CLASSIC_GAME_MODES,
  CLASSIC_LIVES,
  CLASSIC_ATTACK,
  CLASSIC_WHEN_HIT,
  CLASSIC_DROPS,
  CLASSIC_PIRANHAS,
  CLASSIC_GOOMBAS,
  CLASSIC_ENEMY_SPEEDS,
} from '@engine/save/original-options';
import { BEAT_STATUSES } from '@engine/save/progress';
import { Actions } from '@engine/input/actions';
import { PALETTE_MODES } from '@engine/gfx/palette';
import { CODE_DICTS } from '@game/save/save-code';
import { newSave, SAVE_VERSION } from '@game/save/save-files';
import { CLASSIC_SLOTS, CLASSIC_EXTRAS, EXPANSION_HEROES, CHARACTERS } from '@game/characters/registry';
import { levelIds, specialLevelIds, getLevel } from '@content/levels';
import { MAP_PAGES } from '@content/worldmap';
import { bool, decimal, en, int, list, map, nul, obj, set, str, type F, type S } from './codec';

// ------------------------------------------------------------------ dictionaries (K)

const uniq = (xs: string[]) => [...new Set(xs)];
export const HEROES = CODE_DICTS.heroes as string[];
export const CLASSIC_HEROES = uniq([...CLASSIC_SLOTS, ...EXPANSION_HEROES, ...CLASSIC_EXTRAS.map((c) => c.id), ...CHARACTERS.map((c) => c.id)]);
export const CLASSIC_LEVELS = uniq([...levelIds(), ...specialLevelIds()]);
export const NODES = uniq(MAP_PAGES.flatMap((p) => p.nodes.map((n) => n.id)));
export const KIT_KEYS = uniq([
  ...Object.values(CODE_DICTS.kitFlags).flat(),
  ...Object.values(CODE_DICTS.kitNums).flat().map((k: any) => k[0]),
  ...'tier ammo triple homing throwT maxHp helmet tool hasTriple hasHoming beam tanks missiles bombs upThrust chargeT hearts guns eggs downThrust varia spin ninpo tunic swap shieldSpell jumpSpell classicAll aimUp whip weapons missileUp magic ball subs fireSpell autoT arts arrows aimY aimX weapon vvSel sub scrolls ninpoMax halfHit etanks bow bombBag beamPick vvShield scroll quiver multi boomerangOut bombsOwned yoshiRide vvSpeed vvShieldTop vvOption missileExp job'.split(' '),
]);
const L = (s: string) => s.split(' ');
export const KEY_CODES = uniq([
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => `Key${c}`),
  ...'0123456789'.split('').map((c) => `Digit${c}`),
  ...'0123456789'.split('').map((c) => `Numpad${c}`),
  ...L('ArrowLeft ArrowRight ArrowUp ArrowDown Space Enter Escape Backspace Tab ShiftLeft ShiftRight ControlLeft ControlRight AltLeft AltRight MetaLeft MetaRight CapsLock'),
  ...L('NumpadAdd NumpadSubtract NumpadMultiply NumpadDivide NumpadDecimal NumpadEnter NumpadEqual NumLock'),
  ...L('Minus Equal BracketLeft BracketRight Backslash Semicolon Quote Backquote Comma Period Slash IntlBackslash'),
  ...L('Insert Delete Home End PageUp PageDown ContextMenu PrintScreen ScrollLock Pause'),
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
  ...Array.from({ length: 20 }, (_, i) => `pad:${i}`),
  ...[0, 1, 2, 3].flatMap((a) => [`pad:axis${a}-`, `pad:axis${a}+`]),
]);
export const ITEMS = ['mushroom', 'flower', 'star', '1up'];
export const CLASSIC_TUTORIAL_IDS: string[] = []; // unknown: the escape covers them

// ------------------------------------------------------------------ settings

const actionsObj = () => obj(...Actions.map((a) => [a, list(str(KEY_CODES))] as F));
const bindings = obj(['keyboard', actionsObj()], ['gamepad', actionsObj()], ['gamepadIndex', nul(int())]);
const classicRows = obj(
  ...Object.entries(CLASSIC_ROW_VALUES).map(([k, v]) => [k, en(v as readonly unknown[])] as F),
  ['weapons', obj(...Object.entries(CLASSIC_WEAPON_VALUES).map(([k, v]) => [k, en(v as readonly unknown[])] as F))],
);
const flags16 = obj(...CLASSIC_CHEAT_IDS.map((id) => [id, bool] as F));
/** Settings fields that are device preferences (owner: video, audio, controls; plus the device notes). */
export const DEVICE_FIELDS = ['video', 'audio', 'input', 'packs', 'announce', 'homeScreen', 'backupReminders'];
export const DEV_FIELDS = ['dev', 'devUnlock', 'classicDev'];

export function settingsSchema(drop: readonly string[] = []): S & { t: 'obj' } {
  const f: F[] = [
    ['v', int()],
    ['video', obj(['integerScale', bool], ['palette', en(PALETTE_MODES)], ['reduceFlashing', bool], ['showFps', bool])],
    ['audio', obj(['master', decimal(10)], ['music', decimal(10)], ['sfx', decimal(10)], ['muted', bool])],
    [
      'input',
      obj(
        ['bindings', list(bindings)],
        ['touch', en(['auto', 'on', 'off'])],
        ['touchScale', decimal(10, 3)],
        ['dpad', en(['fixed', 'floating'])],
        ['keyHints', bool, true],
      ),
    ],
    [
      'assist',
      obj(
        ['allowLeftScroll', bool],
        ['infiniteLives', bool],
        ['invulnerable', bool],
        ['infiniteTime', bool],
        ['coyoteFrames', int()],
        ['fireRevertsToBig', bool],
        ['safetyFloor', bool],
        ['slowMotion', en([1, 2])],
      ),
    ],
    ['packs', list(str())],
    ['announce', bool],
    ['dev', bool],
    ['devUnlock', str()],
    ['backupReminders', bool],
    ['homeScreen', obj(['tipDone', bool], ['noticeDone', bool], ['offlineDone', bool]), true],
    ['classicRules', en(['classic', 'current'])],
    ['classicMapDifficulty', en(['easy', 'normal', 'hard'])],
    ['classic', classicRows],
    [
      'classicDev',
      obj(['yoshiMount', bool], ['yoshiRide', bool, true], ['heroesOff', list(str(CLASSIC_HEROES))], ['heroesOn', list(str(CLASSIC_HEROES)), true]),
    ],
    ['classicSkins', map(str(CLASSIC_HEROES), str(CLASSIC_HEROES)), true],
    ['classicHeroesOff', set(CLASSIC_HEROES), true],
    ['classicTutorials', bool, true],
    ['classicTutorialsSeen', list(str(CLASSIC_TUTORIAL_IDS)), true],
    [
      'classicCheats',
      obj(
        ['on', flags16],
        ['unlocked', flags16],
        ['stats', obj(...CLASSIC_CHEAT_STATS.map((k) => [k, int(4)] as F))],
        ['beaten', obj(['smb', bool], ['special', bool], ['lost', bool])],
        ['continuesUsed', int()],
        ['levelSelect', bool],
      ),
    ],
  ];
  return obj(...f.filter(([n]) => !drop.includes(n)));
}

export function settingsDefault(drop: readonly string[] = []): any {
  const d: any = defaultSettings();
  for (const k of drop) delete d[k];
  return d;
}

// ------------------------------------------------------------------ progress

const beatEnum = en(BEAT_STATUSES);
export const progressSchema = obj(
  ['v', int()],
  ['bestScore', int(10)],
  ['lastCharacter', str(HEROES)],
  ['reached', map(str(HEROES), str(CODE_DICTS.levels as string[]))],
  ['cleared', list(str(CODE_DICTS.levels as string[]))],
  ['lost', obj(['world9', bool], ['letters', bool], ['beaten', int()])],
  ['classicBeat', obj(['smb', beatEnum], ['special', beatEnum], ['lost', beatEnum]), true],
);
export const progressDefault = () => ({
  v: 1,
  bestScore: 0,
  lastCharacter: 'mario',
  reached: {},
  cleared: [],
  lost: { world9: false, letters: false, beaten: 0 },
  classicBeat: { smb: 'none', special: 'none', lost: 'none' },
});

// ------------------------------------------------------------------ campaign SaveFile

const POWER = en(['small', 'big', 'fire', 'full']);
const kitS = map(str(KIT_KEYS), int());
const heroPower = obj(['powerState', POWER], ['hp', int()], ['kit', kitS]);
const LEVELS = CODE_DICTS.levels as string[];
const PAGES = CODE_DICTS.pages as string[];

export function saveSchema(dropFields: readonly string[] = []): S {
  const f: F[] = [
    ['v', int()],
    ['slot', int()],
    ['created', int(30)],
    ['updated', int(30)],
    ['character', str(HEROES)],
    ['character2', nul(str(HEROES))],
    ['lives', int(2)],
    ['score', int(10)],
    ['coins', int(4)],
    ['powerState', POWER],
    ['hp', int()],
    ['kit', kitS],
    ['powerState2', POWER],
    ['hp2', int()],
    ['kit2', kitS],
    ['cleared', set(LEVELS)],
    ['pages', set(PAGES)],
    ['secrets', set(CODE_DICTS.secrets as string[])],
    ['position', obj(['page', str(PAGES)], ['node', str(NODES)])],
    ['gameCleared', bool],
    ['lastNode', map(str(PAGES), str(NODES))],
    ['pendingReveal', list(str())],
    ['devUnlockAll', bool, true],
    ['devAllHeroes', bool, true],
    ['devGateOpen', bool, true],
    ['freed', set(HEROES)],
    ['tutorials', set(HEROES), true],
    ['met', set(CODE_DICTS.met as string[]), true],
    ['inventoryUnlocked', bool, true],
    ['bonusOpen', bool, true],
    ['bonusGuard', bool, true],
    ['inventory', list(str(ITEMS)), true],
    ['bonusNext', int(), true],
    ['spadeBoard', int(), true],
    ['spadeTaken', list(int()), true],
    ['devInventory', bool, true],
    ['itemsNext', list(str(ITEMS)), true],
    ['heroInventory', map(str(HEROES), list(str(ITEMS))), true],
    ['heroItemsNext', map(str(HEROES), list(str(ITEMS))), true],
    ['heroKits', map(str(HEROES), heroPower), true],
    ['wallet', bool],
    ['story', set(CODE_DICTS.story as string[]), true],
    ['explained', set(CODE_DICTS.explained as string[]), true],
  ];
  const body = obj(...f.filter(([n]) => !dropFields.includes(n)));
  return {
    t: 'keyed',
    head: ['slot', 'character', 'character2'],
    mk: (h: any) => {
      const d: any = { ...newSave(h.slot, h.character, h.character2 ?? null), created: 0, updated: 0 };
      d.v = SAVE_VERSION;
      for (const k of dropFields) delete d[k];
      return d;
    },
    body,
  };
}

// ------------------------------------------------------------------ Classic slot: ClassicResume (main + PR #193 heroKits)

const CL = str(CLASSIC_LEVELS);
const CH = str(CLASSIC_HEROES);
const classicPower = obj(['powerState', POWER], ['hp', int()], ['kit', kitS]);
export function levelWS(id: string): { world: number; stage: number } {
  try {
    const l = getLevel(id);
    return { world: l.world, stage: l.stage };
  } catch {
    return { world: 1, stage: 1 };
  }
}
export function resumeSchema(drop: readonly string[] = []): S {
  const f: F[] = [
    ['v', int()],
    ['levelId', CL],
    ['rules', en(['classic', 'current'])],
    ['hero', CH],
    ['score', int(10)],
    ['coins', int(3)],
    ['lives', int(2)],
    ['world', int()],
    ['stage', int()],
    ['powerState', POWER],
    ['hp', int()],
    ['kit', kitS],
    ['warped', bool],
    ['checkpoint', nul(obj(['level', CL], ['x', int(5)], ['y', int(3), true]))],
    ['survival', obj(['fallen', set(CLASSIC_HEROES)], ['reviveAllowed', bool]), true],
    ['difficulty', en(['easy', 'normal', 'hard']), true],
    ['gameMode', en(CLASSIC_GAME_MODES), true],
    ['heroKits', map(CH, classicPower), true],
    ['savedAt', int(30), true],
  ];
  return {
    t: 'keyed',
    head: ['levelId'],
    // K's default for a slot: the level's own world and stage (keepResume writes them from the
    // level), the run's start values, and Classic rules on Normal / All Characters.
    mk: (h: any) => ({
      v: 1,
      levelId: h.levelId,
      rules: 'classic',
      hero: 'mario',
      score: 0,
      coins: 0,
      lives: 3,
      ...levelWS(h.levelId),
      powerState: 'small',
      hp: 0,
      kit: {},
      warped: false,
      checkpoint: null,
      difficulty: 'normal',
      gameMode: 'all',
    }),
    body: obj(...f.filter(([n]) => !drop.includes(n))),
  };
}

// ------------------------------------------------------------------ Classic file: planned B-L (DESIGN, placeholder names as the sample has them)

const orig = (xs: readonly unknown[]) => en(['original', ...xs]);
export function blSchema(drop: readonly string[] = []): S {
  const f: F[] = [
    ['v', int()],
    ['levelId', CL],
    ['hero', CH],
    ['score', int(10)],
    ['coins', int(3)],
    ['lives', int(2)],
    ['powerState', POWER],
    ['hp', int()],
    ['kit', kitS],
    ['heroKits', map(CH, classicPower)],
    ['checkpoint', nul(obj(['x', int(5)], ['y', int(3), true], ['level', CL, true]))],
    ['continues', int()],
    [
      'rules',
      obj(
        ['difficulty', en(['easy', 'normal', 'hard'])],
        ['gameMode', en(CLASSIC_GAME_MODES)],
        [
          'more',
          obj(
            ['lives', orig(CLASSIC_LIVES)],
            ['attack', orig(CLASSIC_ATTACK)],
            ['whenHit', orig(CLASSIC_WHEN_HIT)],
            ['drops', orig(CLASSIC_DROPS)],
            ['piranhas', orig(CLASSIC_PIRANHAS)],
            ['goombas', orig(CLASSIC_GOOMBAS)],
            ['enemySpeed', orig(CLASSIC_ENEMY_SPEEDS)],
          ),
        ],
        ['weapons', map(str(Object.keys(CLASSIC_WEAPON_VALUES)), str(uniq(Object.values(CLASSIC_WEAPON_VALUES).flat() as string[])))],
        ['disabled', set(CLASSIC_HEROES)],
      ),
    ],
    ['survival', obj(['fallen', set(CLASSIC_HEROES)], ['reviveAllowed', bool]), true],
    ['warped', bool, true],
    ['savedAt', int(30), true],
  ];
  return {
    t: 'keyed',
    head: ['levelId'],
    mk: () => ({
      v: 1,
      hero: 'mario',
      score: 0,
      coins: 0,
      lives: 3,
      powerState: 'small',
      hp: 0,
      kit: {},
      heroKits: {},
      checkpoint: null,
      continues: 0,
      rules: {
        difficulty: 'normal',
        gameMode: 'all',
        more: { lives: 'original', attack: 'original', whenHit: 'original', drops: 'original', piranhas: 'original', goombas: 'original', enemySpeed: 'original' },
        weapons: {},
        disabled: [],
      },
    }),
    body: obj(...f.filter(([n]) => !drop.includes(n))),
  };
}

// ------------------------------------------------------------------ the whole profile

export const SETS = ['smb', 'special', 'lost'] as const;
export const RESUME_KEYS = SETS.map((s) => `smbc-classic-resume-${s}`);
export const BL_KEYS = SETS.flatMap((s) => [1, 2, 3].map((n) => `smbc-classic-file-${s}-${n}`));

export type Policy = 'exact' | 'semantic' | 'portable';

export function profileSchema(policy: Policy): S & { t: 'obj' } {
  const sDrop = policy === 'exact' ? [] : policy === 'semantic' ? DEV_FIELDS : [...DEV_FIELDS, ...DEVICE_FIELDS];
  const fDrop = policy === 'exact' ? [] : ['created', 'updated', 'devUnlockAll', 'devAllHeroes', 'devGateOpen', 'devInventory'];
  const cDrop = policy === 'exact' ? [] : ['savedAt'];
  return obj(
    ['smbc.settings', settingsSchema(sDrop), true],
    ['smbc.progress', progressSchema, true],
    ...[1, 2, 3].map((n) => [`smbc.save.${n}`, saveSchema(fDrop), true] as F),
    ...RESUME_KEYS.map((k) => [k, resumeSchema(cDrop), true] as F),
    ...BL_KEYS.map((k) => [k, blSchema(cDrop), true] as F),
  );
}
export function profileDefault(policy: Policy): any {
  const sDrop = policy === 'exact' ? [] : policy === 'semantic' ? DEV_FIELDS : [...DEV_FIELDS, ...DEVICE_FIELDS];
  return { 'smbc.settings': settingsDefault(sDrop), 'smbc.progress': progressDefault() };
}

/** What a policy keeps of a stored profile (the semantic-equivalence rule, applied to the input). */
export function applyPolicy(data: Record<string, any>, policy: Policy): Record<string, any> {
  const d = structuredClone(data);
  if (policy === 'exact') return d;
  const s = d['smbc.settings'];
  if (s) for (const k of policy === 'semantic' ? DEV_FIELDS : [...DEV_FIELDS, ...DEVICE_FIELDS]) delete s[k];
  for (const n of [1, 2, 3]) {
    const f = d[`smbc.save.${n}`];
    if (f) for (const k of ['created', 'updated', 'devUnlockAll', 'devAllHeroes', 'devGateOpen', 'devInventory']) delete f[k];
  }
  for (const k of [...RESUME_KEYS, ...BL_KEYS]) if (d[k]) delete d[k].savedAt;
  return d;
}
