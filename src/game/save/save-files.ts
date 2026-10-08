import type { MapProgress, PageId } from '@game/map/types';
import { isPageId, MAP_PAGES, mapPage } from '@content/worldmap';
import { startHp, type CharacterDef } from '@game/characters/character';
import { CHARACTERS } from '@game/characters/registry';
import { newGameState, type GameState } from '@game/context';
import { hasKey, loadJson, removeKey, saveJson } from '@engine/save/storage';
import {
  bonusSaveFields,
  bonusStateFrom,
  newBonusState,
  type ItemId,
  type NextItem,
} from '@game/bonus/items';
import { CRYSTAL_BALL } from '@game/map/captives';
import { FIRST_HERO } from '@game/story/beats';

/**
 * Three campaign save files (world map progress plus the run: lives, score, coins, heroes and
 * their power). Dev starts, `?level=`, custom/shared levels and editor play-tests never touch them.
 */
export type SaveSlot = 1 | 2 | 3;
export const SAVE_SLOTS: readonly SaveSlot[] = [1, 2, 3];

export interface SaveFile extends MapProgress {
  /** Format version (SAVE_VERSION when written by this build). */
  v: number;
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
  /** The node the hero last stood on in each page visited (where map travel returns to). */
  lastNode: Record<PageId, string>;
  /** Map ids opened but not drawn in yet ('smb-4:start', 'smb-2:start>2-1'), see Game.pendingReveal. */
  pendingReveal: string[];
  /**
   * Developer mode's map menu "Unlock all": every world, level, castle and road on the map open
   * (nothing marked cleared). Only has an effect while dev mode is on; missing in older files (off).
   */
  devUnlockAll?: boolean;
  /**
   * Developer mode's map menu "All heroes": every hero can be picked on this file without freeing
   * any (`freed` is never written by it). Only has an effect while dev mode is on; missing: off.
   */
  devAllHeroes?: boolean;
  /**
   * Developer mode's map menu "Chapter 2 gate: open": the file's campaign may enter Lost Kingdom
   * levels before Chapter 2 ships (rules.chapterGated). Only has an effect while dev mode is on;
   * missing: closed. Nothing else in the file changes with it.
   */
  devGateOpen?: boolean;
  /**
   * Heroes freed on this file (CharacterDef ids, Mario always first): only these can be picked
   * in campaign play; the rest are brainwashed captives to find (docs/HEROES.md).
   */
  freed: string[];
  /**
   * Heroes whose "<HERO> TRAINING?" question was answered on this file (CharacterDef ids, each
   * once), so it is asked only the first time a hero is picked. Missing in older files: [] plus the
   * file's current heroes (validation adds them, so players already using a hero aren't asked).
   */
  tutorials?: string[];
  /**
   * Who the file has met (0.4.7; the Mini Game Arena's "found" rule, src/game/arena): CharacterDef
   * ids of heroes whose captive was talked to at least once (freed heroes count as met), plus
   * 'larry' once Larry Koopa's airship was boarded. Missing in older files: derived on load from
   * `freed` (and 'larry' from the secret `larry`). No format change.
   */
  met?: string[];
  /**
   * The SMB3 item inventory is unlocked on this file (Larry Koopa's crystal ball, 4-2's airship).
   * Missing in older files: off, but a file that has the crystal ball's secret `larry` counts as on.
   */
  inventoryUnlocked?: boolean;
  /**
   * World 4's bonus spot can be played (missing: open). It closes once used, and opens again when
   * the Hammer Bro guarding its road is beaten (docs/WORLD_MAP.md).
   */
  bonusOpen?: boolean;
  /**
   * The used bonus spot's Hammer Bro is out guarding its road: set once a level is entered from
   * the map after the bonus was used, cleared when he is beaten. Missing (older files): not out
   * yet, so he comes out after the next level.
   */
  bonusGuard?: boolean;
  /*
   * The SMB3 bonus games and item inventory (src/game/bonus, docs/BONUS.md), all optional (missing:
   * empty / 0 / off, no format bump): item ids won (at most 12), the bonus rotation's next game,
   * dev mode's "Item inventory" flag, and the items used from the map waiting for the start of the
   * next level (at most one of each kind).
   */
  inventory?: ItemId[];
  bonusNext?: number;
  /**
   * The N-spade's board in play and its cards taken on earlier visits (0.4.14, optional: missing,
   * the first board with nothing taken; bonus/rules.ts NSPADE_BOARDS, takenCards).
   */
  spadeBoard?: number;
  spadeTaken?: number[];
  devInventory?: boolean;
  itemsNext?: NextItem[];
  /**
   * The story beats this file has seen (0.4.13, src/game/story/beats.ts), each once. Missing in
   * older files (and new ones until the first save): seeded on load from the file's progress
   * (beats.ts seedSeen). No format change.
   */
  story?: string[];
}

