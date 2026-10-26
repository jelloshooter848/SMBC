import type { PaletteMode } from '../gfx/palette';
import type { PlayerBindings } from '../input/bindings';
import { defaultBindings } from '../input/bindings';
import { loadJson, saveJson, storageIsStale } from './storage';
import type { BeatDifficulty } from './progress';
import { defaultClassicSettings, normaliseClassic, type ClassicSettings } from './original-options';

/** Classic mode's map difficulties (data/MapDifficulty.as), as the beat status names them. */
export type MapDifficulty = BeatDifficulty;
export const MAP_DIFFICULTIES: readonly MapDifficulty[] = ['easy', 'normal', 'hard'];

export type TouchMode = 'auto' | 'on' | 'off';
/** Touch d-pad: drawn at a fixed spot, or a stick that centres under the thumb. */
export type DpadStyle = 'fixed' | 'floating';
export const DPAD_STYLES: readonly DpadStyle[] = ['fixed', 'floating'];
export const TOUCH_MODES: readonly TouchMode[] = ['auto', 'on', 'off'];
/**
 * Touch size range. The pad is laid out at 1 (68 px face buttons, every label at 11 px or more);
 * smaller made buttons under the 44 px touch-target size and labels unreadable, so 1 is the floor.
 */
export const TOUCH_SCALE_MIN = 1;
export const TOUCH_SCALE_MAX = 1.6;

export interface AssistSettings {
  allowLeftScroll: boolean;
  infiniteLives: boolean;
  invulnerable: boolean;
  infiniteTime: boolean;
  coyoteFrames: number;
  fireRevertsToBig: boolean;
  /** An invisible floor over deadly pits and lava (AssistOptions.safetyFloor). */
  safetyFloor: boolean;
  /** 0.4.72: what every block holds is shown over it, hidden blocks too (AssistOptions.showHidden). */
  showHidden: boolean;
  /** 1 = normal, 2 = half speed (one physics step every other frame). */
  slowMotion: 1 | 2;
}

export interface Settings {
  v: typeof SETTINGS_VERSION;
  video: { integerScale: boolean; palette: PaletteMode; reduceFlashing: boolean; showFps: boolean };
  audio: { master: number; music: number; sfx: number; muted: boolean };
  input: {
    bindings: PlayerBindings[];
    touch: TouchMode;
    touchScale: number;
    dpad: DpadStyle;
    /**
     * Key hints: a reference of the ability buttons with their bound keys beside the game (and a
     * key line on the touch buttons). Optional, so files saved before it existed need no migration.
     */
    keyHints?: boolean;
  };
  assist: AssistSettings;
  /** Enabled asset pack names, in override order. */
  packs: string[];
  /** Screen-reader announcements of menu and game events through the aria-live region. */
  announce: boolean;
  /** Developer mode (level select and test tools), unlocked with the title-screen code or ?dev=1. */
  dev: boolean;
  /**
   * The dev-mode lock this browser opened with the passphrase (its hash, game/dev-lock.ts): a
   * release build keeps `dev` only when it matches its own lock. '' when none was opened.
   */
  devUnlock: string;
  /**
   * After each castle's first clear, a card offers to back up the file as a save code (Options >
   * Save files > Backup reminders, 0.4.44). Off by default since O-08 (settings v3); the v2 -> v3
   * migration turns it off once, as v2 files cannot tell the old default from a choice.
   */
  backupReminders: boolean;
  /**
   * Home Screen notes shown once (0.4.44), kept with the settings, not a save file: the phone
   * tip after a first level (`tipDone`), and the Home Screen app's note on its own saves
   * (`noticeDone`), and the downloaded copy's note on its own saves (`offlineDone`, 0.4.49).
   * Optional, so files saved before it existed need no migration.
   */
  homeScreen?: HomeScreenFlags;
  /**
   * The rules a Classic mode run plays (title > CLASSIC > Options > Rules): 'classic' (the
   * original SMBC's, the default) or 'campaign'. A campaign file always plays Campaign rules.
   */
  classicRules: ClassicRules;
  /**
   * Classic mode's Map Difficulty (G-006; the original's New Game row, data/MapDifficulty.as):
   * Easy, Normal (the default) or Hard. A Classic run is built for it (level/layers.ts) and its
   * beat status records it. Files saved before it get Normal.
   */
  classicMapDifficulty: MapDifficulty;
  /**
   * Classic mode's options (title > CLASSIC > Options: Game Mode, More Settings, Customize
   * Weapons; save/original-options.ts), every one defaulting to the original's. Files saved
   * before them get the defaults (the deep merge, then normaliseClassic).
   */
  classic: ClassicSettings;
  /**
   * Developer toggles for Classic mode (Dev menu; read only while dev mode is on, else the
   * defaults): the Yoshi mount (off: Classic plays as the original) and the Classic heroes the
   * original SMBC 3.1.21 did not have (`heroesOff`: their ids, hidden from the Classic select).
   */
  classicDev: ClassicDevToggles;
  /**
   * Classic mode's skin picker (FU-8): each hero's chosen look, as skin id by select-slot hero id
   * (`{ protoman: 'breakman' }`). Absent or missing a hero: that hero's own look. Optional, so
   * files saved before it need no migration; loadSettings keeps its string entries.
   */
  classicSkins?: Record<string, string>;
  /**
   * Classic mode's Disable characters (G-032; GeneralOptions.as 23, 47-53): the select-slot hero
   * ids left out of the select, the Random slot and Single random. At least one hero always
   * stays (Game.heroSlots). Optional, so older files need no migration.
   */
  classicHeroesOff?: string[];
  /**
   * Classic mode's Tutorials (O-15 / G-042; the original's General > Tutorials,
   * GeneralOptions.as 25, off by default as GameSettings.as 89): the TutorialManager's boxes at
   * the select, the first start, each hero's start and each upgrade. Optional: absent is off.
   */
  classicTutorials?: boolean;
  /**
   * The Tutorials boxes shown in this Classic game (TutorialManager.saveData: each box once per
   * game, and all of them again from a new game, startNewGameHandler). Optional.
   */
  classicTutorialsSeen?: string[];
  /**
   * Classic mode's cheats (the original's Cheats menu, Cheats.as): which are on, which are
   * unlocked, and the counts their unlock goals read (StatManager.as). Its own key, deep-merged
   * into older files (every field defaults to the original's: all off, most locked).
   */
  classicCheats: ClassicCheatsSettings;
}

