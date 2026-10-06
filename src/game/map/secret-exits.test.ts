import { describe, expect, it } from 'vitest';
import { hasSecretExit, secretExitLevels } from './secret-exits';

describe('secretExitLevels', () => {
  const smb = () => [...secretExitLevels()].filter((id) => !id.startsWith('ll-')).sort();
  const lost = () => [...secretExitLevels()].filter((id) => id.startsWith('ll-')).sort();

  it('SMB: 1-2 (warp zone) and 4-2 (two warp zones) only', () => {
    expect(smb()).toEqual(['1-2', '4-2']);
  });

  it('Lost Levels: every level with a warp zone, in it or in one of its areas', () => {
    expect(lost()).toEqual([
      'll-1-2',
      'll-10-2',
      'll-10-3',
      'll-11-4',
      'll-3-1',
      'll-5-1',
      'll-5-2',
      'll-8-1',
    ]);
  });

  it('names main levels, never their sub-areas', () => {
    expect(hasSecretExit('1-2')).toBe(true);
    expect(hasSecretExit('4-2')).toBe(true);
    expect(hasSecretExit('1-2-intro')).toBe(false);
    expect(hasSecretExit('4-2-warp')).toBe(false);
  });

  it('pipes within a level (8-4) or to its own next level do not count', () => {
    expect(hasSecretExit('8-4')).toBe(false);
    expect(hasSecretExit('1-1')).toBe(false);
    expect(hasSecretExit('ll-8-4')).toBe(false);
    expect(hasSecretExit('nope')).toBe(false);
    expect(hasSecretExit(undefined)).toBe(false);
  });
});
