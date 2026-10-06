import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { toPx, px } from '@engine/math/units';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { WorldMapScene } from '@game/scenes/world-map';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { FileSelectScene } from '@game/scenes/file-select';
import { CardScene, MessageScene } from '@game/scenes/message';
import { MenuScene } from '@game/scenes/menu';
import { StoryScene } from '@game/scenes/story';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { Captive } from '@game/entities/objects/captive';
import { loadSave, newSave, writeSave, type SaveFile } from '@game/save/save-files';
import { miniGameFor } from '@game/minigames';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';

// Freeing the heroes (0.5.0): a campaign file starts with Mario only; the others are brainwashed
// captives to find. Luigi waits in the 1-1 bonus room; talking to him starts his mini game (the
// placeholder here: jump passes, attack fails, menu quits).

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

function makeGame() {
  const said: string[] = [];
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const audio = { ...NULL_AUDIO, stopMusic: vi.fn(), playMusic: vi.fn(), setTempoScale: vi.fn() };
  const game = new Game({
    ctx: { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const r = new NullRenderer();
  const step = (a: Action[] = [], a2: Action[] = []) => {
    p1.setHeld(a);
    p2.setHeld(a2);
    p1.next();
    p2.next();
    game.scenes.update([p1, p2]);
    game.scenes.render(r);
  };
  const tap = (a: Action, player = 0) => {
    step(player === 0 ? [a] : [], player === 1 ? [a] : []);
    step();
  };
  const idle = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  const until = (pred: () => boolean, max = 2000) => {
    for (let i = 0; i < max && !pred(); i++) step();
    expect(pred()).toBe(true);
  };
  const top = () => game.scenes.top;
  return { game, said, step, tap, idle, until, top, audio };
}
type H = ReturnType<typeof makeGame>;

/** A campaign file in slot 1, written to storage. */
function file(over: Partial<SaveFile> = {}, c1 = MARIO.id): SaveFile {
  const s = { ...newSave(1, c1), ...over };
  writeSave(s);
  return s;
}

/** Draw a scene, recording text and the sheet/palette of each sprite. */
function draw(scene: { render(r: Renderer): void }) {
  const texts: { str: string; x: number; y: number }[] = [];
  const sprites: { key: string; frame: string; x: number; y: number }[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string, x: number, y: number): void {
      texts.push({ str, x, y });
    },
    sprite(s: SpriteSheet, frame: string, x: number, y: number): void {
      sprites.push({ key: s.id, frame, x, y });
    },
  });
  scene.render(r);
  return { texts, sprites };
}

/** The picks a character select offers: step right through the roster, collecting each name said. */
function offered(h: H): string[] {
  const names: string[] = [];
  for (let i = 0; i < CHARACTERS.length; i++) {
    h.tap('right');
    names.push(h.said.at(-1) ?? '');
  }
  return names;
}

/** File 1 open on the map, then into the 1-1 bonus room (falling in at column 1, as from the pipe). */
function intoBonus(h: H, time = 300) {
  h.game.openFile(1);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
  h.game.startLevel(getLevel('1-1-bonus'), { mode: 'fall', x: 1, y: 1, time });
  h.step();
  expect(h.top()).toBeInstanceOf(LevelScene);
  return h.top() as LevelScene;
}

const captives = (l: LevelScene) =>
  l.world.entities.filter((e): e is Captive => e instanceof Captive && e.alive);

/** Put player 1 next to Luigi on his ledge and let him land. */
function standByLuigi(h: H, l: LevelScene) {
  const c = captives(l)[0] as Captive;
  const p = l.world.player;
  p.body.x = c.body.x - px(18);
  p.body.y = c.body.y + c.body.h - p.body.h - px(2);
  p.body.vx = 0;
  p.body.vy = 0;
  p.body.onGround = false;
  h.until(() => p.body.onGround, 60);
  h.idle(10);
}

/** Talk to Luigi and go through the dialogue and rules cards into his mini game. */
function talkIntoMiniGame(h: H, l: LevelScene) {
  h.tap('up');
  expect(h.top()).not.toBe(l);
  // Dialogue cards (OK goes on), then the rules card, then the round.
  for (let i = 0; i < 6 && (h.top() instanceof CardScene || h.top() instanceof MessageScene); i++) {
    h.idle(32);
    h.tap('jump');
  }
  const round = h.top();
  expect(round).not.toBeInstanceOf(CardScene);
  expect(round).not.toBeInstanceOf(MessageScene);
  expect(round).not.toBe(l);
  return round;
}

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
    expect(h.said.some((t) => /7 heroes still to be found/i.test(t))).toBe(true);
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

  it('the silhouette palette turns every colour black', () => {
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    const pal = PALETTES.default.luigi as readonly string[];
    expect(pal.some((c) => c !== '#000000')).toBe(true);
    const sheet = assets.sheet('mario', 'luigi~silhouette');
    expect(sheet.id).toBe('mario@luigi~silhouette');
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
    expect(h.said.some((t) => /6 heroes still to be found/i.test(t))).toBe(true);
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
  it('a NEW file shows the story cards before the World 1 map; OK pages through them', () => {
    const h = makeGame();
    h.game.showTitle();
    h.idle(8);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(FileSelectScene);
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(StoryScene);
    expect(h.said.some((t) => /bowser/i.test(t))).toBe(true);
    expect(loadSave(1)?.freed).toEqual(['mario']);
    h.until(() => {
      if (h.top() instanceof StoryScene) h.tap('jump');
      return h.top() instanceof WorldMapScene;
    }, 400);
    expect(h.game.campaign).toEqual({ slot: 1 });
  });

  it('MENU skips the rest of the story; an existing file opens straight on its map', () => {
    const h = makeGame();
    h.game.showTitle();
    h.idle(8);
    h.tap('start');
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(StoryScene);
    h.idle(32);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
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
    // Top right: on the ledge at row 6, columns 12-14 (feet on its top).
    expect(toPx(c.body.x) >> 4).toBeGreaterThanOrEqual(12);
    expect(toPx(c.body.y + c.body.h)).toBe(6 * 16);
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
    h.tap('jump'); // pass
    expect(h.game.freed).toContain('luigi');
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
