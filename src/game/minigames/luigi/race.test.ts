import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Scene } from '@engine/scene';
import type { Announcer } from '@engine/a11y/announcer';
import { overlaps } from '@engine/math/aabb';
import { px, toPx } from '@engine/math/units';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { CHARACTERS } from '@game/characters/registry';
import { LUIGI } from '@game/characters/luigi';
import type { MiniGameResult } from '../types';
import { LUIGI_MINIGAME } from '.';
import { CARD_FRAMES, GO_FRAME, plantUp, RaceMenuScene, type MirrorRaceScene } from './race';
import { LUIGI_ROUTE, poleOf, RACE_SPAWNS_LEFT_OUT, RACE_TILE_CHANGES, raceCourse } from './course';
import { RivalLuigi, type Route } from './rival';
import { defaultSettings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import { AssistOptionsScene } from '@game/scenes/options';
import { Goomba } from '@game/entities/enemies/goomba';
import { Enemy } from '@game/entities/enemies/enemy';
import { Piranha } from '@game/entities/enemies/piranha';
import { Koopa } from '@game/entities/enemies/koopa';
import { Decoration } from '@game/entities/objects/decoration';
import { parseTextMap } from '@game/level/textmap';
import { DEFAULT_LEGEND, T } from '@game/level/tiles';
import { levelSeed, World } from '@game/world/world';
import { newGameState } from '@game/context';
import { MARIO } from '@game/characters/mario';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RaceBot, SHARP, CAUTIOUS } from './bot';
import { raceRun } from './sim';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** The first pit (px): the three-wide one before the brick row. */
const PIT_X = 848;

/**
 * Plays as Mario: the race bot (bot.ts) once the race is on, if given one, while also pressing any
 * extra actions the test asks for.
 */
class Driver implements InputFrame {
  private readonly bot: RaceBot | null;
  private readonly route: ScriptedInput | null;
  private readonly extra = new ScriptedInput({ steps: [] });
  constructor(bot: RaceBot | null) {
    this.bot = bot;
    this.route = bot ? new ScriptedInput({ steps: [] }) : null;
  }
  step(scene: MirrorRaceScene, extra: Action[]): void {
    if (this.bot && this.route) {
      this.route.setHeld(scene.phase === 'race' ? this.bot.step(scene.world) : []);
      this.route.next();
    }
    this.extra.setHeld(extra);
    this.extra.next();
  }
  held(a: Action): boolean {
    return (this.route?.held(a) ?? false) || this.extra.held(a);
  }
  pressed(a: Action): boolean {
    return (this.route?.pressed(a) ?? false) || this.extra.pressed(a);
  }
  released(a: Action): boolean {
    return (this.route?.released(a) ?? false) || this.extra.released(a);
  }
  bufferedJump(w: number): boolean {
    return (this.route?.bufferedJump(w) ?? false) || this.extra.bufferedJump(w);
  }
  consumeJumpBuffer(): void {
    this.route?.consumeJumpBuffer();
    this.extra.consumeJumpBuffer();
  }
  get dirX(): -1 | 0 | 1 {
    return this.route && this.route.dirX !== 0 ? this.route.dirX : this.extra.dirX;
  }
}

/** A text-recording renderer, so the HUD can be read back. */
class TextRenderer implements Renderer {
  texts: string[] = [];
  private readonly none = new NullRenderer();
  clear = this.none.clear;
  rect = this.none.rect;
  sprite = this.none.sprite;
  debugText = this.none.debugText;
  line = this.none.line;
  text(...args: Parameters<Renderer['text']>): void {
    this.texts.push(args[1]);
  }
}

/**
 * A real Game with the race pushed over a stand-in level scene, as the unlock flow does; `done`
 * records each result and pops the race (the flow's job) unless `keep` is set.
 */
