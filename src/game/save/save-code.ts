import { shareBase } from '@engine/site';
import {
  highestWorld,
  migrateSave,
  SAVE_MIGRATIONS,
  type SaveFile,
  type SaveMigration,
  type SaveSlot,
} from './save-files';
import {
  BitReader,
  BitWriter,
  cleanCode,
  CodeFormatError,
  crc16,
  fromBase32,
  groupCode,
  toBase32,
  widthFor,
} from './code-bits';

/*
 * Portable save codes (0.4.44, roadmap #36; the format is documented in docs/SAVE_CODES.md): a
 * campaign file packed into a short Crockford Base32 code, so the code itself is the save. No
 * server and no account: a code can be shared as a resume link (`#save=<code>`) or pasted.
 *
 * Layout: the code version (Exp-Golomb), a CRC-16 over every other bit, then the fields below, in
 * the order of FIELDS. Lists of ids use frozen dictionaries (a snapshot of the game's registries,
 * kept in step by save-code.test.ts) with an escape for any id they don't know, so nothing is lost.
 *
 * To add a field or a dictionary entry: bump CODE_VERSION, add the field to FIELDS with `since`
 * set to it (or the ids as a new chunk of the dictionary), and list the save format it writes in
 * CODE_SAVE_FORMAT. Older codes keep decoding with the fields and dictionaries of their version,
 * then go through the save migrations like any stored file.
 */

/** The code layout this build writes. */
export const CODE_VERSION = 3;

/** The save format (SaveFile.v) each code version's fields make, before the save migrations. */
const CODE_SAVE_FORMAT: Readonly<Record<number, number>> = { 1: 4, 2: 4, 3: 4 };

export const CODE_TYPO = "THAT CODE DOESN'T LOOK RIGHT";
export const CODE_NEWER = 'THIS CODE IS FROM A NEWER VERSION. UPDATE THE GAME TO LOAD IT';
export const CODE_EMPTY = 'PASTE OR TYPE A SAVE CODE';

/**
 * How the code treats each field of SaveFile (save-code.test.ts fails on a field missing here):
 * 'code' fields are in the code; the score, the timestamps, the slot and the developer's flags are
 * left out ('left-out': a loaded file has no score, now's time, the slot it goes into and every dev
 * flag off); 'legacy' fields are only ever read from older files, never written (save-files.ts).
 */
export const SAVE_CODE_FIELDS: { readonly [K in keyof Required<SaveFile>]: 'code' | 'left-out' | 'legacy' } =
  {
    v: 'left-out', // the code version stands for it (CODE_SAVE_FORMAT)
    slot: 'left-out',
    created: 'left-out',
    updated: 'left-out',
    score: 'left-out',
    character: 'code',
    character2: 'code',
    lives: 'code',
    coins: 'code',
    powerState: 'code',
    hp: 'code',
    kit: 'code',
    powerState2: 'code',
    hp2: 'code',
    kit2: 'code',
    cleared: 'code',
    pages: 'code',
    secrets: 'code',
    position: 'code',
    gameCleared: 'code',
    lastNode: 'code',
    pendingReveal: 'code',
    devUnlockAll: 'left-out',
    devAllHeroes: 'left-out',
    devGateOpen: 'left-out',
    devInventory: 'left-out',
    freed: 'code',
    tutorials: 'code',
    met: 'code',
    inventoryUnlocked: 'code',
    bonusOpen: 'code',
    bonusGuard: 'code',
    inventory: 'legacy',
    itemsNext: 'legacy',
    bonusNext: 'code',
    spadeBoard: 'code',
    spadeTaken: 'code',
    heroInventory: 'code',
    heroItemsNext: 'code',
    heroKits: 'code',
    wallet: 'code',
    story: 'code',
    explained: 'code',
  };

// ---------------------------------------------------------------- frozen dictionaries

/**
 * A dictionary in chunks, one per code version: chunk 0 is version 1's ids, chunk 1 the ids
 * version 2 added, and so on. A chunk never changes once shipped (dictFingerprints is checked).
 */
type Chunks<T = string> = readonly (readonly T[])[];

const range = (n: number, from = 1): number[] => Array.from({ length: n }, (_, i) => i + from);
const SMB_WORLDS = range(8);
const LL_WORLDS = range(13);

const HEROES: Chunks = [['mario', 'luigi', 'link', 'megaman', 'samus', 'simon', 'ryu', 'bill', 'sophia']];
const MET: Chunks = [[...(HEROES[0] as string[]), 'larry']];
/**
 * Version 3 (0.4.51) reserves the Valley of Bowser ahead of its release (docs/SAVE_CODES.md): its
 * page `valley-of-bowser` here, its castle level `8-5` in LEVELS and its nodes in pageNodes, so
 * the page needs no new code version. Until the page exists a build drops it on load
 * (save-files.ts migrateSave keeps registered pages only), as it would the same id escaped.
 */
