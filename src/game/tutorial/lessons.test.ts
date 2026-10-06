import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../characters/registry';
import { fontText } from '../hud/text';
import { wrapPrompt } from './stage-prompts';
import { LESSONS, lessonsFor, promptActions, promptText } from './lessons';

/** Actions a prompt token may name: the face buttons (directions are written plainly). */
const BUTTONS = ['jump', 'attack', 'special', 'select'];
import { ROOM_COLS, ROOM_LINES } from './room';

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
      const prompts = lessons.flatMap((l) =>
        [l.prompt, l.touchPrompt].flatMap((prompt) => (prompt ? [{ id: l.id, prompt }] : [])),
      );
      for (const l of prompts) {
        // Bare: each [LABEL:action] token as its label (the box falls back to this).
        const bare = promptText(l.prompt);
        expect(fontText(bare), l.id).toBe(bare);
        const lines = wrapPrompt(bare, ROOM_COLS);
        expect(lines.length, l.id).toBeLessThanOrEqual(ROOM_LINES);
        for (const line of lines) expect(line.length).toBeLessThanOrEqual(ROOM_COLS);
        expect(ROOM_COLS).toBeLessThanOrEqual(28);
        expect(bare, l.id).not.toMatch(LETTER);
        expect(bare, l.id).not.toMatch(PROSE);
        // Tokens name real button actions, and their labels are the hero's ability words.
        for (const a of promptActions(l.prompt)) expect(BUTTONS, `${id} ${l.id}`).toContain(a);
        const named = vocab.filter((w) => new RegExp(`\\b${w}\\b`).test(bare));
        expect(named.length, `${id} ${l.id}: names an ability`).toBeGreaterThan(0);
      }
    },
  );
});

describe('prompt tokens', () => {
  it('[LABEL:action] becomes the hint, or the bare label', () => {
    const p = 'HOLD [SHOOT:attack], THEN [JUMP:jump].';
    expect(promptText(p)).toBe('HOLD SHOOT, THEN JUMP.');
    expect(promptText(p, (l, a) => `${l} (${a.toUpperCase()})`)).toBe(
      'HOLD SHOOT (ATTACK), THEN JUMP (JUMP).',
    );
    expect(promptActions(p)).toEqual(['attack', 'jump']);
  });
});