function setup(bot: RaceBot | null, opts: { keep?: boolean; stubAssets?: boolean; noDamage?: boolean } = {}) {
  const assets = opts.stubAssets
    ? ({ sheet: () => ({ id: 'stub', image: null, frames: new Map() }) } as unknown as AssetRegistry)
    : new AssetRegistry({ default: {} });
  const said: string[] = [];
  const game = new Game({
    ctx: {
      assets,
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST, invulnerable: !!opts.noDamage },
      reduceFlashing: true,
    },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
  });
  const below: Scene = { update() {}, render() {} };
  game.scenes.push(below);
  const results: MiniGameResult[] = [];
  const scene = LUIGI_MINIGAME.create(game, (r) => {
    results.push(r);
    if (!opts.keep) game.scenes.pop();
  }) as MirrorRaceScene;
  game.scenes.push(scene);
  const input = new Driver(bot);
  const step = (extra: Action[] = []) => {
    input.step(scene, extra);
    game.scenes.update([input]);
  };
  const tap = (a: Action) => {
    step([a]);
    step();
  };
  /** Steps until the race reports (or `max` frames). */
  const play = (max = 4000) => {
    for (let i = 0; i < max && results.length === 0; i++) step();
  };
  /** Once the race is on, puts Mario on the ground just short of the first pit and runs him in. */
  const intoPit = () => {
    while (scene.phase !== 'race') step();
    const b = scene.world.player.body;
    b.x = px(PIT_X - 40);
    b.y = px(208) - b.h;
    scene.world.camera.snapTo(b.x);
    for (let i = 0; i < 2000 && results.length === 0; i++) step(['right', 'run']);
  };
  return { game, scene, below, results, said, step, tap, play, intoPit };
}

/** Luigi's finishing time on his own, with no plant up anywhere (frames after GO). */
function rivalTime(route: Route = LUIGI_ROUTE): number {
  const level = raceCourse();
  const r = new RivalLuigi(level, LUIGI, route, px(level.start.x * 16 - 16), poleOf(level));
  for (let f = 0; f < 3000 && !r.finished; f++) r.update();
  return r.finishedAt ?? Infinity;
}

/** A level's tiles, row by row, as the map's glyphs would give them (ids). */
const ll11 = () =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../../content/levels/lost/world1/ll-1-1.map'), 'utf8'),
    'll-1-1',
  );

