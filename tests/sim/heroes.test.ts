import { describe, expect, it, vi } from 'vitest';
import { toPx, px } from '@engine/math/units';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { FileSelectScene } from '@game/scenes/file-select';
import { CardScene, CARD_GUARD_FRAMES, MessageScene } from '@game/scenes/message';
import { MenuScene } from '@game/scenes/menu';
import { WorldMapScene } from '@game/scenes/world-map';
import { captiveDialogue, CARD_COLS, freedCard } from '@game/scenes/free-hero';
import { freedTalk } from '@game/story/script';
import { fontText } from '@game/hud/text';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import type { Captive } from '@game/entities/objects/captive';
import { loadSave, newSave } from '@game/save/save-files';
import { miniGameFor, type MiniGameDef, type MiniGameResult } from '@game/minigames';
import type { Action } from '@engine/input/actions';
import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Game } from '@game/scenes/game';
import { TOAD_PAGES } from '@game/tutorial/mario-1-0';
import {
  captives,
  draw,
  file,
  intoBonus,
  makeGame,
  offered,
  skipFreedTalk,
  standByLuigi,
  store,
  talkIntoMiniGame,
  useStorage,
  type H,
} from './heroes-harness';
import { skipOpening } from './story-seen';

// Freeing the heroes (0.5.0): a campaign file starts with Mario only; the others are brainwashed
// captives to find. Luigi waits in the 1-1 bonus room; talking to him starts his mini game. The
// flow is tested against a stub MiniGameDef (the contract only): jump passes, attack fails, menu
// quits, and special scribbles over the run's state before passing. The real Mirror Race has its
// own sims (heroes-race.test.ts, minigames/luigi/race.test.ts).

vi.mock('@game/minigames', () => {
  const stub: MiniGameDef = {
    hero: 'luigi',
    title: 'STUB RACE',
    rules: ['JUMP PASSES.', 'ATTACK FAILS.'],
    create(game: Game, done: (r: MiniGameResult) => void, opts?: { retry?: boolean }): Scene {
      let over = false;
      const end = (r: MiniGameResult) => {
        if (over) return;
        over = true;
        done(r);
      };
      const round: Scene & { retry: boolean } = {
        // Whether the flow started this round as a TRY AGAIN.
        retry: opts?.retry === true,
        update(input: InputFrame) {
          if (input.pressed('jump')) end('pass');
          else if (input.pressed('attack')) end('fail');
          else if (input.pressed('start')) end('quit');
          else if (input.pressed('special')) {
            // A round that tramples the run: the flow must put it back.
            const s = game.state;
            s.lives = 42;
            s.score = 99999;
            s.powerState = 'fire';
            s.kit.junk = 1;
            game.state = { ...s, coins: 77 };
            end('pass');
          }
        },
        render() {},
      };
      return round;
    },
  };
  return { MINIGAMES: { luigi: stub }, miniGameFor: (hero: string) => (hero === 'luigi' ? stub : null) };
});

useStorage();

