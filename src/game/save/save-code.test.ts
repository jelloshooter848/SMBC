import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Rng } from '@engine/rng';
import { CHARACTERS } from '@game/characters/registry';
import { HERO_ITEMS } from '@game/items/catalog';
import { hasKey } from '@game/items/flags';
import { heroStart, itemRules } from '@game/items/heroes';
import { ITEM_IDS, NEXT_ORDER } from '@game/bonus/items';
import { MAP_PAGES } from '@content/worldmap';
import { CRYSTAL_BALL } from '@game/map/captives';
import { KAKARIKO } from '@game/town/secret-house';
import { beat, STORY_REV } from '@game/story/beats';
import { BitWriter, cleanCode, crc16, fromBase32, toBase32 } from './code-bits';
import {
  CODE_DICTS,
  CODE_EMPTY,
  CODE_NEWER,
  CODE_TYPO,
  CODE_VERSION,
  codeCandidates,
  decodeSaveCode,
  dictFingerprints,
  encodeSaveCode,
  packCode,
  readSaveCode,
  SAVE_CODE_FIELDS,
  saveLink,
  saveSummary,
  shareText,
  summaryText,
} from './save-code';
import {
  migrateSave,
  newSave,
  SAVE_MIGRATIONS,
  SAVE_VERSION,
  type SaveFile,
  type SaveSlot,
} from './save-files';

// ------------------------------------------------------------------ helpers

/** What a code keeps of a file, with set-like lists in a fixed order (a code doesn't keep order). */
function canonical(s: SaveFile): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (SAVE_CODE_FIELDS[k as keyof SaveFile] !== 'code') continue;
    out[k] = v;
  }
  const sorted = (x: unknown) => (Array.isArray(x) ? [...x].sort() : x);
  for (const k of ['cleared', 'pages', 'secrets', 'freed', 'tutorials', 'met', 'story'] as const)
    if (k in out) out[k] = sorted(out[k]);
  return out;
}

function roundTrip(s: SaveFile, slot: SaveSlot = s.slot): SaveFile {
  const r = decodeSaveCode(encodeSaveCode(s), slot);
  if (!r.ok) throw new Error(`decode failed: ${r.error}`);
  return r.save;
}

function expectRoundTrip(s: SaveFile): SaveFile {
  const back = roundTrip(s);
  expect(canonical(back)).toEqual(canonical(s));
  return back;
}

/** A hero's kit with every item found (their own rules give each item, stacking ones to the top). */
function fullHero(id: string): { powerState: string; hp: number; kit: Record<string, number> } {
  const c = CHARACTERS.find((h) => h.id === id);
  if (!c) throw new Error(id);
  const s = heroStart(c);
  const p = {
    def: c,
    scratch: { ...s.kit },
    hp: s.hp,
    powerState: c.damage.kind === 'powerup' ? 'fire' : 'full',
    startTransition: () => {},
  };
  const rules = itemRules(id);
  for (let k = 0; k < 6; k++)
    for (const item of HERO_ITEMS[id]?.items ?? [])
      try {
        rules?.give(p as never, item.id);
      } catch {
        // a hero whose give needs a live level (Sophia's transition): its flag still counts
        p.scratch[hasKey(item.id)] = 1;
      }
  if (id === 'mario' || id === 'luigi') p.powerState = 'fire';
  return { powerState: p.powerState, hp: p.hp, kit: p.scratch };
}

const LEVELS = MAP_PAGES.flatMap((p) => p.nodes.flatMap((n) => (n.level ? [n.level] : [])));
const SMB_PAGES = MAP_PAGES.filter((p) => p.group === 'smb').map((p) => p.id);