const PAGES: Chunks = [
  [...SMB_WORLDS.map((n) => `smb-${n}`), 'hub', ...LL_WORLDS.map((n) => `ll-${n}`), 'arena'],
  [],
  ['valley-of-bowser'],
];
const LEVELS: Chunks = [
  [
    '1-0',
    ...SMB_WORLDS.flatMap((w) => range(4).map((s) => `${w}-${s}`)),
    '2-top-secret',
    ...LL_WORLDS.flatMap((w) => range(4).map((s) => `ll-${w}-${s}`)),
  ],
  [],
  ['8-5'],
];
const SECRETS: Chunks = [
  ['bonus-1', 'bonus-2', 'kakariko', 'bonus-3', 'larry', 'bonus-5', 'bonus-6', 'bonus-7', 'bonus-8'],
];
/**
 * Story beats (story/beats.ts) in the order a file meets them, so a file's list is a few long
 * runs; then the beats older builds wrote (nothing reads them, but a code keeps them). Version 2
 * added none (an empty chunk); version 3 (0.4.51) the seven hero sightings (beats.ts
 * SIGHTING_HEROES), all at once though they ship world by world, so later ones need no new version.
 */
const STORY: Chunks = [
  [
    'story:0.4.23',
    'opening',
    'spell',
    'enter:smb-1',
    'luigi-runs',
    'fakes',
    'remark:1-4',
    'gate:smb-1',
    'sealed:smb-1',
    ...range(7, 2).flatMap((n) => [
      `enter:smb-${n}`,
      `welcome:smb-${n}`,
      ...(n === 4 ? ['anchor-4-2', 'crash'] : []),
      ...(n <= 7 ? [`remark:${n}-4`] : ['bowser-8-4']),
      `gate:smb-${n}`,
      `sealed:smb-${n}`,
      ...(n === 8 ? ['rift'] : []),
    ]),
    'hub',
    'arena',
    'joined',
    'all-freed',
    ...(HEROES[0] as string[]).flatMap((h) => [`joined:${h}`, `missed:${h}`]),
    ...SMB_WORLDS.flatMap((n) => (HEROES[0] as string[]).map((h) => `enter:smb-${n}:${h}`)),
  ],
  [],
  [
    'sighting:link',
    'sighting:megaman',
    'sighting:samus',
    'sighting:simon',
    'sighting:ryu',
    'sighting:bill',
    'sighting:sophia',
  ],
];
/** The inventory's items and the held items (bonus/items.ts ITEM_IDS, NEXT_ORDER). */
const ITEMS: Chunks = [['mushroom', 'flower', 'star', '1up']];
const NEXT: Chunks = [['mushroom', 'flower', 'star']];
/**
 * The one-time explainers (0.4.46, tutorial/explainers.ts EXPLAINER_IDS), new in code version 2:
 * version 1 had none (an empty chunk).
 */
const EXPLAINED: Chunks = [
  [],
  [
    'megaman:health-small',
    'megaman:health-large',
    'megaman:weapon-small',
    'megaman:weapon-large',
    'megaman:e-tank',
    'samus:energy-small',
    'samus:energy-large',
    'samus:missile-pack',
    'link:bomb',
    'link:magic-small',
    'link:magic-large',
    'link:heart-small',
    'simon:heart-small',
    'simon:heart-large',
    'ryu:ninpo-small',
    'ryu:ninpo-large',
    'ryu:health-small',
    'bill:capsule',
    'bill:health-small',
    'sophia:triple-ammo',
    'sophia:homing-ammo',
    'megaman:helmet',
  ],
];

/** Kit flags (value 1): the campaign's `found` and each item's `has-<id>` (items/catalog.ts). */
const flagsOf = (items: string[]): Chunks => [['found', ...items.map((i) => `has-${i}`)]];
const KIT_FLAGS: Readonly<Record<string, Chunks>> = {
  mario: flagsOf(['mushroom', 'fire-flower']),
  luigi: flagsOf(['mushroom', 'fire-flower']),
  link: flagsOf([
    'heart-container',
    'bomb-bag',
    'shield-spell',
    'jump-spell',
    'blue-ring',
    'fire-spell',
    'magical-sword',
  ]),
  megaman: flagsOf(['helmet', 'saw-disc', 'leaf-guard', 'rush-coil', 'flame-wave', 'homing-knuckle', 'bolt']),
  samus: flagsOf(['energy-tank', 'missiles', 'long-beam', 'ice-beam', 'varia-suit', 'wave-beam']),
  simon: flagsOf([
    'pot-roast',
    'chain-whip',
    'dagger',
    'holy-water',
    'axe',
    'morning-star',
    'cross',
    'double-shot',
    'stopwatch',
    'triple-shot',
  ]),
  ryu: flagsOf(['medicine', 'throwing-star', 'ninpo-scroll', 'windmill', 'fire-wheel', 'jump-slash']),
  bill: flagsOf(['medal', 'machine-gun', 'laser', 'flame-gun', 'spread-gun']),
  sophia: flagsOf([
    'power-capsule',
    'crusher',
    'wall-climb',
    'ceiling-climb',
    'triple-missile',
    'homing-missile',
  ]),
};
/**
 * A hero's other kit keys (meters, ammo, tiers, the tool picked), each with its usual value:
 * a key at its usual value costs one bit. Usual values only make codes shorter; any value fits.
 */
