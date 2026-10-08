import { describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import type { Scene } from '@engine/scene';
import type { Action } from '@engine/input/actions';
import { ScriptedInput } from '@game/sim/headless';
import { CARD_GUARD_FRAMES, CardScene, MessageScene } from '@game/scenes/message';
import { CreditsScene } from '@game/scenes/credits';
import { LevelScene } from '@game/scenes/level';
import { showChapterGate } from '@game/scenes/world-map';
import { playStoryCards } from '@game/story/cards';
import { BowserSaysScene } from '@game/story/level-beats';
import { ToadGuide, type ToadScene } from '@game/map/toad-guide';
import { ShadowTeaseScene } from '@game/tutorial/tease';
import { LINK } from '@game/characters/link';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { CASTLE_PAGES } from '@game/story/script';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import { makeGame, useStorage, type H } from './heroes-harness';

// Owner note 4 (0.4.22): text never moves without a key press. Every card, page and box stays
// up with no input (10,000 frames here, nearly three minutes) and goes on when a key is pressed
// after the card guard. Animations may still run on timers; only text waits.

useStorage();

const LONG = 10_000;

/** Pushes `scene` over a fresh game; `next` counts how often the scene went on. */
function over(h: H, make: (next: () => void) => Scene) {
  const next = vi.fn(() => void h.game.scenes.pop());
  const scene = make(next);
  h.game.scenes.push(scene);
  return { scene, next };
}

describe('cards and boxes wait for a key', () => {
  it.each<[string, (h: H, next: () => void) => Scene, Action]>([
    ['MessageScene', (h, next) => new MessageScene(h.game, ['HELLO'], next), 'jump'],
    ['CardScene (on black)', (h, next) => new CardScene(h.game, ['HELLO'], next), 'attack'],
    [
      'CardScene (panel over the map)',
      (h, next) => new CardScene(h.game, ['HELLO'], next, null, { panel: true, overlay: true }),
      'start',
    ],
    ['BowserSaysScene', (h, next) => new BowserSaysScene(h.game, ['BWA HA HA!'], next), 'jump'],
  ])('%s stays up with no input and closes on a key', (_name, make, key) => {
    const h = makeGame();
    const { scene, next } = over(h, (n) => make(h, n));
    h.idle(LONG);
    expect(next).not.toHaveBeenCalled();
    expect(h.top()).toBe(scene);
    h.tap(key);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('a held key does not skip a card: the 30-frame guard stays', () => {
    const h = makeGame();
    const { next } = over(h, (n) => new MessageScene(h.game, ['HELLO'], n));
    h.tap('jump');
    expect(next).not.toHaveBeenCalled();
    h.idle(CARD_GUARD_FRAMES);
    h.tap('jump');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('story cards (partners, restyle remarks, Larry, the crystal ball): each page waits', () => {
    const h = makeGame();
    const done = vi.fn();
    playStoryCards(h.game, null, [['PAGE ONE'], ['PAGE TWO']], done);
    h.idle(LONG);
    expect((h.top() as CardScene).lines).toEqual(['PAGE ONE']);
    h.tap('jump');
    h.idle(LONG);
    expect((h.top() as CardScene).lines).toEqual(['PAGE TWO']);
    expect(done).not.toHaveBeenCalled();
    h.tap('jump');
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('BACK still skips the rest of a story scene', () => {
    const h = makeGame();
    const done = vi.fn();
    playStoryCards(h.game, null, [['PAGE ONE'], ['PAGE TWO']], done);
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('attack');
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("the chapter gate's card waits", () => {
    const h = makeGame();
    const depth = h.game.scenes.depth;
    showChapterGate(h.game);
    h.idle(LONG);
    expect(h.top()).toBeInstanceOf(CardScene);
    h.tap('jump');
    expect(h.game.scenes.depth).toBe(depth);
  });

  it("Toad's map box waits on each page", () => {
    const said: string[] = [];
    const scenes: ToadScene[] = [{ ids: ['x'], pages: [['ONE'], ['TWO']], walk: false }];
    const guide = new ToadGuide(
      scenes,
      { x: 0, y: 0 },
      {
        markSeen: () => {},
        say: (t) => said.push(t),
        prompt: () => 'OK',
      },
    );
    const input = new ScriptedInput({ steps: [] });
    const run = (n: number, hold: Action[] = []) => {
      for (let i = 0; i < n; i++) {
        input.setHeld(hold);
        input.next();
        guide.update([input]);
      }
    };
    run(LONG);
    expect(guide.lines).toEqual(['ONE']);
    run(1, ['jump']);
    run(1);
    expect(guide.lines).toEqual(['TWO']);
    run(LONG);
    expect(guide.lines).toEqual(['TWO']);
    run(1, ['jump']);
    expect(guide.done).toBe(true);
  });
});

describe("1-0's shadow tease waits for a key once Bowser speaks", () => {
  function tease(h: H) {
    h.game.newGame(MARIO, '1-1');
    h.until(() => h.top() instanceof LevelScene, 400);
    const level = h.top() as LevelScene;
    const state = { ended: false };
    h.game.scenes.push(
      new ShadowTeaseScene(h.game, level.world, LINK, () => {
        state.ended = true;
        h.game.scenes.pop();
      }),
    );
    return state;
  }

  it('outside the campaign: the one page stays until OK', () => {
    const h = makeGame();
    const state = tease(h);
    expect(h.top()?.touchLabels?.()).toMatchObject({ jump: null });
    h.idle(60);
    expect(h.top()?.touchLabels?.()).toMatchObject({ jump: 'SKIP' });
    h.idle(LONG);
    expect(state.ended).toBe(false);
    // Bowser's box shows OK, and so does the touch button that closes it.
    expect(h.top()?.touchLabels?.()).toMatchObject({ jump: 'OK', attack: null });
    h.tap('jump');
    expect(state.ended).toBe(true);
  });
});

describe('the credits', () => {
  it('roll by themselves, but the closing hold waits for a key', () => {
    const h = makeGame();
    const done = vi.fn();
    h.game.scenes.push(new CreditsScene(h.game, [], done));
    h.idle(LONG);
    expect(done).not.toHaveBeenCalled();
    h.tap('jump');
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('castle pages wait for a key per page, then exit', () => {
  function castle(level: LevelData, story: boolean, coop = false) {
    const state = newGameState(MARIO, coop ? LUIGI : null);
    state.world = level.world;
    const axe = (level.entities.find((e) => e.type === 'axe') as { x: number }).x;
    const world = new World(
      level,
      {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST, invulnerable: true },
        reduceFlashing: true,
      },
      state,
      { x: axe - 6, y: 8, mode: 'stand' },
    );
    world.storyMode = story;
    const input = new ScriptedInput({ steps: [] });
    const input2 = new ScriptedInput({ steps: [] });
    let exited = false;
    let placed = false;
    const run = (n: number, hold: Action[] = [], hold2: Action[] = []) => {
      for (let i = 0; i < n && !exited; i++) {
        if (!placed && world.entities.some((e) => e.constructor.name === 'Bowser')) {
          placed = true;
          const p = world.player.body;
          p.x = px(axe * 16 + 2);
          p.y = px(9 * 16) - p.h;
          world.camera.snapTo(p.x);
        }
        input.setHeld(hold);
        input.next();
        input2.setHeld(hold2);
        input2.next();
        world.update(coop ? [input, input2] : [input]);
        for (const ev of world.events.splice(0)) if (ev.type === 'exit') exited = true;
      }
    };
    return { world, run, exited: () => exited };
  }

  it('campaign 1-4: the reveal, OK, the news, OK, then the exit', () => {
    const c = castle(getLevel('1-4'), true);
    const page = CASTLE_PAGES['1-4'];
    if (!page) throw new Error('no 1-4 page');
    c.run(LONG);
    expect(c.world.castleText).toEqual(['THANK YOU MARIO!', '', ...page.reveal]);
    expect(c.world.castleWaiting).toBe(true);
    c.run(1, ['jump']);
    c.run(1);
    c.run(LONG);
    expect(c.world.castleText).toEqual(['THANK YOU MARIO!', '', ...page.news]);
    expect(c.exited()).toBe(false);
    c.run(1, ['jump']);
    expect(c.exited()).toBe(true);
  });

  it('classic 1-4: the NES news waits for OK too', () => {
    const c = castle(getLevel('1-4'), false);
    c.run(LONG);
    expect(c.world.castleText).toEqual(['THANK YOU MARIO!', '', 'BUT OUR PRINCESS IS IN', 'ANOTHER CASTLE!']);
    expect(c.exited()).toBe(false);
    c.run(1, ['attack']);
    expect(c.exited()).toBe(true);
  });

  it("co-op: either player's OK turns the page and exits; MENU does not", () => {
    const c = castle(getLevel('1-4'), true, true);
    const page = CASTLE_PAGES['1-4'];
    if (!page) throw new Error('no 1-4 page');
    c.run(LONG);
    expect(c.world.castleWaiting).toBe(true);
    c.run(1, [], ['start']);
    c.run(1);
    expect(c.world.castleText).toEqual(['THANK YOU MARIO!', '', ...page.reveal]);
    c.run(1, [], ['jump']);
    c.run(LONG);
    expect(c.world.castleText).toEqual(['THANK YOU MARIO!', '', ...page.news]);
    c.run(1, [], ['attack']);
    expect(c.exited()).toBe(true);
  });
});
