import { describe, expect, it, vi } from 'vitest';
import type * as Worldmap from '@content/worldmap';
import type { WorldMapPage } from '@game/map/types';
import { decodeSaveCode, encodeSaveCode } from './save-code';
import { newSave, type SaveFile } from './save-files';

// Code version 3 (0.4.51) reserves the Valley of Bowser ahead of its release: the page
// `valley-of-bowser`, its nodes `bowsers-castle` and `start`, and its castle level `8-5`. This
// build has no such page (a loaded file drops it, save-code.test.ts), so here a stand-in page is
// registered, as the release that adds it will: a code made then round-trips exactly.

const VALLEY = 'valley-of-bowser';

vi.mock('@content/worldmap', async (importOriginal) => {
  const orig = await importOriginal<typeof Worldmap>();
  const valley = {
    id: 'valley-of-bowser',
    group: 'valley',
    nodes: [{ id: 'start' }, { id: 'bowsers-castle', level: '8-5' }],
    paths: [],
    exits: [],
  } as unknown as WorldMapPage;
  const pages = [...orig.MAP_PAGES, valley];
  return {
    ...orig,
    MAP_PAGES: pages,
    mapPage: (id: string) => pages.find((p) => p.id === id),
    isPageId: (id: unknown) => typeof id === 'string' && pages.some((p) => p.id === id),
  };
});

/** A file that has beaten 8-4 and stands at Bowser's Castle in the Valley of Bowser. */
function atValley(over: Partial<SaveFile> = {}): SaveFile {
  const smb = Array.from({ length: 8 }, (_, i) => `smb-${i + 1}`);
  return {
    ...newSave(1, 'mario'),
    cleared: ['1-0', ...Array.from({ length: 32 }, (_, i) => `${(i >> 2) + 1}-${(i & 3) + 1}`)],
    pages: [...smb, VALLEY],
    position: { page: VALLEY, node: 'bowsers-castle' },
    lastNode: { 'smb-8': '8-4', [VALLEY]: 'bowsers-castle' },
    freed: ['mario', 'luigi', 'link', 'megaman', 'samus', 'simon', 'ryu', 'bill', 'sophia'],
    ...over,
  };
}

const roundTrip = (s: SaveFile): SaveFile => {
  const r = decodeSaveCode(encodeSaveCode(s), 1);
  if (!r.ok) throw new Error(r.error);
  expect(r.version).toBe(3);
  return r.save;
};
const len = (s: SaveFile) => encodeSaveCode(s).replace(/-/g, '').length;

describe('save codes: the Valley of Bowser, reserved in version 3', () => {
  it('its page, nodes and castle level round-trip', () => {
    const s = atValley({
      cleared: [...atValley().cleared, '8-5'],
      pendingReveal: [`${VALLEY}:bowsers-castle`, `smb-8:8-4>${VALLEY}`],
    });
    const back = roundTrip(s);
    expect(back.pages).toContain(VALLEY);
    expect(back.position).toEqual({ page: VALLEY, node: 'bowsers-castle' });
    expect(back.lastNode).toEqual({ 'smb-8': '8-4', [VALLEY]: 'bowsers-castle' });
    expect(back.cleared).toContain('8-5');
    expect(back.pendingReveal).toEqual(s.pendingReveal);
    expect(roundTrip(atValley({ position: { page: VALLEY, node: 'start' } })).position).toEqual({
      page: VALLEY,
      node: 'start',
    });
  });

  it('each costs a symbol, not its name as text', () => {
    // The page is one dictionary symbol, its castle the page's usual node (one pick).
    const smb8 = atValley({
      pages: atValley().pages.filter((p) => p !== VALLEY),
      position: { page: 'smb-8', node: '8-4' },
      lastNode: { 'smb-8': '8-4' },
    });
    expect(len(atValley()) - len(smb8)).toBeLessThanOrEqual(2);
    // 8-5 is a level symbol: shorter than an id the dictionary doesn't know (escaped as text).
    const with85 = atValley({ cleared: [...atValley().cleared, '8-5'] });
    const with86 = atValley({ cleared: [...atValley().cleared, '8-6'] });
    expect(len(with85) - len(atValley())).toBeLessThanOrEqual(2);
    expect(len(with86)).toBeGreaterThan(len(with85));
  });
});
