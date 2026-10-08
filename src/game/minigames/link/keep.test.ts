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
import { ATTACK_FRAMES, DEATH_FRAMES } from '@game/topdown/hero';
import { BeamBurst, SwordBeam } from '@game/topdown/beam';
import { TILE } from '@game/topdown/geometry';
import { Chest, FloorSwitch, Pickup, PushBlock, Torch } from '@game/topdown/entity';
import { Knight, Rock } from '@game/topdown/enemies';
import { STUN_FRAMES } from '@game/topdown/items';
import { miniGameFor } from '..';
import type { MiniGameResult } from '../types';
import { LINK_MINIGAME } from '.';
import { FAIL_DELAY, INTRO_LINES, KeepMenuScene, ShadowKeepScene, WIN_FRAMES } from './keep';
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
function botRun(h: Harness, max = 20000): number {
  const bot = new TopDownBot(KEEP_PLAN);
  let i = 0;
  for (; i < max && h.results.length === 0; i++) h.step(bot.next(h.world));
  return i;
}

/** Into the keeper's room by the south door, a few steps in (the shutters close behind). */
function toKeeper(h: Harness): Keeper {
  h.world.warpTo('keeper', 7.5 * TILE, 9 * TILE);
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
  it('thirteen rooms on a 4×6 map, every door (the cracked wall too) leads somewhere, every room reachable from the start', () => {
    const d = keepDungeon();
    expect(d.rooms.size).toBe(13);
    expect([d.cols, d.rows]).toEqual([4, 6]);
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
    expect(seen.size).toBe(13);
    // The shrine only through the cracked wall.
    expect(d.rooms.get('shrine')?.doors).toEqual({ e: 'cracked' });
    expect(d.rooms.get('armory')?.doors.w).toBe('cracked');
  });

  it("every room is Zelda's: walls two tiles thick round a 12×7 floor, each doorway centred in its wall", () => {
    for (const r of keepDungeon().rooms.values()) {
      expect(r.wall, r.id).toBe(2);
      const inner = r.def.map.slice(2, 9).map((l) => l.slice(2, 14));
      expect(inner.join('').includes('#'), r.id).toBe(false);
      for (const [side, cells] of Object.entries(r.doorCells))
        expect(cells, `${r.id} ${side}`).toEqual(side === 'n' || side === 's' ? [7, 8] : [5]);
    }
  });

  it('laid out as a Zelda dungeon: the entrance at the bottom, locked doors, the map and compass, the boss next to the Triforce at the top', () => {
    const d = keepDungeon();
    const room = (id: string) => d.rooms.get(id);
    const kinds = (id: string) => room(id)?.def.map.join('') ?? '';
    expect(d.startRoom).toBe('start');
    expect(room('start')?.gy).toBe(d.rows - 1);
    expect(room('triforce')?.gy).toBe(0);
    expect(room('triforce')?.def.goal).toBe(true);
    // The keeper's lair opens north onto the Triforce.
    expect([room('keeper')?.gx, room('keeper')?.gy]).toEqual([room('triforce')?.gx, 1]);
    expect(room('keeper')?.doors.n).toBe('shutter');
    expect(kinds('triforce')).toMatch(/A/);
    // Two keys for two locked doors.
    const locked = [...d.rooms.values()].flatMap((r) => Object.values(r.doors).filter((k) => k === 'locked'));
    expect(locked.length).toBe(4); // each locked doorway, seen from both sides
    expect(KEEP_ROOMS.filter((r) => r.map.join('').includes('k')).map((r) => r.id)).toEqual([
      'bats',
      'knights',
    ]);
    expect(kinds('map')).toMatch(/m/);
    expect(kinds('compass')).toMatch(/v/);
    // The rest of the keep, as before.
    expect(room('cellar')?.def.chests).toEqual(['boomerang']);
    expect(room('armory')?.def.chests).toEqual(['bomb']);
    expect(room('shrine')?.def.chests).toEqual(['white-sword']);
    expect(kinds('blocks').match(/P/g)).toHaveLength(1);
    expect(room('blocks')?.def.shutters).toBe('plates');
    expect(room('shutters')?.def.shutters).toBe('clear');
    expect(kinds('switch')).toMatch(/r.*_.*f/);
    expect(room('keeper')?.def.music).toBe('keeper');
    // A Zelda boss leaves its heart container.
    expect(kinds('keeper')).toMatch(/M.*H/);
    expect(room('keeper')?.def.reveal).toBe('clear');
  });
});