/**
 * The original's cheats (Cheats.as), minus Level Select. Classic Samus and Classic Simon (G-040)
 * set Samus.classicMode and Simon.classicMode (Cheats.as 327, 337): the heroes read them.
 */
export const CLASSIC_CHEAT_IDS = [
  'allGroundIsBricks',
  'allHammerBros',
  'allWeaponsPierce',
  'alwaysBreakBricks',
  'bouncyPits',
  'classicSamus',
  'classicScreenScroll',
  'classicSimon',
  'everyoneCanStomp',
  'evilHammerBros',
  'extraCheckpoints',
  'infiniteAmmo',
  'infiniteLives',
  'infiniteTime',
  'invincible',
  'waterMode',
] as const;
export type ClassicCheatId = (typeof CLASSIC_CHEAT_IDS)[number];

/** The counts the unlock goals read (StatManager.as num*), kept across runs. */
export const CLASSIC_CHEAT_STATS = [
  'enemiesDefeated',
  'enemiesStomped',
  'armouredDefeated',
  'bricksBroken',
  'ammoPickups',
  'cheepsDefeated',
  'hammerBrosDefeated',
] as const;
export type ClassicCheatStat = (typeof CLASSIC_CHEAT_STATS)[number];

export interface ClassicCheatsSettings {
  on: Record<ClassicCheatId, boolean>;
  unlocked: Record<ClassicCheatId, boolean>;
  stats: Record<ClassicCheatStat, number>;
  /**
   * The games beaten in Classic mode (StatManager.beatGame): SMB, Super Mario Bros. Special
   * (G-020; a save from before it had none, so it starts false) and The Lost Levels.
   */
  beaten: { smb: boolean; special: boolean; lost: boolean };
  /**
   * Retired (B-L): the old shared count of continues used in Classic mode. Each Classic save file
   * now keeps its own (original-files.ts ClassicFile.continues). Kept in storage untouched: the
   * files' migration reads it once for a run that had no count of its own; nothing writes it.
   */
  continuesUsed: number;
  // v0.4.73 item 94: no Level Select cheat (the original's 17th, Cheats.as:47). An old save's
  // `levelSelect` flags are dropped on its next save (loadSettings keeps only these keys).
}

