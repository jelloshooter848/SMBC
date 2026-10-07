import { describe, expect, it } from 'vitest';
import type { Settings } from '@engine/save/settings';
import { WorldMapScene } from '@game/scenes/world-map';
import { CreditsScene } from '@game/scenes/credits';
import { LevelScene } from '@game/scenes/level';
import { CRASH_FRAMES } from '@game/map/airship-crash';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import type { CharacterDef } from '@game/characters/character';
import { loadSave, type SaveFile } from '@game/save/save-files';
import { beat, seedSeen } from '@game/story/beats';
import {
  CRASH_PAGES,
  FAKES_PAGES,
  HUB_PAGE,
  JOINED_CRACK,
  JOINED_GENERIC,
  JOINED_PAGES,
  MISSED_PAGES,
  riftPages,
  WORLD_ENTRY,
  type Page,
} from '@game/story/script';
import { draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { ALL_STORY } from './story-seen';

// Toad as the world map's guide (0.4.13, docs/STORY.md 2.3, 2.14; map/toad-guide.ts): his box at
// the top of the map, once per file, before the page's reveal; walking in for the major scenes.

useStorage();

const W1 = ['1-0', '1-1', '1-2', '1-3', '1-4'];
const map = (h: H) => h.top() as WorldMapScene;

function open(over: Partial<SaveFile>, setup?: (h: H) => void): H {
  const h = makeGame();
  h.game.deps.settings = { dev: false } as Settings;
  setup?.(h);
  file(over);
  h.game.openFile(1);
  h.step();
  return h;
}

/** Toad's map sprite this frame, or undefined. */
const toadSprite = (h: H) => draw(map(h)).sprites.find((s) => s.key === 'smb3' && /^toad-map-/.test(s.frame));

/** Waits out the walk-in, then reads every page shown, pressing OK on each; the map is idle after. */
function readAll(h: H, press: 'jump' | 'attack' = 'jump'): Page[] {
  const out: Page[] = [];
  for (let i = 0; i < 40 && map(h).mode === 'story'; i++) {
    h.until(() => map(h).toad?.lines != null || map(h).mode !== 'story', 600);
    const lines = map(h).toad?.lines;
    if (!lines) break;
    out.push(lines);
    h.idle(31);
    h.tap(press);
  }
  h.until(() => map(h).mode !== 'story', 600);
  return out;
}

describe("Toad's map scenes", () => {
  it('World 1 after 1-0: Toad walks in, two pages at the top, then the road to 1-1; once per file', () => {
    const h = open({});
    expect(map(h).story).toBe(false); // a new file, 1-0 not cleared: nothing yet
    h.game.levelCleared('1-0');
    expect(map(h).story).toBe(true);
    expect(map(h).revealing).toBe(true);
    expect(map(h).toad?.lines).toBeNull(); // walking in first
    const first = toadSprite(h);
    expect(first).toBeDefined();
    h.idle(10);
    expect(toadSprite(h)!.x).toBeGreaterThan(first!.x);
    h.until(() => map(h).toad?.lines != null, 200);
    expect(map(h).touchLabels()).toMatchObject({ jump: 'OK', attack: 'SKIP' });
    // The box sits at the top, under the header.
    const { texts } = draw(map(h));
    const top = texts.find((t) => t.str === 'TOAD:');
    expect(top!.y).toBeLessThan(60);
    expect(h.said.some((t) => t.startsWith('TOAD: FIRST, WHO ARE WE LOOKING') && /OK for more/.test(t))).toBe(
      true,
    );
    // The road waits behind the box.
    expect(h.game.pendingReveal.length).toBeGreaterThan(0);
    const pages = readAll(h);
    expect(pages).toEqual(WORLD_ENTRY['smb-1']);
    expect(h.said.some((t) => t.startsWith('TOAD: IF I KNOW HIM') && /OK to continue/.test(t))).toBe(true);
    expect(h.game.seen(beat.enter('smb-1'))).toBe(true);
    expect(loadSave(1)?.story).toContain(beat.enter('smb-1'));
    // Toad walks back off; then the reveal.
    h.until(() => map(h).mode === 'idle', 600);
    expect(h.game.pendingReveal).toEqual([]);
    expect(toadSprite(h)).toBeUndefined();
    // Reopened: not again.
    h.game.openFile(1);
    h.step();
    expect(map(h).story).toBe(false);
  });

  it('routine lines show the box only: no Toad walking in (a missed hero)', () => {
    const h = open({ cleared: ['1-0'], position: { page: 'smb-1', node: '1-1' }, story: ['enter:smb-1'] });
    h.game.levelCleared('1-1');
    expect(map(h).story).toBe(true);
    expect(map(h).toad?.lines).toEqual(MISSED_PAGES.luigi);
    for (let i = 0; i < 20; i++) {
      expect(toadSprite(h)).toBeUndefined();
      h.step();
    }
    expect(readAll(h)).toEqual([MISSED_PAGES.luigi]);
    expect(h.game.seen('missed:luigi')).toBe(true);
    // The road to 1-2 then draws in.
    h.until(() => map(h).mode === 'idle', 600);
    // Back on 1-1 (the hero stands there), Toad's hint line for Luigi.
    expect(map(h).hintLine).toBe('TOAD: I HEAR A MUSTACHE SIGH...');
  });

  it('the play order when several are due: fakes (walking in), joined, entry; BACK closes one scene', () => {
    const h = open({
      cleared: W1,
      pages: ['smb-1', 'smb-2'],
      freed: ['mario', 'luigi'],
      position: { page: 'smb-1', node: '1-4' },
      story: [],
    });
    expect(map(h).story).toBe(true);
    h.until(() => map(h).toad?.lines != null, 300);
    expect(map(h).toad?.lines).toEqual(FAKES_PAGES[0]);
    // BACK: the rest of the fakes scene is skipped, the next scene (the generic joined) starts.
    h.idle(31);
    h.tap('attack');
    expect(map(h).toad?.lines).toEqual(JOINED_CRACK);
    const rest = readAll(h);
    expect(rest).toEqual([JOINED_CRACK, JOINED_GENERIC, JOINED_PAGES.luigi, ...(WORLD_ENTRY['smb-1'] ?? [])]);
    for (const id of [beat.fakes, beat.joined(), beat.joined('luigi'), beat.enter('smb-1')])
      expect(h.game.seen(id)).toBe(true);
  });

  it("the airship crash: the cutscene, then Toad's crash cards, then the road; no missed cards", () => {
    const h = open({
      cleared: [...W1, '2-1', '2-2', '2-3', '2-4', '3-1', '3-2', '3-3', '3-4', '4-1'],
      pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
      position: { page: 'smb-4', node: '4-2' },
    });
    expect(map(h).story).toBe(false); // an old file (no list): seeded, nothing floods in
    h.game.takeCrystalBall('4-2-airship');
    expect(map(h).cutscene).toBe(true);
    h.idle(CRASH_FRAMES.END + 2);
    expect(map(h).cutscene).toBe(false);
    expect(map(h).story).toBe(true);
    expect(map(h).revealing).toBe(true);
    const pages = readAll(h);
    expect(pages).toEqual(CRASH_PAGES);
    expect(h.game.seen(beat.crash)).toBe(true);
    // The crash's cards stand in for World 4's missed card (Samus, on 4-2): only marked.
    expect(h.game.seen(beat.missed('samus'))).toBe(true);
    expect(h.said.some((t) => t.startsWith('TOAD: 4-2 SOUNDED HOLLOW'))).toBe(false);
    h.until(() => map(h).mode === 'idle', 600);
    expect(h.game.pendingReveal).toEqual([]);
  });

  it('after the 8-4 credits: the rift on World 8 (P1 named), before the road on to Lost World 1', () => {
    const cleared = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`));
    const h = open({
      cleared: ['1-0', ...cleared.filter((id) => id !== '8-4')],
      pages: [1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`),
      position: { page: 'smb-8', node: '8-4' },
      story: ALL_STORY.filter((id) => id !== beat.rift && id !== beat.bowser84),
    });
    expect(map(h).story).toBe(false);
    h.game.showEnding('8-4');
    expect(h.top()).toBeInstanceOf(CreditsScene);
    h.idle(60);
    h.tap('start');
    h.until(() => h.top() instanceof WorldMapScene, 3000);
    expect(map(h).page.id).toBe('smb-8');
    expect(h.game.pendingReveal).toContain('smb-8:8-4>ll-1');
    expect(map(h).story).toBe(true);
    expect(toadSprite(h)).toBeDefined();
    expect(readAll(h)).toEqual(riftPages('MARIO'));
    h.until(() => map(h).mode === 'idle', 600);
    expect(h.game.pendingReveal).not.toContain('smb-8:8-4>ll-1');
    expect(h.game.seen(beat.rift)).toBe(true);
  });

  it('World 8 entry: pages 1 and 4 without Sophia; all four with her', () => {
    const entry = WORLD_ENTRY['smb-8'] as Page[];
    const at8 = (setup?: (h: H) => void) =>
      open(
        {
          cleared: ['1-0', ...[1, 2, 3, 4, 5, 6, 7].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`))],
          pages: [1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`),
          position: { page: 'smb-8', node: 'start' },
          story: ALL_STORY.filter((id) => !id.startsWith('enter:smb-8')),
        },
        setup,
      );
    const without = at8();
    expect(readAll(without)).toEqual([entry[0], entry[3]]);
    expect(without.game.seen('enter:smb-8:sophia')).toBe(false);
    const sophia: CharacterDef = { ...MARIO, id: 'sophia', name: 'Sophia III', hudName: 'SOPHIA' };
    const withHer = at8((h) => {
      (h.game.deps as { characters: CharacterDef[] }).characters = [...CHARACTERS, sophia];
    });
    expect(readAll(withHer)).toEqual(entry);
    expect(withHer.game.seen('enter:smb-8:sophia')).toBe(true);
  });

  it('the hub: its line on the first visit only', () => {
    const h = open({
      cleared: ['1-0', '1-1'],
      secrets: ['bonus-1'],
      pages: ['smb-1', 'hub'],
      position: { page: 'hub', node: 'start' },
      story: ALL_STORY.filter((id) => id !== beat.hub),
    });
    expect(readAll(h)).toEqual([HUB_PAGE]);
    h.game.openFile(1);
    h.step();
    expect(map(h).story).toBe(false);
  });

  it('an old save (no story list) with lots done loads without any card', () => {
    const h = open({
      cleared: [...W1, '2-1', '2-2', '2-3', '2-4'],
      pages: ['smb-1', 'smb-2', 'smb-3'],
      freed: ['mario', 'luigi', 'link'],
      position: { page: 'smb-3', node: 'start' },
    });
    expect(map(h).story).toBe(false);
    expect(map(h).mode).toBe('idle');
    expect(h.game.story).toEqual(seedSeen(h.game.mapProgress, h.game.freed));
  });

  it('only while the story plays: a round played for fun shows no card', () => {
    const h = open({
      cleared: W1,
      pages: ['smb-1', 'smb-2'],
      position: { page: 'smb-1', node: '1-4' },
      story: [],
    });
    expect(map(h).story).toBe(true);
    const g = makeGame();
    g.game.deps.settings = { dev: false } as Settings;
    g.game.openFile(1);
    expect((g.top() as WorldMapScene).story).toBe(true);
    g.game.inRound = true;
    g.game.showMap();
    g.step();
    expect((g.top() as WorldMapScene).story).toBe(false);
    expect(g.top()).not.toBeInstanceOf(LevelScene);
  });
});