/** A file that has seen and done everything (Chapter 1 and the Lost Kingdom). */
function fullSave(): SaveFile {
  const heroes = CHARACTERS.map((c) => c.id);
  const raw = {
    ...newSave(1, 'mario'),
    character: 'mario',
    lives: 99,
    coins: 999,
    wallet: true,
    ...(() => {
      const m = fullHero('mario');
      return { powerState: m.powerState, hp: m.hp, kit: m.kit };
    })(),
    cleared: LEVELS.slice(),
    pages: MAP_PAGES.map((p) => p.id),
    secrets: [
      'bonus-1',
      'bonus-2',
      KAKARIKO,
      'bonus-3',
      CRYSTAL_BALL,
      'bonus-5',
      'bonus-6',
      'bonus-7',
      'bonus-8',
    ],
    position: { page: 'll-13', node: 'll-13-4' },
    gameCleared: true,
    lastNode: Object.fromEntries(
      MAP_PAGES.filter((p) => p.group !== 'arena' && p.id !== 'hub').map((p) => [
        p.id,
        p.nodes[p.nodes.length - (p.group === 'smb' ? 2 : 1)]?.id ?? 'start',
      ]),
    ),
    freed: heroes,
    tutorials: heroes,
    met: [...heroes, 'larry'],
    inventoryUnlocked: true,
    heroKits: Object.fromEntries(heroes.filter((h) => h !== 'mario').map((h) => [h, fullHero(h)])),
    heroInventory: { mario: ['star', 'flower', '1up'], link: ['mushroom', 'star'], samus: ['1up'] },
    heroItemsNext: { mario: ['star'] },
    bonusNext: 2,
    story: [
      STORY_REV,
      beat.opening,
      beat.spell,
      beat.luigiRuns,
      beat.fakes,
      beat.crash,
      beat.anchor42,
      beat.rift,
      beat.bowser84,
      beat.hub,
      beat.arena,
      ...SMB_PAGES.flatMap((p, i) => [
        beat.enter(p),
        beat.gate(p),
        beat.sealed(p),
        ...(i > 0 ? [beat.welcome(p)] : []),
        ...(i < 7 ? [beat.remark(`${i + 1}-4`)] : []),
      ]),
    ],
  };
  const s = migrateSave(raw, 1);
  if (!s) throw new Error('full save did not validate');
  return s;
}

/** A file part way through World 4: three castles, four heroes, a few items. */
function midSave(): SaveFile {
  const raw = {
    ...newSave(2, 'link'),
    character: 'link',
    lives: 7,
    coins: 63,
    powerState: 'full',
    hp: 10,
    kit: {
      found: 1,
      maxHp: 10,
      [hasKey('bomb-bag')]: 1,
      bombs: 6,
      tool: 0,
      magic: 20,
      [hasKey('shield-spell')]: 1,
    },
    cleared: [
      '1-0',
      '1-1',
      '1-2',
      '1-3',
      '1-4',
      '2-1',
      '2-2',
      '2-3',
      '2-4',
      '3-1',
      '3-2',
      '3-3',
      '3-4',
      '4-1',
    ],
    pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
    secrets: ['bonus-1', KAKARIKO],
    position: { page: 'smb-4', node: '4-1' },
    lastNode: { 'smb-1': '1-4', 'smb-2': '2-4', 'smb-3': '3-4' },
    pendingReveal: ['smb-4:4-1>4-2', 'smb-4:4-2'],
    freed: ['mario', 'luigi', 'link', 'megaman'],
    tutorials: ['mario', 'luigi', 'link'],
    met: ['mario', 'luigi', 'link', 'megaman', 'samus'],
    heroKits: {
      mario: { powerState: 'big', hp: 0, kit: { found: 1 } },
      megaman: {
        powerState: 'full',
        hp: 28,
        kit: { found: 1, helmet: 1, [hasKey('saw-disc')]: 1, wsaw: 17 },
      },
    },
    heroInventory: { link: ['mushroom', 'flower'] },
    bonusNext: 1,
    spadeBoard: 1,
    spadeTaken: [0, 5],
    story: [
      STORY_REV,
      beat.opening,
      beat.spell,
      beat.luigiRuns,
      beat.fakes,
      ...['smb-1', 'smb-2', 'smb-3', 'smb-4'].map(beat.enter),
      ...['smb-2', 'smb-3', 'smb-4'].map(beat.welcome),
      ...['smb-1', 'smb-2', 'smb-3'].flatMap((p) => [beat.gate(p), beat.sealed(p)]),
      ...['1-4', '2-4', '3-4'].map(beat.remark),
    ],
  };
  const s = migrateSave(raw, 2);
  if (!s) throw new Error('mid save did not validate');
  return s;
}

const pick = <T>(rng: Rng, xs: readonly T[], p = 0.5): T[] => xs.filter(() => rng.chance(p));

