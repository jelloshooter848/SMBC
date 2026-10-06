import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { HIDE_RADIUS_GREEN, HIDE_RADIUS_RED, Piranha, piranhaPalette } from '@game/entities/enemies/piranha';
import { Corpse } from '@game/entities/effects/effects';
import { enemyPalettes, enemiesDef } from '@content/sprites/enemies';
import { NES, hexToRgb } from '@engine/gfx/palette';
import { px, toPx } from '@engine/math/units';
import type { View } from '@game/entities/entity';
import type { LevelData, Theme } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

// Red and green Piranha Plants (src/com/smbc/enemies/PiranhaGreen.as, PiranhaRed.as). The red
// one only overrides setStats to narrow the "player too close" band from ±2 tiles to ±1.4
// tiles around the pipe's centre (32 / 22.4 px here); timings, speed and height are shared.

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const PIPE = 20; // pipe columns 20-21, centre at x = 336
const CENTRE = (PIPE + 1) * 16;

/** A 48-wide level: an upright pipe at 20-21 (top row 11) or one hanging from the ceiling. */
const level = (entity: string, theme = 'overworld'): LevelData => {
  const hanging = entity.startsWith('piranha-down');
  const rows = Array.from({ length: 13 }, (_, y) => {
    const row = (hanging && y < 2 ? '#' : '.').repeat(48).split('');
    if (!hanging && y === 11) row.splice(PIPE, 2, '[', ']');
    if (!hanging && y === 12) row.splice(PIPE, 2, '{', '}');
    if (hanging && y >= 2 && y <= 6) row.splice(PIPE, 2, '{', '}');
    if (hanging && y === 7) row.splice(PIPE, 2, 'D', 'G');
    return row.join('');
  });
  return parseTextMap(
    [
      'id: t',
      `theme: ${theme}`,
      'time: 300',
      'start: 2,12',
      '',
      '[tiles]',
      ...rows,
      '#'.repeat(48),
      '#'.repeat(48),
      '',
      '[entities]',
      entity,
    ].join('\n'),
  );
};

const plant = (w: World): Piranha | undefined => w.entities.find((e): e is Piranha => e instanceof Piranha);

/** Keep the player standing on the ground with its centre `d` px left of the pipe's centre. */
function holdAt(w: World, d: number): void {
  const b = w.player.body;
  b.x = px(CENTRE - d) - b.w / 2;
  b.y = px(13 * 16) - b.h;
  b.vx = 0;
  b.vy = 0;
}

/** Highest the plant got (px out of its pipe) over 400 frames with the player held `d` px away. */
function maxOut(entity: string, d: number): number {
  let max = 0;
  const r = runSim({
    level: level(entity),
    character: MARIO,
    script: none,
    maxFrames: 400,
    controller: (w) => {
      holdAt(w, d);
      const p = plant(w);
      if (p) max = Math.max(max, toPx(p.body.h));
      return [];
    },
  });
  expect(plant(r.world)).toBeDefined();
  return max;
}

describe('red piranha plants come out with the player closer than green ones', () => {
  it('uses the original radii: ±2 tiles green, ±1.4 tiles red', () => {
    expect(HIDE_RADIUS_GREEN).toBe(px(32));
    expect(toPx(HIDE_RADIUS_RED)).toBe(22); // 22.4 px
    expect(HIDE_RADIUS_RED).toBeGreaterThan(px(22));
    expect(HIDE_RADIUS_RED).toBeLessThan(px(23));
  });

  it('spawns red from red=1 and green otherwise', () => {
    for (const [line, red, hanging] of [
      [`piranha ${PIPE} 11`, false, false],
      [`piranha ${PIPE} 11 red=1`, true, false],
      [`piranha-down ${PIPE} 7`, false, true],
      [`piranha-down ${PIPE} 7 red=1`, true, true],
    ] as const) {
      let p: Piranha | undefined;
      runSim({
        level: level(line),
        character: MARIO,
        script: none,
        maxFrames: 60,
        controller: (w) => {
          holdAt(w, 60); // plants spawn as the camera reaches them
          p ??= plant(w);
          return [];
        },
      });
      expect(p?.red, line).toBe(red);
      expect(p?.hanging, line).toBe(hanging);
    }
  });

  it('27 px from an upright pipe: the green plant stays in, the red one comes out', () => {
    expect(maxOut(`piranha ${PIPE} 11`, 27)).toBe(0);
    expect(maxOut(`piranha ${PIPE} 11 red=1`, 27)).toBe(24);
  });

  it('31 px away the green one still hides; at 33 px it comes out too', () => {
    expect(maxOut(`piranha ${PIPE} 11`, 31)).toBe(0);
    expect(maxOut(`piranha ${PIPE} 11`, 33)).toBe(24);
  });

  it('20 px away (inside ±1.4 tiles) both stay in', () => {
    expect(maxOut(`piranha ${PIPE} 11`, 20)).toBe(0);
    expect(maxOut(`piranha ${PIPE} 11 red=1`, 20)).toBe(0);
  });

  it('hanging plants use the same radii', () => {
    expect(maxOut(`piranha-down ${PIPE} 7`, 27)).toBe(0);
    expect(maxOut(`piranha-down ${PIPE} 7 red=1`, 27)).toBe(24);
    expect(maxOut(`piranha-down ${PIPE} 7 red=1`, 20)).toBe(0);
  });

  it('an upright red plant stays in while the player is over its pipe, even outside the radius', () => {
    let checked = false;
    runSim({
      level: level(`piranha ${PIPE} 11 red=1`),
      character: MARIO,
      script: none,
      maxFrames: 60,
      controller: (w) => {
        const p = plant(w);
        if (!p || checked) {
          holdAt(w, 60);
          return [];
        }
        const b = w.player.body;
        const w0 = b.w;
        b.w = px(20); // a wide hero: centre 24 px out, still overlapping the pipe's edge
        b.x = px(CENTRE + 24) - b.w / 2;
        b.y = px(11 * 16) - b.h; // feet on the pipe's top
        expect(p.playerBlocks(w)).toBe(true);
        b.y = px(13 * 16) - b.h; // same column, down on the ground beside the pipe
        expect(p.playerBlocks(w)).toBe(false);
        b.w = w0;
        checked = true;
        return [];
      },
    });
    expect(checked).toBe(true);
  });
});

