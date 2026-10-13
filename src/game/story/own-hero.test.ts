import { describe, expect, it } from 'vitest';
import { SMB_PAGES } from '@content/worldmap';
import { fontText } from '@game/hud/text';
import { CARD_COLS } from '@game/scenes/free-hero';
import { welcomePages } from '@game/map/world-gate';
import { PARTNERS, partnerPages, partnerSet, WELCOMES, type Page } from './script';

// 0.4.47 (roadmap #29): every level NPC and every world's welcome local has a third line set,
// said when the hero talking to them IS that world's own hero (a Hyrule villager seeing Link, a
// Mega City robot seeing Mega Man). Order: own hero playing > hero still missing > hero freed.
// #28: the fairy's hints are riddles now; talked to again she gives one clearer fallback.

/** Who speak for no one (the pipe keeper). (Fred, gone before his hero could play, until 0.4.54.) */
const NO_OWN = ['pipe-keeper'];

const text = (pages: readonly Page[]) => pages.flat().join(' ');

/** The world (2-8) each welcome's page belongs to, and its hero (the page's gate). */
const welcomeHero = (page: string): string => {
  const p = SMB_PAGES.find((m) => m.id === page);
  const hero = p?.exits.find((e) => e.gate)?.gate;
  expect(hero, page).toBeDefined();
  return hero as string;
};

const ownCards: [string, Page][] = [
  ...Object.entries(PARTNERS).flatMap(([k, s]) =>
    (s.own ?? []).map((p, i): [string, Page] => [`${k} own ${i}`, p]),
  ),
  ...Object.entries(WELCOMES).flatMap(([k, w]) =>
    (w.own ?? []).map((p, i): [string, Page] => [`${k} own ${i}`, p]),
  ),
  ...(PARTNERS.fairy?.again ?? []).map((p, i): [string, Page] => [`fairy again ${i}`, p]),
];

