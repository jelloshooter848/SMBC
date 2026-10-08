import { describe, expect, it } from 'vitest';
import { LevelScene } from '@game/scenes/level';
import { WorldMapScene } from '@game/scenes/world-map';
import { PauseScene } from '@game/scenes/pause';
import { CARD_GUARD_FRAMES, CardScene } from '@game/scenes/message';
import { MARIO } from '@game/characters/mario';
import { beat } from '@game/story/beats';
import { pageSaid } from '@game/story/cards';
import { BOWSER_SPELL_LAST, BOWSER_SPELL_PAGES, BOWSER_SPELL_SAID } from '@game/story/script';
import { BowserSpellScene, SPELL_TIMING, SPELL_WINDOWS, WINDOWS_END } from '@game/story/bowser-spell';
import { MARIO_TUTORIAL } from '@game/tutorial/mario-1-0';
import { ShadowTeaseScene } from '@game/tutorial/tease';
import { loadSave } from '@game/save/save-files';
import { draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { ALL_STORY } from './story-seen';

// Bowser's spell at the end of 1-0 (0.4.23, docs/STORY.md 2.2): in the campaign it replaces the
// shadow tease; Bowser in full colour, his pages, the wand, the eight windows, his last page.

useStorage();

const level = (h: H) => h.top() as LevelScene;

/** A campaign file in 1-0, the greeting closed, standing near the flag. */
function in10(story: string[] = ALL_STORY.filter((id) => id !== beat.spell)): H {
  const h = makeGame();
  file({ story });
  h.game.openFile(1);
  h.idle(4);
  h.game.enterLevelFromMap('1-0');
  h.until(() => h.top() instanceof CardScene, 400);
  h.idle(CARD_GUARD_FRAMES + 1);
  h.tap('attack'); // the greeting
  expect(h.top()).toBeInstanceOf(LevelScene);
  return h;
}

/** The tutorial's scripted moment, played as the director would; `ended` once it calls back. */
function playBeat(h: H) {
  const state = { ended: false };
  const scene = level(h);
  MARIO_TUTORIAL.beat!.play({ game: h.game, scene }, () => (state.ended = true));
  return state;
}

const spell = (h: H) => h.top() as BowserSpellScene;
const ok = (h: H, key: 'jump' | 'attack' | 'start' = 'jump') => {
  h.idle(CARD_GUARD_FRAMES + 1);
  h.tap(key);
};

describe("Bowser's spell (campaign)", () => {
  it('replaces the tease: the music stops, the sky dims, Bowser appears in full colour, his four pages', () => {
    const h = in10();
    const state = playBeat(h);
    expect(h.top()).toBeInstanceOf(BowserSpellScene);
    expect(h.audio.stopMusic).toHaveBeenCalled();
    expect(spell(h).bowserShown).toBe(false);
    h.idle(SPELL_TIMING.bowserAt);
    expect(spell(h).bowserShown).toBe(true);
    const { sprites } = draw(spell(h));
    // In his castle palette, not a silhouette.
    expect(sprites.some((s) => s.key === 'enemies@enemies-castle' && /^bowser-[02]$/.test(s.frame))).toBe(
      true,
    );
    expect(sprites.some((s) => s.key.includes('silhouette'))).toBe(false);
    h.until(() => spell(h).lines !== null, 60);
    for (let i = 0; i < BOWSER_SPELL_PAGES.length; i++) {
      expect(spell(h).lines).toEqual(BOWSER_SPELL_PAGES[i]);
      expect(h.said.at(-1)).toBe(pageSaid(BOWSER_SPELL_PAGES[i]!, false));
      const texts = draw(spell(h)).texts.map((t) => t.str);
      expect(texts).toEqual(expect.arrayContaining([...BOWSER_SPELL_PAGES[i]!].filter(Boolean)));
      // The wand is out from the second page on.
      const wand = draw(spell(h)).sprites.some(
        (s) => s.key.startsWith('story') && s.frame.startsWith('star-wand'),
      );
      expect(wand).toBe(i >= 1);
      ok(h);
    }
    expect(state.ended).toBe(false);
    expect(spell(h).stage).toBe('raise');
    expect(h.game.seen(beat.spell)).toBe(true);
  });

  it('the spell: eight windows, each hero in the captive palette, in world order; then the last page', () => {
    const h = in10();
    playBeat(h);
    h.until(() => spell(h).lines !== null, 200);
    for (let i = 0; i < BOWSER_SPELL_PAGES.length; i++) ok(h);
    h.until(() => spell(h).windows, 200);
    expect(h.said.at(-1)).toBe(BOWSER_SPELL_SAID);
    h.idle(WINDOWS_END - 10);
    expect(spell(h).windows).toBe(true);
    const { sprites, texts } = draw(spell(h));
    for (const w of SPELL_WINDOWS)
      expect(
        sprites.some((s) => s.key.endsWith('~brainwashed') && s.key.includes(w.hero)),
        w.hero,
      ).toBe(true);
    expect(texts.map((t) => t.str)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    // No names on screen.
    expect(texts.some((t) => /LUIGI|LINK|MEGA|SAMUS|SIMON|RYU|BILL|SOPHIA/.test(t.str))).toBe(false);
    h.idle(20);
    expect(spell(h).lines).toEqual(BOWSER_SPELL_LAST);
    expect(h.said.at(-1)).toBe(pageSaid(BOWSER_SPELL_LAST, true));
  });

  it('OK while the windows open skips to the last page; OK ends it: a puff, the music back', () => {
    const h = in10();
    const state = playBeat(h);
    h.until(() => spell(h).lines !== null, 200);
    for (let i = 0; i < BOWSER_SPELL_PAGES.length; i++) ok(h);
    h.until(() => spell(h).windows, 200);
    ok(h);
    expect(spell(h).lines).toEqual(BOWSER_SPELL_LAST);
    ok(h);
    expect(spell(h).stage).toBe('vanish');
    expect(spell(h).bowserShown).toBe(true);
    h.audio.playMusic.mockClear();
    h.idle(SPELL_TIMING.vanish);
    expect(state.ended).toBe(true);
    expect(h.audio.playMusic).toHaveBeenCalled();
    expect(h.top()).toBeInstanceOf(LevelScene);
  });

  it('no page moves on by itself; BACK on a page skips the rest of the scene', () => {
    const h = in10();
    const state = playBeat(h);
    h.until(() => spell(h).lines !== null, 200);
    h.idle(5000);
    expect(spell(h).lines).toEqual(BOWSER_SPELL_PAGES[0]);
    ok(h);
    expect(spell(h).lines).toEqual(BOWSER_SPELL_PAGES[1]);
    ok(h, 'attack');
    expect(spell(h).stage).toBe('vanish');
    h.idle(SPELL_TIMING.vanish);
    expect(state.ended).toBe(true);
    expect(h.said.includes(BOWSER_SPELL_SAID)).toBe(false);
  });

  it('plays every time 1-0 is played (not once per file)', () => {
    const h = in10([...ALL_STORY]);
    playBeat(h);
    expect(h.top()).toBeInstanceOf(BowserSpellScene);
  });

  it('outside the campaign the shadow tease plays as before', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '1-0');
    h.until(() => h.top() instanceof CardScene, 400);
    for (let i = 0; i < 10 && h.top() instanceof CardScene; i++) ok(h);
    expect(h.top()).toBeInstanceOf(LevelScene);
    playBeat(h);
    expect(h.top()).toBeInstanceOf(ShadowTeaseScene);
  });
});

describe('Pause → Skip tutorial', () => {
  const skip = (h: H) => {
    h.game.scenes.push(new PauseScene(h.game));
    h.step();
    h.game.skipTutorial();
    h.step();
  };

  it('on a file that never saw the spell: it plays before 1-0 closes, then the map with 1-0 cleared', () => {
    const h = in10();
    skip(h);
    expect(h.top()).toBeInstanceOf(BowserSpellScene);
    h.until(() => spell(h).lines !== null, 200);
    ok(h, 'attack');
    h.until(() => h.top() instanceof WorldMapScene, 600);
    expect(loadSave(1)?.cleared).toContain('1-0');
    expect(h.game.seen(beat.spell)).toBe(true);
  });

  it('once seen, Skip tutorial goes straight to the map', () => {
    const h = in10([...ALL_STORY]);
    skip(h);
    h.until(() => h.top() instanceof WorldMapScene, 600);
    expect(loadSave(1)?.cleared).toContain('1-0');
  });
});
