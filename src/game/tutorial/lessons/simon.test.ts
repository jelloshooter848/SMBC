import { describe, expect, it } from 'vitest';
import { heroItems } from '../../items/catalog';
import { SIMON_TOOL_LABELS } from '../../characters/simon';
import { SUB_WEAPONS } from '../../characters/simon/weapons';
import { MoveStats } from '../lessons';
import { practiceRoom } from '../room';
import { touchNames } from './common';
import { SIMON_BIG_HP, SIMON_TRAINING } from './simon';

/*
 * Simon's training from 0.4.34: the basic kit, then each of his power-ups grabbed in the room and
 * used, in the campaign's order. The scripted run is training-room.test.ts (training-tc.ts).
 */

const lessons = SIMON_TRAINING.chapters.flatMap((c) => c.lessons);
const byId = (id: string) => lessons.find((l) => l.id === id);
const fresh = () => new MoveStats(practiceRoom().geometry);

describe("Simon's training", () => {
  it('starts from the basic kit: no whole-kit room, no PREVIEW marks', () => {
    expect('fullKit' in SIMON_TRAINING).toBe(false);
    for (const l of lessons) expect('unlocked' in l, l.id).toBe(false);
  });

  it('teaches the basic moves, then every power-up in the order the campaign places them', () => {
    expect(lessons.map((l) => l.id)).toEqual([
      'whip',
      'crouch-whip',
      'committed-jump',
      'pot-roast',
      'chain-whip',
      'dagger',
      'hearts',
      'holy-water',
      'hand-axe',
      'morning-star',
      'cross',
      'double-shot',
      'stopwatch',
      'triple-shot',
    ]);
    // Every item of his, once each, grow item first (docs/POWERUPS.md 6.2's order).
    const items = lessons.flatMap((l) => (l.item ? [l.item] : []));
    expect(items).toEqual(heroItems('simon')?.items.map((i) => i.id));
    // The basic chapter has none; the Pot Roast opens the next one (the hero is at the start, so
    // the item is to the right, as its prompt says).
    expect(SIMON_TRAINING.chapters[0]?.lessons.every((l) => !l.item)).toBe(true);
    expect(SIMON_TRAINING.chapters[1]?.lessons[0]?.item).toBe('pot-roast');
    // Each sub-weapon's lesson is its belt id, with its item.
    for (const w of SUB_WEAPONS) expect(byId(w.id)?.item).toBe(w.item);
  });

  it("touch prompts name the sub-weapon as THROW's button shows it", () => {
    const captions = new Set(Object.values(SIMON_TOOL_LABELS));
    for (const l of lessons)
      for (const name of touchNames(l.prompt))
        if (!['WHIP', 'JUMP', 'TOOLS'].includes(name)) expect(captions, `${l.id}: ${name}`).toContain(name);
    expect(touchNames(byId('holy-water')?.prompt ?? '')).toContain('WATER');
    expect(touchNames(byId('stopwatch')?.prompt ?? '')).toContain('WATCH');
  });

  it('measures the real thing: the bar at 16, two or three sub-weapons out, hearts spent', () => {
    const t = fresh();
    const roast = byId('pot-roast');
    t.now = { maxHp: 10 };
    expect(roast?.done(t)).toBe(false);
    t.now = { maxHp: SIMON_BIG_HP };
    expect(roast?.done(t)).toBe(true);
    t.maxShotsOut = 1;
    expect(byId('double-shot')?.done(t)).toBe(false);
    t.maxShotsOut = 2;
    expect(byId('double-shot')?.done(t)).toBe(true);
    expect(byId('triple-shot')?.done(t)).toBe(false);
    t.maxShotsOut = 3;
    expect(byId('triple-shot')?.done(t)).toBe(true);
    // The stopwatch makes no projectile: its hearts are what show it was used.
    expect(byId('stopwatch')?.done(t)).toBe(false);
    t.toolUses.add('stopwatch');
    expect(byId('stopwatch')?.done(t)).toBe(true);
  });
});
