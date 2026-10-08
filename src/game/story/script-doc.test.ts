import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import type { MiniGameDef } from '@game/minigames';
import { captiveDialogue } from '@game/scenes/free-hero';
import {
  ALL_FREED_AFTER,
  ALL_FREED_BEFORE,
  ARENA_PAGE,
  CASTLE_PAGES,
  castleRemark,
  gateScript,
  REMARK_CASTLES,
  RIFT_SEALED_PAGES,
  sealedHint,
  WELCOMES,
  welcomeHint,
  CRASH_PAGES,
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
  STORY_CRYSTAL_BALL_PAGES,
  STORY_NOT_OVER,
  STORY_TEASE_PAGES,
  STORY_TOAD_PAGES,
  WORLD_ENTRY,
  type Page,
} from './script';

// docs/STORY.md is the script the owner reviews; script.ts is what the game shows. For the shipped
// sections (Chapter 1: 2.1 to 2.14, everything before 2.15) every ```text block of the doc must be
// one of script.ts's pages, word for word, and every page of script.ts must be in the doc, so the
// two never drift apart. `<HERO>` stays a placeholder: script.ts's functions are called with it.

const HERO = '<HERO>';

/**
 * Blocks of the shipped sections that are not in this build yet, matched by their first line.
 * None since 0.4.18: World 8's Sophia III (2.11, her partner Jason and her own lines) is built.
 */
const NOT_BUILT: readonly string[] = [];

/** The ```text blocks of docs/STORY.md from section `from` up to (not including) section `to`. */
function docBlocks(from: string, to: string): { section: string; lines: string[]; old: boolean }[] {
  const md = readFileSync(resolve(__dirname, '../../../docs/STORY.md'), 'utf8');
  const start = md.indexOf(`\n### ${from} `);
  const end = md.indexOf(`\n### ${to} `);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const out: { section: string; lines: string[]; old: boolean }[] = [];
  let section = from;
  let said = '';
  const lines = md.slice(start, end).split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] as string;
    const head = /^### (\S+) /.exec(l);
    if (head) section = head[1] as string;
    if (l !== '```text') {
      if (l.trim() !== '') said = l.trim();
      continue;
    }
    const block: string[] = [];
    for (i++; i < lines.length && lines[i] !== '```'; i++) block.push(lines[i] as string);
    // A block after "Old:" is the text the story replaced, for reference.
    out.push({ section, lines: block, old: said === 'Old:' });
    said = '';
  }
  return out;
}

