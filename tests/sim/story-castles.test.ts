import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { ScriptedInput } from '@game/sim/headless';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { PALETTES, SPRITES } from '@content/sprites';
import { getLevel } from '@content/levels';
import { MARIO } from '@game/characters/mario';
import { CHARACTERS } from '@game/characters/registry';
import { Bowser } from '@game/entities/enemies/bowser';
import { Corpse } from '@game/entities/effects/effects';
import { WandPoof } from '@game/entities/effects/wand-poof';
import { Toad } from '@game/entities/objects/toad';
import { Princess } from '@game/entities/objects/princess';
import { campaignLevel } from '@game/level/campaign';
import { CASTLE_PAGES, STORY_NOT_OVER } from '@game/story/script';
import { CREDITS, CREDITS_NAME, CreditsScene, creditsLines } from '@game/scenes/credits';
import { Game } from '@game/scenes/game';
import { LevelScene } from '@game/scenes/level';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import type { View } from '@game/entities/entity';
import { px } from '@engine/math/units';

// docs/STORY.md 2.3a, the castle blocks of 2.4-2.10, and 2.12: the campaign's castles name the
// fake Bowser's true form and then tell the news (two pages); the fakes show their true form in a
// tell and burst out of the disguise however they are beaten; 8-4 has Toad and a credits line.
// Classic play keeps the NES text and behaviour.

const levels = join(import.meta.dirname, '../../src/content/levels');
const load = (path: string, id: string): LevelData =>
  parseTextMap(readFileSync(join(levels, path), 'utf8'), id);

const OLD_NEWS = ['', 'BUT OUR PRINCESS IS IN', 'ANOTHER CASTLE!'];

const SMB_CASTLES: [string, string][] = [
  ['1-4', 'world1/1-4.map'],
  ['2-4', 'world2/2-4.map'],
  ['3-4', 'world3/3-4.map'],
  ['4-4', 'world4/4-4.map'],
  ['5-4', 'world5/5-4.map'],
  ['6-4', 'world6/6-4.map'],
  ['7-4', 'world7/7-4.map'],
];

function makeWorld(level: LevelData, story: boolean, start: { x: number; y: number } | null = null) {
  const sfx: string[] = [];
  const state = newGameState(MARIO);
  state.world = level.world;
  const world = new World(
    level,
    {
      assets: new AssetRegistry({ default: {} }),
      audio: { ...NULL_AUDIO, sfx: (id: string) => void sfx.push(id) },
      assist: { ...DEFAULT_ASSIST, invulnerable: true },
      reduceFlashing: true,
    },
    state,
    start ? { ...start, mode: 'stand' } : {},
  );
  world.storyMode = story;
  return { world, sfx };
}

const axeOf = (level: LevelData) => level.entities.find((e) => e.type === 'axe') as { x: number };
const bowserOf = (w: World) => w.entities.find((e): e is Bowser => e instanceof Bowser && e.alive && !e.fake);

/** Clear a castle by the axe; returns the text pages, what was said and the sounds. */
function clearCastle(level: LevelData, story: boolean) {
  const axe = axeOf(level).x;
  const { world, sfx } = makeWorld(level, story, { x: axe - 6, y: 8 });
  const input = new ScriptedInput({ steps: [{ frame: 0, hold: [] as Action[] }] });
  const texts: string[][] = [];
  const said: string[] = [];
  let exitAt = -1;
  let placed = false;
  let unmasked: string | null = null;
  let poofs = 0;
  let frames = 0;
  for (; frames < 2000 && exitAt < 0; frames++) {
    const b = bowserOf(world);
    if (!placed && b) {
      placed = true;
      const p = world.player.body;
      p.x = px(axe * 16 + 2);
      p.y = px(9 * 16) - p.h;
      p.vx = 0;
      p.vy = 0;
      world.camera.snapTo(p.x);
    }
    input.next();
    world.update([input]);
    for (const ev of world.events.splice(0)) {
      if (ev.type === 'say') said.push(ev.text);
      if (ev.type === 'exit') exitAt = frames;
    }
    const falling = world.entities.find((e): e is Bowser => e instanceof Bowser && !e.fake);
    if (falling?.currentFrame?.startsWith('bowser-die-')) unmasked = falling.currentFrame;
    poofs += world.entities.filter((e) => e instanceof WandPoof).length > 0 ? 1 : 0;
    const last = texts[texts.length - 1];
    if (world.castleText.join('|') !== (last ?? []).join('|')) texts.push([...world.castleText]);
  }
  return { world, texts, said, sfx, exitAt, unmasked, poofs, placed };
}