/** A random but well-formed save file (validated by migrateSave, as every stored file is). */
function randomSave(seed: number): SaveFile {
  const rng = new Rng(seed * 7919 + 13);
  const heroes = CHARACTERS.map((c) => c.id);
  const slot = (1 + rng.int(3)) as SaveSlot;
  const character = rng.chance(0.03) ? 'zelda' : rng.pick(heroes);
  const character2 = rng.chance(0.25) ? rng.pick(heroes.filter((h) => h !== character)) : null;
  const pages = [
    'smb-1',
    ...pick(
      rng,
      MAP_PAGES.map((p) => p.id),
    ),
  ];
  const page = MAP_PAGES.find((p) => p.id === rng.pick(pages));
  const odd = () => `x${rng.int(1000)}-${rng.pick(['a', 'b', 'Z', ':', '_', 'é'])}`;
  const num = () =>
    rng.chance(0.6) ? 1 : rng.chance(0.7) ? rng.int(120) : rng.chance(0.5) ? -rng.int(9) : rng.float() * 50;
  const kitFor = (h: string) => {
    const kit: Record<string, number> = {};
    if (rng.chance(0.9)) kit.found = 1;
    for (const item of HERO_ITEMS[h]?.items ?? [])
      if (rng.chance(0.5)) kit[hasKey(item.id)] = rng.chance(0.95) ? 1 : 2;
    for (const k of [
      'maxHp',
      'tool',
      'bombs',
      'magic',
      'missiles',
      'tanks',
      'ninpo',
      'hearts',
      'wsaw',
      'triple',
    ])
      if (rng.chance(0.25)) kit[k] = num();
    if (rng.chance(0.15)) kit[odd()] = num();
    return kit;
  };
  const power = (h: string) => ({
    powerState: rng.pick(['small', 'big', 'fire', 'full', 'full', 'weird']),
    hp: rng.chance(0.2) ? rng.float() * 30 : rng.int(100),
    kit: kitFor(h),
  });
  const p1 = power(character);
  const p2 = power(character2 ?? '');
  const story = [...pick(rng, CODE_DICTS.story, 0.3), ...(rng.chance(0.2) ? [odd()] : [])];
  const raw: Record<string, unknown> = {
    v: SAVE_VERSION,
    slot,
    created: 1,
    updated: 2,
    character,
    character2,
    lives: 1 + rng.int(99),
    score: rng.int(999999),
    coins: rng.int(1000),
    wallet: rng.chance(0.5),
    powerState: p1.powerState,
    hp: p1.hp,
    kit: p1.kit,
    powerState2: p2.powerState,
    hp2: p2.hp,
    kit2: p2.kit,
    cleared: [...pick(rng, LEVELS), ...(rng.chance(0.1) ? [odd()] : [])],
    pages,
    secrets: [...pick(rng, CODE_DICTS.secrets), ...(rng.chance(0.1) ? [odd()] : [])],
    position: { page: page?.id ?? 'smb-1', node: page ? rng.pick(page.nodes).id : 'start' },
    gameCleared: rng.chance(0.3),
    lastNode: Object.fromEntries(
      pick(rng, pages).map((id) => [id, rng.pick(MAP_PAGES.find((p) => p.id === id)?.nodes ?? []).id]),
    ),
    pendingReveal: pick(rng, pages, 0.2).map((p) =>
      rng.pick([`${p}:${odd()}`, `${p}:start`, `${p}:start>${rng.pick(pages)}`, `${p}:a>b>c`, `${p}:>x`]),
    ),
    devUnlockAll: rng.chance(0.1),
    devAllHeroes: rng.chance(0.1),
    devGateOpen: rng.chance(0.1),
    devInventory: rng.chance(0.1),
    freed: pick(rng, heroes),
    tutorials: pick(rng, heroes),
    met: pick(rng, [...heroes, 'larry']),
    inventoryUnlocked: rng.chance(0.5),
    bonusOpen: rng.chance(0.7),
    bonusGuard: rng.chance(0.5),
    heroInventory: Object.fromEntries(
      pick(rng, heroes, 0.3).map((h) => [h, Array.from({ length: rng.int(13) }, () => rng.pick(ITEM_IDS))]),
    ),
    heroItemsNext: Object.fromEntries(pick(rng, heroes, 0.2).map((h) => [h, pick(rng, NEXT_ORDER)])),
    bonusNext: rng.int(3),
    spadeBoard: rng.int(8),
    spadeTaken: pick(
      rng,
      Array.from({ length: 18 }, (_, i) => i),
      0.4,
    ),
    heroKits: Object.fromEntries(pick(rng, heroes, 0.6).map((h) => [h, power(h)])),
  };
  if (rng.chance(0.8)) raw.story = story;
  const s = migrateSave(raw, slot);
  if (!s) throw new Error(`random save ${seed} did not validate`);
  return s;
}