/** Unlocked from the start in the original (Cheats.as: their `locked` is false). */
const OPEN_CHEATS: readonly ClassicCheatId[] = [
  'classicSamus',
  'classicScreenScroll',
  'classicSimon',
  'everyoneCanStomp',
];

export function defaultClassicCheats(): ClassicCheatsSettings {
  const flags = (v: (id: ClassicCheatId) => boolean) =>
    Object.fromEntries(CLASSIC_CHEAT_IDS.map((id) => [id, v(id)])) as Record<ClassicCheatId, boolean>;
  return {
    on: flags(() => false),
    unlocked: flags((id) => OPEN_CHEATS.includes(id)),
    stats: Object.fromEntries(CLASSIC_CHEAT_STATS.map((k) => [k, 0])) as Record<ClassicCheatStat, number>,
    beaten: { smb: false, special: false, lost: false },
    continuesUsed: 0,
  };
}

/** Settings.classicDev. */
export interface ClassicDevToggles {
  yoshiMount: boolean;
  /** The Yoshi mount is on and every level starts riding him (O-06: Off / On / Ride). */
  yoshiRide?: boolean;
  /**
   * Dev > Classic heroes (O-06): the per-hero overrides over what release players get. `heroesOff`
   * (the old Dev menu toggles, kept as they were) is the Off half, `heroesOn` the On half: shown
   * in dev mode even when not released. A hero in neither follows the release rule.
   */
  heroesOff: string[];
  heroesOn?: string[];
  /**
   * BUG-10, Dev > Toggle heroes > Classic > Plays as: the heroes (ids) that play their Campaign
   * design in Classic mode (Classic rules). Absent or empty: each plays its Classic design.
   */
  playsCampaign?: string[];
  /**
   * BUG-10, Dev > Toggle heroes > Campaign: the campaign heroes (ids) that play their Classic kit
   * under Campaign rules. Absent or empty: each plays its Campaign design.
   */
  playsClassic?: string[];
}

/** Classic mode's rules (Options in the CLASSIC menu): the original SMBC's, or today's. */
export type ClassicRules = 'classic' | 'campaign';
export const CLASSIC_RULES: readonly ClassicRules[] = ['classic', 'campaign'];

export interface HomeScreenFlags {
  tipDone: boolean;
  noticeDone: boolean;
  offlineDone: boolean;
}

export const SETTINGS_KEY = 'smbc.settings';

/**
 * The settings file's version: 2 since the quieter default master volume (0.4.49), 3 since the
 * backup reminders are off by default (O-08).
 */
export const SETTINGS_VERSION = 3;

/**
 * The master volume a new player starts at (0.4.49): 6 dB below the old 0.8, so the game starts
 * about level with a phone's other media instead of far louder (1-1's music: RMS -17.6 dBFS,
 * peak -6.7 dBFS, was -11.6 / -0.7). On the slider's 10% steps.
 */
export const DEFAULT_MASTER = 0.4;
/** The default before 0.4.49: a v1 file still at exactly this never changed it (migration). */
export const OLD_DEFAULT_MASTER = 0.8;

export function defaultSettings(): Settings {
  return {
    v: SETTINGS_VERSION,
    // integerScale false is Picture size: FILL, the default since 0.4.73 (owner). Saved files
    // keep their value: no migration (owner's choice B).
    video: { integerScale: false, palette: 'default', reduceFlashing: false, showFps: false },
    audio: { master: DEFAULT_MASTER, music: 1, sfx: 1, muted: false },
    input: {
      bindings: [defaultBindings(0), defaultBindings(1)],
      touch: 'auto',
      touchScale: 1,
      dpad: 'fixed',
      keyHints: false,
    },
    assist: {
      allowLeftScroll: false,
      infiniteLives: false,
      invulnerable: false,
      infiniteTime: false,
      coyoteFrames: 0,
      fireRevertsToBig: false,
      safetyFloor: false,
      showHidden: false,
      slowMotion: 1,
    },
    packs: [],
    announce: true,
    dev: false,
    devUnlock: '',
    backupReminders: false,
    homeScreen: { tipDone: false, noticeDone: false, offlineDone: false },
    classicRules: 'classic',
    classicMapDifficulty: 'normal',
    classicCheats: defaultClassicCheats(),
    classic: defaultClassicSettings(),
    classicDev: { yoshiMount: false, heroesOff: [] },
  };
}

