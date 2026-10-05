import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import type { LevelData } from '@game/level/schema';

// Which converted piranhas are red (enemyPiranhaRed / enemyPiranhaRedUpsideDown -> `red=1`) on
// normal difficulty. SMB1's red tokens are all hard-only, so every SMB1 plant is green. In The
// Lost Levels worlds 1-3 are green, from world 4 on they are red apart from a few in the shared
// pipe-exit rooms and one in 6-1, and every hanging plant is red.

const dir = (sub: string) => join(import.meta.dirname, sub);
const maps = (sub: string): LevelData[] =>
  readdirSync(dir(sub))
    .filter((f) => f.endsWith('.map'))
    .map((f) => parseTextMap(readFileSync(join(dir(sub), f), 'utf8'), f.slice(0, -4)));
const plants = (ls: LevelData[]) =>
  ls.flatMap((l) =>
    l.entities
      .filter((e) => e.type === 'piranha' || e.type === 'piranha-down')
      .map((e) => ({ id: l.id, type: e.type, x: e.x, y: e.y, red: e.props?.red === 1 })),
  );
const smb1 = plants([1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => maps(`world${w}`)));
const lost = plants(Array.from({ length: 13 }, (_, i) => maps(`lost/world${i + 1}`)).flat());
const ofLevel = (id: string) => lost.filter((p) => p.id === id);

describe('piranha plant colours in the converted levels', () => {
  it('SMB1: all 111 plants are green and upright', () => {
    expect(smb1).toHaveLength(111);
    expect(smb1.filter((p) => p.red)).toEqual([]);
    expect(smb1.filter((p) => p.type !== 'piranha')).toEqual([]);
  });

  it('red=1 is the only prop a plant carries, and only as 1', () => {
    for (const l of [1, 13, 4].flatMap((w) => maps(`lost/world${w}`)))
      for (const e of l.entities.filter((en) => en.type.startsWith('piranha')))
        expect(e.props === undefined || (Object.keys(e.props).join() === 'red' && e.props.red === 1)).toBe(
          true,
        );
  });

  it('Lost Levels: 175 red and 64 green upright plants, and all 64 hanging plants red', () => {
    const up = lost.filter((p) => p.type === 'piranha');
    const down = lost.filter((p) => p.type === 'piranha-down');
    expect(up.filter((p) => p.red)).toHaveLength(175);
    expect(up.filter((p) => !p.red)).toHaveLength(64);
    expect(down).toHaveLength(64);
    expect(down.every((p) => p.red)).toBe(true);
  });

  it('Lost Levels worlds 1-3 are all green', () => {
    const early = lost.filter((p) => /^ll-[123]-/.test(p.id));
    expect(early.length).toBe(59);
    expect(early.some((p) => p.red)).toBe(false);
    expect(ofLevel('ll-1-1').map((p) => [p.x, p.y])).toEqual([
      [32, 13],
      [39, 9],
      [45, 13],
      [123, 9],
      [128, 9],
      [142, 9],
      [147, 6],
      [163, 11],
    ]);
  });

  it('from world 4 the plants are red, except in a few exit rooms and one in 6-1', () => {
    const greenLater = lost.filter((p) => !p.red && !/^ll-[123]-/.test(p.id));
    expect(greenLater.map((p) => `${p.id} ${p.x},${p.y}`).sort()).toEqual([
      'll-10-2-exit 3,11',
      'll-11-2-exit 3,11',
      'll-5-2-exit 3,11',
      'll-6-1 156,12',
      'll-6-2-exit 3,11',
    ]);
    expect(ofLevel('ll-4-1')).toHaveLength(10);
    expect(ofLevel('ll-4-1').every((p) => p.red)).toBe(true);
    expect(ofLevel('ll-12-3').map((p) => [p.x, p.red])).toEqual([
      [117, true],
      [122, true],
      [127, true],
      [188, true],
    ]);
    expect(ofLevel('ll-9-1').map((p) => [p.type, p.x, p.y, p.red])).toEqual([
      ['piranha', 3, 11, true],
      ['piranha-down', 40, 8, true],
      ['piranha', 45, 8, true],
      ['piranha-down', 54, 9, true],
      ['piranha', 68, 9, true],
    ]);
  });
});
