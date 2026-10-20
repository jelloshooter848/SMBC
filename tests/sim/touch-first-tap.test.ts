import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { defaultSettings } from '@engine/save/settings';
import type { TouchLabels } from '@engine/input/touch';
import type { Action } from '@engine/input/actions';
import type { Scene } from '@engine/scene';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { CardScene, CARD_GUARD_FRAMES, MessageScene } from '@game/scenes/message';
import { playStoryCards } from '@game/story/cards';
import { showChapter1Gate } from '@game/scenes/chapter1-gate';
import { MENU_TOUCH_LABELS } from '@game/touch-labels';
import { CHARACTERS } from '@game/characters/registry';

// The phone "first tap ignored on text cards" bug (owner-approved fix for 0.5.0): a card showed its
// OK touch button from its first frame, but ignored presses for CARD_GUARD_FRAMES (the guard that
// keeps a press meant for the level from skipping it). A player who tapped OK as soon as it
// appeared (typically right after the WORLD card or the previous page) saw nothing happen and had
// to tap again. Now a card's buttons show only once a tap on them works: shown <=> the first tap
// moves it on, at every frame.

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const assets = {
  sheet: (name: string) => ({ name, frames: new Map() }),
} as unknown as AssetRegistry;

function makeGame() {
  const game = new Game({
    ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    settings: defaultSettings(),
    controlScheme: () => 'touch',
  });
  const p1 = new ScriptedInput({ steps: [] });
  const step = (a: Action[] = []) => {
    p1.setHeld(a);
    p1.next();
    game.scenes.update([p1]);
  };
  return { game, step };
}
type H = ReturnType<typeof makeGame>;

/** What main.ts hands the touch pad: the top scene's labels over the menu defaults. */
const labels = (game: Game): TouchLabels => ({ ...MENU_TOUCH_LABELS, ...game.scenes.top?.touchLabels?.() });

/** A base scene under the card, so popping the card leaves something on top. */
const base: Scene = { update: () => undefined, render: () => undefined };

interface Case {
  name: string;
  /** Opens the card on `h` (over `base`); returns a check that it has moved on. */
  open: (h: H) => () => boolean;
  /** The touch button that moves it on. */
  button: Action;
}

const CASES: Case[] = [
  {
    name: 'a message (MessageScene)',
    button: 'jump',
    open: (h) => {
      let done = false;
      h.game.scenes.push(new MessageScene(h.game, ['HI'], () => (done = true)));
      return () => done;
    },
  },
  {
    name: 'a closing card (CardScene, OK on B)',
    button: 'attack',
    open: (h) => {
      let done = false;
      h.game.scenes.push(new CardScene(h.game, ['THANK YOU'], () => (done = true)));
      return () => done;
    },
  },
  {
    name: "a story page (Toad's and the partners' cards)",
    button: 'jump',
    open: (h) => {
      let done = false;
      playStoryCards(h.game, null, [['TOAD:', '', 'HELLO!']], () => (done = true));
      return () => done;
    },
  },
  {
    name: 'the Chapter 1 gate card (G-100)',
    button: 'jump',
    open: (h) => {
      showChapter1Gate(h.game);
      return () => h.game.scenes.top === base;
    },
  },
];

describe('touch: a card shows OK only when the first tap on it works', () => {
  for (const c of CASES)
    it(`${c.name}: shown <=> the first tap moves it on, at every frame`, () => {
      let shownFrom = -1;
      for (let k = 0; k <= CARD_GUARD_FRAMES + 10; k++) {
        const h = makeGame();
        h.game.scenes.push(base);
        const moved = c.open(h);
        for (let i = 0; i < k; i++) h.step();
        const label = labels(h.game)[c.button];
        h.step([c.button]); // one tap
        h.step();
        expect(!!label, `frame ${k}: label ${String(label)}, moved ${moved()}`).toBe(moved());
        if (label && shownFrom < 0) shownFrom = k;
      }
      // Hidden through the guard, then shown for good.
      expect(shownFrom).toBe(CARD_GUARD_FRAMES);
    });

  it('during the guard every button is hidden (no dead OK on screen)', () => {
    const h = makeGame();
    h.game.scenes.push(new CardScene(h.game, ['A'], () => undefined, null, { keys: ['jump', 'start'] }));
    const l = labels(h.game);
    expect([l.jump, l.attack, l.special, l.start, l.select]).toEqual([null, null, null, null, null]);
  });
});
