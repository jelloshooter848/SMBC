import { describe, expect, it } from 'vitest';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { NES } from '@engine/gfx/palette';
import { enemiesDef, enemyPalettes } from './enemies';
import { PALETTES } from './index';
import { marioDef, marioPalettes } from './mario';

const size = (rows: readonly string[]): [number, number] => [rows[0]?.length ?? 0, rows.length];

const HERO_FRAMES: Record<string, [number, number]> = {
  'small-idle': [16, 16],
  'small-walk-0': [16, 16],
  'small-walk-1': [16, 16],
  'small-walk-2': [16, 16],
  'small-skid': [16, 16],
  'small-jump': [16, 16],
  'small-die': [16, 16],
  'small-climb-0': [16, 16],
  'small-climb-1': [16, 16],
  'small-swim-0': [16, 16],
  'small-swim-1': [16, 16],
  'small-crouch': [16, 16],
  'big-idle': [16, 32],
  'big-walk-0': [16, 32],
  'big-walk-1': [16, 32],
  'big-walk-2': [16, 32],
  'big-skid': [16, 32],
  'big-jump': [16, 32],
  'big-crouch': [16, 32],
  'big-climb-0': [16, 32],
  'big-climb-1': [16, 32],
  'big-swim-0': [16, 32],
  'big-swim-1': [16, 32],
  'big-throw': [16, 32],
  'grow-mid': [16, 32],
};

const ENEMY_FRAMES: Record<string, [number, number]> = {
  'goomba-0': [16, 16],
  'goomba-1': [16, 16],
  'goomba-squash': [16, 16],
  shell: [16, 16],
  'shell-wiggle': [16, 16],
  'piranha-0': [16, 24],
  'piranha-1': [16, 24],
  'buzzy-0': [16, 16],
  'buzzy-1': [16, 16],
  'buzzy-shell': [16, 16],
  'spiny-0': [16, 16],
  'spiny-1': [16, 16],
  'spiny-egg': [16, 16],
  bullet: [16, 16],
  'cheep-0': [16, 16],
  'cheep-1': [16, 16],
  'blooper-0': [16, 24],
  'blooper-1': [16, 24],
  'podoboo-0': [16, 16],
  'podoboo-1': [16, 16],
  'hammer-0': [16, 16],
  'hammer-1': [16, 16],
  'koopa-0': [16, 24],
  'koopa-1': [16, 24],
  'koopa-fly-0': [16, 24],
  'koopa-fly-1': [16, 24],
  'hammer-bro-0': [16, 24],
  'hammer-bro-1': [16, 24],
  'lakitu-0': [16, 24],
  'lakitu-1': [16, 24],
  'bowser-0': [32, 32],
  'bowser-1': [32, 32],
  'bowser-2': [32, 32],
  'bowser-3': [32, 32],
  'bowser-die-1': [32, 32],
  'bowser-die-2': [32, 32],
  'bowser-die-3': [32, 32],
  'bowser-die-4': [32, 32],
  'bowser-die-5': [32, 32],
  'bowser-die-6': [32, 32],
  'bowser-die-7': [32, 32],
  'bowser-die-8': [32, 32],
  // The true forms' outlines (the campaign fakes' steady tell with reduce flashing on).
  'bowser-ghost-1': [32, 32],
  'bowser-ghost-2': [32, 32],
  'bowser-ghost-3': [32, 32],
  'bowser-ghost-4': [32, 32],
  'bowser-ghost-5': [32, 32],
  'bowser-ghost-6': [32, 32],
  'bowser-ghost-7': [32, 32],
};

const HERO_PALETTES = [
  'mario',
  'mario-fire',
  'luigi',
  'luigi-fire',
  'mario-star-0',
  'mario-star-1',
  'mario-star-2',
  'mario-star-3',
];
const ENEMY_PALETTES = [
  'enemies-overworld',
  'enemies-underground',
  'enemies-castle',
  'enemies-water',
  'koopa-green',
  'koopa-red',
  'piranha-green',
  'piranha-red',
  'bowser-true-form',
];

/** The bottom row of a standing frame must carry pixels (feet on the ground). */
const standsOnBottomRow = (rows: readonly string[]): boolean => /[^.]/.test(rows[rows.length - 1] ?? '');

describe('hero sprites', () => {
  it('is a valid definition', () => {
    expect(() => validateDef('mario', marioDef)).not.toThrow();
    expect(marioDef.palette).toBe('mario');
  });

  it.each(Object.entries(HERO_FRAMES))('frame %s is %j', (name, expected) => {
    const rows = marioDef.frames[name];
    expect(rows, `missing frame ${name}`).toBeDefined();
    expect(size(rows as readonly string[])).toEqual(expected);
  });

  it('has no frames beyond the documented set', () => {
    expect(Object.keys(marioDef.frames).sort()).toEqual(Object.keys(HERO_FRAMES).sort());
  });

  it('keeps feet on the bottom row of ground poses', () => {
    for (const name of ['small-idle', 'small-walk-0', 'small-walk-1', 'small-walk-2', 'small-crouch'])
      expect(standsOnBottomRow(marioDef.frames[name] as readonly string[]), name).toBe(true);
    for (const name of ['big-idle', 'big-walk-0', 'big-walk-1', 'big-walk-2', 'big-crouch', 'grow-mid'])
      expect(standsOnBottomRow(marioDef.frames[name] as readonly string[]), name).toBe(true);
  });

  it.each(HERO_PALETTES)('rasterizes with palette %s', (name) => {
    const pal = marioPalettes[name];
    expect(pal, `missing palette ${name}`).toBeDefined();
    expect((pal as string[]).length).toBeLessThanOrEqual(12);
    expect(() => rasterizeToBuffer(marioDef, pal as string[])).not.toThrow();
  });

  it('uses the documented index roles (every suit colour appears in the idle frame)', () => {
    const idle = (marioDef.frames['small-idle'] as readonly string[]).join('');
    for (const idx of ['1', '2', '3', '4', '5']) expect(idle, `index ${idx}`).toContain(idx);
  });
});