// ------------------------------------------------------------------ the field-coverage guard

/** The field names of `interface <name>` in a source file (one per line, `name?:` or `name:`). */
function interfaceFields(file: string, name: string): string[] {
  const src = readFileSync(new URL(file, import.meta.url), 'utf8');
  const start = src.indexOf(`export interface ${name}`);
  expect(start, `interface ${name} in ${file}`).toBeGreaterThanOrEqual(0);
  const body = src.slice(src.indexOf('{', start) + 1);
  const out: string[] = [];
  let depth = 0;
  for (const line of body.split('\n')) {
    if (depth === 0 && /^\}/.test(line)) break;
    const m = /^ {2}(\w+)\??:/.exec(line);
    if (depth === 0 && m) out.push(m[1] as string);
    depth += (line.match(/[{(]/g) ?? []).length - (line.match(/[})]/g) ?? []).length;
    depth = Math.max(0, depth);
  }
  return out;
}

describe('save codes: every SaveFile field is handled', () => {
  it('SAVE_CODE_FIELDS lists exactly the fields of SaveFile (and the MapProgress it extends)', () => {
    const fields = new Set([
      ...interfaceFields('./save-files.ts', 'SaveFile'),
      ...interfaceFields('../map/types.ts', 'MapProgress'),
    ]);
    // Sanity: the parser found the file's real fields.
    for (const f of ['v', 'kit2', 'wallet', 'story', 'heroKits', 'cleared', 'position'])
      expect(fields).toContain(f);
    const missing = [...fields].filter((f) => !(f in SAVE_CODE_FIELDS));
    expect(
      missing,
      'a SaveFile field the save code does not handle: add it to SAVE_CODE_FIELDS and to the codec ' +
        '(a new CODE_VERSION, docs/SAVE_CODES.md)',
    ).toEqual([]);
    expect(Object.keys(SAVE_CODE_FIELDS).filter((f) => !fields.has(f))).toEqual([]);
  });

  it('a new file and a full file hold no field outside the list', () => {
    for (const s of [newSave(1, 'mario', 'luigi'), fullSave(), midSave()])
      for (const k of Object.keys(s)) expect(SAVE_CODE_FIELDS).toHaveProperty(k);
  });

  it('only the score, the timestamps, the slot, the format version, dev flags and legacy fields are left out', () => {
    const out = Object.entries(SAVE_CODE_FIELDS)
      .filter(([, how]) => how !== 'code')
      .map(([k]) => k)
      .sort();
    expect(out).toEqual(
      [
        'created',
        'devAllHeroes',
        'devGateOpen',
        'devInventory',
        'devUnlockAll',
        'inventory',
        'itemsNext',
        'score',
        'slot',
        'updated',
        'v',
      ].sort(),
    );
  });
});

// ------------------------------------------------------------------ round trips