export function saveKey(slot: SaveSlot): string {
  return `smbc.save.${slot}`;
}

/** Ordered migrations from older stored versions; each maps v → v+1 (index 0 maps v1 → v2). */
export type SaveMigration = (old: Record<string, unknown>) => Record<string, unknown>;

/** v1 world number → v2 page id. */
const smbPage = (w: unknown): unknown => (typeof w === 'number' && Number.isInteger(w) ? `smb-${w}` : w);

/** A v1 reveal id ('4:start', '1:1-4>world-2') → v2 ('smb-4:start', 'smb-1:1-4>smb-2'). */
function revealIdV2(rid: unknown): unknown {
  if (typeof rid !== 'string') return rid;
  const m = /^(\d+):(.+)$/.exec(rid);
  if (!m) return rid;
  return `smb-${m[1]}:${(m[2] as string).replace(/>world-(\d+)$/, '>smb-$1')}`;
}

/**
 * v1 → v2 (0.4.0, map pages by id): numeric `worlds` become `pages` ('smb-N'), position.world
 * becomes position.page, and lastNode keys and pendingReveal ids name pages. Anything else is
 * carried over untouched (validation in migrateSave then keeps what is well formed).
 */
export function migrateV1toV2(old: Record<string, unknown>): Record<string, unknown> {
  const { worlds, ...rest } = old;
  const out: Record<string, unknown> = { ...rest, v: 2 };
  if (Array.isArray(worlds)) out.pages = worlds.map(smbPage);
  if (isObj(old.position)) {
    const { world, ...pos } = old.position;
    out.position = { ...pos, page: smbPage(world) };
  }
  if (isObj(old.lastNode))
    out.lastNode = Object.fromEntries(
      Object.entries(old.lastNode).map(([k, v]) => [/^\d+$/.test(k) ? `smb-${k}` : k, v]),
    );
  if (Array.isArray(old.pendingReveal)) out.pendingReveal = old.pendingReveal.map(revealIdV2);
  return out;
}

/** The hero every file starts with (never locked); defined in story/beats.ts, re-exported here. */
export { FIRST_HERO };

/** Known hero ids from `ids`, Mario first, each once (unknown ids and non-strings dropped). */
export function freedHeroes(
  ids: readonly unknown[],
  characters: readonly CharacterDef[] = CHARACTERS,
): string[] {
  const known = (id: unknown): id is string => typeof id === 'string' && characters.some((c) => c.id === id);
  return [...new Set([FIRST_HERO, ...ids.filter(known)])];
}

/** Known hero ids from `ids`, each once, in order (unknown ids and non-strings dropped). */
export function tutorialHeroes(
  ids: readonly unknown[],
  characters: readonly CharacterDef[] = CHARACTERS,
): string[] {
  const known = (id: unknown): id is string => typeof id === 'string' && characters.some((c) => c.id === id);
  return [...new Set(ids.filter(known))];
}

/** Larry Koopa in `met`: his airship has been boarded on the file (src/game/arena). */
export const MET_LARRY = 'larry';

/**
 * The file's `met` list (SaveFile.met): known hero ids and 'larry' from `ids`, each once, in
 * order, then the freed heroes (always met), then 'larry' when `larrySecret` (his crystal ball).
 */
