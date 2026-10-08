import { describe, expect, it } from 'vitest';
import { heroItems } from '../../items/catalog';
import { GUNS } from '../../characters/bill/weapons';
import { MoveStats } from '../lessons';
import { practiceRoom } from '../room';
import { BILL_MEDAL_HITS, BILL_TRAINING } from './bill';

/*
 * Bill's training from 0.4.34: the rifle and his moves, then a Medal and each falcon gun grabbed
 * in the room and fired, in the campaign's order. The scripted run is training-room.test.ts
 * (training-tc.ts).
 */

const lessons = BILL_TRAINING.chapters.flatMap((c) => c.lessons);
const byId = (id: string) => lessons.find((l) => l.id === id);

describe("Bill's training", () => {
  it('starts from the basic kit: no whole-kit room, no PREVIEW marks', () => {
    expect('fullKit' in BILL_TRAINING).toBe(false);
    for (const l of lessons) expect('unlocked' in l, l.id).toBe(false);
  });

  it('teaches the rifle, then the Medal and every gun in the order the campaign places them', () => {
    expect(lessons.map((l) => l.id)).toEqual([
      'shoot',
      'aim',
      'prone',
      'jump-shoot',
      'medal',
      'mg',
      'laser',
      'flame-gun',
      'spread',
      'swim-shoot',
    ]);
    const items = lessons.flatMap((l) => (l.item ? [l.item] : []));
    expect(items).toEqual(heroItems('bill')?.items.map((i) => i.id));
    expect(BILL_TRAINING.chapters[0]?.lessons.every((l) => !l.item)).toBe(true);
    expect(BILL_TRAINING.chapters[1]?.lessons[0]?.item).toBe('medal');
    // Each gun's lesson is its belt id, with its item: guns come only from items.
    for (const g of GUNS.slice(1)) expect(byId(g.id)?.item).toBe(g.item);
  });

  it('measures the real thing: one more hit, and each gun fired', () => {
    const t = new MoveStats(practiceRoom().geometry);
    t.now = { maxHp: BILL_MEDAL_HITS - 1 };
    expect(byId('medal')?.done(t)).toBe(false);
    t.now = { maxHp: BILL_MEDAL_HITS };
    expect(byId('medal')?.done(t)).toBe(true);
    // The rifle's shots tick none of the gun lessons.
    t.shotKinds.add('rifle');
    for (const g of GUNS.slice(1)) expect(byId(g.id)?.done(t), g.id).toBe(false);
    for (const g of GUNS.slice(1)) {
      t.shotKinds.add(g.spec.kind);
      expect(byId(g.id)?.done(t), g.id).toBe(true);
    }
  });
});