describe('save files lock heroes in campaign play', () => {
  it('a new file offers only Mario: the others are black silhouettes named ???, skipped by the cursor', () => {
    const h = makeGame();
    file();
    h.game.openFile(1);
    expect(h.game.freed).toEqual(['mario']);
    expect(h.game.heroLocked(MARIO)).toBe(false);
    expect(h.game.heroLocked(LUIGI)).toBe(true);
    h.game.enterLevelFromMap('1-1');
    const cs = h.top() as CharacterSelectScene;
    expect(cs).toBeInstanceOf(CharacterSelectScene);
    expect(h.said.some((t) => /8 heroes still to be found/i.test(t))).toBe(true);
    h.idle(12);
    const { texts, sprites } = draw(cs);
    expect(texts.filter((t) => t.str === '???')).toHaveLength(CHARACTERS.length - 1);
    expect(texts.map((t) => t.str)).toContain('MARIO');
    expect(texts.map((t) => t.str)).not.toContain('LUIGI');
    // Every locked hero drawn with the silhouette palette, Mario in his own colours.
    for (const c of CHARACTERS.slice(1))
      expect(sprites.some((s) => s.key === `${c.portrait.sheet}@${c.portrait.palette}~silhouette`)).toBe(
        true,
      );
    expect(sprites.some((s) => s.key === 'mario@mario')).toBe(true);
    expect(offered(h).every((n) => n === 'Mario')).toBe(true);
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene);
    expect(h.game.state.character).toBe(MARIO);
  });

  it('an old v2 file keeps Mario and its last hero; the death pick respects it', () => {
    const h = makeGame();
    store.set(
      'smbc.save.1',
      JSON.stringify({ ...newSave(1, 'link'), v: 2, freed: undefined, powerState: 'full', hp: 6 }),
    );
    h.game.openFile(1);
    expect(h.game.freed).toEqual(['mario', 'link']);
    expect(h.game.state.character).toBe(LINK);
    h.game.markSeen('luigi-runs'); // 1-1's opening beat is another story
    h.game.enterLevelFromMap('1-1');
    h.idle(12);
    expect(new Set(offered(h))).toEqual(new Set(['Mario', 'Link']));
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene);
    // A death goes through the pick again: still only those two.
    (h.top() as LevelScene).world.events.push({ type: 'died' });
    h.step();
    h.until(() => h.top() instanceof CharacterSelectScene);
    h.idle(12);
    expect(new Set(offered(h))).toEqual(new Set(['Mario', 'Link']));
    expect(h.said.some((t) => /7 heroes still to be found/i.test(t))).toBe(true);
  });

  it('a file whose hero is somehow locked falls back to Mario', () => {
    const h = makeGame();
    file({ freed: ['mario'] }, LINK.id);
    h.game.openFile(1);
    expect(h.game.state.character).toBe(MARIO);
    h.game.autosave();
    expect(loadSave(1)?.character).toBe('mario');
  });

  it('non-campaign starts keep every hero (dev start, ?level=, the title pick)', () => {
    const h = makeGame();
    file();
    h.game.openFile(1);
    expect(h.game.heroLocked(LUIGI)).toBe(true);
    h.game.devStart('1-1', MARIO, 'small');
    expect(h.game.campaign).toBeNull();
    for (const c of CHARACTERS) expect(h.game.heroLocked(c)).toBe(false);
    // ?level= / title → character select → level: all heroes offered.
    h.game.pendingLevel = '1-2';
    h.game.showCharacterSelect();
    h.idle(12);
    expect(new Set(offered(h))).toEqual(new Set(CHARACTERS.map((c) => c.name)));
    const { texts } = draw(h.top() as CharacterSelectScene);
    expect(texts.some((t) => t.str === '???')).toBe(false);
  });
});

describe('the story intro', () => {
  it('a NEW file opens straight on the World 1 map, on 1-0, where Toad tells the story', () => {
    const h = makeGame();
    h.game.showTitle();
    h.idle(8);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(FileSelectScene);
    h.idle(8);
    h.tap('jump');
    skipOpening(h); // the story's opening first (opening.test.ts)
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect((h.top() as WorldMapScene).node).toBe('start');
    expect(loadSave(1)?.freed).toEqual(['mario']);
    expect(h.game.campaign).toEqual({ slot: 1 });
    // The story is Toad's, in 1-0 (tests/sim/tutorial.test.ts).
    expect(TOAD_PAGES.flat().join(' ')).toMatch(/BRAINWASHED THE HEROES OF OTHER WORLDS/);
  });

  it('an existing file opens straight on its map', () => {
    const h = makeGame();
    file({ cleared: ['1-0'] });
    h.game.showTitle();
    h.idle(8);
    h.tap('start');
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
  });
});

