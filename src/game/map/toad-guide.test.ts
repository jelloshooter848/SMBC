import { describe, expect, it } from 'vitest';
import { fontText } from '../hud/text';
import { beat } from '../story/beats';
import {
  ALL_FREED_AFTER,
  ALL_FREED_BEFORE,
  ARENA_PAGE,
  CRASH_PAGES,
  HINT_COLS,
  HUB_PAGE,
  JOINED_CRACK,
  JOINED_GENERIC,
  JOINED_PAGES,
  MISSED_HINT,
  MISSED_PAGES,
  riftPages,
  WORLD_ENTRY,
} from '../story/script';
import { CRYSTAL_BALL } from './captives';
import { dueScenes, missedHint, missedSaid, type GuideInput } from './toad-guide';
import type { MapProgress } from './types';

// Toad's map scenes (docs/STORY.md 2.3, 2.14): which are due, in which order, once per file.

const HEROES = ['mario', 'luigi', 'link', 'megaman', 'samus', 'simon', 'ryu', 'bill'];
const HIDDEN = HEROES.filter((h) => h !== 'mario');

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
    hidden: HIDDEN,
    shadows: [],
    hero: 'MARIO',
    ...over,
  };
}

const ids = (g: GuideInput) => dueScenes(g).flatMap((s) => s.ids);

describe('dueScenes', () => {
  it('World 1: nothing before 1-0 is cleared; its entry (a major scene) after', () => {
    expect(dueScenes(input({ prog: { cleared: [] } }))).toEqual([]);
    expect(dueScenes(input())).toEqual([
      { ids: [beat.enter('smb-1')], pages: [...(WORLD_ENTRY['smb-1'] ?? [])], walk: true },
    ]);
    expect(dueScenes(input({ story: [beat.enter('smb-1')] }))).toEqual([]);
  });

  it('other worlds: the entry on first arrival, Toad does not walk in', () => {
    const s = dueScenes(input({ page: 'smb-3', story: [beat.enter('smb-1')] }));
    expect(s).toEqual([
      { ids: [beat.enter('smb-3')], pages: [...(WORLD_ENTRY['smb-3'] ?? [])], walk: false },
    ]);
  });

  it('the fake Bowsers: no map card after 1-4 any more (castle 1-4 says it, 0.4.23)', () => {
    expect(dueScenes(input({ prog: { cleared: ['1-0', '1-4'] }, story: [beat.enter('smb-1')] }))).toEqual([]);
  });

  it('heroes joined: the generic card first (once), then each own card; crack page gone after 8-4', () => {
    const seen = [beat.enter('smb-1')];
    const s = dueScenes(input({ freed: ['mario', 'luigi', 'link'], story: seen }));
    expect(s.map((x) => x.ids)).toEqual([[beat.joined()], [beat.joined('luigi')], [beat.joined('link')]]);
    expect(s[0]?.pages).toEqual([JOINED_CRACK, JOINED_GENERIC]);
    expect(s[1]?.pages).toEqual([JOINED_PAGES.luigi]);
    const after = dueScenes(input({ freed: ['mario', 'luigi'], story: seen, prog: { gameCleared: true } }));
    expect(after[0]?.pages).toEqual([JOINED_GENERIC]);
    // The generic one already seen: only the hero's own.
    const later = dueScenes(
      input({ freed: ['mario', 'luigi', 'ryu'], story: [...seen, 'joined', 'joined:luigi'] }),
    );
    expect(later).toEqual([{ ids: ['joined:ryu'], pages: [JOINED_PAGES.ryu], walk: false }]);
  });

  it('a hero without a card of its own gets the generic one', () => {
    const s = dueScenes(input({ freed: ['mario', 'zelda'], story: [beat.enter('smb-1'), 'joined'] }));
    expect(s).toEqual([{ ids: ['joined:zelda'], pages: [JOINED_CRACK, JOINED_GENERIC], walk: false }]);
  });

  it('every hero freed: before and after 8-4', () => {
    const story = [beat.enter('smb-1'), 'joined', ...HIDDEN.map((h) => beat.joined(h))];
    const before = dueScenes(input({ freed: HEROES, story }));
    expect(before).toEqual([{ ids: [beat.allFreed], pages: [ALL_FREED_BEFORE], walk: false }]);
    const after = dueScenes(input({ freed: HEROES, story, prog: { gameCleared: true } }));
    expect(after).toEqual([{ ids: [beat.allFreed], pages: [ALL_FREED_AFTER], walk: false }]);
  });

  it('missed heroes: their card, only marked once the file has the crystal ball', () => {
    const story = [beat.enter('smb-1')];
    expect(dueScenes(input({ shadows: ['luigi'], story }))).toEqual([
      { ids: ['missed:luigi'], pages: [MISSED_PAGES.luigi], walk: false },
    ]);
    const ball = dueScenes(input({ shadows: ['luigi'], story, prog: { secrets: [CRYSTAL_BALL] } }));
    expect(ball).toEqual([{ ids: ['missed:luigi'], pages: [], walk: false }]);
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

  it('the play order: major scene, joined, all freed, world entry, missed, then nothing on Lost pages', () => {
    const g = input({
      page: 'smb-1',
      prog: { cleared: ['1-0', '1-1', '1-4'] },
      freed: HEROES,
      shadows: ['luigi'],
    });
    expect(ids(g)).toEqual([
      beat.joined(),
      ...HIDDEN.map((h) => beat.joined(h)),
      beat.allFreed,
      beat.enter('smb-1'),
      'missed:luigi',
    ]);
    expect(dueScenes({ ...g, page: 'll-1' })).toEqual([]);
  });

  describe('World 8: pages 2-3 (Sophia) only once she is in the game', () => {
    const entry = WORLD_ENTRY['smb-8'] ?? [];
    const w8 = (over: Partial<GuideInput> & { story?: string[] } = {}) =>
      dueScenes(input({ page: 'smb-8', ...over }));
    it('without her: pages 1 and 4 (Bowser, the turnip)', () => {
      expect(entry).toHaveLength(4);
      expect(w8()).toEqual([{ ids: ['enter:smb-8'], pages: [entry[0], entry[3]], walk: false }]);
    });
    it('with her: pages 1-4 in order, both beats', () => {
      expect(w8({ heroes: [...HEROES, 'sophia'] })).toEqual([
        { ids: ['enter:smb-8', 'enter:smb-8:sophia'], pages: [...entry], walk: false },
      ]);
    });
    it('a file that saw the entry before she landed: pages 2-3 once', () => {
      const s = w8({ heroes: [...HEROES, 'sophia'], story: ['enter:smb-8'] });
      expect(s).toEqual([{ ids: ['enter:smb-8:sophia'], pages: [entry[1], entry[2]], walk: false }]);
      expect(w8({ heroes: [...HEROES, 'sophia'], story: ['enter:smb-8', 'enter:smb-8:sophia'] })).toEqual([]);
    });
  });
});

describe("Toad's hint lines", () => {
  it('per hero, spoken in plain words, fitting the line', () => {
    for (const [id, line] of Object.entries(MISSED_HINT)) {
      expect(missedHint(id)).toBe(line);
      expect(line.length).toBeLessThanOrEqual(HINT_COLS);
      expect(fontText(line)).toBe(line);
      expect(missedSaid(id)).toMatch(/^Toad: [A-Z][ a-z]/);
    }
    expect(missedSaid('luigi')).toBe('Toad: I hear a mustache sigh...');
    expect(missedSaid('simon')).toBe('Toad: This lift smells of bats.');
    expect(missedHint('zelda')).toBeNull();
    expect(missedSaid('zelda')).toBeNull();
  });
});
