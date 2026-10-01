import type { PaletteMode } from '../gfx/palette';
import type { PlayerBindings } from '../input/bindings';
import { defaultBindings } from '../input/bindings';
import { loadJson, saveJson } from './storage';

export type TouchMode = 'auto' | 'on' | 'off';

export interface AssistSettings {
  allowLeftScroll: boolean;
  infiniteLives: boolean;
  invulnerable: boolean;
  infiniteTime: boolean;
  coyoteFrames: number;
  fireRevertsToBig: boolean;
  /** 1 = normal, 2 = half speed (one physics step every other frame). */
  slowMotion: 1 | 2;
}

export interface Settings {
  v: 1;
  video: { integerScale: boolean; palette: PaletteMode; reduceFlashing: boolean; showFps: boolean };
  audio: { master: number; music: number; sfx: number; muted: boolean };
  input: { bindings: PlayerBindings[]; touch: TouchMode; touchScale: number };
  assist: AssistSettings;
  /** Enabled asset pack names, in override order. */
  packs: string[];
  /** Screen-reader announcements of menu and game events through the aria-live region. */
  announce: boolean;
}

export const SETTINGS_KEY = 'smbc.settings';

export function defaultSettings(): Settings {
  return {
    v: 1,
    video: { integerScale: true, palette: 'default', reduceFlashing: false, showFps: false },
    audio: { master: 0.8, music: 1, sfx: 1, muted: false },
    input: { bindings: [defaultBindings(0), defaultBindings(1)], touch: 'auto', touchScale: 1 },
    assist: {
      allowLeftScroll: false,
      infiniteLives: false,
      invulnerable: false,
      infiniteTime: false,
      coyoteFrames: 0,
      fireRevertsToBig: false,
      slowMotion: 1,
    },
    packs: [],
    announce: true,
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
  return s;
}

export function saveSettings(s: Settings): void {
  saveJson(SETTINGS_KEY, s);
}
