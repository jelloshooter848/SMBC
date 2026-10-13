import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import type { Player } from '@game/entities/player';
import { heroItems } from '@game/items/catalog';
import { heroStart, itemRules } from '@game/items/heroes';
import { ownsItem, giveQuietly } from '@game/tutorial/kit';
import { HIT_RULES, HIT_TASK } from '@game/tutorial/hit-rules';
import { heroStage } from '@game/tutorial/heroes';
import { MARIO_TUTORIAL } from '@game/tutorial/mario-1-0';
import type { Lesson } from '@game/tutorial/stage-prompts';
import { TrainingThorns } from '@game/tutorial/targets';
import { file, makeGame, useStorage } from './heroes-harness';
import { choose, playStage, startStage } from './stage-bot';

// WHAT A HIT TAKES (0.4.46, roadmap #21): each hero's real rule for a hit, as the code has it (their
// onHurt), as docs/POWERUPS.md section 7 writes it, and as their training's lesson says it after
// the thorns: one test per hero. A death takes the found kit (back to the basic kit).

useStorage();

const hero = (id: string): CharacterDef => {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c) throw new Error(id);
  return c;
};

/** Every item of `id`'s (a found kit), the grow item first, full health. */
function fullKit(p: Player): void {
  for (const it of heroItems(p.def.id)?.items ?? []) giveQuietly(p, it.id);
  if (p.def.id === 'mario' || p.def.id === 'luigi') p.powerState = 'fire';
}

/** What one hit does to `id` with every item (a campaign kit): before and after. */
function hitOnce(id: string, setup: (p: Player) => void = () => {}) {
  const level = parseTextMap(
    [
      'id: t',
      'time: 300',
      'start: 4,12',
      '',
      '[tiles]',
      ...Array(13).fill('.'.repeat(16)),
      '#'.repeat(16),
      '#'.repeat(16),
    ].join('\n'),
  );
  const c = hero(id);
  const start = heroStart(c);
  let before: { hp: number; power: string; owned: string[] } | null = null;
  const r = runSim({
    level,
    character: c,
    script: { steps: [] },
    maxFrames: 3,
    state: { kit: start.kit, hp: start.hp, powerState: start.powerState },
    controller: (w, f) => {
      const p = w.player;
      if (f === 0) {
        fullKit(p);
        setup(p);
        p.hp = p.scratch.maxHp ?? p.hp;
        if (c.damage.kind === 'hp') p.hp = Math.max(p.hp, (p.scratch.maxHp ?? c.damage.max) as number);
        before = { hp: p.hp, power: p.powerState, owned: owned(p) };
        p.invuln = 0;
        w.hurtPlayer(p, 1);
      }
      return [];
    },
  });
  const p = r.world.player;
  return {
    before: before as unknown as { hp: number; power: string; owned: string[] },
    after: { hp: p.hp, power: p.powerState, owned: owned(p) },
    p,
  };
}

const owned = (p: Player): string[] =>
  (heroItems(p.def.id)?.items ?? []).filter((i) => ownsItem(p, i.id)).map((i) => i.id);

/** docs/POWERUPS.md section 7's row for a hero: what a hit takes, and what a death takes. */
function docRow(name: string): { hit: string; death: string } {
  const doc = readFileSync(new URL('../../docs/POWERUPS.md', import.meta.url), 'utf8');
  const sec = doc.slice(doc.indexOf('## 7. Losing powers'), doc.indexOf('## 8.'));
  const row = sec.split('\n').find((l) => l.startsWith('|') && l.split('|')[1]?.includes(name));
  expect(row, `POWERUPS.md section 7 has a row for ${name}`).toBeTruthy();
  const cells = (row as string).split('|').map((x) => x.trim());
  return { hit: cells[2] as string, death: cells[3] as string };
}

/** The hero's training lessons (Mario's is 1-0). */
const lessonsOf = (id: string): readonly Lesson[] =>
  id === 'mario' ? MARIO_TUTORIAL.lessons : (heroStage(id)?.tutorial.lessons ?? []);