describe('Mirror Race: the course and the rival', () => {
  it('keeps the course out of the level library (dev level select, campaign)', () => {
    expect(levelIds()).not.toContain('luigi-race');
    expect(raceCourse().id).toBe('luigi-race');
  });

  it('has rules within the rules card (26 columns) and the contract fields', () => {
    expect(LUIGI_MINIGAME.hero).toBe('luigi');
    expect(LUIGI_MINIGAME.title).toBe('MIRROR RACE');
    for (const line of LUIGI_MINIGAME.rules) expect(line.length).toBeLessThanOrEqual(26);
  });

  it("Luigi's route reaches the pole on its own, the same way every time", () => {
    const t = rivalTime();
    expect(t).toBeGreaterThan(2250);
    expect(t).toBeLessThan(2330);
    expect(rivalTime()).toBe(t);
  });

  it("is The Lost Levels' 1-1 (ll-1-1.map) tile for tile, but for the listed easings", () => {
    const race = raceCourse();
    const lost = ll11();
    expect([race.width, race.height]).toEqual([lost.width, lost.height]);
    const changed = new Map(RACE_TILE_CHANGES.map(([x, y, from, to]) => [`${x},${y}`, { from, to }]));
    const glyph = (id: number | undefined) =>
      Object.entries(DEFAULT_LEGEND).find(([, v]) => v === id)?.[0] ?? '.';
    for (let y = 0; y < race.height; y++)
      for (let x = 0; x < race.width; x++) {
        const a = race.tiles[y * race.width + x];
        const b = lost.tiles[y * lost.width + x];
        const c = changed.get(`${x},${y}`);
        if (!c) {
          expect(a, `${x},${y}`).toBe(b);
          continue;
        }
        // Enemy glyphs are spawns, not tiles: both read as air there; the bricks really go. A listed
        // tile 'from' is what Lost Levels 1-1 really has there (so no coin is lost unlisted).
        if (c.from === '=') expect([glyph(b), glyph(a)]).toEqual(['=', '.']);
        else if (c.from === '.') expect(glyph(b), `${x},${y}`).toBe('.');
      }
    // Each listed enemy glyph change is a spawn moved or gone.
    const at = (l: typeof race, x: number, y: number) => l.entities.some((e) => e.x === x && e.y === y);
    for (const [x, y, from, to] of RACE_TILE_CHANGES) {
      if (from !== '.' && from !== '=')
        expect([at(lost, x, y), at(race, x, y)], `${x},${y}`).toEqual([true, false]);
      if (to !== '.') expect(at(race, x, y), `${x},${y}`).toBe(true);
    }
    // The [entities] spawns: the level's, less the listed ones (and its halfway point, bonus pipe).
    const line = (e: (typeof race.entities)[number]) => `${e.type} ${e.x} ${e.y}`;
    const listed = (l: typeof race) =>
      l.entities.filter((e) => !RACE_TILE_CHANGES.some(([x, y]) => e.x === x && e.y === y)).map(line);
    expect(listed(race)).toEqual(listed(lost).filter((e) => !RACE_SPAWNS_LEFT_OUT.includes(e)));
    expect(race.zones.map((z) => z.kind)).toEqual(['exit']);
  });

  it('has the 1-1 pieces: plants in its pipes, a Paratroopa and a Koopa, the poison mushroom, the staircase and the flag', () => {
    const race = raceCourse();
    const at = (x: number, y: number) => race.tiles[y * race.width + x];
    const plants = race.entities.filter((e) => e.type === 'piranha');
    expect(plants.length).toBeGreaterThanOrEqual(4);
    for (const p of plants) expect([T.PIPE_TL, T.PIPE_H_TL]).toContain(at(p.x, p.y));
    const kinds = race.entities.map((e) => e.type);
    expect(kinds).toContain('koopa-para-green');
    expect(kinds.some((k) => k === 'koopa-green' || k === 'koopa-red')).toBe(true);
    expect(race.tiles).toContain(T.Q_POISON);
    // The staircase: eight hard-block steps up, just before the pole.
    const pole = poleOf(race);
    const col = Math.floor(pole.x / 16);
    let top = Infinity;
    for (let x = col - 12; x < col; x++)
      for (let y = 0; y < race.height; y++) if (at(x, y) === T.HARD) top = Math.min(top, y);
    expect(top).toBeLessThanOrEqual(12 - 7);
    expect(race.zones.some((z) => z.kind === 'exit')).toBe(true);
  });

  it('Luigi stops short of a pipe while its plant is up, then goes on once it is down', () => {
    const level = raceCourse();
    const r = new RivalLuigi(level, LUIGI, LUIGI_ROUTE, px(level.start.x * 16 - 16), poleOf(level));
    let up = true;
    // A plant up over the tall pipe (px 624-655) for the first 600 frames.
    r.plantUp = (x0, x1) => up && x0 < 656 && x1 > 624;
    for (let f = 0; f < 600; f++) r.update();
    expect(r.x + toPx(r.player.body.w)).toBeLessThan(624);
    expect(r.x).toBeGreaterThan(520);
    expect(r.player.body.vx).toBe(0);
    expect(r.waited).toBeGreaterThan(100);
    up = false;
    for (let f = 0; f < 3000 && !r.finished; f++) r.update();
    expect(r.finished).toBe(true);
  });

  it('Luigi hops up a pipe he runs into, and jumps a pit off his route (after waiting for a plant)', () => {
    const level = raceCourse();
    // No route jump for the tall pipe nor the first pit: he runs into the pipe, stands a moment
    // and hops up it; at the pit's edge he jumps it.
    const route = { ...LUIGI_ROUTE, jumps: LUIGI_ROUTE.jumps.slice(1) };
    const r = new RivalLuigi(level, LUIGI, route, px(level.start.x * 16 - 16), poleOf(level));
    for (let f = 0; f < 500; f++) r.update();
    expect(r.x).toBeGreaterThan(660);
    for (let f = 0; f < 400; f++) r.update();
    expect(r.x).toBeGreaterThan(PIT_X + 48);
    expect(toPx(r.player.body.y)).toBeLessThan(240);
    expect(rivalTime(route)).toBeLessThan(Infinity);
  });

  it("finds the race's plants that are up over a stretch, within a jump's reach", () => {
    const level = raceCourse();
    const w = new World(
      level,
      {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST },
        reduceFlashing: true,
      },
      newGameState(MARIO),
      { seed: levelSeed(level) },
    );
    const plant = new Piranha(39, 9); // the tall pipe's, px 624-655, its mouth at 144
    w.entities.push(plant);
    expect(plantUp(w, 600, 700, 208)).toBe(false); // in its pipe
    for (let f = 0; f < 60; f++) plant.update(w);
    expect(plant.body.h).toBeGreaterThan(0);
    expect(plantUp(w, 600, 700, 208)).toBe(true);
    expect(plantUp(w, 656, 700, 208)).toBe(false); // past it
    expect(plantUp(w, 600, 700, 240)).toBe(false); // too far below to reach it
  });
});

