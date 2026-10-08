import { describe, expect, it } from 'vitest';
import { fontText } from '@game/hud/text';
import { CARD_COLS } from '@game/scenes/free-hero';
import {
  ALL_FREED_AFTER,
  ALL_FREED_BEFORE,
  ARENA_PAGE,
  CAPTIVE_HUNT,
  CASTLE_COLS,
  CASTLE_PAGES,
  CRASH_PAGES,
  HINT_COLS,
  HUB_PAGE,
  JOINED_CRACK,
  JOINED_GENERIC,
  JOINED_PAGES,
  LARRY_PAGES,
  MISSED_HINT,
  MISSED_PAGES,
  noMoreStandIns,
  PARTNERS,
  RESTYLE_PAGES,
  riftPages,
  SIMON_CURSE,
  STORY_CRYSTAL_BALL_PAGES,
  STORY_NOT_OVER,
  STORY_TEASE_PAGES,
  STORY_TOAD_PAGES,
  WORLD_ENTRY,
  type Page,
} from './script';

/** The longest name a hero can have (Sophia III), for the `<HERO>` pages. */
const LONGEST = 'SOPHIA III';

/** A card page: speaker, blank line and four lines (or six lines of a partner's or the prompt box). */
const CARD_LINES = 6;
/** A castle page: under the thanks, at most four rows. */
const CASTLE_LINES = 4;

const cards: [string, Page][] = [
  ...STORY_TOAD_PAGES.map((p, i): [string, Page] => [`toad ${i}`, p]),
  ...STORY_TEASE_PAGES.map((p, i): [string, Page] => [`tease ${i}`, p]),
  ['no more stand-ins', noMoreStandIns(LONGEST)],
  ...Object.entries(RESTYLE_PAGES).map(([k, p]): [string, Page] => [`restyle ${k}`, p]),
  ...Object.entries(WORLD_ENTRY).flatMap(([k, ps]) =>
    ps.map((p, i): [string, Page] => [`entry ${k} ${i}`, p]),
  ),
  ...Object.entries(MISSED_PAGES).map(([k, p]): [string, Page] => [`missed ${k}`, p]),
  ...LARRY_PAGES.map((p, i): [string, Page] => [`larry ${i}`, p]),
  ...CRASH_PAGES.map((p, i): [string, Page] => [`crash ${i}`, p]),
  ...riftPages(LONGEST).map((p, i): [string, Page] => [`rift ${i}`, p]),
  ['joined crack', JOINED_CRACK],
  ['joined generic', JOINED_GENERIC],
  ...Object.entries(JOINED_PAGES).map(([k, p]): [string, Page] => [`joined ${k}`, p]),
  ['all freed before', ALL_FREED_BEFORE],
  ['all freed after', ALL_FREED_AFTER],
  ['hub', HUB_PAGE],
  ['arena', ARENA_PAGE],
  ['not over', STORY_NOT_OVER],
  ['captive hunt', ['SOPHIA III:', '', '...SOPHIA III SERVES', 'KING KOOPA...', ...CAPTIVE_HUNT]],
  ['simon curse', SIMON_CURSE],
  ...Object.entries(PARTNERS).flatMap(([k, s]) => s.pages.map((p, i): [string, Page] => [`${k} ${i}`, p])),
];

const castles: [string, Page][] = [
  ...STORY_CRYSTAL_BALL_PAGES.map((p, i): [string, Page] => [`crystal ball ${i}`, p]),
  ...Object.entries(CASTLE_PAGES).flatMap(([k, c]): [string, Page][] => [
    [`${k} reveal`, c.reveal],
    [`${k} news`, c.news],
  ]),
];

const fontOnly = (lines: readonly string[]) => lines.filter((l) => fontText(l) !== l);
const tooWide = (lines: readonly string[], cols: number) => lines.filter((l) => l.length > cols);

describe('the story script', () => {
  it.each(cards)('card page "%s" fits its box', (_name, page) => {
    expect(page.length).toBeGreaterThan(0);
    expect(page.length).toBeLessThanOrEqual(CARD_LINES);
    expect(tooWide(page, CARD_COLS)).toEqual([]);
    expect(fontOnly(page)).toEqual([]);
  });

  it.each(castles)('castle page "%s" fits its box', (_name, page) => {
    expect(page.length).toBeGreaterThan(0);
    expect(page.length).toBeLessThanOrEqual(CASTLE_LINES);
    expect(tooWide(page, CASTLE_COLS)).toEqual([]);
    expect(fontOnly(page)).toEqual([]);
  });

  it.each(Object.entries(MISSED_HINT))('hint line for %s fits the strip', (_hero, line) => {
    expect(line.length).toBeLessThanOrEqual(HINT_COLS);
    expect(fontText(line)).toBe(line);
  });

  it('every partner has a name and pages', () => {
    for (const s of Object.values(PARTNERS)) {
      expect(s.name).not.toBe('');
      expect(s.pages.length).toBeGreaterThan(0);
    }
  });

  it('has a missed card and a hint line for the same heroes', () => {
    expect(Object.keys(MISSED_HINT).sort()).toEqual(Object.keys(MISSED_PAGES).sort());
  });
});
