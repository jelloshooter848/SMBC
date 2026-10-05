import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Spring } from '@game/entities/objects/spring';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { Blooper } from '@game/entities/enemies/blooper';
import { toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** A 48-wide flat overworld: `marks` puts single characters on the air rows (col, row, ch). */
const flat = (marks: [number, number, string][] = [], entities: string[] = []): LevelData => {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(48).split(''));
  for (const [x, y, ch] of marks) (rows[y] as string[])[x] = ch;
  return parseTextMap(
    [
      'id: t',
      'time: 300',
      'start: 2,12',
      '',
      '[tiles]',
      ...rows.map((r) => r.join('')),
      '#'.repeat(48),
      '#'.repeat(48),
      '',
      '[entities]',
      ...entities,
    ].join('\n'),
  );
};

describe('Lost Levels: green springboard', () => {
  /** Drop onto a spring at column 6 and return the apex: px of the feet above the plate top. */
  const apex = (marker: 's' | 'y', hold: boolean): number => {
    const l = flat([[6, 12, marker]]);
    l.start = { x: 6, y: 9 };
    l.startMode = 'stand';
    let launched = false;
    let minFeet = Infinity;
    let finite = true;
    const r = runSim({
      level: l,
      character: MARIO,
      script: none,
      maxFrames: 900,
      controller: (w) => {
        const spring = w.entities.find((e): e is Spring => e instanceof Spring);
        if (spring?.busy) launched = true;
        const b = w.player.body;
        if (!Number.isFinite(b.y)) finite = false;
        if (launched) minFeet = Math.min(minFeet, toPx(b.y + b.h));
        return hold && launched ? ['jump'] : [];
      },
      until: (w, f) => launched && f > 60 && w.player.body.onGround,
    });
    expect(launched).toBe(true);
    expect(finite).toBe(true);
    expect(r.outcome).toBe('stopped'); // came back down and landed (no death above the screen)
    return 12 * 16 - minFeet;
  };

  it('parses the y marker as a green spring', () => {
    const l = flat([[6, 12, 'y']]);
    expect(l.entities).toContainEqual({ type: 'spring-green', x: 6, y: 12 });
  });

  it('launches much higher than the red one, well off the top of the screen', () => {
    const red = apex('s', false);
    const redHeld = apex('s', true);
    const green = apex('y', false);
    const greenHeld = apex('y', true);
    expect(green).toBeGreaterThan(redHeld);
    expect(greenHeld).toBeGreaterThan(redHeld * 3);
    expect(greenHeld).toBeGreaterThanOrEqual(10 * 16);
    expect(12 * 16 - greenHeld).toBeLessThan(0); // the feet leave the top of the screen
    expect(red).toBeGreaterThan(0);
  });
});

describe('Lost Levels: chasing Hammer Bro', () => {
  const track = (marker: 'h' | 'n'): { start: number; end: number; bro: HammerBro } => {
    let bro: HammerBro | undefined;
    let start = NaN;
    runSim({
      level: flat([[14, 12, marker]]),
      character: MARIO,
      script: none,
      maxFrames: 60,
      assist: { invulnerable: true },
      controller: (w) => {
        if (!bro) {
          bro = w.entities.find((e): e is HammerBro => e instanceof HammerBro);
          if (bro) start = toPx(bro.body.x);
        }
        return [];
      },
    });
    expect(bro).toBeDefined();
    return { start, end: toPx((bro as HammerBro).body.x), bro: bro as HammerBro };
  };

  it('parses the n marker as a chasing Hammer Bro', () => {
    expect(flat([[14, 12, 'n']]).entities).toContainEqual({ type: 'hammer-bro-chase', x: 14, y: 12 });
  });

  it('walks toward the player within the first 60 frames', () => {
    const chase = track('n');
    expect(chase.bro.chase).toBe(true);
    expect(chase.start - chase.end).toBeGreaterThanOrEqual(20);
    // A normal one only shuffles around its home spot.
    const plain = track('h');
    expect(Math.abs(plain.start - plain.end)).toBeLessThan(20);
  });
});

describe('Lost Levels: Blooper out of water', () => {
  it('swims in the air with a finite y between the HUD line and the floor for 600 frames', () => {
    let bl: Blooper | undefined;
    let ok = true;
    let minY = Infinity;
    let maxY = -Infinity;
    const r = runSim({
      level: flat([], ['blooper 10 6']),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
      controller: (w) => {
        bl ??= w.entities.find((e): e is Blooper => e instanceof Blooper);
        if (bl?.alive) {
          const b = bl.body;
          const y = toPx(b.y);
          if (!Number.isFinite(b.y) || y < 32 || y + toPx(b.h) > 13 * 16) ok = false;
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        return [];
      },
    });
    expect(bl).toBeDefined();
    expect(r.world.waterTop).toBe(Infinity); // not a water level
    expect(ok).toBe(true);
    // It still swims up and down instead of being pinned to the floor.
    expect(maxY - minY).toBeGreaterThan(24);
    expect(minY).toBeLessThan(13 * 16 - 20 - 32);
  });
});