type NumKey = readonly [key: string, usual: number];
const KIT_NUMS: Readonly<Record<string, Chunks<NumKey>>> = {
  mario: [[]],
  luigi: [[]],
  link: [
    [
      ['maxHp', 16],
      ['bombs', 8],
      ['magic', 32],
      ['tool', 0],
      ['tunic', 1],
      ['beam', 1],
      ['halfHit', 0],
      ['shieldSpell', 0],
      ['jumpSpell', 0],
      ['fireSpell', 0],
      ['upThrust', 1],
      ['downThrust', 1],
      ['boomerangOut', 0],
      ['throwT', 0],
    ],
  ],
  megaman: [
    [
      ['helmet', 1],
      ['wsaw', 28],
      ['wleaf', 28],
      ['wrush', 28],
      ['wflame', 28],
      ['wknuckle', 28],
      ['wbolt', 28],
      ['etanks', 0],
      ['weapons', 0],
      ['chargeT', 0],
      ['tool', 0],
    ],
  ],
  samus: [
    [
      ['maxHp', 90],
      ['tanks', 6],
      ['missiles', 30],
      ['tool', 0],
      ['beamPick', 0],
      ['varia', 1],
      ['ball', 1],
      ['aimUp', 0],
      ['beam', 0],
    ],
  ],
  simon: [
    [
      ['maxHp', 16],
      ['hearts', 99],
      ['tool', 0],
      ['whip', 0],
      ['subs', 0],
      ['multi', 0],
      ['throwT', 0],
    ],
  ],
  ryu: [
    [
      ['maxHp', 16],
      ['ninpoMax', 99],
      ['ninpo', 99],
      ['scrolls', 3],
      ['tool', 0],
      ['arts', 0],
      ['spin', 0],
      ['throwT', 0],
    ],
  ],
  bill: [
    [
      ['maxHp', 5],
      ['tool', 0],
      ['guns', 0],
      ['aimX', 0],
      ['aimY', 0],
      ['autoT', 0],
    ],
  ],
  sophia: [
    [
      ['hasTriple', 1],
      ['triple', 60],
      ['hasHoming', 1],
      ['homing', 20],
      ['tool', 0],
    ],
  ],
};
/** Hit points a hero is usually at when their kit has no `maxHp` (their full health at the start). */
const FULL_HP: Readonly<Record<string, number>> = {
  link: 6,
  megaman: 28,
  samus: 30,
  simon: 10,
  ryu: 10,
  bill: 3,
};
/** Power states, the usual first: hit-point heroes are 'full'; the others mostly 'fire' late on. */
const HP_HEROES: readonly string[] = ['link', 'megaman', 'samus', 'simon', 'ryu', 'bill'];
const POWERS_HP = ['full', 'small', 'big', 'fire'];
const POWERS_UP = ['fire', 'big', 'small', 'full'];

/** The entries of dictionary `d` as code version `v` knew it. */
function at<T>(d: Chunks<T>, v: number): readonly T[] {
  return d.slice(0, v).flat();
}

/** The current dictionaries (tests check they cover the game's registries). */
export const CODE_DICTS = {
  heroes: at(HEROES, CODE_VERSION),
  met: at(MET, CODE_VERSION),
  pages: at(PAGES, CODE_VERSION),
  levels: at(LEVELS, CODE_VERSION),
  secrets: at(SECRETS, CODE_VERSION),
  story: at(STORY, CODE_VERSION),
  explained: at(EXPLAINED, CODE_VERSION),
  kitFlags: Object.fromEntries(Object.entries(KIT_FLAGS).map(([h, d]) => [h, at(d, CODE_VERSION)])) as Record<
    string,
    readonly string[]
  >,
  kitNums: Object.fromEntries(Object.entries(KIT_NUMS).map(([h, d]) => [h, at(d, CODE_VERSION)])) as Record<
    string,
    readonly NumKey[]
  >,
};

/** A short checksum of text (for dictFingerprints). */
function textCrc(text: string): string {
  const bits: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    for (let j = 15; j >= 0; j--) bits.push((c >> j) & 1);
  }
  return crc16(bits).toString(16).padStart(4, '0');
}

/** `<chunks>:<checksum>` of each dictionary: save-code.test.ts pins them, so a shipped chunk can't change. */
export function dictFingerprints(): Record<string, string> {
  const print = (chunks: Chunks<unknown>) => `${chunks.length}:${textCrc(JSON.stringify(chunks))}`;
  const heroes = at(HEROES, CODE_VERSION);
  const per = (d: Readonly<Record<string, Chunks<unknown>>>) =>
    `${Math.max(...heroes.map((h) => d[h]?.length ?? 0))}:${textCrc(JSON.stringify(heroes.map((h) => d[h])))}`;
  return {
    heroes: print(HEROES),
    met: print(MET),
    pages: print(PAGES),
    levels: print(LEVELS),
    secrets: print(SECRETS),
    story: print(STORY),
    explained: print(EXPLAINED),
    kitFlags: per(KIT_FLAGS),
    kitNums: per(KIT_NUMS),
  };
}

// ---------------------------------------------------------------- value codes

/** Characters a string escape writes in 6 bits (63: any other UTF-16 unit, in 16 bits). */
const STR_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-:_.>';
const STR_OTHER = 63;

function writeStr(w: BitWriter, s: string): void {
  w.eg(2, s.length);
  for (let i = 0; i < s.length; i++) {
    const k = STR_CHARS.indexOf(s[i] as string);
    if (k >= 0) w.uint(6, k);
    else {
      w.uint(6, STR_OTHER);
      w.uint(16, s.charCodeAt(i));
    }
  }
}

function readStr(r: BitReader): string {
  const n = r.eg(2);
  if (n > 256) throw new CodeFormatError('string too long');
  let s = '';
  for (let i = 0; i < n; i++) {
    const k = r.uint(6);
    if (k === STR_OTHER) s += String.fromCharCode(r.uint(16));
    else if (k < STR_CHARS.length) s += STR_CHARS[k];
    else throw new CodeFormatError('bad character');
  }
  return s;
}

