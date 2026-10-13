import { describe, expect, it } from 'vitest';
import { CAMPAIGN_MAP_PAGES, CAMPAIGN_PAGES, mapPage, MAP_PAGES, rulePages } from '@content/worldmap';
import { WORLD_4_ZEBES } from '@content/worldmap/world4-zebes';
import { WORLD_5_TRANSYLVANIA } from '@content/worldmap/world5-transylvania';
import { WORLD_6_GALESBURG } from '@content/worldmap/world6-galesburg';
import { WORLD_7_GALUGA } from '@content/worldmap/world7-galuga';
import { getLevel, levelIds } from '@content/levels';
import type { EntitySpawn, LevelData } from '../level/schema';
import { CAMPAIGN_LABELS, campaignLabel, campaignLevel, shownStage } from './campaign-order';
import { heroSide, hiddenHeroesIn } from './captives';
import { clearLevel, isOpen, isPathOpen, newMapProgress, nextStep, shownLevel } from './rules';
import type { MapProgress, WorldMapPage } from './types';

/*
 * The campaign's level order (level-order.md, owner Oct 13): one table (map/campaign-order.ts)
 * labels a world played in another order everywhere a level number shows; the campaign page's
 * roads follow it; classic play and the Lost Levels show the real ids.
 */

describe('the campaign label table', () => {
  it('plays World 4 as 4-2, 4-1, 4-3, 4-4, shown 4-1 to 4-4; other worlds as they are', () => {
    expect(campaignLabel('4-2')).toBe('4-1');
    expect(campaignLabel('4-1')).toBe('4-2');
    for (const id of ['4-3', '4-4', '1-1', '5-1', '8-1', '2-top-secret', 'll-4-2', 'll-6-2', 'll-7-3'])
      expect(campaignLabel(id)).toBe(id);
    expect(campaignLevel('4-1')).toBe('4-2');
    expect(campaignLevel('4-2')).toBe('4-1');
    expect(campaignLevel('4-3')).toBe('4-3');
    // Classic play keeps the real ids.
    expect(campaignLabel('4-2', false)).toBe('4-2');
  });

  it('plays World 6 as 6-2, 6-1, 6-3, 6-4 and World 7 as 7-3, 7-1, 7-2, 7-4, each shown 1 to 4 (0.4.53)', () => {
    expect(['6-2', '6-1', '6-3', '6-4'].map((id) => campaignLabel(id))).toEqual(['6-1', '6-2', '6-3', '6-4']);
    expect(['7-3', '7-1', '7-2', '7-4'].map((id) => campaignLabel(id))).toEqual(['7-1', '7-2', '7-3', '7-4']);
    expect(['6-1', '6-2', '6-3', '6-4'].map(campaignLevel)).toEqual(['6-2', '6-1', '6-3', '6-4']);
    expect(['7-1', '7-2', '7-3', '7-4'].map(campaignLevel)).toEqual(['7-3', '7-1', '7-2', '7-4']);
    for (const id of ['6-2', '7-3', '7-1']) expect(campaignLabel(id, false)).toBe(id);
  });

  it('only swaps stages within a world (each row a label of the same world, each label once)', () => {
    const labels = Object.values(CAMPAIGN_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
    for (const [id, shown] of Object.entries(CAMPAIGN_LABELS)) {
      expect(id).toMatch(/^[1-8]-[1-3]$/);
      expect(shown.split('-')[0]).toBe(id.split('-')[0]);
      // A label shown is a level the table also moves (a permutation of the world's stages).
      expect(Object.keys(CAMPAIGN_LABELS)).toContain(campaignLevel(id));
    }
  });

  it('gives the HUD, intro card and announcer the shown stage only in campaign order', () => {
    expect(shownStage(4, 2, true)).toBe(1);
    expect(shownStage(4, 1, true)).toBe(2);
    expect(shownStage(4, 3, true)).toBe(3);
    expect(shownStage(4, 2, false)).toBe(2);
    expect(shownStage(4, 2, undefined)).toBe(2);
    expect(shownStage(5, 1, true)).toBe(1);
    expect([1, 2, 3, 4].map((s) => shownStage(6, s, true))).toEqual([2, 1, 3, 4]);
    expect([1, 2, 3, 4].map((s) => shownStage(7, s, true))).toEqual([2, 3, 1, 4]);
    expect(shownStage(7, 3, false)).toBe(3);
  });

  it('labels every campaign page’s level nodes from the table, classic pages never', () => {
    for (const page of CAMPAIGN_PAGES)
      for (const n of page.nodes) {
        if (!n.level) continue;
        const want = campaignLabel(n.level);
        expect(n.shown, `${page.id} ${n.id}`).toBe(want === n.level ? undefined : want);
        expect(shownLevel(n)).toBe(want);
      }
    for (const page of MAP_PAGES)
      for (const n of page.nodes) expect(n.shown, `${page.id} ${n.id}`).toBeUndefined();
  });

  it('has a campaign page for every world it reorders, its roads in the shown order', () => {
    const worlds = new Set(Object.keys(CAMPAIGN_LABELS).map((id) => id.split('-')[0]));
    for (const w of worlds) {
      const page = CAMPAIGN_PAGES.find((p) => p.id === `smb-${w}`) as WorldMapPage;
      expect(page, `World ${w}`).toBeDefined();
      const chain = ['start', ...[1, 2, 3, 4].map((s) => campaignLevel(`${w}-${s}`))];
      for (let i = 0; i < 4; i++)
        expect(
          page.paths.some((p) => p.from === chain[i] && p.to === chain[i + 1]),
          `${chain[i]}>${chain[i + 1]}`,
        ).toBe(true);
    }
  });
});

describe('the rules on the campaign pages', () => {
  it('reads the campaign’s pages on a campaign file, the classic ones otherwise', () => {
    expect(rulePages(false)).toBe(MAP_PAGES);
    expect(rulePages(true)).toBe(CAMPAIGN_MAP_PAGES);
    expect(CAMPAIGN_MAP_PAGES.map((p) => p.id)).toEqual(MAP_PAGES.map((p) => p.id));
    expect(CAMPAIGN_MAP_PAGES).toContain(WORLD_4_ZEBES);
    expect(CAMPAIGN_MAP_PAGES).toContain(WORLD_5_TRANSYLVANIA);
    expect(CAMPAIGN_MAP_PAGES).toContain(WORLD_6_GALESBURG);
    expect(CAMPAIGN_MAP_PAGES).toContain(WORLD_7_GALUGA);
  });

  const w4 = (cleared: string[]): MapProgress => ({
    ...newMapProgress(),
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
      ...cleared,
    ],
    pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
  });
  const road = (from: string, to: string) =>
    WORLD_4_ZEBES.paths.find((p) => p.from === from && p.to === to) as WorldMapPage['paths'][number];

  it('opens Samus’s cavern (internal 4-2) first, and draws in the road on to internal 4-1 when it is cleared', () => {
    const p = w4([]);
    expect(isOpen(p, WORLD_4_ZEBES, '4-2')).toBe(true);
    expect(isOpen(p, WORLD_4_ZEBES, '4-1')).toBe(false);
    const opened = clearLevel(p, '4-2', () => ({ parent: null }) as unknown as LevelData, CAMPAIGN_MAP_PAGES);
    expect(opened).toEqual(['smb-4:4-2>4-1', 'smb-4:4-1']);
    expect(p.position).toEqual({ page: 'smb-4', node: '4-2' });
    // Internal 4-1 cleared opens 4-3, as the classic 4-2 did.
    expect(
      clearLevel(p, '4-1', () => ({ parent: null }) as unknown as LevelData, CAMPAIGN_MAP_PAGES),
    ).toEqual(['smb-4:4-1>4-3', 'smb-4:4-3']);
  });

  it('never strands an old file that cleared internal 4-1 before 4-2 (the old order): both stay reachable', () => {
    const p = w4(['4-1']);
    // Internal 4-1 shows, and the road back to Samus's cavern from it walks both ways.
    expect(isOpen(p, WORLD_4_ZEBES, '4-1')).toBe(true);
    expect(isOpen(p, WORLD_4_ZEBES, '4-2')).toBe(true);
    expect(isPathOpen(p, WORLD_4_ZEBES, road('4-2', '4-1'))).toBe(true);
    expect(isOpen(p, WORLD_4_ZEBES, '4-3')).toBe(true);
    const at = (from: string, d: 'left' | 'right' | 'up' | 'down') => {
      const s = nextStep(WORLD_4_ZEBES, p, from, d, CAMPAIGN_MAP_PAGES);
      return s?.kind === 'node' ? s.to : null;
    };
    expect(at('4-1', 'left')).toBe('4-2');
    expect(at('4-2', 'up')).toBe('start');
    expect(at('4-2', 'right')).toBe('4-1');
    // Nothing else changes for a file played in order: a level not reached stays hidden.
    expect(isOpen(w4([]), WORLD_4_ZEBES, '4-3')).toBe(false);
    expect(isOpen(w4(['4-2']), WORLD_4_ZEBES, '4-3')).toBe(false);
  });

  it('never opens a secret road or a bonus spot backwards', () => {
    const p = w4(['4-1']);
    expect(isOpen(p, WORLD_4_ZEBES, 'bonus-4')).toBe(false);
    expect(isPathOpen(p, WORLD_4_ZEBES, road('4-2', 'bonus-4'))).toBe(false);
  });
});