/** Ordered migrations from older stored versions; each maps v → v+1. */
const migrations: Array<(old: Record<string, unknown>) => Record<string, unknown>> = [
  // v1 -> v2 (0.4.49): a master volume still at the old default moves to the new, quieter one;
  // any other value is the player's own choice and is kept.
  (old) => {
    const audio = old.audio;
    if (!audio || typeof audio !== 'object') return old;
    const a = audio as Record<string, unknown>;
    return a.master === OLD_DEFAULT_MASTER ? { ...old, audio: { ...a, master: DEFAULT_MASTER } } : old;
  },
  // v2 -> v3 (O-08): the backup reminders become off by default. A v2 file's `true` is the old
  // default as often as a choice (the two cannot be told apart), so it turns off once; the
  // player can turn it back on in Options > Save files.
  (old) => ({ ...old, backupReminders: false }),
];

/** Deep-merge stored values over defaults so new fields always exist. */
function merge<T>(base: T, over: unknown): T {
  if (Array.isArray(base)) return (Array.isArray(over) ? over : base) as T;
  if (base && typeof base === 'object' && over && typeof over === 'object') {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
      if (k in out) out[k] = merge(out[k], v);
    }
    return out as T;
  }
  return (typeof over === typeof base ? over : base) as T;
}

/**
 * The settings as stored now, and remembered as this tab's own read of them (item 150: a later
 * saveSettings of the returned object writes only what this tab changed since).
 */
export function loadSettings(): Settings {
  const raw = loadJson<unknown>(SETTINGS_KEY);
  const s = parseSettings(raw);
  remember(s, raw);
  return s;
}

