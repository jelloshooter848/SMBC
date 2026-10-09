import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { SMB_PAGES } from '@content/worldmap';
import { CHARACTERS } from '@game/characters/registry';
import { PARTNERS, partnerPages, type Page } from './script';

// 0.4.40 (owner: "an NPC in every level"): every main level of Chapter 1, 1-1 to 8-4, has someone
// to talk to in the campaign. Each speaks for the world's hero: while that hero is still under the
// spell they plead and hint (by place, never by level number: the 0.4.35 rule); once the hero is
// freed they thank you, or tell an easter egg about the hero's own game. Where each one stands,
// and that every hero can walk up and talk, is tests/sim/partners.test.ts.

/** The campaign's main levels, 1-1 to 8-4. */
const MAIN = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`));

/** World `w`'s hero: the one its road out waits for (the map page's gate). */
const heroOf = (w: number): string => {
  const gate = SMB_PAGES[w - 1]?.exits.find((e) => e.gate)?.gate;
  expect(gate, `world ${w}`).toBeDefined();
  return gate as string;
};

/** Every `partner` placed in a level file: its id, the level it stands in, and that level's main level. */
const placed = levelIds().flatMap((id) => {
  const l = getLevel(id);
  return l.entities
    .filter((e) => e.type === 'partner')
    .map((e) => ({ who: String(e.props?.who ?? ''), level: id, main: l.parent ?? id }));
});

/**
 * The two who speak for no one: 1-2's pipe keeper says where the warp zone's pipe goes (owner
 * ask, 0.4.23), and Fred the frog (8-4) goes home with Jason once Sophia III is freed.
 */
const ONE_STATE = ['pipe-keeper', 'fred'];

const text = (pages: readonly Page[]) => pages.flat().join(' ');

describe('an NPC in every level (0.4.40)', () => {
  it.each(MAIN)('%s: someone stands there in the campaign who speaks for the world hero', (id) => {
    const w = Number(id[0]);
    const hero = heroOf(w);
    const here = placed.filter((p) => p.main === id).map((p) => p.who);
    const speakers = here.filter((who) => {
      const s = PARTNERS[who];
      return s?.hero === hero && (s.after?.length ?? 0) > 0;
    });
    expect(speakers, `${id}: ${here.join(', ') || 'nobody'}`).not.toEqual([]);
  });

  it('every partner of the script stands somewhere, in a Chapter 1 level, and is campaign only', () => {
    const where = new Set(placed.map((p) => p.who));
    expect(Object.keys(PARTNERS).filter((who) => !where.has(who))).toEqual([]);
    for (const p of placed) {
      expect(PARTNERS[p.who], `${p.level}: ${p.who}`).toBeDefined();
      expect(MAIN, `${p.level}: ${p.who}`).toContain(p.main);
      const spawn = getLevel(p.level).entities.find((e) => e.type === 'partner' && e.props?.who === p.who);
      expect(spawn?.props?.campaign, `${p.level}: ${p.who}`).toBe(true);
    }
  });

  it("each NPC speaks for its own world's hero", () => {
    for (const p of placed) {
      const s = PARTNERS[p.who]!;
      if (p.who === 'pipe-keeper') continue;
      expect(s.hero, p.who).toBe(heroOf(Number(p.main[0])));
    }
  });

  it('every NPC has both states, one to three cards each: still missing, and found', () => {
    for (const [who, s] of Object.entries(PARTNERS)) {
      expect(s.pages.length, who).toBeGreaterThanOrEqual(1);
      expect(s.pages.length, who).toBeLessThanOrEqual(3);
      if (ONE_STATE.includes(who)) continue;
      expect(s.hero, who).toBeDefined();
      expect(s.after?.length ?? 0, who).toBeGreaterThanOrEqual(1);
      expect(s.after?.length ?? 0, who).toBeLessThanOrEqual(3);
      // The states differ: freed, the hero's own page plays instead.
      expect(partnerPages(s, ['mario', s.hero!])).toBe(s.after);
      expect(text(s.after!), who).not.toBe(text(s.pages));
    }
    expect(
      Object.keys(PARTNERS)
        .filter((w) => !PARTNERS[w]!.after)
        .sort(),
    ).toEqual([...ONE_STATE].sort());
  });

  it('every card is named: the speaker, then a blank line (a statue or a caption excepted)', () => {
    const named = /^[A-Z][A-Z .'-]*:$/;
    for (const [who, s] of Object.entries(PARTNERS))
      for (const page of [...s.pages, ...(s.after ?? [])]) {
        if (!named.test(page[0] ?? '')) continue;
        expect(page[1], `${who}: ${page[0]}`).toBe('');
        expect(page.length, `${who}: ${page[0]}`).toBeGreaterThan(2);
      }
  });

  it('no line names a level by its number (places are named in-world; the crystal ball pinpoints)', () => {
    const levelish = /\b[1-8]-[1-4]\b|\bWORLD [1-8]\b|\bLEVEL\b|\bSTAGE [1-8]\b/;
    for (const [who, s] of Object.entries(PARTNERS)) {
      expect(text(s.pages), who).not.toMatch(levelish);
      expect(text(s.after ?? []), who).not.toMatch(levelish);
    }
  });

  it('no two NPCs say the same card', () => {
    const seen = new Map<string, string>();
    for (const [who, s] of Object.entries(PARTNERS))
      for (const page of [...s.pages, ...(s.after ?? [])]) {
        const k = page.join('\n');
        // A card may repeat within one NPC's two states (a greeting said either way).
        const prev = seen.get(k);
        if (prev !== undefined) expect(prev, k).toBe(who);
        seen.set(k, who);
      }
  });

  it('the found state never pleads for the hero it is about', () => {
    const name = (id: string) => CHARACTERS.find((c) => c.id === id)?.name.toUpperCase() ?? id;
    for (const [who, s] of Object.entries(PARTNERS)) {
      if (!s.after || !s.hero) continue;
      expect(text(s.after), `${who} (${name(s.hero)})`).not.toMatch(/PLEASE (FIND|HELP|SAVE|BRING)/);
    }
  });
});