/** Whole numbers 0..2^40 in Exp-Golomb, anything else (negative, fractional) as its text. */
const PLAIN_MAX = 2 ** 40;

/** A number; with `usual`, one bit when it is that. */
function writeNum(w: BitWriter, v: number, usual: number | null = null): void {
  if (usual !== null) {
    if (Object.is(v, usual)) {
      w.bit(0);
      return;
    }
    w.bit(1);
  }
  if (Number.isInteger(v) && v >= 0 && v <= PLAIN_MAX && !Object.is(v, -0)) {
    w.bit(0);
    w.eg(2, v);
  } else {
    w.bit(1);
    writeStr(w, Object.is(v, -0) ? '-0' : String(v));
  }
}

function readNum(r: BitReader, usual: number | null = null): number {
  if (usual !== null && !r.bit()) return usual;
  if (!r.bit()) return r.eg(2);
  const v = Number(readStr(r));
  if (!Number.isFinite(v)) throw new CodeFormatError('bad number');
  return v;
}

/** One of `dict` in a fixed width, or the escape (dict.length) and the text. */
function writeSym(w: BitWriter, dict: readonly string[], v: string): void {
  const width = widthFor(dict.length + 1);
  const i = dict.indexOf(v);
  w.uint(width, i < 0 ? dict.length : i);
  if (i < 0) writeStr(w, v);
}

function readSym(r: BitReader, dict: readonly string[]): string {
  const i = r.uint(widthFor(dict.length + 1));
  if (i === dict.length) return readStr(r);
  const v = dict[i];
  if (v === undefined) throw new CodeFormatError('bad index');
  return v;
}

/** One of `list`, the first ones shortest (Exp-Golomb 0 of the index), or the escape and the text. */
function writePick(w: BitWriter, list: readonly string[], v: string): void {
  const i = list.indexOf(v);
  w.eg(0, i < 0 ? list.length : i);
  if (i < 0) writeStr(w, v);
}

function readPick(r: BitReader, list: readonly string[]): string {
  const i = r.eg(0);
  if (i === list.length) return readStr(r);
  const v = list[i];
  if (v === undefined) throw new CodeFormatError('bad index');
  return v;
}

/**
 * A set of indices into a dictionary of `n`: as runs (gap and length of each run of neighbours)
 * or as a bitmap, whichever is shorter (one bit says which).
 */
function writeIndexSet(w: BitWriter, n: number, idx: readonly number[]): void {
  const runs: [number, number][] = [];
  for (const i of idx) {
    const last = runs[runs.length - 1];
    if (last && last[0] + last[1] === i) last[1]++;
    else runs.push([i, 1]);
  }
  const a = new BitWriter();
  a.eg(0, runs.length);
  let pos = 0;
  for (const [start, len] of runs) {
    a.eg(0, start - pos);
    a.eg(0, len - 1);
    pos = start + len;
  }
  if (a.length <= n) {
    w.bit(0);
    w.append(a);
  } else {
    w.bit(1);
    for (let i = 0; i < n; i++) w.bit(idx.includes(i));
  }
}

function readIndexSet(r: BitReader, n: number): number[] {
  const out: number[] = [];
  if (r.bit()) {
    for (let i = 0; i < n; i++) if (r.bit()) out.push(i);
    return out;
  }
  const k = r.eg(0);
  let pos = 0;
  for (let j = 0; j < k; j++) {
    const start = pos + r.eg(0);
    const len = r.eg(0) + 1;
    if (start + len > n) throw new CodeFormatError('run past the dictionary');
    for (let i = start; i < start + len; i++) out.push(i);
    pos = start + len;
  }
  return out;
}

/** `values` as a code keeps them: the known ones in dictionary order, then the others, each once. */
function canonicalList(dict: readonly string[], values: readonly string[]): string[] {
  const set = new Set(values);
  return [...dict.filter((d) => set.has(d)), ...[...set].filter((v) => !dict.includes(v))];
}

/** A set of strings: an index set over `dict`, then the count and text of any it doesn't know. */
function writeStrSet(w: BitWriter, dict: readonly string[], values: readonly string[]): void {
  const set = new Set(values);
  writeIndexSet(
    w,
    dict.length,
    dict.flatMap((d, i) => (set.has(d) ? [i] : [])),
  );
  const extra = [...set].filter((v) => !dict.includes(v));
  w.eg(0, extra.length);
  for (const e of extra) writeStr(w, e);
}

function readStrSet(r: BitReader, dict: readonly string[]): string[] {
  const out = readIndexSet(r, dict.length).map((i) => dict[i] as string);
  const extra = r.eg(0);
  if (extra > 4096) throw new CodeFormatError('too many');
  for (let i = 0; i < extra; i++) out.push(readStr(r));
  return out;
}

function writeCount(w: BitWriter, n: number): void {
  w.eg(0, n);
}

function readCount(r: BitReader, max = 4096): number {
  const n = r.eg(0);
  if (n > max) throw new CodeFormatError('too many');
  return n;
}

// ---------------------------------------------------------------- heroes: power, hit points, kit

interface Power {
  powerState: string;
  hp: number;
  kit: Record<string, number>;
}

