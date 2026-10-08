import { describe, expect, it } from 'vitest';
import type { PracticeRoom } from './common';
import { MoveStats } from '../lessons';
import { practiceRoom } from '../room';
import { LUIGI_TRAINING } from './luigi';

/*
 * Luigi's training from 0.4.34: his moves while small, then SMB's Super Mushroom and Fire Flower
 * (standing still in the room). The scripted run is training-room.test.ts (training-tc.ts).
 */

const lessons = LUIGI_TRAINING.chapters.flatMap((c) => c.lessons);
const byId = (id: string) => lessons.find((l) => l.id === id);

describe("Luigi's training", () => {
  it('starts small: no whole-kit room, no PREVIEW marks, no power given by a setup', () => {
    expect(LUIGI_TRAINING.fullKit).toBeUndefined();
    for (const l of lessons) expect(l.unlocked, l.id).toBeUndefined();
  });

  it('teaches his moves, then the Mushroom, then the Fire Flower', () => {
    expect(lessons.map((l) => l.id)).toEqual(['high-jump', 'slippery-stop', 'mushroom', 'fireball']);
    expect(lessons.map((l) => l.item ?? null)).toEqual([null, null, 'mushroom', 'fire-flower']);
    expect(LUIGI_TRAINING.chapters[1]?.lessons[0]?.item).toBe('mushroom');
  });

  it('the Mushroom lesson counts a brick broken after it came up (only a big Luigi can)', () => {
    const feats = { bricks: 2 };
    const room = { world: { feats } } as unknown as PracticeRoom;
    const l = byId('mushroom');
    const t = new MoveStats(practiceRoom().geometry);
    // Not before the lesson has come up.
    expect(l?.done(t)).toBe(false);
    l?.setup?.(room);
    expect(l?.done(t)).toBe(false);
    feats.bricks++;
    expect(l?.done(t)).toBe(true);
  });

  it('the Fire Flower lesson counts a fireball on the dummy', () => {
    const t = new MoveStats(practiceRoom().geometry);
    t.dummyHits.add('stomp');
    expect(byId('fireball')?.done(t)).toBe(false);
    t.dummyHits.add('fireball');
    expect(byId('fireball')?.done(t)).toBe(true);
  });
});