describe('Simon’s map hint follows his captive (World 5 from above)', () => {
  const lvl = (id: string, entities: EntitySpawn[] = [], parent: string | null = null): LevelData =>
    ({ id, parent, entities }) as unknown as LevelData;
  const simon: EntitySpawn = { type: 'captive', x: 3, y: 4, props: { hero: 'simon' } };

  it('a captive under a 5-1 sub-area (the crypt behind its gate) puts the hint at 5-1, west of it', () => {
    const out = hiddenHeroesIn(
      [lvl('5-1'), lvl('5-1-bonus', [], '5-1'), lvl('5-1-crypt', [simon], '5-1-bonus'), lvl('5-4')],
      CAMPAIGN_MAP_PAGES,
    );
    expect(out).toEqual([{ hero: 'simon', level: '5-1-crypt', main: '5-1', page: 'smb-5', node: '5-1' }]);
    const n = WORLD_5_TRANSYLVANIA.nodes.find((x) => x.id === '5-1');
    if (!n) throw new Error('no 5-1');
    expect(heroSide(WORLD_5_TRANSYLVANIA, n)).toBe(-1);
    // The spot west of 5-1 (1,9) is on no road.
    const roads = [...WORLD_5_TRANSYLVANIA.paths, ...WORLD_5_TRANSYLVANIA.exits].flatMap((p) => p.points);
    expect(roads.some(([x, y]) => x === n.x - 1 && y === n.y)).toBe(false);
    // The classic page names the same node (node ids never change).
    expect(hiddenHeroesIn([lvl('5-1'), lvl('5-1-crypt', [simon], '5-1')], MAP_PAGES)[0]?.node).toBe('5-1');
    expect(mapPage('smb-5')?.nodes.some((x) => x.id === '5-1')).toBe(true);
  });
});