const powersOf = (hero: string | null): readonly string[] =>
  hero === null || !(at(HEROES, CODE_VERSION) as string[]).includes(hero)
    ? ['small', 'big', 'fire', 'full']
    : HP_HEROES.includes(hero)
      ? POWERS_HP
      : POWERS_UP;

function usualHp(hero: string | null, kit: Record<string, number>): number {
  return kit.maxHp ?? (hero === null ? 0 : (FULL_HP[hero] ?? 0));
}

function writeKit(w: BitWriter, hero: string | null, kit: Record<string, number>, v: number): void {
  const flags = hero !== null && KIT_FLAGS[hero] ? at(KIT_FLAGS[hero], v) : ['found'];
  const nums = hero !== null && KIT_NUMS[hero] ? at(KIT_NUMS[hero], v) : [];
  const flagIdx = flags.flatMap((k, i) => (kit[k] === 1 ? [i] : []));
  const numIdx = nums.flatMap(([k], i) => (k in kit ? [i] : []));
  writeIndexSet(w, flags.length, flagIdx);
  writeIndexSet(w, nums.length, numIdx);
  for (const i of numIdx) {
    const [k, usual] = nums[i] as NumKey;
    writeNum(w, kit[k] as number, usual);
  }
  const extra = Object.entries(kit).filter(
    ([k, x]) => !(flags.includes(k) && x === 1) && !nums.some(([n]) => n === k),
  );
  writeCount(w, extra.length);
  for (const [k, x] of extra) {
    writeStr(w, k);
    writeNum(w, x);
  }
}

function readKit(r: BitReader, hero: string | null, v: number): Record<string, number> {
  const flags = hero !== null && KIT_FLAGS[hero] ? at(KIT_FLAGS[hero], v) : ['found'];
  const nums = hero !== null && KIT_NUMS[hero] ? at(KIT_NUMS[hero], v) : [];
  const kit: Record<string, number> = {};
  for (const i of readIndexSet(r, flags.length)) kit[flags[i] as string] = 1;
  for (const i of readIndexSet(r, nums.length)) {
    const [k, usual] = nums[i] as NumKey;
    kit[k] = readNum(r, usual);
  }
  const extra = readCount(r, 256);
  for (let i = 0; i < extra; i++) {
    const k = readStr(r);
    kit[k] = readNum(r);
  }
  return kit;
}

function writePower(w: BitWriter, hero: string | null, p: Power, v: number): void {
  writePick(w, powersOf(hero), p.powerState);
  writeKit(w, hero, p.kit, v);
  writeNum(w, p.hp, usualHp(hero, p.kit));
}

function readPower(r: BitReader, hero: string | null, v: number): Power {
  const powerState = readPick(r, powersOf(hero));
  const kit = readKit(r, hero, v);
  return { powerState, hp: readNum(r, usualHp(hero, kit)), kit };
}

// ---------------------------------------------------------------- map nodes

/**
 * The nodes a page's hero is likely on, the usual first (the castle, where a page is left from):
 * a fixed list by page id and code version `v`, so it never moves with the map's art. Any other
 * node is escaped. Version 3 (0.4.51) adds the Valley of Bowser's (its castle, then its start).
 */
function pageNodes(page: string, v: number): string[] {
  if (page === 'valley-of-bowser' && v >= 3) return ['bowsers-castle', 'start'];
  const smb = /^smb-(\d+)$/.exec(page)?.[1];
  if (smb) return [`${smb}-4`, 'start', `${smb}-1`, `${smb}-2`, `${smb}-3`, `bonus-${smb}`];
  const ll = /^ll-(\d+)$/.exec(page)?.[1];
  if (ll) return [`ll-${ll}-4`, 'start', `ll-${ll}-1`, `ll-${ll}-2`, `ll-${ll}-3`];
  if (page === 'hub') return ['start', 'warp-arena', 'warp-mystery-1', 'warp-mystery-2', 'warp-mystery-3'];
  return ['start'];
}

/** lastNode's slot for a page: its usual node, none (index 1), or any other. */
const NO_NODE = '\u0000none';
const lastNodeChoices = (page: string, v: number): string[] => {
  const [first, ...rest] = pageNodes(page, v);
  return [first as string, NO_NODE, ...rest];
};

/**
 * A pending reveal id (map/rules.ts revealId: '<page>:<node>', or '<page>:<from>><to>' for a road
 * or a world exit): the page, then the node, or the road's ends (a node, then a node or a page).
 * Anything else is kept as text.
 */
function writeReveal(w: BitWriter, id: string, v: number): void {
  const colon = id.indexOf(':');
  const page = id.slice(0, colon);
  const rest = id.slice(colon + 1);
  const pages = at(PAGES, v);
  if (colon <= 0 || !pages.includes(page)) {
    w.bit(0);
    writeStr(w, id);
    return;
  }
  w.bit(1);
  writeSym(w, pages, page);
  const nodes = pageNodes(page, v);
  const arrow = rest.indexOf('>');
  w.bit(arrow > 0);
  if (arrow <= 0) {
    writePick(w, nodes, rest);
    return;
  }
  writePick(w, nodes, rest.slice(0, arrow));
  writePick(w, [...nodes, ...pages], rest.slice(arrow + 1));
}

function readReveal(r: BitReader, v: number): string {
  if (!r.bit()) return readStr(r);
  const pages = at(PAGES, v);
  const page = readSym(r, pages);
  const nodes = pageNodes(page, v);
  if (!r.bit()) return `${page}:${readPick(r, nodes)}`;
  const from = readPick(r, nodes);
  return `${page}:${from}>${readPick(r, [...nodes, ...pages])}`;
}

