import { afterEach, describe, expect, it } from 'vitest';
import { loadProgress } from '@engine/save/progress';
import { SETTINGS_KEY } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { CreditsScene } from '@game/scenes/credits';
import { CardScene, MessageScene } from '@game/scenes/message';
import { PauseScene } from '@game/scenes/pause';
import { QuitRunScene } from '@game/scenes/quit-run';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { REPLAY_HELP_KEY } from '@game/scenes/original-replay';
import { loadClearedFile, type ClassicFileRef } from '@game/original-files';
import { store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';
import { pickAtContinue } from './continue-select';
import { classic, inLevel, keepCleared, openFiles } from './cleared-nav';

// v0.4.73 owner follow-ups on #209. 98: the beat (the beaten record and the cheat unlocks) is
// recorded when the file is written CLEARED, before the credits roll, so a tab closed during
// the credits loses nothing; it is recorded once, and developer and practice runs record
// nothing. 97a: in a replay, Quit names the file box, not the Classic menu.

useStorage();
afterEach(() => store.clear());

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const storedSettings = () =>
  JSON.parse(store.get(SETTINGS_KEY) ?? '{}') as {
    classicCheats?: { beaten?: Record<string, boolean>; unlocked?: Record<string, boolean> };
  };

describe('98: the beat is kept before the credits', () => {
  it('the tab closes mid-credits: the beat, the unlocks and the CLEARED file are all stored', () => {
    const h = classic();
    h.game.classicGame(MARIO, '8-4', { ref: A });
    h.until(() => inLevel(h), 900);
    h.game.showEnding('8-4');
    expect(h.top()).toBeInstanceOf(CreditsScene);
    h.idle(30);
    // The tab closes here: nothing after this point runs. What is in storage now is all there is.
    expect(loadClearedFile(A)).not.toBeNull();
    expect(loadProgress().classicBeat?.smb).toBe('normal');
    expect(storedSettings().classicCheats?.beaten?.smb).toBe(true);
    expect(storedSettings().classicCheats?.unlocked?.infiniteLives).toBe(true);
  });

  it('the credits ending normally record nothing twice: each unlock card shows once', () => {
    const h = classic();
    h.game.classicGame(MARIO, '8-4', { ref: A });
    h.until(() => inLevel(h), 900);
    h.game.showEnding('8-4');
    const before = store.get(SETTINGS_KEY);
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    expect(store.get(SETTINGS_KEY)).toBe(before);
    const cards: string[] = [];
    for (let i = 0; i < 20 && (h.top() instanceof MessageScene || h.top() instanceof CardScene); i++) {
      cards.push(JSON.stringify((h.top() as unknown as { lines: string[] }).lines));
      h.idle(40);
      h.tap('jump');
    }
    expect(cards.length).toBeGreaterThan(0);
    expect(new Set(cards).size).toBe(cards.length);
    expect(loadProgress().classicBeat?.smb).toBe('normal');
  });

  it('a developer run records nothing, before or after the credits', () => {
    const h = classic();
    h.game.devClassicGame(MARIO, '8-4', 'classic', true);
    h.until(() => inLevel(h), 900);
    h.game.showEnding('8-4');
    expect(loadProgress().classicBeat?.smb ?? 'none').toBe('none');
    expect(h.settings.classicCheats.beaten.smb).toBe(false);
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    expect(loadProgress().classicBeat?.smb ?? 'none').toBe('none');
  });

  it('a practice run records nothing', () => {
    const h = classic((s) => (s.classicCheats.levelSelect = true));
    h.game.showClassicMenu();
    h.game.classicLevelSelect('8-4');
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    h.game.showEnding('8-4');
    expect(loadProgress().classicBeat?.smb ?? 'none').toBe('none');
    expect(h.settings.classicCheats.beaten.smb).toBe(false);
  });
});

describe('97a: Quit in a replay names the file box', () => {
  it('the pause row and the question', () => {
    keepCleared(A);
    store.set(REPLAY_HELP_KEY, 'true');
    const h = classic();
    openFiles(h);
    choose(h, 'File 1');
    choose(h, 'World 1');
    choose(h, '1-1');
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    const pause = new PauseScene(h.game, (h.top() as LevelScene).world);
    const quit = (pause as unknown as { items: MenuItem[] }).items.find((i) => i.label === 'Quit');
    expect(quit?.hint).toMatch(/file box/i);
    expect(quit?.hint).not.toMatch(/Classic menu/);
    h.game.scenes.push(pause);
    choose(h, 'Quit');
    expect(h.top()).toBeInstanceOf(QuitRunScene);
    expect((h.top() as QuitRunScene).title).toMatch(/FILE BOX/);
    expect(h.said.at(-1)).toMatch(/^Quit to the file box\?/);
  });
});