describe('Worlds 6 and 7 in the campaign order (0.4.53)', () => {
  const ALL = ['1-0', '1-1', '1-2', '1-3', '1-4'];
  for (let w = 2; w <= 5; w++) ALL.push(...[1, 2, 3, 4].map((s) => `${w}-${s}`));
  const at = (w: 6 | 7, cleared: string[]): MapProgress => ({
    ...newMapProgress(),
    cleared: [...ALL, ...(w === 7 ? ['6-1', '6-2', '6-3', '6-4'] : []), ...cleared],
    pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4', 'smb-5', 'smb-6', ...(w === 7 ? ['smb-7'] : [])],
  });
  const clear = (p: MapProgress, id: string) =>
    clearLevel(p, id, () => ({ parent: null }) as unknown as LevelData, CAMPAIGN_MAP_PAGES);
  const roadOf = (page: WorldMapPage, from: string, to: string) =>
    page.paths.find((p) => p.from === from && p.to === to) as WorldMapPage['paths'][number];
  const step = (page: WorldMapPage, p: MapProgress, from: string, d: 'left' | 'right' | 'up' | 'down') => {
    const s = nextStep(page, p, from, d, CAMPAIGN_MAP_PAGES);
    return s?.kind === 'node' ? s.to : null;
  };

  it('World 6 opens Ryu’s level (internal 6-2) first and draws each road on in the new order', () => {
    const p = at(6, []);
    expect(isOpen(p, WORLD_6_GALESBURG, '6-2')).toBe(true);
    expect(isOpen(p, WORLD_6_GALESBURG, '6-1')).toBe(false);
    expect(clear(p, '6-2')).toEqual(['smb-6:6-2>6-1', 'smb-6:6-1']);
    expect(clear(p, '6-1')).toEqual(['smb-6:6-1>6-3', 'smb-6:6-3']);
    expect(clear(p, '6-3')).toEqual(['smb-6:6-3>6-4', 'smb-6:6-4']);
    // The gate is unchanged: World 7 waits for 6-4 and Ryu.
    expect(isOpen(p, WORLD_6_GALESBURG, 'bonus-6')).toBe(false);
  });

  it('World 7 opens Bill’s level (internal 7-3) first, then 7-1, 7-2 and 7-4', () => {
    const p = at(7, []);
    expect(isOpen(p, WORLD_7_GALUGA, '7-3')).toBe(true);
    for (const id of ['7-1', '7-2', '7-4']) expect(isOpen(p, WORLD_7_GALUGA, id), id).toBe(false);
    expect(clear(p, '7-3')).toEqual(['smb-7:7-3>7-1', 'smb-7:7-1']);
    expect(clear(p, '7-1')).toEqual(['smb-7:7-1>7-2', 'smb-7:7-2']);
    expect(clear(p, '7-2')).toEqual(['smb-7:7-2>7-4', 'smb-7:7-4']);
  });

  it('never strands an old World 6 file that cleared internal 6-1 first: both stay reachable', () => {
    const p = at(6, ['6-1']);
    expect(isOpen(p, WORLD_6_GALESBURG, '6-1')).toBe(true);
    expect(isPathOpen(p, WORLD_6_GALESBURG, roadOf(WORLD_6_GALESBURG, '6-2', '6-1'))).toBe(true);
    expect(isOpen(p, WORLD_6_GALESBURG, '6-3')).toBe(true);
    expect(step(WORLD_6_GALESBURG, p, '6-1', 'left')).toBe('6-2');
    expect(step(WORLD_6_GALESBURG, p, '6-2', 'left')).toBe('start');
    expect(step(WORLD_6_GALESBURG, p, '6-1', 'up')).toBe('6-3');
  });

  it('never strands an old World 7 file mid-world (7-1, or 7-1 and 7-2, cleared before 7-3)', () => {
    for (const cleared of [['7-1'], ['7-1', '7-2']]) {
      const p = at(7, cleared);
      for (const id of ['7-3', '7-1', '7-2'])
        expect(isOpen(p, WORLD_7_GALUGA, id), `${cleared} ${id}`).toBe(true);
      expect(isPathOpen(p, WORLD_7_GALUGA, roadOf(WORLD_7_GALUGA, '7-3', '7-1'))).toBe(true);
      expect(step(WORLD_7_GALUGA, p, '7-1', 'down')).toBe('7-3');
      expect(step(WORLD_7_GALUGA, p, '7-3', 'up')).toBe('start');
      expect(step(WORLD_7_GALUGA, p, '7-1', 'right')).toBe('7-2');
      expect(isOpen(p, WORLD_7_GALUGA, '7-4')).toBe(cleared.includes('7-2'));
      // Never a bonus spot backwards.
      expect(isOpen(p, WORLD_7_GALUGA, 'bonus-7')).toBe(false);
    }
  });
});