describe('Mirror Race: outcomes', () => {
  it('opens on the black WORLD 1-1 card, then shows the course a moment, and nobody moves before GO', () => {
    const h = setup(null);
    const x0 = h.scene.world.player.body.x;
    const l0 = h.scene.rival.player.body.x;
    expect(h.scene.phase).toBe('card');
    for (let i = 0; i < CARD_FRAMES - 1; i++) h.step(['right', 'run']);
    expect(h.scene.phase).toBe('card');
    h.step(['right', 'run']);
    expect(h.scene.phase).toBe('ready');
    for (let i = CARD_FRAMES; i < GO_FRAME - 1; i++) h.step(['right', 'run']);
    expect(h.scene.phase).toBe('ready');
    expect(h.scene.world.player.body.x).toBe(x0);
    expect(h.scene.rival.player.body.x).toBe(l0);
    for (let i = 0; i < 30; i++) h.step(['right', 'run']);
    expect(h.scene.phase).toBe('race');
    expect(h.scene.world.player.body.x).toBeGreaterThan(x0);
    // A short beat on the course before GO, so nobody starts blind off the black card.
    expect(GO_FRAME - CARD_FRAMES).toBeGreaterThanOrEqual(20);
    expect(GO_FRAME - CARD_FRAMES).toBeLessThanOrEqual(60);
    expect(h.said[0]).toBe('World 1-1. Race Luigi to the flag!');
    expect(h.said).toContain('Go!');
  });

  it('a sharp run beats Luigi to the flag by over a second and a half: pass', () => {
    const h = setup(new RaceBot(SHARP));
    h.play();
    expect(h.results).toEqual(['pass']);
    expect(h.scene.rival.finished).toBe(false);
    expect(h.game.scenes.top).toBe(h.below);
    // Luigi raced on (as if Mario had not won) takes the flag well after.
    const run = raceRun({ ...SHARP, rivalOn: true });
    expect(run.result).toBe('pass');
    expect((run.luigiAt ?? 0) - (run.marioAt ?? Infinity)).toBeGreaterThan(90);
  });

  it('a careful run, waiting at plants that are up, still wins', () => {
    const run = raceRun({ ...CAUTIOUS, rivalOn: true });
    expect(run.result).toBe('pass');
    expect(run.waited).toBeGreaterThan(60);
  });

  it('standing still loses (with No damage, so nothing kills him): Luigi takes the flag, fail', () => {
    const h = setup(null, { noDamage: true });
    h.play(4000);
    expect(h.results).toEqual(['fail']);
    expect(h.scene.rival.finished).toBe(true);
    expect(h.scene.world.player.dead).toBe(false);
    expect(h.scene.world.flagGrabbedBy).toBeNull();
  });

  it('falling in a pit fails (after the death), before Luigi finishes', () => {
    const h = setup(null);
    h.intoPit();
    expect(h.results).toEqual(['fail']);
    expect(h.scene.world.player.dead).toBe(true);
    expect(toPx(h.scene.world.player.body.y)).toBeGreaterThan(240);
    expect(h.scene.rival.finished).toBe(false);
    expect(h.said).toContain('Mario fell. Try again.');
  });

  it('once Mario wins, Luigi lets go and coasts to a stop on the ground (no mid-air freeze)', () => {
    const h = setup(new RaceBot(SHARP), { keep: true });
    for (let i = 0; i < 3000 && h.scene.phase !== 'won'; i++) h.step();
    const l = h.scene.rival.player.body;
    h.play();
    expect(h.results).toEqual(['pass']);
    expect(l.onGround).toBe(true);
    expect(l.vx).toBe(0);
    expect(h.scene.rival.finished).toBe(false);
    // Stopped mid-jump over a pit, he holds on through the jump and lands past it.
    const level = raceCourse();
    const r = new RivalLuigi(level, LUIGI, LUIGI_ROUTE, px(level.start.x * 16 - 16), poleOf(level));
    for (let f = 0; f < 3000 && !(r.x > PIT_X - 24 && !r.player.body.onGround); f++) r.update();
    const x0 = r.x;
    r.stopped = true;
    for (let f = 0; f < 300; f++) r.update();
    expect(r.player.body.onGround).toBe(true);
    expect(r.player.body.vx).toBe(0);
    expect(r.x).toBeGreaterThan(x0);
    expect(toPx(r.player.body.y)).toBeLessThan(208);
  });

  it('the menu offers Continue (the race resumes where it was) and Give up (quit)', () => {
    const h = setup(null);
    for (let i = 0; i < GO_FRAME + 40; i++) h.step(['right']);
    const x = h.scene.world.player.body.x;
    const lx = h.scene.rival.player.body.x;
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(RaceMenuScene);
    for (let i = 0; i < 10; i++) h.step(['right']);
    expect(h.scene.world.player.body.x).toBe(x);
    expect(h.scene.rival.player.body.x).toBe(lx);
    h.tap('jump'); // Continue
    expect(h.game.scenes.top).toBe(h.scene);
    expect(h.results).toEqual([]);
    h.tap('start');
    for (let i = 0; i < 8; i++) h.step();
    h.tap('down');
    h.tap('jump'); // Give up
    expect(h.results).toEqual(['quit']);
    expect(h.game.scenes.top).toBe(h.below);
  });

  it('in dev mode the menu offers the assists too (not without dev mode)', () => {
    const labels = (dev: boolean) => {
      const h = setup(null);
      h.game.deps.settings = { ...defaultSettings(), dev };
      for (let i = 0; i < 20; i++) h.step();
      h.tap('start');
      const menu = h.game.scenes.top as RaceMenuScene;
      expect(menu).toBeInstanceOf(RaceMenuScene);
      return { h, items: (menu as unknown as { items: MenuItem[] }).items };
    };
    expect(labels(false).items.map((i) => i.label)).toEqual(['Continue', 'Give up']);
    const { h, items } = labels(true);
    expect(items.map((i) => i.label)).toEqual(['Continue', 'Give up', 'Assists']);
    items[2]?.select?.();
    expect(h.game.scenes.top).toBeInstanceOf(AssistOptionsScene);
  });

  it('dev assist No damage: an enemy cannot hurt Mario, but a pit still ends the race', () => {
    const touch = (invulnerable: boolean) => {
      const h = setup(null);
      h.game.ctx.assist.invulnerable = invulnerable;
      for (let i = 0; i < GO_FRAME + 5; i++) h.step();
      const m = h.scene.world.player.body;
      h.scene.world.spawn(new Goomba(m.x + px(20), m.y + m.h - px(14)));
      for (let i = 0; i < 90 && h.results.length === 0; i++) h.step();
      return h;
    };
    expect(touch(false).scene.world.player.dead).toBe(true);
    const safe = touch(true);
    expect(safe.scene.world.player.dead).toBe(false);
    expect(safe.scene.phase).toBe('race');
    const pit = setup(null, { noDamage: true });
    pit.intoPit();
    expect(pit.results).toEqual(['fail']);
    expect(pit.said).toContain('Mario fell. Try again.');
  });

  it('the menu opens during the countdown too, and Give up quits from there', () => {
    const h = setup(null);
    for (let i = 0; i < 20; i++) h.step();
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(RaceMenuScene);
    for (let i = 0; i < 8; i++) h.step();
    h.tap('down');
    h.tap('jump');
    expect(h.results).toEqual(['quit']);
  });

  it.each([
    ['pass', () => setup(new RaceBot(SHARP), { keep: true }), (h: ReturnType<typeof setup>) => h.play(3000)],
    [
      'fail',
      () => setup(null, { keep: true, noDamage: true }),
      (h: ReturnType<typeof setup>) => h.play(4000),
    ],
    ['fail', () => setup(null, { keep: true }), (h: ReturnType<typeof setup>) => h.intoPit()],
  ] as const)('calls done exactly once (%s), however long the scene is left running', (want, make, run) => {
    const h = make();
    run(h);
    expect(h.results).toEqual([want]);
    // Left on top (the flow is slow to pop it), with the menu button pressed now and then.
    for (let i = 0; i < 1000; i++) h.step(i % 7 === 0 ? ['start'] : []);
    expect(h.results).toEqual([want]);
    expect(h.game.scenes.top).toBe(h.scene);
  });

  it('the rival never touches or hurts Mario: standing still, he runs through and wins', () => {
    const h = setup(null);
    let crossed = false;
    for (let i = 0; i < 4000 && h.results.length === 0; i++) {
      // The course's own enemies would get Mario first: clear them away.
      const w = h.scene.world;
      for (let k = w.entities.length - 1; k >= 0; k--)
        if (w.entities[k] instanceof Enemy) w.entities.splice(k, 1);
      h.step();
      const m = h.scene.world.player;
      if (overlaps(m.body, h.scene.rival.player.body)) crossed = true;
      expect(m.dead).toBe(false);
      expect(m.invuln).toBe(0);
      expect(m.powerState).toBe('small');
    }
    expect(crossed).toBe(true);
    expect(h.results).toEqual(['fail']);
    expect(h.scene.rival.finished).toBe(true);
  });

  it("leaves the campaign's state alone (score, coins, lives, power, hero)", () => {
    const h = setup(new RaceBot(SHARP));
    const s = h.game.state;
    const before = { ...s };
    h.play(3000);
    expect(h.results).toEqual(['pass']);
    expect(h.scene.world.state.score).toBeGreaterThan(0); // the flag's points went to the race
    expect(s).toEqual(before);
  });
});

