import { describe, expect, it } from 'vitest';
import { heroItems } from '../../items/catalog';
import { RYU_TOOL_LABELS } from '../../characters/ryu';
import { NINPO_ARTS } from '../../characters/ryu/weapons';
import { MoveStats } from '../lessons';
import { practiceRoom } from '../room';
import { touchNames } from './common';
import { RYU_BIG_HP, RYU_START_NINPO, RYU_TRAINING } from './ryu';

/*
 * Ryu's training from 0.4.34: the basic kit, then each of his power-ups grabbed in the room and
 * used, in the campaign's order. The scripted run is training-room.test.ts (training-tc.ts).
 */

const lessons = RYU_TRAINING.chapters.flatMap((c) => c.lessons);
const byId = (id: string) => lessons.find((l) => l.id === id);

describe("Ryu's training", () => {
  it('starts from the basic kit: no whole-kit room, no PREVIEW marks', () => {
    expect('fullKit' in RYU_TRAINING).toBe(false);
    for (const l of lessons) expect('unlocked' in l, l.id).toBe(false);
  });

  it('teaches the sword and the wall, then every power-up in the order the campaign places them', () => {
    expect(lessons.map((l) => l.id)).toEqual([
      'slash',
      'cling',
      'wall-jump',
      'medicine',
      'throwing-star',
      'ninpo-scroll',
      'windmill',
      'fire-wheel',
      'jump-slash',
    ]);
    const items = lessons.flatMap((l) => (l.item ? [l.item] : []));
    expect(items).toEqual(heroItems('ryu')?.items.map((i) => i.id));
    expect(RYU_TRAINING.chapters[0]?.lessons.every((l) => !l.item)).toBe(true);
    expect(RYU_TRAINING.chapters[1]?.lessons[0]?.item).toBe('medicine');
    for (const a of NINPO_ARTS) expect(byId(a.item)?.item).toBe(a.item);
  });

  it("touch prompts name the art as CAST's button shows it", () => {
    const captions = new Set(Object.values(RYU_TOOL_LABELS));
    for (const l of lessons)
      for (const name of touchNames(l.prompt))
        if (!['SLASH', 'JUMP', 'NINPO'].includes(name)) expect(captions, `${l.id}: ${name}`).toContain(name);
    expect(touchNames(byId('jump-slash')?.prompt ?? '')).toContain('SPIN');
  });

  it('measures the real thing: the bar at 16, a bigger ninpo meter, the somersault', () => {
    const t = new MoveStats(practiceRoom().geometry);
    t.now = { maxHp: 10, ninpoMax: RYU_START_NINPO };
    expect(byId('medicine')?.done(t)).toBe(false);
    expect(byId('ninpo-scroll')?.done(t)).toBe(false);
    t.now = { maxHp: RYU_BIG_HP, ninpoMax: RYU_START_NINPO + 20 };
    expect(byId('medicine')?.done(t)).toBe(true);
    expect(byId('ninpo-scroll')?.done(t)).toBe(true);
    expect(byId('jump-slash')?.done(t)).toBe(false);
    t.seen.add('spin');
    expect(byId('jump-slash')?.done(t)).toBe(true);
  });
});
