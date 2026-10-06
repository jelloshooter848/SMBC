import { describe, expect, it } from 'vitest';
import type { LevelData, Zone } from '../level/schema';
import { hasSecretExit, secretExitLevels, secretExitsIn } from './secret-exits';

/** A made-up level: only the id, the parent and the zones matter to the rule. */
const lvl = (id: string, zones: Zone[], parent: string | null = null): LevelData =>
  ({ id, parent, zones }) as unknown as LevelData;
const pipe = (level: string): Zone => ({
  kind: 'pipe',
  x: 1,
  y: 1,
  dir: 'down',
  target: { level, x: 1, y: 1 },
});
const flag = (next: string): Zone => ({ kind: 'exit', x: 9, next });
/** Worlds 1 and 2 of two levels each, in play order; `zones` go into 1-1, `areas` after it. */
const world = (zones: Zone[], areas: LevelData[] = []) =>
  secretExitsIn([
    lvl('1-1', [...zones, flag('1-2')]),
    ...areas,
    lvl('1-2', [flag('2-1')]),
    lvl('2-1', [flag('2-2')]),
    lvl('2-2', []),
  ]);

describe('secretExitsIn (made-up levels)', () => {
  it('a warp zone alone counts', () => {
    expect([...world([{ kind: 'warp', x: 5, w: 16, worlds: [2] }])]).toEqual(['1-1']);
  });

  it('a pipe into another world counts', () => {
    expect([...world([pipe('2-1')])]).toEqual(['1-1']);
  });

  it('a vine into another world counts', () => {
    expect([...world([{ kind: 'vine', x: 3, y: 4, target: { level: '2-2', x: 1, y: 1 } }])]).toEqual(['1-1']);
  });

  it('a pit into another world counts', () => {
    expect([...world([{ kind: 'pit', x: 3, target: { level: '2-1', x: 1, y: 1 } }])]).toEqual(['1-1']);
  });

  it('a pipe to its own next level, or within the level, does not', () => {
    expect([...world([pipe('1-2')])]).toEqual([]);
    expect([...world([pipe('1-1-bonus')], [lvl('1-1-bonus', [pipe('1-1')], '1-1')])]).toEqual([]);
  });

  it('without a flagpole, the next level in order is the normal way out', () => {
    const levels = [lvl('1-1', [pipe('1-2')]), lvl('1-2', [pipe('2-1')]), lvl('1-3', []), lvl('2-1', [])];
    expect([...secretExitsIn(levels)]).toEqual(['1-2']);
  });

  it('an area counts for its main level (through `parent`, two deep), never on its own', () => {
    const areas = [
      lvl('1-1-sky', [], '1-1'),
      lvl('1-1-warp', [{ kind: 'warp', x: 1, w: 16, worlds: [2] }], '1-1-sky'),
    ];
    expect([...world([], areas)]).toEqual(['1-1']);
    const piped = [lvl('1-1-under', [pipe('2-2')], '1-1')];
    expect([...world([], piped)]).toEqual(['1-1']);
  });
});

describe('secretExitLevels', () => {
  const smb = () => [...secretExitLevels()].filter((id) => !id.startsWith('ll-')).sort();
  const lost = () => [...secretExitLevels()].filter((id) => id.startsWith('ll-')).sort();

  it('SMB: 1-2 (warp zone) and 4-2 (two warp zones) only', () => {
    expect(smb()).toEqual(['1-2', '4-2']);
  });

  it('Lost Levels: every level with a warp zone, in it or in one of its areas', () => {
    expect(lost()).toEqual([
      'll-1-2',
      'll-10-2',
      'll-10-3',
      'll-11-4',
      'll-3-1',
      'll-5-1',
      'll-5-2',
      'll-8-1',
    ]);
  });

  it('names main levels, never their sub-areas', () => {
    expect(hasSecretExit('1-2')).toBe(true);
    expect(hasSecretExit('4-2')).toBe(true);
    expect(hasSecretExit('1-2-intro')).toBe(false);
    expect(hasSecretExit('4-2-warp')).toBe(false);
  });

  it('pipes within a level (8-4) or to its own next level do not count', () => {
    expect(hasSecretExit('8-4')).toBe(false);
    expect(hasSecretExit('1-1')).toBe(false);
    expect(hasSecretExit('ll-8-4')).toBe(false);
    expect(hasSecretExit('nope')).toBe(false);
    expect(hasSecretExit(undefined)).toBe(false);
  });
});
