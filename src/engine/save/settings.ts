import type { PaletteMode } from '../gfx/palette';
import type { PlayerBindings } from '../input/bindings';
import { defaultBindings } from '../input/bindings';
import { loadJson, saveJson } from './storage';

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
  v: 1;
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
}

export const SETTINGS_KEY = 'smbc.settings';

export function defaultSettings(): Settings {
  return {
    v: 1,
    video: { integerScale: true, palette: 'default', reduceFlashing: false, showFps: false },
    audio: { master: 0.8, music: 1, sfx: 1, muted: false },
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
  };
}

/** Ordered migrations from older stored versions; each maps v → v+1. */
const migrations: Array<(old: Record<string, unknown>) => Record<string, unknown>> = [];

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
  s.v = 1;
  // Fields added later (input.dpad, the `run` action) are filled in here; no migration needed.
  if (!TOUCH_MODES.includes(s.input.touch)) s.input.touch = 'auto';
  if (!DPAD_STYLES.includes(s.input.dpad)) s.input.dpad = 'fixed';
  s.input.touchScale = Math.max(TOUCH_SCALE_MIN, Math.min(TOUCH_SCALE_MAX, s.input.touchScale)) || 1;
  s.input.bindings = s.input.bindings.map((b, i) => fillBindings(b, i));
  return s;
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
