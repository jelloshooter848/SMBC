import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { Action } from '@engine/input/actions';
import type { Scene } from '@engine/scene';
import type { Announcer } from '@engine/a11y/announcer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import type { MenuItem } from '@game/scenes/menu';
import { AssistOptionsScene } from '@game/scenes/options';
import { defaultSettings } from '@engine/save/settings';
import { captiveDialogue, CARD_COLS } from '@game/scenes/free-hero';
import { CHARACTERS } from '@game/characters/registry';
import { TopDownBot } from '@game/topdown/bot';
import { DEATH_FRAMES } from '@game/topdown/hero';
import { TILE } from '@game/topdown/geometry';
import { Chest, FloorSwitch, Pickup } from '@game/topdown/entity';
import { Rock } from '@game/topdown/enemies';
import { STUN_FRAMES } from '@game/topdown/items';
import { HUD_H } from '@game/topdown/geometry';
import { miniGameFor } from '..';
import type { MiniGameResult } from '../types';
import { LINK_MINIGAME } from '.';
import { FAIL_DELAY, INTRO_LINES, KEEPER_BANNER_Y, KeepMenuScene, ShadowKeepScene, WIN_FRAMES } from './keep';
import { KEEP_PLAN } from './bot-plan';
import { KEEP_ROOMS, keepDungeon } from './dungeon';
import { GLOW_FRAMES, KEEPER_HP, KEEPER_STUN, Keeper, Spell } from './keeper';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** Audio that records what it was asked to play. */
function recordingAudio() {
  const log = { music: [] as string[], sfx: [] as string[] };
  const audio: AudioSink = {
    ...NULL_AUDIO,
    playMusic: (id) => void log.music.push(id),
    sfx: (id) => void log.sfx.push(id),
  };
  return { audio, log };
}

/**
 * A real Game with the keep pushed over a stand-in level scene, as the unlock flow does; `done`
 * records each result and pops the keep (the flow's job) unless `keep` is set.
 */
