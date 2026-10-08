import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { MAP_PAGES, mapPage } from '@content/worldmap';
import { hiddenHeroes } from './captives';
import {
  clearLevel,
  exitId,
  isExitOpen,
  isPageOpen,
  newMapProgress,
  nextStep,
  openMetExits,
  revealId,
  sealStands,
} from './rules';
import type { MapProgress, WorldMapPage } from './types';

// The world gates (docs/STORY.md 2.3b, 2.12; campaign only): World N's road on opens only when
// N-4 is cleared AND World N's hero is freed. A file without a freed list (classic play, the
// older tests) keeps today's roads, and a world a file has already reached stays open.

const page = (id: string): WorldMapPage => mapPage(id) as WorldMapPage;
const SMB = MAP_PAGES.filter((p) => p.group === 'smb');

/** A campaign file with worlds 1..`world` open and everything up to `upTo` cleared. */
function file(world: number, cleared: string[], freed: string[] = ['mario']): MapProgress {
  const p = newMapProgress();
  p.pages = SMB.slice(0, world).map((x) => x.id);
  p.cleared = cleared.slice();
  p.freed = freed.slice();
  return p;
}

const world1 = ['1-0', '1-1', '1-2', '1-3'];

describe('the world gates (map/rules.ts)', () => {
  it("every SMB world's road on waits for the hero hidden in that world", () => {
    for (const p of SMB) {
      const e = p.exits[0];
      const hidden = hiddenHeroes().filter((h) => h.page === p.id);
      expect(hidden.length, p.id).toBe(1);
      expect(e?.gate, p.id).toBe(hidden[0]?.hero);
    }
  });

  it('a castle cleared with its hero still captive opens nothing: the seal stands', () => {
    const p = file(1, world1);
    const opened = clearLevel(p, '1-4', getLevel);
    expect(p.pages).toEqual(['smb-1']);
    expect(opened).not.toContain(revealId('smb-1', '1-4>smb-2'));
    const w1 = page('smb-1');
    const e = w1.exits[0] as NonNullable<(typeof w1.exits)[0]>;
    expect(isExitOpen(p, w1, e)).toBe(false);
    expect(sealStands(p, w1, e)).toBe(true);
    // The road is not walkable either.
    expect(nextStep(w1, p, '1-4', 'right')).toBeNull();
  });

  it('freeing the hero afterwards opens the road the next time the map shows (openMetExits)', () => {
    const p = file(1, [...world1, '1-4']);
    expect(openMetExits(p)).toEqual([]);
    p.freed = [...(p.freed ?? []), 'luigi'];
    const opened = openMetExits(p);
    expect(opened[0]).toBe(revealId('smb-1', exitId(page('smb-1').exits[0] as never)));
    expect(p.pages).toContain('smb-2');
    expect(sealStands(p, page('smb-1'), page('smb-1').exits[0] as never)).toBe(false);
  });

  it('a hero freed before the castle: the castle clear opens the road as before', () => {
    const p = file(1, world1, ['mario', 'luigi']);
    const opened = clearLevel(p, '1-4', getLevel);
    expect(p.pages).toContain('smb-2');
    expect(opened).toContain(revealId('smb-1', '1-4>smb-2'));
  });

  it('no seal before the castle is cleared (the road is simply not open yet)', () => {
    const p = file(1, world1);
    expect(sealStands(p, page('smb-1'), page('smb-1').exits[0] as never)).toBe(false);
  });

  it('an older file keeps every world it has reached, with its road (no seal there)', () => {
    const p = file(3, [...world1, '1-4', '2-1', '2-2', '2-3', '2-4']);
    for (const id of ['smb-1', 'smb-2']) {
      const w = page(id);
      const e = w.exits[0] as never;
      expect(isExitOpen(p, w, e), id).toBe(true);
      expect(sealStands(p, w, e), id).toBe(false);
    }
    expect(isPageOpen(p, 'smb-3')).toBe(true);
  });

  it('a file without a freed list (classic play, older tests) has no gates', () => {
    const p = file(1, world1);
    delete p.freed;
    clearLevel(p, '1-4', getLevel);
    expect(p.pages).toContain('smb-2');
  });

  it('Unlock all keeps every road', () => {
    const p = file(1, world1);
    const w1 = page('smb-1');
    expect(isExitOpen(p, w1, w1.exits[0] as never, true)).toBe(true);
  });

  it("World 8's road on to Lost World 1 (the rift) waits for Sophia III too", () => {
    const p = file(8, [...world1, '1-4']);
    p.gameCleared = true;
    const w8 = page('smb-8');
    const e = w8.exits[0] as NonNullable<(typeof w8.exits)[0]>;
    expect(e.gate).toBe('sophia');
    clearLevel(p, '8-4', getLevel);
    expect(p.pages).not.toContain('ll-1');
    expect(sealStands(p, w8, e)).toBe(true);
    p.freed = [...(p.freed ?? []), 'sophia'];
    expect(openMetExits(p)).toContain(revealId('smb-8', exitId(e)));
    expect(p.pages).toContain('ll-1');
  });
});