describe('what a hit takes, per hero (code = POWERUPS.md = the training tip)', () => {
  const cases: {
    id: string;
    doc: string;
    check: (r: ReturnType<typeof hitOnce>) => void;
    words: RegExp[];
    text: RegExp[];
  }[] = [
    {
      id: 'mario',
      doc: 'Mario, Luigi',
      check: ({ before, after }) => {
        expect(before.power).toBe('fire');
        expect(after.power).toBe('small');
      },
      words: [/fire → small/, /big → small/, /small dies/],
      text: [/^FIRE OR BIG, A HIT MAKES YOU SMALL\./, /WHILE SMALL COSTS A LIFE\.$/],
    },
    {
      id: 'luigi',
      doc: 'Mario, Luigi',
      check: ({ after }) => expect(after.power).toBe('small'),
      words: [/fire → small/, /small dies/],
      text: [/^FIRE OR BIG, A HIT MAKES YOU SMALL\./],
    },
    {
      id: 'link',
      doc: 'Link',
      check: ({ before, after }) => {
        // With the Blue Ring the first hit is free; everything stays.
        expect(after.hp).toBe(before.hp);
        expect(after.owned).toEqual(before.owned);
        const plain = hitOnce('link', (p) => delete p.scratch.tunic);
        expect(plain.after.hp).toBe(plain.before.hp - 1);
      },
      words: [/1 hit point/, /every other hit free/],
      text: [/HALF A HEART/, /EVERY OTHER/, /DEATH TAKES ITEMS/],
    },
    {
      id: 'megaman',
      doc: 'Mega Man',
      check: ({ before, after }) => {
        expect(before.owned).toContain('helmet');
        expect(after.owned).toEqual(before.owned.filter((i) => i !== 'helmet'));
        expect(after.hp).toBe(before.hp - 4);
      },
      words: [/the Helmet/, /4 of 28 health/],
      text: [/HELMET/, /WEAPONS STAY/, /DEATH TAKES ALL/],
    },
    {
      id: 'samus',
      doc: 'Samus',
      check: ({ before, after }) => {
        // With the Varia Suit: 4.
        expect(after.hp).toBe(before.hp - 4);
        expect(after.owned).toEqual(before.owned);
        const plain = hitOnce('samus', (p) => delete p.scratch.varia);
        expect(plain.after.hp).toBe(plain.before.hp - 8);
      },
      words: [/8 energy, 4 with the Varia Suit/],
      text: [/8 ENERGY, 4 IN THE VARIA SUIT/],
    },
    {
      id: 'simon',
      doc: 'Simon',
      check: ({ before, after }) => {
        expect(after.hp).toBe(before.hp - 2);
        expect(after.owned).toEqual(before.owned);
      },
      words: [/2 health/],
      text: [/2 HEALTH/, /STAY/],
    },
    {
      id: 'ryu',
      doc: 'Ryu',
      check: ({ before, after }) => {
        expect(after.hp).toBe(before.hp - 2);
        expect(after.owned).toEqual(before.owned);
      },
      words: [/2 health/],
      text: [/2 HEALTH/, /STAY/],
    },
    {
      id: 'bill',
      doc: 'Bill',
      check: ({ before, after }) => {
        expect(after.hp).toBe(before.hp - 1);
        expect(after.owned).toEqual(before.owned);
      },
      words: [/1 hit/],
      text: [/ONE HIT POINT/, /GUNS STAY/],
    },
    {
      id: 'sophia',
      doc: 'Sophia III',
      check: ({ before, after }) => {
        expect(before.power).not.toBe('small');
        expect(after.power).toBe('small');
        expect(before.owned).toEqual(
          expect.arrayContaining(['wall-climb', 'ceiling-climb', 'triple-missile']),
        );
        expect(after.owned).not.toContain('wall-climb');
        expect(after.owned).not.toContain('ceiling-climb');
        expect(after.owned).toEqual(expect.arrayContaining(['triple-missile', 'homing-missile']));
      },
      words: [/→ Normal/, /climbs too/, /missiles kept/, /Normal dies/],
      text: [/NORMAL/, /CLIMBS LOST/, /MISSILES KEPT/],
    },
  ];

  for (const c of cases)
    it(`${c.id}: a hit, as the code does it, POWERUPS.md writes it and the training says it`, () => {
      c.check(hitOnce(c.id));
      const row = docRow(c.doc);
      for (const w of c.words) expect(row.hit, `${c.doc}: ${row.hit}`).toMatch(w);
      expect(row.death).toMatch(/everything/);
      const tip = HIT_RULES[c.id]?.tip ?? '';
      for (const t of c.text) expect(tip, tip).toMatch(t);
      // Its training has the lesson: the thorns, then that tip.
      const lessons = lessonsOf(c.id);
      const hit = lessons.find((l) => l.id === 'hit');
      const note = lessons.find((l) => l.id === 'hit-note');
      expect(hit?.text).toBe(HIT_TASK);
      expect(note?.text).toBe(tip);
      expect(note?.note).toBe(true);
      expect(note?.keepKit).toBe(true);
      expect(lessons.findIndex((l) => l.id === 'hit-note')).toBe(
        lessons.findIndex((l) => l.id === 'hit') + 1,
      );
    });

  it('a death takes everything: the found kit goes back to the basic kit (campaign)', () => {
    for (const c of CHARACTERS) {
      if (!itemRules(c.id)) continue;
      const h = makeGame();
      file({ character: c.id, freed: ['mario', c.id], tutorials: ['mario', c.id] });
      h.game.openFile(1);
      const s = h.game.state;
      s.kit = {
        found: 1,
        ...Object.fromEntries((heroItems(c.id)?.items ?? []).map((i) => [`has-${i.id}`, 1])),
      };
      h.game.resetAfterDeath();
      expect(s.kit, c.id).toEqual(heroStart(c).kit);
    }
  });
});

describe('the WHAT A HIT TAKES lesson in training', () => {
  it("Mega Man: the thorns knock the Helmet off; the tip waits with it off; then it's back", () => {
    const { h, stage } = startStage('megaman', { replay: true });
    choose(h, 'Bolt');
    const s = stage();
    const right = () => ['right' as const];
    // Past the Bolt and the pierce (Pause → Skip this lesson): the hit lesson comes up.
    s.director.skipLesson();
    s.director.skipLesson();
    expect(s.director.lesson?.id).toBe('hit');
    expect(s.world.entities.some((e) => e instanceof TrainingThorns && e.alive)).toBe(true);
    expect(s.world.player.scratch.helmet).toBe(1);
    playStage(h, s, right, () => s.director.lesson?.id !== 'hit', 900);
    expect(s.director.lesson?.id).toBe('hit-note');
    expect(s.world.player.scratch.helmet).toBe(0);
    expect(s.world.player.hp).toBeLessThan(28);
    // Its tip holds the game, with the Helmet still off.
    playStage(
      h,
      s,
      () => [],
      () => s.director.frozen,
      300,
    );
    expect(s.director.lines().join(' ')).toMatch(/HELMET/);
    expect(s.world.player.scratch.helmet).toBe(0);
    // The thorns are gone; on past them the flag lesson gives the Helmet back.
    expect(s.world.entities.some((e) => e instanceof TrainingThorns && e.alive)).toBe(false);
    playStage(h, s, right, () => s.director.lesson?.id === 'flag', 900);
    expect(s.world.player.scratch.helmet).toBe(1);
  });
});