/** Stored settings (any version, any damage) as this version's, every field normalised. */
function parseSettings(raw: unknown): Settings {
  let stored = raw as Record<string, unknown> | null;
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return defaultSettings();
  let v = Number(stored.v ?? 1);
  while (v < 1 + migrations.length) {
    const m = migrations[v - 1];
    if (!m) break;
    stored = m(stored);
    v++;
  }
  const s = merge(defaultSettings(), stored);
  s.v = SETTINGS_VERSION;
  // Fields added later (input.dpad, the `run` action) are filled in here; no migration needed.
  if (!TOUCH_MODES.includes(s.input.touch)) s.input.touch = 'auto';
  if (!DPAD_STYLES.includes(s.input.dpad)) s.input.dpad = 'fixed';
  // Item 76 (v0.4.73): the Campaign rules' old name reads as 'campaign' (the next save writes that).
  if ((s.classicRules as string) === 'current') s.classicRules = 'campaign'; // rename-campaign: keep
  if (!CLASSIC_RULES.includes(s.classicRules)) s.classicRules = 'classic';
  if (!MAP_DIFFICULTIES.includes(s.classicMapDifficulty)) s.classicMapDifficulty = 'normal';
  for (const k of CLASSIC_CHEAT_STATS) {
    const n = s.classicCheats.stats[k];
    s.classicCheats.stats[k] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  // B-L: classicCheats.continuesUsed is retired (each Classic save file keeps its own count);
  // it is kept as stored, read once by the files' migration, and never written.
  s.classic = normaliseClassic(s.classic);
  s.classicDev.heroesOff = s.classicDev.heroesOff.filter((id) => typeof id === 'string');
  // The merge keeps only keys the defaults have: O-06's optional fields are copied over here.
  const dev = (stored.classicDev ?? {}) as Record<string, unknown>;
  const on = Array.isArray(dev.heroesOn)
    ? (dev.heroesOn as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];
  if (on.length) s.classicDev.heroesOn = on.filter((id) => !s.classicDev.heroesOff.includes(id));
  if (dev.yoshiRide === true && s.classicDev.yoshiMount) s.classicDev.yoshiRide = true;
  // BUG-10's Plays as lists, likewise.
  for (const k of ['playsCampaign', 'playsClassic'] as const) {
    const v = dev[k];
    const list = Array.isArray(v)
      ? (v as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];
    if (list.length) s.classicDev[k] = [...new Set(list)];
  }
  // The merge keeps only keys the defaults have, so the skin choices are copied over here.
  const skins = normaliseSkins(stored.classicSkins);
  if (skins) s.classicSkins = skins;
  else delete s.classicSkins;
  const off = Array.isArray(stored.classicHeroesOff)
    ? (stored.classicHeroesOff as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];
  if (off.length) s.classicHeroesOff = off;
  else delete s.classicHeroesOff;
  // Tutorials (O-15): on only when stored as true; the boxes seen, as their ids.
  if (stored.classicTutorials === true) s.classicTutorials = true;
  else delete s.classicTutorials;
  const seen = Array.isArray(stored.classicTutorialsSeen)
    ? (stored.classicTutorialsSeen as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];
  if (seen.length) s.classicTutorialsSeen = seen;
  else delete s.classicTutorialsSeen;
  s.input.touchScale = Math.max(TOUCH_SCALE_MIN, Math.min(TOUCH_SCALE_MAX, s.input.touchScale)) || 1;
  s.input.bindings = s.input.bindings.map((b, i) => fillBindings(b, i));
  return s;
}

/**
 * Slots older saves kept skin choices under that are now looks of another slot's hero: the choice
 * moves to that hero (Proto Man's Break Man and Francesca's Doropie to Mega Man, Pit's Dark Pit to
 * Samus), so the look is kept.
 */
const OLD_SKIN_SLOTS: Readonly<Record<string, string>> = {
  protoman: 'megaman',
  francesca: 'megaman',
  pit: 'samus',
};

/** Settings.classicSkins as stored: its string entries (hero id to skin id), or undefined. */
export function normaliseSkins(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, id] of Object.entries(v as Record<string, unknown>)) if (typeof id === 'string') out[k] = id;
  for (const [old, host] of Object.entries(OLD_SKIN_SLOTS)) {
    const id = out[old];
    if (id === undefined) continue;
    delete out[old];
    // A real skin choice (not the old slot's own look) moves over, unless the host already wears
    // a skin of its own choosing.
    const held = out[host];
    if (id !== old && (held === undefined || held === host)) out[host] = id;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Stored bindings predate newer actions: give any missing action its default codes. */
function fillBindings(b: PlayerBindings | null, player: number): PlayerBindings {
  const def = defaultBindings(player);
  if (!b || typeof b !== 'object') return def;
  return {
    ...b,
    keyboard: { ...def.keyboard, ...b.keyboard },
    gamepad: { ...def.gamepad, ...b.gamepad },
    gamepadIndex: b.gamepadIndex ?? null,
  };
}

/*
 * Item 150 (owner-approved, save safety): two tabs share smbc.settings. A save re-reads what is
 * stored and, when another tab wrote since this tab last read or wrote it, writes the merge of
 * the two, field by field, by SETTINGS_MERGE:
 * - 'pref': a preference: this tab's value only if this tab changed it since, else the stored.
 * - 'each': each key of it is a 'pref' of its own (a video setting, a hero's skin...).
 * - 'or': flags set once (cheat unlocks, games beaten, notes shown once): set in either stays set.
 * - 'count': counts (the cheats' goals): the stored count plus what this tab added since.
 * - 'max': a number that only grows: the larger.
 * - 'union': ids collected (the old Tutorials list): every id from both.
 * - an object: its fields, each by its own rule.
 * Every field of Settings is named here (the type requires it, and a test checks it), so a new
 * field cannot be forgotten. A SAVE DATA import or erase is not merged: a stale tab writes
 * nothing and reloads (storage.ts, the data marker).
 */
export type MergeRule =
  'pref' | 'each' | 'or' | 'count' | 'max' | 'union' | { readonly [k: string]: MergeRule };

const CHEATS_MERGE: { readonly [K in keyof ClassicCheatsSettings]-?: MergeRule } = {
  on: 'each',
  unlocked: 'or',
  stats: 'count',
  beaten: 'or',
  continuesUsed: 'max',
};

export const SETTINGS_MERGE: { readonly [K in keyof Settings]-?: MergeRule } = {
  v: 'pref',
  video: 'each',
  audio: 'each',
  input: 'each',
  assist: 'each',
  packs: 'pref',
  announce: 'pref',
  dev: 'pref',
  devUnlock: 'pref',
  backupReminders: 'pref',
  homeScreen: 'or',
  classicRules: 'pref',
  classicMapDifficulty: 'pref',
  classic: 'each',
  classicDev: 'each',
  classicSkins: 'each',
  classicHeroesOff: 'pref',
  classicTutorials: 'pref',
  classicTutorialsSeen: 'union',
  classicCheats: CHEATS_MERGE,
};

/** What this tab last read or wrote, per settings object: the stored text, and a copy. */
const synced = new WeakMap<Settings, { text: string; copy: unknown }>();

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

function remember(s: Settings, raw: unknown): void {
  synced.set(s, { text: JSON.stringify(raw ?? null), copy: clone(s) });
}

/** One field: `mine` (this tab), `base` (as this tab last read or wrote it), `theirs` (stored). */
function mergeField(rule: MergeRule, mine: unknown, base: unknown, theirs: unknown): unknown {
  if (typeof rule === 'object' || rule === 'each' || rule === 'or' || rule === 'count') {
    if (rule === 'or' && !isRecord(mine) && !isRecord(theirs)) return mine === true || theirs === true;
    if (rule === 'count' && !isRecord(mine) && !isRecord(theirs)) {
      const m = typeof mine === 'number' ? mine : 0;
      const t = typeof theirs === 'number' ? theirs : 0;
      const b = typeof base === 'number' ? base : t;
      return t + Math.max(0, m - b);
    }
    if (rule === 'each' && !isRecord(mine) && !isRecord(theirs))
      return mergeField('pref', mine, base, theirs);
    const m = isRecord(mine) ? mine : {};
    const b = isRecord(base) ? base : {};
    const t = isRecord(theirs) ? theirs : {};
    if (!isRecord(mine) && !isRecord(theirs)) return mergeField('pref', mine, base, theirs);
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(t), ...Object.keys(m), ...Object.keys(b)])) {
      const sub: MergeRule = typeof rule === 'object' ? (rule[k] ?? 'pref') : rule === 'each' ? 'pref' : rule;
      const v = mergeField(sub, m[k], b[k], t[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (rule === 'max') {
    const m = typeof mine === 'number' ? mine : 0;
    const t = typeof theirs === 'number' ? theirs : 0;
    return Math.max(m, t);
  }
  if (rule === 'union') {
    const t = Array.isArray(theirs) ? theirs : [];
    const m = Array.isArray(mine) ? mine : [];
    const all = [...t, ...m.filter((x) => !t.includes(x))];
    return all.length || mine !== undefined || theirs !== undefined ? all : undefined;
  }
  // 'pref': this tab's value only if this tab changed it.
  return same(mine, base) ? clone(theirs) : clone(mine);
}

/** Puts `src`'s fields into `target` in place (other code holds its inner objects). */
function assignInPlace(target: Record<string, unknown>, src: Record<string, unknown>): void {
  for (const k of Object.keys(target)) if (!(k in src)) delete target[k];
  for (const [k, v] of Object.entries(src)) {
    const t = target[k];
    if (isRecord(t) && isRecord(v)) assignInPlace(t, v);
    else target[k] = clone(v);
  }
}

/**
 * Writes `s`. Item 150: when another tab wrote the settings since this tab last read or wrote
 * them, `s` first takes the merge (SETTINGS_MERGE) in place, so this tab goes on with the other
 * tab's unlocks and choices too. After a SAVE DATA import or erase nothing is written (the tab
 * reloads).
 */
export function saveSettings(s: Settings): void {
  if (storageIsStale()) return;
  const raw = loadJson<unknown>(SETTINGS_KEY);
  const at = synced.get(s);
  if (at && raw !== null && JSON.stringify(raw) !== at.text) {
    const theirs = parseSettings(raw) as unknown as Record<string, unknown>;
    const merged = mergeField(
      SETTINGS_MERGE as MergeRule,
      s as unknown as Record<string, unknown>,
      at.copy,
      theirs,
    ) as Record<string, unknown>;
    merged.v = SETTINGS_VERSION;
    assignInPlace(s as unknown as Record<string, unknown>, merged);
  }
  if (saveJson(SETTINGS_KEY, s)) remember(s, clone(s));
}
