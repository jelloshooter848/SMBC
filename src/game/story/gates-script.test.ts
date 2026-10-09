import { describe, expect, it } from 'vitest';
import { fontText } from '@game/hud/text';
import { CARD_COLS } from '@game/scenes/free-hero';
import {
  CASTLE_COLS,
  CASTLE_PAGES,
  castleRemark,
  gateScript,
  HINT_COLS,
  REMARK_CASTLES,
  RIFT_SEALED_PAGES,
  sealedHint,
  WELCOMES,
  welcomeHint,
  type Page,
} from './script';

// S3's lines (docs/STORY.md 2.3a, 2.3b, 2.12): the castle remarks, the world gates, the rift's
// reminder and the welcomes fit their boxes with the longest hero name, in font characters.

const LONGEST = 'SOPHIA III';

const cards: [string, Page][] = [
  ...REMARK_CASTLES.map((id): [string, Page] => [`remark ${id}`, castleRemark(id, LONGEST) as Page]),
  ...[1, 2, 3, 4, 5, 6, 7].flatMap((w) => {
    const g = gateScript(w, LONGEST);
    if (!g) return [];
    return [...g.reminder, ...g.bowser, ...g.toad].map((p, i): [string, Page] => [`gate ${w} ${i}`, p]);
  }),
  ...RIFT_SEALED_PAGES.map((p, i): [string, Page] => [`rift sealed ${i}`, p]),
  ...Object.entries(WELCOMES).flatMap(([k, w]) => w.pages.map((p, i): [string, Page] => [`${k} ${i}`, p])),
  ...Object.entries(WELCOMES).flatMap(([k, w]) =>
    (w.after ?? []).map((p, i): [string, Page] => [`${k} after ${i}`, p]),
  ),
];

describe("S3's story lines", () => {
  it.each(cards)('card page "%s" fits its box', (_name, page) => {
    expect(page.length).toBeGreaterThan(2);
    expect(page.length).toBeLessThanOrEqual(6);
    expect(page[1]).toBe('');
    expect(page.filter((l) => l.length > CARD_COLS)).toEqual([]);
    expect(page.filter((l) => fontText(l) !== l)).toEqual([]);
  });

  it('castles 1-4 to 7-4 each have a remark and two pages that fit', () => {
    expect(REMARK_CASTLES).toEqual(['1-4', '2-4', '3-4', '4-4', '5-4', '6-4', '7-4']);
    for (const id of REMARK_CASTLES) {
      const c = CASTLE_PAGES[id];
      expect(c, id).toBeDefined();
      for (const page of [c?.reveal ?? [], c?.news ?? []]) {
        expect(page.length).toBeLessThanOrEqual(4);
        expect(page.filter((l) => l.length > CASTLE_COLS)).toEqual([]);
      }
    }
    expect(castleRemark('8-4', 'MARIO')).toBeNull();
  });

  it('every gate from World 1 to 7 has a reminder, a cutaway and Toad; none past 7', () => {
    for (let w = 1; w <= 7; w++) {
      const g = gateScript(w, 'MARIO');
      expect(g?.reminder.length, `${w}`).toBeGreaterThan(0);
      expect(g?.bowser.every((p) => p[0] === 'BOWSER:')).toBe(true);
      expect(g?.toad.every((p) => p[0] === 'TOAD:')).toBe(true);
    }
    expect(gateScript(8, 'MARIO')).toBeNull();
  });

  it('the hint lines fit the strip (the longest hero, every local)', () => {
    const lines = [sealedHint(LONGEST), ...Object.values(WELCOMES).map((w) => welcomeHint(w.local))];
    for (const l of lines) {
      expect(l.length).toBeLessThanOrEqual(HINT_COLS);
      expect(fontText(l)).toBe(l);
    }
    expect(sealedHint(LONGEST)).toBe('SEALED - FREE SOPHIA III FIRST');
  });

  it('a welcome for each of worlds 2-8, spoken by its local', () => {
    expect(Object.keys(WELCOMES)).toEqual(['smb-2', 'smb-3', 'smb-4', 'smb-5', 'smb-6', 'smb-7', 'smb-8']);
    for (const w of Object.values(WELCOMES)) for (const p of w.pages) expect(p[0]).toBe(`${w.local}:`);
  });

  it("each local has one short after-freed page in its own voice (its world's hero freed)", () => {
    for (const [k, w] of Object.entries(WELCOMES)) {
      expect(w.after, k).toHaveLength(1);
      const page = w.after?.[0] ?? [];
      expect(page[0], k).toBe(`${w.local}:`);
      expect(page.length - 2, k).toBeLessThanOrEqual(4);
      expect(
        page.filter((l) => l.length > 28),
        k,
      ).toEqual([]);
      // Abilities, never button letters.
      expect(
        page.filter((l) => /\b(PRESS|PUSH|BUTTON)\b|\b[BXYZ]\b/.test(l)),
        k,
      ).toEqual([]);
      // Not the welcome's plea any more.
      expect(page.join(' '), k).not.toMatch(/BRAINWASHED|REPROGRAMMED|PLEASE HELP/);
    }
  });
});

describe('locals and Toad describe places, never level numbers (0.4.35, owner)', () => {
  it.each(cards)('"%s" names no level like 2-1 or 4-2 (the crystal ball pinpoints levels)', (_name, page) => {
    expect(page.filter((l) => /\b[1-8]-[1-4]\b/.test(l))).toEqual([]);
  });
});
