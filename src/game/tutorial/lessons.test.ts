import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../characters/registry';
import { fontText, wrapText } from '../hud/text';
import { LESSONS, lessonsFor } from './lessons';
import { PROMPT_COLS, PROMPT_LINES } from './room';

/**
 * A button named by its letter ("B", "BUTTON C"), or "A" used as one ("PRESS A", "(A)", "A:") rather
 * than as the article: prompts name abilities instead.
 */
const LETTER = /\b(BUTTON )?[BCXYLR]\b/;
const PROSE =
  /\b(button|press|push|tap|hold)\s+[abcxy]\b|\([abcxy]\)|\b[abcxy]\s*[:/]|\b(press|push|tap)\s+(start|select)\b/i;

/** The words a hero's controls go by: its guide's actions and touch captions, and its tools. */
function vocabulary(id: string): string[] {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c) return [];
  const words = new Set(['JUMP', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
  for (const row of c.guide.controls) {
    if (row.touch) words.add(row.touch.toUpperCase());
    for (const w of row.action.toUpperCase().split(/[^A-Z]+/)) if (w) words.add(w);
  }
  for (const t of c.guide.belt ?? []) for (const w of t.name.toUpperCase().split(/\s+/)) words.add(w);
  return [...words];
}

describe('hero lessons', () => {
  it('every hero but Mario has 3 to 5 lessons; Mario has none (his tutorial is 1-0)', () => {
    for (const c of CHARACTERS) {
      const n = lessonsFor(c.id).length;
      if (c.id === 'mario') expect(n).toBe(0);
      else {
        expect(n, c.id).toBeGreaterThanOrEqual(3);
        expect(n, c.id).toBeLessThanOrEqual(5);
      }
    }
    expect(Object.keys(LESSONS).every((id) => CHARACTERS.some((c) => c.id === id))).toBe(true);
  });

  it.each(CHARACTERS.filter((c) => c.id !== 'mario').map((c) => [c.id]))(
    '%s: prompts fit the box, name abilities and never button letters',
    (id) => {
      const lessons = lessonsFor(id);
      expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
      const vocab = vocabulary(id);
      for (const l of lessons) {
        expect(fontText(l.prompt), l.id).toBe(l.prompt);
        const lines = wrapText(l.prompt, PROMPT_COLS);
        expect(lines.length, l.id).toBeLessThanOrEqual(PROMPT_LINES);
        for (const line of lines) expect(line.length).toBeLessThanOrEqual(PROMPT_COLS);
        expect(l.prompt, l.id).not.toMatch(LETTER);
        expect(l.prompt, l.id).not.toMatch(PROSE);
        const named = vocab.filter((w) => new RegExp(`\\b${w}\\b`).test(l.prompt));
        expect(named.length, `${id} ${l.id}: names an ability`).toBeGreaterThan(0);
      }
    },
  );
});
