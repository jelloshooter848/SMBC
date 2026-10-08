import { describe, expect, it } from 'vitest';
import { beat } from '../story/beats';
import { ARENA_PAGE, CRASH_PAGES, HUB_PAGE, riftPages, WORLD1_PAGES } from '../story/script';
import * as script from '../story/script';
import { dueScenes, type GuideInput } from './toad-guide';
import type { MapProgress } from './types';

// Toad's map scenes (docs/STORY.md 2.3, 2.14): which are due, in which order, once per file.

const HEROES = ['mario', 'luigi', 'link', 'megaman', 'samus', 'simon', 'ryu', 'bill'];

function input(
  over: Partial<GuideInput> & { story?: string[]; prog?: Partial<MapProgress> } = {},
): GuideInput {
  const story = over.story ?? [];
  const progress: MapProgress = {
    cleared: ['1-0'],
    pages: ['smb-1'],
    secrets: [],
    position: { page: 'smb-1', node: 'start' },
    gameCleared: false,
    ...over.prog,
  };
  return {
    page: 'smb-1',
    seen: (id) => story.includes(id),
    progress,
    freed: ['mario'],
    heroes: HEROES,
    hero: 'MARIO',
    ...over,
  };
}

const ids = (g: GuideInput) => dueScenes(g).flatMap((s) => s.ids);

describe('dueScenes', () => {
  it("World 1: nothing before 1-0 is cleared; Toad's World 1 scene (a major scene) after", () => {
    expect(dueScenes(input({ prog: { cleared: [] } }))).toEqual([]);
    expect(dueScenes(input())).toEqual([
      { ids: [beat.enter('smb-1')], pages: [...WORLD1_PAGES], walk: true },
    ]);
    expect(WORLD1_PAGES[2]?.[2]).toBe("WHERE'S LUIGI? WE NEED TO");
    expect(dueScenes(input({ story: [beat.enter('smb-1')] }))).toEqual([]);
  });

  it('other worlds: Toad has no world entry any more (2.14)', () => {
    for (const page of ['smb-2', 'smb-3', 'smb-4', 'smb-8'])
      expect(dueScenes(input({ page, story: [beat.enter('smb-1')] }))).toEqual([]);
  });

  it('the old Toad cards are gone: no joined, all-freed or missed cards (2.14)', () => {
    const s = dueScenes(input({ freed: HEROES, story: [beat.enter('smb-1')] }));
    expect(s).toEqual([]);
    for (const name of [
      'STORY_TEASE_PAGES',
      'RESTYLE_PAGES',
      'WORLD_ENTRY',
      'ENTRY_NEEDS',
      'MISSED_PAGES',
      'MISSED_HINT',
      'JOINED_CRACK',
      'JOINED_GENERIC',
      'JOINED_PAGES',
      'ALL_FREED_BEFORE',
      'ALL_FREED_AFTER',
      'FAKES_PAGES',
    ])
      expect(name in script, name).toBe(false);
  });

  it('the fake Bowsers: no map card after 1-4 any more (castle 1-4 says it, 0.4.23)', () => {
    expect(dueScenes(input({ prog: { cleared: ['1-0', '1-4'] }, story: [beat.enter('smb-1')] }))).toEqual([]);
  });

  it('the crash, the rift, the extras', () => {
    const crash = dueScenes(input({ page: 'smb-4', crash: true, story: ['enter:smb-4'] }));
    expect(crash).toEqual([{ ids: [beat.crash], pages: [...CRASH_PAGES], walk: true }]);
    const rift = (freed: string[]) =>
      dueScenes(
        input({
          page: 'smb-8',
          hero: 'MEGA MAN',
          freed,
          story: ['enter:smb-8'],
          prog: { gameCleared: true },
        }),
      );
    // The rift waits for Sophia III (0.4.23).
    expect(rift(['mario', 'sophia'])[0]).toEqual({
      ids: [beat.rift],
      pages: riftPages('MEGA MAN'),
      walk: true,
    });
    expect(rift(['mario']).map((s) => s.ids)).not.toContainEqual([beat.rift]);
    expect(dueScenes(input({ page: 'hub' }))).toEqual([{ ids: [beat.hub], pages: [HUB_PAGE], walk: false }]);
    expect(dueScenes(input({ page: 'arena' }))).toEqual([
      { ids: [beat.arena], pages: [ARENA_PAGE], walk: false },
    ]);
  });

  it('the play order: the major scenes, then the extras; nothing on Lost pages', () => {
    const g = input({ page: 'smb-1', prog: { cleared: ['1-0', '1-1', '1-4'] }, freed: HEROES });
    expect(ids(g)).toEqual([beat.enter('smb-1')]);
    expect(dueScenes({ ...g, page: 'll-1' })).toEqual([]);
  });
});