// ---------------------------------------------------------------- the fields, in code order

/** The decoded fields, before the save migrations (a SaveFile of the code's save format). */
type Raw = Record<string, unknown>;

interface FieldCodec {
  /** What it writes (documentation and errors). */
  name: string;
  /** The code version that added it. */
  since: number;
  write(w: BitWriter, s: SaveFile, v: number): void;
  read(r: BitReader, raw: Raw, v: number): void;
}

const heroesAt = (v: number) => at(HEROES, v);
const pagesOf = (s: SaveFile, v: number) => canonicalList(at(PAGES, v), s.pages);

const FIELDS: readonly FieldCodec[] = [
  {
    name: 'character, powerState, hp, kit',
    since: 1,
    write(w, s, v) {
      writeSym(w, heroesAt(v), s.character);
      writePower(w, s.character, { powerState: s.powerState, hp: s.hp, kit: s.kit }, v);
    },
    read(r, raw, v) {
      const hero = readSym(r, heroesAt(v));
      const p = readPower(r, hero, v);
      Object.assign(raw, { character: hero, powerState: p.powerState, hp: p.hp, kit: p.kit });
    },
  },
  {
    name: 'character2, powerState2, hp2, kit2',
    since: 1,
    write(w, s, v) {
      w.bit(s.character2 !== null);
      if (s.character2 !== null) writeSym(w, heroesAt(v), s.character2);
      writePower(w, s.character2, { powerState: s.powerState2, hp: s.hp2, kit: s.kit2 }, v);
    },
    read(r, raw, v) {
      const hero = r.bit() ? readSym(r, heroesAt(v)) : null;
      const p = readPower(r, hero, v);
      Object.assign(raw, { character2: hero, powerState2: p.powerState, hp2: p.hp, kit2: p.kit });
    },
  },
  {
    name: 'lives, coins',
    since: 1,
    write(w, s) {
      w.eg(2, s.lives);
      w.eg(4, s.coins);
    },
    read(r, raw) {
      raw.lives = r.eg(2);
      raw.coins = r.eg(4);
    },
  },
  {
    name: 'wallet, gameCleared, inventoryUnlocked, bonusOpen, bonusGuard',
    since: 1,
    write(w, s) {
      w.bit(s.wallet);
      w.bit(s.gameCleared);
      w.bit(s.inventoryUnlocked === true);
      w.bit(s.bonusOpen !== false);
      w.bit(s.bonusGuard === true);
    },
    read(r, raw) {
      raw.wallet = r.bit();
      raw.gameCleared = r.bit();
      raw.inventoryUnlocked = r.bit();
      raw.bonusOpen = r.bit();
      raw.bonusGuard = r.bit();
    },
  },
  {
    name: 'pages, cleared, secrets',
    since: 1,
    write(w, s, v) {
      writeStrSet(w, at(PAGES, v), s.pages);
      writeStrSet(w, at(LEVELS, v), s.cleared);
      writeStrSet(w, at(SECRETS, v), s.secrets);
    },
    read(r, raw, v) {
      raw.pages = readStrSet(r, at(PAGES, v));
      raw.cleared = readStrSet(r, at(LEVELS, v));
      raw.secrets = readStrSet(r, at(SECRETS, v));
    },
  },
  {
    name: 'position',
    since: 1,
    write(w, s, v) {
      writeSym(w, at(PAGES, v), s.position.page);
      writePick(w, pageNodes(s.position.page, v), s.position.node);
    },
    read(r, raw, v) {
      const page = readSym(r, at(PAGES, v));
      raw.position = { page, node: readPick(r, pageNodes(page, v)) };
    },
  },
  {
    name: 'lastNode (one slot per open page)',
    since: 1,
    write(w, s, v) {
      for (const page of pagesOf(s, v)) writePick(w, lastNodeChoices(page, v), s.lastNode[page] ?? NO_NODE);
    },
    read(r, raw, v) {
      const lastNode: Record<string, string> = {};
      for (const page of canonicalList(at(PAGES, v), raw.pages as string[])) {
        const node = readPick(r, lastNodeChoices(page, v));
        if (node !== NO_NODE) lastNode[page] = node;
      }
      raw.lastNode = lastNode;
    },
  },
  {
    name: 'pendingReveal',
    since: 1,
    write(w, s, v) {
      writeCount(w, s.pendingReveal.length);
      for (const id of s.pendingReveal) writeReveal(w, id, v);
    },
    read(r, raw, v) {
      raw.pendingReveal = Array.from({ length: readCount(r, 64) }, () => readReveal(r, v));
    },
  },
  {
    name: 'freed, tutorials, met',
    since: 1,
    write(w, s, v) {
      writeStrSet(w, heroesAt(v), s.freed);
      writeStrSet(w, heroesAt(v), s.tutorials ?? []);
      writeStrSet(w, at(MET, v), s.met ?? []);
    },
    read(r, raw, v) {
      raw.freed = readStrSet(r, heroesAt(v));
      raw.tutorials = readStrSet(r, heroesAt(v));
      raw.met = readStrSet(r, at(MET, v));
    },
  },
  {
    name: 'story',
    since: 1,
    write(w, s, v) {
      w.bit(s.story !== undefined);
      if (s.story) writeStrSet(w, at(STORY, v), s.story);
    },
    read(r, raw, v) {
      if (r.bit()) raw.story = readStrSet(r, at(STORY, v));
    },
  },
  {
    name: 'heroKits',
    since: 1,
    write(w, s, v) {
      const kits = s.heroKits ?? {};
      const heroes = canonicalList(heroesAt(v), Object.keys(kits));
      writeStrSet(w, heroesAt(v), heroes);
      for (const h of heroes) writePower(w, h, kits[h] as Power, v);
    },
    read(r, raw, v) {
      const heroes = canonicalList(heroesAt(v), readStrSet(r, heroesAt(v)));
      raw.heroKits = Object.fromEntries(heroes.map((h) => [h, readPower(r, h, v)]));
    },
  },
  {
    name: 'heroInventory, heroItemsNext',
    since: 1,
    write(w, s, v) {
      const items = at(ITEMS, v);
      const inv = s.heroInventory ?? {};
      const heroes = canonicalList(heroesAt(v), Object.keys(inv));
      writeStrSet(w, heroesAt(v), heroes);
      for (const h of heroes) {
        const list = inv[h] ?? [];
        writeCount(w, list.length);
        const known = list.every((x) => items.includes(x));
        w.bit(known);
        for (const x of list)
          if (known) w.uint(widthFor(items.length), items.indexOf(x));
          else writeSym(w, items, x);
      }
      const next = s.heroItemsNext ?? {};
      const nextHeroes = canonicalList(heroesAt(v), Object.keys(next));
      writeStrSet(w, heroesAt(v), nextHeroes);
      for (const h of nextHeroes) writeStrSet(w, at(NEXT, v), next[h] ?? []);
    },
    read(r, raw, v) {
      const items = at(ITEMS, v);
      const heroes = canonicalList(heroesAt(v), readStrSet(r, heroesAt(v)));
      const inv: Record<string, string[]> = {};
      for (const h of heroes) {
        const n = readCount(r, 64);
        const known = r.bit();
        inv[h] = Array.from({ length: n }, () =>
          known ? (items[r.uint(widthFor(items.length))] ?? '') : readSym(r, items),
        );
      }
      raw.heroInventory = inv;
      const nextHeroes = canonicalList(heroesAt(v), readStrSet(r, heroesAt(v)));
      raw.heroItemsNext = Object.fromEntries(nextHeroes.map((h) => [h, readStrSet(r, at(NEXT, v))]));
    },
  },
  {
    name: 'bonusNext, spadeBoard, spadeTaken',
    since: 1,
    write(w, s) {
      w.eg(0, s.bonusNext ?? 0);
      w.eg(0, s.spadeBoard ?? 0);
      const taken = [...new Set(s.spadeTaken ?? [])].sort((a, b) => a - b);
      writeCount(w, taken.length);
      let prev = -1;
      for (const t of taken) {
        w.eg(0, t - prev - 1);
        prev = t;
      }
    },
    read(r, raw) {
      raw.bonusNext = r.eg(0);
      raw.spadeBoard = r.eg(0);
      const taken: number[] = [];
      let prev = -1;
      for (let i = readCount(r, 64); i > 0; i--) taken.push((prev = prev + 1 + r.eg(0)));
      raw.spadeTaken = taken;
    },
  },
  {
    name: 'explained',
    since: 2,
    write(w, s, v) {
      writeStrSet(w, at(EXPLAINED, v), s.explained ?? []);
    },
    read(r, raw, v) {
      raw.explained = readStrSet(r, at(EXPLAINED, v));
    },
  },
];

