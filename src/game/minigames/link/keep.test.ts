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
import { CHARACTERS } from '@game/characters/registry';
import { TopDownBot } from '@game/topdown/bot';
import { DEATH_FRAMES } from '@game/topdown/hero';
import { TILE } from '@game/topdown/geometry';
import { miniGameFor } from '..';
import type { MiniGameResult } from '../types';
import { LINK_MINIGAME } from '.';
import { FAIL_DELAY, INTRO_LINES, KeepMenuScene, ShadowKeepScene, WIN_FRAMES } from './keep';
import { KEEP_PLAN } from './bot-plan';
import { KEEP_ROOMS, keepDungeon } from './dungeon';
import { GLOW_FRAMES, KEEPER_HP, Keeper, Spell } from './keeper';

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

  it('uses the dungeon and keeper music and the puzzle sounds by id (they exist)', () => {
    const songIds = songs.map((s) => s.id);
    const sfxIds = sfx.map((s) => s.id);
    for (const id of ['dungeon', 'keeper']) expect(songIds).toContain(id);
    for (const id of ['secret', 'sword-stab', 'door-open', 'key-get']) expect(sfxIds).toContain(id);
  });
});

describe('Shadow Keep: the dungeon', () => {
  it('eight rooms on a 4×4 map, every door leads somewhere, every room reachable from the start', () => {
    const d = keepDungeon();
    expect(d.rooms.size).toBe(8);
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
    expect(seen.size).toBe(8);
  });

  it("holds the brief's rooms in order: bats, a push block, knights with the key, a locked door into a kill-all room, spitters with a switch and a refill, the keeper, the exit", () => {
    const kinds = (id: string) => KEEP_ROOMS.find((r) => r.id === id)?.map.join('') ?? '';
    const def = (id: string) => KEEP_ROOMS.find((r) => r.id === id);
    expect(KEEP_ROOMS.map((r) => r.id)).toEqual([
      'start',
      'bats',
      'blocks',
      'knights',
      'shutters',
      'switch',
      'keeper',
      'exit',
    ]);
    expect(kinds('bats')).toMatch(/b/);
    expect(kinds('blocks').match(/P/g)).toHaveLength(1);
    expect(def('blocks')?.shutters).toBe('plates');
    expect(kinds('knights')).toMatch(/n.*k|k.*n/);
    expect(def('knights')?.reveal).toBe('clear');
    expect(kinds('knights')).toMatch(/L/);
    expect(def('shutters')?.shutters).toBe('clear');
    expect(kinds('switch')).toMatch(/r/);
    expect(kinds('switch')).toMatch(/_/);
    expect(kinds('switch')).toMatch(/H/);
    expect(def('keeper')?.music).toBe('keeper');
    expect(kinds('keeper')).toMatch(/M/);
    expect(kinds('exit')).toMatch(/E/);
  });
});

describe('Shadow Keep: a full run', () => {
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
    expect(rooms).toEqual(['start', 'bats', 'blocks', 'knights', 'shutters', 'switch', 'keeper', 'exit']);
    expect(h.results).toEqual(['pass']);
    expect(wonAt).toBeGreaterThan(0);
    expect(h.said).toContain('The spell breaks! Link is free.');
    expect(h.world.keys).toBe(0); // the key went into the locked door
    expect(h.log.music).toEqual(['dungeon', 'keeper', 'dungeon']);
    for (const id of ['sword-stab', 'secret', 'door-open', 'key-get']) expect(h.log.sfx).toContain(id);
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
  it("waits for Link to step in; the shutters shut; it glows, then fans three spells at him that the shield can't stop", () => {
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
    // Facing them with the shield up doesn't help.
    h.world.hero.facing = 'up';
    const hp = h.world.hero.hp;
    for (let i = 0; i < 120 && h.world.hero.hp === hp; i++) h.step();
    expect(h.world.hero.hp).toBeLessThan(hp);
  });

  it('can be beaten: six stabs from below; then the shutters open and the dungeon music returns', () => {
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

describe('Shadow Keep: outcomes', () => {
  it('losing every heart fails, after the death spin, once', () => {
    const h = setup({ keep: true });
    h.step([], 5);
    h.world.hero.hurt(h.world, 6, 'down');
    expect(h.scene.touchLabels().attack).toBe('SWORD');
    h.step();
    expect(h.scene.phase).toBe('dying');
    expect(h.said).toContain('Link fell. Try again.');
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
