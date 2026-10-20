import { describe, expect, it } from 'vitest';
import { urlLevelStart } from '@game/dev-url';

// G-020 (0.5.0, #181): a `?level=` link to a Special level starts a Classic Special run outside
// dev mode, as SMB and Lost Levels links do.

const start = (level: string, dev = false) => urlLevelStart(new URLSearchParams({ level }), dev);

describe('?level= links to Special', () => {
  it('start a Classic run there with dev mode off, from sp-1-1 to sp-8-4', () => {
    for (const id of ['sp-1-1', 'sp-4-2', 'sp-8-4']) expect(start(id), id).toBe('classic');
    // As SMB and Lost Levels links do.
    expect(start('4-2')).toBe('classic');
    expect(start('ll-13-4')).toBe('classic');
  });

  it('not past the set, nor its inner areas (a run starts at a level)', () => {
    for (const id of ['sp-9-1', 'sp-0-1', 'sp-1-5', 'sp-1-1-bonus', 'sp-4-3-bonus'])
      expect(start(id), id).toBeNull();
  });

  it('with dev mode on, any level is free play as before', () => {
    expect(start('sp-4-3-bonus', true)).toBe('free');
  });
});