// ---------------------------------------------------------------- packing

/** Bits of the CRC after the version. */
const CRC_BITS = 16;

/**
 * Version `version`, the CRC, then `payload`, padded with zeros to whole characters: the code in
 * groups of five. The CRC covers the version and everything after itself, padding included, so a
 * build can check any code, even one from a newer version it can't read.
 */
export function packCode(version: number, payload: BitWriter): string {
  const head = new BitWriter();
  head.eg(0, version - 1);
  const body = payload.bits.slice();
  while ((head.length + CRC_BITS + body.length) % 5) body.push(0);
  const crc = new BitWriter();
  crc.uint(CRC_BITS, crc16([...head.bits, ...body]));
  return groupCode(toBase32([...head.bits, ...crc.bits, ...body]));
}

/** The file as a save code ('K7MD4-P2QJ9-…'). */
export function encodeSaveCode(save: SaveFile): string {
  const w = new BitWriter();
  for (const f of FIELDS) f.write(w, save, CODE_VERSION);
  return packCode(CODE_VERSION, w);
}

export type CodeError = 'typo' | 'newer' | 'empty';
export type CodeResult =
  | { ok: true; save: SaveFile; version: number; code: string }
  | { ok: false; error: CodeError; message: string };

const MESSAGES: Readonly<Record<CodeError, string>> = {
  typo: CODE_TYPO,
  newer: CODE_NEWER,
  empty: CODE_EMPTY,
};
const fail = (error: CodeError): CodeResult => ({ ok: false, error, message: MESSAGES[error] });

/**
 * A save code (typed or pasted: any case, dashes and spaces anywhere, O for 0, I and L for 1) as
 * a file for `slot`, brought up to this build's save format by `migrations`. A code that fails its
 * CRC, or doesn't parse, is a typo; one with a valid CRC from a later code version is 'newer'.
 */