describe('Shadow Keep: rewards', () => {
  it("the knights' key stays hidden (and can't be taken) until the room is clear", () => {
    const h = setup();
    h.world.warpTo('knights', 7.5 * TILE, 8 * TILE);
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
    h.world.warpTo('switch', 2 * TILE, 5 * TILE);
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

// Full bot runs take a few seconds each (thirteen rooms, some of them twice).
describe('Shadow Keep: a full run', { timeout: 30_000 }, () => {
  it('the bot escapes the keep: every room, the Triforce, then pass once the spell breaks', () => {
    const h = setup({ keep: true });
    const rooms: string[] = [];
    const bot = new TopDownBot(KEEP_PLAN);
    let wonAt = -1;
    for (let i = 0; i < 20000 && h.results.length === 0; i++) {
      h.step(bot.next(h.world));
      if (rooms[rooms.length - 1] !== h.world.room.id) rooms.push(h.world.room.id);
      if (wonAt < 0 && h.scene.phase === 'won') wonAt = i;
    }
    expect(rooms).toEqual([
      'start',
      'bats',
      'start',
      'map',
      'cellar',
      'map',
      'shutters',
      'compass',
      'shutters',
      'blocks',
      'knights',
      'armory',
      'shrine',
      'armory',
      'knights',
      'switch',
      'keeper',
      'triforce',
    ]);
    expect(h.results).toEqual(['pass']);
    expect(wonAt).toBeGreaterThan(0);
    expect(h.said).toContain('Link holds up the Triforce! The spell breaks. Link is free.');
    expect(h.world.keys).toBe(0); // both keys went into the locked doors
    expect([...h.world.found].sort()).toEqual(['compass', 'map', 'triforce']);
    expect(h.world.inv.owned).toEqual(['boomerang', 'bomb']);
    expect(h.world.swordBeam).toBe(true); // the white sword from the shrine
    expect(h.world.hero.maxHp).toBe(8);
    expect(h.log.music).toEqual(['dungeon', 'keeper', 'dungeon', 'triforce-get']);
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
  it('waits for Link to step in; the shutters shut; it glows, then fans three spells at him; facing them is no help', () => {
    const h = setup();
    h.world.warpTo('keeper', 7.5 * TILE, 9 * TILE);
    const keeper = h.world.enemies().find((e) => e instanceof Keeper) as Keeper;
    h.step([], 30);
    expect(keeper.awake).toBe(false);
    h.step(['up'], 20);
    expect(keeper.awake).toBe(true);
    expect(h.world.doorOpen('s')).toBe(false);
    expect(h.world.doorOpen('n')).toBe(false);
    expect(h.log.music[h.log.music.length - 1]).toBe('keeper');
    for (let i = 0; i < 400 && keeper.glowT === 0; i++) h.step();
    expect(keeper.glowT).toBeGreaterThan(0);
    h.step([], GLOW_FRAMES);
    const spells = h.world.entities.filter((e) => e instanceof Spell) as Spell[];
    expect(spells).toHaveLength(3);
    // No shield in the keep: facing them doesn't help.
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
      hero.y = keeper.y + 40;
      hero.facing = 'up';
      const go = !hero.attacking && i % 2 === 0;
      if (go) stabs++;
      h.step(go ? ['attack'] : []);
    }
    expect(keeper.dead).toBe(true);
    expect(stabs).toBeGreaterThanOrEqual(KEEPER_HP);
    h.step([], 2);
    expect(h.world.doorOpen('n')).toBe(true);
    expect(h.world.doorOpen('s')).toBe(true);
    expect(h.said).toContain('The keeper falls! The north door opens.');
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
    for (let i = 0; i < 20000 && h.scene.phase !== 'won'; i++) h.step(bot.next(h.world));
    expect(h.scene.phase).toBe('won');
    h.step([], WIN_FRAMES - 2);
    expect(h.results).toEqual([]);
    h.step([], 2);
    expect(h.results).toEqual(['pass']);
  });
});

describe('Shadow Keep: the Triforce', () => {
  it('once the keeper falls the north shutters open onto the Triforce; Link holds it up in the item-get pose to its own fanfare, then the round passes', () => {
    const h = setup({ keep: true });
    const keeper = toKeeper(h);
    expect(h.world.doorOpen('n')).toBe(false);
    keeper.die(h.world);
    h.step([], 2);
    expect(h.world.doorOpen('n')).toBe(true);
    h.world.warpTo('triforce', 7.5 * TILE, 8 * TILE);
    const shard = h.world.entities.find((e) => e instanceof Pickup && e.kind === 'triforce') as Pickup;
    expect(shard.x + shard.w / 2).toBe(8 * TILE); // centred in the room
    for (let i = 0; i < 200 && h.scene.phase === 'play'; i++) h.step(['up']);
    expect(h.scene.phase).toBe('won');
    expect(h.world.hero.holding).toBe('triforce');
    expect(h.world.found.has('triforce')).toBe(true);
    expect(h.log.music[h.log.music.length - 1]).toBe('triforce-get');
    expect(h.said.some((t) => t.includes('Triforce'))).toBe(true);
    expect(h.world.hero.hp).toBe(h.world.hero.maxHp); // every heart refilled, as in Zelda
    h.step([], WIN_FRAMES - 2);
    expect(h.world.hero.holding).toBe('triforce'); // held up the whole fanfare
    expect(h.results).toEqual([]);
    h.step([], 2);
    expect(h.results).toEqual(['pass']);
  });

  it('the fanfare is an original song of its own that fits the hold', () => {
    const song = songs.find((s) => s.id === 'triforce-get');
    expect(song?.loop).toBe(false);
    expect(song?.pulse1).toBeTruthy();
  });

  it('no flashing on the pickup: nothing is drawn over the room while Link holds it up', () => {
    const h = setup({ keep: true });
    h.world.warpTo('triforce', 7.5 * TILE, 8 * TILE);
    for (let i = 0; i < 200 && h.scene.phase === 'play'; i++) h.step(['up']);
    const big: string[] = [];
    const none = new NullRenderer();
    const r: Renderer = {
      ...none,
      clear: none.clear,
      line: none.line,
      debugText: none.debugText,
      text: none.text,
      sprite: none.sprite,
      rect: (_x, y, w, h2, c) => void (w >= 200 && h2 >= 100 && y >= 64 && big.push(c)),
    };
    for (let i = 0; i < 60; i++) {
      h.step();
      h.scene.render(r);
    }
    expect(big).toEqual([]);
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

  it('draws the wake-up line, the HUD (level over the map, item boxes, life) and announces the start', () => {
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
    expect(texts).toEqual(expect.arrayContaining([...INTRO_LINES, 'LEVEL-1', 'B', 'A', '-LIFE-']));
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

describe('Shadow Keep: the sword beam', () => {
  /** Link in the start room facing up the clear middle column, and a knight held still up it. */
  function lineUp(h: Harness): Knight {
    const hero = h.world.hero;
    hero.x = 7 * TILE;
    hero.y = 8 * TILE;
    hero.facing = 'up';
    const knight = new Knight(7 * TILE, 2 * TILE);
    knight.stunT = 1000;
    h.world.add(knight);
    return knight;
  }
  const beams = (h: Harness) => h.world.entities.filter((e) => e instanceof SwordBeam);

  it('Link starts without it: a stab at full hearts throws nothing', () => {
    const h = setup();
    lineUp(h);
    expect(h.world.swordBeam).toBe(false);
    h.tap('attack');
    expect(beams(h)).toHaveLength(0);
    expect(h.log.sfx).not.toContain('sword-beam');
  });

  it('with the white sword, at full hearts a stab also throws a beam up the room that hurts the first monster it meets', () => {
    const h = setup();
    h.world.grant('white-sword');
    const knight = lineUp(h);
    const hp = knight.hp;
    h.tap('attack');
    expect(beams(h)).toHaveLength(1);
    expect(h.log.sfx).toContain('sword-beam');
    h.step([], 40);
    expect(knight.hp).toBe(hp - 1);
    expect(beams(h)).toHaveLength(0);
  });

  it('one beam at a time; none below full hearts', () => {
    const h = setup();
    h.world.grant('white-sword');
    lineUp(h).dead = true;
    h.tap('attack');
    h.step([], ATTACK_FRAMES);
    h.tap('attack');
    expect(beams(h)).toHaveLength(1);
    h.step([], 60);
    expect(beams(h)).toHaveLength(0);
    h.world.hero.hp = h.world.hero.maxHp - 1;
    h.tap('attack');
    expect(beams(h)).toHaveLength(0);
  });

  it('bursts at the wall into four pieces that fly apart diagonally and are gone in a moment', () => {
    const h = setup();
    h.world.grant('white-sword');
    lineUp(h).dead = true;
    h.tap('attack');
    let burst: BeamBurst | null = null;
    for (let i = 0; i < 80 && !burst; i++) {
      h.step();
      burst = (h.world.entities.find((e) => e instanceof BeamBurst) as BeamBurst | undefined) ?? null;
    }
    expect(burst).not.toBeNull();
    expect(burst?.y).toBeLessThan(3 * TILE); // at the face of the two-tile wall
    h.step([], 4);
    const spread = burst?.pieces().map((p) => [Math.sign(p.dx), Math.sign(p.dy)].join());
    expect(new Set(spread)).toEqual(new Set(['-1,-1', '1,-1', '-1,1', '1,1']));
    h.step([], 40);
    expect(h.world.entities.some((e) => e instanceof BeamBurst)).toBe(false);
  });

  /** Fires a beam from Link at (col, row) facing `dir`; returns where it burst (room px). */
  function fireUntilBurst(h: Harness, col: number, row: number, dir: 'left' | 'up'): BeamBurst | null {
    h.world.grant('white-sword');
    const hero = h.world.hero;
    hero.x = col * TILE;
    hero.y = row * TILE;
    hero.facing = dir;
    h.tap('attack');
    for (let i = 0; i < 120; i++) {
      const b = h.world.entities.find((e) => e instanceof BeamBurst) as BeamBurst | undefined;
      if (b) return b;
      h.step();
    }
    return null;
  }

  it('flies over push blocks and torches (only walls, doors and the room edge stop it)', () => {
    const h = setup();
    // The start room's lit torch at (3,7), and a push block put in the way at (5,7).
    h.world.add(new PushBlock(5 * TILE, 7 * TILE));
    expect(h.world.entities.some((e) => e instanceof Torch && e.x === 3 * TILE && e.y === 7 * TILE)).toBe(
      true,
    );
    const burst = fireUntilBurst(h, 8, 7, 'left');
    expect(burst).not.toBeNull();
    expect(burst?.cx).toBeLessThan(3 * TILE); // at the west wall, past both
  });

  it('flies over statues too, and bursts at the wall behind them', () => {
    const h = setup();
    h.world.warpTo('bats', 12 * TILE, 4 * TILE);
    for (const e of h.world.enemies()) e.dead = true;
    h.step();
    // Statues at (9,4) and (6,4) on the way to the west wall.
    const burst = fireUntilBurst(h, 12, 4, 'left');
    expect(burst).not.toBeNull();
    expect(burst?.cx).toBeLessThan(3 * TILE);
  });
});

describe('Shadow Keep: items, the white sword and the secret', () => {
  it('Link starts with only his sword (no beam, no shield): rocks hit from the front and from the side', () => {
    const h = setup();
    const hero = h.world.hero;
    expect(h.world.swordBeam).toBe(false);
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
    h.world.warpTo('cellar', 12 * TILE, 5 * TILE);
    for (const k of h.world.enemies()) k.die(h.world);
    const chest = openChest(h);
    expect(chest.open).toBe(true);
    expect(h.world.inv.owned).toEqual(['boomerang']);
    expect(h.log.sfx).toContain('item-get');
    expect(drawnText(h)).toEqual(expect.arrayContaining(['YOU GOT THE BOOMERANG!', 'BOOMERANG: THROW']));
    expect(h.said.some((t) => t.startsWith('You got the boomerang!'))).toBe(true);
    h.step([], 80);
    h.world.warpTo('bats', 12 * TILE, 5 * TILE);
    h.world.warpTo('cellar', 12 * TILE, 5 * TILE);
    const again = h.world.entities.find((e) => e instanceof Chest) as Chest;
    expect(again.open).toBe(true);
    const gets = h.log.sfx.filter((s) => s === 'item-get').length;
    openChest(h);
    expect(h.log.sfx.filter((s) => s === 'item-get').length).toBe(gets);
    expect(h.world.inv.owned).toEqual(['boomerang']);
  });

  it('the keeper leaves a heart container when it falls, as a Zelda boss does: three hearts become four, all full', () => {
    const h = setup();
    const keeper = toKeeper(h);
    const hc = () =>
      h.world.entities.find((e) => e instanceof Pickup && e.kind === 'heart-container') as Pickup;
    expect(hc().hidden).toBe(true);
    keeper.die(h.world);
    h.step();
    expect(h.said).toContain('A heart container appears!');
    expect(hc().hidden).toBe(false);
    h.world.hero.hp = 1;
    h.world.hero.x = hc().x;
    h.world.hero.y = hc().y;
    h.step();
    expect(h.world.hero.maxHp).toBe(8);
    expect(h.world.hero.hp).toBe(8);
    expect(h.said).toContain('A heart container! One more heart, and every heart refilled.');
  });

  it('a bombs pickup adds four and is announced; no refill waits by the cracked wall (wasting bombs can cost the white sword)', () => {
    const h = setup();
    h.world.grant('bomb');
    h.world.inv.addAmmo('bomb', -9);
    h.world.warpTo('armory', 7.5 * TILE, 8 * TILE);
    expect(h.world.entities.some((e) => e instanceof Pickup && e.kind === 'bombs')).toBe(false);
    const hero = h.world.hero;
    h.world.add(new Pickup(hero.x + 4, hero.y, 'bombs'));
    h.step();
    expect(h.world.inv.count('bomb')).toBe(4);
    expect(h.said).toContain('Bombs! 4');
  });

  it("a bomb opens the armory's cracked wall (only a blast does); the shrine's chest holds the white sword", () => {
    const h = setup();
    h.world.warpTo('armory', 7.5 * TILE, 8 * TILE);
    for (const k of h.world.enemies()) k.die(h.world);
    openChest(h);
    expect(h.world.inv.count('bomb')).toBe(4);
    expect(drawnText(h)).toEqual(expect.arrayContaining(['YOU GOT THE BOMB!', 'BOMB: SET ONE DOWN']));
    h.step([], 70);
    h.world.grant('boomerang');
    h.world.inv.select('bomb');
    const hero = h.world.hero;
    hero.x = 2 * TILE;
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
    hero.x = 2 * TILE;
    hero.y = 5 * TILE;
    h.step(['left'], 100);
    expect(h.world.room.id).toBe('shrine');
    h.step([], 30); // he walks himself in past the wall
    expect(h.world.swordBeam).toBe(false);
    openChest(h);
    expect(h.world.swordBeam).toBe(true);
    expect(h.said).toContain('You got the white sword! At full hearts the sword shoots a beam.');
    expect(drawnText(h)).toEqual(
      expect.arrayContaining(['YOU GOT THE WHITE SWORD!', 'AT FULL HEARTS THE SWORD', 'SHOOTS A BEAM']),
    );
    h.step([], 70);
    // From now on a stab at full hearts throws a beam.
    hero.hp = hero.maxHp;
    hero.facing = 'right';
    h.tap('attack');
    expect(h.world.entities.some((e) => e instanceof SwordBeam)).toBe(true);
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

  it('draws the Zelda HUD: LEVEL-1 over the map, key and bomb counts, the B and A boxes, -LIFE-', () => {
    const h = setup();
    const first = drawnText(h);
    expect(first).toEqual(expect.arrayContaining(['LEVEL-1', 'B', 'A', '-LIFE-']));
    // The counts column shows keys and bombs from the start, as Zelda's does (no rupees here).
    expect(first.filter((t) => t === '×0')).toHaveLength(2);
    // No names on it: the art says what each box holds.
    for (const name of ['SHADOW KEEP', 'ITEM', 'SWORD']) expect(first).not.toContain(name);
    h.world.grant('boomerang');
    h.world.grant('bomb');
    expect(drawnText(h)).toEqual(expect.arrayContaining(['×0', '×4']));
  });

  it('the B box holds the item in the slot and the A box the sword, B on the left', () => {
    const h = setup();
    h.world.grant('boomerang');
    const at: Record<string, number> = {};
    // Without the art (headless), an icon is drawn as a white 8x16 stand-in.
    const icons: number[] = [];
    const none = new NullRenderer();
    const r: Renderer = {
      ...none,
      clear: none.clear,
      sprite: none.sprite,
      line: none.line,
      debugText: none.debugText,
      rect: (x, _y, w, h, c) => void (w === 8 && h === 16 && c === '#fcfcfc' && icons.push(x)),
      text: (_f, t, x) => void (at[t] ??= x),
    };
    h.game.scenes.render(r);
    expect(at.B).toBeLessThan(at.A as number);
    expect(at.A).toBeLessThan(at['-LIFE-'] as number);
    expect(at['LEVEL-1']).toBeLessThan(at.B as number);
    // Each icon sits under its letter: the boomerang in B, the sword in A.
    expect(icons).toEqual([at.B, at.A]);
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

  it('a spell hits Link whichever way he faces (no shield in the keep)', () => {
    const down = Math.PI / 2 + 0.3; // fanned, but mostly down
    for (const facing of ['up', 'right'] as const) {
      const h = setup();
      const hero = h.world.hero;
      hero.facing = facing;
      h.world.add(new Spell(hero.x + 14, hero.y - 36, down));
      h.step([], 40);
      expect(hero.hp).toBe(5);
    }
  });

  it("the keeper's touch costs a whole heart", () => {
    const h = setup();
    const keeper = toKeeper(h);
    const hero = h.world.hero;
    hero.invuln = 0;
    hero.attackT = 0;
    const hp = hero.hp;
    hero.x = keeper.x + 8;
    hero.y = keeper.y + 8;
    h.step();
    expect(hp - hero.hp).toBe(2);
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

  it('the keeper wakes without a name on screen, as a Zelda boss does', () => {
    const h = setup();
    const keeper = toKeeper(h);
    expect(keeper.awake).toBe(true);
    for (let i = 0; i < 60; i++) {
      expect(drawnText(h)).not.toContain('THE KEEPER');
      h.step();
    }
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
