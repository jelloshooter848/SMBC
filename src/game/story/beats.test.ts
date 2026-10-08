import { describe, expect, it } from 'vitest';
import type { MapProgress } from '@game/map/types';
import { beat, seedSeen, STORY_REV, storyOn, upgradeStory } from './beats';

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
  it('the removed beats are gone (0.4.23, docs/STORY.md 2.14)', () => {
    for (const k of ['missed', 'joined', 'restyle', 'allFreed', 'enterHero'])
      expect(k in beat, k).toBe(false);
  });

  it('are the saved strings', () => {
    expect(beat.enter('smb-3')).toBe('enter:smb-3');
    expect([beat.opening, beat.spell, beat.luigiRuns]).toEqual(['opening', 'spell', 'luigi-runs']);
    expect([beat.fakes, beat.crash, beat.rift, beat.bowser84, beat.hub, beat.arena]).toEqual([
      'fakes',
      'crash',
      'rift',
      'bowser-8-4',
      'hub',
      'arena',
    ]);
  });
});

const progress = (over: Partial<MapProgress> = {}): MapProgress => ({
  cleared: [],
  pages: ['smb-1'],
  secrets: [],
  position: { page: 'smb-1', node: 'start' },
  ...over,
});

describe('seedSeen', () => {
  it('a new file has seen nothing (World 1 waits for 1-0)', () => {
    expect(seedSeen(progress(), ['mario'])).toEqual([]);
  });

  it('enters every open SMB page, World 1 once 1-0 is cleared', () => {
    const seen = seedSeen(progress({ cleared: ['1-0'], pages: ['smb-1', 'smb-3', 'll-1'] }), ['mario']);
    expect(seen).toContain('enter:smb-1');
    expect(seen).toContain('enter:smb-3');
    expect(seen.some((id) => id.includes('ll-1'))).toBe(false);
  });

  it('fakes after 1-4; crash with the crystal ball', () => {
    expect(seedSeen(progress({ cleared: ['1-0', '1-4'] }), ['mario'])).toContain('fakes');
    expect(seedSeen(progress({ cleared: ['1-0'] }), ['mario'])).not.toContain('fakes');
    expect(seedSeen(progress({ secrets: ['larry'] }), ['mario'])).toContain('crash');
  });

  it('no removed beats (restyles, joined, missed, all-freed)', () => {
    const seen = seedSeen(progress({ cleared: ['1-0', '1-1', '2-1'], secrets: ['larry'] }), [
      'mario',
      'luigi',
      'link',
    ]);
    expect(seen.filter((id) => /^(restyle|joined|missed|all-freed)/.test(id))).toEqual([]);
  });

  it('the opening and the spell once the file has played on (1-0 cleared)', () => {
    expect(seedSeen(progress(), ['mario'])).not.toContain('opening');
    const seen = seedSeen(progress({ cleared: ['1-0'] }), ['mario']);
    expect(seen).toEqual(expect.arrayContaining(['opening', 'spell']));
  });

  it("Luigi's run in 1-1 once 1-1 is cleared or Luigi is freed", () => {
    expect(seedSeen(progress({ cleared: ['1-0'] }), ['mario'])).not.toContain('luigi-runs');
    expect(seedSeen(progress({ cleared: ['1-0', '1-1'] }), ['mario'])).toContain('luigi-runs');
    expect(seedSeen(progress({ cleared: ['1-0'] }), ['mario', 'luigi'])).toContain('luigi-runs');
  });

  it('rift and bowser-8-4 once 8-4 is beaten', () => {
    for (const p of [progress({ gameCleared: true }), progress({ cleared: ['8-4'] })]) {
      expect(seedSeen(p, ['mario'])).toEqual(expect.arrayContaining(['rift', 'bowser-8-4']));
    }
    expect(seedSeen(progress({ cleared: ['8-3'] }), ['mario'])).not.toContain('rift');
  });

  it('hub and arena when their pages are open', () => {
    const seen = seedSeen(progress({ pages: ['smb-1', 'hub', 'arena'] }), ['mario']);
    expect(seen).toContain('hub');
    expect(seen).toContain('arena');
  });

  it('lists each beat once', () => {
    const seen = seedSeen(progress({ cleared: ['1-0', '1-0', '8-4'], gameCleared: true }), ['mario']);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('upgradeStory (files from before 0.4.23)', () => {
  it('a new file (no list): what seedSeen gives, and the mark', () => {
    expect(upgradeStory(undefined, progress(), ['mario'])).toEqual([STORY_REV]);
  });

  it("an older file's list keeps its own beats; only the new ones whose trigger is past are added", () => {
    const p = progress({ cleared: ['1-0', '1-4'], pages: ['smb-1', 'smb-2'] });
    // S3's beats past on it too (seedSeenS3, run from seedNew): World 1's gate and seal, 1-4's
    // remark, World 2's welcome.
    expect(upgradeStory([], p, ['mario'])).toEqual([
      'opening',
      'spell',
      'gate:smb-1',
      'sealed:smb-1',
      'remark:1-4',
      'welcome:smb-2',
      STORY_REV,
    ]);
  });

  it("an older file's list: the new beats whose trigger is past are added, once", () => {
    const p = progress({ cleared: ['1-0', '1-1', '1-2'], pages: ['smb-1'] });
    const up = upgradeStory(['enter:smb-1', 'joined'], p, ['mario', 'luigi']);
    expect(up).toEqual(
      expect.arrayContaining(['enter:smb-1', 'joined', 'opening', 'spell', 'luigi-runs', STORY_REV]),
    );
    expect(new Set(up).size).toBe(up.length);
  });

  it('a file already upgraded is left as it is (a beat not seen yet stays unseen)', () => {
    const story = [STORY_REV, 'enter:smb-1'];
    expect(upgradeStory(story, progress({ cleared: ['1-0', '1-1'] }), ['mario'])).toEqual(story);
  });

  it('an older file that never played 1-0 still gets the opening', () => {
    expect(upgradeStory([], progress(), ['mario'])).toEqual([STORY_REV]);
  });
});
