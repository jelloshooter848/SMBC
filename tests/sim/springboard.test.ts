import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim, ScriptedInput } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { SAMUS } from '@game/characters/samus';
import { Spring, SPRING_SQUASHED, SPRING_TALL } from '@game/entities/objects/spring';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px, toPx } from '@engine/math/units';
import type { CharacterDef } from '@game/characters/character';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';

// Springboards (com/smbc/ground/SpringRed.as, SpringGreen.as): a solid Ground two tiles tall that
// squashes to one tile while ridden, then launches at defSpringPwr (500 Flash px/s = 4.17 px/f),
// or boostSpringPwr (red 1000, green 2750 for Mario) when jump was pressed on the spring. The
// rise uses Mario's GRAVITY (1500 Flash px/s² = 0.208 px/f²): 41.7 px plain, 167 px boosted red.

const SPRING_COL = 10;

/** A flat 48-wide overworld with a spring (`s` red, `y` green) standing on the ground at column 10. */
const flat = (marker: 's' | 'y', start: [number, number]): LevelData => {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(48).split(''));
  (rows[12] as string[])[SPRING_COL] = marker;
  const l = parseTextMap(
    [
      'id: t',
      'time: 300',
      `start: ${start[0]},${start[1]}`,
      '',
      '[tiles]',
      ...rows.map((r) => r.join('')),
      '#'.repeat(48),
      '#'.repeat(48),
    ].join('\n'),
  );
  l.startMode = 'stand';
  return l;
};

type JumpInput = 'none' | 'press-on-spring' | 'held-from-above';

/** Drop the hero onto the spring and return how far its top rises above where it was at launch. */
function rise(marker: 's' | 'y', jump: JumpInput, character: CharacterDef = MARIO): number {
  let spring: Spring | undefined;
  let launchTop: number | null = null;
  let wasBusy = false;
  let minTop = Infinity;
  let pressed = false;
  runSim({
    level: flat(marker, [SPRING_COL, 6]),
    character,
    script: { steps: [{ frame: 0, hold: [] }] },
    maxFrames: 900,
    controller: (w) => {
      spring ??= w.entities.find((e): e is Spring => e instanceof Spring);
      const b = w.player.body;
      if (wasBusy && !spring?.busy && launchTop === null) launchTop = toPx(b.y);
      wasBusy = !!spring?.busy;
      if (launchTop !== null) minTop = Math.min(minTop, toPx(b.y));
      if (jump === 'held-from-above') return ['jump'];
      if (jump === 'press-on-spring' && spring?.busy && !pressed) {
        pressed = true;
        return ['jump'];
      }
      return [];
    },
    until: (w) => launchTop !== null && w.player.body.onGround,
  });
  expect(launchTop).not.toBeNull();
  return (launchTop as unknown as number) - minTop;
}

