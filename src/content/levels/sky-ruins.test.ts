import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { DEFAULT_LEGEND, T, tileDef } from '@game/level/tiles';
import type { LevelData } from '@game/level/schema';
import { getLevel, levelIds } from '.';

// Owner design (2-1 coin heaven): past the end of the clouds an up-arrow of coins hints at
// something higher; a hidden vine block over the second to last cloud platform on the right
// grows a vine up to a Link-themed sky area (2-1-sky2) with captive Link, and a gap in its
// clouds drops back into 2-1 exactly where the coin heaven's own drop does.

const load = (id: string): LevelData =>
  parseTextMap(readFileSync(join(import.meta.dirname, 'world2', `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
const coinsIn = (l: LevelData, x0: number, x1: number, y0: number, y1: number): string[] => {
  const rows: string[] = [];
  for (let y = y0; y <= y1; y++) {
    let row = '';
    for (let x = x0; x <= x1; x++) row += tile(l, x, y) === T.COIN ? '$' : '.';
    rows.push(row);
  }
  return rows;
};
const cloudRun = (l: LevelData, y: number, x0: number, x1: number) => {
  for (let x = x0; x <= x1; x++) expect(tile(l, x, y), `${x},${y}`).toBe(T.CLOUD_BLOCK);
};

describe('the hidden vine block tile', () => {
  it('is a hidden block holding a vine, written `7` in maps', () => {
    expect(tileDef(T.HIDDEN_VINE).block).toEqual({ kind: 'hidden', content: 'vine' });
    expect(tileDef(T.HIDDEN_VINE).collision).toBe('none');
    expect(DEFAULT_LEGEND['7']).toBe(T.HIDDEN_VINE);
  });
});

describe('2-1 sky: the way up to the sky ruins', () => {
  const l = load('2-1-sky');

  it('an up-arrow of coins just past the end of the clouds', () => {
    expect(tile(l, 61, 13)).toBe(T.CLOUD_BLOCK);
    expect(coinsIn(l, 62, 66, 5, 10)).toEqual([
      '..$..', //
      '.$$$.',
      '$.$.$',
      '..$..',
      '..$..',
      '..$..',
    ]);
  });

  it('three small cloud platforms on the right; the hidden vine block is over the second to last', () => {
    cloudRun(l, 12, 65, 67);
    cloudRun(l, 11, 70, 72);
    cloudRun(l, 12, 75, 77);
    for (const x of [62, 63, 64, 68, 69, 73, 74, 78, 79])
      for (let y = 10; y <= 13; y++) {
        expect(tile(l, x, y), `${x},${y}`).not.toBe(T.CLOUD_BLOCK);
      }
    // Four rows above the platform: a normal jump bumps it, like any ? block over the ground.
    expect(tile(l, 71, 7)).toBe(T.HIDDEN_VINE);
    for (let y = 8; y <= 10; y++) expect(tile(l, 71, y)).toBe(T.AIR);
    expect(l.zones).toContainEqual({ kind: 'vine', x: 71, y: 7, target: { level: '2-1-sky2', x: 4, y: 14 } });
  });

  it('still drops back into 2-1 at column 162 anywhere off the clouds', () => {
    expect(l.zones).toContainEqual({ kind: 'pit', x: 0, target: { level: '2-1', x: 162, y: 0 } });
    for (let x = 62; x < l.width; x++) expect(tile(l, x, 13), `${x}`).toBe(T.AIR);
  });
});

describe('2-1 sky ruins (2-1-sky2): a Link-themed area above the coin heaven', () => {
  const l = load('2-1-sky2');

  it('is a 2-1 sub-area arrived at by climbing the vine, keeping the running clock', () => {
    expect(l.parent).toBe('2-1');
    expect([l.world, l.stage]).toEqual([2, 1]);
    expect(l.time).toBeNull();
    expect(l.startMode).toBe('climb');
    expect(l.start).toEqual({ x: 4, y: 14 });
    expect(tile(l, 4, 13)).toBe(T.AIR); // the vine comes up through here
    cloudRun(l, 13, 0, 3);
    cloudRun(l, 13, 5, 55);
    expect(tile(l, 0, 13)).toBe(T.CLOUD_BLOCK);
  });

  it('is in the level library like the other sub-areas', () => {
    expect(levelIds()).toContain('2-1-sky2');
    expect(getLevel('2-1-sky2').parent).toBe('2-1');
  });

  it('captive Link waits beside the temple doorway, on the clouds, clear of the ledges', () => {
    expect(l.entities).toContainEqual({ type: 'captive', x: 30, y: 12, props: { hero: 'link' } });
    expect(tile(l, 30, 13)).toBe(T.CLOUD_BLOCK);
    expect(tile(l, 30, 12)).toBe(T.AIR);
    expect(l.decor).toContainEqual({ kind: 'ruin-temple', x: 26, y: 12 });
  });

  it('ruins on the clouds: pillars, a statue, and three triangles of coins over the temple', () => {
    const kinds = l.decor.map((d) => d.kind);
    expect(kinds.filter((k) => k === 'ruin-pillar').length).toBeGreaterThanOrEqual(2);
    expect(kinds).toContain('ruin-pillar-broken');
    expect(kinds).toContain('ruin-statue');
    expect(coinsIn(l, 24, 30, 6, 9)).toEqual([
      '...$...', //
      '..$$$..',
      '.$...$.',
      '$$$.$$$',
    ]);
  });

  it('the way out: the clouds end in a drop, signposted by a down-arrow of coins, into 2-1 at column 162', () => {
    expect(tile(l, 55, 13)).toBe(T.CLOUD_BLOCK);
    for (let x = 56; x < l.width; x++)
      for (let y = 0; y <= 14; y++) {
        expect(tileDef(tile(l, x, y) as number).collision, `${x},${y}`).toBe('none');
      }
    expect(coinsIn(l, 57, 61, 5, 10)).toEqual([
      '..$..', //
      '..$..',
      '..$..',
      '$.$.$',
      '.$$$.',
      '..$..',
    ]);
    // The same target and entry (a pit drop) as the coin heaven's own way back.
    expect(l.zones).toEqual(
      expect.arrayContaining([{ kind: 'pit', x: 0, target: { level: '2-1', x: 162, y: 0 } }]),
    );
    expect(l.zones.filter((z) => z.kind === 'pit')).toEqual(
      load('2-1-sky').zones.filter((z) => z.kind === 'pit'),
    );
  });
});
