import { describe, expect, it } from 'vitest';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { PauseScene } from '@game/scenes/pause';
import { QUIT_RUN_KEPT, QUIT_RUN_TITLE, QuitRunScene } from '@game/scenes/quit-run';
import { MUSHROOM_CURSOR } from '@game/scenes/menu-box';
import { makeGame, useStorage, type H } from './heroes-harness';

// 0.4.72 owner item 3: BACK on the Classic select (and Pause > Quit) opens the Quit card as a
// CLASSIC box (menu-box.ts): the select's framed panel, the mushroom cursor, the question on the
// gold header row and the promise on the box's foot, the original's box sounds. Its wording,
// focus (NO) and spoken line are as before (rc-menus.test.ts O-16).

useStorage();

/** Every text, rect and sprite the top scenes draw this frame. */
function frame(h: H) {
  const texts: { str: string; sheet: string }[] = [];
  const rects: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(f: SpriteSheet, str: string): void {
      texts.push({ str, sheet: f.id });
    },
    rect(_x: number, _y: number, _w: number, _h: number, c: string): void {
      rects.push(c);
    },
  });
  h.game.scenes.render(r);
  return { texts, rects, strs: texts.map((t) => t.str) };
}

/** A Classic run in 1-1, then a death with lives left: the select again. */
function midRunSelect(h: H): CharacterSelectScene {
  h.game.classicGame(h.game.heroSlots[0]!, '1-1', { ref: { set: 'smb', slot: 1 } });
  h.until(() => h.top() instanceof LevelScene, 600);
  h.game.respawn('1-1', { mode: 'stand' });
  const sel = h.top() as CharacterSelectScene;
  expect(sel).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  return sel;
}

function expectBox(h: H): void {
  const f = frame(h);
  // The question and the promise, as before; the menu panel's '>' cursor and dark veil are gone.
  expect(f.strs).toContain(QUIT_RUN_TITLE);
  expect(f.strs).toContain(QUIT_RUN_KEPT);
  expect(f.strs).toContain('NO');
  expect(f.strs).toContain('YES');
  expect(f.strs).not.toContain('>');
  expect(f.rects).not.toContain('rgba(0,0,0,0.85)');
  // The mushroom cursor's cap red (menu-box.ts CURSOR_COLOURS r), one rect per red pixel or more.
  const red = MUSHROOM_CURSOR.join('')
    .split('')
    .filter((c) => c === 'r').length;
  expect(f.rects.filter((c) => c === '#d82800').length).toBeGreaterThanOrEqual(red);
  // The question is the box's gold header: a different sheet from the rows'.
  const head = f.texts.find((t) => t.str === QUIT_RUN_TITLE)!;
  const no = f.texts.find((t) => t.str === 'NO')!;
  expect(head.sheet).not.toBe(no.sheet);
}

describe('owner 0.4.72 item 3: the Quit card is a CLASSIC box', () => {
  it('BACK on the mid-run select: a box, NO focused, announced as before', () => {
    const h = makeGame();
    const sel = midRunSelect(h);
    h.tap('attack');
    const card = h.top() as QuitRunScene;
    expect(card).toBeInstanceOf(QuitRunScene);
    expect((card as unknown as { index: number }).index).toBe(0);
    expect(h.said.at(-1)).toBe('Quit to the Classic menu? Your run waits in its file. No');
    h.idle(10);
    expectBox(h);
    // The select stays in view under it.
    expect(card.translucent).toBe(true);
    // The original's box sounds: moving the cursor, then going back.
    h.audio.sfx.mockClear();
    h.tap('down');
    expect(h.audio.sfx).toHaveBeenCalledWith('fireball');
    expect(h.said.at(-1)).toBe('Yes');
    h.tap('up');
    h.audio.sfx.mockClear();
    h.tap('attack');
    expect(h.audio.sfx).toHaveBeenCalledWith('bump');
    expect(h.top()).toBe(sel);
  });

  it('Pause > Quit opens the same box', () => {
    const h = makeGame();
    h.game.classicGame(h.game.heroSlots[0]!, '1-1', { ref: { set: 'smb', slot: 1 } });
    h.until(() => h.top() instanceof LevelScene, 600);
    h.idle(4);
    h.tap('start');
    const pause = h.top() as PauseScene;
    expect(pause).toBeInstanceOf(PauseScene);
    h.idle(8);
    const row = (pause as unknown as { items: { label: string }[] }).items.findIndex(
      (i) => i.label === 'Quit',
    );
    for (let n = 0; (pause as unknown as { index: number }).index !== row && n < 20; n++) h.tap('down');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(QuitRunScene);
    h.idle(10);
    expectBox(h);
  });

  it('the box is open the frame it is said (no growing open), Reduce flashing or not', () => {
    const h = makeGame();
    h.game.ctx.reduceFlashing = false;
    midRunSelect(h);
    h.tap('attack');
    expect(frame(h).strs).toContain(QUIT_RUN_TITLE);
  });
});