describe('the captive Luigi in the 1-1 bonus room', () => {
  it('spawns in campaign play on his ledge, with no collision damage', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    const cs = captives(l);
    expect(cs).toHaveLength(1);
    const c = cs[0] as Captive;
    expect(c.hero.id).toBe('luigi');
    // Top right: on the ledge at row 7, columns 12-14 (feet on its top).
    expect(toPx(c.body.x) >> 4).toBeGreaterThanOrEqual(12);
    expect(toPx(c.body.y + c.body.h)).toBe(7 * 16);
    // Touching him does nothing to the player.
    const p = l.world.player;
    p.body.x = c.body.x;
    p.body.y = c.body.y + c.body.h - p.body.h;
    h.idle(10);
    expect(p.dead).toBe(false);
    expect(p.stun ?? 0).toBe(0);
  });

  it('does not spawn once Luigi is freed on this file, nor outside campaign play', () => {
    const h = makeGame();
    file({ freed: ['mario', 'luigi'] });
    expect(captives(intoBonus(h))).toHaveLength(0);
    const h2 = makeGame();
    h2.game.devStart('1-1-bonus', MARIO, 'small');
    h2.until(() => h2.top() instanceof LevelScene);
    h2.idle(5);
    expect(captives(h2.top() as LevelScene)).toHaveLength(0);
  });

  it('shows TALK only while a player stands within reach on the ground', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    h.idle(5);
    const c = captives(l)[0] as Captive;
    expect(c.prompt).toBe(false);
    expect(draw(l).texts.some((t) => t.str === 'TALK')).toBe(false);
    standByLuigi(h, l);
    expect(c.prompt).toBe(true);
    expect(draw(l).texts.some((t) => t.str === 'TALK')).toBe(true);
    // Talking hides it under the dialogue box.
    h.tap('up');
    expect(h.top()).not.toBe(l);
    expect(c.prompt).toBe(false);
    expect(draw(l).texts.some((t) => t.str === 'TALK')).toBe(false);
  });

  it('a scripted Mario can reach talking range from where he falls in', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    const c = captives(l)[0] as Captive;
    const p = l.world.player;
    // Land, run right, hop onto the brick block, run along it and jump for the ledge.
    let reached = false;
    for (let f = 0; f < 600 && !reached; f++) {
      const x = toPx(p.body.x);
      const onBlock = p.body.onGround && toPx(p.body.y + p.body.h) === 160;
      const held: Action[] = ['right', 'attack'];
      if (p.body.onGround && toPx(p.body.y + p.body.h) === 208 && x >= 36 && x < 60) held.push('jump');
      else if (onBlock && x >= 150) held.push('jump');
      else if (!p.body.onGround && p.body.vy < 0) held.push('jump');
      if (c.prompt) reached = true;
      h.step(c.body.x - p.body.x < px(20) ? [] : held);
    }
    expect(reached).toBe(true);
    expect(c.inReach(p)).toBe(true);
  });
});