describe('piranha plant colours', () => {
  const view = (theme: Theme) => ({ theme }) as unknown as View;
  const themes: Theme[] = ['overworld', 'underground', 'castle', 'water', 'night', 'treetop', 'snow'];

  it('picks the red or green palette in every theme', () => {
    const red = new Piranha(3, 11, false, true);
    const green = new Piranha(3, 11);
    const hangingRed = new Piranha(3, 7, true, true);
    for (const t of themes) {
      expect(red.palette(view(t))).toBe('piranha-red');
      expect(hangingRed.palette(view(t))).toBe('piranha-red');
      expect(green.palette(view(t))).toBe('piranha-green');
    }
    expect(piranhaPalette(true)).toBe('piranha-red');
    expect(piranhaPalette(false)).toBe('piranha-green');
  });

  it('the two palettes differ only in the head colour (index 7): red vs green', () => {
    const red = enemyPalettes['piranha-red'] as string[];
    const green = enemyPalettes['piranha-green'] as string[];
    red.forEach((c, i) => (i === 7 ? expect(green[i]).not.toBe(c) : expect(green[i]).toBe(c)));
    const [r, g, b] = hexToRgb(red[7] as string);
    expect(r).toBeGreaterThan(g * 2);
    expect(r).toBeGreaterThan(b * 2);
    expect(green[7]).toBe(NES.green);
    // The plant's head is drawn with index 7 and nothing else in the frame uses it but the head.
    for (const f of ['piranha-0', 'piranha-1'])
      expect((enemiesDef.frames[f] as string[]).join('')).toContain('7');
  });

  it('a red plant knocked out by a fireball leaves a red corpse', () => {
    let corpse: Corpse | undefined;
    runSim({
      level: level(`piranha ${PIPE} 11 red=1`, 'underground'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      controller: (w) => {
        holdAt(w, 60);
        const p = plant(w);
        if (p?.alive && toPx(p.body.h) >= 24) p.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, w);
        corpse ??= w.entities.find((e): e is Corpse => e instanceof Corpse);
        return [];
      },
    });
    expect(corpse).toBeDefined();
    expect(corpse?.palette).toBe('piranha-red');
  });
});

describe('piranha plant timing (PiranhaGreen.as)', () => {
  /** Frames (from the plant's spawn) at which it first shows and first is fully out. */
  const timing = (entity: string): { first: number; full: number } => {
    let spawned = -1;
    let first = -1;
    let full = -1;
    runSim({
      level: level(entity),
      character: MARIO,
      script: none,
      maxFrames: 200,
      controller: (w, f) => {
        holdAt(w, 100);
        const p = plant(w);
        if (p && spawned < 0) spawned = f;
        if (p && first < 0 && toPx(p.body.h) > 0) first = f - spawned;
        if (p && full < 0 && toPx(p.body.h) >= 24) full = f - spawned;
        return [];
      },
    });
    return { first, full };
  };

  it('rises as soon as it appears (readyToRise starts true; WAIT_TMR only runs between moves)', () => {
    for (const e of [`piranha ${PIPE} 11`, `piranha-down ${PIPE} 7`]) {
      const { first } = timing(e);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(2);
    }
  });

  it('rises at 75 Flash px/s = 0.625 px a frame: 24 px in about 38 frames', () => {
    const { first, full } = timing(`piranha ${PIPE} 11`);
    expect(full - first).toBeGreaterThanOrEqual(36);
    expect(full - first).toBeLessThanOrEqual(39);
  });
});