/** The doc's `Hint line: \`...\`` lines in the shipped sections. */
function docHints(): string[] {
  const md = readFileSync(resolve(__dirname, '../../../docs/STORY.md'), 'utf8');
  const shipped = md.slice(md.indexOf('\n### 2.1 '), md.indexOf('\n### 2.15 '));
  return [...shipped.matchAll(/Hint line: `([^`]+)`/g)].map((m) => m[1] as string);
}

const hero = (id: string) => CHARACTERS.find((c) => c.id === id) as CharacterDef;

/** The captive's cards (free-hero.ts) for hero `id`, with player 1's name back to `<HERO>`. */
function captiveCards(id: string): string[][] {
  const you: CharacterDef = { ...hero('mario'), name: 'MARIO' };
  return captiveDialogue(hero(id), { title: 'GAME' } as MiniGameDef, you).map((page) =>
    page.map((l) => l.replace('MARIO', HERO)),
  );
}

/** Each script.ts page by the name of the constant it comes from, in the doc's own form. */
function scriptPages(): Map<string, Page> {
  const out = new Map<string, Page>();
  const add = (name: string, page: Page) => out.set(name, page);
  const list = (name: string, pages: readonly Page[]) => pages.forEach((p, i) => add(`${name}[${i}]`, p));
  list('STORY_TOAD_PAGES', STORY_TOAD_PAGES);
  list('STORY_TEASE_PAGES', STORY_TEASE_PAGES);
  add('noMoreStandIns', noMoreStandIns(HERO));
  for (const [id, page] of Object.entries(RESTYLE_PAGES)) add(`RESTYLE_PAGES.${id}`, page);
  for (const [id, pages] of Object.entries(WORLD_ENTRY)) list(`WORLD_ENTRY.${id}`, pages);
  for (const [id, page] of Object.entries(MISSED_PAGES)) add(`MISSED_PAGES.${id}`, page);
  list('LARRY_PAGES', LARRY_PAGES);
  list('STORY_CRYSTAL_BALL_PAGES', STORY_CRYSTAL_BALL_PAGES);
  list('CRASH_PAGES', CRASH_PAGES);
  // The castle's page 1 shows under the thanks, as the doc writes it.
  for (const [id, c] of Object.entries(CASTLE_PAGES)) {
    add(`CASTLE_PAGES.${id}.reveal`, [`THANK YOU ${HERO}!`, '', ...c.reveal]);
    add(`CASTLE_PAGES.${id}.news`, c.news);
  }
  // The credits' block, without the blank line that parts it from THANKS FOR PLAYING.
  add('STORY_NOT_OVER', STORY_NOT_OVER.slice(1));
  list('riftPages', riftPages(HERO));
  // Every hero's first card (CAPTIVE_HUNT), shown with Luigi's name; Simon's curse (SIMON_CURSE)
  // with what follows it in his card, without the speaker.
  add('CAPTIVE_HUNT', captiveCards('luigi')[0] as Page);
  add('SIMON_CURSE', (captiveCards('simon')[1] as Page).slice(2));
  // Sophia III's challenge (2.11), her own card in full.
  add('DIALOGUE.sophia', captiveCards('sophia')[1] as Page);
  add('JOINED_CRACK', JOINED_CRACK);
  add('JOINED_GENERIC', JOINED_GENERIC);
  for (const [id, page] of Object.entries(JOINED_PAGES)) add(`JOINED_PAGES.${id}`, page);
  add('ALL_FREED_BEFORE', ALL_FREED_BEFORE);
  add('ALL_FREED_AFTER', ALL_FREED_AFTER);
  add('HUB_PAGE', HUB_PAGE);
  add('ARENA_PAGE', ARENA_PAGE);
  for (const [who, p] of Object.entries(PARTNERS)) list(`PARTNERS.${who}`, p.pages);
  // S3 (0.4.23): the castle remarks, the world gates, the rift's reminder and the welcomes.
  for (const id of REMARK_CASTLES) add(`castleRemark.${id}`, castleRemark(id, HERO) as Page);
  for (let w = 1; w <= 7; w++) {
    const g = gateScript(w, HERO);
    if (!g) continue;
    list(`gateScript.${w}.reminder`, g.reminder);
    list(`gateScript.${w}.bowser`, g.bowser);
    list(`gateScript.${w}.toad`, g.toad);
  }
  list('RIFT_SEALED_PAGES', RIFT_SEALED_PAGES);
  for (const [page, w] of Object.entries(WELCOMES)) list(`WELCOMES.${page}`, w.pages);
  return out;
}

const key = (page: readonly string[]) => page.join('\n');

describe('docs/STORY.md and script.ts agree (Chapter 1: 2.1 to 2.14)', () => {
  const blocks = docBlocks('2.1', '2.15');
  const pages = scriptPages();
  const byText = new Map([...pages].map(([name, page]) => [key(page), name]));

  it('every text block of the doc is a page of script.ts', () => {
    const now = blocks.filter((b) => !b.old && !NOT_BUILT.includes(b.lines[0] as string));
    const missing = now.filter((b) => !byText.has(key(b.lines))).map((b) => `${b.section}:\n${key(b.lines)}`);
    expect(missing).toEqual([]);
    expect(now.length).toBeGreaterThan(90);
  });

  it('the old text the doc quotes is gone from script.ts; every block is built (Sophia III since 0.4.18)', () => {
    const old = blocks.filter((b) => b.old);
    expect(old.length).toBeGreaterThan(0);
    for (const b of old) expect(byText.has(key(b.lines)), key(b.lines)).toBe(false);
    expect(NOT_BUILT).toEqual([]);
    // Jason's three pages and Sophia III's challenge are among the pages the doc and script share.
    const firsts = blocks.filter((b) => !b.old).map((b) => b.lines[0]);
    expect(firsts.filter((l) => l === 'JASON:')).toHaveLength(3);
    expect(firsts.filter((l) => l === 'SOPHIA III:')).toHaveLength(1);
  });

  it('every page of script.ts is in the doc', () => {
    const inDoc = new Set(blocks.map((b) => key(b.lines)));
    const missing = [...pages].filter(([, page]) => !inDoc.has(key(page))).map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it("the gates' and welcomes' hint lines (`hint line ...`) are script.ts's, and back (S3)", () => {
    const md = readFileSync(resolve(__dirname, '../../../docs/STORY.md'), 'utf8');
    const shipped = md.slice(md.indexOf('\n### 2.1 '), md.indexOf('\n### 2.15 '));
    const doc = [...shipped.matchAll(/[Hh]int line(?: on [^:`]+:)?\s+`((?:SEALED|TALK)[^`]+)`/g)].map(
      (m) => m[1] as string,
    );
    const names = ['LUIGI', 'LINK', 'MEGA MAN', 'SAMUS', 'SIMON', 'RYU', 'BILL', 'SOPHIA III'];
    const ours = [...names.map(sealedHint), ...Object.values(WELCOMES).map((w) => welcomeHint(w.local))];
    expect([...new Set(doc)].sort()).toEqual(ours.sort());
  });

  it("every hint line of the doc is one of script.ts's, and back", () => {
    expect(docHints().sort()).toEqual(Object.values(MISSED_HINT).sort());
  });
});