describe('Ryu’s and Bill’s map hints follow their captives to the first node of their worlds', () => {
  const levels = levelIds().map(getLevel);
  const hint = (hero: string) => hiddenHeroesIn(levels, CAMPAIGN_MAP_PAGES).find((h) => h.hero === hero);

  it('Ryu (in the dojo under internal 6-2) at 6-2, shown 6-1, east of it beside the dojo', () => {
    expect(hint('ryu')).toMatchObject({ main: '6-2', page: 'smb-6', node: '6-2' });
    const n = WORLD_6_GALESBURG.nodes.find((x) => x.id === '6-2');
    if (!n) throw new Error('no 6-2');
    expect(n.shown).toBe('6-1');
    expect(heroSide(WORLD_6_GALESBURG, n)).toBe(1);
    expect([n.x + 1, n.y]).toEqual([5, 10]);
  });

  it('Bill (in his camp under internal 7-3) at 7-3, shown 7-1, west of it over the camp', () => {
    expect(hint('bill')).toMatchObject({ main: '7-3', page: 'smb-7', node: '7-3' });
    const n = WORLD_7_GALUGA.nodes.find((x) => x.id === '7-3');
    if (!n) throw new Error('no 7-3');
    expect(n.shown).toBe('7-1');
    expect(heroSide(WORLD_7_GALUGA, n)).toBe(-1);
    expect([n.x - 1, n.y]).toEqual([2, 9]);
  });
});