describe('save codes: round trips', () => {
  it('a new file', () => {
    const s = newSave(1, 'mario');
    const back = expectRoundTrip(s);
    expect(back.slot).toBe(1);
    expect(back.score).toBe(0);
  });

  it('a mid-game file and a 100% file', () => {
    expectRoundTrip(midSave());
    const full = fullSave();
    const back = expectRoundTrip(full);
    expect(back.freed).toHaveLength(CHARACTERS.length);
    expect(Object.keys(back.heroKits ?? {})).toHaveLength(CHARACTERS.length - 1);
  });

  it('a two-player file: character2, its power, hp and kit2', () => {
    const s = migrateSave(
      {
        ...newSave(3, 'samus', 'simon'),
        powerState2: 'full',
        hp2: 13,
        kit2: { found: 1, maxHp: 14, hearts: 37, [hasKey('dagger')]: 1, subs: 2 },
        hp: 47,
        kit: { found: 1, maxHp: 60, tanks: 3, missiles: 12, [hasKey('missiles')]: 1 },
      },
      3,
    ) as SaveFile;
    const back = expectRoundTrip(s);
    expect(back.character2).toBe('simon');
    expect(back.kit2).toEqual(s.kit2);
    expect(back.hp2).toBe(13);
  });

  it('every field, one at a time, away from its default', () => {
    const base = newSave(1, 'mario');
    const changes: Partial<SaveFile>[] = [
      { character: 'ryu', powerState: 'full', hp: 7, kit: { found: 1, maxHp: 12, ninpo: 40 } },
      { character2: 'bill', powerState2: 'full', hp2: 4, kit2: { found: 1, maxHp: 4, tool: 1 } },
      { lives: 42 },
      { coins: 999, wallet: true },
      { coins: 57 },
      { powerState: 'fire' },
      { hp: 3 },
      { kit: { found: 1, odd: 2.5 } },
      { gameCleared: true },
      { cleared: ['1-0', '1-1', 'll-3-2'], pages: ['smb-1', 'll-3'] },
      { pages: ['smb-1', 'smb-2', 'hub', 'arena'] },
      { secrets: ['bonus-1', 'mystery'] },
      { pages: ['smb-1', 'smb-5'], position: { page: 'smb-5', node: '5-3' } },
      { pages: ['smb-1', 'smb-2'], lastNode: { 'smb-1': '1-4', 'smb-2': 'bonus-2' } },
      { pages: ['smb-1', 'smb-2'], pendingReveal: ['smb-2:start', 'smb-1:1-4>smb-2'] },
      { freed: ['mario', 'sophia'] },
      { tutorials: ['mario', 'link', 'ryu'] },
      { met: ['mario', 'larry', 'bill'] },
      { inventoryUnlocked: true },
      { bonusOpen: false, bonusGuard: true },
      { heroInventory: { mario: ['1up', '1up', 'star'], ryu: ['flower'] } },
      { heroItemsNext: { mario: ['mushroom', 'star'], bill: ['flower'] } },
      { bonusNext: 2 },
      { spadeBoard: 5, spadeTaken: [1, 2] },
      { heroKits: { link: { powerState: 'full', hp: 2, kit: { found: 1, maxHp: 8 } } } },
      { wallet: true },
      { story: [STORY_REV, beat.opening, 'joined:link', 'restyle:2-2', 'never-heard-of-it'] },
      { story: [] },
    ];
    for (const c of changes) {
      const s = migrateSave({ ...base, ...c }, 1) as SaveFile;
      for (const [k, v] of Object.entries(c)) if (k !== 'pages') expect(s[k as keyof SaveFile]).toEqual(v);
      expectRoundTrip(s);
    }
  });

  it('a file without a story list stays without one (seeded on load as before)', () => {
    const s = newSave(1, 'mario');
    delete s.story;
    expect(roundTrip(s).story).toBeUndefined();
  });

  it('v3 and v1 files, migrated, round-trip', () => {
    const v3 = {
      v: 3,
      slot: 2,
      created: 5,
      updated: 6,
      character: 'link',
      character2: null,
      lives: 4,
      score: 1234,
      coins: 88,
      powerState: 'full',
      hp: 6,
      kit: { maxHp: 8, bombs: 3 },
      powerState2: 'small',
      hp2: 0,
      kit2: {},
      cleared: ['1-1', '1-2', '1-3', '1-4', '2-1'],
      pages: ['smb-1', 'smb-2'],
      secrets: ['bonus-1'],
      position: { page: 'smb-2', node: '2-1' },
      gameCleared: false,
      lastNode: { 'smb-1': '1-4' },
      pendingReveal: [],
      freed: ['mario', 'link'],
      inventory: ['star', 'mushroom'],
      itemsNext: ['flower'],
    };
    const s3 = migrateSave(v3, 2) as SaveFile;
    expect(s3.wallet).toBe(false);
    expect(s3.heroInventory).toEqual({ mario: ['star', 'mushroom'] });
    expectRoundTrip(s3);
    const v1 = {
      v: 1,
      slot: 1,
      created: 1,
      updated: 1,
      character: 'mario',
      character2: 'luigi',
      lives: 3,
      score: 0,
      coins: 0,
      powerState: 'big',
      hp: 0,
      kit: {},
      powerState2: 'fire',
      hp2: 0,
      kit2: {},
      worlds: [1, 2, 3],
      cleared: ['1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4'],
      position: { world: 3, node: 'start' },
      gameCleared: false,
      lastNode: { 1: '1-4', 2: '2-4' },
      pendingReveal: ['3:start'],
    };
    expectRoundTrip(migrateSave(v1, 1) as SaveFile);
  });

  it('the file comes back in the slot it is loaded into, with no score and fresh timestamps', () => {
    const s = midSave();
    s.score = 5000;
    const r = decodeSaveCode(encodeSaveCode(s), 3);
    expect(r.ok && r.save.slot).toBe(3);
    expect(r.ok && r.save.score).toBe(0);
    expect(r.ok && r.save.created).toBeGreaterThan(1e12);
    expect(r.ok && r.save.devUnlockAll).toBe(false);
  });

  it('ammo, hit points and odd values come back exactly (no refill)', () => {
    const s = fullSave();
    s.heroKits = {
      ...s.heroKits,
      link: { powerState: 'full', hp: 3, kit: { found: 1, maxHp: 16, bombs: 1, magic: 7 } },
    };
    s.hp = 0;
    s.kit = { ...s.kit, weird: -3, frac: 0.1 + 0.2 };
    expectRoundTrip(migrateSave(s, 1) as SaveFile);
  });

  it('200 random files round-trip', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = randomSave(seed);
      const back = roundTrip(s);
      expect(canonical(back), `seed ${seed}`).toEqual(canonical(s));
    }
  });

  it('code lengths: new, mid-game and 100% (docs/SAVE_CODES.md)', () => {
    const len = (s: SaveFile) => encodeSaveCode(s).replace(/-/g, '').length;
    // Right after 1-4, when the backup card asks: World 2's road still to draw in.
    const firstCastle = migrateSave(
      {
        ...newSave(1, 'mario'),
        powerState: 'fire',
        coins: 42,
        cleared: ['1-0', '1-1', '1-2', '1-3', '1-4'],
        pages: ['smb-1', 'smb-2'],
        position: { page: 'smb-1', node: '1-4' },
        lastNode: { 'smb-1': '1-4' },
        pendingReveal: ['smb-1:1-4>smb-2', 'smb-2:start'],
        freed: ['mario', 'luigi'],
        met: ['mario', 'luigi'],
        heroInventory: { mario: ['star'] },
        story: [STORY_REV, beat.opening, beat.spell, beat.enter('smb-1'), beat.luigiRuns, beat.remark('1-4')],
      },
      1,
    ) as SaveFile;
    expectRoundTrip(firstCastle);
    const lengths = {
      new: len(newSave(1, 'mario')),
      firstCastle: len(firstCastle),
      mid: len(midSave()),
      full: len(fullSave()),
    };
    console.info(`[save codes] characters without dashes: ${JSON.stringify(lengths)}`);
    expect(lengths.new).toBeLessThanOrEqual(30);
    expect(lengths.firstCastle).toBeLessThanOrEqual(45);
    expect(lengths.mid).toBeLessThanOrEqual(80);
    expect(lengths.full).toBeLessThanOrEqual(125);
  });
});

