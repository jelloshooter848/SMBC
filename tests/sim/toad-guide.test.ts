import { describe, expect, it } from 'vitest';
import type { Settings } from '@engine/save/settings';
import { WorldMapScene } from '@game/scenes/world-map';
import { CreditsScene } from '@game/scenes/credits';
import { LevelScene } from '@game/scenes/level';
import { CRASH_FRAMES } from '@game/map/airship-crash';
import { CHARACTERS } from '@game/characters/registry';
import { loadSave, type SaveFile } from '@game/save/save-files';
import { beat, upgradeStory } from '@game/story/beats';
import { CRASH_PAGES, gateScript, HUB_PAGE, riftPages, WORLD1_PAGES, type Page } from '@game/story/script';
import { HIDING_HINT } from '@game/scenes/world-map';
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
  it("World 1 after 1-0: Toad walks in, his World 1 scene's three pages at the top, then the road to 1-1; once per file", () => {
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
    // At World 1's start (the left edge) he stops beside the hero, never on top of him.
    expect(Math.abs(toadSprite(h)!.x - map(h).hx)).toBeGreaterThanOrEqual(16);
    expect(map(h).touchLabels()).toMatchObject({ jump: 'OK', attack: 'SKIP' });
    // The box sits at the top, under the header.
    const { texts } = draw(map(h));
    const top = texts.find((t) => t.str === 'TOAD:');
    expect(top!.y).toBeLessThan(60);
    expect(h.said.some((t) => t.startsWith('TOAD: MARIO, DID YOU SEE THAT?!') && /OK for more/.test(t))).toBe(
      true,
    );
    // The road waits behind the box.
    expect(h.game.pendingReveal.length).toBeGreaterThan(0);
    const pages = readAll(h);
    expect(pages).toEqual(WORLD1_PAGES);
    expect(h.said.some((t) => t.startsWith("TOAD: WHERE'S LUIGI?") && /OK to continue/.test(t))).toBe(true);
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

  it('a cleared level still hiding its hero: no card, the generic hint line (0.4.23)', () => {
    const h = open({ cleared: ['1-0'], position: { page: 'smb-1', node: '1-1' }, story: ['enter:smb-1'] });
    h.game.levelCleared('1-1');
    expect(map(h).story).toBe(false);
    h.until(() => map(h).mode === 'idle', 600);
    expect(map(h).hintLine).toBe(HIDING_HINT);
  });

  it('a story scene elsewhere: the node line is still said on arrival, first', () => {
    const h = open({ cleared: ['1-0'], position: { page: 'smb-1', node: 'start' }, story: [] });
    // The World 1 entry plays (Toad walks in); the page's line was said ahead of it, as before.
    h.until(() => map(h).toad?.lines != null, 300);
    const idx = h.said.findIndex((t) => t.startsWith('World 1'));
    const card = h.said.findIndex((t) => t.startsWith('TOAD: MARIO, DID YOU SEE THAT?!'));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(card).toBeGreaterThan(idx);
    readAll(h);
    h.until(() => map(h).mode === 'idle', 600);
    expect(h.said.filter((t) => t.startsWith('World 1')).length).toBe(1);
  });

  it("the play order when several are due: World 1's scene, then the gate's reminder; BACK closes one scene", () => {
    const h = open({
      cleared: W1,
      pages: ['smb-1'],
      freed: ['mario'], // Luigi still captive: World 1's seal stands
      position: { page: 'smb-1', node: '1-4' },
      story: [],
    });
    expect(map(h).story).toBe(true);
    h.until(() => map(h).toad?.lines != null, 300);
    expect(map(h).toad?.lines).toEqual(WORLD1_PAGES[0]);
    // BACK: the rest of the World 1 scene is skipped, the next scene (the seal's reminder,
    // routine: after the major ones, S3's gateScenes) starts.
    const reminder = gateScript(1, 'MARIO')?.reminder ?? [];
    h.idle(31);
    h.tap('attack');
    expect(map(h).toad?.lines).toEqual(reminder[0]);
    expect(readAll(h)).toEqual(reminder);
    for (const id of [beat.sealed('smb-1'), beat.enter('smb-1')]) expect(h.game.seen(id)).toBe(true);
  });

  it("the airship crash: the cutscene, then Toad's crash cards, then the road", () => {
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
    h.until(() => map(h).mode === 'idle', 600);
    expect(h.game.pendingReveal).toEqual([]);
  });

  it('after the 8-4 credits: the rift on World 8 (P1 named), before the road on to Lost World 1', () => {
    const cleared = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`));
    const h = open({
      cleared: ['1-0', ...cleared.filter((id) => id !== '8-4')],
      pages: [1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`),
      // Sophia III freed first: the rift opens with the credits (0.4.23: it waits for her).
      freed: CHARACTERS.map((c) => c.id),
      position: { page: 'smb-8', node: '8-4' },
      story: ALL_STORY.filter((id) => id !== beat.rift && id !== beat.bowser84),
    });
    expect(map(h).story).toBe(false);
    h.game.showEnding('8-4');
    expect(h.top()).toBeInstanceOf(CreditsScene);
    h.idle(60);
    h.tap('start');
    h.until(() => h.top() instanceof CreditsScene && (h.top() as CreditsScene).waiting, 8000);
    h.tap('jump'); // the closing lines wait for OK
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
    expect(h.game.story).toEqual(upgradeStory(undefined, h.game.mapProgress, h.game.freed));
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

describe("Toad's map scenes: after the last page", () => {
  /** World 8 after the credits with only the rift due (a major scene: Toad walks in), no reveal. */
  const riftOnly = (over: Partial<SaveFile> = {}) =>
    open({
      cleared: [...W1, '8-4'],
      pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4', 'smb-5', 'smb-6', 'smb-7', 'smb-8', 'll-1'],
      freed: CHARACTERS.map((c) => c.id),
      gameCleared: true,
      position: { page: 'smb-8', node: '8-4' },
      story: ALL_STORY.filter((id) => id !== beat.rift),
      ...over,
    });
  const RIFT = riftPages('MARIO');

  it('Toad walks off while the map is already the player’s: the hero can move at once', () => {
    const h = riftOnly();
    expect(readAll(h)).toEqual(RIFT);
    // The frame the last page closes, the map is idle, Toad still on stage walking off.
    expect(map(h).mode).toBe('idle');
    const off = toadSprite(h);
    expect(off).toBeDefined();
    h.idle(6); // the map's idle settle
    expect(toadSprite(h)!.x).toBeLessThan(off!.x);
    // The hero walks while Toad is still going.
    for (const d of ['left', 'up', 'down', 'right'] as const) if (map(h).mode === 'idle') h.tap(d);
    expect(map(h).mode).toBe('walk');
    expect(toadSprite(h)).toBeDefined();
    h.until(() => toadSprite(h) === undefined, 300);
    expect(map(h).toad).toBeNull();
  });

  it('co-op: player 2 pressing OK turns the pages of Toad’s box', () => {
    const h = riftOnly({ character2: 'luigi' });
    expect(h.game.state.character2?.id).toBe('luigi');
    h.until(() => map(h).toad?.lines != null, 300);
    expect(map(h).toad?.lines).toEqual(RIFT[0]);
    h.idle(31);
    h.tap('jump', 1);
    expect(map(h).toad?.lines).toEqual(RIFT[1]);
    h.idle(31);
    h.tap('attack', 1);
    expect(map(h).mode).not.toBe('story');
  });
});
