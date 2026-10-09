import { describe, expect, it } from 'vitest';
import { fontText } from '@game/hud/text';
import { CARD_COLS } from '@game/scenes/free-hero';
import {
  ARENA_PAGE,
  BOWSER_SPELL_LAST,
  BOWSER_SPELL_PAGES,
  CAPTIVE_HUNT,
  CASTLE_COLS,
  CASTLE_PAGES,
  CRASH_PAGES,
  HUB_PAGE,
  LARRY_PAGES,
  LUIGI_RUNS_PAGE,
  noMoreStandIns,
  NOTE_COLS,
  NOTE_LINES,
  OPENING_BURST,
  OPENING_TOAD_PAGES,
  PARTNERS,
  PEACH_NOTE,
  riftPages,
  SIMON_CURSE,
  STORY_CRYSTAL_BALL_PAGES,
  STORY_NOT_OVER,
  STORY_TOAD_PAGES,
  WORLD1_PAGES,
  type Page,
} from './script';

/** The longest name a hero can have (Sophia III), for the `<HERO>` pages. */
const LONGEST = 'SOPHIA III';

/** A card page: speaker, blank line and four lines (or six lines of a partner's or the prompt box). */
const CARD_LINES = 6;
/** A castle page: under the thanks, at most four rows. */
const CASTLE_LINES = 4;

const cards: [string, Page][] = [
  ['opening burst', OPENING_BURST],
  ...OPENING_TOAD_PAGES.map((p, i): [string, Page] => [`opening toad ${i}`, p]),
  ...STORY_TOAD_PAGES.map((p, i): [string, Page] => [`toad ${i}`, p]),
  ...BOWSER_SPELL_PAGES.map((p, i): [string, Page] => [`bowser spell ${i}`, p]),
  ['bowser spell last', BOWSER_SPELL_LAST],
  ...WORLD1_PAGES.map((p, i): [string, Page] => [`world 1 ${i}`, p]),
  ['luigi runs', LUIGI_RUNS_PAGE],
  ['no more stand-ins', noMoreStandIns(LONGEST)],
  ...LARRY_PAGES.map((p, i): [string, Page] => [`larry ${i}`, p]),
  ...CRASH_PAGES.map((p, i): [string, Page] => [`crash ${i}`, p]),
  ...riftPages(LONGEST).map((p, i): [string, Page] => [`rift ${i}`, p]),
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

  it("Peach's note fits its parchment (2.1)", () => {
    expect(PEACH_NOTE.length).toBeLessThanOrEqual(NOTE_LINES);
    expect(tooWide(PEACH_NOTE, NOTE_COLS)).toEqual([]);
    expect(fontOnly(PEACH_NOTE)).toEqual([]);
    expect(PEACH_NOTE[0]).toBe('DEAR TOAD,');
  });

  it('every partner has a name and pages', () => {
    for (const s of Object.values(PARTNERS)) {
      expect(s.name).not.toBe('');
      expect(s.pages.length).toBeGreaterThan(0);
    }
  });
});

describe('heroes are named in full in what anyone says (0.4.35: Toad called Mega Man "MEGA")', () => {
  it('hudName (the HUD short name) is used only by the HUD and status bars', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) files.push(p);
      }
    };
    walk('src/game');
    // The HUD and the map's lives box (6 letters), and the hero definitions themselves.
    const allowed = /^src\/game\/(hud\/|characters\/|scenes\/world-map\.ts)/;
    const users = files.filter((f) => !allowed.test(f) && /\.hudName\b/.test(readFileSync(f, 'utf8')));
    expect(users).toEqual([]);
  });
});