describe('castle pages (campaign)', () => {
  it.each(SMB_CASTLES)('%s: thanks, the reveal page, then the news page in the same box', (id, path) => {
    const r = clearCastle(load(path, id), true);
    expect(r.placed).toBe(true);
    const page = CASTLE_PAGES[id];
    expect(page).toBeDefined();
    if (!page) return;
    expect(r.texts).toEqual([
      ['THANK YOU MARIO!'],
      ['THANK YOU MARIO!', '', ...page.reveal],
      ['THANK YOU MARIO!', '', ...page.news],
    ]);
    expect(r.texts.flat()).not.toContain('ANOTHER CASTLE!');
    // Each page is read out.
    expect(r.said).toEqual([
      ['THANK YOU MARIO!', ...page.reveal].join(' '),
      ['THANK YOU MARIO!', ...page.news].join(' '),
    ]);
    // The axe drop unmasks the fake: a poof, and its true form falls.
    expect(r.unmasked).toBe(`bowser-die-${id[0]}`);
    expect(r.poofs).toBeGreaterThan(0);
    expect(r.sfx).toContain('poof');
  });

  it('8-4: "no trick this time", then the wand breaks; the real king falls without a poof', () => {
    const level = load('world8/8-4-end.map', '8-4-end');
    const r = clearCastle(level, true);
    const page = CASTLE_PAGES['8-4'];
    if (!page) throw new Error('no 8-4 page');
    expect(r.texts).toEqual([
      ['THANK YOU MARIO!'],
      ['THANK YOU MARIO!', '', ...page.reveal],
      ['THANK YOU MARIO!', '', ...page.news],
    ]);
    expect(r.texts.flat()).not.toContain('YOUR QUEST IS OVER.');
    expect(r.unmasked).toBeNull();
    expect(r.poofs).toBe(0);
    expect(r.sfx).not.toContain('poof');
  });

  it('page 2 shows 2 s after page 1 and stays up about 3.5 s before the exit', () => {
    const level = load('world1/1-4.map', '1-4');
    const axe = axeOf(level).x;
    const { world } = makeWorld(level, true, { x: axe - 6, y: 8 });
    const input = new ScriptedInput({ steps: [{ frame: 0, hold: [] as Action[] }] });
    const at: Record<string, number> = {};
    let placed = false;
    for (let f = 0; f < 2000 && at.exit === undefined; f++) {
      if (!placed && bowserOf(world)) {
        placed = true;
        const p = world.player.body;
        p.x = px(axe * 16 + 2);
        p.y = px(9 * 16) - p.h;
        world.camera.snapTo(p.x);
      }
      input.next();
      world.update([input]);
      for (const ev of world.events.splice(0)) if (ev.type === 'exit') at.exit = f;
      const n = world.castleText.length;
      if (n === 1 && at.thanks === undefined) at.thanks = f;
      if (world.castleText[2] === CASTLE_PAGES['1-4']?.reveal[0] && at.p1 === undefined) at.p1 = f;
      if (world.castleText[2] === CASTLE_PAGES['1-4']?.news[0] && at.p2 === undefined) at.p2 = f;
    }
    expect((at.p1 as number) - (at.thanks as number)).toBe(90);
    expect((at.p2 as number) - (at.p1 as number)).toBe(120);
    expect((at.exit as number) - (at.p2 as number)).toBeGreaterThanOrEqual(200);
  });

  it('every page fits the castle box', () => {
    for (const { reveal, news } of Object.values(CASTLE_PAGES)) {
      expect(reveal.length).toBeLessThanOrEqual(4);
      expect(news.length).toBeLessThanOrEqual(4);
    }
  });
});

