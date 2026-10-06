import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearedMainLevels,
  eraseSave,
  highestWorld,
  listSaves,
  loadSave,
  migrateSave,
  migrateV1toV2,
  migrateV2toV3,
  SAVE_MIGRATIONS,
  SAVE_VERSION,
  UNREADABLE,
  type SaveFile,
  type SlotContents,
  newSave,
  saveFromState,
  saveKey,
  stateFromSave,
  writeSave,
} from './save-files';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { SAMUS } from '@game/characters/samus';

/** listSaves with each file reduced to one field. */
const slots = <K extends keyof SaveFile>(k: K) =>
  listSaves().map((s: SlotContents) => (s && s !== UNREADABLE ? s[k] : s));

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

describe('save files', () => {
  it('a new file starts on World 1 with 3 lives, 5 for two players', () => {
    const s = newSave(2, 'mario', null);
    expect(s).toMatchObject({
      v: SAVE_VERSION,
      slot: 2,
      character: 'mario',
      character2: null,
      lives: 3,
      score: 0,
      coins: 0,
      cleared: [],
      pages: ['smb-1'],
      secrets: [],
      position: { page: 'smb-1', node: 'start' },
      gameCleared: false,
    });
    expect(newSave(1, 'mario', 'luigi').lives).toBe(5);
  });

  it('a new file starts each hero at its real default power', () => {
    expect(newSave(1, 'mario', 'link')).toMatchObject({
      powerState: 'small',
      hp: 0,
      powerState2: 'full',
      hp2: 6,
    });
    expect(newSave(1, 'samus')).toMatchObject({ powerState: 'full', hp: SAMUS.startHp });
    expect(newSave(1, 'wario')).toMatchObject({ powerState: 'small', hp: 0 });
  });

  it('keys are smbc.save.1..3', () => {
    expect([1, 2, 3].map((n) => saveKey(n as 1 | 2 | 3))).toEqual([
      'smbc.save.1',
      'smbc.save.2',
      'smbc.save.3',
    ]);
  });

  it('round-trips and stamps updated', () => {
    const s = newSave(1, 'link', 'samus');
    s.created = 1000;
    s.updated = 1000;
    s.cleared = ['1-0', '1-1', '1-2'];
    s.pages = ['smb-1', 'smb-4', 'hub'];
    s.secrets = ['bonus-1'];
    s.position = { page: 'smb-4', node: 'start' };
    s.score = 12345;
    s.kit = { hearts: 5, bombs: 3 };
    s.gameCleared = true;
    expect(writeSave(s)).toBe(true);
    expect(s.updated).toBeGreaterThan(1000);
    expect(loadSave(1)).toEqual(s);
  });

  it('the three slots are independent; erase empties one', () => {
    writeSave(newSave(1, 'mario'));
    writeSave(newSave(3, 'link'));
    expect(slots('character')).toEqual(['mario', null, 'link']);
    const s3 = loadSave(3)!;
    s3.score = 900;
    writeSave(s3);
    expect(loadSave(1)!.score).toBe(0);
    eraseSave(1);
    expect(slots('score')).toEqual([null, null, 900]);
  });

  it('corrupt data does not load; listSaves marks it unreadable until erased', () => {
    store.set('smbc.save.1', '{not json');
    store.set('smbc.save.2', '[1,2]');
    store.set('smbc.save.3', JSON.stringify({ v: 1, character: 7 }));
    expect([1, 2, 3].map((n) => loadSave(n as 1 | 2 | 3))).toEqual([null, null, null]);
    expect(listSaves()).toEqual([UNREADABLE, UNREADABLE, UNREADABLE]);
    eraseSave(2);
    expect(listSaves()).toEqual([UNREADABLE, null, UNREADABLE]);
  });

  it('an unknown version (newer or invalid) does not load and is unreadable', () => {
    for (const v of [SAVE_VERSION + 1, 0, 'x', undefined]) {
      store.set('smbc.save.1', JSON.stringify({ ...newSave(1, 'mario'), v }));
      expect(loadSave(1)).toBeNull();
      expect(listSaves()[0]).toBe(UNREADABLE);
    }
  });

  it('missing or wrong-typed fields fall back to defaults; the slot comes from the key', () => {
    store.set(
      'smbc.save.2',
      JSON.stringify({
        v: 1,
        slot: 3,
        character: 'luigi',
        lives: 'many',
        cleared: ['1-1', 4, null],
        worlds: [3, 'two'],
        kit: { hearts: 4, bad: 'x' },
        position: { world: 3 },
        bogus: true,
      }),
    );
    const s = loadSave(2)!;
    expect(s.slot).toBe(2);
    expect(s.character).toBe('luigi');
    expect(s.lives).toBe(3);
    // Any clear means a file from before the tutorial: 1-0 counts as cleared.
    expect(s.cleared).toEqual(['1-0', '1-1']);
    expect(s.pages).toEqual(['smb-1', 'smb-3']);
    expect(s.kit).toEqual({ hearts: 4 });
    expect(s.position).toEqual({ page: 'smb-3', node: 'start' });
    expect((s as unknown as { bogus?: boolean }).bogus).toBeUndefined();
  });

  it('runs migrations from older versions in order', () => {
    // A hypothetical v1 → v2 step (v1 stored `hero`, v2 calls it `character`).
    const migrations = [(old: Record<string, unknown>) => ({ ...old, v: 2, character: old.hero })];
    const s = migrateSave({ v: 1, hero: 'simon', score: 50 }, 1, migrations);
    expect(s?.character).toBe('simon');
    expect(s?.score).toBe(50);
    expect(s?.v).toBe(2); // stamped with the version it was migrated to
    // Data already at the newest version is not migrated again; a missing step is unreadable.
    expect(migrateSave({ v: 2, character: 'ryu' }, 1, migrations)?.character).toBe('ryu');
    expect(migrateSave({ v: 1, hero: 'ryu' }, 1, [undefined as never, migrations[0]!])).toBeNull();
  });

  it('write → migrate → save → load runs each migration once', () => {
    let calls = 0;
    const migrations = [
      (old: Record<string, unknown>) => {
        calls++;
        return { ...old, v: 2, score: Number(old.score) * 10 };
      },
    ];
    const v1 = { ...newSave(1, 'mario'), v: 1, score: 7 };
    store.set('smbc.save.1', JSON.stringify(v1));
    const migrated = migrateSave(JSON.parse(store.get('smbc.save.1')!), 1, migrations)!;
    expect(migrated.score).toBe(70);
    writeSave(migrated);
    const again = migrateSave(JSON.parse(store.get('smbc.save.1')!), 1, migrations)!;
    expect(calls).toBe(1);
    expect(again.v).toBe(2);
    expect(again.score).toBe(70);
  });

  it('sanitises numbers, worlds and the position on load', () => {
    const put = (o: Record<string, unknown>) => {
      store.set('smbc.save.1', JSON.stringify({ ...newSave(1, 'mario'), ...o }));
      return loadSave(1)!;
    };
    expect(put({ lives: 0 }).lives).toBe(1);
    expect(put({ lives: -5 }).lives).toBe(1);
    expect(put({ lives: 250 }).lives).toBe(99);
    expect(put({ lives: 4.7 }).lives).toBe(4);
    expect(put({ score: -100, coins: 12.5 })).toMatchObject({ score: 0, coins: 12 });
    expect(put({ score: 1234.9, coins: -1 })).toMatchObject({ score: 1234, coins: 0 });
    expect(put({ pages: ['smb-3', 'smb-3', 'smb-9', 'hub', 'x', 3, 'smb-8', 'smb-1'] }).pages).toEqual([
      'smb-1',
      'smb-3',
      'hub',
      'smb-8',
    ]);
    expect(put({ pages: [] }).pages).toEqual(['smb-1']);
    expect(put({ pages: 'smb-2' }).pages).toEqual(['smb-1']);
    expect(put({ pages: ['smb-1', 'smb-4'], position: { page: 'smb-4', node: '4-2' } }).position).toEqual({
      page: 'smb-4',
      node: '4-2',
    });
    // A world not reached: the hero goes to the start of the highest world reached.
    expect(put({ pages: ['smb-1', 'smb-4'], position: { page: 'smb-6', node: '6-2' } }).position).toEqual({
      page: 'smb-4',
      node: 'start',
    });
    expect(put({ pages: ['smb-1', 'smb-2'], position: { page: 'smb-2', node: 5 } }).position).toEqual({
      page: 'smb-2',
      node: 'start',
    });
  });

  it('keeps the last node of open worlds only (missing in older files: none)', () => {
    const put = (o: Record<string, unknown>) => {
      store.set('smbc.save.1', JSON.stringify({ ...newSave(1, 'mario'), ...o }));
      return loadSave(1)!;
    };
    expect(newSave(1, 'mario').lastNode).toEqual({});
    const { lastNode: _, ...old } = newSave(1, 'mario');
    store.set('smbc.save.1', JSON.stringify(old));
    expect(loadSave(1)!.lastNode).toEqual({});
    expect(
      put({
        pages: ['smb-1', 'smb-4', 'hub'],
        lastNode: {
          'smb-1': '1-2',
          'smb-4': '4-1',
          'smb-3': '3-1',
          x: 'a',
          'smb-2': 7,
          hub: 'warp-lost',
          1: '1-1',
        },
      }).lastNode,
    ).toEqual({ 'smb-1': '1-2', 'smb-4': '4-1', hub: 'warp-lost' });
    expect(put({ lastNode: ['1-1'] }).lastNode).toEqual({});
    expect(put({ lastNode: { 'smb-1': '' } }).lastNode).toEqual({});
  });

  it('keeps pending reveal ids of open worlds only, each once', () => {
    const put = (o: Record<string, unknown>) => {
      store.set('smbc.save.1', JSON.stringify({ ...newSave(1, 'mario'), ...o }));
      return loadSave(1)!;
    };
    expect(newSave(1, 'mario').pendingReveal).toEqual([]);
    expect(
      put({
        pages: ['smb-1', 'smb-4', 'hub'],
        pendingReveal: [
          'smb-4:start',
          'smb-4:start',
          'smb-2:start',
          'start',
          7,
          'smb-1:1-1>1-2',
          ':x',
          'hub:',
          'hub:lost',
          '4:start',
        ],
      }).pendingReveal,
    ).toEqual(['smb-4:start', 'smb-1:1-1>1-2', 'hub:lost']);
    expect(put({ pendingReveal: 'x' }).pendingReveal).toEqual([]);
  });

  it("renames World 1's old warp spot road (0.4.0: from 1-1; 0.4.1: from 1-2)", () => {
    const put = (o: Record<string, unknown>) => {
      store.set('smbc.save.1', JSON.stringify({ ...newSave(1, 'mario'), ...o }));
      return loadSave(1)!;
    };
    const s = put({
      cleared: ['1-1', '1-2'],
      secrets: ['bonus-1'],
      position: { page: 'smb-1', node: 'bonus-1' },
      lastNode: { 'smb-1': '1-1>bonus-1' },
      pendingReveal: ['smb-1:1-1>bonus-1', 'smb-1:bonus-1', 'smb-1:1-2>bonus-1'],
    });
    expect(s.pendingReveal).toEqual(['smb-1:1-2>bonus-1', 'smb-1:bonus-1']);
    // lastNode holds node ids: a road id (or any id the page has no node for) is dropped.
    expect(s.lastNode).toEqual({});
    expect(s.position).toEqual({ page: 'smb-1', node: 'bonus-1' });
    // A v1 file ('1:1-1>bonus-1') too.
    store.set(
      'smbc.save.2',
      JSON.stringify({
        ...newSave(2, 'mario'),
        v: 1,
        worlds: [1],
        pendingReveal: ['1:1-1>bonus-1', '1:bonus-1'],
      }),
    );
    expect(loadSave(2)?.pendingReveal).toEqual(['smb-1:1-2>bonus-1', 'smb-1:bonus-1']);
  });

  it('keeps the developer "unlock all" flag only when it is true (missing in older files: off)', () => {
    const put = (o: Record<string, unknown>) => {
      store.set('smbc.save.1', JSON.stringify({ ...newSave(1, 'mario'), ...o }));
      return loadSave(1)!;
    };
    expect(newSave(1, 'mario').devUnlockAll).toBe(false);
    const { devUnlockAll: _, ...old } = newSave(1, 'mario');
    store.set('smbc.save.1', JSON.stringify(old));
    const loaded = loadSave(1)!;
    expect(loaded.devUnlockAll).toBe(false);
    expect(loaded.v).toBe(SAVE_VERSION);
    expect(put({ devUnlockAll: true }).devUnlockAll).toBe(true);
    for (const bad of ['true', 1, null, {}]) expect(put({ devUnlockAll: bad }).devUnlockAll).toBe(false);
    // Unlocking opens nothing in the file itself.
    expect(put({ devUnlockAll: true }).pages).toEqual(['smb-1']);
  });

  it('keeps the developer "all heroes" flag only when it is true (missing: off), freed untouched', () => {
    const put = (o: Record<string, unknown>) => {
      store.set('smbc.save.1', JSON.stringify({ ...newSave(1, 'mario'), ...o }));
      return loadSave(1)!;
    };
    expect(newSave(1, 'mario').devAllHeroes).toBe(false);
    const { devAllHeroes: _, ...old } = newSave(1, 'mario');
    store.set('smbc.save.1', JSON.stringify(old));
    expect(loadSave(1)!.devAllHeroes).toBe(false);
    expect(loadSave(1)!.v).toBe(SAVE_VERSION);
    expect(put({ devAllHeroes: true }).devAllHeroes).toBe(true);
    for (const bad of ['true', 1, null, {}]) expect(put({ devAllHeroes: bad }).devAllHeroes).toBe(false);
    expect(put({ devAllHeroes: true }).freed).toEqual(['mario']);
  });

  it('counts main levels cleared and the highest world', () => {
    const s = newSave(1, 'mario');
    s.cleared = ['1-1', '1-2', '1-2', '8-4', 'll-1-1', 'custom-x', '9-1'];
    s.pages = ['smb-1', 'smb-2', 'smb-5', 'hub', 'll-1'];
    expect(clearedMainLevels(s)).toBe(3);
    expect(highestWorld(s)).toBe(5);
  });

  it('a file from before the tutorial (0.5.0) with any clear counts 1-0 as cleared; no format bump', () => {
    // Played before 1-0 existed: 1-1 cleared, standing on World 1's old start node.
    const old = { ...newSave(1, 'mario'), cleared: ['1-1'], position: { page: 'smb-1', node: 'start' } };
    store.set(saveKey(1), JSON.stringify(old));
    const s = loadSave(1) as SaveFile;
    expect(s.v).toBe(SAVE_VERSION);
    expect(s.cleared).toEqual(['1-0', '1-1']);
    // The old start node is still a node (now 1-0's): nothing to remap.
    expect(s.position).toEqual({ page: 'smb-1', node: 'start' });
    expect(clearedMainLevels(s)).toBe(1);
    // A Lost Levels clear counts too; a file with no clears still has the tutorial ahead.
    store.set(saveKey(2), JSON.stringify({ ...newSave(2, 'mario'), cleared: ['ll-1-1'] }));
    expect(loadSave(2)?.cleared).toEqual(['1-0', 'll-1-1']);
    store.set(saveKey(3), JSON.stringify(newSave(3, 'mario')));
    expect(loadSave(3)?.cleared).toEqual([]);
    // No clears but standing past the start (1-1 was open on a new file before 0.5.0): back on 1-0.
    store.set(
      saveKey(3),
      JSON.stringify({ ...newSave(3, 'mario'), position: { page: 'smb-1', node: '1-1' } }),
    );
    expect(loadSave(3)?.position).toEqual({ page: 'smb-1', node: 'start' });
    // Not on the developer's "Unlock all", where it may stand anywhere.
    store.set(
      saveKey(3),
      JSON.stringify({
        ...newSave(3, 'mario'),
        devUnlockAll: true,
        position: { page: 'smb-1', node: '1-1' },
      }),
    );
    expect(loadSave(3)?.position).toEqual({ page: 'smb-1', node: '1-1' });
    // Already there: kept once, in place.
    expect(migrateSave({ ...newSave(1, 'mario'), cleared: ['1-0', '1-1'] }, 1)?.cleared).toEqual([
      '1-0',
      '1-1',
    ]);
  });

  it('never throws when storage is unavailable', () => {
    (globalThis as { localStorage?: unknown }).localStorage = undefined;
    expect(loadSave(1)).toBeNull();
    expect(writeSave(newSave(1, 'mario'))).toBe(false);
    expect(() => eraseSave(1)).not.toThrow();
  });
});