describe('springboards', () => {
  it('launch from the same spot as before: feet on top of the spring’s own map cell', () => {
    let spring: Spring | undefined;
    let launchFeet = -1;
    let wasBusy = false;
    runSim({
      level: flat('s', [SPRING_COL, 6]),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 200,
      controller: (w) => {
        spring ??= w.entities.find((e): e is Spring => e instanceof Spring);
        if (wasBusy && !spring?.busy && launchFeet < 0) launchFeet = toPx(w.player.body.y + w.player.body.h);
        wasBusy = !!spring?.busy;
        return [];
      },
      until: () => launchFeet >= 0,
    });
    // The first frame after the launch has already moved up by the launch speed (4 px).
    expect(launchFeet).toBeGreaterThanOrEqual(12 * 16 - 5);
    expect(launchFeet).toBeLessThanOrEqual(12 * 16);
  });

  it('a plain bounce rises 2.6 tiles, red and green alike', () => {
    const red = rise('s', 'none');
    expect(red).toBeGreaterThanOrEqual(40);
    expect(red).toBeLessThanOrEqual(46);
    expect(rise('y', 'none')).toBe(red);
  });

  it("the rise uses the hero's own gravity: Samus (700 Flash px/s²) bounces about 89 px", () => {
    const samus = rise('s', 'none', SAMUS);
    expect(samus).toBeGreaterThanOrEqual(85);
    expect(samus).toBeLessThanOrEqual(93);
  });

  it('jump pressed on the red spring launches at 8.33 px/f: about 167 px', () => {
    const boosted = rise('s', 'press-on-spring');
    expect(boosted).toBeGreaterThanOrEqual(160);
    expect(boosted).toBeLessThanOrEqual(172);
  });

  it('jump pressed on the green spring launches at 22.9 px/f, far off the screen', () => {
    expect(rise('y', 'press-on-spring')).toBeGreaterThan(1200);
  });

  it('jump already held when landing gives the plain bounce (only a fresh press boosts)', () => {
    expect(rise('s', 'held-from-above')).toBe(rise('s', 'none'));
    expect(rise('y', 'held-from-above')).toBe(rise('y', 'none'));
  });

  it('is two tiles tall idle and one tile squashed', () => {
    let spring: Spring | undefined;
    let minH = Infinity;
    let idleH = 0;
    runSim({
      level: flat('s', [SPRING_COL, 6]),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 120,
      controller: (w) => {
        spring ??= w.entities.find((e): e is Spring => e instanceof Spring);
        if (spring) {
          if (!idleH) idleH = toPx(spring.body.h);
          minH = Math.min(minH, spring.height);
          // The box always stands on the bottom of its map cell.
          expect(toPx(spring.body.y + spring.body.h)).toBe(13 * 16);
        }
        return [];
      },
    });
    expect(idleH).toBe(SPRING_TALL);
    expect(minH).toBe(SPRING_SQUASHED);
  });

  it('is solid from the side: walking into it stops Mario, who never gets past or bounces', () => {
    let spring: Spring | undefined;
    let maxRight = -Infinity;
    let rode = false;
    const r = runSim({
      level: flat('s', [SPRING_COL - 5, 12]),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: ['right'] }] },
      maxFrames: 180,
      controller: (w) => {
        spring ??= w.entities.find((e): e is Spring => e instanceof Spring);
        if (spring?.busy) rode = true;
        const b = w.player.body;
        maxRight = Math.max(maxRight, toPx(b.x + b.w));
        return ['right'];
      },
    });
    expect(rode).toBe(false);
    expect(maxRight).toBe(SPRING_COL * 16);
    const b = r.world.player.body;
    expect(toPx(b.y + b.h)).toBe(13 * 16); // still on the ground
  });

  it('a one-tile hop beside it does not get Mario on top; he stays at its side', () => {
    let spring: Spring | undefined;
    let rode = false;
    let maxRight = -Infinity;
    runSim({
      level: flat('s', [SPRING_COL - 2, 12]),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 120,
      controller: (w, f) => {
        spring ??= w.entities.find((e): e is Spring => e instanceof Spring);
        if (spring?.busy) rode = true;
        const b = w.player.body;
        maxRight = Math.max(maxRight, toPx(b.x + b.w));
        // A short tap: small Mario rises a little over a tile, holding right into the spring.
        return f < 3 ? ['jump', 'right'] : ['right'];
      },
    });
    expect(rode).toBe(false);
    expect(maxRight).toBe(SPRING_COL * 16);
  });

  it('co-op: a spring in use belongs to its rider; the other player is not frozen and cannot boost it', () => {
    const world = new World(
      flat('s', [2, 12]),
      {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST },
        reduceFlashing: true,
      },
      newGameState(MARIO, MARIO),
    );
    const [p1, p2] = world.players as [typeof world.player, typeof world.player];
    // Both above the spring: P1 just over its top, P2 40 px higher (still over it while P1 rides).
    for (const [p, top] of [
      [p1, 5 * 16],
      [p2, 3 * 16],
    ] as const) {
      p.body.x = px(SPRING_COL * 16 + 2);
      p.body.y = px(top);
      p.body.vy = 0;
    }
    const riding = (): boolean => world.entities.some((e) => e instanceof Spring && e.ridBy(p1));
    const a = new ScriptedInput({ steps: [] });
    const b = new ScriptedInput({ steps: [] });
    let busyFrames = 0;
    let p2Moved = false;
    let launchTop: number | null = null;
    let minTop = Infinity;
    let pressed = false;
    for (let f = 0; f < 200 && !(launchTop !== null && p1.body.onGround); f++) {
      const p2Input: Action[] = [];
      if (riding() && !pressed) {
        pressed = true; // P2 presses jump while P1 is on the spring
        p2Input.push('jump');
      }
      a.setHeld([]);
      b.setHeld(p2Input);
      a.next();
      b.next();
      const p2Before = p2.body.y;
      const wasRiding = riding();
      world.update([a, b]);
      if (riding() && launchTop === null) {
        busyFrames++;
        if (p2.body.y !== p2Before) p2Moved = true;
      }
      if (wasRiding && !riding() && launchTop === null) launchTop = toPx(p1.body.y);
      if (launchTop !== null) minTop = Math.min(minTop, toPx(p1.body.y));
    }
    expect(pressed).toBe(true);
    // Landing frame plus 8 squashing frames, launched on the next: not twice as fast.
    expect(busyFrames).toBe(9);
    expect(p2Moved).toBe(true);
    // P1 got the plain bounce (about 42 px), not P2's boost (about 167 px).
    expect((launchTop as unknown as number) - minTop).toBeLessThanOrEqual(46);
  });
});
