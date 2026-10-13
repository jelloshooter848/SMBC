import { describe, expect, it } from 'vitest';
import { levelIds } from '@content/levels';
import {
  clearLevel,
  exitId,
  isExitOpen,
  isOpen,
  newMapProgress,
  nextStep,
  openMetExits,
  openPaths,
  type GetLevel,
} from '@game/map/rules';
import { smbWorld } from '@game/map/world-gate';
import type { MapProgress, WorldMapPage } from '@game/map/types';
import { CAMPAIGN_MAP_PAGES, isPageId, levelPage, MAP_PAGES, mapPage, pageLook, rulePages } from './index';
import { underworldPage, WORLD_8_UNDERWORLD } from './world8-underworld';
import { BOWSERS_CASTLE, VALLEY_EXIT, VALLEY_LIVE, VALLEY_OF_BOWSER, valleyLive } from './valley-of-bowser';

/*
 * The VALLEY OF BOWSER (0.4.54): its one switch (the castle's level, 8-5, in the level index), and
 * the map rules with it live: World 8's road there (Sophia's gate), the castle, and the road on to
 * the Lost Levels, open once the castle is cleared or on a file that has beaten the game.
 * tests/sim/valley-of-bowser.test.ts plays it with the switch on.
 */

const noLevels: GetLevel = (id) => {
  throw new Error(`no level ${id}`);
};

/** Campaign play's pages once the Valley is live: World 8's road leads there, the Valley after it. */
const LIVE: readonly WorldMapPage[] = (() => {
  const pages = CAMPAIGN_MAP_PAGES.map((p) => (p.id === 'smb-8' ? underworldPage(true) : p)).filter(
    (p) => p.id !== VALLEY_OF_BOWSER.id,
  );
  const at = pages.findIndex((p) => p.id === 'smb-8') + 1;
  return [...pages.slice(0, at), VALLEY_OF_BOWSER, ...pages.slice(at)];
})();
const page = (id: string) => LIVE.find((p) => p.id === id) as WorldMapPage;

const WORLDS = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`));
const HEROES = ['mario', 'luigi', 'link', 'megaman', 'samus', 'simon', 'ryu', 'bill', 'sophia'];
const SMB = [1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`);

function file(over: Partial<MapProgress> = {}): MapProgress {
  return { ...newMapProgress(), cleared: ['1-0', ...WORLDS], pages: [...SMB], freed: HEROES, ...over };
}

describe('the switch: the Valley is live once its castle’s level, 8-5, exists', () => {
  it('reads the level index', () => {
    expect(valleyLive(['8-3', '8-4'])).toBe(false);
    expect(valleyLive(['8-4', '8-5'])).toBe(true);
    expect(VALLEY_LIVE).toBe(levelIds().includes('8-5'));
  });

  describe.runIf(!VALLEY_LIVE)('while there is no 8-5 (0.4.54)', () => {
    it('registers no Valley: saves, the rules and the menus never see it', () => {
      expect(MAP_PAGES.some((p) => p.id === 'valley-of-bowser' || p.group === 'valley')).toBe(false);
      expect(isPageId('valley-of-bowser')).toBe(false);
      expect(mapPage('valley-of-bowser')).toBeUndefined();
      expect(levelPage('8-5')).toBeUndefined();
      expect(rulePages(true).some((p) => p.id === 'valley-of-bowser')).toBe(false);
    });

    it('keeps campaign World 8’s road on to Lost World 1, Sophia’s gate on it, as today', () => {
      expect(pageLook(mapPage('smb-8'), true)).toBe(WORLD_8_UNDERWORLD);
      expect(WORLD_8_UNDERWORLD.exits.map(exitId)).toEqual(['8-4>ll-1']);
      expect(WORLD_8_UNDERWORLD.exits[0]?.gate).toBe('sophia');
      // A beaten file walks it on to Lost World 1 and back.
      const p = file({
        gameCleared: true,
        pages: [...SMB, 'll-1'],
        position: { page: 'smb-8', node: '8-4' },
      });
      const pages = rulePages(true);
      const on = nextStep(WORLD_8_UNDERWORLD, p, '8-4', 'right', pages);
      expect(on?.kind === 'exit' && on.exit.to).toBe('ll-1');
      const back = nextStep(pageLook(mapPage('ll-1'), true) as WorldMapPage, p, 'start', 'left', pages);
      expect(back).toMatchObject({ kind: 'back', page: 'smb-8', node: '8-4' });
    });
  });

  describe.runIf(VALLEY_LIVE)('once 8-5 exists', () => {
    it('registers the Valley after the SMB worlds and leads campaign World 8’s road there', () => {
      expect(mapPage('valley-of-bowser')).toBe(VALLEY_OF_BOWSER);
      expect(levelPage('8-5')).toBe(VALLEY_OF_BOWSER);
      expect(MAP_PAGES.indexOf(VALLEY_OF_BOWSER)).toBe(8);
      expect(WORLD_8_UNDERWORLD.exits.map(exitId)).toEqual(['8-4>valley-of-bowser']);
    });
  });
});