// ------------------------------------------------------------------ the format

describe('save codes: format', () => {
  it('is Crockford Base32 in groups of five', () => {
    const code = encodeSaveCode(midSave());
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{1,5}(-[0-9A-HJKMNP-TV-Z]{1,5})*$/);
    for (const g of code.split('-').slice(0, -1)) expect(g).toHaveLength(5);
  });

  it('starts with the version, then the CRC over everything else', () => {
    const bits = fromBase32(cleanCode(encodeSaveCode(newSave(1, 'mario'))) as string) as number[];
    // Version 1 is Exp-Golomb 0 → a single 1 bit.
    expect(bits[0]).toBe(1);
    const crc = bits.slice(1, 17).reduce((a, b) => a * 2 + b, 0);
    expect(crc16([bits[0] as number, ...bits.slice(17)])).toBe(crc);
  });

  it('forgives case, dashes, spaces and Crockford look-alikes (O → 0, I and L → 1)', () => {
    const s = midSave();
    const code = encodeSaveCode(s);
    const plain = code.replace(/-/g, '');
    const variants = [
      code.toLowerCase(),
      plain,
      ` ${code.replace(/-/g, ' - ')} `,
      plain.replace(/(.{3})/g, '$1 '),
      code.replace(/-/g, '--'),
      code.replace(/0/g, 'O').replace(/1/g, 'I'),
      code.replace(/1/g, 'l').toLowerCase(),
    ];
    for (const v of variants) {
      const r = decodeSaveCode(v, 2);
      expect(r.ok, v).toBe(true);
      if (r.ok) expect(canonical(r.save)).toEqual(canonical(s));
    }
  });

  it('rejects every single-character change, and swapped, lost or extra characters', () => {
    const plain = encodeSaveCode(midSave()).replace(/-/g, '');
    const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    let tried = 0;
    for (let i = 0; i < plain.length; i++)
      for (const ch of B32) {
        if (ch === plain[i]) continue;
        const typo = plain.slice(0, i) + ch + plain.slice(i + 1);
        const r = decodeSaveCode(typo, 1);
        expect(r.ok, `${i}:${ch}`).toBe(false);
        if (!r.ok) expect(r.message).toBe(CODE_TYPO);
        tried++;
      }
    expect(tried).toBe(plain.length * 31);
    for (let i = 0; i + 1 < plain.length; i++) {
      if (plain[i] === plain[i + 1]) continue;
      const swapped = plain.slice(0, i) + plain[i + 1] + plain[i] + plain.slice(i + 2);
      expect(decodeSaveCode(swapped, 1).ok, `swap ${i}`).toBe(false);
    }
    for (let i = 0; i < plain.length; i++)
      expect(decodeSaveCode(plain.slice(0, i) + plain.slice(i + 1), 1).ok, `lost ${i}`).toBe(false);
    for (let i = 0; i <= plain.length; i += 3)
      expect(decodeSaveCode(plain.slice(0, i) + 'Q' + plain.slice(i), 1).ok, `extra ${i}`).toBe(false);
  });

  it('nonsense, empty input and characters outside the alphabet are rejected', () => {
    expect(decodeSaveCode('', 1)).toMatchObject({ ok: false, error: 'empty', message: CODE_EMPTY });
    expect(decodeSaveCode('   -- ', 1)).toMatchObject({ ok: false, error: 'empty' });
    expect(decodeSaveCode('HELLO-WORLD', 1)).toMatchObject({ ok: false, error: 'typo' });
    expect(decodeSaveCode('UUUUU', 1)).toMatchObject({ ok: false, error: 'typo' });
    expect(decodeSaveCode('0000000000000000000000000', 1)).toMatchObject({ ok: false, error: 'typo' });
  });

  it('a code from a newer version asks for an update (and a typo in one is still a typo)', () => {
    const w = new BitWriter();
    w.uint(40, 123456789);
    const newer = packCode(CODE_VERSION + 1, w);
    expect(decodeSaveCode(newer, 1)).toMatchObject({ ok: false, error: 'newer', message: CODE_NEWER });
    expect(CODE_NEWER).toBe('THIS CODE IS FROM A NEWER VERSION. UPDATE THE GAME TO LOAD IT');
    const typo = newer.replace(/-/g, '').slice(0, -2) + (newer.endsWith('Z') ? 'Y' : 'Z') + newer.slice(-1);
    expect(decodeSaveCode(typo, 1)).toMatchObject({ ok: false, error: 'typo' });
    expect(readSaveCode(`load this: ${newer}`, 1)).toMatchObject({ ok: false, error: 'newer' });
  });

  it('an old code loads through the save migrations: a later field gets its default', () => {
    const code = encodeSaveCode(midSave());
    // A pretend next save format (v5) with one new field, as a future build would add.
    const v4to5 = (old: Record<string, unknown>) => ({ ...old, v: 5, shinyNewThing: 'default' });
    const r = decodeSaveCode(code, 1, [...SAVE_MIGRATIONS, v4to5]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.save.v).toBe(5);
      expect(r.save.cleared).toEqual(expect.arrayContaining(midSave().cleared));
    }
  });

  it('dictionaries are frozen per code version (a new id needs a new chunk and version)', () => {
    // Change these only together with CODE_VERSION: codes already shared depend on them.
    expect(dictFingerprints()).toEqual({
      heroes: '1:d059',
      met: '1:91ad',
      pages: '1:b4c0',
      levels: '1:b313',
      secrets: '1:1a3a',
      story: '1:c6c3',
      kitFlags: '1:32dc',
      kitNums: '1:b2e2',
    });
  });
});

