import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearedMainLevels,
  eraseSave,
  highestWorld,
  listSaves,
  loadSave,
  migrateSave,
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
      worlds: [1],
      secrets: [],
      position: { world: 1, node: 'start' },
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
    s.cleared = ['1-1', '1-2'];
    s.worlds = [1, 4];
    s.secrets = ['bonus-1'];
    s.position = { world: 4, node: 'start' };
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
    expect(s.cleared).toEqual(['1-1']);
    expect(s.worlds).toEqual([1, 3]);
    expect(s.kit).toEqual({ hearts: 4 });
    expect(s.position).toEqual({ world: 3, node: 'start' });
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
    expect(put({ worlds: [3, 3, 9, 0, 2.5, 8, 'x', 1] }).worlds).toEqual([1, 3, 8]);
    expect(put({ worlds: [] }).worlds).toEqual([1]);
    expect(put({ worlds: [1, 4], position: { world: 4, node: '4-2' } }).position).toEqual({
      world: 4,
      node: '4-2',
    });
    // A world not reached: the hero goes to the start of the highest world reached.
    expect(put({ worlds: [1, 4], position: { world: 6, node: '6-2' } }).position).toEqual({
      world: 4,
      node: 'start',
    });
    expect(put({ worlds: [1, 2], position: { world: 2, node: 5 } }).position).toEqual({
      world: 2,
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
      put({ worlds: [1, 4], lastNode: { 1: '1-2', 4: '4-1', 3: '3-1', x: 'a', 2: 7, 9: '9-1' } }).lastNode,
    ).toEqual({ 1: '1-2', 4: '4-1' });
    expect(put({ lastNode: ['1-1'] }).lastNode).toEqual({});
    expect(put({ lastNode: { 1: '' } }).lastNode).toEqual({});
  });

  it('keeps pending reveal ids of open worlds only, each once', () => {
    const put = (o: Record<string, unknown>) => {
      store.set('smbc.save.1', JSON.stringify({ ...newSave(1, 'mario'), ...o }));
      return loadSave(1)!;
    };
    expect(newSave(1, 'mario').pendingReveal).toEqual([]);
    expect(
      put({ worlds: [1, 4], pendingReveal: ['4:start', '4:start', '2:start', 'start', 7, '1:1-1>1-2', ':x'] })
        .pendingReveal,
    ).toEqual(['4:start', '1:1-1>1-2']);
    expect(put({ pendingReveal: 'x' }).pendingReveal).toEqual([]);
  });

  it('counts main levels cleared and the highest world', () => {
    const s = newSave(1, 'mario');
    s.cleared = ['1-1', '1-2', '1-2', '8-4', 'll-1-1', 'custom-x', '9-1'];
    s.worlds = [1, 2, 5];
    expect(clearedMainLevels(s)).toBe(3);
    expect(highestWorld(s)).toBe(5);
  });

  it('never throws when storage is unavailable', () => {
    (globalThis as { localStorage?: unknown }).localStorage = undefined;
    expect(loadSave(1)).toBeNull();
    expect(writeSave(newSave(1, 'mario'))).toBe(false);
    expect(() => eraseSave(1)).not.toThrow();
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
    save.position = { world: 1, node: '1-1' };
    const out = saveFromState(save, stateFromSave(save, CHARACTERS));
    expect(out.cleared).toEqual(['1-1']);
    expect(out.position).toEqual({ world: 1, node: '1-1' });
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