export function decodeSaveCode(
  text: string,
  slot: SaveSlot,
  migrations: readonly SaveMigration[] = SAVE_MIGRATIONS,
): CodeResult {
  const clean = cleanCode(text);
  if (clean === null) return fail('typo');
  if (!clean.length) return fail('empty');
  const bits = fromBase32(clean);
  if (!bits) return fail('typo');
  try {
    const r = new BitReader(bits);
    const version = r.eg(0) + 1;
    const head = bits.slice(0, r.pos);
    const crc = r.uint(CRC_BITS);
    if (crc16([...head, ...bits.slice(r.pos)]) !== crc) return fail('typo');
    if (version > CODE_VERSION) return fail('newer');
    const format = CODE_SAVE_FORMAT[version];
    if (format === undefined) return fail('typo');
    const now = Date.now();
    const raw: Raw = {
      v: format,
      slot,
      created: now,
      updated: now,
      score: 0,
      devUnlockAll: false,
      devAllHeroes: false,
      devGateOpen: false,
      devInventory: false,
    };
    for (const f of FIELDS) if (f.since <= version) f.read(r, raw, version);
    // What is left is the padding of the last character: fewer than five bits, all zero.
    if (r.left >= 5 || bits.slice(r.pos).some((b) => b)) return fail('typo');
    const save = migrateSave(raw, slot, migrations);
    if (!save) return fail('typo');
    return { ok: true, save, version, code: groupCode(clean) };
  } catch (e) {
    if (e instanceof CodeFormatError) return fail('typo');
    throw e;
  }
}

// ---------------------------------------------------------------- codes in pasted text

/** Fewest characters a candidate needs (the smallest real code is longer). */
const MIN_CODE = 12;
/** Most neighbouring words tried together (a code typed with spaces). */
const MAX_WORDS = 40;

/**
 * Where a code may be in pasted text, most likely first: after `#save=` in a resume link, then
 * whole words that could be a code (longest first), then runs of neighbouring words joined (a
 * code typed with spaces), longest first. Each is the cleaned code (cleanCode), once.
 */
export function codeCandidates(text: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const c = cleanCode(s);
    if (c && c.length >= MIN_CODE && !out.includes(c)) out.push(c);
  };
  for (const m of text.matchAll(/#save=([^\s#&"'<>]+)/gi)) {
    let s = m[1] as string;
    try {
      s = decodeURIComponent(s);
    } catch {
      // keep it as it is
    }
    add(s);
  }
  const words = text
    .split(/\s+/)
    .map((t) => t.replace(/^[^0-9a-z]+|[^0-9a-z]+$/gi, ''))
    .filter(Boolean);
  const codeish = words.map((t) => cleanCode(t) !== null);
  [...words.filter((_, i) => codeish[i])]
    .sort((a, b) => (cleanCode(b) as string).length - (cleanCode(a) as string).length)
    .forEach(add);
  const joined: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (!codeish[i]) continue;
    for (let j = i + 1; j < Math.min(words.length, i + MAX_WORDS) && codeish[j]; j++)
      joined.push(words.slice(i, j + 1).join(''));
  }
  joined.sort((a, b) => b.length - a.length).forEach(add);
  return out;
}

/** The first save code found in pasted text (a message, a link, or the code alone) as a file for `slot`. */
export function readSaveCode(
  text: string,
  slot: SaveSlot,
  migrations: readonly SaveMigration[] = SAVE_MIGRATIONS,
): CodeResult {
  const candidates = codeCandidates(text);
  if (!candidates.length) return fail(cleanCode(text) === '' || !text.trim() ? 'empty' : 'typo');
  let newer = false;
  for (const c of candidates) {
    const r = decodeSaveCode(c, slot, migrations);
    if (r.ok) return r;
    if (r.error === 'newer') newer = true;
  }
  return fail(newer ? 'newer' : 'typo');
}

// ---------------------------------------------------------------- summaries and links

/** What a code's file shows: the world reached and the heroes freed (Mario counted). */
export function saveSummary(save: SaveFile): { world: number; heroes: number } {
  return { world: highestWorld(save), heroes: save.freed.length };
}

/** 'WORLD 3, 4 HEROES' (font text). */
export function summaryText(save: SaveFile): string {
  const { world, heroes } = saveSummary(save);
  return `WORLD ${world}, ${heroes} HERO${heroes === 1 ? '' : 'ES'}`;
}

/**
 * The resume link: this page's address with `#save=<code>` as its hash. The page's query is left
 * off, so a link made on a `?dev=1` or `?level=` page doesn't turn dev mode on for a friend or
 * start a level instead of asking. The downloaded copy (file://) links to the public site
 * instead (engine/site.ts): a friend can't open a file on someone else's disk.
 */
export function saveLink(code: string, href: string): string {
  const url = new URL(shareBase(href));
  url.search = '';
  url.hash = `save=${code}`;
  return url.toString();
}

/** The share sheet's message: "My SMBC REMIX save (World 3, 4 heroes): <link>". */
export function shareText(save: SaveFile, link: string): string {
  const { world, heroes } = saveSummary(save);
  return `My SMBC REMIX save (World ${world}, ${heroes} hero${heroes === 1 ? '' : 'es'}): ${link}`;
}

/** The code in a `#save=` hash, or null (main.ts: a resume link opened). */
export function linkCode(hash: string): string | null {
  const m = /^#save=([^#&]*)/i.exec(hash);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1] as string);
  } catch {
    return m[1] as string;
  }
}