// ------------------------------------------------------------------ the game's own ids are known

describe('save codes: dictionaries know the game', () => {
  it('every hero, page, level and secret of this build is in its dictionary', () => {
    for (const c of CHARACTERS) expect(CODE_DICTS.heroes).toContain(c.id);
    expect(CODE_DICTS.met).toContain('larry');
    for (const p of MAP_PAGES) {
      expect(CODE_DICTS.pages).toContain(p.id);
      for (const n of p.nodes) {
        if (n.level) expect(CODE_DICTS.levels).toContain(n.level);
        if (n.unlock) expect(CODE_DICTS.secrets).toContain(n.unlock);
        if (n.town) expect(CODE_DICTS.secrets).toContain(n.town);
      }
      for (const x of [...p.paths.map((q) => q.exit), ...p.exits.map((e) => e.requires)])
        if (x?.startsWith('secret:')) expect(CODE_DICTS.secrets).toContain(x.slice(7));
    }
    expect(CODE_DICTS.secrets).toContain(CRYSTAL_BALL);
    expect(CODE_DICTS.secrets).toContain(KAKARIKO);
  });

  it("every hero's found-item flag is in their kit dictionary", () => {
    for (const [hero, items] of Object.entries(HERO_ITEMS))
      for (const i of items.items) expect(CODE_DICTS.kitFlags[hero]).toContain(hasKey(i.id));
  });

  it('every story beat of Chapter 1 is in the story dictionary', () => {
    const ids = [
      STORY_REV,
      beat.opening,
      beat.spell,
      beat.luigiRuns,
      beat.fakes,
      beat.crash,
      beat.rift,
      beat.bowser84,
      beat.anchor42,
      beat.hub,
      beat.arena,
      ...SMB_PAGES.flatMap((p) => [beat.enter(p), beat.gate(p), beat.sealed(p)]),
      ...SMB_PAGES.slice(1).map(beat.welcome),
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => beat.remark(`${n}-4`)),
    ];
    for (const id of ids) expect(CODE_DICTS.story).toContain(id);
  });
});