describe('castle text outside the story (classic) and in the Lost castles', () => {
  it.each(SMB_CASTLES)('%s classic: "BUT OUR PRINCESS IS IN ANOTHER CASTLE!", no poof', (id, path) => {
    const r = clearCastle(load(path, id), false);
    expect(r.texts).toEqual([['THANK YOU MARIO!'], ['THANK YOU MARIO!', ...OLD_NEWS]]);
    expect(r.said).toEqual([]);
    expect(r.unmasked).toBeNull();
    expect(r.poofs).toBe(0);
    expect(r.sfx).not.toContain('poof');
  });

  it('8-4 classic: the princess and "YOUR QUEST IS OVER."', () => {
    const r = clearCastle(load('world8/8-4-end.map', '8-4-end'), false);
    expect(r.world.entities.some((e) => e instanceof Princess && e.alive)).toBe(true);
    expect(r.texts.at(-1)).toEqual(['THANK YOU MARIO!', '', 'YOUR QUEST IS OVER.']);
  });

  it('Lost 1-4 in the story keeps its text (Chapter 2), but the fake still unmasks', () => {
    const r = clearCastle(load('lost/world1/ll-1-4.map', 'll-1-4'), true);
    expect(r.texts).toEqual([['THANK YOU MARIO!'], ['THANK YOU MARIO!', ...OLD_NEWS]]);
    expect(r.unmasked).toBe('bowser-die-1');
    expect(r.sfx).toContain('poof');
  });
});

/** Beat the bridge's Bowser with five fireballs. */
function fireballs(level: LevelData, story: boolean, worldNo = level.world) {
  const { world, sfx } = makeWorld(level, story, { x: axeOf(level).x - 6, y: 8 });
  world.state.world = worldNo;
  const input = new ScriptedInput({ steps: [{ frame: 0, hold: [] as Action[] }] });
  for (let i = 0; i < 5 && !bowserOf(world); i++) {
    input.next();
    world.update([input]);
  }
  const b = bowserOf(world);
  if (!b) throw new Error('no Bowser');
  for (let i = 0; i < 5; i++) b.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, world);
  input.next();
  world.update([input]);
  const corpse = world.entities.find((e): e is Corpse => e instanceof Corpse);
  const poof = world.entities.some((e) => e instanceof WandPoof);
  return { corpse, poof, sfx, alive: b.alive };
}

describe('the fake Bowsers unmask (campaign)', () => {
  it('fireballs: the disguise bursts with a poof and the true form drops', () => {
    const r = fireballs(load('world3/3-4.map', '3-4'), true);
    expect(r.alive).toBe(false);
    expect(r.corpse?.frame).toBe('bowser-die-3');
    expect(r.poof).toBe(true);
    expect(r.sfx).toContain('poof');
  });

  it('fireballs in classic: the NES true form, no poof', () => {
    const r = fireballs(load('world3/3-4.map', '3-4'), false);
    expect(r.corpse?.frame).toBe('bowser-die-3');
    expect(r.poof).toBe(false);
    expect(r.sfx).not.toContain('poof');
  });

  it("8-4's real king never poofs", () => {
    const r = fireballs(load('world8/8-4-end.map', '8-4-end'), true);
    expect(r.corpse?.frame).toBe('bowser-die-8');
    expect(r.poof).toBe(false);
    expect(r.sfx).not.toContain('poof');
  });

  it("an off-bridge fake (the Lost Levels' kind) with a true form poofs too", () => {
    const level = load('lost/world1/ll-1-4.map', 'll-1-4');
    const { world, sfx } = makeWorld(level, true, { x: axeOf(level).x - 6, y: 8 });
    const b = new Bowser(axeOf(level).x - 10, 9, 'hammer', true);
    world.spawn(b);
    for (let i = 0; i < 5; i++) b.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, world);
    expect(b.alive).toBe(false);
    expect(world.entities.some((e) => e instanceof WandPoof)).toBe(true);
    expect(sfx).toContain('poof');
  });
});

