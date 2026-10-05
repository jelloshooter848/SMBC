import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { Lakitu } from '@game/entities/enemies/lakitu';
import { toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** A 48-wide level: 13 air rows (with `rows` overriding some), two ground rows, entity lines. */
const level = (rows: Record<number, string>, entities: string[], theme = 'overworld'): LevelData =>
  parseTextMap(
    [
      'id: t',
      `theme: ${theme}`,
      'time: 300',
      'start: 2,12',
      '',
      '[tiles]',
      ...Array.from({ length: 13 }, (_, y) => rows[y] ?? '.'.repeat(48)),
      '#'.repeat(48),
      '#'.repeat(48),
      '',
      '[entities]',
      ...entities,
    ].join('\n'),
  );

describe('Lost Levels: fake Bowser', () => {
  it('the axe drops the bridge Bowser and leaves a fake one standing', () => {
    // One screen at the end of the level: ground 24-25 with the fake Bowser on it (first in the
    // entity list), a bridge over lava 26-33 with the real Bowser, the axe at 37 (the player starts between them).
    const W = 40;
    const floor = (mid: string) => '#'.repeat(26) + mid.repeat(8) + '#'.repeat(W - 34);
    const castle = parseTextMap(
      [
        'id: t',
        'theme: castle',
        'time: 300',
        'start: 34,11',
        '',
        '[tiles]',
        ...Array.from({ length: 12 }, () => '.'.repeat(W)),
        '.'.repeat(26) + '-'.repeat(8) + '#'.repeat(W - 34),
        floor('~'),
        floor('~'),
        '',
        '[entities]',
        'bowser 24 11 fake=1',
        'bowser 31 11',
        'axe 37 11',
      ].join('\n'),
    );
    let fake: Bowser | undefined;
    let real: Bowser | undefined;
    let fakeY = 0;
    runSim({
      level: castle,
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
      controller: (w) => {
        const all = w.entities.filter((e): e is Bowser => e instanceof Bowser);
        fake ??= all.find((b) => b.fake);
        real ??= all.find((b) => !b.fake);
        if (fake) fakeY = toPx(fake.body.y);
        return ['right'];
      },
    });
    expect(fake?.fake).toBe(true);
    expect(real).toBeDefined();
    // The real one fell into the lava; the fake one is still standing on the floor.
    expect(toPx(real!.body.y)).toBeGreaterThan(240);
    expect(fakeY).toBeLessThan(12 * 16);
    expect(fake!.alive).toBe(true);
  });
});

describe('Lost Levels: Lakitu "Middle" end', () => {
  const flyHeight = (line: string): number => {
    let y = -1;
    runSim({
      level: level({}, [line]),
      character: MARIO,
      script: none,
      maxFrames: 200,
      assist: { invulnerable: true },
      controller: (w) => {
        const lk = w.entities.find((e): e is Lakitu => e instanceof Lakitu);
        if (lk) y = toPx(lk.body.y);
        return [];
      },
    });
    return y;
  };
  it('flies just under the HUD normally and at mid-screen with a Middle end', () => {
    expect(flyHeight('lakitu 2 0 end=40')).toBe(40);
    expect(flyHeight('lakitu 2 0 end=40 mid=1')).toBe(112);
  });
});
