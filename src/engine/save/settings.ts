import type { PaletteMode } from '../gfx/palette';
import type { PlayerBindings } from '../input/bindings';
import { defaultBindings } from '../input/bindings';
import { loadJson, saveJson } from './storage';
import { defaultClassicSettings, normaliseClassic, type ClassicSettings } from './original-options';

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
   * After each castle's first clear, a card offers to back up the file as a save code (Options >
   * Save files > Backup reminders, 0.4.44). On by default; older settings files get it on.
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
   * original SMBC's, the default) or 'current'. Campaign files always play 'current'.
   */
  classicRules: ClassicRules;
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
   * Classic mode's cheats (the original's Cheats menu, Cheats.as): which are on, which are
   * unlocked, and the counts their unlock goals read (StatManager.as). Its own key, deep-merged
   * into older files (every field defaults to the original's: all off, most locked).
   */
  classicCheats: ClassicCheatsSettings;
}

/** The original's cheats (Cheats.as), minus its no-ops (Classic Samus, Classic Simon) and Level Select. */
export const CLASSIC_CHEAT_IDS = [
  'allGroundIsBricks',
  'allHammerBros',
  'allWeaponsPierce',
  'alwaysBreakBricks',
  'bouncyPits',
  'classicScreenScroll',
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
  /** The games beaten in Classic mode (StatManager.beatGame): SMB, The Lost Levels. */
  beaten: { smb: boolean; lost: boolean };
  /**
   * Continues used in Classic mode over the save's whole life (StatManager.numContinuesUsed is a
   * saved stat): Infinite Lives unlocks only while it is 0 when a game is beaten.
   */
  continuesUsed: number;
}

/** Unlocked from the start in the original (Cheats.as: their `locked` is false). */
const OPEN_CHEATS: readonly ClassicCheatId[] = ['classicScreenScroll', 'everyoneCanStomp'];

export function defaultClassicCheats(): ClassicCheatsSettings {
  const flags = (v: (id: ClassicCheatId) => boolean) =>
    Object.fromEntries(CLASSIC_CHEAT_IDS.map((id) => [id, v(id)])) as Record<ClassicCheatId, boolean>;
  return {
    on: flags(() => false),
    unlocked: flags((id) => OPEN_CHEATS.includes(id)),
    stats: Object.fromEntries(CLASSIC_CHEAT_STATS.map((k) => [k, 0])) as Record<ClassicCheatStat, number>,
    beaten: { smb: false, lost: false },
    continuesUsed: 0,
  };
}

/** Settings.classicDev. */
export interface ClassicDevToggles {
  yoshiMount: boolean;
  heroesOff: string[];
}

/** Classic mode's rules (Options in the CLASSIC menu): the original SMBC's, or today's. */
export type ClassicRules = 'classic' | 'current';
export const CLASSIC_RULES: readonly ClassicRules[] = ['classic', 'current'];

export interface HomeScreenFlags {
  tipDone: boolean;
  noticeDone: boolean;
  offlineDone: boolean;
}

export const SETTINGS_KEY = 'smbc.settings';

/** The settings file's version: 2 since the quieter default master volume (0.4.49). */
export const SETTINGS_VERSION = 2;

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
    video: { integerScale: true, palette: 'default', reduceFlashing: false, showFps: false },
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
      slowMotion: 1,
    },
    packs: [],
    announce: true,
    dev: false,
    backupReminders: true,
    homeScreen: { tipDone: false, noticeDone: false, offlineDone: false },
    classicRules: 'classic',
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

export function loadSettings(): Settings {
  let stored = loadJson<Record<string, unknown>>(SETTINGS_KEY);
  if (!stored || typeof stored !== 'object') return defaultSettings();
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
  if (!CLASSIC_RULES.includes(s.classicRules)) s.classicRules = 'classic';
  for (const k of CLASSIC_CHEAT_STATS) {
    const n = s.classicCheats.stats[k];
    s.classicCheats.stats[k] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  const used = s.classicCheats.continuesUsed;
  s.classicCheats.continuesUsed = Number.isFinite(used) ? Math.max(0, Math.floor(used)) : 0;
  s.classic = normaliseClassic(s.classic);
  s.classicDev.heroesOff = s.classicDev.heroesOff.filter((id) => typeof id === 'string');
  // The merge keeps only keys the defaults have, so the skin choices are copied over here.
  const skins = normaliseSkins(stored.classicSkins);
  if (skins) s.classicSkins = skins;
  else delete s.classicSkins;
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

export function saveSettings(s: Settings): void {
  saveJson(SETTINGS_KEY, s);
}
