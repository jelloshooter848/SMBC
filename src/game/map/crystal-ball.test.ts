import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { WORLD_4 } from '@content/worldmap/world4';
import { CRYSTAL_BALL, heroHint, type HiddenHero } from './captives';
import { isOpen, isPathOpen, newMapProgress, pathExit, secretExit, clearLevel } from './rules';
import type { MapProgress } from './types';

// Larry Koopa's crystal ball (4-2's airship, docs/HEROES.md "Larry Koopa and the crystal ball"):
// once found, every hero not freed yet shows its silhouette by its level before that level is
// cleared, and World 4's bonus road opens as 4-2's secret exit `secret:larry`.

const luigi: HiddenHero = { hero: 'luigi', level: '1-1-bonus', main: '1-1', page: 'smb-1', node: '1-1' };

/** A file with World 4 open and 4-1 cleared (4-2 reachable). */
function w4(): MapProgress {
  const p = newMapProgress();
  p.cleared = [
    '1-0',
    '1-1',
    '1-2',
    '1-3',
    '1-4',
    '2-1',
    '2-2',
    '2-3',
    '2-4',
    '3-1',
    '3-2',
    '3-3',
    '3-4',
    '4-1',
  ];
  p.pages = ['smb-1', 'smb-2', 'smb-3', 'smb-4'];
  p.position = { page: 'smb-4', node: '4-1' };
  return p;
}

describe('the crystal ball hint (map/captives.ts)', () => {
  it('is the secret key `larry`', () => {
    expect(CRYSTAL_BALL).toBe('larry');
  });

  it('without it a hero hides until its level is cleared; with it the silhouette shows at once', () => {
    const p = newMapProgress();
    expect(heroHint(luigi, p, ['mario'])).toBe('none');
    p.secrets.push('larry');
    expect(heroHint(luigi, p, ['mario'])).toBe('silhouette');
    // A freed hero is a trophy either way.
    expect(heroHint(luigi, p, ['mario', 'luigi'])).toBe('trophy');
  });
});

describe("World 4's bonus spot (4-2's secret exit secret:larry)", () => {
  const bonus = WORLD_4.nodes.find((n) => n.id === 'bonus-4');
  const road = WORLD_4.paths.find((p) => p.to === 'bonus-4');

  it('is a bonus node keyed by larry, guarded by a Hammer Bro, its road from 4-2 the secret exit', () => {
    expect(bonus).toMatchObject({ kind: 'bonus', unlock: 'larry', guard: 'hammer-bro' });
    expect(road?.from).toBe('4-2');
    expect(road && pathExit(WORLD_4, road)).toBe('secret:larry');
  });

  it('stays hidden when 4-2 is cleared at its flagpole', () => {
    const p = w4();
    clearLevel(p, '4-2', getLevel);
    expect(isOpen(p, WORLD_4, 'bonus-4')).toBe(false);
    expect(isPathOpen(p, WORLD_4, road as NonNullable<typeof road>)).toBe(false);
  });

  it('opens with the crystal ball (from the airship, an area of 4-2), without clearing 4-2', () => {
    const p = w4();
    expect(isOpen(p, WORLD_4, '4-2')).toBe(true);
    const opened = secretExit(p, '4-2-airship', 'larry', getLevel);
    expect(opened).toEqual(['smb-4:4-2>bonus-4', 'smb-4:bonus-4']);
    expect(p.secrets).toContain('larry');
    expect(p.cleared).not.toContain('4-2');
    expect(p.position).toEqual({ page: 'smb-4', node: '4-2' });
    expect(isOpen(p, WORLD_4, 'bonus-4')).toBe(true);
    // 4-3 still waits for 4-2's flagpole.
    expect(isOpen(p, WORLD_4, '4-3')).toBe(false);
  });
});