/** Run a castle's Bowser for `frames` frames, the player parked well away. */
function tells(level: LevelData, story: boolean, frames = 600) {
  const { world } = makeWorld(level, story, { x: axeOf(level).x - 14, y: 8 });
  const input = new ScriptedInput({ steps: [{ frame: 0, hold: [] as Action[] }] });
  let shown = 0;
  let b: Bowser | undefined;
  for (let f = 0; f < frames; f++) {
    world.player.body.vx = 0;
    input.next();
    world.update([input]);
    b = bowserOf(world) ?? b;
    if (b?.tellShowing) shown++;
  }
  return { shown, bowser: b, world };
}

describe('the tell', () => {
  it('a fake flickers into its true form every ~4 s in the campaign', () => {
    const r = tells(load('world1/1-4.map', '1-4'), true, 600);
    expect(r.shown).toBeGreaterThan(0);
    // A few frames each time, not a constant reveal.
    expect(r.shown).toBeLessThan(30);
  });

  it('never in classic play, never for the real king', () => {
    expect(tells(load('world1/1-4.map', '1-4'), false).shown).toBe(0);
    expect(tells(load('world8/8-4-end.map', '8-4-end'), true).shown).toBe(0);
  });

  /** What Bowser draws, frame by frame: `name@sheet` per sprite (the sheet id carries its palette). */
  function drawnFrames(level: '1-4' | '8-4', story: boolean, reduceFlashing: boolean, frames = 520) {
    const lv = level === '8-4' ? load('world8/8-4-end.map', '8-4-end') : load('world1/1-4.map', '1-4');
    const r = tells(lv, story, 1);
    const b = r.bowser as Bowser;
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    let cur: string[] = [];
    const rec: Renderer = {
      clear() {},
      rect() {},
      text() {},
      debugText() {},
      line() {},
      sprite(s: SpriteSheet, f: string) {
        cur.push(`${f}@${s.id}`);
      },
    };
    const out: { draws: string[]; window: boolean; showing: boolean }[] = [];
    for (let i = 0; i < frames; i++) {
      b.update(r.world);
      cur = [];
      const view: View = { camX: r.world.camera.x, frame: i, assets, theme: 'castle', reduceFlashing };
      b.render(rec, view);
      out.push({ draws: cur, window: b.tellWindow, showing: b.tellShowing });
    }
    return out;
  }
  /** What Bowser draws over a few hundred frames, by frame name. */
  function drawn(story: boolean, reduceFlashing: boolean) {
    return new Set(
      drawnFrames('1-4', story, reduceFlashing, 260).flatMap((f) => f.draws.map((d) => d.split('@')[0] ?? d)),
    );
  }
  const bright = (d: string) => d.startsWith('bowser-ghost-') && d.endsWith('~tell');
  const king = (d: string) => /^bowser-[0-3]@/.test(d);

  it('flicker: the true form is drawn in its silhouette for a few frames', () => {
    const f = drawn(true, false);
    expect(f.has('bowser-die-1')).toBe(true);
    expect(f.has('bowser-ghost-1')).toBe(false);
  });

  it('reduce flashing: a steady bright outline over him for the tell window, never a flicker', () => {
    const frames = drawnFrames('1-4', true, true);
    const inWindow = frames.filter((f) => f.window);
    const outside = frames.filter((f) => !f.window);
    expect(inWindow.length).toBeGreaterThan(0);
    expect(outside.length).toBeGreaterThan(inWindow.length);
    // Every frame of the window: the king, then the bright true-form outline over him.
    for (const f of inWindow) {
      expect(f.draws.some(king)).toBe(true);
      expect(f.draws.at(-1)).toMatch(/^bowser-ghost-1@.*~tell$/);
      expect(f.draws.some((d) => d.startsWith('bowser-die-'))).toBe(false);
    }
    // Nothing alternates within the window (only the king's own walk frame may change).
    const shapes = new Set(inWindow.map((f) => f.draws.map((d) => (king(d) ? 'king' : d)).join()));
    expect(shapes.size).toBe(1);
    // Outside the window: just the king, no outline (bright or faint).
    for (const f of outside) expect(f.draws.every(king)).toBe(true);
  });

  it('reduce flashing off: the flicker is unchanged and the bright outline never drawn', () => {
    const frames = drawnFrames('1-4', true, false);
    for (const f of frames) {
      expect(f.draws.some(bright)).toBe(false);
      expect(f.draws.some((d) => d.startsWith('bowser-die-1@'))).toBe(f.showing);
    }
    // Within the window the flicker alternates between the king and his true form.
    const win = frames.filter((f) => f.window);
    expect(win.some((f) => f.showing)).toBe(true);
    expect(win.some((f) => !f.showing)).toBe(true);
  });

  it("the bright outline is one full-contrast colour: none of the king's, not black", () => {
    const pal = PALETTES.default['enemies-castle'] as readonly string[];
    const fx = PALETTES.fx?.tell;
    expect(fx).toBeDefined();
    const out = new Set(fx?.([...pal]));
    expect(out.size).toBe(1);
    const [c] = [...out];
    expect(pal).not.toContain(c);
    expect(c).not.toBe('#000000');
  });

  it('the real 8-4 king never shows it', () => {
    for (const rf of [true, false])
      for (const f of drawnFrames('8-4', true, rf)) expect(f.draws.every(king)).toBe(true);
  });

  it('classic: only the king is drawn', () => {
    const f = drawn(false, false);
    expect([...f].every((n) => /^bowser-[0-3]$/.test(n))).toBe(true);
  });
});