export function metIds(
  ids: readonly unknown[],
  freed: readonly string[],
  larrySecret = false,
  characters: readonly CharacterDef[] = CHARACTERS,
): string[] {
  const known = (id: unknown): id is string =>
    typeof id === 'string' && (id === MET_LARRY || characters.some((c) => c.id === id));
  return [...new Set([...ids.filter(known), ...freed, ...(larrySecret ? [MET_LARRY] : [])])];
}

/**
 * v2 → v3 (0.5.0, freeing the heroes): existing files are locked too, keeping Mario plus the
 * hero(es) they last used (`character`, `character2`).
 */
export function migrateV2toV3(old: Record<string, unknown>): Record<string, unknown> {
  return { ...old, v: 3, freed: freedHeroes([old.character, old.character2]) };
}

export const SAVE_MIGRATIONS: SaveMigration[] = [migrateV1toV2, migrateV2toV3];
/** The current format: version 1 plus one per migration. */
export const SAVE_VERSION = 1 + SAVE_MIGRATIONS.length;

/** A hero's starting power: 'small' and no hp for power-up heroes, 'full' at starting hp otherwise. */
function defaultPower(c: CharacterDef | undefined): { power: string; hp: number } {
  if (!c || c.damage.kind === 'powerup') return { power: 'small', hp: 0 };
  return { power: 'full', hp: startHp(c) };
}

/**
 * A fresh file: World 1, standing on its start node, 3 lives (5 with two players), each hero at
 * its default power (heroes are looked up by id in `characters`).
 */
