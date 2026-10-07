import { describe, expect, it } from 'vitest';
import type { HiddenHero } from '@game/map/captives';
import type { MapProgress } from '@game/map/types';
import { beat, seedSeen, storyOn } from './beats';

const game = (over: Partial<Parameters<typeof storyOn>[0]> = {}) => ({
  campaign: { slot: 1 },
  inRound: false,
  stageRound: null,
  playtestDone: null,
  ...over,
});

describe('storyOn', () => {
  it('is on only in campaign play', () => {
    expect(storyOn(game())).toBe(true);
    expect(storyOn(game({ campaign: null }))).toBe(false);
  });
  it('is off in an arena / dev round and in an editor play-test', () => {
    expect(storyOn(game({ inRound: true }))).toBe(false);
    expect(storyOn(game({ stageRound: { base: null, done: () => {} } }))).toBe(false);
    expect(storyOn(game({ playtestDone: () => {} }))).toBe(false);
  });
});

describe('beat ids', () => {
  it('are the saved strings', () => {
    expect(beat.enter('smb-3')).toBe('enter:smb-3');
    expect(beat.missed('link')).toBe('missed:link');
    expect(beat.joined()).toBe('joined');
    expect(beat.joined('luigi')).toBe('joined:luigi');
    expect(beat.restyle('2-1')).toBe('restyle:2-1');
    expect([beat.allFreed, beat.fakes, beat.crash, beat.rift, beat.bowser84, beat.hub, beat.arena]).toEqual([
      'all-freed',
      'fakes',
      'crash',
      'rift',
      'bowser-8-4',
      'hub',
      'arena',
    ]);
  });
});

const HEROES: HiddenHero[] = [
  { hero: 'luigi', level: '1-1-bonus', main: '1-1', page: 'smb-1', node: '1-1' },
  { hero: 'link', level: '2-1-sky2', main: '2-1', page: 'smb-2', node: '2-1' },
];
const progress = (over: Partial<MapProgress> = {}): MapProgress => ({
  cleared: [],
  pages: ['smb-1'],
  secrets: [],
  position: { page: 'smb-1', node: 'start' },
  ...over,
});

describe('seedSeen', () => {
  it('a new file has seen nothing (World 1 waits for 1-0)', () => {
    expect(seedSeen(progress(), ['mario'], HEROES)).toEqual([]);
  });

  it('enters every open SMB page, World 1 once 1-0 is cleared', () => {
    const seen = seedSeen(
      progress({ cleared: ['1-0'], pages: ['smb-1', 'smb-3', 'll-1'] }),
      ['mario'],
      HEROES,
    );
    expect(seen).toContain('enter:smb-1');
    expect(seen).toContain('enter:smb-3');
    expect(seen.some((id) => id.includes('ll-1'))).toBe(false);
  });

  it('fakes after 1-4, restyles for cleared levels', () => {
    const seen = seedSeen(progress({ cleared: ['1-0', '1-4', '2-1'] }), ['mario'], HEROES);
    expect(seen).toContain('fakes');
    expect(seen).toContain('restyle:2-1');
    expect(seedSeen(progress({ cleared: ['1-0'] }), ['mario'], HEROES)).not.toContain('fakes');
  });

  it('joined for freed heroes other than Mario; missed for silhouettes', () => {
    const seen = seedSeen(progress({ cleared: ['1-0', '1-1', '2-1'] }), ['mario', 'luigi'], HEROES);
    expect(seen).toContain('joined');
    expect(seen).toContain('joined:luigi');
    expect(seen).not.toContain('joined:mario');
    expect(seen).toContain('missed:link'); // 2-1 cleared, Link not freed: his shadow shows
    expect(seen).not.toContain('missed:luigi'); // freed: a trophy, not a shadow
    expect(seen).not.toContain('all-freed');
    expect(seedSeen(progress({ cleared: ['1-0'] }), ['mario'], HEROES)).not.toContain('joined');
  });

  it('the crystal ball: crash, and every shadow shows', () => {
    const seen = seedSeen(progress({ secrets: ['larry'] }), ['mario'], HEROES);
    expect(seen).toContain('crash');
    expect(seen).toContain('missed:luigi');
    expect(seen).toContain('missed:link');
  });

  it('all-freed when every hidden hero is freed', () => {
    expect(seedSeen(progress(), ['mario', 'luigi', 'link'], HEROES)).toContain('all-freed');
    expect(seedSeen(progress(), ['mario'], [])).not.toContain('all-freed');
  });

  it('rift and bowser-8-4 once 8-4 is beaten', () => {
    for (const p of [progress({ gameCleared: true }), progress({ cleared: ['8-4'] })]) {
      expect(seedSeen(p, ['mario'], HEROES)).toEqual(expect.arrayContaining(['rift', 'bowser-8-4']));
    }
    expect(seedSeen(progress({ cleared: ['8-3'] }), ['mario'], HEROES)).not.toContain('rift');
  });

  it('hub and arena when their pages are open', () => {
    const seen = seedSeen(progress({ pages: ['smb-1', 'hub', 'arena'] }), ['mario'], HEROES);
    expect(seen).toContain('hub');
    expect(seen).toContain('arena');
  });

  it('lists each beat once', () => {
    const seen = seedSeen(progress({ cleared: ['1-0', '1-0', '8-4'], gameCleared: true }), ['mario'], HEROES);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('uses the bundled captives by default', () => {
    expect(seedSeen(progress({ secrets: ['larry'] }), ['mario'])).toContain('missed:luigi');
  });
});