describe('8-4: Toad at the end (campaign only)', () => {
  it('campaignLevel swaps the princess for Toad; the map keeps the princess', () => {
    const level = load('world8/8-4-end.map', '8-4-end');
    const camp = campaignLevel(level, () => false);
    expect(camp.entities.some((e) => e.type === 'princess')).toBe(false);
    expect(camp.entities.find((e) => e.type === 'toad')).toMatchObject({ x: 57, y: 12 });
    expect(level.entities.find((e) => e.type === 'princess')).toMatchObject({ x: 57, y: 12 });
    const r = makeWorld(camp, true, { x: 50, y: 10 });
    r.world.update([new ScriptedInput({ steps: [] })]);
    expect(r.world.entities.some((e) => e instanceof Toad)).toBe(true);
  });

  it('the Lost 8-4 princess stays in the campaign', () => {
    const level = load('lost/world8/ll-8-4-end3.map', 'll-8-4-end3');
    const camp = campaignLevel(level, () => false);
    expect(camp.entities.some((e) => e.type === 'princess')).toBe(true);
  });
});

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

describe('8-4 credits', () => {
  it('the story adds "...BUT THE STORY ISN\'T OVER." right after THANKS FOR PLAYING', () => {
    const lines = creditsLines(true);
    const i = lines.indexOf('THANKS FOR PLAYING');
    // The game's name follows THANKS FOR PLAYING (two lines since the rebrand), then the story's lines.
    expect(lines.slice(i, i + 1 + CREDITS_NAME.length + STORY_NOT_OVER.length)).toEqual([
      'THANKS FOR PLAYING',
      ...CREDITS_NAME,
      ...STORY_NOT_OVER,
    ]);
    expect(CREDITS_NAME).toEqual(['SUPER MARIO BROS. CROSSOVER', 'REMIX']);
    expect(creditsLines(false)).toEqual(CREDITS);
  });

  function ending(campaign: boolean) {
    const said: string[] = [];
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    const game = new Game({
      ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
      getLevel,
      characters: CHARACTERS,
      announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
    });
    game.newGame(MARIO, '8-4-end');
    const input = new ScriptedInput({ steps: [] });
    for (let i = 0; i < 400 && !(game.scenes.top instanceof LevelScene); i++) {
      input.next();
      game.scenes.update([input]);
    }
    if (campaign) (game as unknown as { campaign: unknown }).campaign = { slot: 1 };
    game.showEnding('8-4');
    return { credits: game.scenes.top as CreditsScene, said };
  }

  it('campaign 8-4: the credits carry the line; classic: unchanged', () => {
    const story = ending(true);
    expect(story.credits).toBeInstanceOf(CreditsScene);
    expect(story.credits.lines).toEqual(creditsLines(true));
    const classic = ending(false);
    expect(classic.credits.lines).toEqual(CREDITS);
  });
});