export function newSave(
  slot: SaveSlot,
  character: string,
  character2: string | null = null,
  characters: readonly CharacterDef[] = CHARACTERS,
): SaveFile {
  const now = Date.now();
  const p1 = defaultPower(characters.find((c) => c.id === character));
  const p2 = defaultPower(character2 === null ? undefined : characters.find((c) => c.id === character2));
  return {
    v: SAVE_VERSION,
    slot,
    created: now,
    updated: now,
    character,
    character2,
    lives: character2 ? 5 : 3,
    score: 0,
    coins: 0,
    powerState: p1.power,
    hp: p1.hp,
    kit: {},
    powerState2: p2.power,
    hp2: p2.hp,
    kit2: {},
    cleared: [],
    pages: ['smb-1'],
    secrets: [],
    position: { page: 'smb-1', node: 'start' },
    gameCleared: false,
    lastNode: {},
    pendingReveal: [],
    devUnlockAll: false,
    devAllHeroes: false,
    devGateOpen: false,
    freed: freedHeroes([character, character2], characters),
    tutorials: tutorialHeroes([character, character2], characters),
    met: metIds([], freedHeroes([character, character2], characters), false, characters),
    inventoryUnlocked: false,
    bonusOpen: true,
    bonusGuard: false,
    ...bonusSaveFields(newBonusState()),
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);
/** A whole number in [min, max]; `d` when not a number. */
const whole = (x: unknown, d: number, min: number, max = Number.MAX_SAFE_INTEGER): number =>
  Math.min(max, Math.max(min, Math.floor(num(x, d))));
const str = (x: unknown, d: string): string => (typeof x === 'string' ? x : d);
const strs = (x: unknown, d: string[]): string[] =>
  Array.isArray(x) ? x.filter((e): e is string => typeof e === 'string') : d;
const isStrings = (x: unknown): x is string[] => Array.isArray(x) && x.every((e) => typeof e === 'string');
/** Page id → node id, for open pages only, and nodes the page has. */
function lastNodes(x: unknown, pages: readonly PageId[]): Record<PageId, string> {
  const out: Record<PageId, string> = {};
  if (isObj(x))
    for (const [k, v] of Object.entries(x))
      if (pages.includes(k) && typeof v === 'string' && mapPage(k)?.nodes.some((n) => n.id === v)) out[k] = v;
  return out;
}

/**
 * Reveal ids a map change renamed, old → new: 0.4.1 moved World 1's warp spot road from 1-1
 * to 1-2.
 */
const RENAMED_REVEALS: Readonly<Record<string, string>> = { 'smb-1:1-1>bonus-1': 'smb-1:1-2>bonus-1' };

/** Pending reveal ids ('<page>:<id>') of open pages, renamed ones updated, each once, at most 64. */
function revealIds(x: unknown, pages: readonly PageId[]): string[] {
  const ids = strs(x, [])
    .map((id) => RENAMED_REVEALS[id] ?? id)
    .filter((id) => {
      const i = id.indexOf(':');
      return i > 0 && i < id.length - 1 && pages.includes(id.slice(0, i));
    });
  return [...new Set(ids)].slice(0, 64);
}

/**
 * Map nodes a later build took away, '<page>:<node>' → the node of that page to stand on instead.
 * 0.4.7 (the Lost Levels as the story's extension): Lost World 1's warp back to the hub and the
 * World 8 ↔ A pads went; a hero left on World 8's pad stands at the castle it hung off.
 */
const REMOVED_NODES: Readonly<Record<string, string>> = {
  'll-1:hub': 'start',
  'll-8:warp-ll-10': 'll-8-4',
  'll-10:warp-ll-8': 'start',
};

/** The node to stand on: `node` when page `page` has it, else its replacement or the start. */
function placedNode(page: PageId, node: string): string {
  if (mapPage(page)?.nodes.some((n) => n.id === node)) return node;
  return REMOVED_NODES[`${page}:${node}`] ?? 'start';
}

/** World 1's page, where every file starts. */
const FIRST_PAGE_ID: PageId = 'smb-1';

/** Mario's tutorial stage, World 1's start node (0.5.0): every new file plays it first. */
export const TUTORIAL_LEVEL = '1-0';

/**
 * A file that has cleared anything was played before the tutorial existed: it counts 1-0 as
 * cleared (derived on load, no format change), so 1-1 stays open. The node it stood on, World 1's
 * 'start', is 1-0's node now, so no position needs remapping.
 */
function withTutorial(cleared: string[]): string[] {
  return cleared.length && !cleared.includes(TUTORIAL_LEVEL) ? [TUTORIAL_LEVEL, ...cleared] : cleared;
}

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
  const current = 1 + migrations.length;
  while (v < current) {
    const m = migrations[v - 1];
    if (!m) return null;
    stored = m(stored);
    if (!isObj(stored)) return null;
    v++;
  }
  if (v !== current) return null; // from a newer build
  if (typeof stored.character !== 'string') return null;
  const d = newSave(slot, stored.character, typeof stored.character2 === 'string' ? stored.character2 : null);
  const pos = isObj(stored.position) ? stored.position : {};
  // Registered pages, each once, World 1 always (an id this build has no page for is left
  // out); the hero stands on one of them, else on the start of the furthest open SMB world.
  const listed = Array.isArray(stored.pages) ? stored.pages : [];
  const pages = [...new Set(['smb-1', ...listed.filter(isPageId)])];
  const posPage = str(pos.page, d.position.page);
  const furthest =
    [...MAP_PAGES].reverse().find((p) => p.group === 'smb' && pages.includes(p.id))?.id ?? d.position.page;
  const cleared = withTutorial(strs(stored.cleared, d.cleared));
  let position = pages.includes(posPage)
    ? { page: posPage, node: placedNode(posPage, str(pos.node, d.position.node)) }
    : { page: furthest, node: 'start' };
  // Before 1-0, 1-1 was open on a new file: a file with no clears may stand there (or anywhere
  // past World 1's start), which is locked until 1-0 is cleared. Back to the start, on 1-0.
  // A file on the developer's "Unlock all" may stand anywhere: left as it is.
  if (
    !cleared.length &&
    stored.devUnlockAll !== true &&
    position.page === FIRST_PAGE_ID &&
    position.node !== 'start'
  )
    position = { page: FIRST_PAGE_ID, node: 'start' };
  const freed = Array.isArray(stored.freed) ? freedHeroes(stored.freed) : d.freed;
  const secrets = strs(stored.secrets, d.secrets);
  return {
    ...d,
    v: current,
    created: num(stored.created, d.created),
    updated: num(stored.updated, d.updated),
    lives: whole(stored.lives, d.lives, 1, 99),
    score: whole(stored.score, d.score, 0),
    coins: whole(stored.coins, d.coins, 0),
    powerState: str(stored.powerState, d.powerState),
    hp: num(stored.hp, d.hp),
    kit: kit(stored.kit),
    powerState2: str(stored.powerState2, d.powerState2),
    hp2: num(stored.hp2, d.hp2),
    kit2: kit(stored.kit2),
    cleared,
    pages,
    secrets,
    position,
    gameCleared: stored.gameCleared === true,
    lastNode: lastNodes(stored.lastNode, pages),
    pendingReveal: revealIds(stored.pendingReveal, pages),
    devUnlockAll: stored.devUnlockAll === true,
    devAllHeroes: stored.devAllHeroes === true,
    devGateOpen: stored.devGateOpen === true,
    freed,
    // The file's current (freed) heroes count as answered, so an existing player is never
    // interrupted; a hero used only through dev "All heroes" still gets its real question.
    tutorials: tutorialHeroes([
      ...(Array.isArray(stored.tutorials) ? stored.tutorials : []),
      ...[stored.character, stored.character2].filter((id) => freed.includes(id as string)),
    ]),
    // Talked-to captives; older files derive it from the freed heroes (and Larry from his secret).
    met: metIds(Array.isArray(stored.met) ? stored.met : [], freed, secrets.includes(CRYSTAL_BALL)),
    // Larry Koopa's crystal ball (secret 'larry') unlocks the inventory.
    inventoryUnlocked: stored.inventoryUnlocked === true || secrets.includes('larry'),
    bonusOpen: stored.bonusOpen !== false,
    bonusGuard: stored.bonusOpen === false && stored.bonusGuard === true,
    ...bonusSaveFields(bonusStateFrom(stored)),
    // The seen story beats: kept only when well formed (else seeded on load, Game.openFile).
    ...(isStrings(stored.story) ? { story: [...new Set(stored.story)] } : {}),
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

/** A slot holding data that can't be read (corrupt, or from a newer build): erase it to reuse it. */
export const UNREADABLE = 'unreadable';
export type SlotContents = SaveFile | typeof UNREADABLE | null;

/** All three slots in order: the file, UNREADABLE, or null when empty. */
export function listSaves(): SlotContents[] {
  return SAVE_SLOTS.map((slot) => loadSave(slot) ?? (hasKey(saveKey(slot)) ? UNREADABLE : null));
}

/** Main levels 1-1..8-4 cleared on the file (out of 32). */
export function clearedMainLevels(save: MapProgress): number {
  return new Set(save.cleared.filter((id) => /^[1-8]-[1-4]$/.test(id))).size;
}

/** Highest SMB world reached (its page 'smb-N' open). */
export function highestWorld(save: MapProgress): number {
  return Math.max(1, ...save.pages.map((id) => Number(/^smb-(\d+)$/.exec(id)?.[1] ?? 1)));
}

/** Hit points capped at the hero's maximum (heart containers / tanks raise it through the kit). */
function capHp(c: CharacterDef, hp: number, kit: Record<string, number>): number {
  return Math.min(hp, kit.maxHp ?? startHp(c));
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
  s.world = Number(/-(\d+)$/.exec(save.position.page)?.[1] ?? 1);
  s.stage = 1;
  if (c1 && validPower(c1, save.powerState)) {
    s.powerState = save.powerState;
    if (c1.damage.kind === 'hp' && save.hp > 0) s.hp = capHp(c1, save.hp, save.kit);
    s.kit = { ...save.kit };
  }
  const c2Known = c2 !== null && characters.some((c) => c.id === save.character2);
  if (c2 && c2Known && validPower(c2, save.powerState2)) {
    s.powerState2 = save.powerState2;
    if (c2.damage.kind === 'hp' && save.hp2 > 0) s.hp2 = capHp(c2, save.hp2, save.kit2);
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
    hp: capHp(state.character, state.hp, state.kit),
    kit: { ...state.kit },
    powerState2: state.powerState2,
    hp2: state.character2 ? capHp(state.character2, state.hp2, state.kit2) : state.hp2,
    kit2: { ...state.kit2 },
  };
}
