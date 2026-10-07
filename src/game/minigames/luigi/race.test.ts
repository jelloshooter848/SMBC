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
import { CARD_FRAMES, GO_FRAME, RaceMenuScene, type MirrorRaceScene } from './race';
import { LUIGI_ROUTE, poleOf, raceCourse } from './course';
import { RivalLuigi, RouteInput, type Route } from './rival';
import { defaultSettings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import { AssistOptionsScene } from '@game/scenes/options';
import { Goomba } from '@game/entities/enemies/goomba';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** Mario's fast run: holds run the whole way, jumping at these points (px of his left edge). */
const FAST: Route = {
  jumps: [270, 380, 520, 610, 755, 940, 1130, 1210].map((at) => ({ at, hold: 20 })),
};
/** The same run with a stumble: he stops for over a second on the first screen. */
const STUMBLE: Route = { ...FAST, pauses: [{ at: 100, frames: 75 }] };
/** A cautious walk (never runs), hopping each obstacle. */
const WALK: Route = {
  walks: [[0, 2000]],
  jumps: [280, 395, 540, 590, 618, 788, 855, 950, 1140, 1190].map((at) => ({ at, hold: 20 })),
};
/** Runs, clears the low pipe, and then never jumps again: into the first pit. */
const PIT: Route = { jumps: [{ at: 270, hold: 20 }] };

/** Plays `route` (as Mario) while also pressing any extra actions the test asks for. */
class Driver implements InputFrame {
  private readonly route: RouteInput | null;
  private readonly extra = new ScriptedInput({ steps: [] });
  constructor(route: Route | null) {
    this.route = route ? new RouteInput(route) : null;
  }
  step(scene: MirrorRaceScene, extra: Action[]): void {
    this.route?.step(scene.world.player);
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
    return (this.route?.bufferedJump() ?? false) || this.extra.bufferedJump(w);
  }
  consumeJumpBuffer(): void {
    this.route?.consumeJumpBuffer();
    this.extra.consumeJumpBuffer();
  }
  get dirX(): -1 | 0 | 1 {
    return this.route ? this.route.dirX : this.extra.dirX;
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
function setup(route: Route | null, opts: { keep?: boolean; stubAssets?: boolean } = {}) {
  const assets = opts.stubAssets
    ? ({ sheet: () => ({ id: 'stub', image: null, frames: new Map() }) } as unknown as AssetRegistry)
    : new AssetRegistry({ default: {} });
  const said: string[] = [];
  const game = new Game({
    ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
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
  const input = new Driver(route);
  const step = (extra: Action[] = []) => {
    input.step(scene, extra);
    game.scenes.update([input]);
  };
  const tap = (a: Action) => {
    step([a]);
    step();
  };
  /** Steps until the race reports (or `max` frames). */
  const play = (max = 2000) => {
    for (let i = 0; i < max && results.length === 0; i++) step();
  };
  return { game, scene, below, results, said, step, tap, play };
}

/** Luigi's finishing time on his own (frames after GO). */
function rivalTime(): number {
  const level = raceCourse();
  const r = new RivalLuigi(level, LUIGI, LUIGI_ROUTE, px(level.start.x * 16 - 16), poleOf(level));
  for (let f = 0; f < 2000 && !r.finished; f++) r.update();
  return r.finishedAt ?? Infinity;
}

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
    expect(t).toBeGreaterThan(660);
    expect(t).toBeLessThan(740);
    expect(rivalTime()).toBe(t);
  });
});

describe('Mirror Race: outcomes', () => {
  it('opens on the black WORLD 1-1 card, then shows the course a moment, and nobody moves before GO', () => {
    const h = setup(FAST);
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
    for (let i = 0; i < 30; i++) h.step();
    expect(h.scene.phase).toBe('race');
    expect(h.scene.world.player.body.x).toBeGreaterThan(x0);
    // A short beat on the course before GO, so nobody starts blind off the black card.
    expect(GO_FRAME - CARD_FRAMES).toBeGreaterThanOrEqual(20);
    expect(GO_FRAME - CARD_FRAMES).toBeLessThanOrEqual(60);
    expect(h.said[0]).toBe('World 1-1. Race Luigi to the flag!');
    expect(h.said).toContain('Go!');
  });

  it('a fast run beats Luigi to the flag: pass', () => {
    const h = setup(FAST);
    let wonAt = -1;
    for (let i = 0; i < 2000 && h.results.length === 0; i++) {
      h.step();
      if (wonAt < 0 && h.scene.phase === 'won') wonAt = h.scene.raceFrames;
    }
    expect(h.results).toEqual(['pass']);
    expect(h.scene.rival.finished).toBe(false);
    // Well ahead: more than a second and a half.
    expect(rivalTime() - wonAt).toBeGreaterThan(90);
    expect(h.game.scenes.top).toBe(h.below);
  });

  it('a good run with a stumble still wins, by one to two seconds', () => {
    const h = setup(STUMBLE);
    let wonAt = -1;
    for (let i = 0; i < 2000 && h.results.length === 0; i++) {
      h.step();
      if (wonAt < 0 && h.scene.phase === 'won') wonAt = h.scene.raceFrames;
    }
    expect(h.results).toEqual(['pass']);
    const margin = rivalTime() - wonAt;
    expect(margin).toBeGreaterThanOrEqual(60);
    expect(margin).toBeLessThanOrEqual(120);
  });

  it('a cautious walk loses: Luigi takes the flag first, fail', () => {
    const h = setup(WALK);
    h.play();
    expect(h.results).toEqual(['fail']);
    expect(h.scene.rival.finished).toBe(true);
    expect(h.scene.world.player.dead).toBe(false);
    expect(h.scene.world.flagGrabbedBy).toBeNull();
  });

  it('falling in a pit fails (after the death), before Luigi finishes', () => {
    const h = setup(PIT);
    h.play();
    expect(h.results).toEqual(['fail']);
    expect(h.scene.world.player.dead).toBe(true);
    expect(toPx(h.scene.world.player.body.y)).toBeGreaterThan(240);
    expect(h.scene.rival.finished).toBe(false);
    expect(h.said).toContain('Mario fell. Try again.');
  });

  it('once Mario wins, Luigi lets go and coasts to a stop on the ground (no mid-air freeze)', () => {
    const h = setup(FAST, { keep: true });
    for (let i = 0; i < 2000 && h.scene.phase !== 'won'; i++) h.step();
    const l = h.scene.rival.player.body;
    const at = { x: l.x, y: l.y };
    h.play();
    expect(h.results).toEqual(['pass']);
    expect(l.onGround).toBe(true);
    expect(l.vx).toBe(0);
    expect(l.x !== at.x || l.y !== at.y).toBe(true);
    expect(h.scene.rival.finished).toBe(false);
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
    const pit = setup(PIT);
    pit.game.ctx.assist.invulnerable = true;
    pit.play();
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
    ['pass', FAST],
    ['fail', WALK],
    ['fail', PIT],
  ] as const)('calls done exactly once (%s), however long the scene is left running', (want, route) => {
    const h = setup(route, { keep: true });
    h.play();
    expect(h.results).toEqual([want]);
    // Left on top (the flow is slow to pop it), with the menu button pressed now and then.
    for (let i = 0; i < 1000; i++) h.step(i % 7 === 0 ? ['start'] : []);
    expect(h.results).toEqual([want]);
    expect(h.game.scenes.top).toBe(h.scene);
  });

  it('the rival never touches or hurts Mario: standing still, he runs through and wins', () => {
    const h = setup(null);
    let crossed = false;
    for (let i = 0; i < 2000 && h.results.length === 0; i++) {
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
    const h = setup(FAST);
    const s = h.game.state;
    const before = { ...s };
    h.play();
    expect(h.results).toEqual(['pass']);
    expect(h.scene.world.state.score).toBeGreaterThan(0); // the flag's points went to the race
    expect(s).toEqual(before);
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
    const h = setup(null, { stubAssets: true });
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
    const h = setup(null, { stubAssets: true });
    const r = new TextRenderer();
    // Mario stands still; Luigi runs off the right of the screen, then wins.
    let arrow = false;
    let banner = false;
    for (let i = 0; i < 2000 && h.results.length === 0; i++) {
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
    const h = setup(PIT);
    expect(h.scene.touchLabels().jump).toBeNull();
    expect(h.scene.touchLabels().start).toBe('MENU');
    for (let i = 0; i < CARD_FRAMES; i++) h.step();
    expect(h.scene.touchLabels().jump).toBe('JUMP');
    expect(h.scene.touchLabels().start).toBe('MENU');
    for (let i = 0; i < 2000 && !h.scene.world.player.dead; i++) h.step();
    expect(h.scene.touchLabels().jump).toBeNull();
    expect(h.scene.touchLabels().start).toBeNull();
  });
});