// ------------------------------------------------------------------ pasted messages and links

describe('save codes: finding the code in pasted text', () => {
  const s = midSave();
  const code = encodeSaveCode(s);
  const ok = (text: string) => {
    const r = readSaveCode(text, 2);
    expect(r.ok, text).toBe(true);
    if (r.ok) expect(canonical(r.save)).toEqual(canonical(s));
  };

  it('a share message with words and a resume link around it', () => {
    ok(shareText(s, saveLink(code, 'https://example.com/SMBC/')));
    ok(`Here's my save!! ${saveLink(code, 'https://example.com/SMBC/?x=1')} see you`);
    ok(`hey\n\n${code}\n\nthat's the code. Load it tonight ok?`);
    ok(`code: "${code.toLowerCase()}".`);
    ok(`MY CODE IS ${code.replace(/-/g, ' ')} THANKS`);
    ok(`https://example.com/SMBC/#save=${code.replace(/-/g, '')}`);
    ok(`https://example.com/SMBC/#save=${encodeURIComponent(code)}&utm=x`);
  });

  it('the first candidates are the link, then whole words that look like a code', () => {
    const c = codeCandidates(`see https://x.y/#save=${code} and ${code}`);
    expect(c[0]).toBe(code.replace(/-/g, ''));
  });

  it('a message with a broken code says the code is wrong', () => {
    const broken = code.slice(0, 10) + (code[10] === 'A' ? 'B' : 'A') + code.slice(11);
    expect(readSaveCode(`my save ${broken} :)`, 1)).toMatchObject({
      ok: false,
      error: 'typo',
      message: CODE_TYPO,
    });
    expect(readSaveCode('just words, no code', 1)).toMatchObject({ ok: false, error: 'typo' });
    expect(readSaveCode('  ', 1)).toMatchObject({ ok: false, error: 'empty' });
  });
});

describe('save codes: summaries and links', () => {
  it('names the world reached and the heroes freed', () => {
    const s = midSave();
    expect(saveSummary(s)).toEqual({ world: 4, heroes: 4 });
    expect(summaryText(s)).toBe('WORLD 4, 4 HEROES');
    expect(summaryText(newSave(1, 'mario'))).toBe('WORLD 1, 1 HERO');
    // The page's query is left off: a friend's link must not turn on ?dev=1 or start a ?level=.
    const link = saveLink('ABCDE-FGHJK', 'https://example.com/SMBC/index.html?dev=1#level=x');
    expect(link).toBe('https://example.com/SMBC/index.html#save=ABCDE-FGHJK');
    expect(saveLink('ABCDE', 'https://example.com/SMBC/?level=1-1&char=link')).toBe(
      'https://example.com/SMBC/#save=ABCDE',
    );
    expect(shareText(s, link)).toBe(`My SMBC REMIX save (World 4, 4 heroes): ${link}`);
  });

  it('Base32 round-trips bits', () => {
    const bits = [1, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1];
    expect(fromBase32(toBase32(bits))?.slice(0, bits.length)).toEqual(bits);
  });
});