describe('Mirror Race: the start (0.4.22, owner note 9)', () => {
  it('frame 0: the start castle and the Paratroopa at column 16 are already spawned', () => {
    const h = setup(null, { stubAssets: true });
    const w = h.scene.world;
    expect(w.entities.some((e) => e instanceof Decoration && toPx(e.body.x) < 16 * 3)).toBe(true);
    expect(w.entities.some((e) => e instanceof Koopa && e.wings && toPx(e.body.x) >> 4 === 16)).toBe(true);
    // Nothing more spawns at GO: what the banner showed is what races.
    const before = w.entities.length;
    for (let i = 0; i < GO_FRAME; i++) h.step();
    expect(h.scene.phase).toBe('race');
    expect(w.entities.length).toBe(before);
  });

  it('a TRY AGAIN skips the lives card: straight to the course under the banner, no lives shown', () => {
    const h = setup(null, { stubAssets: true });
    const results: MiniGameResult[] = [];
    const retry = LUIGI_MINIGAME.create(h.game, (r) => void results.push(r), {
      retry: true,
    }) as MirrorRaceScene;
    h.game.scenes.push(retry);
    expect(retry.phase).toBe('ready');
    const r = new TextRenderer();
    h.game.scenes.render(r);
    expect(r.texts).toContain('RACE LUIGI TO THE FLAG!');
    expect(r.texts).not.toContain('WORLD 1-1');
    expect(r.texts.some((t) => t.startsWith('×'))).toBe(false);
    expect(retry.world.entities.some((e) => e instanceof Decoration)).toBe(true);
  });
});

