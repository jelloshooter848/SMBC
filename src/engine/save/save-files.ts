import type { MapProgress } from '@game/map/types';
import type { CharacterDef } from '@game/characters/character';
import { newGameState, type GameState } from '@game/context';
import { loadJson, removeKey, saveJson } from './storage';

/**
 * Three campaign save files (world map progress plus the run: lives, score, coins, heroes and
 * their power). Dev starts, `?level=`, custom/shared levels and editor play-tests never touch them.
 */
export type SaveSlot = 1 | 2 | 3;
export const SAVE_SLOTS: readonly SaveSlot[] = [1, 2, 3];

export interface SaveFile extends MapProgress {
  v: 1;
  slot: SaveSlot;
  /** ms since the epoch. */
  created: number;
  updated: number;
  /** CharacterDef ids. */
  character: string;
  character2: string | null;
  lives: number;
  score: number;
  coins: number;
  powerState: string;
  hp: number;
  kit: Record<string, number>;
  powerState2: string;
  hp2: number;
  kit2: Record<string, number>;
  /** 8-4 was beaten on this file. */
  gameCleared: boolean;
}

export const SAVE_VERSION = 1;

export function saveKey(slot: SaveSlot): string {
  return `smbc.save.${slot}`;
}

/** Ordered migrations from older stored versions; each maps v → v+1 (index 0 maps v1 → v2). */
export type SaveMigration = (old: Record<string, unknown>) => Record<string, unknown>;
export const SAVE_MIGRATIONS: SaveMigration[] = [];

/** A fresh file: World 1, standing on its start node, 3 lives (5 with two players). */
export function newSave(slot: SaveSlot, character: string, character2: string | null = null): SaveFile {
  const now = Date.now();
  return {
    v: 1,
    slot,
    created: now,
    updated: now,
    character,
    character2,
    lives: character2 ? 5 : 3,
    score: 0,
    coins: 0,
    powerState: 'small',
    hp: 0,
    kit: {},
    powerState2: 'small',
    hp2: 0,
    kit2: {},
    cleared: [],
    worlds: [1],
    secrets: [],
    position: { world: 1, node: 'start' },
    gameCleared: false,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const str = (x: unknown, d: string): string => (typeof x === 'string' ? x : d);
const strs = (x: unknown, d: string[]): string[] =>
  Array.isArray(x) ? x.filter((e): e is string => typeof e === 'string') : d;
function kit(x: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (isObj(x))
    for (const [k, v] of Object.entries(x)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return out;
}

/**
 * Bring stored data up to the current version (running `migrations`) and merge it over a fresh
 * file's defaults, dropping anything of the wrong type. Returns null for data that isn't a save
 * file at all or comes from an unknown (newer or invalid) version.
 */
export function migrateSave(
  raw: unknown,
  slot: SaveSlot,
  migrations: readonly SaveMigration[] = SAVE_MIGRATIONS,
): SaveFile | null {
  if (!isObj(raw)) return null;
  let stored = raw;
  let v = stored.v;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return null;
  while (v < SAVE_VERSION + migrations.length) {
    const m = migrations[v - 1];
    if (!m) return null;
    stored = m(stored);
    if (!isObj(stored)) return null;
    v++;
  }
  if (v !== SAVE_VERSION + migrations.length) return null; // from a newer build
  if (typeof stored.character !== 'string') return null;
  const d = newSave(slot, stored.character, typeof stored.character2 === 'string' ? stored.character2 : null);
  const pos = isObj(stored.position) ? stored.position : {};
  const worlds = Array.isArray(stored.worlds)
    ? stored.worlds.filter((w): w is number => typeof w === 'number' && Number.isInteger(w) && w >= 1)
    : [];
  if (!worlds.includes(1)) worlds.unshift(1);
  return {
    ...d,
    created: num(stored.created, d.created),
    updated: num(stored.updated, d.updated),
    lives: num(stored.lives, d.lives),
    score: num(stored.score, d.score),
    coins: num(stored.coins, d.coins),
    powerState: str(stored.powerState, d.powerState),
    hp: num(stored.hp, d.hp),
    kit: kit(stored.kit),
    powerState2: str(stored.powerState2, d.powerState2),
    hp2: num(stored.hp2, d.hp2),
    kit2: kit(stored.kit2),
    cleared: strs(stored.cleared, d.cleared),
    worlds,
    secrets: strs(stored.secrets, d.secrets),
    position: { world: num(pos.world, d.position.world), node: str(pos.node, d.position.node) },
    gameCleared: stored.gameCleared === true,
  };
}

/** The file in `slot`, or null when the slot is empty, corrupt or from an unknown version. */
export function loadSave(slot: SaveSlot): SaveFile | null {
  return migrateSave(loadJson<unknown>(saveKey(slot)), slot);
}

/** Stores the file in its slot and stamps `updated`. Returns false when storage is unavailable. */
export function writeSave(save: SaveFile): boolean {
  save.updated = Date.now();
  return saveJson(saveKey(save.slot), save);
}

export function eraseSave(slot: SaveSlot): void {
  removeKey(saveKey(slot));
}

/** All three slots in order; empty slots are null. */
export function listSaves(): (SaveFile | null)[] {
  return SAVE_SLOTS.map(loadSave);
}

/** Main levels 1-1..8-4 cleared on the file (out of 32). */
export function clearedMainLevels(save: MapProgress): number {
  return new Set(save.cleared.filter((id) => /^[1-8]-[1-4]$/.test(id))).size;
}

/** Highest world reached. */
export function highestWorld(save: MapProgress): number {
  return Math.max(1, ...save.worlds);
}

function validPower(c: CharacterDef, power: string): boolean {
  return c.damage.kind === 'powerup' ? power !== 'full' && power !== '' : power === 'full';
}

/**
 * A GameState for playing the file. Heroes are looked up by id (an unknown id falls back to the
 * first character, starting fresh); power, hp and kit carry over when they suit the hero.
 */
export function stateFromSave(save: SaveFile, characters: readonly CharacterDef[]): GameState {
  const first = characters[0] as CharacterDef;
  const c1 = characters.find((c) => c.id === save.character);
  const c2 = save.character2 === null ? null : (characters.find((c) => c.id === save.character2) ?? first);
  const s = newGameState(c1 ?? first, c2);
  s.lives = save.lives;
  s.score = save.score;
  s.coins = save.coins;
  s.world = save.position.world;
  s.stage = 1;
  if (c1 && validPower(c1, save.powerState)) {
    s.powerState = save.powerState;
    if (c1.damage.kind === 'hp' && save.hp > 0) s.hp = save.hp;
    s.kit = { ...save.kit };
  }
  const c2Known = c2 !== null && characters.some((c) => c.id === save.character2);
  if (c2 && c2Known && validPower(c2, save.powerState2)) {
    s.powerState2 = save.powerState2;
    if (c2.damage.kind === 'hp' && save.hp2 > 0) s.hp2 = save.hp2;
    s.kit2 = { ...save.kit2 };
  }
  return s;
}

/** A copy of `save` with the run's lives, score, coins, heroes and power taken from `state`. */
export function saveFromState(save: SaveFile, state: GameState): SaveFile {
  return {
    ...save,
    character: state.character.id,
    character2: state.character2?.id ?? null,
    lives: state.lives,
    score: state.score,
    coins: state.coins,
    powerState: state.powerState,
    hp: state.hp,
    kit: { ...state.kit },
    powerState2: state.powerState2,
    hp2: state.hp2,
    kit2: { ...state.kit2 },
  };
}
