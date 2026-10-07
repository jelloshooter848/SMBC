import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { LevelScene } from '@game/scenes/level';
import { WorldMapScene } from '@game/scenes/world-map';
import { CardScene } from '@game/scenes/message';
import { loadSave, migrateSave, newSave, saveKey } from '@game/save/save-files';
import { playStoryCards } from '@game/story/cards';
import { seedSeen } from '@game/story/beats';
import { draw, file, makeGame, store, useStorage, type H } from './heroes-harness';

// The story foundation (0.4.13, src/game/story): the seen-beats list on the save file, the
// multi-page story cards, and World.storyMode (campaign only).

useStorage();

const stored = () => JSON.parse(store.get(saveKey(1)) ?? 'null') as Record<string, unknown>;

describe('the seen story beats on the save file', () => {
  it('a new file has no list; migrateSave keeps a list of strings only', () => {
    const s = newSave(1, 'mario');
    expect(s.story).toBeUndefined();
    expect(migrateSave({ ...s, story: ['fakes', 'joined'] }, 1)?.story).toEqual(['fakes', 'joined']);
    expect(migrateSave({ ...s, story: ['fakes', 3] }, 1)).not.toHaveProperty('story');
    expect(migrateSave({ ...s, story: 'fakes' }, 1)).not.toHaveProperty('story');
    expect(migrateSave(s, 1)).not.toHaveProperty('story');
  });

  it('an old file without the list loads, gets it seeded, and saves it', () => {
    const h = makeGame();
    const over = {
      cleared: ['1-0', '1-1', '1-2', '1-3', '1-4'],
      pages: ['smb-1', 'smb-2'],
      freed: ['mario', 'luigi'],
    };
    file(over);
    expect(stored()).not.toHaveProperty('story');
    h.game.openFile(1);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    const want = seedSeen({ ...newSave(1, 'mario'), ...over }, over.freed);
    expect(h.game.story).toEqual(want);
    expect(h.game.story).toEqual(
      expect.arrayContaining(['enter:smb-1', 'enter:smb-2', 'fakes', 'joined:luigi']),
    );
    h.game.autosave();
    expect(loadSave(1)?.story).toEqual(want);
  });

  it('a file with a list round-trips; markSeen adds once and saves', () => {
    const h = makeGame();
    file({ story: ['hub'] });
    h.game.openFile(1);
    expect(h.game.story).toEqual(['hub']);
    expect(h.game.seen('hub')).toBe(true);
    expect(h.game.seen('enter:smb-1')).toBe(false);
    h.game.markSeen('enter:smb-1');
    h.game.markSeen('enter:smb-1');
    expect(h.game.story).toEqual(['hub', 'enter:smb-1']);
    expect(stored().story).toEqual(['hub', 'enter:smb-1']);
    expect(loadSave(1)?.story).toEqual(['hub', 'enter:smb-1']);
  });
});

describe('World.storyMode', () => {
  const into = (h: H) => {
    h.game.startLevel(getLevel('1-1'), { mode: 'stand' });
    h.step();
    const l = h.top();
    expect(l).toBeInstanceOf(LevelScene);
    return (l as LevelScene).world;
  };

  it('is off outside the campaign', () => {
    const h = makeGame();
    expect(into(h).storyMode).toBe(false);
  });

  it('is on in campaign play, off in a round played for fun', () => {
    const h = makeGame();
    file();
    h.game.openFile(1);
    expect(into(h).storyMode).toBe(true);
    h.game.inRound = true;
    expect(into(h).storyMode).toBe(false);
  });
});

describe('playStoryCards', () => {
  const PAGES = [
    ['TOAD:', '', 'PAGE ONE'],
    ['TOAD:', '', 'PAGE TWO'],
    ['TOAD:', '', 'PAGE THREE'],
  ];
  const level = (h: H) => {
    h.game.startLevel(getLevel('1-1'), { mode: 'stand' });
    h.step();
    return h.top() as LevelScene;
  };
  const card = (h: H) => {
    const c = h.top();
    expect(c).toBeInstanceOf(CardScene);
    return c as CardScene;
  };

  it('shows each page in turn over the frozen level, announced, OK to go on', () => {
    const h = makeGame();
    const l = level(h);
    let done = 0;
    playStoryCards(h.game, l.world, PAGES, () => done++);
    expect(card(h).lines).toEqual(PAGES[0]);
    expect(card(h).translucent).toBe(true);
    expect(h.said.at(-1)).toBe('TOAD: PAGE ONE OK for more, BACK to skip.');
    // The level does not run beneath.
    const x = l.world.player.body.x;
    h.idle(32);
    expect(l.world.player.body.x).toBe(x);
    // The prompt, in the top box.
    const texts = draw(card(h)).texts;
    expect(texts.some((t) => t.str.startsWith('OK'))).toBe(true);
    expect(texts.find((t) => t.str === 'PAGE ONE')?.y).toBeLessThan(120);
    h.tap('jump');
    expect(card(h).lines).toEqual(PAGES[1]);
    h.idle(32);
    h.tap('start');
    expect(card(h).lines).toEqual(PAGES[2]);
    expect(h.said.at(-1)).toBe('TOAD: PAGE THREE OK to continue.');
    expect(done).toBe(0);
    h.idle(32);
    h.tap('jump');
    expect(h.top()).toBe(l);
    expect(done).toBe(1);
  });

  it('BACK closes the rest of the scene', () => {
    const h = makeGame();
    const l = level(h);
    let done = 0;
    playStoryCards(h.game, l.world, PAGES, () => done++);
    expect(card(h).touchLabels().attack).toBe('BACK');
    h.idle(32);
    h.tap('attack');
    expect(h.top()).toBe(l);
    expect(done).toBe(1);
  });

  it('ignores presses during the guard', () => {
    const h = makeGame();
    const l = level(h);
    playStoryCards(h.game, l.world, PAGES, () => {});
    h.tap('attack');
    h.tap('jump');
    expect(card(h).lines).toEqual(PAGES[0]);
  });

  it('with no world, the box goes over the scene beneath (the map); option for the bottom', () => {
    const h = makeGame();
    file();
    h.game.openFile(1);
    const map = h.top();
    expect(map).toBeInstanceOf(WorldMapScene);
    let done = 0;
    playStoryCards(h.game, null, PAGES.slice(0, 1), () => done++, { bottom: true });
    expect(card(h).translucent).toBe(true);
    expect(draw(card(h)).texts.find((t) => t.str === 'PAGE ONE')?.y).toBeGreaterThan(120);
    h.idle(32);
    h.tap('jump');
    expect(h.top()).toBe(map);
    expect(done).toBe(1);
  });

  it('no pages: done at once', () => {
    const h = makeGame();
    let done = 0;
    playStoryCards(h.game, null, [], () => done++);
    expect(done).toBe(1);
  });

  it('a CardScene without the new options is unchanged (no BACK, on black without a world)', () => {
    const h = makeGame();
    const c = new CardScene(h.game, ['A'], () => {}, null, 1800, { panel: true });
    expect(c.translucent).toBe(false);
    expect(c.touchLabels().attack).toBe('OK');
  });
});