describe('freeing Luigi', () => {
  it('talk → dialogue → rules → mini game pass: Luigi is free, saved, gone from the room, and selectable', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    standByLuigi(h, l);
    const before = { x: l.world.player.body.x, y: l.world.player.body.y, power: l.world.player.powerState };
    h.tap('up');
    expect(h.top()).toBeInstanceOf(CardScene);
    expect(h.said.some((t) => /luigi serves king koopa/i.test(t))).toBe(true);
    const def = miniGameFor('luigi')!;
    let sawRules = false;
    for (let i = 0; i < 6 && (h.top() instanceof CardScene || h.top() instanceof MessageScene); i++) {
      const t = draw(h.top() as CardScene).texts.map((x) => x.str);
      if (t.includes(def.title) && def.rules.every((r) => t.includes(r))) sawRules = true;
      h.idle(32);
      h.tap('jump');
    }
    expect(sawRules).toBe(true);
    h.tap('jump'); // the placeholder: jump passes
    skipFreedTalk(h); // (the talk: its own sims below)
    expect(h.top()).toBeInstanceOf(CardScene);
    expect((h.top() as CardScene).lines).toContain('LUIGI IS FREE!');
    // Saved at once.
    expect(h.game.freed).toContain('luigi');
    expect(loadSave(1)?.freed).toEqual(['mario', 'luigi']);
    h.idle(32);
    h.tap('jump');
    expect(h.top()).toBe(l);
    expect(captives(l)).toHaveLength(0);
    const p = l.world.player;
    expect({ x: p.body.x, y: p.body.y, power: p.powerState }).toEqual(before);
    // The room plays on; the next pick offers Luigi.
    h.idle(30);
    expect(h.top()).toBe(l);
    h.game.returnToMap();
    h.game.enterLevelFromMap('1-1');
    h.idle(12);
    expect(new Set(offered(h))).toEqual(new Set(['Mario', 'Luigi']));
  });

  it('fail → TRY AGAIN? YES starts a fresh round, which can pass', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    standByLuigi(h, l);
    const round1 = talkIntoMiniGame(h, l);
    h.tap('attack'); // the placeholder: attack fails
    const menu = h.top() as MenuScene;
    expect(menu).toBeInstanceOf(MenuScene);
    expect(menu.title).toBe('TRY AGAIN?');
    h.idle(8);
    h.tap('jump'); // YES
    const round2 = h.top();
    expect(round2).not.toBe(round1);
    expect(round2).not.toBeInstanceOf(MenuScene);
    // The flow tells the round it is a retry (the Mirror Race then skips its lives card).
    expect((round1 as unknown as { retry: boolean }).retry).toBe(false);
    expect((round2 as unknown as { retry: boolean }).retry).toBe(true);
    h.tap('jump'); // pass
    expect(h.game.freed).toContain('luigi');
    skipFreedTalk(h);
    h.idle(32);
    h.tap('jump');
    expect(h.top()).toBe(l);
    expect(captives(l)).toHaveLength(0);
  });

  it('fail → NO, and quit, go back to the level with Luigi still captive and locked', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    standByLuigi(h, l);
    talkIntoMiniGame(h, l);
    h.tap('attack');
    h.idle(8);
    h.tap('down'); // NO
    h.tap('jump');
    expect(h.top()).toBe(l);
    expect(captives(l)).toHaveLength(1);
    // Talk again and quit from the round.
    h.idle(5);
    talkIntoMiniGame(h, l);
    h.tap('start'); // the placeholder: menu quits
    expect(h.top()).toBe(l);
    expect(captives(l)).toHaveLength(1);
    expect(h.game.freed).toEqual(['mario']);
    expect(loadSave(1)?.freed).toEqual(['mario']);
    expect(h.game.heroLocked(LUIGI)).toBe(true);
  });

  it('the level timer does not run during the whole flow', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    standByLuigi(h, l);
    h.step(['up']); // the level's last frame: the talk
    expect(h.top()).toBeInstanceOf(CardScene);
    const time = l.world.time;
    const frame = l.world.frame;
    h.step();
    for (let i = 0; i < 6 && (h.top() instanceof CardScene || h.top() instanceof MessageScene); i++) {
      h.idle(200);
      h.tap('jump');
    }
    h.idle(300); // a long round
    h.tap('jump'); // pass
    h.idle(200);
    h.step(['attack']); // BACK skips Luigi's talk
    h.idle(200);
    h.step(['jump']); // the freed card: back to the level
    expect(h.top()).toBe(l);
    expect(l.world.time).toBe(time);
    expect(l.world.frame).toBe(frame);
    h.step();
    expect(l.world.frame).toBe(frame + 1);
  });

  it('back in the level its music (and the hurry tempo) restarts after the round stopped it', () => {
    for (const [time, tempo] of [
      [300, 1],
      [90, 1.4],
    ] as const) {
      const h = makeGame();
      file();
      const l = intoBonus(h, time);
      standByLuigi(h, l);
      talkIntoMiniGame(h, l);
      h.audio.stopMusic(); // as a mini game does before it reports
      h.audio.playMusic.mockClear();
      h.audio.setTempoScale.mockClear();
      h.tap('start'); // quit
      expect(h.top()).toBe(l);
      expect(h.audio.playMusic).toHaveBeenLastCalledWith('underground');
      expect(h.audio.setTempoScale).toHaveBeenLastCalledWith(tempo);
    }
  });

  it('the OK press that closes the last card does not make the hero jump back in the level', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    standByLuigi(h, l);
    talkIntoMiniGame(h, l);
    h.tap('attack'); // fail
    h.idle(8);
    h.tap('down');
    h.step(['jump']); // NO
    expect(h.top()).toBe(l);
    const y = l.world.player.body.y;
    for (let i = 0; i < 20; i++) {
      h.step();
      expect(l.world.player.body.y).toBe(y);
    }
  });
});