describe("a world's own hero (#29)", () => {
  it('every NPC with a hero has all three sets: missing, freed and own (one or two cards)', () => {
    for (const [who, s] of Object.entries(PARTNERS)) {
      if (NO_OWN.includes(who)) {
        expect(s.own, who).toBeUndefined();
        continue;
      }
      expect(s.hero, who).toBeDefined();
      expect(s.pages.length, who).toBeGreaterThan(0);
      expect(s.after?.length ?? 0, who).toBeGreaterThan(0);
      expect(s.own?.length ?? 0, who).toBeGreaterThanOrEqual(1);
      expect(s.own?.length ?? 0, who).toBeLessThanOrEqual(2);
    }
  });

  it('every welcome local has all three sets too', () => {
    for (const [page, w] of Object.entries(WELCOMES)) {
      expect(w.pages.length, page).toBeGreaterThan(0);
      expect(w.after?.length ?? 0, page).toBeGreaterThan(0);
      expect(w.own?.length ?? 0, page).toBeGreaterThanOrEqual(1);
      expect(w.own?.length ?? 0, page).toBeLessThanOrEqual(2);
      for (const p of w.own ?? []) expect(p[0], page).toBe(`${w.local}:`);
    }
  });

  it('the three sets resolve: own hero playing > hero still missing > hero freed', () => {
    for (const [who, s] of Object.entries(PARTNERS)) {
      if (!s.hero || NO_OWN.includes(who)) continue;
      const other = s.hero === 'mario' ? 'luigi' : 'mario';
      // Another hero: the plea while missing, the after pages once freed.
      expect(partnerSet(s, ['mario'], other), who).toBe('missing');
      expect(partnerPages(s, ['mario'], { playing: other }), who).toBe(s.pages);
      expect(partnerSet(s, ['mario', s.hero], other), who).toBe('freed');
      expect(partnerPages(s, ['mario', s.hero], { playing: other }), who).toBe(s.after);
      // Its own hero: the own lines, freed or (dev "All heroes" only) not.
      expect(partnerSet(s, ['mario', s.hero], s.hero), who).toBe('own');
      expect(partnerPages(s, ['mario', s.hero], { playing: s.hero }), who).toBe(s.own);
      expect(partnerSet(s, ['mario'], s.hero), who).toBe('own');
      expect(partnerPages(s, ['mario'], { playing: s.hero }), who).toBe(s.own);
      // No hero named (old callers): as before.
      expect(partnerPages(s, ['mario']), who).toBe(s.pages);
    }
    // The pipe keeper has one set whoever talks.
    const keeper = PARTNERS['pipe-keeper']!;
    expect(partnerPages(keeper, ['mario', 'luigi'], { playing: 'luigi' })).toBe(keeper.pages);
  });

  it("a local's three sets: own (any player's hero) > missing > freed", () => {
    for (const [page, w] of Object.entries(WELCOMES)) {
      const hero = welcomeHero(page);
      expect(welcomePages(page, ['mario']), page).toBe(w.pages);
      expect(welcomePages(page, ['mario'], ['mario']), page).toBe(w.pages);
      expect(welcomePages(page, ['mario', hero], ['mario']), page).toBe(w.after);
      expect(welcomePages(page, ['mario', hero], [hero]), page).toBe(w.own);
      expect(welcomePages(page, ['mario', hero], ['mario', hero]), page).toBe(w.own);
      expect(welcomePages(page, ['mario'], [hero]), page).toBe(w.own);
    }
  });

  it.each(ownCards)('"%s" fits its card: the speaker, a blank line, at most four lines', (_n, page) => {
    expect(page.length).toBeLessThanOrEqual(6);
    expect(page.filter((l) => l.length > CARD_COLS)).toEqual([]);
    expect(page.filter((l) => fontText(l) !== l)).toEqual([]);
    if (/^[A-Z][A-Z .'-]*:$/.test(page[0] ?? '')) {
      expect(page[1]).toBe('');
      expect(page.length).toBeGreaterThan(2);
    }
  });

  it('the own lines name no level numbers, no buttons, and never plead for the hero', () => {
    const levelish = /\b[1-8]-[1-4]\b|\bWORLD [1-8]\b|\bLEVEL\b|\bSTAGE [1-8]\b/;
    for (const [name, page] of ownCards) {
      const t = page.join(' ');
      expect(t, name).not.toMatch(levelish);
      expect(t, name).not.toMatch(/\b(PRESS|PUSH|BUTTON)\b|\b[ABXYZ] BUTTON\b/);
      if (!name.startsWith('fairy again')) expect(t, name).not.toMatch(/PLEASE (FIND|HELP|SAVE|BRING)/);
    }
  });

  it('no two NPCs share an own card, and no own card repeats another set', () => {
    const seen = new Set<string>();
    const other = new Set(
      [
        ...Object.values(PARTNERS).flatMap((s) => [...s.pages, ...(s.after ?? [])]),
        ...Object.values(WELCOMES).flatMap((w) => [...w.pages, ...(w.after ?? [])]),
      ].map((p) => p.join('\n')),
    );
    for (const [name, page] of ownCards) {
      const k = page.join('\n');
      expect(seen.has(k), name).toBe(false);
      expect(other.has(k), name).toBe(false);
      seen.add(k);
    }
  });
});

describe("the fairy's riddles (#28)", () => {
  const fairy = PARTNERS.fairy!;

  it('first talk: a riddle, no plain directions; again: one clearer fallback page', () => {
    const riddle = text(fairy.pages);
    // Cryptic: none of the old plain steps.
    expect(riddle).not.toMatch(/RIDE THE CLOUDS|BUMP THE EMPTY|A VINE WILL GROW|JUMP/);
    expect(fairy.again).toHaveLength(1);
    const again = text(fairy.again!);
    expect(again).toMatch(/CLOUD/);
    expect(again).toMatch(/VINE/);
    expect(again).toMatch(/BUMP|KNOCK|HIT/);
  });

  it('the fallback only while Link is missing, for another hero; Link himself hears his own lines', () => {
    expect(partnerPages(fairy, ['mario'], { playing: 'mario' })).toBe(fairy.pages);
    expect(partnerPages(fairy, ['mario'], { playing: 'mario', again: true })).toBe(fairy.again);
    expect(partnerPages(fairy, ['mario', 'link'], { playing: 'mario', again: true })).toBe(fairy.after);
    expect(partnerPages(fairy, ['mario', 'link'], { playing: 'link', again: true })).toBe(fairy.own);
    // Nobody else has a fallback: talking again repeats their pages.
    for (const [who, s] of Object.entries(PARTNERS))
      if (who !== 'fairy') expect(partnerPages(s, ['mario'], { again: true }), who).toBe(s.pages);
  });

  it('no level numbers: the crystal ball pinpoints the spot', () => {
    const t = text([...fairy.pages, ...(fairy.again ?? [])]);
    expect(t).not.toMatch(/\b[1-8]-[1-4]\b|\bWORLD\b|\bLEVEL\b|\bSTAGE\b/);
  });
});