describe('migration v1 → v2 (map pages by id, 0.4.0)', () => {
  /** A real 0.3.0 file: warped from 1-2 to World 4, World 2 opened by 1-4, standing on 4-1. */
  const V1 = {
    v: 1,
    slot: 1,
    created: 1759700000000,
    updated: 1759790000000,
    character: 'link',
    character2: null,
    lives: 4,
    score: 52300,
    coins: 41,
    powerState: 'full',
    hp: 5,
    kit: { hearts: 5, bombs: 2 },
    powerState2: 'small',
    hp2: 0,
    kit2: {},
    cleared: ['1-1', '1-3', '1-2', '1-4', '4-1'],
    worlds: [1, 4, 2],
    secrets: ['bonus-3'],
    position: { world: 4, node: '4-1' },
    gameCleared: false,
    lastNode: { 1: '1-4', 4: '4-1', 2: 'start' },
    pendingReveal: ['2:start', '2:start>2-1', '2:2-1', '1:1-4>world-2', '4:4-1>4-2', '4:4-2'],
    devUnlockAll: false,
  };

  it('is the first migration (v3 follows); v1 files load at the current version', () => {
    expect(SAVE_MIGRATIONS[0]).toBe(migrateV1toV2);
    expect(newSave(1, 'mario').v).toBe(SAVE_VERSION);
  });

  it('maps worlds, the position, lastNode and pending reveal ids to page ids', () => {
    expect(migrateV1toV2(V1)).toEqual({
      ...Object.fromEntries(Object.entries(V1).filter(([k]) => k !== 'worlds')),
      v: 2,
      pages: ['smb-1', 'smb-4', 'smb-2'],
      position: { page: 'smb-4', node: '4-1' },
      lastNode: { 'smb-1': '1-4', 'smb-4': '4-1', 'smb-2': 'start' },
      pendingReveal: [
        'smb-2:start',
        'smb-2:start>2-1',
        'smb-2:2-1',
        'smb-1:1-4>smb-2',
        'smb-4:4-1>4-2',
        'smb-4:4-2',
      ],
    });
  });

  it('loads a stored v1 file with nothing lost, and the counts the file select shows', () => {
    store.set('smbc.save.1', JSON.stringify(V1));
    const s = loadSave(1)!;
    expect(s).toEqual({
      ...newSave(1, 'link'),
      ...Object.fromEntries(Object.entries(V1).filter(([k]) => k !== 'worlds')),
      v: SAVE_VERSION,
      freed: ['mario', 'link'],
      cleared: ['1-0', ...V1.cleared],
      pages: ['smb-1', 'smb-4', 'smb-2'],
      position: { page: 'smb-4', node: '4-1' },
      lastNode: { 'smb-1': '1-4', 'smb-4': '4-1', 'smb-2': 'start' },
      pendingReveal: [
        'smb-2:start',
        'smb-2:start>2-1',
        'smb-2:2-1',
        'smb-1:1-4>smb-2',
        'smb-4:4-1>4-2',
        'smb-4:4-2',
      ],
    });
    expect(clearedMainLevels(s)).toBe(5);
    expect(highestWorld(s)).toBe(4);
    // Saved again it stays at the current version and loads the same.
    writeSave(s);
    expect(loadSave(1)).toEqual(s);
  });

  it('keeps a cleared game, and a 2P file still loads', () => {
    store.set(
      'smbc.save.2',
      JSON.stringify({ ...V1, character2: 'samus', gameCleared: true, worlds: [1, 2, 3, 4, 5, 6, 7, 8] }),
    );
    const s = loadSave(2)!;
    expect(s.character2).toBe('samus');
    expect(s.gameCleared).toBe(true);
    expect(s.pages).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`));
    expect(highestWorld(s)).toBe(8);
  });

  it('a v1 file without the later optional fields still migrates', () => {
    const { lastNode: _l, pendingReveal: _p, devUnlockAll: _d, ...old } = V1;
    store.set('smbc.save.3', JSON.stringify({ ...old, position: 'bad', worlds: 'bad' }));
    const s = loadSave(3)!;
    expect(s.pages).toEqual(['smb-1']);
    expect(s.position).toEqual({ page: 'smb-1', node: 'start' });
    expect(s.lastNode).toEqual({});
    expect(s.pendingReveal).toEqual([]);
    expect(s.cleared).toEqual(['1-0', ...V1.cleared]);
  });
});

describe('migration v2 → v3 (freed heroes, 0.5.0)', () => {
  /** A 0.4.x file: Link and Samus playing, two-player. */
  const V2 = {
    ...newSave(1, 'mario'),
    v: 2,
    character: 'link',
    character2: 'samus',
    powerState: 'full',
    hp: 6,
    powerState2: 'full',
    hp2: 30,
  } as Record<string, unknown>;
  delete V2.freed;

  it('files are written at v3', () => {
    expect(SAVE_VERSION).toBe(3);
    expect(SAVE_MIGRATIONS).toEqual([migrateV1toV2, migrateV2toV3]);
    expect(newSave(1, 'mario').v).toBe(3);
  });

  it('a new file has freed only Mario (and the heroes it was made with)', () => {
    expect(newSave(1, 'mario').freed).toEqual(['mario']);
    expect(newSave(1, 'mario', null).freed).toEqual(['mario']);
    expect(newSave(1, 'link', 'mario').freed).toEqual(['mario', 'link']);
    expect(newSave(1, 'wario').freed).toEqual(['mario']);
  });

  it('keeps Mario plus the hero(es) last used, deduped, nulls and unknown ids dropped', () => {
    expect(migrateV2toV3(V2).freed).toEqual(['mario', 'link', 'samus']);
    expect(migrateV2toV3({ ...V2, character2: null }).freed).toEqual(['mario', 'link']);
    expect(migrateV2toV3({ ...V2, character: 'mario', character2: 'mario' }).freed).toEqual(['mario']);
    expect(migrateV2toV3({ ...V2, character: 'wario', character2: 'luigi' }).freed).toEqual([
      'mario',
      'luigi',
    ]);
    expect(migrateV2toV3({ ...V2, character: 7, character2: undefined }).freed).toEqual(['mario']);
    expect(migrateV2toV3(V2).v).toBe(3);
  });

  it('loads a stored v2 file locked to its last heroes, the rest of it untouched', () => {
    store.set('smbc.save.1', JSON.stringify(V2));
    const s = loadSave(1)!;
    expect(s.v).toBe(3);
    expect(s.freed).toEqual(['mario', 'link', 'samus']);
    expect(s.character).toBe('link');
    expect(s.character2).toBe('samus');
    expect(s.hp2).toBe(30);
    writeSave(s);
    expect(loadSave(1)).toEqual(s);
  });

  it('a v1 file goes through both migrations', () => {
    store.set('smbc.save.2', JSON.stringify({ v: 1, character: 'ryu', character2: 'luigi', worlds: [1, 2] }));
    const s = loadSave(2)!;
    expect(s.v).toBe(3);
    expect(s.pages).toEqual(['smb-1', 'smb-2']);
    expect(s.freed).toEqual(['mario', 'ryu', 'luigi']);
  });

  it('validation keeps an array of known ids, each once, always with Mario', () => {
    const put = (freed: unknown) => {
      store.set('smbc.save.3', JSON.stringify({ ...newSave(3, 'mario'), freed }));
      return loadSave(3)!.freed;
    };
    expect(put(['mario', 'luigi'])).toEqual(['mario', 'luigi']);
    expect(put(['luigi'])).toEqual(['mario', 'luigi']);
    expect(put(['luigi', 'luigi', 'wario', 3, null, 'link'])).toEqual(['mario', 'luigi', 'link']);
    expect(put([])).toEqual(['mario']);
    // Not an array at all: Mario and the file's heroes, as a migrated file gets.
    for (const bad of ['luigi', 1, null, { luigi: true }]) expect(put(bad)).toEqual(['mario']);
    store.set('smbc.save.3', JSON.stringify({ ...newSave(3, 'link'), freed: 'x' }));
    expect(loadSave(3)!.freed).toEqual(['mario', 'link']);
  });
});

describe('save file ↔ game state', () => {
  it('round-trips heroes, lives, score, coins and power', () => {
    const save = newSave(1, 'mario', 'link');
    const state = stateFromSave(save, CHARACTERS);
    expect(state.character).toBe(MARIO);
    expect(state.character2).toBe(LINK);
    expect(state.lives).toBe(5);
    state.lives = 7;
    state.score = 4200;
    state.coins = 33;
    state.powerState = 'fire';
    state.hp2 = 2;
    state.kit2 = { hearts: 4, bombs: 2 };
    const out = saveFromState(save, state);
    expect(save.lives).toBe(5); // the input is not changed
    expect(out).toMatchObject({
      character: 'mario',
      character2: 'link',
      lives: 7,
      score: 4200,
      coins: 33,
      powerState: 'fire',
      hp2: 2,
      kit2: { hearts: 4, bombs: 2 },
    });
    const again = stateFromSave(out, CHARACTERS);
    expect(again).toEqual({ ...state, world: 1, stage: 1 });
    expect(again.kit2).not.toBe(state.kit2);
  });

  it('keeps the map progress when copying the run in', () => {
    const save = newSave(2, 'luigi');
    save.cleared = ['1-1'];
    save.position = { page: 'smb-1', node: '1-1' };
    const out = saveFromState(save, stateFromSave(save, CHARACTERS));
    expect(out.cleared).toEqual(['1-1']);
    expect(out.position).toEqual({ page: 'smb-1', node: '1-1' });
    expect(out.slot).toBe(2);
  });

  it('hp is capped at the hero maximum (kit.maxHp, else its starting hp)', () => {
    const save = newSave(1, 'samus', 'link');
    save.hp = 500;
    save.hp2 = 40;
    let s = stateFromSave(save, CHARACTERS);
    expect(s.hp).toBe(SAMUS.startHp);
    expect(s.hp2).toBe(6);
    save.kit = { maxHp: 199 };
    save.hp = 150;
    s = stateFromSave(save, CHARACTERS);
    expect(s.hp).toBe(150);
    s.hp = 900;
    s.hp2 = 900;
    const out = saveFromState(save, s);
    expect(out.hp).toBe(199);
    expect(out.hp2).toBe(6);
  });

  it('a hp hero carries its hp; a power state that does not suit the hero is reset', () => {
    const save = newSave(1, 'samus');
    save.powerState = 'full';
    save.hp = 22;
    expect(stateFromSave(save, CHARACTERS).hp).toBe(22);
    save.powerState = 'fire';
    const s = stateFromSave(save, CHARACTERS);
    expect(s.character).toBe(SAMUS);
    expect(s.powerState).toBe('full');
  });

  it('an unknown hero id falls back to the first character, starting fresh', () => {
    const save = newSave(1, 'wario', 'waluigi');
    save.powerState = 'fire';
    save.kit = { x: 1 };
    const s = stateFromSave(save, CHARACTERS);
    expect(s.character).toBe(CHARACTERS[0]);
    expect(s.character2).toBe(CHARACTERS[0]);
    expect(s.powerState).toBe('small');
    expect(s.kit).toEqual({});
    expect(stateFromSave(newSave(1, 'luigi'), CHARACTERS).character).toBe(LUIGI);
  });
});
