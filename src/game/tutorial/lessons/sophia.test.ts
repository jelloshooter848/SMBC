import { describe, expect, it } from 'vitest';
import { heroItems } from '../../items/catalog';
import { MoveStats } from '../lessons';
import { practiceRoom } from '../room';
import { touchNames } from './common';
import { SOPHIA_TRAINING } from './sophia';

/*
 * Sophia III's training from 0.4.34: driving, the cannon and Jason, then each of her power-ups
 * grabbed in the room and used, in the campaign's order. The scripted run is
 * training-room.test.ts (training-tc.ts).
 */

const lessons = SOPHIA_TRAINING.chapters.flatMap((c) => c.lessons);
const byId = (id: string) => lessons.find((l) => l.id === id);

describe("Sophia III's training", () => {
  it('starts from the basic kit: no whole-kit room, no PREVIEW marks', () => {
    expect(SOPHIA_TRAINING.fullKit).toBeUndefined();
    for (const l of lessons) expect(l.unlocked, l.id).toBeUndefined();
  });

  it('teaches the tank and Jason, then every power-up in the order the campaign places them', () => {
    expect(lessons.map((l) => l.id)).toEqual([
      'drive-jump',
      'cannon',
      'cannon-up',
      'jason',
      'hover',
      'crusher',
      'missile',
      'wall-climb',
      'ceiling-climb',
      'homing',
    ]);
    expect(lessons.map((l) => l.item ?? null)).toEqual([
      null,
      null,
      null,
      null,
      'power-capsule',
      'crusher',
      'triple-missile',
      'wall-climb',
      'ceiling-climb',
      'homing-missile',
    ]);
    // All six of hers, the climbs as items of their own (decision 10).
    expect(new Set(lessons.flatMap((l) => (l.item ? [l.item] : [])))).toEqual(
      new Set(heroItems('sophia')?.items.map((i) => i.id)),
    );
    expect(SOPHIA_TRAINING.chapters[0]?.lessons.every((l) => !l.item)).toBe(true);
    // The Power Capsule (her grow item) opens the power-ups.
    expect(SOPHIA_TRAINING.chapters[1]?.lessons[0]?.item).toBe('power-capsule');
  });

  it('touch prompts name her buttons: SHOOT, MISSILE, EXIT', () => {
    for (const l of lessons)
      for (const name of touchNames(l.prompt))
        expect(['SHOOT', 'MISSILE', 'EXIT', 'JUMP'], `${l.id}: ${name}`).toContain(name);
  });

  it('measures the real thing: Jason out and back in, the hover, each climb', () => {
    const t = new MoveStats(practiceRoom().geometry);
    const jason = byId('jason');
    // Out on foot: not yet.
    t.seen.add('_jason');
    t.now = { _jason: 1 };
    expect(jason?.done(t)).toBe(false);
    // Back in the tank.
    t.now = {};
    expect(jason?.done(t)).toBe(true);
    // A wall is not a ceiling, nor the other way round.
    t.seen.add('_wall');
    expect(byId('wall-climb')?.done(t)).toBe(true);
    expect(byId('ceiling-climb')?.done(t)).toBe(false);
    t.seen.add('_ceiling');
    expect(byId('ceiling-climb')?.done(t)).toBe(true);
    expect(byId('hover')?.done(t)).toBe(false);
    t.seen.add('_hover');
    expect(byId('hover')?.done(t)).toBe(true);
    // Triple missiles do not tick the homing lesson.
    t.shotKinds.add('sophia-missile');
    expect(byId('homing')?.done(t)).toBe(false);
    t.shotKinds.add('sophia-homing');
    expect(byId('homing')?.done(t)).toBe(true);
  });
});
