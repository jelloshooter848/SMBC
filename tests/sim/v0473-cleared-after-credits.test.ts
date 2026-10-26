import { afterEach, describe, expect, it } from 'vitest';
import { MARIO } from '@game/characters/mario';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { ClassicNoteScene } from '@game/scenes/original-replay';
import { MessageScene } from '@game/scenes/message';
import { TitleScene } from '@game/scenes/title';
import { loadClearedFile, type ClassicFileRef } from '@game/original-files';
import { store, useStorage } from './heroes-harness';
import { beat, classic, closeUnlockCards, inLevel, readNote } from './cleared-nav';

// v0.4.73 PR 2 (B): after the credits of a beaten set, the cheat cards as before, then that
// set's file box with the CLEARED file focused and a Classic message box over it: "YOU BEAT
// <SET>! FILE N IS CLEARED." and "PICK A CLEARED FILE TO REPLAY ANY LEVEL OF THIS MAP SET.",
// each line fitting the box, read out, waiting for OK. Developer and practice runs keep the
// title.

useStorage();
afterEach(() => store.clear());

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const L2: ClassicFileRef = { set: 'lost', slot: 2 };
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const index = (s: unknown) => (s as { index: number }).index;

describe('B: after the credits', () => {
  it('the cheat cards first, then the message over the file box, then the box on the file', () => {
    const h = classic();
    beat(h, A);
    // SMB's All Ground Is Bricks and Infinite Lives (no continue) are unlocked by the beat.
    expect(h.top()).toBeInstanceOf(MessageScene);
    closeUnlockCards(h);
    expect(h.top()).toBeInstanceOf(ClassicNoteScene);
    const note = h.top() as ClassicNoteScene;
    expect(note.lines.join(' ')).toMatch(/YOU BEAT SUPER MARIO BROS\.!/);
    expect(note.lines.join(' ')).toMatch(/FILE 1 IS CLEARED\./);
    expect(h.said.at(-1)).toMatch(/You beat Super Mario Bros\.! File 1 is cleared\./i);
    // It waits for a press: never a timer.
    h.idle(900);
    expect(h.top()).toBe(note);
    const pages = readNote(h);
    const all = pages.flat();
    expect(all.join(' ')).toMatch(/PICK A CLEARED FILE TO REPLAY ANY LEVEL OF THIS MAP SET\./);
    // Every line fits the box (the boxes' widest text row).
    for (const line of all) expect(line.length).toBeLessThanOrEqual(28);
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
    const box = h.top() as ClassicFilesScene;
    expect(index(box)).toBe(0);
    expect(items(box)[0]?.value?.()).toMatch(/CLEARED/);
  });

  it('the file box is under the message, focused on the cleared file', () => {
    const h = classic();
    beat(h, A);
    closeUnlockCards(h);
    const note = h.top() as ClassicNoteScene;
    const under = h.game.scenes.find((s) => s instanceof ClassicFilesScene) as ClassicFilesScene;
    expect(under).toBeDefined();
    expect(index(under)).toBe(0);
    expect(note).toBeInstanceOf(ClassicNoteScene);
  });

  it('BACK on the message steps back to the file box', () => {
    const h = classic();
    beat(h, A);
    closeUnlockCards(h);
    expect(h.top()).toBeInstanceOf(ClassicNoteScene);
    h.idle(40);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
  });

  it('The Lost Levels in FILE 2: its own name and file', () => {
    const h = classic();
    beat(h, L2, 'll-13-4');
    closeUnlockCards(h);
    const note = h.top() as ClassicNoteScene;
    expect(note).toBeInstanceOf(ClassicNoteScene);
    expect(note.lines.join(' ')).toMatch(/YOU BEAT THE LOST LEVELS!/);
    expect(note.lines.join(' ')).toMatch(/FILE 2 IS CLEARED\./);
    readNote(h);
    const box = h.top() as ClassicFilesScene;
    expect(box.set.id).toBe('lost');
    expect(index(box)).toBe(1);
    expect(loadClearedFile(L2)).not.toBeNull();
  });

  it('Reduce flashing on: the box is open at once; off: it grows open', () => {
    const calm = classic();
    beat(calm, A);
    closeUnlockCards(calm);
    expect((calm.top() as ClassicNoteScene).openness).toBe(1);
    store.clear();
    const lively = classic();
    (lively.game.ctx as { reduceFlashing: boolean }).reduceFlashing = false;
    beat(lively, A);
    closeUnlockCards(lively);
    const note = lively.top() as ClassicNoteScene;
    expect(note.openness).toBeLessThan(1);
    lively.idle(20);
    expect(note.openness).toBe(1);
  });

  it('touch: OK only once the box takes a press', () => {
    const h = classic();
    beat(h, A);
    closeUnlockCards(h);
    const note = h.top() as ClassicNoteScene;
    expect(note.touchLabels().jump ?? null).toBeNull();
    h.idle(40);
    expect(note.touchLabels().jump).toBe('OK');
  });
});

describe('B: developer and practice runs keep the title', () => {
  it('a developer Classic run', () => {
    const h = classic();
    h.game.devClassicGame(MARIO, '8-4', 'classic', true);
    h.until(() => inLevel(h), 900);
    h.game.showEnding('8-4');
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect([...store.keys()].filter((k) => k.startsWith('smbc-classic-file'))).toEqual([]);
  });
});