describe("the freed hero's talk (0.4.23, docs/STORY.md 2.13)", () => {
  /** Into the stub round and pass it: Luigi's talk shows. */
  function pass(h: H): LevelScene {
    file();
    const l = intoBonus(h);
    standByLuigi(h, l);
    talkIntoMiniGame(h, l);
    h.tap('jump');
    return l;
  }

  it('Luigi talks over the level, still standing there, before the freed card; OK reads every page', () => {
    const h = makeGame();
    const l = pass(h);
    const pages = freedTalk('luigi', 'MARIO');
    expect(pages.length).toBeGreaterThan(3);
    // Free and saved already; still in the room while he talks.
    expect(loadSave(1)?.freed).toEqual(['mario', 'luigi']);
    for (const [i, page] of pages.entries()) {
      const card = h.top() as CardScene;
      expect(card).toBeInstanceOf(CardScene);
      expect(card.lines).toEqual(page);
      expect(captives(l)).toHaveLength(1);
      const last = i === pages.length - 1;
      expect(h.said.at(-1)).toBe(
        `${page.filter((x) => x !== '').join(' ')} ${last ? 'OK to continue.' : 'OK for more, BACK to skip.'}`,
      );
      h.idle(CARD_GUARD_FRAMES + 1);
      h.tap('jump');
    }
    expect((h.top() as CardScene).lines).toContain('LUIGI IS FREE!');
    h.idle(32);
    h.tap('jump');
    expect(h.top()).toBe(l);
    h.idle(60);
    expect(captives(l)).toHaveLength(0);
  });

  it("the player hero speaks the <HERO>: page, and is named in Luigi's first", () => {
    const h = makeGame();
    pass(h);
    expect((h.top() as CardScene).lines).toEqual(['LUIGI:', '', 'OOF... MY HEAD...', 'MARIO? IS THAT YOU?']);
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('jump');
    expect((h.top() as CardScene).lines[0]).toBe('MARIO:');
  });

  it('BACK skips the rest of the talk, straight to the freed card; it never turns by itself', () => {
    const h = makeGame();
    const l = pass(h);
    const first = h.top();
    h.idle(3600);
    expect(h.top()).toBe(first);
    h.tap('attack');
    expect((h.top() as CardScene).lines).toContain('LUIGI IS FREE!');
    const pages = freedTalk('luigi', 'MARIO');
    expect(h.said.some((t) => t.startsWith(pages[2]!.filter((x) => x !== '').join(' ')))).toBe(false);
    h.idle(32);
    h.tap('jump');
    expect(h.top()).toBe(l);
  });

  it('the talk plays once: Luigi has left, and nobody is there to talk to again', () => {
    const h = makeGame();
    const l = pass(h);
    skipFreedTalk(h);
    h.idle(32);
    h.tap('jump');
    h.idle(60);
    expect(captives(l)).toHaveLength(0);
    h.tap('up');
    expect(h.top()).toBe(l);
  });
});