describe('the Valley in the map rules (live)', () => {
  const valley = page('valley-of-bowser');
  const eight = page('smb-8');

  it('is no SMB world: no world number, so no world gate or welcome takes it for a ninth', () => {
    expect(smbWorld('valley-of-bowser')).toBe(0);
    expect(valley.group).toBe('valley');
  });

  it('opens when 8-4 is cleared and Sophia III is freed (World 8’s gate), drawing in its road and castle', () => {
    const p = file({
      cleared: ['1-0', ...WORLDS.filter((id) => id !== '8-4')],
      position: { page: 'smb-8', node: '8-3' },
    });
    const opened = clearLevel(p, '8-4', noLevels, LIVE);
    expect(p.pages).toContain('valley-of-bowser');
    expect(p.pages).not.toContain('ll-1');
    expect(opened).toEqual(
      expect.arrayContaining([
        'smb-8:8-4>valley-of-bowser',
        'valley-of-bowser:start',
        'valley-of-bowser:start>bowsers-castle',
        'valley-of-bowser:bowsers-castle',
      ]),
    );
    expect(opened.some((id) => id.includes('ll-1'))).toBe(false);
  });

  it('stays shut while Sophia III is captive (the seal), like every world’s road on', () => {
    const p = file({
      cleared: ['1-0', ...WORLDS.filter((id) => id !== '8-4')],
      freed: HEROES.filter((h) => h !== 'sophia'),
    });
    clearLevel(p, '8-4', noLevels, LIVE);
    expect(p.pages).not.toContain('valley-of-bowser');
    expect(isExitOpen(p, eight, eight.exits[0] as never)).toBe(false);
  });

  it('keeps the road on to the Lost Levels shut until BOWSER’S CASTLE is cleared', () => {
    const p = file({
      pages: [...SMB, 'valley-of-bowser'],
      position: { page: 'valley-of-bowser', node: 'bowsers-castle' },
    });
    expect(isOpen(p, valley, 'bowsers-castle')).toBe(true);
    expect(isExitOpen(p, valley, VALLEY_EXIT)).toBe(false);
    expect(openPaths(p, valley).exits).toEqual([]);
    expect(nextStep(valley, p, 'bowsers-castle', 'right', LIVE)).toBeNull();
    const opened = clearLevel(p, '8-5', noLevels, LIVE);
    expect(p.position).toEqual({ page: 'valley-of-bowser', node: 'bowsers-castle' });
    expect(p.pages).toContain('ll-1');
    expect(opened).toEqual(expect.arrayContaining(['valley-of-bowser:bowsers-castle>ll-1', 'll-1:start']));
    const on = nextStep(valley, p, 'bowsers-castle', 'right', LIVE);
    expect(on?.kind === 'exit' && on.exit.to).toBe('ll-1');
  });

  it('opens that road on a file that has already beaten the game, the castle open and uncleared', () => {
    const p = file({ gameCleared: true, pages: [...SMB, 'valley-of-bowser'] });
    expect(isExitOpen(p, valley, VALLEY_EXIT)).toBe(true);
    expect(p.cleared).not.toContain('8-5');
    // openMetExits (each time the map shows) opens Lost World 1 for it and draws the road in.
    expect(openMetExits(p, LIVE)).toEqual(expect.arrayContaining(['valley-of-bowser:bowsers-castle>ll-1']));
    expect(p.pages).toContain('ll-1');
    // Never while the Valley itself is shut.
    const shut = file({ gameCleared: true });
    expect(isExitOpen(shut, valley, VALLEY_EXIT)).toBe(false);
  });

  it('brings an old beaten file up to date: the Valley opens, the Lost Levels road stays open', () => {
    // A file from before the Valley: World 8 done, Sophia freed, the credits seen, Lost World 1 open.
    const p = file({ gameCleared: true, pages: [...SMB, 'll-1'], position: { page: 'll-1', node: 'start' } });
    const opened = openMetExits(p, LIVE);
    expect(opened[0]).toBe('smb-8:8-4>valley-of-bowser');
    expect(p.pages).toContain('valley-of-bowser');
    expect(isExitOpen(p, valley, VALLEY_EXIT)).toBe(true);
    // Back from Lost World 1's start: to the Valley's castle now, World 8's road leading there.
    const back = nextStep(page('ll-1'), p, 'start', 'left', LIVE);
    expect(back).toMatchObject({ kind: 'back', page: 'valley-of-bowser', node: 'bowsers-castle' });
    const home = nextStep(valley, p, 'start', 'left', LIVE);
    expect(home).toMatchObject({ kind: 'back', page: 'smb-8', node: '8-4' });
  });

  it('opens with unlock all once the castle shows, like any road on', () => {
    // (Unlock all opens every registered page; the file holds the Valley here, live or not.)
    const p = { ...newMapProgress(), pages: ['smb-1', 'valley-of-bowser'] };
    expect(isExitOpen(p, valley, VALLEY_EXIT, true)).toBe(true);
    expect(isExitOpen(p, valley, VALLEY_EXIT, false)).toBe(false);
  });

  it('names the castle BOWSER’S CASTLE wherever the player sees it', () => {
    expect(valley.nodes.find((n) => n.id === 'bowsers-castle')?.name).toBe(BOWSERS_CASTLE);
    expect(BOWSERS_CASTLE).toBe("BOWSER'S CASTLE");
  });
});
