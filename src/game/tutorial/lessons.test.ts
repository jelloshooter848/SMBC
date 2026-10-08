import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../characters/registry';
import { fontText } from '../hud/text';
import { wrapPrompt } from './stage-prompts';
import { chaptersFor, LESSONS, lessonsFor, promptActions, promptText, touchNames, TRAINING } from './lessons';
import { WEAPONS } from '../characters/megaman/weapons';
import { SUB_WEAPONS } from '../characters/simon/weapons';
import { NINPO_ARTS } from '../characters/ryu/weapons';
import { GUNS } from '../characters/bill/weapons';

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

/**
 * Each hero's whole kit (owner note 24), as its code has it: one lesson per piece. Left out because
 * the campaign code has no such thing: Bill's R and B capsules (only in his mini game, Jungle
 * Assault), Link's cracked-block bombing (a cracked wall crumbles to any attack: the bomb lesson
 * blasts the dummy).
 */
const KIT: Record<string, string[]> = {
  luigi: ['high-jump', 'slippery-stop', 'fireball'],
  link: [
    'sword',
    'down-thrust',
    'up-thrust',
    'shield',
    'boomerang',
    'bomb',
    'jump-spell',
    'shield-spell',
    'fire-spell',
    'swim',
  ],
  megaman: [
    'shoot',
    'charge',
    'slide',
    'rush',
    'weapon',
    'saw',
    'leaf',
    'flame',
    'knuckle',
    'bolt',
    'seabed-jump',
  ],
  samus: [
    'shoot',
    'aim-up',
    'long-beam',
    'ice-beam',
    'wave-beam',
    'missile',
    'missile-switch',
    'morph-ball',
    'bomb',
    'bomb-jump',
  ],
  simon: [
    'whip',
    'crouch-whip',
    'committed-jump',
    'dagger',
    'hand-axe',
    'holy-water',
    'cross',
    'stopwatch',
    'hearts',
    'chain-whip',
    'morning-star',
    'double-shot',
  ],
  ryu: ['slash', 'cling', 'wall-jump', 'throwing-star', 'windmill', 'fire-wheel', 'jump-slash'],
  bill: ['shoot', 'aim', 'prone', 'jump-shoot', 'mg', 'spread', 'laser', 'flame-gun', 'swim-shoot'],
  sophia: ['drive-jump', 'cannon', 'cannon-up', 'hover', 'missile', 'homing', 'wall-climb', 'jason'],
};

describe('hero lessons', () => {
  it('every hero but Mario has a lesson for every piece of its kit; Mario has none (his tutorial is 1-0)', () => {
    for (const c of CHARACTERS) {
      const ids = lessonsFor(c.id).map((l) => l.id);
      if (c.id === 'mario') expect(ids).toEqual([]);
      else for (const piece of KIT[c.id] ?? ['?']) expect(ids, c.id).toContain(piece);
    }
    expect(Object.keys(LESSONS).every((id) => CHARACTERS.some((c) => c.id === id))).toBe(true);
    // The kit's own lists: every Mega Man weapon, Simon sub-weapon, Ryu art and Bill gun.
    expect(lessonsFor('megaman').map((l) => l.id)).toEqual(expect.arrayContaining(WEAPONS.map((w) => w.id)));
    expect(lessonsFor('simon').map((l) => l.id)).toEqual(
      expect.arrayContaining(SUB_WEAPONS.map((w) => w.id)),
    );
    expect(lessonsFor('ryu').map((l) => l.id)).toEqual(
      expect.arrayContaining(NINPO_ARTS.map((a) => (a.id === 'slash' ? 'jump-slash' : a.id))),
    );
    expect(lessonsFor('bill').map((l) => l.id)).toEqual(
      expect.arrayContaining(GUNS.slice(1).map((g) => g.id)),
    );
  });

  it('lessons come in short chapters: 1 to 6 lessons each, titled to fit the heading', () => {
    for (const c of CHARACTERS.filter((x) => x.id !== 'mario')) {
      const chapters = chaptersFor(c.id);
      expect(chapters.length, c.id).toBeGreaterThan(0);
      expect(new Set(chapters.map((ch) => ch.id)).size).toBe(chapters.length);
      for (const ch of chapters) {
        expect(ch.lessons.length, `${c.id} ${ch.id}`).toBeGreaterThanOrEqual(1);
        expect(ch.lessons.length, `${c.id} ${ch.id}`).toBeLessThanOrEqual(6);
        const head = `${c.hudName} ${ch.title} ${ch.lessons.length}/${ch.lessons.length}`;
        expect(head.length, head).toBeLessThanOrEqual(ROOM_COLS);
        expect(fontText(head)).toBe(head);
      }
      expect(chapters.flatMap((ch) => ch.lessons)).toEqual(lessonsFor(c.id));
    }
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
        // Bare: each [LABEL:action] token as its label (the box falls back to this), and as touch
        // shows it (its caption).
        const bare = promptText(l.prompt);
        for (const text of [bare, promptText(l.prompt, undefined, true)]) {
          expect(fontText(text), l.id).toBe(text);
          const lines = wrapPrompt(text, ROOM_COLS);
          expect(lines.length, l.id).toBeLessThanOrEqual(ROOM_LINES);
          for (const line of lines) expect(line.length).toBeLessThanOrEqual(ROOM_COLS);
        }
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

  it('[LABEL:action:CAPTION]: keys and pads keep the ability, touch shows the button caption', () => {
    const p = '[USE TOOL:special:BOOMERANG] THROWS IT. [TOOLS:select] PICKS ANOTHER.';
    expect(promptText(p)).toBe('USE TOOL THROWS IT. TOOLS PICKS ANOTHER.');
    expect(promptText(p, (l) => `${l} (C)`)).toBe('USE TOOL (C) THROWS IT. TOOLS (C) PICKS ANOTHER.');
    expect(promptText(p, undefined, true)).toBe('BOOMERANG THROWS IT. TOOLS PICKS ANOTHER.');
    expect(promptActions(p)).toEqual(['special', 'select']);
    expect(touchNames(p)).toEqual(['BOOMERANG', 'TOOLS']);
  });

  it("converted heroes' touch prompts name the tool or weapon, never USE TOOL, USE WEAPON, THROW or CAST", () => {
    const generic = ['USE TOOL', 'USE WEAPON', 'THROW', 'CAST'];
    for (const [hero, t] of Object.entries(TRAINING)) {
      if (t.fullKit) continue;
      for (const l of t.chapters.flatMap((c) => c.lessons))
        for (const name of touchNames(l.touchPrompt ?? l.prompt))
          expect(generic, `${hero}:${l.id}`).not.toContain(name);
    }
  });
});