function setup(opts: { keep?: boolean; seed?: number } = {}) {
  const said: string[] = [];
  const { audio, log } = recordingAudio();
  const game = new Game({
    ctx: {
      assets: new AssetRegistry({ default: {} }),
      audio,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
  });
  const below: Scene = { update() {}, render() {} };
  game.scenes.push(below);
  const results: MiniGameResult[] = [];
  const done = (r: MiniGameResult) => {
    results.push(r);
    if (!opts.keep) game.scenes.pop();
  };
  const scene =
    opts.seed === undefined
      ? (LINK_MINIGAME.create(game, done) as ShadowKeepScene)
      : new ShadowKeepScene(game, done, { seed: opts.seed });
  game.scenes.push(scene);
  const input = new ScriptedInput({ steps: [] });
  const step = (held: Action[] = [], n = 1) => {
    for (let i = 0; i < n; i++) {
      input.setHeld(held);
      input.next();
      game.scenes.update([input]);
    }
  };
  const tap = (a: Action) => {
    step([a]);
    step();
  };
  return { game, scene, below, results, said, log, step, tap, world: scene.world };
}

type Harness = ReturnType<typeof setup>;

/** Plays the bot until the keep reports (or `max` frames); returns the frames played. */
function botRun(h: Harness, max = 12000): number {
  const bot = new TopDownBot(KEEP_PLAN);
  let i = 0;
  for (; i < max && h.results.length === 0; i++) h.step(bot.next(h.world));
  return i;
}

/** Into the keeper's room by the south door, a few steps in (the shutters close behind). */
function toKeeper(h: Harness): Keeper {
  h.world.warpTo('keeper', 7.5 * TILE, 10 * TILE);
  h.step(['up'], 20);
  return h.world.enemies().find((e) => e instanceof Keeper) as Keeper;
}

describe('Shadow Keep: the mini game contract', () => {
  it('frees Link: registered, a title, and rules within the rules card naming the ability', () => {
    expect(miniGameFor('link')).toBe(LINK_MINIGAME);
    expect(LINK_MINIGAME.hero).toBe('link');
    expect(LINK_MINIGAME.title).toBe('SHADOW KEEP');
    for (const line of LINK_MINIGAME.rules) expect(line.length).toBeLessThanOrEqual(26);
    expect(LINK_MINIGAME.rules.join(' ')).toMatch(/SWORD|ATTACK/);
    expect(LINK_MINIGAME.rules.join(' ')).not.toMatch(/\b[AB] BUTTON|\bPRESS [AB]\b/);
  });

  it("Link's captive lines fit the dialogue box: the shadow holds him in his own mind", () => {
    const link = CHARACTERS.find((c) => c.id === 'link');
    const mario = CHARACTERS.find((c) => c.id === 'mario');
    if (!link || !mario) throw new Error('missing heroes');
    const pages = captiveDialogue(link, LINK_MINIGAME, mario);
    for (const page of pages) for (const line of page) expect(line.length).toBeLessThanOrEqual(CARD_COLS);
    expect(pages[1]?.join(' ')).toContain('THE SHADOW... HOLDS ME...');
    expect(pages[1]?.join(' ')).toContain('FIGHT IT WITH ME');
  });

  it('uses the dungeon and keeper music and the puzzle sounds by id (they exist)', () => {
    const songIds = songs.map((s) => s.id);
    const sfxIds = sfx.map((s) => s.id);
    for (const id of ['dungeon', 'keeper']) expect(songIds).toContain(id);
    for (const id of [
      'secret',
      'sword-stab',
      'door-open',
      'key-get',
      'boomerang',
      'bomb-fuse',
      'bomb-blast',
      'item-get',
      'select',
    ])
      expect(sfxIds).toContain(id);
  });
});

describe('Shadow Keep: the dungeon', () => {
  it('eleven rooms on a 4×4 map, every door (the cracked wall too) leads somewhere, every room reachable from the start', () => {
    const d = keepDungeon();
    expect(d.rooms.size).toBe(11);
    expect(d.cols).toBeLessThanOrEqual(4);
    expect(d.rows).toBeLessThanOrEqual(4);
    const seen = new Set([d.startRoom]);
    const queue = [d.startRoom];
    while (queue.length) {
      const r = d.rooms.get(queue.shift() as string);
      if (!r) continue;
      for (const side of Object.keys(r.doors) as ('n' | 'e' | 's' | 'w')[]) {
        const [dx, dy] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[side];
        const next = d.roomAt(r.gx + (dx as number), r.gy + (dy as number));
        if (next && !seen.has(next.id)) {
          seen.add(next.id);
          queue.push(next.id);
        }
      }
    }
    expect(seen.size).toBe(11);
    // The shrine only through the cracked wall.
    expect(d.rooms.get('shrine')?.doors).toEqual({ e: 'cracked' });
    expect(d.rooms.get('armory')?.doors.w).toBe('cracked');
  });

  it("holds the brief's rooms in order: bats, the boomerang's chest, a push block, knights with the key, a locked door into a kill-all room with a heart container, the bombs' chest by a cracked wall, the shield's shrine, spitters with a switch and a refill, the keeper, the exit", () => {
    const kinds = (id: string) => KEEP_ROOMS.find((r) => r.id === id)?.map.join('') ?? '';
    const def = (id: string) => KEEP_ROOMS.find((r) => r.id === id);
    expect(KEEP_ROOMS.map((r) => r.id)).toEqual([
      'start',
      'bats',
      'cellar',
      'blocks',
      'knights',
      'shutters',
      'armory',
      'shrine',
      'switch',
      'keeper',
      'exit',
    ]);
    expect(def('cellar')?.chests).toEqual(['boomerang']);
    expect(def('armory')?.chests).toEqual(['bomb']);
    expect(kinds('armory')).toMatch(/C/);
    expect(def('shrine')?.chests).toEqual(['shield']);
    expect(kinds('shutters')).toMatch(/H/);
    expect(def('shutters')?.reveal).toBe('clear');
    expect(kinds('bats')).toMatch(/b/);
    expect(kinds('blocks').match(/P/g)).toHaveLength(1);
    expect(def('blocks')?.shutters).toBe('plates');
    expect(kinds('knights')).toMatch(/n.*k|k.*n/);
    expect(def('knights')?.reveal).toBe('clear');
    expect(kinds('knights')).toMatch(/L/);
    expect(def('shutters')?.shutters).toBe('clear');
    expect(kinds('switch')).toMatch(/r/);
    expect(kinds('switch')).toMatch(/_/);
    expect(kinds('switch')).toMatch(/f/);
    expect(def('keeper')?.music).toBe('keeper');
    expect(kinds('keeper')).toMatch(/M/);
    expect(kinds('exit')).toMatch(/E/);
  });
});

describe('Shadow Keep: rewards', () => {
  it("the knights' key stays hidden (and can't be taken) until the room is clear", () => {
    const h = setup();
    h.world.warpTo('knights', 7.5 * TILE, 10 * TILE);
    const key = () => h.world.entities.find((e) => e instanceof Pickup && e.kind === 'key') as Pickup;
    expect(key().hidden).toBe(true);
    h.world.hero.invuln = 100000;
    h.world.hero.x = key().x - 4;
    h.world.hero.y = key().y;
    h.step([], 5);
    expect(h.world.keys).toBe(0);
    for (const k of h.world.enemies()) k.die(h.world);
    h.step();
    expect(h.said).toContain('A key appears!');
    h.world.hero.x = key().x - 4;
    h.world.hero.y = key().y;
    h.step();
    expect(h.world.keys).toBe(1);
  });

  it('the heart refill appears only once the floor switch is down', () => {
    const h = setup();
    h.world.warpTo('switch', TILE, 5 * TILE);
    const refill = () => h.world.entities.find((e) => e instanceof Pickup && e.kind === 'refill');
    expect((refill() as Pickup).hidden).toBe(true);
    for (const k of h.world.enemies()) k.die(h.world);
    h.step([], 2);
    expect((refill() as Pickup).hidden).toBe(true); // clearing the room isn't it
    const sw = h.world.entities.find((e) => e instanceof FloorSwitch) as FloorSwitch;
    h.world.hero.x = sw.x;
    h.world.hero.y = sw.y;
    h.step();
    expect(sw.pressed).toBe(true);
    expect((refill() as Pickup).hidden).toBe(false);
    expect(h.world.doorOpen('n')).toBe(true);
  });
});

// Full bot runs take a few seconds each (eleven rooms, two of them twice).
describe('Shadow Keep: a full run', { timeout: 30_000 }, () => {
  it('the bot escapes the keep: every room, then pass once the spell breaks', () => {
    const h = setup({ keep: true });
    const rooms: string[] = [];
    const bot = new TopDownBot(KEEP_PLAN);
    let wonAt = -1;
    for (let i = 0; i < 12000 && h.results.length === 0; i++) {
      h.step(bot.next(h.world));
      if (rooms[rooms.length - 1] !== h.world.room.id) rooms.push(h.world.room.id);
      if (wonAt < 0 && h.scene.phase === 'won') wonAt = i;
    }
    expect(rooms).toEqual([
      'start',
      'bats',
      'cellar',
      'bats',
      'blocks',
      'knights',
      'shutters',
      'armory',
      'shrine',
      'armory',
      'shutters',
      'switch',
      'keeper',
      'exit',
    ]);
    expect(h.results).toEqual(['pass']);
    expect(wonAt).toBeGreaterThan(0);
    expect(h.said).toContain('The spell breaks! Link is free.');
    expect(h.world.keys).toBe(0); // the key went into the locked door
    expect(h.world.inv.owned).toEqual(['boomerang', 'bomb']);
    expect(h.world.hero.shield).toBe(true);
    expect(h.world.hero.maxHp).toBe(8);
    expect(h.log.music).toEqual(['dungeon', 'keeper', 'dungeon']);
    for (const id of [
      'sword-stab',
      'secret',
      'door-open',
      'key-get',
      'item-get',
      'boomerang',
      'bomb-fuse',
      'bomb-blast',
    ])
      expect(h.log.sfx).toContain(id);
    expect(h.said).toContain('The cracked wall breaks open!');
  });

  it('is deterministic: the same seed plays the same run', () => {
    const a = setup();
    const b = setup();
    const fa = botRun(a);
    const fb = botRun(b);
    expect(a.results).toEqual(['pass']);
    expect(fa).toBe(fb);
    expect(a.world.hero.hp).toBe(b.world.hero.hp);
  });
});

describe('Shadow Keep: the keeper', () => {
  it('waits for Link to step in; the shutters shut; it glows, then fans three spells at him; without the shield facing them is no help', () => {
    const h = setup();
    h.world.warpTo('keeper', 7.5 * TILE, 10 * TILE);
    const keeper = h.world.enemies().find((e) => e instanceof Keeper) as Keeper;
    h.step([], 30);
    expect(keeper.awake).toBe(false);
    h.step(['up'], 20);
    expect(keeper.awake).toBe(true);
    expect(h.world.doorOpen('s')).toBe(false);
    expect(h.world.doorOpen('e')).toBe(false);
    expect(h.log.music[h.log.music.length - 1]).toBe('keeper');
    for (let i = 0; i < 400 && keeper.glowT === 0; i++) h.step();
    expect(keeper.glowT).toBeGreaterThan(0);
    h.step([], GLOW_FRAMES);
    const spells = h.world.entities.filter((e) => e instanceof Spell) as Spell[];
    expect(spells).toHaveLength(3);
    // No shield yet: facing them doesn't help.
    expect(h.world.hero.shield).toBe(false);
    h.world.hero.facing = 'up';
    const hp = h.world.hero.hp;
    for (let i = 0; i < 120 && h.world.hero.hp === hp; i++) h.step();
    expect(h.world.hero.hp).toBeLessThan(hp);
  });

  it('can be beaten: eight stabs from below; then the shutters open and the dungeon music returns', () => {
    const h = setup();
    const keeper = toKeeper(h);
    const hero = h.world.hero;
    let stabs = 0;
    for (let i = 0; i < 2000 && !keeper.dead; i++) {
      hero.invuln = 1000; // stand in the spells: this test is about the sword
      hero.x = Math.round((keeper.x + 12) / 8) * 8;
      hero.y = 72;
      hero.facing = 'up';
      const go = !hero.attacking && i % 2 === 0;
      if (go) stabs++;
      h.step(go ? ['attack'] : []);
    }
    expect(keeper.dead).toBe(true);
    expect(stabs).toBeGreaterThanOrEqual(KEEPER_HP);
    h.step([], 2);
    expect(h.world.doorOpen('e')).toBe(true);
    expect(h.world.doorOpen('s')).toBe(true);
    expect(h.said).toContain('The keeper falls! The way out is open.');
    expect(h.log.music[h.log.music.length - 1]).toBe('dungeon');
  });
});

describe('Shadow Keep: outcomes', { timeout: 30_000 }, () => {
  it('losing every heart fails, after the death spin, once', () => {
    const h = setup({ keep: true });
    h.step([], 5);
    h.world.hero.hurt(h.world, 6, 'down');
    expect(h.scene.touchLabels().attack).toBe('SWORD');
    h.step();
    expect(h.scene.phase).toBe('dying');
    expect(h.said).toContain('Link fell.');
    h.step([], DEATH_FRAMES - 5);
    expect(h.results).toEqual([]);
    h.step([], FAIL_DELAY + 10);
    expect(h.results).toEqual(['fail']);
    h.step(['start'], 200);
    expect(h.results).toEqual(['fail']);
  });

  it('the menu offers Continue (play resumes where it was) and Give up (quit)', () => {
    const h = setup();
    h.step(['left'], 20);
    const x = h.world.hero.x;
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(KeepMenuScene);
    h.step(['left'], 10);
    expect(h.world.hero.x).toBe(x);
    h.tap('jump'); // Continue
    expect(h.game.scenes.top).toBe(h.scene);
    expect(h.results).toEqual([]);
    h.tap('start');
    h.step([], 8);
    h.tap('down');
    h.tap('jump'); // Give up
    expect(h.results).toEqual(['quit']);
    expect(h.game.scenes.top).toBe(h.below);
  });

  it('in dev mode the menu offers the assists too (not without dev mode)', () => {
    const labels = (dev: boolean) => {
      const h = setup();
      h.game.deps.settings = { ...defaultSettings(), dev };
      h.step([], 5);
      h.tap('start');
      const menu = h.game.scenes.top as KeepMenuScene;
      expect(menu).toBeInstanceOf(KeepMenuScene);
      return { h, items: (menu as unknown as { items: MenuItem[] }).items };
    };
    expect(labels(false).items.map((i) => i.label)).toEqual(['Continue', 'Give up']);
    const { h, items } = labels(true);
    expect(items.map((i) => i.label)).toEqual(['Continue', 'Give up', 'Assists']);
    items[2]?.select?.();
    expect(h.game.scenes.top).toBeInstanceOf(AssistOptionsScene);
  });

  it.each(['pass', 'fail', 'quit'] as const)(
    'calls done exactly once (%s), however long it is left running',
    (want) => {
      const h = setup({ keep: true });
      if (want === 'pass') botRun(h);
      else if (want === 'fail') {
        h.world.hero.hurt(h.world, 6, 'down');
        h.step([], DEATH_FRAMES + FAIL_DELAY + 5);
      } else {
        h.tap('start');
        h.step([], 8);
        h.tap('down');
        h.tap('jump');
        h.game.scenes.pop(); // the flow pops the keep
        h.game.scenes.push(h.scene);
      }
      expect(h.results).toEqual([want]);
      for (let i = 0; i < 600; i++) h.step(i % 7 === 0 ? ['start'] : ['attack', 'up']);
      expect(h.results).toEqual([want]);
    },
  );

  it("leaves the campaign's state alone (hearts, keys and all live in the keep)", () => {
    const h = setup();
    const s = h.game.state;
    const before = { ...s };
    botRun(h);
    expect(h.results).toEqual(['pass']);
    expect(s).toEqual(before);
  });

  it('a win holds "THE SPELL BREAKS!" for a moment before passing', () => {
    const h = setup({ keep: true });
    const bot = new TopDownBot(KEEP_PLAN);
    for (let i = 0; i < 12000 && h.scene.phase !== 'won'; i++) h.step(bot.next(h.world));
    expect(h.scene.phase).toBe('won');
    h.step([], WIN_FRAMES - 2);
    expect(h.results).toEqual([]);
    h.step([], 2);
    expect(h.results).toEqual(['pass']);
  });
});

describe('Shadow Keep: screen and controls', () => {
  it('labels the d-pad play: SWORD and MENU, no jump; none once it is over', () => {
    const h = setup({ keep: true });
    expect(h.scene.touchLabels()).toEqual({
      jump: null,
      attack: 'SWORD',
      special: null,
      start: 'MENU',
      select: null,
    });
    h.world.hero.hurt(h.world, 6, 'down');
    h.step();
    expect(h.scene.touchLabels().attack).toBeNull();
    expect(h.scene.touchLabels().start).toBeNull();
  });

  it('draws the wake-up line, the HUD (map title, item, life) and announces the start', () => {
    const h = setup();
    const texts: string[] = [];
    const none = new NullRenderer();
    const r: Renderer = {
      ...none,
      clear: none.clear,
      rect: none.rect,
      sprite: none.sprite,
      line: none.line,
      debugText: none.debugText,
      text: (_f, t) => void texts.push(t),
    };
    h.game.scenes.render(r);
    expect(texts).toEqual(expect.arrayContaining([...INTRO_LINES, 'SHADOW KEEP', 'SWORD', '-LIFE-']));
    expect(h.said[0]).toMatch(/^Escape the Shadow Keep\. Link\.\.\. wake up/);
  });
});

/** Text drawn by the scene's next render. */
function drawnText(h: Harness): string[] {
  const texts: string[] = [];
  const none = new NullRenderer();
  const r: Renderer = {
    ...none,
    clear: none.clear,
    rect: none.rect,
    sprite: none.sprite,
    line: none.line,
    debugText: none.debugText,
    text: (_f, t) => void texts.push(t),
  };
  h.game.scenes.render(r);
  return texts;
}

/** Walks Link into the room's chest from below (it must have open floor under it). */
function openChest(h: Harness): Chest {
  const c = h.world.entities.find((e) => e instanceof Chest) as Chest;
  h.world.hero.x = c.x;
  h.world.hero.y = c.y + 16;
  h.step(['up'], 12);
  return c;
}

describe('Shadow Keep: items, the shield and the secret', () => {
  it('Link starts with only his sword: no shield, so rocks hit from the front and from the side', () => {
    const h = setup();
    const hero = h.world.hero;
    expect(hero.shield).toBe(false);
    expect(h.world.inv.owned).toEqual([]);
    hero.facing = 'right';
    h.world.add(new Rock(hero.x + 40, hero.y + 4, 'left'));
    h.step([], 30);
    expect(hero.hp).toBe(5);
    hero.invuln = 0;
    h.world.add(new Rock(hero.x + 4, hero.y - 40, 'down'));
    h.step([], 30);
    expect(hero.hp).toBe(4);
  });

  it("the cellar's chest gives the boomerang once, with a fanfare and how to use it", () => {
    const h = setup();
    h.world.warpTo('cellar', TILE, 5 * TILE);
    for (const k of h.world.enemies()) k.die(h.world);
    const chest = openChest(h);
    expect(chest.open).toBe(true);
    expect(h.world.inv.owned).toEqual(['boomerang']);
    expect(h.log.sfx).toContain('item-get');
    expect(drawnText(h)).toEqual(expect.arrayContaining(['YOU GOT THE BOOMERANG!', 'BOOMERANG: THROW']));
    expect(h.said.some((t) => t.startsWith('You got the boomerang!'))).toBe(true);
    h.step([], 80);
    h.world.warpTo('bats', 14 * TILE, 5 * TILE);
    h.world.warpTo('cellar', TILE, 5 * TILE);
    const again = h.world.entities.find((e) => e instanceof Chest) as Chest;
    expect(again.open).toBe(true);
    const gets = h.log.sfx.filter((s) => s === 'item-get').length;
    openChest(h);
    expect(h.log.sfx.filter((s) => s === 'item-get').length).toBe(gets);
    expect(h.world.inv.owned).toEqual(['boomerang']);
  });

  it('the shutters room shows a heart container once it is clear: three hearts become four, all full', () => {
    const h = setup();
    h.world.warpTo('shutters', TILE, 5 * TILE);
    const hc = () =>
      h.world.entities.find((e) => e instanceof Pickup && e.kind === 'heart-container') as Pickup;
    expect(hc().hidden).toBe(true);
    for (const k of h.world.enemies()) k.die(h.world);
    h.step();
    expect(hc().hidden).toBe(false);
    h.world.hero.hp = 1;
    h.world.hero.x = hc().x;
    h.world.hero.y = hc().y;
    h.step();
    expect(h.world.hero.maxHp).toBe(8);
    expect(h.world.hero.hp).toBe(8);
    expect(h.said).toContain('A heart container! One more heart, and every heart refilled.');
  });

  it("a bomb opens the armory's cracked wall (only a blast does); the shrine's chest holds the shield", () => {
    const h = setup();
    h.world.warpTo('armory', 7.5 * TILE, 9 * TILE);
    for (const k of h.world.enemies()) k.die(h.world);
    openChest(h);
    expect(h.world.inv.count('bomb')).toBe(4);
    expect(drawnText(h)).toEqual(expect.arrayContaining(['YOU GOT THE BOMB!', 'BOMB: SET ONE DOWN']));
    h.step([], 70);
    h.world.grant('boomerang');
    h.world.inv.select('bomb');
    const hero = h.world.hero;
    hero.x = TILE;
    hero.y = 5 * TILE;
    // The sword doesn't open it.
    h.tap('left');
    h.tap('attack');
    h.step([], 20);
    expect(h.world.doorOpen('w')).toBe(false);
    h.tap('special');
    h.step(['right'], 30);
    h.step([], 90);
    expect(h.world.doorOpen('w')).toBe(true);
    expect(h.log.sfx).toEqual(expect.arrayContaining(['bomb-fuse', 'bomb-blast', 'secret']));
    expect(h.said).toContain('The cracked wall breaks open!');
    // Through it to the shrine and its chest.
    hero.x = TILE;
    hero.y = 5 * TILE;
    h.step(['left'], 100);
    expect(h.world.room.id).toBe('shrine');
    openChest(h);
    expect(hero.shield).toBe(true);
    expect(h.said).toContain(
      'You got the magic shield! Face rocks and spells to block them, and monsters hurt you less.',
    );
    expect(drawnText(h)).toEqual(
      expect.arrayContaining([
        'YOU GOT THE SHIELD!',
        'FACE ROCKS AND SPELLS TO BLOCK',
        'MONSTERS HURT YOU LESS',
      ]),
    );
    h.step([], 70);
    hero.invuln = 0;
    hero.facing = 'right';
    const hp = hero.hp;
    h.world.add(new Rock(hero.x + 40, hero.y + 4, 'left'));
    h.step([], 30);
    expect(hero.hp).toBe(hp);
  });

  it('labels the item button by the item while it can be used, and ITEM once there are two', () => {
    const h = setup();
    const labels = () => h.scene.touchLabels();
    expect(labels()).toEqual({ jump: null, attack: 'SWORD', special: null, start: 'MENU', select: null });
    h.world.grant('boomerang');
    expect(labels().special).toBe('BOOMERANG');
    expect(labels().select).toBeNull();
    h.tap('special');
    expect(labels().special).toBeNull(); // it is out
    h.step([], 120);
    expect(labels().special).toBe('BOOMERANG');
    h.world.grant('bomb');
    expect(labels().select).toBe('ITEM');
    h.tap('select');
    expect(labels().special).toBe('BOMB');
    h.world.inv.addAmmo('bomb', -9);
    expect(labels().special).toBeNull(); // none left
  });

  it('draws the item box (ITEM) beside the sword box, and the bomb count beside the keys', () => {
    const h = setup();
    h.world.grant('boomerang');
    h.world.grant('bomb');
    expect(drawnText(h)).toEqual(expect.arrayContaining(['ITEM', 'SWORD', '×0', '×4', '-LIFE-']));
  });

  it('the boomerang stuns monsters for seconds but the keeper for only half a second (and not asleep)', () => {
    const h = setup();
    const keeper = toKeeper(h);
    expect(keeper.stunFor(STUN_FRAMES)).toBe(KEEPER_STUN);
    expect(KEEPER_STUN).toBeLessThanOrEqual(30);
    expect(STUN_FRAMES).toBeGreaterThanOrEqual(150);
    keeper.awake = false;
    expect(keeper.stun(h.world, STUN_FRAMES)).toBe(false);
  });

  it('with the magic shield, a spell is blocked from the front (not from the side, not mid-stab, not without it)', () => {
    const spellAt = (h: Harness, dx: number, dy: number, angle: number) => {
      const hero = h.world.hero;
      hero.invuln = 0;
      h.world.add(new Spell(hero.x + 4 + dx, hero.y + 4 + dy, angle));
    };
    const down = Math.PI / 2 + 0.3; // fanned, but mostly down
    for (const shield of [true, false]) {
      const h = setup();
      h.world.hero.shield = shield;
      h.world.hero.facing = 'up';
      spellAt(h, 10, -40, down);
      h.step([], 40);
      expect(h.world.hero.hp).toBe(shield ? 6 : 5);
    }
    const h = setup();
    const hero = h.world.hero;
    hero.shield = true;
    hero.facing = 'right'; // from above while facing right: the side
    spellAt(h, 10, -40, down);
    h.step([], 40);
    expect(hero.hp).toBe(5);
    hero.facing = 'up';
    hero.x = 112;
    hero.y = 80;
    spellAt(h, 8, -20, down);
    h.step(['attack']); // mid-stab
    h.step([], 12);
    expect(hero.hp).toBe(4);
  });

  it("with the shield the keeper's touch costs half a heart instead of a whole one", () => {
    for (const shield of [false, true]) {
      const h = setup();
      const keeper = toKeeper(h);
      const hero = h.world.hero;
      hero.shield = shield;
      hero.invuln = 0;
      hero.attackT = 0;
      const hp = hero.hp;
      hero.x = keeper.x + 8;
      hero.y = keeper.y + 8;
      h.step();
      expect(hp - hero.hp).toBe(shield ? 1 : 2);
    }
  });

  it("the keeper's spells vanish when it falls", () => {
    const h = setup();
    const keeper = toKeeper(h);
    h.world.hero.invuln = 100000;
    for (let i = 0; i < 400 && !h.world.entities.some((e) => e instanceof Spell); i++) h.step();
    expect(h.world.entities.some((e) => e instanceof Spell)).toBe(true);
    keeper.hp = 1;
    keeper.invuln = 0;
    keeper.hurt(h.world, 1, 'up');
    h.step();
    expect(h.world.entities.some((e) => e instanceof Spell)).toBe(false);
  });

  it("the keeper's name shows between the keeper and Link at the door, covering neither", () => {
    const h = setup();
    const keeper = toKeeper(h);
    expect(drawnText(h)).toContain('THE KEEPER');
    const top = KEEPER_BANNER_Y - 6;
    const bottom = KEEPER_BANNER_Y + 12 + 2;
    expect(top).toBeGreaterThan(HUD_H + keeper.y + keeper.h + 2);
    expect(bottom).toBeLessThan(HUD_H + h.world.hero.y);
  });

  it("dev mode's no-damage assist keeps Link's hearts, switched on and off mid-round", () => {
    const h = setup();
    const hero = h.world.hero;
    h.game.ctx.assist.invulnerable = true;
    hero.hurt(h.world, 2, 'down');
    h.world.add(new Rock(hero.x + 40, hero.y + 4, 'left'));
    h.step([], 80);
    expect(hero.hp).toBe(6);
    h.world.grant('bomb');
    h.tap('special');
    h.step([], 100); // right beside it
    expect(hero.hp).toBe(6);
    h.game.ctx.assist.invulnerable = false;
    hero.invuln = 0;
    hero.hurt(h.world, 2, 'down');
    expect(hero.hp).toBe(4);
  });
});