describe('enemy sprites', () => {
  it('is a valid definition', () => {
    expect(() => validateDef('enemies', enemiesDef)).not.toThrow();
    expect(enemiesDef.palette).toBe('enemies-overworld');
  });

  it.each(Object.entries(ENEMY_FRAMES))('frame %s is %j', (name, expected) => {
    const rows = enemiesDef.frames[name];
    expect(rows, `missing frame ${name}`).toBeDefined();
    expect(size(rows as readonly string[])).toEqual(expected);
  });

  it('has no frames beyond the documented set', () => {
    expect(Object.keys(enemiesDef.frames).sort()).toEqual(Object.keys(ENEMY_FRAMES).sort());
  });

  it('bottom-aligns the squashed toadstool and the shell', () => {
    const squash = enemiesDef.frames['goomba-squash'] as readonly string[];
    expect(squash.slice(0, 8).every((r) => !/[^.]/.test(r))).toBe(true);
    expect(standsOnBottomRow(squash)).toBe(true);
    for (const name of ['shell', 'shell-wiggle']) {
      const shell = enemiesDef.frames[name] as readonly string[];
      expect(
        shell.slice(0, 2).every((r) => !/[^.]/.test(r)),
        name,
      ).toBe(true);
      expect(
        shell.slice(2).every((r) => /[^.]/.test(r)),
        name,
      ).toBe(true);
    }
  });

  it.each(ENEMY_PALETTES)('rasterizes with palette %s', (name) => {
    const pal = enemyPalettes[name];
    expect(pal, `missing palette ${name}`).toBeDefined();
    expect((pal as string[]).length).toBeLessThanOrEqual(12);
    expect(() => rasterizeToBuffer(enemiesDef, pal as string[])).not.toThrow();
  });

  it('swaps only the shell indices between green and red turtles', () => {
    const green = enemyPalettes['koopa-green'] as string[];
    const red = enemyPalettes['koopa-red'] as string[];
    green.forEach((c, i) => {
      if (i === 5 || i === 6) expect(red[i]).not.toBe(c);
      else expect(red[i]).toBe(c);
    });
    const shell = (enemiesDef.frames['koopa-0'] as readonly string[]).join('');
    expect(shell).toContain('5');
    expect(shell).toContain('6');
  });

  // SMB1 (which Crossover's die_N frames follow) swaps the beaten fake for BowserIdentities[world]
  // at its own size, where his front half was; worlds 1-3 get state $23, an overturned shell.
  it("draws the fake king's true forms at enemy size, at his head end", () => {
    for (let n = 1; n <= 7; n++) {
      const rows = enemiesDef.frames[`bowser-die-${n}`] as readonly string[];
      const ys = rows.flatMap((r, y) => (/[^.]/.test(r) ? [y] : []));
      const xs = rows.flatMap((r) => [...r].flatMap((c, x) => (c === '.' ? [] : [x])));
      // Within a 16x24 slot two columns in and eight rows down (the top 24 rows once mirrored).
      expect(Math.min(...xs), `bowser-die-${n}`).toBeGreaterThanOrEqual(2);
      expect(Math.max(...xs), `bowser-die-${n}`).toBeLessThanOrEqual(17);
      expect(Math.min(...ys), `bowser-die-${n}`).toBeGreaterThanOrEqual(8);
      expect(Math.max(...ys), `bowser-die-${n}`).toBeLessThanOrEqual(31);
    }
    // 2-4 and 3-4 are empty shells: no eye (4) in the turtle's, no legs (3) under the beetle's.
    const koopa = (enemiesDef.frames['bowser-die-2'] as readonly string[]).join('');
    expect(koopa).toContain('5');
    expect(koopa).not.toContain('4');
    expect((enemiesDef.frames['bowser-die-3'] as readonly string[]).join('')).not.toContain('3');
  });

  it('outlines the true forms in a colour that shows on the black castle background', () => {
    const castle = enemyPalettes['enemies-castle'] as string[];
    const tf = enemyPalettes['bowser-true-form'] as string[];
    expect(tf[1]).not.toBe('#000000');
    tf.forEach((c, i) => {
      if (i !== 1) expect(c, `index ${i}`).toBe(castle[i]);
    });
  });

  it('keeps the true-form outline visible in high contrast', () => {
    expect(PALETTES.highContrast?.['bowser-true-form']?.[1]).toBe(NES.gray);
  });
});
