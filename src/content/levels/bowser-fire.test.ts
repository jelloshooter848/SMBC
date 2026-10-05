import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import type { LevelData } from '@game/level/schema';

// Bowser's long-range flames start at the original's bowserFireBallStart column (normal
// difficulty). 8-4 and D-4 have none.

const load = (dir: string, id: string): LevelData =>
  parseTextMap(readFileSync(join(import.meta.dirname, dir, `${id}.map`), 'utf8'), id);

const fireZones = (l: LevelData) => l.zones.filter((z) => z.kind === 'bowser-fire');

const SMB1: [string, number][] = [
  ['1-4', 92],
  ['2-4', 87],
  ['3-4', 89],
  ['4-4', 256],
  ['5-4', 87],
  ['6-4', 92],
  ['7-4', 296],
];
const LOST: [string, number][] = [
  ['1-4', 96],
  ['4-4', 144],
  ['5-4', 154],
  ['6-4', 276],
  ['7-4', 171],
  ['10-4', 136],
  ['11-4', 171],
  ['12-4', 173],
];

describe('Bowser fire zones', () => {
  it.each(SMB1)('SMB1 %s starts at column %i, before Bowser', (id, x) => {
    const l = load(`world${id[0]}`, id);
    expect(fireZones(l)).toEqual([{ kind: 'bowser-fire', x }]);
    const bowser = l.entities.find((e) => e.type === 'bowser' && !e.props?.fake);
    expect(bowser!.x).toBeGreaterThan(x);
  });

  it.each(LOST)('Lost Levels %s starts at column %i, before Bowser', (id, x) => {
    const w = id.split('-')[0];
    const l = load(`lost/world${w}`, `ll-${id}`);
    expect(fireZones(l)).toEqual([{ kind: 'bowser-fire', x }]);
    const bowser = l.entities.find((e) => e.type === 'bowser' && !e.props?.fake);
    expect(bowser!.x).toBeGreaterThan(x);
  });

  it('none in castles without one (SMB1 8-4, Lost Levels 2-4, 3-4, 8-4, D-4)', () => {
    for (const [dir, id] of [
      ['world8', '8-4-end'],
      ['lost/world2', 'll-2-4'],
      ['lost/world3', 'll-3-4'],
      ['lost/world8', 'll-8-4-end3'],
      ['lost/world13', 'll-13-4-end'],
    ] as const)
      expect(fireZones(load(dir, id))).toEqual([]);
  });
});