describe('the unlock flow, in detail', () => {
  it("restores the run's state a round changed (lives, score, power, kit, even a new state object)", () => {
    const h = makeGame();
    file({ lives: 4, score: 1200, coins: 9 });
    const l = intoBonus(h);
    standByLuigi(h, l);
    const state = h.game.state;
    const before = { ...state, kit: { ...state.kit } };
    talkIntoMiniGame(h, l);
    h.tap('special'); // the stub tramples the run, then passes
    expect(h.game.state).toBe(state);
    expect({ ...h.game.state, kit: { ...h.game.state.kit } }).toEqual(before);
    // The save written as Luigi was freed has the run as the level left it.
    const saved = loadSave(1)!;
    expect([saved.lives, saved.score, saved.coins, saved.powerState]).toEqual([4, 1200, 9, 'small']);
    expect(saved.freed).toEqual(['mario', 'luigi']);
  });

  it('the rules card never starts the round by itself: it waits for OK', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    standByLuigi(h, l);
    h.tap('up');
    for (let i = 0; i < 6 && h.top() instanceof CardScene; i++) {
      h.idle(32);
      h.tap('jump');
    }
    const rules = h.top();
    expect(rules).toBeInstanceOf(MessageScene);
    h.idle(5000);
    expect(h.top()).toBe(rules);
    h.tap('jump');
    expect(h.top()).not.toBe(rules);
    expect(h.top()).not.toBeInstanceOf(MessageScene);
  });

  it('dialogue cards show and announce how to go on (OK), once they take input', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    standByLuigi(h, l);
    h.tap('up');
    const card = h.top() as CardScene;
    expect(card).toBeInstanceOf(CardScene);
    expect(h.said.at(-1)).toMatch(/OK to continue\.$/);
    expect(draw(card).texts.some((t) => t.str === 'OK')).toBe(false); // not during the guard
    h.idle(32);
    expect(draw(card).texts.some((t) => t.str === 'OK')).toBe(true);
    // Every line fits the box.
    for (const t of draw(card).texts) expect(t.str.length).toBeLessThanOrEqual(CARD_COLS);
  });

  it('announces Talk once when a player comes within reach (again after leaving)', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    h.idle(5);
    const talk = () => h.said.filter((t) => t === 'Luigi. Up to talk.').length;
    expect(talk()).toBe(0);
    standByLuigi(h, l);
    expect(talk()).toBe(1);
    h.idle(30);
    expect(talk()).toBe(1);
    const p = l.world.player;
    p.body.x -= px(40);
    h.idle(2);
    expect((captives(l)[0] as Captive).prompt).toBe(false);
    p.body.x += px(40);
    h.idle(2);
    expect(talk()).toBe(2);
  });

  it("the dialogue names the hero of the player who talked (player two's in co-op)", () => {
    const h = makeGame();
    file({ character2: 'link', freed: ['mario', 'link'], lives: 5 });
    const l = intoBonus(h);
    expect(h.game.state.character2).toBe(LINK);
    h.idle(5);
    const c = captives(l)[0] as Captive;
    const p2 = l.world.players[1]!;
    l.world.player.body.x = px(40); // player one far away
    p2.body.x = c.body.x - px(18);
    p2.body.y = c.body.y + c.body.h - p2.body.h - px(2);
    p2.body.vx = 0;
    p2.body.vy = 0;
    p2.body.onGround = false;
    h.until(() => p2.body.onGround, 60);
    h.idle(5);
    h.tap('up', 1);
    expect(h.top()).toBeInstanceOf(CardScene);
    h.idle(32);
    h.tap('jump');
    expect((h.top() as CardScene).lines).toContain('LINK? I KNOW NO LINK.');
  });

  it('a long mini game title wraps to the dialogue box', () => {
    // A hero with no lines of their own gets the generic challenge, which names the title (every
    // captive has its own lines now: Bill's came with 0.4.9, so a stand-in hero without any).
    const bill = { ...CHARACTERS.find((c) => c.id === 'bill')!, id: 'nobody' };
    const def: MiniGameDef = {
      hero: 'nobody',
      title: 'THE VERY LONG AND WINDING TRIAL OF THE CHOZO',
      rules: [],
      create: () => ({ update() {}, render() {} }),
    };
    const pages = captiveDialogue(bill, def, MARIO);
    for (const page of pages) for (const line of page) expect(line.length).toBeLessThanOrEqual(CARD_COLS);
    expect(pages.flat().join(' ')).toContain('CHOZO');
  });

  it("the freed card names the hero in full (MEGA MAN, not the HUD's MEGA), every line fitting the box", () => {
    for (const hero of CHARACTERS) {
      const lines = freedCard(hero);
      expect(lines[0]).toBe(`${fontText(hero.name)} IS FREE!`);
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(CARD_COLS);
    }
    const megaman = CHARACTERS.find((c) => c.id === 'megaman');
    if (!megaman) throw new Error('no Mega Man');
    expect(freedCard(megaman)[0]).toBe('MEGA MAN IS FREE!');
    expect(freedCard(megaman)).toContain('MEGA MAN JOINS YOUR TEAM.');
  });
});
