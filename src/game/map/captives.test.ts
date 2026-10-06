import { describe, expect, it } from 'vitest';
import type { EntitySpawn, LevelData } from '../level/schema';
import type { MapProgress, WorldMapPage } from './types';
import {
  heroHint,
  hiddenHeroes,
  hiddenHeroesAt,
  hiddenHeroesIn,
  heroSide,
  type HiddenHero,
} from './captives';
import { newMapProgress } from './rules';
import { WORLD_1 } from '@content/worldmap/world1';
import { WORLD_2 } from '@content/worldmap/world2';

/** A made-up level: only the id, the parent and the entities matter to the index. */
const lvl = (id: string, entities: EntitySpawn[] = [], parent: string | null = null): LevelData =>
  ({ id, parent, entities }) as unknown as LevelData;
const captive = (hero: string): EntitySpawn => ({ type: 'captive', x: 3, y: 4, props: { hero } });
/** A made-up page with one level node per id. */
const page = (id: string, levels: string[]): WorldMapPage =>
  ({
    id,
    nodes: levels.map((level, i) => ({ id: level, kind: 'level', level, x: i * 2 + 2, y: 6 })),
    paths: [],
    exits: [],
  }) as unknown as WorldMapPage;

describe('hiddenHeroesIn (made-up levels)', () => {
  it('finds a captive in a sub-area and maps it to its main level and node', () => {
    const out = hiddenHeroesIn(
      [lvl('1-1'), lvl('1-1-bonus', [captive('luigi')], '1-1'), lvl('1-2')],
      [page('p-1', ['1-1', '1-2'])],
    );
    expect(out).toEqual([{ hero: 'luigi', level: '1-1-bonus', main: '1-1', page: 'p-1', node: '1-1' }]);
  });

  it('follows parent chains (an area of an area) and captives in the main level itself', () => {
    const out = hiddenHeroesIn(
      [
        lvl('2-1', [captive('samus')]),
        lvl('2-1-sky', [], '2-1'),
        lvl('2-1-sky2', [captive('link')], '2-1-sky'),
      ],
      [page('p-2', ['2-1'])],
    );
    expect(out.map((h) => [h.hero, h.main, h.node])).toEqual([
      ['samus', '2-1', '2-1'],
      ['link', '2-1', '2-1'],
    ]);
  });

  it('skips other entities, captives without a hero, and levels with no map node', () => {
    const out = hiddenHeroesIn(
      [
        lvl('1-1', [
          { type: 'goomba', x: 1, y: 1 },
          { type: 'captive', x: 1, y: 1 },
        ]),
        lvl('9-9', [captive('ryu')]),
      ],
      [page('p-1', ['1-1'])],
    );
    expect(out).toEqual([]);
  });
});

describe('hiddenHeroes (the bundled levels and map pages)', () => {
  it('Luigi is hidden in World 1, node 1-1 (the 1-1 bonus room)', () => {
    expect(hiddenHeroes()).toContainEqual({
      hero: 'luigi',
      level: '1-1-bonus',
      main: '1-1',
      page: 'smb-1',
      node: '1-1',
    });
    expect(hiddenHeroesAt('smb-1', '1-1').map((h) => h.hero)).toEqual(['luigi']);
  });

  it('Link is hidden in World 2, node 2-1 (the 2-1 sky ruins)', () => {
    expect(hiddenHeroes()).toContainEqual({
      hero: 'link',
      level: '2-1-sky2',
      main: '2-1',
      page: 'smb-2',
      node: '2-1',
    });
    expect(hiddenHeroesAt('smb-2', '2-1').map((h) => h.hero)).toEqual(['link']);
  });

  it('other nodes hide no one', () => {
    expect(hiddenHeroesAt('smb-1', '1-2')).toEqual([]);
    expect(hiddenHeroesAt('smb-1', 'start')).toEqual([]);
    expect(hiddenHeroesAt('smb-2', '2-2')).toEqual([]);
  });
});

describe('heroHint: the three stages', () => {
  const luigi: HiddenHero = { hero: 'luigi', level: '1-1-bonus', main: '1-1', page: 'smb-1', node: '1-1' };
  const progress = (cleared: string[]): MapProgress => ({ ...newMapProgress(), cleared });

  it('none before the level is cleared', () => {
    expect(heroHint(luigi, progress([]), ['mario'])).toBe('none');
    expect(heroHint(luigi, progress(['1-0']), ['mario'])).toBe('none');
  });

  it('a silhouette once cleared while the hero is not freed', () => {
    expect(heroHint(luigi, progress(['1-0', '1-1']), ['mario'])).toBe('silhouette');
  });

  it('a trophy once freed', () => {
    expect(heroHint(luigi, progress(['1-0', '1-1']), ['mario', 'luigi'])).toBe('trophy');
    // Freed without the clear (left the level after freeing him): still his trophy.
    expect(heroHint(luigi, progress(['1-0']), ['mario', 'luigi'])).toBe('trophy');
  });
});

describe('heroSide: beside the node, clear of its roads', () => {
  it('World 1 1-1: right (its roads leave left and up)', () => {
    expect(
      heroSide(
        WORLD_1,
        WORLD_1.nodes.find((n) => n.id === '1-1')!,
      ),
    ).toBe(1);
  });

  it('World 2 2-1: left (its roads leave right, up and down)', () => {
    expect(
      heroSide(
        WORLD_2,
        WORLD_2.nodes.find((n) => n.id === '2-1')!,
      ),
    ).toBe(-1);
  });

  it('a node may pick its side (heroSpot)', () => {
    const n = { ...WORLD_1.nodes.find((n) => n.id === '1-1')!, heroSpot: 'left' as const };
    expect(heroSide(WORLD_1, n)).toBe(-1);
  });
});