describe('Mirror Race: screen', () => {
  it("draws the WORLD 1-1 card with the HUD and Mario's lives, and no 3-2-1 countdown", () => {
    const h = setup(null, { stubAssets: true });
    const r = new TextRenderer();
    h.game.scenes.render(r);
    expect(r.texts).toEqual(expect.arrayContaining(['MARIO ', 'WORLD', '1-1', 'TIME', '400', 'WORLD 1-1']));
    expect(r.texts).toContain(`×  ${h.scene.world.state.lives}`);
    for (const n of ['3', '2', '1']) expect(r.texts).not.toContain(n);
    for (let i = 0; i < CARD_FRAMES; i++) h.step();
    r.texts = [];
    h.game.scenes.render(r);
    expect(r.texts).toContain('RACE LUIGI TO THE FLAG!');
    expect(r.texts).not.toContain('WORLD 1-1');
  });

  it('races under the SMB HUD (name, score, coins, WORLD, a TIME that runs down), the track bar under it', () => {
    const h = setup(null, { stubAssets: true, noDamage: true });
    const rects: { y: number; h: number }[] = [];
    const r = new TextRenderer();
    (r as Renderer).rect = (_x, y, _w, hh) => void rects.push({ y, h: hh });
    for (let i = 0; i < GO_FRAME + 60 * 10; i++) h.step(['right']);
    r.texts = [];
    h.game.scenes.render(r);
    expect(r.texts).toEqual(expect.arrayContaining(['MARIO ', 'WORLD', '1-1', 'TIME']));
    expect(r.texts.some((t) => /^\d{7}$/.test(t))).toBe(true);
    expect(r.texts.some((t) => t.startsWith('$×'))).toBe(true);
    // Ten seconds of racing: the clock is down from 400 at the level's pace.
    const time = Number(r.texts.find((t) => /^\d{3}$/.test(t)));
    expect(time).toBeLessThan(400);
    expect(time).toBeGreaterThan(370);
    // No race clock in seconds and tenths any more.
    expect(r.texts.some((t) => /^\d+\.\d$/.test(t))).toBe(false);
    // The track (its white line, a 1-px rect) runs under the HUD's two rows.
    const line = rects.find((b) => b.h === 1);
    expect(line?.y).toBeGreaterThan(24);
  });

  it("the card shows the campaign's lives when raced from a save file, and no TIME with infinite time", () => {
    const h = setup(null, { stubAssets: true });
    h.game.campaign = { slot: 1 } as typeof h.game.campaign;
    h.game.state.lives = 7;
    h.game.ctx.assist.infiniteTime = true;
    const r = new TextRenderer();
    h.game.scenes.render(r);
    expect(r.texts).toContain('×  7');
    expect(r.texts).toContain('TIME');
    expect(r.texts).not.toContain('400');
    // A round for fun keeps the round's own lives.
    const fun = setup(null, { stubAssets: true });
    fun.game.campaign = { slot: 1 } as typeof fun.game.campaign;
    fun.game.inRound = true;
    fun.game.state.lives = 7;
    const r2 = new TextRenderer();
    fun.game.scenes.render(r2);
    expect(r2.texts).toContain(`×  ${fun.scene.world.state.lives}`);
  });

  it('draws the track, the off-screen arrow and the result banner', () => {
    const h = setup(null, { stubAssets: true, noDamage: true });
    const r = new TextRenderer();
    // Mario stands still; Luigi runs off the right of the screen, then wins.
    let arrow = false;
    let banner = false;
    for (let i = 0; i < 4000 && h.results.length === 0; i++) {
      h.step();
      r.texts = [];
      h.game.scenes.render(r);
      if (r.texts.includes('LUIGI')) arrow = true;
      if (r.texts.includes('LUIGI WINS!')) banner = true;
    }
    expect(arrow).toBe(true);
    expect(banner).toBe(true);
  });

  it('labels only MENU on the card, the buttons as in a level from the course on, and none once decided', () => {
    const h = setup(null, { keep: true });
    expect(h.scene.touchLabels().jump).toBeNull();
    expect(h.scene.touchLabels().start).toBe('MENU');
    for (let i = 0; i < CARD_FRAMES; i++) h.step();
    expect(h.scene.touchLabels().jump).toBe('JUMP');
    expect(h.scene.touchLabels().start).toBe('MENU');
    h.intoPit();
    expect(h.scene.touchLabels().jump).toBeNull();
    expect(h.scene.touchLabels().start).toBeNull();
  });
});
