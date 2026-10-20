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
import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import { BackupCardScene } from '@game/scenes/backup-card';
import { LoadCodeScene } from '@game/scenes/save-codes';
import { ShopCardScene, SHOP_CARD_GUARD } from '@game/town/shop-card';
import type { ShopEntry } from '@game/town/shop';
import { InventoryScene } from '@game/bonus/inventory';
import type { UseOutcome } from '@game/bonus/use';
import { InstallGuideScene } from '@game/pwa/home-screen';
import { ToadGuide } from '@game/map/toad-guide';
import { GateScene, GATE_MISFIRE_FRAMES } from '@game/map/gate-scene';
import type { WorldExit } from '@game/map/types';
import { encodeSaveCode, readSaveCode } from '@game/save/save-code';
import { newSave } from '@game/save/save-files';

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
  /** The first frame its buttons show (and a tap works): the card's guard. */
  from?: number;
}

const SHOP: ShopEntry = {
  slot: 'grow',
  id: 'mushroom',
  name: 'MUSHROOM',
  does: 'Grows you',
  price: 5,
  icon: {} as ShopEntry['icon'],
  mark: null,
};

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
  {
    name: 'BACK UP YOUR GAME? (BackupCard, NOT NOW)',
    button: 'attack',
    open: (h) => {
      h.game.scenes.push(new BackupCardScene(h.game, 1));
      return () => h.game.scenes.top === base;
    },
  },
  {
    name: "a code that doesn't load (LoadCodeScene's message)",
    button: 'jump',
    from: CARD_GUARD_FRAMES / 2,
    open: (h) => {
      let done = false;
      h.game.scenes.push(new LoadCodeScene(h.game, readSaveCode('XX', 1), { done: () => (done = true) }));
      return () => done;
    },
  },
  {
    name: 'LOAD THIS SAVE? (LoadCodeScene, picking the file)',
    button: 'jump',
    from: CARD_GUARD_FRAMES / 2,
    open: (h) => {
      const scene = new LoadCodeScene(h.game, readSaveCode(encodeSaveCode(newSave(1, 'mario')), 1), {
        done: () => undefined,
      });
      h.game.scenes.push(scene);
      return () => scene.mode !== 'pick';
    },
  },
  {
    name: "the shop's BUY? card (ShopCard)",
    button: 'jump',
    from: SHOP_CARD_GUARD,
    open: (h) => {
      let answered = false;
      h.game.scenes.push(new ShopCardScene(h.game, SHOP, null, () => (answered = true)));
      return () => answered;
    },
  },
  {
    name: "the shopkeeper's reply (ShopCard)",
    button: 'jump',
    from: SHOP_CARD_GUARD,
    open: (h) => {
      let answered = false;
      h.game.scenes.push(new ShopCardScene(h.game, SHOP, ['NOT ENOUGH COINS!'], () => (answered = true)));
      return () => answered;
    },
  },
  {
    name: "the bonus inventory's note after a use",
    button: 'jump',
    from: 9,
    open: (h) => {
      const inv = new InventoryScene(h.game);
      h.game.scenes.push(inv);
      inv.note = { ok: true, lines: ['GIVEN NEXT LEVEL'], said: '', t: 0 } as unknown as UseOutcome & {
        t: number;
      };
      return () => inv.note === null;
    },
  },
  {
    name: 'the Home Screen guide (InstallGuideScene)',
    button: 'jump',
    open: (h) => {
      let closed = false;
      h.game.scenes.push(new InstallGuideScene(h.game, 'ios-safari', () => (closed = true)));
      return () => closed;
    },
  },
];

/** One frame with `key` newly pressed (or nothing). */
const press = (key: Action | null): InputFrame => ({ ...NO_INPUT, pressed: (a: Action) => a === key });

/** Map overlays (not scenes): `ready` says whether OK shows; a press then must change the state. */
interface Overlay {
  update(inputs: readonly InputFrame[]): void;
  readonly ready: boolean;
}

function checkOverlay(make: () => Overlay, state: (o: Overlay) => string, frames: number): number {
  let firstReady = -1;
  for (let k = 0; k < frames; k++) {
    const a = make();
    const b = make();
    for (let i = 0; i < k; i++) {
      a.update([NO_INPUT]);
      b.update([NO_INPUT]);
    }
    const ready = a.ready;
    a.update([press('jump')]);
    b.update([NO_INPUT]);
    expect(state(a) !== state(b), `frame ${k}: ready ${ready}`).toBe(ready);
    if (ready && firstReady < 0) firstReady = k;
  }
  return firstReady;
}

const toad = () =>
  new ToadGuide(
    [
      {
        ids: ['t'],
        pages: [
          ['TOAD:', '', 'ONE'],
          ['TOAD:', '', 'TWO'],
        ],
        walk: false,
      },
    ],
    { x: 40, y: 100 },
    { markSeen: () => undefined, say: () => undefined, prompt: () => 'OK' },
  );
const toadState = (o: Overlay) => JSON.stringify((o as ToadGuide).lines);

const gate = () =>
  new GateScene(
    {
      world: 1,
      exit: {} as WorldExit,
      bowser: [
        ['BOWSER:', '', 'ONE'],
        ['BOWSER:', '', 'TWO'],
      ],
      toad: [],
      tear: false,
    },
    { x: 0, y: 0 },
    { say: () => undefined, sfx: () => undefined, prompt: () => 'OK', reduceFlashing: () => true },
  );
const gateState = (o: Overlay) => {
  const g = o as GateScene;
  // `ready` too: a press on the misfire's last frame hurries it onto the page the misfire was
  // about to reach anyway, which then starts its own guard (the press is still taken).
  return `${String(g.cutaway)} ${JSON.stringify(g.lines)} ${String(g.ready)}`;
};

describe("touch: Toad's map pages and the gate's cutaway show OK only when it works", () => {
  it("Toad's pages: ready <=> the first OK turns the page, at every frame", () => {
    expect(checkOverlay(toad, toadState, CARD_GUARD_FRAMES + 10)).toBe(CARD_GUARD_FRAMES);
  });

  it("the gate: ready <=> OK hurries the misfire or turns Bowser's page, at every frame", () => {
    expect(checkOverlay(gate, gateState, GATE_MISFIRE_FRAMES + 120)).toBeGreaterThan(0);
  });

  it("the gate's buttons never blink off between the misfire and Bowser's first page", () => {
    const g = gate();
    const seen: boolean[] = [];
    for (let i = 0; i < GATE_MISFIRE_FRAMES + 200; i++) {
      g.update([NO_INPUT]);
      seen.push(g.ready);
    }
    const first = seen.indexOf(true);
    expect(first).toBeGreaterThan(0);
    expect(seen.slice(first).every(Boolean)).toBe(true);
    expect(g.lines).not.toBeNull(); // still on Bowser's first page, waiting for OK
  });
});

describe('touch: a card shows OK only when the first tap on it works', () => {
  for (const c of CASES)
    it(`${c.name}: shown <=> the first tap moves it on, at every frame`, () => {
      let shownFrom = -1;
      const from = c.from ?? CARD_GUARD_FRAMES;
      for (let k = 0; k <= from + 10; k++) {
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
      expect(shownFrom).toBe(from);
    });

  it('during the guard every button is hidden (no dead OK on screen)', () => {
    const h = makeGame();
    h.game.scenes.push(new CardScene(h.game, ['A'], () => undefined, null, { keys: ['jump', 'start'] }));
    const l = labels(h.game);
    expect([l.jump, l.attack, l.special, l.start, l.select]).toEqual([null, null, null, null, null]);
  });
});
