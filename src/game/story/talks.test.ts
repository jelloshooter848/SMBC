import { describe, expect, it } from 'vitest';
import { fontText } from '@game/hud/text';
import { CARD_COLS } from '@game/scenes/free-hero';
import { CHARACTERS } from '@game/characters/registry';
import { FREED_TALKS, freedTalk, partnerGone, partnerPages, PARTNERS, type Page } from './script';

// 0.4.23 (docs/STORY.md 2.3, 2.4-2.11, 2.13): the hint NPCs say a new page once their hero is
// freed, and every freed hero talks between the round and the freed card.

/** The longest name a hero can have (Sophia III), for the `<HERO>` pages. */
const LONGEST = 'SOPHIA III';

const cards: [string, Page][] = [
  ...Object.entries(PARTNERS).flatMap(([k, s]) =>
    (s.after ?? []).map((p, i): [string, Page] => [`${k} after ${i}`, p]),
  ),
  ...Object.keys(FREED_TALKS).flatMap((id) =>
    freedTalk(id, LONGEST).map((p, i): [string, Page] => [`${id} talk ${i}`, p]),
  ),
];

describe('the freed talks and the after lines', () => {
  it.each(cards)(
    'card page "%s" fits its box: a speaker, a blank line and at most four lines',
    (_n, page) => {
      expect(page.length).toBeGreaterThan(0);
      expect(page.length).toBeLessThanOrEqual(6);
      expect(page.filter((l) => l.length > CARD_COLS)).toEqual([]);
      expect(page.filter((l) => fontText(l) !== l)).toEqual([]);
    },
  );

  it('every hero but Mario has a freed talk; the player hero speaks the <HERO>: pages', () => {
    const heroes = CHARACTERS.map((c) => c.id).filter((id) => id !== 'mario');
    expect(Object.keys(FREED_TALKS).sort()).toEqual(heroes.sort());
    expect(freedTalk('mario', 'MARIO')).toEqual([]);
    expect(freedTalk('luigi', 'MARIO')[1]?.[0]).toBe('MARIO:');
    expect(freedTalk('link', 'MEGA MAN')[1]).toEqual(['MEGA MAN:', '', 'ARE YOU OKAY?']);
    expect(freedTalk('sophia', 'SAMUS')[1]).toContain('YOU... THANKS, SAMUS.');
  });

  it('every hint NPC names its hero; only the pipe keeper hints at none', () => {
    const heroes = new Set(CHARACTERS.map((c) => c.id));
    for (const [who, s] of Object.entries(PARTNERS)) {
      if (who === 'pipe-keeper') expect(s.hero, who).toBeUndefined();
      else expect(heroes.has(s.hero ?? ''), who).toBe(true);
    }
    // Each hero of worlds 1-8 has at least one hint NPC.
    const hinted = new Set(Object.values(PARTNERS).map((s) => s.hero));
    for (const id of heroes) if (id !== 'mario') expect(hinted.has(id), id).toBe(true);
  });

  it('once its hero is freed a hint NPC says its one after page instead; Fred goes home', () => {
    for (const [who, s] of Object.entries(PARTNERS)) {
      expect(partnerPages(s, ['mario'])).toBe(s.pages);
      expect(partnerGone(s, ['mario']), who).toBe(false);
      if (!s.hero) continue;
      if (who === 'fred') {
        expect(s.after).toBeUndefined();
        expect(partnerGone(s, ['mario', s.hero])).toBe(true);
        continue;
      }
      expect(s.after, who).toHaveLength(1);
      expect(partnerPages(s, ['mario', s.hero])).toBe(s.after);
      expect(partnerGone(s, ['mario', s.hero])).toBe(false);
    }
  });

  it('the old man no longer tells of the second vine: the fairy in the clouds does', () => {
    const text = (who: string) => (PARTNERS[who]?.pages ?? []).flat().join(' ');
    expect(PARTNERS['old-man']?.pages).toHaveLength(3);
    expect(text('old-man')).not.toContain('SECOND VINE');
    expect(text('fairy')).toContain('A VINE WILL GROW.');
  });
});
