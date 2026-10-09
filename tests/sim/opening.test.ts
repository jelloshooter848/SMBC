import { describe, expect, it } from 'vitest';
import { WorldMapScene } from '@game/scenes/world-map';
import { FileSelectScene } from '@game/scenes/file-select';
import { CARD_GUARD_FRAMES } from '@game/scenes/message';
import { beat } from '@game/story/beats';
import { pageSaid } from '@game/story/cards';
import { OPENING_BURST, OPENING_TOAD_PAGES, PEACH_NOTE } from '@game/story/script';
import { inkNudge, noteSaid, OpeningScene, OPENING_TIMING } from '@game/story/opening';
import { loadSave } from '@game/save/save-files';
import { draw, makeGame, useStorage, type H } from './heroes-harness';

// A new file opens in the Mushroom Kingdom (0.4.23, docs/STORY.md 2.1): Peach's castle, the
// caption, her note on parchment, Toad's two pages, then the World 1 map. Once per file.

useStorage();

/** Title → Start game → slot 1, a new file. */
function newFile(h: H) {
  h.game.showTitle();
  h.idle(8);
  h.tap('start');
  expect(h.top()).toBeInstanceOf(FileSelectScene);
  h.idle(8);
  h.tap('jump');
}

const scene = (h: H) => h.top() as OpeningScene;
const ok = (h: H, key: 'jump' | 'attack' | 'start' = 'jump') => {
  h.idle(CARD_GUARD_FRAMES + 1);
  h.tap(key);
};

describe('the opening (a new file)', () => {
  it("Mario's house: Toad bursts in through the door and every card is his, named at its top", () => {
    const h = makeGame();
    newFile(h);
    const s = scene(h);
    const frames = () => draw(scene(h)).sprites.map((x) => x.frame);
    // A cozy room: the bed, the window, the lamp, the picture; the door shut until Toad comes.
    for (const f of ['bed', 'window', 'lamp', 'picture', 'door-shut']) expect(frames()).toContain(f);
    expect(frames()).not.toContain('castle-big');
    expect(frames()).not.toContain('toad');
    h.until(() => frames().includes('door-open'), OPENING_TIMING.toadOut + 2);
    expect(h.audio.sfx).toHaveBeenCalledWith('door-open');
    expect(frames()).toContain('toad');
    expect(h.said.some((t) => t.startsWith("Mario's house"))).toBe(true);
    // His first card opens with the owner's words, under the speaker label.
    h.until(() => s.lines !== null, OPENING_TIMING.captionAt + 5);
    expect(s.lines).toEqual(OPENING_BURST);
    expect(OPENING_BURST.slice(0, 2)).toEqual(['TOAD:', '']);
    expect(OPENING_BURST.slice(2).join(' ')).toMatch(
      /^MARIO!!! THANK GOODNESS YOU'RE HERE! PRINCESS PEACH IS MISSING/,
    );
    // Every card after the note is his too, and none says MARIO again.
    for (const page of OPENING_TOAD_PAGES) {
      expect(page.slice(0, 2)).toEqual(['TOAD:', '']);
      expect(page.join(' ')).not.toMatch(/MARIO/);
    }
  });

  it('the house, Toad bursts in, the note, Toad, then the World 1 map; marked seen on the file', () => {
    const h = makeGame();
    newFile(h);
    expect(h.top()).toBeInstanceOf(OpeningScene);
    expect(h.game.seen(beat.opening)).toBe(true);
    expect(loadSave(1)?.story).toContain(beat.opening);
    // its own short opening song (0.4.31; it borrowed the toad house's before)
    expect(h.audio.playMusic).toHaveBeenCalledWith('opening');
    expect(h.audio.playMusic).not.toHaveBeenCalledWith('toad-house');
    // Toad bursts in with the note; then his first card, which waits.
    h.until(() => scene(h).lines !== null, OPENING_TIMING.captionAt + 5);
    expect(scene(h).lines).toEqual(OPENING_BURST);
    expect(h.said.at(-1)).toBe(pageSaid(OPENING_BURST, false));
    expect(draw(scene(h)).sprites.some((s) => s.frame === 'bed')).toBe(true);
    expect(draw(scene(h)).sprites.some((s) => s.frame === 'note-sheet')).toBe(true);
    h.idle(5000);
    expect(scene(h).lines).toEqual(OPENING_BURST);
    // The note: written a line at a time; OK shows the rest, OK closes it.
    ok(h);
    expect(scene(h).stage).toBe('note');
    expect(h.said.at(-1)).toBe(noteSaid());
    h.idle(OPENING_TIMING.dim + OPENING_TIMING.lineFrames * 2);
    expect(scene(h).noteLines).toBeGreaterThan(0);
    expect(scene(h).noteDone).toBe(false);
    ok(h);
    expect(scene(h).noteDone).toBe(true);
    // Brown ink, one letter at a time, each nudged by its fixed pattern.
    const texts = draw(scene(h)).texts;
    const ink = texts.filter((t) => t.str.length === 1);
    expect(ink.length).toBe(PEACH_NOTE.join('').replace(/ /g, '').length);
    expect(texts.filter((t) => t.str.length > 1).map((t) => t.str)).toEqual(['OK']);
    expect(draw(scene(h)).sprites.some((s) => s.frame === 'wax-seal')).toBe(true);
    h.idle(5000);
    expect(scene(h).stage).toBe('note');
    ok(h);
    for (let i = 0; i < OPENING_TOAD_PAGES.length; i++) {
      expect(scene(h).lines).toEqual(OPENING_TOAD_PAGES[i]);
      expect(h.said.at(-1)).toBe(pageSaid(OPENING_TOAD_PAGES[i]!, i === OPENING_TOAD_PAGES.length - 1));
      ok(h);
    }
    expect(scene(h).stage).toBe('leave');
    h.until(() => h.top() instanceof WorldMapScene, 200);
    const map = h.top() as WorldMapScene;
    expect(map.page.id).toBe('smb-1');
    expect(map.node).toBe('start');
  });

  it('BACK skips the rest; a file reopened goes straight to its map', () => {
    const h = makeGame();
    newFile(h);
    h.until(() => scene(h).lines !== null, 200);
    ok(h, 'attack');
    expect(scene(h).stage).toBe('leave');
    h.until(() => h.top() instanceof WorldMapScene, 200);
    const again = makeGame();
    again.game.openFile(1);
    expect(again.top()).toBeInstanceOf(WorldMapScene);
  });

  it('the handwriting nudge is a fixed pattern of -1, 0 and +1', () => {
    const all = new Set<number>();
    for (let l = 0; l < 13; l++) for (let c = 0; c < 26; c++) all.add(inkNudge(l, c));
    expect([...all].sort()).toEqual([-1, 0, 1]);
    expect(inkNudge(3, 7)).toBe(inkNudge(3, 7));
  });
});
