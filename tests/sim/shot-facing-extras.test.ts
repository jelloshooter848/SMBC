import { describe, expect, it } from 'vitest';
import { SPRITES } from '@content/sprites';
import { BASS_BUSTER } from '@game/characters/bass/classic-weapons';

/*
 * Shots fly head first (0.4.57) for the Classic-only heroes. Bass's buster is a diamond: mirror
 * symmetric, so it reads the same fired either way and needs no head/tail check.
 */

const mirror = (rows: readonly string[]): string[] => rows.map((r) => [...r].reverse().join(''));

describe('Classic-only heroes: shots fly head first', () => {
  it("Bass's buster is left/right symmetric, so it leads the same fired right or left", () => {
    for (const f of BASS_BUSTER.frames) {
      const rows = SPRITES[BASS_BUSTER.sheet]?.frames[f] as string[] | undefined;
      expect(rows, f).toBeDefined();
      expect(mirror(rows as string[]), f).toEqual(rows);
    }
  });
});
